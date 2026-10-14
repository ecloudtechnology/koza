"use client";
// Raporlar (§22, T19, K-17): çekirdek manifest store.createReport ile (SHA-256, T19); toplamlar YALNIZ motorun
// aggregate() çıktısından. Paket = çekirdek manifest + motor toplamı + kaynaklar + kanıt indeksi + GRI/TSRS indeksi.
// Yayımlama ayrı yetkili işlem; taslak indirmek yayımlamak değildir. Platform kendine güvence etiketi vermez.
import Link from "next/link";
import { useState } from "react";
import { aggregate } from "@/lib/calc";
import { can, ROLE_LABEL } from "@/lib/domain";
import { sha256Hex } from "@/lib/hash";
import { StoreError } from "@/lib/store";
import { useStore, fmtDate, fmtDec, kgToT } from "@/lib/useStore";
import { ErrorBox, Loading, NoTenant, Notice, PageHeader } from "@/components/ui";
import { EngineStatus, ReportPackageView, useEngine } from "@/modules/urun-rapor/components";
import { buildCsv, buildDocxBytes, downloadBlob, packageSections } from "@/modules/urun-rapor/export";
import { assurances, attachAssurance, buildAggregateRequest, createPackage, packages, publications, publishPackage, recordExport, reportingIndex, reportingMaps, SCOPE2_METHOD_LABEL } from "@/modules/urun-rapor/report";
import type { Assurance, ReportPackage, Scope2Method } from "@/modules/urun-rapor/types";
import "@/modules/urun-rapor/style.css";

export default function Raporlar() {
  const { store, ready } = useStore();
  const { engine, engineErr } = useEngine();
  const [err, setErr] = useState<unknown>(null);
  const [reason, setReason] = useState("");
  const [s2, setS2] = useState<Scope2Method>("location_based");
  const [busy, setBusy] = useState(false);
  const [ok, setOk] = useState<string | null>(null);
  if (!ready || !store) return <Loading />;
  if (!store.tenant) return <NoTenant />;
  const periods = store.periods();
  const pkgs = packages(store).slice().reverse();
  const legacy = store.reports().filter((r) => !pkgs.some((p) => p.report_id === r.id));
  const canCreate = can(store.role, "report.create");

  const create = async (period_id: string, hasPrev: boolean) => {
    setBusy(true);
    setErr(null);
    setOk(null);
    try {
      store.require("report.create");
      const req = buildAggregateRequest(store, period_id, s2);
      let agg;
      try {
        agg = await aggregate(req);
      } catch (e) {
        throw new StoreError("ENGINE_LOAD_FAILED", `Toplam yalnız motordan gelir; motor toplama çağrısı başarısız: ${String((e as Error)?.message ?? e)}. Rapor oluşturulmadı.`, 503);
      }
      const p = await createPackage(store, period_id, hasPrev ? reason : null, req, agg);
      setReason("");
      setOk(`Rapor paketi v${p.report_version} bu tarayıcıda kaydedildi (paket SHA-256 ${p.package_sha256.slice(0, 12)}…). Durum: ${store.period(period_id).status === "locked" ? "kilitli dönem — yayımlanabilir" : "taslak — dönem açık"}. Sonraki adım: bölümleri inceleyin, dışa aktarın; yayım için onaylayan/yönetici.`);
    } catch (e) {
      setErr(e);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <PageHeader eyebrow={`Rapor · §22 · T19 · rol: ${ROLE_LABEL[store.role]}`} title="Raporlar ve kanıtlar" lead="Her rapor veri, hesap ve faktör kimliklerini içeren bir manifest ve SHA-256 karması taşır. Aynı girdilerle yeniden oluşturulan rapor aynı karmayı verir; sonradan değişen kaynak raporu sessizce değiştiremez. Toplamlar yalnız hesap motorunun toplama çıktısıdır." />
      <Notice kind="info">
        <p>
          Rapor paketi: yönetici özeti, sınır, dönem, yöntem, kapsam/kategori sonuçları, eksikler, kalite, karşılaştırma, kaynaklar, kanıt indeksi, GRI gereklilik indeksi ve TSRS açıklama matrisi. Dışa aktarma: JSON manifest, CSV (kayıt başına satır, formül enjeksiyonu önlenir), DOCX ve yazdırılabilir görünüm (PDF tarayıcıdan). <b>Taslak indirmek yayımlamak değildir</b>; yayım kilitli dönem ve ayrı yetki ister. Ürün çalışmaları ayrı bölümdedir, kurumsal toplama girmez.
        </p>
      </Notice>
      <ErrorBox error={err} />
      {ok && (
        <Notice kind="ok" title="Bu tarayıcıda kaydedildi">
          <p>{ok}</p>
        </Notice>
      )}
      <EngineStatus engine={engine} engineErr={engineErr} />

      <div className="card ur-no-print">
        <h2>Rapor sürümü oluştur</h2>
        {periods.length === 0 ? (
          <p className="muted">
            Dönem yok. <Link href="/kurulum/">Kurulum</Link>
          </p>
        ) : (
          <>
            <div className="field" style={{ marginBottom: "0.75rem" }}>
              <label>Kapsam 2 yöntemi (kurumsal toplamda kullanılan)</label>
              <select value={s2} onChange={(e) => setS2(e.target.value as Scope2Method)} style={{ maxWidth: 260 }}>
                {(Object.keys(SCOPE2_METHOD_LABEL) as Scope2Method[]).map((k) => (
                  <option key={k} value={k}>
                    {SCOPE2_METHOD_LABEL[k]}
                  </option>
                ))}
              </select>
              <span className="hint">Diğer yöntem raporda ayrıca gösterilir, toplanmaz (§13, §22).</span>
            </div>
            {periods.map((p) => {
              const prev = packages(store, p.id);
              return (
                <div key={p.id} className="row" style={{ marginBottom: "0.5rem" }}>
                  <span>
                    {p.start} → {p.end} <span className={`badge ${p.status === "locked" ? "accent" : "neutral"}`}>{p.status === "locked" ? "kilitli" : "açık"}</span> · {prev.length} sürüm
                  </span>
                  {prev.length > 0 && <input placeholder="Yeni sürüm nedeni (zorunlu)" value={reason} onChange={(e) => setReason(e.target.value)} style={{ maxWidth: 280 }} aria-label="Yeni sürüm nedeni" />}
                  <button className="primary" disabled={busy || !canCreate || engine !== "ready" || (prev.length > 0 && !reason.trim())} onClick={() => create(p.id, prev.length > 0)}>
                    {busy ? "Oluşturuluyor…" : prev.length ? "Yeniden oluştur (yeni sürüm)" : "Rapor paketi oluştur"}
                  </button>
                </div>
              );
            })}
          </>
        )}
        <p className="small muted">Açık dönem için üretilen rapor taslaktır; dönem kilitlenmeden yayımlanamaz. Yalnız onaylayan veya yönetici oluşturur. Motor yüklenmediyse rapor oluşturulmaz (sahte toplam yok).</p>
      </div>

      {pkgs.length === 0 && legacy.length === 0 && (
        <div className="card quiet">
          <h3>Henüz rapor yok</h3>
          <p className="small">İlk raporu yukarıdan oluşturun. Rapor için en az bir dönem gerekir; kayıt olmasa da paket oluşur ve eksikleri listeler.</p>
        </div>
      )}

      {pkgs.map((p) => (
        <PackageCard key={p.id} p={p} onError={setErr} onOk={setOk} />
      ))}

      {legacy.length > 0 && (
        <details className="card">
          <summary>Paketsiz eski rapor sürümleri ({legacy.length}) — yalnız çekirdek manifest</summary>
          {legacy.map((r) => (
            <p key={r.id} className="small">
              v{r.version} · {fmtDate(r.created_at)} · SHA-256 <span className="mono">{r.manifest_sha256.slice(0, 16)}…</span> · {r.manifest.records.length} kayıt · motor toplamı yok (paket öncesi sürüm)
            </p>
          ))}
        </details>
      )}
    </>
  );
}

function PackageCard({ p, onError, onOk }: { p: ReportPackage; onError: (e: unknown) => void; onOk: (m: string) => void }) {
  const { store } = useStore();
  const [note, setNote] = useState("");
  const m = p.manifest;
  const c = m.aggregate.corporate;
  const pubs = publications(store!, p.id);
  const asr = assurances(store!, p.id);
  const index = reportingIndex(reportingMaps(), m, { assurance: asr.length > 0 });
  const prev = p.supersedes ? packages(store!).find((x) => x.id === p.supersedes) : null;
  const same = prev ? prev.package_sha256 === p.package_sha256 : null;
  const period = store!.period(p.period_id);
  const canPublish = can(store!.role, "urun-rapor.report.publish");
  const published = pubs.length > 0;
  const s2 = c.scope2_method ? SCOPE2_METHOD_LABEL[c.scope2_method as Scope2Method] ?? c.scope2_method : "—";

  const exp = (format: "json" | "csv" | "docx", fn: () => void) => {
    try {
      fn();
    } catch (e) {
      onError(e);
    }
  };
  const exportJson = () =>
    exp("json", () => {
      downloadBlob(JSON.stringify({ package_id: p.id, report_id: p.report_id, version: p.report_version, package_sha256: p.package_sha256, core_manifest_sha256: p.core_manifest_sha256, published, manifest: m }, null, 2), `koza-rapor-v${p.report_version}.json`, "application/json");
      recordExport(store!, p.id, "json");
    });
  const exportCsv = () =>
    exp("csv", () => {
      const { text, sanitized } = buildCsv(m);
      downloadBlob(text, `koza-rapor-v${p.report_version}-kayitlar.csv`, "text/csv;charset=utf-8");
      recordExport(store!, p.id, "csv", sanitized);
      if (sanitized) onOk(`CSV indirildi; ${sanitized} hücre formül enjeksiyonuna karşı tek tırnakla metne zorlandı (CSV_EXPORT_SANITIZED, §25). Veri değişmedi.`);
    });
  const exportDocx = () =>
    exp("docx", () => {
      const sections = packageSections(m, { publications: pubs, assurances: asr, index, report_id: p.report_id, report_version: p.report_version, package_sha256: p.package_sha256 });
      const bytes = buildDocxBytes(`${m.tenant.name} — Sera gazı raporu ${m.period.start} → ${m.period.end}${published ? "" : " (TASLAK)"}`, sections);
      downloadBlob(bytes, `koza-rapor-v${p.report_version}.docx`, "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
      recordExport(store!, p.id, "docx");
    });

  return (
    <div className="card">
      <div className="spread">
        <h2>
          Rapor v{p.report_version} · {m.period.start} → {m.period.end}
        </h2>
        <span>
          {published ? <span className="badge accent">yayımlandı</span> : <span className="badge neutral">taslak — yayımlanmadı</span>} {period.status === "locked" ? <span className="badge ok">dönem kilitli</span> : <span className="badge warn">dönem açık</span>}
        </span>
      </div>
      <dl className="kv">
        <dt>Oluşturma</dt>
        <dd>
          {fmtDate(p.created_at)} · {p.created_by} {p.reason && `· neden: ${p.reason}`}
        </dd>
        <dt>Paket SHA-256</dt>
        <dd className="mono small">
          {p.package_sha256}
          {same === true && <span className="badge ok">önceki sürümle aynı (T19)</span>}
          {same === false && <span className="badge warn">önceki sürümden farklı</span>}
        </dd>
        <dt>Çekirdek manifest SHA-256</dt>
        <dd className="mono small">{p.core_manifest_sha256}</dd>
        <dt>Toplam (motor)</dt>
        <dd className="num">
          <b>{kgToT(c.total_kg)} t CO₂e</b> — {c.label_tr}
          <div className="small muted">
            Kapsam 1 {kgToT(c.scope1_kg)} · Kapsam 2 ({s2}) {kgToT(c.scope2_kg)}
            {c.scope2_alternative_kg !== undefined && c.scope2_alternative_kg !== null && ` · diğer yöntem ${kgToT(c.scope2_alternative_kg)} (toplanmaz)`} · Kapsam 3 {kgToT(c.scope3_kg)} · motor {m.engine_version}
          </div>
          <div className="small muted">
            Çapraz kontrol (depo, yalnız onaylı Kapsam 1 satırlarının tam ondalık toplamı): {kgToT(m.core.totals.approved_co2e_kg)} t · onaylı {m.core.totals.approved_record_count} · onaysız {m.core.totals.non_approved_record_count} · hesapsız {m.core.totals.blocked_record_count} · kaynak {m.core.sources_with_records}/{m.core.sources_expected}
          </div>
        </dd>
        <dt>Kalite</dt>
        <dd className="small">
          tahmini pay (sayı) {fmtDec(m.quality.estimated_share_by_count)} · (kg) {fmtDec(m.quality.estimated_share_by_kg)} · bilinmiyor {m.quality.unknown_count} · uygulanmaz {m.quality.not_applicable_count} · kanıtsız {m.quality.evidence_missing_count}
        </dd>
        <dt>Ürün çalışmaları</dt>
        <dd className="small">{m.product_studies.length ? `${m.product_studies.length} çalışma ayrı bölümde — kurumsal toplama dahil değil` : "yok"}</dd>
      </dl>

      <ReportPackageView p={p} publications={pubs} assurances={asr} index={index} mode="screen" />

      <details className="ur-section">
        <summary>Kayıtlar ({m.core.records.length})</summary>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Kayıt</th>
                <th>v</th>
                <th>Durum</th>
                <th>Kapsam</th>
                <th>Koşu</th>
                <th>Faktör</th>
                <th>CO₂e (t)</th>
                <th>Kapsama</th>
                <th>Nitelik</th>
              </tr>
            </thead>
            <tbody>
              {m.records_detail.map((x) => (
                <tr key={x.record_id}>
                  <td>
                    <Link href={`/kayit/?id=${x.record_id}`} className="mono small">
                      {x.record_id.slice(0, 12)}
                    </Link>
                  </td>
                  <td className="num">{x.version}</td>
                  <td>{x.state}</td>
                  <td>{x.scope ?? "—"}{x.category ? ` / kat. ${x.category}` : ""}</td>
                  <td className="mono small">{x.run_id?.slice(0, 10) ?? "—"}</td>
                  <td className="small">{x.factor_refs || "—"}</td>
                  <td className="num">{kgToT(x.total_co2e_kg)}</td>
                  <td>{x.coverage ?? "—"}</td>
                  <td>
                    {x.data_quality}
                    {x.quantity_state === "unknown" && " · bilinmiyor"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>

      <div className="ur-exports ur-no-print">
        <button onClick={exportJson}>JSON manifest</button>
        <button onClick={exportCsv}>CSV (kayıt başına satır)</button>
        <button onClick={exportDocx}>DOCX</button>
        <Link className="btn" href={`/raporlar/yazdir/?id=${p.id}`}>
          Yazdır / PDF görünümü
        </Link>
        <span className="small muted">İndirmek yayımlamak değildir.</span>
      </div>

      <div className="grid-2 ur-no-print" style={{ marginTop: "0.75rem" }}>
        <div className="card quiet">
          <h3>Yayım (ayrı yetkili işlem)</h3>
          {published ? (
            <ul className="small">
              {pubs.map((x) => (
                <li key={x.id}>
                  {fmtDate(x.created_at)} · {x.created_by} · paket <span className="mono">{x.package_sha256.slice(0, 12)}…</span> {x.note && `· ${x.note}`}
                </li>
              ))}
            </ul>
          ) : (
            <>
              <p className="small">Yayım için dönem kilitli olmalı ve rol onaylayan/yönetici olmalı; denetim izine yazılır.</p>
              <div className="row">
                <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="yayım notu (isteğe bağlı)" style={{ maxWidth: 280 }} />
                <button
                  className="primary"
                  disabled={!canPublish || period.status !== "locked"}
                  onClick={() => {
                    try {
                      const pub = publishPackage(store!, p.id, note.trim() || null);
                      setNote("");
                      onOk(`Rapor v${p.report_version} yayımlandı (${pub.id}); denetim izine yazıldı. Yayım kaydı değişmez.`);
                    } catch (e) {
                      onError(e);
                    }
                  }}
                >
                  Yayımla
                </button>
              </div>
              {period.status !== "locked" && <p className="small muted">Dönem açık: PUBLISH_REQUIRES_LOCKED_PERIOD.</p>}
            </>
          )}
        </div>
        <AssuranceSlot p={p} list={asr} onError={onError} onOk={onOk} />
      </div>
    </div>
  );
}

function AssuranceSlot({ p, list, onError, onOk }: { p: ReportPackage; list: Assurance[]; onError: (e: unknown) => void; onOk: (m: string) => void }) {
  const { store } = useStore();
  const canAttach = can(store!.role, "urun-rapor.assurance.attach");
  const [f, setF] = useState({ provider: "", file_name: "", sha256: "", scope: "", opinion: "unqualified" as Assurance["opinion"], opinion_text: "", level: "limited" as Assurance["level"] });
  return (
    <div className="card quiet">
      <h3>Bağımsız güvence (isteğe bağlı)</h3>
      {list.length > 0 ? (
        <ul className="small">
          {list.map((a) => (
            <li key={a.id}>
              <b>{a.provider}</b> · {a.file_name} · <span className="mono">{a.sha256.slice(0, 16)}…</span> · kapsam: {a.scope} · görüş: {a.opinion} ({a.level}) {a.opinion_text && `· ${a.opinion_text}`}
            </li>
          ))}
        </ul>
      ) : (
        <p className="small">Güvence raporu eklenmemiş. Platform kendi kendine güvence etiketi veremez; yalnız bağımsız sağlayıcının dosyası (ad + SHA-256), kapsamı ve görüşü kaydedilir.</p>
      )}
      {canAttach && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            try {
              const a = attachAssurance(store!, p.id, f);
              onOk(`Güvence kaydı eklendi: ${a.provider}; dosya karması ${a.sha256.slice(0, 12)}…`);
              setF({ ...f, provider: "", file_name: "", sha256: "", scope: "", opinion_text: "" });
            } catch (err) {
              onError(err);
            }
          }}
        >
          <div className="field">
            <label>Güvence sağlayıcı (bağımsız)</label>
            <input value={f.provider} onChange={(e) => setF({ ...f, provider: e.target.value })} required />
          </div>
          <div className="field">
            <label>Güvence raporu dosyası (yalnız karma saklanır)</label>
            <input
              type="file"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                const sha = await sha256Hex(await file.arrayBuffer());
                setF((x) => ({ ...x, file_name: file.name, sha256: sha }));
              }}
            />
            {f.sha256 && (
              <span className="hint mono">
                {f.file_name} · {f.sha256}
              </span>
            )}
          </div>
          <div className="field">
            <label>Kapsam (rapordan aynen)</label>
            <input value={f.scope} onChange={(e) => setF({ ...f, scope: e.target.value })} required placeholder="ör. Kapsam 1 ve 2, 2026 dönemi" />
          </div>
          <div className="field">
            <label>Görüş ve düzey</label>
            <div className="row">
              <select value={f.opinion} onChange={(e) => setF({ ...f, opinion: e.target.value as Assurance["opinion"] })} style={{ maxWidth: 170 }}>
                <option value="unqualified">olumlu (şartsız)</option>
                <option value="qualified">şartlı</option>
                <option value="adverse">olumsuz</option>
                <option value="disclaimer">görüş bildirmekten kaçınma</option>
                <option value="other">diğer</option>
              </select>
              <select value={f.level} onChange={(e) => setF({ ...f, level: e.target.value as Assurance["level"] })} style={{ maxWidth: 150 }}>
                <option value="limited">sınırlı güvence</option>
                <option value="reasonable">makul güvence</option>
                <option value="unknown">bilinmiyor</option>
              </select>
              <input value={f.opinion_text} onChange={(e) => setF({ ...f, opinion_text: e.target.value })} placeholder="görüş metni özeti" />
            </div>
          </div>
          <div className="actions">
            <button type="submit" disabled={!f.sha256}>
              Güvence kaydı ekle
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
