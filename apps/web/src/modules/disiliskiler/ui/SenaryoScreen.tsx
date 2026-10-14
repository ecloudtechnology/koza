"use client";
// Senaryo defteri ekranı (REG-05, §22, AKS-05, kural 7). Veri: scenario.ts. Envanterden kesin ayrı.
import Link from "next/link";
import { useState } from "react";
import { ROLE_LABEL } from "@/lib/domain";
import { useStore, fmtDate, fmtDec } from "@/lib/useStore";
import { ErrorBox, Loading, NoTenant, Notice, PageHeader } from "@/components/ui";
import type { Store } from "@/lib/store";
import { addAllocationScenario, addImpactScenario, addLedgerEntry, addShadowPrice, allocationScenarios, currentShadowPrice, impactScenarios, ledger, retireLedgerEntry, shadowPrices, type LedgerRow } from "../scenario";
import { PREVIEW_NOTE, Tabs, useAction } from "./common";

const TABS = [
  { id: "fiyat", label: "Gölge karbon fiyatı" },
  { id: "tahsis", label: "Tahsis / açık-fazla" },
  { id: "defter", label: "Kredi · giderim · kaçınılan" },
  { id: "etki", label: "Etki senaryosu" },
];
const KIND: Record<LedgerRow["kind"], string> = { credit: "Karbon kredisi", removal: "Giderim", avoided: "Kaçınılan emisyon" };

export default function SenaryoScreen() {
  const { store, ready } = useStore();
  const [tab, setTab] = useState("fiyat");
  if (!ready || !store) return <Loading />;
  if (!store.tenant) return <NoTenant />;
  const canWrite = ["admin", "approver"].includes(store.role);
  return (
    <>
      <PageHeader eyebrow={`Senaryo defteri · REG-05 · §22 · AKS-05 · rol: ${ROLE_LABEL[store.role]}`} title="Senaryo defteri" lead="Gölge karbon fiyatı, ücretsiz tahsis açık/fazla senaryoları, karbon kredisi/giderim/kaçınılan emisyon defteri ve aksiyona bağlı etki senaryoları. Hepsi envanterden ayrı bir defterdir." />
      <div className="dis-banner" role="note">
        <b>Bu defter envanteri değiştirmez.</b> Buradaki hiçbir satır kayıt, hesap koşusu, onay, dönem veya rapor manifestine yazmaz; brüt toplamdan hiçbir şey düşülmez (kural 7, §22). Her yazma işlemi envanter parmak izini önce/sonra karşılaştırır; değişirse işlem geri alınır (SCENARIO_NOT_INVENTORY). Yazma yetkisi: onaylayan ve kurum yöneticisi (önizlemede finans rolü yok; K-11).
      </div>
      {!canWrite && <Notice kind="info"><p>Bu rol senaryo defterine yazamaz; okuyabilir.</p></Notice>}
      <Tabs items={TABS} value={tab} onChange={setTab} />
      {tab === "fiyat" && <Fiyat store={store} canWrite={canWrite} />}
      {tab === "tahsis" && <Tahsis store={store} canWrite={canWrite} />}
      {tab === "defter" && <Defter store={store} canWrite={canWrite} />}
      {tab === "etki" && <Etki store={store} canWrite={canWrite} />}
    </>
  );
}

function Fiyat({ store, canWrite }: { store: Store; canWrite: boolean }) {
  const act = useAction();
  const [f, setF] = useState({ value: "", currency: "EUR", effective_from: "", review_cycle: "yıllık", note: "" });
  const list = shadowPrices(store).slice().reverse();
  const cur = currentShadowPrice(store);
  return (
    <div className="grid-2">
      <div className="card">
        <h2>Gölge karbon fiyatı kaydet (AKS-05)</h2>
        <p className="small muted">Yatırım taleplerinde "enerji/emisyon etkisi" zorunludur; gölge fiyat varsa senaryo olarak eklenir. Fiyatı kim belirler ve ne sıklıkla güncellenir sorusu açık karardır (K-11); kayıt yapılabilir, "kurum kararı bekliyor" rozetiyle görünür.</p>
        <ErrorBox error={act.err} />
        {act.ok && <Notice kind="ok">{act.ok}</Notice>}
        <form onSubmit={(e) => { e.preventDefault(); act.run(() => { addShadowPrice(store, f); setF({ ...f, value: "", note: "" }); return `Gölge fiyat kaydedildi. ${PREVIEW_NOTE} Performans modülü bu satırı senaryo olarak okuyabilir.`; }); }}>
          <div className="field">
            <label htmlFor="pv">Değer (para birimi / tCO₂e) *</label>
            <div className="inline">
              <input id="pv" value={f.value} onChange={(e) => setF({ ...f, value: e.target.value })} inputMode="decimal" placeholder="ör. 85,50" required />
              <input aria-label="Para birimi" value={f.currency} onChange={(e) => setF({ ...f, currency: e.target.value })} style={{ width: 80 }} />
            </div>
          </div>
          <div className="field">
            <label htmlFor="pe">Geçerlilik başlangıcı *</label>
            <input id="pe" type="date" value={f.effective_from} onChange={(e) => setF({ ...f, effective_from: e.target.value })} required />
          </div>
          <div className="field">
            <label htmlFor="pr">Gözden geçirme sıklığı</label>
            <input id="pr" value={f.review_cycle} onChange={(e) => setF({ ...f, review_cycle: e.target.value })} />
            <span className="hint">Öneri: finans + sürdürülebilirlik, yıllık (K-11 kesinleşince güncellenir).</span>
          </div>
          <div className="field">
            <label htmlFor="pn">Not / dayanak</label>
            <input id="pn" value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} placeholder="kaynak veya gerekçe; doğrulanmamış piyasa fiyatı yazmayın" />
          </div>
          <button className="primary" type="submit" disabled={!canWrite || act.busy}>
            Kaydet (rol: {ROLE_LABEL[store.role]})
          </button>
        </form>
      </div>
      <div className="card">
        <h2>Geçerli fiyat ve geçmiş</h2>
        {cur ? (
          <p>
            <span className="big-num">{fmtDec(cur.value, 2)}</span> {cur.currency}/{cur.per_unit} · geçerli {cur.effective_from} · belirleyen rol {ROLE_LABEL[cur.set_by_role as keyof typeof ROLE_LABEL] ?? cur.set_by_role}{" "}
            <span className="badge warn">kurum kararı bekliyor ({cur.decision_ref})</span>
          </p>
        ) : (
          <p className="muted">Kayıtlı gölge fiyat yok. Yatırım talepleri fiyatsız yalnız "enerji/emisyon etkisi" ile değerlendirilir.</p>
        )}
        {list.length > 0 && (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Değer</th>
                  <th>Geçerlilik</th>
                  <th>Rol</th>
                  <th>Gözden geçirme</th>
                  <th>Kayıt</th>
                </tr>
              </thead>
              <tbody>
                {list.map((p) => (
                  <tr key={p.id}>
                    <td className="num">
                      {fmtDec(p.value, 2)} {p.currency}/{p.per_unit}
                    </td>
                    <td>{p.effective_from}</td>
                    <td>{p.set_by_role}</td>
                    <td>{p.review_cycle}</td>
                    <td className="small">
                      {fmtDate(p.created_at)} {p.note && `· ${p.note}`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="small muted">
          Depo satırı: <code>store.rows("disiliskiler","shadow_price")</code> → {"{value, currency, per_unit, effective_from, set_by_role}"}.
        </p>
      </div>
    </div>
  );
}

function Tahsis({ store, canWrite }: { store: Store; canWrite: boolean }) {
  const act = useAction();
  const facs = store.facilities();
  const [f, setF] = useState({ label: "", facility_id: "", allowance_qty: "", expected_emissions_qty: "", benchmark_note: "", note: "" });
  const list = allocationScenarios(store).slice().reverse();
  return (
    <div className="grid-2">
      <div className="card">
        <h2>Ücretsiz tahsis — açık / fazla senaryosu (REG-05)</h2>
        <p className="small muted">Tahsis miktarını ve beklenen emisyonu siz girersiniz; uygulama benchmark üretmez (ulusal tahsis kuralları K-06 ile doğrulanmamış). Sonuç yalnız senaryodur; envanterdeki onaylı toplamla karıştırılmaz.</p>
        <ErrorBox error={act.err} />
        {act.ok && <Notice kind="ok">{act.ok}</Notice>}
        <form onSubmit={(e) => { e.preventDefault(); act.run(() => { const sc = addAllocationScenario(store, { ...f, facility_id: f.facility_id || null }); setF({ ...f, label: "", allowance_qty: "", expected_emissions_qty: "", note: "" }); return `Senaryo kaydedildi: ${sc.outcome === "surplus" ? "fazla" : sc.outcome === "deficit" ? "açık" : "denk"} ${fmtDec(sc.difference, 3)} tCO₂e. ${PREVIEW_NOTE}`; }); }}>
          <div className="field">
            <label htmlFor="al">Senaryo adı *</label>
            <input id="al" value={f.label} onChange={(e) => setF({ ...f, label: e.target.value })} required />
          </div>
          <div className="field">
            <label htmlFor="af">Tesis</label>
            <select id="af" value={f.facility_id} onChange={(e) => setF({ ...f, facility_id: e.target.value })}>
              <option value="">kurum geneli</option>
              {facs.map((x) => (
                <option key={x.id} value={x.id}>
                  {x.name}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="aa">Tahsis miktarı (tCO₂e) *</label>
            <input id="aa" value={f.allowance_qty} onChange={(e) => setF({ ...f, allowance_qty: e.target.value })} inputMode="decimal" required />
          </div>
          <div className="field">
            <label htmlFor="ae">Beklenen emisyon (tCO₂e, senaryo varsayımı) *</label>
            <input id="ae" value={f.expected_emissions_qty} onChange={(e) => setF({ ...f, expected_emissions_qty: e.target.value })} inputMode="decimal" required />
            <span className="hint">Onaylı envanter toplamı otomatik alınmaz; senaryo varsayımı ayrı girilir ki iki sayı karışmasın.</span>
          </div>
          <div className="field">
            <label htmlFor="ab">Benchmark notu</label>
            <input id="ab" value={f.benchmark_note} onChange={(e) => setF({ ...f, benchmark_note: e.target.value })} placeholder="hangi benchmark varsayıldı; kaynak doğrulanmadı" />
          </div>
          <button className="primary" type="submit" disabled={!canWrite || act.busy}>
            Senaryoyu kaydet
          </button>
        </form>
      </div>
      <div className="card">
        <h2>Senaryolar ({list.length})</h2>
        {list.length === 0 && <p className="muted">Senaryo yok.</p>}
        {list.map((sc) => (
          <div key={sc.id} className="card quiet">
            <div className="spread">
              <b>{sc.label}</b>
              <span className={`badge ${sc.outcome === "surplus" ? "ok" : sc.outcome === "deficit" ? "warn" : "neutral"}`}>senaryo · {sc.outcome === "surplus" ? "fazla" : sc.outcome === "deficit" ? "açık" : "denk"}</span>
            </div>
            <p className="small num">
              tahsis {fmtDec(sc.allowance_qty, 3)} − beklenen {fmtDec(sc.expected_emissions_qty, 3)} = <b>{fmtDec(sc.difference, 3)} tCO₂e</b> · {sc.facility_id ? facs.find((x) => x.id === sc.facility_id)?.name : "kurum geneli"} · {fmtDate(sc.created_at)}
            </p>
            {sc.benchmark_note && <p className="small muted">benchmark: {sc.benchmark_note}</p>}
          </div>
        ))}
      </div>
    </div>
  );
}

function Defter({ store, canWrite }: { store: Store; canWrite: boolean }) {
  const act = useAction();
  const [f, setF] = useState({ kind: "credit" as LedgerRow["kind"], quantity_tco2e: "", vintage: "", standard_ref: "", evidence_ref: "", note: "" });
  const list = ledger(store).slice().reverse();
  return (
    <div className="grid-2">
      <div className="card">
        <h2>Kredi · giderim · kaçınılan emisyon defteri (§22)</h2>
        <p className="small muted">Bu satırlar brüt toplamdan otomatik düşülmez ve raporda ayrı görünümde kalır. "Net" iddiası üretilmez.</p>
        <ErrorBox error={act.err} />
        {act.ok && <Notice kind="ok">{act.ok}</Notice>}
        <form onSubmit={(e) => { e.preventDefault(); act.run(() => { addLedgerEntry(store, f); setF({ ...f, quantity_tco2e: "", note: "" }); return `Defter satırı kaydedildi (${KIND[f.kind]}). ${PREVIEW_NOTE}`; }); }}>
          <div className="field">
            <label htmlFor="lk">Tür</label>
            <select id="lk" value={f.kind} onChange={(e) => setF({ ...f, kind: e.target.value as LedgerRow["kind"] })}>
              {(Object.keys(KIND) as LedgerRow["kind"][]).map((k) => (
                <option key={k} value={k}>
                  {KIND[k]}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="lq">Miktar (tCO₂e) *</label>
            <input id="lq" value={f.quantity_tco2e} onChange={(e) => setF({ ...f, quantity_tco2e: e.target.value })} inputMode="decimal" required />
          </div>
          <div className="dis-mini">
            <input aria-label="Yıl" placeholder="vintage / yıl" value={f.vintage} onChange={(e) => setF({ ...f, vintage: e.target.value })} />
            <input aria-label="Standart" placeholder="standart / kayıt sistemi" value={f.standard_ref} onChange={(e) => setF({ ...f, standard_ref: e.target.value })} />
            <input aria-label="Kanıt" placeholder="kanıt referansı" value={f.evidence_ref} onChange={(e) => setF({ ...f, evidence_ref: e.target.value })} />
          </div>
          <button className="primary" type="submit" disabled={!canWrite || act.busy}>
            Kaydet
          </button>
        </form>
      </div>
      <div className="card">
        <h2>Defter ({list.length})</h2>
        {list.length === 0 ? (
          <p className="muted">Satır yok.</p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Tür</th>
                  <th>tCO₂e</th>
                  <th>Yıl</th>
                  <th>Standart</th>
                  <th>Durum</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {list.map((r) => (
                  <tr key={r.id}>
                    <td>{KIND[r.kind]}</td>
                    <td className="num">{fmtDec(r.quantity_tco2e, 3)}</td>
                    <td>{r.vintage || "—"}</td>
                    <td className="small">{r.standard_ref || "—"}</td>
                    <td>
                      <span className={`badge ${r.status === "retired" ? "neutral" : "info"}`}>{r.status === "retired" ? "kullanıldı" : "kayıtlı"}</span>
                    </td>
                    <td>{r.status === "recorded" && <button disabled={!canWrite} onClick={() => act.run(() => { retireLedgerEntry(store, r.id, "kullanıldı olarak işaretlendi"); return "Satır 'kullanıldı' olarak işaretlendi; envanter değişmedi."; })}>kullanıldı</button>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="small muted">
          Envanter toplamı <Link href="/raporlar/">rapor manifestinde</Link> yalnız onaylı kayıtlardan gelir; bu defter ona dokunmaz.
        </p>
      </div>
    </div>
  );
}

function Etki({ store, canWrite }: { store: Store; canWrite: boolean }) {
  const act = useAction();
  const prices = shadowPrices(store);
  const tasks = store.tasks().filter((t) => t.status === "open");
  const [f, setF] = useState({ title: "", action_ref: "", assumed_reduction_tco2e: "", shadow_price_id: prices.length ? prices[prices.length - 1].id : "", note: "" });
  const list = impactScenarios(store).slice().reverse();
  return (
    <div className="grid-2">
      <div className="card">
        <h2>Etki senaryosu — aksiyona bağlı (AKS-05)</h2>
        <p className="small muted">Bir görev/aksiyon için varsayılan azaltımı girin; gölge fiyat seçilirse senaryo tutarı (fiyat × azaltım) gösterilir. Bu tutar motor sonucu değildir ve yatırım dosyasında "senaryo" etiketiyle yer alır. Gerçek etki ölçülmeden aksiyon kapanmaz (AKS-04).</p>
        <ErrorBox error={act.err} />
        {act.ok && <Notice kind="ok">{act.ok}</Notice>}
        <form onSubmit={(e) => { e.preventDefault(); act.run(() => { const r = addImpactScenario(store, { ...f, shadow_price_id: f.shadow_price_id || null }); setF({ ...f, title: "", assumed_reduction_tco2e: "", note: "" }); return `Etki senaryosu kaydedildi${r.shadow_value ? `: ${fmtDec(r.shadow_value, 2)} ${r.currency} (senaryo)` : ""}. ${PREVIEW_NOTE}`; }); }}>
          <div className="field">
            <label htmlFor="et">Başlık *</label>
            <input id="et" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} required />
          </div>
          <div className="field">
            <label htmlFor="ea">Bağlı aksiyon / görev</label>
            <input id="ea" list="open-tasks" value={f.action_ref} onChange={(e) => setF({ ...f, action_ref: e.target.value })} placeholder="görev kimliği veya açıklama" />
            <datalist id="open-tasks">
              {tasks.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.title}
                </option>
              ))}
            </datalist>
          </div>
          <div className="field">
            <label htmlFor="er">Varsayılan azaltım (tCO₂e / yıl) *</label>
            <input id="er" value={f.assumed_reduction_tco2e} onChange={(e) => setF({ ...f, assumed_reduction_tco2e: e.target.value })} inputMode="decimal" required />
          </div>
          <div className="field">
            <label htmlFor="ep">Gölge fiyat</label>
            <select id="ep" value={f.shadow_price_id} onChange={(e) => setF({ ...f, shadow_price_id: e.target.value })}>
              <option value="">fiyatsız (yalnız emisyon etkisi)</option>
              {prices.map((p) => (
                <option key={p.id} value={p.id}>
                  {fmtDec(p.value, 2)} {p.currency}/tCO₂e ({p.effective_from})
                </option>
              ))}
            </select>
          </div>
          <button className="primary" type="submit" disabled={!canWrite || act.busy}>
            Kaydet
          </button>
        </form>
      </div>
      <div className="card">
        <h2>Senaryolar ({list.length})</h2>
        {list.length === 0 && <p className="muted">Etki senaryosu yok.</p>}
        {list.map((r) => (
          <div key={r.id} className="card quiet">
            <b>{r.title}</b> <span className="badge copper">senaryo</span>
            <p className="small num">
              azaltım {fmtDec(r.assumed_reduction_tco2e, 3)} tCO₂e {r.shadow_value && <>· senaryo tutarı <b>{fmtDec(r.shadow_value, 2)} {r.currency}</b></>} · aksiyon: {r.action_ref ? (tasks.find((t) => t.id === r.action_ref) ? <Link href="/gorevler/">{tasks.find((t) => t.id === r.action_ref)!.title}</Link> : r.action_ref) : "—"} · {fmtDate(r.created_at)}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
