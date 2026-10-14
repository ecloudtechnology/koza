// OCR (DAT-03): Tesseract.js (cdnjs, 5.x) isteğe bağlı yüklenir; tur+eng. Çıkan metinden aday alanlar
// düzenli ifadeyle çıkarılır; her alanın güveni eşleşen kelimelerin OCR güveninden gelir. Hiçbir alan
// kullanıcı "aktar" demeden forma yazılmaz. OCR doğruluğu emisyon hesabının doğruluğu değildir (§11).
import { parseQuantity } from "@/lib/quantity";

const TESSERACT_URL = "https://cdnjs.cloudflare.com/ajax/libs/tesseract.js/5.1.1/tesseract.min.js";

export interface OcrWord {
  text: string;
  confidence: number; // 0–100
}
export interface OcrOutput {
  text: string;
  words: OcrWord[];
  mean_confidence: number;
}
export interface Candidate {
  key: "invoice_no" | "period_start" | "period_end" | "quantity" | "unit" | "calorific_value" | "calorific_unit" | "supplier";
  label: string;
  value: string;
  raw: string;
  confidence: number; // 0–1
  note: string | null;
}
export const LOW_CONFIDENCE = 0.75;

type TesseractNs = {
  createWorker(langs: string, oem?: number, opts?: { logger?: (m: { status: string; progress: number }) => void }): Promise<{
    recognize(img: File | Blob | string): Promise<{ data: { text: string; confidence: number; words?: { text: string; confidence: number }[] } }>;
    terminate(): Promise<void>;
  }>;
};
declare global {
  interface Window {
    Tesseract?: TesseractNs;
  }
}

export class OcrError extends Error {
  code = "OCR_UNAVAILABLE";
}

async function loadTesseract(): Promise<TesseractNs> {
  if (typeof window === "undefined") throw new OcrError("OCR yalnız tarayıcıda çalışır.");
  if (window.Tesseract) return window.Tesseract;
  await new Promise<void>((resolve, reject) => {
    const s = document.createElement("script");
    s.src = TESSERACT_URL;
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new OcrError("OCR kütüphanesi (Tesseract.js, cdnjs) yüklenemedi: ağ veya CDN engeli."));
    document.head.appendChild(s);
  });
  if (!window.Tesseract) throw new OcrError("OCR kütüphanesi yüklendi ama kullanılamıyor.");
  return window.Tesseract;
}

/** Görüntü dosyasını okur. PDF desteklenmez (görüntü olarak yükleyin). Hata → OcrError (sessiz atlama yok). */
export async function recognize(file: File, onProgress?: (status: string, progress: number) => void): Promise<OcrOutput> {
  if (!file.type.startsWith("image/")) throw new OcrError(`Bu önizlemede OCR yalnız görüntü dosyalarını (PNG/JPG) okur; '${file.type || "bilinmeyen tür"}' desteklenmiyor. PDF ise sayfayı görüntü olarak kaydedin.`);
  const T = await loadTesseract();
  let worker: Awaited<ReturnType<TesseractNs["createWorker"]>>;
  try {
    worker = await T.createWorker("tur+eng", 1, { logger: (m) => onProgress?.(m.status, m.progress) });
  } catch (e) {
    throw new OcrError(`OCR dil verisi (tur+eng) indirilemedi: ${String((e as Error)?.message ?? e)}`);
  }
  try {
    const { data } = await worker.recognize(file);
    const words = (data.words ?? []).map((w) => ({ text: w.text, confidence: w.confidence }));
    return { text: data.text, words, mean_confidence: data.confidence };
  } catch (e) {
    throw new OcrError(`Belge işlenemedi: ${String((e as Error)?.message ?? e)}`);
  } finally {
    await worker.terminate().catch(() => undefined);
  }
}

// ---------- Aday alan çıkarma (saf; test edilir) ----------
const UNIT_MAP: Record<string, string> = { sm3: "Sm3", "sm³": "Sm3", nm3: "Nm3", "nm³": "Nm3", m3: "m3", "m³": "m3", kwh: "kWh", mwh: "MWh", gj: "GJ", lt: "L", l: "L", litre: "L", kg: "kg", ton: "t", t: "t" };
const UNIT_RE = "Sm3|Sm³|Nm3|Nm³|m3|m³|kWh|MWh|GJ|litre|lt|kg|ton";

function confidenceFor(snippet: string, words: OcrWord[]): number {
  const tokens = snippet.split(/\s+/).map((t) => t.replace(/[^\p{L}\p{N}.,/-]/gu, "")).filter((t) => t.length >= 2);
  const hits: number[] = [];
  for (const t of tokens) {
    const w = words.find((w) => w.text.replace(/[^\p{L}\p{N}.,/-]/gu, "") === t);
    if (w) hits.push(w.confidence);
  }
  if (!hits.length) return words.length ? 0.5 : 0.6; // kelime eşleşmedi: düşük-orta güven
  return Math.round((hits.reduce((a, b) => a + b, 0) / hits.length) * 10) / 1000;
}
function toIso(d: string, m: string, y: string): string {
  return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
}

export function extractCandidates(text: string, words: OcrWord[] = []): Candidate[] {
  const out: Candidate[] = [];
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);

  const inv = text.match(/(?:fatura\s*(?:no|numaras[ıi])|invoice\s*(?:no|number)|belge\s*no)\s*[:.#-]?\s*([A-Z]{0,4}[\s-]?\d[\w\-/]{3,})/i);
  if (inv) out.push({ key: "invoice_no", label: "Fatura numarası", value: inv[1].trim(), raw: inv[0], confidence: confidenceFor(inv[0], words), note: null });

  const dates = Array.from(text.matchAll(/\b(\d{1,2})[./-](\d{1,2})[./-](\d{4})\b/g));
  const period = text.match(/(?:dönem|donem|period|tüketim\s*dönemi)[^\d]{0,20}(\d{1,2})[./-](\d{1,2})[./-](\d{4})\s*(?:-|–|—|ile|to)\s*(\d{1,2})[./-](\d{1,2})[./-](\d{4})/i);
  if (period) {
    out.push({ key: "period_start", label: "Dönem başlangıcı", value: toIso(period[1], period[2], period[3]), raw: period[0], confidence: confidenceFor(`${period[1]}.${period[2]}.${period[3]}`, words), note: null });
    out.push({ key: "period_end", label: "Dönem bitişi", value: toIso(period[4], period[5], period[6]), raw: period[0], confidence: confidenceFor(`${period[4]}.${period[5]}.${period[6]}`, words), note: null });
  } else if (dates.length >= 2) {
    const [a, b] = dates;
    out.push({ key: "period_start", label: "Dönem başlangıcı (ilk tarih)", value: toIso(a[1], a[2], a[3]), raw: a[0], confidence: Math.min(confidenceFor(a[0], words), 0.7), note: "Belgedeki ilk iki tarih dönem sayıldı; doğrulayın." });
    out.push({ key: "period_end", label: "Dönem bitişi (ikinci tarih)", value: toIso(b[1], b[2], b[3]), raw: b[0], confidence: Math.min(confidenceFor(b[0], words), 0.7), note: "Belgedeki ilk iki tarih dönem sayıldı; doğrulayın." });
  }

  // miktar + birim: önce "tüketim" geçen satır, yoksa ilk birimli sayı
  const qre = new RegExp(`(\\d[\\d.,]*)\\s*(${UNIT_RE})\\b`, "i");
  const qLine = lines.find((l) => /tüketim|tuketim|consumption|miktar/i.test(l) && qre.test(l)) ?? lines.find((l) => qre.test(l) && !/kcal|kwh\/|mj\//i.test(l));
  const qm = qLine?.match(qre);
  if (qm) {
    const unit = UNIT_MAP[qm[2].toLowerCase()] ?? qm[2];
    const parsed = parseQuantity(qm[1], null);
    const conf = confidenceFor(qm[0], words);
    out.push({ key: "quantity", label: "Miktar", value: parsed.value ?? qm[1], raw: qm[0], confidence: parsed.ambiguous ? Math.min(conf, 0.5) : conf, note: parsed.ambiguous ? "Ayracı belirsiz (binlik mi ondalık mı?); formda seçilir." : parsed.error ? parsed.error : null });
    out.push({ key: "unit", label: "Birim", value: unit, raw: qm[2], confidence: conf, note: unit === "m3" ? "m³ koşulsuz hacimdir; faturada Sm³/Nm³ yazıyorsa onu seçin (T03)." : null });
  }

  const cv = text.match(/(\d[\d.,]*)\s*(kcal\s*\/\s*(?:Sm3|Sm³|Nm3|Nm³|m3|m³)|kWh\s*\/\s*(?:Sm3|Sm³|Nm3|Nm³|m3|m³)|MJ\s*\/\s*(?:Sm3|Sm³|Nm3|Nm³|m3|m³))/i);
  if (cv) {
    const parsed = parseQuantity(cv[1], null);
    const u = cv[2].replace(/\s/g, "").replace("³", "3");
    const unit = u.toLowerCase().startsWith("kcal") ? "kcal/m3" : u.toLowerCase().startsWith("kwh") ? "kWh/m3" : "MJ/m3";
    const conf = confidenceFor(cv[0], words);
    out.push({ key: "calorific_value", label: "Isıl değer", value: parsed.value ?? cv[1], raw: cv[0], confidence: parsed.ambiguous ? Math.min(conf, 0.5) : conf, note: parsed.ambiguous ? "Ayracı belirsiz." : null });
    out.push({ key: "calorific_unit", label: "Isıl değer birimi", value: unit, raw: cv[2], confidence: conf, note: unit === "kcal/m3" ? "kcal/m³ motor birimi değildir; MJ/m³'e dönüşüm kaynağıyla yapılır (sessiz çevrim yok)." : null });
  }

  const sup = lines.find((l) => /(a\.?ş\.?|ltd|şti|san\.|tic\.|dağıtım|dagitim|enerji|elektrik perakende|gaz)/i.test(l) && !/fatura|tüketim|tuketim|abone/i.test(l));
  if (sup) out.push({ key: "supplier", label: "Tedarikçi", value: sup.replace(/\s{2,}/g, " ").slice(0, 80), raw: sup, confidence: Math.min(confidenceFor(sup, words), 0.7), note: "Firma adı satır tahminidir; doğrulayın." });

  return out;
}

// ---------- Asistan önerileri (sessionStorage "koza.asistan.suggest") ----------
// Yük: { source: "asistan", at, fields: { invoice_no?, supplier?, period_start?, period_end?, quantity?, unit? } }
// (fields nesne; dizi biçimi [{key,value,confidence}] de kabul edilir). Alanlar yalnız kullanıcı "aktar" deyince forma yazılır.
export const SUGGEST_KEY = "koza.asistan.suggest";
export interface AssistantSuggestion {
  key: string;
  label?: string;
  value: string;
  confidence?: number;
  source?: string;
}
export interface AssistantPayload {
  source?: string;
  at?: string;
  fields?: Record<string, unknown> | AssistantSuggestion[];
}
const CANDIDATE_KEYS: Candidate["key"][] = ["invoice_no", "period_start", "period_end", "quantity", "unit", "calorific_value", "calorific_unit", "supplier"];
const CANDIDATE_LABEL: Record<Candidate["key"], string> = { invoice_no: "Fatura numarası", period_start: "Dönem başlangıcı", period_end: "Dönem bitişi", quantity: "Miktar", unit: "Birim", calorific_value: "Isıl değer", calorific_unit: "Isıl değer birimi", supplier: "Tedarikçi" };

export function parseAssistantPayload(raw: string): Candidate[] {
  const parsed = JSON.parse(raw) as AssistantPayload | AssistantSuggestion[];
  const src = Array.isArray(parsed) ? "asistan" : (parsed.source ?? "asistan");
  const at = Array.isArray(parsed) ? null : (parsed.at ?? null);
  const note = `Asistan önerisi (${src}${at ? `, ${at}` : ""}); veridir, karar değildir — aktarmadan önce belgeyle doğrulayın.`;
  const fields = Array.isArray(parsed) ? parsed : parsed.fields;
  const list: AssistantSuggestion[] = Array.isArray(fields) ? fields : Object.entries(fields ?? {}).map(([key, v]) => (v && typeof v === "object" ? { key, ...(v as Omit<AssistantSuggestion, "key">) } : { key, value: String(v ?? "") }));
  return list
    .filter((f) => f && typeof f.value === "string" && f.value.trim() !== "" && CANDIDATE_KEYS.includes(f.key as Candidate["key"]))
    .map((f) => ({ key: f.key as Candidate["key"], label: f.label ?? CANDIDATE_LABEL[f.key as Candidate["key"]], value: f.value, raw: f.value, confidence: typeof f.confidence === "number" ? Math.max(0, Math.min(1, f.confidence)) : 0.5, note: f.source ? `${note} Kaynak: ${f.source}` : note }));
}
export function readAssistantSuggestions(): Candidate[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.sessionStorage.getItem(SUGGEST_KEY);
    return raw ? parseAssistantPayload(raw) : [];
  } catch {
    return [];
  }
}
export function clearAssistantSuggestions(): void {
  try {
    window.sessionStorage.removeItem(SUGGEST_KEY);
  } catch {
    /* yoksay */
  }
}
