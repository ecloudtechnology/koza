"use client";
import { useStore, fmtDate } from "@/lib/useStore";
import { ErrorBox, Loading, NoTenant } from "@/components/ui";

export default function DenetimIzi() {
  const { store, ready } = useStore();
  if (!ready || !store) return <Loading />;
  if (!store.tenant) return <NoTenant />;
  let log;
  try {
    log = store.auditLog();
  } catch (e) {
    return (
      <>
        <h1>Denetim izi</h1>
        <ErrorBox error={e} />
      </>
    );
  }
  return (
    <>
      <h1>Denetim izi</h1>
      <p className="muted">Append-only: her işlem aktör, rol, nesne, sürüm ve gerekçeyle yazılır; silme yolu yok (§25, Dilim 0). Loglara belge içeriği veya sır yazılmaz. {log.length} olay.</p>
      <div className="table-wrap card">
        <table>
          <thead>
            <tr>
              <th>Zaman</th>
              <th>Aktör</th>
              <th>İşlem</th>
              <th>Nesne</th>
              <th>Sürüm</th>
              <th>Gerekçe</th>
            </tr>
          </thead>
          <tbody>
            {log.map((a) => (
              <tr key={a.id}>
                <td className="small">{fmtDate(a.at)}</td>
                <td className="small">
                  {a.actor_id} <span className="badge neutral">{a.actor_role}</span>
                </td>
                <td className="mono small">{a.action}</td>
                <td className="small">
                  {a.object_type} <span className="mono">{a.object_id.slice(0, 14)}</span>
                </td>
                <td className="num">{a.object_version ?? "—"}</td>
                <td className="small">{a.reason ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
