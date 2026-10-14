"use client";
import Link from "next/link";
import { useState } from "react";
import type { Task } from "@/lib/domain";
import type { Store } from "@/lib/store";
import { useStore } from "@/lib/useStore";
import { ErrorBox, Loading, Notice, PageHeader } from "@/components/ui";
import { searchTerms } from "@/modules/ogrenme/search";
import { helpCannotFind, helpNoDocument, helpUnsure, tenantProfile, terms } from "@/modules/ogrenme/store";
import { CONTEXT_LABEL, type TermFull } from "@/modules/ogrenme/types";
import "@/modules/ogrenme/style.css";

const CONTEXTS = ["envanter", "urun", "raporlama", "mevzuat", "veri-girisi", "yonetim"];

export default function Sozluk() {
  const { store, ready } = useStore();
  const [q, setQ] = useState("");
  const [ctx, setCtx] = useState<string | null>(null);
  if (!ready || !store) return <Loading what="Sözlük" />;
  const all = terms();
  const results = searchTerms(all, q, ctx);
  const profile = tenantProfile(store.tenant);

  return (
    <>
      <PageHeader eyebrow="Öğrenme · §10" title="Sözlük ve bağlamsal yardım" lead="Teknik dili çözmek için sade, özgün tanımlar. Arama Türkçe karaktere, yaygın yazım hatasına, kısaltmaya ve İngilizce karşılığa toleranslıdır. 'Bu kutuya ne yazacağım?' girdileri doğrudan veri girişi alanına bağlanır." />
      <Notice kind="info">
        <p>
          Tanımlar Koza'nın özgün kısa açıklamalarıdır; standart metinleri kopyalanmaz ve bir kaynaktaki teknik tanım uygulamanın kendi görüşü gibi sunulmaz (K-12). Her terim içerik editörü onayı bekler; durum kartta görünür. {all.length} terim.
        </p>
      </Notice>
      <div className="card">
        <div className="field">
          <label htmlFor="q">Ara</label>
          <input id="q" value={q} onChange={(e) => setQ(e.target.value)} placeholder="ör. kapsam2, co2 esdegeri, GWP, scope, ne yazacağım" autoComplete="off" />
          <span className="hint">Yazım hatası toleransı: "kapsm", "emisyn", "mense garantsi" gibi aramalar da eşleşir.</span>
        </div>
        <div className="ogr-chips" role="group" aria-label="Bağlam filtresi">
          <button type="button" aria-pressed={ctx === null} onClick={() => setCtx(null)}>Tümü</button>
          {CONTEXTS.map((c) => (
            <button key={c} type="button" aria-pressed={ctx === c} onClick={() => setCtx(c)}>
              {CONTEXT_LABEL[c] ?? c}
            </button>
          ))}
          <button type="button" aria-pressed={ctx === "alan-yardimi"} onClick={() => setCtx("alan-yardimi")}>
            Bu kutuya ne yazacağım?
          </button>
        </div>
        <p className="small muted">
          {q || ctx ? `${results.length} sonuç (filtre: ${q ? `"${q}"` : "—"}${ctx ? ` · ${ctx === "alan-yardimi" ? "alan yardımı" : CONTEXT_LABEL[ctx]}` : ""}).` : `Tüm terimler listeleniyor (${results.length}).`}
        </p>
      </div>
      {all.length === 0 ? (
        <Notice kind="warn"><p>Sözlükte terim yok (içerik kataloğu boş).</p></Notice>
      ) : results.length === 0 ? (
        <div className="card quiet">
          <h3>Eşleşen terim yok</h3>
          <p className="small">
            Bu bir filtre sonucudur; sözlükte {all.length} terim var. Farklı yazım deneyin (ör. İngilizce karşılık) ya da bağlam filtresini kaldırın. Terim gerçekten eksikse{" "}
            <Link href="/asistan/">asistana</Link> sorabilir veya içerik ekibine görev açabilirsiniz.
          </p>
        </div>
      ) : (
        results.map(({ term }) => <TermCard key={term.id} term={term} store={store} profileDocs={helpCannotFind(term, profile).documents} />)
      )}
    </>
  );
}

function TermCard({ term, store, profileDocs }: { term: TermFull; store: Store; profileDocs: string[] }) {
  const [variant, setVariant] = useState<string | null>(null);
  const [help, setHelp] = useState<"none" | "find" | "nodoc" | "unsure">("none");
  const [note, setNote] = useState("");
  const [task, setTask] = useState<Task | null>(null);
  const [err, setErr] = useState<unknown>(null);
  const tenant = store.tenant;
  const def = variant ? (term.variants?.find((v) => v.context === variant)?.definition ?? term.definition) : term.definition;
  const act = (fn: () => Task) => {
    setErr(null);
    try {
      setTask(fn());
    } catch (e) {
      setErr(e);
    }
  };
  return (
    <div className="card" id={term.id}>
      <div className="spread">
        <h2 style={{ marginTop: 0 }}>
          {term.tr} <span className="muted small">{term.en}{term.abbr ? ` · ${term.abbr}` : ""}</span>
        </h2>
        <div className="row">
          {term.kind === "alan-yardimi" && <span className="badge info">alan yardımı</span>}
          {(term.contexts ?? []).map((c) => (
            <span key={c} className="badge neutral">{CONTEXT_LABEL[c] ?? c}</span>
          ))}
          <span className="badge warn">{term.status}</span>
        </div>
      </div>
      {term.variants && term.variants.length > 0 && (
        <div className="ogr-chips" role="group" aria-label="Bağlam seçimi">
          <span className="small muted">Bu terim bağlama göre farklı kullanılır:</span>
          <button type="button" aria-pressed={variant === null} onClick={() => setVariant(null)}>Genel</button>
          {term.variants.map((v) => (
            <button key={v.context} type="button" aria-pressed={variant === v.context} onClick={() => setVariant(v.context)}>
              {CONTEXT_LABEL[v.context] ?? v.context}
            </button>
          ))}
        </div>
      )}
      <p>{def}</p>
      <dl className="kv">
        <dt>Örnek</dt>
        <dd>{term.example}</dd>
        {term.confused_with && (
          <>
            <dt>Karıştırılan</dt>
            <dd>{term.confused_with}</dd>
          </>
        )}
        {term.related_task && (
          <>
            <dt>İlgili görev</dt>
            <dd>
              {term.related_task}
              {term.related_route && (
                <>
                  {" "}· <Link href={term.related_route}>ekrana git</Link>
                </>
              )}
            </dd>
          </>
        )}
        {term.field_help && (
          <>
            <dt>Alan</dt>
            <dd>
              <Link href={`${term.field_help.route}#${term.field_help.field_id}`}>
                {term.field_help.field_label} → kutuya dön
              </Link>{" "}
              <span className="small muted">(görevinizden ayrılmadan alanı açar)</span>
            </dd>
          </>
        )}
        <dt>Kaynak</dt>
        <dd className="small">{term.source}</dd>
      </dl>
      <div className="ogr-help">
        <div className="row">
          <span className="small muted">Yardım yolları:</span>
          <button type="button" aria-pressed={help === "find"} onClick={() => setHelp(help === "find" ? "none" : "find")}>Bilgiyi bulamıyorum</button>
          <button type="button" aria-pressed={help === "nodoc"} onClick={() => setHelp(help === "nodoc" ? "none" : "nodoc")}>Belge elimde yok</button>
          <button type="button" aria-pressed={help === "unsure"} onClick={() => setHelp(help === "unsure" ? "none" : "unsure")}>Emin değilim</button>
        </div>
        {help === "find" && (
          <Notice kind="info" title="Nerede bulunur?">
            <p>
              Olası departman: <b>{helpCannotFind(term, null).department}</b>.{" "}
              {profileDocs.length > 0 ? <>Kurum profilinizdeki örnek belgeler: {profileDocs.join(", ")}.</> : <>Kurum seçiliyse profilin örnek belgeleri burada listelenir.</>}{" "}
              Belge bulunamazsa "Belge elimde yok" ile görev açın.
            </p>
          </Notice>
        )}
        {help === "nodoc" && (
          <div>
            {!tenant ? (
              <p className="small muted">Görev açmak için kurum seçin.</p>
            ) : (
              <div className="actions">
                <button type="button" className="primary" onClick={() => act(() => helpNoDocument(store, term.id))}>
                  Eksik belge görevi oluştur
                </button>
                <span className="small muted">Görev, belgeyi tutan departmana yönlendirilir; sayı uydurulmaz.</span>
              </div>
            )}
          </div>
        )}
        {help === "unsure" && (
          <div>
            {!tenant ? (
              <p className="small muted">Uzman kontrolü için kurum seçin.</p>
            ) : (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  act(() => helpUnsure(store, term.id, note));
                }}
              >
                <div className="field" style={{ maxWidth: 520 }}>
                  <label htmlFor={`note-${term.id}`}>Neyden emin değilsiniz? (isteğe bağlı)</label>
                  <input id={`note-${term.id}`} value={note} onChange={(e) => setNote(e.target.value)} placeholder="ör. faturadaki birim Sm³ mü m³ mü anlaşılmıyor" />
                </div>
                <div className="actions">
                  <button type="submit" className="primary">Uzman kontrolüne işaretle</button>
                </div>
              </form>
            )}
          </div>
        )}
        <ErrorBox error={err} />
        {task && (
          <Notice kind="ok" title="Görev oluşturuldu">
            <p>
              "{task.title}" bu tarayıcıda kaydedildi (durum: açık). <Link href="/gorevler/">Görevler</Link> ekranından izleyebilirsiniz; aynı başlıkla ikinci görev açılmaz.
            </p>
          </Notice>
        )}
      </div>
    </div>
  );
}
