// Miktar okuma (§11): nokta/virgül ayracı kullanıcı yereline göre okunur; "1.234" belirsizse sessiz karar verilmez.
export interface ParsedQuantity {
  value: string | null; // kanonik ondalık dize ("1234.5")
  ambiguous: boolean; // "1.234" gibi: binlik mi ondalık mı sorulur
  error: string | null;
}

export function parseQuantity(raw: string, decimalSep: "," | "." | null): ParsedQuantity {
  const s = raw.trim().replace(/\s/g, "");
  if (!s) return { value: null, ambiguous: false, error: null };
  if (/^-/.test(s)) return { value: null, ambiguous: false, error: "Negatif tüketim normal kayıt olamaz; iade/düzeltme ayrı işlem türüdür (§11)." };
  if (!/^[\d.,]+$/.test(s)) return { value: null, ambiguous: false, error: "Bu alan miktar bekliyor; ödeme tutarını veya metni ayrı alana yazın (§10)." };
  const hasDot = s.includes(".");
  const hasComma = s.includes(",");
  let v: string;
  if (hasDot && hasComma) {
    const lastDot = s.lastIndexOf(".");
    const lastComma = s.lastIndexOf(",");
    v = lastDot > lastComma ? s.replace(/,/g, "") : s.replace(/\./g, "").replace(",", ".");
  } else if (hasComma) {
    const parts = s.split(",");
    if (parts.length > 2) {
      // "1,234,567" → binlik virgül
      v = s.replace(/,/g, "");
    } else v = s.replace(",", ".");
  } else if (hasDot) {
    const parts = s.split(".");
    if (parts.length > 2) v = s.replace(/\./g, ""); // "1.234.567" → binlik nokta
    else if (parts[1].length === 3) {
      if (decimalSep === null) return { value: null, ambiguous: true, error: null };
      v = decimalSep === "." ? s : s.replace(/\./g, "");
    } else v = s;
  } else v = s;
  if (!/^\d+(\.\d+)?$/.test(v)) return { value: null, ambiguous: false, error: "Sayı okunamadı." };
  v = v.replace(/^0+(?=\d)/, "");
  if (v.includes(".")) v = v.replace(/\.?0+$/, "");
  return { value: v, ambiguous: false, error: null };
}
