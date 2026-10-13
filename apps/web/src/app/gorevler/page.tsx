"use client";
import Link from "next/link";
import { useStore, fmtDate } from "@/lib/useStore";
import { Loading, NoTenant, Notice } from "@/components/ui";

const KIND: Record<string, string> = {
  missing_info: "Eksik bilgi",
  expert_decision: "Uzman kararı",
  duplicate_review: "Mükerrer inceleme",
  reopen_request: "Yeniden açma",
  content: "İçerik ekibi",
};

export default function Gorevler() {
  const { store, ready } = useStore();
  if (!ready || !store) return <Loading />;
  if (!store.tenant) return <NoTenant />;
  const tasks = store.tasks().slice().reverse();
  const open = tasks.filter((t) => t.status === "open");
  return (
    <>
      <h1>Görevler ve veri talepleri</h1>
      <p className="muted">Eksik bilgi, uzman kararı ve içerik talepleri akışlardan otomatik oluşur. Tedarikçi talepleri (TDR) Dilim 7'de.</p>
      <Notice kind="info">
        <p>Tedarikçi veri talebi, dış kişiye gönderim ve otomatik hatırlatma bu önizlemede yok; dış gönderim açık yetki ister (§09, §21).</p>
      </Notice>
      <div className="card">
        <h2>Açık ({open.length})</h2>
        {open.length === 0 ? <p className="muted">Açık görev yok.</p> : <TaskTable tasks={open} store={store} />}
      </div>
      <div className="card">
        <h2>Tamamlanan ({tasks.length - open.length})</h2>
        {tasks.length - open.length === 0 ? <p className="muted">—</p> : <TaskTable tasks={tasks.filter((t) => t.status === "done")} store={store} />}
      </div>
    </>
  );
}

function TaskTable({ tasks, store }: { tasks: ReturnType<NonNullable<ReturnType<typeof useStore>["store"]>["tasks"]>; store: NonNullable<ReturnType<typeof useStore>["store"]> }) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Görev</th>
            <th>Tür</th>
            <th>Gereklilik</th>
            <th>Kayıt</th>
            <th>Açılış</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {tasks.map((t) => (
            <tr key={t.id}>
              <td>
                <b>{t.title}</b>
                <div className="small muted">{t.detail}</div>
              </td>
              <td>{KIND[t.kind] ?? t.kind}</td>
              <td className="small">{t.requirement_ids.join(", ")}</td>
              <td>{t.related_record_id ? <Link href={`/kayit/?id=${t.related_record_id}`} className="mono small">{t.related_record_id.slice(0, 12)}</Link> : "—"}</td>
              <td className="small">{fmtDate(t.created_at)}</td>
              <td>{t.status === "open" && t.kind !== "missing_info" && <button onClick={() => store.completeTask(t.id)}>Tamamlandı</button>}
                {t.status === "open" && t.kind === "missing_info" && <span className="small muted">kayıt tamamlanınca kapanır</span>}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
