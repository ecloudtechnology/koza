// Gösterge sözlüğü ve veri sözleşmesi (GÖS-01…04).
// Çekirdek paket content/indicators'dan, sektöre özgü göstergeler ve paydalar kurumun (ve tesislerin)
// sektör profilinden okunur. Kodda sektör dallanması yoktur (kural 5).
import { contentOf, profileById, type Profile } from "@/lib/content";
import { StoreError, type Store } from "@/lib/store";
import { sumDecimalStrings } from "@/lib/store";
import { cmp, divide, isDecimal } from "./decimal";
import type { IndicatorDef, IndicatorPackage, IndicatorValueInput, IndicatorValueRow } from "./types";
import { periodEmissions } from "./emissions";

export const MODULE = "performans";
export const T_VALUES = "indicator_values";
export const DEN_PREFIX = "den:";

export const FAMILY_LABEL: Record<IndicatorDef["family"], string> = {
  energy: "Enerji",
  emissions: "Emisyon (motor koşuları)",
  water: "Su",
  waste: "Atık",
  ohs: "İş sağlığı ve güvenliği",
  people: "Çalışanlar",
  output: "Faaliyet çıktısı",
  sector: "Sektöre özgü (profil)",
  denominator: "Yoğunluk paydası (profil)",
};
export const ACCESS_LABEL: Record<IndicatorDef["access"], string> = { all: "Tüm roller", data_owner: "Veri sahibi ve üstü", restricted: "Kısıtlı (hassas)" };
export const FREQ_LABEL: Record<IndicatorDef["frequency"], string> = { monthly: "Aylık", quarterly: "Çeyreklik", annual: "Yıllık" };
export const ENTRY_LABEL: Record<IndicatorDef["entry"], string> = { manual: "Elle, dönem başına", engine_runs: "Hesap koşularından", profile_denominator: "Profil paydası olarak", ratio: "Oran (türetilmiş)" };

export function corePackages(): IndicatorPackage[] {
  return contentOf<IndicatorPackage>("indicators");
}

/** Kurumun geçerli profilleri: kurum profili + tesislerin farklı profilleri (SEK-01). */
export function tenantProfiles(s: Store): Profile[] {
  const ids = new Set<string>();
  const t = s.tenant;
  if (t) ids.add(t.profile_id);
  for (const f of s.facilities()) if (f.profile_id) ids.add(f.profile_id);
  return Array.from(ids).map((id) => profileById(id)).filter((p): p is Profile => !!p);
}

/** Gösterge kataloğu: çekirdek paket + profil göstergeleri + profil paydaları ("den:<id>"). */
export function catalog(s: Store): IndicatorDef[] {
  const out: IndicatorDef[] = [];
  for (const pkg of corePackages()) {
    for (const i of pkg.indicators) out.push({ ...i, origin: { kind: "core", package: pkg.id, version: pkg.version } });
  }
  const seen = new Set(out.map((i) => i.id));
  for (const p of tenantProfiles(s)) {
    for (const i of p.indicators) {
      if (seen.has(i.id)) continue;
      seen.add(i.id);
      out.push({
        id: i.id,
        name: i.name,
        family: "sector",
        definition: i.definition,
        unit: i.unit,
        source_system: "Profil tanımı; kaynak sistem kurumca belirlenir",
        owner_role: i.suggested_owner_role,
        frequency: (i.frequency as IndicatorDef["frequency"]) ?? "monthly",
        access: "all",
        entry: "manual",
        ratio: null,
        quality: { allow_negative: false, max: null, consistency: [] },
        dimensions: [],
        origin: { kind: "profile", profile_id: p.id, version: p.version },
      });
    }
    for (const d of p.intensity_denominators) {
      const id = DEN_PREFIX + d.id;
      if (seen.has(id)) continue;
      seen.add(id);
      out.push({
        id,
        name: { tr: d.name.tr },
        family: "denominator",
        definition: `Yoğunluk paydası (profil ${p.id} v${p.version}). Faaliyet çıktısının somut biçimi; aynı dönem için girilmeden yoğunluk hesaplanmaz (GÖS-03).`,
        unit: d.unit,
        source_system: d.source_hint,
        owner_role: "Veri sorumlusu (profil paydası)",
        frequency: "monthly",
        access: "all",
        entry: "manual",
        ratio: null,
        quality: { allow_negative: false, max: null, consistency: [] },
        dimensions: [],
        origin: { kind: "profile", profile_id: p.id, version: p.version },
      });
    }
  }
  return out;
}

export function indicatorDef(s: Store, id: string): IndicatorDef {
  const d = catalog(s).find((i) => i.id === id);
  if (!d) throw new StoreError("INDICATOR_UNKNOWN", `Gösterge tanımsız: ${id}. Çekirdek pakette veya kurumun profilinde yok.`, 422);
  return d;
}

export function denominators(s: Store): IndicatorDef[] {
  return catalog(s).filter((i) => i.family === "denominator");
}

// ---------- Değer satırları ----------

export function allValues(s: Store): IndicatorValueRow[] {
  return s.rows<IndicatorValueRow>(MODULE, T_VALUES);
}
/** Yerine geçilmemiş satırlar (kabul edilen + düzeltme bekleyen). */
export function activeValues(s: Store): IndicatorValueRow[] {
  return allValues(s).filter((r) => !r.superseded_by);
}
export function acceptedValues(s: Store): IndicatorValueRow[] {
  return activeValues(s).filter((r) => r.status === "accepted");
}
/** Düzeltme kuyruğu (GÖS-04). */
export function fixQueue(s: Store): IndicatorValueRow[] {
  return activeValues(s).filter((r) => r.status === "needs_fix");
}

function dimKey(d: Record<string, string>): string {
  return Object.keys(d)
    .sort()
    .map((k) => `${k}=${d[k]}`)
    .join("|");
}

/** Veri sözleşmesi testleri (GÖS-04): kaynak/birim/zaman/aralık/tutarlılık. Bulgu listesi döner; boşsa kabul. */
export function contractFindings(s: Store, def: IndicatorDef, input: Required<Pick<IndicatorValueInput, "indicator_id" | "period_id" | "period_start" | "period_end" | "facility_id" | "unit" | "value" | "value_state" | "data_quality" | "dimensions">>, exclude_id: string | null): string[] {
  const f: string[] = [];
  const p = s.period(input.period_id);
  if (input.unit !== def.unit) f.push(`Birim uyuşmuyor: gösterge birimi '${def.unit}', girilen '${input.unit}'.`);
  if (!(input.period_start <= input.period_end)) f.push("Aralık bitişi başlangıçtan önce.");
  if (input.period_start < p.start || input.period_end > p.end) f.push(`Aralık (${input.period_start} → ${input.period_end}) raporlama dönemi (${p.start} → ${p.end}) dışında.`);
  if (input.facility_id && !s.facilities().some((x) => x.id === input.facility_id)) f.push("Tesis bu kurumda yok.");
  for (const dim of def.dimensions) {
    const v = input.dimensions[dim.id];
    if (!v) f.push(`Kırılım eksik: ${dim.name.tr}.`);
    else if (!dim.values.some((x) => x.id === v)) f.push(`Kırılım değeri tanımsız: ${dim.name.tr} = ${v}.`);
  }
  if (input.value_state === "known") {
    if (!isDecimal(input.value)) f.push("Değer ondalık sayı değil.");
    else {
      if (!def.quality.allow_negative && cmp(input.value, "0") < 0) f.push("Negatif değer; bu gösterge negatif olamaz.");
      if (def.quality.max !== null && cmp(input.value, def.quality.max) > 0) f.push(`Değer sözleşmedeki üst sınırı (${def.quality.max}) aşıyor.`);
      for (const rule of def.quality.consistency) {
        const other = acceptedKnownSum(s, rule.other, input.period_id, input.facility_id);
        if (other === null) continue; // karşılaştırılacak değer yok; bulgu değil
        const c = cmp(input.value, other);
        if ((rule.rule === "lte" && c > 0) || (rule.rule === "gte" && c < 0)) f.push(`${rule.message} (${rule.other} = ${other})`);
      }
    }
  }
  const dup = acceptedValues(s).find((r) => r.id !== exclude_id && r.indicator_id === input.indicator_id && r.period_id === input.period_id && (r.facility_id ?? null) === (input.facility_id ?? null) && dimKey(r.dimensions) === dimKey(input.dimensions));
  if (dup) f.push(`Aynı dönem${input.facility_id ? ", tesis" : ""} ve kırılım için zaten bir satır var (${dup.id.slice(0, 12)}); düzeltme ile yeni sürüm oluşturun.`);
  return f;
}

/** Kabul edilmiş, bilinen değerlerin toplamı (tesis süzgeci isteğe bağlı). Satır yoksa null. */
export function acceptedKnownSum(s: Store, indicator_id: string, period_id: string, facility_id: string | null | undefined): string | null {
  const rows = acceptedValues(s).filter((r) => r.indicator_id === indicator_id && r.period_id === period_id && r.value_state === "known" && r.value !== null && (facility_id === undefined || facility_id === null || r.facility_id === facility_id));
  return rows.length ? sumDecimalStrings(rows.map((r) => r.value as string)) : null;
}

function normalize(s: Store, input: IndicatorValueInput) {
  const p = s.period(input.period_id);
  return {
    indicator_id: input.indicator_id,
    period_id: input.period_id,
    period_start: input.period_start ?? p.start,
    period_end: input.period_end ?? p.end,
    facility_id: input.facility_id ?? null,
    unit: input.unit,
    value: input.value_state === "known" ? input.value : null,
    value_state: input.value_state,
    data_quality: input.data_quality,
    dimensions: input.dimensions ?? {},
  };
}

/**
 * Değer kaydı. Form hataları (değer durumu tutarsızlığı, tanımsız gösterge) hata fırlatır;
 * veri sözleşmesi bulguları satırı 'needs_fix' ile düzeltme kuyruğuna alır (sessiz kabul yok).
 */
export function saveIndicatorValue(s: Store, input: IndicatorValueInput, supersedes: string | null = null): IndicatorValueRow {
  s.require("performans.indicator.write");
  const def = indicatorDef(s, input.indicator_id);
  if (def.entry !== "manual") throw new StoreError("INDICATOR_NOT_ENTERABLE", `'${def.name.tr}' elle girilmez (${ENTRY_LABEL[def.entry]}).`, 422);
  if (input.value_state === "known" && (input.value === null || input.value.trim() === "")) throw new StoreError("VALUE_STATE_MISMATCH", "'Biliniyor' seçildi ama değer boş. Değer yoksa 'bilinmiyor' bırakın; sıfır yazmayın.", 422);
  if (input.value_state !== "known" && input.value !== null && input.value.trim() !== "") throw new StoreError("VALUE_STATE_MISMATCH", "'Bilinmiyor' veya 'uygulanamaz' seçiliyken değer girilemez.", 422);
  if (input.value_state === "not_applicable" && !(input.na_reason ?? "").trim()) throw new StoreError("VALUE_STATE_MISMATCH", "'Uygulanamaz' gerekçe ister.", 422);
  const n = normalize(s, input);
  const findings = contractFindings(s, def, n, supersedes);
  const row = s.insert<IndicatorValueRow>(
    MODULE,
    T_VALUES,
    { ...n, na_reason: input.value_state === "not_applicable" ? (input.na_reason ?? "").trim() : null, evidence_note: (input.evidence_note ?? "").trim(), status: findings.length ? "needs_fix" : "accepted", findings, supersedes, superseded_by: null },
    findings.length ? "performans.indicator_values.needs_fix" : "performans.indicator_values.create"
  );
  return row;
}

/** Düzeltme: eski satır korunur ve 'yerine geçen' işareti alır; yeni satır sözleşme testinden yeniden geçer (kural 9). */
export function fixIndicatorValue(s: Store, id: string, patch: Partial<IndicatorValueInput>): IndicatorValueRow {
  s.require("performans.indicator.write");
  const old = s.row<IndicatorValueRow>(MODULE, T_VALUES, id);
  if (old.superseded_by) throw new StoreError("VERSION_CONFLICT", "Bu satır zaten düzeltildi; güncel sürümü düzenleyin.", 409);
  const input: IndicatorValueInput = {
    indicator_id: old.indicator_id,
    period_id: old.period_id,
    period_start: old.period_start,
    period_end: old.period_end,
    facility_id: old.facility_id,
    unit: old.unit,
    value: old.value,
    value_state: old.value_state,
    na_reason: old.na_reason,
    data_quality: old.data_quality,
    evidence_note: old.evidence_note,
    dimensions: old.dimensions,
    ...patch,
  };
  const row = saveIndicatorValue(s, input, old.id);
  s.update<IndicatorValueRow>(MODULE, T_VALUES, old.id, { superseded_by: row.id }, "düzeltme ile yeni sürüm");
  return row;
}

// ---------- Dönem değeri ve yoğunluk (GÖS-03) ----------

export type PeriodValueState = "known" | "unknown" | "not_applicable" | "missing" | "needs_fix";
export interface PeriodValue {
  indicator_id: string;
  period_id: string;
  state: PeriodValueState;
  value: string | null;
  unit: string;
  quality: "measured" | "estimated" | "mixed" | null;
  rows: number;
  note: string;
}

/** Bir göstergenin dönem değeri: kabul edilmiş aktif satırların toplamı; eksik/bilinmeyen varsa 'known' olmaz. */
export function periodValue(s: Store, indicator_id: string, period_id: string): PeriodValue {
  const def = indicatorDef(s, indicator_id);
  const base = { indicator_id, period_id, unit: def.unit, rows: 0, quality: null as PeriodValue["quality"], value: null as string | null };
  if (def.entry === "engine_runs") {
    const e = periodEmissions(s, period_id);
    const scope = indicator_id === "scope1_kgco2e" ? "1" : indicator_id === "scope2_kgco2e" ? "2" : null;
    if (!scope) return { ...base, state: "missing", note: "Bu emisyon göstergesinin kapsam eşlemesi yok." };
    const b = e.scopes[scope];
    if (b.approved_kg === null) return { ...base, state: "missing", rows: b.draft_count, note: b.draft_count ? `${b.draft_count} kayıt onaylı değil; onaylı toplam yok.` : "Bu dönemde onaylı kayıt yok." };
    return { ...base, state: "known", value: b.approved_kg, rows: b.approved_count, quality: "measured", note: `${b.approved_count} onaylı kayıt; ${b.draft_count} taslak toplamda değil.` };
  }
  if (def.entry === "ratio" && def.ratio) {
    const num = periodValue(s, def.ratio.numerator, period_id);
    const den = periodValue(s, def.ratio.denominator, period_id);
    if (num.state !== "known" || den.state !== "known") return { ...base, state: "missing", note: `Oran için ${num.state !== "known" ? def.ratio.numerator : def.ratio.denominator} bu dönemde bilinmiyor; oran hesaplanmaz (§23).` };
    const v = divide(num.value as string, den.value as string);
    if (v === null) return { ...base, state: "missing", note: "Payda sıfır; oran tanımsız." };
    return { ...base, state: "known", value: v, rows: num.rows + den.rows, quality: num.quality === "estimated" || den.quality === "estimated" ? "estimated" : "measured", note: "İki kayıtlı değerin oranı (6 basamakta kesilir)." };
  }
  if (def.entry === "profile_denominator") return { ...base, state: "missing", note: "Soyut gösterge; değer profil paydası kimliğiyle (den:…) girilir." };
  const rows = activeValues(s).filter((r) => r.indicator_id === indicator_id && r.period_id === period_id);
  if (!rows.length) return { ...base, state: "missing", note: "Bu dönem için değer girilmemiş." };
  if (rows.some((r) => r.status === "needs_fix")) return { ...base, state: "needs_fix", rows: rows.length, note: "Düzeltme kuyruğunda satır var; düzeltilmeden kullanılmaz." };
  if (rows.some((r) => r.value_state === "unknown")) return { ...base, state: "unknown", rows: rows.length, note: "En az bir satır 'bilinmiyor'; dönem değeri bilinmiyor (sıfır atanmaz)." };
  if (rows.every((r) => r.value_state === "not_applicable")) return { ...base, state: "not_applicable", rows: rows.length, note: rows.map((r) => r.na_reason).filter(Boolean).join("; ") };
  const known = rows.filter((r) => r.value_state === "known" && r.value !== null);
  const qs = new Set(known.map((r) => r.data_quality));
  return { ...base, state: "known", value: sumDecimalStrings(known.map((r) => r.value as string)), rows: rows.length, quality: qs.size > 1 ? "mixed" : qs.has("estimated") ? "estimated" : "measured", note: known.length > 1 ? `${known.length} satırın toplamı (tesis/kırılım)` : "" };
}

export interface IntensityResult {
  status: "ok" | "blocked";
  value: string | null;
  unit: string;
  numerator: PeriodValue;
  denominator: PeriodValue | null;
  code: "INTENSITY_DENOMINATOR_MISSING" | "NUMERATOR_MISSING" | "DENOMINATOR_ZERO" | null;
  reason: string;
}

/**
 * Yoğunluk = pay / payda, aynı dönem (GÖS-03). Payda yoksa hesaplanmaz; sıfır atanmaz.
 * Bu bir sunum oranıdır: iki kayıtlı değerin bölümü. Emisyon hesabı değildir (kural 1).
 */
export function intensity(s: Store, numerator_id: string, denominator_id: string, period_id: string): IntensityResult {
  const num = periodValue(s, numerator_id, period_id);
  const denDef = catalog(s).find((i) => i.id === denominator_id);
  const unit = `${num.unit}/${denDef?.unit ?? "?"}`;
  if (!denDef) return { status: "blocked", value: null, unit, numerator: num, denominator: null, code: "INTENSITY_DENOMINATOR_MISSING", reason: `Payda '${denominator_id}' kurumun profilinde tanımlı değil.` };
  const den = periodValue(s, denominator_id, period_id);
  if (den.state !== "known") return { status: "blocked", value: null, unit, numerator: num, denominator: den, code: "INTENSITY_DENOMINATOR_MISSING", reason: `Payda (${denDef.name.tr}) bu dönem için bilinmiyor: ${den.note}` };
  if (num.state !== "known") return { status: "blocked", value: null, unit, numerator: num, denominator: den, code: "NUMERATOR_MISSING", reason: `Pay bu dönem için bilinmiyor: ${num.note}` };
  const v = divide(num.value as string, den.value as string);
  if (v === null) return { status: "blocked", value: null, unit, numerator: num, denominator: den, code: "DENOMINATOR_ZERO", reason: "Payda sıfır; yoğunluk tanımsız." };
  return { status: "ok", value: v, unit, numerator: num, denominator: den, code: null, reason: "" };
}

export function requireIntensity(s: Store, numerator_id: string, denominator_id: string, period_id: string): IntensityResult {
  const r = intensity(s, numerator_id, denominator_id, period_id);
  if (r.status === "blocked") throw new StoreError(r.code === "NUMERATOR_MISSING" ? "EFFECT_DATA_MISSING" : "INTENSITY_DENOMINATOR_MISSING", r.reason, 409);
  return r;
}
