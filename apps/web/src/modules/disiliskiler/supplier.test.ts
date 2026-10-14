import { beforeEach, describe, expect, it } from "vitest";
import { resetAll, Store, StoreError } from "@/lib/store";
import "./register";
import { acknowledgeConfidentiality, addSupplier, assertFormAccess, authorizeRequest, createRequest, evaluateRisk, exportRequestText, requests, segmentation, submitQuestionnaire, submitResponse, supplierRequest, supplierRequests } from "./supplier";
import { divDecimal, mulDecimal, normalizeDecimal, percentShare, subDecimal } from "./decimal";

function fresh(): Store {
  resetAll();
  const s = new Store();
  s.switchUser("u-yonetici");
  s.createTenant({ name: "Test AŞ", country: "TR", nace_code: "C24", profile_id: "agir-sanayi", profile_version: "0.1.0" });
  return s;
}
const FIELDS = { product: "Çelik tel", reference_unit: "1 kg", system_boundary: "Beşikten kapıya", period_geo: "2025, Gebze", method: "ISO 14067", verification_status: "Bilinmiyor", documents: "hesap özeti", note: "" };
const FULL_ANSWER = { value: "1,85", unit: "kg CO2e/kg", basis: "Ürüne özgü ölçüm/hesap", allocation_info: "", system_boundary: "Beşikten kapıya", period_geo: "2025", method: "ISO 14067", verification_status: "İç kontrol", documents: "" };

describe("ondalık yardımcıları (float yok)", () => {
  it("normalize", () => {
    expect(normalizeDecimal("1.234,5")).toBe("1234.5");
    expect(normalizeDecimal("1,5")).toBe("1.5");
    expect(normalizeDecimal("12 TL")).toBeNull();
    expect(normalizeDecimal("0.10")).toBe("0.1");
  });
  it("çarpma, çıkarma, bölme kesme", () => {
    expect(mulDecimal("0.1", "0.2")).toBe("0.02");
    expect(subDecimal("5", "7.25")).toBe("-2.25");
    expect(divDecimal("1", "3", 4)).toBe("0.3333");
    expect(percentShare("1", "3")).toBe("33.33");
    expect(percentShare("1", "0")).toBeNull();
  });
});

describe("tedarikçi programı (TDR, §14, §09)", () => {
  let s: Store;
  beforeEach(() => {
    s = fresh();
  });

  it("TDR-01 kritik %20 segmentasyonu deterministik ve para birimine göre ayrı", () => {
    const names = ["A", "B", "C", "D", "E"];
    const spend = ["1000", "5000", "300", "5000", "20"];
    const cls = ["low", "high", "unknown", "medium", "low"] as const;
    names.forEach((n, i) => addSupplier(s, { name: n, spend_currency: "TRY", spend_amount: spend[i], intensity_class: cls[i], intensity_reason: "test", product_groups: ["x"], cbam_relevant: null, contact_note: "" }));
    addSupplier(s, { name: "EUR-1", spend_currency: "EUR", spend_amount: "100", intensity_class: "high", intensity_reason: "test", product_groups: [], cbam_relevant: null, contact_note: "" });
    const g1 = segmentation(s);
    const g2 = segmentation(s);
    expect(JSON.stringify(g1.map((g) => g.rows.map((r) => [r.supplier.name, r.score, r.first_wave])))).toBe(JSON.stringify(g2.map((g) => g.rows.map((r) => [r.supplier.name, r.score, r.first_wave]))));
    const tryGroup = g1.find((g) => g.currency === "TRY")!;
    expect(tryGroup.rows.map((r) => r.supplier.name)).toEqual(["B", "D", "A", "C", "E"]); // 15000, 10000, 1000, 900, 20
    expect(tryGroup.first_wave_count).toBe(1); // ceil(5 × 20 / 100)
    expect(tryGroup.rows.filter((r) => r.first_wave).map((r) => r.supplier.name)).toEqual(["B"]);
    expect(tryGroup.total_score).toBe("26920");
    expect(tryGroup.rows[0].share_percent).toBe("55.72");
    expect(g1.find((g) => g.currency === "EUR")!.rows.length).toBe(1);
  });

  it("bilinmeyen harcama sıfır sayılmaz; en sona düşer", () => {
    addSupplier(s, { name: "X", spend_currency: "TRY", spend_amount: "", intensity_class: "high", intensity_reason: "t", product_groups: [], cbam_relevant: null, contact_note: "" });
    addSupplier(s, { name: "Y", spend_currency: "TRY", spend_amount: "1", intensity_class: "low", intensity_reason: "t", product_groups: [], cbam_relevant: null, contact_note: "" });
    const g = segmentation(s)[0];
    expect(g.rows[1].supplier.name).toBe("X");
    expect(g.rows[1].score).toBeNull();
  });

  it("CBAM ilgisi paket açık değilken işaretlenemez", () => {
    expect(() => addSupplier(s, { name: "X", spend_currency: "TRY", spend_amount: "1", intensity_class: "high", intensity_reason: "t", product_groups: [], cbam_relevant: true, contact_note: "" })).toThrow(/CBAM paketi/);
  });

  it("tedarikçi yalnız kendine atanmış ve yetkilendirilmiş talebi görür (SUPPLIER_SCOPE_VIOLATION)", () => {
    const a = addSupplier(s, { name: "A", spend_currency: "TRY", spend_amount: "1", intensity_class: "high", intensity_reason: "t", product_groups: [], cbam_relevant: null, contact_note: "" });
    const b = addSupplier(s, { name: "B", spend_currency: "TRY", spend_amount: "1", intensity_class: "high", intensity_reason: "t", product_groups: [], cbam_relevant: null, contact_note: "" });
    const ra = createRequest(s, { supplier_id: a.id, fields: FIELDS });
    const rb = createRequest(s, { supplier_id: b.id, fields: FIELDS });
    authorizeRequest(s, ra.id, "muhatap, kapsam ve ekler doğrulandı");
    authorizeRequest(s, rb.id, "muhatap, kapsam ve ekler doğrulandı");
    expect(supplierRequests(s, a.id).map((r) => r.id)).toEqual([ra.id]);
    expect(() => supplierRequest(s, a.id, rb.id)).toThrowError(expect.objectContaining({ code: "SUPPLIER_SCOPE_VIOLATION" }));
    // taslak (yetkisiz) talep tedarikçiye görünmez
    const rc = createRequest(s, { supplier_id: a.id, fields: FIELDS });
    expect(supplierRequests(s, a.id).some((r) => r.id === rc.id)).toBe(false);
  });

  it("TDR-02 gizlilik kapısı: taahhüt onayı olmadan form açılmaz", () => {
    const a = addSupplier(s, { name: "A", spend_currency: "TRY", spend_amount: "1", intensity_class: "high", intensity_reason: "t", product_groups: [], cbam_relevant: null, contact_note: "" });
    const r = createRequest(s, { supplier_id: a.id, fields: FIELDS });
    authorizeRequest(s, r.id, "muhatap, kapsam ve ekler doğrulandı");
    expect(() => assertFormAccess(s, a.id, r.id)).toThrowError(expect.objectContaining({ code: "CONFIDENTIALITY_ACK_REQUIRED" }));
    expect(() => submitResponse(s, a.id, r.id, FULL_ANSWER)).toThrowError(expect.objectContaining({ code: "CONFIDENTIALITY_ACK_REQUIRED" }));
    const ack = acknowledgeConfidentiality(s, a.id, r.id);
    expect(ack.confidentiality_version).toBe(r.confidentiality_version);
    expect(assertFormAccess(s, a.id, r.id).id).toBe(r.id);
  });

  it("§09 dış gönderim açık yetki ister ve denetim izine yazılır; e-posta yok", () => {
    const a = addSupplier(s, { name: "A", spend_currency: "TRY", spend_amount: "1", intensity_class: "high", intensity_reason: "t", product_groups: [], cbam_relevant: null, contact_note: "" });
    const r = createRequest(s, { supplier_id: a.id, fields: FIELDS });
    expect(() => exportRequestText(s, r.id)).toThrowError(expect.objectContaining({ code: "EXTERNAL_SEND_AUTHORIZATION_REQUIRED" }));
    s.switchUser("u-veri");
    expect(() => authorizeRequest(s, r.id, "muhatap doğrulandı, kapsam uygun")).toThrow(/yetki/i);
    s.switchUser("u-yonetici");
    authorizeRequest(s, r.id, "muhatap doğrulandı, kapsam uygun");
    const text = exportRequestText(s, r.id);
    expect(text).toContain("yalnız toplulaştırılmış kullanım".slice(0, 5).toLowerCase() === "yalnı" ? "Yalnız toplulaştırılmış kullanım" : "toplulaştırılmış");
    const audit = s.auditLog();
    expect(audit.some((e) => e.action === "disiliskiler.request.authorize_external" && e.object_id === r.id)).toBe(true);
    expect(audit.some((e) => e.action === "disiliskiler.request.export")).toBe(true);
  });

  it("§14 yanıt sürümlü; şirket toplamı tahsissiz → işaret (ret değil); eksik → tamamlayıcı talep", () => {
    const a = addSupplier(s, { name: "A", spend_currency: "TRY", spend_amount: "1", intensity_class: "high", intensity_reason: "t", product_groups: [], cbam_relevant: null, contact_note: "" });
    const r = createRequest(s, { supplier_id: a.id, fields: FIELDS });
    authorizeRequest(s, r.id, "muhatap doğrulandı, kapsam uygun");
    acknowledgeConfidentiality(s, a.id, r.id);
    const first = submitResponse(s, a.id, r.id, { ...FULL_ANSWER, basis: "Yalnız şirket toplamı (tahsis yok)" });
    expect(first.response.flags.some((f) => f.code === "COMPANY_TOTAL_WITHOUT_ALLOCATION")).toBe(true);
    expect(first.response.complete).toBe(false);
    expect(first.complement).not.toBeNull();
    expect(first.complement!.parent_request_id).toBe(r.id);
    expect(first.complement!.status).toBe("draft"); // yeniden yetki ister
    expect(requests(s).find((x) => x.id === r.id)!.status).toBe("needs_complement");
    const second = submitResponse(s, a.id, r.id, { ...FULL_ANSWER, basis: "Şirket toplamından tahsis", allocation_info: "kütle bazlı" });
    expect(second.response.response_version).toBe(2);
    expect(second.response.complete).toBe(true);
    expect(second.response.answers.value).toBe("1.85");
    expect(requests(s).find((x) => x.id === r.id)!.status).toBe("answered");
  });

  it("TDR-03 risk kuralları içerikten; yüksek risk saha ziyareti görevi açar (ceza değil)", () => {
    const low = evaluateRisk({ inventory_exists: "yes_verified", product_data: "yes", energy_records: "monthly", responsible_person: "yes", regulated_scope: "no" });
    expect(low.level).toBe("low");
    expect(low.points).toBe(0);
    const unanswered = evaluateRisk({});
    expect(unanswered.points).toBe(10); // 5 soru × 2 (cevapsız sıfır sayılmaz)
    expect(unanswered.level).toBe("high");
    const override = evaluateRisk({ inventory_exists: "yes_verified", product_data: "no", energy_records: "monthly", responsible_person: "yes", regulated_scope: "no" });
    expect(override.level).toBe("high");
    expect(override.trace.some((t) => t.includes("doğrudan kural"))).toBe(true);
    const a = addSupplier(s, { name: "A", spend_currency: "TRY", spend_amount: "1", intensity_class: "high", intensity_reason: "t", product_groups: [], cbam_relevant: null, contact_note: "" });
    const q = submitQuestionnaire(s, a.id, {});
    expect(q.level).toBe("high");
    const task = s.tasks().find((t) => t.id === q.task_id);
    expect(task?.title).toMatch(/Saha ziyareti/);
    expect(task?.requirement_ids).toContain("TDR-03");
    const q2 = submitQuestionnaire(s, a.id, low.points === 0 ? { inventory_exists: "yes_verified", product_data: "yes", energy_records: "monthly", responsible_person: "yes", regulated_scope: "no" } : {});
    expect(q2.task_id).toBeNull();
  });

  it("izleyici tedarikçi yazamaz", () => {
    s.switchUser("u-izleyici");
    expect(() => addSupplier(s, { name: "A", spend_currency: "TRY", spend_amount: "1", intensity_class: "high", intensity_reason: "t", product_groups: [], cbam_relevant: null, contact_note: "" })).toThrowError(StoreError);
  });
});
