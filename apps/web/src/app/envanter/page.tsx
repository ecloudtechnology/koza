"use client";
import Link from "next/link";
import { SOURCE_TYPE_LABEL } from "@/lib/domain";
import { useStore, fmtDec, kgToT } from "@/lib/useStore";
import { Loading, NoTenant, StateBadge } from "@/components/ui";

export default function Envanter() {
  const { store, ready } = useStore();
  if (!ready || !store) return <Loading />;
  if (!store.tenant) return <NoTenant />;
  const recs = store.records();
  const sources = store.sources();

  return (
    <>
      <h1>Emisyon envanteri</h1>
      <p className="muted">Kapsam 1 — sabit yakma (doğal gaz). Kapsam 2 (Dilim 2) ve Kapsam 3'ün 15 kategorisi (Dilim 7) henüz yok; eksik kapsam görünür kalır (§22).</p>

      <div className="card">
        <h2>Kaynak envanteri</h2>
        {sources.length === 0 ? (
          <p className="muted">
            Kaynak yok. <Link href="/kurulum/">Kurulumda oluşturun.</Link>
          </p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Kaynak</th>
                  <th>Tür</th>
                  <th>Kapsam önerisi</th>
                  <th>Veri girişi</th>
                  <th>Kayıt sayısı</th>
                </tr>
              </thead>
              <tbody>
                {sources.map((s) => {
                  const n = recs.filter((r) => store.current(r.id).source_id === s.id).length;
                  const supported = s.source_type === "stationary_combustion" && s.fuel === "natural_gas";
                  return (
                    <tr key={s.id}>
                      <td>{s.name}</td>
                      <td>{SOURCE_TYPE_LABEL[s.source_type]}</td>
                      <td>{s.source_type === "purchased_electricity" ? "Kapsam 2" : s.source_type === "purchased_goods" ? "Kapsam 3 (kat. 1)" : "Kapsam 1"}</td>
                      <td>{supported ? <span className="badge ok">hazır</span> : <span className="badge neutral">henüz yok ({s.source_type === "purchased_electricity" || s.source_type === "refrigerant" ? "Dilim 2" : "Dilim 7"})</span>}</td>
                      <td className="num">{n}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="card">
        <h2>Kayıtlar</h2>
        {recs.length === 0 ? (
          <p className="muted">
            Henüz kayıt yok. <Link href="/veri-girisi/">İlk kaydı girin.</Link>
          </p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Kayıt</th>
                  <th>Kaynak</th>
                  <th>Dönem</th>
                  <th>Miktar</th>
                  <th>Nitelik</th>
                  <th>Durum</th>
                  <th>Son hesap</th>
                </tr>
              </thead>
              <tbody>
                {recs.map((r) => {
                  const v = store.current(r.id);
                  const run = store.latestRun(r.id);
                  return (
                    <tr key={r.id}>
                      <td>
                        <Link href={`/kayit/?id=${r.id}`} className="mono">
                          {r.id.slice(0, 12)}
                        </Link>{" "}
                        v{v.version} {r.training && <span className="badge info">eğitim</span>}
                      </td>
                      <td>{sources.find((s) => s.id === v.source_id)?.name}</td>
                      <td className="num">
                        {v.period_start} → {v.period_end}
                      </td>
                      <td className="num">{v.quantity_state === "unknown" ? <span className="badge warn">bilinmiyor</span> : `${fmtDec(v.quantity)} ${v.unit ?? "(birim?)"}`}</td>
                      <td>{v.data_quality === "estimated" ? <span className="badge warn">tahmini</span> : "ölçülmüş"}</td>
                      <td>
                        <StateBadge state={r.state} />
                      </td>
                      <td className="num">
                        {run ? (
                          run.result.status === "blocked" ? (
                            <span className="badge crit">engellendi</span>
                          ) : (
                            <>
                              {kgToT(run.result.total_co2e_kg)} t <span className="badge neutral">{run.result.coverage}</span>
                              {run.record_version !== v.version && <span className="badge warn">eski sürüm</span>}
                            </>
                          )
                        ) : (
                          "—"
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <p className="small muted">Toplam burada gösterilmez: onaylı olmayan kayıt toplamda onaylı veri olarak görünemez (§21). Onaylı toplam ve eksikler rapor manifestinde.</p>
      </div>
    </>
  );
}
