import { beforeEach, describe, expect, it } from "vitest";
import "./register";
import { resetAll, Store, StoreError } from "@/lib/store";
import { agendaRelevant, agendaToTask, applicabilityOf, calendarEntries, completeLesson, completionOf, decideApplicability, helpNoDocument, lessonPath, lessons, myProgress, setAgendaPref, sources, tenantProfile, terms, trainingByUnit, whyShown } from "./store";
import { fold, scoreTerm, searchTerms, tokenMatches } from "./search";
import type { AgendaItem } from "./types";

function fresh(): Store {
  resetAll();
  return new Store();
}
function setup(s: Store) {
  s.switchUser("u-yonetici");
  s.createTenant({ name: "Test AŞ", country: "TR", nace_code: "C24", profile_id: "agir-sanayi", profile_version: "0.1.0" });
  s.confirmProfile("agir-sanayi", "0.1.0");
  const f = s.addFacility({ name: "Gebze", city: "Gebze", profile_id: null });
  const f2 = s.addFacility({ name: "Bursa", city: "Bursa", profile_id: null });
  return { f, f2 };
}
const ANS = [0, 0, 0];

describe("içerik (§07, §08, §09, §10)", () => {
  it("10 ders, şablon alanları ve 3'er soru; her soruda her seçenek için açıklama", () => {
    const ls = lessons();
    expect(ls).toHaveLength(10);
    for (const l of ls) {
      expect(l.explanation.length).toBeGreaterThanOrEqual(3);
      expect(l.quiz).toHaveLength(3);
      for (const q of l.quiz) {
        expect(q.options).toHaveLength(3);
        expect(q.explanations).toHaveLength(3);
        expect(q.correct).toBeGreaterThanOrEqual(0);
      }
      expect(l.related_task.route).toMatch(/^\//);
      expect(l.sources.length).toBeGreaterThan(0);
      expect(l.sources.every((k) => sources().some((s) => s.code === k))).toBe(true);
    }
  });
  it("en az 30 terim; hepsi editör onayı bekliyor ve kaynaklı", () => {
    const ts = terms();
    expect(ts.length).toBeGreaterThanOrEqual(30);
    for (const t of ts) {
      expect(t.status).toContain("editör onayı");
      expect(t.source.length).toBeGreaterThan(0);
      expect(t.definition.length).toBeGreaterThan(30);
    }
  });
  it("kaynak kartları: aile, son kontrol, resmî URL; GRI 102/103 2025 geçiş koşulu 1 Ocak 2027", () => {
    const ss = sources();
    expect(ss).toHaveLength(16);
    for (const s of ss) {
      expect(["GRI", "TSRS", "GHG Protocol", "ISO", "mevzuat", "rehber"]).toContain(s.family);
      expect(String(s.checked_at)).toMatch(/^\d{4}-\d{2}-\d{2}/);
      expect(s.urls.every((u) => u.startsWith("https://"))).toBe(true);
    }
    const k14 = ss.find((s) => s.code === "K14")!;
    expect(String(k14.effective_from)).toMatch(/^2027-01-01/);
    expect(k14.identity_note).toMatch(/General Disclosures/);
    expect(k14.versions.filter((v) => v.current)).toHaveLength(1);
    expect(k14.versions.length).toBeGreaterThan(1);
  });
});

describe("ilerleme (§07, ÖĞR-04, kural 11)", () => {
  let s: Store;
  beforeEach(() => {
    s = fresh();
  });
  it("kullanıcı bazında saklanır; başka kullanıcı görmez", () => {
    setup(s);
    s.switchUser("u-veri");
    completeLesson(s, "101-01", { unit_id: null, answers: ANS });
    expect(completionOf(s, "101-01").done).toBe(true);
    s.switchUser("u-uzman");
    expect(completionOf(s, "101-01").done).toBe(false);
    expect(myProgress(s)).toHaveLength(0);
  });
  it("sorular cevaplanmadan tamamlanamaz; aynı sürüm için tekrar çağrı yeni kayıt açmaz", () => {
    setup(s);
    s.switchUser("u-veri");
    expect(() => completeLesson(s, "101-02", { unit_id: null, answers: [0, null, 0] })).toThrowError(StoreError);
    const a = completeLesson(s, "101-02", { unit_id: null, answers: ANS });
    const b = completeLesson(s, "101-02", { unit_id: null, answers: [1, 1, 1] });
    expect(b.id).toBe(a.id);
    expect(myProgress(s)).toHaveLength(1);
  });
  it("bilinmeyen ders reddedilir", () => {
    setup(s);
    expect(() => completeLesson(s, "101-99", { unit_id: null, answers: ANS })).toThrow(/bulunamadı/);
  });
  it("eğitim saati yalnız birim düzeyinde toplanır; kullanıcı kimliği çıktıda yok", () => {
    const { f } = setup(s);
    s.switchUser("u-veri");
    completeLesson(s, "101-01", { unit_id: f.id, answers: ANS });
    s.switchUser("u-uzman");
    completeLesson(s, "101-01", { unit_id: f.id, answers: ANS });
    completeLesson(s, "101-03", { unit_id: null, answers: ANS });
    const agg = trainingByUnit(s);
    const gebze = agg.find((a) => a.unit_id === f.id)!;
    expect(gebze.completions).toBe(2);
    expect(gebze.minutes).toBe(7 * 2);
    expect(agg.find((a) => a.unit_id === null)!.unit_label).toBe("Kurum geneli");
    expect(JSON.stringify(agg)).not.toMatch(/u-veri|u-uzman/);
  });
  it("ders yolu profilden gelir (ÖĞR-01…03)", () => {
    setup(s);
    const p = tenantProfile(s.tenant);
    expect(lessonPath(p, "manager").lessons.map((l) => l.id)).toEqual(["101-01", "101-07", "101-09"]);
    expect(lessonPath(p, "field").missing).toHaveLength(0);
  });
  it("kurumlar arası izolasyon: başka kurumun ilerlemesi görünmez", () => {
    setup(s);
    s.switchUser("u-veri");
    completeLesson(s, "101-01", { unit_id: null, answers: ANS });
    s.switchUser("u-yonetici");
    s.createTenant({ name: "Diğer AŞ", country: "TR", nace_code: null, profile_id: "genel", profile_version: "0.1.0" });
    s.switchUser("u-veri");
    expect(myProgress(s)).toHaveLength(0);
    expect(trainingByUnit(s)).toHaveLength(0);
  });
});

describe("uygulanabilirlik (§08, REG-01, REG-06)", () => {
  let s: Store;
  beforeEach(() => {
    s = fresh();
  });
  it("gerekçesiz karar reddedilir; karar kural sürümüne (checked_at) bağlanır", () => {
    setup(s);
    s.switchUser("u-uzman");
    expect(() => decideApplicability(s, { source_code: "K03", result: "applies", reason: "kısa" })).toThrow(/gerekçe/i);
    const row = decideApplicability(s, { source_code: "K03", result: "applies", reason: "Kurumsal envanter kuruluyor; Kapsam 1 kaynakları var." });
    expect(row.rule_version).toBe(String(sources().find((x) => x.code === "K03")!.checked_at));
    expect(row.inputs.profile_id).toBe("agir-sanayi");
    expect(applicabilityOf(s, "K03").effective).toBe("applies");
  });
  it("yetkisiz rol karar veremez; bilinmeyen kaynak reddedilir", () => {
    setup(s);
    s.switchUser("u-veri");
    expect(() => decideApplicability(s, { source_code: "K03", result: "applies", reason: "yeterince uzun bir gerekçe" })).toThrow(/yetki/i);
    s.switchUser("u-uzman");
    expect(() => decideApplicability(s, { source_code: "K99", result: "applies", reason: "yeterince uzun bir gerekçe" })).toThrow(/Kaynak kartı yok/);
  });
  it("TSRS karar yokken 'inceleme gerekli' ve K-08 notu; karar geçmişi korunur", () => {
    setup(s);
    const a = applicabilityOf(s, "K02");
    expect(a.effective).toBe("review_required");
    expect(a.note).toMatch(/K-08/);
    s.switchUser("u-uzman");
    decideApplicability(s, { source_code: "K02", result: "review_required", reason: "KGK kapsam eşikleri doğrulanmadı." });
    decideApplicability(s, { source_code: "K02", result: "not_applicable", reason: "Kurum halka açık değil, eşiklerin altında (finans onayı)." });
    const b = applicabilityOf(s, "K02");
    expect(b.effective).toBe("not_applicable");
    expect(b.history).toHaveLength(2);
  });
  it("'bu bana neden gösteriliyor' profilden türer", () => {
    setup(s);
    const p = tenantProfile(s.tenant);
    const k16 = sources().find((x) => x.code === "K16")!; // kategori 3 — ağır sanayi önceliğinde
    expect(whyShown(k16, s.tenant, p).length).toBeGreaterThan(0);
    const k10 = sources().find((x) => x.code === "K10")!; // kategori 15 — öncelikte değil
    expect(whyShown(k10, s.tenant, p)).toHaveLength(0);
  });
});

describe("gündem ve takvim (§09)", () => {
  let s: Store;
  beforeEach(() => {
    s = fresh();
  });
  const draft: AgendaItem = {
    id: "x-draft", type: "mevzuat_degisikligi", status: "taslak", title: "Taslak düzenleme", summary: ["a", "b", "c"], publisher: "test", source_url: "https://example.invalid", source_codes: [],
    published_at: null, event_or_effective_at: "2030-01-01", countries: ["TR"], sectors: [], relevance: { profile_ids: ["*"], packages: [] }, suggested_action: "bekle", affected_route: null, last_checked: null, editor_status: "test",
  };
  it("taslak madde görev üretmez; yürürlükteki madde üretir ve mükerrer açmaz", () => {
    setup(s);
    expect(() => agendaToTask(s, draft)).toThrow(/görev üretemez/);
    expect(s.tasks()).toHaveLength(0);
    expect(() => agendaToTask(s, { ...draft, status: "istisare" })).toThrowError(StoreError);
    const t1 = agendaToTask(s, "gri-102-climate-change-2025");
    const t2 = agendaToTask(s, "gri-102-climate-change-2025");
    expect(t2.id).toBe(t1.id);
    expect(s.tasks()).toHaveLength(1);
  });
  it("geçmiş son tarih yaklaşan listesine girmez; kurum içi ve yasal tarih ayrı etiketlenir", () => {
    setup(s);
    s.addPeriod({ start: "2025-01-01", end: "2025-12-31" });
    s.addPeriod({ start: "2026-01-01", end: "2026-12-31" });
    const { upcoming, past } = calendarEntries(s, "2026-06-01");
    expect(upcoming.some((e) => e.date === "2025-12-31")).toBe(false);
    expect(past.some((e) => e.date === "2025-12-31" && e.kind === "internal")).toBe(true);
    expect(upcoming.find((e) => e.date === "2026-12-31")!.kind).toBe("internal");
    expect(upcoming.find((e) => e.id === "ag-gri-102-climate-change-2025")!.kind).toBe("legal");
    const later = calendarEntries(s, "2027-02-01");
    expect(later.upcoming.some((e) => e.id === "ag-gri-102-climate-change-2025")).toBe(false);
  });
  it("sessize alınan madde takvimden düşer; takip kullanıcı bazlıdır", () => {
    setup(s);
    s.switchUser("u-veri");
    setAgendaPref(s, "gri-102-climate-change-2025", { muted: true });
    expect(calendarEntries(s, "2026-06-01").upcoming.some((e) => e.id === "ag-gri-102-climate-change-2025")).toBe(false);
    s.switchUser("u-uzman");
    expect(calendarEntries(s, "2026-06-01").upcoming.some((e) => e.id === "ag-gri-102-climate-change-2025")).toBe(true);
    expect(() => setAgendaPref(s, "yok", { follow: true })).toThrow(/yok/);
  });
  it("ilgi kuralı: TSRS maddesi paket/ülke ile eşleşir", () => {
    setup(s);
    const p = tenantProfile(s.tenant);
    const tsrs = { ...draft, relevance: { profile_ids: [], packages: ["tsrs"] }, countries: ["TR"] };
    expect(agendaRelevant(tsrs, s.tenant, p).relevant).toBe(false); // ağır sanayi profilinde tsrs paketi yok
    expect(agendaRelevant({ ...tsrs, relevance: { profile_ids: ["agir-sanayi"], packages: [] } }, s.tenant, p).relevant).toBe(true);
  });
});

describe("sözlük araması ve yardım yolları (§10)", () => {
  it("Türkçe karakter katlama", () => {
    expect(fold("Küresel ISINMA Potansiyeli CO₂e")).toBe("kuresel isinma potansiyeli co2e");
  });
  it("yazım hatası toleransı ve kısaltma", () => {
    expect(tokenMatches("kapsm", "kapsam")).toBe(true);
    expect(tokenMatches("emisyn", "emisyon")).toBe(true);
    expect(tokenMatches("su", "sunum")).toBe(true);
    const ts = terms();
    expect(searchTerms(ts, "kapsam2", null)[0].term.id).toBe("kapsam-2");
    expect(searchTerms(ts, "co2 esdegeri", null)[0].term.id).toBe("co2e");
    expect(searchTerms(ts, "GWP", null)[0].term.id).toBe("gwp");
    expect(searchTerms(ts, "scope", null).some((r) => r.term.id === "kapsam")).toBe(true);
    expect(searchTerms(ts, "mense garantsi", null)[0].term.id).toBe("mense-garantisi");
    expect(scoreTerm(ts.find((t) => t.id === "gwp")!, "zzzz-yok")).toBe(0);
  });
  it("bağlam filtresi ve alan yardımı", () => {
    const ts = terms();
    expect(searchTerms(ts, "", "alan-yardimi").every((r) => r.term.kind === "alan-yardimi")).toBe(true);
    expect(searchTerms(ts, "ne yazacağım", "alan-yardimi").length).toBeGreaterThan(0);
    expect(searchTerms(ts, "", "urun").every((r) => r.term.contexts?.includes("urun"))).toBe(true);
  });
  it("'belge elimde yok' görev açar; mükerrer açmaz", () => {
    const s = fresh();
    setup(s);
    s.switchUser("u-veri");
    const t = helpNoDocument(s, "alan-kanit-dosyasi");
    expect(t.kind).toBe("missing_info");
    expect(helpNoDocument(s, "alan-kanit-dosyasi").id).toBe(t.id);
    expect(() => helpNoDocument(s, "yok-terim")).toThrow(/Terim yok/);
  });
});
