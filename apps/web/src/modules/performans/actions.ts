// Karar kapısı ve aksiyon motoru (AKS-01…05; forum 7 adım).
// Adımlar: 1 başlat → 2 ön değerlendir → 4 seçenek → 5 pilot → 6 ölç → 7 karar (standardize | yeniden tasarım).
// Aksiyon, ölçülmüş etki satırı olmadan 'tamamlandı' olamaz (v1.1 kabul).
import { StoreError, type ModuleRow, type Store } from "@/lib/store";
import { newId } from "@/lib/hash";
import { cmp, isDecimal, mul, neg, pctChange } from "./decimal";
import { MODULE } from "./indicators";
import { metricValue } from "./metrics";
import type { ActionEffectRow, ActionOption, ActionRow, ActionStatus, AssessmentField, AssessmentKey, EffectMetric, GoalThreshold, InvestmentImpact, TriggerType } from "./types";

export const T_ACTIONS = "actions";
export const T_EFFECTS = "action_effects";

export const TRIGGER_LABEL: Record<TriggerType, string> = {
  kpi_deviation: "KPI sapması",
  investment: "Yeni yatırım",
  process_change: "Süreç / hat değişikliği",
  employee_suggestion: "Çalışan önerisi (Green Kaizen)",
  regulation: "Mevzuat gereği",
};
export const STATUS_LABEL: Record<ActionStatus, string> = {
  started: "1 · Başlatıldı",
  pre_assessed: "2 · Ön değerlendirildi",
  options: "4 · Seçenekler karşılaştırıldı",
  pilot: "5 · Pilot uygulanıyor",
  measured: "6 · Ölçüldü",
  decided: "7 · Standardize edilecek",
  completed: "Tamamlandı",
  redesign: "7 · Kök neden / yeniden tasarım",
};
export const ASSESSMENT_KEYS: { key: AssessmentKey; tr: string }[] = [
  { key: "energy", tr: "Enerji" },
  { key: "water", tr: "Su" },
  { key: "carbon", tr: "Karbon" },
  { key: "waste_scrap", tr: "Atık / fire" },
  { key: "ohs", tr: "İSG" },
  { key: "ergonomics", tr: "Ergonomi" },
  { key: "workload", tr: "İş yükü" },
  { key: "cost", tr: "Maliyet" },
];

export function emptyAssessment(): Record<AssessmentKey, AssessmentField> {
  // AKS-02: bilinmeyen alan "bilinmiyor" kalır; hiçbir alan otomatik doldurulmaz
  const o = {} as Record<AssessmentKey, AssessmentField>;
  for (const k of ASSESSMENT_KEYS) o[k.key] = { value_state: "unknown", note: "" };
  return o;
}

export function actions(s: Store): ActionRow[] {
  return s.rows<ActionRow>(MODULE, T_ACTIONS);
}
export function action(s: Store, id: string): ActionRow {
  return s.row<ActionRow>(MODULE, T_ACTIONS, id);
}
export function effectsOf(s: Store, action_id: string): ActionEffectRow[] {
  return s.rows<ActionEffectRow>(MODULE, T_EFFECTS).filter((e) => e.action_id === action_id);
}

function assertStatus(a: ActionRow, allowed: ActionStatus[], what: string): void {
  if (!allowed.includes(a.status)) throw new StoreError("ACTION_STEP_ORDER", `${what} için aksiyon '${STATUS_LABEL[a.status]}' durumunda olamaz; beklenen: ${allowed.map((x) => STATUS_LABEL[x]).join(" / ")}.`, 409);
}

function validateInvestment(impact: InvestmentImpact | null): void {
  if (!impact) throw new StoreError("INVESTMENT_IMPACT_REQUIRED", "Yatırım talebinde enerji/emisyon etkisi alanı zorunlu (AKS-05).", 422);
  if (impact.value_state === "unknown") throw new StoreError("INVESTMENT_IMPACT_REQUIRED", "Enerji/emisyon etkisi 'bilinmiyor' bırakılarak yatırım talebi açılamaz (AKS-05).", 422);
  if (impact.value_state === "known" && (!isDecimal(impact.value) || !impact.unit)) throw new StoreError("INVESTMENT_IMPACT_REQUIRED", "Etki değeri ondalık sayı ve birimle girilmeli.", 422);
  if (impact.value_state === "not_applicable" && !impact.note.trim()) throw new StoreError("INVESTMENT_IMPACT_REQUIRED", "'Uygulanamaz' seçimi gerekçe ister.", 422);
}

/** Adım 1: tetikleyici ile başlat. */
export function startAction(s: Store, input: { title: string; trigger_type: TriggerType; trigger_ref?: string | null; trigger_note?: string; investment_impact?: InvestmentImpact | null }): ActionRow {
  s.require("performans.action.write");
  if (!input.title.trim()) throw new StoreError("VALIDATION", "Aksiyon başlığı zorunlu.", 422);
  const impact = input.trigger_type === "investment" ? (input.investment_impact ?? null) : null;
  if (input.trigger_type === "investment") validateInvestment(impact);
  return s.insert<ActionRow>(MODULE, T_ACTIONS, {
    title: input.title.trim(),
    trigger_type: input.trigger_type,
    trigger_ref: input.trigger_ref ?? null,
    trigger_note: (input.trigger_note ?? "").trim(),
    status: "started",
    pre_assessment: emptyAssessment(),
    options: [],
    chosen_option_id: null,
    thresholds: { efficiency: null, satisfaction: null },
    baseline_period_id: null,
    pilot_period_id: null,
    investment_impact: impact,
    root_cause: null,
    closed_at: null,
    closed_by: null,
  });
}

/** Adım 2: ön değerlendirme. Bilinmeyen alanlar 'bilinmiyor' kalır; doldurulmaz. */
export function savePreAssessment(s: Store, id: string, pre: Record<AssessmentKey, AssessmentField>): ActionRow {
  s.require("performans.action.write");
  const a = action(s, id);
  assertStatus(a, ["started", "pre_assessed", "redesign"], "Ön değerlendirme");
  for (const k of ASSESSMENT_KEYS) {
    const f = pre[k.key];
    if (!f) throw new StoreError("VALIDATION", `Alan eksik: ${k.tr}`, 422);
    if (f.value_state === "known" && !f.note.trim()) throw new StoreError("VALIDATION", `${k.tr}: 'biliniyor' seçildiyse beklenen etki yazılmalı.`, 422);
  }
  return s.update<ActionRow>(MODULE, T_ACTIONS, id, { pre_assessment: pre, status: a.status === "redesign" ? "redesign" : "pre_assessed" }, "ön değerlendirme");
}

/** Adım 4: seçenekler yan yana (ekonomik, çevresel, çalışan etkisi; pilot sorumlusu rol/birim ve süre). */
export function saveOptions(s: Store, id: string, options: Omit<ActionOption, "id">[], chosen_option_id: string | null): ActionRow {
  s.require("performans.action.write");
  const a = action(s, id);
  assertStatus(a, ["pre_assessed", "options", "redesign"], "Seçenek karşılaştırması");
  if (options.length < 1) throw new StoreError("VALIDATION", "En az bir seçenek gerekir; iki seçenek karşılaştırma için önerilir.", 422);
  const withIds: ActionOption[] = options.map((o, i) => ({ ...o, id: a.options[i]?.id ?? newId("opt") }));
  for (const o of withIds) {
    if (!o.title.trim()) throw new StoreError("VALIDATION", "Seçenek başlığı zorunlu.", 422);
    if (!o.pilot_owner_role.trim() && !o.pilot_owner_unit.trim()) throw new StoreError("VALIDATION", `'${o.title}': pilot sorumlusu rol/birim zorunlu (kişi adı değil).`, 422);
    if (!/^\d+$/.test(o.pilot_duration_days)) throw new StoreError("VALIDATION", `'${o.title}': pilot süresi gün olarak tam sayı olmalı.`, 422);
  }
  if (chosen_option_id && !withIds.some((o) => o.id === chosen_option_id)) throw new StoreError("VALIDATION", "Seçilen seçenek listede yok.", 422);
  return s.update<ActionRow>(MODULE, T_ACTIONS, id, { options: withIds, chosen_option_id, status: "options" }, "seçenekler");
}

/** Eşikler: iki hedef için ölçüt ve en az değişim yüzdesi — kullanıcı tanımlar, kodda eşik yoktur. */
export function saveThresholds(s: Store, id: string, thresholds: { efficiency: GoalThreshold; satisfaction: GoalThreshold }): ActionRow {
  s.require("performans.action.write");
  action(s, id);
  for (const [k, t] of Object.entries(thresholds)) {
    if (!t || !isDecimal(t.min_change_pct) || cmp(t.min_change_pct, "0") < 0) throw new StoreError("GATE_THRESHOLD_MISSING", `${k === "efficiency" ? "Verimlilik" : "Çalışan memnuniyeti"} eşiği (en az değişim %) tanımsız veya negatif.`, 422);
  }
  return s.update<ActionRow>(MODULE, T_ACTIONS, id, { thresholds }, "eşikler");
}

/** Adım 5: pilot — seçenek seçilmiş olmalı; baz ve pilot dönemleri belirlenir. */
export function startPilot(s: Store, id: string, baseline_period_id: string, pilot_period_id: string): ActionRow {
  s.require("performans.action.write");
  const a = action(s, id);
  assertStatus(a, ["options"], "Pilot");
  if (!a.chosen_option_id) throw new StoreError("ACTION_STEP_ORDER", "Pilot için önce bir seçenek seçilmeli.", 409);
  s.period(baseline_period_id);
  s.period(pilot_period_id);
  if (baseline_period_id === pilot_period_id) throw new StoreError("VALIDATION", "Baz dönem ile pilot dönem farklı olmalı.", 422);
  return s.update<ActionRow>(MODULE, T_ACTIONS, id, { baseline_period_id, pilot_period_id, status: "pilot" }, "pilot başladı");
}

function evalGoal(s: Store, goal: EffectMetric["goal"], t: GoalThreshold, base: string, pilot: string): EffectMetric {
  const b = metricValue(s, t.metric, base);
  const p = metricValue(s, t.metric, pilot);
  if (b.value === null || p.value === null) {
    throw new StoreError("EFFECT_DATA_MISSING", `${b.label}: ${b.value === null ? `baz dönem — ${b.note}` : `pilot dönem — ${p.note}`}`, 409);
  }
  const ch = pctChange(b.value, p.value);
  let met: boolean | null = null;
  if (ch !== null) {
    // decrease: değişim ≤ −eşik ; increase: değişim ≥ +eşik
    met = t.direction === "decrease" ? cmp(ch, neg(t.min_change_pct)) <= 0 : cmp(ch, t.min_change_pct) >= 0;
  }
  return { goal, label: b.label, unit: b.unit, baseline: b.value, pilot: p.value, change_pct: ch, met, note: ch === null ? "Baz değer sıfır; yüzde değişim tanımsız, eşik değerlendirilemedi." : `${t.direction === "decrease" ? "azalış" : "artış"} eşiği %${t.min_change_pct}` };
}

/** Adım 6–7: baz dönem ile pilot dönemi kayıtlı değerlerle karşılaştır; iki hedef de eşiği karşılarsa standardize, değilse yeniden tasarım. Etki satırı değişmezdir. */
export function measureEffect(s: Store, id: string, note = ""): ActionEffectRow {
  s.require("performans.action.write");
  const a = action(s, id);
  assertStatus(a, ["pilot", "measured", "redesign"], "Etki ölçümü");
  if (!a.baseline_period_id || !a.pilot_period_id) throw new StoreError("ACTION_STEP_ORDER", "Baz ve pilot dönemi tanımlı değil.", 409);
  if (!a.thresholds.efficiency || !a.thresholds.satisfaction) throw new StoreError("GATE_THRESHOLD_MISSING", "İki hedef için ölçüt ve eşik tanımlanmadan etki ölçülemez.", 422);
  const m1 = evalGoal(s, "efficiency", a.thresholds.efficiency, a.baseline_period_id, a.pilot_period_id);
  const m2 = evalGoal(s, "satisfaction", a.thresholds.satisfaction, a.baseline_period_id, a.pilot_period_id);
  const goal1_met = m1.met === true;
  const goal2_met = m2.met === true;
  const decision = goal1_met && goal2_met ? "standardize" : "redesign";
  const row = s.insert<ActionEffectRow>(MODULE, T_EFFECTS, { action_id: id, baseline_period_id: a.baseline_period_id, pilot_period_id: a.pilot_period_id, metrics: [m1, m2], goal1_met, goal2_met, decision, note: note.trim() });
  s.update<ActionRow>(MODULE, T_ACTIONS, id, { status: decision === "standardize" ? "decided" : "redesign" }, `etki ölçüldü: ${decision}`);
  return row;
}

/** Kök neden yazılır; akış seçenek adımına döner (yeniden tasarım). */
export function recordRootCause(s: Store, id: string, root_cause: string): ActionRow {
  s.require("performans.action.write");
  const a = action(s, id);
  assertStatus(a, ["redesign"], "Kök neden");
  if (root_cause.trim().length < 10) throw new StoreError("VALIDATION", "Kök neden en az 10 karakter.", 422);
  return s.update<ActionRow>(MODULE, T_ACTIONS, id, { root_cause: root_cause.trim(), status: "pre_assessed", chosen_option_id: null, baseline_period_id: null, pilot_period_id: null }, "kök neden; yeniden tasarım");
}

/** Kapatma: yalnız ölçülmüş etki satırı varsa ve son karar 'standardize' ise (v1.1 kabul: etki ölçülmeden kapanmaz). */
export function closeAction(s: Store, id: string): ActionRow {
  s.require("performans.action.close");
  const a = action(s, id);
  const effects = effectsOf(s, id);
  const last = effects.length ? effects[effects.length - 1] : null;
  if (!last) throw new StoreError("ACTION_EFFECT_REQUIRED", "Bu aksiyon için ölçülmüş etki satırı yok; baz–pilot karşılaştırması yapılmadan 'tamamlandı' olamaz.", 409);
  if (last.decision !== "standardize" || a.status !== "decided") throw new StoreError("ACTION_EFFECT_REQUIRED", "Son etki ölçümü iki hedefin eşiğini karşılamadı; kök neden ve yeniden tasarım gerekir.", 409);
  const now = new Date().toISOString();
  return s.update<ActionRow>(MODULE, T_ACTIONS, id, { status: "completed", closed_at: now, closed_by: s.user.id }, "standardize edildi; etki satırı " + last.id);
}

// ---------- AKS-05: gölge karbon fiyatı (senaryo defteri; envantere girmez) ----------
export interface ShadowPrice {
  price: string;
  currency: string;
  per_unit: string; // ör. tCO2e
  source_note: string;
}

/** disiliskiler modülünün senaryo defterinden okunur; tablo yoksa null (K-11 açık). */
export function shadowPrice(s: Store): ShadowPrice | null {
  let rows: ModuleRow[] = [];
  try {
    rows = s.rows<ModuleRow>("disiliskiler", "shadow_price");
  } catch {
    return null;
  }
  const last = rows.length ? rows[rows.length - 1] : null;
  if (!last) return null;
  const price = (last["price"] ?? last["value"]) as unknown;
  if (typeof price !== "string" || !isDecimal(price)) return null;
  return {
    price,
    currency: typeof last["currency"] === "string" ? (last["currency"] as string) : "",
    per_unit: typeof last["per_unit"] === "string" ? (last["per_unit"] as string) : typeof last["unit"] === "string" ? (last["unit"] as string) : "tCO2e",
    source_note: typeof last["note"] === "string" ? (last["note"] as string) : "",
  };
}

/** SENARYO satırı: etki × gölge fiyat. Birimler eşleşmiyorsa çarpılmaz. Envanter toplamına hiçbir zaman girmez (kural 7). */
export function shadowScenarioLine(impact: InvestmentImpact | null, sp: ShadowPrice | null): { status: "ok" | "no_price" | "no_impact" | "unit_mismatch"; amount: string | null; text: string } {
  if (!sp) return { status: "no_price", amount: null, text: "Gölge karbon fiyatı tanımlı değil (K-11)." };
  if (!impact || impact.value_state !== "known" || !impact.value || !impact.unit) return { status: "no_impact", amount: null, text: "Enerji/emisyon etkisi bilinmiyor; senaryo değeri hesaplanmadı." };
  if (impact.unit !== sp.per_unit) return { status: "unit_mismatch", amount: null, text: `Etki birimi (${impact.unit}) gölge fiyat birimiyle (${sp.per_unit}) eşleşmiyor; çarpım yapılmadı.` };
  const amount = mul(impact.value, sp.price);
  return { status: "ok", amount, text: `SENARYO: ${impact.value} ${impact.unit} × ${sp.price} ${sp.currency}/${sp.per_unit} = ${amount} ${sp.currency}. Senaryo defteri değeridir; envantere girmez.` };
}
