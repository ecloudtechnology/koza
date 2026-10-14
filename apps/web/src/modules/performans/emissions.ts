// Emisyon değerleri: YALNIZ kayıtlı hesap koşularından okunur (kural 1, K-17).
// Burada hesap yapılmaz; motor sonuçları (total_co2e_kg) manifestteki gibi tam ondalık toplanır.
import { SCOPE_OF_SOURCE, type CalculationRun, type FactorRef } from "@/lib/domain";
import { sumDecimalStrings, type Store } from "@/lib/store";
import { profileById } from "@/lib/content";

export interface ScopeBucket {
  approved_kg: string | null; // onaylı/kilitli kayıtların koşu toplamı
  draft_kg: string | null; // onaylı olmayan (taslak, hesaplandı, incelemede…) kayıtların koşu toplamı
  approved_count: number;
  draft_count: number;
}
export interface PeriodEmissions {
  period_id: string;
  scopes: Record<"1" | "2" | "3", ScopeBucket>;
  excluded: { record_id: string; reason: string }[]; // koşusu yok / engellendi / toplam yok
  scope2_methods: string[]; // kayıtların detail.scope2.method değerleri
  factor_refs: FactorRef[];
  methods: { id: string; version: string }[];
  engine_versions: string[];
  boundaries: string[];
  source_ids: string[];
  activity_by_unit: Record<string, string>; // normalize edilmiş faaliyet miktarı toplamı (birim → toplam)
  scope3_categories_with_records: number[];
  scope3_priority_missing: number[]; // profil önceliğinde olup kaydı olmayan kategoriler
  estimated_count: number;
  record_count: number;
  label_tr: string; // "hesaplanan envanter toplamı" — eksik kategori varsa daima bu ad
}

function bucket(): ScopeBucket {
  return { approved_kg: null, draft_kg: null, approved_count: 0, draft_count: 0 };
}

function scope3Category(detail: Record<string, unknown> | null, sourceType: string): number | null {
  if (sourceType === "purchased_goods") return 1;
  if (!detail) return null;
  const direct = detail["category"];
  if (typeof direct === "number") return direct;
  if (typeof direct === "string" && /^\d+$/.test(direct)) return Number(direct);
  const s3 = detail["scope3"];
  if (s3 && typeof s3 === "object") {
    const c = (s3 as Record<string, unknown>)["category"];
    if (typeof c === "number") return c;
    if (typeof c === "string" && /^\d+$/.test(c)) return Number(c);
  }
  return null;
}

function scope2Method(detail: Record<string, unknown> | null): string | null {
  const s2 = detail?.["scope2"];
  if (s2 && typeof s2 === "object") {
    const m = (s2 as Record<string, unknown>)["method"];
    if (typeof m === "string") return m;
  }
  return null;
}

/** Dönemin emisyon görünümü: onaylı ve taslak ayrı; koşusu olmayan kayıt dışarıda listelenir. */
export function periodEmissions(s: Store, period_id: string): PeriodEmissions {
  const scopes = { "1": bucket(), "2": bucket(), "3": bucket() };
  const sums: Record<string, string[]> = {};
  const push = (k: string, v: string) => (sums[k] ??= []).push(v);
  const excluded: PeriodEmissions["excluded"] = [];
  const s2m = new Set<string>();
  const factors = new Map<string, FactorRef>();
  const methods = new Map<string, { id: string; version: string }>();
  const engines = new Set<string>();
  const boundaries = new Set<string>();
  const sourceIds = new Set<string>();
  const act: Record<string, string[]> = {};
  const cats = new Set<number>();
  let estimated = 0;
  let count = 0;
  const sourceById = new Map(s.sources().map((x) => [x.id, x]));
  for (const r of s.records()) {
    const v = s.current(r.id);
    if (v.period_id !== period_id) continue;
    count += 1;
    const src = sourceById.get(v.source_id);
    const scope = src ? SCOPE_OF_SOURCE[src.source_type] : 0;
    sourceIds.add(v.source_id);
    if (v.data_quality === "estimated") estimated += 1;
    if (scope === 2) {
      const m = scope2Method(v.detail);
      if (m) s2m.add(m);
    }
    if (scope === 3 && src) {
      const c = scope3Category(v.detail, src.source_type);
      if (c !== null) cats.add(c);
    }
    const run: CalculationRun | null = s.latestRun(r.id);
    if (!run) {
      excluded.push({ record_id: r.id, reason: "hesap koşusu yok" });
      continue;
    }
    if (run.result.status === "blocked" || run.result.total_co2e_kg === null) {
      excluded.push({ record_id: r.id, reason: run.result.status === "blocked" ? "hesap engellendi" : "toplam yok (ör. Kapsam 2'de iki yöntem; yöntem seçilmeli)" });
      continue;
    }
    if (scope === 0) {
      excluded.push({ record_id: r.id, reason: "ürün bağlamı / diğer: kurumsal toplama girmez (kural 8)" });
      continue;
    }
    for (const f of run.factor_refs) factors.set(`${f.id}@${f.version}`, f);
    methods.set(`${run.method.id}@${run.method.version}`, run.method);
    engines.add(run.engine_version);
    if (run.result.boundary) boundaries.add(run.result.boundary);
    const na = run.result.normalized_activity;
    if (na) (act[na.unit] ??= []).push(na.quantity);
    const key = String(scope) as "1" | "2" | "3";
    const approved = r.state === "approved" || r.state === "locked";
    push(`${key}:${approved ? "a" : "d"}`, run.result.total_co2e_kg);
    if (approved) scopes[key].approved_count += 1;
    else scopes[key].draft_count += 1;
  }
  for (const key of ["1", "2", "3"] as const) {
    const a = sums[`${key}:a`];
    const d = sums[`${key}:d`];
    scopes[key].approved_kg = a?.length ? sumDecimalStrings(a) : null;
    scopes[key].draft_kg = d?.length ? sumDecimalStrings(d) : null;
  }
  const activity_by_unit: Record<string, string> = {};
  for (const [u, vs] of Object.entries(act)) activity_by_unit[u] = sumDecimalStrings(vs);
  const t = s.tenant;
  const profileIds = new Set<string>();
  if (t) profileIds.add(t.profile_id);
  for (const f of s.facilities()) if (f.profile_id) profileIds.add(f.profile_id);
  const priorities = new Set<number>();
  for (const pid of profileIds) for (const c of profileById(pid)?.scope3_priorities ?? []) priorities.add(c);
  const missing = Array.from(priorities).filter((c) => !cats.has(c)).sort((a, b) => a - b);
  return {
    period_id,
    scopes,
    excluded,
    scope2_methods: Array.from(s2m).sort(),
    factor_refs: Array.from(factors.values()).sort((a, b) => `${a.id}@${a.version}`.localeCompare(`${b.id}@${b.version}`)),
    methods: Array.from(methods.values()),
    engine_versions: Array.from(engines).sort(),
    boundaries: Array.from(boundaries).sort(),
    source_ids: Array.from(sourceIds).sort(),
    activity_by_unit,
    scope3_categories_with_records: Array.from(cats).sort((a, b) => a - b),
    scope3_priority_missing: missing,
    estimated_count: estimated,
    record_count: count,
    label_tr: "Hesaplanan envanter toplamı",
  };
}

/** Onaylı kayıtların kapsam toplamı (kg, ondalık dize) — yalnız gösterim ve oran payı için. */
export function approvedScopeKg(e: PeriodEmissions, scope: "1" | "2" | "3"): string | null {
  return e.scopes[scope].approved_kg;
}

export function approvedTotalKg(e: PeriodEmissions): string | null {
  const parts = (["1", "2", "3"] as const).map((k) => e.scopes[k].approved_kg).filter((x): x is string => x !== null);
  return parts.length ? sumDecimalStrings(parts) : null;
}
