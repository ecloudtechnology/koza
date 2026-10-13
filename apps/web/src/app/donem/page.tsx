"use client";
import Link from "next/link";
import { useState } from "react";
import { ROLE_LABEL } from "@/lib/domain";
import { useStore, fmtDate } from "@/lib/useStore";
import { ErrorBox, Loading, NoTenant, Notice, PageHeader, StateBadge } from "@/components/ui";

export default function Donem() {
  const { store, ready } = useStore();
  const [err, setErr] = useState<unknown>(null);
  const [force, setForce] = useState("");
  const [reason, setReason] = useState("");
  const [impact, setImpact] = useState("");
  if (!ready || !store) return <Loading />;
  if (!store.tenant) return <NoTenant />;
  const periods = store.periods();
  const act = (fn: () => void) => {
    setErr(null);
    try {
      fn();
    } catch (e) {
      setErr(e);
    }
  };
  return (
    <>
      <PageHeader eyebrow={`Dönem · §21 · T17 · rol: ${ROLE_LABEL[store.role]}`} title="Dönem kapanışı" lead="Kapanış listesi beklenen kayıtları, eksikleri, onay durumunu ve tahminleri gösterir. Kilitli dönem değiştirilemez; yeniden açma gerekçe, etki analizi ve yetkili onayı ister." />
      <ErrorBox error={err} />
      {periods.length === 0 && (
        <Notice kind="warn">
          <p>
            Dönem yok. <Link href="/kurulum/">Kurulumda ekleyin.</Link>
          </p>
        </Notice>
      )}
      {periods.map((p) => {
        const c = store.closeChecklist(p.id);
        const reopens = store.reopens(p.id);
        return (
          <div className="card" key={p.id}>
            <h2>
              {p.start} → {p.end} <span className={`badge ${p.status === "locked" ? "accent" : "neutral"}`}>{p.status === "locked" ? "kilitli" : "açık"}</span>
            </h2>
            <dl className="kv">
              <dt>Beklenen kaynak</dt>
              <dd>{c.expected_sources.length} doğal gaz kaynağı</dd>
              <dt>Kaydı olmayan kaynak</dt>
              <dd>{c.missing_sources.length ? <span className="badge warn">{c.missing_sources.map((s) => s.name).join(", ")}</span> : <span className="badge ok">yok</span>}</dd>
              <dt>Kayıt</dt>
              <dd>
                {c.records.length} · onaylı olmayan: {c.not_approved.length} · tahmini: {c.estimated.length}
              </dd>
              <dt>Açık görev</dt>
              <dd>{c.open_tasks.length}</dd>
              <dt>Mutabakat</dt>
              <dd className="muted">Sayaç–fatura ve stok uzlaştırması bu önizlemede yok (Dilim 2)</dd>
            </dl>
            {c.records.length > 0 && (
              <ul className="small">
                {c.records.map(({ r, v }) => (
                  <li key={r.id}>
                    <Link href={`/kayit/?id=${r.id}`} className="mono">
                      {r.id.slice(0, 12)}
                    </Link>{" "}
                    v{v.version} <StateBadge state={r.state} /> {v.data_quality === "estimated" && <span className="badge warn">tahmini</span>}
                  </li>
                ))}
              </ul>
            )}
            {p.status === "open" ? (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  act(() => store.lockPeriod(p.id, force || null));
                }}
              >
                {c.not_approved.length > 0 && (
                  <div className="field">
                    <label htmlFor={`f-${p.id}`}>Açık eksik notu (onaylı olmayan kayıt varken kilitlemek için zorunlu)</label>
                    <input id={`f-${p.id}`} value={force} onChange={(e) => setForce(e.target.value)} />
                  </div>
                )}
                <div className="actions">
                  <button className="primary" type="submit" disabled={store.role !== "admin"}>
                    Dönemi kilitle
                  </button>
                  {store.role !== "admin" && <span className="small muted">Yalnız kurum yöneticisi kilitler.</span>}
                </div>
              </form>
            ) : (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  act(() => {
                    store.reopenPeriod(p.id, reason, impact);
                    setReason("");
                    setImpact("");
                  });
                }}
              >
                <fieldset>
                  <legend>Yeniden açma (T17)</legend>
                  <p className="small">Kilitli: {fmtDate(p.locked_at!)} · {p.locked_by}. Eski rapor sürümleri korunur; yeni rapor eskiyi hangi nedenle değiştirdiğini belirtir.</p>
                  <div className="field">
                    <label>Gerekçe</label>
                    <input value={reason} onChange={(e) => setReason(e.target.value)} />
                  </div>
                  <div className="field">
                    <label>Etki analizi (hangi kayıt/rapor etkilenir)</label>
                    <input value={impact} onChange={(e) => setImpact(e.target.value)} />
                  </div>
                  <div className="actions">
                    <button className="danger" type="submit" disabled={store.role !== "admin"}>
                      Dönemi yeniden aç
                    </button>
                  </div>
                </fieldset>
              </form>
            )}
            {reopens.length > 0 && (
              <ul className="small">
                {reopens.map((x) => (
                  <li key={x.id}>
                    Yeniden açıldı {fmtDate(x.at)} · {x.requested_by} · {x.reason} · etki: {x.impact_note}
                  </li>
                ))}
              </ul>
            )}
          </div>
        );
      })}
    </>
  );
}
