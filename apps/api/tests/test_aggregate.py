"""POST /v1/calculations/aggregate: toplam yalnız koza_calc.aggregate'ten (K-17, kural 1); ürün ayrı bağlam (kural 8)."""

import sys

import pytest

from helpers import H, T, approved_record, calculate, create


def test_without_engine_aggregate_api_returns_503_and_no_number(env, monkeypatch):
    client, _ = env
    approved_record(client)
    mod = sys.modules["koza_calc"]
    if hasattr(mod, "aggregate"):
        monkeypatch.delattr(mod, "aggregate")
    r = client.post("/v1/calculations/aggregate", json={"period_id": T.PERIOD_A}, headers=H("tok-a-approver"))
    assert r.status_code == 503, r.text
    assert r.json()["code"] == "AGGREGATE_UNAVAILABLE" and r.json()["retryable"] is True
    assert "total" not in r.text.lower() or "total_kg" not in r.text


def test_aggregate_passes_runs_with_policy_and_separates_product(env, monkeypatch):
    client, _ = env
    rec = approved_record(client)
    draft = create(client, key="k-d")  # koşumsuz
    calc_only = create(client, key="k-c")
    calculate(client, calc_only["id"])  # calculated, onaysız
    product = create(client, key="k-p", source_type="product_process")
    r = client.post(f"/v1/activities/{product['id']}/calculate",
                    json={"factor_refs": [{"id": "TEST-NG-CO2", "version": "1.0"}], "method": {"id": "ghgp-corporate-test", "version": "0.1"}},
                    headers=H("tok-a-entry"))
    assert r.status_code == 201, r.text
    product_run_ok = r.json()["data"]["status"] != "blocked"

    captured = {}

    def fake_aggregate(request):
        captured["request"] = request
        return {"engine_version": "test", "corporate": {"total_kg": "5000", "label_tr": "Hesaplanan envanter toplamı"},
                "product": {}, "not_applicable": [], "unknown": []}

    monkeypatch.setattr(sys.modules["koza_calc"], "aggregate", fake_aggregate, raising=False)

    r = client.post("/v1/calculations/aggregate", json={"period_id": T.PERIOD_A}, headers=H("tok-a-viewer"))
    assert r.status_code == 200, r.text
    d = r.json()["data"]
    assert d["persisted"] is False and d["result"]["corporate"]["total_kg"] == "5000"
    req = captured["request"]
    assert req["policy"] == {"include_states": ["approved", "locked"], "scope2_method": "location_based"}
    by_id = {x["record_id"]: x for x in req["results"]}
    assert rec["id"] in by_id and by_id[rec["id"]]["context"] == "corporate" and by_id[rec["id"]]["scope"] == 1
    assert by_id[rec["id"]]["result"]["total_co2e_kg"] == "5000" and by_id[rec["id"]]["state"] == "approved"
    assert calc_only["id"] not in by_id  # politika dışı durum: motora verilmez (motor da excluded sayardı)
    without = {x["record_id"] for x in d["records_without_run"]}
    assert {draft["id"], calc_only["id"]} <= without
    if product_run_ok:
        assert by_id[product["id"]]["context"] == "product" and by_id[product["id"]]["scope"] is None

    # politika genişletilince hesaplanmış kayıt da son koşumuyla gider
    r = client.post("/v1/calculations/aggregate", json={"period_id": T.PERIOD_A, "policy": {"include_states": ["approved", "locked", "calculated"], "scope2_method": "market_based"}}, headers=H("tok-a-viewer"))
    assert r.status_code == 200
    ids = {x["record_id"] for x in captured["request"]["results"]}
    assert calc_only["id"] in ids and captured["request"]["policy"]["scope2_method"] == "market_based"
    assert client.post("/v1/calculations/aggregate", json={"period_id": T.PERIOD_B}, headers=H("tok-a-viewer")).status_code == 404


def test_real_engine_aggregate_when_available(env):
    """Gerçek koza_calc ≥0.2 kuruluysa uçtan uca: onaylı koşum toplanır, ürün bağlamı kurumsal toplama girmez (kural 8)."""
    mod = sys.modules["koza_calc"]
    if not hasattr(mod, "aggregate") or getattr(mod, "ENGINE_VERSION", "") == "0.0.0-stub":
        pytest.skip("koza_calc.aggregate yok (motor < 0.2 veya taklit)")
    client, _ = env
    rec = approved_record(client)
    r = client.post("/v1/calculations/aggregate", json={"period_id": T.PERIOD_A}, headers=H("tok-a-approver"))
    assert r.status_code == 200, r.text
    d = r.json()["data"]
    assert d["engine_version"] == mod.ENGINE_VERSION and d["persisted"] is False
    corp = d["result"]["corporate"]
    assert corp["total_kg"] == "5000" and corp["scope1_kg"] == "5000"
    assert [x["record_id"] for x in d["request"]["results"]] == [rec["id"]]
    assert d["result"].get("product") in ({}, None) or rec["id"] not in d["result"]["product"]
