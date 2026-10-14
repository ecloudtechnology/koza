// İki hedefin ölçütleri (AKS-04, v1.1 §6): verimlilik → profil yoğunlukları / gösterge; çalışan memnuniyeti →
// öneri aktarım oranı (birim düzeyi), memnuniyet toplulaştırması. Kişi düzeyinde hiçbir şey döndürülmez (kural 11).
import type { Store } from "@/lib/store";
import { divide, mul } from "./decimal";
import { MODULE, intensity, periodValue, catalog } from "./indicators";
import { T_SATISFACTION, quarterRange } from "./governance";
import type { KaizenRow, MetricSpec, SatisfactionRow } from "./types";

export const T_KAIZEN = "kaizen";

export interface MetricValue {
  label: string;
  unit: string;
  value: string | null;
  note: string;
}

/** Dönem aralığına düşen öneriler (oluşturulma tarihine göre), birim süzgeci isteğe bağlı. */
export function suggestionsInPeriod(s: Store, period_id: string, unit: string | null): KaizenRow[] {
  const p = s.period(period_id);
  return s.rows<KaizenRow>(MODULE, T_KAIZEN).filter((k) => {
    const d = k.created_at.slice(0, 10);
    return d >= p.start && d <= p.end && (!unit || k.unit === unit);
  });
}

/** Aksiyona aktarılan öneri oranı (%), birim düzeyi. Öneri yoksa null (sıfır atanmaz). */
export function suggestionRate(s: Store, period_id: string, unit: string | null): MetricValue {
  const all = suggestionsInPeriod(s, period_id, unit);
  const label = `Aksiyona aktarılan öneri oranı${unit ? ` (${unit})` : ""}`;
  if (!all.length) return { label, unit: "%", value: null, note: "Dönemde öneri yok." };
  const transferred = all.filter((k) => k.status === "transferred").length;
  const r = divide(String(transferred), String(all.length), 4);
  return { label, unit: "%", value: r === null ? null : mul(r, "100"), note: `${transferred}/${all.length} öneri` };
}

/** Dönemdeki son çeyreğin birim skoru (ortalama alınmaz; kayıtlı değer gösterilir). */
export function satisfactionScore(s: Store, period_id: string, unit: string): MetricValue {
  const p = s.period(period_id);
  const rows = s
    .rows<SatisfactionRow>(MODULE, T_SATISFACTION)
    .filter((r) => r.unit === unit)
    .filter((r) => {
      const q = quarterRange(r.quarter);
      return q !== null && q.start >= p.start && q.end <= p.end;
    })
    .sort((a, b) => a.quarter.localeCompare(b.quarter));
  const label = `Memnuniyet skoru (${unit})`;
  if (!rows.length) return { label, unit: "skor", value: null, note: "Dönem içinde çeyreklik toplulaştırma yok (K-10)." };
  const last = rows[rows.length - 1];
  return { label, unit: `skor (${last.scale_note || "ölçek belirtilmedi"})`, value: last.score, note: `${last.quarter}, ${last.respondents} katılımcı` };
}

export function metricValue(s: Store, spec: MetricSpec, period_id: string): MetricValue {
  const cat = catalog(s);
  const name = (id: string) => cat.find((i) => i.id === id)?.name.tr ?? id;
  switch (spec.kind) {
    case "intensity": {
      const r = intensity(s, spec.indicator_id, spec.denominator_id, period_id);
      return { label: `${name(spec.indicator_id)} / ${name(spec.denominator_id)}`, unit: r.unit, value: r.value, note: r.status === "ok" ? "" : r.reason };
    }
    case "indicator": {
      const v = periodValue(s, spec.indicator_id, period_id);
      return { label: name(spec.indicator_id), unit: v.unit, value: v.state === "known" ? v.value : null, note: v.state === "known" ? "" : v.note };
    }
    case "suggestion_rate":
      return suggestionRate(s, period_id, spec.unit);
    case "satisfaction":
      return satisfactionScore(s, period_id, spec.unit);
  }
}

export function metricLabel(s: Store, spec: MetricSpec): string {
  const cat = catalog(s);
  const name = (id: string) => cat.find((i) => i.id === id)?.name.tr ?? id;
  switch (spec.kind) {
    case "intensity":
      return `${name(spec.indicator_id)} / ${name(spec.denominator_id)}`;
    case "indicator":
      return name(spec.indicator_id);
    case "suggestion_rate":
      return `Aksiyona aktarılan öneri oranı${spec.unit ? ` (${spec.unit})` : ""}`;
    case "satisfaction":
      return `Memnuniyet skoru (${spec.unit})`;
  }
}
