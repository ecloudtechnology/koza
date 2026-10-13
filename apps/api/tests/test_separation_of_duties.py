"""§04 görevlerin ayrılığı: veri giren ile onaylayan varsayılan olarak farklıdır; istisna gerekçeli."""

import pytest

from helpers import H, calculate, create, submit


def _in_review(client, token="tok-a-entry"):
    rec = create(client, token=token)
    calculate(client, rec["id"], token=token)
    return submit(client, rec["id"], token=token)


def _decide(client, rec, token, decision="approve", **extra):
    return client.post("/v1/approvals", json={"record_id": rec["id"], "expected_version": rec["version"], "decision": decision, **extra}, headers=H(token))


def test_author_cannot_approve_own_record_by_default(env):
    client, _ = env
    rec = _in_review(client, token="tok-a-entry-approver")  # aynı kullanıcı: veri giren + onaylayan
    r = _decide(client, rec, "tok-a-entry-approver")
    assert r.status_code == 403
    assert r.json()["code"] == "SELF_APPROVAL_FORBIDDEN"
    r = _decide(client, rec, "tok-a-approver")  # farklı kişi
    assert r.status_code == 201
    assert r.json()["data"]["activity"]["state"] == "approved"
    assert r.json()["data"]["approval"]["self_approval"] is False


@pytest.mark.parametrize("env", [True], indirect=True)
def test_self_approval_allowed_with_policy_and_reason(env):
    client, _ = env
    rec = _in_review(client, token="tok-a-entry-approver")
    r = _decide(client, rec, "tok-a-entry-approver")
    assert r.status_code == 422 and r.json()["code"] == "SELF_APPROVAL_REASON_REQUIRED"
    r = _decide(client, rec, "tok-a-entry-approver", self_approval_reason="Küçük ekip istisnası; müdür onayı e-postada.")
    assert r.status_code == 201, r.text
    approval = r.json()["data"]["approval"]
    assert approval["self_approval"] is True and approval["self_approval_reason"].startswith("Küçük ekip")
    audit = client.get("/v1/audit", params={"object_id": rec["id"]}, headers=H("tok-a-admin")).json()["data"]
    evt = next(e for e in audit if e["action"] == "approval.approve")
    assert evt["payload"]["self_approval"] is True


def test_role_matrix_for_decisions(env):
    client, _ = env
    rec = _in_review(client)
    assert _decide(client, rec, "tok-a-admin").status_code == 403  # admin teknik onay veremez
    assert _decide(client, rec, "tok-a-reviewer").status_code == 403  # kontrolör onaylayamaz
    assert _decide(client, rec, "tok-a-entry").status_code == 403
    assert _decide(client, rec, "tok-a-viewer").status_code == 403
    r = _decide(client, rec, "tok-a-reviewer", decision="request_changes", comment="Kanıt eksik")
    assert r.status_code == 201
    assert r.json()["data"]["activity"]["state"] == "changes_requested"
    # artık in_review değil → onay denemesi durum çakışması
    rec2 = r.json()["data"]["activity"]
    r = _decide(client, rec2, "tok-a-approver")
    assert r.status_code == 409 and r.json()["code"] == "STATE_CONFLICT"


def test_approve_requires_in_review_state(env):
    client, _ = env
    rec = create(client)
    r = _decide(client, rec, "tok-a-approver")
    assert r.status_code == 409 and r.json()["code"] == "STATE_CONFLICT"
