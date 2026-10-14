// İçe aktarma (§11): CSV/XLSX → eşleme → satır doğrulama → taslak kayıt. Sayı üretmez; yalnız okur ve doğrular.
// XLSX için SheetJS cdnjs'ten isteğe bağlı yüklenir; CDN başarısızsa dürüst hata + CSV'ye düşüş.
import type { DataQuality, EmissionSource } from "@/lib/domain";
import type { Store } from "@/lib/store";
import { canonicalJson, sha256Hex } from "@/lib/hash";
import { parseQuantity } from "@/lib/quantity";
import { fieldVisible, setPath, type FieldSpec, type RecordSchema } from "./schemas";
import type { PreparedRow } from "./store";
import { importedRowHashes } from "./store";

export interface Table {
  headers: string[];
  rows: string[][];
}

// ---------- CSV ----------
export function detectDelimiter(text: string): string {
  const first = text.split(/\r?\n/).find((l) => l.trim()) ?? "";
  const counts: [string, number][] = [";", ",", "\t", "|"].map((d) => [d, first.split(d).length - 1]);
  counts.sort((a, b) => b[1] - a[1]);
  return counts[0][1] > 0 ? counts[0][0] : ",";
}
export function parseCsv(text: string, delimiter?: string): Table {
  const src = text.replace(/^﻿/, "");
  const d = delimiter ?? detectDelimiter(src);
  const rows: string[][] = [];
  let cur: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (quoted) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          cell += '"';
          i++;
        } else quoted = false;
      } else cell += ch;
      continue;
    }
    if (ch === '"') quoted = true;
    else if (ch === d) {
      cur.push(cell);
      cell = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && src[i + 1] === "\n") i++;
      cur.push(cell);
      cell = "";
      rows.push(cur);
      cur = [];
    } else cell += ch;
  }
  if (cell !== "" || cur.length) {
    cur.push(cell);
    rows.push(cur);
  }
  const nonEmpty = rows.filter((r) => r.some((c) => c.trim() !== ""));
  if (!nonEmpty.length) return { headers: [], rows: [] };
  const headers = nonEmpty[0].map((h) => h.trim());
  return { headers, rows: nonEmpty.slice(1).map((r) => headers.map((_, i) => (r[i] ?? "").trim())) };
}

// ---------- XLSX (SheetJS, cdnjs, isteğe bağlı) ----------
const XLSX_URL = "https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js";
type SheetJs = { read(data: ArrayBuffer, opts: { type: "array" }): { SheetNames: string[]; Sheets: Record<string, unknown> }; utils: { sheet_to_json(ws: unknown, opts: { header: 1; raw: false; defval: string }): string[][] } };
declare global {
  interface Window {
    XLSX?: SheetJs;
  }
}
export async function loadSheetJs(): Promise<SheetJs> {
  if (typeof window === "undefined") throw new Error("XLSX okuma yalnız tarayıcıda.");
  if (window.XLSX) return window.XLSX;
  await new Promise<void>((resolve, reject) => {
    const s = document.createElement("script");
    s.src = XLSX_URL;
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("XLSX kütüphanesi (SheetJS, cdnjs) yüklenemedi: ağ veya CDN engeli. Dosyayı CSV olarak kaydedip yükleyin."));
    document.head.appendChild(s);
  });
  if (!window.XLSX) throw new Error("XLSX kütüphanesi yüklendi ama kullanılamıyor. CSV ile devam edin.");
  return window.XLSX;
}
export async function parseXlsx(buf: ArrayBuffer): Promise<Table> {
  const x = await loadSheetJs();
  const wb = x.read(buf, { type: "array" });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = x.utils.sheet_to_json(ws, { header: 1, raw: false, defval: "" }).filter((r) => r.some((c) => String(c).trim() !== ""));
  if (!rows.length) return { headers: [], rows: [] };
  const headers = rows[0].map((h) => String(h).trim());
  return { headers, rows: rows.slice(1).map((r) => headers.map((_, i) => String(r[i] ?? "").trim())) };
}

// ---------- Hedef alanlar (eşleme) ----------
export interface Target {
  key: string; // "source" | "period_start" | … | "detail:<path>"
  label: string;
  required: boolean;
  hint: string;
}
export function targetsFor(schema: RecordSchema): Target[] {
  const common: Target[] = [
    { key: "source", label: "Kaynak (ad veya kimlik)", required: true, hint: "Kaynak envanterindeki ad; tesis kaynaktan bulunur." },
    { key: "period_start", label: "Dönem başlangıcı", required: true, hint: "YYYY-AA-GG veya GG.AA.YYYY" },
    { key: "period_end", label: "Dönem bitişi", required: true, hint: "YYYY-AA-GG veya GG.AA.YYYY" },
    { key: "quantity", label: schema.quantity_label, required: false, hint: "Boş = bilinmiyor (görev açılır). '1.234' belirsizse satır hata verir." },
    { key: "unit", label: "Birim", required: false, hint: schema.units.map((u) => u.value).join(", ") },
    { key: "data_quality", label: "Veri niteliği", required: false, hint: "ölçülmüş / tahmini (boş = ölçülmüş)" },
    { key: "invoice_no", label: "Fatura / belge no", required: false, hint: "Mükerrerlik kontrolünde kullanılır" },
    { key: "supplier", label: "Tedarikçi", required: false, hint: "" },
    { key: "note", label: "Not", required: false, hint: "" },
  ];
  const detail: Target[] = schema.fields.filter((f) => f.key !== "heating_value_basis").map((f) => ({ key: `detail:${f.key}`, label: f.label, required: f.required && !f.show_if, hint: f.options ? f.options.map((o) => o.value).join(", ") : f.kind }));
  if (schema.scope === 1 && schema.key !== "refrigerant" && schema.key !== "process") common.push({ key: "heating_value_basis", label: "Isıl değer esası", required: false, hint: "LHV / HHV" });
  return [...common, ...detail];
}
const TR_MAP: Record<string, string> = { ç: "c", ğ: "g", ı: "i", ö: "o", ş: "s", ü: "u", "i̇": "i" };
const norm = (s: string) =>
  s
    .toLocaleLowerCase("tr")
    .replace(/[çğıöşü]/g, (ch) => TR_MAP[ch] ?? ch)
    .replace(/[^a-z0-9]/g, "");
/** Başlık adlarından otomatik eşleme önerisi (yalnız öneri; kullanıcı onaylar). */
export function suggestMapping(headers: string[], targets: Target[]): Record<string, string> {
  const aliases: Record<string, string[]> = {
    source: ["kaynak", "source", "tesis", "ekipman", "sayac"],
    period_start: ["baslangic", "donembaslangici", "start", "periodstart", "ilktarih"],
    period_end: ["bitis", "donembitisi", "end", "periodend", "sontarih"],
    quantity: ["miktar", "tuketim", "quantity", "deger", "value", "adet", "tutar"],
    unit: ["birim", "unit"],
    data_quality: ["nitelik", "verinitelig", "dataquality", "olcum"],
    invoice_no: ["faturano", "faturanumarasi", "belgeno", "invoice", "invoiceno"],
    supplier: ["tedarikci", "supplier", "firma"],
    note: ["not", "aciklama", "note"],
    heating_value_basis: ["esas", "isildegeresasi", "basis"],
  };
  const out: Record<string, string> = {};
  for (const t of targets) {
    const want = [norm(t.label), ...(aliases[t.key] ?? []), norm(t.key.replace("detail:", "").split(".").pop() ?? "")];
    const h = headers.find((h) => want.includes(norm(h)));
    if (h && !Object.values(out).includes(h)) out[t.key] = h;
  }
  return out;
}

// ---------- Satır doğrulama ----------
export function normalizeDate(raw: string): string | null {
  const s = raw.trim();
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (m) return `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`;
  m = s.match(/^(\d{1,2})[./](\d{1,2})[./](\d{4})$/);
  if (m) return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  return null;
}
function parseBool(raw: string): boolean | null {
  const v = norm(raw);
  if (["evet", "true", "1", "e", "yes"].includes(v)) return true;
  if (["hayir", "false", "0", "h", "no"].includes(v)) return false;
  return null;
}
function fieldValue(spec: FieldSpec, raw: string): { value: unknown; error: string | null } {
  if (raw === "") return { value: null, error: null };
  switch (spec.kind) {
    case "decimal": {
      const q = parseQuantity(raw, null);
      if (q.ambiguous) return { value: null, error: `${spec.label}: '${raw}' belirsiz (binlik mi ondalık mı?)` };
      if (q.error) return { value: null, error: `${spec.label}: ${q.error}` };
      return { value: q.value, error: null };
    }
    case "integer":
    case "year":
      return /^\d+$/.test(raw) ? { value: raw, error: null } : { value: null, error: `${spec.label}: tam sayı bekleniyor ('${raw}')` };
    case "date": {
      const d = normalizeDate(raw);
      return d ? { value: d, error: null } : { value: null, error: `${spec.label}: tarih okunamadı ('${raw}')` };
    }
    case "boolean": {
      const b = parseBool(raw);
      return b === null ? { value: null, error: `${spec.label}: evet/hayır bekleniyor ('${raw}')` } : { value: b, error: null };
    }
    case "select": {
      const opt = spec.options?.find((o) => o.value === raw || norm(o.label) === norm(raw) || norm(o.value) === norm(raw));
      return opt ? { value: opt.value, error: null } : { value: null, error: `${spec.label}: '${raw}' seçeneklerde yok (${spec.options?.map((o) => o.value).join(", ")})` };
    }
    default:
      return { value: raw, error: null };
  }
}

export async function rowHash(schema_key: string, values: Record<string, string>): Promise<string> {
  return sha256Hex(canonicalJson({ schema_key, values }));
}

/** Satırları doğrular ve taslak kayıt girdilerini hazırlar; hiçbir şey kaydetmez (önizleme). */
export async function prepareRows(s: Store, schema: RecordSchema, table: Table, mapping: Record<string, string>, training = false): Promise<PreparedRow[]> {
  const sources = s.sources().filter((x) => schema.source_types.includes(x.source_type));
  const periods = s.periods();
  const existingHashes = importedRowHashes(s);
  const seen = new Set<string>();
  const col = (name: string | undefined) => (name ? table.headers.indexOf(name) : -1);
  const out: PreparedRow[] = [];
  for (let i = 0; i < table.rows.length; i++) {
    const row = table.rows[i];
    const values: Record<string, string> = {};
    for (const [target, header] of Object.entries(mapping)) {
      const c = col(header);
      if (c >= 0) values[target] = row[c] ?? "";
    }
    const hash = await rowHash(schema.key, values);
    const errors: string[] = [];
    // kaynak / tesis
    const srcRaw = (values.source ?? "").trim();
    const source: EmissionSource | undefined = sources.find((x) => x.id === srcRaw || x.name.toLocaleLowerCase("tr") === srcRaw.toLocaleLowerCase("tr"));
    if (!srcRaw) errors.push("Kaynak boş.");
    else if (!source) errors.push(`Kaynak '${srcRaw}' bu kurumda ${schema.title} türünde bulunamadı.`);
    else if (!s.facilities().some((f) => f.id === source.facility_id)) errors.push(`Kaynağın tesisi (${source.facility_id}) bu kurumda yok.`);
    // tarih
    const ps = normalizeDate(values.period_start ?? "");
    const pe = normalizeDate(values.period_end ?? "");
    if (!ps) errors.push(`Dönem başlangıcı okunamadı ('${values.period_start ?? ""}').`);
    if (!pe) errors.push(`Dönem bitişi okunamadı ('${values.period_end ?? ""}').`);
    let period = ps && pe ? periods.find((p) => p.start <= ps && pe <= p.end) : undefined;
    if (ps && pe && ps > pe) errors.push("Dönem bitişi başlangıçtan önce.");
    if (ps && pe && !period) {
      period = periods.find((p) => p.status !== "locked" && !(pe < p.start || ps > p.end));
      if (!period) errors.push(`Tarih aralığı (${ps} → ${pe}) hiçbir raporlama dönemine düşmüyor.`);
    }
    if (period?.status === "locked") errors.push("Raporlama dönemi kilitli.");
    // miktar + birim
    const qRaw = (values.quantity ?? "").trim();
    const q = parseQuantity(qRaw, null);
    if (q.ambiguous) errors.push(`Miktar '${qRaw}' belirsiz (1.234 binlik mi ondalık mı?); dosyada açık yazın.`);
    if (q.error) errors.push(`Miktar: ${q.error}`);
    const unitRaw = (values.unit ?? "").trim();
    const unitOpt = unitRaw ? schema.units.find((u) => u.value === unitRaw || norm(u.value) === norm(unitRaw) || norm(u.value) === norm(unitRaw.replace("³", "3"))) : undefined;
    if (unitRaw && !unitOpt) errors.push(`Birim '${unitRaw}' bu kayıt türünde tanınmadı (${schema.units.map((u) => u.value).join(", ")}).`);
    const dqRaw = norm(values.data_quality ?? "");
    const dq: DataQuality = ["tahmini", "estimated", "tahmin"].includes(dqRaw) ? "estimated" : "measured";
    const basisRaw = (values.heating_value_basis ?? "").trim().toUpperCase();
    const basis: "LHV" | "HHV" | null = basisRaw === "LHV" ? "LHV" : basisRaw === "HHV" ? "HHV" : null;
    if (basisRaw && !basis) errors.push(`Isıl değer esası '${basisRaw}' LHV veya HHV olmalı.`);
    // ayrıntı alanları
    const detail: Record<string, unknown> = {};
    for (const spec of schema.fields) {
      const raw = (values[`detail:${spec.key}`] ?? "").trim();
      const fv = fieldValue(spec, raw);
      if (fv.error) errors.push(fv.error);
      if (fv.value !== null) setPath(detail, spec.key, fv.value);
    }
    if (basis) detail.heating_value_basis = basis;
    for (const spec of schema.fields) {
      if (spec.required && fieldVisible(spec, detail) && (values[`detail:${spec.key}`] ?? "").trim() === "") errors.push(`Zorunlu alan boş: ${spec.label}.`);
    }
    // mükerrer: dosya içi, önceki içe aktarma, fatura no
    if (seen.has(hash)) errors.push("Dosya içinde yinelenen satır (aynı değerler).");
    seen.add(hash);
    const inv = (values.invoice_no ?? "").trim();
    if (inv) {
      const sup = (values.supplier ?? "").trim();
      const dupRec = s.records().find((r) => {
        const cv = s.current(r.id);
        return cv.invoice_no?.trim() === inv && (cv.supplier ?? "") === sup;
      });
      if (dupRec && !existingHashes.has(hash)) errors.push(`Fatura no '${inv}' zaten kayıtlı (kayıt ${dupRec.id}).`);
    }
    const existing = existingHashes.get(hash) ?? null;
    const input = !errors.length && source && period && ps && pe
      ? {
          schema_key: schema.key,
          version: {
            change_reason: null,
            source_id: source.id,
            period_id: period.id,
            period_start: ps,
            period_end: pe,
            quantity: q.value,
            quantity_state: q.value === null ? ("unknown" as const) : ("known" as const),
            unit: unitOpt?.value ?? null,
            heating_value_basis: basis,
            reference_conditions: null,
            calorific_value: null,
            basis_conversion: null,
            data_quality: dq,
            invoice_no: inv || null,
            supplier: (values.supplier ?? "").trim() || null,
            evidence_ids: [],
            duplicate_override_reason: null,
            note: (values.note ?? "").trim() ? `${(values.note ?? "").trim()} (içe aktarma)` : "İçe aktarma ile oluşturuldu",
          },
          detail,
          unknown_fields: [],
          training,
        }
      : null;
    out.push({ row: i + 1, hash, error: errors.length ? errors.join(" ") : null, existing_record_id: existing, input });
  }
  return out;
}
