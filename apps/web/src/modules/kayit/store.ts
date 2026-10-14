// kayit modülü deposu — saf fonksiyonlar (s: Store, …). Tablolar:
//   kayit/category_assessment  Kapsam 3 kategori uygulanabilirliği (T10: eksik veri = bilinmiyor, asla sıfır)
//   kayit/lifetime_groups      Kategori 11 satış grubu kayıtları (T12)
//   kayit/source_meta          Kaynak ek bilgisi (şebeke bölgesi, gazlar, Kapsam 3 kategorisi)
//   kayit/imports              İçe aktarma işleri (durum, sayımlar, satır karmaları, oluşan kayıtlar)
// Hesap yok; yalnız iş kuralı ve veri (kural 1).
import { SCOPE3_CATEGORIES, type ActivityRecord, type ActivityRecordVersion, type EmissionSource } from "@/lib/domain";
import { StoreError, type ModuleRow, type Store } from "@/lib/store";
import { DETAIL_SCHEMA_VERSION, getPath, schemaOf, validateDetail, type RecordSchema } from "./schemas";

export const MODULE = "kayit";

export type Applicability = "applicable" | "not_applicable" | "unknown";
export interface CategoryAssessmentRow extends ModuleRow {
  category: number;
  state: Applicability;
  reason: string | null;
  note: string;
}
export interface LifetimeGroupRow extends ModuleRow {
  group_id: string;
  sale_year: string;
  record_id: string;
}
export interface SourceMetaRow extends ModuleRow {
  source_id: string;
  grid_region: string | null;
  gases: string[];
  scope3_category: number | null;
}
export interface ImportRowResult {
  row: number; // 1 tabanlı veri satırı (başlık hariç)
  hash: string;
  status: "created" | "skipped_existing" | "error";
  reason: string | null;
  record_id: string | null;
}
export interface ImportJobRow extends ModuleRow {
  file_name: string;
  file_sha256: string;
  schema_key: string;
  status: "done" | "rolled_back";
  row_count: number;
  ok_count: number;
  skipped_count: number;
  error_count: number;
  rows: ImportRowResult[];
  mapping: Record<string, string>;
  rolled_back_at: string | null;
  rolled_back_record_ids: string[];
}

// ---------- Kategori değerlendirmesi (T10) ----------
/** 15 kategorinin güncel durumu; kaydı olmayan kategori 'unknown' (sıfır değil). */
export function categoryAssessments(s: Store): Record<number, CategoryAssessmentRow | { category: number; state: "unknown"; reason: null; note: string }> {
  const rows = s.rows<CategoryAssessmentRow>(MODULE, "category_assessment");
  const out: Record<number, CategoryAssessmentRow | { category: number; state: "unknown"; reason: null; note: string }> = {};
  for (const c of SCOPE3_CATEGORIES) out[c.n] = { category: c.n, state: "unknown", reason: null, note: "Değerlendirilmedi — veri eksik; sıfır değil." };
  for (const r of rows) out[r.category] = r; // ekleme sırası = zaman; son satır geçerli
  return out;
}
export function assessCategory(s: Store, category: number, state: Applicability, reason: string | null, note = ""): CategoryAssessmentRow {
  s.require("kayit.category.assess");
  if (!SCOPE3_CATEGORIES.some((c) => c.n === category)) throw new StoreError("VALIDATION", "Kategori 1–15 aralığında olmalı.", 422);
  if (state === "not_applicable" && !(reason ?? "").trim()) {
    throw new StoreError("CATEGORY_NA_REASON_REQUIRED", "Kategori 'uygulanamaz' işaretlenirken gerekçe zorunlu. Veri eksikliği uygulanamazlık değildir; o durumda 'bilinmiyor' bırakın (T10).", 422);
  }
  // Değişmez: yeni satır (eski karar korunur)
  return s.insert<CategoryAssessmentRow>(MODULE, "category_assessment", { category, state, reason: state === "not_applicable" ? reason : null, note }, "kayit.category.assess");
}

// ---------- Kaynak ek bilgisi ----------
export function sourceMeta(s: Store, source_id: string): SourceMetaRow | null {
  const rows = s.rows<SourceMetaRow>(MODULE, "source_meta").filter((r) => r.source_id === source_id);
  return rows.length ? rows[rows.length - 1] : null;
}
export function setSourceMeta(s: Store, source_id: string, meta: { grid_region?: string | null; gases?: string[]; scope3_category?: number | null }): SourceMetaRow {
  s.require("setup.edit");
  const prev = sourceMeta(s, source_id);
  return s.insert<SourceMetaRow>(MODULE, "source_meta", {
    source_id,
    grid_region: meta.grid_region ?? prev?.grid_region ?? null,
    gases: meta.gases ?? prev?.gases ?? [],
    scope3_category: meta.scope3_category ?? prev?.scope3_category ?? null,
  });
}

// ---------- Kapsam 2: kurumsal toplamda kullanılan yöntem ----------
// Diğer modüller (rapor, toplama) bunu kayıt ayrıntısından okur: detail.scope2_method_used. Değişiklik yeni sürümdür (§21).
export function scope2MethodUsed(s: Store, record_id: string): "location_based" | "market_based" | null {
  const m = s.current(record_id)?.detail?.scope2_method_used;
  return m === "location_based" || m === "market_based" ? m : null;
}
export function setScope2MethodUsed(s: Store, record_id: string, method: "location_based" | "market_based"): void {
  const cur = s.current(record_id);
  s.updateRecord(record_id, cur.version, { detail: { ...(cur.detail ?? {}), scope2_method_used: method } }, `Kurumsal toplamda kullanılan Kapsam 2 yöntemi: ${method}`);
}

// ---------- Kategori 11 satış grubu (T12) ----------
export function lifetimeGroups(s: Store): LifetimeGroupRow[] {
  return s.rows<LifetimeGroupRow>(MODULE, "lifetime_groups");
}
/** Aynı grup kimliği başka bir kayıtla envantere alınmışsa engeller (sonraki yıl yeniden ekleme yok). */
export function assertLifetimeGroupFree(s: Store, group_id: string, sale_year: string, exclude_record: string | null): void {
  const existing = lifetimeGroups(s).find((g) => g.group_id === group_id && g.record_id !== exclude_record);
  if (existing) {
    throw new StoreError("LIFETIME_GROUP_ALREADY_ACCOUNTED", `Satış grubu '${group_id}' ${existing.sale_year} satış yılıyla zaten envantere alındı (kayıt ${existing.record_id}). ${sale_year !== existing.sale_year ? "Sonraki yıl için aynı grup yeniden ömür boyu toplam olarak eklenemez (T12)." : "Aynı grup iki kez eklenemez (T12)."}`, 409, { record_id: existing.record_id });
  }
}
export function registerLifetimeGroup(s: Store, group_id: string, sale_year: string, record_id: string): LifetimeGroupRow {
  assertLifetimeGroupFree(s, group_id, sale_year, record_id);
  return s.insert<LifetimeGroupRow>(MODULE, "lifetime_groups", { group_id, sale_year, record_id }, "kayit.lifetime_group.register");
}

// ---------- Kayıt oluşturma (şema doğrulama + T12 + "bilmiyorum" görevleri) ----------
export type VersionInput = Omit<ActivityRecordVersion, "record_id" | "tenant_id" | "version" | "created_at" | "created_by">;

export interface CreateInput {
  schema_key: string;
  version: Omit<VersionInput, "detail">;
  detail: Record<string, unknown>;
  unknown_fields?: string[]; // "bilmiyorum" denen şema alanları
  training?: boolean;
}

export function schemaOrThrow(key: string): RecordSchema {
  const sc = schemaOf(key);
  if (!sc) throw new StoreError("VALIDATION", `Bilinmeyen kayıt şeması: ${key}`, 422);
  return sc;
}

/** Şemaya göre doğrular, kaydı oluşturur, kat. 11 grubunu kilitler, bilinmeyen alanlar için görev açar. */
export function createKayitRecord(s: Store, input: CreateInput): ActivityRecord {
  const schema = schemaOrThrow(input.schema_key);
  const source: EmissionSource = s.source(input.version.source_id);
  if (!schema.source_types.includes(source.source_type)) {
    throw new StoreError("SOURCE_TYPE_MISMATCH", `Seçilen kaynak '${source.name}' (${source.source_type}) bu kayıt türüyle (${schema.title}) uyuşmuyor.`, 422);
  }
  const unknown_fields = input.unknown_fields ?? [];
  const detail: Record<string, unknown> = { ...input.detail, schema_version: DETAIL_SCHEMA_VERSION, schema_key: schema.key };
  if (schema.scope === 3) detail.scope3 = { ...((detail.scope3 as Record<string, unknown>) ?? {}), category: schema.category };
  for (const k of unknown_fields) setUnknown(detail, k);
  const { missing, unknown } = validateDetail(schema, detail, unknown_fields);
  if (missing.length) {
    throw new StoreError("SCHEMA_FIELD_REQUIRED", `Zorunlu alan eksik: ${missing.map((m) => m.label).join(", ")}. Alanı doldurun ya da 'bilmiyorum' işaretleyin.`, 422, { fields: missing.map((m) => m.key) });
  }
  // Kapsam 3: uygulanamaz gerekçesi (motor da NA_REASON_REQUIRED ile engeller; burada taslak kaydı da engellenir)
  if (schema.scope === 3 && getPath(detail, "scope3.applicability") === "not_applicable" && !String(getPath(detail, "scope3.not_applicable_reason") ?? "").trim()) {
    throw new StoreError("CATEGORY_NA_REASON_REQUIRED", "Kategori 'uygulanamaz' için gerekçe zorunlu (T10).", 422);
  }
  // T12 ön kontrol (kayıt oluşmadan)
  const group_id = schema.category === 11 ? String(getPath(detail, "scope3.sold_products.group_id") ?? "").trim() : "";
  const sale_year = String(getPath(detail, "scope3.sold_products.sale_year") ?? "");
  if (group_id) assertLifetimeGroupFree(s, group_id, sale_year, null);

  const r = s.createRecord({ ...input.version, detail }, input.training ?? false);
  if (group_id) registerLifetimeGroup(s, group_id, sale_year, r.id);
  if (unknown.length) {
    s.createTask({
      title: `Eksik bilgi (${schema.title}): ${unknown.map((u) => u.label).join(", ")}`,
      detail: "Alan 'bilmiyorum' olarak bırakıldı; kayıt taslak olarak korundu. Bilgiyi bulup yeni sürümle tamamlayın (DAT-04, T20).",
      kind: "missing_info",
      related_record_id: r.id,
      requirement_ids: ["DAT-04", "T20", ...schema.requirement_ids.slice(0, 1)],
    });
  }
  return r;
}
function setUnknown(detail: Record<string, unknown>, path: string): void {
  const parts = path.split(".");
  let cur = detail;
  for (const p of parts.slice(0, -1)) {
    const n = cur[p];
    if (!n || typeof n !== "object") cur[p] = {};
    cur = cur[p] as Record<string, unknown>;
  }
  cur[parts[parts.length - 1]] = null;
}

// ---------- İçe aktarma işleri (§11, idempotent + geri alma) ----------
export function importJobs(s: Store): ImportJobRow[] {
  return s.rows<ImportJobRow>(MODULE, "imports");
}
export function activeImportByHash(s: Store, sha256: string): ImportJobRow | undefined {
  return importJobs(s).find((j) => j.file_sha256 === sha256 && j.status !== "rolled_back");
}
/** Etkin (geri alınmamış) işlerde başarıyla kaydedilmiş satır karmaları → kayıt kimliği. */
export function importedRowHashes(s: Store): Map<string, string> {
  const m = new Map<string, string>();
  for (const j of importJobs(s)) {
    if (j.status === "rolled_back") continue;
    for (const r of j.rows) if (r.status === "created" && r.record_id) m.set(r.hash, r.record_id);
  }
  return m;
}
export interface PreparedRow {
  row: number;
  hash: string;
  error: string | null; // doğrulama hatası (satır atlanır)
  existing_record_id: string | null; // aynı karma zaten kaydedilmiş (atlanır, hata değil)
  input: CreateInput | null;
}
export function commitImport(s: Store, file: { name: string; sha256: string }, schema_key: string, mapping: Record<string, string>, prepared: PreparedRow[]): ImportJobRow {
  s.require("kayit.import.run");
  const dup = activeImportByHash(s, file.sha256);
  if (dup) throw new StoreError("IMPORT_DUPLICATE_FILE", `Bu dosya (${dup.file_name}) daha önce içe aktarıldı (iş ${dup.id}); ikinci kez kayıt oluşturulmaz.`, 409, { job_id: dup.id });
  const rows: ImportRowResult[] = [];
  for (const p of prepared) {
    if (p.error || !p.input) {
      rows.push({ row: p.row, hash: p.hash, status: "error", reason: p.error ?? "Satır hazırlanamadı.", record_id: null });
      continue;
    }
    if (p.existing_record_id) {
      rows.push({ row: p.row, hash: p.hash, status: "skipped_existing", reason: "Aynı satır daha önce kaydedildi; ikinci kayıt oluşturulmadı.", record_id: p.existing_record_id });
      continue;
    }
    try {
      const r = createKayitRecord(s, p.input);
      rows.push({ row: p.row, hash: p.hash, status: "created", reason: null, record_id: r.id });
    } catch (e) {
      const msg = e instanceof StoreError ? `${e.code}: ${e.message}` : String((e as Error)?.message ?? e);
      rows.push({ row: p.row, hash: p.hash, status: "error", reason: msg, record_id: null });
    }
  }
  return s.insert<ImportJobRow>(MODULE, "imports", {
    file_name: file.name,
    file_sha256: file.sha256,
    schema_key,
    status: "done",
    row_count: prepared.length,
    ok_count: rows.filter((r) => r.status === "created").length,
    skipped_count: rows.filter((r) => r.status === "skipped_existing").length,
    error_count: rows.filter((r) => r.status === "error").length,
    rows,
    mapping,
    rolled_back_at: null,
    rolled_back_record_ids: [],
  }, "kayit.import.run");
}

/** Geri alma: yalnız hâlâ taslak (draft / validation_required, hesap koşusu yok) kayıtlar silinir; onaylı/incelemede olanlar dokunulmaz. */
export function rollbackImport(s: Store, job_id: string): { deleted: string[]; kept: { record_id: string; state: string }[] } {
  s.require("kayit.import.rollback");
  const job = s.row<ImportJobRow>(MODULE, "imports", job_id);
  if (job.status === "rolled_back") throw new StoreError("INVALID_TRANSITION", "Bu içe aktarma zaten geri alındı.", 409);
  const deleted: string[] = [];
  const kept: { record_id: string; state: string }[] = [];
  for (const r of job.rows) {
    if (r.status !== "created" || !r.record_id) continue;
    const rec = s.records().find((x) => x.id === r.record_id);
    if (!rec) continue;
    const stillDraft = (rec.state === "draft" || rec.state === "validation_required") && s.runsOf(rec.id).length === 0;
    if (!stillDraft) {
      kept.push({ record_id: rec.id, state: rec.state });
      continue;
    }
    // Önizleme deposunda silme işlemi: kayıt + sürümleri; audit izi kalır (üretimde apps/api soft-delete)
    s.db.records = s.db.records.filter((x) => x.id !== rec.id);
    s.db.versions = s.db.versions.filter((x) => x.record_id !== rec.id);
    s.db.modules[MODULE]!.lifetime_groups = (s.db.modules[MODULE]?.lifetime_groups ?? []).filter((g) => g.record_id !== rec.id);
    for (const t of s.tasks()) if (t.related_record_id === rec.id && t.status === "open") t.status = "done";
    s.audit("kayit.import.rollback.delete_draft", "activity_record", rec.id, rec.current_version, `içe aktarma ${job.id} geri alındı`);
    deleted.push(rec.id);
  }
  if (!deleted.length && !kept.length) throw new StoreError("IMPORT_NOT_REVERSIBLE", "Bu işin oluşturduğu kayıt yok.", 409);
  s.update<ImportJobRow>(MODULE, "imports", job.id, { status: "rolled_back", rolled_back_at: new Date().toISOString(), rolled_back_record_ids: deleted }, `geri alındı: ${deleted.length} taslak silindi, ${kept.length} kayıt korundu`);
  return { deleted, kept };
}
