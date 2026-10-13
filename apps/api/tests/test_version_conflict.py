"""T18: iki kullanıcı aynı sürümü değiştiriyor → çakışma, sessiz veri kaybı yok."""

from helpers import H, create


def test_second_writer_on_stale_version_gets_409_with_current_version(env):
    client, _ = env
    rec = create(client)
    assert rec["version"] == 1

    r1 = client.patch(f"/v1/activities/{rec['id']}", json={"quantity": "120"}, headers=H("tok-a-entry", **{"If-Match": '"1"'}))
    assert r1.status_code == 200, r1.text
    assert r1.json()["data"]["version"] == 2
    assert r1.headers["ETag"] == '"2"'

    r2 = client.patch(f"/v1/activities/{rec['id']}", json={"quantity": "130"}, headers=H("tok-a-entry2", **{"If-Match": '"1"'}))
    assert r2.status_code == 409
    err = r2.json()
    assert err["code"] == "VERSION_CONFLICT"
    assert err["details"]["current_version"] == 2
    assert err["details"]["expected_version"] == 1

    current = client.get(f"/v1/activities/{rec['id']}", headers=H("tok-a-entry")).json()["data"]
    assert current["quantity"] == "120"  # ikinci yazarın verisi sessizce üstüne yazılmadı
    versions = client.get(f"/v1/activities/{rec['id']}/versions", headers=H("tok-a-entry")).json()["data"]
    assert [v["quantity"] for v in versions] == ["100", "120"]


def test_expected_version_in_body_is_accepted(env):
    client, _ = env
    rec = create(client)
    r = client.patch(f"/v1/activities/{rec['id']}", json={"expected_version": 1, "note": "x"}, headers=H("tok-a-entry"))
    assert r.status_code == 200


def test_missing_expected_version_is_428(env):
    client, _ = env
    rec = create(client)
    r = client.patch(f"/v1/activities/{rec['id']}", json={"note": "x"}, headers=H("tok-a-entry"))
    assert r.status_code == 428
    assert r.json()["code"] == "VERSION_REQUIRED"
