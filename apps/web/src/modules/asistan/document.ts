// Belge güvenliği (§24, T15): yapıştırılan metin VERİDİR, komut değildir. Alan adayları düzenli ifadeyle
// çıkarılır; talimat benzeri içerik yalnız görünür uyarı üretir, davranışı değiştirmez.
import { parseQuantity } from "@/lib/quantity";
import { fold } from "./text";

export type CandidateField = "invoice_no" | "supplier" | "period_start" | "period_end" | "quantity" | "unit";

export interface Candidate {
  field: CandidateField;
  label: string;
  value: string; // forma kopyalanacak değer (kullanıcı onaylamadan kopyalanmaz)
  snippet: string; // belgede bulunduğu satır
  note: string | null; // ör. ayraç belirsizliği
}

export interface DocScan {
  chars: number;
  candidates: Candidate[];
  injections: string[]; // bulunan talimat benzeri ifadeler (veri olarak kaldı)
}

export const SUGGEST_KEY = "koza.asistan.suggest";

export interface SuggestPayload {
  source: "asistan";
  at: string;
  fields: Partial<Record<CandidateField, string>>;
}

const LABEL: Record<CandidateField, string> = {
  invoice_no: "Fatura no",
  supplier: "Tedarikçi",
  period_start: "Dönem başlangıcı",
  period_end: "Dönem bitişi",
  quantity: "Miktar",
  unit: "Birim",
};

const UNIT_CANON: Record<string, string> = { sm3: "Sm3", nm3: "Nm3", m3: "m3", kwh: "kWh", mwh: "MWh", gj: "GJ", mj: "MJ" };

// Talimat benzeri kalıplar (katlanmış metinde aranır). Liste veridir; eşleşme yalnız uyarı üretir.
const INJECTION: { re: RegExp; label: string }[] = [
  { re: /onceki (tum )?talimat/, label: "önceki talimat(ları) yok say" },
  { re: /talimat(lar)?(i|ini)? yok say/, label: "talimatı yok say" },
  { re: /ignore (all |the )?(previous|above|prior)/, label: "ignore previous" },
  { re: /disregard (all |the )?(previous|above|prior)/, label: "disregard previous" },
  { re: /sistem komutu/, label: "sistem komutu" },
  { re: /system prompt/, label: "system prompt" },
  { re: /\bsystem:|\bassistant:|\basistan:/, label: "rol etiketi (system/assistant)" },
  { re: /you are now|sen artik|artik sen/, label: "rol değiştirme" },
  { re: /yeni talimat/, label: "yeni talimat" },
  { re: /(kayd[a-z]*|kayit[a-z]*|donem[a-z]*|rapor[a-z]*|faktor[a-z]*)\s+(onayla|sil|kilitle|yayimla|gonder|etkinlestir)/, label: "araç eylemi komutu (onayla/sil/kilitle/yayımla/gönder/etkinleştir)" },
];

function lines(text: string): string[] {
  return text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
}

function iso(d: string, m: string, y: string): string {
  return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
}

function datesIn(line: string): string[] {
  const out: string[] = [];
  for (const m of line.matchAll(/\b(\d{1,2})[./](\d{1,2})[./](\d{4})\b/g)) out.push(iso(m[1], m[2], m[3]));
  for (const m of line.matchAll(/\b(\d{4})-(\d{2})-(\d{2})\b/g)) out.push(`${m[1]}-${m[2]}-${m[3]}`);
  return out;
}

/** Talimat benzeri ifadeleri bulur. Davranış değiştirmez; yalnız liste döner. */
export function findInjections(text: string): string[] {
  const f = fold(text);
  const out: string[] = [];
  for (const p of INJECTION) if (p.re.test(f)) out.push(p.label);
  return out;
}

export function scanDocument(text: string): DocScan {
  const ls = lines(text);
  const cands: Candidate[] = [];

  // Fatura no
  for (const l of ls) {
    const m = l.match(/(?:fatura\s*(?:no|numaras[ıi]|seri\s*no)|invoice\s*(?:no|number|#))\s*[:.#]?\s*([A-Za-z]{0,4}[-\s]?\d{3,}[A-Za-z0-9/-]*|[A-Za-z0-9][A-Za-z0-9/-]{4,})/i);
    if (m) {
      cands.push({ field: "invoice_no", label: LABEL.invoice_no, value: m[1].trim(), snippet: l, note: null });
      break;
    }
  }

  // Tedarikçi
  let sup: Candidate | null = null;
  for (const l of ls) {
    const m = l.match(/(?:tedarik[cç]i|sat[ıi]c[ıi]|da[gğ][ıi]t[ıi]m\s*[sş]irketi|unvan|firma)\s*[:]\s*(.{3,80})/i);
    if (m) {
      sup = { field: "supplier", label: LABEL.supplier, value: m[1].trim(), snippet: l, note: null };
      break;
    }
  }
  if (!sup) {
    const l = ls.find((x) => /\b(A\.?[SŞ]\.?|Ltd\.?|Limited|Anonim [SŞ]irketi)\b/.test(x) && x.length <= 90);
    if (l) sup = { field: "supplier", label: LABEL.supplier, value: l, snippet: l, note: "Unvan satırından tahmin edildi; doğrulayın." };
  }
  if (sup) cands.push(sup);

  // Dönem: önce "dönem" geçen satırda iki tarih, yoksa belgedeki ilk iki tarih
  const periodLine = ls.find((l) => /d[oö]nem|period|okuma|t[uü]ketim tarih/i.test(l) && datesIn(l).length >= 2);
  const ds = periodLine ? datesIn(periodLine) : ls.flatMap(datesIn);
  if (ds.length >= 2) {
    const [a, b] = ds.slice(0, 2).sort();
    const note = periodLine ? null : "Belgedeki ilk iki tarihten alındı; fatura tarihi olabilir, doğrulayın.";
    cands.push({ field: "period_start", label: LABEL.period_start, value: a, snippet: periodLine ?? "", note });
    cands.push({ field: "period_end", label: LABEL.period_end, value: b, snippet: periodLine ?? "", note });
  }

  // Miktar + birim: tüketim/miktar satırı öncelikli
  const qre = /(\d{1,3}(?:[.,]\d{3})+(?:[.,]\d+)?|\d+(?:[.,]\d+)?)\s*(sm³|sm3|nm³|nm3|m³|m3|kwh|mwh|gj|mj)\b/i;
  const pref = ls.find((l) => /t[uü]ketim|miktar|toplam/i.test(l) && qre.test(l));
  const ql = pref ?? ls.find((l) => qre.test(l));
  if (ql) {
    const m = ql.match(qre)!;
    const unit = UNIT_CANON[fold(m[2]).replace("³", "3")] ?? m[2];
    const parsed = parseQuantity(m[1], null);
    const note = parsed.ambiguous ? `"${m[1]}" binlik mi ondalık mı belirsiz; form ayracı sorar (§11).` : parsed.error;
    cands.push({ field: "quantity", label: LABEL.quantity, value: parsed.value ?? m[1], snippet: ql, note });
    cands.push({ field: "unit", label: LABEL.unit, value: unit, snippet: ql, note: unit === "m3" ? "m³: sıcaklık/basınç koşulu faturada belirtilmiyorsa hesap engellenir (UNIT_CONDITIONS_UNKNOWN)." : null });
  }

  return { chars: text.length, candidates: cands, injections: findInjections(text) };
}

/** Kullanıcının onayladığı adaylardan, veri girişi formunun okuyacağı öneri yükü. */
export function toSuggestion(selected: Candidate[]): SuggestPayload {
  const fields: Partial<Record<CandidateField, string>> = {};
  for (const c of selected) fields[c.field] = c.value;
  return { source: "asistan", at: new Date().toISOString(), fields };
}
