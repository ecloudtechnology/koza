import { beforeEach, describe, expect, it } from "vitest";
import { resetAll, Store } from "@/lib/store";
import "./register";
import { addCarbonCost, addMonitoringPlanVersion, buildCarbonCostPack, createChangeCard, decideChangeCard, decidePackage, effectiveRules, evaluateApplicability, isPackageOpen, monitoringPlans, packageState, packages, recordAssessment, recordSourceVersion, requirePackage } from "./regulation";
import { addSupplier } from "./supplier";

function fresh(): Store {
  resetAll();
  const s = new Store();
  s.switchUser("u-yonetici");
  s.createTenant({ name: "Test AŞ", country: "TR", nace_code: "C24", profile_id: "agir-sanayi", profile_version: "0.1.0" });
  return s;
}
const CBAM_YES = { exports_to_eu: "yes", product_groups: "yes", reporting_window: "yes" };

/** Uzman akışı: kaynak sürümü → değişiklik kartı → onay → kurallar bu kurum için doğrulanır. */
async function verifyRules(s: Store, package_id: string, rule_ids: string[], publication_status: "in_force" | "draft" | "unknown" = "in_force") {
  s.switchUser("u-uzman");
  const v = await recordSourceVersion(s, { package_id, source_ref: "K16", kind: "text", title: "Resmî metin", content: "Madde 1 — kapsam ve eşik metni (test)", publication_date: "2026-01-01", effective_date: "2026-06-01", publication_status });
  const card = createChangeCard(s, { package_id, old_version_id: null, new_version_id: v.id, changed_clause: "Madde 1", summary: "Kapsam listesi doğrulandı", nature: "kesin", affected: { profiles: ["agir-sanayi"], forms: [], calcs: [], lessons: [] }, rule_ids, rule_values: Object.fromEntries(rule_ids.map((r) => [r, { threshold: null, effective_from: "2026-06-01" }])) });
  return { version: v, card };
}

describe("regülasyon paketleri (REG-01…06, §08, §19)", () => {
  let s: Store;
  beforeEach(() => {
    s = fresh();
  });

  it("paketler içerikten yüklenir; eşikler null ve doğrulanmamış", () => {
    expect(packages().map((p) => p.id).sort()).toEqual(["cbam", "eu-customer-supply-chain", "national-ets-mrv", "tsrs"]);
    const ets = requirePackage("national-ets-mrv");
    const th = ets.rules.find((r) => r.id === "ets-capacity-threshold")!;
    expect(th.threshold).toBeNull();
    expect(th.source_status).toBe("unverified");
  });

  it("kural 6: doğrulanmamış kural → her zaman review_required; paket açılamaz (RULE_UNVERIFIED)", () => {
    const a = recordAssessment(s, "cbam", CBAM_YES);
    expect(a.result).toBe("review_required");
    expect(a.rule_versions_used.every((r) => r.source_status === "unverified")).toBe(true);
    s.switchUser("u-onay");
    expect(() => decidePackage(s, a.id, "open", "açmak istiyorum")).toThrowError(expect.objectContaining({ code: "RULE_UNVERIFIED" }));
    expect(isPackageOpen(s, "cbam")).toBe(false);
    expect(s.tasks().length).toBe(0);
  });

  it("'bilmiyorum' → review_required; dışlayan cevap → not_applicable", () => {
    const pkg = requirePackage("cbam");
    const rules = effectiveRules(s, "cbam");
    expect(evaluateApplicability(pkg, rules, { exports_to_eu: "unknown" }).result).toBe("review_required");
    expect(evaluateApplicability(pkg, rules, { exports_to_eu: "no", product_groups: "yes", reporting_window: "yes" }).result).toBe("not_applicable");
  });

  it("kapalı paket görev üretmez", () => {
    const a = recordAssessment(s, "cbam", { exports_to_eu: "no", product_groups: "no", reporting_window: "no" });
    expect(a.result).toBe("not_applicable");
    s.switchUser("u-onay");
    const st = decidePackage(s, a.id, "closed", "AB'ye ihracat yok");
    expect(st.state).toBe("closed");
    expect(st.task_ids).toEqual([]);
    expect(s.tasks().length).toBe(0);
    s.switchUser("u-yonetici");
    expect(() => addSupplier(s, { name: "A", spend_currency: "TRY", spend_amount: "1", intensity_class: "high", intensity_reason: "t", product_groups: [], cbam_relevant: true, contact_note: "" })).toThrowError(expect.objectContaining({ code: "PACKAGE_NOT_OPEN" }));
  });

  it("SRC-03…07: kaynak sürümü + değişiklik kartı + uzman onayı → kural doğrulanır → paket açılır → yükümlülük görevleri", async () => {
    const { version, card } = await verifyRules(s, "cbam", ["cbam-product-list", "cbam-phase-dates"]);
    expect(version.content_sha256).toMatch(/^[0-9a-f]{64}$/);
    expect(version.excerpt.length).toBeLessThanOrEqual(200);
    // yalnız uzman onaylar
    s.switchUser("u-onay");
    expect(() => decideChangeCard(s, card.id, "approved", "kontrol ettim")).toThrow(/yetki/i);
    s.switchUser("u-uzman");
    decideChangeCard(s, card.id, "approved", "resmî metinle karşılaştırdım");
    const rules = effectiveRules(s, "cbam");
    expect(rules.find((r) => r.id === "cbam-product-list")!.source_status).toBe("verified");
    expect(rules.find((r) => r.id === "cbam-method")!.source_status).toBe("unverified"); // kartta yoktu
    // içerik dosyası değişmedi (kurum bazlı etkinleştirme)
    expect(requirePackage("cbam").rules.find((r) => r.id === "cbam-product-list")!.source_status).toBe("unverified");
    s.switchUser("u-yonetici");
    const a = recordAssessment(s, "cbam", CBAM_YES);
    expect(a.result).toBe("applicable");
    s.switchUser("u-onay");
    const st = decidePackage(s, a.id, "open", "değerlendirme uygun, uzman kuralları onayladı");
    expect(st.state).toBe("open");
    expect(st.task_ids.length).toBe(requirePackage("cbam").obligations.length);
    expect(s.tasks().filter((t) => t.requirement_ids.includes("REG-01")).length).toBe(st.task_ids.length);
    expect(isPackageOpen(s, "cbam")).toBe(true);
    expect(packageState(s, "cbam")!.assessment_id).toBe(a.id);
    // şimdi CBAM ilgisi işaretlenebilir
    s.switchUser("u-yonetici");
    expect(addSupplier(s, { name: "A", spend_currency: "TRY", spend_amount: "1", intensity_class: "high", intensity_reason: "t", product_groups: [], cbam_relevant: true, contact_note: "" }).cbam_relevant).toBe(true);
  });

  it("taslak/istişare veya yayın durumu bilinmeyen kaynak kuralı etkinleştiremez (§19)", async () => {
    const d = await verifyRules(s, "tsrs", ["tsrs-scope-thresholds"], "draft");
    expect(() => decideChangeCard(s, d.card.id, "approved", "onaylıyorum")).toThrowError(expect.objectContaining({ code: "RULE_UNVERIFIED" }));
    const u = await verifyRules(s, "tsrs", ["tsrs-scope-thresholds"], "unknown");
    expect(() => decideChangeCard(s, u.card.id, "approved", "onaylıyorum")).toThrowError(expect.objectContaining({ code: "RULE_UNVERIFIED" }));
    expect(effectiveRules(s, "tsrs").find((r) => r.id === "tsrs-scope-thresholds")!.source_status).toBe("unverified");
  });

  it("REG-02/REG-04: izleme planı ve kanıt paketi yalnız ulusal ETS paketi açıkken; plan sürümleri değişmez", async () => {
    s.switchUser("u-yonetici");
    const f = s.addFacility({ name: "Tesis", city: "Gebze", profile_id: null });
    expect(() => addMonitoringPlanVersion(s, f.id, [{ source_name: "Kazan", scope1_category: "sabit yakma", tier: "kademe 2", method: "fatura + ısıl değer", note: "" }], "")).toThrowError(expect.objectContaining({ code: "PACKAGE_NOT_OPEN" }));
    expect(() => buildCarbonCostPack(s)).toThrowError(expect.objectContaining({ code: "PACKAGE_NOT_OPEN" }));
    const { card } = await verifyRules(s, "national-ets-mrv", ["ets-activity-list", "ets-capacity-threshold"]);
    decideChangeCard(s, card.id, "approved", "ikincil mevzuat metniyle karşılaştırdım");
    s.switchUser("u-yonetici");
    const a = recordAssessment(s, "national-ets-mrv", { facility_activity: "yes", capacity_threshold: "yes", permit_status: "no" });
    expect(a.result).toBe("applicable");
    s.switchUser("u-uzman");
    decidePackage(s, a.id, "open", "tesis kapsamda");
    s.switchUser("u-yonetici");
    const p1 = addMonitoringPlanVersion(s, f.id, [{ source_name: "Kazan", scope1_category: "sabit yakma", tier: "kademe 2", method: "fatura + ısıl değer", note: "" }], "ilk plan");
    const p2 = addMonitoringPlanVersion(s, f.id, [{ source_name: "Kazan", scope1_category: "sabit yakma", tier: "kademe 3", method: "sayaç", note: "" }], "sayaç takıldı");
    expect(p2.plan_version).toBe(2);
    expect(p2.supersedes).toBe(p1.id);
    expect(monitoringPlans(s, f.id)[0].entries[0].tier).toBe("kademe 2"); // eski sürüm korunur
    expect(p1.mrv_rule_status).toBe("unverified"); // kılavuz kuralı kartta yoktu → görünür
    s.switchUser("u-onay");
    addCarbonCost(s, { period_label: "2026", amount: "12.500,00", currency: "TRY", paid_at: "2026-09-01", evidence_name: "dekont.pdf", evidence_sha256: "a".repeat(64), note: "" });
    const pack = buildCarbonCostPack(s);
    expect(pack.carbon_costs[0].amount).toBe("12500");
    expect(pack.mrv_plans[0].plan_version).toBe(2);
    expect(pack.disclaimers_tr.some((d) => d.includes("K-07"))).toBe(true);
  });
});
