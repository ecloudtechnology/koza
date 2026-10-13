"use client";
import Link from "next/link";
import { ROLE_LABEL } from "@/lib/domain";
import { useStore, fmtDec, kgToT } from "@/lib/useStore";
import { Loading, NoTenant, Notice, StateBadge } from "@/components/ui";

export default function Inceleme() {
  const { store, ready } = useStore();
  if (!ready || !store) return <Loading />;
  if (!store.tenant) return <NoTenant />;
  const queue = store.records().filter((r) => r.state === "in_review");
  const done = store.records().filter((r) => ["approved", "changes_requested", "locked"].includes(r.state));
  const reviewer = ["reviewer", "approver"].includes(store.role);

  return (
    <>
      <h1>İnceleme kuyruğu</h1>
      <p className="muted">Uzman kontrolör sınır, yöntem, faktör ve kanıtı inceler; onaylayan sonucu onaylar (§04). Rolünüz: {ROLE_LABEL[store.role]}.</p>
      {!reviewer && (
        <Notice kind="info">
          <p>Bu rolle inceleme yapılamaz; kuyruk salt okunurdur. Üst çubuktan "uzman kontrolör" veya "onaylayan" seçin (görev ayrılığı: veri giren kendi kaydını onaylayamaz).</p>
        </Notice>
      )}
      <div className="card">
        <h2>İncelemede ({queue.length})</h2>
        {queue.length === 0 ? (
          <p className="muted">Kuyruk boş. Kayıtlar "kontrole gönder" ile buraya düşer.</p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Kayıt</th>
                  <th>Miktar</th>
                  <th>Kanıt</th>
                  <th>Sonuç</th>
                  <th>Durum</th>
                  <th>Yöntem / faktör özeti</th>
                </tr>
              </thead>
              <tbody>
                {queue.map((r) => {
                  const v = store.current(r.id);
                  const run = store.latestRun(r.id);
                  return (
                    <tr key={r.id}>
                      <td>
                        <Link href={`/kayit/?id=${r.id}`} className="mono">
                          {r.id.slice(0, 12)}
                        </Link>
                      </td>
                      <td className="num">
                        {fmtDec(v.quantity)} {v.unit} {v.heating_value_basis}
                      </td>
                      <td>{v.evidence_ids.length ? `${v.evidence_ids.length} dosya` : <span className="badge warn">yok</span>}</td>
                      <td className="num">{run ? `${kgToT(run.result.total_co2e_kg)} t · ${run.result.coverage}` : "—"}</td>
                      <td>
                        <StateBadge state={r.state} /> {run?.result.status === "review_required" && <span className="badge warn">inceleme gerekli</span>}
                      </td>
                      <td className="small">
                        {run ? `${run.method.id}@${run.method.version}; ${run.factor_refs.map((f) => `${f.id}@${f.version}`).join(", ")}` : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
      <div className="card">
        <h2>Karar verilmiş ({done.length})</h2>
        {done.length === 0 ? (
          <p className="muted">Henüz karar yok.</p>
        ) : (
          <ul className="small">
            {done.map((r) => (
              <li key={r.id}>
                <Link href={`/kayit/?id=${r.id}`} className="mono">
                  {r.id.slice(0, 12)}
                </Link>{" "}
                <StateBadge state={r.state} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}
