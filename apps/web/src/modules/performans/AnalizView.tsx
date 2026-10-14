"use client";
// /analiz — Gösterge sözlüğü ve giriş (GÖS), analiz (§22), hedef kartı + RACI + iki hedefin durumu (v1.1).
import Link from "next/link";
import { useMemo, useState } from "react";
import { ROLE_LABEL, type DataQuality, type ValueState } from "@/lib/domain";
import type { Store } from "@/lib/store";
import { fmtDate, fmtDec } from "@/lib/useStore";
import { ErrorBox, Notice } from "@/components/ui";
import { ACCESS_LABEL, ENTRY_LABEL, FAMILY_LABEL, FREQ_LABEL, acceptedValues, catalog, denominators, fixIndicatorValue, fixQueue, saveIndicatorValue } from "./indicators";
import { approvedTotalKg } from "./emissions";
import { comparePeriods, detectDeviations, twoGoals } from "./analysis";
import { TARGET_STATUS_LABEL, raciDefaults, raciRows, saveRaci, saveSatisfaction, saveTarget, targets, updateTarget, type TargetInput } from "./governance";
import { Bars, PeriodValueCell, type BarRow } from "./ui";
import type { IndicatorDef, IndicatorValueRow } from "./types";

const VS_LABEL: Record<ValueState, string> = { known: "Biliniyor (değer gireceğim)", unknown: "Bilinmiyor (sıfır yazılmaz)", not_applicable: "Uygulanamaz (gerekçeyle)" };

export function AnalizView({ store }: { store: Store }) {
  const periods = store.periods();
  const [pa, setPa] = useState(periods[0]?.id ?? "");
  const [pb, setPb] = useState(periods[1]?.id ?? periods[0]?.id ?? "");
  const cat = useMemo(() => catalog(store), [store]);
  return (
    <>
      <Notice kind="info" title="Önizleme deposu: bu tarayıcı">
        <p>
          Gösterge değerleri, hedefler ve RACI bu tarayıcıda saklanır. Emisyon sayıları yalnız kayıtlı hesap koşularından okunur; bu ekran emisyon hesaplamaz, yalnız kayıtlı değerleri oranlar ve karşılaştırır. Rolünüz: {ROLE_LABEL[store.role]}.
        </p>
      </Notice>
      {periods.length === 0 && (
        <Notice kind="warn" title="Dönem yok">
          <p>
            Analiz için en az bir raporlama dönemi gerekir. <Link href="/kurulum/">Kurulumda dönem ekleyin.</Link>
          </p>
        </Notice>
      )}
      <div className="card">
        <h2>Dönem seçimi</h2>
        <div className="pf-inline-form">
          <div className="field">
            <label htmlFor="pa">Baz dönem (A)</label>
            <select id="pa" value={pa} onChange={(e) => setPa(e.target.value)}>
              {periods.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.start} → {p.end} {p.status === "locked" ? "(kilitli)" : ""}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="pb">Karşılaştırma dönemi (B)</label>
            <select id="pb" value={pb} onChange={(e) => setPb(e.target.value)}>
              {periods.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.start} → {p.end} {p.status === "locked" ? "(kilitli)" : ""}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>
      {pa && pb && <Analysis store={store} pa={pa} pb={pb} />}
      <IndicatorEntry store={store} cat={cat} />
      <FixQueue store={store} cat={cat} />
      <Dictionary cat={cat} />
      {pb && <Targets store={store} cat={cat} period={pb} />}
      <Raci store={store} />
      {pb && <TwoGoalsCard store={store} period={pb} />}
    </>
  );
}

// ---------------- Analiz ----------------
function Analysis({ store, pa, pb }: { store: Store; pa: string; pb: string }) {
  const c = useMemo(() => comparePeriods(store, pa, pb, ["scope1_kgco2e", "scope2_kgco2e", "electricity_kwh", "fuels_gj", "water_withdrawal_m3", "waste_mass_t"]), [store, pa, pb]);
  const dens = denominators(store);
  const nameOf = (id: string) => store.periods().find((p) => p.id === id);
  const label = (id: string) => {
    const p = nameOf(id);
    return p ? `${p.start} → ${p.end}` : id;
  };
  const scopeRows = (e: typeof c.a, tag: string): BarRow[] =>
    (["1", "2", "3"] as const).flatMap((k) => [
      { label: `Kapsam ${k} · onaylı (${tag})`, value: e.scopes[k].approved_kg, unit: "kgCO2e", variant: "approved" as const, note: `${e.scopes[k].approved_count} kayıt` },
      { label: `Kapsam ${k} · taslak (${tag})`, value: e.scopes[k].draft_kg, unit: "kgCO2e", variant: "draft" as const, note: `${e.scopes[k].draft_count} kayıt; toplama girmez` },
    ]);
  const samePeriod = pa === pb;
  return (
    <>
      <div className="card">
        <h2>Mutlak emisyon — onaylı ve taslak ayrı</h2>
        <p className="small">
          <b>{c.b.label_tr}</b>: eksik Kapsam 3 kategorisi ve onaysız kayıt olduğu sürece kurumsal toplam değil, hesaplanan envanter toplamıdır (§22). Kapsam 2 yöntemi: {c.b.scope2_methods.length ? c.b.scope2_methods.join(", ") : "Kapsam 2 kaydı yok / yöntem belirtilmemiş"}. Senaryo verisi bu tabloda yer almaz (kural 7).
        </p>
        <Bars title="Dönem A ve B kapsam toplamları" rows={[...scopeRows(c.a, "A"), ...scopeRows(c.b, "B")]} caption={`A = ${label(pa)}, B = ${label(pb)}. Taslak çubuklar taralıdır ve toplama girmez.`} />
        <dl className="kv" style={{ marginTop: "0.8rem" }}>
          <dt>Onaylı toplam A / B</dt>
          <dd>
            {c.a.scopes["1"].approved_kg === null && c.a.scopes["2"].approved_kg === null ? "—" : fmtDec(approvedTotalKg(c.a))} / {fmtDec(approvedTotalKg(c.b))} kgCO2e
          </dd>
          <dt>Kayıt dışı (B)</dt>
          <dd>{c.b.excluded.length ? c.b.excluded.map((x) => `${x.record_id.slice(0, 12)}: ${x.reason}`).join(" · ") : "yok"}</dd>
          <dt>Eksik Kapsam 3 (profil önceliği)</dt>
          <dd>{c.b.scope3_priority_missing.length ? `Kategori ${c.b.scope3_priority_missing.join(", ")} için kayıt yok` : "profil önceliklerinin hepsinde kayıt var"}</dd>
          <dt>Tahmini veri payı (B, kayıt sayısı)</dt>
          <dd>
            {c.b.estimated_count} / {c.b.record_count}
          </dd>
        </dl>
      </div>
      <div className="card">
        <h2>Yoğunluk — payda aynı dönemde girilmeden hesaplanmaz (GÖS-03)</h2>
        {dens.length === 0 ? (
          <p className="muted">Kurumun profilinde yoğunluk paydası tanımlı değil.</p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Pay / payda</th>
                  <th>Mutlak A → B</th>
                  <th>Payda A → B</th>
                  <th>Yoğunluk A → B</th>
                  <th>Yorum</th>
                </tr>
              </thead>
              <tbody>
                {c.intensities.map((row) => (
                  <tr key={row.numerator_id + row.denominator_id}>
                    <td>
                      {row.numerator_name} / {row.denominator_name}
                      <div className="pf-state">{row.a.unit}</div>
                    </td>
                    <td className="num">
                      {row.a.numerator.state === "known" ? fmtDec(row.a.numerator.value) : "—"} → {row.b.numerator.state === "known" ? fmtDec(row.b.numerator.value) : "—"}
                      {row.claim.abs_change_pct !== null && <div className="pf-state">%{row.claim.abs_change_pct}</div>}
                    </td>
                    <td className="num">
                      {row.a.denominator?.state === "known" ? fmtDec(row.a.denominator.value) : "—"} → {row.b.denominator?.state === "known" ? fmtDec(row.b.denominator.value) : "—"}
                      {row.claim.output_change_pct !== null && <div className="pf-state">%{row.claim.output_change_pct}</div>}
                    </td>
                    <td className="num">
                      {row.a.status === "ok" ? fmtDec(row.a.value) : <span className="badge warn">hesaplanmadı</span>} → {row.b.status === "ok" ? fmtDec(row.b.value) : <span className="badge warn">hesaplanmadı</span>}
                      {row.b.status !== "ok" && <div className="pf-state">{row.b.reason}</div>}
                    </td>
                    <td>
                      <div className={`pf-claim ${row.claim.kind === "suppressed" ? "" : row.claim.kind === "insufficient" ? "quiet" : "ok"}`}>{samePeriod ? "A ve B aynı dönem; karşılaştırma yok." : row.claim.text}</div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="small muted">Yoğunluk iki kayıtlı değerin bölümüdür (6 basamakta kesilir); emisyon hesabı değildir. Faaliyet çıktısı düşmüşse mutlak düşüş verimlilik olarak yorumlanmaz (v1.1 kabul).</p>
      </div>
      <div className="card">
        <h2>Fark ayrıştırması: faaliyet / faktör / sınır / yöntem</h2>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Boyut</th>
                <th>A</th>
                <th>B</th>
                <th>Değişti mi</th>
                <th>Not</th>
              </tr>
            </thead>
            <tbody>
              {c.decomposition.map((d, i) => (
                <tr key={i}>
                  <td>{d.label}</td>
                  <td className="small">{d.a}</td>
                  <td className="small">{d.b}</td>
                  <td>{d.changed === null ? <span className="badge neutral">karşılaştırılamadı</span> : d.changed ? <span className="badge warn">evet</span> : <span className="badge ok">hayır</span>}</td>
                  <td className="small">{d.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="small muted">Ayrıştırma, koşu üst verisinden (faktör sürümü, yöntem, sınır, normalize miktar) hangi boyutların değiştiğini gösterir; farkı boyutlara sayısal olarak paylaştırmaz — bu bir hesaptır ve motorda yapılır.</p>
      </div>
    </>
  );
}

// ---------------- Gösterge girişi ----------------
function IndicatorEntry({ store, cat }: { store: Store; cat: IndicatorDef[] }) {
  const periods = store.periods();
  const facilities = store.facilities();
  const enterable = cat.filter((i) => i.entry === "manual");
  const [ind, setInd] = useState(enterable[0]?.id ?? "");
  const def = enterable.find((i) => i.id === ind) ?? enterable[0];
  const [period, setPeriod] = useState(periods[0]?.id ?? "");
  const [facility, setFacility] = useState("");
  const [vs, setVs] = useState<ValueState>("known");
  const [value, setValue] = useState("");
  const [unit, setUnit] = useState(def?.unit ?? "");
  const [dq, setDq] = useState<DataQuality>("measured");
  const [ev, setEv] = useState("");
  const [na, setNa] = useState("");
  const [ps, setPs] = useState("");
  const [pe, setPe] = useState("");
  const [dims, setDims] = useState<Record<string, string>>({});
  const [err, setErr] = useState<unknown>(null);
  const [done, setDone] = useState<IndicatorValueRow | null>(null);
  const pick = (id: string) => {
    setInd(id);
    const d = enterable.find((i) => i.id === id);
    setUnit(d?.unit ?? "");
    setDims({});
    setDone(null);
  };
  const submit = () => {
    setErr(null);
    setDone(null);
    try {
      const row = saveIndicatorValue(store, { indicator_id: ind, period_id: period, facility_id: facility || null, unit: unit.trim(), value: vs === "known" ? value.trim().replace(",", ".") : null, value_state: vs, na_reason: na, data_quality: dq, evidence_note: ev, dimensions: dims, period_start: ps || undefined, period_end: pe || undefined });
      setDone(row);
      if (row.status === "accepted") {
        setValue("");
        setEv("");
      }
    } catch (e) {
      setErr(e);
    }
  };
  if (!def) return null;
  return (
    <div className="card">
      <h2>Gösterge değeri girişi (dönem başına)</h2>
      <p className="small">
        Gösterge sözlüğündeki tanım, birim ve veri sahibine göre girilir. Kayıtta veri sözleşmesi testleri çalışır (birim, zaman, aralık, tutarlılık); bulgu varsa satır <b>düzeltme kuyruğuna</b> alınır, sessizce kabul edilmez (GÖS-04). Kapsam 1–2 elle girilmez.
      </p>
      <ErrorBox error={err} />
      {done && done.status === "accepted" && (
        <Notice kind="ok" title="Bu tarayıcıda kaydedildi">
          <p>
            {cat.find((i) => i.id === done.indicator_id)?.name.tr}: {done.value_state === "known" ? `${fmtDec(done.value)} ${done.unit}` : done.value_state === "unknown" ? "bilinmiyor" : "uygulanamaz"} · durum: kabul edildi · sonraki adım: aynı dönem için payda değerini girin, yoğunluk tablosu dolacaktır.
          </p>
        </Notice>
      )}
      {done && done.status === "needs_fix" && (
        <Notice kind="warn" title="Düzeltme kuyruğuna alındı (kabul edilmedi)">
          <ul className="small">
            {done.findings.map((f, i) => (
              <li key={i}>{f}</li>
            ))}
          </ul>
          <p className="small">Satır korunur, analizde kullanılmaz. Aşağıdaki düzeltme kuyruğundan yeni sürüm olarak düzeltin.</p>
        </Notice>
      )}
      <div className="pf-inline-form">
        <div className="field">
          <label htmlFor="ind">Gösterge</label>
          <select id="ind" value={ind} onChange={(e) => pick(e.target.value)}>
            {Object.entries(FAMILY_LABEL).map(([fam, fl]) => {
              const list = enterable.filter((i) => i.family === fam);
              return list.length ? (
                <optgroup key={fam} label={fl}>
                  {list.map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.name.tr} [{i.unit}]
                    </option>
                  ))}
                </optgroup>
              ) : null;
            })}
          </select>
          <span className="hint">
            {def.definition} · kaynak: {def.source_system} · sahibi: {def.owner_role}
          </span>
        </div>
        <div className="field">
          <label htmlFor="per">Raporlama dönemi</label>
          <select id="per" value={period} onChange={(e) => setPeriod(e.target.value)}>
            {periods.map((p) => (
              <option key={p.id} value={p.id}>
                {p.start} → {p.end}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="fac">Tesis (isteğe bağlı)</label>
          <select id="fac" value={facility} onChange={(e) => setFacility(e.target.value)}>
            <option value="">Kurum geneli</option>
            {facilities.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="ps">Aralık başı (boş = dönem başı)</label>
          <input id="ps" type="date" value={ps} onChange={(e) => setPs(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="pe">Aralık sonu (boş = dönem sonu)</label>
          <input id="pe" type="date" value={pe} onChange={(e) => setPe(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="vs">Değer durumu</label>
          <select id="vs" value={vs} onChange={(e) => setVs(e.target.value as ValueState)}>
            {(Object.keys(VS_LABEL) as ValueState[]).map((k) => (
              <option key={k} value={k}>
                {VS_LABEL[k]}
              </option>
            ))}
          </select>
        </div>
        {vs === "known" && (
          <div className="field">
            <label htmlFor="val">Değer</label>
            <input id="val" inputMode="decimal" value={value} onChange={(e) => setValue(e.target.value)} placeholder="ör. 1250,5" />
          </div>
        )}
        {vs === "not_applicable" && (
          <div className="field">
            <label htmlFor="na">Gerekçe</label>
            <input id="na" value={na} onChange={(e) => setNa(e.target.value)} />
          </div>
        )}
        <div className="field">
          <label htmlFor="unit">Birim (sözlük: {def.unit})</label>
          <input id="unit" value={unit} onChange={(e) => setUnit(e.target.value)} />
          <span className="hint">Farklı birim yazılırsa satır düzeltme kuyruğuna gider; dönüşüm yapılmaz.</span>
        </div>
        <div className="field">
          <label htmlFor="dq">Veri niteliği</label>
          <select id="dq" value={dq} onChange={(e) => setDq(e.target.value as DataQuality)}>
            <option value="measured">Ölçülmüş</option>
            <option value="estimated">Tahmini</option>
          </select>
        </div>
        {def.dimensions.map((d) => (
          <div className="field" key={d.id}>
            <label htmlFor={`dim-${d.id}`}>{d.name.tr}</label>
            <select id={`dim-${d.id}`} value={dims[d.id] ?? ""} onChange={(e) => setDims({ ...dims, [d.id]: e.target.value })}>
              <option value="">Seçin</option>
              {d.values.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.tr}
                </option>
              ))}
            </select>
          </div>
        ))}
        <div className="field">
          <label htmlFor="ev">Kanıt notu</label>
          <input id="ev" value={ev} onChange={(e) => setEv(e.target.value)} placeholder="fatura no, sayaç, rapor adı" />
        </div>
      </div>
      <div className="actions" style={{ marginTop: "0.8rem" }}>
        <button className="primary" onClick={submit} disabled={!period}>
          Kaydet
        </button>
        <span className="small muted">Yetki: performans.indicator.write (veri giren, veri sorumlusu, yönetici)</span>
      </div>
      <RecentValues store={store} cat={cat} />
    </div>
  );
}

function RecentValues({ store, cat }: { store: Store; cat: IndicatorDef[] }) {
  const rows = acceptedValues(store).slice().reverse().slice(0, 12);
  if (!rows.length) return <p className="small muted" style={{ marginTop: "0.8rem" }}>Henüz kabul edilmiş gösterge değeri yok.</p>;
  const per = (id: string) => store.periods().find((p) => p.id === id);
  return (
    <details style={{ marginTop: "0.8rem" }}>
      <summary className="small">Son kabul edilen değerler ({rows.length})</summary>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Gösterge</th>
              <th>Dönem</th>
              <th>Değer</th>
              <th>Nitelik</th>
              <th>Kanıt notu</th>
              <th>Kayıt</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td>
                  {cat.find((i) => i.id === r.indicator_id)?.name.tr ?? r.indicator_id}
                  {Object.keys(r.dimensions).length > 0 && <div className="pf-state">{Object.entries(r.dimensions).map(([k, v]) => `${k}=${v}`).join(", ")}</div>}
                </td>
                <td className="small">{per(r.period_id) ? `${r.period_start} → ${r.period_end}` : r.period_id}</td>
                <td className="num">{r.value_state === "known" ? `${fmtDec(r.value)} ${r.unit}` : r.value_state === "unknown" ? "bilinmiyor" : `uygulanamaz: ${r.na_reason}`}</td>
                <td>{r.data_quality === "estimated" ? <span className="badge warn">tahmini</span> : "ölçülmüş"}</td>
                <td className="small">{r.evidence_note || "—"}</td>
                <td className="small">{fmtDate(r.created_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}

// ---------------- Düzeltme kuyruğu ----------------
function FixQueue({ store, cat }: { store: Store; cat: IndicatorDef[] }) {
  const q = fixQueue(store);
  const [edit, setEdit] = useState<{ id: string; value: string; unit: string; ps: string; pe: string } | null>(null);
  const [err, setErr] = useState<unknown>(null);
  const [msg, setMsg] = useState("");
  const apply = () => {
    if (!edit) return;
    setErr(null);
    try {
      const row = fixIndicatorValue(store, edit.id, { value: edit.value.trim().replace(",", "."), unit: edit.unit.trim(), period_start: edit.ps, period_end: edit.pe });
      setMsg(row.status === "accepted" ? "Düzeltme kabul edildi; eski satır korundu." : `Yeni sürüm de düzeltme bekliyor: ${row.findings.join(" ")}`);
      setEdit(null);
    } catch (e) {
      setErr(e);
    }
  };
  return (
    <div className="card">
      <h2>Düzeltme kuyruğu ({q.length})</h2>
      <p className="small">Veri sözleşmesi bulgusu olan satırlar. Düzeltme yeni sürüm olarak kaydedilir; eski satır silinmez (kural 9).</p>
      <ErrorBox error={err} />
      {msg && (
        <Notice kind="ok">
          <p>{msg}</p>
        </Notice>
      )}
      {q.length === 0 ? (
        <p className="muted">Kuyruk boş: bekleyen bulgu yok.</p>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Gösterge</th>
                <th>Girilen</th>
                <th>Bulgular</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {q.map((r) => (
                <tr key={r.id}>
                  <td>
                    {cat.find((i) => i.id === r.indicator_id)?.name.tr ?? r.indicator_id}
                    <div className="pf-state">
                      {r.period_start} → {r.period_end}
                    </div>
                  </td>
                  <td className="num">{r.value_state === "known" ? `${r.value} ${r.unit}` : r.value_state}</td>
                  <td>
                    <ul className="small" style={{ margin: 0, paddingLeft: "1rem" }}>
                      {r.findings.map((f, i) => (
                        <li key={i}>{f}</li>
                      ))}
                    </ul>
                  </td>
                  <td>
                    {edit?.id === r.id ? (
                      <div className="stack">
                        <input aria-label="Değer" value={edit.value} onChange={(e) => setEdit({ ...edit, value: e.target.value })} />
                        <input aria-label="Birim" value={edit.unit} onChange={(e) => setEdit({ ...edit, unit: e.target.value })} />
                        <input aria-label="Aralık başı" type="date" value={edit.ps} onChange={(e) => setEdit({ ...edit, ps: e.target.value })} />
                        <input aria-label="Aralık sonu" type="date" value={edit.pe} onChange={(e) => setEdit({ ...edit, pe: e.target.value })} />
                        <div className="actions">
                          <button className="primary" onClick={apply}>
                            Yeni sürüm kaydet
                          </button>
                          <button onClick={() => setEdit(null)}>Vazgeç</button>
                        </div>
                      </div>
                    ) : (
                      <button onClick={() => setEdit({ id: r.id, value: r.value ?? "", unit: r.unit, ps: r.period_start, pe: r.period_end })}>Düzelt</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ---------------- Sözlük ----------------
function Dictionary({ cat }: { cat: IndicatorDef[] }) {
  return (
    <div className="card">
      <h2>Gösterge sözlüğü ve veri sözleşmesi (GÖS-01, GÖS-02)</h2>
      <p className="small">Çekirdek paket her sektörde vardır; sektöre özgü göstergeler ve paydalar kurumun sektör profilinden okunur (veri, kod değil — SEK-02). Kaynak: content/indicators, content/sector-profiles.</p>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Gösterge</th>
              <th>Aile</th>
              <th>Birim</th>
              <th>Kaynak sistem</th>
              <th>Veri sahibi (rol)</th>
              <th>Sıklık</th>
              <th>Giriş</th>
              <th>Erişim</th>
              <th>Kalite kuralı</th>
              <th>Köken</th>
            </tr>
          </thead>
          <tbody>
            {cat.map((i) => (
              <tr key={i.id}>
                <td>
                  <b>{i.name.tr}</b>
                  <div className="small muted">{i.definition}</div>
                </td>
                <td className="small">{FAMILY_LABEL[i.family]}</td>
                <td className="mono small">{i.unit}</td>
                <td className="small">{i.source_system}</td>
                <td className="small">{i.owner_role}</td>
                <td className="small">{FREQ_LABEL[i.frequency]}</td>
                <td className="small">{ENTRY_LABEL[i.entry]}</td>
                <td className="small">{ACCESS_LABEL[i.access]}</td>
                <td className="small">
                  {i.quality.allow_negative ? "negatif olabilir" : "negatif olamaz"}
                  {i.quality.max !== null && `; üst sınır ${i.quality.max}`}
                  {i.quality.consistency.map((c) => `; ${c.rule === "lte" ? "≤" : "≥"} ${c.other}`).join("")}
                  ; birim ve dönem aralığı eşleşmeli
                </td>
                <td className="small">{i.origin.kind === "core" ? `çekirdek ${i.origin.package} v${i.origin.version}` : `profil ${i.origin.profile_id} v${i.origin.version}`}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ---------------- Hedef kartı ----------------
function Targets({ store, cat, period }: { store: Store; cat: IndicatorDef[]; period: string }) {
  const list = targets(store);
  const devs = detectDeviations(store, period);
  const periods = store.periods();
  const dens = denominators(store);
  const numerators = cat.filter((i) => i.entry !== "profile_denominator" && i.family !== "denominator");
  const [err, setErr] = useState<unknown>(null);
  const [msg, setMsg] = useState("");
  const [open, setOpen] = useState(false);
  const [f, setF] = useState<TargetInput>({ title: "", kind: "absolute", indicator_id: "scope1_kgco2e", denominator_id: dens[0]?.id ?? null, base_period_id: periods[0]?.id ?? "", target_year: "2030", target_value: "", direction: "decrease", covered_sources: [], milestones: [], owner_role: "admin", owner_unit: "", status: "active", deviation_tolerance_pct: "5", note: "" });
  const [ms, setMs] = useState({ year: "", value: "" });
  const save = () => {
    setErr(null);
    try {
      const t = saveTarget(store, { ...f, target_value: f.target_value.replace(",", "."), denominator_id: f.kind === "intensity" ? f.denominator_id : null });
      setMsg(`Hedef kartı kaydedildi (bu tarayıcıda): ${t.title} · durum ${TARGET_STATUS_LABEL[t.status]} · sonraki adım: dönem değerleri girildikçe sapma burada ve Karar kapısında görünür.`);
      setOpen(false);
    } catch (e) {
      setErr(e);
    }
  };
  const setStatus = (id: string, status: TargetInput["status"], version: number) => {
    setErr(null);
    try {
      updateTarget(store, id, { status }, `durum: ${status}`, version);
    } catch (e) {
      setErr(e);
    }
  };
  const name = (id: string | null) => (id ? cat.find((i) => i.id === id)?.name.tr ?? id : "—");
  return (
    <div className="card">
      <h2>Hedef kartı (§22) ve KPI sapması</h2>
      <p className="small">Hedef: baz yıl/dönem, hedef yılı, kapsanan kaynaklar, mutlak veya yoğunluk, ara hedefler, sorumlu rol/birim (kişi değil), durum. Sapma eşiği kurumun kararıdır; kodda eşik yoktur.</p>
      <ErrorBox error={err} />
      {msg && (
        <Notice kind="ok">
          <p>{msg}</p>
        </Notice>
      )}
      {list.length === 0 ? <p className="muted">Henüz hedef kartı yok. Yönetici veya onaylayan rolüyle ekleyin.</p> : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Hedef</th>
                <th>Tür</th>
                <th>Baz → hedef yılı</th>
                <th>Hedef değer</th>
                <th>Ara hedefler</th>
                <th>Sorumlu</th>
                <th>Durum</th>
                <th>Seçili dönemde sapma</th>
              </tr>
            </thead>
            <tbody>
              {list.map((t) => {
                const d = devs.find((x) => x.target.id === t.id);
                const bp = periods.find((p) => p.id === t.base_period_id);
                return (
                  <tr key={t.id}>
                    <td>
                      <b>{t.title}</b>
                      <div className="small muted">
                        {name(t.indicator_id)}
                        {t.kind === "intensity" && ` / ${name(t.denominator_id)}`} · kaynaklar: {t.covered_sources.length ? t.covered_sources.length : "tümü"}
                      </div>
                    </td>
                    <td>{t.kind === "absolute" ? "mutlak" : "yoğunluk"}</td>
                    <td className="small">
                      {bp ? bp.start.slice(0, 4) : "?"} → {t.target_year}
                    </td>
                    <td className="num">
                      {fmtDec(t.target_value)} ({t.direction === "decrease" ? "azalt" : "artır"})
                    </td>
                    <td className="small">{t.milestones.length ? t.milestones.map((m) => `${m.year}: ${fmtDec(m.value)}`).join(", ") : "—"}</td>
                    <td className="small">
                      {t.owner_role in ROLE_LABEL ? ROLE_LABEL[t.owner_role as keyof typeof ROLE_LABEL] : t.owner_role}
                      {t.owner_unit && ` · ${t.owner_unit}`}
                    </td>
                    <td>
                      <span className={`badge ${t.status === "active" ? "ok" : t.status === "missed" ? "crit" : "neutral"}`}>{TARGET_STATUS_LABEL[t.status]}</span>
                      {t.status === "draft" && <button style={{ marginLeft: "0.4rem" }} onClick={() => setStatus(t.id, "active", t.version)}>Etkinleştir</button>}
                      {t.status === "active" && <button style={{ marginLeft: "0.4rem" }} onClick={() => setStatus(t.id, "retired", t.version)}>Kaldır</button>}
                    </td>
                    <td>
                      {!d ? <span className="small muted">yalnız etkin hedefler izlenir</span> : d.deviates === null ? <span className="badge warn">ölçülemedi: {d.note}</span> : d.deviates ? <span className="badge crit">sapma %{d.deviation_pct} (ref. {d.reference_year}: {fmtDec(d.reference)})</span> : <span className="badge ok">eşik içinde (%{d.deviation_pct})</span>}
                      {d && d.deviates && (
                        <div className="small">
                          <Link href="/aksiyon/">Karar kapısında aksiyon başlat →</Link>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {!open ? (
        <button style={{ marginTop: "0.6rem" }} onClick={() => setOpen(true)}>
          Yeni hedef kartı
        </button>
      ) : (
        <div style={{ marginTop: "0.8rem" }}>
          <div className="pf-inline-form">
            <div className="field">
              <label htmlFor="tt">Başlık</label>
              <input id="tt" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} />
            </div>
            <div className="field">
              <label htmlFor="tk">Tür</label>
              <select id="tk" value={f.kind} onChange={(e) => setF({ ...f, kind: e.target.value as TargetInput["kind"] })}>
                <option value="absolute">Mutlak</option>
                <option value="intensity">Yoğunluk</option>
              </select>
            </div>
            <div className="field">
              <label htmlFor="ti">Gösterge (pay)</label>
              <select id="ti" value={f.indicator_id} onChange={(e) => setF({ ...f, indicator_id: e.target.value })}>
                {numerators.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.name.tr} [{i.unit}]
                  </option>
                ))}
              </select>
            </div>
            {f.kind === "intensity" && (
              <div className="field">
                <label htmlFor="td">Payda (profil)</label>
                <select id="td" value={f.denominator_id ?? ""} onChange={(e) => setF({ ...f, denominator_id: e.target.value || null })}>
                  <option value="">Seçin</option>
                  {dens.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name.tr} [{d.unit}]
                    </option>
                  ))}
                </select>
              </div>
            )}
            <div className="field">
              <label htmlFor="tb">Baz dönem</label>
              <select id="tb" value={f.base_period_id} onChange={(e) => setF({ ...f, base_period_id: e.target.value })}>
                {periods.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.start} → {p.end}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="ty">Hedef yılı</label>
              <input id="ty" value={f.target_year} onChange={(e) => setF({ ...f, target_year: e.target.value })} />
            </div>
            <div className="field">
              <label htmlFor="tv">Hedef değer</label>
              <input id="tv" inputMode="decimal" value={f.target_value} onChange={(e) => setF({ ...f, target_value: e.target.value })} />
            </div>
            <div className="field">
              <label htmlFor="tdir">Yön</label>
              <select id="tdir" value={f.direction} onChange={(e) => setF({ ...f, direction: e.target.value as TargetInput["direction"] })}>
                <option value="decrease">Azaltım</option>
                <option value="increase">Artış</option>
              </select>
            </div>
            <div className="field">
              <label htmlFor="tor">Sorumlu rol</label>
              <select id="tor" value={f.owner_role} onChange={(e) => setF({ ...f, owner_role: e.target.value })}>
                {Object.entries(ROLE_LABEL).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="tou">Sorumlu birim</label>
              <input id="tou" value={f.owner_unit} onChange={(e) => setF({ ...f, owner_unit: e.target.value })} placeholder="ör. Enerji" />
            </div>
            <div className="field">
              <label htmlFor="ttol">Sapma eşiği (%)</label>
              <input id="ttol" inputMode="decimal" value={f.deviation_tolerance_pct} onChange={(e) => setF({ ...f, deviation_tolerance_pct: e.target.value })} />
            </div>
            <div className="field">
              <label htmlFor="tsrc">Kapsanan kaynaklar</label>
              <select id="tsrc" multiple value={f.covered_sources} onChange={(e) => setF({ ...f, covered_sources: Array.from(e.target.selectedOptions).map((o) => o.value) })}>
                {store.sources().map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
              <span className="hint">Boş = tüm kaynaklar</span>
            </div>
            <div className="field">
              <label>Ara hedef ekle</label>
              <div className="actions">
                <input aria-label="Ara hedef yılı" placeholder="yıl" value={ms.year} onChange={(e) => setMs({ ...ms, year: e.target.value })} style={{ maxWidth: 90 }} />
                <input aria-label="Ara hedef değeri" placeholder="değer" value={ms.value} onChange={(e) => setMs({ ...ms, value: e.target.value })} style={{ maxWidth: 120 }} />
                <button
                  onClick={() => {
                    if (ms.year && ms.value) {
                      setF({ ...f, milestones: [...f.milestones, { year: ms.year, value: ms.value.replace(",", ".") }] });
                      setMs({ year: "", value: "" });
                    }
                  }}
                >
                  Ekle
                </button>
              </div>
              <span className="hint">{f.milestones.map((m) => `${m.year}: ${m.value}`).join(", ") || "yok"}</span>
            </div>
          </div>
          <div className="actions" style={{ marginTop: "0.6rem" }}>
            <button className="primary" onClick={save}>
              Hedefi kaydet
            </button>
            <button onClick={() => setOpen(false)}>Vazgeç</button>
            <span className="small muted">Yetki: performans.target.write (yönetici, onaylayan)</span>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------- RACI ----------------
function Raci({ store }: { store: Store }) {
  const rows = raciRows(store);
  const d = raciDefaults();
  const [edit, setEdit] = useState<{ process_id: string; process: string; responsible: string; accountable: string; consulted: string; informed: string; deliverable: string; metric: string } | null>(null);
  const [err, setErr] = useState<unknown>(null);
  const split = (s: string) => s.split(",").map((x) => x.trim()).filter(Boolean);
  const save = () => {
    if (!edit) return;
    setErr(null);
    try {
      saveRaci(store, { process_id: edit.process_id, process: edit.process, responsible: split(edit.responsible), accountable: edit.accountable.trim(), consulted: split(edit.consulted), informed: split(edit.informed), deliverable: edit.deliverable, metric: edit.metric }, "RACI düzenlendi");
      setEdit(null);
    } catch (e) {
      setErr(e);
    }
  };
  return (
    <div className="card">
      <h2>RACI — süreç başına sorumluluk (birim düzeyi)</h2>
      <p className="small">
        Varsayılan satırlar forum yönetim modeli tablosundan (content/raci v{d.version}); kurum satırı düzenlendiğinde varsayılanın yerine geçer. R = yapan, A = hesap veren (tek birim), C = danışılan, I = bilgilendirilen. Kişi adı girilmez.
      </p>
      <ErrorBox error={err} />
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Süreç</th>
              <th>R</th>
              <th>A</th>
              <th>C</th>
              <th>I</th>
              <th>Teslimat</th>
              <th>Ölçüt</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ row, custom }) => (
              <tr key={row.process_id}>
                <td>
                  <b>{row.process}</b> {custom ? <span className="badge accent">kurum</span> : <span className="badge neutral">varsayılan</span>}
                </td>
                <td className="small">{row.responsible.join(", ")}</td>
                <td className="small">{row.accountable}</td>
                <td className="small">{row.consulted.join(", ")}</td>
                <td className="small">{row.informed.join(", ")}</td>
                <td className="small">{row.deliverable}</td>
                <td className="small">{row.metric}</td>
                <td>
                  <button onClick={() => setEdit({ process_id: row.process_id, process: row.process, responsible: row.responsible.join(", "), accountable: row.accountable, consulted: row.consulted.join(", "), informed: row.informed.join(", "), deliverable: row.deliverable, metric: row.metric })}>Düzenle</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {edit && (
        <div style={{ marginTop: "0.8rem" }}>
          <h3>{edit.process}</h3>
          <div className="pf-inline-form">
            {(["responsible", "accountable", "consulted", "informed", "deliverable", "metric"] as const).map((k) => (
              <div className="field" key={k}>
                <label htmlFor={`raci-${k}`}>{{ responsible: "R (virgülle)", accountable: "A (tek birim)", consulted: "C (virgülle)", informed: "I (virgülle)", deliverable: "Teslimat", metric: "Ölçüt" }[k]}</label>
                <input id={`raci-${k}`} value={edit[k]} onChange={(e) => setEdit({ ...edit, [k]: e.target.value })} />
              </div>
            ))}
          </div>
          <div className="actions" style={{ marginTop: "0.6rem" }}>
            <button className="primary" onClick={save}>
              Kaydet (yetki: performans.raci.write)
            </button>
            <button onClick={() => setEdit(null)}>Vazgeç</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------- İki hedefin durumu ----------------
function TwoGoalsCard({ store, period }: { store: Store; period: string }) {
  const g = useMemo(() => twoGoals(store, period), [store, period]);
  const [sat, setSat] = useState({ quarter: "", unit: "", score: "", scale_note: "1–5", respondents: "", method_note: "anonim çeyreklik anket" });
  const [err, setErr] = useState<unknown>(null);
  const [msg, setMsg] = useState("");
  const saveSat = () => {
    setErr(null);
    try {
      const r = saveSatisfaction(store, { ...sat, score: sat.score.replace(",", ".") });
      setMsg(`Kaydedildi (bu tarayıcıda): ${r.unit} ${r.quarter} skor ${r.score}, ${r.respondents} katılımcı.`);
      setSat({ ...sat, score: "", respondents: "" });
    } catch (e) {
      setErr(e);
    }
  };
  const intBars: BarRow[] = g.efficiency.intensities.map((i) => ({ label: i.label, value: i.result.value, unit: i.result.unit, variant: "plain", note: i.result.status === "ok" ? "" : i.result.reason }));
  return (
    <div className="card">
      <h2>İki hedefin durumu (seçili dönem B)</h2>
      <div className="pf-side">
        <div>
          <h3>Hedef 1 · Verimlilik</h3>
          <p className="small">Profildeki yoğunluklar ve atık/fire göstergeleri. Payda girilmemiş satırlar çizilmez (sıfır değil, bilinmiyor).</p>
          {intBars.length ? <Bars title="Yoğunluklar" rows={intBars} /> : <p className="muted">Profilde payda yok.</p>}
          <dl className="kv" style={{ marginTop: "0.6rem" }}>
            {g.efficiency.indicators.map((i) => (
              <div key={i.label} style={{ display: "contents" }}>
                <dt>{i.label}</dt>
                <dd>
                  <PeriodValueCell v={i.value} />
                </dd>
              </div>
            ))}
          </dl>
        </div>
        <div>
          <h3>Hedef 2 · Çalışan memnuniyeti</h3>
          <p className="small">Öneri sayısı ve uygulanma oranı birim düzeyinde; bağlılık skoru anonim çeyreklik toplulaştırma (K-10). Kişi bazlı liste yoktur (kural 11).</p>
          <dl className="kv">
            <dt>Öneri (toplam / aktarılan)</dt>
            <dd>
              {g.satisfaction.total_suggestions} / {g.satisfaction.total_transferred} · <Link href="/kaizen/">Green Kaizen</Link>
            </dd>
            <dt>Kişi başı eğitim saati</dt>
            <dd>
              <PeriodValueCell v={g.satisfaction.training_per_fte} />
            </dd>
          </dl>
          {g.satisfaction.units.length > 0 && (
            <Bars title="Birim bazında uygulanan öneri oranı" rows={g.satisfaction.units.map((u) => ({ label: u.unit, value: u.implementation_rate_pct, unit: "%", variant: "plain" as const, note: `${u.implemented}/${u.received} öneri` }))} />
          )}
          {g.satisfaction.latest_scores.length ? (
            <Bars title="Son çeyrek memnuniyet skoru (birim)" rows={g.satisfaction.latest_scores.map((x) => ({ label: `${x.unit} · ${x.quarter}`, value: x.score, unit: x.scale_note, variant: "plain" as const, note: `${x.respondents} katılımcı` }))} />
          ) : (
            <p className="muted small">Henüz memnuniyet toplulaştırması girilmedi.</p>
          )}
          <details style={{ marginTop: "0.6rem" }}>
            <summary className="small">Çeyreklik memnuniyet toplulaştırması gir (İK; yetki: performans.satisfaction.write)</summary>
            <ErrorBox error={err} />
            {msg && (
              <Notice kind="ok">
                <p>{msg}</p>
              </Notice>
            )}
            <div className="pf-inline-form">
              <div className="field">
                <label htmlFor="sq">Çeyrek</label>
                <input id="sq" placeholder="2026-Q1" value={sat.quarter} onChange={(e) => setSat({ ...sat, quarter: e.target.value })} />
              </div>
              <div className="field">
                <label htmlFor="su">Birim</label>
                <input id="su" value={sat.unit} onChange={(e) => setSat({ ...sat, unit: e.target.value })} />
              </div>
              <div className="field">
                <label htmlFor="ss">Skor</label>
                <input id="ss" inputMode="decimal" value={sat.score} onChange={(e) => setSat({ ...sat, score: e.target.value })} />
              </div>
              <div className="field">
                <label htmlFor="ssc">Ölçek</label>
                <input id="ssc" value={sat.scale_note} onChange={(e) => setSat({ ...sat, scale_note: e.target.value })} />
              </div>
              <div className="field">
                <label htmlFor="sr">Katılımcı sayısı</label>
                <input id="sr" inputMode="numeric" value={sat.respondents} onChange={(e) => setSat({ ...sat, respondents: e.target.value })} />
              </div>
            </div>
            <button className="primary" style={{ marginTop: "0.5rem" }} onClick={saveSat}>
              Kaydet
            </button>
          </details>
        </div>
      </div>
    </div>
  );
}
