"use client";
import Link from "next/link";
import { useState } from "react";
import { ROLE_LABEL } from "@/lib/domain";
import { useStore, fmtDate, kgToT } from "@/lib/useStore";
import { ErrorBox, Loading, NoTenant, Notice, PageHeader } from "@/components/ui";

export default function Raporlar() {
  const { store, ready } = useStore();
  const [err, setErr] = useState<unknown>(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  if (!ready || !store) return <Loading />;
  if (!store.tenant) return <NoTenant />;
  const periods = store.periods();
  const reports = store.reports();

  const download = (obj: unknown, name: string) => {
    const blob = new Blob([JSON.stringify(obj, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = name;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <>
      <PageHeader eyebrow={`Rapor · §22 · T19 · rol: ${ROLE_LABEL[store.role]}`} title="Raporlar ve kanıtlar" lead="Her rapor veri, hesap ve faktör kimliklerini içeren bir manifest ve SHA-256 karması taşır. Aynı girdilerle yeniden oluşturulan rapor aynı karmayı verir; sonradan değişen kaynak raporu sessizce değiştiremez." />
      <Notice kind="info">
        <p>
          Bu önizlemede rapor paketi <b>makine okunur JSON manifest</b>tir ve indirilebilir. DOCX/PDF, GRI/TSRS gereklilik indeksi ve yayımlama ayrı yetkili işlemi henüz yok (Dilim 2+). Taslak indirmek yayımlamak değildir.
        </p>
      </Notice>
      <ErrorBox error={err} />
      <div className="card">
        <h2>Rapor sürümü oluştur</h2>
        {periods.length === 0 ? (
          <p className="muted">
            Dönem yok. <Link href="/kurulum/">Kurulum</Link>
          </p>
        ) : (
          periods.map((p) => {
            const prev = store.reports(p.id);
            return (
              <div key={p.id} className="row" style={{ marginBottom: "0.5rem" }}>
                <span>
                  {p.start} → {p.end} <span className={`badge ${p.status === "locked" ? "accent" : "neutral"}`}>{p.status === "locked" ? "kilitli" : "açık"}</span> · {prev.length} sürüm
                </span>
                {prev.length > 0 && <input placeholder="Yeni sürüm nedeni (zorunlu)" value={reason} onChange={(e) => setReason(e.target.value)} style={{ maxWidth: 280 }} aria-label="Yeni sürüm nedeni" />}
                <button
                  className="primary"
                  disabled={busy || !["approver", "admin"].includes(store.role) || (prev.length > 0 && !reason.trim())}
                  onClick={async () => {
                    setBusy(true);
                    setErr(null);
                    try {
                      await store.createReport(p.id, prev.length ? reason : null);
                      setReason("");
                    } catch (e) {
                      setErr(e);
                    } finally {
                      setBusy(false);
                    }
                  }}
                >
                  {prev.length ? "Yeniden oluştur (yeni sürüm)" : "Rapor oluştur"}
                </button>
              </div>
            );
          })
        )}
        <p className="small muted">Açık dönem için üretilen rapor taslaktır; dönem kilitlenmeden "nihai" değildir. Yalnız onaylayan veya yönetici oluşturur.</p>
      </div>

      {reports
        .slice()
        .reverse()
        .map((r) => {
          const prev = r.supersedes ? reports.find((x) => x.id === r.supersedes) : null;
          const same = prev ? prev.manifest_sha256 === r.manifest_sha256 : null;
          const m = r.manifest;
          return (
            <div className="card" key={r.id}>
              <h2>
                Rapor v{r.version} · {m.period.start} → {m.period.end}
              </h2>
              <dl className="kv">
                <dt>Oluşturma</dt>
                <dd>
                  {fmtDate(r.created_at)} · {r.created_by} {r.reason && `· neden: ${r.reason}`}
                </dd>
                <dt>Manifest SHA-256</dt>
                <dd className="mono small">
                  {r.manifest_sha256}
                  {same === true && <span className="badge ok">önceki sürümle aynı (T19)</span>}
                  {same === false && <span className="badge warn">önceki sürümden farklı</span>}
                </dd>
                <dt>Toplam</dt>
                <dd className="num">
                  <b>{kgToT(m.totals.approved_co2e_kg)} t CO₂e</b> — {m.totals.label_tr}
                  <div className="small muted">
                    onaylı {m.totals.approved_record_count} · onaysız {m.totals.non_approved_record_count} · hesapsız {m.totals.blocked_record_count} · kaynak {m.sources_with_records}/{m.sources_expected}
                  </div>
                </dd>
                <dt>Yöntem / motor</dt>
                <dd>
                  {m.method ? `${m.method.id}@${m.method.version}` : "—"} · {m.engine_version ?? "—"}
                </dd>
                <dt>Eksikler ve sınırlar</dt>
                <dd>
                  <ul className="small">
                    {m.gaps_tr.map((g, i) => (
                      <li key={i}>{g}</li>
                    ))}
                  </ul>
                </dd>
              </dl>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Kayıt</th>
                      <th>v</th>
                      <th>Durum</th>
                      <th>Koşu</th>
                      <th>Faktör</th>
                      <th>CO₂e (t)</th>
                      <th>Kapsama</th>
                      <th>Nitelik</th>
                    </tr>
                  </thead>
                  <tbody>
                    {m.records.map((x) => (
                      <tr key={x.record_id}>
                        <td>
                          <Link href={`/kayit/?id=${x.record_id}`} className="mono small">
                            {x.record_id.slice(0, 12)}
                          </Link>
                        </td>
                        <td className="num">{x.version}</td>
                        <td>{x.state}</td>
                        <td className="mono small">{x.run_id?.slice(0, 10) ?? "—"}</td>
                        <td className="small">{x.factor_refs.map((f) => `${f.id}@${f.version}`).join(", ") || "—"}</td>
                        <td className="num">{kgToT(x.total_co2e_kg)}</td>
                        <td>{x.coverage ?? "—"}</td>
                        <td>{x.data_quality}{x.quantity_state === "unknown" && " · bilinmiyor"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="actions" style={{ marginTop: "0.75rem" }}>
                <button onClick={() => download({ report_id: r.id, version: r.version, manifest_sha256: r.manifest_sha256, manifest: m }, `koza-rapor-${r.version}.json`)}>Manifesti indir (JSON)</button>
              </div>
            </div>
          );
        })}
    </>
  );
}
