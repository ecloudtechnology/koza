// urun-rapor modülü tipleri. Sayılar ondalık DİZE (kural 1); hesap yalnız motorda.
import type { AggregateResult } from "@/lib/calc";
import type { CalcResult, DataQuality, FactorRef, ReportManifest, ValueState } from "@/lib/domain";
import type { ModuleRow } from "@/lib/store";

export const MODULE = "urun-rapor";

// ---------- Ürün çalışması (§17) ----------

export type StudyBoundary = "gate_to_gate" | "cradle_to_gate" | "cradle_to_grave" | "custom";

export interface BoundaryExplanation {
  start_process: string; // kapıdan kapıya: başlangıç prosesi
  end_process: string; // kapıdan kapıya: bitiş prosesi
  facility_exit: string; // beşikten kapıya: hangi tesisin çıkışı
  upstream_note: string; // beşikten kapıya: üst aşamalar
  distribution_scenario: string; // beşikten mezara
  use_scenario: string;
  eol_scenario: string;
  included: string; // özel kısmi sınır: dahil süreçler
  excluded: string; // özel kısmi sınır: hariç süreçler
  rationale: string; // özel kısmi sınır: gerekçe
}

export type ProcessKind = "material" | "route" | "scrap" | "packaging" | "energy" | "transport" | "use" | "eol" | "coproduct";

export type AllocationBasis = "mass" | "energy" | "economic" | "none";

export interface Allocation {
  basis: AllocationBasis;
  share: string; // 0–1 ondalık dize
  source_ref: string;
}

export interface ProcessLine {
  id: string;
  kind: ProcessKind;
  name: string;
  // Faaliyet kaydına bağlı (aynı ham veri) ya da kendi miktarı
  link: { type: "record"; record_id: string } | { type: "own"; quantity: string | null; quantity_state: ValueState; unit: string | null; heating_value_basis: "LHV" | "HHV" | null; data_quality: DataQuality; fuel: string | null };
  factor_keys: string[]; // "ID@sürüm"
  allocation: Allocation | null;
  note: string;
}

// Girdi tipi ayrı tanımlanır: ModuleRow'un dizin imzası Omit<> ile anahtarları yitirir.
export interface StudyInput {
  product_name: string;
  product_version: string;
  reference_flow: { quantity: string; unit: string };
  functional_unit: string | null;
  functional_unit_note: string;
  boundary: StudyBoundary;
  boundary_explanation: BoundaryExplanation;
  period: { start: string; end: string };
  processes: ProcessLine[];
}
export interface Study extends ModuleRow, StudyInput {}

export interface LineResult {
  line_id: string;
  line_name: string;
  kind: ProcessKind;
  request_hash: string | null; // motorun inputs_hash'i
  factor_refs: FactorRef[];
  result: CalcResult;
}

// Değişmez satır: her hesap yeni sonuç satırıdır; çalışma tanımı değişince sürüm numarası da artar.
export interface StudyResult extends ModuleRow {
  study_id: string;
  study_version: number; // hesaplandığı andaki çalışma sürümü
  boundary: StudyBoundary;
  label_tr: string; // "ürün karbon ayak izi" | "kısmi ürün karbon ayak izi (…)"
  reference_flow: { quantity: string; unit: string };
  functional_unit: string | null;
  period: { start: string; end: string };
  method: { id: string; version: string };
  engine_version: string;
  lines: LineResult[];
  // Çalışma toplamı yalnız motorun aggregate() çıktısından (ürün bölümü). Üretilemediyse null + neden.
  study_total_kg: string | null;
  study_claim_tr: string | null;
  total_note_tr: string | null;
  gaps_tr: string[];
  included_in_corporate_total: false;
}

// ---------- Rapor paketi (§22) ----------

export type Scope2Method = "location_based" | "market_based";

export interface AggregateRequest {
  results: {
    record_id: string;
    context: "corporate" | "product";
    scope: 1 | 2 | 3 | null;
    category: number | null;
    state: string;
    result: CalcResult;
    scope2_method_used: Scope2Method | null;
    study_id?: string;
  }[];
  policy: { include_states: string[]; scope2_method: Scope2Method };
}

export interface RecordDetailRow {
  record_id: string;
  version: number;
  state: string;
  source_id: string;
  source_name: string;
  source_type: string;
  scope: number | null;
  category: number | null;
  period_start: string;
  period_end: string;
  quantity: string | null;
  quantity_state: ValueState;
  unit: string | null;
  data_quality: DataQuality;
  run_id: string | null;
  status: string | null;
  total_co2e_kg: string | null;
  coverage: string | null;
  factor_refs: string; // "ID@v, ID@v"
  evidence_sha256: string; // boşlukla ayrılmış
  invoice_no: string | null;
  supplier: string | null;
  note: string;
}

export interface EvidenceIndexRow {
  record_id: string;
  evidence_id: string;
  file_name: string;
  sha256: string;
  size_bytes: number;
}

export interface ProductStudySummary {
  study_id: string;
  product_name: string;
  product_version: string;
  study_version: number;
  boundary: StudyBoundary;
  label_tr: string;
  result_id: string;
  total_kg: string | null;
  claim_tr: string | null;
  included_in_corporate_total: false;
}

export interface PackageManifest {
  package_schema: "urun-rapor/1";
  core: ReportManifest; // store.createReport'un ürettiği çekirdek manifest (T19 davranışı korunur)
  core_manifest_sha256: string; // rapor kimliği/sürümü satırda (ReportPackage); manifest içeriği girdiye bağlıdır (T19)
  engine_version: string;
  policy: AggregateRequest["policy"];
  aggregate: AggregateResult; // tek sayısal otorite (K-17)
  boundary: { approach: string; note: string; status: string } | null;
  period: { id: string; start: string; end: string; status: string };
  tenant: ReportManifest["tenant"];
  method: { id: string; version: string } | null;
  sources: {
    catalog_id: string | null;
    factors: { id: string; version: string; title_tr: string | null; source_ref: string | null; license: string | null }[];
    method: { id: string; version: string; title_tr: string | null; gwp_set: Record<string, string> | null } | null;
    engine_version: string;
    reporting_maps: { id: string; version: string }[];
  };
  records_detail: RecordDetailRow[];
  evidence_index: EvidenceIndexRow[];
  product_studies: ProductStudySummary[];
  comparison: { previous: { period: { id: string; start: string; end: string }; package_id: string; package_sha256: string; corporate: AggregateResult["corporate"] } | null; note_tr: string };
  quality: {
    estimated_share_by_count: string | null;
    estimated_share_by_kg: string | null;
    review_required_count: number;
    blocked_count: number;
    no_run_count: number;
    evidence_missing_count: number;
    unknown_count: number;
    not_applicable_count: number;
  };
  gaps_tr: string[];
}

export interface ReportPackage extends ModuleRow {
  report_id: string;
  period_id: string;
  report_version: number;
  core_manifest_sha256: string;
  package_sha256: string;
  manifest: PackageManifest;
  reason: string | null;
  supersedes: string | null;
}

export interface Publication extends ModuleRow {
  package_id: string;
  report_id: string;
  period_id: string;
  package_sha256: string;
  note: string | null;
}

export interface AssuranceInput {
  provider: string;
  file_name: string;
  sha256: string;
  scope: string;
  opinion: "unqualified" | "qualified" | "adverse" | "disclaimer" | "other";
  opinion_text: string;
  level: "limited" | "reasonable" | "unknown";
}
export interface Assurance extends ModuleRow, AssuranceInput {
  package_id: string;
}

// ---------- GRI / TSRS eşleştirme (içerik: content/reporting-maps) ----------

export type Relation = "full" | "partial" | "conditional";

export interface ReportingMap {
  id: string;
  framework: string;
  title: string;
  version: string;
  applicable_from: string | null;
  source: string;
  note_tr: string;
  items: {
    id: string;
    title_tr: string;
    elements: { koza: string; relation: Relation; note_tr: string }[];
    narrative: string[];
  }[];
}
