// Küçük, tam (float'sız) ondalık yardımcıları. Yalnız önceliklendirme (TDR-01) ve senaryo defteri (REG-05) için;
// emisyon hesabı DEĞİLDİR (kural 1). Girdi/çıktı ondalık dizedir. Negatif değerler desteklenir.
import { sumDecimalStrings } from "@/lib/store";

const DEC = /^-?\d+(\.\d+)?$/;

/** "1.234,5" / "1234.5" / "1,5" → "1234.5". Geçersizse null. */
export function normalizeDecimal(input: string): string | null {
  const s = input.trim().replace(/\s/g, "");
  if (!s) return null;
  let t = s;
  if (s.includes(",") && s.includes(".")) {
    // son ayraç ondalık kabul edilir
    t = s.lastIndexOf(",") > s.lastIndexOf(".") ? s.replace(/\./g, "").replace(",", ".") : s.replace(/,/g, "");
  } else if (s.includes(",")) {
    t = s.replace(",", ".");
  }
  if (!DEC.test(t)) return null;
  return trimZeros(t);
}

function trimZeros(t: string): string {
  const neg = t.startsWith("-");
  let [ip, fp = ""] = (neg ? t.slice(1) : t).split(".");
  ip = ip.replace(/^0+(?=\d)/, "");
  fp = fp.replace(/0+$/, "");
  const out = fp ? `${ip}.${fp}` : ip;
  return neg && out !== "0" ? `-${out}` : out;
}

function split(v: string): { neg: boolean; digits: bigint; scale: number } {
  const neg = v.startsWith("-");
  const [ip, fp = ""] = (neg ? v.slice(1) : v).split(".");
  return { neg, digits: BigInt(ip + fp), scale: fp.length };
}

function fromScaled(n: bigint, scale: number): string {
  const neg = n < BigInt(0);
  let s = (neg ? -n : n).toString().padStart(scale + 1, "0");
  if (scale > 0) s = `${s.slice(0, -scale)}.${s.slice(-scale)}`;
  return trimZeros((neg ? "-" : "") + s);
}

export function addDecimal(a: string, b: string): string {
  return sumDecimalStrings([a, b]);
}
export function subDecimal(a: string, b: string): string {
  const nb = b.startsWith("-") ? b.slice(1) : `-${b}`;
  return sumDecimalStrings([a, nb === "-0" ? "0" : nb]);
}
export function mulDecimal(a: string, b: string): string {
  const x = split(a);
  const y = split(b);
  const sign = x.neg !== y.neg ? BigInt(-1) : BigInt(1);
  return fromScaled(sign * x.digits * y.digits, x.scale + y.scale);
}
/** a / b, `scale` basamağa KESİLİR (yuvarlama yok; deterministik). b = 0 → null. */
export function divDecimal(a: string, b: string, scale: number): string | null {
  const x = split(a);
  const y = split(b);
  if (y.digits === BigInt(0)) return null;
  // (x.digits / 10^x.scale) / (y.digits / 10^y.scale) = x.digits * 10^(y.scale + scale) / (y.digits * 10^x.scale)
  const num = x.digits * BigInt(10) ** BigInt(y.scale + scale);
  const den = y.digits * BigInt(10) ** BigInt(x.scale);
  const q = num / den;
  const sign = x.neg !== y.neg ? BigInt(-1) : BigInt(1);
  return fromScaled(sign * q, scale);
}
/** -1, 0, 1 */
export function cmpDecimal(a: string, b: string): -1 | 0 | 1 {
  const d = split(subDecimal(a, b));
  if (d.digits === BigInt(0)) return 0;
  return d.neg ? -1 : 1;
}
/** part / total × 100, 2 basamağa kesilmiş yüzde dizesi. total = 0 → null. */
export function percentShare(part: string, total: string): string | null {
  return divDecimal(mulDecimal(part, "100"), total, 2);
}
export function isZero(a: string): boolean {
  return split(a).digits === BigInt(0);
}
