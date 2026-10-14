"use client";
// Ürün çalışması (§17, REG-03, T08, T09): ayrı hesap bağlamı; sonucu kurumsal toplama GİRMEZ (kural 8).
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { aggregate, calculate } from "@/lib/calc";
import type { AggregateResult } from "@/lib/calc";
import { can, ROLE_LABEL, STATE_LABEL } from "@/lib/domain";
import { StoreError } from "@/lib/store";
import { useStore, fmtDate, fmtDec } from "@/lib/useStore";
import { ErrorBox, Loading, NoTenant, Notice, PageHeader } from "@/components/ui";
import { CalcResultView, EngineStatus, useEngine } from "@/modules/urun-rapor/components";
import {
  addLine,
  BOUNDARY_QUESTIONS,
  boundaryLabel,
  boundaryTitle,
  buildLineRequest,
  buildStudyAggregateRequest,
  CRADLE_TO_CRADLE_NOTE_TR,
  createStudy,
  emptyExplanation,
  EXPLANATION_LABEL,
  factorKey,
  isCurrentResult,
  latestResult,
  lineResultFrom,
  PROCESS_KIND_LABEL,
  publishedFactors,
  removeLine,
  resultsOf,
  saveStudyResult,
  studies,
  study,
  updateStudy,
} from "@/modules/urun-rapor/study";
import type { AllocationBasis, BoundaryExplanation, LineResult, ProcessKind, Study, StudyBoundary, StudyResult } from "@/modules/urun-rapor/types";
import "@/modules/urun-rapor/style.css";

export default function Page() {
  return (
    <Suspense fallback={<Loading />}>
      <Urun />
    </Suspense>
  );
}

const EXCLUSION_TR = "Ürün çalışması sonuçları kurumsal envantere ve rapor toplamlarına hiçbir zaman eklenmez; raporda yalnız 'Ürün çalışmaları' bölümünde ayrı listelenir (§17, REG-03, kural 8).";

function Urun() {
  const { store, ready } = useStore();
  const params = useSearchParams();
  const id = params.get("id") ?? "";
  if (!ready || !store) return <Loading />;
  if (!store.tenant) return <NoTenant />;
  const writer = can(store.role, "urun-rapor.study.write");
  if (id) return <StudyDetail id={id} writer={writer} />;
  return <StudyList writer={writer} />;
}

// ---------- Liste + yeni çalışma ----------

function StudyList({ writer }: { writer: boolean }) {
  const { store } = useStore();
  const [err, setErr] = useState<unknown>(null);
  const [showForm, setShowForm] = useState(false);
  const [saved, setSaved] = useState<Study | null>(null);
  const list = studies(store!);
  return (
    <>
      <PageHeader eyebrow={`Ürün · §17 · REG-03 · rol: ${ROLE_LABEL[store!.role]}`} title="Ürün ve yaşam döngüsü" lead="Ürün çalışması, kurumsal envanterin yanında ayrı bir hesap bağlamıdır. Aynı ham veri kullanılabilir; dönem, tahsis, referans birimi ve sınır ayrı tutulur. Yalnız karbon hesaplanır: sonuç 'ürün karbon ayak izi' ya da 'kısmi ürün karbon ayak izi'dir; tam LCA veya EPD değildir." />
      <Notice kind="info" title="Kurumsal toplama girmez">
        <p>{EXCLUSION_TR}</p>
      </Notice>
      <ErrorBox error={err} />
      {saved && (
        <Notice kind="ok" title="Bu tarayıcıda kaydedildi">
          <p>
            Çalışma <b>{saved.product_name}</b> ({saved.product_version}) oluşturuldu; sınır: {boundaryTitle(saved.boundary)}. Sonraki adım: <Link href={`/urun/?id=${saved.id}`}>süreç satırlarını ekleyip hesaplayın</Link>.
          </p>
        </Notice>
      )}
      <div className="card">
        <div className="spread">
          <h2>Çalışmalar ({list.length})</h2>
          {writer && (
            <button className="primary" onClick={() => setShowForm((v) => !v)}>
              {showForm ? "Formu kapat" : "Yeni ürün çalışması"}
            </button>
          )}
        </div>
        {!writer && <p className="small muted">Rolünüz ({ROLE_LABEL[store!.role]}) çalışma yazamaz; görüntüleme açık.</p>}
        {list.length === 0 ? (
          <p className="muted">Henüz ürün çalışması yok. {writer ? "'Yeni ürün çalışması' ile başlayın: ürün, referans akış ve dört sınır sorusu." : ""}</p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Ürün</th>
                  <th>Sürüm</th>
                  <th>Sınır</th>
                  <th>Referans akış</th>
                  <th>Dönem</th>
                  <th>Son sonuç</th>
                  <th>Durum</th>
                </tr>
              </thead>
              <tbody>
                {list.map((st) => {
                  const r = latestResult(store!, st);
                  return (
                    <tr key={st.id}>
                      <td>
                        <Link href={`/urun/?id=${st.id}`}>{st.product_name}</Link>
                      </td>
                      <td>{st.product_version}</td>
                      <td className="small">{boundaryTitle(st.boundary)}</td>
                      <td className="num">
                        {fmtDec(st.reference_flow.quantity)} {st.reference_flow.unit}
                      </td>
                      <td className="small">
                        {st.period.start} → {st.period.end}
                      </td>
                      <td className="num">{r ? (r.study_total_kg === null ? "—" : `${fmtDec(r.study_total_kg, 6)} kg CO₂e`) : "—"}</td>
                      <td>{r ? isCurrentResult(st, r) ? <span className="badge ok">hesaplandı (v{r.study_version})</span> : <span className="badge warn">tanım değişti; yeniden hesapla</span> : <span className="badge neutral">taslak</span>}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {showForm && writer && (
        <StudyForm
          onSaved={(st) => {
            setSaved(st);
            setShowForm(false);
            setErr(null);
          }}
          onError={setErr}
        />
      )}
    </>
  );
}

function StudyForm({ onSaved, onError }: { onSaved: (s: Study) => void; onError: (e: unknown) => void }) {
  const { store } = useStore();
  const periods = store!.periods();
  const [f, setF] = useState({ product_name: "", product_version: "", rf_q: "1", rf_u: "kg", fu: "", fu_note: "", boundary: "" as StudyBoundary | "", start: periods[0]?.start ?? "", end: periods[0]?.end ?? "" });
  const [ex, setEx] = useState<BoundaryExplanation>(emptyExplanation());
  const q = BOUNDARY_QUESTIONS.find((x) => x.boundary === f.boundary);
  return (
    <form
      className="card"
      onSubmit={(e) => {
        e.preventDefault();
        try {
          if (!f.boundary) throw new StoreError("VALIDATION", "Dört sınır sorusundan birini seçin.", 422);
          const st = createStudy(store!, {
            product_name: f.product_name,
            product_version: f.product_version,
            reference_flow: { quantity: f.rf_q.replace(",", "."), unit: f.rf_u },
            functional_unit: f.fu.trim() ? f.fu.trim() : null,
            functional_unit_note: f.fu_note,
            boundary: f.boundary,
            boundary_explanation: ex,
            period: { start: f.start, end: f.end },
            processes: [],
          });
          onSaved(st);
        } catch (err) {
          onError(err);
        }
      }}
    >
      <h2>Yeni ürün çalışması</h2>
      <fieldset>
        <legend>Ürün ve referans akış</legend>
        <div className="grid-2">
          <div className="field">
            <label>Ürün adı</label>
            <input value={f.product_name} onChange={(e) => setF({ ...f, product_name: e.target.value })} required />
          </div>
          <div className="field">
            <label>Ürün sürümü</label>
            <input value={f.product_version} onChange={(e) => setF({ ...f, product_version: e.target.value })} placeholder="ör. 2026-A" required />
            <span className="hint">Reçete, rota veya ambalaj değişince yeni ürün sürümü = yeni çalışma.</span>
          </div>
          <div className="field">
            <label>Referans akış (miktar + birim)</label>
            <div className="inline">
              <input value={f.rf_q} onChange={(e) => setF({ ...f, rf_q: e.target.value })} inputMode="decimal" required />
              <input value={f.rf_u} onChange={(e) => setF({ ...f, rf_u: e.target.value })} placeholder="kg, adet, m²" required style={{ maxWidth: 120 }} />
            </div>
            <span className="hint">Sonuç bu miktar başına verilir (ör. 1 kg ürün).</span>
          </div>
          <div className="field">
            <label>Fonksiyonel birim (isteğe bağlı)</label>
            <input value={f.fu} onChange={(e) => setF({ ...f, fu: e.target.value })} placeholder="ör. 1 m² duvarı 50 yıl yalıtmak" />
            <span className="hint">Ürünün sağladığı işlevi, performansı ve kullanım süresini tanımlar. Yazılmazsa sonuçlar farklı performanslı ürünlerle karşılaştırılamaz; bir kilogram, ürünleri otomatik karşılaştırılabilir yapmaz.</span>
            <input value={f.fu_note} onChange={(e) => setF({ ...f, fu_note: e.target.value })} placeholder="performans ve kullanım süresi notu" />
          </div>
          <div className="field">
            <label>Çalışma dönemi</label>
            <div className="inline">
              <input type="date" value={f.start} onChange={(e) => setF({ ...f, start: e.target.value })} required />
              <input type="date" value={f.end} onChange={(e) => setF({ ...f, end: e.target.value })} required />
            </div>
            <span className="hint">Kurumsal dönemden bağımsızdır; aynı ham veri kullanılsa da ürün dönemi ayrı tutulur.</span>
          </div>
        </div>
      </fieldset>
      <fieldset>
        <legend>Sınır — dört soru (§17)</legend>
        <div className="ur-boundary-q">
          {BOUNDARY_QUESTIONS.map((bq) => (
            <label key={bq.boundary}>
              <input type="radio" name="boundary" checked={f.boundary === bq.boundary} onChange={() => setF({ ...f, boundary: bq.boundary })} />
              <span>
                {bq.question}
                <br />
                <span className="t">
                  Teknik sınır: {bq.technical} · gerekli açıklama: {bq.explanation} · sonuç etiketi: {boundaryLabel(bq.boundary)}
                </span>
              </span>
            </label>
          ))}
        </div>
        <p className="small muted">Bu seçim çalışmanın amacını açıklar; bir faktörün gerçek sınırını değiştirmez. Çakışan sınırlı faktörleri motor engeller (T08/T09).</p>
        <Notice kind="warn" title="Beşikten beşiğe sunulmuyor">
          <p>{CRADLE_TO_CRADLE_NOTE_TR}</p>
        </Notice>
        {q && (
          <div className="grid-2">
            {q.required.map((k) => (
              <div className="field" key={k}>
                <label>{EXPLANATION_LABEL[k]}</label>
                <textarea value={ex[k]} onChange={(e) => setEx({ ...ex, [k]: e.target.value })} required />
              </div>
            ))}
          </div>
        )}
      </fieldset>
      <div className="actions">
        <button className="primary" type="submit">
          Çalışmayı kaydet (bu tarayıcıda)
        </button>
      </div>
    </form>
  );
}

// ---------- Çalışma ayrıntısı ----------

function StudyDetail({ id, writer }: { id: string; writer: boolean }) {
  const { store } = useStore();
  const { engine, engineErr } = useEngine();
  const [err, setErr] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);
  const [ok, setOk] = useState<string | null>(null);
  let st: Study;
  try {
    st = study(store!, id);
  } catch {
    return (
      <Notice kind="warn">
        <p>
          <strong>Çalışma bulunamadı.</strong> Bu kimlik aktif kurumda yok (T14). <Link href="/urun/">Listeye dön</Link>
        </p>
      </Notice>
    );
  }
  const results = resultsOf(store!, st.id).slice().reverse();
  const latest = latestResult(store!, st);
  const current = isCurrentResult(st, latest);
  const q = BOUNDARY_QUESTIONS.find((x) => x.boundary === st.boundary)!;

  const runCalc = async () => {
    setErr(null);
    setOk(null);
    setBusy(true);
    try {
      store!.require("urun-rapor.study.write");
      if (!st.processes.length) throw new StoreError("STUDY_LINE_INPUT", "Önce en az bir süreç satırı ekleyin.", 422);
      const lines: LineResult[] = [];
      for (const line of st.processes) {
        const { request, factor_refs } = buildLineRequest(store!, st, line);
        const res = await calculate(request);
        lines.push(lineResultFrom(line, res, factor_refs));
      }
      let agg: AggregateResult | null = null;
      let aggErr: string | null = null;
      if (lines.every((l) => l.result.status !== "blocked")) {
        try {
          agg = await aggregate(buildStudyAggregateRequest(st, lines));
        } catch (e) {
          aggErr = `Motor toplama (aggregate) çağrısı başarısız: ${String((e as Error)?.message ?? e)}`;
        }
      }
      const row = saveStudyResult(store!, st, lines, agg, aggErr);
      setOk(`Sonuç ${row.id} kaydedildi (çalışma v${row.study_version}). ${row.study_total_kg === null ? "Çalışma toplamı üretilemedi; satır sonuçlarına ve engellere bakın." : "Sonraki adım: sonucu raporda 'Ürün çalışmaları' bölümünde görün — kurumsal toplama girmez."}`);
    } catch (e) {
      setErr(e);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <PageHeader eyebrow={`Ürün çalışması · ${boundaryTitle(st.boundary)} · v${st.version}`} title={`${st.product_name} — ${st.product_version}`} lead={`Referans akış ${fmtDec(st.reference_flow.quantity)} ${st.reference_flow.unit} · dönem ${st.period.start} → ${st.period.end} · sonuç etiketi: ${boundaryLabel(st.boundary)}`} />
      <p className="small ur-no-print">
        <Link href="/urun/">← Çalışmalar</Link>
      </p>
      <Notice kind="info" title="Kurumsal toplama girmez">
        <p>{EXCLUSION_TR}</p>
      </Notice>
      <ErrorBox error={err} />
      {ok && (
        <Notice kind="ok" title="Bu tarayıcıda kaydedildi">
          <p>{ok}</p>
        </Notice>
      )}
      <EngineStatus engine={engine} engineErr={engineErr} />

      <div className="grid-2">
        <div className="card">
          <h2>Sınır ve açıklama</h2>
          <dl className="kv">
            <dt>Soru</dt>
            <dd>{q.question}</dd>
            <dt>Teknik sınır</dt>
            <dd>{q.technical}</dd>
            {q.required.map((k) => (
              <ExplRow key={k} label={EXPLANATION_LABEL[k]} value={st.boundary_explanation[k]} />
            ))}
            <dt>Fonksiyonel birim</dt>
            <dd>{st.functional_unit ?? <span className="badge warn">tanımsız — karşılaştırma yapılamaz</span>} {st.functional_unit_note && <span className="small muted">({st.functional_unit_note})</span>}</dd>
          </dl>
          <p className="small muted" style={{ marginTop: "0.5rem" }}>
            {CRADLE_TO_CRADLE_NOTE_TR}
          </p>
          {writer && <StudyEdit st={st} onError={setErr} onOk={setOk} />}
        </div>
        <div className="card">
          <h2>Hesapla</h2>
          <p className="small">
            Her süreç satırı motorda <code>source_type: product_process</code> ve çalışmanın sınırıyla ayrı hesaplanır; çalışma toplamı motorun <code>aggregate()</code> ürün bölümünden gelir. Arayüz toplamaz.
          </p>
          <div className="actions">
            <button className="primary" onClick={runCalc} disabled={!writer || busy || engine !== "ready" || st.processes.length === 0}>
              {busy ? "Hesaplanıyor…" : current ? "Yeniden hesapla (yeni sonuç satırı)" : "Hesapla ve sonucu kaydet"}
            </button>
          </div>
          {latest && !current && <p className="small muted">Son sonuç çalışmanın v{latest.study_version} tanımına ait; tanım v{st.version}. Eski sonuç korunur, yeni hesap yeni satır açar.</p>}
          {!writer && <p className="small muted">Hesap için 'urun-rapor.study.write' yetkisi gerekir (veri giren, veri sorumlusu, yönetici).</p>}
        </div>
      </div>

      <ProcessLines st={st} writer={writer} onError={setErr} onOk={setOk} />

      <div className="card">
        <h2>Sonuçlar ({results.length}) — değişmez satırlar</h2>
        {results.length === 0 ? (
          <p className="muted">Henüz sonuç yok. Satırları ekleyip 'Hesapla' deyin.</p>
        ) : (
          results.map((r) => (
            <details key={r.id} open={r.id === latest?.id}>
              <summary>
                {fmtDate(r.created_at)} · çalışma v{r.study_version} · {r.label_tr} · {r.study_total_kg === null ? "toplam yok" : `${fmtDec(r.study_total_kg, 6)} kg CO₂e / ${fmtDec(r.reference_flow.quantity)} ${r.reference_flow.unit}`}
                {r.id === latest?.id && current && <span className="badge ok">güncel</span>}
                {r.study_version !== st.version && <span className="badge neutral">eski tanım (korundu)</span>}
              </summary>
              <StudyResultView r={r} st={st} />
            </details>
          ))
        )}
      </div>
    </>
  );
}

function ExplRow({ label, value }: { label: string; value: string }) {
  return (
    <>
      <dt>{label}</dt>
      <dd>{value || <span className="badge warn">boş</span>}</dd>
    </>
  );
}

function StudyEdit({ st, onError, onOk }: { st: Study; onError: (e: unknown) => void; onOk: (m: string) => void }) {
  const { store } = useStore();
  const [open, setOpen] = useState(false);
  const [fu, setFu] = useState(st.functional_unit ?? "");
  const [ex, setEx] = useState<BoundaryExplanation>(st.boundary_explanation);
  const [reason, setReason] = useState("");
  const q = BOUNDARY_QUESTIONS.find((x) => x.boundary === st.boundary)!;
  if (!open)
    return (
      <div className="actions" style={{ marginTop: "0.75rem" }}>
        <button onClick={() => setOpen(true)}>Tanımı düzelt (yeni sürüm)</button>
      </div>
    );
  return (
    <form
      style={{ marginTop: "0.75rem" }}
      onSubmit={(e) => {
        e.preventDefault();
        try {
          updateStudy(store!, st.id, { functional_unit: fu.trim() ? fu.trim() : null, boundary_explanation: ex }, reason, st.version);
          onOk(`Çalışma tanımı v${st.version} olarak güncellendi; önceki sonuçlar korunur, yeni hesap gerekir.`);
          setOpen(false);
        } catch (err) {
          onError(err);
        }
      }}
    >
      <fieldset>
        <legend>Tanım düzeltme — beklenen sürüm v{st.version}</legend>
        <div className="field">
          <label>Fonksiyonel birim</label>
          <input value={fu} onChange={(e) => setFu(e.target.value)} />
        </div>
        {q.required.map((k) => (
          <div className="field" key={k}>
            <label>{EXPLANATION_LABEL[k]}</label>
            <textarea value={ex[k]} onChange={(e) => setEx({ ...ex, [k]: e.target.value })} required />
          </div>
        ))}
        <div className="field">
          <label>Değişiklik gerekçesi (zorunlu)</label>
          <input value={reason} onChange={(e) => setReason(e.target.value)} required />
        </div>
        <div className="actions">
          <button className="primary" type="submit">
            Kaydet
          </button>
          <button type="button" onClick={() => setOpen(false)}>
            Vazgeç
          </button>
        </div>
      </fieldset>
    </form>
  );
}

// ---------- Süreç satırları ----------

const KINDS = Object.keys(PROCESS_KIND_LABEL) as ProcessKind[];
const UNITS = ["GJ", "MWh", "kWh", "Sm3", "Nm3", "m3", "kg", "t", "L", "km", "t.km", "unit"];

function ProcessLines({ st, writer, onError, onOk }: { st: Study; writer: boolean; onError: (e: unknown) => void; onOk: (m: string) => void }) {
  const { store } = useStore();
  const factors = publishedFactors(store!);
  const records = store!.records().map((r) => ({ r, v: store!.current(r.id), src: store!.source(store!.current(r.id).source_id) }));
  const [f, setF] = useState({ kind: "material" as ProcessKind, name: "", linkType: "own" as "own" | "record", record_id: records[0]?.r.id ?? "", quantity: "", unit: "kg", basis: "" as "" | "LHV" | "HHV", dq: "measured" as "measured" | "estimated", fuel: "", keys: [] as string[], alloc: false, basis_a: "mass" as AllocationBasis, share: "", src_ref: "", note: "" });
  const [show, setShow] = useState(false);
  return (
    <div className="card">
      <div className="spread">
        <h2>Süreç listesi ({st.processes.length})</h2>
        {writer && <button onClick={() => setShow((v) => !v)}>{show ? "Formu kapat" : "Satır ekle"}</button>}
      </div>
      <p className="small muted">Malzeme listesi, üretim rotası, fire, ambalaj, enerji tahsisi, sevkiyat, kullanım, ömür sonu ve ortak ürünler satır satır tanımlanır. Her satır ya mevcut bir faaliyet kaydına bağlanır (aynı ham veri, ayrı bağlam) ya da kendi miktarını taşır.</p>
      {st.processes.length === 0 ? (
        <p className="muted">Satır yok.</p>
      ) : (
        <div className="table-wrap ur-lines">
          <table>
            <thead>
              <tr>
                <th>Tür</th>
                <th>Ad</th>
                <th>Veri</th>
                <th>Faktör</th>
                <th>Tahsis</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {st.processes.map((l) => {
                const rid = l.link.type === "record" ? l.link.record_id : null;
                const rec = rid ? records.find((x) => x.r.id === rid) : null;
                return (
                  <tr key={l.id}>
                    <td className="small">{PROCESS_KIND_LABEL[l.kind]}</td>
                    <td>{l.name}</td>
                    <td className="small">
                      {l.link.type === "record" ? (
                        rec ? (
                          <>
                            <Link href={`/kayit/?id=${rec.r.id}`} className="mono">
                              {rec.r.id.slice(0, 12)}
                            </Link>{" "}
                            · {rec.src.name} · {rec.v.quantity_state === "known" ? `${fmtDec(rec.v.quantity)} ${rec.v.unit ?? "?"}` : "miktar bilinmiyor"} · {STATE_LABEL[rec.r.state]}
                          </>
                        ) : (
                          <span className="badge warn">kayıt bulunamadı</span>
                        )
                      ) : l.link.quantity_state === "known" ? (
                        `${fmtDec(l.link.quantity)} ${l.link.unit ?? "?"}${l.link.heating_value_basis ? ` (${l.link.heating_value_basis})` : ""}${l.link.data_quality === "estimated" ? " · tahmini" : ""}`
                      ) : (
                        <span className="badge warn">bilinmiyor</span>
                      )}
                    </td>
                    <td className="mono small">{l.factor_keys.join(", ") || <span className="badge warn">faktör yok</span>}</td>
                    <td className="small">{l.allocation ? `${l.allocation.basis} · pay ${l.allocation.share} · ${l.allocation.source_ref}` : "—"}</td>
                    <td>
                      {writer && (
                        <button
                          className="danger"
                          onClick={() => {
                            try {
                              removeLine(store!, st, l.id, `satır silindi: ${l.name}`);
                              onOk(`Satır "${l.name}" silindi; çalışma v${st.version}.`);
                            } catch (e) {
                              onError(e);
                            }
                          }}
                        >
                          Sil
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {show && writer && (
        <form
          style={{ marginTop: "0.75rem" }}
          onSubmit={(e) => {
            e.preventDefault();
            try {
              const link =
                f.linkType === "record"
                  ? ({ type: "record", record_id: f.record_id } as const)
                  : ({ type: "own", quantity: f.quantity.trim() ? f.quantity.replace(",", ".") : null, quantity_state: f.quantity.trim() ? "known" : "unknown", unit: f.unit || null, heating_value_basis: f.basis || null, data_quality: f.dq, fuel: f.fuel.trim() || null } as const);
              addLine(store!, st, { kind: f.kind, name: f.name, link, factor_keys: f.keys, allocation: f.alloc || f.kind === "coproduct" ? { basis: f.basis_a, share: f.share.replace(",", "."), source_ref: f.src_ref } : null, note: f.note }, `satır eklendi: ${f.name}`);
              onOk(`Satır "${f.name}" eklendi; çalışma tanımı v${st.version}. Hesap için 'Hesapla'.`);
              setF({ ...f, name: "", quantity: "", keys: [], share: "", src_ref: "", note: "" });
              setShow(false);
            } catch (err) {
              onError(err);
            }
          }}
        >
          <fieldset>
            <legend>Yeni süreç satırı</legend>
            <div className="grid-2">
              <div className="field">
                <label>Süreç türü</label>
                <select value={f.kind} onChange={(e) => setF({ ...f, kind: e.target.value as ProcessKind })}>
                  {KINDS.map((k) => (
                    <option key={k} value={k}>
                      {PROCESS_KIND_LABEL[k]}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label>Ad</label>
                <input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} required placeholder="ör. Kazan doğal gazı — hat 2" />
              </div>
              <div className="field">
                <label>Veri kaynağı</label>
                <div className="radio-list">
                  <label>
                    <input type="radio" checked={f.linkType === "record"} onChange={() => setF({ ...f, linkType: "record" })} disabled={records.length === 0} />
                    <span>Mevcut faaliyet kaydına bağla {records.length === 0 && <span className="muted">(kayıt yok)</span>}</span>
                  </label>
                  <label>
                    <input type="radio" checked={f.linkType === "own"} onChange={() => setF({ ...f, linkType: "own" })} />
                    <span>Kendi miktarını gir</span>
                  </label>
                </div>
              </div>
              {f.linkType === "record" ? (
                <div className="field">
                  <label>Faaliyet kaydı</label>
                  <select value={f.record_id} onChange={(e) => setF({ ...f, record_id: e.target.value })}>
                    {records.map((x) => (
                      <option key={x.r.id} value={x.r.id}>
                        {x.r.id.slice(0, 12)} · {x.src.name} · {x.v.quantity_state === "known" ? `${x.v.quantity} ${x.v.unit ?? "?"}` : "miktar bilinmiyor"} · {STATE_LABEL[x.r.state]}
                      </option>
                    ))}
                  </select>
                  <span className="hint">Kayıt envanterde kalır; burada yalnız ürün bağlamında yeniden hesaplanır. Kaydın güncel sürümü kullanılır.</span>
                </div>
              ) : (
                <>
                  <div className="field">
                    <label>Miktar ve birim</label>
                    <div className="inline">
                      <input value={f.quantity} onChange={(e) => setF({ ...f, quantity: e.target.value })} inputMode="decimal" placeholder="boş = bilinmiyor" />
                      <select value={f.unit} onChange={(e) => setF({ ...f, unit: e.target.value })} style={{ maxWidth: 110 }}>
                        {UNITS.map((u) => (
                          <option key={u} value={u}>
                            {u}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div className="field">
                    <label>Isıl değer esası / yakıt / nitelik</label>
                    <div className="row">
                      <select value={f.basis} onChange={(e) => setF({ ...f, basis: e.target.value as "" | "LHV" | "HHV" })} style={{ maxWidth: 140 }}>
                        <option value="">esas bilinmiyor</option>
                        <option value="LHV">LHV</option>
                        <option value="HHV">HHV</option>
                      </select>
                      <input value={f.fuel} onChange={(e) => setF({ ...f, fuel: e.target.value })} placeholder="yakıt (natural_gas …)" style={{ maxWidth: 180 }} />
                      <select value={f.dq} onChange={(e) => setF({ ...f, dq: e.target.value as "measured" | "estimated" })} style={{ maxWidth: 140 }}>
                        <option value="measured">ölçülmüş</option>
                        <option value="estimated">tahmini</option>
                      </select>
                    </div>
                  </div>
                </>
              )}
              <div className="field">
                <label>Faktör (yayımlı sürümler)</label>
                <div className="ur-factors">
                  {factors.map((fc) => {
                    const k = factorKey(fc);
                    return (
                      <label key={k}>
                        <input type="checkbox" checked={f.keys.includes(k)} onChange={(e) => setF({ ...f, keys: e.target.checked ? [...f.keys, k] : f.keys.filter((x) => x !== k) })} />
                        <span>
                          {fc.title_tr} <span className="mono">{k}</span> · {fc.value} {fc.numerator_unit} {fc.gas}/{fc.denominator_unit} · sınır: {fc.boundary}
                        </span>
                      </label>
                    );
                  })}
                </div>
                <span className="hint">Her faktörün kapsadığı süreç ve sınırı motor tutar; beşikten kapıya + üst aşama birlikte seçilirse BOUNDARY_OVERLAP, beşikten mezara faktör doğrudan kullanılırsa LCA_FACTOR_IN_CATEGORY engeli döner (T08/T09).</span>
              </div>
              <div className="field">
                <label className="check">
                  <input type="checkbox" checked={f.alloc || f.kind === "coproduct"} disabled={f.kind === "coproduct"} onChange={(e) => setF({ ...f, alloc: e.target.checked })} /> Tahsis uygula (ortak ürün / paylaşılan enerji)
                </label>
                {(f.alloc || f.kind === "coproduct") && (
                  <div className="row">
                    <select value={f.basis_a} onChange={(e) => setF({ ...f, basis_a: e.target.value as AllocationBasis })} style={{ maxWidth: 150 }}>
                      <option value="mass">kütle</option>
                      <option value="energy">enerji</option>
                      <option value="economic">ekonomik</option>
                      <option value="none">tahsis yok (gerekçeli)</option>
                    </select>
                    <input value={f.share} onChange={(e) => setF({ ...f, share: e.target.value })} placeholder="pay 0–1 (ör. 0.6)" inputMode="decimal" style={{ maxWidth: 140 }} required />
                    <input value={f.src_ref} onChange={(e) => setF({ ...f, src_ref: e.target.value })} placeholder="kaynak (üretim raporu, fiyat listesi…)" required />
                  </div>
                )}
                <span className="hint">Pay motorda sonuçla çarpılır ve izde görünür; dağıtılan toplam sınırı aşamaz (§16).</span>
              </div>
              <div className="field">
                <label>Not</label>
                <input value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} />
              </div>
            </div>
            <div className="actions">
              <button className="primary" type="submit" disabled={f.keys.length === 0}>
                Satırı ekle
              </button>
            </div>
          </fieldset>
        </form>
      )}
    </div>
  );
}

// ---------- Sonuç görünümü (§17 kabul koşulu: birim, sınır, dönem, yöntem, tahsis, eksikler) ----------

function StudyResultView({ r, st }: { r: StudyResult; st: Study }) {
  const blocked = r.lines.filter((l) => l.result.status === "blocked");
  return (
    <div>
      <dl className="kv">
        <dt>Sonuç etiketi</dt>
        <dd>
          <b>{r.label_tr}</b> — yalnız karbon; LCA veya EPD değildir
        </dd>
        <dt>Birim</dt>
        <dd>
          {r.reference_flow.quantity} {r.reference_flow.unit} referans akış başına · fonksiyonel birim: {r.functional_unit ?? "tanımsız"}
        </dd>
        <dt>Sınır</dt>
        <dd>{boundaryTitle(r.boundary)}</dd>
        <dt>Dönem</dt>
        <dd>
          {r.period.start} → {r.period.end}
        </dd>
        <dt>Yöntem / motor</dt>
        <dd>
          {r.method.id}@{r.method.version} · {r.engine_version}
        </dd>
        <dt>Tahsis</dt>
        <dd>
          {r.lines.some((l) => st.processes.find((p) => p.id === l.line_id)?.allocation) ? (
            <ul className="small">
              {r.lines.map((l) => {
                const a = st.processes.find((p) => p.id === l.line_id)?.allocation;
                return a ? (
                  <li key={l.line_id}>
                    {l.line_name}: {a.basis} · pay {a.share} · {a.source_ref}
                  </li>
                ) : null;
              })}
            </ul>
          ) : (
            "tahsis yok"
          )}
        </dd>
        <dt>Çalışma toplamı</dt>
        <dd className="num">
          {r.study_total_kg === null ? <span className="badge warn">yok — {r.total_note_tr}</span> : <b>{fmtDec(r.study_total_kg, 6)} kg CO₂e</b>} {r.study_claim_tr && <span className="small muted">· {r.study_claim_tr}</span>}
        </dd>
        <dt>Kurumsal toplam</dt>
        <dd>
          <span className="badge accent">dahil değil</span> <span className="small">{EXCLUSION_TR}</span>
        </dd>
        <dt>Eksikler</dt>
        <dd>
          <ul className="small">
            {r.gaps_tr.map((g, i) => (
              <li key={i}>{g}</li>
            ))}
          </ul>
        </dd>
      </dl>
      {blocked.length > 0 && (
        <Notice kind="warn" title="Çakışma / engel">
          <p>{blocked.length} satır motor tarafından engellendi. BOUNDARY_OVERLAP: beşikten kapıya ile üst aşama faktörü aynı aşamayı iki kez sayar (T09). LCA_FACTOR_IN_CATEGORY: beşikten mezara toplam ayrıştırılmadan kullanılamaz (T08). Satır ayrıntısında açıklama ve yapılacak iş yazar.</p>
        </Notice>
      )}
      <h3>Satır sonuçları</h3>
      {r.lines.map((l) => (
        <details key={l.line_id}>
          <summary>
            {PROCESS_KIND_LABEL[l.kind]} · {l.line_name} · <span className={`badge ${l.result.status === "computed" ? "ok" : l.result.status === "review_required" ? "warn" : "crit"}`}>{l.result.status}</span> · {l.factor_refs.map((f) => `${f.id}@${f.version}`).join(", ")}
          </summary>
          <CalcResultView r={l.result} />
        </details>
      ))}
    </div>
  );
}
