"""§19 kaynak kayıt defteri: tarih alanları ayrı, içerik karması, değişiklik kartı, uzman onayı; eski sürüm erişilebilir."""

import hashlib

from helpers import H


def _create_source(client):
    r = client.post("/v1/sources", json={"name": "Örnek Standart 2025", "publisher": "Kurgusal Yayıncı", "kind": "standard",
                                         "url": "https://ornek.test/standart", "license": "link-only"}, headers=H("tok-a-editor"))
    assert r.status_code == 201, r.text
    return r.json()["data"]


def test_versions_keep_dates_separate_and_history(env):
    client, _ = env
    assert client.post("/v1/sources", json={"name": "x", "publisher": "y", "kind": "standard"}, headers=H("tok-a-entry")).status_code == 403
    src = _create_source(client)
    v1 = {"publication_date": "2025-06-26", "effective_date": "2027-01-01", "covered_period_start": "2027-01-01",
          "content": "Madde 1: eski metin", "content_url": "https://ornek.test/v1",
          "change_card": {"summary_tr": "İlk sürüm", "nature": "definitive"}}
    r = client.post(f"/v1/sources/{src['id']}/versions", json=v1, headers=H("tok-a-editor"))
    assert r.status_code == 201, r.text
    d1 = r.json()["data"]
    assert d1["version"] == 1 and d1["content_hash"] == hashlib.sha256(b"Madde 1: eski metin").hexdigest()
    assert d1["dates"]["publication_date"] == "2025-06-26" and d1["dates"]["effective_date"] == "2027-01-01"
    assert d1["dates"]["seen_at"] and d1["dates"]["last_checked_at"] is None
    assert d1["expert_approved"] is False and d1["binding"] is False  # taslak yayın yükümlülük değildir

    # aynı içerik → yeni sürüm yok; kontrol zamanı ayrıca yazılır
    r = client.post(f"/v1/sources/{src['id']}/versions", json=v1, headers=H("tok-a-editor"))
    assert r.status_code == 409 and r.json()["code"] == "SOURCE_CONTENT_UNCHANGED"
    r = client.post(f"/v1/sources/{src['id']}/versions/1/checked", headers=H("tok-a-editor"))
    assert r.status_code == 200 and r.json()["data"]["dates"]["last_checked_at"]

    v2 = {**v1, "content": "Madde 1: yeni metin", "effective_date": "2027-07-01",
          "change_card": {"old_link": "https://ornek.test/v1", "new_link": "https://ornek.test/v2", "changed_clause": "Madde 1",
                          "summary_tr": "Yürürlük ertelendi", "nature": "definitive", "affected_calculations": ["stationary_combustion"]}}
    d2 = client.post(f"/v1/sources/{src['id']}/versions", json=v2, headers=H("tok-a-admin")).json()["data"]
    assert d2["version"] == 2
    changed = {c["field"]: (c["from"], c["to"]) for c in d2["changes_from_previous"]}
    assert changed["effective_date"] == ("2027-01-01", "2027-07-01") and "content_hash" in changed
    assert d2["change_card"]["changed_clause"] == "Madde 1"

    versions = client.get(f"/v1/sources/{src['id']}/versions", headers=H("tok-a-viewer")).json()
    assert [v["version"] for v in versions["data"]] == [1, 2] and versions["meta"]["approved_count"] == 0
    assert versions["data"][0]["content_hash"] == d1["content_hash"]  # eski sürüm erişilebilir


def test_expert_approval_only_reviewer_and_audited(env):
    client, _ = env
    src = _create_source(client)
    client.post(f"/v1/sources/{src['id']}/versions", json={"content_hash": "a" * 64}, headers=H("tok-a-editor"))
    for tok in ("tok-a-editor", "tok-a-admin", "tok-a-approver"):
        assert client.post(f"/v1/sources/{src['id']}/versions/1/approve", headers=H(tok)).status_code == 403
    r = client.post(f"/v1/sources/{src['id']}/versions/1/approve", headers=H("tok-a-reviewer"))
    assert r.status_code == 200, r.text
    assert r.json()["data"]["expert_approved"] is True and r.json()["data"]["binding"] is True and r.json()["data"]["approved_by"]
    assert client.post(f"/v1/sources/{src['id']}/versions/9/approve", headers=H("tok-a-reviewer")).status_code == 404
    info = client.get(f"/v1/sources/{src['id']}", headers=H("tok-a-viewer")).json()["data"]
    assert info["latest_approved_version"] == 1
    audit = client.get("/v1/audit", params={"object_id": src["id"]}, headers=H("tok-a-admin")).json()["data"]
    assert {"source.create", "source.version_create", "source.approve"} <= {e["action"] for e in audit}
    r = client.post(f"/v1/sources/{src['id']}/versions", json={}, headers=H("tok-a-editor"))
    assert r.status_code == 422  # content_hash veya content zorunlu
