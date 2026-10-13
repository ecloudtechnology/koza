"use client";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { TEST_CATALOG, type TestFactor } from "@/lib/content";
import { calculate, engineReady } from "@/lib/calc";
import { ROLE_LABEL, type CalcResult, type FactorRef } from "@/lib/domain";
import { StoreError } from "@/lib/store";
import { useStore, fmtDate, fmtDec, kgToT } from "@/lib/useStore";
import { ErrorBox, Loading, NoTenant, Notice, StateBadge } from "@/components/ui";

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
  const [selected, setSelected] = useState<string[]>([]);
  const [preview, setPreview] = useState<CalcResult | null>(null);
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
  const runs = store.runsOf(rec.id).slice().reverse();
  const latest = store.latestRun(rec.id);
  const period = store.period(v.period_id);
  const approvals = store.approvalsOf(rec.id);
  const tasks = store.tasks().filter((t) => t.related_record_id === rec.id);

  // Faktör seçenekleri: yakıta uyan, YAYIMLI sürümler (uzmanın etkinleştirdiği). Kurgusal test kataloğu.
  const options = TEST_CATALOG.factors.filter((f) => f.fuel === (source.fuel ?? "") && store.publishedVersion(f.id) === f.version);
  const defaultSel = options.filter((f) => f.boundary === "combustion" && f.denominator_unit === "GJ").map((f) => `${f.id}@${f.version}`);
  const sel = selected.length ? selected : defaultSel;
  const chosen: TestFactor[] = sel.map((k) => options.find((f) => `${f.id}@${f.version}` === k)).filter(Boolean) as TestFactor[];

  const buildRequest = () => ({
    activity: {
      id: rec!.id,
      version: v.version,
      source_type: source.source_type,
      fuel: source.fuel,
      quantity: v.quantity,
      unit: v.unit ?? "bilinmiyor",
      heating_value_basis: v.heating_value_basis,
      reference_conditions: v.reference_conditions,
      calorific_value: v.calorific_value,
      basis_conversion: v.basis_conversion,
      data_quality: v.data_quality,
      period: { start: v.period_start, end: v.period_end },
    },
    factors: chosen.map((f) => ({
      id: f.id,
      version: f.version,
      value: f.value,
      numerator_unit: f.numerator_unit,
      gas: f.gas,
      denominator_unit: f.denominator_unit,
      basis: f.basis,
      reference_conditions: f.reference_conditions,
      boundary: f.boundary,
      gwp_set_id: f.gwp_set_id,
      source_ref: f.source_ref,
      license: f.license,
      valid_from: f.valid_from,
      valid_to: f.valid_to,
    })),
    method: { id: TEST_CATALOG.method.id, version: TEST_CATALOG.method.version, gwp_set: TEST_CATALOG.method.gwp_set },
  });

  const runPreview = async () => {
    setErr(null);
    setBusy(true);
    try {
      if (v.quantity_state === "unknown") throw new StoreError("CALC_INPUT", "Miktar bilinmiyor; birimi bilinmeyen/eksik miktardan kesin sonuç üretilmez (§11). Önce eksik bilgiyi tamamlayın.", 422);
      const res = await calculate(buildRequest());
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
      store.saveRun(rec!.id, preview, refs, { id: TEST_CATALOG.method.id, version: TEST_CATALOG.method.version });
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

  return (
    <>
      <div className="row" style={{ justifyContent: "space-between" }}>
        <h1>
          Kayıt <span className="mono small">{rec.id}</span>
        </h1>
        <StateBadge state={rec.state} />
      </div>
      <p className="muted">
        {source.name} · {v.period_start} → {v.period_end} · sürüm {v.version} · yazan {v.created_by} {rec.training && <span className="badge info">eğitim kaydı</span>}
        {period.status === "locked" && <span className="badge accent">dönem kilitli</span>}
      </p>
      <ErrorBox error={err} />

      <div className="grid-2">
        <div className="card">
          <h2>Girdi (güncel sürüm)</h2>
          <dl className="kv">
            <dt>Miktar</dt>
            <dd className="num">{v.quantity_state === "unknown" ? <span className="badge warn">bilinmiyor (NULL)</span> : `${fmtDec(v.quantity)} ${v.unit ?? "(birim bilinmiyor)"}`}</dd>
            <dt>Isıl değer esası</dt>
            <dd>{v.heating_value_basis ?? <span className="badge warn">bilinmiyor</span>}</dd>
            <dt>Hacim koşulları</dt>
            <dd>{v.reference_conditions ? `${v.reference_conditions.temperature_c} °C, ${v.reference_conditions.pressure_kpa} kPa` : v.unit === "m3" ? <span className="badge warn">yok</span> : "—"}</dd>
            <dt>Isıl değer (dönüşüm)</dt>
            <dd>{v.calorific_value ? `${v.calorific_value.value} ${v.calorific_value.unit} (${v.calorific_value.basis}) — ${v.calorific_value.source_ref || "kaynak yok"}` : "—"}</dd>
            <dt>Veri niteliği</dt>
            <dd>{v.data_quality === "estimated" ? <span className="badge warn">tahmini</span> : "ölçülmüş"}</dd>
            <dt>Fatura / tedarikçi</dt>
            <dd>
              {v.invoice_no ?? "—"} / {v.supplier ?? "—"}
            </dd>
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
                      {["GJ", "MWh", "kWh", "Sm3", "Nm3", "m3", ""].map((u) => (
                        <option key={u} value={u}>
                          {u || "bilinmiyor"}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="field">
                    <label>Esas</label>
                    <select value={edit.basis} onChange={(e) => setEdit({ ...edit, basis: e.target.value })}>
                      <option value="">bilinmiyor</option>
                      <option value="LHV">LHV</option>
                      <option value="HHV">HHV</option>
                    </select>
                  </div>
                </div>
                <div className="field">
                  <label>Not</label>
                  <input value={edit.note} onChange={(e) => setEdit({ ...edit, note: e.target.value })} />
                </div>
                <div className="field">
                  <label>Değişiklik gerekçesi (zorunlu)</label>
                  <input value={edit.change_reason} onChange={(e) => setEdit({ ...edit, change_reason: e.target.value })} required />
                  <span className="hint">Kayıt yeni sürüm alır; eski sürüm korunur. Onaylı kayıt değişirse önceki onay geçersizleşir (§21).</span>
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
            <Notice kind="crit">
              <p>
                <strong>Hesap motoru yüklenemedi.</strong> {engineErr} — Bu durumda hesap yapılmaz; sahte sonuç gösterilmez. Mevcut kayıt ve taslak korunur (§25 süreklilik).
              </p>
            </Notice>
          )}
          <Notice kind="warn">
            <p>
              <strong>Kurgusal test kataloğu.</strong> {TEST_CATALOG.note_tr} Yöntem: {TEST_CATALOG.method.title_tr} v{TEST_CATALOG.method.version} — {TEST_CATALOG.method.note_tr}
            </p>
          </Notice>
          {options.length === 0 ? (
            <p className="muted">Bu kaynak türü/yakıt için yayımlı faktör yok.</p>
          ) : (
            <div className="radio-list">
              {options.map((f) => {
                const k = `${f.id}@${f.version}`;
                return (
                  <label key={k}>
                    <input type="checkbox" checked={sel.includes(k)} onChange={(e) => setSelected(e.target.checked ? [...sel, k] : sel.filter((x) => x !== k))} />
                    <span>
                      {f.title_tr} <span className="mono small">{k}</span> · {f.value} {f.numerator_unit} {f.gas}/{f.denominator_unit}
                      {f.basis && ` (${f.basis})`} · sınır: {f.boundary}
                      <br />
                      <span className="hint">Kaynak: {f.source_ref} · lisans: {f.license}</span>
                    </span>
                  </label>
                );
              })}
            </div>
          )}
          <div className="actions" style={{ marginTop: "0.75rem" }}>
            <button className="primary" onClick={runPreview} disabled={engine !== "ready" || busy || chosen.length === 0}>
              {busy ? "Hesaplanıyor…" : "Önizle (kaydetmez)"}
            </button>
            {preview && (
              <button onClick={saveRun} disabled={!["data_entry", "data_owner", "reviewer", "admin"].includes(store.role)}>
                Bu koşuyu kaydet
              </button>
            )}
          </div>
          {preview && <ResultView r={preview} title="Önizleme sonucu (kaydedilmedi)" />}
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
      </div>

      <div className="card">
        <h2>Hesap koşuları ({runs.length})</h2>
        {runs.length === 0 ? (
          <p className="muted">Kaydedilmiş koşu yok.</p>
        ) : (
          runs.map((run) => (
            <details key={run.id} open={run.id === latest?.id}>
              <summary>
                {fmtDate(run.created_at)} · kayıt v{run.record_version} · {run.factor_refs.map((f) => `${f.id}@${f.version}`).join(", ")} · motor {run.engine_version} ·{" "}
                <span className={`badge ${run.result.status === "computed" ? "ok" : run.result.status === "review_required" ? "warn" : "crit"}`}>{run.result.status}</span>
                {run.superseded_by && <span className="badge neutral">yerine yeni koşu geldi (korundu)</span>}
              </summary>
              <ResultView r={run.result} title={`Koşu ${run.id}`} />
            </details>
          ))
        )}
      </div>

      <div className="card">
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
                  <td>{x.heating_value_basis ?? "?"}</td>
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

function ResultView({ r, title }: { r: CalcResult; title: string }) {
  return (
    <div style={{ marginTop: "0.75rem" }}>
      <h3>{title}</h3>
      {r.status === "blocked" ? (
        <Notice kind="crit">
          <p>
            <strong>Hesap yapılamadı.</strong> Engel çözülmeden onay yok.
          </p>
          <ul>
            {r.blocks.map((b, i) => (
              <li key={i}>
                <span className="mono">{b.code}</span> — {b.message_tr} {b.field && <span className="muted">({b.field})</span>}
              </li>
            ))}
          </ul>
        </Notice>
      ) : (
        <>
          {r.status === "review_required" && (
            <Notice kind="warn">
              <p>
                <strong>İnceleme gerekli.</strong> {r.warnings.map((w) => w.message_tr).join(" ")}
              </p>
            </Notice>
          )}
          <dl className="kv">
            <dt>Sonuç</dt>
            <dd className="num">
              <b>{kgToT(r.total_co2e_kg)} t CO₂e</b> ({fmtDec(r.total_co2e_kg)} kg)
            </dd>
            <dt>Kapsama</dt>
            <dd>
              <span className={`badge ${r.coverage === "full_ghg" || r.coverage === "co2e_factor" ? "ok" : "warn"}`}>{r.coverage}</span> — {r.claim_tr}
            </dd>
            <dt>Normalize miktar</dt>
            <dd className="num">{r.normalized_activity ? `${fmtDec(r.normalized_activity.quantity, 6)} ${r.normalized_activity.unit} ${r.normalized_activity.basis ?? ""}` : "—"}</dd>
            <dt>Sınır</dt>
            <dd>{r.boundary}</dd>
            <dt>Yöntem / motor</dt>
            <dd>
              {r.method.id}@{r.method.version} · koza_calc {r.engine_version}
            </dd>
            <dt>Girdi karması</dt>
            <dd className="mono small">{r.inputs_hash}</dd>
          </dl>
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
                {r.components.map((c) => (
                  <tr key={c.gas}>
                    <td>{c.gas}</td>
                    <td className="mono small">
                      {c.factor_id}@{c.factor_version}
                    </td>
                    <td className="num">{fmtDec(c.mass_kg, 6)}</td>
                    <td className="num">{c.gwp ?? "—"}</td>
                    <td>{c.gwp_applied ? "evet" : "hayır"}</td>
                    <td className="num">{fmtDec(c.co2e_kg, 6)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
      <details>
        <summary>İz kaydı (sonuçtan faktöre ve kaynağa)</summary>
        <pre className="trace">{JSON.stringify(r.trace, null, 2)}</pre>
      </details>
    </div>
  );
}
