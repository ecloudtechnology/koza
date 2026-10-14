import json

from koza_calc.golden import run_dir, run_file, run_fixture, run_fixtures
from tests.conftest import GOLDEN_DIR, REPO_ROOT


def test_golden_dir_all_pass():
    assert GOLDEN_DIR.is_dir(), GOLDEN_DIR
    report = run_dir(str(REPO_ROOT / "tests" / "golden"))
    failures = [r for r in report["results"] if not r["ok"]]
    assert report["failed"] == 0, json.dumps(failures, ensure_ascii=False, indent=2)
    assert report["passed"] >= 20
    assert report["passed"] + report["failed"] == len(report["results"])
    for r in report["results"]:
        assert set(r) == {"id", "ok", "diff"}


def _walk_factors(obj):
    """İstek içindeki her faktör nesnesi (üst liste, araç faktörü, artık karışım…)."""
    if isinstance(obj, dict):
        if "numerator_unit" in obj and "denominator_unit" in obj and "value" in obj:
            yield obj
        for v in obj.values():
            yield from _walk_factors(v)
    elif isinstance(obj, list):
        for v in obj:
            yield from _walk_factors(v)


def test_every_fixture_declares_fictional_coefficients():
    for path in sorted(GOLDEN_DIR.glob("*.json")):
        fx = json.loads(path.read_text(encoding="utf-8"))
        assert fx["note_tr"] == "Katsayılar kurgusaldır; yalnız yazılım testi içindir.", path.name
        assert fx["id"] == path.stem, path.name
        assert fx["title_tr"] and fx["requirements"]
        assert ("request" in fx) != ("aggregate_request" in fx), path.name
        request = fx.get("request", fx.get("aggregate_request"))
        for f in _walk_factors(request):
            assert f.get("license") == "test-only", path.name


def test_required_scenarios_present():
    ids = {p.stem for p in GOLDEN_DIR.glob("*.json")}
    for needed in [
        "T01-co2-only", "T01b-co2e-kwh", "T02-co2e-factor-no-double-gwp", "T02-mix-co2e-and-gas-blocked",
        "T03-m3-conditions-unknown-blocked", "T03-m3-with-conditions-to-nm3", "T04-hhv-vs-lhv-blocked",
        "T04-hhv-with-basis-conversion-review", "full-ghg", "partial-ghg", "boundary-mix-blocked",
        "negative-quantity-blocked", "T20-unit-unknown-blocked", "T20-basis-unknown-blocked",
        "factor-missing-source-blocked", "estimated-review-required", "mwh-to-gj", "t-numerator",
    ]:
        assert needed in ids, needed


def test_run_file_accepts_path_and_dict():
    path = GOLDEN_DIR / "T01-co2-only.json"
    from_path = run_file(str(path))
    from_dict = run_file(json.loads(path.read_text(encoding="utf-8")))
    assert from_path == from_dict == {"id": "T01-co2-only", "ok": True, "diff": []}


def test_subset_matching_reports_diff():
    fx = json.loads((GOLDEN_DIR / "T01-co2-only.json").read_text(encoding="utf-8"))
    fx["expected"]["total_co2e_kg"] = "5001"
    fx["expected"]["components"][0]["gwp_applied"] = True
    r = run_fixture(fx)
    assert r["ok"] is False
    assert any(d.startswith("total_co2e_kg:") for d in r["diff"])
    assert any(d.startswith("components[0].gwp_applied:") for d in r["diff"])


def test_block_codes_compared_unordered():
    fx = json.loads((GOLDEN_DIR / "boundary-mix-blocked.json").read_text(encoding="utf-8"))
    fx["expected"]["block_codes"] = list(reversed(fx["expected"]["block_codes"]))
    assert run_fixture(fx)["ok"] is True


def test_run_fixtures_without_filesystem():
    fixtures = [json.loads(p.read_text(encoding="utf-8")) for p in sorted(GOLDEN_DIR.glob("*.json"))]
    report = run_fixtures(fixtures)
    assert report["failed"] == 0 and report["passed"] == len(fixtures)


def test_malformed_fixture_reports_not_raises():
    assert run_fixture({"id": "x"})["ok"] is False
