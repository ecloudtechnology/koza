import { beforeEach, describe, expect, it } from "vitest";
import { resetAll, Store, StoreError } from "@/lib/store";
import { canonicalJson, sha256Hex } from "@/lib/hash";
import type { ActivityRecordVersion, CalcResult } from "@/lib/domain";
import "./register";
import { addAllocationScenario, addImpactScenario, addLedgerEntry, addShadowPrice, currentShadowPrice, inventoryFingerprint, scenarioWrite } from "./scenario";

const RESULT: CalcResult = {
  engine_version: "0.1.0", method: { id: "m", version: "0.1" }, status: "computed", blocks: [], warnings: [], normalized_activity: { quantity: "100", unit: "GJ", basis: "LHV" },
  components: [{ gas: "CO2", factor_id: "TEST-NG-CO2", factor_version: "1.0", mass_kg: "5000", gwp: null, gwp_applied: false, co2e_kg: "5000" }],
  total_co2e_kg: "5000", coverage: "co2_only", claim_tr: "x", boundary: "combustion", trace: [], inputs_hash: "sha256:abc",
};

function fresh(): Store {
  resetAll();
  const s = new Store();
  s.switchUser("u-yonetici");
  s.createTenant({ name: "Test AŞ", country: "TR", nace_code: "C24", profile_id: "agir-sanayi", profile_version: "0.1.0" });
  const f = s.addFacility({ name: "Tesis", city: "Gebze", profile_id: null });
  const p = s.addPeriod({ start: "2026-01-01", end: "2026-12-31" });
  const src = s.addSource({ facility_id: f.id, name: "Kazan", source_type: "stationary_combustion", fuel: "natural_gas", control: "owned", created_from: "manual" });
  s.switchUser("u-veri");
  const v: Omit<ActivityRecordVersion, "record_id" | "tenant_id" | "version" | "created_at" | "created_by"> = {
    change_reason: null, source_id: src.id, period_id: p.id, period_start: "2026-01-01", period_end: "2026-01-31", quantity: "100", quantity_state: "known", unit: "GJ", heating_value_basis: "LHV",
    reference_conditions: null, calorific_value: null, basis_conversion: null, data_quality: "measured", invoice_no: "F-1", supplier: "GazCo", evidence_ids: ["evd-x"], duplicate_override_reason: null, note: "", detail: null,
  };
  s.db.evidence.push({ id: "evd-x", tenant_id: s.tenantId, file_name: "f.pdf", size_bytes: 1, sha256: "00", mime: "application/pdf", uploaded_at: "", uploaded_by: "u-veri", stored: false });
  const r = s.createRecord(v);
  s.saveRun(r.id, RESULT, [{ id: "TEST-NG-CO2", version: "1.0" }], { id: "m", version: "0.1" });
  s.submit(r.id);
  s.switchUser("u-onay");
  s.decide(r.id, "approved", "uygun");
  return s;
}

describe("senaryo defteri (REG-05, §22, kural 7)", () => {
  let s: Store;
  beforeEach(() => {
    s = fresh();
  });

  it("senaryo girişleri envanter toplamını ve manifest karmasını değiştirmez", async () => {
    const p = s.periods()[0];
    const before = await s.buildManifest(p.id);
    const hBefore = await sha256Hex(canonicalJson(before));
    const fpBefore = inventoryFingerprint(s.db);
    expect(before.totals.approved_co2e_kg).toBe("5000");
    s.switchUser("u-onay");
    const price = addShadowPrice(s, { value: "85,5", currency: "EUR", effective_from: "2026-01-01", review_cycle: "yıllık", note: "" });
    addAllocationScenario(s, { label: "2026 tahsis", facility_id: null, allowance_qty: "4", expected_emissions_qty: "5", benchmark_note: "", note: "" });
    addLedgerEntry(s, { kind: "credit", quantity_tco2e: "100", vintage: "2025", standard_ref: "test", evidence_ref: "", note: "" });
    addLedgerEntry(s, { kind: "removal", quantity_tco2e: "3", vintage: "2026", standard_ref: "", evidence_ref: "", note: "" });
    addImpactScenario(s, { title: "Kazan verimi", action_ref: "tsk-x", assumed_reduction_tco2e: "2", shadow_price_id: price.id, note: "" });
    const after = await s.buildManifest(p.id);
    expect(await sha256Hex(canonicalJson(after))).toBe(hBefore);
    expect(after.totals.approved_co2e_kg).toBe("5000"); // kredi/giderim düşülmedi
    expect(inventoryFingerprint(s.db)).toBe(fpBefore);
  });

  it("gölge fiyat satırı performans modülünün beklediği alanları taşır", () => {
    s.switchUser("u-onay");
    addShadowPrice(s, { value: "1.250,75", currency: "TRY", effective_from: "2026-01-01", review_cycle: "yıllık", note: "" });
    const rows = s.rows<{ id: string; tenant_id: string; created_at: string; created_by: string; version: number; value: string; currency: string; per_unit: string; effective_from: string; set_by_role: string }>("disiliskiler", "shadow_price");
    expect(rows.length).toBe(1);
    expect(rows[0]).toMatchObject({ value: "1250.75", currency: "TRY", per_unit: "tCO2e", effective_from: "2026-01-01", set_by_role: "approver" });
    expect(currentShadowPrice(s)!.decision_ref).toBe("K-11");
  });

  it("tahsis senaryosu açık/fazla hesaplar ve senaryo olarak kalır; etki senaryosu fiyat × azaltım", () => {
    s.switchUser("u-yonetici");
    const sc = addAllocationScenario(s, { label: "x", facility_id: null, allowance_qty: "1000", expected_emissions_qty: "1200,5", benchmark_note: "", note: "" });
    expect(sc.difference).toBe("-200.5");
    expect(sc.outcome).toBe("deficit");
    const price = addShadowPrice(s, { value: "80", currency: "EUR", effective_from: "2026-01-01", review_cycle: "", note: "" });
    const imp = addImpactScenario(s, { title: "t", action_ref: "", assumed_reduction_tco2e: "12.5", shadow_price_id: price.id, note: "" });
    expect(imp.shadow_value).toBe("1000");
    expect(imp.currency).toBe("EUR");
  });

  it("değişmezlik denetimi: envantere dokunan senaryo işlemi geri alınır (SCENARIO_NOT_INVENTORY)", () => {
    const n = s.db.records.length;
    expect(() =>
      scenarioWrite(s, () => {
        s.db.records.push({ id: "act-hack", tenant_id: s.tenantId, state: "draft", current_version: 1, author_id: "x", approval_id: null, training: false });
      }),
    ).toThrowError(expect.objectContaining({ code: "SCENARIO_NOT_INVENTORY" }));
    expect(s.db.records.length).toBe(n);
  });

  it("yetki: veri giren ve izleyici senaryo yazamaz", () => {
    s.switchUser("u-veri");
    expect(() => addShadowPrice(s, { value: "1", currency: "EUR", effective_from: "2026-01-01", review_cycle: "", note: "" })).toThrowError(StoreError);
    s.switchUser("u-izleyici");
    expect(() => addLedgerEntry(s, { kind: "avoided", quantity_tco2e: "1", vintage: "", standard_ref: "", evidence_ref: "", note: "" })).toThrow(/yetki/i);
  });
});
