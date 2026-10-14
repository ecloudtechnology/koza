// Rapor paketi (§22, T19, K-17): toplamlar YALNIZ motorun aggregate() çıktısından gelir.
// Bu dosya sayı üretmez; motor çıktısını paketler, ürün sonuçlarını ayrı tutar (kural 8) ve yayım/güvence
// kayıtlarını değişmez satır olarak yazar.
import type { AggregateResult } from "@/lib/calc";
import { contentOf, TEST_CATALOG } from "@/lib/content";
import { SCOPE_OF_SOURCE, type ActivityRecord, type ActivityRecordVersion, type CalculationRun, type EmissionSource, type ReportSnapshot, type ReportingPeriod } from "@/lib/domain";
import { canonicalJson, sha256Hex } from "@/lib/hash";
import { Store, StoreError } from "@/lib/store";
import { boundaryLabel, latestResult, studies } from "./study";
import { MODULE, type AggregateRequest, type Assurance, type AssuranceInput, type EvidenceIndexRow, type PackageManifest, type ProductStudySummary, type Publication, type RecordDetailRow, type Relation, type ReportPackage, type ReportingMap, type Scope2Method } from "./types";

export const PACKAGES = "report_packages";
export const PUBLICATIONS = "publications";
export const ASSURANCES = "assurances";

export const SCOPE2_METHOD_LABEL: Record<Scope2Method, string> = { location_based: "Konum bazlı", market_based: "Piyasa bazlı" };

// ---------- Dönem kayıtları ----------

export interface PeriodRecord {
  r: ActivityRecord;
  v: ActivityRecordVersion;
  src: EmissionSource;
  run: CalculationRun | null;
}

export function recordsOfPeriod(s: Store, period_id: string): PeriodRecord[] {
  return s
    .records()
    .map((r) => ({ r, v: s.current(r.id) }))
    .filter((x) => x.v.period_id === period_id)
    .map((x) => ({ ...x, src: s.source(x.v.source_id), run: s.latestRun(x.r.id) }))
    .sort((a, b) => a.r.id.localeCompare(b.r.id));
}

export function scopeOf(src: EmissionSource): 1 | 2 | 3 | null {
  const sc = SCOPE_OF_SOURCE[src.source_type];
  return sc === 0 ? null : sc;
}

function detailOf(v: ActivityRecordVersion): Record<string, unknown> {
  return (v.detail ?? {}) as Record<string, unknown>;
}

export function categoryOf(src: EmissionSource, v: ActivityRecordVersion): number | null {
  if (src.source_type === "purchased_goods") return 1;
  const s3 = detailOf(v).scope3 as { category?: unknown } | undefined;
  return typeof s3?.category === "number" ? s3.category : null;
}

export function scope2MethodUsed(v: ActivityRecordVersion): Scope2Method | null {
  const s2 = detailOf(v).scope2 as { method?: unknown } | undefined;
  return s2?.method === "location_based" || s2?.method === "market_based" ? s2.method : null;
}

// ---------- Toplama isteği (CONTRACT-v0.2 §7) ----------

/** Kurumsal kayıtlar context="corporate"; ürün çalışması satırları context="product". Motor ikisini ayırır; arayüz toplamaz. */
export function buildAggregateRequest(s: Store, period_id: string, scope2_method: Scope2Method): AggregateRequest {
  const results: AggregateRequest["results"] = [];
  for (const x of recordsOfPeriod(s, period_id)) {
    if (!x.run) continue; // koşusuz kayıt: sonucu yok, kalite bölümünde sayılır
    results.push({
      record_id: x.r.id,
      context: "corporate",
      scope: scopeOf(x.src),
      category: categoryOf(x.src, x.v),
      state: x.r.state,
      result: x.run.result,
      scope2_method_used: scope2MethodUsed(x.v),
    });
  }
  for (const st of studies(s)) {
    const res = latestResult(s, st);
    if (!res) continue;
    for (const l of res.lines) {
      results.push({ record_id: `${st.id}:${l.line_id}`, context: "product", scope: null, category: null, state: "calculated", result: l.result, scope2_method_used: null, study_id: st.id });
    }
  }
  return { results, policy: { include_states: ["approved", "locked"], scope2_method } };
}

/** Kural 8 denetimi: ürün satırı kimlikleri kurumsal listelerde (hariç/bilinmiyor/uygulanmaz) görünemez. */
export function assertProductSeparation(req: AggregateRequest, agg: AggregateResult): void {
  const productIds = new Set(req.results.filter((r) => r.context === "product").map((r) => r.record_id));
  const corporateLists: string[] = [...agg.corporate.excluded.map((e) => e.record_id), ...agg.unknown, ...agg.not_applicable];
  const leaked = corporateLists.filter((id) => productIds.has(id));
  if (leaked.length) {
    throw new StoreError("PRODUCT_NOT_IN_CORPORATE_TOTAL", `Motor toplama çıktısında ${leaked.length} ürün çalışması satırı kurumsal listede göründü (${leaked.slice(0, 3).join(", ")}). Paket oluşturulmadı.`, 409, { leaked });
  }
  const productStudies = new Set(req.results.filter((r) => r.context === "product").map((r) => r.study_id!));
  const corporateHasProduct = req.results.some((r) => r.context === "corporate" && r.study_id);
  if (corporateHasProduct) throw new StoreError("PRODUCT_NOT_IN_CORPORATE_TOTAL", "Ürün çalışması satırı kurumsal bağlamla gönderilmek istendi.", 409);
  if (productStudies.size && agg.corporate.total_kg !== null && !req.results.some((r) => r.context === "corporate" && req.policy.include_states.includes(r.state))) {
    throw new StoreError("PRODUCT_NOT_IN_CORPORATE_TOTAL", "Kurumsal toplama dahil edilebilir kayıt yokken motor kurumsal toplam döndürdü; ürün sonucu karışmış olabilir.", 409);
  }
}

// ---------- Paket manifesti ----------

export function packages(s: Store, period_id?: string): ReportPackage[] {
  return s.rows<ReportPackage>(MODULE, PACKAGES).filter((p) => !period_id || p.period_id === period_id);
}
export function pkg(s: Store, id: string): ReportPackage {
  return s.row<ReportPackage>(MODULE, PACKAGES, id);
}
export function publications(s: Store, package_id?: string): Publication[] {
  return s.rows<Publication>(MODULE, PUBLICATIONS).filter((p) => !package_id || p.package_id === package_id);
}
export function assurances(s: Store, package_id?: string): Assurance[] {
  return s.rows<Assurance>(MODULE, ASSURANCES).filter((a) => !package_id || a.package_id === package_id);
}

export function previousPackage(s: Store, period: ReportingPeriod): ReportPackage | null {
  const prevPeriods = s
    .periods()
    .filter((p) => p.end < period.start)
    .sort((a, b) => (a.end < b.end ? 1 : -1));
  for (const p of prevPeriods) {
    const list = packages(s, p.id);
    if (list.length) return list[list.length - 1];
  }
  return null;
}

export function reportingMaps(): ReportingMap[] {
  return contentOf<ReportingMap>("reporting-maps");
}

export function buildPackageManifest(s: Store, snap: ReportSnapshot, req: AggregateRequest, agg: AggregateResult): PackageManifest {
  assertProductSeparation(req, agg);
  const period = s.period(snap.period_id);
  const recs = recordsOfPeriod(s, snap.period_id);
  const records_detail: RecordDetailRow[] = recs.map((x) => ({
    record_id: x.r.id,
    version: x.v.version,
    state: x.r.state,
    source_id: x.src.id,
    source_name: x.src.name,
    source_type: x.src.source_type,
    scope: scopeOf(x.src),
    category: categoryOf(x.src, x.v),
    period_start: x.v.period_start,
    period_end: x.v.period_end,
    quantity: x.v.quantity,
    quantity_state: x.v.quantity_state,
    unit: x.v.unit,
    data_quality: x.v.data_quality,
    run_id: x.run?.id ?? null,
    status: x.run?.result.status ?? null,
    total_co2e_kg: x.run?.result.total_co2e_kg ?? null,
    coverage: x.run?.result.coverage ?? null,
    factor_refs: (x.run?.factor_refs ?? []).map((f) => `${f.id}@${f.version}`).join(", "),
    evidence_sha256: x.v.evidence_ids
      .map((id) => s.evidence(id)?.sha256)
      .filter(Boolean)
      .join(" "),
    invoice_no: x.v.invoice_no,
    supplier: x.v.supplier,
    note: x.v.note,
  }));
  const evidence_index: EvidenceIndexRow[] = [];
  for (const x of recs) {
    for (const id of x.v.evidence_ids) {
      const e = s.evidence(id);
      if (e) evidence_index.push({ record_id: x.r.id, evidence_id: e.id, file_name: e.file_name, sha256: e.sha256, size_bytes: e.size_bytes });
    }
  }
  evidence_index.sort((a, b) => a.record_id.localeCompare(b.record_id) || a.evidence_id.localeCompare(b.evidence_id));

  const factorKeys = new Set<string>();
  for (const x of recs) for (const f of x.run?.factor_refs ?? []) factorKeys.add(`${f.id}@${f.version}`);
  const factors = Array.from(factorKeys)
    .sort()
    .map((k) => {
      const [id, version] = k.split("@");
      const cat = TEST_CATALOG.factors.find((f) => f.id === id && f.version === version);
      return { id, version, title_tr: cat?.title_tr ?? null, source_ref: cat?.source_ref ?? null, license: cat?.license ?? null };
    });

  const product_studies: ProductStudySummary[] = studies(s)
    .map((st) => ({ st, res: latestResult(s, st) }))
    .filter((x) => x.res)
    .map(({ st, res }) => ({
      study_id: st.id,
      product_name: st.product_name,
      product_version: st.product_version,
      study_version: res!.study_version,
      boundary: st.boundary,
      label_tr: boundaryLabel(st.boundary),
      result_id: res!.id,
      total_kg: agg.product?.[st.id]?.total_kg ?? res!.study_total_kg,
      claim_tr: agg.product?.[st.id]?.claim_tr ?? res!.study_claim_tr,
      included_in_corporate_total: false as const,
    }))
    .sort((a, b) => a.study_id.localeCompare(b.study_id));

  const prev = previousPackage(s, period);
  const boundary = s.boundary();
  const noRun = recs.filter((x) => !x.run).length;
  const blocked = recs.filter((x) => x.run?.result.status === "blocked").length;
  const review = recs.filter((x) => x.run?.result.status === "review_required").length;
  const evidenceMissing = recs.filter((x) => x.v.evidence_ids.length === 0).length;

  const gaps = [...snap.manifest.gaps_tr, ...agg.corporate.coverage_notes_tr];
  if (noRun) gaps.push(`${noRun} kayıt için hesap koşusu yok; toplamda yer almaz`);
  if (blocked) gaps.push(`${blocked} kayıt engelli (hesaplanamadı)`);
  if (agg.unknown.length) gaps.push(`${agg.unknown.length} kayıt 'bilinmiyor' durumunda; sıfır sayılmadı, toplama girmedi`);
  if (agg.not_applicable.length) gaps.push(`${agg.not_applicable.length} kayıt gerekçeli 'uygulanmaz'; toplama girmedi`);
  if (agg.corporate.scope2_alternative_kg !== undefined && agg.corporate.scope2_alternative_kg !== null) gaps.push(`Kapsam 2 ${SCOPE2_METHOD_LABEL[req.policy.scope2_method]} yöntemle raporlandı; diğer yöntem ayrıca gösterilir, toplanmaz`);
  if (product_studies.length) gaps.push(`${product_studies.length} ürün çalışması ayrı bağlamda; kurumsal toplama dahil değil (REG-03)`);
  if (period.status !== "locked") gaps.push("Dönem kilitli değil; bu paket taslaktır ve yayımlanamaz");

  return {
    package_schema: "urun-rapor/1",
    core: snap.manifest,
    core_manifest_sha256: snap.manifest_sha256,
    engine_version: agg.engine_version,
    policy: req.policy,
    aggregate: agg,
    boundary: boundary ? { approach: boundary.approach, note: boundary.note, status: boundary.status } : null,
    period: { id: period.id, start: period.start, end: period.end, status: period.status },
    tenant: snap.manifest.tenant,
    method: snap.manifest.method,
    sources: {
      catalog_id: factors.length ? TEST_CATALOG.catalog_id : null,
      factors,
      method: snap.manifest.method ? { ...snap.manifest.method, title_tr: TEST_CATALOG.method.id === snap.manifest.method.id ? TEST_CATALOG.method.title_tr : null, gwp_set: TEST_CATALOG.method.id === snap.manifest.method.id ? TEST_CATALOG.method.gwp_set : null } : null,
      engine_version: agg.engine_version,
      reporting_maps: reportingMaps().map((m) => ({ id: m.id, version: m.version })),
    },
    records_detail,
    evidence_index,
    product_studies,
    comparison: {
      previous: prev ? { period: prev.manifest.period, package_id: prev.id, package_sha256: prev.package_sha256, corporate: prev.manifest.aggregate.corporate } : null,
      note_tr: prev ? "Önceki dönem değerleri yan yana gösterilir; fark ayrıştırması (faaliyet / faktör / sınır / yöntem) motorun bu sürümünde yoktur, arayüz fark hesaplamaz." : "Karşılaştırılacak önceki dönem paketi yok.",
    },
    quality: {
      estimated_share_by_count: agg.corporate.estimated_share_by_count,
      estimated_share_by_kg: agg.corporate.estimated_share_by_kg,
      review_required_count: review,
      blocked_count: blocked,
      no_run_count: noRun,
      evidence_missing_count: evidenceMissing,
      unknown_count: agg.unknown.length,
      not_applicable_count: agg.not_applicable.length,
    },
    gaps_tr: gaps,
  };
}

/** Çekirdek rapor (store.createReport, T19) + motor toplamı → paket satırı. Aynı girdiler aynı package_sha256 verir. */
export async function createPackage(s: Store, period_id: string, reason: string | null, req: AggregateRequest, agg: AggregateResult): Promise<ReportPackage> {
  s.require("report.create");
  const prev = packages(s, period_id);
  if (prev.length && !reason?.trim()) throw new StoreError("VALIDATION", "Aynı dönem için yeni rapor sürümü nedeni zorunlu (§22 sabit rapor sürümü).", 422);
  const snap = await s.createReport(period_id, reason);
  const manifest = buildPackageManifest(s, snap, req, agg);
  const package_sha256 = await sha256Hex(canonicalJson(manifest));
  const last = prev.length ? prev[prev.length - 1] : null;
  const row = s.insert<ReportPackage>(
    MODULE,
    PACKAGES,
    { report_id: snap.id, period_id, report_version: snap.version, core_manifest_sha256: snap.manifest_sha256, package_sha256, manifest, reason, supersedes: last?.id ?? null },
    "urun-rapor.report.package"
  );
  s.audit("urun-rapor.report.package.hash", `${MODULE}.${PACKAGES}`, row.id, snap.version, `paket sha256 ${package_sha256.slice(0, 12)}${last ? (last.package_sha256 === package_sha256 ? " (önceki ile aynı)" : " (önceki sürümden farklı)") : ""}`);
  s.commit();
  return row;
}

// ---------- Yayım (§22: ayrı yetkili işlem) ----------

export function publishPackage(s: Store, package_id: string, note: string | null): Publication {
  s.require("urun-rapor.report.publish");
  const p = pkg(s, package_id);
  const period = s.period(p.period_id);
  if (period.status !== "locked") throw new StoreError("PUBLISH_REQUIRES_LOCKED_PERIOD", `Dönem ${period.start} → ${period.end} açık; yayım için önce kilitlenmeli.`, 409, { period_id: period.id });
  if (publications(s, package_id).length) throw new StoreError("ALREADY_PUBLISHED", "Bu paket zaten yayımlanmış.", 409);
  return s.insert<Publication>(MODULE, PUBLICATIONS, { package_id, report_id: p.report_id, period_id: p.period_id, package_sha256: p.package_sha256, note }, "urun-rapor.report.publish");
}

// ---------- Dış güvence (platform kendine güvence etiketi veremez) ----------

export function attachAssurance(s: Store, package_id: string, input: AssuranceInput): Assurance {
  s.require("urun-rapor.assurance.attach");
  pkg(s, package_id);
  const provider = input.provider.trim();
  const tenantName = (s.tenant?.name ?? "").trim().toLocaleLowerCase("tr");
  if (!provider || /\bkoza\b/i.test(provider) || provider.toLocaleLowerCase("tr") === tenantName) {
    throw new StoreError("ASSURANCE_SELF_LABEL_FORBIDDEN", "Güvence sağlayıcı bağımsız bir taraf olmalı; platform veya raporlayan kurum kendi güvencesini veremez.", 403);
  }
  if (!/^[0-9a-f]{64}$/.test(input.sha256)) throw new StoreError("VALIDATION", "Güvence dosyası karması (SHA-256, 64 hex) zorunlu; dosyayı seçin.", 422);
  if (!input.file_name.trim() || !input.scope.trim()) throw new StoreError("VALIDATION", "Dosya adı ve güvence kapsamı zorunlu.", 422);
  return s.insert<Assurance>(MODULE, ASSURANCES, { ...input, provider, package_id }, "urun-rapor.assurance.attach");
}

export function recordExport(s: Store, package_id: string, format: "json" | "csv" | "docx" | "print", sanitized = 0): void {
  s.audit("urun-rapor.report.export", `${MODULE}.${PACKAGES}`, package_id, null, `${format}${sanitized ? `; CSV_EXPORT_SANITIZED ${sanitized} hücre` : ""}`);
  s.commit();
}

// ---------- GRI gereklilik indeksi / TSRS açıklama matrisi (veri: content/reporting-maps) ----------

export const ELEMENT_LABEL: Record<string, string> = {
  "corporate.scope1_kg": "Kapsam 1 toplamı",
  "corporate.scope2_kg.location": "Kapsam 2 (konum bazlı)",
  "corporate.scope2_kg.market": "Kapsam 2 (piyasa bazlı)",
  "corporate.scope3_kg": "Kapsam 3 toplamı",
  "corporate.scope3_by_category": "Kapsam 3 kategori kırılımı",
  biogenic_co2_kg: "Biyojenik CO₂",
  "method.gwp_set": "GWP seti",
  "method.id": "Hesap yöntemi ve sürümü",
  "boundary.approach": "Konsolidasyon yaklaşımı",
  period: "Raporlama dönemi",
  base_year: "Baz yıl",
  factor_sources: "Faktör kaynakları",
  "quality.estimated_share": "Tahmini veri payı",
  excluded_records: "Hariç tutulan kayıtlar ve nedenleri",
  evidence_index: "Kanıt indeksi",
  "comparison.previous": "Önceki dönem karşılaştırması",
  "assurance.external": "Bağımsız güvence raporu",
};

export interface IndexContext {
  assurance: boolean;
}

/** Unsur pakette var mı. Bilinmeyen unsur → false (eksik olarak görünür; sessiz 'var' yok). */
export function elementPresent(m: PackageManifest, ctx: IndexContext, id: string): boolean {
  const c = m.aggregate.corporate;
  const s2primary = c.scope2_method;
  const alt = c.scope2_alternative_kg ?? null;
  switch (id) {
    case "corporate.scope1_kg":
      return c.scope1_kg !== null;
    case "corporate.scope2_kg.location":
      return (s2primary === "location_based" && c.scope2_kg !== null) || (s2primary === "market_based" && alt !== null);
    case "corporate.scope2_kg.market":
      return (s2primary === "market_based" && c.scope2_kg !== null) || (s2primary === "location_based" && alt !== null);
    case "corporate.scope3_kg":
      return c.scope3_kg !== null;
    case "corporate.scope3_by_category":
      return Object.keys(c.scope3_by_category ?? {}).length > 0;
    case "biogenic_co2_kg":
      return m.aggregate.biogenic_co2_kg !== null;
    case "method.gwp_set":
      return !!m.sources.method?.gwp_set;
    case "method.id":
      return m.method !== null;
    case "boundary.approach":
      return !!m.boundary && m.boundary.approach !== "unknown";
    case "period":
      return true;
    case "base_year":
      return false; // veri modelinde yok
    case "factor_sources":
      return m.sources.factors.length > 0;
    case "quality.estimated_share":
      return m.quality.estimated_share_by_count !== null;
    case "excluded_records":
      return true; // liste (boş olsa da) pakette
    case "evidence_index":
      return m.evidence_index.length > 0;
    case "comparison.previous":
      return m.comparison.previous !== null;
    case "assurance.external":
      return ctx.assurance;
    default:
      return false;
  }
}

export interface IndexRow {
  id: string;
  title_tr: string;
  covered: { koza: string; relation: Relation; note_tr: string }[];
  missing: { koza: string; relation: Relation; note_tr: string }[];
  narrative: string[];
  status_tr: string; // asla "tam uyum"
}

export function reportingIndex(maps: ReportingMap[], m: PackageManifest, ctx: IndexContext): { map: ReportingMap; rows: IndexRow[] }[] {
  return maps.map((map) => ({
    map,
    rows: map.items.map((it) => {
      const covered = it.elements.filter((e) => elementPresent(m, ctx, e.koza));
      const missing = it.elements.filter((e) => !elementPresent(m, ctx, e.koza));
      const status_tr = it.elements.length === 0 ? "yalnız anlatı — Koza verisi yok" : covered.length === 0 ? "veri unsuru yok" : missing.length ? `${covered.length}/${it.elements.length} veri unsuru var; anlatı ayrı` : "veri unsurları var; anlatı ve kanıt ayrı gerekir";
      return { id: it.id, title_tr: it.title_tr, covered, missing, narrative: it.narrative, status_tr };
    }),
  }));
}
