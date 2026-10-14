// performans modülü tipleri (GÖS, AKS, KZN). Sayılar ondalık DİZE; eksik = null + value_state (kural 2).
import type { ModuleRow } from "@/lib/store";
import type { DataQuality, ValueState } from "@/lib/domain";

// ---- Gösterge sözlüğü (content/indicators + profil) ----
export type IndicatorFamily = "energy" | "emissions" | "water" | "waste" | "ohs" | "people" | "output" | "sector" | "denominator";
export type IndicatorEntry = "manual" | "engine_runs" | "profile_denominator" | "ratio";
export type AccessLevel = "all" | "data_owner" | "restricted";

export interface IndicatorDef {
  id: string;
  name: { tr: string; en?: string };
  family: IndicatorFamily;
  definition: string;
  unit: string;
  source_system: string;
  owner_role: string;
  frequency: "monthly" | "quarterly" | "annual";
  access: AccessLevel;
  entry: IndicatorEntry;
  ratio: { numerator: string; denominator: string } | null;
  quality: { allow_negative: boolean; max: string | null; consistency: { rule: "lte" | "gte"; other: string; message: string }[] };
  dimensions: { id: string; name: { tr: string }; values: { id: string; tr: string }[] }[];
  origin: { kind: "core"; package: string; version: string } | { kind: "profile"; profile_id: string; version: string };
}

export interface IndicatorPackage {
  id: string;
  version: string;
  status: string;
  title: { tr: string };
  note: string;
  indicators: Omit<IndicatorDef, "origin">[];
}

// ---- performans/indicator_values ----
export type ValueStatus = "accepted" | "needs_fix";
export type IndicatorValueData = {
  indicator_id: string;
  period_id: string;
  period_start: string; // değerin kapsadığı aralık; raporlama dönemi içinde olmalı (GÖS-04 zaman)
  period_end: string;
  facility_id: string | null;
  unit: string;
  value: string | null; // ondalık dize; null = bilinmiyor / uygulanamaz
  value_state: ValueState;
  na_reason: string | null; // not_applicable gerekçesi
  data_quality: DataQuality;
  evidence_note: string; // kanıt notu (belge adı, sayaç no…)
  dimensions: Record<string, string>;
  status: ValueStatus;
  findings: string[]; // veri sözleşmesi bulguları (needs_fix)
  supersedes: string | null;
  superseded_by: string | null;
}
export type IndicatorValueRow = ModuleRow & IndicatorValueData;

export interface IndicatorValueInput {
  indicator_id: string;
  period_id: string;
  period_start?: string;
  period_end?: string;
  facility_id?: string | null;
  unit: string;
  value: string | null;
  value_state: ValueState;
  na_reason?: string | null;
  data_quality: DataQuality;
  evidence_note?: string;
  dimensions?: Record<string, string>;
}

// ---- performans/targets (§22 hedef kartı) ----
export type TargetStatus = "draft" | "active" | "achieved" | "missed" | "retired";
export type TargetData = {
  title: string;
  kind: "absolute" | "intensity";
  indicator_id: string; // pay (ör. scope1_kgco2e, electricity_kwh)
  denominator_id: string | null; // yoğunlukta "den:<id>" (profil paydası)
  base_period_id: string;
  target_year: string; // YYYY
  target_value: string; // hedef değer (pay birimi veya yoğunluk birimi)
  direction: "decrease" | "increase";
  covered_sources: string[]; // emisyon kaynağı kimlikleri (boş = tüm kaynaklar)
  milestones: { year: string; value: string }[];
  owner_role: string;
  owner_unit: string;
  status: TargetStatus;
  deviation_tolerance_pct: string; // KPI sapması eşiği (kullanıcı tanımlar; kodda eşik yok)
  note: string;
}
export type TargetRow = ModuleRow & TargetData;

// ---- performans/raci ----
export type RaciData = {
  process_id: string;
  process: string;
  responsible: string[];
  accountable: string;
  consulted: string[];
  informed: string[];
  deliverable: string;
  metric: string;
}
export type RaciRow = ModuleRow & RaciData;

// ---- performans/satisfaction (K-10: anonim çeyreklik toplulaştırma, birim düzeyi) ----
export type SatisfactionData = {
  quarter: string; // "2026-Q1"
  unit: string;
  score: string; // ondalık dize
  scale_note: string; // ölçek (ör. 1–5)
  respondents: string; // katılımcı sayısı (toplam; kişi yok)
  method_note: string;
}
export type SatisfactionRow = ModuleRow & SatisfactionData;

// ---- performans/actions (AKS) ----
export type TriggerType = "kpi_deviation" | "investment" | "process_change" | "employee_suggestion" | "regulation";
export type ActionStatus = "started" | "pre_assessed" | "options" | "pilot" | "measured" | "decided" | "completed" | "redesign";
export interface AssessmentField {
  value_state: ValueState;
  note: string;
}
export type AssessmentKey = "energy" | "water" | "carbon" | "waste_scrap" | "ohs" | "ergonomics" | "workload" | "cost";
export interface ActionOption {
  id: string;
  title: string;
  economic: string;
  environmental: string;
  employee: string;
  pilot_owner_role: string;
  pilot_owner_unit: string;
  pilot_duration_days: string;
}
export type MetricSpec =
  | { kind: "intensity"; indicator_id: string; denominator_id: string }
  | { kind: "indicator"; indicator_id: string }
  | { kind: "suggestion_rate"; unit: string | null }
  | { kind: "satisfaction"; unit: string };
export interface GoalThreshold {
  metric: MetricSpec;
  direction: "decrease" | "increase";
  min_change_pct: string; // kullanıcı tanımlı eşik
}
export interface InvestmentImpact {
  value_state: ValueState;
  value: string | null;
  unit: string | null; // tCO2e | kgCO2e | kWh | GJ
  note: string;
}
export type ActionData = {
  title: string;
  trigger_type: TriggerType;
  trigger_ref: string | null; // hedef / öneri kimliği
  trigger_note: string;
  status: ActionStatus;
  pre_assessment: Record<AssessmentKey, AssessmentField>;
  options: ActionOption[];
  chosen_option_id: string | null;
  thresholds: { efficiency: GoalThreshold | null; satisfaction: GoalThreshold | null };
  baseline_period_id: string | null;
  pilot_period_id: string | null;
  investment_impact: InvestmentImpact | null; // AKS-05 (yalnız investment tetikleyicisinde zorunlu)
  root_cause: string | null;
  closed_at: string | null;
  closed_by: string | null;
}
export type ActionRow = ModuleRow & ActionData;

// performans/action_effects (değişmez: yeni satır)
export interface EffectMetric {
  goal: "efficiency" | "satisfaction";
  label: string;
  unit: string;
  baseline: string | null;
  pilot: string | null;
  change_pct: string | null;
  met: boolean | null; // null = ölçülemedi
  note: string;
}
export type ActionEffectData = {
  action_id: string;
  baseline_period_id: string;
  pilot_period_id: string;
  metrics: EffectMetric[];
  goal1_met: boolean;
  goal2_met: boolean;
  decision: "standardize" | "redesign";
  note: string;
}
export type ActionEffectRow = ModuleRow & ActionEffectData;

// ---- performans/kaizen (KZN) ----
export type KaizenStatus = "received" | "pre_evaluated" | "transferred" | "not_suitable";
export type KaizenData = {
  observed: string;
  proposal: string;
  area: string; // alan / hat / ekipman
  unit: string; // birim (toplulaştırma anahtarı)
  photo: { file_name: string; sha256: string; size_bytes: number } | null;
  author_id: string; // yalnız geri bildirim için; listelenmez (K-09 muhafazakâr tasarım)
  status: KaizenStatus;
  evaluation_note: string | null;
  rejection_reason: string | null;
  action_id: string | null;
}
export type KaizenRow = ModuleRow & KaizenData;

