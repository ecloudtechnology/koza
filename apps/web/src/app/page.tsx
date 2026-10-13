"use client";
import Link from "next/link";
import { ROLE_LABEL } from "@/lib/domain";
import { useStore, fmtDate } from "@/lib/useStore";
import { Loading, Notice, StateBadge } from "@/components/ui";

export default function Home() {
  const { store, ready } = useStore();
  if (!ready || !store) return <Loading />;
  const tenant = store.tenant;

  // "Sonraki adım": depo durumundan türetilir (§05 ana sayfa: bugünkü işler, eksikler, sonraki adım)
  let next: { title: string; href: string; why: string };
  if (!tenant) next = { title: "Kurum kurulumunu başlat", href: "/kurulum/", why: "Henüz kurum yok. Kurum adı, sektör (NACE) ve kaynak envanteriyle başlanır (ONB-01…03)." };
  else if (!tenant.profile_confirmed || store.sources().length === 0 || store.periods().length === 0)
    next = { title: "Kurulumu tamamla", href: "/kurulum/", why: "Profil onayı, tesis, raporlama dönemi veya kaynak envanteri eksik. Kurulum kaldığı adımdan devam eder (§06)." };
  else {
    const recs = store.records();
    const byState = (s: string) => recs.filter((r) => r.state === s);
    if (recs.length === 0) next = { title: "İlk doğal gaz kaydını gir", href: "/veri-girisi/", why: "Kaynak envanteri hazır. İlk görev: bir eğitim kaydı veya gerçek fatura (§06 ilk görev)." };
    else if (byState("validation_required").length) next = { title: "Eksik bilgiyi tamamla", href: "/gorevler/", why: `${byState("validation_required").length} kayıt doğrulama bekliyor; görevlerde hangi alanın eksik olduğu yazılı (T20).` };
    else if (byState("draft").length) next = { title: "Taslağı hesapla", href: `/kayit/?id=${byState("draft")[0].id}`, why: "Taslak kayıt var; hesap önizlemesi motorla çalıştırılır (DAT-05)." };
    else if (byState("changes_requested").length) next = { title: "Düzeltme istenen kaydı güncelle", href: `/kayit/?id=${byState("changes_requested")[0].id}`, why: "İnceleyen gerekçe yazdı; kayıt yeni sürümle düzeltilir." };
    else if (byState("calculated").length) next = { title: "Kontrole gönder", href: `/kayit/?id=${byState("calculated")[0].id}`, why: "Hesaplandı, onaylandı demek değildir (§21). İnceleme için gönderin." };
    else if (byState("in_review").length) next = { title: "İnceleme kuyruğu", href: "/inceleme/", why: `${byState("in_review").length} kayıt incelemede. Veri giren ile onaylayan farklı olmalı; üst çubuktan rolü değiştirin.` };
    else if (byState("approved").length && store.periods().some((p) => p.status === "open")) next = { title: "Dönemi kapat", href: "/donem/", why: "Onaylı kayıtlar var; kapanış listesi eksikleri gösterir, yönetici kilitler (§21)." };
    else next = { title: "Rapor sürümü oluştur", href: "/raporlar/", why: "Kilitli dönem için sabit manifestli rapor üretilir (T19)." };
  }

  const tasks = tenant ? store.tasks().filter((t) => t.status === "open") : [];
  const recent = tenant ? store.db.audit.filter((a) => a.tenant_id === tenant.id).slice(-6).reverse() : [];

  return (
    <>
      <h1>Ne yapmak istiyorsun?</h1>
      <p className="muted">
        Oturum: <b>{store.user.name}</b> ({ROLE_LABEL[store.role]}){tenant ? <> · Kurum: <b>{tenant.name}</b></> : null}
      </p>

      <div className="card">
        <h2>Sonraki adım</h2>
        <p>
          <Link className="btn primary" href={next.href}>
            {next.title}
          </Link>
        </p>
        <p className="small">{next.why}</p>
      </div>

      <div className="grid-2">
        <div className="card">
          <h2>Bugünkü işler</h2>
          {tasks.length === 0 ? (
            <p className="muted">Açık görev yok.</p>
          ) : (
            <ul>
              {tasks.slice(0, 6).map((t) => (
                <li key={t.id}>
                  <Link href={t.related_record_id ? `/kayit/?id=${t.related_record_id}` : "/gorevler/"}>{t.title}</Link>{" "}
                  <span className="badge neutral">{t.requirement_ids.join(", ")}</span>
                </li>
              ))}
            </ul>
          )}
          <p className="small">
            <Link href="/gorevler/">Tüm görevler</Link>
          </p>
        </div>
        <div className="card">
          <h2>Son değişiklikler</h2>
          {recent.length === 0 ? (
            <p className="muted">Henüz işlem yok.</p>
          ) : (
            <ul className="small">
              {recent.map((a) => (
                <li key={a.id}>
                  <span className="mono">{a.action}</span> · {a.object_type} {a.object_version ? `v${a.object_version}` : ""} · {fmtDate(a.at)}
                </li>
              ))}
            </ul>
          )}
          <p className="small">
            <Link href="/denetim-izi/">Denetim izi</Link>
          </p>
        </div>
      </div>

      {tenant && store.records().length > 0 && (
        <div className="card">
          <h2>Kayıt durumları</h2>
          <div className="row">
            {store.records().map((r) => (
              <Link key={r.id} href={`/kayit/?id=${r.id}`} className="small">
                <StateBadge state={r.state} /> <span className="mono">{r.id.slice(0, 12)}</span>
              </Link>
            ))}
          </div>
        </div>
      )}

      <Notice kind="info">
        <p>
          <strong>Bu bir önizlemedir.</strong> Dilim 0–1 akışı (kurum kurulumu → doğal gaz kaydı → hesap → inceleme → dönem kapanışı → rapor) çalışır; hesabı
          tarayıcıda çalışan aynı Python motoru yapar. Kayıtlar yalnız bu tarayıcıda saklanır; sunucu, veritabanı ve gerçek yetki katmanı bu önizlemede yoktur
          (depodaki <code>apps/api</code> ve <code>db/migrations</code> bunların kodudur). Kullanılan tüm emisyon faktörleri <b>kurgusal test değerleridir</b>.
        </p>
        <p>
          İnceleyenler için: <Link href="/belgeler/?d=inceleme-rehberi">İnceleme rehberi</Link> · <Link href="/durum/">Proje durumu ve gereklilik izleme</Link>
        </p>
      </Notice>
    </>
  );
}
