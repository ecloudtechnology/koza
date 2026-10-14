"use client";
import Link from "next/link";
import { useState } from "react";
import { PROFILES, profileById, suggestProfile, type Profile } from "@/lib/content";
import { SCOPE3_CATEGORIES, SOURCE_TYPE_LABEL, type SourceType } from "@/lib/domain";
import { FUELS, REFRIGERANT_GASES } from "@/modules/kayit/schemas";
import { setSourceMeta, sourceMeta } from "@/modules/kayit/store";
import { useStore } from "@/lib/useStore";
import { ErrorBox, Loading, Notice, PageHeader } from "@/components/ui";

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
      <PageHeader eyebrow="Başlangıç · ONB-01…03, SEK-01/03/05" title="Kurum kurulumu" lead="Kurum, sektör profili, tesisler, raporlama dönemi, envanter sınırı ve kaynak envanteri. Geri dönülen kurulum kaldığı adımdan devam eder (§06)." />
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
  const [extra, setExtra] = useState<Record<string, SourceExtra>>({});
  const [manual, setManual] = useState<{ type: SourceType; name: string; control: "owned" | "leased" | "unknown"; extra: SourceExtra }>({ type: "stationary_combustion", name: "", control: "owned", extra: {} });
  const sources = store.sources();

  // Tür-özgü alanlarla kaynak oluşturma: yakıt (yakma), gaz listesi (soğutucu), şebeke bölgesi (elektrik), kategori (değer zinciri)
  const createSource = (st: SourceType, name: string, control: "owned" | "leased" | "unknown", x: SourceExtra) => {
    const fuel = st === "stationary_combustion" || st === "mobile_combustion" ? (x.fuel ?? (st === "stationary_combustion" ? "natural_gas" : "diesel")) : null;
    const src = store.addSource({ facility_id: facility, name: name || SOURCE_TYPE_LABEL[st] || st, source_type: st, fuel, control, created_from: "onboarding" });
    if (st === "refrigerant" || st === "purchased_electricity" || st === "purchased_steam" || st === "purchased_heat" || st === "purchased_cooling" || st === "scope3" || st === "purchased_goods") {
      setSourceMeta(store, src.id, { gases: x.gases ?? [], grid_region: st.startsWith("purchased_") && st !== "purchased_goods" ? (x.grid_region ?? "TR") : null, scope3_category: st === "purchased_goods" ? (x.scope3_category ?? 1) : st === "scope3" ? (x.scope3_category ?? null) : null });
    }
    return src;
  };

  return (
    <div className="stack">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          try {
            if (!facility) throw new Error("Önce tesis seçin.");
            for (const q of profile.onboarding_questions) {
              if (answers[q.id] === "yes") {
                createSource(q.creates_source_type as SourceType, names[q.id] ?? "", "owned", extra[q.id] ?? {});
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
          <p className="small">Sorular sektör profilinden gelir (SEK-02). Cevaplar kaynak envanterini ve Kapsam 3 ön değerlendirmesini oluşturur; hiçbir kategori otomatik silinmez.</p>
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
          {profile.onboarding_questions.map((q) => {
            const st = q.creates_source_type as SourceType;
            return (
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
                  <>
                    <input placeholder={`Kaynak adı (ör. ${st === "stationary_combustion" ? "Ana kazan — doğal gaz" : SOURCE_TYPE_LABEL[st] ?? st})`} value={names[q.id] ?? ""} onChange={(e) => setNames({ ...names, [q.id]: e.target.value })} />
                    <SourceTypeFields st={st} value={extra[q.id] ?? {}} onChange={(x) => setExtra({ ...extra, [q.id]: x })} />
                  </>
                )}
                <span className="hint">Oluşturacağı kaynak türü: {SOURCE_TYPE_LABEL[st] ?? st} — veri girişi bu tür için hazırdır.</span>
              </div>
            );
          })}
          <div className="actions">
            <button className="primary" type="submit">
              Kaynakları oluştur ve devam et
            </button>
          </div>
        </fieldset>
      </form>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          try {
            if (!facility) throw new Error("Önce tesis seçin.");
            createSource(manual.type, manual.name, manual.control, manual.extra);
            setManual({ ...manual, name: "", extra: {} });
          } catch (ex) {
            setErr(ex);
          }
        }}
      >
        <fieldset>
          <legend>Başka kaynak ekle (soru listesinde olmayan türler)</legend>
          <div className="row">
            <div className="field">
              <label htmlFor="mt">Kaynak türü</label>
              <select id="mt" value={manual.type} onChange={(e) => setManual({ ...manual, type: e.target.value as SourceType, extra: {} })}>
                {(Object.keys(SOURCE_TYPE_LABEL) as SourceType[]).filter((k) => k !== "other" && k !== "purchased_goods").map((k) => (
                  <option key={k} value={k}>
                    {SOURCE_TYPE_LABEL[k]}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="mn">Ad</label>
              <input id="mn" value={manual.name} onChange={(e) => setManual({ ...manual, name: e.target.value })} placeholder="ör. Forklift filosu" />
            </div>
            <div className="field">
              <label htmlFor="mc">Kontrol ilişkisi</label>
              <select id="mc" value={manual.control} onChange={(e) => setManual({ ...manual, control: e.target.value as "owned" | "leased" | "unknown" })}>
                <option value="owned">Kurumun</option>
                <option value="leased">Kiralık</option>
                <option value="unknown">Bilinmiyor</option>
              </select>
            </div>
          </div>
          <SourceTypeFields st={manual.type} value={manual.extra} onChange={(x) => setManual({ ...manual, extra: x })} />
          <div className="actions">
            <button type="submit">Kaynağı ekle</button>
          </div>
        </fieldset>
      </form>
      {sources.length > 0 && (
        <div className="card">
          <h3>Mevcut kaynaklar ({sources.length})</h3>
          <ul className="small">
            {sources.map((s) => {
              const m = sourceMeta(store, s.id);
              return (
                <li key={s.id}>
                  {s.name} · {SOURCE_TYPE_LABEL[s.source_type]} {s.fuel && `· ${s.fuel}`} {m?.grid_region && `· şebeke ${m.grid_region}`} {m?.gases?.length ? `· ${m.gases.join(", ")}` : ""} {m?.scope3_category && `· kat. ${m.scope3_category}`}
                </li>
              );
            })}
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

type SourceExtra = { fuel?: string; gases?: string[]; grid_region?: string; scope3_category?: number };

function SourceTypeFields({ st, value, onChange }: { st: SourceType; value: SourceExtra; onChange: (x: SourceExtra) => void }) {
  if (st === "stationary_combustion" || st === "mobile_combustion") {
    return (
      <div className="field">
        <label>Yakıt</label>
        <select value={value.fuel ?? (st === "stationary_combustion" ? "natural_gas" : "diesel")} onChange={(e) => onChange({ ...value, fuel: e.target.value })}>
          {FUELS[st].map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>
    );
  }
  if (st === "refrigerant") {
    const gases = value.gases ?? [];
    return (
      <div className="field">
        <label>Soğutucu gazlar (ekipman etiketinden)</label>
        <div className="row">
          {REFRIGERANT_GASES.filter((g) => g.value !== "other" && g.value !== "unknown").map((g) => (
            <label key={g.value} className="check">
              <input type="checkbox" checked={gases.includes(g.value)} onChange={(e) => onChange({ ...value, gases: e.target.checked ? [...gases, g.value] : gases.filter((x) => x !== g.value) })} /> {g.label}
            </label>
          ))}
        </div>
        <span className="hint">Gaz türü bilinmiyorsa boş bırakın; kayıt girişinde "bilmiyorum" seçilir ve hesap bekler (§12).</span>
      </div>
    );
  }
  if (st === "purchased_electricity" || st === "purchased_steam" || st === "purchased_heat" || st === "purchased_cooling") {
    return (
      <div className="field">
        <label>Şebeke bölgesi (ülke/bölge)</label>
        <input value={value.grid_region ?? "TR"} onChange={(e) => onChange({ ...value, grid_region: e.target.value })} placeholder="TR" style={{ maxWidth: 160 }} />
        <span className="hint">Konum bazlı faktör bu bölgeye göre seçilir (§13).</span>
      </div>
    );
  }
  if (st === "scope3" || st === "purchased_goods") {
    return (
      <div className="field">
        <label>Kapsam 3 kategorisi</label>
        <select value={String(value.scope3_category ?? (st === "purchased_goods" ? 1 : ""))} onChange={(e) => onChange({ ...value, scope3_category: e.target.value ? Number(e.target.value) : undefined })}>
          <option value="">— seçin —</option>
          {SCOPE3_CATEGORIES.map((c) => (
            <option key={c.n} value={c.n}>
              {c.n} — {c.tr}
            </option>
          ))}
        </select>
        <span className="hint">Kategori yalnız bu kaynağın varsayılanıdır; her kayıtta seçilir ve kategori değerlendirmesi envanterde tutulur (T10).</span>
      </div>
    );
  }
  return null;
}

function StepFirst({ store, onBack }: { store: S; onBack: () => void }) {
  const ng = store.sources();
  return (
    <div className="stack">
      <div className="card">
        <h2>İlk görev</h2>
        <p>
          Sistem bir <b>eğitim kaydı</b> veya gerçek doğal gaz faturasıyla başlamayı önerir (§06). Eğitim kaydı açıkça etiketlenir ve hiçbir zaman üretim toplamına eklenmez.
        </p>
        {ng.length === 0 ? (
          <Notice kind="warn">
            <p>Henüz kaynak tanımlı değil. Geri dönüp kaynak envanteri sorularını yanıtlayın; ilk görev olarak bir fatura (doğal gaz veya elektrik) kaydı önerilir.</p>
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
          <li>Hafta 2 — kanıtlı temel tüketim (doğal gaz, elektrik, diğer yakıtlar)</li>
          <li>Hafta 3 — satın alma, lojistik, atık veri talepleri (Kapsam 3, tedarikçi programı)</li>
          <li>Hafta 4 — uzman kontrolü ve kapanış provası (İnceleme, Dönem)</li>
        </ol>
      </div>
      <div className="actions">
        <button onClick={onBack}>Geri</button>
      </div>
    </div>
  );
}
