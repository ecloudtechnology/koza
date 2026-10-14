"""§25: hız sınırı (429 retryable), CSV formül temizliği, oturum iptali, admin MFA politikası, rol değişimi audit'i,
webhook imzası + staging tekilliği."""

import json
import time

from fastapi.testclient import TestClient

from koza_api import testing as T
from koza_api.security import SecurityPolicy, TokenBucketLimiter, csv_safe
from koza_api.webhooks import compute_signature

from helpers import CATALOG, H, approved_record, create


def test_rate_limit_token_bucket_returns_429_retryable():
    policy = SecurityPolicy(admin_mfa_required=False, rate_limit_rps=1, rate_limit_burst=3, evidence_max_bytes=10,
                            evidence_allowed_types=frozenset(), signed_url_ttl=60, signed_url_max_ttl=60)
    app, _ = T.build_app(CATALOG, security=policy)
    with TestClient(app) as client:
        codes = [client.get("/v1/periods", headers=H("tok-a-entry")).status_code for _ in range(5)]
        assert codes[:3] == [200, 200, 200] and codes[3] == 429
        r = client.get("/v1/periods", headers=H("tok-a-entry"))
        assert r.json()["code"] == "RATE_LIMITED" and r.json()["retryable"] is True and r.headers["Retry-After"]
        assert client.get("/v1/periods", headers=H("tok-a-viewer")).status_code == 200  # başka asıl etkilenmez
        assert client.get("/healthz").status_code == 200  # sağlık ucu sınır dışı
    lim = TokenBucketLimiter(rps=10, burst=2)
    assert lim.acquire("k", now=0.0)[0] and lim.acquire("k", now=0.0)[0] and not lim.acquire("k", now=0.0)[0]
    assert lim.acquire("k", now=0.2)[0]  # 0.2 sn sonra 2 jeton dolar


def test_csv_export_sanitizes_formulas_and_keeps_value_states(env):
    client, _ = env
    rec = approved_record(client, note="=HYPERLINK(\"http://kotu\")")
    create(client, key="k-u", quantity=None, quantity_state="unknown", fuel="+cmd")
    create(client, key="k-z", quantity="0", note="@SUM(1)")
    assert client.get("/v1/exports/activities.csv", headers=H("tok-a-entry")).status_code == 403
    r = client.get("/v1/exports/activities.csv", params={"period_id": T.PERIOD_A}, headers=H("tok-a-viewer"))
    assert r.status_code == 200 and r.headers["content-type"].startswith("text/csv")
    text = r.content.decode("utf-8-sig")
    lines = text.strip().split("\r\n")
    assert lines[0].startswith("record_id,period_id,state,version") and len(lines) == 4
    assert "'=HYPERLINK" in text and "'+cmd" in text and "'@SUM(1)" in text and ",=HYPERLINK" not in text
    rows = {l.split(",")[0]: l for l in lines[1:]}
    approved_line = rows[rec["id"]]
    assert ",approved," in approved_line and ",100,known," in approved_line and ",5000," in approved_line
    assert any(",,unknown," in l for l in lines[1:]) and any(",0,known," in l for l in lines[1:])
    audit = client.get("/v1/audit", headers=H("tok-a-admin")).json()["data"]
    assert any(e["action"] == "export.csv" and e["payload"]["rows"] == 3 for e in audit)
    assert client.get("/v1/exports/activities.csv", params={"period_id": T.PERIOD_B}, headers=H("tok-a-viewer")).status_code == 404
    assert csv_safe("-5") == "'-5" and csv_safe("abc") == "abc" and csv_safe(None) == ""


def test_session_revocation_blocks_token_and_is_audited(env):
    client, _ = env
    me = client.get("/v1/sessions/me", headers=H("tok-a-entry")).json()["data"]
    assert me["roles"] == ["data_entry"] and me["jti"].startswith("dev-") and me["mfa_verified"] is True
    r = client.post("/v1/sessions/revoke", json={"jti": me["jti"]}, headers=H("tok-a-entry2"))
    assert r.status_code == 403  # başka oturumu sıradan kullanıcı sonlandıramaz
    r = client.post("/v1/sessions/revoke", json={"reason": "çıkış"}, headers=H("tok-a-entry"))
    assert r.status_code == 200 and r.json()["data"]["jti"] == me["jti"]
    r = client.get("/v1/periods", headers=H("tok-a-entry"))
    assert r.status_code == 401 and r.json()["code"] == "SESSION_REVOKED"
    # admin ayrılan çalışanın oturumunu kapatır
    me2 = client.get("/v1/sessions/me", headers=H("tok-a-entry2")).json()["data"]
    assert client.post("/v1/sessions/revoke", json={"jti": me2["jti"]}, headers=H("tok-a-admin")).status_code == 200
    assert client.get("/v1/periods", headers=H("tok-a-entry2")).status_code == 401
    audit = client.get("/v1/audit", headers=H("tok-a-admin")).json()["data"]
    assert sum(1 for e in audit if e["action"] == "session.revoke") == 2
    assert any(e["action"] == "session.login" and e["actor_id"] == T.USERS["a_entry"] for e in audit)


def test_admin_mfa_policy_and_membership_change_audit(env):
    client, repo = env
    # MFA doğrulanmamış admin: yönetici işlemleri 403 MFA_REQUIRED, okuma serbest
    r = client.post("/v1/periods", json={"start_date": "2027-01-01", "end_date": "2027-12-31"}, headers=H("tok-a-admin-nomfa"))
    assert r.status_code == 403 and r.json()["code"] == "MFA_REQUIRED"
    assert client.get("/v1/periods", headers=H("tok-a-admin-nomfa")).status_code == 200
    r = client.post("/v1/memberships", json={"user_id": T.USERS["a_viewer"], "role": "reviewer", "action": "grant"}, headers=H("tok-a-admin-nomfa"))
    assert r.status_code == 403 and r.json()["code"] == "MFA_REQUIRED"
    assert client.post("/v1/periods", json={"start_date": "2027-01-01", "end_date": "2027-12-31"}, headers=H("tok-a-admin")).status_code == 201
    # rol değişimi: yalnız admin, audit'e yazılır, depoda etkili
    assert client.post("/v1/memberships", json={"user_id": T.USERS["a_viewer"], "role": "reviewer", "action": "grant"}, headers=H("tok-a-approver")).status_code == 403
    r = client.post("/v1/memberships", json={"user_id": T.USERS["a_viewer"], "role": "reviewer", "action": "grant", "reason": "terfi"}, headers=H("tok-a-admin"))
    assert r.status_code == 200, r.text
    assert r.json()["data"]["roles"] == ["reviewer", "viewer"] and r.json()["meta"]["effective_for_dev_tokens"] is False
    assert repo.get_membership_roles(T.TENANT_A, T.USERS["a_viewer"]) == {"reviewer", "viewer"}
    r = client.post("/v1/memberships", json={"user_id": T.USERS["a_viewer"], "role": "viewer", "action": "revoke"}, headers=H("tok-a-admin"))
    assert r.json()["data"]["roles"] == ["reviewer"]
    assert client.post("/v1/memberships", json={"user_id": "00000000-0000-4000-8000-00000000dead", "role": "viewer", "action": "grant"}, headers=H("tok-a-admin")).status_code == 422
    assert client.post("/v1/memberships", json={"user_id": T.USERS["a_admin"], "role": "admin", "action": "revoke"}, headers=H("tok-a-admin")).status_code == 409
    members = client.get("/v1/memberships", headers=H("tok-a-admin")).json()["data"]
    assert {"user_id": T.USERS["a_viewer"], "roles": ["reviewer"]} in members
    audit = client.get("/v1/audit", params={"object_id": T.USERS["a_viewer"]}, headers=H("tok-a-admin")).json()["data"]
    assert [e["payload"]["action"] for e in audit if e["action"] == "membership.change"] == ["grant", "revoke"]


def test_webhook_signature_and_staging_dedupe(env):
    client, _ = env
    client.app.state.webhook_secrets = {"erp": "cok-gizli-sir"}
    body = json.dumps({"event_id": "evt-1", "mapping_version": "m1", "pulled_at": "2026-10-01T10:00:00Z",
                       "rows": [{"external_id": "INV-1", "payload": {"amount": "100"}}, {"external_id": "INV-2", "payload": {"amount": "5"}}]}).encode()
    ts = str(int(time.time()))
    sig = compute_signature("cok-gizli-sir", ts, body)
    hdr = lambda **x: H("tok-a-entry", **{"Content-Type": "application/json", "X-Koza-Timestamp": ts, "X-Koza-Signature": sig, **x})
    r = client.post("/v1/integrations/meter/events", content=body, headers=hdr())
    assert r.status_code == 503 and r.json()["code"] == "WEBHOOK_SECRET_MISSING"
    r = client.post("/v1/integrations/erp/events", content=body, headers=hdr(**{"X-Koza-Signature": "sha256=00"}))
    assert r.status_code == 401 and r.json()["details"]["reason"] == "signature_mismatch"
    old = str(int(time.time()) - 3600)
    r = client.post("/v1/integrations/erp/events", content=body, headers=hdr(**{"X-Koza-Timestamp": old, "X-Koza-Signature": compute_signature("cok-gizli-sir", old, body)}))
    assert r.status_code == 401 and r.json()["details"]["reason"] == "stale"
    r = client.post("/v1/integrations/erp/events", content=body + b" ", headers=hdr())
    assert r.status_code == 401  # gövde değişti → imza tutmaz
    r = client.post("/v1/integrations/erp/events", content=body, headers=hdr())
    assert r.status_code == 202, r.text
    assert r.json()["data"]["accepted"] == ["INV-1", "INV-2"] and r.json()["data"]["duplicates"] == []
    r = client.post("/v1/integrations/erp/events", content=body, headers=hdr())  # aynı olay yeniden
    assert r.status_code == 202 and r.json()["data"]["accepted"] == [] and r.json()["data"]["duplicates"] == ["INV-1", "INV-2"]
    staging = client.get("/v1/integrations/staging", params={"source_system": "erp"}, headers=H("tok-a-viewer")).json()
    assert staging["meta"]["count"] == 2 and staging["data"][0]["mapping_version"] == "m1" and staging["data"][0]["pulled_at"]
    status = client.get("/v1/integrations/status", headers=H("tok-a-viewer")).json()["data"]
    assert status[0]["source_system"] == "erp" and status[0]["pending"] == 2 and status[0]["last_received_at"]
    assert client.get("/v1/integrations/staging", headers=H("tok-b-admin", T.TENANT_B)).json()["meta"]["count"] == 0
    assert client.post("/v1/integrations/erp/events", content=body, headers={**hdr(), "Authorization": "Bearer tok-a-viewer"}).status_code == 403
