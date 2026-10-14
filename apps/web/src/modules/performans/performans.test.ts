import { beforeEach, describe, expect, it } from "vitest";
import "./register";
import { resetAll, Store, StoreError } from "@/lib/store";
import type { ActivityRecordVersion, CalcResult } from "@/lib/domain";
import { cmp, divide, mul, pctChange, sub } from "./decimal";
import { catalog, fixIndicatorValue, fixQueue, intensity, periodValue, requireIntensity, saveIndicatorValue } from "./indicators";
import { periodEmissions, approvedTotalKg } from "./emissions";
import { comparePeriods, detectDeviations, efficiencyClaim, twoGoals } from "./analysis";
import { saveSatisfaction, saveTarget } from "./governance";
import { closeAction, measureEffect, saveOptions, savePreAssessment, saveThresholds, shadowPrice, shadowScenarioLine, startAction, startPilot, emptyAssessment, action } from "./actions";
import { assertNoPersonalData, evaluateSuggestion, myFeedback, submitSuggestion, summaryByUnit } from "./kaizen";

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
  const p1 = s.addPeriod({ start: "2025-01-01", end: "2025-12-31" });
  const p2 = s.addPeriod({ start: "2026-01-01", end: "2026-12-31" });
  const src = s.addSource({ facility_id: f.id, name: "Kazan", source_type: "stationary_combustion", fuel: "natural_gas", control: "owned", created_from: "manual" });
  return { f, p1, p2, src };
}
function version(src: string, p: string, over: Partial<ActivityRecordVersion> = {}): Omit<ActivityRecordVersion, "record_id" | "tenant_id" | "version" | "created_at" | "created_by"> {
  return {
    change_reason: null, source_id: src, period_id: p, period_start: "2026-01-01", period_end: "2026-01-31", quantity: "100", quantity_state: "known", unit: "GJ", heating_value_basis: "LHV",
    reference_conditions: null, calorific_value: null, basis_conversion: null, data_quality: "measured", invoice_no: "F-1", supplier: "GazCo", evidence_ids: [], duplicate_override_reason: null, note: "", detail: null, ...over,
  };
}
function approvedRecord(s: Store, src: string, p: string, total: string, invoice: string) {
  s.switchUser("u-veri");
  const r = s.createRecord(version(src, p, { invoice_no: invoice, quantity: total, evidence_ids: ["evd-x"] }));
  s.saveRun(r.id, { ...RESULT, total_co2e_kg: total, components: [{ ...RESULT.components[0], co2e_kg: total, mass_kg: total }] }, [{ id: "TEST-NG-CO2", version: "1.0" }], { id: "m", version: "0.1" });
  s.submit(r.id);
  s.switchUser("u-onay");
  s.decide(r.id, "approved", "inceledim, uygun");
  s.switchUser("u-yonetici");
  return r;
}
const val = (indicator_id: string, period_id: string, value: string | null, over: Partial<Parameters<typeof saveIndicatorValue>[1]> = {}) => ({ indicator_id, period_id, unit: over.unit ?? "", value, value_state: "known" as const, data_quality: "measured" as const, ...over });

describe("ondalık yardımcıları (sunum oranı; emisyon hesabı değil)", () => {
  it("tam böler ve keser", () => {
    expect(divide("10", "4")).toBe("2.5");
    expect(divide("1", "3", 4)).toBe("0.3333");
    expect(divide("5", "0")).toBeNull();
  });
  it("çıkarma, çarpma, karşılaştırma, yüzde", () => {
    expect(sub("10.5", "0.25")).toBe("10.25");
    expect(mul("2.5", "4")).toBe("10");
    expect(cmp("2.50", "2.5")).toBe(0);
    expect(pctChange("200", "150")).toBe("-25");
  });
});

describe("GÖS: gösterge sözlüğü ve veri sözleşmesi", () => {
  let s: Store;
  beforeEach(() => {
    s = fresh();
  });
  it("katalog = çekirdek + profil göstergeleri + profil paydaları; kodda sektör yok", () => {
    setup(s);
    const ids = catalog(s).map((i) => i.id);
    expect(ids).toContain("electricity_kwh");
    expect(ids).toContain("scrap_rate"); // agir-sanayi profilinden
    expect(ids).toContain("den:production_tonnes");
    expect(ids).not.toContain("den:employees"); // genel profilin paydası bu kurumda yok
  });
  it("GÖS-03: payda yokken yoğunluk hesaplanmaz, sıfır atanmaz", () => {
    const { p2, src } = setup(s);
    approvedRecord(s, src.id, p2.id, "5000", "F-1");
    const r = intensity(s, "scope1_kgco2e", "den:production_tonnes", p2.id);
    expect(r.status).toBe("blocked");
    expect(r.code).toBe("INTENSITY_DENOMINATOR_MISSING");
    expect(r.value).toBeNull();
    expect(() => requireIntensity(s, "scope1_kgco2e", "den:production_tonnes", p2.id)).toThrowError(expect.objectContaining({ code: "INTENSITY_DENOMINATOR_MISSING" }));
    s.switchUser("u-veri");
    saveIndicatorValue(s, val("den:production_tonnes", p2.id, "250", { unit: "t" }));
    const ok = intensity(s, "scope1_kgco2e", "den:production_tonnes", p2.id);
    expect(ok.status).toBe("ok");
    expect(ok.value).toBe("20");
    expect(ok.unit).toBe("kgCO2e/t");
  });
  it("GÖS-04: sözleşme bulgusu düzeltme kuyruğuna gider, sessiz kabul yok; düzeltme eski satırı korur", () => {
    const { p2 } = setup(s);
    s.switchUser("u-veri");
    const bad = saveIndicatorValue(s, val("electricity_kwh", p2.id, "1200", { unit: "MWh" }));
    expect(bad.status).toBe("needs_fix");
    expect(bad.findings.join(" ")).toMatch(/Birim/);
    expect(fixQueue(s).map((r) => r.id)).toContain(bad.id);
    expect(periodValue(s, "electricity_kwh", p2.id).state).toBe("needs_fix");
    const fixed = fixIndicatorValue(s, bad.id, { unit: "kWh" });
    expect(fixed.status).toBe("accepted");
    expect(fixed.supersedes).toBe(bad.id);
    expect(fixQueue(s)).toHaveLength(0);
    expect(periodValue(s, "electricity_kwh", p2.id).value).toBe("1200");
    // zaman: dönem dışı aralık
    const late = saveIndicatorValue(s, val("water_withdrawal_m3", p2.id, "10", { unit: "m3", period_start: "2027-01-01", period_end: "2027-01-31" }));
    expect(late.status).toBe("needs_fix");
    // tutarlılık: tüketim ≤ çekim
    saveIndicatorValue(s, val("water_withdrawal_m3", p2.id, "100", { unit: "m3" }));
    const cons = saveIndicatorValue(s, val("water_consumption_m3", p2.id, "150", { unit: "m3" }));
    expect(cons.status).toBe("needs_fix");
    expect(cons.findings.join(" ")).toMatch(/çekim/);
    // negatif
    expect(saveIndicatorValue(s, val("fuels_gj", p2.id, "-3", { unit: "GJ" })).status).toBe("needs_fix");
  });
  it("kural 2: bilinmeyen değer sıfır olmaz; 'biliniyor' boş değerle kaydedilmez; emisyon elle girilmez", () => {
    const { p2 } = setup(s);
    s.switchUser("u-veri");
    expect(() => saveIndicatorValue(s, val("electricity_kwh", p2.id, null, { unit: "kWh" }))).toThrowError(expect.objectContaining({ code: "VALUE_STATE_MISMATCH" }));
    const u = saveIndicatorValue(s, { indicator_id: "electricity_kwh", period_id: p2.id, unit: "kWh", value: null, value_state: "unknown", data_quality: "measured" });
    expect(u.value).toBeNull();
    expect(periodValue(s, "electricity_kwh", p2.id).state).toBe("unknown");
    expect(() => saveIndicatorValue(s, val("scope1_kgco2e", p2.id, "1", { unit: "kgCO2e" }))).toThrowError(expect.objectContaining({ code: "INDICATOR_NOT_ENTERABLE" }));
    s.switchUser("u-izleyici");
    expect(() => saveIndicatorValue(s, val("electricity_kwh", p2.id, "1", { unit: "kWh" }))).toThrowError(expect.objectContaining({ code: "FORBIDDEN" }));
  });
  it("§23: eğitim saati çalışan sayısı olmadan oranlanmaz", () => {
    const { p2 } = setup(s);
    s.switchUser("u-veri");
    saveIndicatorValue(s, val("training_hours", p2.id, "400", { unit: "saat" }));
    expect(periodValue(s, "training_hours_per_fte", p2.id).state).toBe("missing");
    saveIndicatorValue(s, val("headcount_fte", p2.id, "80", { unit: "FTE" }));
    expect(periodValue(s, "training_hours_per_fte", p2.id).value).toBe("5");
  });
});

describe("Analiz (§22, v1.1 kabul)", () => {
  let s: Store;
  beforeEach(() => {
    s = fresh();
  });
  it("çıktı düşerken mutlak düşüş 'verimlilik arttı' demez; fark ayrıştırması görünür", () => {
    const { p1, p2, src } = setup(s);
    approvedRecord(s, src.id, p1.id, "10000", "F-1");
    approvedRecord(s, src.id, p2.id, "8000", "F-2");
    s.switchUser("u-veri");
    saveIndicatorValue(s, val("den:production_tonnes", p1.id, "1000", { unit: "t" }));
    saveIndicatorValue(s, val("den:production_tonnes", p2.id, "500", { unit: "t" }));
    const c = comparePeriods(s, p1.id, p2.id, ["scope1_kgco2e"]);
    const row = c.intensities.find((x) => x.numerator_id === "scope1_kgco2e")!;
    expect(row.a.value).toBe("10");
    expect(row.b.value).toBe("16");
    expect(row.claim.kind).toBe("suppressed");
    expect(row.claim.text).not.toMatch(/verimlilik arttı/i);
    expect(c.decomposition.map((d) => d.dimension)).toEqual(expect.arrayContaining(["faaliyet", "faktor", "sinir", "yontem"]));
    // çıktı düşmediğinde yoğunluk düşüşü söylenebilir
    expect(efficiencyClaim("100", "80", "10", "10", "10", "8").kind).toBe("intensity_down");
    expect(efficiencyClaim("100", "80", "10", "5", "10", "16").kind).toBe("suppressed");
  });
  it("onaylı ve taslak toplam ayrı; koşusu olmayan kayıt dışarıda", () => {
    const { p2, src } = setup(s);
    approvedRecord(s, src.id, p2.id, "5000", "F-1");
    s.switchUser("u-veri");
    const d = s.createRecord(version(src.id, p2.id, { invoice_no: "F-9" }));
    s.saveRun(d.id, RESULT, [{ id: "TEST-NG-CO2", version: "1.0" }], { id: "m", version: "0.1" });
    const n = s.createRecord(version(src.id, p2.id, { invoice_no: "F-10", quantity: "7" }));
    const e = periodEmissions(s, p2.id);
    expect(e.scopes["1"].approved_kg).toBe("5000");
    expect(e.scopes["1"].draft_kg).toBe("5000");
    expect(e.excluded.map((x) => x.record_id)).toContain(n.id);
    expect(approvedTotalKg(e)).toBe("5000");
    expect(e.label_tr).toMatch(/Hesaplanan envanter toplamı/);
    expect(e.scope3_priority_missing.length).toBeGreaterThan(0);
  });
  it("hedef kartı ve KPI sapması kullanıcı eşiğiyle", () => {
    const { p1, p2, src } = setup(s);
    approvedRecord(s, src.id, p2.id, "12000", "F-1");
    s.switchUser("u-veri");
    expect(() => saveTarget(s, { title: "x", kind: "absolute", indicator_id: "scope1_kgco2e", denominator_id: null, base_period_id: p1.id, target_year: "2030", target_value: "9000", direction: "decrease", covered_sources: [], milestones: [{ year: "2026", value: "10000" }], owner_role: "admin", owner_unit: "Enerji", status: "active", deviation_tolerance_pct: "5", note: "" })).toThrowError(expect.objectContaining({ code: "FORBIDDEN" }));
    s.switchUser("u-yonetici");
    saveTarget(s, { title: "Kapsam 1 azaltım", kind: "absolute", indicator_id: "scope1_kgco2e", denominator_id: null, base_period_id: p1.id, target_year: "2030", target_value: "9000", direction: "decrease", covered_sources: [], milestones: [{ year: "2026", value: "10000" }], owner_role: "admin", owner_unit: "Enerji", status: "active", deviation_tolerance_pct: "5", note: "" });
    const dev = detectDeviations(s, p2.id);
    expect(dev).toHaveLength(1);
    expect(dev[0].reference).toBe("10000");
    expect(dev[0].deviation_pct).toBe("20");
    expect(dev[0].deviates).toBe(true);
  });
});

describe("AKS: karar kapısı ve aksiyon motoru", () => {
  let s: Store;
  beforeEach(() => {
    s = fresh();
  });
  function pilotReady(s: Store, p1: string, p2: string) {
    const a = startAction(s, { title: "Fırın yalıtımı", trigger_type: "process_change" });
    expect(a.pre_assessment.energy.value_state).toBe("unknown"); // AKS-02: otomatik doldurulmaz
    const pre = emptyAssessment();
    pre.energy = { value_state: "known", note: "kWh/t düşüşü bekleniyor" };
    savePreAssessment(s, a.id, pre);
    const withOpts = saveOptions(s, a.id, [{ title: "Yalıtım", economic: "düşük", environmental: "orta", employee: "ısı yükü azalır", pilot_owner_role: "Üretim", pilot_owner_unit: "Hat 1", pilot_duration_days: "30" }], null);
    saveOptions(s, a.id, withOpts.options, withOpts.options[0].id);
    saveThresholds(s, a.id, {
      efficiency: { metric: { kind: "intensity", indicator_id: "electricity_kwh", denominator_id: "den:production_tonnes" }, direction: "decrease", min_change_pct: "5" },
      satisfaction: { metric: { kind: "satisfaction", unit: "Hat 1" }, direction: "increase", min_change_pct: "2" },
    });
    startPilot(s, a.id, p1, p2);
    return a;
  }
  function fillData(s: Store, p1: string, p2: string, pilotScore: string) {
    s.switchUser("u-veri");
    saveIndicatorValue(s, val("electricity_kwh", p1, "1000", { unit: "kWh" }));
    saveIndicatorValue(s, val("den:production_tonnes", p1, "10", { unit: "t" }));
    saveIndicatorValue(s, val("electricity_kwh", p2, "900", { unit: "kWh" }));
    saveIndicatorValue(s, val("den:production_tonnes", p2, "10", { unit: "t" }));
    s.switchUser("u-yonetici");
    saveSatisfaction(s, { quarter: "2025-Q4", unit: "Hat 1", score: "3.5", scale_note: "1–5", respondents: "12", method_note: "anonim anket" });
    saveSatisfaction(s, { quarter: "2026-Q1", unit: "Hat 1", score: pilotScore, scale_note: "1–5", respondents: "12", method_note: "anonim anket" });
  }
  it("etki ölçülmeden 'tamamlandı' olamaz; adım sırası korunur", () => {
    const { p1, p2 } = setup(s);
    const a = pilotReady(s, p1.id, p2.id);
    expect(() => closeAction(s, a.id)).toThrowError(expect.objectContaining({ code: "ACTION_EFFECT_REQUIRED" }));
    expect(action(s, a.id).status).toBe("pilot");
    expect(() => measureEffect(s, a.id)).toThrowError(expect.objectContaining({ code: "EFFECT_DATA_MISSING" }));
    const b = startAction(s, { title: "y", trigger_type: "regulation" });
    expect(() => startPilot(s, b.id, p1.id, p2.id)).toThrowError(expect.objectContaining({ code: "ACTION_STEP_ORDER" }));
  });
  it("iki hedef kapısı: ikisi de eşiği karşılarsa standardize, değilse yeniden tasarım", () => {
    const { p1, p2 } = setup(s);
    const a = pilotReady(s, p1.id, p2.id);
    fillData(s, p1.id, p2.id, "3.5"); // memnuniyet değişmedi → hedef 2 karşılanmadı
    const e1 = measureEffect(s, a.id);
    expect(e1.goal1_met).toBe(true);
    expect(e1.goal2_met).toBe(false);
    expect(e1.decision).toBe("redesign");
    expect(action(s, a.id).status).toBe("redesign");
    expect(() => closeAction(s, a.id)).toThrowError(expect.objectContaining({ code: "ACTION_EFFECT_REQUIRED" }));
    // yeni çeyrek skoru eşiği aşar
    s.switchUser("u-yonetici");
    saveSatisfaction(s, { quarter: "2026-Q2", unit: "Hat 1", score: "3.8", scale_note: "1–5", respondents: "12", method_note: "anonim anket" });
    const e2 = measureEffect(s, a.id);
    expect(e2.decision).toBe("standardize");
    s.switchUser("u-veri");
    expect(() => closeAction(s, a.id)).toThrowError(expect.objectContaining({ code: "FORBIDDEN" }));
    s.switchUser("u-onay");
    expect(closeAction(s, a.id).status).toBe("completed");
  });
  it("AKS-05: yatırım talebi enerji/emisyon etkisi ister; gölge fiyat senaryodur, envanteri değiştirmez (kural 7)", () => {
    const { p2, src } = setup(s);
    approvedRecord(s, src.id, p2.id, "5000", "F-1");
    expect(() => startAction(s, { title: "Yeni kompresör", trigger_type: "investment" })).toThrowError(expect.objectContaining({ code: "INVESTMENT_IMPACT_REQUIRED" }));
    expect(() => startAction(s, { title: "Yeni kompresör", trigger_type: "investment", investment_impact: { value_state: "unknown", value: null, unit: null, note: "" } })).toThrowError(expect.objectContaining({ code: "INVESTMENT_IMPACT_REQUIRED" }));
    const a = startAction(s, { title: "Yeni kompresör", trigger_type: "investment", investment_impact: { value_state: "known", value: "12.5", unit: "tCO2e", note: "yıllık azalım" } });
    expect(shadowPrice(s)).toBeNull();
    expect(shadowScenarioLine(a.investment_impact, null).status).toBe("no_price");
    const before = approvedTotalKg(periodEmissions(s, p2.id));
    s.insert("disiliskiler", "shadow_price", { price: "80", currency: "EUR", per_unit: "tCO2e", note: "test" });
    const line = shadowScenarioLine(a.investment_impact, shadowPrice(s));
    expect(line.status).toBe("ok");
    expect(line.amount).toBe("1000");
    expect(line.text).toMatch(/SENARYO/);
    expect(approvedTotalKg(periodEmissions(s, p2.id))).toBe(before);
    expect(periodValue(s, "scope1_kgco2e", p2.id).value).toBe("5000");
  });
});

describe("KZN: Green Kaizen", () => {
  let s: Store;
  beforeEach(() => {
    s = fresh();
  });
  it("öneri → ön değerlendirme → aksiyon tetikleyicisi; 'uygun değil' gerekçe ister", () => {
    setup(s);
    s.switchUser("u-izleyici");
    const k = submitSuggestion(s, { observed: "Fırın kapağı açık kalıyor", proposal: "Kapak sensörü", area: "Fırın 2", unit: "Hat 1" });
    expect(k.status).toBe("received");
    expect(() => evaluateSuggestion(s, k.id, "transferred", "")).toThrowError(expect.objectContaining({ code: "FORBIDDEN" }));
    s.switchUser("u-uzman");
    expect(() => evaluateSuggestion(s, k.id, "not_suitable", "")).toThrowError(expect.objectContaining({ code: "KAIZEN_REASON_REQUIRED" }));
    const t = evaluateSuggestion(s, k.id, "transferred", "pilotla denenebilir");
    expect(t.action_id).toBeTruthy();
    expect(action(s, t.action_id!).trigger_type).toBe("employee_suggestion");
    expect(action(s, t.action_id!).trigger_ref).toBe(k.id);
  });
  it("kural 11: birim özeti kişi alanı içermez; geri bildirim yalnız kendi önerisi", () => {
    setup(s);
    s.switchUser("u-veri");
    submitSuggestion(s, { observed: "a", proposal: "b", area: "c", unit: "Hat 1" });
    s.switchUser("u-izleyici");
    submitSuggestion(s, { observed: "d", proposal: "e", area: "f", unit: "Hat 1" });
    submitSuggestion(s, { observed: "g", proposal: "h", area: "i", unit: "Hat 2" });
    const sum = summaryByUnit(s);
    expect(sum.map((u) => u.unit)).toEqual(["Hat 1", "Hat 2"]);
    expect(sum[0].received).toBe(2);
    expect(sum[0].implementation_rate_pct).toBe("0");
    const json = JSON.stringify(sum);
    for (const k of ["author_id", "created_by", "u-veri", "u-izleyici", "Ayşe", "Denetçi"]) expect(json).not.toContain(k);
    expect(() => assertNoPersonalData([{ unit: "x", author_id: "u-veri" }])).toThrowError(expect.objectContaining({ code: "PERSONAL_RANKING_FORBIDDEN" }));
    expect(myFeedback(s)).toHaveLength(2); // yalnız u-izleyici'nin önerileri
    s.switchUser("u-veri");
    expect(myFeedback(s)).toHaveLength(1);
    s.switchUser("u-yonetici");
    expect(() => saveSatisfaction(s, { quarter: "2026-Q1", unit: "Hat 1", score: "4", scale_note: "1–5", respondents: "1", method_note: "" })).toThrowError(expect.objectContaining({ code: "PERSONAL_RANKING_FORBIDDEN" }));
  });
  it("iki hedefin durumu birim düzeyinde toplanır", () => {
    const { p2 } = setup(s);
    submitSuggestion(s, { observed: "a", proposal: "b", area: "c", unit: "Hat 1" });
    const g = twoGoals(s, p2.id);
    expect(g.satisfaction.total_suggestions).toBe(1);
    expect(JSON.stringify(g.satisfaction)).not.toContain("author_id");
    expect(g.efficiency.intensities.every((i) => i.result.status === "blocked")).toBe(true);
  });
});

describe("hata sözlüğü ve yetki kaydı", () => {
  it("modül kodları kayıtlı", async () => {
    const { explain } = await import("@/lib/errors");
    const { PERMISSIONS } = await import("@/lib/domain");
    for (const c of ["INTENSITY_DENOMINATOR_MISSING", "ACTION_EFFECT_REQUIRED", "DATA_CONTRACT_FAILED", "PERSONAL_RANKING_FORBIDDEN", "INVESTMENT_IMPACT_REQUIRED"]) expect(explain(c)?.action).toBeTruthy();
    expect(PERMISSIONS["performans.kaizen.submit"]).toContain("viewer");
    expect(PERMISSIONS["performans.action.close"]).toEqual(expect.arrayContaining(["admin", "approver"]));
    expect(PERMISSIONS["performans.action.close"]).not.toContain("data_entry");
    expect(StoreError).toBeTruthy();
  });
});
