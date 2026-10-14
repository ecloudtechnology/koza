"use client";
import Link from "next/link";
import { ROLE_LABEL } from "@/lib/domain";
import { useStore, fmtDate } from "@/lib/useStore";
import { Loading, StateBadge } from "@/components/ui";

const CHAIN = [
  ["Kurulum", "/kurulum/", "Kurum, profil, kaynaklar"],
  ["Veri", "/veri-girisi/", "Kanıtlı doğal gaz kaydı"],
  ["Hesap", "/envanter/", "Motorla önizleme ve koşu"],
  ["Kontrol", "/inceleme/", "Uzman incelemesi ve onay"],
  ["Dönem", "/donem/", "Kapanış listesi ve kilit"],
  ["Rapor", "/raporlar/", "Sabit manifest"],
] as const;

export default function Home() {
  const { store, ready } = useStore();
  if (!ready || !store) return <Loading />;
  const tenant = store.tenant;

  // "Sonraki adım" depo durumundan türetilir (§05 ana sayfa: bugünkü işler, eksikler, sonraki adım)
  let next: { title: string; href: string; why: string; stage: number };
  if (!tenant) next = { title: "Kurum kurulumunu başlat", href: "/kurulum/", why: "Henüz kurum yok. Kurum adı, sektör (NACE) ve kaynak envanteriyle başlanır (ONB-01…03).", stage: 0 };
  else if (!tenant.profile_confirmed || store.sources().length === 0 || store.periods().length === 0)
    next = { title: "Kurulumu tamamla", href: "/kurulum/", why: "Profil onayı, tesis, raporlama dönemi veya kaynak envanteri eksik. Kurulum kaldığı adımdan devam eder (§06).", stage: 0 };
  else {
    const recs = store.records();
    const by = (s: string) => recs.filter((r) => r.state === s);
    if (recs.length === 0) next = { title: "İlk doğal gaz kaydını gir", href: "/veri-girisi/", why: "Kaynak envanteri hazır. İlk görev: bir eğitim kaydı veya gerçek fatura (§06).", stage: 1 };
    else if (by("validation_required").length) next = { title: "Eksik bilgiyi tamamla", href: "/gorevler/", why: `${by("validation_required").length} kayıt doğrulama bekliyor; görevlerde hangi alanın eksik olduğu yazılı (T20).`, stage: 1 };
    else if (by("draft").length) next = { title: "Taslağı hesapla", href: `/kayit/?id=${by("draft")[0].id}`, why: "Taslak kayıt var; hesap önizlemesi motorla çalıştırılır (DAT-05).", stage: 2 };
    else if (by("changes_requested").length) next = { title: "Düzeltme istenen kaydı güncelle", href: `/kayit/?id=${by("changes_requested")[0].id}`, why: "İnceleyen gerekçe yazdı; kayıt yeni sürümle düzeltilir.", stage: 2 };
    else if (by("calculated").length) next = { title: "Kontrole gönder", href: `/kayit/?id=${by("calculated")[0].id}`, why: "Hesaplandı, onaylandı demek değildir (§21). İnceleme için gönderin.", stage: 3 };
    else if (by("in_review").length) next = { title: "İnceleme kuyruğuna git", href: "/inceleme/", why: `${by("in_review").length} kayıt incelemede. Veri giren ile onaylayan farklı olmalı; üst çubuktan rolü değiştirin.`, stage: 3 };
    else if (by("approved").length && store.periods().some((p) => p.status === "open")) next = { title: "Dönemi kapat", href: "/donem/", why: "Onaylı kayıtlar var; kapanış listesi eksikleri gösterir, yönetici kilitler (§21).", stage: 4 };
    else next = { title: "Rapor sürümü oluştur", href: "/raporlar/", why: "Kilitli dönem için sabit manifestli rapor üretilir (T19).", stage: 5 };
  }

  const tasks = tenant ? store.tasks().filter((t) => t.status === "open") : [];
  const recent = tenant ? store.db.audit.filter((a) => a.tenant_id === tenant.id).slice(-6).reverse() : [];
  const recs = tenant ? store.records() : [];
  const n = (s: string) => recs.filter((r) => r.state === s).length;

  return (
    <>
      <section className="hero">
        <div style={{ fontSize: "0.7rem", letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--accent)", fontWeight: 600, marginBottom: "0.4rem" }}>
          {tenant ? tenant.name : "Hoş geldiniz"} · {store.user.name} ({ROLE_LABEL[store.role]})
        </div>
        <h1>Ne yapmak istiyorsun?</h1>
        <p className="lead">{next.why}</p>
        <div className="actions">
          <Link className="btn primary" href={next.href}>
            {next.title} →
          </Link>
          {!tenant && (
            <Link className="btn" href="/hakkinda/">
              Önce Koza nedir?
            </Link>
          )}
        </div>
        {tenant && (
          <div className="stat-row">
            <div className="stat"><span className="v">{recs.length}</span><span className="l">Kayıt</span></div>
            <div className="stat"><span className="v">{n("in_review")}</span><span className="l">İncelemede</span></div>
            <div className="stat"><span className="v">{n("approved") + n("locked")}</span><span className="l">Onaylı</span></div>
            <div className="stat"><span className="v">{tasks.length}</span><span className="l">Açık görev</span></div>
          </div>
        )}
      </section>

      <div className="flow" aria-label="Çalışma zinciri">
        {CHAIN.map(([t, href, d], i) => (
          <Link key={t} href={href} className={`node${i === next.stage ? " on" : ""}`}>
            <div className="k">Adım {i + 1}</div>
            <div className="t">{t}</div>
            <div className="d">{d}</div>
          </Link>
        ))}
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
                  <Link href={t.related_record_id ? `/kayit/?id=${t.related_record_id}` : "/gorevler/"}>{t.title}</Link> <span className="badge neutral">{t.requirement_ids.join(", ")}</span>
                </li>
              ))}
            </ul>
          )}
          <p className="small">
            <Link href="/gorevler/">Tüm görevler</Link>
          </p>
        </div>
        <div className="card adv">
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

      <div className="card">
        <h2>Hızlı erişim</h2>
        <div className="quick">
          <Link href="/veri-girisi/"><b>Kayıt gir</b><span>Fatura, malzeme, sevkiyat, atık, seyahat…</span></Link>
          <Link href="/ice-aktar/"><b>Dosyadan yükle</b><span>CSV veya Excel ile toplu kayıt</span></Link>
          <Link href="/inceleme/"><b>İnceleme</b><span>Onay bekleyen kayıtlar</span></Link>
          <Link href="/raporlar/"><b>Raporlar</b><span>Dönem raporu ve kanıt indeksi</span></Link>
          <Link href="/analiz/"><b>Analiz</b><span>Yoğunluk, hedefler, iki hedefin durumu</span></Link>
          <Link href="/asistan/"><b>Asistan</b><span>"Bu kutuya ne yazacağım?"</span></Link>
        </div>
      </div>

      {recs.length > 0 && (
        <div className="card adv">
          <h2>Kayıt durumları</h2>
          <div className="row">
            {recs.map((r) => (
              <Link key={r.id} href={`/kayit/?id=${r.id}`} className="small" style={{ textDecoration: "none" }}>
                <StateBadge state={r.state} /> <span className="mono">{r.id.slice(0, 12)}</span>
              </Link>
            ))}
          </div>
        </div>
      )}

      <div className="card quiet adv">
        <h3 style={{ marginTop: 0 }}>Bu önizleme hakkında</h3>
        <p className="small" style={{ marginBottom: 0 }}>
          Bu, Koza'nın inceleme için yayımlanmış önizlemesidir: kayıtlar yalnız bu tarayıcıda saklanır; hesabı tarayıcıda çalışan aynı Python motoru yapar; sunucu, veritabanı ve kimlik
          katmanı depodaki kodda ve testlerde çalışır (bkz. Üretime geçiş). Tüm emisyon faktörleri <b>kurgusal test değeridir</b>; gerçek katalog uzman onayıyla yüklenir. İnceleyenler
          için: <Link href="/belgeler/?d=inceleme-rehberi">İnceleme rehberi</Link> · <Link href="/durum/">Proje durumu</Link> · <Link href="/hatalar/">Hata sözlüğü</Link>
        </p>
      </div>
    </>
  );
}
