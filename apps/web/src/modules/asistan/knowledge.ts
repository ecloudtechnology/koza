// Bilgi dizini (AI-02): yalnız yetkili, sürümü belirli kaynaklar. Çalışma anında içerikten kurulur;
// şartname bölümleri (§01–§34 + v1.1 maddeleri), sözlük, dersler, kaynak kartları ve hata sözlüğü.
// Kurum verisi bu dizine GİRMEZ; motor onu Store üzerinden, aktif kuruma süzülü okur (kural 3).
import { LESSONS, SOURCES, SPEC_SECTIONS, TERMS } from "@/lib/content";
import { ERRORS } from "@/lib/errors";
import { fold, sentences, stem, tokens } from "./text";

export type KnowledgeKind = "spec" | "term" | "lesson" | "source" | "error";

export interface Citation {
  id: string; // kaynak kimliği (§24, K03, emisyon-faktoru, UNIT_UNKNOWN …)
  label: string; // ekranda görünen ad
  version: string; // sürüm / tarih / durum
  href: string; // uygulama içi bağlantı
  excerpt: string | null; // dayanak paragraf (AI-03)
}

export interface KnowledgeEntry {
  id: string;
  kind: KnowledgeKind;
  title: string;
  text: string;
  version: string;
  href: string;
  folded: string;
  stems: Set<string>;
  titleStems: Set<string>;
}

let INDEX: KnowledgeEntry[] | null = null;

function entry(kind: KnowledgeKind, id: string, title: string, text: string, version: string, href: string, searchExtra = ""): KnowledgeEntry {
  // text: alıntı için (dayanak paragraf); searchExtra: yalnız arama için (örnek, karıştırılan kavram)
  const all = tokens(`${title} ${text} ${searchExtra}`).map(stem);
  return { id, kind, title, text, version, href, folded: fold(`${title} ${text} ${searchExtra}`), stems: new Set(all), titleStems: new Set(tokens(title).map(stem)) };
}

export function buildIndex(): KnowledgeEntry[] {
  if (INDEX) return INDEX;
  const out: KnowledgeEntry[] = [];
  for (const s of SPEC_SECTIONS) {
    const v11 = !s.id.startsWith("§");
    out.push(entry("spec", s.id, v11 ? `${s.id} (v1.1)` : `${s.id} ${s.title}`, s.body, v11 ? "KOZA v1.1 gereklilik eki" : "KOZA şartname v1.0", v11 ? "/belgeler/?d=v11" : "/belgeler/?d=sartname"));
  }
  for (const t of TERMS) {
    out.push(entry("term", t.id, `Sözlük: ${t.tr}${t.abbr ? ` (${t.abbr})` : ""}`, `${t.en}. ${t.definition}`, `${t.status}; kaynak: ${t.source}`, "/sozluk/", `${t.example} ${t.confused_with ?? ""}`));
  }
  for (const l of LESSONS) {
    out.push(entry("lesson", l.id, `101 dersi: ${l.title.tr}`, `${l.goal} ${l.application} ${l.body ?? ""}`, l.status, "/101/"));
  }
  for (const k of SOURCES) {
    out.push(entry("source", k.code, `${k.code} ${k.title}`, `${k.publisher}. ${k.role}`, `kontrol ${k.checked_at}; ${k.status}`, "/protokoller/"));
  }
  for (const e of ERRORS) {
    out.push(entry("error", e.code, `Hata ${e.code}: ${e.title}`, `${e.cause} ${e.consequence} ${e.action}`, e.requirement, `/hatalar/#${e.code}`));
  }
  INDEX = out;
  return out;
}

export function byId(id: string): KnowledgeEntry | undefined {
  return buildIndex().find((e) => e.id === id);
}

/** Bir girdiyi, sorguya en yakın 1–2 cümlelik dayanakla alıntıya çevirir (AI-03). */
export function cite(e: KnowledgeEntry, query?: string): Citation {
  return { id: e.id, label: e.title, version: e.version, href: e.href, excerpt: excerpt(e, query) };
}

export function citeId(id: string, query?: string): Citation | null {
  const e = byId(id);
  return e ? cite(e, query) : null;
}

export function excerpt(e: KnowledgeEntry, query?: string): string | null {
  const ss = sentences(e.text.replace(/^#{1,6}\s.*$/gm, " ")).filter((s) => !s.startsWith("#")); // markdown başlıkları alıntıya girmez
  if (!ss.length) return null;
  if (!query) return ss.slice(0, 2).join(" ");
  const q = new Set(tokens(query).map(stem));
  let best = 0;
  let bestScore = -1;
  ss.forEach((s, i) => {
    const sc = tokens(s).map(stem).filter((t) => q.has(t)).length;
    if (sc > bestScore) {
      bestScore = sc;
      best = i;
    }
  });
  return ss.slice(best, best + 2).join(" ");
}

export interface Hit {
  entry: KnowledgeEntry;
  score: number;
}

/** Deterministik arama: belirteç gövdesi örtüşmesi; başlık eşleşmesi ağırlıklı. Eşitlikte dizin sırası korunur. */
export function search(query: string, opts: { kinds?: KnowledgeKind[]; limit?: number; min?: number } = {}): Hit[] {
  const q = Array.from(new Set(tokens(query).map(stem))).filter((t) => t.length >= 3 || /^\d+$/.test(t)); // "kapsam 3": rakam belirteci korunur
  if (!q.length) return [];
  const hits: Hit[] = [];
  for (const e of buildIndex()) {
    if (opts.kinds && !opts.kinds.includes(e.kind)) continue;
    let score = 0;
    for (const t of q) {
      if (e.titleStems.has(t)) score += 3;
      else if (e.stems.has(t)) score += 1;
    }
    if (score > 0) hits.push({ entry: e, score });
  }
  const min = opts.min ?? Math.max(2, Math.ceil(q.length * 0.6));
  return hits
    .filter((h) => h.score >= min)
    .sort((a, b) => b.score - a.score || a.entry.titleStems.size - b.entry.titleStems.size) // eşitlikte daha dar başlık (ör. "Kapsam 3" > "Kapsam (1, 2, 3)")
    .slice(0, opts.limit ?? 3);
}
