"""§27 POST /v1/classifications/preview: kural tabanlı, deterministik; gerekçe + eksik sorular + kural sürümü; saklamaz."""

from helpers import H, T


def _post(client, **body):
    return client.post("/v1/classifications/preview", json=body, headers=H("tok-a-entry"))


def test_owned_combustion_is_scope1_with_rule_and_version(env):
    client, repo = env
    r = _post(client, source_type="stationary_combustion", fuel="natural_gas", control_relation="owned")
    assert r.status_code == 200, r.text
    d = r.json()["data"]
    assert d["suggestion"] == {"scope": 1, "category": None, "context": "corporate"}
    assert d["confidence"] == "rule" and d["rule_id"] == "R01" and d["rules_version"]
    assert d["rationale_tr"] and d["missing_questions"] == []
    assert d["persisted"] is False and d["binding"] is False
    assert repo.list_records(T.TENANT_A) == []
    # deterministik: aynı girdi aynı çıktı
    assert _post(client, source_type="stationary_combustion", fuel="natural_gas", control_relation="owned").json()["data"] == d


def test_missing_control_relation_yields_questions_not_a_guess(env):
    client, _ = env
    d = _post(client, source_type="stationary_combustion").json()["data"]
    assert d["confidence"] != "rule"
    fields = {q["field"] for q in d["missing_questions"]}
    assert {"control_relation", "fuel"} <= fields
    assert all(q["question_tr"] for q in d["missing_questions"])


def test_leased_without_control_is_scope3_cat8_and_product_is_separate(env):
    client, _ = env
    d = _post(client, source_type="mobile_combustion", fuel="diesel", control_relation="leased_no_control").json()["data"]
    assert d["suggestion"]["scope"] == 3 and d["suggestion"]["category"] == 8
    d = _post(client, source_type="purchased_electricity").json()["data"]
    assert d["suggestion"]["scope"] == 2 and d["rule_id"] == "R05"
    d = _post(client, source_type="scope3", scope3_hint="business_travel").json()["data"]
    assert d["suggestion"] == {"scope": 3, "category": 6, "context": "corporate"}
    d = _post(client, source_type="scope3").json()["data"]
    assert d["confidence"] == "needs_input" and d["missing_questions"][0]["field"] == "scope3_hint"
    d = _post(client, source_type="product_process").json()["data"]
    assert d["suggestion"]["context"] == "product" and d["suggestion"]["scope"] is None
    d = _post(client, source_type="unicorn").json()["data"]
    assert d["suggestion"] is None and d["confidence"] == "none" and "stationary_combustion" in d["supported_source_types"]


def test_body_tenant_id_rejected(env):
    client, _ = env
    r = _post(client, source_type="stationary_combustion", tenant_id="x")
    assert r.status_code == 422
