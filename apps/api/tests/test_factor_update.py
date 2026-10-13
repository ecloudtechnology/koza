"""T13: faktör güncelleniyor → eski onaylı sonuç korunur; yeni sürüm öneri olarak eklenir."""

from helpers import FACTOR_V1, FACTOR_V2, H, T, approved_record, calculate


def test_new_factor_version_creates_new_run_and_keeps_old(env):
    client, _ = env
    rec = approved_record(client)
    old_run_id = rec["approved_run_id"]

    new_run = calculate(client, rec["id"], token="tok-a-reviewer", factor=FACTOR_V2)
    assert new_run["id"] != old_run_id
    assert new_run["factor_refs"] == [FACTOR_V2]
    assert old_run_id in new_run["supersedes_run_ids"]
    assert new_run["record_state"] == "approved"  # onay durumu değişmedi

    runs = client.get(f"/v1/activities/{rec['id']}/runs", headers=H("tok-a-reviewer")).json()
    ids = {r["id"] for r in runs["data"]}
    assert ids == {old_run_id, new_run["id"]}
    assert runs["meta"]["approved_run_id"] == old_run_id
    old = next(r for r in runs["data"] if r["id"] == old_run_id)
    assert old["factor_refs"] == [FACTOR_V1]
    assert old["result"]["total_co2e_kg"] == "5000"

    # rapor manifesti onaylı (eski) koşumu kullanır; yeni faktör sessizce rapora girmez
    report = client.post("/v1/reports", json={"period_id": T.PERIOD_A}, headers=H("tok-a-admin")).json()["data"]
    entry = report["manifest"]["records"][0]
    assert entry["run"]["run_id"] == old_run_id
    assert entry["run"]["factors"] == [FACTOR_V1]
    assert report["manifest"]["factors"] == [FACTOR_V1]


def test_runs_are_immutable_in_repo_interface(env):
    _, repo = env
    assert not any(name.startswith(("update_run", "delete_run", "update_result", "delete_result")) for name in dir(repo))
