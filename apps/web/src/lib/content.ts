// Üretilmiş içerik (scripts/gen-content.mjs). Sektör profilleri veridir, kod değil (kural 5).
import profilesJson from "@/generated/profiles.json";
import catalogJson from "@/generated/test-catalog.json";
import goldenJson from "@/generated/golden.json";
import docsJson from "@/generated/docs.json";
import traceJson from "@/generated/traceability.json";
import termsJson from "@/generated/terms.json";
import lessonsJson from "@/generated/lessons.json";
import sourcesJson from "@/generated/sources.json";

export interface Profile {
  id: string;
  version: string;
  status: "draft" | "review" | "approved" | "retired";
  title: { tr: string; en: string };
  nace_codes: string[];
  approved_by: string | null;
  approved_at: string | null;
  indicators: { id: string; name: { tr: string; en: string }; unit: string; definition: string; suggested_owner_role: string; frequency: string }[];
  intensity_denominators: { id: string; name: { tr: string }; unit: string; source_hint: string }[];
  onboarding_questions: { id: string; text: { tr: string }; creates_source_type: string }[];
  scope3_priorities: number[];
  lesson_paths: Record<string, string[]>;
  example_documents: string[];
  regulation_packages: { package_id: string; note: string }[];
}

export interface TestFactor {
  id: string;
  version: string;
  title_tr: string;
  fuel: string;
  value: string;
  numerator_unit: string;
  gas: string;
  denominator_unit: string;
  basis: string | null;
  reference_conditions: { temperature_c: string; pressure_kpa: string } | null;
  boundary: string;
  gwp_set_id: string | null;
  source_ref: string;
  license: string;
  valid_from: string;
  valid_to: string | null;
  status: string;
  reviewed_by: string | null;
}

export interface TestCatalog {
  catalog_id: string;
  note_tr: string;
  license: string;
  method: { id: string; version: string; title_tr: string; gwp_set: Record<string, string>; approved: boolean; note_tr: string };
  factors: TestFactor[];
}

export interface GoldenFixture {
  id: string;
  title_tr: string;
  requirements: string[];
  note_tr: string;
  request: unknown;
  expected: unknown;
}

export interface DocEntry {
  id: string;
  title: string;
  path: string;
  body: string;
}

export interface TraceRow {
  id: string;
  title: string;
  dilim: string;
  status: "done" | "partial" | "planned" | "blocked";
  where: string;
  evidence: string;
  note?: string;
}

export interface Term {
  id: string;
  tr: string;
  en: string;
  abbr?: string;
  definition: string;
  example: string;
  confused_with?: string;
  related_task?: string;
  source: string;
  status: string;
}

export interface Lesson {
  id: string;
  title: { tr: string };
  level: string;
  goal: string;
  application: string;
  duration_min: number | null;
  status: string;
  body: string | null;
}

export const PROFILES = profilesJson as unknown as Profile[];
export const TEST_CATALOG = catalogJson as unknown as TestCatalog;
export const GOLDEN = goldenJson as unknown as GoldenFixture[];
export const DOCS = docsJson as unknown as DocEntry[];
export const TRACE = traceJson as unknown as { updated: string; rows: TraceRow[] };
export const TERMS = termsJson as unknown as Term[];
export const LESSONS = lessonsJson as unknown as Lesson[];
export interface SourceCard { code: string; title: string; publisher: string; role: string; urls: string[]; checked_at: string; license: string; status: string }
export const SOURCES = sourcesJson as unknown as SourceCard[];

export function profileById(id: string): Profile | undefined {
  return PROFILES.find((p) => p.id === id);
}

// SEK-01: NACE kodundan profil önerisi. Yalnız öneridir; kullanıcı onaylar (SEK-03). Eşleşme yoksa "genel" (SEK-05).
export function suggestProfile(nace: string): { profile: Profile; reason: string } {
  const code = nace.trim().toUpperCase().replace(/\s+/g, "");
  const genel = profileById("genel")!;
  if (!code) return { profile: genel, reason: "NACE kodu girilmedi; genel profil önerildi (SEK-05)." };
  const division = code.replace(/^([A-Z])?(\d{2}).*/, "$1$2");
  for (const p of PROFILES) {
    if (p.id === "genel") continue;
    if (p.nace_codes.some((c) => c.toUpperCase() === code || c.toUpperCase() === division || code.startsWith(c.toUpperCase()) || (division && c.toUpperCase().endsWith(division.replace(/^[A-Z]/, ""))))) {
      return { profile: p, reason: `NACE ${code} profilin kod listesinde (${p.nace_codes.join(", ")}).` };
    }
  }
  return { profile: genel, reason: `NACE ${code} için onaylı profil yok; genel profil önerildi. Eksik sektör talebi içerik ekibine görev olur (SEK-05).` };
}
