// Senaryo defteri (REG-05, §22, AKS-05, kural 7). Envanterden kesin ayrı defter.
// Tablolar: shadow_price, allocation_scenario, ledger (kredi/giderim/kaçınılan), impact_scenario.
// Değişmezlik: her yazma, envanter tablolarının (kayıt, sürüm, koşu, onay, rapor, dönem, kanıt) parmak izini
// önce/sonra karşılaştırır; değiştiyse geri alır ve SCENARIO_NOT_INVENTORY fırlatır.
import { type Db, type ModuleRow, Store, StoreError } from "@/lib/store";
import { canonicalJson } from "@/lib/hash";
import { cmpDecimal, mulDecimal, normalizeDecimal, subDecimal } from "./decimal";

export const MODULE = "disiliskiler";
const INVENTORY_KEYS = ["records", "versions", "runs", "approvals", "reports", "periods", "reopens", "evidence", "sources", "facilities", "boundaries", "publishedFactorVersions"] as const;
type InvKey = (typeof INVENTORY_KEYS)[number];

export interface ShadowPriceRow extends ModuleRow {
  value: string; // ondalık dize
  currency: string;
  per_unit: "tCO2e";
  effective_from: string;
  set_by_role: string;
  review_cycle: string; // ör. "yıllık" — K-11 açık: kurum kararı bekliyor
  note: string;
  decision_ref: "K-11";
}
export interface AllocationScenarioRow extends ModuleRow {
  label: string;
  facility_id: string | null;
  allowance_qty: string; // kullanıcı girdisi, tCO2e
  expected_emissions_qty: string; // kullanıcı girdisi (senaryo varsayımı), tCO2e
  unit: "tCO2e";
  difference: string; // allowance − expected (tam ondalık)
  outcome: "surplus" | "deficit" | "balanced";
  benchmark_note: string; // benchmark değeri kaynak doğrulanmadan girilmez; serbest not
  note: string;
}
export interface LedgerRow extends ModuleRow {
  kind: "credit" | "removal" | "avoided";
  quantity_tco2e: string;
  vintage: string;
  standard_ref: string;
  evidence_ref: string;
  note: string;
  status: "recorded" | "retired";
}
export interface ImpactScenarioRow extends ModuleRow {
  title: string;
  action_ref: string; // görev kimliği veya serbest metin
  assumed_reduction_tco2e: string;
  shadow_price_id: string | null;
  shadow_value: string | null; // fiyat × azaltım, senaryo tutarı (motor sonucu değil)
  currency: string | null;
  note: string;
}

export function inventoryFingerprint(db: Db): string {
  const pick: Partial<Record<InvKey, unknown>> = {};
  for (const k of INVENTORY_KEYS) pick[k] = db[k];
  return canonicalJson(pick);
}

/** Senaryo yazma kapısı: envanter değişirse geri alır ve hata fırlatır (kural 7 denetimi). */
export function scenarioWrite<T>(s: Store, fn: () => T): T {
  const before = inventoryFingerprint(s.db);
  const snapshot = JSON.parse(before) as Partial<Record<InvKey, unknown>>;
  const out = fn();
  if (inventoryFingerprint(s.db) !== before) {
    for (const k of INVENTORY_KEYS) (s.db as unknown as Record<string, unknown>)[k] = snapshot[k];
    s.commit();
    throw new StoreError("SCENARIO_NOT_INVENTORY", "Senaryo işlemi envanter tablolarını değiştirmeye çalıştı; değişiklik geri alındı.", 500);
  }
  return out;
}

// ---------- Gölge karbon fiyatı (AKS-05, K-11) ----------
export function shadowPrices(s: Store): ShadowPriceRow[] {
  return s.rows<ShadowPriceRow>(MODULE, "shadow_price").slice().sort((a, b) => a.effective_from.localeCompare(b.effective_from) || a.created_at.localeCompare(b.created_at));
}
export function currentShadowPrice(s: Store): ShadowPriceRow | null {
  const list = shadowPrices(s);
  return list.length ? list[list.length - 1] : null;
}
export function addShadowPrice(s: Store, input: { value: string; currency: string; effective_from: string; review_cycle: string; note: string }): ShadowPriceRow {
  s.require("disiliskiler.scenario.write");
  const v = normalizeDecimal(input.value);
  if (v === null || v.startsWith("-")) throw new StoreError("VALIDATION", "Fiyat okunamadı veya negatif.", 422);
  if (!input.effective_from) throw new StoreError("VALIDATION", "Geçerlilik başlangıcı zorunlu.", 422);
  if (!input.currency.trim()) throw new StoreError("VALIDATION", "Para birimi zorunlu.", 422);
  return scenarioWrite(s, () =>
    s.insert<ShadowPriceRow>(MODULE, "shadow_price", { value: v, currency: input.currency.trim().toUpperCase(), per_unit: "tCO2e", effective_from: input.effective_from, set_by_role: s.role, review_cycle: input.review_cycle.trim() || "belirlenmedi", note: input.note.trim(), decision_ref: "K-11" }),
  );
}

// ---------- Tahsis / açık-fazla senaryosu (REG-05) ----------
export function allocationScenarios(s: Store): AllocationScenarioRow[] {
  return s.rows<AllocationScenarioRow>(MODULE, "allocation_scenario");
}
export function addAllocationScenario(s: Store, input: { label: string; facility_id: string | null; allowance_qty: string; expected_emissions_qty: string; benchmark_note: string; note: string }): AllocationScenarioRow {
  s.require("disiliskiler.scenario.write");
  const a = normalizeDecimal(input.allowance_qty);
  const e = normalizeDecimal(input.expected_emissions_qty);
  if (a === null || e === null || a.startsWith("-") || e.startsWith("-")) throw new StoreError("VALIDATION", "Tahsis ve beklenen emisyon miktarları okunabilir, negatif olmayan ondalık olmalı.", 422);
  if (!input.label.trim()) throw new StoreError("VALIDATION", "Senaryo adı zorunlu.", 422);
  if (input.facility_id && !s.facilities().some((f) => f.id === input.facility_id)) throw new StoreError("NOT_FOUND", "Tesis bulunamadı.", 404);
  const diff = subDecimal(a, e);
  const c = cmpDecimal(diff, "0");
  return scenarioWrite(s, () =>
    s.insert<AllocationScenarioRow>(MODULE, "allocation_scenario", { label: input.label.trim(), facility_id: input.facility_id, allowance_qty: a, expected_emissions_qty: e, unit: "tCO2e", difference: diff, outcome: c > 0 ? "surplus" : c < 0 ? "deficit" : "balanced", benchmark_note: input.benchmark_note.trim(), note: input.note.trim() }),
  );
}

// ---------- Kredi / giderim / kaçınılan emisyon defteri (§22) — brüt toplamdan düşülmez ----------
export function ledger(s: Store): LedgerRow[] {
  return s.rows<LedgerRow>(MODULE, "ledger");
}
export function addLedgerEntry(s: Store, input: { kind: LedgerRow["kind"]; quantity_tco2e: string; vintage: string; standard_ref: string; evidence_ref: string; note: string }): LedgerRow {
  s.require("disiliskiler.scenario.write");
  const q = normalizeDecimal(input.quantity_tco2e);
  if (q === null || q.startsWith("-")) throw new StoreError("VALIDATION", "Miktar okunamadı veya negatif.", 422);
  if (!["credit", "removal", "avoided"].includes(input.kind)) throw new StoreError("VALIDATION", "Tür geçersiz.", 422);
  return scenarioWrite(s, () => s.insert<LedgerRow>(MODULE, "ledger", { kind: input.kind, quantity_tco2e: q, vintage: input.vintage.trim(), standard_ref: input.standard_ref.trim(), evidence_ref: input.evidence_ref.trim(), note: input.note.trim(), status: "recorded" }));
}
export function retireLedgerEntry(s: Store, id: string, reason: string): LedgerRow {
  s.require("disiliskiler.scenario.write");
  if (!reason.trim()) throw new StoreError("VALIDATION", "Gerekçe zorunlu.", 422);
  return scenarioWrite(s, () => s.update<LedgerRow>(MODULE, "ledger", id, { status: "retired" }, reason.trim()));
}

// ---------- Etki senaryosu (aksiyona bağlı; AKS-05) ----------
export function impactScenarios(s: Store): ImpactScenarioRow[] {
  return s.rows<ImpactScenarioRow>(MODULE, "impact_scenario");
}
export function addImpactScenario(s: Store, input: { title: string; action_ref: string; assumed_reduction_tco2e: string; shadow_price_id: string | null; note: string }): ImpactScenarioRow {
  s.require("disiliskiler.scenario.write");
  const r = normalizeDecimal(input.assumed_reduction_tco2e);
  if (r === null) throw new StoreError("VALIDATION", "Varsayılan azaltım okunamadı.", 422);
  if (!input.title.trim()) throw new StoreError("VALIDATION", "Senaryo başlığı zorunlu.", 422);
  let shadow_value: string | null = null;
  let currency: string | null = null;
  if (input.shadow_price_id) {
    const p = s.row<ShadowPriceRow>(MODULE, "shadow_price", input.shadow_price_id);
    shadow_value = mulDecimal(p.value, r); // senaryo tutarı: fiyat × varsayılan azaltım; envanter sayısı değil
    currency = p.currency;
  }
  return scenarioWrite(s, () => s.insert<ImpactScenarioRow>(MODULE, "impact_scenario", { title: input.title.trim(), action_ref: input.action_ref.trim(), assumed_reduction_tco2e: r, shadow_price_id: input.shadow_price_id, shadow_value, currency, note: input.note.trim() }));
}
