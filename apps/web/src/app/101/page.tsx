"use client";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { ROLE_LABEL } from "@/lib/domain";
import type { Profile } from "@/lib/content";
import { useStore, fmtDate } from "@/lib/useStore";
import { ErrorBox, Loading, Notice, PageHeader } from "@/components/ui";
import { completeLesson, completionOf, defaultPathFor, lessonById, lessonPath, lessons, sourceByCode, tenantProfile, trainingByUnit } from "@/modules/ogrenme/store";
import { PATH_LABEL, type LessonFull, type PathRole, type ProgressRow } from "@/modules/ogrenme/types";
import type { Store } from "@/lib/store";
import "@/modules/ogrenme/style.css";

export default function Page() {
  return (
    <Suspense fallback={<Loading />}>
      <Yuzbir />
    </Suspense>
  );
}

const PATHS: PathRole[] = ["manager", "specialist", "field"];

function Yuzbir() {
  const { store, ready } = useStore();
  const params = useSearchParams();
  if (!ready || !store) return <Loading what="Dersler" />;
  const tenant = store.tenant;
  const profile = tenantProfile(tenant);
  const yol = params.get("yol") as PathRole | null;
  const path: PathRole = yol && PATHS.includes(yol) ? yol : defaultPathFor(store.role);
  const lessonId = params.get("d");
  const lesson = lessonId ? lessonById(lessonId) : undefined;
  const all = lessons();
  const { lessons: pathLessons, missing } = lessonPath(profile, path);
  const href = (q: Record<string, string | null>) => {
    const u = new URLSearchParams();
    const merged = { yol: path, d: lessonId, ...q };
    for (const [k, v] of Object.entries(merged)) if (v) u.set(k, v);
    const s = u.toString();
    return `/101/${s ? `?${s}` : ""}`;
  };

  return (
    <>
      <PageHeader eyebrow="Öğrenme · §07 · ÖĞR-01…04" title="Sürdürülebilirlik 101" lead="İş başında rehber: on kısa modül, rolünüze göre sıralanmış. Her ders gerçek bir uygulama görevine bağlanır; tam kursu bitirmek veri girişinin ön koşulu değildir." />
      {!tenant && (
        <Notice kind="warn" title="Kurum seçilmedi">
          <p>
            Dersler okunabilir; ancak ilerleme kaydı ve rol bazlı yol kurum profilinden gelir. <Link href="/kurulum/">Kurum kurulumu</Link> ile başlayın veya üst çubuktan kurum seçin.
          </p>
        </Notice>
      )}
      <div className="card">
        <h2>Öğrenme yolu</h2>
        <p className="small muted">
          Rolünüz: {ROLE_LABEL[store.role]} · Profil: {profile ? `${profile.title.tr} v${profile.version}` : "— (kurum yok)"} · Yol önerisi role göre; istediğiniz yolu açabilirsiniz.
        </p>
        <div className="ogr-path" role="group" aria-label="Öğrenme yolu">
          {PATHS.map((p) => (
            <Link key={p} href={href({ yol: p, d: null })} role="button" aria-pressed={p === path} className="badge neutral" style={{ textDecoration: "none", padding: "0.35rem 0.8rem" }}>
              {PATH_LABEL[p]}
            </Link>
          ))}
        </div>
        {path === "field" && <p className="small">Saha yolu: her dersin 3 dakikalık saha sürümü vardır; örnek belgeler kurum profilinden gelir (ÖĞR-03).</p>}
        {pathLessons.length === 0 ? (
          <p className="muted">Bu yol için profilde ders tanımlı değil. Tüm modüller aşağıda.</p>
        ) : (
          <LessonList store={store} items={pathLessons} path={path} current={lessonId} tenant={!!tenant} />
        )}
        {missing.length > 0 && <p className="small muted">Profilde tanımlı ama içerikte bulunmayan ders: {missing.join(", ")} (içerik ekibine bildirilir).</p>}
      </div>

      {lesson ? (
        <LessonReader key={lesson.id} store={store} lesson={lesson} path={path} profile={profile} pathLessons={pathLessons} hrefFor={(d) => href({ d })} />
      ) : (
        <div className="card">
          <h2>Tüm modüller (§07 tablosu)</h2>
          <LessonList store={store} items={all} path={path} current={null} tenant={!!tenant} />
        </div>
      )}

      {tenant && <UnitTotals store={store} />}
      <p className="small muted">
        Ders içindeki örnekler ve eğitim kayıtları hiçbir zaman üretim emisyon toplamına eklenmez (§07 kabul). Rozet veya sertifika yoktur; yalnız "modül tamamlandı" ifadesi kullanılır. İçerik durumu her derste görünür.
      </p>
    </>
  );
}

function LessonList({ store, items, path, current, tenant }: { store: Store; items: LessonFull[]; path: PathRole; current: string | null; tenant: boolean }) {
  return (
    <ul className="ogr-lesson-list">
      {items.map((l) => {
        const c = tenant ? completionOf(store, l.id) : { done: false, stale: false, row: null };
        const mins = path === "field" && l.field_duration_min ? l.field_duration_min : l.duration_min;
        return (
          <li key={l.id} className={c.done ? "done" : ""} aria-current={current === l.id ? "true" : undefined}>
            <span className="n">{l.id}</span>
            <Link href={`/101/?yol=${path}&d=${l.id}`}>
              <b>{l.title.tr}</b> <span className="small muted">— {l.goal}</span>
            </Link>
            <span className="small muted">~{mins} dk</span>
            {c.done ? <span className="badge ok">modül tamamlandı</span> : <span className="badge neutral">{l.level}</span>}
            {c.stale && <span className="badge warn">ders güncellendi</span>}
          </li>
        );
      })}
    </ul>
  );
}

function LessonReader({ store, lesson, path, profile, pathLessons, hrefFor }: { store: Store; lesson: LessonFull; path: PathRole; profile: Profile | null; pathLessons: LessonFull[]; hrefFor: (d: string) => string }) {
  const tenant = store.tenant;
  const [answers, setAnswers] = useState<(number | null)[]>(lesson.quiz.map(() => null));
  const [checked, setChecked] = useState(false);
  const [fieldMode, setFieldMode] = useState(path === "field" && !!lesson.field_summary);
  const [unit, setUnit] = useState<string>("");
  const [err, setErr] = useState<unknown>(null);
  const [saved, setSaved] = useState<ProgressRow | null>(null);
  const completion = tenant ? completionOf(store, lesson.id) : { done: false, stale: false, row: null };
  const idx = pathLessons.findIndex((l) => l.id === lesson.id);
  const next = idx >= 0 ? pathLessons[idx + 1] : undefined;
  const facilities = tenant ? store.facilities() : [];
  const allAnswered = answers.every((a) => a !== null);

  return (
    <article className="card ogr-reader" aria-labelledby="lesson-title">
      <div className="spread">
        <div>
          <div className="eyebrow mono small">{lesson.id} · {lesson.level}</div>
          <h2 id="lesson-title" style={{ marginTop: 0 }}>{lesson.title.tr}</h2>
        </div>
        <div className="row">
          <span className="badge warn">{lesson.status}</span>
          {completion.done && <span className="badge ok">modül tamamlandı{completion.row ? ` · ${fmtDate(completion.row.completed_at)}` : ""}</span>}
        </div>
      </div>
      {completion.stale && (
        <Notice kind="info" title="Ders güncellendi">
          <p>Tamamlama kaydınız korunuyor (içerik sürümü {completion.row?.content_version}); içerik {String(lesson.review_date)} tarihinde değişti. Kısa bir tazeleme önerilir; yeniden tamamlamak isteğe bağlıdır.</p>
        </Notice>
      )}
      <dl className="kv">
        <dt>Öğrenme hedefi</dt>
        <dd>{lesson.goal}</dd>
        <dt>Uygulama</dt>
        <dd>{lesson.application}</dd>
        <dt>Süre (hedef)</dt>
        <dd>
          ~{lesson.duration_min} dk{lesson.field_duration_min ? ` · saha sürümü ~${lesson.field_duration_min} dk` : ""} — tamamlama zorlaması değildir.
        </dd>
        <dt>Ön koşul</dt>
        <dd>
          {lesson.prerequisites.length === 0
            ? "Yok"
            : lesson.prerequisites.map((p) => {
                const pl = lessonById(p);
                const c = tenant ? completionOf(store, p) : { done: false };
                return (
                  <span key={p} style={{ marginRight: "0.6rem" }}>
                    <Link href={hrefFor(p)}>{pl?.title.tr ?? p}</Link> {c.done ? <span className="badge ok">tamam</span> : <span className="badge neutral">henüz değil</span>}
                  </span>
                );
              })}
        </dd>
        <dt>Bağlı görev (ÖĞR-04)</dt>
        <dd>
          <Link href={lesson.related_task.route}>{lesson.related_task.label}</Link>
        </dd>
        <dt>Kaynaklar</dt>
        <dd>
          {lesson.sources.map((k) => {
            const s = sourceByCode(k);
            return (
              <span key={k} style={{ marginRight: "0.6rem" }}>
                <Link href={`/protokoller/?k=${k}`} className="mono">{k}</Link> {s ? <span className="small muted">{s.title}</span> : null}
              </span>
            );
          })}
        </dd>
        <dt>Gözden geçirme</dt>
        <dd>{String(lesson.review_date)} · içerik sürümü; içerik editörü onayı bekleniyor</dd>
      </dl>

      {lesson.field_summary && (
        <div className="row" style={{ marginTop: "0.75rem" }}>
          <button type="button" aria-pressed={!fieldMode} onClick={() => setFieldMode(false)}>Tam ders</button>
          <button type="button" aria-pressed={fieldMode} onClick={() => setFieldMode(true)}>Saha sürümü (≤3 dk)</button>
        </div>
      )}

      <section className="ogr-section">
        <h3>Sade açıklama</h3>
        {(fieldMode && lesson.field_summary ? lesson.field_summary : lesson.explanation).map((p, i) => (
          <p key={i}>{p}</p>
        ))}
        {fieldMode && profile && profile.example_documents.length > 0 && (
          <p className="small">
            Profilinizdeki örnek belgeler: {profile.example_documents.join(", ")}.
          </p>
        )}
      </section>
      {!fieldMode && (
        <>
          <section className="ogr-section">
            <h3>İş örneği</h3>
            <p>{lesson.business_example}</p>
          </section>
          <section className="ogr-section">
            <h3>Sık yapılan hata</h3>
            <p>{lesson.common_mistake}</p>
          </section>
          <section className="ogr-section">
            <h3>Küçük uygulama</h3>
            <p>{lesson.exercise.prompt}</p>
            <ol>
              {lesson.exercise.steps.map((s, i) => (
                <li key={i}>{s}</li>
              ))}
            </ol>
            <p className="small muted">{lesson.exercise.note}</p>
          </section>
        </>
      )}

      <section className="ogr-section ogr-quiz">
        <h3>Üç soru</h3>
        <p className="small muted">Yanlış cevapta yalnız doğru seçenek değil, neden yanlış olduğu da gösterilir.</p>
        {lesson.quiz.map((q, qi) => (
          <fieldset key={qi}>
            <legend>
              {qi + 1}. {q.q}
            </legend>
            {q.options.map((o, oi) => {
              const chosen = answers[qi] === oi;
              const cls = checked && chosen ? (oi === q.correct ? "opt right" : "opt wrong") : checked && oi === q.correct ? "opt right" : "opt";
              return (
                <div key={oi}>
                  <label className={cls}>
                    <input
                      type="radio"
                      name={`q-${lesson.id}-${qi}`}
                      checked={chosen}
                      onChange={() => {
                        setChecked(false);
                        setAnswers((a) => a.map((x, i) => (i === qi ? oi : x)));
                      }}
                    />
                    <span>{o}</span>
                  </label>
                  {checked && (chosen || oi === q.correct) && <div className="why">{q.explanations[oi]}</div>}
                </div>
              );
            })}
          </fieldset>
        ))}
        <div className="actions row">
          <button type="button" onClick={() => setChecked(true)} disabled={!allAnswered}>
            Cevapları kontrol et
          </button>
          {checked && <span className="small">Doğru: {answers.filter((a, i) => a === lesson.quiz[i].correct).length}/{lesson.quiz.length} — yanlışların gerekçesi yukarıda.</span>}
        </div>
      </section>

      <section className="ogr-section">
        <h3>Modülü tamamla</h3>
        <ErrorBox error={err} />
        {saved && (
          <Notice kind="ok" title="Modül tamamlandı">
            <p>
              Bu tarayıcıda kaydedildi ({fmtDate(saved.completed_at)}). Eğitim süresi birim toplamına yazıldı; kişi bazlı liste tutulmaz.
              {next ? (
                <>
                  {" "}Sıradaki ders: <Link href={hrefFor(next.id)}>{next.title.tr}</Link>.
                </>
              ) : (
                <> Yoldaki dersler bitti; <Link href="/101/">tüm modüllere</Link> dönebilirsiniz.</>
              )}{" "}
              Uygulama görevi: <Link href={lesson.related_task.route}>{lesson.related_task.label}</Link>.
            </p>
          </Notice>
        )}
        {!tenant ? (
          <p className="small muted">İlerleme kaydı için kurum seçin; ders kurum olmadan da okunabilir.</p>
        ) : completion.done && !completion.stale && !saved ? (
          <p className="small muted">Bu modül {completion.row ? fmtDate(completion.row.completed_at) : ""} tarihinde tamamlandı. Tekrar okumak serbesttir; kayıt değişmez.</p>
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              setErr(null);
              try {
                setSaved(completeLesson(store, lesson.id, { unit_id: unit || null, answers }));
              } catch (ex) {
                setErr(ex);
              }
            }}
          >
            <div className="field" style={{ maxWidth: 420 }}>
              <label htmlFor="unit">Eğitim süresi hangi birime yazılsın?</label>
              <select id="unit" value={unit} onChange={(e) => setUnit(e.target.value)}>
                <option value="">Kurum geneli</option>
                {facilities.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name}
                  </option>
                ))}
              </select>
              <span className="hint">Eğitim saati GÖS paketine birim düzeyinde toplu yazılır (ÖĞR-04); kişi adı tutulmaz (kural 11).</span>
            </div>
            <div className="actions">
              <button className="primary" type="submit" disabled={!allAnswered}>
                Modülü tamamlandı olarak işaretle
              </button>
              {!allAnswered && <span className="small muted">Önce üç soruyu cevaplayın.</span>}
            </div>
          </form>
        )}
      </section>
    </article>
  );
}

function UnitTotals({ store }: { store: Store }) {
  const rows = trainingByUnit(store);
  return (
    <div className="card">
      <h2>Eğitim süresi — birim düzeyinde toplam (ÖĞR-04)</h2>
      {rows.length === 0 ? (
        <p className="muted">Henüz tamamlanan modül yok. İlk modül tamamlanınca birim toplamı burada görünür.</p>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Birim</th>
                <th>Toplam süre (dk)</th>
                <th>Tamamlanan modül</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.unit_id ?? "all"}>
                  <td>{r.unit_label}</td>
                  <td className="num">{r.minutes}</td>
                  <td className="num">{r.completions}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="small muted">Yalnız toplamlar gösterilir; kişi bazlı ilerleme listesi ve sıralama yoktur (§07, kural 11). Süre, dersin tasarım hedefidir; ölçülmüş harcanan zaman değildir.</p>
    </div>
  );
}
