// Önizleme deposu.
//
// Üretimde bu katman apps/api (/v1) ve PostgreSQL RLS'dir. Statik önizlemede sunucu olmadığı
// için aynı iş kuralları (durum makinesi, sürüm çakışması, görev ayrılığı, kilitli dönem,
// değişmez hesap koşuları, rapor manifesti) burada, tarayıcı deposunda (localStorage) uygulanır.
// Bu DEMO deposudur: kayıtlar yalnız bu tarayıcıda kalıcıdır ve ekranda böyle etiketlenir
// (kural 10: kalıcı kayıt olmadan başarı mesajı yok → "bu tarayıcıda kaydedildi" denir).
// Yetki kontrolleri burada da yapılır ama kural 4 gereği bunlar sunucu yetkisinin yerine geçmez;
// sunucu tarafı karşılığı apps/api/koza_api/workflow.py ve tests/isolation.

import {
  type ActivityRecord,
  type ActivityRecordVersion,
  type Approval,
  type AuditEvent,
  type CalcResult,
  type CalculationRun,
  type EmissionSource,
  type Evidence,
  type Facility,
  type FactorRef,
  type InventoryBoundary,
  type PeriodReopen,
  type RecordState,
  type ReportManifest,
  type ReportSnapshot,
  type ReportingPeriod,
  type Role,
  type Task,
  type Tenant,
  type User,
  PREVIEW_USERS,
  TRANSITIONS,
  can,
} from "./domain";
import { canonicalJson, newId, sha256Hex } from "./hash";

export interface Db {
  schema: number;
  tenants: Tenant[];
  facilities: Facility[];
  boundaries: InventoryBoundary[];
  periods: ReportingPeriod[];
  reopens: PeriodReopen[];
  sources: EmissionSource[];
  records: ActivityRecord[];
  versions: ActivityRecordVersion[];
  evidence: Evidence[];
  runs: CalculationRun[];
  approvals: Approval[];
  reports: ReportSnapshot[];
  tasks: Task[];
  audit: AuditEvent[];
  publishedFactorVersions: Record<string, string>; // factor id → etkin sürüm (uzman yayımlar; T13)
  setupProgress: Record<string, number>; // tenant → kurulum adımı (§06: kaldığı yerden devam)
  modules: Record<string, Record<string, ModuleRow[]>>; // modül → tablo → satırlar (her satır tenant_id taşır)
}

// Modül tabloları için ortak satır biçimi. Modüller (src/modules/*) kendi tiplerini bunun üzerine kurar.
export interface ModuleRow {
  id: string;
  tenant_id: string;
  created_at: string;
  created_by: string;
  version: number;
  [key: string]: unknown;
}

export interface Session {
  user_id: string;
  tenant_id: string | null;
}

const DB_KEY = "koza.preview.db.v1";
const SESSION_KEY = "koza.preview.session.v1";

export class StoreError extends Error {
  code: string;
  status: number;
  extra?: Record<string, unknown>;
  constructor(code: string, message: string, status = 400, extra?: Record<string, unknown>) {
    super(message);
    this.code = code;
    this.status = status;
    this.extra = extra;
  }
}

function emptyDb(): Db {
  return {
    schema: 1,
    tenants: [],
    facilities: [],
    boundaries: [],
    periods: [],
    reopens: [],
    sources: [],
    records: [],
    versions: [],
    evidence: [],
    runs: [],
    approvals: [],
    reports: [],
    tasks: [],
    audit: [],
    publishedFactorVersions: { "TEST-NG-CO2": "1.0", "TEST-NG-CH4": "1.0", "TEST-NG-N2O": "1.0", "TEST-NG-CO2E-NM3": "1.0", "TEST-NG-UPSTREAM-CO2E": "1.0" },
    setupProgress: {},
    modules: {},
  };
}

export function storageAvailable(): boolean {
  try {
    const k = "__koza_test__";
    localStorage.setItem(k, "1");
    localStorage.removeItem(k);
    return true;
  } catch {
    return false;
  }
}

export function loadDb(): Db {
  try {
    const raw = localStorage.getItem(DB_KEY);
    if (!raw) return emptyDb();
    const parsed = JSON.parse(raw) as Db;
    if (parsed.schema !== 1) return emptyDb();
    return { ...emptyDb(), ...parsed };
  } catch {
    return emptyDb();
  }
}

function saveDb(db: Db): void {
  localStorage.setItem(DB_KEY, JSON.stringify(db));
  window.dispatchEvent(new CustomEvent("koza:db"));
}

export function loadSession(): Session {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (raw) return JSON.parse(raw) as Session;
  } catch {
    /* yoksay */
  }
  return { user_id: PREVIEW_USERS[0].id, tenant_id: null };
}

export function saveSession(s: Session): void {
  localStorage.setItem(SESSION_KEY, JSON.stringify(s));
  window.dispatchEvent(new CustomEvent("koza:db"));
}

export function resetAll(): void {
  localStorage.removeItem(DB_KEY);
  localStorage.removeItem(SESSION_KEY);
  window.dispatchEvent(new CustomEvent("koza:db"));
}

export function currentUser(s: Session): User {
  return PREVIEW_USERS.find((u) => u.id === s.user_id) ?? PREVIEW_USERS[0];
}

const now = () => new Date().toISOString();

// Her işlem aktif kurum bağlamında çalışır. tenant_id istemci parametresi değildir;
// oturumdan türetilir (kural 3'ün önizleme karşılığı).
export class Store {
  db: Db;
  session: Session;
  constructor() {
    this.db = loadDb();
    this.session = loadSession();
  }

  get user(): User {
    return currentUser(this.session);
  }
  get role(): Role {
    return this.user.role;
  }
  get tenantId(): string {
    if (!this.session.tenant_id) throw new StoreError("NO_TENANT", "Önce bir kurum oluşturun veya seçin.", 401);
    return this.session.tenant_id;
  }
  get tenant(): Tenant | null {
    return this.db.tenants.find((t) => t.id === this.session.tenant_id) ?? null;
  }

  /** Yetki kontrolü (rol matrisi). Modüller kendi eylemlerini registerPermissions ile ekler. */
  require(action: string): void {
    if (!can(this.role, action)) {
      throw new StoreError("FORBIDDEN", `Bu işlem için yetkiniz yok (${this.role}). Uygun role sahip bir kullanıcıdan erişim isteyin.`, 403);
    }
  }

  audit(action: string, object_type: string, object_id: string, object_version: number | null = null, reason: string | null = null): void {
    this.db.audit.push({
      id: newId("aud"),
      tenant_id: this.tenantId,
      at: now(),
      actor_id: this.user.id,
      actor_role: this.role,
      action,
      object_type,
      object_id,
      object_version,
      reason,
    });
  }

  commit(): void {
    saveDb(this.db);
  }

  // ---------- Modül tabloları (src/modules/*) ----------
  // Her satır aktif kurumun tenant_id'sini taşır; okuma her zaman aktif kuruma süzülür (kural 3'ün önizleme karşılığı).
  rows<T extends ModuleRow>(module: string, table: string): T[] {
    const t = this.db.modules[module]?.[table] ?? [];
    const tid = this.session.tenant_id;
    return t.filter((r) => r.tenant_id === tid) as T[];
  }
  row<T extends ModuleRow>(module: string, table: string, id: string): T {
    const r = this.rows<T>(module, table).find((x) => x.id === id);
    if (!r) throw new StoreError("NOT_FOUND", "Kayıt bulunamadı.", 404);
    return r;
  }
  insert<T extends ModuleRow>(module: string, table: string, data: Omit<T, "id" | "tenant_id" | "created_at" | "created_by" | "version"> & { id?: string }, auditAction?: string): T {
    const tid = this.tenantId;
    const row = { ...data, id: data.id ?? newId(table.slice(0, 3)), tenant_id: tid, created_at: now(), created_by: this.user.id, version: 1 } as T;
    const m = (this.db.modules[module] ??= {});
    (m[table] ??= []).push(row);
    this.audit(auditAction ?? `${module}.${table}.create`, `${module}.${table}`, row.id, 1);
    this.commit();
    return row;
  }
  /** Yerinde güncelleme; sürüm artar ve audit yazılır. Değişmez olması gereken satırlar için kullanmayın (yeni satır ekleyin). */
  update<T extends ModuleRow>(module: string, table: string, id: string, patch: Partial<T>, reason: string | null = null, expected_version?: number): T {
    const r = this.row<T>(module, table, id);
    if (expected_version !== undefined && r.version !== expected_version) {
      throw new StoreError("VERSION_CONFLICT", `Kayıt bu arada değişti (güncel sürüm ${r.version}, sizde ${expected_version}). Diğer sürümü görüp tekrar deneyin; veriniz ezilmedi.`, 409, { current_version: r.version });
    }
    Object.assign(r, patch, { version: r.version + 1 });
    this.audit(`${module}.${table}.update`, `${module}.${table}`, id, r.version, reason);
    this.commit();
    return r;
  }

  // ---------- Kurum ve kurulum (ONB-01..03, SEK-01, SEK-05) ----------

  createTenant(input: { name: string; country: string; nace_code: string | null; profile_id: string; profile_version: string }): Tenant {
    const t: Tenant = {
      id: newId("org"),
      name: input.name.trim(),
      country: input.country,
      nace_code: input.nace_code,
      profile_id: input.profile_id,
      profile_version: input.profile_version,
      profile_confirmed: false,
      created_at: now(),
      policy: { allow_self_approval: false, self_approval_reason: null },
    };
    this.db.tenants.push(t);
    this.session.tenant_id = t.id;
    saveSession(this.session);
    this.audit("tenant.create", "organization", t.id);
    this.commit();
    return t;
  }

  switchTenant(id: string): void {
    if (!this.db.tenants.some((t) => t.id === id)) throw new StoreError("NOT_FOUND", "Kurum bulunamadı.", 404);
    this.session.tenant_id = id;
    saveSession(this.session);
  }

  switchUser(id: string): void {
    this.session.user_id = id;
    saveSession(this.session);
  }

  confirmProfile(profile_id: string, profile_version: string): void {
    this.require("setup.edit");
    const t = this.tenant!;
    t.profile_id = profile_id;
    t.profile_version = profile_version;
    t.profile_confirmed = true;
    this.audit("tenant.profile_confirm", "organization", t.id, null, `${profile_id}@${profile_version}`);
    this.commit();
  }

  /** Görev ayrılığı istisnası (§04): gerekçe, izin veren ve süre kaydedilir; raporda görünür. */
  setPolicy(input: { allow_self_approval: boolean; reason: string; until: string | null }): void {
    this.require("setup.edit");
    if (this.role !== "admin") throw new StoreError("FORBIDDEN", "Kurum politikasını yalnız kurum yöneticisi değiştirir.", 403);
    const t = this.tenant!;
    if (input.allow_self_approval && input.reason.trim().length < 10) throw new StoreError("VALIDATION", "İstisna gerekçesi en az 10 karakter olmalı.", 422);
    t.policy = { allow_self_approval: input.allow_self_approval, self_approval_reason: input.allow_self_approval ? `${input.reason} (izin veren: ${this.user.id}; süre: ${input.until ?? "belirsiz"})` : null };
    this.audit("tenant.policy", "organization", t.id, null, t.policy.self_approval_reason ?? "istisna kapatıldı");
    this.commit();
  }

  setSetupStep(step: number): void {
    this.db.setupProgress[this.tenantId] = step;
    this.commit();
  }
  getSetupStep(): number {
    return this.db.setupProgress[this.tenantId] ?? 0;
  }

  addFacility(input: { name: string; city: string; profile_id: string | null }): Facility {
    this.require("setup.edit");
    const f: Facility = { id: newId("fac"), tenant_id: this.tenantId, name: input.name.trim(), city: input.city.trim(), profile_id: input.profile_id };
    this.db.facilities.push(f);
    this.audit("facility.create", "facility", f.id);
    this.commit();
    return f;
  }
  facilities(): Facility[] {
    return this.db.facilities.filter((f) => f.tenant_id === this.tenantId);
  }

  setBoundary(input: { approach: InventoryBoundary["approach"]; note: string }): InventoryBoundary {
    this.require("setup.edit");
    const prev = this.boundary();
    const b: InventoryBoundary = {
      id: newId("bnd"),
      tenant_id: this.tenantId,
      version: (prev?.version ?? 0) + 1,
      approach: input.approach,
      note: input.note,
      status: input.approach === "unknown" ? "pending_expert" : "draft",
    };
    this.db.boundaries.push(b);
    if (input.approach === "unknown") {
      this.createTask({
        title: "Envanter sınırı yaklaşımını belirle",
        detail: "Kullanıcı kontrol/özkaynak yaklaşımını bilmiyor. Uzman kararı olmadan sınır kesinleşmez (ONB-02). Taslak profil açık kaldı.",
        kind: "expert_decision",
        related_record_id: null,
        requirement_ids: ["ONB-02"],
      });
    }
    this.audit("boundary.set", "inventory_boundary", b.id, b.version);
    this.commit();
    return b;
  }
  boundary(): InventoryBoundary | null {
    const list = this.db.boundaries.filter((b) => b.tenant_id === this.tenantId);
    return list.length ? list[list.length - 1] : null;
  }

  addPeriod(input: { start: string; end: string }): ReportingPeriod {
    this.require("setup.edit");
    if (!(input.start < input.end)) throw new StoreError("VALIDATION", "Dönem bitişi başlangıçtan sonra olmalı.", 422);
    const p: ReportingPeriod = { id: newId("per"), tenant_id: this.tenantId, start: input.start, end: input.end, status: "open", locked_at: null, locked_by: null };
    this.db.periods.push(p);
    this.audit("period.create", "reporting_period", p.id);
    this.commit();
    return p;
  }
  periods(): ReportingPeriod[] {
    return this.db.periods.filter((p) => p.tenant_id === this.tenantId);
  }
  period(id: string): ReportingPeriod {
    const p = this.db.periods.find((p) => p.tenant_id === this.tenantId && p.id === id);
    if (!p) throw new StoreError("NOT_FOUND", "Dönem bulunamadı.", 404);
    return p;
  }

  addSource(input: Omit<EmissionSource, "id" | "tenant_id">): EmissionSource {
    this.require("setup.edit");
    const s: EmissionSource = { id: newId("src"), tenant_id: this.tenantId, ...input };
    this.db.sources.push(s);
    this.audit("source.create", "emission_source", s.id);
    this.commit();
    return s;
  }
  sources(): EmissionSource[] {
    return this.db.sources.filter((s) => s.tenant_id === this.tenantId);
  }
  source(id: string): EmissionSource {
    const s = this.db.sources.find((s) => s.tenant_id === this.tenantId && s.id === id);
    if (!s) throw new StoreError("NOT_FOUND", "Kaynak bulunamadı.", 404);
    return s;
  }

  // ---------- Görevler ----------
  createTask(input: Omit<Task, "id" | "tenant_id" | "status" | "created_at">): Task {
    const t: Task = { id: newId("tsk"), tenant_id: this.tenantId, status: "open", created_at: now(), ...input };
    this.db.tasks.push(t);
    this.audit("task.create", "task", t.id);
    this.commit();
    return t;
  }
  tasks(): Task[] {
    return this.db.tasks.filter((t) => t.tenant_id === this.tenantId);
  }
  completeTask(id: string): void {
    const t = this.tasks().find((t) => t.id === id);
    if (!t) throw new StoreError("NOT_FOUND", "Görev bulunamadı.", 404);
    t.status = "done";
    this.audit("task.complete", "task", t.id);
    this.commit();
  }

  // ---------- Kanıt (DAT-02, T07) ----------
  async addEvidence(file: File): Promise<{ evidence: Evidence; duplicates: Evidence[] }> {
    this.require("record.create");
    const buf = await file.arrayBuffer();
    const sha256 = await sha256Hex(buf);
    const duplicates = this.db.evidence.filter((e) => e.tenant_id === this.tenantId && e.sha256 === sha256);
    const ev: Evidence = {
      id: newId("evd"),
      tenant_id: this.tenantId,
      file_name: file.name,
      size_bytes: file.size,
      sha256,
      mime: file.type || "application/octet-stream",
      uploaded_at: now(),
      uploaded_by: this.user.id,
      stored: false,
    };
    this.db.evidence.push(ev);
    this.audit("evidence.register", "evidence", ev.id, null, duplicates.length ? "duplicate_candidate" : null);
    this.commit();
    return { evidence: ev, duplicates };
  }
  evidence(id: string): Evidence | undefined {
    return this.db.evidence.find((e) => e.tenant_id === this.tenantId && e.id === id);
  }

  // ---------- Kayıtlar (DAT-01..06, §21) ----------
  records(): ActivityRecord[] {
    return this.db.records.filter((r) => r.tenant_id === this.tenantId);
  }
  record(id: string): ActivityRecord {
    const r = this.db.records.find((r) => r.tenant_id === this.tenantId && r.id === id);
    if (!r) throw new StoreError("NOT_FOUND", "Kayıt bulunamadı.", 404); // yabancı kurum kaydı da 404 (§27)
    return r;
  }
  versionsOf(record_id: string): ActivityRecordVersion[] {
    return this.db.versions.filter((v) => v.tenant_id === this.tenantId && v.record_id === record_id).sort((a, b) => a.version - b.version);
  }
  current(record_id: string): ActivityRecordVersion {
    const vs = this.versionsOf(record_id);
    const v = vs[vs.length - 1];
    if (v && v.detail === undefined) v.detail = null; // şema 1 kayıtları (detail alanı yok)
    return v;
  }

  private assertPeriodOpen(period_id: string): void {
    const p = this.period(period_id);
    if (p.status === "locked") {
      throw new StoreError("PERIOD_LOCKED", "Bu dönem kilitli. Düzenleme için yetkili yeniden açma akışı gerekir (Dönem sayfası).", 409, { period_id });
    }
  }

  private duplicateCandidates(v: Omit<ActivityRecordVersion, "record_id" | "tenant_id" | "version" | "created_at" | "created_by">, exclude_record: string | null): ActivityRecord[] {
    // §11: aynı belge karması, fatura numarası, tedarikçi, kaynak ve dönem → mükerrerlik adayı
    const hashes = new Set(v.evidence_ids.map((id) => this.evidence(id)?.sha256).filter(Boolean));
    const out: ActivityRecord[] = [];
    for (const r of this.records()) {
      if (r.id === exclude_record) continue;
      const cv = this.current(r.id);
      const sameInvoice = v.invoice_no && cv.invoice_no && v.invoice_no.trim() === cv.invoice_no.trim() && (v.supplier ?? "") === (cv.supplier ?? "");
      const samePeriodSource = cv.source_id === v.source_id && cv.period_start === v.period_start && cv.period_end === v.period_end && cv.quantity === v.quantity && cv.unit === v.unit && v.quantity !== null;
      const sameHash = cv.evidence_ids.some((id) => hashes.has(this.evidence(id)?.sha256));
      if (sameInvoice || samePeriodSource || sameHash) out.push(r);
    }
    return out;
  }

  checkDuplicates(input: Omit<ActivityRecordVersion, "record_id" | "tenant_id" | "version" | "created_at" | "created_by">, exclude_record: string | null): ActivityRecord[] {
    return this.duplicateCandidates(input, exclude_record);
  }

  createRecord(input: Omit<ActivityRecordVersion, "record_id" | "tenant_id" | "version" | "created_at" | "created_by">, training = false): ActivityRecord {
    this.require("record.create");
    this.assertPeriodOpen(input.period_id);
    this.source(input.source_id);
    const dups = this.duplicateCandidates(input, null);
    if (dups.length && !input.duplicate_override_reason) {
      throw new StoreError("DUPLICATE_CANDIDATE", "Bu kayıt mevcut bir kayıtla aynı belge, fatura veya dönem/miktar bilgisini taşıyor. Gerçekten ayrı bir işlemse gerekçe yazarak devam edin.", 409, {
        duplicates: dups.map((d) => d.id),
      });
    }
    const r: ActivityRecord = { id: newId("act"), tenant_id: this.tenantId, state: "draft", current_version: 1, author_id: this.user.id, approval_id: null, training };
    const v: ActivityRecordVersion = { ...input, record_id: r.id, tenant_id: this.tenantId, version: 1, created_at: now(), created_by: this.user.id, change_reason: null };
    this.db.records.push(r);
    this.db.versions.push(v);
    this.audit("record.create", "activity_record", r.id, 1);
    if (dups.length) {
      this.createTask({ title: "Mükerrer aday kayıt gerekçesiyle devam etti", detail: `Gerekçe: ${input.duplicate_override_reason}`, kind: "duplicate_review", related_record_id: r.id, requirement_ids: ["T07"] });
    }
    this.applyMissingInfoTasks(r, v);
    this.deriveState(r, v);
    this.commit();
    return r;
  }

  updateRecord(record_id: string, expected_version: number, patch: Partial<Omit<ActivityRecordVersion, "record_id" | "tenant_id" | "version" | "created_at" | "created_by">>, change_reason: string): ActivityRecordVersion {
    this.require("record.update");
    const r = this.record(record_id);
    const cur = this.current(record_id);
    if (r.state === "locked") throw new StoreError("PERIOD_LOCKED", "Kilitli dönemdeki kayıt değiştirilemez; yeniden açma akışı gerekir.", 409);
    this.assertPeriodOpen(cur.period_id);
    if (cur.version !== expected_version) {
      throw new StoreError("VERSION_CONFLICT", `Kayıt bu arada değişti (güncel sürüm ${cur.version}, sizde ${expected_version}). Diğer sürümü görüp tekrar deneyin; veriniz ezilmedi.`, 409, { current_version: cur.version });
    }
    if (!change_reason.trim()) throw new StoreError("VALIDATION", "Değişiklik gerekçesi zorunlu.", 422);
    const nv: ActivityRecordVersion = { ...cur, ...patch, version: cur.version + 1, created_at: now(), created_by: this.user.id, change_reason };
    this.db.versions.push(nv);
    r.current_version = nv.version;
    // Veri değişirse önceki onay geçersizleşir (§21)
    if (r.approval_id) {
      const ap = this.db.approvals.find((a) => a.id === r.approval_id);
      if (ap && !ap.invalidated_at) {
        ap.invalidated_at = now();
        ap.invalidation_reason = `Kayıt v${nv.version} ile değişti: ${change_reason}`;
      }
      r.approval_id = null;
      this.audit("approval.invalidate", "activity_record", r.id, nv.version, change_reason);
    }
    this.audit("record.update", "activity_record", r.id, nv.version, change_reason);
    this.applyMissingInfoTasks(r, nv);
    this.deriveState(r, nv);
    this.commit();
    return nv;
  }

  private applyMissingInfoTasks(r: ActivityRecord, v: ActivityRecordVersion): void {
    const open = this.tasks().filter((t) => t.related_record_id === r.id && t.kind === "missing_info" && t.status === "open");
    const needs: string[] = [];
    if (v.quantity_state === "unknown") needs.push("miktar");
    if (!v.unit) needs.push("birim");
    if (v.unit && ["GJ", "MJ", "kWh", "MWh"].includes(v.unit) && !v.heating_value_basis) needs.push("ısıl değer esası (alt/üst)");
    if (v.unit === "m3" && !v.reference_conditions) needs.push("hacim koşulları (sıcaklık/basınç) veya faturadaki Sm³/Nm³ bilgisi");
    if (needs.length && open.length === 0) {
      this.createTask({
        title: `Eksik bilgi: ${needs.join(", ")}`,
        detail: "Kayıt taslak olarak korundu (T20). Faturadaki ilgili alanı bulup tamamlayın; emin değilseniz uzman kontrolüne işaretleyin.",
        kind: "missing_info",
        related_record_id: r.id,
        requirement_ids: ["T20", "DAT-04"],
      });
    }
    if (!needs.length) for (const t of open) t.status = "done";
  }

  private deriveState(r: ActivityRecord, v: ActivityRecordVersion): void {
    // Taslak → doğrulama gerekli: zorunlu alan eksikse. Hesap yapılmadan "hesaplandı" olmaz.
    if (["in_review", "approved", "locked"].includes(r.state)) {
      // onaylı kayıt değiştiyse tekrar doğrulama gerekir
      if (r.state === "approved") this.transition(r, "validation_required", "Onaylı kayıt değişti; yeniden inceleme gerekli.");
      return;
    }
    const missing = v.quantity_state === "unknown" || !v.unit;
    r.state = missing ? "validation_required" : "draft";
  }

  private transition(r: ActivityRecord, to: RecordState, reason: string | null): void {
    if (!TRANSITIONS[r.state].includes(to)) {
      throw new StoreError("INVALID_TRANSITION", `'${r.state}' durumundan '${to}' durumuna geçilemez.`, 409);
    }
    const from = r.state;
    r.state = to;
    this.audit(`record.state:${from}->${to}`, "activity_record", r.id, r.current_version, reason);
  }

  // ---------- Hesap (DAT-05, §18, T13) ----------
  saveRun(record_id: string, result: CalcResult, factor_refs: FactorRef[], method: { id: string; version: string }): CalculationRun {
    this.require("record.calculate");
    const r = this.record(record_id);
    const cur = this.current(record_id);
    this.assertPeriodOpen(cur.period_id);
    const run: CalculationRun = {
      id: newId("run"),
      tenant_id: this.tenantId,
      record_id,
      record_version: cur.version,
      factor_refs,
      method,
      engine_version: result.engine_version,
      inputs_hash: result.inputs_hash,
      created_at: now(),
      created_by: this.user.id,
      result,
      superseded_by: null,
    };
    // Eski koşu silinmez; yalnız "yerine geçen" işareti alır (T13, kural 9)
    for (const old of this.runsOf(record_id)) if (!old.superseded_by) old.superseded_by = run.id;
    this.db.runs.push(run);
    this.audit("calculation.run", "calculation_run", run.id, null, `${result.status}; faktör ${factor_refs.map((f) => `${f.id}@${f.version}`).join(",")}`);
    if (result.status !== "blocked" && (r.state === "draft" || r.state === "validation_required" || r.state === "changes_requested")) {
      this.transition(r, "calculated", null);
    }
    this.commit();
    return run;
  }
  runsOf(record_id: string): CalculationRun[] {
    return this.db.runs.filter((x) => x.tenant_id === this.tenantId && x.record_id === record_id);
  }
  latestRun(record_id: string): CalculationRun | null {
    const rs = this.runsOf(record_id).filter((x) => !x.superseded_by);
    return rs.length ? rs[rs.length - 1] : null;
  }

  publishFactorVersion(factor_id: string, version: string): { affected: ActivityRecord[] } {
    this.require("factor.publish");
    const prev = this.db.publishedFactorVersions[factor_id];
    this.db.publishedFactorVersions[factor_id] = version;
    // Etkilenen kayıtlar: eski sürümle koşusu olanlar. Sonuçlar DEĞİŞMEZ; yeni koşu önerilir (T13).
    const affected = this.records().filter((r) => this.latestRun(r.id)?.factor_refs.some((f) => f.id === factor_id && f.version !== version));
    this.audit("factor.publish", "factor_version", `${factor_id}@${version}`, null, `önceki ${prev}; etkilenen kayıt ${affected.length}`);
    this.commit();
    return { affected };
  }
  publishedVersion(factor_id: string): string | undefined {
    return this.db.publishedFactorVersions[factor_id];
  }

  // ---------- İnceleme ve onay (§21, T17, görev ayrılığı) ----------
  submit(record_id: string): void {
    this.require("record.submit");
    const r = this.record(record_id);
    const run = this.latestRun(record_id);
    if (!run || run.record_version !== r.current_version) throw new StoreError("CALC_REQUIRED", "Kontrole göndermeden önce güncel sürüm için hesap çalıştırılmalı.", 409);
    if (run.result.status === "blocked") throw new StoreError("CALC_BLOCKED", "Hesap engellendi; engel çözülmeden kontrole gönderilemez.", 409);
    const cur = this.current(record_id);
    if (!cur.evidence_ids.length) {
      // Eksik kanıt politikası: açık eksikle gönderilir, görev açılır (§21)
      this.createTask({ title: "Kanıt eksik", detail: "Kayıt kanıtsız kontrole gönderildi; inceleyen eksik kanıtla onay veremez.", kind: "missing_info", related_record_id: r.id, requirement_ids: ["§21"] });
    }
    this.transition(r, "in_review", null);
    this.commit();
  }

  decide(record_id: string, decision: "approved" | "changes_requested", reason: string): Approval {
    this.require(decision === "approved" ? "record.approve" : "record.review");
    const r = this.record(record_id);
    if (r.state !== "in_review") throw new StoreError("INVALID_TRANSITION", "Kayıt incelemede değil.", 409);
    const run = this.latestRun(record_id);
    if (!run) throw new StoreError("CALC_REQUIRED", "Hesap koşusu yok.", 409);
    if (!reason.trim()) throw new StoreError("VALIDATION", "Karar gerekçesi zorunlu.", 422);
    if (decision === "approved") {
      const t = this.tenant!;
      if (r.author_id === this.user.id && !t.policy.allow_self_approval) {
        throw new StoreError("SEPARATION_OF_DUTIES", "Kendi girdiğiniz kaydı onaylayamazsınız. Kurum politikası (küçük ekip istisnası) gerekçe ve süreyle açılmadıkça veri giren ile onaylayan farklı olmalı (§04).", 403);
      }
      const cur = this.current(record_id);
      if (!cur.evidence_ids.length) throw new StoreError("EVIDENCE_REQUIRED", "Kanıtsız kayıt onaylanamaz; düzeltme isteyin.", 409);
      if (run.result.status === "review_required" && !reason.toLowerCase().includes("inceledim")) {
        throw new StoreError("REVIEW_ACK_REQUIRED", "Bu hesap 'inceleme gerekli' durumunda (esas dönüşümü veya tahmini veri). Gerekçede neyi incelediğinizi yazın ('inceledim' ifadesiyle).", 422);
      }
    }
    const ap: Approval = { id: newId("apr"), tenant_id: this.tenantId, record_id, record_version: r.current_version, run_id: run.id, decision, reason, decided_by: this.user.id, at: now(), invalidated_at: null, invalidation_reason: null };
    this.db.approvals.push(ap);
    if (decision === "approved") {
      r.approval_id = ap.id;
      this.transition(r, "approved", reason);
    } else {
      this.transition(r, "changes_requested", reason);
    }
    this.audit(`approval.${decision}`, "approval", ap.id, r.current_version, reason);
    this.commit();
    return ap;
  }
  approvalsOf(record_id: string): Approval[] {
    return this.db.approvals.filter((a) => a.tenant_id === this.tenantId && a.record_id === record_id);
  }

  // ---------- Dönem kapanışı (§21, T17) ----------
  closeChecklist(period_id: string) {
    const p = this.period(period_id);
    const recs = this.records().map((r) => ({ r, v: this.current(r.id) })).filter((x) => x.v.period_id === p.id);
    const srcs = this.sources().filter((s) => s.source_type === "stationary_combustion" && s.fuel === "natural_gas");
    const sourcesWithRecords = new Set(recs.map((x) => x.v.source_id));
    return {
      period: p,
      expected_sources: srcs,
      missing_sources: srcs.filter((s) => !sourcesWithRecords.has(s.id)),
      records: recs,
      not_approved: recs.filter((x) => x.r.state !== "approved" && x.r.state !== "locked"),
      estimated: recs.filter((x) => x.v.data_quality === "estimated"),
      open_tasks: this.tasks().filter((t) => t.status === "open"),
    };
  }

  /** Uzlaştırma (§21): aynı kaynakta dönemleri çakışan kayıtlar (sayaç + fatura toplanmaz, §12) ve miktar farkları. Fark otomatik kötü performans değildir. */
  reconciliation(period_id: string): { source_id: string; source_name: string; records: { id: string; period_start: string; period_end: string; quantity: string | null; unit: string | null; data_quality: string }[]; note_tr: string }[] {
    const p = this.period(period_id);
    const bySource = new Map<string, ActivityRecordVersion[]>();
    for (const r of this.records()) {
      const v = this.current(r.id);
      if (v.period_id !== p.id) continue;
      (bySource.get(v.source_id) ?? bySource.set(v.source_id, []).get(v.source_id)!).push(v);
    }
    const out: ReturnType<Store["reconciliation"]> = [];
    for (const [sid, vs] of bySource) {
      if (vs.length < 2) continue;
      const overlapping = vs.some((a) => vs.some((b) => a !== b && a.period_start <= b.period_end && b.period_start <= a.period_end));
      if (!overlapping) continue;
      const src = this.db.sources.find((s) => s.id === sid);
      out.push({
        source_id: sid,
        source_name: src?.name ?? sid,
        records: vs.map((v) => ({ id: v.record_id, period_start: v.period_start, period_end: v.period_end, quantity: v.quantity, unit: v.unit, data_quality: v.data_quality })),
        note_tr: "Aynı kaynakta dönemleri çakışan birden fazla kayıt var. Sayaç ve fatura birlikte varsa ikisi toplanmaz; dönem kayması, ölçüm sınırı ve veri eksiği ayrı açıklanır (§21). Birini gerekçeyle düzeltin veya ayrı dönemlere bölün.",
      });
    }
    return out;
  }

  lockPeriod(period_id: string, force_note: string | null): void {
    this.require("period.lock");
    const c = this.closeChecklist(period_id);
    if (c.period.status === "locked") throw new StoreError("INVALID_TRANSITION", "Dönem zaten kilitli.", 409);
    if (c.not_approved.length && !force_note) {
      throw new StoreError("CLOSE_BLOCKED", `${c.not_approved.length} kayıt onaylı değil. Onaylı olmayan kayıtlar toplamda onaylı veri olarak görünmez; yine de kilitlemek için açık eksik notu yazın.`, 409);
    }
    c.period.status = "locked";
    c.period.locked_at = now();
    c.period.locked_by = this.user.id;
    for (const x of c.records) if (x.r.state === "approved") this.transition(x.r, "locked", "Dönem kilitlendi");
    this.audit("period.lock", "reporting_period", period_id, null, force_note);
    this.commit();
  }

  reopenPeriod(period_id: string, reason: string, impact_note: string): void {
    this.require("period.reopen");
    const p = this.period(period_id);
    if (p.status !== "locked") throw new StoreError("INVALID_TRANSITION", "Dönem kilitli değil.", 409);
    if (reason.trim().length < 10 || impact_note.trim().length < 10) throw new StoreError("VALIDATION", "Gerekçe ve etki analizi zorunlu (en az 10 karakter).", 422);
    this.db.reopens.push({ id: newId("rop"), tenant_id: this.tenantId, period_id, reason, impact_note, requested_by: this.user.id, at: now() });
    p.status = "open";
    for (const r of this.records()) {
      const v = this.current(r.id);
      if (v.period_id === period_id && r.state === "locked") {
        r.state = "approved"; // kilit kalkar, onay korunur; veri değişirse onay geçersizleşir
        this.audit("record.state:locked->approved", "activity_record", r.id, r.current_version, "Dönem yeniden açıldı");
      }
    }
    this.audit("period.reopen", "reporting_period", period_id, null, `${reason} | etki: ${impact_note}`);
    this.commit();
  }
  reopens(period_id: string): PeriodReopen[] {
    return this.db.reopens.filter((x) => x.tenant_id === this.tenantId && x.period_id === period_id);
  }

  // ---------- Rapor (§22, T19) ----------
  async buildManifest(period_id: string): Promise<ReportManifest> {
    const c = this.closeChecklist(period_id);
    const t = this.tenant!;
    const records = c.records
      .map(({ r, v }) => {
        const run = this.latestRun(r.id);
        return {
          record_id: r.id,
          version: v.version,
          state: r.state,
          run_id: run?.id ?? null,
          inputs_hash: run?.inputs_hash ?? null,
          factor_refs: run?.factor_refs ?? [],
          total_co2e_kg: run?.result.total_co2e_kg ?? null,
          coverage: run?.result.coverage ?? null,
          data_quality: v.data_quality,
          quantity_state: v.quantity_state,
        };
      })
      .sort((a, b) => a.record_id.localeCompare(b.record_id));
    // Toplam: yalnız onaylı/kilitli kayıtlar; ondalık toplama tarayıcıda BigInt ile (sayı üretmez, motor sonuçlarını toplar)
    const approved = records.filter((x) => (x.state === "approved" || x.state === "locked") && x.total_co2e_kg !== null);
    const sum = approved.length ? sumDecimalStrings(approved.map((x) => x.total_co2e_kg as string)) : null;
    const blocked = records.filter((x) => x.run_id === null || x.total_co2e_kg === null).length;
    const nonApproved = records.length - approved.length;
    const coverages = new Set(approved.map((x) => x.coverage));
    const gaps: string[] = [];
    if (c.missing_sources.length) gaps.push(`${c.missing_sources.length} kaynak için bu dönemde kayıt yok: ${c.missing_sources.map((s) => s.name).join(", ")}`);
    if (nonApproved) gaps.push(`${nonApproved} kayıt onaylı değil; toplama dahil edilmedi`);
    if (coverages.has("co2_only")) gaps.push("Bazı sonuçlar yalnız CO₂ bileşenidir; tam CO₂e değildir");
    if (c.estimated.length) gaps.push(`${c.estimated.length} kayıt tahmini veri niteliğinde`);
    gaps.push("Kapsam 2 ve Kapsam 3 bu önizlemede yok (Dilim 2 ve 7); bu bir 'hesaplanan envanter toplamı'dır, kurumsal toplam değildir");
    const anyRun = records.find((x) => x.run_id);
    const run = anyRun ? this.db.runs.find((r) => r.id === anyRun.run_id) : undefined;
    return {
      period: { id: c.period.id, start: c.period.start, end: c.period.end },
      tenant: { id: t.id, name: t.name, profile_id: t.profile_id, profile_version: t.profile_version },
      records,
      method: run?.method ?? null,
      engine_version: run?.engine_version ?? null,
      totals: {
        approved_co2e_kg: sum,
        approved_record_count: approved.length,
        non_approved_record_count: nonApproved,
        blocked_record_count: blocked,
        label_tr: "Hesaplanan envanter toplamı (yalnız onaylı Kapsam 1 doğal gaz kayıtları)",
      },
      sources_expected: c.expected_sources.length,
      sources_with_records: c.expected_sources.length - c.missing_sources.length,
      gaps_tr: gaps,
    };
  }

  async createReport(period_id: string, reason: string | null): Promise<ReportSnapshot> {
    this.require("report.create");
    const manifest = await this.buildManifest(period_id);
    const manifest_sha256 = await sha256Hex(canonicalJson(manifest));
    const prev = this.reports(period_id);
    const last = prev.length ? prev[prev.length - 1] : null;
    const snap: ReportSnapshot = {
      id: newId("rep"),
      tenant_id: this.tenantId,
      period_id,
      version: (last?.version ?? 0) + 1,
      created_at: now(),
      created_by: this.user.id,
      manifest,
      manifest_sha256,
      supersedes: last?.id ?? null,
      reason,
    };
    this.db.reports.push(snap);
    this.audit("report.create", "report_snapshot", snap.id, snap.version, `sha256 ${manifest_sha256.slice(0, 12)}${last ? (last.manifest_sha256 === manifest_sha256 ? " (önceki ile aynı)" : " (önceki sürümden farklı)") : ""}`);
    this.commit();
    return snap;
  }
  reports(period_id?: string): ReportSnapshot[] {
    return this.db.reports.filter((r) => r.tenant_id === this.tenantId && (!period_id || r.period_id === period_id)).sort((a, b) => a.version - b.version);
  }

  auditLog(): AuditEvent[] {
    this.require("audit.read");
    return this.db.audit.filter((a) => a.tenant_id === this.tenantId).slice().reverse();
  }
}

// Ondalık dizeleri tam olarak toplar (float yok). Motor sonuçlarının toplanması §22 "toplamlar detaydan
// yeniden üretilebilir" koşulu için; yeni sayı üretmez.
export function sumDecimalStrings(values: string[]): string {
  let scale = 0;
  for (const v of values) {
    const i = v.indexOf(".");
    if (i >= 0) scale = Math.max(scale, v.length - i - 1);
  }
  let total = BigInt(0);
  for (const v of values) {
    const neg = v.startsWith("-");
    const s = neg ? v.slice(1) : v;
    const [ip, fp = ""] = s.split(".");
    const digits = ip + fp.padEnd(scale, "0");
    const n = BigInt(digits || "0");
    total += neg ? -n : n;
  }
  const neg = total < BigInt(0);
  let str = (neg ? -total : total).toString().padStart(scale + 1, "0");
  if (scale > 0) {
    str = `${str.slice(0, -scale)}.${str.slice(-scale)}`.replace(/\.?0+$/, "");
  }
  return (neg ? "-" : "") + str;
}
