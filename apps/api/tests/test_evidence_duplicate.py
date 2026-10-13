"""T07: aynı fatura yeniden yükleniyor → yinelenen kayıt kontrolü ve gerekçeli çözüm."""

from helpers import H, T, create

SHA = "a" * 64


def test_duplicate_hash_in_tenant_is_reported(env):
    client, _ = env
    rec = create(client)
    body = {"sha256": SHA, "filename": "fatura-ocak.pdf", "size_bytes": 12345, "record_id": rec["id"]}
    r1 = client.post("/v1/evidence/uploads", json=body, headers=H("tok-a-entry"))
    assert r1.status_code == 201, r1.text
    d1 = r1.json()["data"]
    assert d1["duplicate_candidates"] == [] and d1["resolution_required"] is False
    assert d1["upload"] is None  # nesne deposu yok; dürüstçe null
    assert d1["evidence"]["scan_status"] == "pending"

    r2 = client.post("/v1/evidence/uploads", json={**body, "filename": "fatura-ocak (1).pdf"}, headers=H("tok-a-entry2"))
    assert r2.status_code == 201
    d2 = r2.json()["data"]
    assert d2["resolution_required"] is True
    assert [c["id"] for c in d2["duplicate_candidates"]] == [d1["evidence"]["id"]]


def test_duplicate_check_is_tenant_scoped(env):
    client, _ = env
    client.post("/v1/evidence/uploads", json={"sha256": SHA, "filename": "a.pdf", "size_bytes": 1}, headers=H("tok-a-entry"))
    r = client.post("/v1/evidence/uploads", json={"sha256": SHA, "filename": "a.pdf", "size_bytes": 1}, headers=H("tok-b-entry", T.TENANT_B))
    assert r.status_code == 201
    assert r.json()["data"]["duplicate_candidates"] == []


def test_invalid_hash_rejected(env):
    client, _ = env
    r = client.post("/v1/evidence/uploads", json={"sha256": "xyz", "filename": "a.pdf", "size_bytes": 1}, headers=H("tok-a-entry"))
    assert r.status_code == 422
    assert r.json()["field_errors"][0]["field"] == "sha256"
