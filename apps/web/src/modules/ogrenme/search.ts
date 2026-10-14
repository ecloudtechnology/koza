// Sözlük araması (§10): Türkçe karakter katlama, yaygın yazım hatası toleransı, kısaltma ve İngilizce eş anlamlı.
import type { TermFull } from "./types";

const MAP: Record<string, string> = { ı: "i", ğ: "g", ü: "u", ş: "s", ö: "o", ç: "c", â: "a", î: "i", û: "u", "₂": "2", "₃": "3", "³": "3", "²": "2" };

/** Küçük harf (tr), aksan/alt simge katlama, fazla boşluk temizliği. */
export function fold(s: string): string {
  return s
    .toLocaleLowerCase("tr")
    .replace(/i̇/g, "i")
    .split("")
    .map((c) => MAP[c] ?? c)
    .join("")
    .replace(/[^a-z0-9\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function tokens(s: string): string[] {
  return fold(s).split(/[\s-]+/).filter(Boolean);
}

/** Damerau-Levenshtein (yer değiştirme dahil) — kısa dizeler için yeterli. */
export function editDistance(a: string, b: string): number {
  const m = a.length, n = b.length;
  const d: number[][] = Array.from({ length: m + 1 }, () => new Array<number>(n + 1).fill(0));
  for (let i = 0; i <= m; i++) d[i][0] = i;
  for (let j = 0; j <= n; j++) d[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
    }
  }
  return d[m][n];
}

function tolerance(len: number): number {
  if (len >= 9) return 2;
  if (len >= 5) return 1;
  return 0;
}

/** Sorgu belirteci terim belirtecine uyuyor mu: içerme ya da tolerans içinde yazım hatası. */
export function tokenMatches(q: string, t: string): boolean {
  if (!q) return false;
  if (t.includes(q)) return true;
  if (q.length >= 4 && t.startsWith(q.slice(0, 4)) && editDistance(q, t) <= tolerance(q.length) + 1) return true;
  return editDistance(q, t) <= tolerance(q.length);
}

function searchable(t: TermFull): { strong: string[]; weak: string[] } {
  const strong = [t.tr, t.en, t.abbr ?? "", ...(t.aliases ?? [])].filter(Boolean);
  const weak = [t.definition, t.example, t.confused_with ?? "", t.field_help?.field_label ?? ""].filter(Boolean);
  return { strong, weak };
}

/** 0 = eşleşme yok; büyük = daha iyi. */
export function scoreTerm(t: TermFull, query: string): number {
  const q = fold(query);
  if (!q) return 1;
  const qTokens = tokens(query);
  const qSquash = q.replace(/[\s-]/g, "");
  const { strong, weak } = searchable(t);
  let score = 0;
  for (const s of strong) {
    const f = fold(s);
    if (f === q) score = Math.max(score, 100);
    else if (f.replace(/[\s-]/g, "") === qSquash) score = Math.max(score, 95);
    else if (f.includes(q)) score = Math.max(score, 80);
    else if (f.replace(/[\s-]/g, "").includes(qSquash) && qSquash.length >= 3) score = Math.max(score, 70);
    else {
      const tt = tokens(s);
      const hit = qTokens.filter((qt) => tt.some((x) => tokenMatches(qt, x))).length;
      if (hit === qTokens.length && hit > 0) score = Math.max(score, 60);
      else if (hit > 0) score = Math.max(score, 30 + hit * 5);
    }
  }
  if (score === 0) {
    for (const w of weak) {
      const f = fold(w);
      if (f.includes(q)) {
        score = Math.max(score, 20);
        break;
      }
      const tt = tokens(w);
      const hit = qTokens.filter((qt) => tt.some((x) => tokenMatches(qt, x))).length;
      if (hit === qTokens.length && hit > 0) score = Math.max(score, 15);
    }
  }
  return score;
}

export function searchTerms(terms: TermFull[], query: string, context: string | null): { term: TermFull; score: number }[] {
  return terms
    .filter((t) => !context || (context === "alan-yardimi" ? t.kind === "alan-yardimi" : (t.contexts ?? []).includes(context)))
    .map((term) => ({ term, score: scoreTerm(term, query) }))
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score || a.term.tr.localeCompare(b.term.tr, "tr"));
}
