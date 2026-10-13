"""T17: kilitli dönem düzenleme → yetkili yeniden açma akışı gerekir. §21: yeniden açma eski raporu silemez."""

from helpers import FACTOR_V1, H, METHOD, T, activity_body, approved_record, create


def _lock(client):
    r = client.post(f"/v1/periods/{T.PERIOD_A}/lock", headers=H("tok-a-admin"))
    assert r.status_code == 200, r.text
    return r.json()["data"]


def test_lock_requires_all_records_approved(env):
    client, _ = env
    create(client)  # taslak
    r = client.post(f"/v1/periods/{T.PERIOD_A}/lock", headers=H("tok-a-admin"))
    assert r.status_code == 409
    assert r.json()["code"] == "PERIOD_NOT_READY"


def test_lock_requires_admin(env):
    client, _ = env
    approved_record(client)
    for tok in ("tok-a-entry", "tok-a-approver", "tok-a-reviewer"):
        assert client.post(f"/v1/periods/{T.PERIOD_A}/lock", headers=H(tok)).status_code == 403


def test_locked_period_blocks_every_edit_and_points_to_reopen(env):
    client, _ = env
    rec = approved_record(client)
    report = client.post("/v1/reports", json={"period_id": T.PERIOD_A}, headers=H("tok-a-admin")).json()["data"]
    period = _lock(client)
    assert period["status"] == "locked"

    current = client.get(f"/v1/activities/{rec['id']}", headers=H("tok-a-entry")).json()["data"]
    assert current["state"] == "locked"

    r = client.patch(f"/v1/activities/{rec['id']}", json={"quantity": "999"},
                     headers=H("tok-a-owner", **{"If-Match": f'"{current["version"]}"'}))
    assert r.status_code == 409
    err = r.json()
    assert err["code"] == "PERIOD_LOCKED"
    assert err["details"]["reopen_path"] == f"/v1/periods/{T.PERIOD_A}/reopen"
    assert err["details"]["reason_required"] is True

    r = client.post(f"/v1/activities/{rec['id']}/calculate", json={"factor_refs": [FACTOR_V1], "method": METHOD}, headers=H("tok-a-entry"))
    assert r.status_code == 409 and r.json()["code"] == "PERIOD_LOCKED"
    r = client.post(f"/v1/activities/{rec['id']}/submit", headers=H("tok-a-entry"))
    assert r.status_code == 409 and r.json()["code"] == "PERIOD_LOCKED"
    r = client.post("/v1/approvals", json={"record_id": rec["id"], "expected_version": current["version"], "decision": "approve"}, headers=H("tok-a-approver"))
    assert r.status_code == 409 and r.json()["code"] == "PERIOD_LOCKED"

    # yeni kayıt da kilitli döneme eklenemez
    r = client.post("/v1/activities", json={**activity_body()}, headers=H("tok-a-entry", **{"Idempotency-Key": "k-locked"}))
    assert r.status_code == 409 and r.json()["code"] == "PERIOD_LOCKED"

    # yeniden açma: gerekçe zorunlu, yalnız admin
    r = client.post(f"/v1/periods/{T.PERIOD_A}/reopen", json={"reason": "kısa"}, headers=H("tok-a-admin"))
    assert r.status_code == 422 and r.json()["code"] == "REASON_REQUIRED"
    r = client.post(f"/v1/periods/{T.PERIOD_A}/reopen", json={"reason": "Fatura düzeltmesi geldi, miktar değişecek."}, headers=H("tok-a-approver"))
    assert r.status_code == 403
    r = client.post(f"/v1/periods/{T.PERIOD_A}/reopen",
                    json={"reason": "Fatura düzeltmesi geldi, miktar değişecek.", "impact_note": "Ocak kaydı etkilenir"},
                    headers=H("tok-a-admin"))
    assert r.status_code == 200, r.text
    period = r.json()["data"]
    assert period["status"] == "open"
    assert period["reopens"][0]["reason"].startswith("Fatura")
    assert period["reopens"][0]["approved_by"] == T.USERS["a_admin"]

    # eski rapor korunur
    r = client.get(f"/v1/reports/{report['id']}", headers=H("tok-a-admin"))
    assert r.status_code == 200 and r.json()["data"]["manifest_sha256"] == report["manifest_sha256"]

    # kayıt onaylı duruma döner; veri değişince olağan akışla onay geçersizleşir
    current = client.get(f"/v1/activities/{rec['id']}", headers=H("tok-a-entry")).json()["data"]
    assert current["state"] == "approved"
    r = client.patch(f"/v1/activities/{rec['id']}", json={"quantity": "999", "change_reason": "düzeltilmiş fatura"},
                     headers=H("tok-a-owner", **{"If-Match": f'"{current["version"]}"'}))
    assert r.status_code == 200
    assert r.json()["data"]["state"] == "validation_required"

    audit = client.get("/v1/audit", headers=H("tok-a-admin")).json()["data"]
    actions = [e["action"] for e in audit]
    assert "period.lock" in actions and "period.reopen" in actions
    reopen_evt = next(e for e in audit if e["action"] == "period.reopen")
    assert report["id"] in reopen_evt["payload"]["retained_reports"]
