"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { PREVIEW_USERS, ROLE_LABEL } from "@/lib/domain";
import { useStore } from "@/lib/useStore";

type NavItem = { href: string; label: string; status?: "hazir" | "kismi" | "planli"; dilim?: string };

const NAV: { group: string; items: NavItem[] }[] = [
  {
    group: "Çalışma",
    items: [
      { href: "/", label: "Ana sayfa", status: "hazir" },
      { href: "/kurulum/", label: "Kurum kurulumu", status: "hazir", dilim: "1" },
      { href: "/veri-girisi/", label: "Veri girişi", status: "kismi", dilim: "1" },
      { href: "/envanter/", label: "Emisyon envanteri", status: "kismi", dilim: "1" },
      { href: "/gorevler/", label: "Görevler ve talepler", status: "kismi", dilim: "1" },
      { href: "/inceleme/", label: "İnceleme kuyruğu", status: "hazir", dilim: "1" },
      { href: "/donem/", label: "Dönem kapanışı", status: "hazir", dilim: "1" },
      { href: "/raporlar/", label: "Raporlar ve kanıtlar", status: "kismi", dilim: "1" },
      { href: "/faktorler/", label: "Faktör kataloğu", status: "kismi", dilim: "1" },
    ],
  },
  {
    group: "Öğrenme ve kaynak",
    items: [
      { href: "/101/", label: "Sürdürülebilirlik 101", status: "planli", dilim: "3" },
      { href: "/protokoller/", label: "Protokoller ve standartlar", status: "planli", dilim: "3" },
      { href: "/gundem/", label: "Gündem ve takvim", status: "planli", dilim: "8" },
      { href: "/sozluk/", label: "Sözlük", status: "kismi", dilim: "3" },
      { href: "/asistan/", label: "Asistan", status: "planli", dilim: "3" },
    ],
  },
  {
    group: "İleri",
    items: [
      { href: "/urun/", label: "Ürün ve yaşam döngüsü", status: "planli", dilim: "7+" },
      { href: "/analiz/", label: "Analiz ve hedefler", status: "planli", dilim: "4" },
      { href: "/ayarlar/", label: "Kurum ayarları", status: "kismi", dilim: "0" },
    ],
  },
  {
    group: "Proje ve doğrulama",
    items: [
      { href: "/durum/", label: "Proje durumu", status: "hazir" },
      { href: "/belgeler/", label: "Belgeler", status: "hazir" },
      { href: "/altin-set/", label: "Altın set (motor testi)", status: "hazir" },
      { href: "/denetim-izi/", label: "Denetim izi", status: "hazir", dilim: "0" },
    ],
  },
];

const STATUS_BADGE: Record<NonNullable<NavItem["status"]>, { cls: string; text: string }> = {
  hazir: { cls: "ok", text: "hazır" },
  kismi: { cls: "warn", text: "kısmi" },
  planli: { cls: "neutral", text: "planlı" },
};

export function Shell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const { store, ready, storage } = useStore();
  const base = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
  const isActive = (href: string) => {
    const p = pathname.replace(base, "") || "/";
    return href === "/" ? p === "/" : p.startsWith(href.replace(/\/$/, ""));
  };

  return (
    <div className="shell">
      <nav className={`nav${open ? " open" : ""}`} aria-label="Ana menü">
        <div className="brand">
          <strong>KOZA</strong>
          <span>önizleme · Dilim 0–1</span>
        </div>
        {NAV.map((g) => (
          <div key={g.group}>
            <div className="nav-group">{g.group}</div>
            {g.items.map((it) => (
              <Link key={it.href} href={it.href} aria-current={isActive(it.href) ? "page" : undefined} onClick={() => setOpen(false)}>
                <span>{it.label}</span>
                {it.status && (
                  <span className={`badge ${STATUS_BADGE[it.status].cls}`} title={it.dilim ? `Dilim ${it.dilim}` : undefined}>
                    {STATUS_BADGE[it.status].text}
                  </span>
                )}
              </Link>
            ))}
          </div>
        ))}
      </nav>
      <div className="main">
        <div className="topbar">
          <div className="row">
            <button className="menu-toggle" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-controls="nav">
              Menü
            </button>
            <span className="badge info">Önizleme deposu: bu tarayıcı</span>
            {!storage && <span className="badge crit">Tarayıcı deposu kapalı — kayıt yapılamaz</span>}
          </div>
          {ready && store && (
            <div className="ctx">
              <label>
                Kurum
                <select
                  value={store.session.tenant_id ?? ""}
                  onChange={(e) => {
                    if (e.target.value) store.switchTenant(e.target.value);
                  }}
                  aria-label="Aktif kurum"
                >
                  <option value="">— kurum yok —</option>
                  {store.db.tenants.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Kullanıcı
                <select value={store.session.user_id} onChange={(e) => store.switchUser(e.target.value)} aria-label="Aktif kullanıcı ve rol">
                  {PREVIEW_USERS.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name} — {ROLE_LABEL[u.role]}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          )}
        </div>
        {children}
      </div>
    </div>
  );
}
