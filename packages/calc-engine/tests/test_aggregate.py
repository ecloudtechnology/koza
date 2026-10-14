"""Toplama (K-17; kural 2, 7, 8; §13, §16, §17)."""
import copy
import json

from koza_calc import aggregate


def res(total, coverage="co2e_factor", claim="CO₂e", status="computed", warnings=None, value_state="known", **over):
    r = {"engine_version": "0.2.0", "status": status, "blocks": [], "warnings": warnings or [], "total_co2e_kg": total,
         "coverage": coverage, "claim_tr": claim, "value_state": value_state}
    r.update(over)
    return r


def entry(rid, scope, total="100", state="approved", context="corporate", category=None, result=None, **over):
    e = {"record_id": rid, "context": context, "scope": scope, "category": category, "state": state,
         "result": result if result is not None else res(total), "scope2_method_used": None}
    e.update(over)
    return e


S2 = res(None, None, "toplanmaz", results={"location_based": res("40000"), "market_based": res("20000")})
POLICY = {"include_states": ["approved", "locked"], "scope2_method": "location_based"}


def base():
    return {"results": [
        entry("s1", 1, "5000", result=res("5000", "co2_only", "Yalnız CO₂")),
        entry("s1e", 1, result=res("1000", warnings=[{"code": "DATA_QUALITY_ESTIMATED", "message_tr": "t"}])),
        entry("s2", 2, result=S2, state="locked"),
        entry("s3", 3, "2000", category=1, state="locked"),
        entry("s3b", 3, "500", category=4),
        entry("p", None, context="product", result=res("1200", "carbon_only", "Ürün", context="product", product={"study_id": "ps-1"})),
        entry("draft", 1, "99999", state="draft"),
        entry("unk", 3, category=2, result=res(None, None, "", status="blocked", value_state="unknown")),
        entry("na", 3, category=14, result=res(None, None, "", value_state="not_applicable")),
    ], "policy": copy.deepcopy(POLICY)}


def test_full_shape():
    out = aggregate(base())
    assert out["status"] == "computed" and out["blocks"] == [] and out["engine_version"] == "0.2.0"
    c = out["corporate"]
    assert c["scope1_kg"] == "6000" and c["scope2_kg"] == "40000" and c["scope3_kg"] == "2500" and c["total_kg"] == "48500"
    assert c["scope2_method"] == "location_based" and c["scope2_alternative_kg"] == "20000" and c["scope2_alternative_method"] == "market_based"
    assert c["scope3_by_category"] == {"1": "2000", "4": "500"}
    assert c["label_tr"] == "Hesaplanan envanter toplamı"
    assert c["excluded"] == [{"record_id": "draft", "reason": "durum 'draft' toplama politikası dışında"}]
    assert c["coverage_notes_tr"] == ["s1: Yalnız CO₂"]
    assert c["estimated_share_by_count"] == "0.2" and c["estimated_share_by_kg"] == "0.02061855670103092783505154639175258"
    assert c["included_count"] == 5 and out["included"] == ["s1", "s1e", "s2", "s3", "s3b"]
    assert out["product"] == {"ps-1": {"total_kg": "1200", "claim_tr": "Ürün", "record_ids": ["p"]}}
    assert out["not_applicable"] == ["na"] and out["unknown"] == ["unk"] and out["biogenic_co2_kg"] is None
    assert out["inputs_hash"].startswith("sha256:")


def test_product_never_enters_corporate_total():
    out = aggregate({"results": [entry("p", None, context="product", result=res("1200", "carbon_only", "Ürün", context="product"))],
                     "policy": {"include_states": ["approved"]}})
    assert out["corporate"]["total_kg"] == "0" and out["product"] == {"p": {"total_kg": "1200", "claim_tr": "Ürün", "record_ids": ["p"]}}
    assert out["included"] == []


def test_scope2_single_method_policy():
    rq = base()
    rq["policy"]["scope2_method"] = "market_based"
    c = aggregate(rq)["corporate"]
    assert c["scope2_kg"] == "20000" and c["scope2_alternative_kg"] == "40000" and c["scope2_alternative_method"] == "location_based"
    assert c["total_kg"] == "28500"
    # tek yöntemli sonuç → alternatif yok
    rq = {"results": [entry("s2", 2, result=res(None, None, "", results={"location_based": res("40000")}))], "policy": POLICY}
    c = aggregate(rq)["corporate"]
    assert c["scope2_kg"] == "40000" and c["scope2_alternative_kg"] is None
    # politika yöntemi sonuçta yoksa dışlanır
    rq["policy"] = dict(POLICY, scope2_method="market_based")
    out = aggregate(rq)
    assert out["corporate"]["scope2_kg"] == "0" and out["corporate"]["excluded"][0]["record_id"] == "s2"


def test_plain_scope2_record_uses_scope2_method_used():
    rq = {"results": [entry("s2", 2, "40000", scope2_method_used="location_based")], "policy": POLICY}
    assert aggregate(rq)["corporate"]["scope2_kg"] == "40000"
    rq["results"][0]["scope2_method_used"] = "market_based"
    out = aggregate(rq)
    assert out["corporate"]["scope2_kg"] == "0" and "farklı" in out["corporate"]["excluded"][0]["reason"]


def test_scope2_method_required_only_when_scope2_present():
    rq = {"results": [entry("s1", 1, "5")], "policy": {"include_states": ["approved"]}}
    assert aggregate(rq)["status"] == "computed"
    rq["results"].append(entry("s2", 2, result=S2))
    out = aggregate(rq)
    assert out["status"] == "blocked" and out["blocks"][0]["field"] == "policy.scope2_method"


def test_blocked_and_states_listed_not_summed():
    rq = {"results": [
        entry("blk", 1, result=res(None, None, "", status="blocked")),
        entry("unk", 1, result=res(None, None, "", status="blocked", value_state="unknown")),
        entry("nul", 1, result=res(None)),
        entry("zero", 1, "0"),
    ], "policy": {"include_states": ["approved"]}}
    out = aggregate(rq)
    assert out["corporate"]["excluded"] == [{"record_id": "blk", "reason": "hesap bloke; sonuç yok"}]
    assert out["unknown"] == ["unk", "nul"] and out["included"] == ["zero"] and out["corporate"]["total_kg"] == "0"
    assert out["corporate"]["estimated_share_by_count"] == "0" and out["corporate"]["estimated_share_by_kg"] == "0"


def test_estimated_shares_by_count_and_kg_differ():
    rq = {"results": [entry("a", 1, "90"), entry("b", 1, "10", data_quality="estimated"),
                      entry("c", 3, "0", category=1, result=res("0", warnings=[{"code": "SPEND_BASED_ESTIMATE", "message_tr": "t"}]))],
          "policy": {"include_states": ["approved"]}}
    c = aggregate(rq)["corporate"]
    assert c["estimated_share_by_count"] == "0.6666666666666666666666666666666667" and c["estimated_share_by_kg"] == "0.1"


def test_biogenic_summed_separately():
    rq = {"results": [entry("a", 1, "90", result=res("90", biogenic_co2_kg="5")), entry("b", 1, "10", result=res("10", biogenic_co2_kg="2.5"))],
          "policy": {"include_states": ["approved"]}}
    out = aggregate(rq)
    assert out["biogenic_co2_kg"] == "7.5" and out["corporate"]["total_kg"] == "100"


def test_exact_decimal_sums():
    rq = {"results": [entry(f"r{i}", 1, "0.1") for i in range(10)], "policy": {"include_states": ["approved"]}}
    assert aggregate(rq)["corporate"]["total_kg"] == "1"


def test_structural_blocks_never_raise():
    for bad in [None, [], {}, {"results": "x", "policy": POLICY}, {"results": [], "policy": None},
                {"results": [], "policy": {"include_states": []}}, {"results": [{"record_id": ""}], "policy": POLICY},
                {"results": [entry("x", 4)], "policy": POLICY}, {"results": [entry("x", 3)], "policy": POLICY},
                {"results": [entry("x", 1, result={})], "policy": POLICY}, {"results": [entry("x", 1, result=res(5))], "policy": POLICY},
                {"results": [entry("x", 1, context="orta")], "policy": POLICY}, {"results": [], "policy": dict(POLICY, scope2_method="x")}]:
        out = aggregate(bad)
        assert out["status"] == "blocked" and out["blocks"] and out["corporate"] is None, bad
        assert all(b["message_tr"] for b in out["blocks"])


def test_deterministic_json_and_no_mutation():
    rq = base()
    snap = copy.deepcopy(rq)
    a = aggregate(rq)
    assert a == aggregate(copy.deepcopy(rq)) and rq == snap
    assert json.loads(json.dumps(a, ensure_ascii=False)) == a
