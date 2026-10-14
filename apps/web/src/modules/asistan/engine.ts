// Kaynaklı yanıt motoru (§24 AI-01…06). Deterministik: anahtar sözcük kuralları + şablonlar; dil modeli yok.
// Sayı yalnız Store'daki kayıtlı hesap koşusundan okunur (AI-05, kural 1); asistan hesap yapmaz, tahmin etmez.
// Kurum verisi yalnız aktif kurumdan, Store'un süzülü okuyucularıyla gelir (kural 3).
import { SCOPE_OF_SOURCE, SOURCE_TYPE_LABEL, STATE_LABEL, type ActivityRecord, type Task } from "@/lib/domain";
import { ERROR_BY_CODE } from "@/lib/errors";
import { TERMS, profileById } from "@/lib/content";
import { Store, StoreError } from "@/lib/store";
import { findInjections, scanDocument, type DocScan } from "./document";
import { citeId, cite, search, type Citation } from "./knowledge";
import { fold } from "./text";

export type Intent =
  | "definition"
  | "why_scope"
  | "field_help"
  | "status"
  | "legal"
  | "numeric"
  | "factor"
  | "conflict"
  | "next_step"
  | "error_code"
  | "other_tenant"
  | "document"
  | "lookup"
  | "empty"
  | "unknown";

export interface QuickReply {
  label: string;
  question: string; // seçilince gönderilecek tam soru
}

export type TaskDraft = Omit<Task, "id" | "tenant_id" | "status" | "created_at">;

export interface Answer {
  intent: Intent;
  kind: "answer" | "clarify" | "no_source";
  summary: string; // kısa açıklama (2–3 cümle)
  basis: Citation[]; // dayanak: kaynak kimliği + bölüm/sürüm
  condition: string; // kurum için koşul
  uncertainty: string; // belirsizlik
  action: { text: string; href: string | null }; // önerilen eylem
  clarify: { question: string; options: QuickReply[] } | null; // AI-04: tek soru + hızlı yanıtlar
  taskDraft: TaskDraft | null; // araç önerisi; yalnız açık tıklama ile store.createTask
  number: { value: string; unit: string; run_id: string; record_id: string } | null; // yalnız kayıtlı koşudan
  details: string[]; // "ayrıntı" açılırları
  notices: string[]; // ör. talimat benzeri ifade uyarısı (T15)
  document: DocScan | null;
}

export const NO_SOURCE = "Bu bilgi için doğrulanmış kaynak bulamadım.";
export const CANNOT = ["onaylamak", "silmek", "dönemi kilitlemek", "rapor yayımlamak", "dışarıya mesaj göndermek", "faktör etkinleştirmek", "sayı tahmin etmek", "uygunluk hükmü vermek"];
export const SUPPORT_HREF = "/gorevler/";

const T16 = "Bu yanıt bir uygunluk hükmü değildir (T16); yükümlülük kararı kaynak metni ve alan uzmanı görüşüyle verilir.";

// ---------- Niyet kuralları (katlanmış metin üzerinde) ----------
const R = {
  other_tenant: [/\b(baska|diger|oteki|rakip|komsu)\b.*\b(kurum|sirket|firma|musteri|tenant)/, /\b(kurum|sirket|firma|musteri)(lar)?(in|un|nin|nun|larin)?\b.*\b(baska|diger|oteki)/, /\bmusteri(ler|nin|lerin)?\b.*\b(veri|kayit|emisyon)/],
  next_step: [/ne yapmaliyim/, /ne yapayim/, /sonraki adim/, /siradaki adim/, /nereden basla/, /simdi ne/, /ilk adim/, /nasil baslarim/],
  legal: [/zorunlu mu/, /\bceza/, /uymak zorunda/, /yukumlu/, /yaptirim/, /\byasal/, /mevzuat/, /\bkanun/, /yonetmelik/, /\bteblig/, /mecbur/, /uygun mu/, /uyumlu mu/, /\bcbam\b/, /\btsrs\b/, /\bets\b/, /taslak/, /raporlamak zorunda/],
  conflict: [/celis/, /farkli (mi )?soyl/, /hangisi gecerli/, /hangisi dogru/, /hangisine uy/, /(ghg|gri|iso|tsrs).*(ghg|gri|iso|tsrs)/],
  factor: [/faktor(u|un|unu|une)?\s*(ne|kac|degeri|nedir)/, /(sogutucu|refrigerant|\br-?\d{2,3}[a-z]?\b|freon|hfc)/, /katsayi/],
  numeric: [/kac (ton|kg|tco2|co2)/, /ne kadar (emisyon|co2|salim)/, /toplam (emisyon|co2|salim|sonuc)/, /sonuc(u|um)? ne/, /co2e? kac/, /hesap sonucu/, /emisyon(um|umuz)? ne/, /kac (ton|kg)/, /sonucu nedir/],
  status: [/ne durumda/, /durumu ne/, /hangi asamada/, /onayland[iı] m[iı]/, /incelemede mi/, /durum nedir/, /nerede kaldi/],
  definition: [/ne demek/, /nedir\b/, /ne anlama gel/, /neyi ifade ed/, /ne demektir/, /anlami ne/, /tanimi ne/, /\bne\s*\?$/, /aciklar misin/],
  why_scope: [/neden bu kapsam/, /neden kapsam/, /hangi kapsam/, /kapsam (1|2|3) mi/, /kapsam[iı] ne/, /kapsama gir/],
  field_help: [/bu kutuya/, /bu alana/, /ne yazacagim/, /ne yazayim/, /nereye yaz/, /hangi alana/, /nasil gir/, /hangi birim/, /nereden bul/, /alan[iı]na ne/],
};

const FIELD_WORDS: { key: string; words: string[] }[] = [
  { key: "birim", words: ["birim", "sm3", "nm3", "m3", "kwh", "mwh", "gj"] },
  { key: "miktar", words: ["miktar", "tuketim", "sayac"] },
  { key: "donem", words: ["donem", "tarih", "baslangic", "bitis"] },
  { key: "fatura_no", words: ["fatura no", "fatura numar", "seri no"] },
  { key: "tedarikci", words: ["tedarikci", "saglayici", "firma", "dagitim sirketi"] },
  { key: "isil", words: ["isil deger", "lhv", "hhv", "alt isil", "ust isil", "kalori", "esas"] },
  { key: "kanit", words: ["kanit", "belge yukle", "dosya", "pdf"] },
  { key: "veri_niteligi", words: ["tahmini", "olculmus", "veri niteligi", "kalite"] },
];

const FIELD_LABEL: Record<string, string> = { birim: "Birim", miktar: "Miktar", donem: "Dönem tarihleri", fatura_no: "Fatura no", tedarikci: "Tedarikçi", isil: "Isıl değer esası", kanit: "Kanıt belgesi", veri_niteligi: "Veri niteliği" };

const UNIT_WORDS: { unit: string; words: string[] }[] = [
  { unit: "Sm3", words: ["sm3", "standart metrekup", "standart m3"] },
  { unit: "Nm3", words: ["nm3", "normal metrekup", "normal m3"] },
  { unit: "kWh", words: ["kwh", "kilovatsaat", "kilowatt"] },
  { unit: "MWh", words: ["mwh"] },
  { unit: "GJ", words: ["gj", "gigajoule", "gigajul"] },
  { unit: "m3", words: ["m3", "metrekup"] },
];

export function detectIntent(question: string): Intent {
  const f = fold(question).trim();
  if (!f) return "empty";
  const m = (k: keyof typeof R) => R[k].some((re) => re.test(f));
  if (m("other_tenant")) return "other_tenant";
  if (/\b[A-Z][A-Z_]{4,}\b/.test(question) && question.match(/\b[A-Z][A-Z_]{4,}\b/g)!.some((c) => ERROR_BY_CODE[c])) return "error_code";
  if (m("next_step")) return "next_step";
  if (m("conflict")) return "conflict";
  if (m("legal")) return "legal";
  if (m("factor")) return "factor";
  if (m("numeric")) return "numeric";
  if (m("status")) return "status";
  if (m("why_scope")) return "why_scope";
  if (m("field_help")) return "field_help";
  if (m("definition")) return "definition";
  return "lookup";
}

// ---------- Yardımcılar ----------
function base(intent: Intent, partial: Partial<Answer>): Answer {
  return {
    intent,
    kind: "answer",
    summary: "",
    basis: [],
    condition: "Aktif kurum bağlamı dışında veri kullanılmadı.",
    uncertainty: "—",
    action: { text: "—", href: null },
    clarify: null,
    taskDraft: null,
    number: null,
    details: [],
    notices: [],
    document: null,
    ...partial,
  };
}

function cites(ids: string[], q?: string): Citation[] {
  return ids.map((id) => citeId(id, q)).filter((c): c is Citation => c !== null);
}

function noSource(intent: Intent, question: string, extra: Partial<Answer> = {}): Answer {
  return base(intent, {
    kind: "no_source",
    summary: `${NO_SOURCE} Soru yetkili kaynak dizini (şartname, sözlük, kaynak kartları, hata sözlüğü) ve kurum verisiyle eşleşmedi; tahmin üretilmez.`,
    uncertainty: "Kaynak yoksa yanıt yoktur; serbest metin yazılmaz (AI-06).",
    action: { text: "Destek talebi görevi aç (soru ve bağlam eklenir)", href: SUPPORT_HREF },
    taskDraft: { title: `Destek talebi: ${question.slice(0, 80)}`, detail: `Asistan doğrulanmış kaynak bulamadı. Soru: "${question}". Kaynak ekibi içerik ekleyince sözlük/ders güncellenir (§10 yardım yolları).`, kind: "content", related_record_id: null, requirement_ids: ["§10", "AI-06"] },
    ...extra,
  });
}

function tenantCondition(s: Store): string {
  const t = s.tenant!;
  const prof = profileById(t.profile_id);
  return `Kurum: ${t.name}; profil ${prof?.title.tr ?? t.profile_id} v${t.profile_version}${t.profile_confirmed ? " (onaylı)" : " (onay bekliyor)"}; rolünüz ${s.role}.`;
}

function recordLabel(s: Store, r: ActivityRecord): string {
  const v = s.current(r.id);
  const src = s.sources().find((x) => x.id === v.source_id);
  return `${r.id.slice(0, 12)} · ${src?.name ?? "kaynak"} · ${v.period_start}–${v.period_end} · ${STATE_LABEL[r.state]}`;
}

type Resolved = { record: ActivityRecord } | { clarify: Answer } | { none: Answer } | { notfound: Answer };

/** "Bu kayıt" bağlamını çözer: kimlik varsa onu, tek kayıt varsa onu, birden çoksa tek soru (AI-04). */
function resolveRecord(s: Store, question: string, intent: Intent): Resolved {
  const idm = question.match(/\b(act-[a-z0-9]+)\b/i);
  if (idm) {
    try {
      return { record: s.record(idm[1].toLowerCase()) };
    } catch (e) {
      if (e instanceof StoreError && e.code === "NOT_FOUND") {
        return {
          notfound: base(intent, {
            kind: "no_source",
            summary: `${idm[1]} kimliği aktif kurumda bulunamadı. Başka bir kuruma ait olabilir ya da hiç var olmayabilir; ikisi de aynı yanıtı alır (§27).`,
            basis: cites(["§27", "§29"], "başka kuruma ait kayıt kimliği reddedilir"),
            condition: tenantCondition(s),
            uncertainty: "Kimliğin varlığı hakkında bilgi verilmez; yalnız aktif kurum verisi okunur (kural 3).",
            action: { text: "Kendi kayıtlarınızı envanterde görün", href: "/envanter/" },
          }),
        };
      }
      throw e;
    }
  }
  const recs = s.records();
  if (recs.length === 0) {
    return {
      none: base(intent, {
        summary: "Bu kurumda henüz kayıt yok. Durum veya sonuç sorusu bir kayda bağlıdır; ilk kayıt veri girişi ekranından açılır.",
        basis: cites(["§11", "§21"], "veri girişi kayıt durumları"),
        condition: tenantCondition(s),
        uncertainty: "Kayıt olmadan durum ve sayı yoktur; asistan boş veriye sıfır atamaz (kural 2).",
        action: { text: "İlk kaydı gir", href: "/veri-girisi/" },
      }),
    };
  }
  if (recs.length === 1) return { record: recs[0] };
  const opts = recs.slice(0, 6).map((r) => ({ label: recordLabel(s, r), question: `${question.replace(/\s+$/, "")} ${r.id}` }));
  return {
    clarify: base(intent, {
      kind: "clarify",
      summary: `Bu kurumda ${recs.length} kayıt var; hangisini sorduğunuz belli değil.`,
      basis: cites(["§24"], "Eksik koşul varsa soru sorulur"),
      condition: tenantCondition(s),
      uncertainty: "Kayıt seçilmeden durum veya sayı verilmez (ASSISTANT_CONTEXT_REQUIRED).",
      action: { text: "Bir kayıt seçin", href: null },
      clarify: { question: "Hangi kaydı soruyorsunuz?", options: opts },
    }),
  };
}

/** Ana sayfadaki "sonraki adım" mantığının aynısı: depo durumundan türetilir (§05). */
export function nextStep(s: Store): { title: string; href: string; why: string } {
  const tenant = s.tenant;
  if (!tenant) return { title: "Kurum kurulumunu başlat", href: "/kurulum/", why: "Henüz kurum yok. Kurum adı, sektör (NACE) ve kaynak envanteriyle başlanır (ONB-01…03)." };
  if (!tenant.profile_confirmed || s.sources().length === 0 || s.periods().length === 0)
    return { title: "Kurulumu tamamla", href: "/kurulum/", why: "Profil onayı, tesis, raporlama dönemi veya kaynak envanteri eksik. Kurulum kaldığı adımdan devam eder (§06)." };
  const recs = s.records();
  const by = (st: string) => recs.filter((r) => r.state === st);
  if (recs.length === 0) return { title: "İlk doğal gaz kaydını gir", href: "/veri-girisi/", why: "Kaynak envanteri hazır. İlk görev: bir eğitim kaydı veya gerçek fatura (§06)." };
  if (by("validation_required").length) return { title: "Eksik bilgiyi tamamla", href: "/gorevler/", why: `${by("validation_required").length} kayıt doğrulama bekliyor; görevlerde hangi alanın eksik olduğu yazılı (T20).` };
  if (by("draft").length) return { title: "Taslağı hesapla", href: `/kayit/?id=${by("draft")[0].id}`, why: "Taslak kayıt var; hesap önizlemesi motorla çalıştırılır (DAT-05)." };
  if (by("changes_requested").length) return { title: "Düzeltme istenen kaydı güncelle", href: `/kayit/?id=${by("changes_requested")[0].id}`, why: "İnceleyen gerekçe yazdı; kayıt yeni sürümle düzeltilir." };
  if (by("calculated").length) return { title: "Kontrole gönder", href: `/kayit/?id=${by("calculated")[0].id}`, why: "Hesaplandı, onaylandı demek değildir (§21). İnceleme için gönderin." };
  if (by("in_review").length) return { title: "İnceleme kuyruğuna git", href: "/inceleme/", why: `${by("in_review").length} kayıt incelemede. Veri giren ile onaylayan farklı olmalı; üst çubuktan rolü değiştirin.` };
  if (by("approved").length && s.periods().some((p) => p.status === "open")) return { title: "Dönemi kapat", href: "/donem/", why: "Onaylı kayıtlar var; kapanış listesi eksikleri gösterir, yönetici kilitler (§21)." };
  return { title: "Rapor sürümü oluştur", href: "/raporlar/", why: "Kilitli dönem için sabit manifestli rapor üretilir (T19)." };
}

// ---------- Niyet işleyicileri ----------
function answerEmpty(): Answer {
  const ex = ["CO₂e ne demek?", "Bu kutuya ne yazacağım?", "Kaydım ne durumda?", "Sonuç ne?", "Ne yapmalıyım?", "Neden bu kapsam?"];
  return base("empty", {
    kind: "clarify",
    summary: "Sorunuzu yazın; asistan yalnız yetkili kaynaklardan ve bu kurumun verisinden yanıt kurar.",
    basis: cites(["§24"]),
    uncertainty: "—",
    action: { text: "Bir örnek soru seçin", href: null },
    clarify: { question: "Ne sormak istiyorsunuz?", options: ex.map((q) => ({ label: q, question: q })) },
  });
}

function answerOtherTenant(s: Store): Answer {
  return base("other_tenant", {
    kind: "no_source",
    summary: "Başka bir kurumun verisi bu asistandan okunamaz; örnek veya öneri olarak bile gösterilmez. Yanıtlar yalnız aktif kurumun (sizin) verisiyle kurulur.",
    basis: cites(["§24", "§27", "§29"], "Başka müşteri verisi örnek veya öneri olarak bile gösterilmez"),
    condition: tenantCondition(s),
    uncertainty: "Diğer kurumun kaydının var olup olmadığı hakkında da bilgi verilmez (T14).",
    action: { text: "Kendi envanterinizi görün", href: "/envanter/" },
  });
}

function answerErrorCode(question: string): Answer {
  const code = question.match(/\b[A-Z][A-Z_]{4,}\b/g)!.find((c) => ERROR_BY_CODE[c])!;
  const e = ERROR_BY_CODE[code];
  return base("error_code", {
    summary: `${e.title} (${code}): ${e.cause} ${e.consequence}`,
    basis: cites([code]),
    condition: `Oluştuğu yer: ${e.source}.`,
    uncertainty: "Hata sözlüğü maddesi; kurumunuza özgü bir hüküm değildir.",
    action: { text: e.action, href: `/hatalar/#${code}` },
  });
}

function answerNextStep(s: Store): Answer {
  const n = nextStep(s);
  const open = s.tasks().filter((t) => t.status === "open");
  return base("next_step", {
    summary: `Sonraki adım: ${n.title}. ${n.why}`,
    basis: cites(["§05", "§06", "§21"], "sonraki adım bugünkü işler eksikler"),
    condition: `${tenantCondition(s)} Açık görev: ${open.length}.`,
    uncertainty: "Adım, deponun şu anki durumundan türetildi; ana sayfa ile aynı kural (§05).",
    action: { text: n.title, href: n.href },
    details: open.slice(0, 5).map((t) => `Açık görev: ${t.title} [${t.requirement_ids.join(", ")}]`),
  });
}

function answerStatus(s: Store, question: string): Answer {
  const r = resolveRecord(s, question, "status");
  if ("clarify" in r) return r.clarify;
  if ("none" in r) return r.none;
  if ("notfound" in r) return r.notfound;
  const rec = r.record;
  const v = s.current(rec.id);
  const run = s.latestRun(rec.id);
  const ap = s.approvalsOf(rec.id).filter((a) => !a.invalidated_at).slice(-1)[0];
  const openTasks = s.tasks().filter((t) => t.related_record_id === rec.id && t.status === "open");
  const runText = run ? `Son hesap koşusu ${run.id.slice(0, 12)} (${run.result.status}, kayıt v${run.record_version}).` : "Kaydedilmiş hesap koşusu yok.";
  const next: Record<string, { text: string; href: string }> = {
    draft: { text: "Hesabı çalıştır", href: `/kayit/?id=${rec.id}` },
    validation_required: { text: "Eksik alanı tamamla (görevde yazılı)", href: `/kayit/?id=${rec.id}` },
    calculated: { text: "Kontrole gönder", href: `/kayit/?id=${rec.id}` },
    in_review: { text: "İnceleme kuyruğu (farklı rol)", href: "/inceleme/" },
    changes_requested: { text: "Gerekçeye göre yeni sürüm gir", href: `/kayit/?id=${rec.id}` },
    approved: { text: "Dönem kapanış listesi", href: "/donem/" },
    locked: { text: "Rapor sürümü", href: "/raporlar/" },
  };
  return base("status", {
    summary: `Kayıt ${rec.id.slice(0, 12)} durumu: ${STATE_LABEL[rec.state]} (sürüm ${rec.current_version}). ${runText} ${ap ? `Onay: ${ap.decision === "approved" ? "onaylandı" : "düzeltme istendi"} (${ap.at.slice(0, 10)}).` : "Geçerli onay yok."}`,
    basis: cites(["§21"], "Kayıt durumları Hesaplandı, onaylandı anlamına gelmez"),
    condition: `${tenantCondition(s)} Kayıt: ${recordLabel(s, rec)}; miktar ${v.quantity_state === "known" ? `${v.quantity} ${v.unit ?? "(birim yok)"}` : v.quantity_state}.`,
    uncertainty: rec.state === "calculated" ? "Hesaplandı, onaylandı anlamına gelmez (§21)." : openTasks.length ? `${openTasks.length} açık görev bu kayda bağlı.` : "—",
    action: { text: next[rec.state].text, href: next[rec.state].href },
    details: [...openTasks.map((t) => `Açık görev: ${t.title}`), ...(run ? run.result.warnings.map((w) => `Uyarı ${w.code}: ${w.message_tr}`) : []), ...(run ? run.result.blocks.map((b) => `Engel ${b.code}: ${b.message_tr}`) : [])],
  });
}

function answerNumeric(s: Store, question: string): Answer {
  const f = fold(question);
  const recs = s.records();
  const periodAsk = /\b(donem|rapor)\b/.test(f) || (/toplam/.test(f) && recs.length !== 1 && !/act-/.test(f));
  if (periodAsk) {
    const reps = s.reports();
    const last = reps[reps.length - 1];
    if (!last) {
      return base("numeric", {
        kind: "no_source",
        summary: "Dönem toplamı için kaydedilmiş rapor sürümü yok. Toplam yalnız onaylı kayıtların motor sonuçlarından rapor manifestinde üretilir; asistan toplama yapmaz.",
        basis: cites(["§22", "§24"], "Sonuçların sayısal otoritesi hesaplama servisidir"),
        condition: `${tenantCondition(s)} Kayıt sayısı ${recs.length}.`,
        uncertainty: "Sayı yok; tahmin verilmez (AI-05).",
        action: { text: "Rapor sürümü oluştur", href: "/raporlar/" },
      });
    }
    const t = last.manifest.totals;
    const val = t.approved_co2e_kg;
    return base("numeric", {
      summary: val === null ? `Rapor v${last.version} (${last.manifest.period.start}–${last.manifest.period.end}): onaylı kayıt toplamı yok; ${t.non_approved_record_count} kayıt onaylı değil, ${t.blocked_record_count} kayıt hesapsız.` : `Rapor v${last.version} (${last.manifest.period.start}–${last.manifest.period.end}): ${val} kg CO₂e. ${t.label_tr}.`,
      basis: cites(["§22", "§24"], "rapor manifesti toplam"),
      condition: `${tenantCondition(s)} Onaylı ${t.approved_record_count}, onaysız ${t.non_approved_record_count}, hesapsız ${t.blocked_record_count} kayıt.`,
      uncertainty: last.manifest.gaps_tr.join(" "),
      action: { text: "Rapor sürümünü gör", href: "/raporlar/" },
      number: val === null ? null : { value: val, unit: "kg CO₂e", run_id: last.id, record_id: "" },
      details: last.manifest.gaps_tr,
    });
  }
  const r = resolveRecord(s, question, "numeric");
  if ("clarify" in r) return r.clarify;
  if ("none" in r) return r.none;
  if ("notfound" in r) return r.notfound;
  const rec = r.record;
  const run = s.latestRun(rec.id);
  if (!run) {
    return base("numeric", {
      kind: "no_source",
      summary: `Kayıt ${rec.id.slice(0, 12)} için kaydedilmiş hesap koşusu yok; bu yüzden sayı veremem. Sayıyı yalnız hesap motoru üretir, asistan hesaplamaz ve tahmin etmez.`,
      basis: cites(["§24", "ASSISTANT_NO_RUN"], "Sayı gerekiyorsa hesap servisinden alınır"),
      condition: `${tenantCondition(s)} Kayıt: ${recordLabel(s, rec)}.`,
      uncertainty: "Koşu yok → sayı yok (AI-05, kural 1).",
      action: { text: "Kayıt sayfasında Hesapla düğmesini çalıştır", href: `/kayit/?id=${rec.id}` },
    });
  }
  const res = run.result;
  const stale = run.record_version !== rec.current_version;
  if (res.total_co2e_kg === null) {
    return base("numeric", {
      kind: "no_source",
      summary: `Kayıt ${rec.id.slice(0, 12)} son koşusu engellendi (${res.status}); toplam üretilmedi. Engel: ${res.blocks.map((b) => b.message_tr).join(" ") || "—"}`,
      basis: cites(["§18", ...res.blocks.map((b) => b.code)], "hesap engeli"),
      condition: `${tenantCondition(s)} Koşu ${run.id.slice(0, 12)}, kayıt v${run.record_version}.`,
      uncertainty: "Engel çözülmeden sayı yoktur; eksik veriye sıfır atanmaz (kural 2).",
      action: { text: "Engeli kayıt sayfasında çöz", href: `/kayit/?id=${rec.id}` },
    });
  }
  return base("numeric", {
    summary: `Kayıt ${rec.id.slice(0, 12)} için kayıtlı hesap koşusu ${run.id.slice(0, 12)}: toplam ${res.total_co2e_kg} kg CO₂e. ${res.claim_tr}`,
    basis: cites(["§24", "§18"], "Sonuçların sayısal otoritesi hesaplama servisidir"),
    condition: `${tenantCondition(s)} Koşu: motor ${run.engine_version}, yöntem ${run.method.id}@${run.method.version}, faktör ${run.factor_refs.map((x) => `${x.id}@${x.version}`).join(", ")}; kayıt v${run.record_version}; kapsayıcılık ${res.coverage ?? "—"}; durum ${res.status}.`,
    uncertainty: [stale ? `Koşu kayıt v${run.record_version} içindir, kayıt şimdi v${rec.current_version}; yeniden hesap gerekir.` : null, res.status === "review_required" ? "Sonuç 'inceleme gerekli' durumunda." : null, ...res.warnings.map((w) => w.message_tr)].filter(Boolean).join(" ") || "Sayı motor çıktısıyla birebirdir; yuvarlama yapılmadı.",
    action: rec.state === "calculated" ? { text: "Kontrole gönder", href: `/kayit/?id=${rec.id}` } : { text: "Kaydı ve koşu izini gör", href: `/kayit/?id=${rec.id}` },
    number: { value: res.total_co2e_kg, unit: "kg CO₂e", run_id: run.id, record_id: rec.id },
    details: res.components.map((c) => `${c.gas}: ${c.mass_kg} kg × GWP ${c.gwp ?? "—"} → ${c.co2e_kg} kg CO₂e (faktör ${c.factor_id}@${c.factor_version})`),
  });
}

function answerFactor(s: Store, question: string): Answer {
  const f = fold(question);
  const refrig = /(sogutucu|refrigerant|\br-?\d{2,3}[a-z]?\b|freon|hfc)/.test(f);
  const draft: TaskDraft = refrig
    ? { title: "Uzman kararı: soğutucu gaz tanımı ve faktör kaynağı", detail: `Kullanıcı sorusu: "${question}". Soğutucu gaz adı, GWP seti ve faktör kaynağı uzman tarafından doğrulanmadan kayda değer girilmez (T11).`, kind: "expert_decision", related_record_id: null, requirement_ids: ["T11", "AI-05"] }
    : { title: "İçerik talebi: faktör kaynağı", detail: `Kullanıcı sorusu: "${question}". Faktör yalnız sürümlü, lisanslı katalogdan gelir; asistan değer uydurmaz.`, kind: "content", related_record_id: null, requirement_ids: ["§19", "AI-05"] };
  return base("factor", {
    kind: "no_source",
    summary: refrig
      ? `${NO_SOURCE} Bu önizlemede doğrulanmış soğutucu gaz listesi ve faktörü yok; asistan katsayı tahmin etmez. Soğutucu için yeni ekipman dolumu otomatik kaçak emisyon sayılmaz (T11).`
      : `${NO_SOURCE} Faktör değeri asistandan değil, sürümlü faktör kataloğundan okunur; bu önizlemedeki tüm faktörler kurgusal test değeridir ve hesap sırasında motor seçer.`,
    basis: cites(["§24", "§29", "§19"], refrig ? "Soğutucu yeni ekipman dolumu otomatik kaçak emisyon sayılmaz" : "Kullanıcı faktör istemeden tahmini katsayı uydurulmaz"),
    condition: tenantCondition(s),
    uncertainty: "Katsayı verilmedi; verilse bile kayda yalnız uzman onaylı katalog sürümü girer (kural 1, 6).",
    action: { text: "Faktör kataloğunu gör (kurgusal test değerleri)", href: "/faktorler/" },
    taskDraft: draft,
  });
}

function sourceCards(question: string): Citation[] {
  const f = fold(question);
  const map: [RegExp, string[]][] = [
    [/\bgri\b/, ["K01", "K14", "K15"]],
    [/tsrs|kgk/, ["K02"]],
    [/ghg|sera gazi protokol/, ["K03", "K04"]],
    [/kapsam 2|scope 2|elektrik/, ["K04", "K16"]],
    [/kapsam 3|scope 3|tedarik/, ["K05", "K06"]],
    [/iso 14067|urun karbon/, ["K08"]],
    [/iso 1404|yasam dongusu|lca/, ["K13"]],
    [/\biso\b/, ["K08", "K13"]],
  ];
  const ids = new Set<string>();
  for (const [re, list] of map) if (re.test(f)) list.forEach((i) => ids.add(i));
  return cites(Array.from(ids));
}

function answerLegal(s: Store, question: string): Answer {
  const f = fold(question);
  const t = s.tenant!;
  const prof = profileById(t.profile_id);
  const pkgs = prof?.regulation_packages ?? [];
  const draftLaw = /taslak/.test(f);
  const cards = sourceCards(question);
  const basis = [...cites(["REG-01", "§19", "§24"], "Taslak yayın otomatik yükümlülük olamaz"), ...cards];
  return base("legal", {
    summary: `Bu soruya kesin "evet/hayır" veremem; yükümlülük kararı kaynak metnine ve kurumun durumuna bağlıdır. ${draftLaw ? "Taslak yayın otomatik yükümlülük doğurmaz; yürürlük tarihi ve kapsam koşulu kaynakta belirtilmeden kural etkinleşmez (§19)." : "Her yükümlülük ayrı, sürümlü bir paket olarak §08 uygulanabilirlik değerlendirmesiyle açılır (REG-01)."} Aşağıdaki dayanaklar kapsamı anlatır, hüküm vermez.`,
    basis,
    condition: `${tenantCondition(s)} ${pkgs.length ? `Profilde listelenen paketler: ${pkgs.map((p) => `${p.package_id} (${p.note})`).join("; ")}.` : "Profilde listelenmiş regülasyon paketi yok."}`,
    uncertainty: `${T16} ${draftLaw ? "Taslak metin yürürlükte değildir; doğrulanmamış kural review_required kalır (kural 6)." : "Ceza/tutar/tarih uydurulmaz; doğrulanmış kaynak sürümü gelmeden sayı verilmez."}`,
    action: { text: "Uzman görüşü görevi aç (kaynak ve bağlam eklenir)", href: SUPPORT_HREF },
    taskDraft: { title: `Uzman görüşü: ${question.slice(0, 80)}`, detail: `Hukuki/uygunluk sorusu: "${question}". Asistan hüküm vermez (T16). İlgili kaynak kartları: ${cards.map((c) => c.id).join(", ") || "—"}. Kurum profili: ${t.profile_id}@${t.profile_version}.`, kind: "expert_decision", related_record_id: null, requirement_ids: ["T16", "REG-01"] },
  });
}

function answerConflict(s: Store, question: string): Answer {
  const cards = sourceCards(question);
  return base("conflict", {
    summary: "İki kaynak aynı terimi farklı bağlamda kullanabilir; asistan birini doğru ilan etmez. Uygulama, bağlam seçimini gösterir ve tek tanıma zorlamaz (§10); hangi çerçevenin geçerli olduğu kurumun raporlama çerçevesi kararıdır.",
    basis: [...cites(["§10", "§19"], "Aynı terimin standartlara göre farklı kullanımı varsa bağlam seçimi gösterilir"), ...cards],
    condition: `${tenantCondition(s)} Raporlama çerçevesi kurulumda/uzman kararıyla seçilir; seçilen çerçevenin sürümü kayıtta tutulur.`,
    uncertainty: "Kaynaklar arasındaki fark için uzman kararı gerekir; asistan hüküm vermez (T16).",
    action: { text: "Uzman kararı görevi aç", href: SUPPORT_HREF },
    taskDraft: { title: `Uzman kararı: standart seçimi — ${question.slice(0, 60)}`, detail: `Çelişen/alternatif standart sorusu: "${question}". Kaynak kartları: ${cards.map((c) => c.id).join(", ") || "—"}. Karar, kurum raporlama çerçevesi olarak kaydedilir.`, kind: "expert_decision", related_record_id: null, requirement_ids: ["§10", "T16"] },
  });
}

function answerWhyScope(s: Store, question: string): Answer {
  const f = fold(question);
  const srcs = s.sources();
  const named = srcs.find((x) => f.includes(fold(x.name)));
  const list = (named ? [named] : srcs).map((x) => `${x.name}: ${SOURCE_TYPE_LABEL[x.source_type]} → Kapsam ${SCOPE_OF_SOURCE[x.source_type] || "—"}${x.control !== "owned" ? ` (kontrol: ${x.control})` : ""}`);
  return base("why_scope", {
    summary: "Kapsam, kaynağın türünden ve kontrol yaklaşımından türetilir: kurumun sahip olduğu/kontrol ettiği yakma ve proses kaynakları Kapsam 1, satın alınan enerji Kapsam 2, değer zinciri Kapsam 3. Kapsam önerisi sistemden gelir; kesinleştirme kullanıcı ve uzman kararıdır.",
    basis: cites(["kapsam", "§11", "§15"], "kapsam"),
    condition: `${tenantCondition(s)} ${list.length ? `Kaynaklarınız: ${list.join("; ")}.` : "Kaynak envanteri boş; kapsam atanacak kaynak yok."}`,
    uncertainty: "Kontrol yaklaşımı (operasyonel/finansal) belirsizse kapsam atanması uzman kararına gider (ONB-02).",
    action: { text: "Kaynak envanterini gör", href: "/kurulum/" },
  });
}

function answerDefinition(s: Store, question: string): Answer {
  const f = fold(question);
  const m = f.match(/^(.*?)\s*(ne demek|nedir|ne anlama gel|neyi ifade ed|ne demektir|anlami ne|tanimi ne|aciklar misin|ne\s*\?)/);
  const subject = (m ? m[1] : f).replace(/[?.!]/g, "").trim();
  if (!subject) return noSource("definition", question);
  const term = search(subject, { kinds: ["term"], limit: 1, min: 1 })[0];
  if (term) {
    const c = cite(term.entry, subject);
    const t = TERMS.find((x) => x.id === term.entry.id);
    return base("definition", {
      summary: c.excerpt ?? term.entry.text,
      basis: [c],
      details: t ? [`Örnek: ${t.example}`, ...(t.confused_with ? [`Karıştırılan: ${t.confused_with}`] : []), ...(t.related_task ? [`İlgili görev: ${t.related_task}`] : [])] : [],
      condition: tenantCondition(s),
      uncertainty: `Sözlük maddesi durumu: ${term.entry.version}. Bir kaynaktaki teknik tanım uygulamanın kendi görüşü gibi sunulmaz (§10).`,
      action: { text: "Sözlükte tam maddeyi aç", href: "/sozluk/" },
    });
  }
  return answerLookup(s, subject, "definition");
}

function unitHelp(unit: string): { text: string; cites: string[] } {
  switch (unit) {
    case "Sm3":
    case "Nm3":
      return { text: `${unit} standart/normal koşullu hacimdir; koşullar birimin tanımında olduğu için ayrıca sıcaklık/basınç girilmez. Birim listesinden ${unit} seçin, miktarı faturadaki gibi yazın.`, cites: ["§11", "UNIT_CONDITIONS_UNKNOWN"] };
    case "m3":
      return { text: "Yalın m³ için hacim koşulları (sıcaklık/basınç) gerekir; faturada Sm³/Nm³ yazıyorsa onu seçin. Koşul bilinmiyorsa hesap engellenir ve kayıt taslak kalır (T03).", cites: ["§11", "UNIT_CONDITIONS_UNKNOWN", "§29"] };
    case "kWh":
    case "MWh":
    case "GJ":
      return { text: `${unit} enerji birimidir; doğal gaz için alt/üst ısıl değer esası (LHV/HHV) seçilmelidir, faturada yazmıyorsa 'bilinmiyor' bırakın ve görev açılır (T04).`, cites: ["§11", "BASIS_UNKNOWN", "§29"] };
    default:
      return { text: "Faturada birim yoksa 'birim bilinmiyor' seçin; kayıt taslak olarak korunur ve eksik bilgi görevi açılır (T20). Birim uydurulmaz.", cites: ["§11", "UNIT_UNKNOWN", "§29"] };
  }
}

function answerFieldHelp(s: Store, question: string): Answer {
  const f = fold(question);
  const field = FIELD_WORDS.find((x) => x.words.some((w) => f.includes(w)))?.key;
  if (!field) {
    return base("field_help", {
      kind: "clarify",
      summary: "Hangi alanı doldurduğunuzu bilmeden belgedeki yeri gösteremem.",
      basis: cites(["§10", "§24"], "Bu kutuya ne yazacağım"),
      condition: tenantCondition(s),
      uncertainty: "Alan seçilmeden yanıt yok (ASSISTANT_CONTEXT_REQUIRED).",
      action: { text: "Alanı seçin", href: null },
      clarify: { question: "Hangi alan için soruyorsunuz?", options: Object.values(FIELD_LABEL).map((l) => ({ label: l, question: `${l} alanına ne yazacağım?` })) },
    });
  }
  if (field === "birim") {
    const unit = UNIT_WORDS.find((u) => u.words.some((w) => f.includes(w)))?.unit;
    if (!unit) {
      return base("field_help", {
        kind: "clarify",
        summary: "Birim yardımı faturadaki birime bağlıdır; faturada ne yazdığını bilmeden doğru alanı gösteremem.",
        basis: cites(["§11", "T20"].filter((x) => x !== "T20"), "Birimin bilinmediği miktardan kesin sonuç üretilmez"),
        condition: tenantCondition(s),
        uncertainty: "Birim bilinmeden varsayım yapılmaz (ASSISTANT_CONTEXT_REQUIRED).",
        action: { text: "Faturadaki birimi seçin", href: null },
        clarify: {
          question: "Faturada miktarın yanında hangi birim yazıyor?",
          options: [
            { label: "Sm³", question: "Faturada Sm3 yazıyor, birim alanına ne yazacağım?" },
            { label: "Nm³", question: "Faturada Nm3 yazıyor, birim alanına ne yazacağım?" },
            { label: "m³ (koşul yok)", question: "Faturada yalın m3 yazıyor, birim alanına ne yazacağım?" },
            { label: "kWh", question: "Faturada kWh yazıyor, birim alanına ne yazacağım?" },
            { label: "GJ", question: "Faturada GJ yazıyor, birim alanına ne yazacağım?" },
            { label: "Birim yok", question: "Faturada birim yok, birim alanına ne yazacağım?" },
          ],
        },
      });
    }
    const h = unitHelp(/birim yok/.test(f) ? "none" : unit);
    return base("field_help", {
      summary: h.text,
      basis: cites(h.cites, "birim"),
      condition: tenantCondition(s),
      uncertainty: "Önerilen değer onay alınmadan forma yazılmaz (§28).",
      action: { text: "Veri girişi formuna dön", href: "/veri-girisi/" },
    });
  }
  const HELP: Record<string, { text: string; cites: string[] }> = {
    miktar: { text: "Faturanın tüketim satırındaki miktarı yazın; ödeme tutarını değil. Nokta/virgül ayracı sorulur, '1.234' gibi belirsiz değerde sessiz karar verilmez. Miktar yoksa 'bilinmiyor' seçin; sıfır yazmayın.", cites: ["§11", "§10", "INVALID_NUMBER", "NEGATIVE_QUANTITY"] },
    donem: { text: "Faturadaki tüketim dönemi (okuma başlangıcı–bitişi) girilir; fatura düzenleme tarihi değil. Dönem, raporlama dönemi içinde olmalıdır.", cites: ["§11", "§21"] },
    fatura_no: { text: "Faturanın seri/sıra numarasını olduğu gibi yazın. Aynı fatura numarası ve tedarikçi ikinci kez girilirse mükerrer aday uyarısı çıkar (T07).", cites: ["§11", "DUPLICATE_CANDIDATE"] },
    tedarikci: { text: "Faturayı düzenleyen dağıtım/satış şirketinin unvanını yazın; mükerrerlik kontrolünde fatura numarasıyla birlikte kullanılır.", cites: ["§11", "DUPLICATE_CANDIDATE"] },
    isil: { text: "Faturada 'alt ısıl değer' (LHV) ya da 'üst ısıl değer' (HHV) ibaresine bakın; enerji birimli (kWh/GJ) miktar için zorunludur. Yazmıyorsa 'bilinmiyor' bırakın; uyum çözülmeden onay olmaz (T04).", cites: ["§11", "BASIS_UNKNOWN", "BASIS_MISMATCH"] },
    kanit: { text: "Fatura PDF'ini veya görselini kanıt olarak ekleyin; önizlemede yalnız karma ve üst veri saklanır. Kanıtsız kayıt onaylanamaz.", cites: ["§11", "EVIDENCE_REQUIRED"] },
    veri_niteligi: { text: "Fatura/sayaç verisi 'ölçülmüş', pay/oran ile türetilen veri 'tahmini' seçilir. Tahmini veri raporda ayrı görünür; sıfıra çevrilmez.", cites: ["§11", "§22"] },
  };
  const h = HELP[field];
  return base("field_help", {
    summary: h.text,
    basis: cites(h.cites, FIELD_LABEL[field]),
    condition: tenantCondition(s),
    uncertainty: "Belgedeki alan adı farklı olabilir; emin değilseniz 'Emin değilim' ile uzman kontrolüne işaretleyin (§10).",
    action: { text: `Veri girişi formunda ${FIELD_LABEL[field]} alanı`, href: "/veri-girisi/" },
  });
}

function answerLookup(s: Store, question: string, intent: Intent = "lookup"): Answer {
  const hits = search(question, { limit: 3 });
  if (!hits.length) return noSource(intent, question);
  const top = cite(hits[0].entry, question);
  return base(intent, {
    summary: top.excerpt ?? top.label,
    basis: hits.map((h) => cite(h.entry, question)),
    condition: tenantCondition(s),
    uncertainty: `En yakın kaynak: ${top.label} (${top.version}). Eşleşme anahtar sözcükle bulundu; metin kaynaktan alıntıdır, yorum değildir.`,
    action: { text: "Kaynağın tamamını aç", href: top.href },
    details: hits.slice(1).map((h) => `${h.entry.title}: ${excerptOf(h.entry.text)}`),
  });
}

function excerptOf(t: string): string {
  return t.replace(/\s+/g, " ").slice(0, 220);
}

function answerDocument(s: Store, text: string): Answer {
  const scan = scanDocument(text);
  const n = scan.candidates.length;
  return base("document", {
    summary: n ? `Belgeden ${n} alan adayı okundu: ${scan.candidates.map((c) => c.label).join(", ")}. Adaylar öneridir; siz onaylamadan forma yazılmaz.` : "Belgede tanınan alan (fatura no, dönem, miktar+birim, tedarikçi) bulunamadı. Metin veri olarak değerlendirildi; alanları elle girin.",
    basis: cites(["§11", "§24", "§28"], "Okunan alanları doğrula önerilen değer onay alınmadan forma yazılmaz"),
    condition: `${tenantCondition(s)} Belge ${scan.chars} karakter; içerik saklanmadı, yalnız adaylar gösterildi.`,
    uncertainty: scan.candidates.some((c) => c.note) ? scan.candidates.filter((c) => c.note).map((c) => `${c.label}: ${c.note}`).join(" ") : "Okuma doğruluğu hesap doğruluğu değildir (§11); her adayı faturayla karşılaştırın.",
    action: { text: n ? "Onayladığınız adayları veri girişine aktar" : "Veri girişine git", href: "/veri-girisi/" },
    notices: scan.injections.length ? [`Belgede talimat benzeri içerik bulundu (${scan.injections.join("; ")}). Veri olarak değerlendirildi ve yok sayıldı; hiçbir davranış değişmedi (T15, ASSISTANT_DOCUMENT_INSTRUCTION).`] : [],
    document: scan,
  });
}

// ---------- Giriş noktası ----------
export interface AskOptions {
  document?: string; // yapıştırılan belge metni (veri; komut değil)
}

/** Tek giriş: amaç + aktif kurum (AI-01) → yetkili kaynak (AI-02) → dayanak (AI-03) → soru (AI-04) → sayı yalnız koşudan (AI-05) → bütün alanlar (AI-06). */
export function ask(s: Store, question: string, opts: AskOptions = {}): Answer {
  s.require("asistan.ask");
  if (!s.tenant) throw new StoreError("NO_TENANT", "Önce bir kurum oluşturun veya seçin.", 401);
  const q = question.trim();
  const injected = findInjections(q);
  let a: Answer;
  if (opts.document !== undefined) a = answerDocument(s, opts.document);
  else {
    const intent = detectIntent(q);
    switch (intent) {
      case "empty": a = answerEmpty(); break;
      case "other_tenant": a = answerOtherTenant(s); break;
      case "error_code": a = answerErrorCode(q); break;
      case "next_step": a = answerNextStep(s); break;
      case "conflict": a = answerConflict(s, q); break;
      case "legal": a = answerLegal(s, q); break;
      case "factor": a = answerFactor(s, q); break;
      case "numeric": a = answerNumeric(s, q); break;
      case "status": a = answerStatus(s, q); break;
      case "why_scope": a = answerWhyScope(s, q); break;
      case "field_help": a = answerFieldHelp(s, q); break;
      case "definition": a = answerDefinition(s, q); break;
      default: a = answerLookup(s, q);
    }
  }
  if (injected.length) a.notices = [...a.notices, `Soruda talimat benzeri ifade var (${injected.join("; ")}); veri olarak kabul edildi, yok sayıldı (T15).`];
  return a;
}
