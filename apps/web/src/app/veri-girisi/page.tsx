"use client";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";
import { SCOPE3_CATEGORIES, type DataQuality, type Evidence, type ValueState } from "@/lib/domain";
import { useStore } from "@/lib/useStore";
import { ErrorBox, Loading, NoTenant, Notice, PageHeader } from "@/components/ui";
import { parseQuantity } from "@/lib/quantity";
import { explain } from "@/lib/errors";
import { StoreError } from "@/lib/store";
import { DQ_DIMS, ENTRY_KINDS, INSTRUMENT_TYPES, MTH_STEPS, fieldVisible, getPath, schemaOf, setPath, unitFamily, type EntryKind, type FieldSpec, type Instrument, type RecordSchema } from "@/modules/kayit/schemas";
import { categoryAssessments, createKayitRecord, sourceMeta } from "@/modules/kayit/store";
import { clearAssistantSuggestions, extractCandidates, LOW_CONFIDENCE, OcrError, readAssistantSuggestions, recognize, type Candidate, type OcrOutput } from "@/modules/kayit/ocr";
import "@/modules/kayit/style.css";

export default function Page() {
  return (
    <Suspense fallback={<Loading />}>
      <VeriGirisi />
    </Suspense>
  );
}

function clone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v)) as T;
}

function VeriGirisi() {
  const { store, ready } = useStore();
  const router = useRouter();
  const params = useSearchParams();
  const training = params.get("training") === "1";
  const [kindId, setKindId] = useState<string>(params.get("tur") ?? "invoice");
  const [schemaKey, setSchemaKey] = useState<string>(params.get("sema") ?? "stationary_combustion");
  const [err, setErr] = useState<unknown>(null);
  // ortak alanlar (§11)
  const [sourceId, setSourceId] = useState("");
  const [periodId, setPeriodId] = useState("");
  const [ps, setPs] = useState("2026-01-01");
  const [pe, setPe] = useState("2026-01-31");
  const [qRaw, setQRaw] = useState("");
  const [decSep, setDecSep] = useState<"," | "." | null>(null);
  const [qUnknown, setQUnknown] = useState(false);
  const [unit, setUnit] = useState<string>("");
  const [basis, setBasis] = useState<"LHV" | "HHV" | "">("");
  const [refT, setRefT] = useState("");
  const [refP, setRefP] = useState("101.325");
  const [cvOn, setCvOn] = useState(false);
  const [cv, setCv] = useState({ value: "", unit: "MJ/m3", basis: "LHV" as "LHV" | "HHV", source_ref: "" });
  const [dq, setDq] = useState<DataQuality>("measured");
  const [dataSource, setDataSource] = useState("invoice");
  const [responsible, setResponsible] = useState("");
  const [invoice, setInvoice] = useState("");
  const [supplier, setSupplier] = useState("");
  const [note, setNote] = useState("");
  const [evs, setEvs] = useState<Evidence[]>([]);
  const [dupEv, setDupEv] = useState<Evidence[]>([]);
  const [dupReason, setDupReason] = useState("");
  const [busy, setBusy] = useState(false);
  // türe özgü alanlar
  const [detail, setDetail] = useState<Record<string, unknown>>({});
  const [unknownFields, setUnknownFields] = useState<string[]>([]);
  // OCR + asistan adayları
  const files = useRef(new Map<string, File>());
  const [ocr, setOcr] = useState<{ state: "idle" | "loading" | "done" | "error"; progress: string; out: OcrOutput | null; error: string }>({ state: "idle", progress: "", out: null, error: "" });
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [assistant, setAssistant] = useState<Candidate[]>([]);
  const [transferred, setTransferred] = useState<string[]>([]);

  useEffect(() => {
    // Asistan önerisi (sessionStorage) yalnız istemcide ve boyama sonrası okunur; forma yazılmaz, aday olarak gösterilir.
    const t = setTimeout(() => setAssistant(readAssistantSuggestions()), 0);
    return () => clearTimeout(t);
  }, []);

  if (!ready || !store) return <Loading />;
  if (!store.tenant) return <NoTenant />;

  const kind: EntryKind = ENTRY_KINDS.find((k) => k.id === kindId) ?? ENTRY_KINDS[0];
  const schema: RecordSchema | undefined = schemaOf(kind.schemas.includes(schemaKey as RecordSchema["key"]) ? schemaKey : kind.schemas[0]);
  const allSources = store.sources();
  const sources = schema ? allSources.filter((s) => schema.source_types.includes(s.source_type)) : [];
  const periods = store.periods().filter((p) => p.status !== "locked");
  const q = parseQuantity(qRaw, decSep);
  const sid = sources.some((s) => s.id === sourceId) ? sourceId : (sources[0]?.id ?? "");
  const pid = periodId || periods[0]?.id || "";
  const fam = unitFamily(unit);
  const unitOk = schema ? schema.units.some((u) => u.value === unit) : false;
  const effUnit = unitOk ? unit : "";
  const source = sources.find((s) => s.id === sid);

  const pickKind = (k: EntryKind) => {
    setKindId(k.id);
    setSchemaKey(k.schemas[0]);
    setDetail({});
    setUnknownFields([]);
    setUnit("");
  };
  const pickSchema = (key: string) => {
    setSchemaKey(key);
    setDetail({});
    setUnknownFields([]);
    setUnit("");
  };
  const setField = (key: string, value: unknown) => {
    setDetail((d) => {
      const n = clone(d);
      setPath(n, key, value);
      return n;
    });
  };
  const toggleUnknown = (key: string, on: boolean) => {
    setUnknownFields((u) => (on ? Array.from(new Set([...u, key])) : u.filter((x) => x !== key)));
    if (on) setField(key, null);
  };

  const transfer = (c: Candidate) => {
    switch (c.key) {
      case "invoice_no":
        setInvoice(c.value);
        break;
      case "supplier":
        setSupplier(c.value);
        break;
      case "period_start":
        setPs(c.value);
        break;
      case "period_end":
        setPe(c.value);
        break;
      case "quantity":
        setQRaw(c.raw.match(/\d[\d.,]*/)?.[0] ?? c.value);
        setDecSep(null);
        setQUnknown(false);
        break;
      case "unit":
        if (schema?.units.some((u) => u.value === c.value)) setUnit(c.value);
        else setErr(new StoreError("VALIDATION", `Birim '${c.value}' bu kayıt türünde (${schema?.title}) kullanılamaz; birimi elle seçin.`, 422));
        break;
      case "calorific_value":
        setCvOn(true);
        setCv((x) => ({ ...x, value: c.value }));
        break;
      case "calorific_unit":
        setCvOn(true);
        setCv((x) => ({ ...x, unit: c.value }));
        break;
    }
    setTransferred((t) => [...t, `${c.key}:${c.value}`]);
    if (assistant.includes(c)) {
      const rest = assistant.filter((x) => x !== c);
      setAssistant(rest);
      if (!rest.length) clearAssistantSuggestions();
    }
  };

  const runOcr = async (ev: Evidence) => {
    const f = files.current.get(ev.id);
    if (!f) {
      setOcr({ state: "error", progress: "", out: null, error: "Dosya bu oturumda bellekte değil; yeniden yükleyin (önizlemede içerik saklanmaz)." });
      return;
    }
    setOcr({ state: "loading", progress: "başlıyor", out: null, error: "" });
    try {
      const out = await recognize(f, (status, progress) => setOcr((o) => ({ ...o, progress: `${status} ${Math.round(progress * 100)}%` })));
      setOcr({ state: "done", progress: "", out, error: "" });
      setCandidates(extractCandidates(out.text, out.words));
    } catch (e) {
      const msg = e instanceof OcrError ? e.message : String((e as Error)?.message ?? e);
      setOcr({ state: "error", progress: "", out: null, error: msg });
      setCandidates([]);
    }
  };

  const save = () => {
    setErr(null);
    try {
      if (!schema) throw new StoreError("VALIDATION", "Kayıt türü seçilmedi.", 422);
      if (!sid || !source) throw new StoreError("VALIDATION", `Bu kayıt türü için kaynak yok (${schema.source_types.join(", ")}); kurulumda kaynak envanterine ekleyin.`, 422);
      if (!pid) throw new StoreError("VALIDATION", "Açık raporlama dönemi yok; kurulumda dönem ekleyin.", 422);
      if (!(ps <= pe)) throw new StoreError("VALIDATION", "Dönem bitişi başlangıçtan önce olamaz.", 422);
      if (!qUnknown && q.error) throw new StoreError("VALIDATION", q.error, 422);
      if (!qUnknown && q.ambiguous) throw new StoreError("VALIDATION", "Miktar ayracı belirsiz; hangi okumanın doğru olduğunu seçin.", 422);
      if (!qUnknown && q.value === null) throw new StoreError("VALIDATION", "Miktar boş. Bilmiyorsanız 'miktarı bilmiyorum' işaretleyin; taslak korunur ve görev açılır (T20).", 422);
      const quantity_state: ValueState = qUnknown ? "unknown" : "known";
      const d = clone(detail);
      d.data_source = dataSource;
      d.responsible = responsible || null;
      // Kaynakta tanımlı yakıt, kullanıcı değiştirmediyse varsayılandır (kaynak envanteri → kayıt)
      if (getPath(d, "fuel") === undefined && source?.fuel && schema.fields.some((f) => f.key === "fuel")) setPath(d, "fuel", source.fuel);
      if (fam === "energy" && schema.scope === 1 && !basis) {
        // "bilmiyorum" → esas null; depo görev açar (T20)
      }
      const r = createKayitRecord(store, {
        schema_key: schema.key,
        version: {
          change_reason: null,
          source_id: sid,
          period_id: pid,
          period_start: ps,
          period_end: pe,
          quantity: qUnknown ? null : q.value,
          quantity_state,
          unit: effUnit || null,
          heating_value_basis: fam === "energy" ? basis || null : null,
          reference_conditions: effUnit === "m3" && refT ? { temperature_c: refT, pressure_kpa: refP || "101.325" } : null,
          calorific_value: cvOn && cv.value ? { value: cv.value.replace(",", "."), unit: cv.unit, basis: cv.basis, source_ref: cv.source_ref } : null,
          basis_conversion: null,
          data_quality: dq,
          invoice_no: invoice || null,
          supplier: supplier || null,
          evidence_ids: evs.map((e) => e.id),
          duplicate_override_reason: dupReason || null,
          note,
        },
        detail: d,
        unknown_fields: unknownFields,
        training,
      });
      router.push(`/kayit/?id=${r.id}`);
    } catch (ex) {
      setErr(ex);
    }
  };

  const allCandidates = [...assistant, ...candidates];
  const cat = schema?.scope === 3 ? schema.category : null;
  const assessment = cat ? categoryAssessments(store)[cat] : null;
  const meta = source ? sourceMeta(store, source.id) : null;

  return (
    <>
      <PageHeader eyebrow="Veri girişi · DAT-01…06" title="Ne kaydetmek istiyorsun?" lead="Fatura, malzeme, sevkiyat, atık, seyahat, soğutucu veya değer zinciri verisini kanıtıyla kaydedin. Kapsam seçimi ileri alandadır; sistem kaynaktan ve kayıt türünden önerir, 'neden bu kapsam?' her türde açıktır (§11)." tags={["§11", "§12", "§13", "§14", "§15", "§16", "T03", "T07", "T10", "T11", "T12", "T20"]} />
      {training && (
        <Notice kind="info">
          <p>
            <strong>Eğitim kaydı.</strong> Bu kayıt "eğitim" etiketi taşır; üretim toplamına girmez (§06).
          </p>
        </Notice>
      )}
      <div className="kind-grid" role="radiogroup" aria-label="Kayıt türü">
        {ENTRY_KINDS.map((k) => (
          <button key={k.id} type="button" className={`kind ${kind.id === k.id ? "on" : ""}`} onClick={() => pickKind(k)} aria-pressed={kind.id === k.id}>
            <span className="t">{k.label}</span>
            <span className="d">{k.description}</span>
          </button>
        ))}
      </div>
      {kind.link && (
        <Notice kind="info">
          <p>
            {kind.id === "product" ? "Ürün çalışması ayrı hesap bağlamıdır; kurumsal toplama eklenmez (kural 8). " : "Karbon dışı veri (su, atık, enerji yoğunluğu vb.) bu formda değil, analiz sayfasında girilir. "}
            <Link href={kind.link.href}>{kind.link.label}</Link>
          </p>
        </Notice>
      )}
      {kind.schemas.length > 1 && (
        <div className="radio-list" style={{ marginBottom: "1rem" }}>
          {kind.schemas.map((key) => {
            const sc = schemaOf(key)!;
            return (
              <label key={key}>
                <input type="radio" name="schema" checked={schema?.key === key} onChange={() => pickSchema(key)} />
                <span>
                  <b>{sc.title}</b> <span className="badge neutral">{sc.scope === 0 ? "ürün bağlamı" : `Kapsam ${sc.scope}`}</span>
                  <br />
                  <span className="hint">{sc.why_scope}</span>
                </span>
              </label>
            );
          })}
        </div>
      )}

      {schema && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            save();
          }}
        >
          <ErrorBox error={err} />
          <fieldset>
            <legend>DAT-01 Faaliyet ve kaynak — {schema.title}</legend>
            <details className="why">
              <summary>Neden bu kapsam?</summary>
              <p className="small">{schema.why_scope}</p>
              <ul className="small">
                {schema.controls.map((c) => (
                  <li key={c}>{c}</li>
                ))}
              </ul>
              <p className="small muted">Beklenen kanıt: {schema.evidence.join("; ")}. İzinli yöntem: {schema.methods.join(", ")}. {schema.owner_hint && `Önerilen sorumlu: ${schema.owner_hint} (uzmanlık garantisi değildir).`}</p>
            </details>
            {sources.length === 0 ? (
              <Notice kind="warn">
                <p>
                  Bu türde ({schema.source_types.join(", ")}) kaynak tanımlı değil. <Link href="/kurulum/">Kurulum → Kaynak envanteri</Link>
                </p>
              </Notice>
            ) : (
              <div className="field">
                <label htmlFor="src">Kaynak (tesis / ekipman / süreç)</label>
                <select id="src" value={sid} onChange={(e) => setSourceId(e.target.value)}>
                  {sources.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} — {store.facilities().find((f) => f.id === s.facility_id)?.name} {s.fuel ? `· ${s.fuel}` : ""}
                    </option>
                  ))}
                </select>
                {meta && (
                  <span className="hint">
                    Kaynak bilgisi: {meta.grid_region && `şebeke ${meta.grid_region} · `}
                    {meta.gases.length > 0 && `gazlar ${meta.gases.join(", ")} · `}
                    {meta.scope3_category && `Kapsam 3 kat. ${meta.scope3_category}`}
                  </span>
                )}
              </div>
            )}
            {assessment && (
              <p className="small">
                Kurum düzeyinde kategori {cat} değerlendirmesi: <span className={`badge ${assessment.state === "applicable" ? "ok" : assessment.state === "not_applicable" ? "neutral" : "warn"}`}>{assessment.state === "applicable" ? "uygulanabilir" : assessment.state === "not_applicable" ? `uygulanamaz — ${assessment.reason}` : "bilinmiyor"}</span> · <Link href="/envanter/">envanterde değiştirilir</Link>
              </p>
            )}
            <div className="field">
              <label htmlFor="per">Raporlama dönemi</label>
              <select id="per" value={pid} onChange={(e) => setPeriodId(e.target.value)}>
                {periods.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.start} → {p.end}
                  </option>
                ))}
              </select>
            </div>
            <div className="row">
              <div className="field">
                <label htmlFor="ps">Faaliyet dönemi başlangıcı</label>
                <input id="ps" type="date" value={ps} onChange={(e) => setPs(e.target.value)} required />
              </div>
              <div className="field">
                <label htmlFor="pe">Bitişi</label>
                <input id="pe" type="date" value={pe} onChange={(e) => setPe(e.target.value)} required />
              </div>
              <div className="field">
                <label htmlFor="resp">Sorumlu</label>
                <input id="resp" value={responsible} onChange={(e) => setResponsible(e.target.value)} placeholder={schema.owner_hint ?? "ad / birim"} />
              </div>
            </div>
          </fieldset>

          <fieldset>
            <legend>DAT-02 / DAT-03 Belge (kanıt) ve belgeden okuma</legend>
            <div className="field">
              <label htmlFor="file">Belge dosyası (PDF, görüntü)</label>
              <input
                id="file"
                type="file"
                disabled={busy}
                onChange={async (e) => {
                  const f = e.target.files?.[0];
                  if (!f) return;
                  setBusy(true);
                  setErr(null);
                  try {
                    const { evidence, duplicates } = await store.addEvidence(f);
                    files.current.set(evidence.id, f);
                    setEvs((x) => [...x, evidence]);
                    setDupEv(duplicates);
                  } catch (ex) {
                    setErr(ex);
                  } finally {
                    setBusy(false);
                    e.target.value = "";
                  }
                }}
              />
              <span className="hint">Önizlemede dosya içeriği saklanmaz; yalnız adı, boyutu ve SHA-256 karması kaydedilir (mükerrerlik kontrolü T07). "Belgeden oku" görüntü dosyalarını tarayıcıda okur (Tesseract.js, tur+eng, isteğe bağlı indirilir).</span>
            </div>
            {evs.length > 0 && (
              <ul className="small">
                {evs.map((e) => (
                  <li key={e.id}>
                    {e.file_name} · {e.size_bytes} bayt · <span className="mono">{e.sha256.slice(0, 16)}…</span>{" "}
                    <button type="button" className="mini" disabled={ocr.state === "loading"} onClick={() => runOcr(e)}>
                      Belgeden oku
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {dupEv.length > 0 && (
              <Notice kind="warn">
                <p>
                  <strong>Aynı belge daha önce yüklenmiş</strong> ({dupEv.length} eş karma). Aynı belge ikinci kez kaydedilmemeli (T07). Gerçekten ayrı bir işlemse aşağıya gerekçe yazın.
                </p>
              </Notice>
            )}
            {ocr.state === "loading" && (
              <p className="muted" role="status">
                Belge okunuyor… {ocr.progress}
              </p>
            )}
            {ocr.state === "error" && (
              <Notice kind="crit" title="Belge okunamadı (OCR_UNAVAILABLE)">
                <p>{ocr.error}</p>
                <p className="small">
                  <b>Sonuç:</b> {explain("OCR_UNAVAILABLE")?.consequence} <b>Ne yapmalı:</b> {explain("OCR_UNAVAILABLE")?.action}
                </p>
              </Notice>
            )}
            {ocr.state === "done" && ocr.out && (
              <details open>
                <summary>
                  Okunan metin (ortalama güven {Math.round(ocr.out.mean_confidence)}%) — {candidates.length} aday alan
                </summary>
                <pre className="trace">{ocr.out.text}</pre>
                {candidates.length === 0 && <p className="small muted">Metinden tanınan alan çıkmadı; alanları elle girin.</p>}
              </details>
            )}
            {allCandidates.length > 0 && (
              <div className="cands">
                <p className="small">
                  <b>Aday alanlar.</b> Hiçbiri siz "aktar" demeden forma yazılmaz. Düşük güvenli alanlar vurgulanır; OCR doğruluğu emisyon hesabının doğruluğu değildir (§11).
                </p>
                <ul>
                  {allCandidates.map((c, i) => {
                    const low = c.confidence < LOW_CONFIDENCE;
                    const done = transferred.includes(`${c.key}:${c.value}`);
                    const fromAssistant = assistant.includes(c);
                    return (
                      <li key={`${c.key}-${i}`} className={low ? "low" : ""}>
                        <span className="badge neutral">{fromAssistant ? "asistan önerisi" : "OCR"}</span> <b>{c.label}:</b> <span className="mono">{c.value}</span> <span className={`badge ${low ? "warn" : "ok"}`}>güven {Math.round(c.confidence * 100)}%</span>
                        {c.note && <span className="hint"> {c.note}</span>}{" "}
                        <button type="button" className="mini" onClick={() => transfer(c)} disabled={done}>
                          {done ? "aktarıldı" : fromAssistant ? "onayla ve aktar" : "aktar"}
                        </button>
                      </li>
                    );
                  })}
                </ul>
                {assistant.length > 0 && (
                  <button type="button" className="mini" onClick={() => { setAssistant([]); clearAssistantSuggestions(); }}>
                    Asistan önerilerini yok say
                  </button>
                )}
              </div>
            )}
            <div className="row">
              <div className="field">
                <label htmlFor="inv">Fatura / belge numarası</label>
                <input id="inv" value={invoice} onChange={(e) => setInvoice(e.target.value)} />
              </div>
              <div className="field">
                <label htmlFor="sup">Tedarikçi / karşı taraf</label>
                <input id="sup" value={supplier} onChange={(e) => setSupplier(e.target.value)} />
              </div>
            </div>
          </fieldset>

          <fieldset>
            <legend>DAT-04 Miktar, birim ve bağlam</legend>
            <div className="field">
              <label htmlFor="q">{schema.quantity_label}</label>
              <div className="inline">
                <input id="q" inputMode="decimal" value={qRaw} onChange={(e) => { setQRaw(e.target.value); setDecSep(null); }} disabled={qUnknown} aria-invalid={!!q.error} placeholder="ör. 1.250,5" />
                <select aria-label="Birim" value={effUnit} onChange={(e) => setUnit(e.target.value)}>
                  {schema.units.map((u) => (
                    <option key={u.value} value={u.value}>
                      {u.label}
                    </option>
                  ))}
                  <option value="">Birimi bilmiyorum</option>
                </select>
              </div>
              {q.error && <span className="err">{q.error}</span>}
              {q.ambiguous && (
                <div className="radio-list small">
                  <span className="err">"{qRaw}" iki şekilde okunabilir. Hangisi doğru?</span>
                  <label>
                    <input type="radio" name="sep" onChange={() => setDecSep(",")} /> Binlik ayracı: {qRaw.replace(".", "")} (bin ile çarpılmış)
                  </label>
                  <label>
                    <input type="radio" name="sep" onChange={() => setDecSep(".")} /> Ondalık ayracı: {qRaw.replace(".", ",")}
                  </label>
                </div>
              )}
              <label className="check">
                <input type="checkbox" checked={qUnknown} onChange={(e) => setQUnknown(e.target.checked)} /> Miktarı bilmiyorum (taslak korunur, görev açılır — T20)
              </label>
              <span className="hint">Boş = bilinmiyor; 0 = ölçülmüş sıfır (gerekçe istenebilir). Eksik veriye sıfır atanmaz (kural 2). Negatif tüketim normal kayıt olamaz; iade/düzeltme ayrı işlem türüdür.</span>
            </div>
            {fam === "energy" && schema.scope === 1 && (
              <div className="field">
                <label>Isıl değer esası</label>
                <div className="radio-list">
                  <label>
                    <input type="radio" name="basis" checked={basis === "LHV"} onChange={() => setBasis("LHV")} /> Alt ısıl değer (LHV / net)
                  </label>
                  <label>
                    <input type="radio" name="basis" checked={basis === "HHV"} onChange={() => setBasis("HHV")} /> Üst ısıl değer (HHV / brüt)
                  </label>
                  <label>
                    <input type="radio" name="basis" checked={basis === ""} onChange={() => setBasis("")} /> Bilmiyorum
                  </label>
                </div>
                <span className="hint">Faktörün esasıyla uyuşmazsa hesap onaya gidemez (T04). Bilmiyorsanız görev açılır.</span>
              </div>
            )}
            {effUnit === "m3" && (
              <div className="field">
                <label>Hacim koşulları (sıcaklık / basınç)</label>
                <div className="row">
                  <input placeholder="Sıcaklık °C" value={refT} onChange={(e) => setRefT(e.target.value)} style={{ maxWidth: 160 }} />
                  <input placeholder="Basınç kPa" value={refP} onChange={(e) => setRefP(e.target.value)} style={{ maxWidth: 160 }} />
                </div>
                <span className="hint">m³, referans koşulu olmadan Nm³/Sm³'e eşitlenmez (T03).</span>
              </div>
            )}
            {fam === "volume_gas" && (
              <div className="field">
                <label className="check">
                  <input type="checkbox" checked={cvOn} onChange={(e) => setCvOn(e.target.checked)} /> Faturada ısıl değer (kcal/m³, kWh/m³, MJ/m³) var — enerjiye dönüşüm için gir
                </label>
                {cvOn && (
                  <div className="row">
                    <input placeholder="Değer" value={cv.value} onChange={(e) => setCv({ ...cv, value: e.target.value })} style={{ maxWidth: 120 }} />
                    <select value={cv.unit} onChange={(e) => setCv({ ...cv, unit: e.target.value })} style={{ maxWidth: 160 }}>
                      <option value="MJ/m3">MJ/m³</option>
                      <option value="kWh/m3">kWh/m³</option>
                      <option value="kcal/m3">kcal/m³ (motor dönüştürmez; MJ/m³'e çevirip kaynağını yazın)</option>
                    </select>
                    <select value={cv.basis} onChange={(e) => setCv({ ...cv, basis: e.target.value as "LHV" | "HHV" })} style={{ maxWidth: 140 }}>
                      <option value="LHV">alt (LHV)</option>
                      <option value="HHV">üst (HHV)</option>
                    </select>
                    <input placeholder="Kaynak (ör. fatura s.2)" value={cv.source_ref} onChange={(e) => setCv({ ...cv, source_ref: e.target.value })} style={{ maxWidth: 200 }} />
                  </div>
                )}
                <span className="hint">Dönüşümün kaynağı kaydedilir; faturada enerji varsa çift dönüşüm yapılmaz (§12).</span>
              </div>
            )}
            <div className="row">
              <div className="field">
                <label htmlFor="ds">Veri kaynağı</label>
                <select id="ds" value={dataSource} onChange={(e) => setDataSource(e.target.value)}>
                  <option value="invoice">Fatura / belge</option>
                  <option value="meter">Sayaç / ölçüm</option>
                  <option value="supplier">Tedarikçi beyanı</option>
                  <option value="survey">Anket / örneklem</option>
                  <option value="estimate">Tahmin / senaryo</option>
                </select>
              </div>
              <div className="field">
                <label>Veri niteliği</label>
                <div className="radio-list">
                  <label>
                    <input type="radio" name="dq" checked={dq === "measured"} onChange={() => setDq("measured")} /> Ölçülmüş (sayaç / fatura)
                  </label>
                  <label>
                    <input type="radio" name="dq" checked={dq === "estimated"} onChange={() => setDq("estimated")} /> Tahmini (sonuç "tahmini" etiketi taşır, inceleme gerekir)
                  </label>
                </div>
              </div>
            </div>
            <div className="field">
              <label htmlFor="note">Not</label>
              <textarea id="note" value={note} onChange={(e) => setNote(e.target.value)} />
            </div>
            {dupEv.length > 0 && (
              <div className="field">
                <label htmlFor="dup">Mükerrer aday gerekçesi (T07)</label>
                <input id="dup" value={dupReason} onChange={(e) => setDupReason(e.target.value)} placeholder="Neden bu ayrı bir işlem?" />
              </div>
            )}
          </fieldset>

          <SchemaFields schema={schema} detail={detail} unknownFields={unknownFields} setField={setField} toggleUnknown={toggleUnknown} sourceFuel={source?.fuel} />

          {schema.scope === 2 && <InstrumentsEditor detail={detail} setField={setField} />}
          {schema.scope === 3 && <MethodChecklist detail={detail} setField={setField} />}

          <div className="actions">
            <button className="primary" type="submit">
              Taslağı kaydet
            </button>
            <span className="small muted">Kaydettikten sonra kayıt sayfasında hesap önizlemesi (DAT-05) ve "kontrole gönder" (DAT-06) ayrı adımlardır. Kayıt bu tarayıcıda saklanır (önizleme deposu).</span>
          </div>
        </form>
      )}
    </>
  );
}

function SchemaFields({ schema, detail, unknownFields, setField, toggleUnknown, sourceFuel }: { schema: RecordSchema; detail: Record<string, unknown>; unknownFields: string[]; setField: (k: string, v: unknown) => void; toggleUnknown: (k: string, on: boolean) => void; sourceFuel?: string | null }) {
  const visible = schema.fields.filter((f) => f.key !== "heating_value_basis" && fieldVisible(f, detail));
  const groups = Array.from(new Set(visible.map((f) => f.group)));
  if (!groups.length) return null;
  return (
    <>
      {groups.map((g) => (
        <fieldset key={g}>
          <legend>{g}</legend>
          {g.startsWith("Veri kalitesi") && <p className="small muted">Beş boyut ayrı değerlendirilir; birleşik puan hesaplanmaz, belirsizlik yüzdesi gibi sunulmaz (§16).</p>}
          <div className="grid-2">
            {visible
              .filter((f) => f.group === g)
              .map((spec) => (
                <Field key={spec.key} spec={spec} value={getPath(detail, spec.key) ?? (spec.key === "fuel" ? sourceFuel ?? undefined : undefined)} unknown={unknownFields.includes(spec.key)} onChange={(v) => setField(spec.key, v)} onUnknown={(on) => toggleUnknown(spec.key, on)} help={g.startsWith("Veri kalitesi") ? DQ_DIMS.find((d) => spec.key.endsWith(d.key))?.help : undefined} />
              ))}
          </div>
        </fieldset>
      ))}
    </>
  );
}

function Field({ spec, value, unknown, onChange, onUnknown, help }: { spec: FieldSpec; value: unknown; unknown: boolean; onChange: (v: unknown) => void; onUnknown: (on: boolean) => void; help?: string }) {
  const id = `f-${spec.key.replace(/\./g, "-")}`;
  const str = value === undefined || value === null ? "" : String(value);
  return (
    <div className="field">
      <label htmlFor={id}>
        {spec.label} {spec.required && <span className="req" title="zorunlu">*</span>}
      </label>
      {spec.kind === "select" ? (
        <select id={id} value={str} onChange={(e) => onChange(e.target.value || null)} disabled={unknown}>
          <option value="">— seçin —</option>
          {spec.options?.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      ) : spec.kind === "boolean" ? (
        <select id={id} value={value === true ? "true" : value === false ? "false" : ""} onChange={(e) => onChange(e.target.value === "" ? null : e.target.value === "true")} disabled={unknown}>
          <option value="">— seçin —</option>
          <option value="true">Evet</option>
          <option value="false">Hayır</option>
        </select>
      ) : spec.kind === "date" ? (
        <input id={id} type="date" value={str} onChange={(e) => onChange(e.target.value || null)} disabled={unknown} />
      ) : (
        <input id={id} inputMode={spec.kind === "text" ? undefined : "decimal"} value={str} placeholder={spec.placeholder} onChange={(e) => onChange(e.target.value === "" ? null : spec.kind === "decimal" ? e.target.value.replace(",", ".") : e.target.value)} disabled={unknown} />
      )}
      {spec.unknown_allowed && (
        <label className="check">
          <input type="checkbox" checked={unknown} onChange={(e) => onUnknown(e.target.checked)} /> Bilmiyorum (taslak korunur, görev açılır)
        </label>
      )}
      {(help ?? spec.help) && <span className="hint">{help ?? spec.help}</span>}
    </div>
  );
}

function InstrumentsEditor({ detail, setField }: { detail: Record<string, unknown>; setField: (k: string, v: unknown) => void }) {
  const list = ((getPath(detail, "scope2.instruments") as Instrument[] | undefined) ?? []).slice();
  const method = String(getPath(detail, "scope2.method") ?? "");
  const update = (i: number, patch: Partial<Instrument>) => {
    const n = list.slice();
    n[i] = { ...n[i], ...patch };
    setField("scope2.instruments", n);
  };
  const add = () => setField("scope2.instruments", [...list, { id: "", type: "guarantee_of_origin", mwh: "", generation_period: { start: "", end: "" }, retired: false, quality_criteria_met: false, beneficiary: "", supplier: "", generation_site: "", serial: "", factor_value: "0", factor_source_ref: "" }]);
  const ex = explain("INSTRUMENT_EXCEEDS_CONSUMPTION");
  return (
    <fieldset>
      <legend>Sözleşmesel araçlar (piyasa bazlı, §13)</legend>
      {method === "location_based" && <p className="small muted">Hesap görünümü yalnız konum bazlı seçildi; araçlar piyasa bazlı görünümde kullanılır. İkisini de görmek için "her ikisi" seçin.</p>}
      <p className="small">
        Her araç için tür, tedarikçi, üretim yeri, enerji dönemi, miktar, belge serisi, faydalanan kuruluş, itfa/iptal ve kalite koşulu tutulur. <b>Belge miktarı tüketimi aşamaz:</b> motor <code>INSTRUMENT_EXCEEDS_CONSUMPTION</code> ile engeller — {ex?.consequence} Arayüz önceden hesaplamaz. "Yenilenebilir satın aldım" tek başına sıfır emisyon üretmez; itfa ve kalite koşulları doğrulanır.
      </p>
      {list.map((inst, i) => (
        <div key={i} className="inst card quiet">
          <div className="grid-3">
            <div className="field">
              <label>Belge / araç kimliği</label>
              <input value={inst.id} onChange={(e) => update(i, { id: e.target.value })} placeholder="GO-2026-001" />
            </div>
            <div className="field">
              <label>Tür</label>
              <select value={inst.type} onChange={(e) => update(i, { type: e.target.value })}>
                {INSTRUMENT_TYPES.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>Miktar (MWh)</label>
              <input inputMode="decimal" value={inst.mwh} onChange={(e) => update(i, { mwh: e.target.value.replace(",", ".") })} />
            </div>
            <div className="field">
              <label>Üretim dönemi başlangıcı</label>
              <input type="date" value={inst.generation_period.start} onChange={(e) => update(i, { generation_period: { ...inst.generation_period, start: e.target.value } })} />
            </div>
            <div className="field">
              <label>Üretim dönemi bitişi</label>
              <input type="date" value={inst.generation_period.end} onChange={(e) => update(i, { generation_period: { ...inst.generation_period, end: e.target.value } })} />
            </div>
            <div className="field">
              <label>Faydalanan kuruluş</label>
              <input value={inst.beneficiary} onChange={(e) => update(i, { beneficiary: e.target.value })} />
            </div>
            <div className="field">
              <label>Tedarikçi</label>
              <input value={inst.supplier ?? ""} onChange={(e) => update(i, { supplier: e.target.value })} />
            </div>
            <div className="field">
              <label>Üretim yeri</label>
              <input value={inst.generation_site ?? ""} onChange={(e) => update(i, { generation_site: e.target.value })} />
            </div>
            <div className="field">
              <label>Belge seri bilgisi</label>
              <input value={inst.serial ?? ""} onChange={(e) => update(i, { serial: e.target.value })} />
            </div>
            <div className="field">
              <label>Araç faktörü (kg CO₂e/MWh)</label>
              <input inputMode="decimal" value={inst.factor_value ?? "0"} onChange={(e) => update(i, { factor_value: e.target.value.replace(",", ".") })} />
              <span className="hint">Menşe garantisi için çoğunlukla 0; tedarikçiye özgü üründe tedarikçi faktörü ve kaynağı.</span>
            </div>
            <div className="field">
              <label>Faktör kaynağı</label>
              <input value={inst.factor_source_ref ?? ""} onChange={(e) => update(i, { factor_source_ref: e.target.value })} />
            </div>
          </div>
          <div className="row">
            <label className="check">
              <input type="checkbox" checked={inst.retired} onChange={(e) => update(i, { retired: e.target.checked })} /> İtfa / iptal edildi (kanıt yüklü)
            </label>
            <label className="check">
              <input type="checkbox" checked={inst.quality_criteria_met} onChange={(e) => update(i, { quality_criteria_met: e.target.checked })} /> Kalite koşulları karşılanıyor
            </label>
            <button type="button" className="mini danger" onClick={() => setField("scope2.instruments", list.filter((_, j) => j !== i))}>
              Kaldır
            </button>
          </div>
        </div>
      ))}
      <button type="button" onClick={add}>
        Araç ekle
      </button>
    </fieldset>
  );
}

function MethodChecklist({ detail, setField }: { detail: Record<string, unknown>; setField: (k: string, v: unknown) => void }) {
  const done = ((getPath(detail, "scope3.method_steps") as string[] | undefined) ?? []).slice();
  const cat = Number(getPath(detail, "scope3.category") ?? 0);
  const catInfo = SCOPE3_CATEGORIES.find((c) => c.n === cat);
  return (
    <fieldset>
      <legend>Yöntem seçme sözleşmesi (MTH-01…05, §16)</legend>
      <p className="small muted">Adımlar kayıt ayrıntısında tutulur; MTH-05 (etkinleştirme) onay akışında tamamlanır. {catInfo && `Önerilen veri sorumlusu: ${catInfo.owner_hint}.`}</p>
      <div className="radio-list">
        {MTH_STEPS.map((s) => (
          <label key={s.id}>
            <input type="checkbox" checked={done.includes(s.id)} disabled={s.id === "MTH-05"} onChange={(e) => setField("scope3.method_steps", e.target.checked ? [...done, s.id] : done.filter((x) => x !== s.id))} />
            <span>
              <b>{s.id}</b> {s.label}
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
