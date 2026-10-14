"use client";
// /aksiyon — Karar kapısı ve aksiyon motoru (AKS-01…05; forum 7 adım).
import Link from "next/link";
import { useMemo, useState } from "react";
import { ROLE_LABEL, type ValueState } from "@/lib/domain";
import type { Store } from "@/lib/store";
import { fmtDate, fmtDec } from "@/lib/useStore";
import { ErrorBox, Notice } from "@/components/ui";
import { ASSESSMENT_KEYS, STATUS_LABEL, TRIGGER_LABEL, actions, closeAction, effectsOf, measureEffect, recordRootCause, saveOptions, savePreAssessment, saveThresholds, shadowPrice, shadowScenarioLine, startAction, startPilot } from "./actions";
import { detectDeviations } from "./analysis";
import { catalog, denominators } from "./indicators";
import { metricLabel, metricValue } from "./metrics";
import { suggestions } from "./kaizen";
import { Bars, Steps } from "./ui";
import type { ActionOption, ActionRow, AssessmentField, AssessmentKey, GoalThreshold, InvestmentImpact, MetricSpec, TriggerType } from "./types";

const STEP_ITEMS = [
  { key: "started", label: "1 Başlat" },
  { key: "pre_assessed", label: "2 Ön değerlendir" },
  { key: "data", label: "3 Veriyi doğrula (GÖS-04)" },
  { key: "options", label: "4 Seçenek üret" },
  { key: "pilot", label: "5 Pilot uygula" },
  { key: "measured", label: "6 Sonucu ölç" },
  { key: "decided", label: "7 Karar" },
  { key: "completed", label: "Standardize edildi" },
];
const stepKey = (st: ActionRow["status"]) => (st === "redesign" ? "decided" : st);
const VS: Record<ValueState, string> = { unknown: "bilinmiyor", known: "biliniyor", not_applicable: "uygulanamaz" };

export function AksiyonView({ store }: { store: Store }) {
  const list = actions(store).slice().reverse();
  const [sel, setSel] = useState<string>(list[0]?.id ?? "");
  const cur = list.find((a) => a.id === sel) ?? null;
  return (
    <>
      <Notice kind="info" title="Önizleme deposu: bu tarayıcı">
        <p>Karar akışı: tetikleyici → ön değerlendirme → veri doğrulama → seçenekler → pilot → ölçüm → karar. Aksiyon, baz–pilot etkisi ölçülmeden kapanmaz; iki hedef de eşiği karşılamazsa kök neden ve yeniden tasarım. Rolünüz: {ROLE_LABEL[store.role]}.</p>
      </Notice>
      <Triggers store={store} onCreated={(id) => setSel(id)} />
      <div className="card">
        <h2>Aksiyonlar ({list.length})</h2>
        {list.length === 0 ? (
          <p className="muted">Henüz aksiyon yok. Yukarıdan bir tetikleyiciyle başlatın.</p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Aksiyon</th>
                  <th>Tetikleyici</th>
                  <th>Durum</th>
                  <th>Açılış</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {list.map((a) => (
                  <tr key={a.id} aria-current={a.id === sel ? "true" : undefined}>
                    <td>
                      <b>{a.title}</b>
                      {a.trigger_note && <div className="small muted">{a.trigger_note}</div>}
                    </td>
                    <td className="small">{TRIGGER_LABEL[a.trigger_type]}</td>
                    <td>
                      <span className={`badge ${a.status === "completed" ? "ok" : a.status === "redesign" ? "warn" : "info"}`}>{STATUS_LABEL[a.status]}</span>
                    </td>
                    <td className="small">{fmtDate(a.created_at)}</td>
                    <td>
                      <button onClick={() => setSel(a.id)}>{a.id === sel ? "Açık" : "Aç"}</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {cur && <ActionDetail key={cur.id + ":" + cur.version} store={store} a={cur} />}
    </>
  );
}

// ---------------- Tetikleyiciler (AKS-01) ----------------
function Triggers({ store, onCreated }: { store: Store; onCreated: (id: string) => void }) {
  const periods = store.periods();
  const latest = periods[periods.length - 1];
  const devs = latest ? detectDeviations(store, latest.id).filter((d) => d.deviates) : [];
  const pendingSug = suggestions(store).filter((k) => k.status === "transferred" && !k.action_id).length;
  const [open, setOpen] = useState(false);
  const [f, setF] = useState<{ title: string; trigger_type: TriggerType; trigger_note: string; trigger_ref: string | null }>({ title: "", trigger_type: "process_change", trigger_note: "", trigger_ref: null });
  const [imp, setImp] = useState<InvestmentImpact>({ value_state: "unknown", value: null, unit: "tCO2e", note: "" });
  const [err, setErr] = useState<unknown>(null);
  const [msg, setMsg] = useState("");
  const create = () => {
    setErr(null);
    try {
      const a = startAction(store, { ...f, investment_impact: f.trigger_type === "investment" ? { ...imp, value: imp.value ? imp.value.replace(",", ".") : null } : null });
      setMsg(`Aksiyon başlatıldı (bu tarayıcıda): ${a.title} · ${STATUS_LABEL[a.status]} · sonraki adım: ön değerlendirme.`);
      setOpen(false);
      onCreated(a.id);
    } catch (e) {
      setErr(e);
    }
  };
  const fromDeviation = (title: string, ref: string, note: string) => {
    setF({ title, trigger_type: "kpi_deviation", trigger_ref: ref, trigger_note: note });
    setOpen(true);
  };
  return (
    <div className="card">
      <h2>1 · Tetikleyiciler</h2>
      <p className="small">KPI sapması etkin hedeflerin eşiğinden otomatik tespit edilir; yeni yatırım, süreç/hat değişikliği, mevzuat gereği elle açılır; çalışan önerisi Green Kaizen ön değerlendirmesinden gelir.</p>
      <ErrorBox error={err} />
      {msg && (
        <Notice kind="ok">
          <p>{msg}</p>
        </Notice>
      )}
      {latest ? (
        devs.length ? (
          <ul className="small">
            {devs.map((d) => (
              <li key={d.target.id}>
                <span className="badge crit">KPI sapması</span> {d.target.title}: dönem değeri {fmtDec(d.current)} vs referans {fmtDec(d.reference)} ({d.reference_year}) → %{d.deviation_pct} (tolerans ±%{d.target.deviation_tolerance_pct}){" "}
                <button onClick={() => fromDeviation(`Sapma: ${d.target.title}`, d.target.id, `Dönem ${latest.start} → ${latest.end}: %${d.deviation_pct} sapma`)}>Aksiyon başlat</button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="small muted">Son dönemde ({latest.start} → {latest.end}) etkin hedeflerde eşiği aşan sapma yok ya da hedef/dönem değeri girilmemiş (<Link href="/analiz/">Analiz ve hedefler</Link>).</p>
        )
      ) : (
        <p className="small muted">Dönem yok; KPI sapması izlenemez.</p>
      )}
      {pendingSug > 0 && <p className="small">{pendingSug} çalışan önerisi aksiyona aktarılmayı bekliyor (Green Kaizen).</p>}
      {!open ? (
        <button className="primary" onClick={() => setOpen(true)}>
          Yeni aksiyon başlat
        </button>
      ) : (
        <div>
          <div className="pf-inline-form">
            <div className="field">
              <label htmlFor="at">Başlık</label>
              <input id="at" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} />
            </div>
            <div className="field">
              <label htmlFor="atr">Tetikleyici</label>
              <select id="atr" value={f.trigger_type} onChange={(e) => setF({ ...f, trigger_type: e.target.value as TriggerType })}>
                {(Object.keys(TRIGGER_LABEL) as TriggerType[]).filter((k) => k !== "employee_suggestion").map((k) => (
                  <option key={k} value={k}>
                    {TRIGGER_LABEL[k]}
                  </option>
                ))}
              </select>
              <span className="hint">Çalışan önerisi yalnız Green Kaizen ön değerlendirmesinden gelir.</span>
            </div>
            <div className="field">
              <label htmlFor="an">Not (ihtiyaç / sapma / mevzuat kaynağı)</label>
              <input id="an" value={f.trigger_note} onChange={(e) => setF({ ...f, trigger_note: e.target.value })} />
            </div>
            {f.trigger_type === "investment" && (
              <>
                <div className="field">
                  <label htmlFor="iv">Enerji/emisyon etkisi — durum (AKS-05, zorunlu)</label>
                  <select id="iv" value={imp.value_state} onChange={(e) => setImp({ ...imp, value_state: e.target.value as ValueState })}>
                    <option value="unknown">bilinmiyor (talep açılamaz)</option>
                    <option value="known">biliniyor</option>
                    <option value="not_applicable">uygulanamaz (gerekçeyle)</option>
                  </select>
                </div>
                {imp.value_state === "known" && (
                  <>
                    <div className="field">
                      <label htmlFor="ivv">Beklenen etki (değer)</label>
                      <input id="ivv" inputMode="decimal" value={imp.value ?? ""} onChange={(e) => setImp({ ...imp, value: e.target.value })} />
                    </div>
                    <div className="field">
                      <label htmlFor="ivu">Birim</label>
                      <select id="ivu" value={imp.unit ?? ""} onChange={(e) => setImp({ ...imp, unit: e.target.value })}>
                        {["tCO2e", "kgCO2e", "kWh", "GJ"].map((u) => (
                          <option key={u} value={u}>
                            {u}
                          </option>
                        ))}
                      </select>
                    </div>
                  </>
                )}
                <div className="field">
                  <label htmlFor="ivn">Etki notu / gerekçe</label>
                  <input id="ivn" value={imp.note} onChange={(e) => setImp({ ...imp, note: e.target.value })} />
                </div>
              </>
            )}
          </div>
          <div className="actions" style={{ marginTop: "0.6rem" }}>
            <button className="primary" onClick={create}>
              Başlat
            </button>
            <button onClick={() => setOpen(false)}>Vazgeç</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------- Aksiyon detayı ----------------
function ActionDetail({ store, a }: { store: Store; a: ActionRow }) {
  const [err, setErr] = useState<unknown>(null);
  const [msg, setMsg] = useState("");
  const run = (fn: () => string) => {
    setErr(null);
    try {
      setMsg(fn());
    } catch (e) {
      setErr(e);
    }
  };
  const effects = effectsOf(store, a.id);
  const sp = shadowPrice(store);
  return (
    <div className="card">
      <h2>
        {a.title} <span className="badge info">{STATUS_LABEL[a.status]}</span>
      </h2>
      <Steps items={STEP_ITEMS} current={stepKey(a.status)} />
      <ErrorBox error={err} />
      {msg && (
        <Notice kind="ok">
          <p>{msg}</p>
        </Notice>
      )}
      <dl className="kv">
        <dt>Tetikleyici</dt>
        <dd>
          {TRIGGER_LABEL[a.trigger_type]}
          {a.trigger_ref && <span className="mono small"> · {a.trigger_ref.slice(0, 12)}</span>}
          {a.trigger_note && ` · ${a.trigger_note}`}
        </dd>
        {a.root_cause && (
          <>
            <dt>Kök neden</dt>
            <dd>{a.root_cause}</dd>
          </>
        )}
      </dl>
      {a.trigger_type === "investment" && (
        <div style={{ marginTop: "0.6rem" }}>
          <h3>Yatırım talebi — enerji/emisyon etkisi (AKS-05)</h3>
          <p className="small">
            Beklenen etki: {a.investment_impact ? (a.investment_impact.value_state === "known" ? `${fmtDec(a.investment_impact.value)} ${a.investment_impact.unit}` : VS[a.investment_impact.value_state]) : "—"} {a.investment_impact?.note && `· ${a.investment_impact.note}`}
          </p>
          <div className="pf-scenario">
            <b>Senaryo satırı (envanterden ayrı):</b> {shadowScenarioLine(a.investment_impact, sp).text}
            {sp && <div className="small muted">Gölge fiyat: {sp.price} {sp.currency}/{sp.per_unit} {sp.source_note && `· ${sp.source_note}`} · kaynak: senaryo defteri (disiliskiler)</div>}
          </div>
        </div>
      )}
      <PreAssessment store={store} a={a} run={run} />
      <DataCheck />
      <Options store={store} a={a} run={run} />
      <Thresholds store={store} a={a} run={run} />
      <Pilot store={store} a={a} run={run} />
      <div style={{ marginTop: "1rem" }}>
        <h3>6–7 · Sonucu ölç ve karar ver</h3>
        <p className="small">Baz dönem ile pilot dönemi kayıtlı gösterge değerleriyle karşılaştırılır. İki hedef de eşiği karşılarsa standardize; değilse kök neden ve yeniden tasarım. Etki satırı değişmezdir; her ölçüm yeni satırdır.</p>
        <div className="actions">
          <button className="primary" disabled={!["pilot", "measured", "redesign"].includes(a.status)} onClick={() => run(() => {
            const e = measureEffect(store, a.id);
            return `Etki ölçüldü: hedef 1 ${e.goal1_met ? "karşılandı" : "karşılanmadı"}, hedef 2 ${e.goal2_met ? "karşılandı" : "karşılanmadı"} → karar: ${e.decision === "standardize" ? "standardize et" : "kök neden / yeniden tasarım"}.`;
          })}>
            Etkiyi ölç
          </button>
          <button disabled={a.status !== "decided"} onClick={() => run(() => `${closeAction(store, a.id).title} tamamlandı (standardize edildi). Yetki: performans.action.close.`)}>
            Standardize et ve kapat
          </button>
          {a.status !== "decided" && a.status !== "completed" && <span className="small muted">Kapatma yalnız ölçülmüş ve iki eşiği geçen etkiden sonra açılır.</span>}
        </div>
        {effects.length > 0 && (
          <>
            <Bars
              title="Son ölçüm: baz ve pilot"
              rows={effects[effects.length - 1].metrics.flatMap((m) => [
                { label: `${m.label} · baz`, value: m.baseline, unit: m.unit, variant: "plain" as const },
                { label: `${m.label} · pilot`, value: m.pilot, unit: m.unit, variant: "approved" as const, note: m.change_pct !== null ? `%${m.change_pct} · ${m.met ? "eşik karşılandı" : "eşik karşılanmadı"}` : m.note },
              ])}
            />
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Ölçüm</th>
                    <th>Hedef</th>
                    <th>Ölçüt</th>
                    <th>Baz → pilot</th>
                    <th>Değişim</th>
                    <th>Eşik</th>
                    <th>Karar</th>
                  </tr>
                </thead>
                <tbody>
                  {effects.map((e) =>
                    e.metrics.map((m, i) => (
                      <tr key={e.id + i}>
                        <td className="small">{i === 0 ? fmtDate(e.created_at) : ""}</td>
                        <td>{m.goal === "efficiency" ? "1 Verimlilik" : "2 Çalışan memnuniyeti"}</td>
                        <td className="small">{m.label}</td>
                        <td className="num">
                          {fmtDec(m.baseline)} → {fmtDec(m.pilot)} {m.unit}
                        </td>
                        <td className="num">{m.change_pct === null ? "—" : `%${m.change_pct}`}</td>
                        <td>{m.met === null ? <span className="badge neutral">değerlendirilemedi</span> : m.met ? <span className="badge ok">karşılandı</span> : <span className="badge warn">karşılanmadı</span>}</td>
                        <td>{i === 0 && (e.decision === "standardize" ? <span className="badge ok">standardize</span> : <span className="badge warn">yeniden tasarım</span>)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}
        {a.status === "redesign" && <RootCause store={store} a={a} run={run} />}
        {a.status === "completed" && (
          <p className="small">
            Kapatıldı: {a.closed_at ? fmtDate(a.closed_at) : ""} · standardize edildi. Çalışan önerisinden geldiyse öneri sahibi ölçülen etkiyi Green Kaizen sayfasında görür (KZN-03).
          </p>
        )}
      </div>
    </div>
  );
}

function PreAssessment({ store, a, run }: { store: Store; a: ActionRow; run: (fn: () => string) => void }) {
  const [pre, setPre] = useState<Record<AssessmentKey, AssessmentField>>(a.pre_assessment);
  const editable = ["started", "pre_assessed", "redesign"].includes(a.status);
  return (
    <div style={{ marginTop: "1rem" }}>
      <h3>2 · Ön değerlendirme (AKS-02)</h3>
      <p className="small">Her alan varsayılan olarak "bilinmiyor"dur ve otomatik doldurulmaz. Bilinen etki için kısa not yazın; "uygulanamaz" gerekçe ister.</p>
      <div className="pf-assess">
        {ASSESSMENT_KEYS.map((k) => (
          <div key={k.key} style={{ display: "contents" }}>
            <label htmlFor={`pa-${k.key}`}>{k.tr}</label>
            <select id={`pa-${k.key}`} value={pre[k.key].value_state} disabled={!editable} onChange={(e) => setPre({ ...pre, [k.key]: { ...pre[k.key], value_state: e.target.value as ValueState } })}>
              {(Object.keys(VS) as ValueState[]).map((v) => (
                <option key={v} value={v}>
                  {VS[v]}
                </option>
              ))}
            </select>
            <input aria-label={`${k.tr} notu`} value={pre[k.key].note} disabled={!editable} placeholder={pre[k.key].value_state === "unknown" ? "—" : "beklenen etki / gerekçe"} onChange={(e) => setPre({ ...pre, [k.key]: { ...pre[k.key], note: e.target.value } })} />
          </div>
        ))}
      </div>
      {editable && (
        <button style={{ marginTop: "0.5rem" }} onClick={() => run(() => `Ön değerlendirme kaydedildi: ${savePreAssessment(store, a.id, pre).title}. Sonraki adım: veriyi doğrula, seçenek üret.`)}>
          Ön değerlendirmeyi kaydet
        </button>
      )}
    </div>
  );
}

function DataCheck() {
  return (
    <div style={{ marginTop: "1rem" }}>
      <h3>3 · Veriyi doğrula (GÖS-04)</h3>
      <p className="small">
        Ölçümde kullanılacak gösterge değerleri veri sözleşmesi testlerinden geçmiş olmalıdır; düzeltme kuyruğundaki satırlar ölçümde kullanılmaz. Kuyruk ve giriş: <Link href="/analiz/">Analiz ve hedefler</Link>.
      </p>
    </div>
  );
}

function Options({ store, a, run }: { store: Store; a: ActionRow; run: (fn: () => string) => void }) {
  const blank = (): Omit<ActionOption, "id"> => ({ title: "", economic: "", environmental: "", employee: "", pilot_owner_role: "", pilot_owner_unit: "", pilot_duration_days: "" });
  const [opts, setOpts] = useState<Omit<ActionOption, "id">[]>(a.options.length ? a.options : [blank(), blank()]);
  const [chosen, setChosen] = useState<string | null>(a.chosen_option_id);
  const editable = ["pre_assessed", "options", "redesign"].includes(a.status);
  const upd = (i: number, k: keyof Omit<ActionOption, "id">, v: string) => setOpts(opts.map((o, j) => (j === i ? { ...o, [k]: v } : o)));
  return (
    <div style={{ marginTop: "1rem" }}>
      <h3>4 · Seçenekleri yan yana karşılaştır (AKS-03)</h3>
      <p className="small">Ekonomik, çevresel ve çalışan etkisi birlikte; her seçeneğe pilot sorumlusu (rol/birim) ve süre atanır. Seçimi işaretleyip kaydedin.</p>
      <div className="table-wrap">
        <table className="pf-opt-table">
          <thead>
            <tr>
              <th>Seç</th>
              <th>Seçenek</th>
              <th>Ekonomik etki</th>
              <th>Çevresel etki</th>
              <th>Çalışan etkisi</th>
              <th>Pilot sorumlusu rol</th>
              <th>Birim</th>
              <th>Süre (gün)</th>
            </tr>
          </thead>
          <tbody>
            {opts.map((o, i) => {
              const id = a.options[i]?.id ?? `new-${i}`;
              return (
                <tr key={i}>
                  <td>
                    <input type="radio" name={`chosen-${a.id}`} aria-label={`Seçenek ${i + 1} seç`} disabled={!editable || !a.options[i]} checked={chosen === id} onChange={() => setChosen(id)} />
                  </td>
                  {(["title", "economic", "environmental", "employee"] as const).map((k) => (
                    <td key={k}>
                      <input aria-label={`Seçenek ${i + 1} ${k}`} value={o[k]} disabled={!editable} onChange={(e) => upd(i, k, e.target.value)} />
                    </td>
                  ))}
                  <td>
                    <select aria-label={`Seçenek ${i + 1} pilot rolü`} value={o.pilot_owner_role} disabled={!editable} onChange={(e) => upd(i, "pilot_owner_role", e.target.value)}>
                      <option value="">—</option>
                      {Object.entries(ROLE_LABEL).map(([k, v]) => (
                        <option key={k} value={v}>
                          {v}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <input aria-label={`Seçenek ${i + 1} birim`} value={o.pilot_owner_unit} disabled={!editable} onChange={(e) => upd(i, "pilot_owner_unit", e.target.value)} />
                  </td>
                  <td>
                    <input aria-label={`Seçenek ${i + 1} süre`} inputMode="numeric" value={o.pilot_duration_days} disabled={!editable} onChange={(e) => upd(i, "pilot_duration_days", e.target.value)} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {editable && (
        <div className="actions" style={{ marginTop: "0.5rem" }}>
          <button onClick={() => setOpts([...opts, blank()])}>Seçenek ekle</button>
          <button className="primary" onClick={() => run(() => {
            const r = saveOptions(store, a.id, opts, chosen && !chosen.startsWith("new-") ? chosen : null);
            return `${r.options.length} seçenek kaydedildi${r.chosen_option_id ? "; seçim işaretlendi, pilot başlatılabilir" : "; önce kaydedin, sonra seçimi işaretleyip yeniden kaydedin"}.`;
          })}>
            Seçenekleri kaydet
          </button>
        </div>
      )}
      {a.chosen_option_id && <p className="small">Seçilen: <b>{a.options.find((o) => o.id === a.chosen_option_id)?.title}</b></p>}
    </div>
  );
}

function MetricPicker({ store, id, value, onChange, goal }: { store: Store; id: string; value: MetricSpec; onChange: (m: MetricSpec) => void; goal: "efficiency" | "satisfaction" }) {
  const cat = useMemo(() => catalog(store), [store]);
  const dens = denominators(store);
  const nums = cat.filter((i) => i.family !== "denominator" && i.entry !== "profile_denominator");
  const units = Array.from(new Set(suggestions(store).map((k) => k.unit)));
  return (
    <div className="pf-inline-form">
      <div className="field">
        <label htmlFor={`${id}-kind`}>Ölçüt türü</label>
        <select id={`${id}-kind`} value={value.kind} onChange={(e) => {
          const k = e.target.value as MetricSpec["kind"];
          if (k === "intensity") onChange({ kind: "intensity", indicator_id: nums[0]?.id ?? "", denominator_id: dens[0]?.id ?? "" });
          else if (k === "indicator") onChange({ kind: "indicator", indicator_id: nums[0]?.id ?? "" });
          else if (k === "suggestion_rate") onChange({ kind: "suggestion_rate", unit: null });
          else onChange({ kind: "satisfaction", unit: units[0] ?? "" });
        }}>
          {goal === "efficiency" ? (
            <>
              <option value="intensity">Yoğunluk (profil paydası)</option>
              <option value="indicator">Gösterge (ör. atık/fire)</option>
            </>
          ) : (
            <>
              <option value="suggestion_rate">Öneri aktarım oranı</option>
              <option value="satisfaction">Memnuniyet skoru (birim)</option>
              <option value="indicator">Gösterge (ör. kişi başı eğitim)</option>
            </>
          )}
        </select>
      </div>
      {(value.kind === "intensity" || value.kind === "indicator") && (
        <div className="field">
          <label htmlFor={`${id}-ind`}>Gösterge</label>
          <select id={`${id}-ind`} value={value.indicator_id} onChange={(e) => onChange({ ...value, indicator_id: e.target.value })}>
            {nums.map((i) => (
              <option key={i.id} value={i.id}>
                {i.name.tr}
              </option>
            ))}
          </select>
        </div>
      )}
      {value.kind === "intensity" && (
        <div className="field">
          <label htmlFor={`${id}-den`}>Payda</label>
          <select id={`${id}-den`} value={value.denominator_id} onChange={(e) => onChange({ ...value, denominator_id: e.target.value })}>
            {dens.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name.tr}
              </option>
            ))}
          </select>
        </div>
      )}
      {(value.kind === "satisfaction" || value.kind === "suggestion_rate") && (
        <div className="field">
          <label htmlFor={`${id}-unit`}>Birim</label>
          <input id={`${id}-unit`} value={value.unit ?? ""} placeholder={value.kind === "suggestion_rate" ? "boş = tüm birimler" : "birim adı"} onChange={(e) => onChange(value.kind === "satisfaction" ? { kind: "satisfaction", unit: e.target.value } : { kind: "suggestion_rate", unit: e.target.value || null })} />
        </div>
      )}
    </div>
  );
}

function Thresholds({ store, a, run }: { store: Store; a: ActionRow; run: (fn: () => string) => void }) {
  const dens = denominators(store);
  const [eff, setEff] = useState<GoalThreshold>(a.thresholds.efficiency ?? { metric: { kind: "intensity", indicator_id: "electricity_kwh", denominator_id: dens[0]?.id ?? "" }, direction: "decrease", min_change_pct: "" });
  const [sat, setSat] = useState<GoalThreshold>(a.thresholds.satisfaction ?? { metric: { kind: "suggestion_rate", unit: null }, direction: "increase", min_change_pct: "" });
  const editable = a.status !== "completed";
  const preview = (t: GoalThreshold) => (a.baseline_period_id && a.pilot_period_id ? `${metricValue(store, t.metric, a.baseline_period_id).value ?? "bilinmiyor"} → ${metricValue(store, t.metric, a.pilot_period_id).value ?? "bilinmiyor"}` : "");
  return (
    <div style={{ marginTop: "1rem" }}>
      <h3>İki hedefin eşiği (AKS-04)</h3>
      <p className="small">Ölçüt ve en az değişim yüzdesi kurumun kararıdır; kodda eşik yoktur. Tanımlanmadan etki ölçülmez.</p>
      <div className="pf-side">
        {[
          { key: "efficiency" as const, title: "Hedef 1 · Verimlilik", t: eff, set: setEff },
          { key: "satisfaction" as const, title: "Hedef 2 · Çalışan memnuniyeti", t: sat, set: setSat },
        ].map(({ key, title, t, set }) => (
          <div key={key}>
            <h4>{title}</h4>
            <MetricPicker store={store} id={`${a.id}-${key}`} goal={key} value={t.metric} onChange={(m) => set({ ...t, metric: m })} />
            <div className="pf-inline-form">
              <div className="field">
                <label htmlFor={`${a.id}-${key}-dir`}>Beklenen yön</label>
                <select id={`${a.id}-${key}-dir`} value={t.direction} disabled={!editable} onChange={(e) => set({ ...t, direction: e.target.value as GoalThreshold["direction"] })}>
                  <option value="decrease">azalış</option>
                  <option value="increase">artış</option>
                </select>
              </div>
              <div className="field">
                <label htmlFor={`${a.id}-${key}-min`}>En az değişim (%)</label>
                <input id={`${a.id}-${key}-min`} inputMode="decimal" value={t.min_change_pct} disabled={!editable} onChange={(e) => set({ ...t, min_change_pct: e.target.value })} />
              </div>
            </div>
            {a.thresholds[key] && <p className="small muted">Kayıtlı: {metricLabel(store, a.thresholds[key]!.metric)} · {a.thresholds[key]!.direction === "decrease" ? "azalış" : "artış"} ≥ %{a.thresholds[key]!.min_change_pct} {preview(a.thresholds[key]!) && `· baz → pilot: ${preview(a.thresholds[key]!)}`}</p>}
          </div>
        ))}
      </div>
      {editable && (
        <button style={{ marginTop: "0.5rem" }} onClick={() => run(() => {
          saveThresholds(store, a.id, { efficiency: { ...eff, min_change_pct: eff.min_change_pct.replace(",", ".") }, satisfaction: { ...sat, min_change_pct: sat.min_change_pct.replace(",", ".") } });
          return "Eşikler kaydedildi.";
        })}>
          Eşikleri kaydet
        </button>
      )}
    </div>
  );
}

function Pilot({ store, a, run }: { store: Store; a: ActionRow; run: (fn: () => string) => void }) {
  const periods = store.periods();
  const [base, setBase] = useState(a.baseline_period_id ?? periods[0]?.id ?? "");
  const [pilot, setPilot] = useState(a.pilot_period_id ?? periods[1]?.id ?? "");
  const opt = a.options.find((o) => o.id === a.chosen_option_id);
  const lbl = (id: string | null) => {
    const p = periods.find((x) => x.id === id);
    return p ? `${p.start} → ${p.end}` : "—";
  };
  return (
    <div style={{ marginTop: "1rem" }}>
      <h3>5 · Pilot uygula</h3>
      <p className="small">Seçilen seçenek, pilot sorumlusu (rol/birim) ve süresiyle sahada denenir; baz dönem ve pilot dönemi kayıtlı gösterge dönemleridir.</p>
      {opt && (
        <p className="small">
          Seçenek: <b>{opt.title}</b> · sorumlu: {opt.pilot_owner_role || "—"} {opt.pilot_owner_unit && `/ ${opt.pilot_owner_unit}`} · {opt.pilot_duration_days} gün
        </p>
      )}
      {a.status === "options" ? (
        <div className="pf-inline-form">
          <div className="field">
            <label htmlFor={`${a.id}-base`}>Baz dönem</label>
            <select id={`${a.id}-base`} value={base} onChange={(e) => setBase(e.target.value)}>
              {periods.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.start} → {p.end}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor={`${a.id}-pilot`}>Pilot dönemi</label>
            <select id={`${a.id}-pilot`} value={pilot} onChange={(e) => setPilot(e.target.value)}>
              {periods.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.start} → {p.end}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <button className="primary" onClick={() => run(() => `Pilot başladı: ${startPilot(store, a.id, base, pilot).title}. Dönem değerleri girildikten sonra etkiyi ölçün.`)}>
              Pilotu başlat
            </button>
          </div>
        </div>
      ) : (
        <p className="small muted">
          Baz: {lbl(a.baseline_period_id)} · pilot: {lbl(a.pilot_period_id)}
        </p>
      )}
    </div>
  );
}

function RootCause({ store, a, run }: { store: Store; a: ActionRow; run: (fn: () => string) => void }) {
  const [rc, setRc] = useState("");
  return (
    <div className="field" style={{ marginTop: "0.8rem" }}>
      <label htmlFor={`${a.id}-rc`}>Kök neden (yeniden tasarım için zorunlu)</label>
      <textarea id={`${a.id}-rc`} value={rc} onChange={(e) => setRc(e.target.value)} />
      <div>
        <button className="primary" onClick={() => run(() => `${recordRootCause(store, a.id, rc).title}: kök neden kaydedildi; akış seçenek adımına döndü.`)}>
          Kök nedeni kaydet, yeniden tasarla
        </button>
      </div>
    </div>
  );
}
