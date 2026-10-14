// Hedef kartı, RACI ve memnuniyet toplulaştırması (§22 hedef; v1.1 yönetişim; K-10).
import { contentOf } from "@/lib/content";
import { StoreError, type Store } from "@/lib/store";
import { isDecimal } from "./decimal";
import { MODULE, catalog } from "./indicators";
import type { RaciData, RaciRow, SatisfactionData, SatisfactionRow, TargetData, TargetRow } from "./types";

export const T_TARGETS = "targets";
export const T_RACI = "raci";
export const T_SATISFACTION = "satisfaction";

export const TARGET_STATUS_LABEL: Record<TargetRow["status"], string> = { draft: "Taslak", active: "Etkin", achieved: "Ulaşıldı", missed: "Ulaşılamadı", retired: "Kaldırıldı" };

export type TargetInput = TargetData;

export function targets(s: Store): TargetRow[] {
  return s.rows<TargetRow>(MODULE, T_TARGETS);
}

function validateTarget(s: Store, t: TargetInput): void {
  const miss: string[] = [];
  if (!t.title.trim()) miss.push("başlık");
  if (!t.base_period_id) miss.push("baz dönem");
  if (!/^\d{4}$/.test(t.target_year)) miss.push("hedef yılı");
  if (!isDecimal(t.target_value)) miss.push("hedef değeri (ondalık sayı)");
  if (!t.owner_role.trim() && !t.owner_unit.trim()) miss.push("sorumlu rol/birim");
  if (t.kind === "intensity" && !t.denominator_id) miss.push("yoğunluk paydası");
  if (!isDecimal(t.deviation_tolerance_pct)) miss.push("sapma eşiği (%)");
  for (const m of t.milestones) if (!/^\d{4}$/.test(m.year) || !isDecimal(m.value)) miss.push(`ara hedef ${m.year || "?"}`);
  if (miss.length) throw new StoreError("TARGET_INVALID", `Eksik/hatalı alan: ${miss.join(", ")}.`, 422);
  s.period(t.base_period_id);
  const cat = catalog(s);
  if (!cat.some((i) => i.id === t.indicator_id)) throw new StoreError("INDICATOR_UNKNOWN", `Gösterge tanımsız: ${t.indicator_id}`, 422);
  if (t.denominator_id && !cat.some((i) => i.id === t.denominator_id && i.family === "denominator")) throw new StoreError("INTENSITY_DENOMINATOR_MISSING", `Payda '${t.denominator_id}' kurumun profilinde tanımlı değil.`, 422);
}

export function saveTarget(s: Store, input: TargetInput): TargetRow {
  s.require("performans.target.write");
  validateTarget(s, input);
  return s.insert<TargetRow>(MODULE, T_TARGETS, input);
}

export function updateTarget(s: Store, id: string, patch: Partial<TargetInput>, reason: string, expected_version?: number): TargetRow {
  s.require("performans.target.write");
  const cur = s.row<TargetRow>(MODULE, T_TARGETS, id);
  const merged = { ...cur, ...patch } as TargetInput;
  validateTarget(s, merged);
  if (!reason.trim()) throw new StoreError("VALIDATION", "Değişiklik gerekçesi zorunlu.", 422);
  return s.update<TargetRow>(MODULE, T_TARGETS, id, patch, reason, expected_version);
}

// ---------- RACI ----------
interface RaciContent {
  id: string;
  version: string;
  status: string;
  source: string;
  rows: { process_id: string; process: { tr: string }; responsible: string[]; accountable: string; consulted: string[]; informed: string[]; deliverable: { tr: string }; metric: { tr: string } }[];
}

export function raciDefaults(): { version: string; source: string; rows: RaciData[] } {
  const c = contentOf<RaciContent>("raci")[0];
  if (!c) return { version: "—", source: "—", rows: [] };
  return {
    version: c.version,
    source: c.source,
    rows: c.rows.map((r) => ({ process_id: r.process_id, process: r.process.tr, responsible: r.responsible, accountable: r.accountable, consulted: r.consulted, informed: r.informed, deliverable: r.deliverable.tr, metric: r.metric.tr })),
  };
}

/** Kurumun RACI satırları: kurum satırı varsa o, yoksa içerik varsayılanı (işaretli). */
export function raciRows(s: Store): { row: RaciData & { id?: string; version?: number }; custom: boolean }[] {
  const own = s.rows<RaciRow>(MODULE, T_RACI);
  const byProcess = new Map(own.map((r) => [r.process_id, r]));
  const out: { row: RaciRow | RaciData; custom: boolean }[] = [];
  for (const d of raciDefaults().rows) {
    const o = byProcess.get(d.process_id);
    out.push(o ? { row: o, custom: true } : { row: d, custom: false });
    byProcess.delete(d.process_id);
  }
  for (const o of byProcess.values()) out.push({ row: o, custom: true });
  return out;
}

const PERSON_LIKE = /\b(bey|hanım|bay|bayan)\b/i;

export function saveRaci(s: Store, input: RaciData, reason: string): RaciRow {
  s.require("performans.raci.write");
  const all = [input.accountable, ...input.responsible, ...input.consulted, ...input.informed];
  if (!input.process.trim() || !input.accountable.trim()) throw new StoreError("VALIDATION", "Süreç adı ve hesap veren birim (A) zorunlu.", 422);
  if (all.some((x) => PERSON_LIKE.test(x))) throw new StoreError("PERSONAL_RANKING_FORBIDDEN", "RACI satırına kişi değil birim yazılır (kural 11).", 422);
  const existing = s.rows<RaciRow>(MODULE, T_RACI).find((r) => r.process_id === input.process_id);
  if (existing) return s.update<RaciRow>(MODULE, T_RACI, existing.id, input, reason || "RACI güncellendi");
  return s.insert<RaciRow>(MODULE, T_RACI, input);
}

// ---------- Memnuniyet (K-10: anonim, çeyreklik, birim düzeyi) ----------
export function satisfactionRows(s: Store): SatisfactionRow[] {
  return s.rows<SatisfactionRow>(MODULE, T_SATISFACTION);
}

export function saveSatisfaction(s: Store, input: SatisfactionData): SatisfactionRow {
  s.require("performans.satisfaction.write");
  if (!/^\d{4}-Q[1-4]$/.test(input.quarter)) throw new StoreError("VALIDATION", "Çeyrek biçimi YYYY-Qn olmalı (ör. 2026-Q1).", 422);
  if (!input.unit.trim()) throw new StoreError("VALIDATION", "Birim zorunlu; skor birim düzeyinde toplulaştırılır (K-10).", 422);
  if (!isDecimal(input.score) || !/^\d+$/.test(input.respondents)) throw new StoreError("VALIDATION", "Skor ondalık sayı, katılımcı sayısı tam sayı olmalı.", 422);
  if (input.respondents === "1") throw new StoreError("PERSONAL_RANKING_FORBIDDEN", "Tek katılımcılı skor kişiyi tanımlar; birim toplulaştırması girin (K-09).", 422);
  return s.insert<SatisfactionRow>(MODULE, T_SATISFACTION, input);
}

/** Çeyrek etiketi → tarih aralığı (gösterim/süzme; hesap değil). */
export function quarterRange(q: string): { start: string; end: string } | null {
  const m = q.match(/^(\d{4})-Q([1-4])$/);
  if (!m) return null;
  const y = m[1];
  const n = Number(m[2]);
  const ranges = [
    ["01-01", "03-31"],
    ["04-01", "06-30"],
    ["07-01", "09-30"],
    ["10-01", "12-31"],
  ];
  return { start: `${y}-${ranges[n - 1][0]}`, end: `${y}-${ranges[n - 1][1]}` };
}
