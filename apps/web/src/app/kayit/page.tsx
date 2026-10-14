"use client";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { TEST_CATALOG } from "@/lib/content";
import { calculate, engineReady } from "@/lib/calc";
import { ROLE_LABEL, SCOPE3_CATEGORIES, type CalcResult, type FactorRef } from "@/lib/domain";
import { StoreError } from "@/lib/store";
import { useStore, fmtDate, fmtDec, kgToT } from "@/lib/useStore";
import { ErrorBox, Loading, NoTenant, Notice, StateBadge } from "@/components/ui";
import { explain } from "@/lib/errors";
import { buildRequest, defaultFactorSelection, factorOptions, fieldVisible, getPath, METHOD_LABEL, schemaForVersion, type CalcResultV2, type CatalogFactor, type Instrument, type RecordSchema } from "@/modules/kayit/schemas";
import { scope2MethodUsed, setScope2MethodUsed } from "@/modules/kayit/store";
import "@/modules/kayit/style.css";

export default function Page() {
  return (
    <Suspense fallback={<Loading />}>
      <Kayit />
    </Suspense>
  );
}

function Kayit() {
  const { store, ready } = useStore();
  const params = useSearchParams();
  const id = params.get("id") ?? "";
  const [err, setErr] = useState<unknown>(null);
  const [engine, setEngine] = useState<"loading" | "ready" | "failed">("loading");
  const [engineErr, setEngineErr] = useState<string>("");
  const [selected, setSelected] = useState<string[] | null>(null);
  const [preview, setPreview] = useState<CalcResultV2 | null>(null);
  const [busy, setBusy] = useState(false);
  const [reason, setReason] = useState("");
  const [edit, setEdit] = useState<{ quantity: string; unit: string; basis: string; note: string; change_reason: string; expected_version: number } | null>(null);

  useEffect(() => {
    let alive = true;
    engineReady()
      .then(() => alive && setEngine("ready"))
      .catch((e) => {
        if (!alive) return;
        setEngine("failed");
        setEngineErr(String(e?.message ?? e));
      });
    return () => {
      alive = false;
    };
  }, []);

  if (!ready || !store) return <Loading />;
  if (!store.tenant) return <NoTenant />;
  let rec;
  try {
    rec = store.record(id);
  } catch {
    return (
      <Notice kind="warn">
        <p>
          <strong>Kayıt bulunamadı.</strong> Bu kimlik aktif kurumda yok. Başka kuruma ait bir kayıt kimliği bilinse bile okunamaz (T14, §27). <Link href="/envanter/">Envantere dön</Link>
        </p>
      </Notice>
    );
  }
  const v = store.current(rec.id);
  const source = store.source(v.source_id);
  const schema: RecordSchema | undefined = schemaForVersion(source, v.detail);
  const runs = store.runsOf(rec.id).slice().reverse();
  const latest = store.latestRun(rec.id);
  const period = store.period(v.period_id);
  const approvals = store.approvalsOf(rec.id);
  const tasks = store.tasks().filter((t) => t.related_record_id === rec.id);
  const detail = v.detail ?? {};
  const scope2Used = scope2MethodUsed(store, rec.id);

  // Faktör seçenekleri: kaynak türü / kategori / birim ailesi / YAYIMLI sürüm (kurgusal test kataloğu)
  const catalog = TEST_CATALOG.factors as CatalogFactor[];
  const options = schema ? factorOptions(schema, source, v, catalog, (fid) => store.publishedVersion(fid)) : [];
  const defaultSel = schema ? defaultFactorSelection(schema, options).map((f) => `${f.id}@${f.version}`) : [];
  const sel = selected ?? defaultSel;
  const chosen: CatalogFactor[] = sel.map((k) => options.find((f) => `${f.id}@${f.version}` === k)).filter(Boolean) as CatalogFactor[];
  const needsFactor = schema?.key !== "refrigerant"; // soğutucuda GWP yöntem setinden gelebilir (T11c)

  const request = () => buildRequest({ record_id: rec!.id, version: v, source, factors: chosen, method: { id: TEST_CATALOG.method.id, version: TEST_CATALOG.method.version, gwp_set: TEST_CATALOG.method.gwp_set } });

  const runPreview = async () => {
    setErr(null);
    setBusy(true);
    try {
      if (!schema) throw new StoreError("VALIDATION", "Bu kayıt için şema bulunamadı; kaynak türü desteklenmiyor.", 422);
      if (v.quantity_state === "unknown" && schema.scope !== 3) throw new StoreError("CALC_INPUT", "Miktar bilinmiyor; birimi bilinmeyen/eksik miktardan kesin sonuç üretilmez (§11). Önce eksik bilgiyi tamamlayın.", 422);
      const res = (await calculate(request())) as CalcResultV2;
      setPreview(res);
    } catch (e) {
      setErr(e);
    } finally {
      setBusy(false);
    }
  };
  const saveRun = () => {
    setErr(null);
    try {
      if (!preview) return;
      const refs: FactorRef[] = chosen.map((f) => ({ id: f.id, version: f.version }));
      store.saveRun(rec!.id, preview as unknown as CalcResult, refs, { id: TEST_CATALOG.method.id, version: TEST_CATALOG.method.version });
      setPreview(null);
    } catch (e) {
      setErr(e);
    }
  };
  const act = (fn: () => void) => {
    setErr(null);
    try {
      fn();
      setReason("");
    } catch (e) {
      setErr(e);
    }
  };

  const outdatedFactor = latest?.factor_refs.some((f) => store.publishedVersion(f.id) !== f.version);
  const canEdit = !["in_review", "locked"].includes(rec.state) && period.status !== "locked";
  const scopeLabel = schema ? (schema.scope === 0 ? "Ürün bağlamı" : `Kapsam ${schema.scope}${schema.category ? ` · kat. ${schema.category}` : ""}`) : "—";
  const detailFields = schema ? schema.fields.filter((f) => f.key !== "heating_value_basis" && fieldVisible(f, detail) && getPath(detail, f.key) !== undefined) : [];
  const instruments = (getPath(detail, "scope2.instruments") as Instrument[] | undefined) ?? [];
  const lifetime = getPath(detail, "scope3.sold_products") as Record<string, string> | undefined;

  return (
    <>
      <div className="row" style={{ justifyContent: "space-between" }}>
        <h1>
          Kayıt <span className="mono small">{rec.id}</span>
        </h1>
        <StateBadge state={rec.state} />
      </div>
      <p className="muted">
        {schema?.title ?? source.source_type} · <span className="badge neutral">{scopeLabel}</span> · {source.name} · {v.period_start} → {v.period_end} · sürüm {v.version} · yazan {v.created_by} {rec.training && <span className="badge info">eğitim kaydı</span>}
        {period.status === "locked" && <span className="badge accent">dönem kilitli</span>}
        {schema?.scope === 0 && <span className="badge copper">ürün bağlamı — kurumsal toplama girmez</span>}
      </p>
      <ErrorBox error={err} />
      {!schema && (
        <Notice kind="warn">
          <p>Bu kaynak türü ({source.source_type}) için kayıt şeması yok; hesap önizlemesi yapılamaz. Kaynak türünü kurulumda düzeltin.</p>
        </Notice>
      )}

      <div className="grid-2">
        <div className="card">
          <h2>Girdi (güncel sürüm)</h2>
          <dl className="kv">
            <dt>Miktar</dt>
            <dd className="num">{v.quantity_state === "unknown" ? <span className="badge warn">bilinmiyor (NULL)</span> : `${fmtDec(v.quantity)} ${v.unit ?? "(birim bilinmiyor)"}`}</dd>
            {schema?.scope === 1 && schema.key !== "refrigerant" && (
              <>
                <dt>Isıl değer esası</dt>
                <dd>{v.heating_value_basis ?? <span className="badge warn">bilinmiyor</span>}</dd>
                <dt>Hacim koşulları</dt>
                <dd>{v.reference_conditions ? `${v.reference_conditions.temperature_c} °C, ${v.reference_conditions.pressure_kpa} kPa` : v.unit === "m3" ? <span className="badge warn">yok</span> : "—"}</dd>
                <dt>Isıl değer (dönüşüm)</dt>
                <dd>{v.calorific_value ? `${v.calorific_value.value} ${v.calorific_value.unit} (${v.calorific_value.basis}) — ${v.calorific_value.source_ref || "kaynak yok"}` : "—"}</dd>
              </>
            )}
            <dt>Veri niteliği</dt>
            <dd>
              {v.data_quality === "estimated" ? <span className="badge warn">tahmini</span> : "ölçülmüş"}
              {typeof detail.data_source === "string" && ` · kaynak: ${detail.data_source}`}
              {typeof detail.responsible === "string" && detail.responsible && ` · sorumlu: ${detail.responsible}`}
            </dd>
            <dt>Fatura / tedarikçi</dt>
            <dd>
              {v.invoice_no ?? "—"} / {v.supplier ?? "—"}
            </dd>
            {detailFields.map((f) => {
              const val = getPath(detail, f.key);
              const shown = val === null ? <span className="badge warn">bilinmiyor</span> : f.kind === "boolean" ? (val ? "evet" : "hayır") : f.options ? (f.options.find((o) => o.value === String(val))?.label ?? String(val)) : String(val);
              return (
                <span key={f.key} style={{ display: "contents" }}>
                  <dt>{f.label}</dt>
                  <dd>{shown}</dd>
                </span>
              );
            })}
            {schema?.scope === 2 && (
              <>
                <dt>Sözleşmesel araçlar</dt>
                <dd>
                  {instruments.length === 0 ? "yok" : instruments.map((i) => `${i.id || "(kimlik yok)"} · ${i.type} · ${i.mwh} MWh · ${i.retired ? "itfa edildi" : "itfa YOK"} · ${i.quality_criteria_met ? "kalite ok" : "kalite ?"}`).join(" | ")}
                </dd>
                <dt>Kurumsal toplamda kullanılan yöntem</dt>
                <dd>
                  <select value={scope2Used ?? ""} onChange={(e) => act(() => setScope2MethodUsed(store, rec!.id, e.target.value as "location_based" | "market_based"))} disabled={store.role === "viewer"} aria-label="Kurumsal toplamda kullanılan Kapsam 2 yöntemi">
                    <option value="">— seçilmedi (manifestte açık yazılır) —</option>
                    <option value="location_based">Konum bazlı</option>
                    <option value="market_based">Piyasa bazlı</option>
                  </select>
                </dd>
              </>
            )}
            {schema?.scope === 3 && (getPath(detail, "scope3.method_steps") as string[] | undefined) && (
              <>
                <dt>MTH adımları</dt>
                <dd>{(getPath(detail, "scope3.method_steps") as string[]).join(", ") || "—"}</dd>
              </>
            )}
            <dt>Kanıt</dt>
            <dd>
              {v.evidence_ids.length === 0 ? (
                <span className="badge warn">kanıt yok</span>
              ) : (
                v.evidence_ids.map((eid) => {
                  const e = store.evidence(eid);
                  return e ? (
                    <div key={eid} className="small">
                      {e.file_name} · <span className="mono">{e.sha256.slice(0, 16)}…</span>
                    </div>
                  ) : null;
                })
              )}
            </dd>
            <dt>Not</dt>
            <dd>{v.note || "—"}</dd>
          </dl>
          {canEdit && store.role !== "viewer" && (
            <div className="actions" style={{ marginTop: "0.75rem" }}>
              <button onClick={() => setEdit({ quantity: v.quantity ?? "", unit: v.unit ?? "", basis: v.heating_value_basis ?? "", note: v.note, change_reason: "", expected_version: v.version })}>Yeni sürümle düzelt</button>
            </div>
          )}
          {edit && (
            <form
              style={{ marginTop: "0.75rem" }}
              onSubmit={(e) => {
                e.preventDefault();
                act(() => {
                  store.updateRecord(
                    rec!.id,
                    edit.expected_version,
                    {
                      quantity: edit.quantity ? edit.quantity.replace(",", ".") : null,
                      quantity_state: edit.quantity ? "known" : "unknown",
                      unit: edit.unit || null,
                      heating_value_basis: (edit.basis || null) as "LHV" | "HHV" | null,
                      note: edit.note,
                    },
                    edit.change_reason
                  );
                  setEdit(null);
                });
              }}
            >
              <fieldset>
                <legend>Düzeltme — beklenen sürüm v{edit.expected_version} (T18)</legend>
                <div className="row">
                  <div className="field">
                    <label>Miktar</label>
                    <input value={edit.quantity} onChange={(e) => setEdit({ ...edit, quantity: e.target.value })} inputMode="decimal" />
                  </div>
                  <div className="field">
                    <label>Birim</label>
                    <select value={edit.unit} onChange={(e) => setEdit({ ...edit, unit: e.target.value })}>
                      {(schema?.units ?? []).map((u) => (
                        <option key={u.value} value={u.value}>
                          {u.value}
                        </option>
                      ))}
                      <option value="">bilinmiyor</option>
                    </select>
                  </div>
                  {schema?.scope === 1 && schema.key !== "refrigerant" && (
                    <div className="field">
                      <label>Esas</label>
                      <select value={edit.basis} onChange={(e) => setEdit({ ...edit, basis: e.target.value })}>
                        <option value="">bilinmiyor</option>
                        <option value="LHV">LHV</option>
                        <option value="HHV">HHV</option>
                      </select>
                    </div>
                  )}
                </div>
                <div className="field">
                  <label>Not</label>
                  <input value={edit.note} onChange={(e) => setEdit({ ...edit, note: e.target.value })} />
                </div>
                <div className="field">
                  <label>Değişiklik gerekçesi (zorunlu)</label>
                  <input value={edit.change_reason} onChange={(e) => setEdit({ ...edit, change_reason: e.target.value })} required />
                  <span className="hint">Kayıt yeni sürüm alır; eski sürüm korunur. Onaylı kayıt değişirse önceki onay geçersizleşir (§21). Türe özgü alanlar için veri girişinden yeni kayıt açın.</span>
                </div>
                <div className="actions">
                  <button className="primary" type="submit">
                    Sürümü kaydet
                  </button>
                  <button type="button" onClick={() => setEdit(null)}>
                    Vazgeç
                  </button>
                </div>
              </fieldset>
            </form>
          )}
        </div>

        <div className="card">
          <h2>Hesap önizlemesi (DAT-05, §18)</h2>
          {engine === "loading" && <p className="muted" role="status">Hesap motoru (Python, Pyodide) yükleniyor… İlk yüklemede ~10 MB iner.</p>}
          {engine === "failed" && (
            <Notice kind="crit" title="Hesap motoru yüklenemedi">
              <p>{engineErr}</p>
              <p className="small">
                <b>Sonuç:</b> {explain("ENGINE_LOAD_FAILED")?.consequence} <b>Ne yapmalı:</b> {explain("ENGINE_LOAD_FAILED")?.action}
              </p>
            </Notice>
          )}
          <Notice kind="warn">
            <p>
              <strong>Kurgusal test kataloğu.</strong> {TEST_CATALOG.note_tr} Yöntem: {TEST_CATALOG.method.title_tr} v{TEST_CATALOG.method.version} — {TEST_CATALOG.method.note_tr}
            </p>
          </Notice>
          {schema && (
            <p className="small muted">
              Şema: {schema.title} · izinli yöntem: {schema.methods.map((m) => METHOD_LABEL[m] ?? m).join(", ")}
              {schema.scope === 3 && ` · seçilen: ${String(getPath(detail, "scope3.method") ?? "—")}`}
              {schema.scope === 2 && ` · görünüm: ${METHOD_LABEL[String(getPath(detail, "scope2.method") ?? "")] ?? "—"}`}
            </p>
          )}
          {options.length === 0 ? (
            <p className="muted">Bu kayıt türü / birim ailesi için yayımlı faktör yok{needsFactor ? "; hesap yapılamaz. Uzman faktör kataloğundan uygun sürümü yayımlamalı." : ". Soğutucu için GWP yöntem setinden eşleştirilir (yoksa GWP_MISSING)."}</p>
          ) : (
            <div className="radio-list">
              {options.map((f) => {
                const k = `${f.id}@${f.version}`;
                return (
                  <label key={k}>
                    <input type="checkbox" checked={sel.includes(k)} onChange={(e) => setSelected(e.target.checked ? [...sel, k] : sel.filter((x) => x !== k))} />
                    <span>
                      {f.title_tr} <span className="mono small">{k}</span> · {f.value} {f.numerator_unit} {f.gas}/{f.denominator_unit}
                      {f.basis && ` (${f.basis})`} · sınır: {f.boundary} {f.role && <span className="badge neutral">{f.role === "location" ? "konum" : "artık karışım"}</span>}
                      <br />
                      <span className="hint">Kaynak: {f.source_ref} · lisans: {f.license}</span>
                    </span>
                  </label>
                );
              })}
            </div>
          )}
          {schema?.scope === 3 && (schema.category === 1 || schema.category === 2) && <p className="small muted">Kategori {schema.category}: kapıdan kapıya faktör üst aşamayı kapsamaz (UPSTREAM_MISSING, T08); beşikten kapıya + üst aşama birlikte seçilmez (BOUNDARY_OVERLAP, T09); beşikten mezara faktör bu kategoride kullanılmaz.</p>}
          <div className="actions" style={{ marginTop: "0.75rem" }}>
            <button className="primary" onClick={runPreview} disabled={engine !== "ready" || busy || !schema || (needsFactor && chosen.length === 0)}>
              {busy ? "Hesaplanıyor…" : "Önizle (kaydetmez)"}
            </button>
            {preview && (
              <button onClick={saveRun} disabled={!["data_entry", "data_owner", "reviewer", "admin"].includes(store.role)}>
                Bu koşuyu kaydet
              </button>
            )}
            <details className="small">
              <summary>İstek (CONTRACT-v0.2)</summary>
              <pre className="trace">{schema ? JSON.stringify(request(), null, 2) : "—"}</pre>
            </details>
          </div>
          {preview && <ResultView r={preview} title="Önizleme sonucu (kaydedilmedi)" schema={schema} />}
        </div>
      </div>

      <div className="card">
        <h2>İş akışı (§21)</h2>
        <p className="small">
          Rolünüz: <b>{ROLE_LABEL[store.role]}</b>. Hesaplandı ≠ onaylandı. Veri giren ile onaylayan farklı olmalı; rolü üst çubuktan değiştirin.
        </p>
        {outdatedFactor && (
          <Notice kind="warn">
            <p>
              <strong>Yeni faktör sürümü yayımlandı.</strong> Son koşu eski sürümle yapıldı; eski sonuç korunur, yeni koşu önerilir (T13). Yukarıdan yeniden önizleyip kaydedin.
            </p>
          </Notice>
        )}
        <div className="actions">
          {["draft", "calculated", "changes_requested", "validation_required"].includes(rec.state) && (
            <button className="primary" onClick={() => act(() => store.submit(rec!.id))} disabled={!["data_entry", "data_owner", "admin"].includes(store.role)}>
              Kontrole gönder (DAT-06)
            </button>
          )}
          {rec.state === "in_review" && (
            <>
              <input placeholder="Karar gerekçesi" value={reason} onChange={(e) => setReason(e.target.value)} style={{ maxWidth: 360 }} aria-label="Karar gerekçesi" />
              <button className="primary" onClick={() => act(() => store.decide(rec!.id, "approved", reason))} disabled={store.role !== "approver"}>
                Onayla
              </button>
              <button className="danger" onClick={() => act(() => store.decide(rec!.id, "changes_requested", reason))} disabled={!["reviewer", "approver"].includes(store.role)}>
                Düzeltme iste
              </button>
            </>
          )}
          {rec.state === "approved" && (
            <Link className="btn" href="/donem/">
              Dönem kapanışına git
            </Link>
          )}
          {rec.state === "locked" && (
            <Link className="btn" href="/donem/">
              Kilitli — yeniden açma akışı (T17)
            </Link>
          )}
        </div>
        {approvals.length > 0 && (
          <ul className="small" style={{ marginTop: "0.75rem" }}>
            {approvals
              .slice()
              .reverse()
              .map((a) => (
                <li key={a.id}>
                  {a.decision === "approved" ? "Onay" : "Düzeltme isteği"} · v{a.record_version} · {a.decided_by} · {fmtDate(a.at)} · "{a.reason}"{" "}
                  {a.invalidated_at && <span className="badge warn">geçersiz: {a.invalidation_reason}</span>}
                </li>
              ))}
          </ul>
        )}
        {tasks.length > 0 && (
          <>
            <h3>Bu kayda bağlı görevler</h3>
            <ul className="small">
              {tasks.map((t) => (
                <li key={t.id}>
                  <span className={`badge ${t.status === "open" ? "warn" : "ok"}`}>{t.status === "open" ? "açık" : "tamam"}</span> {t.title} — {t.detail}
                </li>
              ))}
            </ul>
          </>
        )}
        {lifetime && (
          <p className="small muted">
            Satış grubu <span className="mono">{lifetime.group_id}</span>, satış yılı {lifetime.sale_year}: ömür boyu toplam bu yıla atfedilir; sonraki yıllarda aynı grup yeniden eklenmez (T12).
          </p>
        )}
      </div>

      <div className="card">
        <h2>Hesap koşuları ({runs.length})</h2>
        {runs.length === 0 ? (
          <p className="muted">Kaydedilmiş koşu yok.</p>
        ) : (
          runs.map((run) => (
            <details key={run.id} open={run.id === latest?.id}>
              <summary>
                {fmtDate(run.created_at)} · kayıt v{run.record_version} · {run.factor_refs.map((f) => `${f.id}@${f.version}`).join(", ") || "faktör yok (GWP seti)"} · motor {run.engine_version} ·{" "}
                <span className={`badge ${run.result.status === "computed" ? "ok" : run.result.status === "review_required" ? "warn" : "crit"}`}>{run.result.status}</span>
                {run.superseded_by && <span className="badge neutral">yerine yeni koşu geldi (korundu)</span>}
              </summary>
              <ResultView r={run.result as CalcResultV2} title={`Koşu ${run.id}`} schema={schema} />
            </details>
          ))
        )}
      </div>

      <div className="card adv">
        <h2>Sürüm geçmişi (append-only)</h2>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>v</th>
                <th>Zaman</th>
                <th>Kim</th>
                <th>Miktar</th>
                <th>Esas</th>
                <th>Gerekçe</th>
              </tr>
            </thead>
            <tbody>
              {store.versionsOf(rec.id).map((x) => (
                <tr key={x.version}>
                  <td className="num">{x.version}</td>
                  <td>{fmtDate(x.created_at)}</td>
                  <td>{x.created_by}</td>
                  <td className="num">{x.quantity_state === "unknown" ? "bilinmiyor" : `${fmtDec(x.quantity)} ${x.unit ?? "?"}`}</td>
                  <td>{x.heating_value_basis ?? "—"}</td>
                  <td>{x.change_reason ?? "ilk sürüm"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

function Blocks({ r }: { r: CalcResultV2 }) {
  return (
    <ul>
      {r.blocks.map((b, i) => {
        const ex = explain(b.code);
        return (
          <li key={i}>
            <b>{ex?.title ?? b.code}</b> <code>{b.code}</code> — {b.message_tr} {b.field && <span className="muted">({b.field})</span>}
            {ex && (
              <div className="small" style={{ marginTop: "0.2rem" }}>
                <b>Neden:</b> {ex.cause} <b>Ne yapmalı:</b> {ex.action}
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
function Warnings({ r }: { r: CalcResultV2 }) {
  if (!r.warnings?.length) return null;
  return (
    <Notice kind="warn" title={r.status === "review_required" ? "İnceleme gerekli" : "Uyarı"}>
      <ul>
        {r.warnings.map((w, i) => {
          const ex = explain(w.code);
          return (
            <li key={i}>
              <b>{ex?.title ?? w.code}</b> <code>{w.code}</code> — {w.message_tr}
              {ex && (
                <span className="small">
                  {" "}
                  <b>Sonuç:</b> {ex.consequence} <b>Ne yapmalı:</b> {ex.action}
                </span>
              )}
            </li>
          );
        })}
      </ul>
    </Notice>
  );
}
function Components({ r }: { r: CalcResultV2 }) {
  if (!r.components?.length) return null;
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Gaz</th>
            <th>Faktör</th>
            <th>Kütle (kg)</th>
            <th>GWP</th>
            <th>Uygulandı</th>
            <th>CO₂e (kg)</th>
          </tr>
        </thead>
        <tbody>
          {r.components.map((c, i) => (
            <tr key={`${c.gas}-${c.factor_id}-${i}`}>
              <td>{c.gas}</td>
              <td className="mono small">{c.factor_id ? `${c.factor_id}@${c.factor_version}` : "GWP seti"}</td>
              <td className="num">{fmtDec(c.mass_kg, 6)}</td>
              <td className="num">{c.gwp ?? "—"}</td>
              <td>{c.gwp_applied ? "evet" : "hayır"}</td>
              <td className="num">{fmtDec(c.co2e_kg, 6)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
function SingleResult({ r, extra }: { r: CalcResultV2; extra?: Record<string, string | undefined> }) {
  return (
    <>
      <dl className="kv">
        <dt>Sonuç</dt>
        <dd className="num">
          <b>{kgToT(r.total_co2e_kg)} t CO₂e</b> ({fmtDec(r.total_co2e_kg)} kg)
        </dd>
        <dt>Kapsama</dt>
        <dd>
          <span className={`badge ${r.coverage === "full_ghg" || r.coverage === "co2e_factor" ? "ok" : "warn"}`}>{r.coverage ?? "—"}</span> — {r.claim_tr}
        </dd>
        {extra &&
          Object.entries(extra).map(([k, val]) => (
            <span key={k} style={{ display: "contents" }}>
              <dt>{k}</dt>
              <dd className="num">{val ?? "—"}</dd>
            </span>
          ))}
      </dl>
      <Components r={r} />
    </>
  );
}

function ResultView({ r, title, schema }: { r: CalcResultV2; title: string; schema: RecordSchema | undefined }) {
  const notApplicable = r.value_state === "not_applicable";
  const dual = r.results && (r.results.location_based || r.results.market_based);
  return (
    <div style={{ marginTop: "0.75rem" }}>
      <h3>{title}</h3>
      {r.context === "product" && (
        <Notice kind="info">
          <p>
            <strong>Ürün bağlamı.</strong> Bu sonuç ürün çalışmasına aittir; kurumsal Kapsam 1–3 toplamına eklenmez (§17, kural 8). Kapsama "carbon_only": yalnız karbon; tam LCA/EPD iddiası yok.
          </p>
        </Notice>
      )}
      {r.status === "blocked" ? (
        <Notice kind="crit">
          <p>
            <strong>Hesap yapılamadı.</strong> Engel çözülmeden onay yok.
            {r.value_state === "unknown" && " Sonuç durumu: bilinmiyor (sıfır değil; T10)."}
          </p>
          <Blocks r={r} />
        </Notice>
      ) : notApplicable ? (
        <>
          <Notice kind="info" title="Emisyon sayılmaz (uygulanamaz)">
            <p>{r.claim_tr}</p>
            <p className="small">Sonuç değeri boş (null) bırakılır; sıfır yazılmaz ve toplama girmez (kural 2). Kayıt stok izi olarak kalır.</p>
          </Notice>
          <Warnings r={r} />
        </>
      ) : dual ? (
        <>
          <Warnings r={r} />
          <Notice kind="info" title="İki hesap görünümü — toplanmaz (§13)">
            <p className="small">Konum bazlı ve piyasa bazlı sonuçlar aynı tüketimin alternatif görünümleridir; ikisi birlikte toplanmaz ve enerji tüketimini iki katına çıkarmaz. Kurumsal toplamda kullanılan yöntem kayıtta ve rapor manifestinde açıkça yazılır{r.primary_method ? ` (birincil: ${METHOD_LABEL[r.primary_method] ?? r.primary_method})` : ""}.</p>
          </Notice>
          <div className="scope2-pair">
            {r.results?.location_based && (
              <div>
                <h4>Konum bazlı</h4>
                <SingleResult r={r.results.location_based} />
              </div>
            )}
            {r.results?.market_based && (
              <div>
                <h4>Piyasa bazlı</h4>
                {r.results.market_based.status === "blocked" ? <Notice kind="crit"><Blocks r={r.results.market_based} /></Notice> : <SingleResult r={r.results.market_based} extra={{ "Belgeyle kapsanan (MWh)": r.results.market_based.covered_mwh, "Kapsanmayan (MWh)": r.results.market_based.uncovered_mwh, Araçlar: r.results.market_based.instrument_ids?.join(", ") || "—" }} />}
                <Warnings r={r.results.market_based} />
              </div>
            )}
          </div>
        </>
      ) : (
        <>
          <Warnings r={r} />
          {schema?.scope === 3 && (r.coverage === "partial_boundary" || r.warnings.some((w) => w.code === "UPSTREAM_MISSING" || w.code === "PARTIAL_BOUNDARY")) && (
            <Notice kind="warn" title="Kısmi sınır (T08)">
              <p className="small">Kullanılan faktör kategorinin asgari sınırını tam kapsamıyor; sonuç "kısmi sınır" olarak etiketlenir ve tam kategori sonucu gibi raporlanamaz. Eksik aşamayı ayrı faktörle tamamlayın veya tedarikçiden üst aşama verisi isteyin.</p>
            </Notice>
          )}
          <SingleResult r={r} extra={schema?.scope === 3 ? { Kategori: schema.category ? `${schema.category} — ${SCOPE3_CATEGORIES.find((c) => c.n === schema.category)?.tr ?? ""}` : undefined, ...(r.lifetime_group ? { "Satış grubu": `${r.lifetime_group.group_id} (satış yılı ${r.lifetime_group.sale_year}; atıf yılı ${r.attribution_year ?? r.lifetime_group.sale_year})` } : {}), ...(r.data_quality_dims ? { "Veri kalitesi (5 boyut)": Object.entries(r.data_quality_dims).map(([k, val]) => `${k}: ${val ?? "—"}`).join(" · ") } : {}) } : undefined} />
        </>
      )}
      <dl className="kv" style={{ marginTop: "0.5rem" }}>
        <dt>Normalize miktar</dt>
        <dd className="num">{r.normalized_activity ? `${fmtDec(r.normalized_activity.quantity, 6)} ${r.normalized_activity.unit} ${r.normalized_activity.basis ?? ""}` : "—"}</dd>
        <dt>Sınır</dt>
        <dd>{r.boundary ?? "—"}</dd>
        <dt>Yöntem / motor</dt>
        <dd>
          {r.method.id}@{r.method.version} · koza_calc {r.engine_version}
        </dd>
        <dt>Girdi karması</dt>
        <dd className="mono small">{r.inputs_hash}</dd>
      </dl>
      <details className="adv">
        <summary>İz kaydı (sonuçtan faktöre ve kaynağa)</summary>
        <pre className="trace">{JSON.stringify(r.trace, null, 2)}</pre>
      </details>
    </div>
  );
}
