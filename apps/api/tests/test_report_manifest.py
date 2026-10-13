"""T19: rapor yeniden oluşturuluyor → sabit manifest aynı sonuçları üretir. §22: sonradan değişen kaynak raporu sessizce değiştiremez."""

import hashlib
import json

from helpers import H, T, approved_record, create


def test_regenerated_report_has_identical_manifest_and_hash(env):
    client, _ = env
    approved_record(client, key="k-r1")
    create(client, key="k-r2", quantity=None, quantity_state="unknown")  # eksik kayıt raporda görünür kalır

    r1 = client.post("/v1/reports", json={"period_id": T.PERIOD_A}, headers=H("tok-a-approver"))
    assert r1.status_code == 202, r1.text
    rep1 = r1.json()["data"]
    assert rep1["status"] == "ready" and rep1["job_id"] == rep1["id"] and rep1["version"] == 1
    assert r1.json()["meta"]["async"] is False

    r2 = client.post("/v1/reports", json={"period_id": T.PERIOD_A}, headers=H("tok-a-approver"))
    assert r2.status_code == 422 and r2.json()["code"] == "SUPERSEDE_REASON_REQUIRED"

    r2 = client.post("/v1/reports", json={"period_id": T.PERIOD_A, "supersede_reason": "Denetçi talebiyle yeniden üretildi"}, headers=H("tok-a-approver"))
    rep2 = r2.json()["data"]
    assert rep2["id"] != rep1["id"]
    assert rep2["version"] == 2 and rep2["supersedes_id"] == rep1["id"]
    assert rep2["manifest"] == rep1["manifest"]
    assert rep2["manifest_sha256"] == rep1["manifest_sha256"]

    canonical = json.dumps(rep1["manifest"], sort_keys=True, separators=(",", ":"), ensure_ascii=True)
    assert hashlib.sha256(canonical.encode()).hexdigest() == rep1["manifest_sha256"]

    # eski rapor okunabilir kalır
    g = client.get(f"/v1/reports/{rep1['id']}", headers=H("tok-a-viewer"))
    assert g.status_code == 200 and g.json()["data"]["manifest_sha256"] == rep1["manifest_sha256"]

    counts = rep1["manifest"]["counts"]
    assert counts == {"records": 2, "approved": 1, "not_approved": 1, "quantity_unknown": 1, "not_applicable": 0, "estimated": 0}
    assert rep1["manifest"]["assurance"] is None
    assert "total" not in json.dumps(rep1["manifest"]["counts"])  # toplulaştırma motor işi; API toplam üretmez


def test_manifest_changes_when_inputs_change(env):
    client, _ = env
    rec = approved_record(client)
    rep1 = client.post("/v1/reports", json={"period_id": T.PERIOD_A}, headers=H("tok-a-admin")).json()["data"]
    r = client.patch(f"/v1/activities/{rec['id']}", json={"quantity": "101"}, headers=H("tok-a-owner", **{"If-Match": f'"{rec["version"]}"'}))
    assert r.status_code == 200
    rep2 = client.post("/v1/reports", json={"period_id": T.PERIOD_A, "supersede_reason": "Veri düzeltildi"}, headers=H("tok-a-admin")).json()["data"]
    assert rep2["manifest_sha256"] != rep1["manifest_sha256"]
    assert rep2["manifest"]["records"][0]["included_as_approved"] is False
    assert rep2["manifest"]["records"][0]["run"] is None


def test_report_roles(env):
    client, _ = env
    for tok in ("tok-a-entry", "tok-a-viewer"):
        assert client.post("/v1/reports", json={"period_id": T.PERIOD_A}, headers=H(tok)).status_code == 403
