// Tedarikçi veri programı (TDR-01…04, §09, §14, §21). Saf fonksiyonlar: (s: Store, …) => …
// Tablolar: supplier, request (sürümlü, değişmez satır), ack, response (sürümlü), questionnaire, corrective_plan.
// Hiçbir fonksiyon e-posta göndermez; dış gönderim kullanıcı eliyle, açık yetkiyle (§09) yapılır.
import { type ModuleRow, Store, StoreError } from "@/lib/store";
import { addDecimal, cmpDecimal, mulDecimal, normalizeDecimal, percentShare } from "./decimal";
import { EXAMPLE_TEMPLATE, REQUEST_TEMPLATE, RISK_RULES, SEGMENTATION, type RiskRulesContent, type TemplateField } from "./content";
import { isPackageOpen } from "./regulation";

export const MODULE = "disiliskiler";
export type IntensityClass = "high" | "medium" | "low" | "unknown";

export interface SupplierRow extends ModuleRow {
  name: string;
  spend_currency: string;
  spend_amount: string | null; // ondalık dize; null = bilinmiyor (sıralamada en sona düşer, sıfır sayılmaz)
  intensity_class: IntensityClass;
  intensity_reason: string;
  product_groups: string[];
  cbam_relevant: boolean | null; // yalnız CBAM paketi açıksa işaretlenebilir; null = değerlendirilmedi
  contact_note: string;
  status: "active" | "archived";
}

export type RequestStatus = "draft" | "authorized" | "answered" | "needs_complement" | "superseded";
export interface RequestRow extends ModuleRow {
  request_group: string; // aynı talebin sürümleri
  request_version: number;
  supersedes: string | null;
  supplier_id: string;
  fields: Record<string, string>; // §14 alanları (REQUEST_TEMPLATE.fields)
  template_version: string;
  confidentiality_version: string;
  parent_request_id: string | null; // tamamlayıcı talep (§14)
  missing_fields: string[]; // tamamlayıcı talepte hangi alanlar eksikti
  status: RequestStatus;
  authorized_by: string | null;
  authorized_at: string | null;
  authorization_reason: string | null;
  exported_at: string | null;
}

export interface AckRow extends ModuleRow {
  request_id: string;
  supplier_id: string;
  confidentiality_version: string;
}

export interface ResponseRow extends ModuleRow {
  request_id: string;
  supplier_id: string;
  response_version: number;
  answers: Record<string, string>;
  missing_fields: string[];
  flags: { code: string; message_tr: string }[];
  complete: boolean;
}

export interface QuestionnaireRow extends ModuleRow {
  supplier_id: string;
  answers: Record<string, string>;
  points: number;
  level: "low" | "medium" | "high";
  rules_version: string;
  trace: string[];
  task_id: string | null;
}

export interface CorrectivePlanRow extends ModuleRow {
  supplier_id: string;
  questionnaire_id: string;
  actions: { text: string; owner: string; due: string }[];
  status: "open" | "done";
}

// ---------- Tedarikçi kaydı ----------

export function suppliers(s: Store): SupplierRow[] {
  return s.rows<SupplierRow>(MODULE, "supplier").filter((x) => x.status !== "archived");
}
export function supplier(s: Store, id: string): SupplierRow {
  return s.row<SupplierRow>(MODULE, "supplier", id);
}

export function intensityClasses() {
  return SEGMENTATION.intensity_classes;
}

export function addSupplier(
  s: Store,
  input: { name: string; spend_currency: string; spend_amount: string; intensity_class: IntensityClass; intensity_reason: string; product_groups: string[]; cbam_relevant: boolean | null; contact_note: string },
): SupplierRow {
  s.require("disiliskiler.supplier.write");
  if (!input.name.trim()) throw new StoreError("VALIDATION", "Tedarikçi adı zorunlu.", 422);
  if (!input.intensity_reason.trim()) throw new StoreError("VALIDATION", "Yoğunluk sınıfı için gerekçe zorunlu (sınıf kullanıcı kararıdır).", 422);
  if (!SEGMENTATION.intensity_classes.some((c) => c.value === input.intensity_class)) throw new StoreError("VALIDATION", "Yoğunluk sınıfı listede yok.", 422);
  const amount = input.spend_amount.trim() ? normalizeDecimal(input.spend_amount) : null;
  if (input.spend_amount.trim() && amount === null) throw new StoreError("VALIDATION", "Harcama tutarı okunamadı; yalnız rakam ve ondalık ayraç girin.", 422);
  if (amount !== null && amount.startsWith("-")) throw new StoreError("VALIDATION", "Harcama negatif olamaz.", 422);
  if (input.cbam_relevant !== null && !isPackageOpen(s, "cbam")) {
    throw new StoreError("PACKAGE_NOT_OPEN", "CBAM ilgisi yalnız CBAM paketi bu kurum için açıkken işaretlenebilir.", 409, { package_id: "cbam" });
  }
  return s.insert<SupplierRow>(MODULE, "supplier", {
    name: input.name.trim(),
    spend_currency: input.spend_currency.trim().toUpperCase() || "TRY",
    spend_amount: amount,
    intensity_class: input.intensity_class,
    intensity_reason: input.intensity_reason.trim(),
    product_groups: input.product_groups.map((g) => g.trim()).filter(Boolean),
    cbam_relevant: input.cbam_relevant,
    contact_note: input.contact_note.trim(),
    status: "active",
  });
}

export function updateSupplier(s: Store, id: string, patch: Partial<SupplierRow>, reason: string, expected_version: number): SupplierRow {
  s.require("disiliskiler.supplier.write");
  if (!reason.trim()) throw new StoreError("VALIDATION", "Değişiklik gerekçesi zorunlu.", 422);
  if (patch.cbam_relevant !== undefined && patch.cbam_relevant !== null && !isPackageOpen(s, "cbam")) {
    throw new StoreError("PACKAGE_NOT_OPEN", "CBAM ilgisi yalnız CBAM paketi açıkken işaretlenebilir.", 409, { package_id: "cbam" });
  }
  if (patch.spend_amount !== undefined && patch.spend_amount !== null) {
    const n = normalizeDecimal(patch.spend_amount);
    if (n === null) throw new StoreError("VALIDATION", "Harcama tutarı okunamadı.", 422);
    patch = { ...patch, spend_amount: n };
  }
  return s.update<SupplierRow>(MODULE, "supplier", id, patch, reason, expected_version);
}

// ---------- Segmentasyon (TDR-01) ----------
// Puan = harcama × yoğunluk ağırlığı (içerikten). Önceliklendirmedir; emisyon hesabı değildir.
export interface SegmentRow {
  supplier: SupplierRow;
  weight: number;
  score: string | null; // null = harcama bilinmiyor
  share_percent: string | null;
  cumulative_percent: string | null;
  rank: number;
  first_wave: boolean;
}
export interface SegmentGroup {
  currency: string;
  total_score: string;
  first_wave_percent: number;
  first_wave_count: number;
  rows: SegmentRow[];
}

export function segmentation(s: Store, list: SupplierRow[] = suppliers(s)): SegmentGroup[] {
  const weights = Object.fromEntries(SEGMENTATION.intensity_classes.map((c) => [c.value, c.weight]));
  const byCurrency = new Map<string, SupplierRow[]>();
  for (const sup of list) byCurrency.set(sup.spend_currency, [...(byCurrency.get(sup.spend_currency) ?? []), sup]);
  const groups: SegmentGroup[] = [];
  for (const currency of Array.from(byCurrency.keys()).sort()) {
    const rows = byCurrency.get(currency)!.map((sup) => {
      const weight = weights[sup.intensity_class] ?? weights.unknown;
      const score = sup.spend_amount === null ? null : mulDecimal(sup.spend_amount, String(weight));
      return { sup, weight, score };
    });
    // Deterministik sıra: puan azalan, eşitlikte kimlik artan; bilinmeyen harcama en sonda (sıfır sayılmaz)
    rows.sort((a, b) => {
      if (a.score === null && b.score === null) return a.sup.id.localeCompare(b.sup.id);
      if (a.score === null) return 1;
      if (b.score === null) return -1;
      const c = cmpDecimal(b.score, a.score);
      return c !== 0 ? c : a.sup.id.localeCompare(b.sup.id);
    });
    const scored = rows.filter((r) => r.score !== null);
    const total = scored.reduce((acc, r) => (acc === "0" ? r.score! : addDecimal(acc, r.score!)), "0");
    const firstWaveCount = scored.length === 0 ? 0 : Math.max(1, Math.ceil((scored.length * SEGMENTATION.first_wave_percent) / 100));
    let cum = "0";
    const out: SegmentRow[] = rows.map((r, i) => {
      const share = r.score === null ? null : percentShare(r.score, total);
      if (r.score !== null) cum = addDecimal(cum, r.score);
      const cumPct = r.score === null ? null : percentShare(cum, total);
      return { supplier: r.sup, weight: r.weight, score: r.score, share_percent: share, cumulative_percent: cumPct, rank: i + 1, first_wave: r.score !== null && i < firstWaveCount };
    });
    groups.push({ currency, total_score: total, first_wave_percent: SEGMENTATION.first_wave_percent, first_wave_count: firstWaveCount, rows: out });
  }
  return groups;
}

// ---------- Standart veri talebi (§14, TDR-02, §09) ----------

export function template() {
  return REQUEST_TEMPLATE;
}
export function exampleTemplate() {
  return EXAMPLE_TEMPLATE;
}

export function requests(s: Store): RequestRow[] {
  return s.rows<RequestRow>(MODULE, "request");
}
export function request(s: Store, id: string): RequestRow {
  return s.row<RequestRow>(MODULE, "request", id);
}
export function requestsOfSupplier(s: Store, supplier_id: string): RequestRow[] {
  return requests(s).filter((r) => r.supplier_id === supplier_id);
}

function validateFields(fields: Record<string, string>, defs: TemplateField[]): string[] {
  return defs.filter((f) => f.required && !(fields[f.id] ?? "").trim()).map((f) => f.id);
}

export function createRequest(s: Store, input: { supplier_id: string; fields: Record<string, string>; parent_request_id?: string | null; missing_fields?: string[] }): RequestRow {
  s.require("disiliskiler.request.write");
  supplier(s, input.supplier_id);
  const missing = validateFields(input.fields, REQUEST_TEMPLATE.fields);
  if (missing.length) throw new StoreError("VALIDATION", `Zorunlu talep alanları eksik: ${missing.map((m) => REQUEST_TEMPLATE.fields.find((f) => f.id === m)?.label ?? m).join(", ")}.`, 422, { missing });
  const group = `rg-${Math.random().toString(16).slice(2, 10)}`;
  return s.insert<RequestRow>(MODULE, "request", {
    request_group: group,
    request_version: 1,
    supersedes: null,
    supplier_id: input.supplier_id,
    fields: Object.fromEntries(Object.entries(input.fields).map(([k, v]) => [k, v.trim()])),
    template_version: REQUEST_TEMPLATE.version,
    confidentiality_version: REQUEST_TEMPLATE.version,
    parent_request_id: input.parent_request_id ?? null,
    missing_fields: input.missing_fields ?? [],
    status: "draft",
    authorized_by: null,
    authorized_at: null,
    authorization_reason: null,
    exported_at: null,
  });
}

/** Yeni sürüm: eski satır değişmez, "superseded" olur; yetki sıfırlanır (muhatap/kapsam yeniden doğrulanır, §21). */
export function reviseRequest(s: Store, request_id: string, fields: Record<string, string>, reason: string): RequestRow {
  s.require("disiliskiler.request.write");
  if (!reason.trim()) throw new StoreError("VALIDATION", "Sürüm gerekçesi zorunlu.", 422);
  const old = request(s, request_id);
  const missing = validateFields(fields, REQUEST_TEMPLATE.fields);
  if (missing.length) throw new StoreError("VALIDATION", "Zorunlu talep alanları eksik.", 422, { missing });
  const nv = s.insert<RequestRow>(MODULE, "request", {
    ...old,
    id: undefined,
    request_version: old.request_version + 1,
    supersedes: old.id,
    fields: Object.fromEntries(Object.entries(fields).map(([k, v]) => [k, v.trim()])),
    status: "draft",
    authorized_by: null,
    authorized_at: null,
    authorization_reason: null,
    exported_at: null,
  } as unknown as Omit<RequestRow, "id" | "tenant_id" | "created_at" | "created_by" | "version"> & { id?: string });
  s.update<RequestRow>(MODULE, "request", old.id, { status: "superseded" }, reason);
  return nv;
}

/** §09: dış kişiye veri talebi açık yetki ister. Yetki denetim izine gerekçeyle yazılır; gönderim yapılmaz. */
export function authorizeRequest(s: Store, request_id: string, reason: string): RequestRow {
  s.require("disiliskiler.request.authorize");
  const r = request(s, request_id);
  if (r.status === "superseded") throw new StoreError("INVALID_TRANSITION", "Eski sürüm yetkilendirilemez; güncel sürümü kullanın.", 409);
  if (reason.trim().length < 10) throw new StoreError("VALIDATION", "Yetki gerekçesi en az 10 karakter olmalı (muhatap, kapsam ve ekler doğrulandı mı?).", 422);
  const now = new Date().toISOString();
  const out = s.update<RequestRow>(MODULE, "request", r.id, { status: "authorized", authorized_by: s.user.id, authorized_at: now, authorization_reason: reason.trim() }, reason.trim());
  s.audit("disiliskiler.request.authorize_external", "disiliskiler.request", r.id, out.version, `Dış gönderim yetkisi: ${reason.trim()}`);
  s.commit();
  return out;
}

/** Talep metni (önizleme her zaman görülebilir; kopyalama/indirme yetki ister). */
export function requestText(s: Store, request_id: string): string {
  const r = request(s, request_id);
  const sup = supplier(s, r.supplier_id);
  const t = s.tenant!;
  const lines: string[] = [];
  lines.push(`# Tedarikçi veri talebi — ${sup.name}`, "", `Talep eden: ${t.name}`, `Talep sürümü: v${r.request_version} · şablon ${r.template_version}`, "");
  lines.push(`## ${REQUEST_TEMPLATE.confidentiality.title}`, "", REQUEST_TEMPLATE.confidentiality.text, "", REQUEST_TEMPLATE.confidentiality.aggregated_use_text, "");
  if (r.parent_request_id) lines.push(`## Tamamlayıcı talep`, "", `Önceki yanıtta eksik alanlar: ${r.missing_fields.map(fieldLabel).join(", ")}`, "");
  lines.push("## İstenen bilgiler", "");
  for (const f of REQUEST_TEMPLATE.fields) {
    const v = r.fields[f.id];
    if (v) lines.push(`- **${f.label}:** ${v}`);
  }
  lines.push("", "## Yanıt alanları", "");
  for (const f of REQUEST_TEMPLATE.response_fields) lines.push(`- ${f.label}${f.required ? " (zorunlu)" : ""}${f.hint ? ` — ${f.hint}` : ""}`);
  lines.push("", "Not: Yalnız toplam şirket emisyonu ürün faktörü olarak kullanılamaz; uygun tahsis bilgisi gerekir (§14).");
  return lines.join("\n");
}
export function fieldLabel(id: string): string {
  return REQUEST_TEMPLATE.fields.find((f) => f.id === id)?.label ?? REQUEST_TEMPLATE.response_fields.find((f) => f.id === id)?.label ?? id;
}

/** Kopyala/indir: yalnız yetkilendirilmiş talep. Dışa verme olayı denetim izine yazılır. */
export function exportRequestText(s: Store, request_id: string): string {
  const r = request(s, request_id);
  if (r.status !== "authorized" && r.status !== "answered" && r.status !== "needs_complement") {
    throw new StoreError("EXTERNAL_SEND_AUTHORIZATION_REQUIRED", "Bu talep metni dış tarafa verilmeden önce yetkili onayı gerekir (§09).", 403, { request_id });
  }
  if (!r.authorized_by) throw new StoreError("EXTERNAL_SEND_AUTHORIZATION_REQUIRED", "Yetki kaydı bulunamadı.", 403, { request_id });
  const text = requestText(s, request_id);
  s.update<RequestRow>(MODULE, "request", r.id, { exported_at: new Date().toISOString() }, "metin dışa verildi (kopyala/indir)");
  s.audit("disiliskiler.request.export", "disiliskiler.request", r.id, null, `yetki: ${r.authorized_by} @ ${r.authorized_at}`);
  s.commit();
  return text;
}

// ---------- Tedarikçi görünümü (kapsam: yalnız kendi talepleri) ----------

/** Tedarikçi yalnız kendisine atanmış ve dış gönderimi yetkilendirilmiş talepleri görür. Kurumun başka verisi dönmez. */
export function supplierRequests(s: Store, supplier_id: string): RequestRow[] {
  return requests(s).filter((r) => r.supplier_id === supplier_id && r.status !== "draft" && r.status !== "superseded");
}
export function supplierRequest(s: Store, supplier_id: string, request_id: string): RequestRow {
  const r = requests(s).find((x) => x.id === request_id);
  if (!r) throw new StoreError("NOT_FOUND", "Talep bulunamadı.", 404);
  if (r.supplier_id !== supplier_id || r.status === "draft" || r.status === "superseded") {
    throw new StoreError("SUPPLIER_SCOPE_VIOLATION", "Bu talep size atanmamış.", 403, { request_id });
  }
  return r;
}
export function acks(s: Store, supplier_id: string): AckRow[] {
  return s.rows<AckRow>(MODULE, "ack").filter((a) => a.supplier_id === supplier_id);
}
export function hasAck(s: Store, supplier_id: string, request_id: string): boolean {
  return acks(s, supplier_id).some((a) => a.request_id === request_id);
}
/** TDR-02: ilk ekran taahhüdü. Onay sürümüyle kaydedilir. */
export function acknowledgeConfidentiality(s: Store, supplier_id: string, request_id: string): AckRow {
  const r = supplierRequest(s, supplier_id, request_id);
  const existing = acks(s, supplier_id).find((a) => a.request_id === request_id);
  if (existing) return existing;
  return s.insert<AckRow>(MODULE, "ack", { request_id: r.id, supplier_id, confidentiality_version: r.confidentiality_version }, "disiliskiler.ack.confidentiality");
}
/** Veri formu kapısı: taahhüt onayı yoksa form açılmaz. */
export function assertFormAccess(s: Store, supplier_id: string, request_id: string): RequestRow {
  const r = supplierRequest(s, supplier_id, request_id);
  if (!hasAck(s, supplier_id, request_id)) {
    throw new StoreError("CONFIDENTIALITY_ACK_REQUIRED", "Gizlilik ve 'yalnız toplulaştırılmış kullanım' taahhüdü onaylanmadan veri formu açılmaz.", 409, { request_id });
  }
  return r;
}

export function responses(s: Store, request_id: string): ResponseRow[] {
  return s.rows<ResponseRow>(MODULE, "response").filter((r) => r.request_id === request_id).sort((a, b) => a.response_version - b.response_version);
}
export function latestResponse(s: Store, request_id: string): ResponseRow | null {
  const rs = responses(s, request_id);
  return rs.length ? rs[rs.length - 1] : null;
}

const COMPANY_TOTAL_VALUES = new Set(["Yalnız şirket toplamı (tahsis yok)", "Şirket toplamından tahsis"]);

/** Yanıt kuralları (§14): eksik → tamamlayıcı talep; şirket toplamı tahsissiz → işaret (reddedilmez). */
export function evaluateResponse(answers: Record<string, string>): { missing: string[]; flags: { code: string; message_tr: string }[] } {
  const missing = validateFields(answers, REQUEST_TEMPLATE.response_fields);
  const flags: { code: string; message_tr: string }[] = [];
  const basis = (answers.basis ?? "").trim();
  const alloc = (answers.allocation_info ?? "").trim();
  if (COMPANY_TOTAL_VALUES.has(basis) && !alloc) {
    flags.push({ code: "COMPANY_TOTAL_WITHOUT_ALLOCATION", message_tr: "Yalnız toplam şirket emisyonu ürün faktörü olarak kullanılamaz; tahsis bilgisi gerekir (§14). Değer ürün faktörü olarak alınmaz; tamamlayıcı talepte tahsis sorulur." });
    if (!missing.includes("allocation_info")) missing.push("allocation_info");
  }
  if (basis === "Bilinmiyor") flags.push({ code: "BASIS_UNKNOWN", message_tr: "Verinin dayanağı bilinmiyor; ürün faktörü olarak kullanılmadan önce açıklama gerekir." });
  const v = (answers.value ?? "").trim();
  if (v && normalizeDecimal(v) === null) {
    flags.push({ code: "VALUE_UNREADABLE", message_tr: "Değer sayı olarak okunamadı; faktör olarak kaydedilmez." });
    if (!missing.includes("value")) missing.push("value");
  }
  return { missing, flags };
}

/** Tedarikçi yanıtı: sürümlü. Eksikse tamamlayıcı talep taslağı oluşur (yeniden yetki ister). */
export function submitResponse(s: Store, supplier_id: string, request_id: string, answers: Record<string, string>): { response: ResponseRow; complement: RequestRow | null } {
  const r = assertFormAccess(s, supplier_id, request_id);
  const prev = responses(s, request_id);
  const { missing, flags } = evaluateResponse(answers);
  const normalized = Object.fromEntries(Object.entries(answers).map(([k, v]) => [k, v.trim()]));
  if (normalized.value && normalizeDecimal(normalized.value)) normalized.value = normalizeDecimal(normalized.value)!;
  const response = s.insert<ResponseRow>(
    MODULE,
    "response",
    { request_id, supplier_id, response_version: prev.length + 1, answers: normalized, missing_fields: missing, flags, complete: missing.length === 0 },
    "disiliskiler.response.submit",
  );
  let complement: RequestRow | null = null;
  if (missing.length) {
    const openComplement = requests(s).find((x) => x.parent_request_id === request_id && x.status !== "superseded" && x.status !== "answered");
    if (!openComplement) {
      const role = s.role;
      // Tamamlayıcı talep kurum adına açılır; tedarikçi simülasyonunda yetki kontrolü kurum rolüyle yapılır.
      try {
        s.require("disiliskiler.request.write");
        complement = createRequest(s, {
          supplier_id,
          fields: { ...r.fields, note: `${r.fields.note ?? ""}\nTamamlayıcı talep: önceki yanıt (v${response.response_version}) şu alanlarda eksikti: ${missing.map(fieldLabel).join(", ")}.`.trim() },
          parent_request_id: request_id,
          missing_fields: missing,
        });
      } catch (e) {
        if (!(e instanceof StoreError && e.code === "FORBIDDEN")) throw e;
        s.createTask({ title: `Tamamlayıcı talep gerekli: ${supplier(s, supplier_id).name}`, detail: `Yanıt eksik (${missing.map(fieldLabel).join(", ")}); tamamlayıcı talebi veri sorumlusu açmalı (rol ${role} açamaz).`, kind: "missing_info", related_record_id: null, requirement_ids: ["§14"] });
      }
    }
    s.update<RequestRow>(MODULE, "request", r.id, { status: "needs_complement" }, "yanıt eksik; tamamlayıcı talep");
  } else {
    s.update<RequestRow>(MODULE, "request", r.id, { status: "answered" }, "yanıt tam");
    if (r.parent_request_id) {
      const parent = requests(s).find((x) => x.id === r.parent_request_id);
      if (parent && parent.status === "needs_complement") s.update<RequestRow>(MODULE, "request", parent.id, { status: "answered" }, "tamamlayıcı yanıt geldi");
    }
  }
  return { response, complement };
}

// ---------- Öz değerlendirme ve risk (TDR-03) ----------

export function riskRules(): RiskRulesContent {
  return RISK_RULES;
}

export function evaluateRisk(answers: Record<string, string>, rules: RiskRulesContent = RISK_RULES): { points: number; level: "low" | "medium" | "high"; trace: string[] } {
  const trace: string[] = [];
  let points = 0;
  for (const q of rules.questions) {
    const a = answers[q.id];
    const opt = q.options.find((o) => o.value === a);
    if (!opt) {
      points += rules.unanswered_points;
      trace.push(`${q.id}: cevapsız → +${rules.unanswered_points} (cevapsız sıfır sayılmaz)`);
    } else {
      points += opt.points;
      trace.push(`${q.id}: "${opt.label}" → +${opt.points}`);
    }
  }
  const outcomes = [...rules.outcomes].sort((a, b) => b.min_points - a.min_points);
  let level = outcomes.find((o) => points >= o.min_points)?.level ?? "high";
  trace.push(`toplam ${points} puan → ${level} (eşikler: ${rules.outcomes.map((o) => `${o.level}≥${o.min_points}`).join(", ")})`);
  for (const ov of rules.overrides) {
    if (answers[ov.question_id] === ov.equals) {
      const order = { low: 0, medium: 1, high: 2 };
      if (order[ov.level] > order[level]) {
        level = ov.level;
        trace.push(`doğrudan kural: ${ov.question_id} = "${ov.equals}" → ${ov.level} (${ov.reason})`);
      }
    }
  }
  return { points, level, trace };
}

export function questionnaires(s: Store, supplier_id: string): QuestionnaireRow[] {
  return s.rows<QuestionnaireRow>(MODULE, "questionnaire").filter((q) => q.supplier_id === supplier_id);
}

/** Yüksek risk → "saha ziyareti" görevi (ceza değil, düzeltici plan + koçluk). */
export function submitQuestionnaire(s: Store, supplier_id: string, answers: Record<string, string>): QuestionnaireRow {
  s.require("disiliskiler.questionnaire.write");
  const sup = supplier(s, supplier_id);
  const { points, level, trace } = evaluateRisk(answers);
  let task_id: string | null = null;
  if (level === "high") {
    const t = s.createTask({
      title: `Saha ziyareti: ${sup.name}`,
      detail: `Öz değerlendirme yüksek risk (${points} puan; kural sürümü ${RISK_RULES.version}). Ceza yerine düzeltici plan ve koçluk; ziyaret öncesi plan taslağı hazırlanır (TDR-03).`,
      kind: "expert_decision",
      related_record_id: null,
      requirement_ids: ["TDR-03"],
    });
    task_id = t.id;
  }
  return s.insert<QuestionnaireRow>(MODULE, "questionnaire", { supplier_id, answers, points, level, rules_version: RISK_RULES.version, trace, task_id }, "disiliskiler.questionnaire.submit");
}

export function correctivePlans(s: Store, supplier_id: string): CorrectivePlanRow[] {
  return s.rows<CorrectivePlanRow>(MODULE, "corrective_plan").filter((p) => p.supplier_id === supplier_id);
}
export function addCorrectivePlan(s: Store, supplier_id: string, questionnaire_id: string, actions: { text: string; owner: string; due: string }[]): CorrectivePlanRow {
  s.require("disiliskiler.supplier.write");
  supplier(s, supplier_id);
  s.row<QuestionnaireRow>(MODULE, "questionnaire", questionnaire_id);
  const clean = actions.map((a) => ({ text: a.text.trim(), owner: a.owner.trim(), due: a.due.trim() })).filter((a) => a.text);
  if (!clean.length) throw new StoreError("VALIDATION", "En az bir düzeltici eylem yazın.", 422);
  return s.insert<CorrectivePlanRow>(MODULE, "corrective_plan", { supplier_id, questionnaire_id, actions: clean, status: "open" });
}
