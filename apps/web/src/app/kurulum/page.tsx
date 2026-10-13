"use client";
import Link from "next/link";
import { useState } from "react";
import { PROFILES, profileById, suggestProfile, type Profile } from "@/lib/content";
import { SOURCE_TYPE_LABEL, type SourceType } from "@/lib/domain";
import { useStore } from "@/lib/useStore";
import { ErrorBox, Loading, Notice } from "@/components/ui";

const STEPS = ["Kurum ve profil", "Tesisler", "Dönem ve sınır", "Kaynak envanteri", "İlk görev"];

export default function Kurulum() {
  const { store, ready } = useStore();
  const [stepOverride, setStepOverride] = useState<number | null>(null);
  const [err, setErr] = useState<unknown>(null);
  if (!ready || !store) return <Loading />;
  const tenant = store.tenant;
  // Kaldığı adımdan devam (§06): adım depoda tutulur; geçici üst yazma yalnız bu oturum içindir
  const step = stepOverride ?? (tenant ? store.getSetupStep() : 0);
  const go = (s: number) => {
    setErr(null);
    setStepOverride(s);
    if (store.session.tenant_id) store.setSetupStep(s);
  };

  return (
    <>
      <h1>Kurum kurulumu</h1>
      <p className="muted">ONB-01 … ONB-03, SEK-01/03/05. Geri dönülen kurulum kaldığı adımdan devam eder (§06).</p>
      <ol className="steps">
        {STEPS.map((s, i) => (
          <li key={s} aria-current={i === step ? "step" : undefined} className={i < step ? "done" : ""}>
            {i + 1}. {s}
          </li>
        ))}
      </ol>
      <ErrorBox error={err} />
      {step === 0 && <StepOrg store={store} onDone={() => go(1)} setErr={setErr} />}
      {step === 1 && tenant && <StepFacilities store={store} onDone={() => go(2)} onBack={() => go(0)} setErr={setErr} />}
      {step === 2 && tenant && <StepPeriod store={store} onDone={() => go(3)} onBack={() => go(1)} setErr={setErr} />}
      {step === 3 && tenant && <StepSources store={store} onDone={() => go(4)} onBack={() => go(2)} setErr={setErr} />}
      {step === 4 && tenant && <StepFirst store={store} onBack={() => go(3)} />}
      {step > 0 && !tenant && <Notice kind="warn"><p>Kurum seçili değil. Üst çubuktan kurum seçin veya 1. adımda yeni kurum oluşturun.</p></Notice>}
    </>
  );
}

type S = NonNullable<ReturnType<typeof useStore>["store"]>;

function StepOrg({ store, onDone, setErr }: { store: S; onDone: () => void; setErr: (e: unknown) => void }) {
  const t = store.tenant;
  const [name, setName] = useState(t?.name ?? "");
  const [country, setCountry] = useState(t?.country ?? "TR");
  const [nace, setNace] = useState(t?.nace_code ?? "");
  const [unknownNace, setUnknownNace] = useState(false);
  const [chosen, setChosen] = useState<string>(t?.profile_id ?? "");
  const suggestion = suggestProfile(unknownNace ? "" : nace);
  const selected: Profile | undefined = profileById(chosen || suggestion.profile.id);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        setErr(null);
        try {
          if (!name.trim()) throw new Error("Kurum adı zorunlu: kayıtlar ve raporlar bu ada bağlanır.");
          const p = selected ?? suggestion.profile;
          if (!t) store.createTenant({ name, country, nace_code: unknownNace ? null : nace || null, profile_id: p.id, profile_version: p.version });
          store.confirmProfile(p.id, p.version);
          if (p.id === "genel" && !unknownNace && nace) {
            store.createTask({ title: `Eksik sektör profili: NACE ${nace}`, detail: "Uygun profil yok; genel profille başlandı. İçerik ekibi profil hazırlamalı (SEK-05).", kind: "content", related_record_id: null, requirement_ids: ["SEK-05"] });
          }
          onDone();
        } catch (ex) {
          setErr(ex);
        }
      }}
    >
      <fieldset>
        <legend>Kurum (ONB-01)</legend>
        <div className="field">
          <label htmlFor="name">Kurum adı</label>
          <input id="name" value={name} onChange={(e) => setName(e.target.value)} required disabled={!!t} />
          <span className="hint">Zorunlu: her kayıt ve rapor bu kuruma bağlanır; ekranlarda aktif kurum görünür (§04).</span>
        </div>
        <div className="field">
          <label htmlFor="country">Ülke</label>
          <select id="country" value={country} onChange={(e) => setCountry(e.target.value)} disabled={!!t}>
            <option value="TR">Türkiye</option>
            <option value="DE">Almanya</option>
            <option value="OTHER">Diğer</option>
          </select>
        </div>
        <div className="field">
          <label htmlFor="nace">Faaliyet alanı — NACE kodu (SEK-01)</label>
          <input id="nace" value={nace} onChange={(e) => setNace(e.target.value)} placeholder="ör. C24 veya 24.10" disabled={unknownNace || !!t} />
          <label className="small" style={{ fontWeight: 400 }}>
            <input type="checkbox" style={{ width: "auto" }} checked={unknownNace} onChange={(e) => setUnknownNace(e.target.checked)} disabled={!!t} /> NACE kodumu bilmiyorum
          </label>
          <span className="hint">NACE: Avrupa ekonomik faaliyet sınıflaması. Bilmiyorsanız genel profille başlanır; sonra değiştirilebilir.</span>
        </div>
      </fieldset>
      <fieldset>
        <legend>Sektör profili önerisi (SEK-01 / SEK-03)</legend>
        <p className="small">
          Öneri: <b>{suggestion.profile.title.tr}</b> · {suggestion.reason} Profil yalnız önerir ve önceliklendirir; kategori silmez, uygulanabilirlik kararı vermez.
        </p>
        <div className="radio-list">
          {PROFILES.map((p) => (
            <label key={p.id}>
              <input type="radio" name="profile" checked={(chosen || suggestion.profile.id) === p.id} onChange={() => setChosen(p.id)} />
              <span>
                {p.title.tr} <span className="mono small">v{p.version}</span> <span className={`badge ${p.status === "approved" ? "ok" : "warn"}`}>{p.status === "approved" ? "onaylı" : "taslak — uzman onayı bekliyor"}</span>
                <br />
                <span className="hint">NACE: {p.nace_codes.length ? p.nace_codes.join(", ") : "—"} · Öncelikli Kapsam 3: {p.scope3_priorities.join(", ")} · Payda: {p.intensity_denominators.map((d) => d.name.tr).join(", ")}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>
      <div className="actions">
        <button className="primary" type="submit">
          {t ? "Profili onayla ve devam et" : "Kurumu oluştur ve profili onayla"}
        </button>
      </div>
    </form>
  );
}

function StepFacilities({ store, onDone, onBack, setErr }: { store: S; onDone: () => void; onBack: () => void; setErr: (e: unknown) => void }) {
  const [name, setName] = useState("");
  const [city, setCity] = useState("");
  const [profile, setProfile] = useState<string>("");
  const facs = store.facilities();
  return (
    <div className="stack">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          try {
            if (!name.trim()) throw new Error("Tesis adı zorunlu.");
            store.addFacility({ name, city, profile_id: profile || null });
            setName("");
            setCity("");
          } catch (ex) {
            setErr(ex);
          }
        }}
      >
        <fieldset>
          <legend>Tesis ekle (ONB-01)</legend>
          <div className="field">
            <label htmlFor="fn">Tesis adı</label>
            <input id="fn" value={name} onChange={(e) => setName(e.target.value)} placeholder="ör. Gebze fabrikası" />
          </div>
          <div className="field">
            <label htmlFor="fc">Şehir</label>
            <input id="fc" value={city} onChange={(e) => setCity(e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="fp">Tesise özgü profil (isteğe bağlı, SEK-01)</label>
            <select id="fp" value={profile} onChange={(e) => setProfile(e.target.value)}>
              <option value="">Kurum profilini kullan</option>
              {PROFILES.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.title.tr}
                </option>
              ))}
            </select>
          </div>
          <div className="actions">
            <button type="submit">Tesisi ekle</button>
          </div>
        </fieldset>
      </form>
      <div className="card">
        <h3>Tesisler ({facs.length})</h3>
        {facs.length === 0 ? <p className="muted">Henüz tesis yok. En az bir tesis gerekir; kaynaklar tesise bağlanır.</p> : <ul>{facs.map((f) => <li key={f.id}>{f.name} {f.city && `· ${f.city}`} {f.profile_id && <span className="badge neutral">{profileById(f.profile_id)?.title.tr}</span>}</li>)}</ul>}
      </div>
      <div className="actions">
        <button onClick={onBack}>Geri</button>
        <button className="primary" disabled={facs.length === 0} onClick={onDone}>
          Devam
        </button>
      </div>
    </div>
  );
}

function StepPeriod({ store, onDone, onBack, setErr }: { store: S; onDone: () => void; onBack: () => void; setErr: (e: unknown) => void }) {
  const [start, setStart] = useState("2026-01-01");
  const [end, setEnd] = useState("2026-12-31");
  const [approach, setApproach] = useState<"operational_control" | "financial_control" | "equity_share" | "unknown">("unknown");
  const [note, setNote] = useState("");
  const periods = store.periods();
  const b = store.boundary();
  return (
    <div className="stack">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          try {
            store.addPeriod({ start, end });
          } catch (ex) {
            setErr(ex);
          }
        }}
      >
        <fieldset>
          <legend>Raporlama dönemi (ONB-01)</legend>
          <div className="row">
            <div className="field">
              <label htmlFor="ps">Başlangıç</label>
              <input id="ps" type="date" value={start} onChange={(e) => setStart(e.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="pe">Bitiş</label>
              <input id="pe" type="date" value={end} onChange={(e) => setEnd(e.target.value)} />
            </div>
          </div>
          <div className="actions">
            <button type="submit">Dönem ekle</button>
          </div>
          {periods.length > 0 && (
            <ul className="small">
              {periods.map((p) => (
                <li key={p.id}>
                  {p.start} → {p.end} <span className="badge neutral">{p.status === "open" ? "açık" : p.status === "locked" ? "kilitli" : "kapanıyor"}</span>
                </li>
              ))}
            </ul>
          )}
        </fieldset>
      </form>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          try {
            store.setBoundary({ approach, note });
          } catch (ex) {
            setErr(ex);
          }
        }}
      >
        <fieldset>
          <legend>Kuruluş ve envanter sınırı (ONB-02)</legend>
          <p className="small">Kontrol veya özkaynak payı yaklaşımı uzmanla belirlenir. Bilmiyorsanız taslak profil açılır, nihai sınıflandırma uzman görevine döner; kayıt kaybolmaz.</p>
          <div className="radio-list">
            {(
              [
                ["operational_control", "Operasyonel kontrol — işlettiğimiz tesislerin tamamı"],
                ["financial_control", "Finansal kontrol — finansal politikasını belirlediğimiz kuruluşlar"],
                ["equity_share", "Özkaynak payı — ortaklık payımız oranında"],
                ["unknown", "Bilmiyorum — uzman kararına bırak"],
              ] as const
            ).map(([v, l]) => (
              <label key={v}>
                <input type="radio" name="approach" checked={approach === v} onChange={() => setApproach(v)} /> {l}
              </label>
            ))}
          </div>
          <div className="field">
            <label htmlFor="bn">Not (kapsanan kuruluşlar, ortak girişimler, kiralamalar)</label>
            <textarea id="bn" value={note} onChange={(e) => setNote(e.target.value)} />
          </div>
          <div className="actions">
            <button type="submit">Sınırı kaydet</button>
          </div>
          {b && (
            <p className="small">
              Kayıtlı sınır v{b.version}: <b>{b.approach}</b> · durum <span className={`badge ${b.status === "pending_expert" ? "warn" : "neutral"}`}>{b.status === "pending_expert" ? "uzman kararı bekliyor" : b.status}</span>
            </p>
          )}
        </fieldset>
      </form>
      <div className="actions">
        <button onClick={onBack}>Geri</button>
        <button className="primary" disabled={periods.length === 0 || !b} onClick={onDone}>
          Devam
        </button>
      </div>
    </div>
  );
}

function StepSources({ store, onDone, onBack, setErr }: { store: S; onDone: () => void; onBack: () => void; setErr: (e: unknown) => void }) {
  const t = store.tenant!;
  const profile = profileById(t.profile_id) ?? PROFILES[0];
  const facs = store.facilities();
  const [answers, setAnswers] = useState<Record<string, "yes" | "no" | "unknown">>({});
  const [facility, setFacility] = useState(facs[0]?.id ?? "");
  const [names, setNames] = useState<Record<string, string>>({});
  const sources = store.sources();
  return (
    <div className="stack">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          try {
            for (const q of profile.onboarding_questions) {
              if (answers[q.id] === "yes") {
                const st = q.creates_source_type as SourceType;
                store.addSource({ facility_id: facility, name: names[q.id] || SOURCE_TYPE_LABEL[st] || st, source_type: st, fuel: st === "stationary_combustion" ? "natural_gas" : null, control: "owned", created_from: "onboarding" });
              }
              if (answers[q.id] === "unknown") {
                store.createTask({ title: `Kaynak envanteri sorusu yanıtsız: "${q.text.tr}"`, detail: "Bilinmeyen yanıt kaynak yaratmaz ve silmez; ilgili departmanla doğrulanmalı (ONB-03).", kind: "missing_info", related_record_id: null, requirement_ids: ["ONB-03"] });
              }
            }
            onDone();
          } catch (ex) {
            setErr(ex);
          }
        }}
      >
        <fieldset>
          <legend>Kaynak envanteri soruları (ONB-03) — profil: {profile.title.tr} v{profile.version}</legend>
          <p className="small">Sorular sektör profilinden gelir (SEK-02). Cevaplar kaynak envanterini oluşturur; hiçbir kategori otomatik silinmez.</p>
          <div className="field">
            <label htmlFor="fac">Tesis</label>
            <select id="fac" value={facility} onChange={(e) => setFacility(e.target.value)}>
              {facs.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </select>
          </div>
          {profile.onboarding_questions.map((q) => (
            <div key={q.id} className="field">
              <label>{q.text.tr}</label>
              <div className="row">
                {(["yes", "no", "unknown"] as const).map((v) => (
                  <label key={v} className="small" style={{ fontWeight: 400 }}>
                    <input type="radio" style={{ width: "auto" }} name={q.id} checked={answers[q.id] === v} onChange={() => setAnswers({ ...answers, [q.id]: v })} /> {v === "yes" ? "Evet" : v === "no" ? "Hayır" : "Bilmiyorum"}
                  </label>
                ))}
              </div>
              {answers[q.id] === "yes" && (
                <input placeholder={`Kaynak adı (ör. ${q.creates_source_type === "stationary_combustion" ? "Ana kazan — doğal gaz" : SOURCE_TYPE_LABEL[q.creates_source_type as SourceType] ?? q.creates_source_type})`} value={names[q.id] ?? ""} onChange={(e) => setNames({ ...names, [q.id]: e.target.value })} />
              )}
              <span className="hint">
                Oluşturacağı kaynak türü: {SOURCE_TYPE_LABEL[q.creates_source_type as SourceType] ?? q.creates_source_type}
                {q.creates_source_type !== "stationary_combustion" && " — bu türde veri girişi sonraki dilimlerde (envanterde 'veri girişi henüz yok' olarak görünür)"}
              </span>
            </div>
          ))}
          <div className="actions">
            <button className="primary" type="submit">
              Kaynakları oluştur ve devam et
            </button>
          </div>
        </fieldset>
      </form>
      {sources.length > 0 && (
        <div className="card">
          <h3>Mevcut kaynaklar ({sources.length})</h3>
          <ul className="small">
            {sources.map((s) => (
              <li key={s.id}>
                {s.name} · {SOURCE_TYPE_LABEL[s.source_type]} {s.fuel && `· ${s.fuel}`}
              </li>
            ))}
          </ul>
        </div>
      )}
      <div className="actions">
        <button onClick={onBack}>Geri</button>
        <button onClick={onDone}>Soruları atla (kaynak eklemeden devam)</button>
      </div>
    </div>
  );
}

function StepFirst({ store, onBack }: { store: S; onBack: () => void }) {
  const ng = store.sources().filter((s) => s.source_type === "stationary_combustion" && s.fuel === "natural_gas");
  return (
    <div className="stack">
      <div className="card">
        <h2>İlk görev</h2>
        <p>
          Sistem bir <b>eğitim kaydı</b> veya gerçek doğal gaz faturasıyla başlamayı önerir (§06). Eğitim kaydı açıkça etiketlenir ve hiçbir zaman üretim toplamına eklenmez.
        </p>
        {ng.length === 0 ? (
          <Notice kind="warn">
            <p>Doğal gaz yakan kaynak tanımlı değil. Bu önizlemede yalnız sabit yakma / doğal gaz kaydı desteklenir (Dilim 1). Geri dönüp "Yakıt yakan ekipman var mı?" sorusuna evet deyin.</p>
          </Notice>
        ) : (
          <div className="actions">
            <Link className="btn primary" href="/veri-girisi/?training=1">
              Eğitim kaydıyla başla
            </Link>
            <Link className="btn" href="/veri-girisi/">
              Gerçek faturayla başla
            </Link>
          </div>
        )}
        <h3>İlk ay planı (öneri, yasal süre değildir)</h3>
        <ol className="small">
          <li>Hafta 1 — kurum ve kaynak envanteri (bu adım)</li>
          <li>Hafta 2 — kanıtlı temel tüketim (doğal gaz; elektrik Dilim 2)</li>
          <li>Hafta 3 — satın alma, lojistik, atık veri talepleri (Dilim 7)</li>
          <li>Hafta 4 — uzman kontrolü ve kapanış provası (İnceleme, Dönem)</li>
        </ol>
      </div>
      <div className="actions">
        <button onClick={onBack}>Geri</button>
      </div>
    </div>
  );
}
