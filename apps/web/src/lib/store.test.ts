import { beforeEach, describe, expect, it } from "vitest";
import { resetAll, Store, StoreError, sumDecimalStrings } from "./store";
import { parseQuantity } from "./quantity";
import type { ActivityRecordVersion, CalcResult } from "./domain";

function fresh(): Store {
  resetAll();
  return new Store();
}
const RESULT: CalcResult = {
  engine_version: "0.1.0", method: { id: "m", version: "0.1" }, status: "computed", blocks: [], warnings: [], normalized_activity: { quantity: "100", unit: "GJ", basis: "LHV" },
  components: [{ gas: "CO2", factor_id: "TEST-NG-CO2", factor_version: "1.0", mass_kg: "5000", gwp: null, gwp_applied: false, co2e_kg: "5000" }],
  total_co2e_kg: "5000", coverage: "co2_only", claim_tr: "x", boundary: "combustion", trace: [], inputs_hash: "sha256:abc",
};
function setup(s: Store) {
  s.switchUser("u-yonetici");
  s.createTenant({ name: "Test AŞ", country: "TR", nace_code: "C24", profile_id: "agir-sanayi", profile_version: "0.1.0" });
  s.confirmProfile("agir-sanayi", "0.1.0");
  const f = s.addFacility({ name: "Tesis", city: "Gebze", profile_id: null });
  const p = s.addPeriod({ start: "2026-01-01", end: "2026-12-31" });
  const src = s.addSource({ facility_id: f.id, name: "Kazan", source_type: "stationary_combustion", fuel: "natural_gas", control: "owned", created_from: "manual" });
  return { f, p, src };
}
function version(src: string, p: string, over: Partial<ActivityRecordVersion> = {}): Omit<ActivityRecordVersion, "record_id" | "tenant_id" | "version" | "created_at" | "created_by"> {
  return {
    change_reason: null, source_id: src, period_id: p, period_start: "2026-01-01", period_end: "2026-01-31", quantity: "100", quantity_state: "known", unit: "GJ", heating_value_basis: "LHV",
    reference_conditions: null, calorific_value: null, basis_conversion: null, data_quality: "measured", invoice_no: "F-1", supplier: "GazCo", evidence_ids: [], duplicate_override_reason: null, note: "", detail: null, ...over,
  };
}

describe("miktar okuma (§11)", () => {
  it("1.234 belirsizdir", () => expect(parseQuantity("1.234", null).ambiguous).toBe(true));
  it("1.234,5 → 1234.5", () => expect(parseQuantity("1.234,5", null).value).toBe("1234.5"));
  it("1,5 → 1.5", () => expect(parseQuantity("1,5", null).value).toBe("1.5"));
  it("negatif reddedilir", () => expect(parseQuantity("-3", null).error).toMatch(/Negatif/));
  it("metin reddedilir", () => expect(parseQuantity("12 TL", null).error).toBeTruthy());
});

describe("ondalık toplama", () => {
  it("tam toplar", () => expect(sumDecimalStrings(["5000", "0.4", "12.25"])).toBe("5012.65"));
});

describe("iş akışı (§21)", () => {
  let s: Store;
  beforeEach(() => {
    s = fresh();
  });
  it("T18 sürüm çakışması veriyi ezmez", () => {
    const { p, src } = setup(s);
    s.switchUser("u-veri");
    const r = s.createRecord(version(src.id, p.id));
    s.updateRecord(r.id, 1, { note: "a" }, "ilk düzeltme");
    expect(() => s.updateRecord(r.id, 1, { note: "b" }, "eski sürümle")).toThrowError(StoreError);
    expect(s.current(r.id).note).toBe("a");
  });
  it("T07 aynı fatura ikinci kez gerekçesiz kaydedilmez", () => {
    const { p, src } = setup(s);
    s.switchUser("u-veri");
    s.createRecord(version(src.id, p.id));
    expect(() => s.createRecord(version(src.id, p.id))).toThrow(/mükerrer|aynı belge/i);
    const r2 = s.createRecord(version(src.id, p.id, { duplicate_override_reason: "iki ayrı sayaç" }));
    expect(s.tasks().some((t) => t.kind === "duplicate_review" && t.related_record_id === r2.id)).toBe(true);
  });
  it("T20 birim bilinmiyorsa taslak korunur ve görev açılır", () => {
    const { p, src } = setup(s);
    s.switchUser("u-veri");
    const r = s.createRecord(version(src.id, p.id, { unit: null }));
    expect(s.record(r.id).state).toBe("validation_required");
    expect(s.tasks().some((t) => t.kind === "missing_info")).toBe(true);
  });
  it("görev ayrılığı: veri giren kendi kaydını onaylayamaz; onaylayan onaylar; sonra değişiklik onayı geçersizleştirir", () => {
    const { p, src } = setup(s);
    s.switchUser("u-veri");
    const r = s.createRecord(version(src.id, p.id, { evidence_ids: [] }));
    s.saveRun(r.id, RESULT, [{ id: "TEST-NG-CO2", version: "1.0" }], { id: "m", version: "0.1" });
    expect(s.record(r.id).state).toBe("calculated");
    s.submit(r.id);
    expect(s.record(r.id).state).toBe("in_review");
    expect(() => s.decide(r.id, "approved", "ok")).toThrow(/yetki/i);
    s.switchUser("u-onay");
    expect(() => s.decide(r.id, "approved", "ok")).toThrow(/Kanıtsız/);
    s.switchUser("u-veri");
    const ev = s.db.evidence; ev.push({ id: "evd-x", tenant_id: s.tenantId, file_name: "f.pdf", size_bytes: 1, sha256: "00", mime: "application/pdf", uploaded_at: "", uploaded_by: "u-veri", stored: false });
    s.switchUser("u-onay");
    s.decide(r.id, "changes_requested", "kanıt ekleyin");
    s.switchUser("u-veri");
    s.updateRecord(r.id, 1, { evidence_ids: ["evd-x"] }, "kanıt eklendi");
    s.saveRun(r.id, RESULT, [{ id: "TEST-NG-CO2", version: "1.0" }], { id: "m", version: "0.1" });
    s.submit(r.id);
    s.switchUser("u-onay");
    s.decide(r.id, "approved", "kanıt ve yöntem uygun");
    expect(s.record(r.id).state).toBe("approved");
    s.switchUser("u-veri");
    s.updateRecord(r.id, 2, { note: "düzeltme" }, "miktar düzeltildi");
    expect(s.record(r.id).state).toBe("validation_required");
    expect(s.approvalsOf(r.id)[1].invalidated_at).not.toBeNull();
  });
  it("T17 kilitli dönem düzenlenemez; yeniden açma gerekçe ister", () => {
    const { p, src } = setup(s);
    s.switchUser("u-veri");
    const r = s.createRecord(version(src.id, p.id));
    s.switchUser("u-yonetici");
    expect(() => s.lockPeriod(p.id, null)).toThrow(/onaylı değil/);
    s.lockPeriod(p.id, "pilot kapanışı, açık eksikle");
    expect(s.period(p.id).status).toBe("locked");
    s.switchUser("u-veri");
    expect(() => s.updateRecord(r.id, 1, { note: "x" }, "deneme")).toThrow(/kilitli/i);
    s.switchUser("u-yonetici");
    expect(() => s.reopenPeriod(p.id, "kısa", "kısa")).toThrow();
    s.reopenPeriod(p.id, "faturada düzeltme geldi", "1 kayıt ve rapor v1 etkilenir");
    expect(s.period(p.id).status).toBe("open");
    expect(s.reopens(p.id).length).toBe(1);
  });
  it("T13 faktör sürümü yayımlanınca eski koşu korunur", () => {
    const { p, src } = setup(s);
    s.switchUser("u-veri");
    const r = s.createRecord(version(src.id, p.id));
    const run1 = s.saveRun(r.id, RESULT, [{ id: "TEST-NG-CO2", version: "1.0" }], { id: "m", version: "0.1" });
    s.switchUser("u-uzman");
    const { affected } = s.publishFactorVersion("TEST-NG-CO2", "1.1");
    expect(affected.map((a) => a.id)).toContain(r.id);
    expect(s.runsOf(r.id).find((x) => x.id === run1.id)?.result.total_co2e_kg).toBe("5000");
  });
  it("T19 aynı girdilerle rapor aynı karmayı verir", async () => {
    const { p, src } = setup(s);
    s.switchUser("u-veri");
    const r = s.createRecord(version(src.id, p.id));
    s.saveRun(r.id, RESULT, [{ id: "TEST-NG-CO2", version: "1.0" }], { id: "m", version: "0.1" });
    s.switchUser("u-onay");
    const a = await s.createReport(p.id, null);
    const b = await s.createReport(p.id, "yeniden üretim");
    expect(a.manifest_sha256).toBe(b.manifest_sha256);
    expect(b.manifest.totals.approved_co2e_kg).toBeNull(); // onaysız kayıt toplama girmez
  });
  it("T14 başka kurumun kaydı bulunamaz", () => {
    const { p, src } = setup(s);
    s.switchUser("u-veri");
    const r = s.createRecord(version(src.id, p.id));
    s.switchUser("u-yonetici");
    s.createTenant({ name: "Diğer AŞ", country: "TR", nace_code: null, profile_id: "genel", profile_version: "0.1.0" });
    expect(() => s.record(r.id)).toThrow(/bulunamadı/i);
    expect(s.records().length).toBe(0);
  });
  it("modül tabloları kuruma süzülür", () => {
    setup(s);
    s.insert("test", "items", { name: "a" });
    expect(s.rows("test", "items").length).toBe(1);
    s.createTenant({ name: "B", country: "TR", nace_code: null, profile_id: "genel", profile_version: "0.1.0" });
    expect(s.rows("test", "items").length).toBe(0);
  });
});
