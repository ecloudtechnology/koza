"""Kural 2: NULL=bilinmiyor, 0=ölçülmüş sıfır, not_applicable=gerekçeli karar, estimated=veri niteliği.
Ayrım API, sürüm geçmişi ve rapor manifestinde korunur; eksik veriye sıfır atanmaz."""

from helpers import FACTOR_V1, H, METHOD, T, activity_body, create


def test_zero_unknown_and_not_applicable_are_distinct(env):
    client, _ = env
    zero = create(client, key="z", quantity="0", quantity_state="known")
    unknown = create(client, key="u", quantity=None, quantity_state="unknown")
    na = create(client, key="n", quantity=None, quantity_state="not_applicable", not_applicable_reason="Tesiste doğal gaz kullanılmıyor")
    est = create(client, key="e", quantity="100", data_quality="estimated")

    assert (zero["quantity"], zero["quantity_state"]) == ("0", "known")
    assert (unknown["quantity"], unknown["quantity_state"]) == (None, "unknown")
    assert (na["quantity"], na["quantity_state"], na["not_applicable_reason"]) == (None, "not_applicable", "Tesiste doğal gaz kullanılmıyor")
    assert est["data_quality"] == "estimated"

    for rec in (zero, unknown, na):
        got = client.get(f"/v1/activities/{rec['id']}", headers=H("tok-a-viewer")).json()["data"]
        assert (got["quantity"], got["quantity_state"]) == (rec["quantity"], rec["quantity_state"])

    report = client.post("/v1/reports", json={"period_id": T.PERIOD_A}, headers=H("tok-a-admin")).json()["data"]
    by_id = {e["record_id"]: e for e in report["manifest"]["records"]}
    assert by_id[zero["id"]]["quantity"] == "0"
    assert by_id[unknown["id"]]["quantity"] is None and by_id[unknown["id"]]["quantity_state"] == "unknown"
    assert by_id[na["id"]]["quantity_state"] == "not_applicable" and by_id[na["id"]]["not_applicable_reason"]
    assert by_id[est["id"]]["data_quality"] == "estimated"
    assert report["manifest"]["counts"]["quantity_unknown"] == 1
    assert report["manifest"]["counts"]["not_applicable"] == 1
    assert report["manifest"]["counts"]["estimated"] == 1


def test_inconsistent_value_states_rejected(env):
    client, _ = env
    h = H("tok-a-entry", **{"Idempotency-Key": "x"})
    cases = [
        activity_body(quantity=None, quantity_state="known"),  # known ama değer yok
        activity_body(quantity="10", quantity_state="unknown"),  # unknown ama değer var
        activity_body(quantity=None, quantity_state="not_applicable"),  # gerekçe yok
        activity_body(quantity=100),  # JSON sayısı: sessiz dönüşüm yok
        activity_body(quantity="-5"),  # negatif
        activity_body(tenant_id=T.TENANT_A),  # gövdede tenant_id kabul edilmez (kural 3)
    ]
    for body in cases:
        r = client.post("/v1/activities", json=body, headers=h)
        assert r.status_code == 422, body
        assert r.json()["code"] == "VALIDATION_ERROR" and r.json()["field_errors"]


def test_patch_to_unknown_keeps_null_and_blocks_calculation(env):
    client, _ = env
    rec = create(client)
    r = client.patch(f"/v1/activities/{rec['id']}", json={"quantity": None, "quantity_state": "unknown"},
                     headers=H("tok-a-entry", **{"If-Match": '"1"'}))
    assert r.status_code == 200, r.text
    assert r.json()["data"]["quantity"] is None and r.json()["data"]["quantity_state"] == "unknown"
    r = client.post(f"/v1/activities/{rec['id']}/calculate", json={"factor_refs": [FACTOR_V1], "method": METHOD}, headers=H("tok-a-entry"))
    assert r.status_code == 422 and r.json()["code"] == "QUANTITY_NOT_KNOWN"
    versions = client.get(f"/v1/activities/{rec['id']}/versions", headers=H("tok-a-entry")).json()["data"]
    assert [(v["quantity"], v["quantity_state"]) for v in versions] == [("100", "known"), (None, "unknown")]


def test_zero_is_calculated_not_treated_as_missing(env):
    client, _ = env
    rec = create(client, quantity="0")
    run = client.post(f"/v1/activities/{rec['id']}/calculate", json={"factor_refs": [FACTOR_V1], "method": METHOD}, headers=H("tok-a-entry"))
    assert run.status_code == 201, run.text
    assert run.json()["data"]["status"] in ("computed", "review_required")
    assert run.json()["data"]["result"]["total_co2e_kg"] == "0"


def test_estimated_goes_to_review_required(env):
    client, _ = env
    rec = create(client, data_quality="estimated")
    run = client.post(f"/v1/activities/{rec['id']}/calculate", json={"factor_refs": [FACTOR_V1], "method": METHOD}, headers=H("tok-a-entry"))
    assert run.json()["data"]["status"] == "review_required"
    assert run.json()["data"]["record_state"] == "calculated"  # hesaplandı ≠ onaylandı


def test_preview_persists_nothing(env):
    client, repo = env
    body = {"activity": {"source_type": "stationary_combustion", "fuel": "natural_gas", "quantity": "100", "unit": "GJ",
                         "heating_value_basis": "LHV", "activity_start": "2026-01-01", "activity_end": "2026-01-31"},
            "factor_refs": [FACTOR_V1], "method": METHOD}
    r = client.post("/v1/calculations/preview", json=body, headers=H("tok-a-entry"))
    assert r.status_code == 200, r.text
    assert r.json()["data"]["persisted"] is False
    assert r.json()["data"]["result"]["total_co2e_kg"] == "5000"
    # yalnız oturumun ilk görülme olayı (session.login, §25) yazılır; önizleme hiçbir iş olayı/koşum/kayıt üretmez
    assert len(repo.runs) == 0 and len(repo.records) == 0
    assert [e.action for e in repo.audit if e.action != "session.login"] == []
