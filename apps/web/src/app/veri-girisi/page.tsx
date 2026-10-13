"use client";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { type ActivityRecordVersion, type DataQuality, type Evidence, type ValueState } from "@/lib/domain";
import { useStore } from "@/lib/useStore";
import { ErrorBox, Loading, NoTenant, Notice } from "@/components/ui";

const UNITS = [
  ["GJ", "GJ (gigajul) — faturada enerji"],
  ["MWh", "MWh — faturada enerji"],
  ["kWh", "kWh — faturada enerji"],
  ["Sm3", "Sm³ — standart metreküp (15 °C)"],
  ["Nm3", "Nm³ — normal metreküp (0 °C)"],
  ["m3", "m³ — koşulu belirtilmemiş hacim"],
  ["", "Bilmiyorum"],
] as const;

export default function Page() {
  return (
    <Suspense fallback={<Loading />}>
      <VeriGirisi />
    </Suspense>
  );
}

// §11: nokta/virgül belirsizliği sessizce çözülmez
function parseQuantity(raw: string, decimalSep: "," | "." | null): { value: string | null; ambiguous: boolean; error: string | null } {
  const s = raw.trim().replace(/\s/g, "");
  if (!s) return { value: null, ambiguous: false, error: null };
  if (/^-/.test(s)) return { value: null, ambiguous: false, error: "Negatif tüketim normal kayıt olamaz; iade/düzeltme ayrı işlem türüdür (§11)." };
  if (!/^[\d.,]+$/.test(s)) return { value: null, ambiguous: false, error: "Bu alan miktar bekliyor; ödeme tutarını veya metni ayrı alana yazın (§10)." };
  const hasDot = s.includes("."), hasComma = s.includes(",");
  let v: string;
  if (hasDot && hasComma) {
    // son ayraç ondalık
    const lastDot = s.lastIndexOf("."), lastComma = s.lastIndexOf(",");
    v = lastDot > lastComma ? s.replace(/,/g, "") : s.replace(/\./g, "").replace(",", ".");
  } else if (hasComma) {
    v = s.replace(",", ".");
  } else if (hasDot) {
    const parts = s.split(".");
    if (parts.length === 2 && parts[1].length === 3 && decimalSep === null) return { value: null, ambiguous: true, error: null };
    v = decimalSep === "." || parts[1]?.length !== 3 ? s : s.replace(/\./g, "");
    if (parts.length > 2) v = s.replace(/\./g, "");
  } else v = s;
  if (!/^\d+(\.\d+)?$/.test(v)) return { value: null, ambiguous: false, error: "Sayı okunamadı." };
  return { value: v, ambiguous: false, error: null };
}

function VeriGirisi() {
  const { store, ready } = useStore();
  const router = useRouter();
  const params = useSearchParams();
  const training = params.get("training") === "1";
  const [kind, setKind] = useState<"invoice" | null>("invoice");
  const [err, setErr] = useState<unknown>(null);
  const [sourceId, setSourceId] = useState("");
  const [periodId, setPeriodId] = useState("");
  const [ps, setPs] = useState("2026-01-01");
  const [pe, setPe] = useState("2026-01-31");
  const [qRaw, setQRaw] = useState("");
  const [decSep, setDecSep] = useState<"," | "." | null>(null);
  const [qUnknown, setQUnknown] = useState(false);
  const [unit, setUnit] = useState<string>("GJ");
  const [basis, setBasis] = useState<"LHV" | "HHV" | "">("");
  const [refT, setRefT] = useState("");
  const [refP, setRefP] = useState("101.325");
  const [cvOn, setCvOn] = useState(false);
  const [cv, setCv] = useState({ value: "", unit: "MJ/m3", basis: "LHV" as "LHV" | "HHV", source_ref: "" });
  const [dq, setDq] = useState<DataQuality>("measured");
  const [invoice, setInvoice] = useState("");
  const [supplier, setSupplier] = useState("");
  const [note, setNote] = useState("");
  const [evs, setEvs] = useState<Evidence[]>([]);
  const [dupEv, setDupEv] = useState<Evidence[]>([]);
  const [dupReason, setDupReason] = useState("");
  const [busy, setBusy] = useState(false);

  if (!ready || !store) return <Loading />;
  if (!store.tenant) return <NoTenant />;
  const sources = store.sources().filter((s) => s.source_type === "stationary_combustion" && s.fuel === "natural_gas");
  const periods = store.periods().filter((p) => p.status !== "locked");
  const q = parseQuantity(qRaw, decSep);
  const sid = sourceId || sources[0]?.id || "";
  const pid = periodId || periods[0]?.id || "";

  const buildVersion = (): Omit<ActivityRecordVersion, "record_id" | "tenant_id" | "version" | "created_at" | "created_by"> => {
    const quantity_state: ValueState = qUnknown ? "unknown" : "known";
    return {
      change_reason: null,
      source_id: sid,
      period_id: pid,
      period_start: ps,
      period_end: pe,
      quantity: qUnknown ? null : q.value,
      quantity_state,
      unit: unit || null,
      heating_value_basis: basis || null,
      reference_conditions: unit === "m3" && refT ? { temperature_c: refT, pressure_kpa: refP || "101.325" } : null,
      calorific_value: cvOn && cv.value ? { value: cv.value.replace(",", "."), unit: cv.unit, basis: cv.basis, source_ref: cv.source_ref } : null,
      basis_conversion: null,
      data_quality: dq,
      invoice_no: invoice || null,
      supplier: supplier || null,
      evidence_ids: evs.map((e) => e.id),
      duplicate_override_reason: dupReason || null,
      note,
    };
  };

  const save = () => {
    setErr(null);
    try {
      if (!sid) throw new Error("Doğal gaz kaynağı yok; kurulumda kaynak envanterine ekleyin.");
      if (!pid) throw new Error("Açık raporlama dönemi yok; kurulumda dönem ekleyin.");
      if (!(ps <= pe)) throw new Error("Dönem bitişi başlangıçtan önce olamaz.");
      if (!qUnknown && q.error) throw new Error(q.error);
      if (!qUnknown && q.ambiguous) throw new Error("Miktar ayracı belirsiz; aşağıdan hangi okumanın doğru olduğunu seçin.");
      if (!qUnknown && q.value === null) throw new Error("Miktar boş. Bilmiyorsanız 'miktarı bilmiyorum' işaretleyin; taslak korunur ve görev açılır (T20).");
      const r = store.createRecord(buildVersion(), training);
      router.push(`/kayit/?id=${r.id}`);
    } catch (ex) {
      setErr(ex);
    }
  };

  return (
    <>
      <h1>Ne kaydetmek istiyorsun?</h1>
      {training && (
        <Notice kind="info">
          <p>
            <strong>Eğitim kaydı.</strong> Bu kayıt "eğitim" etiketi taşır; toplamlara ve raporlara eğitim verisi olarak girer, üretim sonucu sayılmaz (§06).
          </p>
        </Notice>
      )}
      <div className="row" role="radiogroup" aria-label="Kayıt türü">
        <button className={kind === "invoice" ? "primary" : ""} onClick={() => setKind("invoice")} aria-pressed={kind === "invoice"}>
          Fatura / tüketim (doğal gaz)
        </button>
        {["Malzeme / hizmet (Dilim 7)", "Sevkiyat (Dilim 7)", "Atık (Dilim 7)", "Seyahat (Dilim 7)", "Soğutucu (Dilim 2)", "Elektrik (Dilim 2)", "Ürün (Dilim 7+)"].map((l) => (
          <button key={l} disabled title="Bu kayıt türü henüz uygulanmadı">
            {l}
          </button>
        ))}
      </div>
      <p className="small">Devre dışı türler henüz uygulanmadı; hangi dilimde geleceği yazılıdır (kural 10). Kapsam seçimi ileri alandadır; sistem kaynaktan önerir.</p>

      {kind === "invoice" && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            save();
          }}
        >
          <ErrorBox error={err} />
          <fieldset>
            <legend>DAT-01 Faaliyet ve kaynak</legend>
            {sources.length === 0 ? (
              <Notice kind="warn">
                <p>
                  Doğal gaz yakan kaynak tanımlı değil. <Link href="/kurulum/">Kurulum → Kaynak envanteri</Link>
                </p>
              </Notice>
            ) : (
              <div className="field">
                <label htmlFor="src">Kaynak (tesis / ekipman)</label>
                <select id="src" value={sid} onChange={(e) => setSourceId(e.target.value)}>
                  {sources.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} — {store.facilities().find((f) => f.id === s.facility_id)?.name}
                    </option>
                  ))}
                </select>
                <span className="hint">Neden Kapsam 1? Yakıt kurumun kontrolündeki ekipmanda yakılıyor; doğrudan emisyon (§12).</span>
              </div>
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
                <label htmlFor="ps">Fatura dönemi başlangıcı</label>
                <input id="ps" type="date" value={ps} onChange={(e) => setPs(e.target.value)} required />
              </div>
              <div className="field">
                <label htmlFor="pe">Bitişi</label>
                <input id="pe" type="date" value={pe} onChange={(e) => setPe(e.target.value)} required />
              </div>
            </div>
          </fieldset>

          <fieldset>
            <legend>DAT-02 Belge (kanıt)</legend>
            <div className="field">
              <label htmlFor="file">Fatura dosyası (PDF, görüntü)</label>
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
              <span className="hint">
                Önizlemede dosya içeriği saklanmaz; yalnız adı, boyutu ve SHA-256 karması kaydedilir (mükerrerlik kontrolü T07). OCR bu önizlemede yok: alanları faturadan elle girin (DAT-03).
              </span>
            </div>
            {evs.length > 0 && (
              <ul className="small">
                {evs.map((e) => (
                  <li key={e.id}>
                    {e.file_name} · {e.size_bytes} bayt · <span className="mono">{e.sha256.slice(0, 16)}…</span>
                  </li>
                ))}
              </ul>
            )}
            {dupEv.length > 0 && (
              <Notice kind="warn">
                <p>
                  <strong>Aynı belge daha önce yüklenmiş</strong> ({dupEv.length} eş karma). Aynı fatura ikinci kez kaydedilmemeli (T07). Gerçekten ayrı bir işlemse aşağıya gerekçe yazın.
                </p>
              </Notice>
            )}
            <div className="row">
              <div className="field">
                <label htmlFor="inv">Fatura numarası</label>
                <input id="inv" value={invoice} onChange={(e) => setInvoice(e.target.value)} />
              </div>
              <div className="field">
                <label htmlFor="sup">Tedarikçi</label>
                <input id="sup" value={supplier} onChange={(e) => setSupplier(e.target.value)} />
              </div>
            </div>
          </fieldset>

          <fieldset>
            <legend>DAT-03 / DAT-04 Miktar, birim ve bağlam</legend>
            <div className="field">
              <label htmlFor="q">Miktar (faturadaki tüketim)</label>
              <div className="inline">
                <input id="q" inputMode="decimal" value={qRaw} onChange={(e) => { setQRaw(e.target.value); setDecSep(null); }} disabled={qUnknown} aria-invalid={!!q.error} placeholder="ör. 1.250,5" />
                <select aria-label="Birim" value={unit} onChange={(e) => setUnit(e.target.value)}>
                  {UNITS.map(([v, l]) => (
                    <option key={v} value={v}>
                      {l}
                    </option>
                  ))}
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
              <label className="small" style={{ fontWeight: 400 }}>
                <input type="checkbox" style={{ width: "auto" }} checked={qUnknown} onChange={(e) => setQUnknown(e.target.checked)} /> Miktarı bilmiyorum (taslak korunur, görev açılır — T20)
              </label>
              <span className="hint">Boş = bilinmiyor; 0 = ölçülmüş sıfır (gerekçe istenebilir). Eksik veriye sıfır atanmaz (kural 2). Sm³/Nm³ ve m³ farklıdır; faturada hangisi yazıyorsa onu seçin (T03).</span>
            </div>
            {["GJ", "MWh", "kWh"].includes(unit) && (
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
                <span className="hint">Faturadaki enerji hangi esasla hesaplanmış? Faktörün esasıyla uyuşmazsa hesap onaya gidemez (T04). Bilmiyorsanız görev açılır.</span>
              </div>
            )}
            {unit === "m3" && (
              <div className="field">
                <label>Hacim koşulları (sıcaklık / basınç)</label>
                <div className="row">
                  <input placeholder="Sıcaklık °C" value={refT} onChange={(e) => setRefT(e.target.value)} style={{ maxWidth: 160 }} />
                  <input placeholder="Basınç kPa" value={refP} onChange={(e) => setRefP(e.target.value)} style={{ maxWidth: 160 }} />
                </div>
                <span className="hint">m³, referans koşulu olmadan Nm³/Sm³'e eşitlenmez (T03). Faturada "Sm³" veya "Nm³" yazıyorsa birimi ona çevirin.</span>
              </div>
            )}
            {["m3", "Nm3", "Sm3"].includes(unit) && (
              <div className="field">
                <label className="small" style={{ fontWeight: 400 }}>
                  <input type="checkbox" style={{ width: "auto" }} checked={cvOn} onChange={(e) => setCvOn(e.target.checked)} /> Faturada ısıl değer (kcal/m³, kWh/m³, MJ/m³) var — enerjiye dönüşüm için gir
                </label>
                {cvOn && (
                  <div className="row">
                    <input placeholder="Değer" value={cv.value} onChange={(e) => setCv({ ...cv, value: e.target.value })} style={{ maxWidth: 120 }} />
                    <select value={cv.unit} onChange={(e) => setCv({ ...cv, unit: e.target.value })} style={{ maxWidth: 140 }}>
                      <option value="MJ/m3">MJ/m³</option>
                      <option value="kWh/m3">kWh/m³</option>
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

          <div className="actions">
            <button className="primary" type="submit">
              Taslağı kaydet
            </button>
            <span className="small muted">Kaydettikten sonra kayıt sayfasında hesap önizlemesi (DAT-05) ve "kontrole gönder" (DAT-06) ayrı adımlardır.</span>
          </div>
        </form>
      )}
    </>
  );
}
