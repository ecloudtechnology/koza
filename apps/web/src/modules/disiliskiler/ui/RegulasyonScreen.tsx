"use client";
// Regülasyon uyum paketleri ekranı (REG-01…06, §08, §19). Veri: regulation.ts; içerik: content/regulation-packages.
import Link from "next/link";
import { useState } from "react";
import { ROLE_LABEL } from "@/lib/domain";
import { sha256Hex } from "@/lib/hash";
import { useStore, fmtDate, fmtDec } from "@/lib/useStore";
import { ErrorBox, Loading, NoTenant, Notice, PageHeader } from "@/components/ui";
import type { Store } from "@/lib/store";
import type { PublicationStatus, RegulationPackage } from "../content";
import {
  addCarbonCost, addMonitoringPlanVersion, assessments, buildCarbonCostPack, carbonCostPackMarkdown, carbonCosts, changeCards, createChangeCard, decideChangeCard, decidePackage, effectiveRules, latestAssessment, monitoringPlans,
  packageState, packages, productStudies, recordAssessment, recordSourceVersion, sourceVersions, touchSourceCheck, type MonitoringEntry, type PackageState,
} from "../regulation";
import { PREVIEW_NOTE, Tabs, downloadText, useAction } from "./common";

const STATE: Record<PackageState | "none", { label: string; cls: string }> = {
  none: { label: "Değerlendirilmedi", cls: "neutral" },
  closed: { label: "Kapalı / uygulanmaz", cls: "neutral" },
  review_required: { label: "İnceleme gerekli", cls: "warn" },
  open: { label: "Açık", cls: "ok" },
};
const RESULT: Record<string, { label: string; cls: string }> = {
  applicable: { label: "Uygulanır", cls: "ok" },
  not_applicable: { label: "Uygulanmaz", cls: "neutral" },
  review_required: { label: "İnceleme gerekli — doğrulanmamış", cls: "warn" },
};
const PUB: Record<PublicationStatus, string> = { draft: "taslak", consultation: "istişare", in_force: "yürürlükte", unknown: "bilinmiyor" };
const TABS = [
  { id: "uyg", label: "Uygulanabilirlik ve karar" },
  { id: "kural", label: "Kurallar ve kaynak izleme (§19)" },
  { id: "yuk", label: "Yükümlülükler ve kanıt" },
];

export default function RegulasyonScreen() {
  const { store, ready } = useStore();
  const [pid, setPid] = useState(packages()[0]?.id ?? "");
  const [tab, setTab] = useState("uyg");
  if (!ready || !store) return <Loading />;
  if (!store.tenant) return <NoTenant />;
  const pkg = packages().find((p) => p.id === pid) ?? packages()[0];
  return (
    <>
      <PageHeader eyebrow={`Regülasyon paketleri · REG-01…06 · §08 · §19 · rol: ${ROLE_LABEL[store.role]}`} title="Regülasyon uyum paketleri" lead="Her yükümlülük ayrı, sürümlü bir pakettir ve §08 uygulanabilirlik değerlendirmesiyle açılır. Eşik, tarih ve benchmark koda yazılmaz; kaynak metni uzman onayıyla doğrulanmadan kural etkinleşmez ve sonuç 'inceleme gerekli' kalır. Açık paket görev üretir; kapalı veya taslak hiçbir zaman üretmez." />
      <Notice kind="warn" title="Açık kararlar (karar kaydı)">
        <p>K-06 ulusal ETS ikincil mevzuat/MRV/tahsis, K-07 CBAM'de ödenen karbon fiyatının kanıt formatı, K-08 TSRS uygulanabilirliği açıktır. Bu ekrandaki tüm eşikler "doğrulanmamış" görünür; uzman kaynak sürümünü onaylayana kadar paket açılamaz.</p>
      </Notice>
      <div className="dis-pkg">
        {packages().map((p) => {
          const st = packageState(store, p.id);
          return (
            <button key={p.id} type="button" className="pkg" aria-pressed={p.id === pkg.id} onClick={() => setPid(p.id)}>
              <span className="t">{p.title.tr}</span>
              <span className={`badge ${STATE[st?.state ?? "none"].cls}`}>{STATE[st?.state ?? "none"].label}</span>
              <span className="small muted">
                v{p.version} · {p.decision_owner.decision_ref ?? "karar sahibi"}: {p.decision_owner.role}
              </span>
            </button>
          );
        })}
      </div>
      <Tabs items={TABS} value={tab} onChange={setTab} />
      {tab === "uyg" && <Uygulanabilirlik store={store} pkg={pkg} />}
      {tab === "kural" && <Kurallar store={store} pkg={pkg} />}
      {tab === "yuk" && <Yukumlulukler store={store} pkg={pkg} />}
    </>
  );
}

// ---------- Uygulanabilirlik (§08) ve karar ----------
function Uygulanabilirlik({ store, pkg }: { store: Store; pkg: RegulationPackage }) {
  const act = useAction();
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [reason, setReason] = useState("");
  const st = packageState(store, pkg.id);
  const last = latestAssessment(store, pkg.id);
  const history = assessments(store, pkg.id).slice().reverse();
  const rules = effectiveRules(store, pkg.id);
  const canAssess = ["admin", "data_owner", "reviewer", "approver"].includes(store.role);
  const canDecide = ["reviewer", "approver", "admin"].includes(store.role);
  return (
    <>
      <ErrorBox error={act.err} />
      {act.ok && <Notice kind="ok">{act.ok}</Notice>}
      <div className="grid-2">
        <div className="card">
          <h2>{pkg.title.tr}</h2>
          <p className="small">{pkg.scope.tr}</p>
          <p className="small muted">
            Şartname: {pkg.spec_sections.join(", ")} · kaynak kartları: {pkg.sources.map((c) => <Link key={c} href="/protokoller/">{c} </Link>)}
          </p>
          <h3>Uygulanabilirlik soruları</h3>
          <form onSubmit={(e) => { e.preventDefault(); act.run(() => { const a = recordAssessment(store, pkg.id, answers); return `Değerlendirme kaydedildi: ${RESULT[a.result].label}. ${PREVIEW_NOTE} ${a.result === "applicable" ? "Sonraki adım: karar sahibi paketi açar." : a.result === "review_required" ? "Sonraki adım: 'Kurallar ve kaynak izleme' sekmesinde kaynak sürümü ve uzman onayı." : "Karar sahibi paketi kapatabilir."}`; }); }}>
            {pkg.applicability_questions.map((q) => {
              const rule = q.rule_ref ? rules.find((r) => r.id === q.rule_ref) : null;
              return (
                <div className="field" key={q.id}>
                  <label>{q.text.tr}</label>
                  <div className="radio-list">
                    {q.options.map((o) => (
                      <label key={o.value}>
                        <input type="radio" name={`${pkg.id}-${q.id}`} checked={answers[q.id] === o.value} onChange={() => setAnswers({ ...answers, [q.id]: o.value })} />
                        <span>{o.label}</span>
                      </label>
                    ))}
                  </div>
                  {q.hint && <span className="hint">{q.hint}</span>}
                  {rule && (
                    <span className="hint">
                      Dayanak kural <code>{rule.id}</code>: eşik {rule.threshold ? `${fmtDec(rule.threshold.value)} ${rule.threshold.unit}` : "doğrulanmamış"} ·{" "}
                      <span className={`badge ${rule.source_status === "verified" ? "ok" : "warn"}`}>{rule.source_status === "verified" ? "doğrulanmış" : "doğrulanmamış → inceleme gerekli"}</span>
                    </span>
                  )}
                </div>
              );
            })}
            <div className="actions">
              <button className="primary" type="submit" disabled={!canAssess || act.busy}>
                Değerlendir ve kaydet
              </button>
              {!canAssess && <span className="small muted">İzleyici değerlendiremez.</span>}
            </div>
          </form>
        </div>
        <div className="card">
          <h2>Durum ve karar</h2>
          <dl className="kv">
            <dt>Paket durumu</dt>
            <dd>
              <span className={`badge ${STATE[st?.state ?? "none"].cls}`}>{STATE[st?.state ?? "none"].label}</span>
              {st && (
                <span className="small muted">
                  {" "}
                  · {st.decided_by} · {st.decided_at && fmtDate(st.decided_at)} · {st.reason} · {st.task_ids.length} görev
                </span>
              )}
            </dd>
            <dt>Karar sahibi</dt>
            <dd>
              {pkg.decision_owner.role} {pkg.decision_owner.decision_ref && <>(açık karar <Link href="/belgeler/?d=karar-kaydi">{pkg.decision_owner.decision_ref}</Link>)</>}
            </dd>
          </dl>
          {!last ? (
            <p className="muted">Henüz değerlendirme yok. Soruları cevaplayıp kaydedin.</p>
          ) : (
            <div className="card quiet">
              <div className="spread">
                <b>Son değerlendirme · {fmtDate(last.created_at)}</b>
                <span className={`badge ${RESULT[last.result].cls}`}>{RESULT[last.result].label}</span>
              </div>
              <ul className="small">
                {last.reasons.map((r, i) => (
                  <li key={i}>{r}</li>
                ))}
              </ul>
              {last.rule_versions_used.length > 0 && (
                <p className="small muted">Kullanılan kural sürümleri: {last.rule_versions_used.map((r) => `${r.id} (${r.source_status}${r.effective_from ? `, ${r.effective_from}` : ""})`).join("; ")}</p>
              )}
              {last.decision ? (
                <p className="small">
                  Karar: <b>{STATE[last.decision].label}</b> · {last.decided_by} · {last.decided_at && fmtDate(last.decided_at)} · {last.decision_reason}
                </p>
              ) : (
                <>
                  <div className="field">
                    <label htmlFor="dreason">Karar gerekçesi</label>
                    <input id="dreason" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="ör. ihracat yok; ya da uzman kuralları onayladı" />
                  </div>
                  <div className="actions">
                    <button className="primary" disabled={!canDecide || act.busy || last.result !== "applicable"} onClick={() => act.run(() => { const s2 = decidePackage(store, last.id, "open", reason); setReason(""); return `Paket açıldı; ${s2.task_ids.length} yükümlülük görevi oluştu. ${PREVIEW_NOTE}`; })}>
                      Paketi aç
                    </button>
                    <button disabled={!canDecide || act.busy} onClick={() => act.run(() => { decidePackage(store, last.id, "review_required", reason); setReason(""); return `Paket 'inceleme gerekli' olarak işaretlendi. ${PREVIEW_NOTE}`; })}>
                      İnceleme gerekli
                    </button>
                    <button disabled={!canDecide || act.busy} onClick={() => act.run(() => { decidePackage(store, last.id, "closed", reason); setReason(""); return `Paket kapatıldı; görev üretilmedi. ${PREVIEW_NOTE}`; })}>
                      Kapat (uygulanmaz)
                    </button>
                  </div>
                  {last.result !== "applicable" && <p className="small muted">Açma düğmesi yalnız sonuç "uygulanır" olduğunda etkindir (kural 6). Doğrulanmamış kuralla paket açılmaz.</p>}
                  {!canDecide && <p className="small muted">Kararı uzman kontrolör, onaylayan veya kurum yöneticisi verir.</p>}
                </>
              )}
            </div>
          )}
          {history.length > 1 && (
            <details>
              <summary className="small">Geçmiş değerlendirmeler ({history.length - 1})</summary>
              <ul className="small">
                {history.slice(1).map((a) => (
                  <li key={a.id}>
                    {fmtDate(a.created_at)} · {RESULT[a.result].label} · paket v{a.package_version} {a.decision && `· karar: ${STATE[a.decision].label}`}
                  </li>
                ))}
              </ul>
            </details>
          )}
        </div>
      </div>
    </>
  );
}

// ---------- Kurallar ve kaynak izleme (§19 SRC-01…07) ----------
function Kurallar({ store, pkg }: { store: Store; pkg: RegulationPackage }) {
  const act = useAction();
  const rules = effectiveRules(store, pkg.id);
  const versions = sourceVersions(store, pkg.id).slice().reverse();
  const cards = changeCards(store, pkg.id).slice().reverse();
  const [sv, setSv] = useState({ source_ref: pkg.sources[0] ?? "", kind: "text" as "text" | "url", title: "", content: "", publication_date: "", effective_date: "", publication_status: "unknown" as PublicationStatus });
  const [cc, setCc] = useState({ old_version_id: "", new_version_id: "", changed_clause: "", summary: "", nature: "kesin" as "kesin" | "yorum", profiles: "", forms: "", calcs: "", lessons: "", rule_ids: [] as string[], values: {} as Record<string, { value: string; unit: string; effective_from: string }> });
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const canRecord = ["data_owner", "admin", "reviewer"].includes(store.role);
  const canApprove = store.role === "reviewer";
  return (
    <>
      <ErrorBox error={act.err} />
      {act.ok && <Notice kind="ok">{act.ok}</Notice>}
      <Notice kind="info" title="Statik önizlemede URL çekilmez">
        <p>SRC-02 (RSS/API/sayfa kontrolü) bu uygulamada çalışmaz. Yeni sürümü siz yapıştırır veya URL'sini kaydedersiniz; uygulama metnin SHA-256 karmasını alır (SRC-03), tam metni saklamaz (lisans, K-12; yalnız ilk 200 karakter). Yayın, yürürlük, görülme ve son kontrol tarihleri ayrı alanlardır.</p>
      </Notice>
      <div className="card">
        <h2>Kurallar — {pkg.title.tr}</h2>
        {rules.map((r) => (
          <div className="dis-rule" key={r.id}>
            <span className="k">Kural</span>
            <span>
              <code>{r.id}</code> — {r.text}
            </span>
            <span className="k">Eşik</span>
            <span>{r.threshold ? `${fmtDec(r.threshold.value)} ${r.threshold.unit}` : <span className="badge warn">doğrulanmamış</span>}</span>
            <span className="k">Kaynak</span>
            <span>
              {r.source_ref} · <span className={`badge ${r.source_status === "verified" ? "ok" : "warn"}`}>{r.source_status === "verified" ? "doğrulanmış (bu kurum için uzman onaylı)" : r.source_status}</span> · yayın: {PUB[r.publication_status]}
            </span>
            <span className="k">Tarihler</span>
            <span>
              yürürlük {r.effective_from ?? "—"} · son kontrol {r.last_checked ?? "hiç"} {r.activation_id && <span className="small muted">· etkinleştirme {r.activation_id.slice(0, 10)}</span>}
            </span>
          </div>
        ))}
      </div>
      <div className="grid-2">
        <div className="card">
          <h2>Kaynak sürümü kaydet (SRC-01/03)</h2>
          <form onSubmit={(e) => { e.preventDefault(); act.run(async () => { const v = await recordSourceVersion(store, { ...sv, package_id: pkg.id, publication_date: sv.publication_date || null, effective_date: sv.effective_date || null }); setSv({ ...sv, title: "", content: "" }); return `Kaynak sürümü kaydedildi; karma ${v.content_sha256.slice(0, 16)}…. ${PREVIEW_NOTE} Sonraki adım: değişiklik kartı.`; }); }}>
            <div className="dis-mini">
              <input aria-label="Kaynak kodu" value={sv.source_ref} onChange={(e) => setSv({ ...sv, source_ref: e.target.value })} placeholder="kaynak kodu (K16)" />
              <select aria-label="Tür" value={sv.kind} onChange={(e) => setSv({ ...sv, kind: e.target.value as "text" | "url" })}>
                <option value="text">Metin yapıştır</option>
                <option value="url">URL kaydet</option>
              </select>
              <select aria-label="Yayın durumu" value={sv.publication_status} onChange={(e) => setSv({ ...sv, publication_status: e.target.value as PublicationStatus })}>
                {(Object.keys(PUB) as PublicationStatus[]).map((k) => (
                  <option key={k} value={k}>
                    yayın: {PUB[k]}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="svt">Başlık (yayımlayan, kod, başlık, baskı yılı birlikte)</label>
              <input id="svt" value={sv.title} onChange={(e) => setSv({ ...sv, title: e.target.value })} />
            </div>
            <div className="field">
              <label htmlFor="svc">{sv.kind === "url" ? "URL" : "Metin"}</label>
              <textarea id="svc" value={sv.content} onChange={(e) => setSv({ ...sv, content: e.target.value })} />
              <span className="hint">Metindeki talimat benzeri içerik komut olarak çalıştırılmaz; yalnız karması alınır (§19).</span>
            </div>
            <div className="dis-mini">
              <label className="field">
                <span className="small">Yayın tarihi</span>
                <input type="date" value={sv.publication_date} onChange={(e) => setSv({ ...sv, publication_date: e.target.value })} />
              </label>
              <label className="field">
                <span className="small">Yürürlük tarihi</span>
                <input type="date" value={sv.effective_date} onChange={(e) => setSv({ ...sv, effective_date: e.target.value })} />
              </label>
            </div>
            <div className="actions">
              <button className="primary" type="submit" disabled={!canRecord || act.busy}>
                Sürümü kaydet ve karmala
              </button>
            </div>
          </form>
          <h3>Kaynak sürümleri ({versions.length})</h3>
          {versions.length === 0 && <p className="muted">Kayıtlı sürüm yok; "güncel" etiketi verilemez.</p>}
          {versions.map((v) => (
            <div key={v.id} className="dis-rule">
              <span className="k">Sürüm</span>
              <span>
                <b>{v.title}</b> · {v.source_ref} · {v.kind === "url" ? v.url : `${v.content_length} karakter`} · yayın: {PUB[v.publication_status]}
              </span>
              <span className="k">Karma</span>
              <span className="mono small">{v.content_sha256}</span>
              <span className="k">Tarihler</span>
              <span className="small">
                yayın {v.publication_date ?? "—"} · yürürlük {v.effective_date ?? "—"} · görülme {fmtDate(v.seen_at)} · son kontrol {fmtDate(v.last_check)}{" "}
                <button className="small" style={{ padding: "0.1rem 0.5rem" }} disabled={!canRecord} onClick={() => act.run(() => { touchSourceCheck(store, v.id); return "Son kontrol tarihi güncellendi."; })}>
                  kontrol ettim
                </button>
              </span>
            </div>
          ))}
        </div>
        <div className="card">
          <h2>Değişiklik kartı (SRC-04/06)</h2>
          {versions.length === 0 ? (
            <p className="muted">Önce kaynak sürümü kaydedin.</p>
          ) : (
            <form onSubmit={(e) => { e.preventDefault(); act.run(() => { createChangeCard(store, { package_id: pkg.id, old_version_id: cc.old_version_id || null, new_version_id: cc.new_version_id || versions[0].id, changed_clause: cc.changed_clause, summary: cc.summary, nature: cc.nature, affected: { profiles: split(cc.profiles), forms: split(cc.forms), calcs: split(cc.calcs), lessons: split(cc.lessons) }, rule_ids: cc.rule_ids, rule_values: Object.fromEntries(cc.rule_ids.map((r) => [r, { threshold: cc.values[r]?.value ? { value: cc.values[r].value, unit: cc.values[r].unit } : null, effective_from: cc.values[r]?.effective_from || null }])) }); setCc({ ...cc, changed_clause: "", summary: "", rule_ids: [], values: {} }); return `Değişiklik kartı açıldı; uzman onayı bekliyor. ${PREVIEW_NOTE}`; }); }}>
              <div className="dis-mini">
                <select aria-label="Eski sürüm" value={cc.old_version_id} onChange={(e) => setCc({ ...cc, old_version_id: e.target.value })}>
                  <option value="">eski metin: yok</option>
                  {versions.map((v) => (
                    <option key={v.id} value={v.id}>
                      eski: {v.title}
                    </option>
                  ))}
                </select>
                <select aria-label="Yeni sürüm" value={cc.new_version_id || versions[0].id} onChange={(e) => setCc({ ...cc, new_version_id: e.target.value })}>
                  {versions.map((v) => (
                    <option key={v.id} value={v.id}>
                      yeni: {v.title} ({PUB[v.publication_status]})
                    </option>
                  ))}
                </select>
                <select aria-label="Nitelik" value={cc.nature} onChange={(e) => setCc({ ...cc, nature: e.target.value as "kesin" | "yorum" })}>
                  <option value="kesin">kesin</option>
                  <option value="yorum">yorum</option>
                </select>
              </div>
              <div className="field">
                <label htmlFor="ccl">Değişen madde</label>
                <input id="ccl" value={cc.changed_clause} onChange={(e) => setCc({ ...cc, changed_clause: e.target.value })} />
              </div>
              <div className="field">
                <label htmlFor="ccs">Sade özet (orijinal metni değiştirmez)</label>
                <textarea id="ccs" value={cc.summary} onChange={(e) => setCc({ ...cc, summary: e.target.value })} />
              </div>
              <div className="dis-mini">
                <input aria-label="Etkilenen profiller" placeholder="etkilenen profiller" value={cc.profiles} onChange={(e) => setCc({ ...cc, profiles: e.target.value })} />
                <input aria-label="Etkilenen formlar" placeholder="formlar" value={cc.forms} onChange={(e) => setCc({ ...cc, forms: e.target.value })} />
                <input aria-label="Etkilenen hesaplar" placeholder="hesaplar" value={cc.calcs} onChange={(e) => setCc({ ...cc, calcs: e.target.value })} />
                <input aria-label="Etkilenen dersler" placeholder="dersler" value={cc.lessons} onChange={(e) => setCc({ ...cc, lessons: e.target.value })} />
              </div>
              <div className="field">
                <label>Doğrulanan kurallar (onaylanınca bu kurum için etkinleşir)</label>
                {pkg.rules.map((r) => (
                  <div key={r.id}>
                    <label className="check">
                      <input type="checkbox" checked={cc.rule_ids.includes(r.id)} onChange={(e) => setCc({ ...cc, rule_ids: e.target.checked ? [...cc.rule_ids, r.id] : cc.rule_ids.filter((x) => x !== r.id) })} />
                      <code>{r.id}</code>
                    </label>
                    {cc.rule_ids.includes(r.id) && (
                      <div className="dis-mini" style={{ margin: "0.2rem 0 0.4rem 1.5rem" }}>
                        <input aria-label="Eşik değeri" placeholder="eşik değeri (kaynaktan)" value={cc.values[r.id]?.value ?? ""} onChange={(e) => setCc({ ...cc, values: { ...cc.values, [r.id]: { ...(cc.values[r.id] ?? { unit: "", effective_from: "" }), value: e.target.value } } })} />
                        <input aria-label="Birim" placeholder="birim" value={cc.values[r.id]?.unit ?? ""} onChange={(e) => setCc({ ...cc, values: { ...cc.values, [r.id]: { ...(cc.values[r.id] ?? { value: "", effective_from: "" }), unit: e.target.value } } })} />
                        <input aria-label="Yürürlük" type="date" value={cc.values[r.id]?.effective_from ?? ""} onChange={(e) => setCc({ ...cc, values: { ...cc.values, [r.id]: { ...(cc.values[r.id] ?? { value: "", unit: "" }), effective_from: e.target.value } } })} />
                      </div>
                    )}
                  </div>
                ))}
              </div>
              <div className="actions">
                <button className="primary" type="submit" disabled={!canRecord || act.busy}>
                  Kartı aç
                </button>
              </div>
            </form>
          )}
          <h3>Kartlar ({cards.length})</h3>
          {cards.map((c) => (
            <div key={c.id} className="card quiet">
              <div className="spread">
                <b>{c.changed_clause}</b>
                <span className={`badge ${c.status === "approved" ? "ok" : c.status === "rejected" ? "crit" : "warn"}`}>{c.status === "approved" ? "onaylı" : c.status === "rejected" ? "reddedildi" : "uzman onayı bekliyor"}</span>
              </div>
              <p className="small">
                {c.summary} · <b>{c.nature}</b> · kurallar: {c.rule_ids.join(", ") || "—"} · eski: {c.old_version_id ? versions.find((v) => v.id === c.old_version_id)?.title : "—"} → yeni: {versions.find((v) => v.id === c.new_version_id)?.title}
              </p>
              <p className="small muted">
                Etkilenen: profiller {c.affected.profiles.join(", ") || "—"} · formlar {c.affected.forms.join(", ") || "—"} · hesaplar {c.affected.calcs.join(", ") || "—"} · dersler {c.affected.lessons.join(", ") || "—"}
              </p>
              {c.status === "pending" ? (
                <div className="actions">
                  <input aria-label="Onay gerekçesi" placeholder="uzman gerekçesi" value={reasons[c.id] ?? ""} onChange={(e) => setReasons({ ...reasons, [c.id]: e.target.value })} style={{ maxWidth: 260 }} />
                  <button className="primary" disabled={!canApprove || act.busy} onClick={() => act.run(() => { decideChangeCard(store, c.id, "approved", reasons[c.id] ?? ""); return `Kart onaylandı; kurallar bu kurum için etkin. ${PREVIEW_NOTE} Uygulanabilirliği yeniden değerlendirin.`; })}>
                    Onayla (uzman)
                  </button>
                  <button disabled={!canApprove || act.busy} onClick={() => act.run(() => { decideChangeCard(store, c.id, "rejected", reasons[c.id] ?? ""); return "Kart reddedildi."; })}>
                    Reddet
                  </button>
                  {!canApprove && <span className="small muted">Yalnız uzman kontrolör onaylar (SRC-06).</span>}
                </div>
              ) : (
                <p className="small">
                  {c.approved_by} · {c.approved_at && fmtDate(c.approved_at)} · {c.approval_reason}
                </p>
              )}
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
function split(s: string): string[] {
  return s.split(",").map((x) => x.trim()).filter(Boolean);
}

// ---------- Yükümlülükler, MRV planı (REG-02), ürün bağlantısı (REG-03), kanıt paketi (REG-04) ----------
function Yukumlulukler({ store, pkg }: { store: Store; pkg: RegulationPackage }) {
  const st = packageState(store, pkg.id);
  const rules = effectiveRules(store, pkg.id);
  const tasks = st ? store.tasks().filter((t) => st.task_ids.includes(t.id)) : [];
  return (
    <>
      <div className="card">
        <h2>Yükümlülükler — {pkg.title.tr}</h2>
        {st?.state !== "open" && <p className="small muted">Paket açık değil ({STATE[st?.state ?? "none"].label}); yükümlülükler bilgi amaçlı listelenir, görev üretilmez.</p>}
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Yükümlülük</th>
                <th>Gerekli kanıt</th>
                <th>Dayanak kural</th>
                <th>Görev</th>
              </tr>
            </thead>
            <tbody>
              {pkg.obligations.map((o) => {
                const r = o.rule_ref ? rules.find((x) => x.id === o.rule_ref) : null;
                const t = tasks.find((x) => x.title.includes(o.text.tr.slice(0, 30)));
                return (
                  <tr key={o.id}>
                    <td>{o.text.tr}</td>
                    <td className="small">{o.evidence.join("; ")}</td>
                    <td className="small">{r ? <><code>{r.id}</code> <span className={`badge ${r.source_status === "verified" ? "ok" : "warn"}`}>{r.source_status === "verified" ? "doğrulanmış" : "doğrulanmamış"}</span></> : "paket kapsamı"}</td>
                    <td className="small">{t ? <Link href="/gorevler/">{t.status === "open" ? "açık görev" : "tamamlandı"}</Link> : "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="small muted">Gerekli kanıt (genel): {pkg.required_evidence.join("; ")}.</p>
      </div>
      {pkg.id === "national-ets-mrv" && <Mrv store={store} />}
      {pkg.id === "cbam" && <CbamLink store={store} />}
      {(pkg.id === "national-ets-mrv" || pkg.id === "cbam") && <KanitPaketi store={store} />}
    </>
  );
}

function Mrv({ store }: { store: Store }) {
  const act = useAction();
  const open = packageState(store, "national-ets-mrv")?.state === "open";
  const facs = store.facilities();
  const [fid, setFid] = useState(facs[0]?.id ?? "");
  const [note, setNote] = useState("");
  const [entries, setEntries] = useState<MonitoringEntry[]>([{ source_name: "", scope1_category: "", tier: "", method: "", note: "" }]);
  const canWrite = ["data_owner", "admin", "reviewer"].includes(store.role);
  const plans = monitoringPlans(store, fid).slice().reverse();
  const sources = store.sources().filter((s) => ["stationary_combustion", "mobile_combustion", "process", "refrigerant"].includes(s.source_type));
  return (
    <div className="card">
      <h2>MRV izleme planı (REG-02) — tesis başına, sürümlü</h2>
      <ErrorBox error={act.err} />
      {act.ok && <Notice kind="ok">{act.ok}</Notice>}
      {!open ? (
        <p className="muted">İzleme planı yalnız ulusal ETS/MRV paketi açıkken oluşturulur. Paket şu an açık değil; önce uygulanabilirlik ve uzman onayı.</p>
      ) : facs.length === 0 ? (
        <p className="muted">
          Tesis yok. <Link href="/kurulum/">Kurulum</Link>
        </p>
      ) : (
        <>
          <p className="small muted">Kapsam 1 kaynaklarını izleme kademesi ve yöntemle eşleyin. Kademe/yöntem listesi ulusal kılavuz doğrulanmadan sabit sunulmaz; metin olarak girilir. Her kayıt yeni sürümdür; eski sürümler değişmez.</p>
          <div className="field">
            <label htmlFor="mf">Tesis</label>
            <select id="mf" value={fid} onChange={(e) => setFid(e.target.value)}>
              {facs.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </select>
          </div>
          {entries.map((en, i) => (
            <div className="dis-mini" key={i} style={{ marginBottom: 4 }}>
              <input aria-label="Kaynak" list="mrv-src" placeholder="Kapsam 1 kaynağı" value={en.source_name} onChange={(e) => setEntries(entries.map((x, j) => (j === i ? { ...x, source_name: e.target.value } : x)))} />
              <input aria-label="Kategori" placeholder="kategori (sabit yakma, proses…)" value={en.scope1_category} onChange={(e) => setEntries(entries.map((x, j) => (j === i ? { ...x, scope1_category: e.target.value } : x)))} />
              <input aria-label="Kademe" placeholder="izleme kademesi" value={en.tier} onChange={(e) => setEntries(entries.map((x, j) => (j === i ? { ...x, tier: e.target.value } : x)))} />
              <input aria-label="Yöntem" placeholder="yöntem (fatura, sayaç, ölçüm)" value={en.method} onChange={(e) => setEntries(entries.map((x, j) => (j === i ? { ...x, method: e.target.value } : x)))} />
              <input aria-label="Not" placeholder="belirsizlik / not" value={en.note} onChange={(e) => setEntries(entries.map((x, j) => (j === i ? { ...x, note: e.target.value } : x)))} />
            </div>
          ))}
          <datalist id="mrv-src">
            {sources.filter((s) => s.facility_id === fid).map((s) => (
              <option key={s.id} value={s.name} />
            ))}
          </datalist>
          <div className="actions">
            <button onClick={() => setEntries([...entries, { source_name: "", scope1_category: "", tier: "", method: "", note: "" }])}>+ kaynak</button>
            <input aria-label="Sürüm notu" placeholder="sürüm notu" value={note} onChange={(e) => setNote(e.target.value)} style={{ maxWidth: 260 }} />
            <button className="primary" disabled={!canWrite || act.busy} onClick={() => act.run(() => { const p = addMonitoringPlanVersion(store, fid, entries, note); setNote(""); return `İzleme planı v${p.plan_version} kaydedildi (kılavuz kuralı: ${p.mrv_rule_status}). ${PREVIEW_NOTE}`; })}>
              Yeni plan sürümü kaydet
            </button>
          </div>
          <h3>Sürüm geçmişi ({plans.length})</h3>
          {plans.length === 0 && <p className="muted">Bu tesis için plan yok.</p>}
          {plans.map((p) => (
            <div key={p.id} className="card quiet">
              <b>v{p.plan_version}</b> · {fmtDate(p.created_at)} · {p.created_by} · {p.note || "—"} · kılavuz kuralı <span className={`badge ${p.mrv_rule_status === "verified" ? "ok" : "warn"}`}>{p.mrv_rule_status}</span>
              <ul className="small">
                {p.entries.map((e, i) => (
                  <li key={i}>
                    {e.source_name} · {e.scope1_category || "—"} · kademe {e.tier || "—"} · {e.method || "—"} {e.note && `· ${e.note}`}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </>
      )}
    </div>
  );
}

function CbamLink({ store }: { store: Store }) {
  const studies = productStudies(store);
  return (
    <div className="card">
      <h2>CBAM gömülü emisyon ↔ ürün çalışmaları (REG-03)</h2>
      <p className="small">Gömülü emisyon ürün bağlamında (§17) hesaplanır; kurumsal Kapsam 1–2 toplamına eklenmez (kural 8). Bu ekran hesap yapmaz; ürün modülündeki çalışmalara bağlanır.</p>
      {studies === null ? (
        <p className="muted">
          Ürün çalışması kaydı yok veya ürün modülü henüz veri yazmadı. <Link href="/urun/">Ürün ve yaşam döngüsü</Link> sekmesinde çalışma açın.
        </p>
      ) : (
        <ul className="small">
          {studies.map((x) => (
            <li key={x.id}>
              <Link href={`/urun/?id=${x.id}`}>{x.title}</Link> · v{x.version}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function KanitPaketi({ store }: { store: Store }) {
  const act = useAction();
  const open = packageState(store, "national-ets-mrv")?.state === "open";
  const costs = carbonCosts(store);
  const [f, setF] = useState({ period_label: "", amount: "", currency: "TRY", paid_at: "", evidence_name: "", evidence_sha256: "", note: "" });
  const canWrite = ["admin", "approver"].includes(store.role);
  const [pack, setPack] = useState<string | null>(null);
  return (
    <div className="card">
      <h2>Karbon maliyeti kanıt paketi (REG-04)</h2>
      <ErrorBox error={act.err} />
      {act.ok && <Notice kind="ok">{act.ok}</Notice>}
      {!open ? (
        <p className="muted">Kanıt paketi yalnız ulusal ETS/MRV paketi açıkken üretilir: yurt içinde ödenen karbon maliyeti ancak ETS kapsamındaki tesis için vardır. Paket açık değilse burada yalnız açıklama görünür; finans girişi de yapılmaz.</p>
      ) : (
        <>
          <p className="small muted">Finans (onaylayan / kurum yöneticisi) ödenen karbon maliyetini kanıt dosyasının SHA-256 karmasıyla kaydeder; dosya içeriği saklanmaz. Paket; envanter dönemi, MRV planı sürümü ve bu girişleri JSON/Markdown olarak toplar. Mahsup biçimi K-07 açık karardır.</p>
          <div className="dis-mini">
            <input aria-label="Dönem" placeholder="dönem (ör. 2026)" value={f.period_label} onChange={(e) => setF({ ...f, period_label: e.target.value })} />
            <input aria-label="Tutar" placeholder="tutar" inputMode="decimal" value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} />
            <input aria-label="Para birimi" placeholder="para birimi" value={f.currency} onChange={(e) => setF({ ...f, currency: e.target.value })} />
            <input aria-label="Ödeme tarihi" type="date" value={f.paid_at} onChange={(e) => setF({ ...f, paid_at: e.target.value })} />
            <input aria-label="Kanıt dosyası" type="file" onChange={async (e) => { const file = e.target.files?.[0]; if (!file) return; const h = await sha256Hex(await file.arrayBuffer()); setF({ ...f, evidence_name: file.name, evidence_sha256: h }); }} />
            <input aria-label="Not" placeholder="not" value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} />
          </div>
          {f.evidence_sha256 && <p className="small mono">kanıt: {f.evidence_name} · sha256 {f.evidence_sha256}</p>}
          <div className="actions">
            <button className="primary" disabled={!canWrite || act.busy} onClick={() => act.run(() => { addCarbonCost(store, f); setF({ ...f, period_label: "", amount: "", evidence_name: "", evidence_sha256: "", note: "" }); return `Ödeme girişi kaydedildi. ${PREVIEW_NOTE}`; })}>
              Finans girişi kaydet
            </button>
            <button disabled={act.busy} onClick={() => act.run(() => { const p = buildCarbonCostPack(store); setPack(JSON.stringify(p, null, 2)); downloadText(JSON.stringify(p, null, 2), "karbon-maliyeti-kanit-paketi.json", "application/json"); downloadText(carbonCostPackMarkdown(p), "karbon-maliyeti-kanit-paketi.md", "text/markdown"); return "Kanıt paketi JSON ve Markdown olarak indirildi."; })}>
              Kanıt paketini üret (JSON + Markdown)
            </button>
          </div>
          {costs.length > 0 && (
            <ul className="small">
              {costs.map((c) => (
                <li key={c.id}>
                  {c.period_label}: {fmtDec(c.amount, 2)} {c.currency} · {c.paid_at} · {c.evidence_name} · <span className="mono">{c.evidence_sha256.slice(0, 16)}…</span> · {c.recorded_role}
                </li>
              ))}
            </ul>
          )}
          {pack && <pre className="dis-pre">{pack}</pre>}
        </>
      )}
    </div>
  );
}
