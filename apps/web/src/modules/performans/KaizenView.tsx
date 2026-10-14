"use client";
// /kaizen — Green Kaizen (KZN-01…03). Birim düzeyi toplulaştırma; kişi bazlı liste yok.
import Link from "next/link";
import { useState } from "react";
import { ROLE_LABEL } from "@/lib/domain";
import type { Store } from "@/lib/store";
import { sha256Hex } from "@/lib/hash";
import { fmtDate } from "@/lib/useStore";
import { ErrorBox, Notice } from "@/components/ui";
import { KAIZEN_STATUS_LABEL, evaluateSuggestion, myFeedback, submitSuggestion, suggestions, summaryByUnit } from "./kaizen";
import { STATUS_LABEL } from "./actions";
import { Bars } from "./ui";
import type { KaizenRow } from "./types";

export function KaizenView({ store }: { store: Store }) {
  return (
    <>
      <Notice kind="info" title="Önizleme deposu: bu tarayıcı">
        <p>
          Öneri, oturumdaki kullanıcı adına saha çalışanı olarak kaydedilir; yalnız birim/hat tutulur, kişi listesi gösterilmez. KVKK (K-09) açık olduğu için muhafazakâr tasarım uygulanır: birim düzeyi toplulaştırma, yazar kimliği yalnız kendi geri bildirimi için. Rolünüz: {ROLE_LABEL[store.role]}.
        </p>
      </Notice>
      <SuggestForm store={store} />
      <MyFeedback store={store} />
      <Evaluate store={store} />
      <UnitDashboard store={store} />
    </>
  );
}

function SuggestForm({ store }: { store: Store }) {
  const [f, setF] = useState({ observed: "", proposal: "", area: "", unit: "" });
  const [photo, setPhoto] = useState<{ file_name: string; sha256: string; size_bytes: number } | null>(null);
  const [err, setErr] = useState<unknown>(null);
  const [msg, setMsg] = useState("");
  const onFile = async (file: File | null) => {
    if (!file) return setPhoto(null);
    const sha256 = await sha256Hex(await file.arrayBuffer());
    setPhoto({ file_name: file.name, sha256, size_bytes: file.size });
  };
  const submit = () => {
    setErr(null);
    try {
      const k = submitSuggestion(store, { ...f, photo });
      setMsg(`Öneriniz alındı (bu tarayıcıda kaydedildi) · ${k.unit} / ${k.area} · durum: ${KAIZEN_STATUS_LABEL[k.status]} · sonraki adım: sürdürülebilirlik elçisi ön değerlendirir; sonucu aşağıda "Önerilerim"de görürsünüz.`);
      setF({ observed: "", proposal: "", area: "", unit: f.unit });
      setPhoto(null);
    } catch (e) {
      setErr(e);
    }
  };
  return (
    <div className="card pf-mobile">
      <h2>Öneri ver (3 alan)</h2>
      <ErrorBox error={err} />
      {msg && (
        <Notice kind="ok">
          <p>{msg}</p>
        </Notice>
      )}
      <div className="stack">
        <div className="field">
          <label htmlFor="k1">Ne gördüm?</label>
          <textarea id="k1" value={f.observed} onChange={(e) => setF({ ...f, observed: e.target.value })} placeholder="ör. Fırın kapağı mola saatlerinde açık kalıyor" />
        </div>
        <div className="field">
          <label htmlFor="k2">Ne öneriyorum?</label>
          <textarea id="k2" value={f.proposal} onChange={(e) => setF({ ...f, proposal: e.target.value })} placeholder="ör. Kapağa kapanma uyarısı / sensör" />
        </div>
        <div className="field">
          <label htmlFor="k3">Hangi alan / hat / ekipman?</label>
          <input id="k3" value={f.area} onChange={(e) => setF({ ...f, area: e.target.value })} placeholder="ör. Fırın 2" />
        </div>
        <div className="field">
          <label htmlFor="k4">Birim</label>
          <input id="k4" value={f.unit} onChange={(e) => setF({ ...f, unit: e.target.value })} placeholder="ör. Hat 1" />
          <span className="hint">Toplulaştırma anahtarı; kişi değil birim.</span>
        </div>
        <div className="field">
          <label htmlFor="k5">Fotoğraf (isteğe bağlı)</label>
          <input id="k5" type="file" accept="image/*" onChange={(e) => onFile(e.target.files?.[0] ?? null)} />
          <span className="hint">Yalnız dosya adı ve sha256 karması saklanır; görüntü içeriği önizlemede saklanmaz (kanıtla aynı ilke).{photo && ` Seçildi: ${photo.file_name} · ${photo.sha256.slice(0, 12)}…`}</span>
        </div>
        <button className="primary" onClick={submit}>
          Gönder
        </button>
      </div>
    </div>
  );
}

function MyFeedback({ store }: { store: Store }) {
  const fb = myFeedback(store);
  return (
    <div className="card">
      <h2>Önerilerim ve geri bildirim (KZN-03)</h2>
      {fb.length === 0 ? (
        <p className="muted">Bu kullanıcı adına öneri yok.</p>
      ) : (
        <ul className="stack" style={{ listStyle: "none", padding: 0 }}>
          {fb.map((x) => (
            <li key={x.suggestion.id} className="card quiet">
              <div className="small muted">
                {fmtDate(x.suggestion.created_at)} · {x.suggestion.unit} / {x.suggestion.area} · <span className="badge neutral">{KAIZEN_STATUS_LABEL[x.suggestion.status]}</span>
                {x.action && <> · aksiyon: {STATUS_LABEL[x.action.status]}</>}
              </div>
              <p>
                <b>{x.suggestion.proposal}</b> — {x.suggestion.observed}
              </p>
              <p className="small">{x.message}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Evaluate({ store }: { store: Store }) {
  const open = suggestions(store).filter((k) => k.status === "received" || k.status === "pre_evaluated");
  const [note, setNote] = useState<Record<string, string>>({});
  const [err, setErr] = useState<unknown>(null);
  const [msg, setMsg] = useState("");
  const decide = (k: KaizenRow, d: "pre_evaluated" | "transferred" | "not_suitable") => {
    setErr(null);
    try {
      const r = evaluateSuggestion(store, k.id, d, note[k.id] ?? "");
      setMsg(`${KAIZEN_STATUS_LABEL[r.status]}: ${r.proposal.slice(0, 60)}${r.action_id ? " · aksiyon açıldı (Karar kapısı)" : ""}`);
    } catch (e) {
      setErr(e);
    }
  };
  return (
    <div className="card">
      <h2>Elçi ön değerlendirmesi (KZN-02) · bekleyen {open.length}</h2>
      <p className="small">Öneriler puanlanmaz, sıralanmaz. Uygun öneri aksiyon tetikleyicisi olur; "uygun değil" gerekçe ister ve öneri sahibine iletilir. Yetki: performans.kaizen.evaluate (uzman kontrolör, yönetici).</p>
      <ErrorBox error={err} />
      {msg && (
        <Notice kind="ok">
          <p>{msg}</p>
        </Notice>
      )}
      {open.length === 0 ? (
        <p className="muted">Bekleyen öneri yok.</p>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Birim / alan</th>
                <th>Gözlem → öneri</th>
                <th>Durum</th>
                <th>Not / gerekçe</th>
                <th>Karar</th>
              </tr>
            </thead>
            <tbody>
              {open.map((k) => (
                <tr key={k.id}>
                  <td className="small">
                    {k.unit} / {k.area}
                    {k.photo && <div className="pf-state">foto: {k.photo.file_name}</div>}
                  </td>
                  <td>
                    <div className="small muted">{k.observed}</div>
                    <b>{k.proposal}</b>
                  </td>
                  <td>
                    <span className="badge neutral">{KAIZEN_STATUS_LABEL[k.status]}</span>
                  </td>
                  <td>
                    <input aria-label="Not" value={note[k.id] ?? ""} onChange={(e) => setNote({ ...note, [k.id]: e.target.value })} />
                  </td>
                  <td>
                    <div className="actions">
                      {k.status === "received" && <button onClick={() => decide(k, "pre_evaluated")}>Ön değerlendirildi</button>}
                      <button className="primary" onClick={() => decide(k, "transferred")}>
                        Aksiyona aktar
                      </button>
                      <button onClick={() => decide(k, "not_suitable")}>Uygun değil</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function UnitDashboard({ store }: { store: Store }) {
  const sum = summaryByUnit(store);
  return (
    <div className="card">
      <h2>Birim panosu (kişi bazlı sıralama yok — kural 11)</h2>
      {sum.length === 0 ? (
        <p className="muted">Henüz öneri yok; pano birim bazında sayı ve uygulanma oranı gösterir.</p>
      ) : (
        <>
          <Bars title="Birim bazında öneri sayısı" rows={sum.map((u) => ({ label: u.unit, value: String(u.received), unit: "öneri", variant: "plain" as const, note: `${u.transferred} aktarıldı, ${u.implemented} uygulandı` }))} />
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Birim</th>
                  <th>Alındı</th>
                  <th>Ön değerlendirildi</th>
                  <th>Aksiyona aktarıldı</th>
                  <th>Uygun değil</th>
                  <th>Uygulandı (aksiyon tamamlandı)</th>
                  <th>Uygulanma oranı</th>
                </tr>
              </thead>
              <tbody>
                {sum.map((u) => (
                  <tr key={u.unit}>
                    <td>{u.unit}</td>
                    <td className="num">{u.received}</td>
                    <td className="num">{u.pre_evaluated}</td>
                    <td className="num">{u.transferred}</td>
                    <td className="num">{u.not_suitable}</td>
                    <td className="num">{u.implemented}</td>
                    <td className="num">{u.implementation_rate_pct === null ? "—" : `%${u.implementation_rate_pct}`}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
      <p className="small muted">
        Aktarılan öneriler <Link href="/aksiyon/">Karar kapısı</Link>'nda izlenir; iki hedefin durumu <Link href="/analiz/">Analiz ve hedefler</Link>'de.
      </p>
    </div>
  );
}
