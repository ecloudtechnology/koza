"""§21: veri değişirse önceki onay geçersizleşir; kullanıcıya yeniden inceleme bildirilir."""

from helpers import H, T, approved_record


def test_edit_after_approval_invalidates_and_audits(env):
    client, repo = env
    rec = approved_record(client)
    assert rec["state"] == "approved" and rec["approved_run_id"]

    r = client.patch(f"/v1/activities/{rec['id']}", json={"quantity": "110", "change_reason": "sayaç okuması düzeltildi"},
                     headers=H("tok-a-owner", **{"If-Match": f'"{rec["version"]}"'}))
    assert r.status_code == 200, r.text
    data, meta = r.json()["data"], r.json()["meta"]
    assert data["state"] == "validation_required"
    assert data["approved_run_id"] is None
    assert data["latest_run_id"] is None  # eski koşum yeni veri sürümüne ait değil
    assert meta["approval_invalidated"] is True and meta["review_required"] is True

    # eski koşum silinmedi, listede durur ama güncel veriye ait değil
    runs = client.get(f"/v1/activities/{rec['id']}/runs", headers=H("tok-a-reviewer")).json()["data"]
    assert len(runs) == 1 and runs[0]["is_current_data"] is False

    audit = client.get("/v1/audit", params={"object_id": rec["id"]}, headers=H("tok-a-admin")).json()["data"]
    assert any(e["action"] == "approval.invalidated" for e in audit)
    # onay satırı değişmedi (append-only), yalnız geçerliliğini yitirdi
    assert len(repo.list_approvals(T.TENANT_A, rec["id"])) == 1


def test_data_entry_cannot_edit_approved_record(env):
    client, _ = env
    rec = approved_record(client)
    r = client.patch(f"/v1/activities/{rec['id']}", json={"quantity": "110"},
                     headers=H("tok-a-entry", **{"If-Match": f'"{rec["version"]}"'}))
    assert r.status_code == 403
    current = client.get(f"/v1/activities/{rec['id']}", headers=H("tok-a-entry")).json()["data"]
    assert current["state"] == "approved" and current["quantity"] == "100"


def test_edit_in_review_is_state_conflict(env):
    client, _ = env
    from helpers import calculate, create, submit
    rec = create(client)
    calculate(client, rec["id"])
    sub = submit(client, rec["id"])
    r = client.patch(f"/v1/activities/{rec['id']}", json={"quantity": "5"},
                     headers=H("tok-a-entry", **{"If-Match": f'"{sub["version"]}"'}))
    assert r.status_code == 409 and r.json()["code"] == "STATE_CONFLICT"
