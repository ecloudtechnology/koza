// Ortak alan tipleri (packages/domain ile aynı sözleşme; §20, §21, GELISTIRME-KURALLARI.md kural 2).
// Sayısal değerler her zaman ondalık DİZE olarak taşınır; hesap yalnız koza_calc içinde yapılır.

export type Role =
  | "admin" // Kurum yöneticisi
  | "data_entry" // Veri giren
  | "data_owner" // Veri sorumlusu
  | "reviewer" // Uzman kontrolör
  | "approver" // Onaylayan
  | "viewer"; // İzleyici / denetçi

export const ROLE_LABEL: Record<Role, string> = {
  admin: "Kurum yöneticisi",
  data_entry: "Veri giren",
  data_owner: "Veri sorumlusu",
  reviewer: "Uzman kontrolör",
  approver: "Onaylayan",
  viewer: "İzleyici / denetçi",
};

// §21 kayıt durumları
export type RecordState =
  | "draft"
  | "validation_required"
  | "calculated"
  | "in_review"
  | "changes_requested"
  | "approved"
  | "locked";

export const STATE_LABEL: Record<RecordState, string> = {
  draft: "Taslak",
  validation_required: "Doğrulama gerekli",
  calculated: "Hesaplandı",
  in_review: "İncelemede",
  changes_requested: "Düzeltme istendi",
  approved: "Onaylandı",
  locked: "Kilitli dönem",
};

// Kural 2: NULL = bilinmiyor, 0 = ölçülmüş sıfır, not_applicable = gerekçeli karar
export type ValueState = "known" | "unknown" | "not_applicable";
export type DataQuality = "measured" | "estimated";

export interface Tenant {
  id: string;
  name: string;
  country: string;
  nace_code: string | null;
  profile_id: string; // content/sector-profiles kimliği
  profile_version: string;
  profile_confirmed: boolean; // SEK-01: kullanıcı onayı
  created_at: string;
  policy: { allow_self_approval: boolean; self_approval_reason: string | null };
}

export interface Facility {
  id: string;
  tenant_id: string;
  name: string;
  city: string;
  profile_id: string | null; // tesis bazlı farklı profil (SEK-01)
}

export interface InventoryBoundary {
  id: string;
  tenant_id: string;
  version: number;
  approach: "operational_control" | "financial_control" | "equity_share" | "unknown";
  note: string;
  status: "draft" | "pending_expert" | "approved";
}

export interface ReportingPeriod {
  id: string;
  tenant_id: string;
  start: string; // YYYY-MM-DD
  end: string;
  status: "open" | "closing" | "locked";
  locked_at: string | null;
  locked_by: string | null;
}

export interface PeriodReopen {
  id: string;
  tenant_id: string;
  period_id: string;
  reason: string;
  impact_note: string;
  requested_by: string;
  at: string;
}

export type SourceType =
  | "stationary_combustion"
  | "mobile_combustion"
  | "refrigerant"
  | "process"
  | "purchased_electricity"
  | "purchased_steam"
  | "purchased_heat"
  | "purchased_cooling"
  | "scope3"
  | "product_process"
  | "purchased_goods" // geriye uyum: kurulumdan gelen kategori 1 kaynağı (scope3 kategori 1 olarak işlenir)
  | "other";

export const SOURCE_TYPE_LABEL: Record<SourceType, string> = {
  stationary_combustion: "Sabit yakma (kazan, fırın, jeneratör)",
  mobile_combustion: "Araç ve mobil ekipman",
  refrigerant: "Soğutucu gaz",
  process: "Proses emisyonu",
  purchased_electricity: "Satın alınan elektrik",
  purchased_steam: "Satın alınan buhar",
  purchased_heat: "Satın alınan ısı",
  purchased_cooling: "Satın alınan soğutma",
  scope3: "Değer zinciri (Kapsam 3)",
  product_process: "Ürün çalışması süreci",
  purchased_goods: "Satın alınan mal ve hizmet (Kapsam 3 kat. 1)",
  other: "Diğer",
};

export const SCOPE_OF_SOURCE: Record<SourceType, 1 | 2 | 3 | 0> = {
  stationary_combustion: 1, mobile_combustion: 1, refrigerant: 1, process: 1,
  purchased_electricity: 2, purchased_steam: 2, purchased_heat: 2, purchased_cooling: 2,
  scope3: 3, purchased_goods: 3, product_process: 0, other: 0,
};

export const SCOPE3_CATEGORIES: { n: number; tr: string; owner_hint: string }[] = [
  { n: 1, tr: "Satın alınan mal ve hizmetler", owner_hint: "Satın alma" },
  { n: 2, tr: "Sermaye malları", owner_hint: "Satın alma / finans" },
  { n: 3, tr: "Yakıt ve enerji üst aşamaları", owner_hint: "Enerji / teknik" },
  { n: 4, tr: "Yukarı yönlü taşıma ve dağıtım", owner_hint: "Lojistik" },
  { n: 5, tr: "Operasyon atıkları", owner_hint: "Çevre sorumlusu" },
  { n: 6, tr: "İş seyahatleri", owner_hint: "Seyahat / idari işler" },
  { n: 7, tr: "İşe gidiş geliş", owner_hint: "İnsan kaynakları" },
  { n: 8, tr: "Kiralanan varlıklar (kiracı)", owner_hint: "İdari işler / finans" },
  { n: 9, tr: "Aşağı yönlü taşıma ve dağıtım", owner_hint: "Lojistik / satış" },
  { n: 10, tr: "Satılan ürünlerin işlenmesi", owner_hint: "Satış / Ar-Ge" },
  { n: 11, tr: "Satılan ürünlerin kullanımı", owner_hint: "Ar-Ge / satış" },
  { n: 12, tr: "Satılan ürünlerin ömür sonu", owner_hint: "Ar-Ge / çevre" },
  { n: 13, tr: "Kiraya verilen varlıklar", owner_hint: "Finans" },
  { n: 14, tr: "Franchise", owner_hint: "Satış / hukuk" },
  { n: 15, tr: "Yatırımlar", owner_hint: "Finans" },
];

export interface EmissionSource {
  id: string;
  tenant_id: string;
  facility_id: string;
  name: string;
  source_type: SourceType;
  fuel: string | null; // natural_gas | null
  control: "owned" | "leased" | "unknown";
  created_from: "onboarding" | "manual";
}

export interface Evidence {
  id: string;
  tenant_id: string;
  file_name: string;
  size_bytes: number;
  sha256: string;
  mime: string;
  uploaded_at: string;
  uploaded_by: string;
  // Önizlemede dosya içeriği saklanmaz; yalnız karma ve üst veri (apps/api README).
  stored: false;
}

export interface ActivityRecordVersion {
  record_id: string;
  tenant_id: string;
  version: number;
  created_at: string;
  created_by: string;
  change_reason: string | null;
  source_id: string;
  period_id: string;
  period_start: string;
  period_end: string;
  quantity: string | null; // ondalık dize; NULL = bilinmiyor
  quantity_state: ValueState;
  unit: string | null; // GJ | MWh | kWh | m3 | Nm3 | Sm3 | null (bilinmiyor)
  heating_value_basis: "LHV" | "HHV" | null;
  reference_conditions: { temperature_c: string; pressure_kpa: string } | null;
  calorific_value: { value: string; unit: string; basis: "LHV" | "HHV"; source_ref: string } | null;
  basis_conversion: { ratio: string; from: "LHV" | "HHV"; to: "LHV" | "HHV"; source_ref: string } | null;
  data_quality: DataQuality;
  invoice_no: string | null;
  supplier: string | null;
  evidence_ids: string[];
  duplicate_override_reason: string | null; // T07
  note: string;
  // Kategoriye özgü doğrulanan ayrıntı (§20 ActivityDetail): soğutucu, Kapsam 2 araçları, Kapsam 3 yöntem alanları,
  // ürün bağlamı. Şema sürümü detail.schema_version'da; hesap isteği bu alandan kurulur (CONTRACT-v0.2).
  detail: Record<string, unknown> | null;
}

export interface ActivityRecord {
  id: string;
  tenant_id: string;
  state: RecordState;
  current_version: number;
  author_id: string;
  approval_id: string | null;
  training: boolean; // §06 eğitim alanı etiketi
}

export interface FactorRef {
  id: string;
  version: string;
}

export interface CalculationRun {
  id: string;
  tenant_id: string;
  record_id: string;
  record_version: number;
  factor_refs: FactorRef[];
  method: { id: string; version: string };
  engine_version: string;
  inputs_hash: string;
  created_at: string;
  created_by: string;
  result: CalcResult; // koza_calc çıktısı (değişmez)
  superseded_by: string | null; // T13: yeni koşu eskisini silmez, işaret eder
}

export interface CalcResult {
  engine_version: string;
  method: { id: string; version: string };
  status: "computed" | "review_required" | "blocked";
  blocks: { code: string; field?: string | null; message_tr: string }[];
  warnings: { code: string; message_tr: string }[];
  normalized_activity: { quantity: string; unit: string; basis: string | null } | null;
  components: {
    gas: string;
    factor_id: string;
    factor_version: string;
    mass_kg: string;
    gwp: string | null;
    gwp_applied: boolean;
    co2e_kg: string;
  }[];
  total_co2e_kg: string | null;
  coverage: "co2_only" | "partial_ghg" | "full_ghg" | "co2e_factor" | null;
  claim_tr: string;
  boundary: string | null;
  trace: Record<string, unknown>[];
  inputs_hash: string;
}

export interface Approval {
  id: string;
  tenant_id: string;
  record_id: string;
  record_version: number;
  run_id: string;
  decision: "approved" | "changes_requested";
  reason: string;
  decided_by: string;
  at: string;
  invalidated_at: string | null; // veri değişirse önceki onay geçersizleşir (§21)
  invalidation_reason: string | null;
}

export interface ReportSnapshot {
  id: string;
  tenant_id: string;
  period_id: string;
  version: number;
  created_at: string;
  created_by: string;
  manifest: ReportManifest;
  manifest_sha256: string;
  supersedes: string | null;
  reason: string | null;
}

export interface ReportManifest {
  period: { id: string; start: string; end: string };
  tenant: { id: string; name: string; profile_id: string; profile_version: string };
  records: {
    record_id: string;
    version: number;
    state: RecordState;
    run_id: string | null;
    inputs_hash: string | null;
    factor_refs: FactorRef[];
    total_co2e_kg: string | null;
    coverage: string | null;
    data_quality: DataQuality;
    quantity_state: ValueState;
  }[];
  method: { id: string; version: string } | null;
  engine_version: string | null;
  totals: {
    approved_co2e_kg: string | null; // yalnız onaylı kayıtlar; eksik varsa "hesaplanan envanter toplamı"
    approved_record_count: number;
    non_approved_record_count: number;
    blocked_record_count: number;
    label_tr: string;
  };
  sources_expected: number;
  sources_with_records: number;
  gaps_tr: string[];
}

export interface Task {
  id: string;
  tenant_id: string;
  title: string;
  detail: string;
  kind: "missing_info" | "expert_decision" | "duplicate_review" | "reopen_request" | "content";
  related_record_id: string | null;
  status: "open" | "done";
  created_at: string;
  requirement_ids: string[];
}

export interface AuditEvent {
  id: string;
  tenant_id: string;
  at: string;
  actor_id: string;
  actor_role: Role;
  action: string;
  object_type: string;
  object_id: string;
  object_version: number | null;
  reason: string | null;
}

export interface User {
  id: string;
  name: string;
  role: Role;
}

// Önizleme oturumunda kullanılabilen kullanıcılar (rol başına bir kişi; görev ayrılığı için ayrı kimlikler)
export const PREVIEW_USERS: User[] = [
  { id: "u-veri", name: "Ayşe (veri giren)", role: "data_entry" },
  { id: "u-uzman", name: "Mehmet (uzman kontrolör)", role: "reviewer" },
  { id: "u-onay", name: "Zeynep (onaylayan)", role: "approver" },
  { id: "u-yonetici", name: "Kerem (kurum yöneticisi)", role: "admin" },
  { id: "u-izleyici", name: "Denetçi (izleyici)", role: "viewer" },
];

// Yetki matrisi (§04). Sunucu tarafı eşdeğeri apps/api/koza_api/workflow.py.
export const PERMISSIONS: Record<string, Role[]> = {
  "record.create": ["data_entry", "data_owner", "admin"],
  "record.update": ["data_entry", "data_owner", "admin"],
  "record.calculate": ["data_entry", "data_owner", "reviewer", "admin"],
  "record.submit": ["data_entry", "data_owner", "admin"],
  "record.review": ["reviewer", "approver"],
  "record.approve": ["approver"],
  "period.lock": ["admin"],
  "period.reopen": ["admin"],
  "report.create": ["approver", "admin"],
  "factor.publish": ["reviewer"],
  "setup.edit": ["admin", "data_entry"],
  "audit.read": ["admin", "viewer", "reviewer", "approver"],
};

export function can(role: Role, action: string): boolean {
  return (PERMISSIONS[action] ?? []).includes(role);
}

/** Modüller kendi eylem yetkilerini kaydeder (src/modules/<ad>/permissions.ts). Aynı anahtar iki kez verilirse birleştirilir. */
export function registerPermissions(perms: Record<string, Role[]>): void {
  for (const [k, roles] of Object.entries(perms)) {
    PERMISSIONS[k] = Array.from(new Set([...(PERMISSIONS[k] ?? []), ...roles]));
  }
}

// Durum geçişleri (§21): sunucu tarafı denetlenir; burada aynı tablo önizleme için.
export const TRANSITIONS: Record<RecordState, RecordState[]> = {
  draft: ["validation_required", "calculated", "in_review"],
  validation_required: ["draft", "calculated"],
  calculated: ["in_review", "draft", "validation_required"],
  in_review: ["approved", "changes_requested"],
  changes_requested: ["draft", "calculated", "in_review"],
  approved: ["locked", "validation_required"],
  locked: [],
};
