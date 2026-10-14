// Regülasyon uyum paketleri (REG-01…06, §08, §19). Saf fonksiyonlar: (s: Store, …) => …
// Paket içeriği content/regulation-packages (veri). Eşik/tarih koda yazılmaz; doğrulanmamış kural → review_required (kural 6).
// Tablolar: package_state, assessment, monitoring_plan (sürümlü, değişmez), carbon_cost, source_version, change_card, rule_activation.
import { type ModuleRow, Store, StoreError } from "@/lib/store";
import { sha256Hex } from "@/lib/hash";
import { normalizeDecimal } from "./decimal";
import { PACKAGES, packageById, type PackageRule, type PublicationStatus, type RegulationPackage } from "./content";

export const MODULE = "disiliskiler";
export type PackageState = "closed" | "review_required" | "open";
export type AssessmentResult = "applicable" | "not_applicable" | "review_required";

export interface PackageStateRow extends ModuleRow {
  package_id: string;
  state: PackageState;
  assessment_id: string | null;
  decided_by: string | null;
  decided_at: string | null;
  reason: string | null;
  task_ids: string[];
}
export interface RuleVersionUsed {
  id: string;
  source_status: PackageRule["source_status"];
  threshold: PackageRule["threshold"];
  effective_from: string | null;
  activation_id: string | null;
}
export interface AssessmentRow extends ModuleRow {
  package_id: string;
  package_version: string;
  answers: Record<string, string>;
  result: AssessmentResult;
  reasons: string[];
  rule_versions_used: RuleVersionUsed[];
  decided_by: string | null;
  decided_at: string | null;
  decision: PackageState | null;
  decision_reason: string | null;
}
export interface MonitoringEntry {
  source_name: string;
  scope1_category: string;
  tier: string; // kullanıcı metni: izleme kademesi (kaynak doğrulanmadan sabit liste yok)
  method: string;
  note: string;
}
export interface MonitoringPlanRow extends ModuleRow {
  facility_id: string;
  plan_version: number;
  supersedes: string | null;
  entries: MonitoringEntry[];
  note: string;
  mrv_rule_status: PackageRule["source_status"]; // planın dayandığı kılavuz kuralının o anki durumu
}
export interface CarbonCostRow extends ModuleRow {
  period_label: string;
  amount: string; // ondalık dize
  currency: string;
  paid_at: string;
  evidence_name: string;
  evidence_sha256: string;
  note: string;
  recorded_role: string;
}
export interface SourceVersionRow extends ModuleRow {
  package_id: string;
  source_ref: string;
  kind: "text" | "url";
  title: string;
  content_sha256: string;
  content_length: number;
  excerpt: string; // ilk 200 karakter; tam metin saklanmaz (lisans, K-12)
  url: string | null;
  publication_date: string | null;
  effective_date: string | null;
  seen_at: string;
  last_check: string;
  publication_status: PublicationStatus;
}
export interface ChangeCardRow extends ModuleRow {
  package_id: string;
  old_version_id: string | null;
  new_version_id: string;
  changed_clause: string;
  summary: string;
  nature: "kesin" | "yorum";
  affected: { profiles: string[]; forms: string[]; calcs: string[]; lessons: string[] };
  rule_ids: string[];
  rule_values: Record<string, { threshold: { value: string; unit: string } | null; effective_from: string | null }>;
  status: "pending" | "approved" | "rejected";
  approved_by: string | null;
  approved_at: string | null;
  approval_reason: string | null;
}
export interface RuleActivationRow extends ModuleRow {
  package_id: string;
  rule_id: string;
  change_card_id: string;
  source_version_id: string;
  threshold: { value: string; unit: string } | null;
  effective_from: string | null;
  status: "active" | "superseded";
  approved_by: string;
}

// ---------- Paket ve etkin kurallar ----------

export function packages(): RegulationPackage[] {
  return PACKAGES;
}
export function requirePackage(id: string): RegulationPackage {
  const p = packageById(id);
  if (!p) throw new StoreError("NOT_FOUND", `Paket bulunamadı: ${id}`, 404);
  return p;
}
export function activations(s: Store, package_id: string): RuleActivationRow[] {
  return s.rows<RuleActivationRow>(MODULE, "rule_activation").filter((a) => a.package_id === package_id);
}
/** İçerikteki kural + kurumun uzman onaylı etkinleştirmesi (SRC-06). Onay yoksa içerikteki durum geçerli. */
export function effectiveRules(s: Store, package_id: string): (PackageRule & { activation_id: string | null })[] {
  const pkg = requirePackage(package_id);
  const act = activations(s, package_id).filter((a) => a.status === "active");
  return pkg.rules.map((r) => {
    const a = act.find((x) => x.rule_id === r.id);
    if (!a) return { ...r, activation_id: null };
    return { ...r, source_status: "verified", threshold: a.threshold, effective_from: a.effective_from, last_checked: a.created_at.slice(0, 10), activation_id: a.id };
  });
}

// ---------- Uygulanabilirlik (§08) ----------

export function evaluateApplicability(pkg: RegulationPackage, rules: (PackageRule & { activation_id: string | null })[], answers: Record<string, string>): { result: AssessmentResult; reasons: string[]; rules_used: RuleVersionUsed[] } {
  const reasons: string[] = [];
  const rules_used: RuleVersionUsed[] = [];
  let excluded = false;
  let review = false;
  if (pkg.status === "draft") {
    review = true;
    reasons.push("Paket taslak; taslak paket yükümlülük üretmez (§19).");
  }
  for (const q of pkg.applicability_questions) {
    const a = answers[q.id];
    const valid = a !== undefined && q.options.some((o) => o.value === a);
    if (!valid || a === "unknown") {
      review = true;
      reasons.push(`"${q.text.tr}" cevabı yok veya 'bilmiyorum' → inceleme gerekli.`);
      continue;
    }
    if (q.excludes_when.includes(a)) {
      excluded = true;
      reasons.push(`"${q.text.tr}" cevabı paketi dışlıyor (${q.options.find((o) => o.value === a)?.label}).`);
      continue;
    }
    if (q.applies_when.includes(a) && q.rule_ref) {
      const r = rules.find((x) => x.id === q.rule_ref);
      if (!r) {
        review = true;
        reasons.push(`Kural ${q.rule_ref} pakette tanımlı değil → inceleme gerekli.`);
        continue;
      }
      rules_used.push({ id: r.id, source_status: r.source_status, threshold: r.threshold, effective_from: r.effective_from, activation_id: r.activation_id });
      if (r.source_status !== "verified") {
        review = true;
        reasons.push(`Kural "${r.id}" doğrulanmamış (kaynak: ${r.source_ref}; eşik: ${r.threshold ? `${r.threshold.value} ${r.threshold.unit}` : "doğrulanmamış"}) → inceleme gerekli (REG-06).`);
      }
    }
  }
  const result: AssessmentResult = excluded ? "not_applicable" : review ? "review_required" : "applicable";
  if (result === "applicable") reasons.push("Tüm sorular cevaplandı; kullanılan kurallar doğrulanmış.");
  return { result, reasons, rules_used };
}

export function assessments(s: Store, package_id?: string): AssessmentRow[] {
  return s.rows<AssessmentRow>(MODULE, "assessment").filter((a) => !package_id || a.package_id === package_id);
}
export function latestAssessment(s: Store, package_id: string): AssessmentRow | null {
  const list = assessments(s, package_id);
  return list.length ? list[list.length - 1] : null;
}

/** Değerlendirme kaydı: cevaplar, sonuç, kullanılan kural sürümleri. Karar ayrı adımdır (decidePackage). */
export function recordAssessment(s: Store, package_id: string, answers: Record<string, string>): AssessmentRow {
  s.require("disiliskiler.package.assess");
  const pkg = requirePackage(package_id);
  const ev = evaluateApplicability(pkg, effectiveRules(s, package_id), answers);
  return s.insert<AssessmentRow>(MODULE, "assessment", {
    package_id,
    package_version: pkg.version,
    answers,
    result: ev.result,
    reasons: ev.reasons,
    rule_versions_used: ev.rules_used,
    decided_by: null,
    decided_at: null,
    decision: null,
    decision_reason: null,
  });
}

export function packageStates(s: Store): PackageStateRow[] {
  return s.rows<PackageStateRow>(MODULE, "package_state");
}
export function packageState(s: Store, package_id: string): PackageStateRow | null {
  return packageStates(s).find((p) => p.package_id === package_id) ?? null;
}
export function isPackageOpen(s: Store, package_id: string): boolean {
  try {
    return packageState(s, package_id)?.state === "open";
  } catch {
    return false;
  }
}

/** Karar sahibi (K-06/K-07/K-08 rolü; yetki package.decide) paketi açar/kapatır.
 *  Açmak için değerlendirme sonucu "applicable" olmalı; doğrulanmamış kural varsa RULE_UNVERIFIED (kural 6).
 *  Açık paket yükümlülük görevleri üretir; kapalı veya inceleme gerekli hiçbir zaman üretmez; taslak kaynaklı yükümlülük atlanır. */
export function decidePackage(s: Store, assessment_id: string, decision: PackageState, reason: string): PackageStateRow {
  s.require("disiliskiler.package.decide");
  const a = s.row<AssessmentRow>(MODULE, "assessment", assessment_id);
  const pkg = requirePackage(a.package_id);
  if (reason.trim().length < 5) throw new StoreError("VALIDATION", "Karar gerekçesi zorunlu.", 422);
  if (decision === "open") {
    if (pkg.status === "draft") throw new StoreError("RULE_UNVERIFIED", "Taslak paket açılamaz; taslak yükümlülük üretmez.", 409, { package_id: pkg.id });
    if (a.result !== "applicable") {
      throw new StoreError("RULE_UNVERIFIED", `Paket açılamaz: değerlendirme sonucu '${a.result}'. Doğrulanmamış kural veya eksik cevap varken paket açılmaz (REG-06).`, 409, { package_id: pkg.id, result: a.result });
    }
    // Değerlendirmeden sonra kurallar değiştiyse (ör. etkinleştirme geri alındı) yeniden değerlendirme gerekir
    const now = effectiveRules(s, pkg.id);
    for (const u of a.rule_versions_used) {
      const cur = now.find((r) => r.id === u.id);
      if (!cur || cur.source_status !== "verified" || cur.activation_id !== u.activation_id) {
        throw new StoreError("RULE_UNVERIFIED", `Kural "${u.id}" değerlendirmeden sonra değişti; yeniden değerlendirin.`, 409, { rule_id: u.id });
      }
    }
  }
  const nowIso = new Date().toISOString();
  s.update<AssessmentRow>(MODULE, "assessment", a.id, { decided_by: s.user.id, decided_at: nowIso, decision, decision_reason: reason.trim() }, reason.trim());
  const task_ids: string[] = [];
  if (decision === "open") {
    const rules = effectiveRules(s, pkg.id);
    for (const ob of pkg.obligations) {
      const rule = ob.rule_ref ? rules.find((r) => r.id === ob.rule_ref) : null;
      if (rule && (rule.publication_status === "draft" || rule.publication_status === "consultation")) continue; // taslak yayın yükümlülük olamaz (§19)
      const t = s.createTask({
        title: `Yükümlülük (${pkg.title.tr}): ${ob.text.tr}`,
        detail: `Gerekli kanıt: ${ob.evidence.join("; ")}. ${rule ? `Dayanak kural ${rule.id}: ${rule.source_status === "verified" ? "doğrulanmış" : "DOĞRULANMAMIŞ — inceleme gerekli"}${rule.effective_from ? `, yürürlük ${rule.effective_from}` : ""}.` : "Dayanak: paket kapsamı."} Önerilen sorumlu: ${ob.task_role_hint ?? "—"}.`,
        kind: "expert_decision",
        related_record_id: null,
        requirement_ids: ["REG-01", ...pkg.spec_sections.filter((x) => x.startsWith("REG"))],
      });
      task_ids.push(t.id);
    }
  }
  const existing = packageState(s, pkg.id);
  const patch = { package_id: pkg.id, state: decision, assessment_id: a.id, decided_by: s.user.id, decided_at: nowIso, reason: reason.trim(), task_ids };
  const row = existing ? s.update<PackageStateRow>(MODULE, "package_state", existing.id, patch, reason.trim()) : s.insert<PackageStateRow>(MODULE, "package_state", patch);
  s.audit(`disiliskiler.package.${decision}`, "disiliskiler.package_state", row.id, row.version, `${pkg.id}@${pkg.version}; ${task_ids.length} görev`);
  s.commit();
  return row;
}

// ---------- MRV izleme planı (REG-02): tesis başına, sürümlü, değişmez ----------

export function monitoringPlans(s: Store, facility_id?: string): MonitoringPlanRow[] {
  return s.rows<MonitoringPlanRow>(MODULE, "monitoring_plan").filter((p) => !facility_id || p.facility_id === facility_id).sort((a, b) => a.plan_version - b.plan_version);
}
export function addMonitoringPlanVersion(s: Store, facility_id: string, entries: MonitoringEntry[], note: string): MonitoringPlanRow {
  s.require("disiliskiler.mrv.write");
  if (!isPackageOpen(s, "national-ets-mrv")) throw new StoreError("PACKAGE_NOT_OPEN", "İzleme planı yalnız ulusal ETS/MRV paketi açıkken oluşturulur (REG-02).", 409, { package_id: "national-ets-mrv" });
  if (!s.facilities().some((f) => f.id === facility_id)) throw new StoreError("NOT_FOUND", "Tesis bulunamadı.", 404);
  const clean = entries.map((e) => ({ source_name: e.source_name.trim(), scope1_category: e.scope1_category.trim(), tier: e.tier.trim(), method: e.method.trim(), note: e.note.trim() })).filter((e) => e.source_name);
  if (!clean.length) throw new StoreError("VALIDATION", "En az bir Kapsam 1 kaynağı eşlenmeli.", 422);
  const prev = monitoringPlans(s, facility_id);
  const last = prev.length ? prev[prev.length - 1] : null;
  const mrv = effectiveRules(s, "national-ets-mrv").find((r) => r.id === "ets-mrv-guidance");
  return s.insert<MonitoringPlanRow>(MODULE, "monitoring_plan", { facility_id, plan_version: (last?.plan_version ?? 0) + 1, supersedes: last?.id ?? null, entries: clean, note: note.trim(), mrv_rule_status: mrv?.source_status ?? "unverified" });
}

// ---------- Ödenen karbon maliyeti (REG-04) ----------

export function carbonCosts(s: Store): CarbonCostRow[] {
  return s.rows<CarbonCostRow>(MODULE, "carbon_cost");
}
export function addCarbonCost(s: Store, input: { period_label: string; amount: string; currency: string; paid_at: string; evidence_name: string; evidence_sha256: string; note: string }): CarbonCostRow {
  s.require("disiliskiler.carbon_cost.write");
  const amount = normalizeDecimal(input.amount);
  if (amount === null || amount.startsWith("-")) throw new StoreError("VALIDATION", "Tutar okunamadı veya negatif.", 422);
  if (!/^[0-9a-f]{64}$/.test(input.evidence_sha256)) throw new StoreError("VALIDATION", "Kanıt dosyası karması (SHA-256) zorunlu; dosyayı seçin, karma tarayıcıda hesaplanır.", 422);
  if (!input.period_label.trim() || !input.paid_at.trim()) throw new StoreError("VALIDATION", "Dönem ve ödeme tarihi zorunlu.", 422);
  return s.insert<CarbonCostRow>(MODULE, "carbon_cost", { period_label: input.period_label.trim(), amount, currency: input.currency.trim().toUpperCase() || "TRY", paid_at: input.paid_at, evidence_name: input.evidence_name.trim(), evidence_sha256: input.evidence_sha256, note: input.note.trim(), recorded_role: s.role });
}

export interface CarbonCostPack {
  generated_at: string;
  generated_by_role: string;
  tenant: { id: string; name: string };
  package: { id: string; version: string; state: PackageState; decided_at: string | null };
  inventory_periods: { id: string; start: string; end: string; status: string; latest_report: { version: number; manifest_sha256: string } | null }[];
  mrv_plans: { facility_id: string; facility_name: string; plan_version: number; plan_id: string; entries: number; mrv_rule_status: string }[];
  carbon_costs: { id: string; period_label: string; amount: string; currency: string; paid_at: string; evidence_name: string; evidence_sha256: string; recorded_role: string }[];
  rules: { id: string; source_status: string; threshold: PackageRule["threshold"]; effective_from: string | null }[];
  disclaimers_tr: string[];
}
/** Karbon maliyeti kanıt paketi: yalnız ulusal ETS/MRV paketi açıksa. Hiçbir sayı üretmez; mevcut kayıtları toplar. */
export function buildCarbonCostPack(s: Store): CarbonCostPack {
  const st = packageState(s, "national-ets-mrv");
  if (!st || st.state !== "open") throw new StoreError("PACKAGE_NOT_OPEN", "Kanıt paketi yalnız ulusal ETS/MRV paketi açıkken üretilir (REG-04).", 409, { package_id: "national-ets-mrv" });
  const pkg = requirePackage("national-ets-mrv");
  const t = s.tenant!;
  const facs = s.facilities();
  const plans = monitoringPlans(s);
  const latestPerFacility = facs.map((f) => {
    const ps = plans.filter((p) => p.facility_id === f.id);
    return ps.length ? ps[ps.length - 1] : null;
  }).filter((p): p is MonitoringPlanRow => p !== null);
  return {
    generated_at: new Date().toISOString(),
    generated_by_role: s.role,
    tenant: { id: t.id, name: t.name },
    package: { id: pkg.id, version: pkg.version, state: st.state, decided_at: st.decided_at },
    inventory_periods: s.periods().map((p) => {
      const reps = s.reports(p.id);
      const last = reps.length ? reps[reps.length - 1] : null;
      return { id: p.id, start: p.start, end: p.end, status: p.status, latest_report: last ? { version: last.version, manifest_sha256: last.manifest_sha256 } : null };
    }),
    mrv_plans: latestPerFacility.map((p) => ({ facility_id: p.facility_id, facility_name: facs.find((f) => f.id === p.facility_id)?.name ?? p.facility_id, plan_version: p.plan_version, plan_id: p.id, entries: p.entries.length, mrv_rule_status: p.mrv_rule_status })),
    carbon_costs: carbonCosts(s).map((c) => ({ id: c.id, period_label: c.period_label, amount: c.amount, currency: c.currency, paid_at: c.paid_at, evidence_name: c.evidence_name, evidence_sha256: c.evidence_sha256, recorded_role: c.recorded_role })),
    rules: effectiveRules(s, "cbam").filter((r) => r.id === "cbam-paid-price-deduction").map((r) => ({ id: r.id, source_status: r.source_status, threshold: r.threshold, effective_from: r.effective_from })),
    disclaimers_tr: [
      "Bu paket mevcut kayıtların dizinidir; tutar veya emisyon üretmez, mahsup hesabı yapmaz.",
      "Menşe ülkede ödenen karbon fiyatının AB CBAM mahsup kanıt formatı açık karardır (K-07); ihracat müşterisinin istediği biçim doğrulanınca paket şablonu güncellenir.",
      "Kanıt dosyalarının içeriği bu önizlemede saklanmaz; yalnız ad ve SHA-256 karması listelenir.",
    ],
  };
}
export function carbonCostPackMarkdown(p: CarbonCostPack): string {
  const L: string[] = [`# Karbon maliyeti kanıt paketi — ${p.tenant.name}`, "", `Üretim: ${p.generated_at} · rol: ${p.generated_by_role} · paket ${p.package.id}@${p.package.version} (${p.package.state})`, ""];
  L.push("## Envanter dönemleri", "");
  for (const x of p.inventory_periods) L.push(`- ${x.start} → ${x.end} (${x.status})${x.latest_report ? ` · rapor v${x.latest_report.version} · sha256 ${x.latest_report.manifest_sha256}` : " · rapor yok"}`);
  L.push("", "## MRV izleme planı sürümleri", "");
  if (!p.mrv_plans.length) L.push("- İzleme planı yok.");
  for (const x of p.mrv_plans) L.push(`- ${x.facility_name}: v${x.plan_version} (${x.entries} kaynak; kılavuz kuralı ${x.mrv_rule_status})`);
  L.push("", "## Ödenen karbon maliyeti girişleri (finans)", "");
  if (!p.carbon_costs.length) L.push("- Giriş yok.");
  for (const c of p.carbon_costs) L.push(`- ${c.period_label}: ${c.amount} ${c.currency} · ödeme ${c.paid_at} · kanıt ${c.evidence_name} · sha256 ${c.evidence_sha256}`);
  L.push("", "## Dayanak kural", "");
  for (const r of p.rules) L.push(`- ${r.id}: ${r.source_status}${r.effective_from ? `, yürürlük ${r.effective_from}` : ""}`);
  L.push("", "## Sınırlar", "");
  for (const d of p.disclaimers_tr) L.push(`- ${d}`);
  return L.join("\n");
}

// ---------- REG-03: ürün çalışmaları bağlantısı (urun-rapor modülü; savunmacı okuma) ----------
export interface ProductStudyRef {
  id: string;
  title: string;
  version: number;
}
export function productStudies(s: Store): ProductStudyRef[] | null {
  try {
    const rows = s.rows<ModuleRow & { title?: unknown; name?: unknown; product_name?: unknown }>("urun-rapor", "studies");
    if (!rows.length) return null;
    return rows.map((r) => ({ id: r.id, title: String(r.title ?? r.name ?? r.product_name ?? r.id), version: r.version }));
  } catch {
    return null;
  }
}

// ---------- Kaynak izleme (§19 SRC-01…07) ----------
// Statik uygulamada URL çekilemez (SRC-02): kullanıcı metni/URL'yi elle kaydeder, uygulama karmasını alır (SRC-03).

export function sourceVersions(s: Store, package_id?: string): SourceVersionRow[] {
  return s.rows<SourceVersionRow>(MODULE, "source_version").filter((v) => !package_id || v.package_id === package_id);
}
export async function recordSourceVersion(
  s: Store,
  input: { package_id: string; source_ref: string; kind: "text" | "url"; title: string; content: string; publication_date: string | null; effective_date: string | null; publication_status: PublicationStatus },
): Promise<SourceVersionRow> {
  s.require("disiliskiler.source.record");
  requirePackage(input.package_id);
  const content = input.content.trim();
  if (!content) throw new StoreError("VALIDATION", "Kaynak metni veya URL zorunlu.", 422);
  if (input.kind === "url" && !/^https?:\/\//.test(content)) throw new StoreError("VALIDATION", "URL http(s) ile başlamalı.", 422);
  const hash = await sha256Hex(content);
  const now = new Date().toISOString();
  return s.insert<SourceVersionRow>(MODULE, "source_version", {
    package_id: input.package_id,
    source_ref: input.source_ref.trim() || "—",
    kind: input.kind,
    title: input.title.trim() || "(başlıksız)",
    content_sha256: hash,
    content_length: content.length,
    excerpt: content.slice(0, 200),
    url: input.kind === "url" ? content : null,
    publication_date: input.publication_date || null,
    effective_date: input.effective_date || null,
    seen_at: now,
    last_check: now,
    publication_status: input.publication_status,
  });
}
/** Son kontrol tarihini günceller (erişim doğrulandıysa). "Güncel" etiketi süresiz kalmaz (§08). */
export function touchSourceCheck(s: Store, source_version_id: string): SourceVersionRow {
  s.require("disiliskiler.source.record");
  return s.update<SourceVersionRow>(MODULE, "source_version", source_version_id, { last_check: new Date().toISOString() }, "kaynak kontrol edildi");
}

export function changeCards(s: Store, package_id?: string): ChangeCardRow[] {
  return s.rows<ChangeCardRow>(MODULE, "change_card").filter((c) => !package_id || c.package_id === package_id);
}
export function createChangeCard(
  s: Store,
  input: { package_id: string; old_version_id: string | null; new_version_id: string; changed_clause: string; summary: string; nature: "kesin" | "yorum"; affected: ChangeCardRow["affected"]; rule_ids: string[]; rule_values: ChangeCardRow["rule_values"] },
): ChangeCardRow {
  s.require("disiliskiler.source.record");
  const pkg = requirePackage(input.package_id);
  s.row<SourceVersionRow>(MODULE, "source_version", input.new_version_id);
  if (input.old_version_id) s.row<SourceVersionRow>(MODULE, "source_version", input.old_version_id);
  if (!input.changed_clause.trim() || !input.summary.trim()) throw new StoreError("VALIDATION", "Değişen madde ve sade özet zorunlu.", 422);
  for (const rid of input.rule_ids) if (!pkg.rules.some((r) => r.id === rid)) throw new StoreError("VALIDATION", `Kural pakette yok: ${rid}`, 422);
  const rule_values: ChangeCardRow["rule_values"] = {};
  for (const rid of input.rule_ids) {
    const v = input.rule_values[rid] ?? { threshold: null, effective_from: null };
    if (v.threshold) {
      const n = normalizeDecimal(v.threshold.value);
      if (n === null) throw new StoreError("VALIDATION", `Eşik değeri okunamadı (${rid}).`, 422);
      rule_values[rid] = { threshold: { value: n, unit: v.threshold.unit.trim() }, effective_from: v.effective_from || null };
    } else rule_values[rid] = { threshold: null, effective_from: v.effective_from || null };
  }
  return s.insert<ChangeCardRow>(MODULE, "change_card", {
    package_id: input.package_id,
    old_version_id: input.old_version_id,
    new_version_id: input.new_version_id,
    changed_clause: input.changed_clause.trim(),
    summary: input.summary.trim(),
    nature: input.nature,
    affected: input.affected,
    rule_ids: input.rule_ids,
    rule_values,
    status: "pending",
    approved_by: null,
    approved_at: null,
    approval_reason: null,
  });
}
/** SRC-06: uzman onayı. Onaylanınca karttaki kurallar bu kurum için doğrulanmış sayılır; taslak/istişare yayın etkinleştirilemez. SRC-07: ilgili görev. */
export function decideChangeCard(s: Store, card_id: string, decision: "approved" | "rejected", reason: string): ChangeCardRow {
  s.require("disiliskiler.source.approve");
  const c = s.row<ChangeCardRow>(MODULE, "change_card", card_id);
  if (c.status !== "pending") throw new StoreError("INVALID_TRANSITION", "Kart zaten karara bağlanmış.", 409);
  if (reason.trim().length < 5) throw new StoreError("VALIDATION", "Karar gerekçesi zorunlu.", 422);
  const nv = s.row<SourceVersionRow>(MODULE, "source_version", c.new_version_id);
  if (decision === "approved" && (nv.publication_status === "draft" || nv.publication_status === "consultation")) {
    throw new StoreError("RULE_UNVERIFIED", "Taslak veya istişare metnine dayanan kural etkinleştirilemez; taslak yayın yükümlülük olamaz (§19).", 409, { publication_status: nv.publication_status });
  }
  if (decision === "approved" && nv.publication_status === "unknown") {
    throw new StoreError("RULE_UNVERIFIED", "Kaynak sürümünün yayın durumu bilinmiyor; 'yürürlükte' olduğu doğrulanmadan kural etkinleştirilemez.", 409);
  }
  const now = new Date().toISOString();
  const out = s.update<ChangeCardRow>(MODULE, "change_card", c.id, { status: decision, approved_by: s.user.id, approved_at: now, approval_reason: reason.trim() }, reason.trim());
  if (decision === "approved") {
    for (const rid of c.rule_ids) {
      for (const old of activations(s, c.package_id).filter((a) => a.rule_id === rid && a.status === "active")) s.update<RuleActivationRow>(MODULE, "rule_activation", old.id, { status: "superseded" }, `yeni kart ${c.id}`);
      s.insert<RuleActivationRow>(MODULE, "rule_activation", { package_id: c.package_id, rule_id: rid, change_card_id: c.id, source_version_id: c.new_version_id, threshold: c.rule_values[rid]?.threshold ?? null, effective_from: c.rule_values[rid]?.effective_from ?? null, status: "active", approved_by: s.user.id }, "disiliskiler.rule.activate");
    }
    const st = packageState(s, c.package_id);
    if (st && st.state !== "closed") {
      s.createTask({ title: `Kural güncellendi: ${requirePackage(c.package_id).title.tr}`, detail: `${c.summary} (${c.nature}). Etkilenen: profiller ${c.affected.profiles.join(", ") || "—"}; formlar ${c.affected.forms.join(", ") || "—"}; hesaplar ${c.affected.calcs.join(", ") || "—"}; dersler ${c.affected.lessons.join(", ") || "—"}. Uygulanabilirliği yeniden değerlendirin.`, kind: "content", related_record_id: null, requirement_ids: ["SRC-07", "REG-06"] });
    }
  }
  s.audit(`disiliskiler.change_card.${decision}`, "disiliskiler.change_card", c.id, out.version, reason.trim());
  s.commit();
  return out;
}
