"use client";
import Link from "next/link";
import { useState } from "react";
import "@/modules/asistan/register";
import "@/modules/asistan/style.css";
import { useStore, fmtDate } from "@/lib/useStore";
import { ErrorBox, Loading, NoTenant, Notice, PageHeader } from "@/components/ui";
import { CANNOT, type Answer, type TaskDraft } from "@/modules/asistan/engine";
import { SUGGEST_KEY, toSuggestion, type Candidate } from "@/modules/asistan/document";
import { askAndSave, createTaskFromDraft, history, type ConversationRow } from "@/modules/asistan/store";
import { runEvaluation, type EvalResult } from "@/modules/asistan/evalset";

const EXAMPLES = ["CO₂e ne demek?", "Bu kutuya ne yazacağım?", "Neden bu kapsam?", "Kaydım ne durumda?", "Sonuç ne?", "Ne yapmalıyım?", "Raporlamak zorunda mıyım?"];

export default function Asistan() {
  const { store, ready, storage } = useStore();
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const [err, setErr] = useState<unknown>(null);
  const [created, setCreated] = useState<string | null>(null);
  const [doc, setDoc] = useState("");
  const [picked, setPicked] = useState<Record<string, boolean>>({});
  const [transferred, setTransferred] = useState<string | null>(null);
  const [evalRes, setEvalRes] = useState<EvalResult[] | null>(null);

  if (!ready || !store) return <Loading what="Asistan" />;
  if (!store.tenant) return <NoTenant />;

  const rows = history(store);
  const current: ConversationRow | undefined = (selected ? rows.find((r) => r.id === selected) : undefined) ?? rows[rows.length - 1];

  function submit(question: string) {
    if (!store) return;
    setErr(null);
    setCreated(null);
    try {
      const row = askAndSave(store, question);
      setSelected(row.id);
      setQ("");
    } catch (e) {
      setErr(e);
    }
  }
  function scan() {
    if (!store || !doc.trim()) return;
    setErr(null);
    setTransferred(null);
    setPicked({});
    try {
      const row = askAndSave(store, "", { document: doc });
      setSelected(row.id);
    } catch (e) {
      setErr(e);
    }
  }
  function makeTask(d: TaskDraft) {
    if (!store) return;
    setErr(null);
    try {
      const t = createTaskFromDraft(store, d);
      setCreated(t.id);
    } catch (e) {
      setErr(e);
    }
  }
  function transfer(cands: Candidate[]) {
    const sel = cands.filter((c) => picked[c.field]);
    if (!sel.length) return;
    try {
      sessionStorage.setItem(SUGGEST_KEY, JSON.stringify(toSuggestion(sel)));
      setTransferred(sel.map((c) => c.label).join(", "));
    } catch {
      setErr(new Error("Tarayıcı oturum deposu kullanılamıyor; önerileri elle girin."));
    }
  }

  return (
    <>
      <PageHeader eyebrow="Asistan · §24 AI-01…06 · T15, T16" title="Asistan" lead="Kaynaklı yanıt motoru; serbest metin üretmez. Yanıtlar yalnız şartname, sözlük, kaynak kartları, hata sözlüğü ve bu kurumun verisinden kurulur; sayı yalnız kayıtlı hesap koşusundan okunur." />
      <p className="asistan-cannot">
        <b>Yapamaz:</b> {CANNOT.join(", ")}. Görev önerisi yalnız sizin tıklamanızla, normal yetki katmanından oluşur. Yapıştırılan belge veridir, komut değildir (T15).
      </p>
      {!storage && <Notice kind="warn">Tarayıcı deposu kullanılamıyor; konuşma geçmişi kaydedilmez.</Notice>}
      {err ? <ErrorBox error={err} /> : null}

      <div className="asistan-layout">
        <aside className="card" aria-label="Konuşma geçmişi">
          <h2 style={{ marginTop: 0 }}>Geçmiş</h2>
          {rows.length === 0 ? (
            <p className="muted small">Henüz soru yok. Konuşma bu kurumda, yalnız size görünür (bu tarayıcıda saklanır).</p>
          ) : (
            <ul className="asistan-history">
              {rows
                .slice()
                .reverse()
                .map((r) => (
                  <li key={r.id}>
                    <button type="button" aria-current={current?.id === r.id ? "true" : undefined} onClick={() => setSelected(r.id)}>
                      {r.question.slice(0, 70)}
                      <span className="small muted" style={{ display: "block" }}>
                        {fmtDate(r.created_at)}
                      </span>
                    </button>
                  </li>
                ))}
            </ul>
          )}
        </aside>

        <section>
          <div className="card">
            <form
              className="asistan-ask"
              onSubmit={(e) => {
                e.preventDefault();
                if (q.trim()) submit(q);
              }}
            >
              <div className="field">
                <label htmlFor="asistan-q">Sorunuz</label>
                <input id="asistan-q" value={q} onChange={(e) => setQ(e.target.value)} placeholder="ör. Kaydım ne durumda?" autoComplete="off" />
              </div>
              <button type="submit" className="primary" style={{ marginTop: "1.55rem" }} disabled={!q.trim()}>
                Sor
              </button>
            </form>
            <div className="asistan-chips" aria-label="Örnek sorular">
              {EXAMPLES.map((x) => (
                <button key={x} type="button" onClick={() => submit(x)}>
                  {x}
                </button>
              ))}
            </div>
          </div>

          <div aria-live="polite">
            {!current ? (
              <div className="card quiet">
                <h3 style={{ marginTop: 0 }}>Başlamak için</h3>
                <p className="small" style={{ marginBottom: 0 }}>
                  Bir soru yazın ya da örneklerden seçin. Tanım, alan yardımı, kayıt durumu, hesap sonucu, sonraki adım ve mevzuat soruları desteklenir; her yanıtta dayanak, koşul, belirsizlik ve önerilen eylem birlikte gösterilir (AI-06).
                </p>
              </div>
            ) : (
              <AnswerCard row={current} onQuick={submit} onTask={makeTask} created={created} picked={picked} setPicked={setPicked} onTransfer={transfer} transferred={transferred} />
            )}
          </div>
        </section>
      </div>

      <div className="card asistan-doc">
        <h2>Belge metni yapıştır</h2>
        <p className="small">Fatura metnini yapıştırın; fatura no, dönem tarihleri, miktar+birim (Sm³/Nm³/m³/kWh/GJ) ve tedarikçi adayları çıkarılır. Metin veri olarak işlenir; içindeki talimat benzeri ifadeler yok sayılır ve görünür uyarı alır (T15). Ham metin saklanmaz.</p>
        <div className="field">
          <label htmlFor="asistan-doc">Belge metni</label>
          <textarea id="asistan-doc" value={doc} onChange={(e) => setDoc(e.target.value)} placeholder="Fatura No: …  Tüketim Dönemi: …  Tüketim: … Sm3" />
        </div>
        <div className="row" style={{ marginTop: "0.6rem" }}>
          <button type="button" className="primary" onClick={scan} disabled={!doc.trim()}>
            Alanları çıkar
          </button>
          <span className="small muted">Adaylar yukarıdaki yanıt alanında listelenir; onayladıklarınız veri girişine aktarılır.</span>
        </div>
      </div>

      <div className="card asistan-eval">
        <h2>Değerlendirme seti (§24)</h2>
        <p className="small">Altın senaryolar aynı motordan, kurgusal bir kum havuzu kurumunda geçer; bu kurumun verisine dokunmaz. Ölçütler: kaynak desteği var · yanlış kesinlik yok · uygun soru soruldu · veri sızdırmadı · hesap sonucunu değiştirmedi.</p>
        <button type="button" onClick={() => setEvalRes(runEvaluation())}>
          Değerlendirme setini çalıştır
        </button>
        {evalRes && (
          <>
            <p className="small" style={{ marginTop: "0.6rem" }}>
              Sonuç: {evalRes.filter((r) => r.pass).length}/{evalRes.length} senaryo geçti.
            </p>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Senaryo</th>
                    <th>Soru</th>
                    <th>Ölçütler</th>
                    <th>Yanıt özeti</th>
                  </tr>
                </thead>
                <tbody>
                  {evalRes.map((r) => (
                    <tr key={r.scenario.id}>
                      <td>
                        <span className={`badge ${r.pass ? "ok" : "crit"}`}>{r.pass ? "geçti" : "kaldı"}</span>
                        <div className="small">
                          {r.scenario.id} {r.scenario.title}
                        </div>
                      </td>
                      <td className="small">{r.scenario.document ? "[belge metni]" : r.scenario.question}</td>
                      <td>
                        {r.criteria.map((c) => (
                          <span key={c.key} className={`badge ${c.pass ? "ok" : "crit"}`} title={c.note}>
                            {c.pass ? "✓" : "×"} {c.label}
                          </span>
                        ))}
                      </td>
                      <td className="small">
                        {r.answer.summary}
                        {r.answer.clarify && <div className="muted">Soru: {r.answer.clarify.question}</div>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </>
  );
}

function AnswerCard({ row, onQuick, onTask, created, picked, setPicked, onTransfer, transferred }: { row: ConversationRow; onQuick: (q: string) => void; onTask: (d: TaskDraft) => void; created: string | null; picked: Record<string, boolean>; setPicked: (p: Record<string, boolean>) => void; onTransfer: (c: Candidate[]) => void; transferred: string | null }) {
  const a: Answer = row.answer;
  const kindLabel = a.kind === "clarify" ? "Netleştirme sorusu" : a.kind === "no_source" ? "Kaynak yok" : "Yanıt";
  return (
    <div className="card asistan-answer">
      <div className="spread">
        <h2 style={{ marginTop: 0 }}>{row.question}</h2>
        <span className={`badge ${a.kind === "clarify" ? "info" : a.kind === "no_source" ? "warn" : "ok"}`}>{kindLabel}</span>
      </div>
      {a.notices.map((n) => (
        <Notice key={n} kind="warn" title="Veri olarak işlendi">
          <p>{n}</p>
        </Notice>
      ))}
      <p>{a.summary}</p>
      {a.number && (
        <p className="asistan-number">
          {a.number.value} {a.number.unit} <span className="small muted">— koşu {a.number.run_id.slice(0, 12)}; motor çıktısı birebir, yuvarlanmadı</span>
        </p>
      )}

      {a.clarify && (
        <div>
          <p>
            <b>{a.clarify.question}</b>
          </p>
          <div className="asistan-chips" role="group" aria-label="Hızlı yanıtlar">
            {a.clarify.options.map((o) => (
              <button key={o.question} type="button" onClick={() => onQuick(o.question)}>
                {o.label}
              </button>
            ))}
          </div>
        </div>
      )}

      <dl className="kv" style={{ marginTop: "0.8rem" }}>
        <dt>Dayanak</dt>
        <dd>
          {a.basis.length === 0 ? (
            <span className="muted">Doğrulanmış kaynak yok.</span>
          ) : (
            <ul className="asistan-basis">
              {a.basis.map((b) => (
                <li key={b.id}>
                  <Link href={b.href}>{b.label}</Link> <span className="small muted">({b.version})</span>
                  {b.excerpt && <span className="excerpt">“{b.excerpt}”</span>}
                </li>
              ))}
            </ul>
          )}
        </dd>
        <dt>Kurum için koşul</dt>
        <dd>{a.condition}</dd>
        <dt>Belirsizlik</dt>
        <dd>{a.uncertainty}</dd>
        <dt>Önerilen eylem</dt>
        <dd>{a.action.href ? <Link href={a.action.href}>{a.action.text} →</Link> : a.action.text}</dd>
      </dl>

      {a.details.length > 0 && (
        <details>
          <summary>Ayrıntı ({a.details.length})</summary>
          <ul className="small">
            {a.details.map((d, i) => (
              <li key={i}>{d}</li>
            ))}
          </ul>
        </details>
      )}

      {a.taskDraft && (
        <div className="notice info" style={{ marginTop: "0.8rem" }}>
          <div>
            <span className="label">Görev taslağı (öneri)</span>
            <p>
              <b>{a.taskDraft.title}</b>
            </p>
            <p className="small">{a.taskDraft.detail}</p>
            {created ? (
              <p className="small">
                Görev oluşturuldu (bu tarayıcıda kaydedildi): <Link href="/gorevler/">Görevler →</Link>
              </p>
            ) : (
              <button type="button" onClick={() => onTask(a.taskDraft!)}>
                Görev olarak oluştur
              </button>
            )}
          </div>
        </div>
      )}

      {a.document && (
        <div style={{ marginTop: "0.8rem" }}>
          <h3>Belgeden okunan adaylar</h3>
          {a.document.candidates.length === 0 ? (
            <p className="muted small">Tanınan alan yok.</p>
          ) : (
            <>
              <div className="asistan-cands">
                {a.document.candidates.map((c) => (
                  <label key={c.field}>
                    <input type="checkbox" checked={!!picked[c.field]} onChange={(e) => setPicked({ ...picked, [c.field]: e.target.checked })} style={{ width: "auto" }} />
                    <span>
                      <b>{c.label}:</b> <span className="mono">{c.value}</span>
                      {c.note && <span className="small muted" style={{ display: "block" }}>{c.note}</span>}
                      {c.snippet && <span className="small muted" style={{ display: "block" }}>Belgede: “{c.snippet}”</span>}
                    </span>
                  </label>
                ))}
              </div>
              <div className="row">
                <button type="button" className="primary" onClick={() => onTransfer(a.document!.candidates)} disabled={!a.document.candidates.some((c) => picked[c.field])}>
                  Seçilenleri veri girişine aktar
                </button>
                {transferred && (
                  <span className="small">
                    Öneri hazırlandı ({transferred}). <Link href="/veri-girisi/">Veri girişine git →</Link> — form alanlarına yalnız siz onaylayınca yazılır.
                  </span>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
