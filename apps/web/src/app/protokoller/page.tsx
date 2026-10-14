"use client";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import type { Profile } from "@/lib/content";
import { can, ROLE_LABEL } from "@/lib/domain";
import type { Store } from "@/lib/store";
import { useStore, fmtDate } from "@/lib/useStore";
import { ErrorBox, Loading, Notice, PageHeader } from "@/components/ui";
import { applicabilityOf, decideApplicability, sources, tenantProfile, userLabel, whyShown } from "@/modules/ogrenme/store";
import { APPLICABILITY_LABEL, FAMILY_FUNCTION, FAMILY_ORDER, type ApplicabilityResult, type SourceFull } from "@/modules/ogrenme/types";
import "@/modules/ogrenme/style.css";

export default function Page() {
  return (
    <Suspense fallback={<Loading />}>
      <Protokoller />
    </Suspense>
  );
}

const date = (d: string | null | undefined) => (d ? String(d).slice(0, 10) : null);
const RESULT_CLASS: Record<ApplicabilityResult, string> = { applies: "ok", not_applicable: "neutral", review_required: "warn" };

function Protokoller() {
  const { store, ready } = useStore();
  const params = useSearchParams();
  if (!ready || !store) return <Loading what="Kaynak kartları" />;
  const k = params.get("k");
  const tenant = store.tenant;
  const profile = tenantProfile(tenant);
  const all = sources();
  const families = FAMILY_ORDER.filter((f) => all.some((s) => s.family === f));
  const canDecide = can(store.role, "ogrenme.applicability.decide");

  return (
    <>
      <PageHeader eyebrow="Öğrenme · §08 · §19 · REG-01" title="Protokoller ve standartlar" lead="Her kaynağın ne işe yaradığı, kime uygulanabileceği ve hangi göreve dönüştüğü. Mevzuat, raporlama standardı, hesap protokolü ve rehber aynı türde sınıflandırılmaz; GRI etki, TSRS finansal odak, GHG Protocol hesaplama işlevi ayrı tutulur." />
      <Notice kind="info">
        <p>
          Kartlar yalnız resmî bağlantı taşır; tam metin saklanmaz (K-12). "Güncel" etiketi yoktur: her kartta <b>son başarılı kontrol</b> tarihi yazar (§08 kabul). Tarih kaynaktan doğrulanmadıysa "doğrulanmadı" görünür; tahmin yazılmaz. Uygulanabilirlik kararı kurum verisine ve kural sürümüne bağlanır; karar yetkisi: uzman kontrolör ve kurum yöneticisi.
        </p>
      </Notice>
      {!tenant && (
        <Notice kind="warn" title="Kurum seçilmedi">
          <p>
            Kartlar okunabilir; "bu bana neden gösteriliyor?" ve uygulanabilirlik kararı kurum profili ister. <Link href="/kurulum/">Kurum kurulumu</Link>.
          </p>
        </Notice>
      )}
      {tenant && profile && (
        <p className="small muted">
          Kurum: {tenant.name} · ülke {tenant.country} · profil {profile.title.tr} v{profile.version} · öncelikli Kapsam 3: {profile.scope3_priorities.join(", ") || "—"} · aday paketler: {profile.regulation_packages.map((p) => p.package_id).join(", ") || "yok"} · rol: {ROLE_LABEL[store.role]}
        </p>
      )}
      {families.map((fam) => (
        <section key={fam} className="card">
          <h2>{fam}</h2>
          <p className="small muted">{FAMILY_FUNCTION[fam]}</p>
          {all
            .filter((s) => s.family === fam)
            .map((s) => (
              <SourceCard key={s.code} s={s} store={store} profile={profile} open={k === s.code} canDecide={canDecide} />
            ))}
        </section>
      ))}
      <p className="small muted">
        Kaynak yaşam döngüsü (SRC-01…07): kayıt → planlı kontrol → sürüm/karma → madde düzeyinde fark → uzman onayı → görev. Bu önizlemede kontrol tarihi içerikten gelir; otomatik erişim kontrolü sunucu tarafında çalışır. Açık kararlar: K-06 (ulusal ETS), K-07 (CBAM kanıt formatı), K-08 (TSRS kapsamı).
      </p>
    </>
  );
}

function SourceCard({ s, store, profile, open, canDecide }: { s: SourceFull; store: Store; profile: Profile | null; open: boolean; canDecide: boolean }) {
  const tenant = store.tenant;
  const [result, setResult] = useState<ApplicabilityResult>("review_required");
  const [reason, setReason] = useState("");
  const [err, setErr] = useState<unknown>(null);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const app = tenant ? applicabilityOf(store, s.code) : null;
  const reasons = whyShown(s, tenant, profile);
  const current = s.versions.find((v) => v.current);
  const previous = s.versions.filter((v) => !v.current);

  return (
    <details className="ogr-source" id={s.code} open={open || undefined} style={{ marginTop: "0.75rem" }}>
      <summary>
        <span className="mono small">{s.code}</span> {s.title} <span className="badge warn">{s.status}</span>
        {app && <span className={`badge ${RESULT_CLASS[app.effective]}`}>{APPLICABILITY_LABEL[app.effective]}</span>}
      </summary>
      <div className="grid-2" style={{ marginTop: "0.75rem" }}>
        <div>
          <h3 style={{ marginTop: 0 }}>Kaynak kartı</h3>
          <dl className="kv">
            <dt>Yayımlayan</dt>
            <dd>{s.publisher}</dd>
            <dt>Rol (Koza'da)</dt>
            <dd>{s.role}</dd>
            <dt>Sürüm / baskı</dt>
            <dd>{s.edition ?? "kaynakta doğrulanmadı"}</dd>
            <dt>Dil</dt>
            <dd>{s.language}</dd>
            <dt>Yayın tarihi</dt>
            <dd>{date(s.published_at) ?? "kaynakta doğrulanmadı"}</dd>
            <dt>Yürürlük</dt>
            <dd>{date(s.effective_from) ?? "kaynakta doğrulanmadı / gönüllü"}</dd>
            <dt>Geçiş koşulu</dt>
            <dd>{s.transition_note ?? "—"}</dd>
            <dt>Yürürlükten kalkma</dt>
            <dd>{date(s.retired_at) ?? "—"}</dd>
            <dt>Son başarılı kontrol</dt>
            <dd>
              <b>{date(s.checked_at)}</b> <span className="small muted">(SRC-02; süresiz "güncel" etiketi verilmez)</span>
            </dd>
            <dt>Lisans</dt>
            <dd>{s.license}</dd>
            {s.identity_note && (
              <>
                <dt>Kimlik notu</dt>
                <dd>{s.identity_note}</dd>
              </>
            )}
            <dt>Resmî URL</dt>
            <dd>
              {s.urls.map((u) => (
                <div key={u}>
                  <a href={u} target="_blank" rel="noreferrer">
                    {u}
                  </a>
                </div>
              ))}
            </dd>
          </dl>
        </div>
        <div>
          <h3 style={{ marginTop: 0 }}>Bu bana neden gösteriliyor?</h3>
          {!tenant ? (
            <p className="small muted">Kurum seçilince gerekçe profilinizden türetilir.</p>
          ) : reasons.length === 0 ? (
            <p className="small">Profiliniz bu kaynağı öncelikli göstermiyor; listede genel bilgi için yer alır. Profil değişirse gerekçe yeniden hesaplanır.</p>
          ) : (
            <ul className="small">
              {reasons.map((r, i) => (
                <li key={i}>{r}</li>
              ))}
            </ul>
          )}

          <h3>Uygulanabilirlik (§08)</h3>
          {!tenant || !app ? (
            <p className="small muted">Kurum seçilince değerlendirme yapılır.</p>
          ) : (
            <>
              <p>
                <span className={`badge ${RESULT_CLASS[app.effective]}`}>{APPLICABILITY_LABEL[app.effective]}</span>{" "}
                {app.current ? (
                  <span className="small">
                    {app.current.reason} — kural sürümü {app.current.rule_version} · {userLabel(app.current.decided_by)} · {fmtDate(app.current.decided_at)} · kullanılan veri: profil {app.current.inputs.profile_id} v{app.current.inputs.profile_version}, ülke {app.current.inputs.country}
                  </span>
                ) : (
                  <span className="small">{app.note}</span>
                )}
              </p>
              {app.stale && <Notice kind="warn"><p>{app.note}</p></Notice>}
              {app.history.length > 1 && (
                <p className="small">
                  <button type="button" onClick={() => setShowHistory(!showHistory)}>{showHistory ? "Geçmişi gizle" : `Karar geçmişi (${app.history.length})`}</button>
                </p>
              )}
              {showHistory && (
                <ul className="small">
                  {app.history.map((h) => (
                    <li key={h.id}>
                      {fmtDate(h.decided_at)} · {APPLICABILITY_LABEL[h.result]} · {h.reason} · kural {h.rule_version} · {userLabel(h.decided_by)}
                    </li>
                  ))}
                </ul>
              )}
              <ErrorBox error={err} />
              {savedAt && (
                <Notice kind="ok" title="Karar kaydedildi">
                  <p>Bu tarayıcıda kaydedildi ({savedAt}). Önceki kararlar geçmişte korunur; sonraki adım: ilgili regülasyon paketi veya rapor haritası.</p>
                </Notice>
              )}
              {canDecide ? (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    setErr(null);
                    try {
                      const row = decideApplicability(store, { source_code: s.code, result, reason });
                      setSavedAt(fmtDate(row.decided_at));
                      setReason("");
                    } catch (ex) {
                      setErr(ex);
                    }
                  }}
                >
                  <div className="field">
                    <label htmlFor={`res-${s.code}`}>Karar</label>
                    <select id={`res-${s.code}`} value={result} onChange={(e) => setResult(e.target.value as ApplicabilityResult)}>
                      <option value="applies">Uygulanır</option>
                      <option value="not_applicable">Uygulanmaz</option>
                      <option value="review_required">İnceleme gerekli</option>
                    </select>
                  </div>
                  <div className="field">
                    <label htmlFor={`rsn-${s.code}`}>Gerekçe (hangi kurum verisine dayanıyor?)</label>
                    <textarea id={`rsn-${s.code}`} value={reason} onChange={(e) => setReason(e.target.value)} rows={2} placeholder="ör. Kurum AB'ye ihracat yapmıyor (satış verisi, finans onayı)." />
                    <span className="hint">Gerekçesiz karar kaydedilmez. Eşik ve tarihler kaynaktan doğrulanmadıysa 'inceleme gerekli' seçin (kural 6). GRI konu seçimi ile bir kategorinin veri eksikliği birbirinin yerine kullanılamaz.</span>
                  </div>
                  <div className="actions">
                    <button className="primary" type="submit">Kararı kaydet</button>
                  </div>
                </form>
              ) : (
                <p className="small muted">Karar yetkisi: uzman kontrolör veya kurum yöneticisi (rolünüz: {ROLE_LABEL[store.role]}).</p>
              )}
            </>
          )}
        </div>
      </div>
      {s.versions.length > 0 && (
        <div style={{ marginTop: "1rem" }}>
          <h3>Sürümler — güncel ve önceki yan yana</h3>
          <div className="ogr-versions">
            {current && <VersionBox v={current} />}
            {previous.map((v) => (
              <VersionBox key={v.label} v={v} />
            ))}
            {previous.length === 0 && <div className="ver"><p className="small muted">Önceki sürüm kaydı yok; değişiklik kaynak izlemeyle eklenir.</p></div>}
          </div>
        </div>
      )}
    </details>
  );
}

function VersionBox({ v }: { v: SourceFull["versions"][number] }) {
  return (
    <div className={`ver ${v.current ? "current" : ""}`}>
      <div className="row">
        <b>{v.label}</b> {v.current ? <span className="badge accent">güncel</span> : <span className="badge neutral">önceki</span>}
      </div>
      <dl className="kv small" style={{ marginTop: "0.4rem" }}>
        <dt>Baskı</dt>
        <dd>{v.edition ?? "doğrulanmadı"}</dd>
        <dt>Yayın</dt>
        <dd>{date(v.published_at) ?? "kaynakta doğrulanmadı"}</dd>
        <dt>Yürürlük</dt>
        <dd>{date(v.effective_from) ?? "doğrulanmadı / gönüllü"}</dd>
        <dt>Bağlantı</dt>
        <dd>
          {v.url ? (
            <a href={v.url} target="_blank" rel="noreferrer">
              resmî metin
            </a>
          ) : (
            "resmî URL doğrulanmadı"
          )}
        </dd>
      </dl>
      <p className="small" style={{ marginTop: "0.4rem" }}>{v.note}</p>
    </div>
  );
}
