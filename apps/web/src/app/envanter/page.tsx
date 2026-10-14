"use client";
import Link from "next/link";
import { useState } from "react";
import { SCOPE3_CATEGORIES, SOURCE_TYPE_LABEL, can, type ActivityRecord, type ActivityRecordVersion, type CalculationRun, type EmissionSource } from "@/lib/domain";
import { useStore, fmtDec, kgToT } from "@/lib/useStore";
import { aggregate, type AggregateResult } from "@/lib/calc";
import { ErrorBox, Loading, NoTenant, Notice, PageHeader, StateBadge } from "@/components/ui";
import { schemaForVersion, type CalcResultV2, type RecordSchema } from "@/modules/kayit/schemas";
import { assessCategory, categoryAssessments, type Applicability } from "@/modules/kayit/store";
import "@/modules/kayit/style.css";

interface Row {
  r: ActivityRecord;
  v: ActivityRecordVersion;
  source: EmissionSource;
  schema: RecordSchema | undefined;
  run: CalculationRun | null;
  scope: 0 | 1 | 2 | 3;
  category: number | null;
}

function ResultCell({ row }: { row: Row }) {
  const run = row.run;
  if (!run) return <span className="muted">hesap yok</span>;
  const r = run.result as CalcResultV2;
  const stale = run.record_version !== row.v.version;
  if (r.status === "blocked") return <span className="badge crit">engellendi{r.value_state === "unknown" ? " (bilinmiyor)" : ""}</span>;
  if (r.value_state === "not_applicable") return <span className="badge neutral">uygulanamaz — sayılmaz</span>;
  if (r.results) {
    const l = r.results.location_based;
    const m = r.results.market_based;
    return (
      <>
        {l && <span>konum {kgToT(l.total_co2e_kg)} t</span>}
        {l && m && " · "}
        {m && <span>piyasa {kgToT(m.total_co2e_kg)} t</span>} <span className="badge neutral">toplanmaz</span>
        {stale && <span className="badge warn">eski sürüm</span>}
      </>
    );
  }
  return (
    <>
      {kgToT(r.total_co2e_kg)} t <span className="badge neutral">{r.coverage ?? "—"}</span>
      {r.status === "review_required" && <span className="badge warn">inceleme</span>}
      {stale && <span className="badge warn">eski sürüm</span>}
    </>
  );
}

function RecordsTable({ rows, sources, showCategory }: { rows: Row[]; sources: EmissionSource[]; showCategory?: boolean }) {
  if (!rows.length) return <p className="muted">Bu bölümde kayıt yok (veri yok; filtre değil).</p>;
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Kayıt</th>
            <th>Tür</th>
            {showCategory && <th>Kat.</th>}
            <th>Kaynak</th>
            <th>Dönem</th>
            <th>Miktar</th>
            <th>Nitelik</th>
            <th>Durum</th>
            <th>Son hesap (kayıt başına; toplanmaz)</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((x) => (
            <tr key={x.r.id}>
              <td>
                <Link href={`/kayit/?id=${x.r.id}`} className="mono">
                  {x.r.id.slice(0, 12)}
                </Link>{" "}
                v{x.v.version} {x.r.training && <span className="badge info">eğitim</span>}
              </td>
              <td>{x.schema?.title ?? SOURCE_TYPE_LABEL[x.source.source_type]}</td>
              {showCategory && <td className="num">{x.category ?? "—"}</td>}
              <td>{sources.find((s) => s.id === x.v.source_id)?.name}</td>
              <td className="num">
                {x.v.period_start} → {x.v.period_end}
              </td>
              <td className="num">{x.v.quantity_state === "unknown" ? <span className="badge warn">bilinmiyor</span> : `${fmtDec(x.v.quantity)} ${x.v.unit ?? "(birim?)"}`}</td>
              <td>{x.v.data_quality === "estimated" ? <span className="badge warn">tahmini</span> : "ölçülmüş"}</td>
              <td>
                <StateBadge state={x.r.state} />
              </td>
              <td className="num">
                <ResultCell row={x} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function Envanter() {
  const { store, ready } = useStore();
  const [err, setErr] = useState<unknown>(null);
  const [editCat, setEditCat] = useState<{ n: number; state: Applicability; reason: string } | null>(null);
  const [agg, setAgg] = useState<{ busy: boolean; policy: "location_based" | "market_based"; result: AggregateResult | null; error: string }>({ busy: false, policy: "location_based", result: null, error: "" });
  if (!ready || !store) return <Loading />;
  if (!store.tenant) return <NoTenant />;
  const sources = store.sources();
  const rows: Row[] = store.records().map((r) => {
    const v = store.current(r.id);
    const source = store.source(v.source_id);
    const schema = schemaForVersion(source, v.detail);
    const scope = schema ? schema.scope : 0;
    return { r, v, source, schema, run: store.latestRun(r.id), scope, category: schema?.category ?? null };
  });
  const s1 = rows.filter((x) => x.scope === 1);
  const s2 = rows.filter((x) => x.scope === 2);
  const s3 = rows.filter((x) => x.scope === 3);
  const product = rows.filter((x) => x.source.source_type === "product_process" || (x.run?.result as CalcResultV2 | undefined)?.context === "product");
  const assessments = categoryAssessments(store);
  const canAssess = can(store.role, "kayit.category.assess");
  const openTasks = store.tasks().filter((t) => t.status === "open").length;

  const runAggregate = async () => {
    setAgg((a) => ({ ...a, busy: true, error: "", result: null }));
    try {
      const results = rows
        .filter((x) => x.run)
        .map((x) => ({
          record_id: x.r.id,
          context: x.scope === 0 ? "product" : "corporate",
          scope: x.scope === 0 ? null : x.scope,
          category: x.category,
          state: x.r.state,
          result: x.run!.result,
          scope2_method_used: (x.v.detail?.scope2_method_used as string | undefined) ?? null,
        }));
      const res = await aggregate({ results, policy: { include_states: ["approved", "locked"], scope2_method: agg.policy } });
      setAgg((a) => ({ ...a, busy: false, result: res }));
    } catch (e) {
      setAgg((a) => ({ ...a, busy: false, error: String((e as Error)?.message ?? e) }));
    }
  };

  return (
    <>
      <PageHeader eyebrow="Envanter · Kapsam 1 · 2 · 3 · ürün" title="Emisyon envanteri" lead="Kaynaklar, kayıtlar ve kayıt başına son hesap. Arayüz sayıları toplamaz; 'hesaplanan envanter toplamı' yalnız motorun toplama işlevinden gelir ve rapor manifestine yazılır. Eksik kategori ve bilinmeyen veri görünür kalır; eksik veriye sıfır atanmaz (§22, T10)." tags={["§12", "§13", "§14", "§15", "§22", "T10"]} />
      <ErrorBox error={err} />
      <div className="stat-row">
        <div className="stat"><span className="v">{sources.length}</span><span className="l">kaynak</span></div>
        <div className="stat"><span className="v">{rows.length}</span><span className="l">kayıt</span></div>
        <div className="stat"><span className="v">{rows.filter((x) => x.r.state === "approved" || x.r.state === "locked").length}</span><span className="l">onaylı / kilitli</span></div>
        <div className="stat"><span className="v">{openTasks}</span><span className="l">açık görev</span></div>
      </div>

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
                  const n = rows.filter((x) => x.v.source_id === s.id).length;
                  const sc = schemaForVersion(s, null);
                  return (
                    <tr key={s.id}>
                      <td>{s.name}</td>
                      <td>
                        {SOURCE_TYPE_LABEL[s.source_type]} {s.fuel && <span className="muted">· {s.fuel}</span>}
                      </td>
                      <td>{sc ? (sc.scope === 0 ? "Ürün bağlamı" : `Kapsam ${sc.scope}${sc.category ? ` (kat. ${sc.category})` : ""}`) : "—"}</td>
                      <td>{sc ? <Link href={`/veri-girisi/?sema=${sc.key}`} className="badge ok">hazır</Link> : <span className="badge neutral">şema yok</span>}</td>
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
        <h2>Kapsam 1 — doğrudan emisyonlar ({s1.length})</h2>
        <RecordsTable rows={s1} sources={sources} />
      </div>
      <div className="card">
        <h2>Kapsam 2 — satın alınan enerji ({s2.length})</h2>
        <p className="small muted">Konum ve piyasa bazlı sonuçlar ayrı gösterilir, toplanmaz. Kurumsal toplamda kullanılan yöntem her kayıtta yazılıdır (§13).</p>
        <RecordsTable rows={s2} sources={sources} />
        {s2.length > 0 && (
          <ul className="small">
            {s2.map((x) => (
              <li key={x.r.id}>
                <span className="mono">{x.r.id.slice(0, 12)}</span>: kurumsal toplamda {x.v.detail?.scope2_method_used ? (x.v.detail.scope2_method_used === "market_based" ? "piyasa bazlı" : "konum bazlı") : <span className="badge warn">yöntem seçilmedi</span>}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="card">
        <h2>Kapsam 3 — değer zinciri (15 kategori)</h2>
        <p className="small muted">Hiçbir kategori silinmez. Değerlendirilmemiş veya kaydı olmayan kategori "bilinmiyor"dur; uygulanamazlık gerekçeyle kaydedilir (T10). Veri kalitesi payı kayıt sayısına göredir; emisyon ağırlıklı pay motorun toplama çıktısındadır (§16).</p>
        <div className="table-wrap">
          <table className="cat-table">
            <thead>
              <tr>
                <th>Kat.</th>
                <th>Kategori</th>
                <th>Uygulanabilirlik</th>
                <th>Kayıt</th>
                <th>Son hesaplar (kayıt başına)</th>
                <th>Tahmini pay (adet)</th>
                <th>Sorumlu önerisi</th>
              </tr>
            </thead>
            <tbody>
              {SCOPE3_CATEGORIES.map((c) => {
                const a = assessments[c.n];
                const recs = s3.filter((x) => x.category === c.n);
                const est = recs.filter((x) => x.v.data_quality === "estimated").length;
                const missing = a.state === "unknown" && recs.length === 0;
                const unknownRecs = recs.filter((x) => x.v.quantity_state === "unknown").length;
                return (
                  <tr key={c.n}>
                    <td className="num">{c.n}</td>
                    <td className={missing ? "missing" : ""}>
                      {c.tr} {missing && <span className="badge warn">eksik — bilinmiyor</span>}
                    </td>
                    <td>
                      {editCat?.n === c.n ? (
                        <form
                          className="row"
                          onSubmit={(e) => {
                            e.preventDefault();
                            setErr(null);
                            try {
                              assessCategory(store, c.n, editCat.state, editCat.reason || null);
                              setEditCat(null);
                            } catch (ex) {
                              setErr(ex);
                            }
                          }}
                        >
                          <select value={editCat.state} onChange={(e) => setEditCat({ ...editCat, state: e.target.value as Applicability })} aria-label="Uygulanabilirlik">
                            <option value="applicable">uygulanabilir</option>
                            <option value="not_applicable">uygulanamaz (gerekçe)</option>
                            <option value="unknown">bilinmiyor</option>
                          </select>
                          {editCat.state === "not_applicable" && <input placeholder="Gerekçe (zorunlu)" value={editCat.reason} onChange={(e) => setEditCat({ ...editCat, reason: e.target.value })} style={{ maxWidth: 220 }} />}
                          <button className="mini primary" type="submit">
                            Kaydet
                          </button>
                          <button className="mini" type="button" onClick={() => setEditCat(null)}>
                            Vazgeç
                          </button>
                        </form>
                      ) : (
                        <>
                          <span className={`badge ${a.state === "applicable" ? "ok" : a.state === "not_applicable" ? "neutral" : "warn"}`}>{a.state === "applicable" ? "uygulanabilir" : a.state === "not_applicable" ? "uygulanamaz" : "bilinmiyor"}</span>
                          {a.reason && <span className="small"> — {a.reason}</span>}{" "}
                          {canAssess && (
                            <button className="mini" type="button" onClick={() => setEditCat({ n: c.n, state: a.state, reason: a.reason ?? "" })}>
                              değerlendir
                            </button>
                          )}
                        </>
                      )}
                    </td>
                    <td className="num">
                      {recs.length}
                      {unknownRecs > 0 && <span className="badge warn">{unknownRecs} bilinmiyor</span>}
                    </td>
                    <td className="num">
                      {recs.length === 0 ? (
                        "—"
                      ) : (
                        <ul className="small" style={{ margin: 0, paddingLeft: "1rem" }}>
                          {recs.map((x) => (
                            <li key={x.r.id}>
                              <Link href={`/kayit/?id=${x.r.id}`} className="mono">
                                {x.r.id.slice(0, 10)}
                              </Link>{" "}
                              <ResultCell row={x} />
                            </li>
                          ))}
                        </ul>
                      )}
                    </td>
                    <td className="num">{recs.length ? `${est}/${recs.length}` : "—"}</td>
                    <td className="small muted">{c.owner_hint}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="small muted">Veri talebi şablonu (tedarikçiye): ürün, referans birim, sistem sınırı, kapsanan yıl/coğrafya, yöntem, doğrulama durumu ve belge (§14). Eksik kategoriler için <Link href="/gorevler/">görev</Link> açın.</p>
      </div>

      <div className="card">
        <h2>Ürün çalışmaları ({product.length}) — kurumsal toplamın dışında</h2>
        <p className="small muted">Ürün/LCA ve CBAM gömülü emisyon sonuçları Kapsam 1–2 toplamına eklenmez (§17, kural 8). Ürün sayfası: <Link href="/urun/">Ürün ve yaşam döngüsü</Link>.</p>
        <RecordsTable rows={product} sources={sources} />
      </div>

      <div className="card">
        <h2>Hesaplanan envanter toplamı (motor toplaması, K-17)</h2>
        <p className="small">
          Arayüz toplam üretmez. Aşağıdaki buton son hesap koşularını motorun <code>aggregate()</code> işlevine verir; yalnız onaylı/kilitli kayıtlar toplanır, ürün sonuçları ve bilinmeyen/uygulanamaz kayıtlar ayrı listelenir, Kapsam 2'de tek yöntem seçilir. Rapor manifestinde aynı toplam kalıcı olarak yazılır (<Link href="/raporlar/">Raporlar</Link>).
        </p>
        <div className="actions">
          <label className="check">
            Kapsam 2 politikası:{" "}
            <select value={agg.policy} onChange={(e) => setAgg((a) => ({ ...a, policy: e.target.value as "location_based" | "market_based" }))}>
              <option value="location_based">konum bazlı</option>
              <option value="market_based">piyasa bazlı</option>
            </select>
          </label>
          <button className="primary" onClick={runAggregate} disabled={agg.busy || rows.every((x) => !x.run)}>
            {agg.busy ? "Motor topluyor…" : "Motorla topla (önizleme)"}
          </button>
        </div>
        {agg.error && (
          <Notice kind="crit" title="Toplama yapılamadı">
            <p>{agg.error}</p>
          </Notice>
        )}
        {agg.result && (
          <dl className="kv" style={{ marginTop: "0.75rem" }}>
            <dt>{agg.result.corporate.label_tr}</dt>
            <dd className="num">
              <b>{kgToT(agg.result.corporate.total_kg)} t CO₂e</b>
            </dd>
            <dt>Kapsam 1</dt>
            <dd className="num">{kgToT(agg.result.corporate.scope1_kg)} t</dd>
            <dt>Kapsam 2 ({agg.result.corporate.scope2_method ?? "—"})</dt>
            <dd className="num">
              {kgToT(agg.result.corporate.scope2_kg)} t {agg.result.corporate.scope2_alternative_kg != null && <span className="muted">(diğer yöntem {kgToT(agg.result.corporate.scope2_alternative_kg)} t — toplanmaz)</span>}
            </dd>
            <dt>Kapsam 3</dt>
            <dd className="num">
              {kgToT(agg.result.corporate.scope3_kg)} t · kategori: {Object.entries(agg.result.corporate.scope3_by_category).map(([k, val]) => `${k}: ${kgToT(val)} t`).join(", ") || "—"}
            </dd>
            <dt>Tahmini pay</dt>
            <dd className="num">adet {agg.result.corporate.estimated_share_by_count ?? "—"} · kg ağırlıklı {fmtDec(agg.result.corporate.estimated_share_by_kg, 3)}</dd>
            <dt>Dışarıda</dt>
            <dd className="small">{agg.result.corporate.excluded.map((e) => `${e.record_id.slice(0, 10)}: ${e.reason}`).join("; ") || "—"}</dd>
            <dt>Bilinmiyor / uygulanamaz</dt>
            <dd className="small">
              {agg.result.unknown.length} bilinmiyor, {agg.result.not_applicable.length} uygulanamaz (sıfır sayılmaz)
            </dd>
            <dt>Kapsama notları</dt>
            <dd className="small">{agg.result.corporate.coverage_notes_tr.join(" ") || "—"}</dd>
            <dt>Ürün (ayrı)</dt>
            <dd className="small">{Object.entries(agg.result.product).map(([k, p]) => `${k}: ${kgToT(p.total_kg)} t — ${p.claim_tr}`).join("; ") || "—"}</dd>
            <dt>Biyojenik CO₂ (ayrı)</dt>
            <dd className="num">{agg.result.biogenic_co2_kg ? `${kgToT(agg.result.biogenic_co2_kg)} t` : "—"}</dd>
          </dl>
        )}
      </div>
    </>
  );
}
