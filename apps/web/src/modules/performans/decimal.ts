// Ondalık dize yardımcıları — YALNIZ sunum düzeyi oranlar için.
//
// Bu dosya emisyon hesabı YAPMAZ (kural 1). Emisyon değerleri her zaman kayıtlı hesap koşularından
// (store.latestRun(...).result.total_co2e_kg) okunur ve burada yeniden hesaplanmaz.
// Buradaki bölme, iki KAYITLI değerin oranıdır (yoğunluk = pay / payda; yüzde değişim = fark / baz).
// Float kullanılmaz; BigInt ile sabit ölçekli tam aritmetik yapılır. Bölme sonucu `scale` basamakta
// sıfıra doğru KESİLİR (yuvarlanmaz) ve bu sunumda açıkça belirtilir.
import { sumDecimalStrings } from "@/lib/store";

const DEC = /^-?\d+(\.\d+)?$/;

export function isDecimal(s: string | null | undefined): s is string {
  return typeof s === "string" && DEC.test(s);
}

/** "12.5" → {n: 125n, scale: 1} */
function parts(v: string): { n: bigint; scale: number } {
  if (!isDecimal(v)) throw new Error(`Ondalık dize değil: ${v}`);
  const neg = v.startsWith("-");
  const [ip, fp = ""] = (neg ? v.slice(1) : v).split(".");
  const n = BigInt(ip + fp);
  return { n: neg ? -n : n, scale: fp.length };
}

function render(n: bigint, scale: number): string {
  const neg = n < BigInt(0);
  let s = (neg ? -n : n).toString().padStart(scale + 1, "0");
  if (scale > 0) s = `${s.slice(0, -scale)}.${s.slice(-scale)}`.replace(/\.?0+$/, "");
  if (s === "" || s === "-") s = "0";
  return (neg && s !== "0" ? "-" : "") + s;
}

/** Karşılaştırma: -1, 0, 1 */
export function cmp(a: string, b: string): -1 | 0 | 1 {
  const pa = parts(a);
  const pb = parts(b);
  const scale = Math.max(pa.scale, pb.scale);
  const na = pa.n * BigInt(10) ** BigInt(scale - pa.scale);
  const nb = pb.n * BigInt(10) ** BigInt(scale - pb.scale);
  return na < nb ? -1 : na > nb ? 1 : 0;
}

export function isZero(a: string): boolean {
  return cmp(a, "0") === 0;
}

export function neg(a: string): string {
  if (isZero(a)) return "0";
  return a.startsWith("-") ? a.slice(1) : `-${a}`;
}

/** a − b (tam) */
export function sub(a: string, b: string): string {
  return sumDecimalStrings([a, neg(b)]);
}

/** a × b (tam) — yalnız senaryo satırı (gölge fiyat × etki) gibi sunum çarpımları için. */
export function mul(a: string, b: string): string {
  const pa = parts(a);
  const pb = parts(b);
  return render(pa.n * pb.n, pa.scale + pb.scale);
}

/**
 * a ÷ b, `scale` ondalık basamakta sıfıra doğru kesilir. Payda sıfırsa null (sıfıra bölme yok; sıfır atanmaz).
 * Yoğunluk = kayıtlı pay / kayıtlı payda (GÖS-03). Bu bir sunum oranıdır, emisyon hesabı değildir.
 */
export function divide(a: string, b: string, scale = 6): string | null {
  const pa = parts(a);
  const pb = parts(b);
  if (pb.n === BigInt(0)) return null;
  // (na / 10^sa) / (nb / 10^sb) = na * 10^(sb + scale) / (nb * 10^sa) / 10^scale
  const num = pa.n * BigInt(10) ** BigInt(pb.scale + scale);
  const den = pb.n * BigInt(10) ** BigInt(pa.scale);
  return render(num / den, scale); // BigInt bölmesi sıfıra doğru keser
}

/** Yüzde değişim: (cur − base) / base × 100; baz sıfırsa null. */
export function pctChange(base: string, cur: string, scale = 2): string | null {
  const d = divide(sub(cur, base), base, scale + 2);
  if (d === null) return null;
  const r = mul(d, "100");
  // fazla basamağı kes (gösterim)
  const [ip, fp = ""] = r.split(".");
  return fp.length > scale ? `${ip}.${fp.slice(0, scale)}`.replace(/\.?0+$/, "") : r;
}
