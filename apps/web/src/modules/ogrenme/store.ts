// ogrenme modülü saf fonksiyonları: (s: Store, …) => … . Tablolar: ogrenme/progress, ogrenme/applicability, ogrenme/agenda_prefs.
// İçerik contentOf ile okunur (kural 5/6); sayısal hesap yok; ders örnekleri hiçbir zaman envantere yazılmaz (§07 kabul).
import { contentOf, PROFILES, profileById, type Profile } from "@/lib/content";
import { PREVIEW_USERS, ROLE_LABEL, type Role, type Task, type Tenant } from "@/lib/domain";
import { Store, StoreError } from "@/lib/store";
import {
  type AgendaItem,
  type AgendaPrefRow,
  type ApplicabilityResult,
  type ApplicabilityRow,
  type CalendarEntry,
  type FundingItem,
  type LessonFull,
  type PathRole,
  type ProgressRow,
  type SourceFull,
  type TermFull,
} from "./types";

const MOD = "ogrenme";

// ---------- İçerik ----------
export const lessons = (): LessonFull[] => contentOf<LessonFull>("lessons");
export const terms = (): TermFull[] => contentOf<TermFull>("terms");
export const sources = (): SourceFull[] => contentOf<SourceFull>("sources");
export const agendaItems = (): AgendaItem[] => contentOf<AgendaItem>("agenda");
export const fundingItems = (): FundingItem[] => contentOf<FundingItem>("funding");
export const lessonById = (id: string): LessonFull | undefined => lessons().find((l) => l.id === id);
export const sourceByCode = (code: string): SourceFull | undefined => sources().find((s) => s.code === code);

/** Kurumun profili; profil yoksa "genel" (SEK-05). Kurum yoksa null. */
export function tenantProfile(tenant: Tenant | null): Profile | null {
  if (!tenant) return null;
  return profileById(tenant.profile_id) ?? profileById("genel") ?? PROFILES[0] ?? null;
}

// ---------- 101: rol bazlı yol (ÖĞR-01…03) ----------
export function defaultPathFor(role: Role): PathRole {
  if (role === "admin" || role === "approver" || role === "viewer") return "manager";
  if (role === "data_entry") return "field";
  return "specialist";
}

/** Profilin lesson_paths'inden ders yolu; bilinmeyen ders kimlikleri atlanır (içerik hatası görünür kalsın diye ayrıca döner). */
export function lessonPath(profile: Profile | null, role: PathRole): { lessons: LessonFull[]; missing: string[] } {
  const ids = profile?.lesson_paths?.[role] ?? [];
  const all = lessons();
  const found: LessonFull[] = [];
  const missing: string[] = [];
  for (const id of ids) {
    const l = all.find((x) => x.id === id);
    if (l) found.push(l);
    else missing.push(id);
  }
  return { lessons: found, missing };
}

// ---------- 101: ilerleme (kullanıcı bazında; §07) ----------
export function myProgress(s: Store): ProgressRow[] {
  if (!s.session.tenant_id) return [];
  return s.rows<ProgressRow>(MOD, "progress").filter((r) => r.user_id === s.user.id);
}

export function completionOf(s: Store, lessonId: string): { done: boolean; row: ProgressRow | null; stale: boolean } {
  const lesson = lessonById(lessonId);
  const rows = myProgress(s).filter((r) => r.lesson_id === lessonId).sort((a, b) => (a.completed_at < b.completed_at ? 1 : -1));
  const row = rows[0] ?? null;
  // Ders güncellenince eski tamamlama korunur; sürüm farklıysa kısa tazeleme önerilir (§07 kabul koşulu)
  const stale = !!row && !!lesson && row.content_version !== String(lesson.review_date);
  return { done: !!row, row, stale };
}

/** "Modül tamamlandı" kaydı. Üç soru da cevaplanmış olmalı (doğruluk şart değil). Aynı sürüm için tekrar çağrı mevcut kaydı döner. */
export function completeLesson(s: Store, lessonId: string, input: { unit_id: string | null; answers: (number | null)[] }): ProgressRow {
  s.require("ogrenme.progress.write");
  const lesson = lessonById(lessonId);
  if (!lesson) throw new StoreError("LESSON_NOT_FOUND", `Ders bulunamadı: ${lessonId}`, 404);
  const answers = input.answers.slice(0, lesson.quiz.length);
  if (answers.length < lesson.quiz.length || answers.some((a) => a === null || a === undefined)) {
    throw new StoreError("LESSON_QUIZ_INCOMPLETE", "Üç sorunun hepsini cevaplayın; yanlış cevapta açıklamayı okuyun, sonra modülü tamamlayın.", 422);
  }
  const version = String(lesson.review_date);
  const existing = myProgress(s).find((r) => r.lesson_id === lessonId && r.content_version === version);
  if (existing) return existing;
  const correct = answers.filter((a, i) => a === lesson.quiz[i].correct).length;
  return s.insert<ProgressRow>(
    MOD,
    "progress",
    {
      user_id: s.user.id,
      lesson_id: lessonId,
      content_version: version,
      completed_at: new Date().toISOString(),
      duration_min: lesson.duration_min,
      unit_id: input.unit_id,
      quiz_correct: correct,
      quiz_total: lesson.quiz.length,
    },
    "ogrenme.lesson.complete"
  );
}

/** Eğitim saati yalnız birim düzeyinde (ÖĞR-04, kural 11): kullanıcı kimliği çıktıya girmez. */
export function trainingByUnit(s: Store): { unit_id: string | null; unit_label: string; minutes: number; completions: number }[] {
  if (!s.session.tenant_id) return [];
  const facilities = s.facilities();
  const acc = new Map<string | null, { minutes: number; completions: number }>();
  for (const r of s.rows<ProgressRow>(MOD, "progress")) {
    const key = r.unit_id ?? null;
    const cur = acc.get(key) ?? { minutes: 0, completions: 0 };
    cur.minutes += r.duration_min;
    cur.completions += 1;
    acc.set(key, cur);
  }
  return Array.from(acc.entries())
    .map(([unit_id, v]) => ({ unit_id, unit_label: unit_id ? (facilities.find((f) => f.id === unit_id)?.name ?? "Bilinmeyen birim") : "Kurum geneli", ...v }))
    .sort((a, b) => a.unit_label.localeCompare(b.unit_label, "tr"));
}

// ---------- Protokoller: "bu bana neden gösteriliyor?" ve uygulanabilirlik (§08, REG-01) ----------
export function whyShown(source: SourceFull, tenant: Tenant | null, profile: Profile | null): string[] {
  const out: string[] = [];
  for (const r of source.relevance ?? []) {
    switch (r.kind) {
      case "always":
        out.push(r.reason);
        break;
      case "country":
        if (tenant && tenant.country === r.value) out.push(`${r.reason} (kurum ülkesi: ${tenant.country})`);
        break;
      case "package":
        if (profile?.regulation_packages.some((p) => p.package_id === r.value)) out.push(`${r.reason} (profil: ${profile.title.tr})`);
        break;
      case "scope3_category":
        if (r.value === null) {
          if (profile && profile.scope3_priorities.length) out.push(`${r.reason} (öncelikli kategoriler: ${profile.scope3_priorities.join(", ")})`);
        } else if (profile?.scope3_priorities.includes(Number(r.value))) out.push(`${r.reason} (profil: ${profile.title.tr})`);
        break;
      case "product_study":
        out.push(`${r.reason} Ürün çalışması başlatılmadıysa yalnız bilgi amaçlıdır.`);
        break;
    }
  }
  return out;
}

export const VALID_RESULTS: ApplicabilityResult[] = ["applies", "not_applicable", "review_required"];

export function decideApplicability(s: Store, input: { source_code: string; result: ApplicabilityResult; reason: string }): ApplicabilityRow {
  s.require("ogrenme.applicability.decide");
  const src = sourceByCode(input.source_code);
  if (!src) throw new StoreError("APPLICABILITY_UNKNOWN_SOURCE", `Kaynak kartı yok: ${input.source_code}`, 404);
  if (!VALID_RESULTS.includes(input.result)) throw new StoreError("APPLICABILITY_RESULT_INVALID", "Karar uygulanır / uygulanmaz / inceleme gerekli olmalı.", 422);
  if ((input.reason ?? "").trim().length < 10) throw new StoreError("APPLICABILITY_REASON_REQUIRED", "Karar gerekçesi zorunlu (en az 10 karakter): hangi kurum verisine dayandığını yazın.", 422);
  const tenant = s.tenant;
  const profile = tenantProfile(tenant);
  // Karar değişmezdir: yeni satır; eskisi geçmişte kalır (kural 9)
  return s.insert<ApplicabilityRow>(
    MOD,
    "applicability",
    {
      source_code: src.code,
      result: input.result,
      reason: input.reason.trim(),
      rule_version: String(src.checked_at),
      decided_by: s.user.id,
      decided_at: new Date().toISOString(),
      inputs: { profile_id: tenant?.profile_id ?? "", profile_version: tenant?.profile_version ?? "", country: tenant?.country ?? "", packages: profile?.regulation_packages.map((p) => p.package_id) ?? [] },
    },
    "ogrenme.applicability.decide"
  );
}

export function applicabilityOf(s: Store, code: string): { effective: ApplicabilityResult; current: ApplicabilityRow | null; history: ApplicabilityRow[]; note: string; stale: boolean } {
  const src = sourceByCode(code);
  const history = s.session.tenant_id ? s.rows<ApplicabilityRow>(MOD, "applicability").filter((r) => r.source_code === code).sort((a, b) => (a.decided_at < b.decided_at ? 1 : -1)) : [];
  const current = history[0] ?? null;
  if (!current) {
    const note = src?.family === "TSRS"
      ? "Henüz değerlendirilmedi. TSRS uygulanabilirliği K-08 (KGK kapsam kararı) kaynaktan doğrulanana kadar varsayılan olarak 'inceleme gerekli'dir."
      : "Henüz değerlendirilmedi; doğrulanmamış kural için varsayılan sonuç 'inceleme gerekli'dir (kural 6).";
    return { effective: "review_required", current: null, history, note, stale: false };
  }
  const stale = !!src && current.rule_version !== String(src.checked_at);
  return { effective: current.result, current, history, note: stale ? "Karar, kaynağın önceki kontrol sürümüne bağlı; kaynak yeniden kontrol edildi, kararı gözden geçirin." : "", stale };
}

export function userLabel(id: string): string {
  const u = PREVIEW_USERS.find((x) => x.id === id);
  return u ? `${u.name} · ${ROLE_LABEL[u.role]}` : id;
}

// ---------- Gündem (§09) ----------
export function agendaRelevant(item: AgendaItem, tenant: Tenant | null, profile: Profile | null): { relevant: boolean; reason: string } {
  const r = item.relevance;
  if (r.profile_ids.includes("*")) return { relevant: true, reason: "Tüm kurumlar için geçerli." };
  if (!tenant) return { relevant: false, reason: "Kurum seçilmedi; ilgi kurum profiliyle belirlenir." };
  if (r.profile_ids.includes(tenant.profile_id)) return { relevant: true, reason: `Kurum profili (${profile?.title.tr ?? tenant.profile_id}) listede.` };
  const pk = profile?.regulation_packages.map((p) => p.package_id) ?? [];
  const hit = r.packages.find((p) => pk.includes(p));
  if (hit) return { relevant: true, reason: `Profil "${hit}" regülasyon paketini aday gösteriyor.` };
  if (item.countries.includes(tenant.country) && r.packages.length === 0 && r.profile_ids.length === 0) return { relevant: true, reason: `Kurum ülkesi (${tenant.country}) kapsamda.` };
  return { relevant: false, reason: "Profiliniz ve ülkeniz bu maddenin ilgi kuralında yok; genel bilgi için gösterilebilir." };
}

export function myAgendaPrefs(s: Store): AgendaPrefRow[] {
  if (!s.session.tenant_id) return [];
  return s.rows<AgendaPrefRow>(MOD, "agenda_prefs").filter((r) => r.user_id === s.user.id);
}

export function prefOf(s: Store, itemId: string): AgendaPrefRow | null {
  return myAgendaPrefs(s).find((r) => r.item_id === itemId) ?? null;
}

/** Takip / sessize al / takvime ekle — kişisel tercih, yerinde güncellenir. */
export function setAgendaPref(s: Store, itemId: string, patch: Partial<Pick<AgendaPrefRow, "follow" | "muted" | "in_calendar">>): AgendaPrefRow {
  s.require("ogrenme.agenda.follow");
  if (!agendaItems().some((i) => i.id === itemId)) throw new StoreError("AGENDA_ITEM_NOT_FOUND", `Gündem maddesi yok: ${itemId}`, 404);
  const cur = prefOf(s, itemId);
  if (cur) return s.update<AgendaPrefRow>(MOD, "agenda_prefs", cur.id, patch, "tercih");
  return s.insert<AgendaPrefRow>(MOD, "agenda_prefs", { user_id: s.user.id, item_id: itemId, follow: false, muted: false, in_calendar: false, ...patch }, "ogrenme.agenda_prefs.set");
}

/** Yürürlükteki maddeden görev. Taslak/istişare asla görev üretmez (§09, §19). Aynı madde için açık görev varsa onu döner. */
export function agendaToTask(s: Store, itemOrId: AgendaItem | string): Task {
  s.require("ogrenme.agenda.task");
  const item = typeof itemOrId === "string" ? agendaItems().find((i) => i.id === itemOrId) : itemOrId;
  if (!item) throw new StoreError("AGENDA_ITEM_NOT_FOUND", "Gündem maddesi yok.", 404);
  if (item.status !== "yururlukte") {
    throw new StoreError("AGENDA_DRAFT_NO_TASK", `"${item.title}" ${item.status === "taslak" ? "taslak" : "istişare"} durumunda; yürürlükte değil, görev üretemez.`, 409);
  }
  const title = `Gündem: ${item.title}`;
  const existing = s.tasks().find((t) => t.status === "open" && t.title === title);
  if (existing) return existing;
  return s.createTask({
    title,
    detail: `${item.suggested_action} Kaynak: ${item.source_url} (son kontrol: ${item.last_checked ?? "doğrulanmadı"}).`,
    kind: "expert_decision",
    related_record_id: null,
    requirement_ids: ["§09", "SRC-07"],
  });
}

// ---------- Takvim (§09): kurum içi teslim ≠ yasal son tarih; geçmiş tarih yaklaşan gibi gösterilmez ----------
export function calendarEntries(s: Store, today: string, opts: { includeMuted?: boolean } = {}): { upcoming: CalendarEntry[]; past: CalendarEntry[] } {
  const entries: CalendarEntry[] = [];
  const tenant = s.tenant;
  const profile = tenantProfile(tenant);
  if (tenant) {
    for (const p of s.periods()) {
      entries.push({ id: `per-end-${p.id}`, kind: "internal", date: p.end, title: "Dönem kapanış provası", detail: `${p.start} – ${p.end} dönemi için kapanış kontrol listesi; durum: ${p.status}.`, route: "/donem/", past: p.end < today });
      if (p.locked_at) {
        const d = p.locked_at.slice(0, 10);
        entries.push({ id: `per-lock-${p.id}`, kind: "internal", date: d, title: "Dönem kilitlendi", detail: `${p.start} – ${p.end} dönemi kilitlendi.`, route: "/donem/", past: d < today });
      }
    }
  }
  const prefs = myAgendaPrefs(s);
  for (const item of agendaItems()) {
    if (!item.event_or_effective_at) continue;
    const pref = prefs.find((p) => p.item_id === item.id);
    if (pref?.muted && !opts.includeMuted) continue;
    const rel = agendaRelevant(item, tenant, profile).relevant || !!pref?.in_calendar || !!pref?.follow;
    if (!rel) continue;
    entries.push({ id: `ag-${item.id}`, kind: "legal", date: item.event_or_effective_at, title: item.title, detail: `${item.publisher} · ${item.status === "yururlukte" ? "yürürlükte" : item.status}`, route: item.affected_route ?? "/gundem/", past: item.event_or_effective_at < today });
  }
  for (const f of fundingItems()) {
    if (!f.deadline) continue;
    entries.push({ id: `fn-${f.id}`, kind: "funding", date: f.deadline, title: f.title, detail: `${f.program_owner} · son başvuru`, route: "/gundem/", past: f.deadline < today });
  }
  const byDate = (a: CalendarEntry, b: CalendarEntry) => a.date.localeCompare(b.date);
  return { upcoming: entries.filter((e) => !e.past).sort(byDate), past: entries.filter((e) => e.past).sort(byDate).reverse() };
}

export function fundingRelevant(f: FundingItem, tenant: Tenant | null, profile: Profile | null): boolean {
  if (f.relevance.profile_ids.includes("*")) return true;
  if (!tenant) return false;
  if (f.relevance.profile_ids.includes(tenant.profile_id)) return true;
  const pk = profile?.regulation_packages.map((p) => p.package_id) ?? [];
  return f.relevance.packages.some((p) => pk.includes(p));
}

// ---------- Sözlük yardım yolları (§10) ----------
export function helpCannotFind(term: TermFull, profile: Profile | null): { documents: string[]; department: string } {
  return { documents: profile?.example_documents ?? [], department: term.likely_department ?? "Belgeyi düzenleyen birim (muhasebe / tesis bakım)" };
}

export function helpNoDocument(s: Store, termId: string): Task {
  s.require("ogrenme.help.task");
  const t = terms().find((x) => x.id === termId);
  if (!t) throw new StoreError("HELP_TERM_NOT_FOUND", `Terim yok: ${termId}`, 404);
  const title = `Belge eksik: ${t.tr}`;
  const existing = s.tasks().find((x) => x.status === "open" && x.title === title);
  if (existing) return existing;
  return s.createTask({ title, detail: `Kullanıcı "${t.tr}" için gereken belgeye sahip değil. Olası departman: ${t.likely_department ?? "belirsiz"}. İlgili görev: ${t.related_task ?? "—"}.`, kind: "missing_info", related_record_id: null, requirement_ids: ["§10"] });
}

export function helpUnsure(s: Store, termId: string, note: string): Task {
  s.require("ogrenme.help.task");
  const t = terms().find((x) => x.id === termId);
  if (!t) throw new StoreError("HELP_TERM_NOT_FOUND", `Terim yok: ${termId}`, 404);
  const title = `Uzman kontrolü: ${t.tr}`;
  const existing = s.tasks().find((x) => x.status === "open" && x.title === title);
  if (existing) return existing;
  return s.createTask({ title, detail: `Kullanıcı "${t.tr}" konusunda emin değil${note.trim() ? `: ${note.trim()}` : "."} Uzman kontrolü istendi; kaynak: ${t.source}.`, kind: "expert_decision", related_record_id: null, requirement_ids: ["§10"] });
}
