"""§27 kabul: aynı anahtar + aynı istek ikinci faaliyet yaratmaz; aynı anahtar + farklı içerik reddedilir."""

from helpers import H, activity_body


def test_same_key_same_body_replays_without_second_record(env):
    client, repo = env
    body = activity_body()
    h = H("tok-a-entry", **{"Idempotency-Key": "idem-1"})
    r1 = client.post("/v1/activities", json=body, headers=h)
    r2 = client.post("/v1/activities", json=body, headers=h)
    assert r1.status_code == 201 and r2.status_code == 201
    assert r1.json()["data"] == r2.json()["data"]
    assert r2.json()["meta"]["idempotent_replay"] is True
    assert r1.json()["request_id"] != r2.json()["request_id"]
    assert len(repo.records) == 1


def test_same_key_different_body_rejected(env):
    client, repo = env
    h = H("tok-a-entry", **{"Idempotency-Key": "idem-2"})
    assert client.post("/v1/activities", json=activity_body(), headers=h).status_code == 201
    r = client.post("/v1/activities", json=activity_body(quantity="200"), headers=h)
    assert r.status_code == 409
    err = r.json()
    assert err["code"] == "IDEMPOTENCY_MISMATCH"
    assert err["retryable"] is False and err["request_id"]
    assert len(repo.records) == 1


def test_missing_key_rejected(env):
    client, _ = env
    r = client.post("/v1/activities", json=activity_body(), headers=H("tok-a-entry"))
    assert r.status_code == 400
    assert r.json()["code"] == "IDEMPOTENCY_KEY_REQUIRED"


def test_key_is_scoped_per_user(env):
    client, repo = env
    body = activity_body()
    client.post("/v1/activities", json=body, headers=H("tok-a-entry", **{"Idempotency-Key": "shared"}))
    r = client.post("/v1/activities", json=body, headers=H("tok-a-entry2", **{"Idempotency-Key": "shared"}))
    assert r.status_code == 201
    assert len(repo.records) == 2
