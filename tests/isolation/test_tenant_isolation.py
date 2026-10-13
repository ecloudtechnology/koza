"""T14 / §04 kabul: başka kuruma ait kayıt kimliği bilinse bile okunamaz, hesaplatılamaz, indirilemez.
§27: yetkisiz nesnenin varlığı açıklanmaz (404, 403 değil). Kural 3: gövdedeki tenant_id yetki kanıtı değildir."""

from koza_api import testing as T

A, B = T.TENANT_A, T.TENANT_B
FACTOR = {"id": "TEST-NG-CO2", "version": "1.0"}
METHOD = {"id": "ghgp-corporate-test", "version": "0.1"}


def _h(token, tenant, **extra):
    return T.headers(token, tenant, **extra)


def _body(period=T.PERIOD_A, **o):
    return {"period_id": period, "source_type": "stationary_combustion", "fuel": "natural_gas", "quantity": "100",
            "quantity_state": "known", "unit": "GJ", "heating_value_basis": "LHV", "activity_start": "2026-01-01",
            "activity_end": "2026-01-31", **o}


def _setup_tenant_a(client):
    rec = client.post("/v1/activities", json=_body(), headers=_h("tok-a-entry", A, **{"Idempotency-Key": "a1"})).json()["data"]
    run = client.post(f"/v1/activities/{rec['id']}/calculate", json={"factor_refs": [FACTOR], "method": METHOD}, headers=_h("tok-a-entry", A)).json()["data"]
    sub = client.post(f"/v1/activities/{rec['id']}/submit", headers=_h("tok-a-entry", A)).json()["data"]
    client.post("/v1/approvals", json={"record_id": rec["id"], "expected_version": sub["version"], "decision": "approve"}, headers=_h("tok-a-approver", A))
    report = client.post("/v1/reports", json={"period_id": T.PERIOD_A}, headers=_h("tok-a-admin", A)).json()["data"]
    ev = client.post("/v1/evidence/uploads", json={"sha256": "b" * 64, "filename": "f.pdf", "size_bytes": 10, "record_id": rec["id"]}, headers=_h("tok-a-entry", A)).json()["data"]
    return rec, run, report, ev


def test_foreign_record_is_404_for_every_operation(env):
    client, repo = env
    rec, run, report, ev = _setup_tenant_a(client)
    rid = rec["id"]
    hb = _h("tok-b-admin", B)  # B'nin en yetkili kullanıcısı bile
    hb_entry = _h("tok-b-entry", B)
    hb_appr = _h("tok-b-approver", B)

    attempts = [
        ("GET", f"/v1/activities/{rid}", None, hb),
        ("GET", f"/v1/activities/{rid}/versions", None, hb),
        ("GET", f"/v1/activities/{rid}/runs", None, hb),
        ("PATCH", f"/v1/activities/{rid}", {"quantity": "1"}, _h("tok-b-entry", B, **{"If-Match": '"1"'})),
        ("POST", f"/v1/activities/{rid}/calculate", {"factor_refs": [FACTOR], "method": METHOD}, hb_entry),
        ("POST", f"/v1/activities/{rid}/submit", None, hb_entry),
        ("POST", "/v1/approvals", {"record_id": rid, "expected_version": 1, "decision": "approve"}, hb_appr),
        ("GET", f"/v1/reports/{report['id']}", None, hb),
        ("GET", f"/v1/periods/{T.PERIOD_A}", None, hb),
        ("POST", f"/v1/periods/{T.PERIOD_A}/lock", None, hb),
        ("POST", f"/v1/periods/{T.PERIOD_A}/reopen", {"reason": "Başka kurumun dönemini açmayı deniyorum"}, hb),
        ("POST", "/v1/evidence/uploads", {"sha256": "c" * 64, "filename": "x.pdf", "size_bytes": 1, "record_id": rid}, hb_entry),
        ("POST", "/v1/activities", _body(period=T.PERIOD_A), _h("tok-b-entry", B, **{"Idempotency-Key": "b-foreign-period"})),
    ]
    for method, path, body, headers in attempts:
        r = client.request(method, path, json=body, headers=headers)
        assert r.status_code in (404, 422), (method, path, r.status_code, r.text)
        if r.status_code == 422:
            # yabancı dönem kimliği alan hatası olarak döner; varlığı açıklanmaz
            assert path == "/v1/activities" and r.json()["field_errors"][0]["field"] == "period_id"
        else:
            assert r.json()["code"] == "NOT_FOUND"
            assert "Kurum A" not in r.text and rid not in r.json().get("message", "")

    # hiçbir şey değişmedi: A'nın kaydı, koşumu, raporu olduğu gibi
    a_rec = client.get(f"/v1/activities/{rid}", headers=_h("tok-a-entry", A)).json()["data"]
    assert a_rec["quantity"] == "100" and a_rec["state"] == "approved"
    assert len(repo.list_runs(A, rid)) == 1
    assert repo.get_period(A, T.PERIOD_A).status == "open"
    assert len(repo.list_records(B)) == 0
    # B'nin audit izinde A'ya ait nesne yok; A'nın izinde B'nin denemeleri yok
    b_audit = client.get("/v1/audit", headers=hb).json()["data"]
    assert all(e["object_id"] != rid for e in b_audit)
    assert all(e.tenant_id == A for e in repo.audit if e.object_id == rid)


def test_x_tenant_must_match_membership(env):
    client, _ = env
    r = client.get("/v1/periods", headers=_h("tok-b-entry", A))  # B kullanıcısı A bağlamı istiyor
    assert r.status_code == 403 and r.json()["code"] == "TENANT_FORBIDDEN"
    r = client.get("/v1/periods", headers={"Authorization": "Bearer tok-b-entry"})
    assert r.status_code == 403 and r.json()["code"] == "TENANT_REQUIRED"
    r = client.get("/v1/periods", headers={"X-Tenant": A})
    assert r.status_code == 401 and r.json()["code"] == "UNAUTHENTICATED"
    r = client.get("/v1/periods", headers=_h("tok-yok", A))
    assert r.status_code == 401


def test_body_tenant_id_is_not_authority(env):
    client, repo = env
    # B kullanıcısı gövdeye A'nın tenant_id'sini koyuyor: reddedilir, A'da kayıt oluşmaz
    r = client.post("/v1/activities", json=_body(period=T.PERIOD_B, tenant_id=A), headers=_h("tok-b-entry", B, **{"Idempotency-Key": "b1"}))
    assert r.status_code == 422
    assert any(fe["field"] == "tenant_id" for fe in r.json()["field_errors"])
    assert len(repo.list_records(A)) == 0 and len(repo.list_records(B)) == 0
    # tenant_id olmadan aynı istek B'de oluşur; tenant yalnız başlık+üyelikten gelir
    r = client.post("/v1/activities", json=_body(period=T.PERIOD_B), headers=_h("tok-b-entry", B, **{"Idempotency-Key": "b2"}))
    assert r.status_code == 201
    assert len(repo.list_records(B)) == 1 and repo.list_records(B)[0].tenant_id == B
    assert len(repo.list_records(A)) == 0


def test_same_ids_in_two_tenants_do_not_collide(env):
    client, repo = env
    # Aynı Idempotency-Key iki kurumda bağımsızdır
    ra = client.post("/v1/activities", json=_body(T.PERIOD_A), headers=_h("tok-a-entry", A, **{"Idempotency-Key": "same"}))
    rb = client.post("/v1/activities", json=_body(T.PERIOD_B), headers=_h("tok-b-entry", B, **{"Idempotency-Key": "same"}))
    assert ra.status_code == 201 and rb.status_code == 201
    assert ra.json()["data"]["id"] != rb.json()["data"]["id"]
    assert repo.get_record(A, rb.json()["data"]["id"]) is None
    assert repo.get_record(B, ra.json()["data"]["id"]) is None
