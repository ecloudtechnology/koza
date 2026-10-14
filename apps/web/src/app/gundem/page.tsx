"use client";
import Link from "next/link";
import { useState } from "react";
import { can, type Task } from "@/lib/domain";
import type { Store } from "@/lib/store";
import { useStore } from "@/lib/useStore";
import { Icon } from "@/components/icons";
import { ErrorBox, Loading, Notice, PageHeader } from "@/components/ui";
import { agendaItems, agendaRelevant, agendaToTask, calendarEntries, fundingItems, fundingRelevant, prefOf, setAgendaPref, tenantProfile } from "@/modules/ogrenme/store";
import { AGENDA_STATUS_LABEL, AGENDA_TYPE_LABEL, CALENDAR_KIND_LABEL, type AgendaItem, type CalendarEntry, type CalendarKind, type FundingItem } from "@/modules/ogrenme/types";
import "@/modules/ogrenme/style.css";

function todayIstanbul(): string {
  try {
    return new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Istanbul" }).format(new Date());
  } catch {
    return new Date().toISOString().slice(0, 10);
  }
}
const STATUS_CLASS = { taslak: "neutral", istisare: "info", yururlukte: "ok" } as const;
const KIND_ICON: Record<CalendarKind, "building" | "shield" | "spark"> = { internal: "building", legal: "shield", funding: "spark" };
const OPEN_LABEL = { open: "açık", closed: "kapalı", unknown: "durum kaynakta doğrulanmadı" } as const;

export default function Gundem() {
  const { store, ready } = useStore();
  const [onlyRelevant, setOnlyRelevant] = useState(true);
  const [showMuted, setShowMuted] = useState(false);
  const [showPast, setShowPast] = useState(false);
  if (!ready || !store) return <Loading what="Gündem" />;
  const tenant = store.tenant;
  const profile = tenantProfile(tenant);
  const today = todayIstanbul();
  const items = agendaItems();
  const visible = items.filter((i) => {
    const rel = agendaRelevant(i, tenant, profile).relevant;
    const pref = prefOf(store, i.id);
    if (!showMuted && pref?.muted) return false;
    return !onlyRelevant || rel || !!pref?.follow;
  });
  const cal = tenant ? calendarEntries(store, today, { includeMuted: showMuted }) : { upcoming: [], past: [] };
  const funding = fundingItems();

  return (
    <>
      <PageHeader eyebrow="Öğrenme · §09 · §19 · REG-01" title="Gündem ve takvim" lead="İşinizle ilgili değişiklikleri anlaşılır görevlere çevirir: ne değişti, beni neden ilgilendiriyor, şimdi ne yapmalıyım. Her haber bildirim değildir; her yayın da yürürlükte bir yükümlülük değildir." />
      <Notice kind="info">
        <p>
          Maddeler yalnız resmî kaynaktan doğrulanmış içerikle eklenir; bilinmeyen tarih "kaynakta doğrulanmadı" olarak görünür, tahmin yazılmaz. Taslak ve istişare metinleri görev üretemez. Saat dilimi Europe/Istanbul; bugün: {today}. Takip, sessize alma ve takvime ekleme kişisel tercihlerdir.
        </p>
      </Notice>
      {!tenant && (
        <Notice kind="warn" title="Kurum seçilmedi">
          <p>
            Gündem okunabilir; kurumla ilgisi, takvim ve görevler kurum bağlamı ister. <Link href="/kurulum/">Kurum kurulumu</Link>.
          </p>
        </Notice>
      )}

      <section className="card ogr-agenda">
        <div className="spread">
          <h2>Gündem ({visible.length}/{items.length})</h2>
          <div className="row">
            <label className="check">
              <input type="checkbox" checked={onlyRelevant} onChange={(e) => setOnlyRelevant(e.target.checked)} /> yalnız kurumla ilgili
            </label>
            <label className="check">
              <input type="checkbox" checked={showMuted} onChange={(e) => setShowMuted(e.target.checked)} /> sessize alınanları göster
            </label>
          </div>
        </div>
        {items.length === 0 ? (
          <p className="muted">Kayıtlı gündem maddesi yok; kaynak izleme (SRC-02) yeni madde üretince burada görünür.</p>
        ) : visible.length === 0 ? (
          <p className="muted">Filtre sonucu boş: {items.length} madde var ama kurumunuzla ilgi kuralı eşleşmiyor ya da sessize alındı. Filtreyi kaldırarak tümünü görebilirsiniz.</p>
        ) : (
          visible.map((i) => <AgendaCard key={i.id} item={i} store={store} today={today} />)
        )}
      </section>

      <section className="card">
        <h2>Takvim</h2>
        <p className="small muted">
          Kurum içi teslim tarihi (dönem kapanış provası, kilit) ile yasal/standart tarihi farklı ikon ve etiket taşır. Geçmiş tarih yaklaşan iş gibi gösterilmez; ayrı listede durur.
        </p>
        {!tenant ? (
          <p className="muted">Takvim kurum dönemlerinden türetilir; kurum seçin.</p>
        ) : cal.upcoming.length === 0 ? (
          <p className="muted">Yaklaşan tarih yok. Dönem tanımlayın (<Link href="/donem/">Dönem kapanışı</Link>) ya da gündemden bir maddeyi takvime ekleyin.</p>
        ) : (
          <CalendarList entries={cal.upcoming} />
        )}
        {tenant && cal.past.length > 0 && (
          <p className="small" style={{ marginTop: "0.75rem" }}>
            <button type="button" onClick={() => setShowPast(!showPast)}>{showPast ? "Geçmiş tarihleri gizle" : `Geçmiş tarihler (${cal.past.length})`}</button>
          </p>
        )}
        {showPast && cal.past.length > 0 && <CalendarList entries={cal.past} />}
        <p className="small muted">Hatırlatma gönderimi (e-posta/entegrasyon) ve dış kişiye veri talebi bu önizlemede yok; açık yetki ister (§09).</p>
      </section>

      <section className="card">
        <h2>Destek haritası</h2>
        <p className="small muted">"Size uygun olabilir" bir ön değerlendirmedir; destek almaya hak kazanıldığı anlamına gelmez. Tutar ve son tarih kaynak olmadan yazılmaz (K-15).</p>
        {funding.length === 0 ? (
          <p className="muted">Kayıtlı destek programı yok.</p>
        ) : (
          <div className="grid-2">
            {funding.map((f) => (
              <FundingCard key={f.id} f={f} relevant={fundingRelevant(f, tenant, profile)} />
            ))}
          </div>
        )}
      </section>
    </>
  );
}

function AgendaCard({ item, store, today }: { item: AgendaItem; store: Store; today: string }) {
  const [err, setErr] = useState<unknown>(null);
  const [task, setTask] = useState<Task | null>(null);
  const tenant = store.tenant;
  const profile = tenantProfile(tenant);
  const rel = agendaRelevant(item, tenant, profile);
  const pref = tenant ? prefOf(store, item.id) : null;
  const canFollow = !!tenant && can(store.role, "ogrenme.agenda.follow");
  const canTask = !!tenant && can(store.role, "ogrenme.agenda.task");
  const pastEvent = !!item.event_or_effective_at && item.event_or_effective_at < today;
  const act = (fn: () => void) => {
    setErr(null);
    try {
      fn();
    } catch (e) {
      setErr(e);
    }
  };
  return (
    <article className={`card quiet ${pref?.muted ? "ogr-muted" : ""}`} aria-labelledby={`ag-${item.id}`}>
      <div className="row">
        <span className="badge info">{AGENDA_TYPE_LABEL[item.type]}</span>
        <span className={`badge ${STATUS_CLASS[item.status]}`}>{AGENDA_STATUS_LABEL[item.status]}</span>
        {pref?.follow && <span className="badge accent">takip ediliyor</span>}
        {pref?.muted && <span className="badge neutral">sessize alındı</span>}
        {pref?.in_calendar && <span className="badge accent">takvimde</span>}
        <span className="badge warn">{item.editor_status}</span>
      </div>
      <h3 id={`ag-${item.id}`}>{item.title}</h3>
      <ul className="summary small">
        <li><b>Ne değişti?</b> {item.summary[0]}</li>
        <li><b>Beni neden ilgilendiriyor?</b> {item.summary[1]}</li>
        <li><b>Şimdi ne yapmalıyım?</b> {item.summary[2]}</li>
      </ul>
      <dl className="kv small">
        <dt>Yayımlayan</dt>
        <dd>{item.publisher}</dd>
        <dt>Resmî kaynak</dt>
        <dd>
          <a href={item.source_url} target="_blank" rel="noreferrer">{item.source_url}</a>
          {item.source_codes.map((k) => (
            <span key={k}>
              {" "}· <Link href={`/protokoller/?k=${k}`} className="mono">{k}</Link>
            </span>
          ))}
        </dd>
        <dt>Yayın tarihi</dt>
        <dd>{item.published_at ? String(item.published_at).slice(0, 10) : "tarih kaynakta doğrulanmadı"}</dd>
        <dt>Olay / yürürlük</dt>
        <dd>
          {item.event_or_effective_at ? String(item.event_or_effective_at).slice(0, 10) : "tarih kaynakta doğrulanmadı"}
          {pastEvent && <span className="badge neutral" style={{ marginLeft: "0.4rem" }}>geçmiş</span>}
        </dd>
        <dt>Ülke / sektör</dt>
        <dd>{item.countries.join(", ") || "—"} · {item.sectors.length ? item.sectors.join(", ") : "tüm sektörler"}</dd>
        <dt>Kurumla ilgisi</dt>
        <dd>{rel.relevant ? <span className="badge ok">ilgili</span> : <span className="badge neutral">genel</span>} {rel.reason}</dd>
        <dt>Önerilen eylem</dt>
        <dd>{item.suggested_action}</dd>
        <dt>Son kontrol</dt>
        <dd>{item.last_checked ? String(item.last_checked).slice(0, 10) : "doğrulanmadı"}</dd>
      </dl>
      <div className="row" style={{ marginTop: "0.6rem" }}>
        {item.affected_route && <Link href={item.affected_route}>Etkilenen kayda / ekrana git →</Link>}
        {canFollow && (
          <>
            <button type="button" onClick={() => act(() => setAgendaPref(store, item.id, { follow: !pref?.follow }))}>{pref?.follow ? "Takibi bırak" : "Takip et"}</button>
            <button type="button" onClick={() => act(() => setAgendaPref(store, item.id, { muted: !pref?.muted }))}>{pref?.muted ? "Sessizi kaldır" : "Sessize al"}</button>
            {item.event_or_effective_at && !pastEvent && (
              <button type="button" onClick={() => act(() => setAgendaPref(store, item.id, { in_calendar: !pref?.in_calendar }))}>{pref?.in_calendar ? "Takvimden çıkar" : "Takvime ekle"}</button>
            )}
          </>
        )}
        {item.status === "yururlukte" ? (
          canTask && (
            <button type="button" className="primary" onClick={() => act(() => setTask(agendaToTask(store, item)))}>
              Görev oluştur
            </button>
          )
        ) : (
          <span className="small muted">Taslak / istişare: görev üretmez (§09 kabul).</span>
        )}
      </div>
      <ErrorBox error={err} />
      {task && (
        <Notice kind="ok" title="Görev oluşturuldu">
          <p>
            "{task.title}" bu tarayıcıda kaydedildi (açık). <Link href="/gorevler/">Görevler</Link>. Aynı madde için ikinci görev açılmaz.
          </p>
        </Notice>
      )}
    </article>
  );
}

function CalendarList({ entries }: { entries: CalendarEntry[] }) {
  return (
    <ul className="ogr-cal">
      {entries.map((e) => (
        <li key={e.id} className={`${e.kind} ${e.past ? "past" : ""}`}>
          <span className="d">{e.date}</span>
          <span className="k">
            <Icon name={KIND_ICON[e.kind]} size={14} /> {CALENDAR_KIND_LABEL[e.kind]}
          </span>
          <span>
            <b>{e.title}</b> <span className="small muted">{e.detail}</span>
            {e.route && (
              <>
                {" "}· <Link href={e.route}>git</Link>
              </>
            )}
          </span>
        </li>
      ))}
    </ul>
  );
}

function FundingCard({ f, relevant }: { f: FundingItem; relevant: boolean }) {
  return (
    <article className="card quiet">
      <div className="row">
        <span className={`badge ${f.open_status === "open" ? "ok" : f.open_status === "closed" ? "neutral" : "warn"}`}>{OPEN_LABEL[f.open_status]}</span>
        {relevant && <span className="badge accent">size uygun olabilir — ön değerlendirme</span>}
        <span className="badge warn">{f.editor_status}</span>
      </div>
      <h3>{f.title}</h3>
      <dl className="kv small">
        <dt>Program sahibi</dt>
        <dd>{f.program_owner}</dd>
        <dt>Yararlanıcı koşulları</dt>
        <dd>
          <ul style={{ margin: 0 }}>
            {f.eligibility.map((e, i) => (
              <li key={i}>{e}</li>
            ))}
          </ul>
        </dd>
        <dt>Çağrı tarihi</dt>
        <dd>{f.call_date ? String(f.call_date).slice(0, 10) : "kaynakta doğrulanmadı"}</dd>
        <dt>Son başvuru</dt>
        <dd>{f.deadline ? String(f.deadline).slice(0, 10) : "kaynakta doğrulanmadı"}</dd>
        <dt>Tutar</dt>
        <dd>{f.amount_note ?? "kaynak olmadan yazılmaz"}</dd>
        <dt>Başvuru</dt>
        <dd>
          <a href={f.official_url} target="_blank" rel="noreferrer">{f.official_url}</a>
        </dd>
        <dt>Son kontrol</dt>
        <dd>{f.last_checked ? String(f.last_checked).slice(0, 10) : "doğrulanmadı"}</dd>
      </dl>
    </article>
  );
}
