"""§18 / T13: faktör sürümü ekleme (uzman kontrolör, source_ref zorunlu) ve etkinleştirme eski koşumları değiştirmez."""

from helpers import FACTOR_V1, FACTOR_V2, H, T, approved_record, create

NEW = {"version": "3.0", "value": "60", "numerator_unit": "kg", "gas": "CO2", "denominator_unit": "GJ", "basis": "LHV",
       "boundary": "combustion", "source_ref": "Kurgusal Yayıncı 2026, Tablo 2", "license": "CC-BY-4.0", "valid_from": "2026-09-01"}


def test_catalog_listing_and_version_create_rules(env):
    client, _ = env
    r = client.get("/v1/factors", headers=H("tok-a-viewer"))
    assert r.status_code == 200 and r.json()["meta"]["count"] == 3
    assert client.get("/v1/factors", params={"factor_id": "TEST-NG-CO2"}, headers=H("tok-a-editor")).json()["meta"]["count"] == 2
    assert client.get("/v1/factors/YOK/versions", headers=H("tok-a-viewer")).status_code == 404
    for tok in ("tok-a-admin", "tok-a-entry", "tok-a-approver", "tok-a-editor"):
        assert client.post("/v1/factors/TEST-NG-CO2/versions", json=NEW, headers=H(tok)).status_code == 403
    r = client.post("/v1/factors/TEST-NG-CO2/versions", json={**NEW, "source_ref": " "}, headers=H("tok-a-reviewer"))
    assert r.status_code == 422 and any("source_ref" in fe["field"] for fe in r.json()["field_errors"])
    r = client.post("/v1/factors/TEST-NG-CO2/versions", json={**NEW, "value": 60}, headers=H("tok-a-reviewer"))
    assert r.status_code == 422  # sayı değil, ondalık dize
    r = client.post("/v1/factors/TEST-NG-CO2/versions", json={**NEW, "license": "test-only"}, headers=H("tok-a-reviewer"))
    assert r.status_code == 422  # kural 12
    r = client.post("/v1/factors/TEST-NG-CO2/versions", json=NEW, headers=H("tok-a-reviewer"))
    assert r.status_code == 201, r.text
    assert r.json()["data"]["status"] == "draft" and r.json()["data"]["value"] == "60"
    assert client.post("/v1/factors/TEST-NG-CO2/versions", json=NEW, headers=H("tok-a-reviewer")).status_code == 409
    methods = client.get("/v1/methods", headers=H("tok-a-viewer")).json()["data"]
    assert methods["methods"][0]["id"] == "ghgp-corporate-test"


def test_activate_lists_affected_records_without_changing_old_runs(env):
    client, repo = env
    rec = approved_record(client)
    old_run = rec["approved_run_id"]
    draft = create(client, key="k-draft")  # koşumsuz kayıt etkilenmez
    assert client.post("/v1/factors/TEST-NG-CO2/versions/2.0/activate", headers=H("tok-a-admin")).status_code == 403
    r = client.post("/v1/factors/TEST-NG-CO2/versions/2.0/activate", headers=H("tok-a-reviewer"))
    assert r.status_code == 200, r.text
    d = r.json()["data"]
    assert d["factor"]["status"] == "active" and d["factor"]["activated_by"] == T.USERS["a_reviewer"]
    assert d["retired_versions"] == ["1.0"]
    assert [a["record_id"] for a in d["affected_records"]] == [rec["id"]]
    aff = d["affected_records"][0]
    assert aff["factor_version_used"] == "1.0" and aff["approved_run_id"] == old_run and aff["state"] == "approved"
    assert draft["id"] not in [a["record_id"] for a in d["affected_records"]]

    # eski koşum ve onay aynen durur
    current = client.get(f"/v1/activities/{rec['id']}", headers=H("tok-a-viewer")).json()["data"]
    assert current["state"] == "approved" and current["approved_run_id"] == old_run
    runs = client.get(f"/v1/activities/{rec['id']}/runs", headers=H("tok-a-viewer")).json()["data"]
    assert len(runs) == 1 and runs[0]["factor_refs"] == [FACTOR_V1] and runs[0]["result"]["total_co2e_kg"] == "5000"
    assert repo.get_factor("TEST-NG-CO2", "1.0")["status"] == "retired"
    assert client.post("/v1/factors/TEST-NG-CO2/versions/1.0/activate", headers=H("tok-a-reviewer")).status_code == 409
    audit = client.get("/v1/audit", params={"object_id": "TEST-NG-CO2"}, headers=H("tok-a-admin")).json()["data"]
    evt = next(e for e in audit if e["action"] == "factor.activate")
    assert evt["payload"]["version"] == "2.0" and evt["payload"]["affected_records"] == 1
    # yeniden hesap: yeni koşum öneri olarak eklenir, onay değişmez (T13)
    r = client.post(f"/v1/activities/{rec['id']}/calculate", json={"factor_refs": [FACTOR_V2], "method": {"id": "ghgp-corporate-test", "version": "0.1"}}, headers=H("tok-a-reviewer"))
    assert r.status_code == 201 and r.json()["data"]["record_state"] == "approved"
