import { beforeEach, describe, expect, it } from "vitest";
import "./register";
import { resetAll, Store, StoreError } from "@/lib/store";
import type { ActivityRecordVersion, CalcResult } from "@/lib/domain";
import type { AggregateResult } from "@/lib/calc";
import { addLine, boundaryLabel, buildLineRequest, buildStudyAggregateRequest, createStudy, emptyExplanation, isCurrentResult, latestResult, lineResultFrom, missingExplanation, resultsOf, saveStudyResult, updateStudy, type StudyInput } from "./study";
import { assertProductSeparation, attachAssurance, buildAggregateRequest, createPackage, elementPresent, publishPackage, publications, reportingIndex, reportingMaps } from "./report";
import { buildCsv, buildDocumentXml, buildDocxBytes, packageSections, sanitizeCell, zipStore } from "./export";
import type { AggregateRequest, PackageManifest } from "./types";

function fresh(): Store {
  resetAll();
  return new Store();
}
const RESULT: CalcResult = {
  engine_version: "0.2.0", method: { id: "m", version: "0.1" }, status: "computed", blocks: [], warnings: [], normalized_activity: { quantity: "100", unit: "GJ", basis: "LHV" },
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
function studyInput(over: Partial<StudyInput> = {}): StudyInput {
  return {
    product_name: "Profil A", product_version: "2026-A", reference_flow: { quantity: "1", unit: "kg" }, functional_unit: null, functional_unit_note: "",
    boundary: "gate_to_gate", boundary_explanation: { ...emptyExplanation(), start_process: "Ergitme", end_process: "Haddeleme" },
    period: { start: "2026-01-01", end: "2026-06-30" }, processes: [], ...over,
  };
}
// Sahte motor toplama çıktısı (motor yok; sözleşme biçimi CONTRACT-v0.2 §7)
function fakeAgg(req: AggregateRequest, over: Partial<AggregateResult["corporate"]> = {}): AggregateResult {
  const corp = req.results.filter((r) => r.context === "corporate" && req.policy.include_states.includes(r.state) && r.result.total_co2e_kg !== null);
  const product: AggregateResult["product"] = {};
  for (const r of req.results) if (r.context === "product" && r.study_id) product[r.study_id] = { total_kg: r.result.total_co2e_kg, claim_tr: "kısmi ürün karbon ayak izi" };
  return {
    engine_version: "0.2.0",
    corporate: {
      scope1_kg: corp.length ? "5000" : null, scope2_kg: null, scope2_method: req.policy.scope2_method, scope2_alternative_kg: null, scope3_kg: null, scope3_by_category: {},
      total_kg: corp.length ? "5000" : null, label_tr: "Hesaplanan envanter toplamı",
      excluded: req.results.filter((r) => r.context === "corporate" && !req.policy.include_states.includes(r.state)).map((r) => ({ record_id: r.record_id, reason: `durum ${r.state}` })),
      coverage_notes_tr: [], estimated_share_by_count: corp.length ? "0" : null, estimated_share_by_kg: corp.length ? "0" : null, ...over,
    },
    product, biogenic_co2_kg: null, not_applicable: [], unknown: [],
  };
}

describe("ürün çalışması (§17)", () => {
  let s: Store;
  beforeEach(() => {
    s = fresh();
  });
  it("sınır etiketleri: hiçbir sınırda LCA/EPD denmez; yalnız beşikten mezara 'ürün karbon ayak izi'", () => {
    expect(boundaryLabel("cradle_to_grave")).toBe("ürün karbon ayak izi (beşikten mezara)");
    for (const b of ["gate_to_gate", "cradle_to_gate", "custom"] as const) expect(boundaryLabel(b)).toMatch(/^kısmi ürün karbon ayak izi/);
    for (const b of ["gate_to_gate", "cradle_to_gate", "cradle_to_grave", "custom"] as const) expect(boundaryLabel(b)).not.toMatch(/LCA|EPD/i);
  });
  it("sınıra göre zorunlu açıklama eksikse çalışma kaydedilmez", () => {
    setup(s);
    s.switchUser("u-veri");
    expect(missingExplanation("cradle_to_grave", emptyExplanation())).toEqual(["distribution_scenario", "use_scenario", "eol_scenario"]);
    expect(() => createStudy(s, studyInput({ boundary: "cradle_to_gate" }))).toThrow(StoreError);
    try {
      createStudy(s, studyInput({ boundary: "custom" }));
    } catch (e) {
      expect((e as StoreError).code).toBe("STUDY_BOUNDARY_INCOMPLETE");
    }
    const st = createStudy(s, studyInput());
    expect(st.boundary).toBe("gate_to_gate");
  });
  it("yetki: izleyici çalışma yazamaz", () => {
    setup(s);
    s.switchUser("u-izleyici");
    expect(() => createStudy(s, studyInput())).toThrow(/yetki/i);
  });
  it("satır isteği product_process + çalışmanın sınırı ve tahsisi ile kurulur; bağlı kayıt aynı ham veriyi taşır", () => {
    const { p, src } = setup(s);
    s.switchUser("u-veri");
    const r = s.createRecord(version(src.id, p.id));
    let st = createStudy(s, studyInput({ boundary: "cradle_to_gate", boundary_explanation: { ...emptyExplanation(), facility_exit: "Gebze", upstream_note: "tedarikçi verisi yok" } }));
    st = addLine(s, st, { kind: "energy", name: "Kazan gazı", link: { type: "record", record_id: r.id }, factor_keys: ["TEST-NG-CO2@1.0"], allocation: { basis: "mass", share: "0.6", source_ref: "üretim raporu 2026-Q1" }, note: "" }, "satır eklendi");
    const { request, factor_refs } = buildLineRequest(s, st, st.processes[0]);
    const act = request.activity as Record<string, unknown>;
    expect(act.source_type).toBe("product_process");
    expect(act.quantity).toBe("100");
    expect((act.product as Record<string, unknown>).boundary).toBe("cradle_to_gate");
    expect((act.product as Record<string, unknown>).allocation).toEqual({ basis: "mass", share: "0.6", source_ref: "üretim raporu 2026-Q1" });
    expect(factor_refs).toEqual([{ id: "TEST-NG-CO2", version: "1.0" }]);
    const agg = buildStudyAggregateRequest(st, [lineResultFrom(st.processes[0], RESULT, factor_refs)]);
    expect(agg.results.every((x) => x.context === "product")).toBe(true);
  });
  it("sonuçlar değişmez: tanım değişince yeni sürüm, eski sonuç korunur ve 'güncel değil' olur", () => {
    setup(s);
    s.switchUser("u-veri");
    let st = createStudy(s, studyInput());
    st = addLine(s, st, { kind: "route", name: "Haddeleme", link: { type: "own", quantity: "10", quantity_state: "known", unit: "GJ", heating_value_basis: "LHV", data_quality: "measured", fuel: "natural_gas" }, factor_keys: ["TEST-NG-CO2@1.0"], allocation: null, note: "" }, "satır");
    const lines = [lineResultFrom(st.processes[0], RESULT, [{ id: "TEST-NG-CO2", version: "1.0" }])];
    const agg = fakeAgg(buildStudyAggregateRequest(st, lines));
    const r1 = saveStudyResult(s, st, lines, agg, null);
    expect(r1.study_total_kg).toBe("5000");
    expect(r1.included_in_corporate_total).toBe(false);
    expect(isCurrentResult(st, latestResult(s, st))).toBe(true);
    const v1 = st.version;
    const st2 = updateStudy(s, st.id, { product_version: "2026-B" }, "ürün sürümü değişti", v1);
    expect(st2.version).toBe(v1 + 1);
    expect(isCurrentResult(st2, latestResult(s, st2))).toBe(false);
    const r2 = saveStudyResult(s, st2, lines, agg, null);
    expect(resultsOf(s, st.id).map((x) => x.id)).toEqual([r1.id, r2.id]);
    expect(resultsOf(s, st.id)[0].study_version).toBe(v1);
    expect(resultsOf(s, st.id)[1].study_version).toBe(v1 + 1);
    expect(() => updateStudy(s, st.id, { product_version: "x" }, "eski sürümle", v1)).toThrow(/değişti/);
  });
});

describe("rapor paketi (§22)", () => {
  let s: Store;
  beforeEach(() => {
    s = fresh();
  });
  function withStudy(p: string, src: string) {
    s.switchUser("u-veri");
    const r = s.createRecord(version(src, p));
    s.saveRun(r.id, RESULT, [{ id: "TEST-NG-CO2", version: "1.0" }], { id: "m", version: "0.1" });
    let st = createStudy(s, studyInput());
    st = addLine(s, st, { kind: "energy", name: "Kazan", link: { type: "record", record_id: r.id }, factor_keys: ["TEST-NG-CO2@1.0"], allocation: null, note: "" }, "satır");
    const lines = [lineResultFrom(st.processes[0], RESULT, [{ id: "TEST-NG-CO2", version: "1.0" }])];
    saveStudyResult(s, st, lines, fakeAgg(buildStudyAggregateRequest(st, lines)), null);
    return { r, st };
  }
  it("ürün çalışması kurumsal manifestte yer almaz; ayrı bölümde listelenir", async () => {
    const { p, src } = setup(s);
    const { r, st } = withStudy(p.id, src.id);
    const req = buildAggregateRequest(s, p.id, "location_based");
    expect(req.results.filter((x) => x.context === "corporate").map((x) => x.record_id)).toEqual([r.id]);
    expect(req.results.filter((x) => x.context === "product").every((x) => x.study_id === st.id && x.record_id.startsWith(st.id))).toBe(true);
    s.switchUser("u-onay");
    const pkg = await createPackage(s, p.id, null, req, fakeAgg(req));
    const m = pkg.manifest;
    expect(m.core.records.map((x) => x.record_id)).toEqual([r.id]);
    expect(m.records_detail.map((x) => x.record_id)).toEqual([r.id]);
    expect(m.product_studies).toHaveLength(1);
    expect(m.product_studies[0].included_in_corporate_total).toBe(false);
    expect(m.product_studies[0].label_tr).not.toMatch(/LCA|EPD/i);
    expect(m.aggregate.corporate.total_kg).toBeNull(); // kayıt onaysız → kurumsal toplam yok; ürün sonucu toplamı doldurmaz
    expect(m.gaps_tr.some((g) => g.includes("ürün çalışması"))).toBe(true);
  });
  it("PRODUCT_NOT_IN_CORPORATE_TOTAL: ürün satırı kurumsal listede görünürse paket reddedilir", () => {
    const { p, src } = setup(s);
    withStudy(p.id, src.id);
    const req = buildAggregateRequest(s, p.id, "location_based");
    const productId = req.results.find((x) => x.context === "product")!.record_id;
    const bad = fakeAgg(req, { excluded: [{ record_id: productId, reason: "durum calculated" }] });
    expect(() => assertProductSeparation(req, bad)).toThrow(StoreError);
    try {
      assertProductSeparation(req, bad);
    } catch (e) {
      expect((e as StoreError).code).toBe("PRODUCT_NOT_IN_CORPORATE_TOTAL");
    }
    const leak = fakeAgg(req, { total_kg: "5000", scope1_kg: "5000" }); // dahil edilebilir kurumsal kayıt yokken toplam var
    expect(() => assertProductSeparation(req, leak)).toThrow(/karışmış/);
  });
  it("T19: aynı girdilerle paket aynı karmayı verir; toplam motor çıktısından", async () => {
    const { p, src } = setup(s);
    s.switchUser("u-veri");
    const r = s.createRecord(version(src.id, p.id));
    s.saveRun(r.id, RESULT, [{ id: "TEST-NG-CO2", version: "1.0" }], { id: "m", version: "0.1" });
    const req = buildAggregateRequest(s, p.id, "location_based");
    s.switchUser("u-onay");
    const a = await createPackage(s, p.id, null, req, fakeAgg(req));
    await expect(createPackage(s, p.id, null, req, fakeAgg(req))).rejects.toThrow(/neden/);
    const b = await createPackage(s, p.id, "yeniden üretim", req, fakeAgg(req));
    expect(a.package_sha256).toBe(b.package_sha256);
    expect(a.core_manifest_sha256).toBe(b.core_manifest_sha256);
    expect(b.supersedes).toBe(a.id);
    expect(a.manifest.aggregate.engine_version).toBe("0.2.0");
  });
  it("yayım: kilitli dönem + yetki gerekir; audit'e yazılır; taslak indirmek yayım değildir", async () => {
    const { p, src } = setup(s);
    s.switchUser("u-veri");
    const r = s.createRecord(version(src.id, p.id));
    s.saveRun(r.id, RESULT, [{ id: "TEST-NG-CO2", version: "1.0" }], { id: "m", version: "0.1" });
    const req = buildAggregateRequest(s, p.id, "location_based");
    s.switchUser("u-onay");
    const pkg = await createPackage(s, p.id, null, req, fakeAgg(req));
    expect(() => publishPackage(s, pkg.id, null)).toThrow(StoreError);
    try {
      publishPackage(s, pkg.id, null);
    } catch (e) {
      expect((e as StoreError).code).toBe("PUBLISH_REQUIRES_LOCKED_PERIOD");
    }
    s.switchUser("u-yonetici");
    s.lockPeriod(p.id, "pilot kapanışı");
    s.switchUser("u-veri");
    expect(() => publishPackage(s, pkg.id, null)).toThrow(/yetki/i);
    s.switchUser("u-uzman");
    expect(() => publishPackage(s, pkg.id, null)).toThrow(/yetki/i);
    s.switchUser("u-onay");
    expect(publications(s, pkg.id)).toHaveLength(0); // paket oluşturmak/indirmek yayım değildir
    const pub = publishPackage(s, pkg.id, "yönetim kurulu onayı");
    expect(pub.package_sha256).toBe(pkg.package_sha256);
    expect(() => publishPackage(s, pkg.id, null)).toThrow(/zaten/);
    s.switchUser("u-yonetici");
    expect(s.auditLog().some((a) => a.action === "urun-rapor.report.publish" && a.object_id === pub.id)).toBe(true);
  });
  it("güvence: platform/kurum kendi güvencesini veremez; bağımsız sağlayıcı + karma gerekir", async () => {
    const { p } = setup(s);
    const req = buildAggregateRequest(s, p.id, "location_based");
    s.switchUser("u-onay");
    const pkg = await createPackage(s, p.id, null, req, fakeAgg(req));
    const base = { file_name: "guvence.pdf", sha256: "a".repeat(64), scope: "Kapsam 1 ve 2", opinion: "unqualified" as const, opinion_text: "sınırlı güvence", level: "limited" as const };
    for (const provider of ["", "Koza", "Test AŞ", " test aş "]) {
      try {
        attachAssurance(s, pkg.id, { ...base, provider });
        throw new Error("geçmemeliydi");
      } catch (e) {
        expect((e as StoreError).code).toBe("ASSURANCE_SELF_LABEL_FORBIDDEN");
      }
    }
    expect(() => attachAssurance(s, pkg.id, { ...base, provider: "Bağımsız Denetim AŞ", sha256: "kısa" })).toThrow(/SHA-256/);
    const a = attachAssurance(s, pkg.id, { ...base, provider: "Bağımsız Denetim AŞ" });
    expect(a.provider).toBe("Bağımsız Denetim AŞ");
    expect(elementPresent(pkg.manifest, { assurance: true }, "assurance.external")).toBe(true);
    expect(elementPresent(pkg.manifest, { assurance: false }, "assurance.external")).toBe(false);
  });
  it("GRI/TSRS indeksi içerikten gelir; eksikleri gösterir; 'tam uyum' üretmez", async () => {
    const { p, src } = setup(s);
    s.switchUser("u-veri");
    const r = s.createRecord(version(src.id, p.id));
    s.saveRun(r.id, RESULT, [{ id: "TEST-NG-CO2", version: "1.0" }], { id: "m", version: "0.1" });
    const req = buildAggregateRequest(s, p.id, "location_based");
    s.switchUser("u-onay");
    const pkg = await createPackage(s, p.id, null, req, fakeAgg(req));
    const maps = reportingMaps();
    expect(maps.map((m) => m.id).sort()).toEqual(["gri-102-2025", "gri-305-2016", "tsrs-2"]);
    expect(maps.find((m) => m.id === "gri-102-2025")!.applicable_from).toBe("2027-01-01");
    const idx = reportingIndex(maps, pkg.manifest, { assurance: false });
    const g305 = idx.find((x) => x.map.id === "gri-305-2016")!;
    const r1 = g305.rows.find((x) => x.id === "305-1")!;
    expect(r1.missing.map((e) => e.koza)).toContain("base_year");
    expect(r1.narrative.length).toBeGreaterThan(0);
    for (const x of idx) for (const row of x.rows) expect(row.status_tr).not.toMatch(/tam uyum/i);
    expect(elementPresent(pkg.manifest, { assurance: false }, "corporate.scope1_kg")).toBe(false); // onaysız kayıt → toplam yok
  });
});

describe("dışa aktarma (§22, §25)", () => {
  it("CSV temizleyici: =, +, -, @, sekme, CR ile başlayan hücreler tırnaklanır; diğerleri değişmez", () => {
    for (const v of ["=SUM(A1)", "+1", "-3", "@cmd", "\tx", "\rx"]) expect(sanitizeCell(v)).toEqual({ value: `'${v}`, changed: true });
    expect(sanitizeCell("5000")).toEqual({ value: "5000", changed: false });
    expect(sanitizeCell(null)).toEqual({ value: "", changed: false });
    expect(sanitizeCell("a,b")).toEqual({ value: "a,b", changed: false });
  });
  it("CSV kayıt başına bir satır üretir ve temizlenen hücre sayısını bildirir", () => {
    const m = { records_detail: [{ record_id: "act-1", note: "=HYPERLINK(\"x\")", supplier: "Gaz, AŞ", quantity: "100" }, { record_id: "act-2", note: "", supplier: null, quantity: null }] } as unknown as PackageManifest;
    const { text, sanitized } = buildCsv(m);
    const lines = text.replace("﻿", "").trim().split("\r\n");
    expect(lines).toHaveLength(3);
    expect(sanitized).toBe(1);
    expect(lines[1]).toContain(`"'=HYPERLINK(""x"")"`);
    expect(lines[1]).toContain(`"Gaz, AŞ"`);
  });
  it("DOCX: geçerli ZIP imzaları ve document.xml; aynı girdi aynı bayt", () => {
    const xml = buildDocumentXml("Rapor", [{ title: "Özet", paragraphs: ["a < b & c"], table: [["k", "v"], ["x", "1"]] }]);
    expect(xml).toContain("a &lt; b &amp; c");
    expect(xml).toContain("<w:tbl>");
    const bytes = buildDocxBytes("Rapor", [{ title: "Özet", paragraphs: ["p"] }]);
    expect(Array.from(bytes.slice(0, 4))).toEqual([0x50, 0x4b, 0x03, 0x04]);
    const tail = bytes.slice(-22, -18);
    expect(Array.from(tail)).toEqual([0x50, 0x4b, 0x05, 0x06]);
    const again = buildDocxBytes("Rapor", [{ title: "Özet", paragraphs: ["p"] }]);
    expect(Buffer.from(bytes).equals(Buffer.from(again))).toBe(true);
    const z = zipStore([{ name: "a.txt", data: new TextEncoder().encode("hi") }]);
    expect(new TextDecoder().decode(z).includes("a.txt")).toBe(true);
  });
  it("bölüm modeli taslak uyarısı taşır ve ürün çalışmasını kurumsal toplamdan ayrı tutar", () => {
    const m = {
      tenant: { name: "T" }, period: { start: "2026-01-01", end: "2026-12-31", status: "open" }, engine_version: "0.2.0", method: null,
      aggregate: { corporate: { scope1_kg: null, scope2_kg: null, scope2_method: "location_based", scope2_alternative_kg: null, scope3_kg: null, scope3_by_category: {}, total_kg: null, label_tr: "Hesaplanan envanter toplamı", excluded: [], coverage_notes_tr: [], estimated_share_by_count: null, estimated_share_by_kg: null }, product: {}, biogenic_co2_kg: null, not_applicable: [], unknown: [] },
      boundary: null, core: { sources_expected: 1, sources_with_records: 0 }, sources: { engine_version: "0.2.0", catalog_id: null, factors: [], method: null, reporting_maps: [] }, gaps_tr: ["x"], quality: { estimated_share_by_count: null, estimated_share_by_kg: null, review_required_count: 0, blocked_count: 0, no_run_count: 0, evidence_missing_count: 0, unknown_count: 0, not_applicable_count: 0 },
      comparison: { previous: null, note_tr: "yok" }, evidence_index: [], product_studies: [{ product_name: "P", product_version: "1", label_tr: "kısmi ürün karbon ayak izi (kapıdan kapıya)", total_kg: "12.5", claim_tr: "c", included_in_corporate_total: false }], core_manifest_sha256: "00",
    } as unknown as PackageManifest;
    const secs = packageSections(m, { publications: [], assurances: [], index: [], report_id: "rep-1", report_version: 1, package_sha256: "11" });
    expect(secs[0].paragraphs[0]).toMatch(/TASLAK/);
    const prod = secs.find((x) => x.title.startsWith("Ürün çalışmaları"))!;
    expect(prod.title).toMatch(/dahil değil/);
    expect(secs.find((x) => x.title === "Güvence")!.paragraphs[0]).toMatch(/eklenmemiş/);
  });
});
