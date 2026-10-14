"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { PREVIEW_USERS, ROLE_LABEL } from "@/lib/domain";
import { useStore } from "@/lib/useStore";
import { Icon, type IconName } from "./icons";
import "@/modules";

type NavItem = { href: string; label: string; icon: IconName };

export const NAV: { group: string; items: NavItem[] }[] = [
  {
    group: "Başlangıç",
    items: [
      { href: "/", label: "Ana sayfa", icon: "home" },
      { href: "/hakkinda/", label: "Koza nedir?", icon: "info" },
      { href: "/ekip/", label: "Ekip", icon: "people" },
    ],
  },
  {
    group: "Veri ve hesap",
    items: [
      { href: "/kurulum/", label: "Kurum kurulumu", icon: "building" },
      { href: "/veri-girisi/", label: "Veri girişi", icon: "edit" },
      { href: "/ice-aktar/", label: "İçe aktarma (CSV)", icon: "list" },
      { href: "/envanter/", label: "Emisyon envanteri", icon: "layers" },
      { href: "/urun/", label: "Ürün ve yaşam döngüsü", icon: "box" },
      { href: "/faktorler/", label: "Faktör kataloğu", icon: "grid" },
    ],
  },
  {
    group: "Kontrol ve rapor",
    items: [
      { href: "/gorevler/", label: "Görevler ve talepler", icon: "check" },
      { href: "/inceleme/", label: "İnceleme kuyruğu", icon: "eye" },
      { href: "/donem/", label: "Dönem kapanışı", icon: "lock" },
      { href: "/raporlar/", label: "Raporlar ve kanıtlar", icon: "file" },
    ],
  },
  {
    group: "Performans ve katılım",
    items: [
      { href: "/analiz/", label: "Analiz ve hedefler", icon: "chart" },
      { href: "/aksiyon/", label: "Karar kapısı ve aksiyon", icon: "flag" },
      { href: "/kaizen/", label: "Green Kaizen", icon: "spark" },
    ],
  },
  {
    group: "Dış ilişkiler ve uyum",
    items: [
      { href: "/tedarikci/", label: "Tedarikçi programı", icon: "people" },
      { href: "/regulasyon/", label: "Regülasyon paketleri", icon: "shield" },
      { href: "/senaryo/", label: "Senaryo defteri", icon: "chart" },
      { href: "/gundem/", label: "Gündem ve takvim", icon: "calendar" },
    ],
  },
  {
    group: "Öğrenme ve kaynak",
    items: [
      { href: "/101/", label: "Sürdürülebilirlik 101", icon: "book" },
      { href: "/protokoller/", label: "Protokoller ve standartlar", icon: "docs" },
      { href: "/sozluk/", label: "Sözlük", icon: "search" },
      { href: "/asistan/", label: "Asistan", icon: "spark" },
    ],
  },
  {
    group: "Yönetim ve doğrulama",
    items: [
      { href: "/ayarlar/", label: "Kurum ayarları", icon: "settings" },
      { href: "/denetim-izi/", label: "Denetim izi", icon: "list" },
      { href: "/durum/", label: "Proje durumu", icon: "flag" },
      { href: "/belgeler/", label: "Belgeler", icon: "docs" },
      { href: "/altin-set/", label: "Altın set (motor testi)", icon: "beaker" },
      { href: "/hatalar/", label: "Hata sözlüğü", icon: "alert" },
    ],
  },
];


export function Shell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const { store, ready, storage } = useStore();
  const base = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
  const path = (pathname ?? "/").replace(base, "") || "/";
  const isActive = (href: string) => (href === "/" ? path === "/" : path.startsWith(href.replace(/\/$/, "")));

  return (
    <div className="shell">
      {open && <div className="scrim" onClick={() => setOpen(false)} aria-hidden="true" />}
      <nav id="nav" className={`nav${open ? " open" : ""}`} aria-label="Ana menü">
        <Link href="/" className="brand">
          <span className="mark" aria-hidden="true">K</span>
          <span>
            <span className="name">Koza</span>
            <span className="sub">Sürdürülebilirlik platformu</span>
          </span>
        </Link>
        {NAV.map((g) => (
          <div key={g.group}>
            <div className="nav-group">{g.group}</div>
            {g.items.map((it) => (
              <Link key={it.href} href={it.href} className="item" aria-current={isActive(it.href) ? "page" : undefined} onClick={() => setOpen(false)}>
                <Icon name={it.icon} />
                <span>{it.label}</span>
              </Link>
            ))}
          </div>
        ))}
        <div className="nav-foot">
          MEXT · İş Dünyasında Sorumlu Üretim grubu
          <br />
          Mentor: Onur Dedeoğlu
        </div>
      </nav>
      <div className="main">
        <div className="topbar">
          <div className="row">
            <button className="menu-toggle" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-controls="nav">
              <Icon name="menu" /> Menü
            </button>
            <span className="badge info" title="Kayıtlar yalnız bu tarayıcıda saklanır (karar K-16)">
              Önizleme deposu: bu tarayıcı
            </span>
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
        <div className="content">{children}</div>
      </div>
    </div>
  );
}
