// Türkçe metin yardımcıları: aksan katlama, kural tabanlı eşleme için belirteçleme. Deterministik; model yok.

const MAP: Record<string, string> = { ç: "c", ğ: "g", ı: "i", ö: "o", ş: "s", ü: "u", â: "a", î: "i", û: "u", "³": "3", "₂": "2" };

/** Küçük harfe indirir ve Türkçe aksanları katlar ("Isıl Değer" → "isil deger"). */
export function fold(s: string): string {
  return s
    .replace(/İ/g, "i")
    .replace(/I/g, "ı")
    .toLowerCase()
    .replace(/[çğıöşüâîû³₂]/g, (ch) => MAP[ch] ?? ch);
}

const STOP = new Set(
  "ve veya ile bir bu su o ne mi mu icin de da ki gibi daha cok en ben sen biz siz benim bana beni bize nasil neden hangi kac var yok olarak ise ama fakat her hem ya yani sey acaba lutfen misin midir mudur olan olur olsun oldu olacak bunu bunun suna sunu onu onun ki ya da ile ilgili hakkinda diye".split(/\s+/)
);

/** Katlanmış, durak sözcükleri atılmış belirteçler. */
export function tokens(s: string): string[] {
  return fold(s)
    .replace(/[^a-z0-9§\s-]/g, " ")
    .split(/\s+/)
    .map((t) => t.replace(/^-+|-+$/g, ""))
    .filter((t) => (t.length >= 2 || /^\d$/.test(t)) && !STOP.has(t)); // "kapsam 3": tek rakam korunur
}

/** Kaba gövde: Türkçe eklerini kesmeden ilk 5 harf (deterministik eşleme için yeterli). */
export function stem(t: string): string {
  return t.length > 5 ? t.slice(0, 5) : t;
}

export function hasAny(folded: string, phrases: string[]): boolean {
  return phrases.some((p) => folded.includes(p));
}

/** Metni cümlelere böler (nokta, soru, ünlem). */
export function sentences(s: string): string[] {
  return s
    .replace(/\s+/g, " ")
    .split(/(?<=[.!?])\s+(?=[A-ZÇĞİÖŞÜ“"0-9§])/)
    .map((x) => x.trim())
    .filter(Boolean);
}

/** İlk n cümle. */
export function firstSentences(s: string, n: number): string {
  return sentences(s).slice(0, n).join(" ");
}
