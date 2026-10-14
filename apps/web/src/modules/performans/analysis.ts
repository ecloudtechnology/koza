// Analiz (§22): mutlak vs yoğunluk, verimlilik iddiası kuralı, fark ayrıştırması, iki hedefin durumu, KPI sapması.
// Emisyonlar kayıtlı koşulardan okunur (emissions.ts); burada yalnız kayıtlı değerler karşılaştırılır.
import type { Store } from "@/lib/store";
import { cmp, pctChange } from "./decimal";
import { periodEmissions, type PeriodEmissions } from "./emissions";
import { catalog, denominators, intensity, periodValue, type IntensityResult, type PeriodValue } from "./indicators";
import { targets } from "./governance";
import { summaryByUnit } from "./kaizen";
import { satisfactionRows } from "./governance";
import type { TargetRow } from "./types";

// ---------- Verimlilik iddiası (v1.1 kabul: çıktı düşerken "verimlilik arttı" denmez) ----------
export type ClaimKind = "suppressed" | "intensity_down" | "intensity_up" | "unchanged" | "insufficient";
export interface EfficiencyClaim {
  kind: ClaimKind;
  text: string;
  abs_change_pct: string | null;
  output_change_pct: string | null;
  intensity_change_pct: string | null;
}

export function efficiencyClaim(absBase: string | null, absCur: string | null, outBase: string | null, outCur: string | null, intBase: string | null, intCur: string | null): EfficiencyClaim {
  const abs = absBase !== null && absCur !== null ? pctChange(absBase, absCur) : null;
  const out = outBase !== null && outCur !== null ? pctChange(outBase, outCur) : null;
  const inten = intBase !== null && intCur !== null ? pctChange(intBase, intCur) : null;
  const base = { abs_change_pct: abs, output_change_pct: out, intensity_change_pct: inten };
  if (absBase === null || absCur === null || outBase === null || outCur === null) {
    return { ...base, kind: "insufficient", text: "İki dönem için mutlak değer ve faaliyet çıktısı birlikte bilinmeden verimlilik yorumu yapılmaz." };
  }
  const absFell = cmp(absCur, absBase) < 0;
  const outFell = cmp(outCur, outBase) < 0;
  if (absFell && outFell) {
    return { ...base, kind: "suppressed", text: "Mutlak değer düştü ama faaliyet çıktısı da düştü; bu düşüş verimlilik iyileşmesi olarak yorumlanmaz. Yoğunluk ve fark ayrıştırmasına bakın." };
  }
  if (inten === null) return { ...base, kind: "insufficient", text: "Yoğunluk iki dönem için hesaplanamadı (payda eksik); verimlilik yorumu yapılmaz." };
  const c = cmp(intCur as string, intBase as string);
  if (c < 0) return { ...base, kind: "intensity_down", text: "Yoğunluk düştü; faaliyet çıktısı düşmedi. Faktör/sınır/yöntem değişimi yoksa birim çıktı başına tüketim azalmıştır (fark ayrıştırmasını kontrol edin)." };
  if (c > 0) return { ...base, kind: "intensity_up", text: "Yoğunluk arttı: birim çıktı başına tüketim yükseldi." };
  return { ...base, kind: "unchanged", text: "Yoğunluk değişmedi." };
}

// ---------- Fark ayrıştırması: faaliyet / faktör / sınır / yöntem (§22) ----------
export interface DecompRow {
  dimension: "faaliyet" | "faktor" | "sinir" | "yontem";
  label: string;
  a: string;
  b: string;
  changed: boolean | null; // null = karşılaştırılamadı
  note: string;
}

export function decomposition(ea: PeriodEmissions, eb: PeriodEmissions): DecompRow[] {
  const rows: DecompRow[] = [];
  const unitsA = Object.keys(ea.activity_by_unit);
  const unitsB = Object.keys(eb.activity_by_unit);
  const allUnits = Array.from(new Set([...unitsA, ...unitsB])).sort();
  if (!allUnits.length) rows.push({ dimension: "faaliyet", label: "Faaliyet miktarı (normalize)", a: "—", b: "—", changed: null, note: "Koşularda normalize miktar yok." });
  for (const u of allUnits) {
    const a = ea.activity_by_unit[u] ?? null;
    const b = eb.activity_by_unit[u] ?? null;
    const ch = a !== null && b !== null ? pctChange(a, b) : null;
    rows.push({ dimension: "faaliyet", label: `Faaliyet miktarı (${u})`, a: a ?? "—", b: b ?? "—", changed: a !== null && b !== null ? cmp(a, b) !== 0 : null, note: ch !== null ? `%${ch}` : "bir dönemde bu birimle kayıt yok" });
  }
  const fa = ea.factor_refs.map((f) => `${f.id}@${f.version}`);
  const fb = eb.factor_refs.map((f) => `${f.id}@${f.version}`);
  rows.push({ dimension: "faktor", label: "Faktör sürümleri", a: fa.join(", ") || "—", b: fb.join(", ") || "—", changed: fa.length && fb.length ? fa.join("|") !== fb.join("|") : null, note: fa.join("|") !== fb.join("|") ? "Faktör sürümü değişti; farkın bir kısmı faktörden gelir (T13)." : "" });
  const sa = ea.source_ids.length;
  const sb = eb.source_ids.length;
  rows.push({ dimension: "sinir", label: "Kayıtlı kaynak sayısı / sınır", a: `${sa} kaynak${ea.boundaries.length ? ` · ${ea.boundaries.join(", ")}` : ""}`, b: `${sb} kaynak${eb.boundaries.length ? ` · ${eb.boundaries.join(", ")}` : ""}`, changed: sa !== sb || ea.boundaries.join("|") !== eb.boundaries.join("|"), note: sa !== sb ? "Kapsanan kaynak sayısı farklı; toplamlar aynı sınırı temsil etmez." : "" });
  const ma = ea.methods.map((m) => `${m.id}@${m.version}`).concat(ea.scope2_methods.map((m) => `Kapsam 2: ${m}`));
  const mb = eb.methods.map((m) => `${m.id}@${m.version}`).concat(eb.scope2_methods.map((m) => `Kapsam 2: ${m}`));
  rows.push({ dimension: "yontem", label: "Yöntem sürümü / Kapsam 2 yöntemi / motor", a: `${ma.join(", ") || "—"} · motor ${ea.engine_versions.join(", ") || "—"}`, b: `${mb.join(", ") || "—"} · motor ${eb.engine_versions.join(", ") || "—"}`, changed: ma.length && mb.length ? ma.join("|") !== mb.join("|") || ea.engine_versions.join("|") !== eb.engine_versions.join("|") : null, note: ma.join("|") !== mb.join("|") ? "Yöntem değişti; dönemler doğrudan karşılaştırılamaz." : "" });
  return rows;
}

// ---------- Dönem karşılaştırması ----------
export interface PeriodCompare {
  a: PeriodEmissions;
  b: PeriodEmissions;
  decomposition: DecompRow[];
  intensities: { denominator_id: string; denominator_name: string; numerator_id: string; numerator_name: string; a: IntensityResult; b: IntensityResult; claim: EfficiencyClaim }[];
}

export function comparePeriods(s: Store, period_a: string, period_b: string, numerator_ids: string[]): PeriodCompare {
  const ea = periodEmissions(s, period_a);
  const eb = periodEmissions(s, period_b);
  const cat = catalog(s);
  const name = (id: string) => cat.find((i) => i.id === id)?.name.tr ?? id;
  const intensities: PeriodCompare["intensities"] = [];
  for (const d of denominators(s)) {
    for (const n of numerator_ids) {
      const ia = intensity(s, n, d.id, period_a);
      const ib = intensity(s, n, d.id, period_b);
      const na = ia.numerator.state === "known" ? ia.numerator.value : null;
      const nb = ib.numerator.state === "known" ? ib.numerator.value : null;
      const da = ia.denominator?.state === "known" ? ia.denominator.value : null;
      const db = ib.denominator?.state === "known" ? ib.denominator.value : null;
      intensities.push({ denominator_id: d.id, denominator_name: d.name.tr, numerator_id: n, numerator_name: name(n), a: ia, b: ib, claim: efficiencyClaim(na, nb, da, db, ia.value, ib.value) });
    }
  }
  return { a: ea, b: eb, decomposition: decomposition(ea, eb), intensities };
}

// ---------- İki hedefin durumu (v1.1 §6) ----------
export interface TwoGoals {
  period_id: string;
  efficiency: { intensities: { label: string; result: IntensityResult }[]; indicators: { label: string; value: PeriodValue }[] };
  satisfaction: { units: ReturnType<typeof summaryByUnit>; total_suggestions: number; total_transferred: number; latest_scores: { unit: string; quarter: string; score: string; scale_note: string; respondents: string }[]; training_per_fte: PeriodValue };
}

export function twoGoals(s: Store, period_id: string): TwoGoals {
  const cat = catalog(s);
  const dens = denominators(s);
  const nums = cat.filter((i) => ["electricity_kwh", "fuels_gj", "scope1_kgco2e", "scope2_kgco2e", "water_withdrawal_m3", "waste_mass_t"].includes(i.id));
  const intensities: TwoGoals["efficiency"]["intensities"] = [];
  for (const d of dens) for (const n of nums) intensities.push({ label: `${n.name.tr} / ${d.name.tr}`, result: intensity(s, n.id, d.id, period_id) });
  const indicators = cat.filter((i) => i.family === "sector" || i.id === "waste_mass_t").map((i) => ({ label: i.name.tr, value: periodValue(s, i.id, period_id) }));
  const units = summaryByUnit(s);
  const latestByUnit = new Map<string, TwoGoals["satisfaction"]["latest_scores"][number]>();
  for (const r of satisfactionRows(s).slice().sort((a, b) => a.quarter.localeCompare(b.quarter))) latestByUnit.set(r.unit, { unit: r.unit, quarter: r.quarter, score: r.score, scale_note: r.scale_note, respondents: r.respondents });
  return {
    period_id,
    efficiency: { intensities, indicators },
    satisfaction: {
      units,
      total_suggestions: units.reduce((n, u) => n + u.received, 0),
      total_transferred: units.reduce((n, u) => n + u.transferred, 0),
      latest_scores: Array.from(latestByUnit.values()),
      training_per_fte: periodValue(s, "training_hours_per_fte", period_id),
    },
  };
}

// ---------- KPI sapması (AKS-01 tetikleyici): hedef değer/ara hedef ile dönem değeri ----------
export interface Deviation {
  target: TargetRow;
  period_id: string;
  current: string | null;
  reference: string; // bu yılın ara hedefi, yoksa hedef değeri
  reference_year: string;
  deviation_pct: string | null; // (current − reference) / reference
  deviates: boolean | null; // null = ölçülemedi
  note: string;
}

export function targetCurrent(s: Store, t: TargetRow, period_id: string): { value: string | null; note: string } {
  if (t.kind === "intensity" && t.denominator_id) {
    const r = intensity(s, t.indicator_id, t.denominator_id, period_id);
    return { value: r.value, note: r.reason };
  }
  const v = periodValue(s, t.indicator_id, period_id);
  return { value: v.state === "known" ? v.value : null, note: v.state === "known" ? "" : v.note };
}

export function detectDeviations(s: Store, period_id: string): Deviation[] {
  const p = s.period(period_id);
  const year = p.end.slice(0, 4);
  return targets(s)
    .filter((t) => t.status === "active")
    .map((t) => {
      const ms = t.milestones.filter((m) => m.year <= year).sort((a, b) => a.year.localeCompare(b.year));
      const ref = ms.length ? ms[ms.length - 1] : { year: t.target_year, value: t.target_value };
      const cur = targetCurrent(s, t, period_id);
      if (cur.value === null) return { target: t, period_id, current: null, reference: ref.value, reference_year: ref.year, deviation_pct: null, deviates: null, note: cur.note };
      const dev = pctChange(ref.value, cur.value);
      let deviates: boolean | null = null;
      if (dev !== null) {
        // azaltım hedefi: değer referansı toleranstan fazla aşıyorsa sapma; artış hedefi: toleranstan fazla altındaysa
        deviates = t.direction === "decrease" ? cmp(dev, t.deviation_tolerance_pct) > 0 : cmp(dev, `-${t.deviation_tolerance_pct}`) < 0;
      }
      return { target: t, period_id, current: cur.value, reference: ref.value, reference_year: ref.year, deviation_pct: dev, deviates, note: dev === null ? "Referans sıfır; sapma yüzdesi tanımsız." : `tolerans ±%${t.deviation_tolerance_pct}` };
    });
}
