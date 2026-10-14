"use client";
// Tedarikçi veri programı ekranı (TDR-01…04, §09, §14, §21). Veri: supplier.ts; içerik: content/supplier-program.
import Link from "next/link";
import { useState } from "react";
import { ROLE_LABEL } from "@/lib/domain";
import { LESSONS } from "@/lib/content";
import { useStore, fmtDate, fmtDec } from "@/lib/useStore";
import { ErrorBox, Loading, NoTenant, Notice, PageHeader } from "@/components/ui";
import type { Store } from "@/lib/store";
import { RISK_RULES, SEGMENTATION } from "../content";
import { isPackageOpen } from "../regulation";
import {
  acknowledgeConfidentiality, addCorrectivePlan, addSupplier, authorizeRequest, correctivePlans, createRequest, evaluateRisk, evaluateResponse, exampleTemplate, exportRequestText, fieldLabel, hasAck, latestResponse,
  questionnaires, requestText, requests, responses, reviseRequest, segmentation, submitQuestionnaire, submitResponse, supplierRequests, suppliers, template, updateSupplier,
  type IntensityClass, type RequestRow, type SupplierRow,
} from "../supplier";
import { PREVIEW_NOTE, Tabs, TemplateInput, copyText, downloadText, useAction } from "./common";

const TABS = [
  { id: "kayit", label: "Kayıt ve segmentasyon" },
  { id: "talep", label: "Veri talepleri" },
  { id: "risk", label: "Öz değerlendirme ve risk" },
  { id: "portal", label: "Tedarikçi görünümü" },
  { id: "kobi", label: "KOBİ dersi ve örnek şablon" },
];
const STATUS: Record<RequestRow["status"], { label: string; cls: string }> = {
  draft: { label: "Taslak — yetki bekliyor", cls: "neutral" },
  authorized: { label: "Yetkilendirildi — kopyala/indir", cls: "info" },
  answered: { label: "Yanıtlandı", cls: "ok" },
  needs_complement: { label: "Eksik — tamamlayıcı talep", cls: "warn" },
  superseded: { label: "Eski sürüm", cls: "neutral" },
};

export default function TedarikciScreen() {
  const { store, ready } = useStore();
  const [tab, setTab] = useState("kayit");
  if (!ready || !store) return <Loading />;
  if (!store.tenant) return <NoTenant />;
  return (
    <>
      <PageHeader eyebrow={`Tedarikçi programı · TDR-01…04 · §14 · rol: ${ROLE_LABEL[store.role]}`} title="Tedarikçi veri programı" lead="Harcama ve emisyon yoğunluğuna göre sıralama, kısa standart veri talebi, gizlilik taahhüdü ilk ekranda, risk temelli öz değerlendirme ve ceza yerine düzeltici plan. Uygulama dış tarafa hiçbir şey göndermez; talep metni yetkili onayıyla kopyalanır veya indirilir (§09)." />
      <Tabs items={TABS} value={tab} onChange={setTab} />
      {tab === "kayit" && <Kayit store={store} />}
      {tab === "talep" && <Talepler store={store} />}
      {tab === "risk" && <Risk store={store} />}
      {tab === "portal" && <Portal store={store} />}
      {tab === "kobi" && <Kobi />}
    </>
  );
}

// ---------- Kayıt ve segmentasyon (TDR-01) ----------
function Kayit({ store }: { store: Store }) {
  const act = useAction();
  const cbamOpen = isPackageOpen(store, "cbam");
  const [f, setF] = useState({ name: "", spend_currency: "TRY", spend_amount: "", intensity_class: "unknown" as IntensityClass, intensity_reason: "", product_groups: "", cbam_relevant: "null", contact_note: "" });
  const list = suppliers(store);
  const groups = segmentation(store, list);
  const canWrite = ["admin", "data_owner"].includes(store.role);
  return (
    <>
      <ErrorBox error={act.err} />
      {act.ok && <Notice kind="ok">{act.ok}</Notice>}
      <div className="grid-2">
        <div className="card">
          <h2>Tedarikçi ekle</h2>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              act.run(() => {
                const row = addSupplier(store, { ...f, product_groups: f.product_groups.split(",").map((x) => x.trim()).filter(Boolean), cbam_relevant: f.cbam_relevant === "null" ? null : f.cbam_relevant === "true" });
                setF({ ...f, name: "", spend_amount: "", intensity_reason: "", product_groups: "", contact_note: "" });
                return `"${row.name}" kaydedildi. ${PREVIEW_NOTE} Sonraki adım: segmentasyon tablosunda sırasını görün, ilk dalgadaysa veri talebi açın.`;
              });
            }}
          >
            <div className="field">
              <label htmlFor="sn">Tedarikçi adı *</label>
              <input id="sn" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} required />
            </div>
            <div className="field">
              <label htmlFor="sa">Yıllık harcama</label>
              <div className="inline">
                <input id="sa" value={f.spend_amount} onChange={(e) => setF({ ...f, spend_amount: e.target.value })} placeholder="ör. 1.250.000,50" inputMode="decimal" />
                <input aria-label="Para birimi" value={f.spend_currency} onChange={(e) => setF({ ...f, spend_currency: e.target.value })} style={{ width: 80 }} />
              </div>
              <span className="hint">Boş bırakılırsa "bilinmiyor" sayılır; sıfır atanmaz, sıralamada en sona düşer. Farklı para birimleri birbirine çevrilmez.</span>
            </div>
            <div className="field">
              <label htmlFor="sc">Emisyon yoğunluğu sınıfı *</label>
              <select id="sc" value={f.intensity_class} onChange={(e) => setF({ ...f, intensity_class: e.target.value as IntensityClass })}>
                {SEGMENTATION.intensity_classes.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label} (ağırlık {c.weight})
                  </option>
                ))}
              </select>
              <span className="hint">{SEGMENTATION.intensity_classes.find((c) => c.value === f.intensity_class)?.note} Sınıf profilden bağımsız listedir; kullanıcı seçer ve gerekçe yazar.</span>
            </div>
            <div className="field">
              <label htmlFor="sr">Sınıf gerekçesi *</label>
              <input id="sr" value={f.intensity_reason} onChange={(e) => setF({ ...f, intensity_reason: e.target.value })} required placeholder="ör. sıcak haddelenmiş çelik; enerji yoğun proses" />
            </div>
            <div className="field">
              <label htmlFor="sg">Ürün grupları</label>
              <input id="sg" value={f.product_groups} onChange={(e) => setF({ ...f, product_groups: e.target.value })} placeholder="virgülle ayırın" />
            </div>
            <div className="field">
              <label htmlFor="scb">CBAM ilgisi</label>
              <select id="scb" value={f.cbam_relevant} onChange={(e) => setF({ ...f, cbam_relevant: e.target.value })} disabled={!cbamOpen}>
                <option value="null">Değerlendirilmedi</option>
                <option value="true">CBAM kapsamında ürün sağlıyor</option>
                <option value="false">CBAM kapsamında değil</option>
              </select>
              <span className="hint">{cbamOpen ? "CBAM paketi açık; işaretlenebilir." : <>Yalnız CBAM paketi bu kurum için açıkken işaretlenir. <Link href="/regulasyon/">Regülasyon paketleri</Link></>}</span>
            </div>
            <div className="field">
              <label htmlFor="sno">İletişim notu</label>
              <input id="sno" value={f.contact_note} onChange={(e) => setF({ ...f, contact_note: e.target.value })} />
            </div>
            <div className="actions">
              <button className="primary" type="submit" disabled={act.busy || !canWrite}>
                Kaydet
              </button>
              {!canWrite && <span className="small muted">Yalnız kurum yöneticisi / veri sorumlusu yazar.</span>}
            </div>
          </form>
        </div>
        <div className="card">
          <h2>Segmentasyon — kritik %{SEGMENTATION.first_wave_percent} ilk dalga (TDR-01)</h2>
          <p className="small muted">{SEGMENTATION.note}</p>
          {list.length === 0 ? (
            <p className="muted">Henüz tedarikçi yok. Soldaki formla ilk tedarikçiyi ekleyin.</p>
          ) : (
            groups.map((g) => (
              <div key={g.currency}>
                <h3>
                  {g.currency} · {g.rows.length} tedarikçi · ilk dalga {g.first_wave_count}
                </h3>
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>#</th>
                        <th>Tedarikçi</th>
                        <th>Harcama</th>
                        <th>Yoğunluk</th>
                        <th>Puan</th>
                        <th>Pay</th>
                        <th>Birikimli</th>
                        <th>Dalga</th>
                      </tr>
                    </thead>
                    <tbody>
                      {g.rows.map((r) => (
                        <tr key={r.supplier.id}>
                          <td>{r.rank}</td>
                          <td>
                            <b>{r.supplier.name}</b>
                            {r.supplier.cbam_relevant && <span className="badge copper">CBAM</span>}
                            <div className="small muted">{r.supplier.product_groups.join(", ")}</div>
                          </td>
                          <td className="num">{r.supplier.spend_amount === null ? "bilinmiyor" : fmtDec(r.supplier.spend_amount, 2)}</td>
                          <td className="small">
                            {SEGMENTATION.intensity_classes.find((c) => c.value === r.supplier.intensity_class)?.label} ×{r.weight}
                            <div className="muted">{r.supplier.intensity_reason}</div>
                          </td>
                          <td className="num">{r.score === null ? "—" : fmtDec(r.score, 2)}</td>
                          <td className="num">{r.share_percent === null ? "—" : `%${r.share_percent.replace(".", ",")}`}</td>
                          <td className="num">{r.cumulative_percent === null ? "—" : `%${r.cumulative_percent.replace(".", ",")}`}</td>
                          <td>{r.first_wave ? <span className="dis-wave">İlk dalga</span> : <span className="muted small">sonraki</span>}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))
          )}
          {list.length > 0 && <SupplierEdit store={store} list={list} canWrite={canWrite} cbamOpen={cbamOpen} />}
        </div>
      </div>
    </>
  );
}

function SupplierEdit({ store, list, canWrite, cbamOpen }: { store: Store; list: SupplierRow[]; canWrite: boolean; cbamOpen: boolean }) {
  const act = useAction();
  const [id, setId] = useState(list[0].id);
  const sup = list.find((x) => x.id === id) ?? list[0];
  const [reason, setReason] = useState("");
  const [cls, setCls] = useState<IntensityClass>(sup.intensity_class);
  const [cr, setCr] = useState(sup.intensity_reason);
  const [cb, setCb] = useState(sup.cbam_relevant === null ? "null" : String(sup.cbam_relevant));
  return (
    <details style={{ marginTop: "0.8rem" }}>
      <summary className="small">Sınıf veya CBAM ilgisini düzelt (gerekçeli, sürümlü)</summary>
      <ErrorBox error={act.err} />
      {act.ok && <Notice kind="ok">{act.ok}</Notice>}
      <div className="dis-mini" style={{ marginTop: "0.5rem" }}>
        <select aria-label="Tedarikçi" value={id} onChange={(e) => { const n = list.find((x) => x.id === e.target.value)!; setId(n.id); setCls(n.intensity_class); setCr(n.intensity_reason); setCb(n.cbam_relevant === null ? "null" : String(n.cbam_relevant)); }}>
          {list.map((x) => (
            <option key={x.id} value={x.id}>
              {x.name} (v{x.version})
            </option>
          ))}
        </select>
        <select aria-label="Yoğunluk sınıfı" value={cls} onChange={(e) => setCls(e.target.value as IntensityClass)}>
          {SEGMENTATION.intensity_classes.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </select>
        <input aria-label="Sınıf gerekçesi" value={cr} onChange={(e) => setCr(e.target.value)} placeholder="sınıf gerekçesi" />
        <select aria-label="CBAM ilgisi" value={cb} onChange={(e) => setCb(e.target.value)} disabled={!cbamOpen}>
          <option value="null">CBAM: değerlendirilmedi</option>
          <option value="true">CBAM: kapsamda</option>
          <option value="false">CBAM: kapsam dışı</option>
        </select>
        <input aria-label="Değişiklik gerekçesi" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="değişiklik gerekçesi *" />
        <button disabled={!canWrite || !reason.trim() || act.busy} onClick={() => act.run(() => { updateSupplier(store, sup.id, { intensity_class: cls, intensity_reason: cr, cbam_relevant: cb === "null" ? null : cb === "true" }, reason, sup.version); setReason(""); return `Güncellendi (v${sup.version + 1}). ${PREVIEW_NOTE}`; })}>
          Güncelle
        </button>
      </div>
    </details>
  );
}

// ---------- Veri talepleri (§14, TDR-02, §09) ----------
function Talepler({ store }: { store: Store }) {
  const act = useAction();
  const tpl = template();
  const list = suppliers(store);
  const all = requests(store).slice().reverse();
  const [supId, setSupId] = useState(list[0]?.id ?? "");
  const [fields, setFields] = useState<Record<string, string>>({});
  const [reviseOf, setReviseOf] = useState<string | null>(null);
  const [reviseReason, setReviseReason] = useState("");
  const [authReason, setAuthReason] = useState<Record<string, string>>({});
  const [preview, setPreview] = useState<string | null>(null);
  const canWrite = ["admin", "data_owner", "data_entry"].includes(store.role);
  const canAuth = ["admin", "data_owner"].includes(store.role);
  if (list.length === 0)
    return (
      <div className="card quiet">
        <h3>Önce tedarikçi kaydı gerekir</h3>
        <p className="muted">"Kayıt ve segmentasyon" sekmesinden tedarikçi ekleyin; ilk dalgadaki tedarikçilerle başlayın.</p>
      </div>
    );
  return (
    <>
      <ErrorBox error={act.err} />
      {act.ok && <Notice kind="ok">{act.ok}</Notice>}
      <Notice kind="info" title="Akış (§09, §21)">
        <p>
          <b>1.</b> Talep metnini hazırla (taslak) → <b>2.</b> muhatap, kapsam ve ekleri doğrulayıp dış gönderimi yetkilendir (kurum yöneticisi / veri sorumlusu; denetim izine yazılır) → <b>3.</b> kopyala veya indir ve kendi e-posta/portalınızla gönderin. Uygulama e-posta göndermez; otomatik hatırlatma yoktur.
        </p>
      </Notice>
      <div className="grid-2">
        <div className="card">
          <h2>{reviseOf ? "Talebin yeni sürümü" : "Standart veri talebi oluştur"}</h2>
          <div className="dis-conf" style={{ marginBottom: "0.8rem" }}>
            <b>{tpl.confidentiality.title} (ilk ekran, TDR-02)</b>
            <p>{tpl.confidentiality.text}</p>
            <p>
              <b>{tpl.confidentiality.aggregated_use_text}</b>
            </p>
            <p className="small muted">Bu metin talebin ilk ekranıdır; tedarikçi onaylamadan veri formu açılmaz. Şablon sürümü {tpl.version}.</p>
          </div>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              act.run(() => {
                if (reviseOf) {
                  const r = reviseRequest(store, reviseOf, fields, reviseReason);
                  setReviseOf(null);
                  setReviseReason("");
                  setFields({});
                  return `Talep v${r.request_version} oluşturuldu (taslak; yeniden yetki ister). ${PREVIEW_NOTE}`;
                }
                const r = createRequest(store, { supplier_id: supId, fields });
                setFields({});
                return `Talep taslağı kaydedildi (v${r.request_version}). ${PREVIEW_NOTE} Sonraki adım: metni önizleyip dış gönderimi yetkilendirin.`;
              });
            }}
          >
            {!reviseOf && (
              <div className="field">
                <label htmlFor="rsup">Tedarikçi *</label>
                <select id="rsup" value={supId} onChange={(e) => setSupId(e.target.value)}>
                  {list.map((x) => (
                    <option key={x.id} value={x.id}>
                      {x.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
            {tpl.fields.map((f) => (
              <TemplateInput key={f.id} f={f} value={fields[f.id] ?? ""} onChange={(v) => setFields({ ...fields, [f.id]: v })} />
            ))}
            {reviseOf && (
              <div className="field">
                <label htmlFor="rr">Sürüm gerekçesi *</label>
                <input id="rr" value={reviseReason} onChange={(e) => setReviseReason(e.target.value)} required />
              </div>
            )}
            <div className="actions">
              <button className="primary" type="submit" disabled={act.busy || !canWrite}>
                {reviseOf ? "Yeni sürümü kaydet" : "Taslağı kaydet"}
              </button>
              {reviseOf && (
                <button type="button" onClick={() => { setReviseOf(null); setFields({}); }}>
                  Vazgeç
                </button>
              )}
              <button type="button" onClick={() => setFields({ ...exampleTemplate().fields })}>
                Örnek şablonla doldur (kurgusal)
              </button>
            </div>
          </form>
        </div>
        <div className="card">
          <h2>Talepler ({all.length})</h2>
          {all.length === 0 && <p className="muted">Henüz talep yok.</p>}
          {all.map((r) => {
            const sup = list.find((x) => x.id === r.supplier_id);
            const resp = latestResponse(store, r.id);
            return (
              <div key={r.id} className="card quiet" style={{ marginBottom: "0.6rem" }}>
                <div className="spread">
                  <div>
                    <b>{sup?.name ?? r.supplier_id}</b> · v{r.request_version} · {r.fields.product}
                    <div className="small muted">
                      {fmtDate(r.created_at)} · şablon {r.template_version}
                      {r.parent_request_id && <> · tamamlayıcı talep (eksik: {r.missing_fields.map(fieldLabel).join(", ")})</>}
                    </div>
                  </div>
                  <span className={`badge ${STATUS[r.status].cls}`}>{STATUS[r.status].label}</span>
                </div>
                {r.authorized_by && (
                  <p className="small">
                    Dış gönderim yetkisi: {r.authorized_by} · {r.authorized_at && fmtDate(r.authorized_at)} · {r.authorization_reason}
                    {r.exported_at && <> · dışa verildi {fmtDate(r.exported_at)}</>}
                  </p>
                )}
                {resp && (
                  <p className="small">
                    Son yanıt v{resp.response_version}: {resp.answers.value ? `${fmtDec(resp.answers.value, 4)} ${resp.answers.unit}` : "değer yok"} · {resp.complete ? "tam" : `eksik: ${resp.missing_fields.map(fieldLabel).join(", ")}`}
                    {resp.flags.map((f) => (
                      <span key={f.code} className="badge warn" style={{ marginLeft: 4 }} title={f.message_tr}>
                        {f.code === "COMPANY_TOTAL_WITHOUT_ALLOCATION" ? "şirket toplamı — tahsis yok" : f.code}
                      </span>
                    ))}
                  </p>
                )}
                <div className="actions">
                  <button onClick={() => setPreview(requestText(store, r.id))}>Metni önizle</button>
                  {r.status === "draft" && (
                    <>
                      <input aria-label="Yetki gerekçesi" placeholder="yetki gerekçesi: muhatap, kapsam, ekler doğrulandı" value={authReason[r.id] ?? ""} onChange={(e) => setAuthReason({ ...authReason, [r.id]: e.target.value })} style={{ maxWidth: 300 }} />
                      <button className="primary" disabled={!canAuth || act.busy} onClick={() => act.run(() => { authorizeRequest(store, r.id, authReason[r.id] ?? ""); return `Dış gönderim yetkilendirildi; denetim izine yazıldı. ${PREVIEW_NOTE} Şimdi kopyalayıp kendi kanalınızla gönderin.`; })}>
                        Dış gönderimi yetkilendir
                      </button>
                    </>
                  )}
                  {r.status !== "draft" && r.status !== "superseded" && (
                    <>
                      <button onClick={() => act.run(async () => { const t = exportRequestText(store, r.id); const ok = await copyText(t); return ok ? "Metin panoya kopyalandı; dışa verme denetim izine yazıldı." : "Pano erişimi yok; indirmeyi kullanın."; })}>Kopyala</button>
                      <button onClick={() => act.run(() => { const t = exportRequestText(store, r.id); downloadText(t, `veri-talebi-${sup?.name ?? r.supplier_id}-v${r.request_version}.md`, "text/markdown"); return "Metin indirildi; dışa verme denetim izine yazıldı."; })}>İndir (.md)</button>
                    </>
                  )}
                  {r.status !== "superseded" && canWrite && (
                    <button onClick={() => { setReviseOf(r.id); setFields({ ...r.fields }); window.scrollTo({ top: 0 }); }}>Yeni sürüm</button>
                  )}
                </div>
              </div>
            );
          })}
          {preview && (
            <div className="card">
              <div className="spread">
                <h3>Metin önizlemesi</h3>
                <button onClick={() => setPreview(null)}>Kapat</button>
              </div>
              <pre className="dis-pre">{preview}</pre>
              <p className="small muted">Önizleme yetki gerektirmez; kopyalama/indirme için yetki gerekir.</p>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

// ---------- Öz değerlendirme ve risk (TDR-03) ----------
function Risk({ store }: { store: Store }) {
  const act = useAction();
  const list = suppliers(store);
  const [supId, setSupId] = useState(list[0]?.id ?? "");
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [plan, setPlan] = useState([{ text: "", owner: "", due: "" }]);
  const canQ = ["admin", "data_owner", "data_entry"].includes(store.role);
  const canPlan = ["admin", "data_owner"].includes(store.role);
  if (list.length === 0) return <div className="card quiet"><h3>Önce tedarikçi kaydı gerekir</h3></div>;
  const preview = evaluateRisk(answers);
  const qs = questionnaires(store, supId).slice().reverse();
  const plans = correctivePlans(store, supId);
  return (
    <>
      <ErrorBox error={act.err} />
      {act.ok && <Notice kind="ok">{act.ok}</Notice>}
      <div className="grid-2">
        <div className="card">
          <h2>Öz değerlendirme anketi</h2>
          <p className="small muted">Risk temelli denetim: önce öz değerlendirme; yalnız yüksek riskte saha ziyareti görevi; ceza yerine düzeltici plan ve koçluk. Kurallar <code>content/supplier-program/risk-rules.yaml</code> v{RISK_RULES.version} ({RISK_RULES.status}).</p>
          <form onSubmit={(e) => { e.preventDefault(); act.run(() => { const q = submitQuestionnaire(store, supId, answers); setAnswers({}); return `Değerlendirme kaydedildi: ${q.level === "high" ? "yüksek risk — saha ziyareti görevi açıldı" : q.level === "medium" ? "orta risk — düzeltici plan önerilir" : "düşük risk"} (${q.points} puan). ${PREVIEW_NOTE}`; }); }}>
            <div className="field">
              <label htmlFor="qsup">Tedarikçi</label>
              <select id="qsup" value={supId} onChange={(e) => setSupId(e.target.value)}>
                {list.map((x) => (
                  <option key={x.id} value={x.id}>
                    {x.name}
                  </option>
                ))}
              </select>
            </div>
            {RISK_RULES.questions.map((q) => (
              <div className="field" key={q.id}>
                <label>{q.text.tr}</label>
                <div className="radio-list">
                  {q.options.map((o) => (
                    <label key={o.value}>
                      <input type="radio" name={q.id} checked={answers[q.id] === o.value} onChange={() => setAnswers({ ...answers, [q.id]: o.value })} />
                      <span>
                        {o.label} <span className="muted small">(+{o.points})</span>
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            ))}
            <div className="actions">
              <button className="primary" type="submit" disabled={!canQ || act.busy}>
                Kaydet ve riski belirle
              </button>
              <span className="small">
                Ön izleme: <b>{RISK_RULES.outcomes.find((o) => o.level === preview.level)?.label}</b> ({preview.points} puan)
              </span>
            </div>
          </form>
          <details>
            <summary className="small">Görünür kurallar ve iz</summary>
            <div className="dis-trace">{preview.trace.join("\n")}</div>
            <ul className="small">
              {RISK_RULES.outcomes.map((o) => (
                <li key={o.level}>
                  <b>{o.label}</b> (≥{o.min_points} puan): {o.action}
                </li>
              ))}
              {RISK_RULES.overrides.map((o, i) => (
                <li key={i}>
                  Doğrudan kural: {o.question_id} = "{o.equals}" → {o.level} — {o.reason}
                </li>
              ))}
              <li>Cevapsız soru +{RISK_RULES.unanswered_points} puan (sıfır sayılmaz).</li>
            </ul>
          </details>
        </div>
        <div className="card">
          <h2>Sonuçlar ve düzeltici plan</h2>
          {qs.length === 0 && <p className="muted">Bu tedarikçi için değerlendirme yok.</p>}
          {qs.map((q) => (
            <div key={q.id} className="card quiet">
              <div className="spread">
                <span>
                  {fmtDate(q.created_at)} · {q.points} puan · kural v{q.rules_version}
                </span>
                <span className={`badge ${q.level === "high" ? "crit" : q.level === "medium" ? "warn" : "ok"}`}>{RISK_RULES.outcomes.find((o) => o.level === q.level)?.label}</span>
              </div>
              {q.task_id && (
                <p className="small">
                  Saha ziyareti görevi açıldı: <Link href="/gorevler/">görevler</Link> (ceza değil; düzeltici plan + koçluk).
                </p>
              )}
              <details>
                <summary className="small">İz</summary>
                <div className="dis-trace">{q.trace.join("\n")}</div>
              </details>
            </div>
          ))}
          {qs.length > 0 && (
            <>
              <h3>Düzeltici plan (son değerlendirmeye bağlı)</h3>
              {plan.map((p, i) => (
                <div className="dis-mini" key={i} style={{ marginBottom: 4 }}>
                  <input aria-label="Eylem" placeholder="eylem" value={p.text} onChange={(e) => setPlan(plan.map((x, j) => (j === i ? { ...x, text: e.target.value } : x)))} />
                  <input aria-label="Sorumlu" placeholder="sorumlu" value={p.owner} onChange={(e) => setPlan(plan.map((x, j) => (j === i ? { ...x, owner: e.target.value } : x)))} />
                  <input aria-label="Tarih" type="date" value={p.due} onChange={(e) => setPlan(plan.map((x, j) => (j === i ? { ...x, due: e.target.value } : x)))} />
                </div>
              ))}
              <div className="actions">
                <button onClick={() => setPlan([...plan, { text: "", owner: "", due: "" }])}>+ eylem</button>
                <button className="primary" disabled={!canPlan || act.busy} onClick={() => act.run(() => { addCorrectivePlan(store, supId, qs[0].id, plan); setPlan([{ text: "", owner: "", due: "" }]); return `Düzeltici plan kaydedildi. ${PREVIEW_NOTE}`; })}>
                  Planı kaydet
                </button>
              </div>
            </>
          )}
          {plans.length > 0 && (
            <ul className="small">
              {plans.map((p) => (
                <li key={p.id}>
                  {fmtDate(p.created_at)}: {p.actions.map((a) => `${a.text} (${a.owner || "—"}, ${a.due || "—"})`).join("; ")}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </>
  );
}

// ---------- Tedarikçi görünümü (simülasyon; kapsam depo kuralıyla) ----------
function Portal({ store }: { store: Store }) {
  const act = useAction();
  const list = suppliers(store);
  const tpl = template();
  const [supId, setSupId] = useState(list[0]?.id ?? "");
  const [reqId, setReqId] = useState<string | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  if (list.length === 0) return <div className="card quiet"><h3>Önce tedarikçi kaydı ve yetkilendirilmiş talep gerekir</h3></div>;
  const visible = supplierRequests(store, supId);
  const sel = reqId ? visible.find((r) => r.id === reqId) ?? null : null;
  const acked = sel ? hasAck(store, supId, sel.id) : false;
  const evalPreview = evaluateResponse(answers);
  return (
    <div className="dis-supplier-view">
      <div className="spread">
        <div>
          <h2 style={{ marginTop: 0 }}>Tedarikçi görünümü (simülasyon)</h2>
          <p className="small">Önizlemede "tedarikçi" rolü yoktur; bu görünüm bir tedarikçi kimliği seçer ve depo kuralı gereği yalnız o tedarikçiye atanmış, yetkilendirilmiş talepleri gösterir. Kurumun başka hiçbir verisi bu görünümden okunamaz (SUPPLIER_SCOPE_VIOLATION). Üretimde tedarikçi ayrı kimlikle girer; yetki sunucuda denetlenir (kural 4).</p>
        </div>
        <select aria-label="Tedarikçi kimliği" value={supId} onChange={(e) => { setSupId(e.target.value); setReqId(null); setAnswers({}); }}>
          {list.map((x) => (
            <option key={x.id} value={x.id}>
              {x.name}
            </option>
          ))}
        </select>
      </div>
      <ErrorBox error={act.err} />
      {act.ok && <Notice kind="ok">{act.ok}</Notice>}
      {visible.length === 0 ? (
        <p className="muted">Bu tedarikçiye yetkilendirilmiş talep yok (taslak talepler görünmez).</p>
      ) : (
        <div className="table-wrap" style={{ background: "var(--surface)" }}>
          <table>
            <thead>
              <tr>
                <th>Talep</th>
                <th>Sürüm</th>
                <th>Durum</th>
                <th>Yanıt sürümü</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {visible.map((r) => {
                const rs = responses(store, r.id);
                return (
                  <tr key={r.id}>
                    <td>{r.fields.product}{r.parent_request_id && <span className="badge warn" style={{ marginLeft: 4 }}>tamamlayıcı</span>}</td>
                    <td>v{r.request_version}</td>
                    <td>{STATUS[r.status].label}</td>
                    <td className="small">{rs.length ? `v${rs[rs.length - 1].response_version}${rs[rs.length - 1].complete ? "" : ` · eksik: ${rs[rs.length - 1].missing_fields.map(fieldLabel).join(", ")}`}` : "—"}</td>
                    <td>
                      <button onClick={() => { setReqId(r.id); setAnswers({}); act.clear(); }}>Aç</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {sel && !acked && (
        <div className="card" style={{ marginTop: "1rem" }}>
          <h3>{tpl.confidentiality.title}</h3>
          <p>{tpl.confidentiality.text}</p>
          <p>
            <b>{tpl.confidentiality.aggregated_use_text}</b>
          </p>
          <p className="small muted">Neden isteniyor: {sel.fields.product} için referans birim başına emisyon verisi ({sel.fields.reference_unit}); veri yalnız toplulaştırılmış kullanılır.</p>
          <div className="actions">
            <button className="primary" onClick={() => act.run(() => { acknowledgeConfidentiality(store, supId, sel.id); return `Taahhüt onayı kaydedildi (sürüm ${sel.confidentiality_version}). Veri formu açıldı.`; })}>
              Okudum, onaylıyorum
            </button>
            <button onClick={() => act.run(() => { submitResponse(store, supId, sel.id, {}); })}>Onaylamadan forma geç (kural testi)</button>
          </div>
        </div>
      )}
      {sel && acked && (
        <div className="card" style={{ marginTop: "1rem" }}>
          <h3>Veri formu — {sel.fields.product}</h3>
          <dl className="kv">
            {tpl.fields.filter((f) => sel.fields[f.id]).map((f) => (
              <Frag key={f.id} k={f.label} v={sel.fields[f.id]} />
            ))}
          </dl>
          <form onSubmit={(e) => { e.preventDefault(); act.run(() => { const out = submitResponse(store, supId, sel.id, answers); setAnswers({}); return out.response.complete ? `Yanıt v${out.response.response_version} kaydedildi (tam). ${PREVIEW_NOTE}` : `Yanıt v${out.response.response_version} kaydedildi; eksik alanlar: ${out.response.missing_fields.map(fieldLabel).join(", ")}. ${out.complement ? "Tamamlayıcı talep taslağı açıldı (kurum yetkilendirecek)." : "Tamamlayıcı talep görevi açıldı."}`; }); }}>
            {tpl.response_fields.map((f) => (
              <TemplateInput key={f.id} f={f} value={answers[f.id] ?? ""} onChange={(v) => setAnswers({ ...answers, [f.id]: v })} />
            ))}
            {evalPreview.flags.map((f) => (
              <Notice key={f.code} kind="warn">
                <p>{f.message_tr}</p>
              </Notice>
            ))}
            <div className="actions">
              <button className="primary" type="submit" disabled={act.busy}>
                Yanıtı gönder (sürümlü)
              </button>
              <button type="button" onClick={() => setAnswers({ ...exampleTemplate().response })}>
                Örnek yanıtla doldur (kurgusal)
              </button>
            </div>
          </form>
          {responses(store, sel.id).length > 0 && (
            <>
              <h3>Yanıt sürümleriniz ve eksikler (§21)</h3>
              <ul className="small">
                {responses(store, sel.id).map((r) => (
                  <li key={r.id}>
                    v{r.response_version} · {fmtDate(r.created_at)} · {r.complete ? "tam" : `eksik: ${r.missing_fields.map(fieldLabel).join(", ")}`} {r.flags.map((f) => ` · ${f.message_tr}`)}
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}
    </div>
  );
}
function Frag({ k, v }: { k: string; v: string }) {
  return (
    <>
      <dt>{k}</dt>
      <dd>{v}</dd>
    </>
  );
}

// ---------- KOBİ dersi ve örnek şablon (TDR-04) ----------
function Kobi() {
  const ex = exampleTemplate();
  const tpl = template();
  const lesson = LESSONS.find((l) => l.id === ex.lesson_id);
  return (
    <div className="grid-2">
      <div className="card">
        <h2>KOBİ tedarikçi için kısa MRV / karbon muhasebesi dersi</h2>
        <p>
          Ders: <Link href="/101/">Sürdürülebilirlik 101</Link> → <b>{lesson ? `${lesson.id} ${lesson.title.tr}` : ex.lesson_id}</b>
          {lesson && <span className="badge neutral" style={{ marginLeft: 6 }}>{lesson.status}</span>}
        </p>
        <ul className="small">
          <li>Ne isteniyor: referans birim başına kg CO₂e; sınır, yıl, yöntem ve doğrulama durumuyla.</li>
          <li>Şirket toplamı tek başına ürün faktörü değildir; tahsis anahtarı (kütle, değer, süre) yazılır (§14).</li>
          <li>Bilmediğiniz alanı boş bırakın; sıfır yazmayın. Eksik alan için tamamlayıcı talep gelir, ceza gelmez.</li>
          <li>Veriniz yalnız toplulaştırılmış kullanılır; gizlilik taahhüdü her talebin ilk ekranındadır.</li>
        </ul>
        <p className="small muted">Bu özet derse yönlendirmedir; ders gövdesi içerik editörü onayıyla yayımlanır.</p>
      </div>
      <div className="card">
        <h2>Örnek dolu şablon (kurgusal)</h2>
        <p className="small muted">{ex.note}</p>
        <h3>Talep</h3>
        <dl className="kv">
          {tpl.fields.map((f) => (
            <Frag key={f.id} k={f.label} v={ex.fields[f.id] ?? "—"} />
          ))}
        </dl>
        <h3>Yanıt</h3>
        <dl className="kv">
          {tpl.response_fields.map((f) => (
            <Frag key={f.id} k={f.label} v={ex.response[f.id] ?? "—"} />
          ))}
        </dl>
      </div>
    </div>
  );
}
