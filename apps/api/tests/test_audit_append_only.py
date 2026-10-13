"""§25: denetim izi yalnız eklenir; API'de silme/güncelleme ucu yoktur."""

from helpers import H, T, approved_record, create


def test_audit_grows_and_has_no_delete_surface(env):
    client, repo = env
    rec = create(client)
    n1 = len(client.get("/v1/audit", headers=H("tok-a-admin")).json()["data"])
    approved_record(client, key="k-2")
    events = client.get("/v1/audit", headers=H("tok-a-admin")).json()["data"]
    assert len(events) > n1
    assert [e["id"] for e in events] == sorted(e["id"] for e in events)
    assert {"activity.create", "calculation.run", "activity.submit", "approval.approve"} <= {e["action"] for e in events}
    assert all(e["request_id"] for e in events)

    assert client.delete("/v1/audit", headers=H("tok-a-admin")).status_code == 405
    assert client.delete(f"/v1/activities/{rec['id']}", headers=H("tok-a-admin")).status_code == 405
    assert client.put(f"/v1/activities/{rec['id']}", json={}, headers=H("tok-a-admin")).status_code == 405
    assert not [n for n in dir(repo) if n.startswith(("delete_", "update_audit", "remove_"))]


def test_audit_requires_role_and_is_tenant_scoped(env):
    client, _ = env
    rec = create(client)
    assert client.get("/v1/audit", headers=H("tok-a-entry")).status_code == 403
    assert client.get("/v1/audit", headers=H("tok-a-viewer")).status_code == 200
    b = client.get("/v1/audit", headers=H("tok-b-admin", T.TENANT_B)).json()["data"]
    assert rec["id"] not in {e["object_id"] for e in b}
