"""§25 dosya güvenliği: nesne deposu, boyut/tür sınırı, karma doğrulaması, tarama kancası, kısa ömürlü imzalı bağlantı."""

import hashlib
import time

import pytest

from koza_api.objectstore import LocalObjectStore, UrlSigner
from koza_api.scanner import CommandScanner, NoScanner, PendingScanner

from helpers import H, T, create

PDF = b"%PDF-1.4 kurgusal kanit dosyasi"
SHA = hashlib.sha256(PDF).hexdigest()


@pytest.fixture
def store(tmp_path):
    return LocalObjectStore(tmp_path / "objects")


def _session(client, record_id=None, size=len(PDF), name="fatura.pdf", sha=SHA):
    r = client.post("/v1/evidence/uploads", json={"sha256": sha, "filename": name, "size_bytes": size, "record_id": record_id}, headers=H("tok-a-entry"))
    assert r.status_code == 201, r.text
    return r.json()["data"]


def test_without_object_store_upload_is_null_and_content_is_503(env):
    client, _ = env
    d = _session(client)
    assert d["upload"] is None
    r = client.put(f"/v1/evidence/uploads/{d['evidence']['id']}/content", content=PDF, headers=H("tok-a-entry", **{"Content-Type": "application/pdf"}))
    assert r.status_code == 503 and r.json()["code"] == "OBJECT_STORE_UNAVAILABLE"
    r = client.get(f"/v1/evidence/{d['evidence']['id']}/download-url", headers=H("tok-a-entry"))
    assert r.status_code == 503 and r.json()["code"] == "SIGNING_SECRET_MISSING"


def test_full_upload_flow_with_explicit_none_scanner_and_signed_url(env, store, monkeypatch):
    client, repo = env
    app = client.app
    app.state.object_store, app.state.scanner, app.state.signer = store, NoScanner(), UrlSigner(b"x" * 32)
    rec = create(client)
    d = _session(client, record_id=rec["id"])
    assert d["upload"]["method"] == "PUT" and d["upload"]["max_bytes"] == 1024 * 1024
    eid = d["evidence"]["id"]
    # tür engeli, boyut engeli, karma uyuşmazlığı
    r = client.put(f"/v1/evidence/uploads/{eid}/content", content=PDF, headers=H("tok-a-entry", **{"Content-Type": "text/html"}))
    assert r.status_code == 415 and r.json()["code"] == "EVIDENCE_TYPE_NOT_ALLOWED"
    r = client.put(f"/v1/evidence/uploads/{eid}/content", content=b"x" * (1024 * 1024 + 1), headers=H("tok-a-entry", **{"Content-Type": "application/pdf"}))
    assert r.status_code == 413 and r.json()["code"] == "EVIDENCE_TOO_LARGE"
    r = client.put(f"/v1/evidence/uploads/{eid}/content", content=PDF + b"!", headers=H("tok-a-entry", **{"Content-Type": "application/pdf"}))
    assert r.status_code == 422 and r.json()["code"] == "EVIDENCE_HASH_MISMATCH"
    assert store.path_for(f"{T.TENANT_A}/{eid}") is None  # hiçbir şey saklanmadı
    # indirme bağlantısı: taranmamış → 409
    assert client.get(f"/v1/evidence/{eid}/download-url", headers=H("tok-a-viewer")).json()["code"] == "EVIDENCE_NOT_AVAILABLE"
    # geçerli yükleme
    r = client.put(f"/v1/evidence/uploads/{eid}/content", content=PDF, headers=H("tok-a-entry", **{"Content-Type": "application/pdf"}))
    assert r.status_code == 200, r.text
    assert r.json()["data"]["scan_status"] == "clean" and r.json()["meta"]["scanner"] == "none"
    assert store.path_for(f"{T.TENANT_A}/{eid}").read_bytes() == PDF
    assert client.put(f"/v1/evidence/uploads/{eid}/content", content=PDF, headers=H("tok-a-entry", **{"Content-Type": "application/pdf"})).status_code == 409
    # imzalı bağlantı: kısa ömürlü, bearer gerekmez, süre dolunca 403, yabancı kurum 404
    r = client.get(f"/v1/evidence/{eid}/download-url", params={"ttl": 60}, headers=H("tok-a-viewer"))
    assert r.status_code == 200, r.text
    url = r.json()["data"]["url"]
    assert r.json()["data"]["ttl_seconds"] == 60 and r.json()["data"]["expires_at"] <= int(time.time()) + 60
    assert client.get(url).status_code == 200 and client.get(url).content == PDF
    assert client.get(url.replace("sig=", "sig=0")).status_code == 403
    assert client.get(url.replace(f"exp={r.json()['data']['expires_at']}", "exp=1")).status_code == 403
    monkeypatch.setattr(time, "time", lambda: 10 ** 10)
    assert client.get(url).status_code == 403
    monkeypatch.undo()
    assert client.get(f"/v1/evidence/{eid}/download-url", headers=H("tok-b-admin", T.TENANT_B)).status_code == 404
    r = client.get(f"/v1/evidence/{eid}/download-url", params={"ttl": 99999}, headers=H("tok-a-viewer"))
    assert r.json()["data"]["ttl_seconds"] == 900  # üst sınır
    audit = {e["action"] for e in client.get("/v1/audit", params={"object_id": eid}, headers=H("tok-a-admin")).json()["data"]}
    assert {"evidence.upload_session", "evidence.upload_complete", "evidence.download_url"} <= audit


def test_default_scanner_leaves_pending_and_rejected_is_deleted(env, store, tmp_path):
    client, _ = env
    app = client.app
    app.state.object_store, app.state.scanner, app.state.signer = store, PendingScanner(), UrlSigner(b"y" * 32)
    d = _session(client)
    eid = d["evidence"]["id"]
    r = client.put(f"/v1/evidence/uploads/{eid}/content", content=PDF, headers=H("tok-a-entry", **{"Content-Type": "application/pdf"}))
    assert r.status_code == 200 and r.json()["data"]["scan_status"] == "pending"
    assert client.get(f"/v1/evidence/{eid}/download-url", headers=H("tok-a-viewer")).status_code == 409
    # komut tabanlı tarayıcı: çıkış 1 → rejected, dosya silinir
    script = tmp_path / "scan.sh"
    script.write_text("#!/bin/sh\nexit 1\n")
    script.chmod(0o755)
    app.state.scanner = CommandScanner(str(script))
    d2 = _session(client, name="fatura2.pdf", sha=hashlib.sha256(PDF + b"2").hexdigest(), size=len(PDF) + 1)
    r = client.put(f"/v1/evidence/uploads/{d2['evidence']['id']}/content", content=PDF + b"2", headers=H("tok-a-entry", **{"Content-Type": "application/pdf"}))
    assert r.status_code == 200 and r.json()["data"]["scan_status"] == "rejected"
    assert store.path_for(f"{T.TENANT_A}/{d2['evidence']['id']}") is None


def test_blocked_extension_and_declared_size(env):
    client, _ = env
    r = client.post("/v1/evidence/uploads", json={"sha256": SHA, "filename": "makro.xlsm", "size_bytes": 10}, headers=H("tok-a-entry"))
    assert r.status_code == 422 and r.json()["code"] == "EVIDENCE_TYPE_BLOCKED"
    r = client.post("/v1/evidence/uploads", json={"sha256": SHA, "filename": "buyuk.pdf", "size_bytes": 10 ** 9}, headers=H("tok-a-entry"))
    assert r.status_code == 413 and r.json()["code"] == "EVIDENCE_TOO_LARGE"
