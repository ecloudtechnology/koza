"""§11/§27 içe aktarma: 202 + job_id, satır hataları açıklamalı, aynı dosya/satır ikinci kayıt yaratmaz, geri alma yalnız taslak."""

import io

from helpers import FACTOR_V1, H, METHOD, T, calculate

CSV = (
    "source_type;fuel;quantity;unit;heating_value_basis;activity_start;activity_end;data_quality\n"
    "stationary_combustion;natural_gas;100;GJ;LHV;2026-01-01;2026-01-31;measured\n"
    "stationary_combustion;natural_gas;12,5;GJ;LHV;2026-02-01;2026-02-28;estimated\n"
    "stationary_combustion;natural_gas;1.234;GJ;LHV;2026-03-01;2026-03-31;measured\n"   # belirsiz sayı → hata
    "stationary_combustion;natural_gas;;GJ;LHV;2026-04-01;2026-04-30;measured\n"        # miktar yok → unknown (sıfır değil)
    "stationary_combustion;natural_gas;-5;GJ;LHV;2026-05-01;2026-05-31;measured\n"      # negatif → hata
    "stationary_combustion;natural_gas;100;GJ;LHV;2026-01-01;2026-01-31;measured\n"     # 1. satırın aynısı → duplicate
)


def _upload(client, csv_text=CSV, token="tok-a-entry", preview=False, name="ocak.csv"):
    files = {"file": (name, io.BytesIO(csv_text.encode("utf-8")), "text/csv")}
    return client.post("/v1/imports" + ("?preview=true" if preview else ""), files=files, data={"period_id": T.PERIOD_A}, headers=H(token))


def test_preview_reports_rows_without_creating_records(env):
    client, repo = env
    r = _upload(client, preview=True)
    assert r.status_code == 202, r.text
    d = r.json()["data"]
    assert d["job_id"] and d["status"] == "preview" and d["mode"] == "preview"
    statuses = [row["status"] for row in d["rows"]]
    assert statuses == ["valid", "valid", "error", "valid", "error", "duplicate"]
    assert "belirsiz" in d["rows"][2]["errors"][0]["message"].lower()
    assert d["rows"][4]["errors"][0]["field"].endswith("quantity") or d["rows"][4]["errors"]
    assert d["summary"] == {"rows": 6, "created": 0, "valid": 3, "duplicate": 1, "error": 2}
    assert repo.list_records(T.TENANT_A) == []
    assert client.get(f"/v1/imports/{d['job_id']}", headers=H("tok-a-viewer")).status_code == 200


def test_apply_creates_only_valid_rows_and_rerun_is_idempotent(env):
    client, repo = env
    r = _upload(client)
    assert r.status_code == 202, r.text
    d = r.json()["data"]
    assert d["status"] == "done" and d["summary"]["created"] == 3 and d["summary"]["error"] == 2 and d["summary"]["duplicate"] == 1
    created = [row["record_id"] for row in d["rows"] if row["status"] == "created"]
    assert len(created) == 3 and all(created)
    recs = {rec.id: rec for rec in repo.list_records(T.TENANT_A)}
    assert set(recs) == set(created)
    by_row = {row["row_no"]: row for row in d["rows"]}
    assert recs[by_row[2]["record_id"]].current.quantity == "12.5"  # virgül ondalık kabul edildi
    assert recs[by_row[4]["record_id"]].current.quantity is None and recs[by_row[4]["record_id"]].current.quantity_state == "unknown"
    assert all(rec.current.state == "draft" and rec.current.transition == "import" for rec in recs.values())

    # aynı dosya yeniden → aynı iş, kayıt sayısı değişmez
    r2 = _upload(client, token="tok-a-entry2")
    assert r2.status_code == 202 and r2.json()["meta"]["idempotent_replay"] is True
    assert r2.json()["data"]["job_id"] == d["job_id"]
    assert len(repo.list_records(T.TENANT_A)) == 3

    # aynı satırlar farklı dosyada (başka ad/sıra) → duplicate, ikinci kayıt yok
    r3 = _upload(client, csv_text=CSV.replace("12,5", "12.5"), name="subat.csv")
    assert r3.status_code == 202 and r3.json()["meta"].get("idempotent_replay") is None
    assert r3.json()["data"]["summary"]["created"] == 0 and r3.json()["data"]["summary"]["duplicate"] == 4
    assert len(repo.list_records(T.TENANT_A)) == 3
    audit = client.get("/v1/audit", headers=H("tok-a-admin")).json()["data"]
    assert any(e["action"] == "import.apply" and e["object_id"] == d["job_id"] for e in audit)


def test_json_rows_and_row_errors_with_reasons(env):
    client, _ = env
    body = {"period_id": T.PERIOD_A, "rows": [
        {"source_type": "stationary_combustion", "fuel": "natural_gas", "quantity": "7", "unit": "GJ", "activity_start": "2026-01-01", "activity_end": "2026-01-02"},
        {"source_type": "stationary_combustion", "quantity": "7", "unit": "GJ", "activity_start": "2026-01-05", "activity_end": "2026-01-02"},
        {"source_type": "stationary_combustion", "quantity": "7", "tenant_id": T.TENANT_B, "unit": "GJ", "activity_start": "2026-01-01", "activity_end": "2026-01-02"},
    ]}
    r = client.post("/v1/imports", json=body, headers=H("tok-a-owner"))
    assert r.status_code == 202, r.text
    rows = r.json()["data"]["rows"]
    assert [x["status"] for x in rows] == ["created", "error", "error"]
    assert "activity_end" in rows[1]["errors"][0]["message"] or rows[1]["errors"]
    assert rows[2]["errors"][0]["field"] == "tenant_id"
    assert client.post("/v1/imports", json=body, headers=H("tok-a-viewer")).status_code == 403


def test_rollback_withdraws_only_drafts(env):
    client, repo = env
    d = _upload(client).json()["data"]
    created = [row["record_id"] for row in d["rows"] if row["status"] == "created"]
    calculate(client, created[0])  # artık taslak değil
    r = client.post(f"/v1/imports/{d['job_id']}/rollback", json={"reason": "kısa"}, headers=H("tok-a-owner"))
    assert r.status_code == 422
    r = client.post(f"/v1/imports/{d['job_id']}/rollback", json={"reason": "Yanlış dönem dosyası yüklendi."}, headers=H("tok-a-entry"))
    assert r.status_code == 403
    r = client.post(f"/v1/imports/{d['job_id']}/rollback", json={"reason": "Yanlış dönem dosyası yüklendi."}, headers=H("tok-a-owner"))
    assert r.status_code == 200, r.text
    out = r.json()["data"]
    assert out["status"] == "rolled_back" and set(out["withdrawn"]) == set(created[1:])
    assert out["kept"] == [{"record_id": created[0], "state": "calculated"}]
    assert {rec.id for rec in repo.list_records(T.TENANT_A)} == {created[0]}
    assert client.get(f"/v1/activities/{created[1]}", headers=H("tok-a-entry")).status_code == 404
    # ikinci geri alma reddedilir; geri çekilen satırlar yeniden içe aktarılabilir (tekrar kayıt yaratır)
    assert client.post(f"/v1/imports/{d['job_id']}/rollback", json={"reason": "Yanlış dönem dosyası yüklendi."}, headers=H("tok-a-owner")).status_code == 409
    r = _upload(client)
    assert r.json()["data"]["summary"]["created"] == 2 and r.json()["data"]["summary"]["duplicate"] == 2
    assert len(repo.list_records(T.TENANT_A)) == 3


def test_import_is_tenant_scoped_and_period_checked(env):
    client, repo = env
    files = {"file": ("x.csv", io.BytesIO(CSV.encode()), "text/csv")}
    r = client.post("/v1/imports", files=files, data={"period_id": T.PERIOD_A}, headers=H("tok-b-entry", T.TENANT_B))
    assert r.status_code == 422 and r.json()["field_errors"][0]["field"] == "period_id"
    assert repo.list_records(T.TENANT_A) == [] and repo.list_records(T.TENANT_B) == []
    d = _upload(client).json()["data"]
    assert client.get(f"/v1/imports/{d['job_id']}", headers=H("tok-b-admin", T.TENANT_B)).status_code == 404
