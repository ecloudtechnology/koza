// ogrenme modülü içerik tipleri (content/lessons, terms, sources, agenda, funding). İçerik veridir (kural 5, 6).
import type { ModuleRow } from "@/lib/store";

export type PathRole = "manager" | "specialist" | "field";
export const PATH_LABEL: Record<PathRole, string> = { manager: "Yönetici (ÖĞR-01)", specialist: "Mühendis / uzman (ÖĞR-02)", field: "Saha (ÖĞR-03)" };

export interface QuizQuestion {
  q: string;
  options: string[];
  correct: number;
  explanations: string[];
}

export interface LessonFull {
  id: string;
  title: { tr: string };
  level: string;
  goal: string;
  application: string;
  duration_min: number;
  field_duration_min: number | null;
  prerequisites: string[];
  status: string;
  review_date: string;
  sources: string[];
  related_task: { route: string; label: string };
  explanation: string[];
  field_summary: string[] | null;
  business_example: string;
  common_mistake: string;
  exercise: { prompt: string; steps: string[]; note: string };
  quiz: QuizQuestion[];
}

export interface TermFull {
  id: string;
  tr: string;
  en: string;
  abbr?: string | null;
  aliases?: string[];
  kind?: "terim" | "alan-yardimi";
  contexts?: string[];
  definition: string;
  variants?: { context: string; definition: string }[];
  example: string;
  confused_with?: string | null;
  related_task?: string;
  related_route?: string | null;
  field_help?: { route: string; field_id: string; field_label: string };
  likely_department?: string | null;
  source: string;
  status: string;
}

export const CONTEXT_LABEL: Record<string, string> = {
  envanter: "Kurumsal envanter",
  urun: "Ürün / yaşam döngüsü",
  raporlama: "Raporlama",
  mevzuat: "Mevzuat",
  "veri-girisi": "Veri girişi",
  yonetim: "Yönetim ve süreç",
};

export type SourceFamily = "GRI" | "TSRS" | "GHG Protocol" | "ISO" | "mevzuat" | "rehber";
export const FAMILY_ORDER: SourceFamily[] = ["GRI", "TSRS", "GHG Protocol", "ISO", "mevzuat", "rehber"];
export const FAMILY_FUNCTION: Record<SourceFamily, string> = {
  GRI: "Etki raporlaması — evrensel, sektörel ve konu gereklilikleri için indeks",
  TSRS: "Sürdürülebilirlikle ilgili finansal açıklamalar — kurum kapsamı ve dönemle ilişkili ayrı açıklama listesi",
  "GHG Protocol": "Kurumsal ve ürün sera gazı hesap yaklaşımı — sınır, kategori ve yöntem kuralları",
  ISO: "Yaşam döngüsü çerçevesi (14040/14044) ve ürün karbon ayak izi (14067)",
  mevzuat: "Hukuki yükümlülük — yetki alanı, kapsam, tarih ve uzman kontrolü",
  rehber: "İkincil dayanak — öğrenme ve kavramsal içerik; kural üretmez",
};

export interface SourceVersion {
  label: string;
  edition: string | null;
  published_at: string | null;
  effective_from: string | null;
  url: string | null;
  note: string;
  current: boolean;
}

export interface RelevanceRule {
  kind: "always" | "scope3_category" | "package" | "country" | "product_study";
  value: string | number | null;
  reason: string;
}

export interface SourceFull {
  code: string;
  title: string;
  publisher: string;
  family: SourceFamily;
  role: string;
  urls: string[];
  edition: string | null;
  language: string;
  published_at: string | null;
  effective_from: string | null;
  transition_note: string | null;
  retired_at: string | null;
  checked_at: string;
  license: string;
  status: string;
  identity_note: string | null;
  versions: SourceVersion[];
  relevance: RelevanceRule[];
}

export type ApplicabilityResult = "applies" | "not_applicable" | "review_required";
export const APPLICABILITY_LABEL: Record<ApplicabilityResult, string> = { applies: "Uygulanır", not_applicable: "Uygulanmaz", review_required: "İnceleme gerekli" };

export type AgendaType = "mevzuat_degisikligi" | "standart_guncellemesi" | "resmi_duyuru" | "destek_cagrisi" | "etkinlik" | "sektor_gelismesi";
export const AGENDA_TYPE_LABEL: Record<AgendaType, string> = {
  mevzuat_degisikligi: "Mevzuat değişikliği",
  standart_guncellemesi: "Standart güncellemesi",
  resmi_duyuru: "Resmî duyuru",
  destek_cagrisi: "Destek / teşvik çağrısı",
  etkinlik: "Eğitim / etkinlik",
  sektor_gelismesi: "Sektör gelişmesi",
};
export type AgendaStatus = "taslak" | "istisare" | "yururlukte";
export const AGENDA_STATUS_LABEL: Record<AgendaStatus, string> = { taslak: "Taslak", istisare: "İstişare metni", yururlukte: "Yürürlükte" };

export interface AgendaItem {
  id: string;
  type: AgendaType;
  status: AgendaStatus;
  title: string;
  summary: string[];
  publisher: string;
  source_url: string;
  source_codes: string[];
  published_at: string | null;
  event_or_effective_at: string | null;
  countries: string[];
  sectors: string[];
  relevance: { profile_ids: string[]; packages: string[] };
  suggested_action: string;
  affected_route: string | null;
  last_checked: string | null;
  editor_status: string;
}

export interface FundingItem {
  id: string;
  title: string;
  program_owner: string;
  official_url: string;
  eligibility: string[];
  open_status: "open" | "closed" | "unknown";
  call_date: string | null;
  deadline: string | null;
  amount_note: string | null;
  relevance: { profile_ids: string[]; packages: string[] };
  last_checked: string | null;
  editor_status: string;
}

// ---- Modül tabloları ("ogrenme/<tablo>") ----
export interface ProgressRow extends ModuleRow {
  user_id: string;
  lesson_id: string;
  content_version: string; // dersin review_date'i: ders değişince eski kayıt korunur, tazeleme önerilir (§07 kabul)
  completed_at: string;
  duration_min: number;
  unit_id: string | null; // tesis; null = kurum geneli. Eğitim saati yalnız birim düzeyinde toplanır (ÖĞR-04, kural 11)
  quiz_correct: number;
  quiz_total: number;
}

export interface ApplicabilityRow extends ModuleRow {
  source_code: string;
  result: ApplicabilityResult;
  reason: string;
  rule_version: string; // kaynağın checked_at'i (karar hangi kural sürümüne bağlı)
  decided_by: string;
  decided_at: string;
  inputs: { profile_id: string; profile_version: string; country: string; packages: string[] }; // kullanılan kurum verisi (§08)
}

export interface AgendaPrefRow extends ModuleRow {
  user_id: string;
  item_id: string;
  follow: boolean;
  muted: boolean;
  in_calendar: boolean;
}

export type CalendarKind = "internal" | "legal" | "funding";
export const CALENDAR_KIND_LABEL: Record<CalendarKind, string> = { internal: "Kurum içi teslim", legal: "Yasal / standart tarihi", funding: "Destek çağrısı" };

export interface CalendarEntry {
  id: string;
  kind: CalendarKind;
  date: string; // YYYY-MM-DD (Europe/Istanbul; saklama UTC — önizlemede tarih dizesi)
  title: string;
  detail: string;
  route: string | null;
  past: boolean;
}
