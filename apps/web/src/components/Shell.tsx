"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { PREVIEW_USERS, ROLE_LABEL } from "@/lib/domain";
import { useStore } from "@/lib/useStore";
import { Icon, type IconName } from "./icons";

type Status = "hazir" | "kismi" | "planli";
type NavItem = { href: string; label: string; icon: IconName; status?: Status; dilim?: string };

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
    group: "Çalışma akışı",
    items: [
      { href: "/kurulum/", label: "Kurum kurulumu", icon: "building", status: "hazir", dilim: "1" },
      { href: "/veri-girisi/", label: "Veri girişi", icon: "edit", status: "kismi", dilim: "1" },
      { href: "/envanter/", label: "Emisyon envanteri", icon: "layers", status: "kismi", dilim: "1" },
      { href: "/gorevler/", label: "Görevler ve talepler", icon: "check", status: "kismi", dilim: "1" },
      { href: "/inceleme/", label: "İnceleme kuyruğu", icon: "eye", status: "hazir", dilim: "1" },
      { href: "/donem/", label: "Dönem kapanışı", icon: "lock", status: "hazir", dilim: "1" },
      { href: "/raporlar/", label: "Raporlar ve kanıtlar", icon: "file", status: "kismi", dilim: "1" },
      { href: "/faktorler/", label: "Faktör kataloğu", icon: "grid", status: "kismi", dilim: "1" },
    ],
  },
  {
    group: "Öğrenme ve kaynak",
    items: [
      { href: "/101/", label: "Sürdürülebilirlik 101", icon: "book", status: "planli", dilim: "3" },
      { href: "/protokoller/", label: "Protokoller ve standartlar", icon: "shield", status: "planli", dilim: "3" },
      { href: "/gundem/", label: "Gündem ve takvim", icon: "calendar", status: "planli", dilim: "8" },
      { href: "/sozluk/", label: "Sözlük", icon: "search", status: "kismi", dilim: "3" },
      { href: "/asistan/", label: "Asistan", icon: "spark", status: "planli", dilim: "3" },
    ],
  },
  {
    group: "İleri",
    items: [
      { href: "/urun/", label: "Ürün ve yaşam döngüsü", icon: "box", status: "planli", dilim: "7+" },
      { href: "/analiz/", label: "Analiz ve hedefler", icon: "chart", status: "planli", dilim: "4" },
      { href: "/ayarlar/", label: "Kurum ayarları", icon: "settings", status: "kismi", dilim: "0" },
    ],
  },
  {
    group: "Proje ve doğrulama",
    items: [
      { href: "/durum/", label: "Proje durumu", icon: "flag" },
      { href: "/belgeler/", label: "Belgeler", icon: "docs" },
      { href: "/altin-set/", label: "Altın set (motor testi)", icon: "beaker" },
      { href: "/hatalar/", label: "Hata sözlüğü", icon: "alert" },
      { href: "/denetim-izi/", label: "Denetim izi", icon: "list", dilim: "0" },
    ],
  },
];

const ST: Record<Status, { cls: string; text: string }> = { hazir: { cls: "ok", text: "hazır" }, kismi: { cls: "warn", text: "kısmi" }, planli: { cls: "", text: "planlı" } };

export function Shell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const { store, ready, storage } = useStore();
  const base = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
  const path = (pathname ?? "/").replace(base, "") || "/";
  const isActive = (href: string) => (href === "/" ? path === "/" : path.startsWith(href.replace(/\/$/, "")));
  useEffect(() => setOpen(false), [pathname]);

  return (
    <div className="shell">
      {open && <div className="scrim" onClick={() => setOpen(false)} aria-hidden="true" />}
      <nav id="nav" className={`nav${open ? " open" : ""}`} aria-label="Ana menü">
        <Link href="/" className="brand">
          <span className="mark" aria-hidden="true">K</span>
          <span>
            <span className="name">Koza</span>
            <span className="sub">Önizleme · Dilim 0–1</span>
          </span>
        </Link>
        {NAV.map((g) => (
          <div key={g.group}>
            <div className="nav-group">{g.group}</div>
            {g.items.map((it) => (
              <Link key={it.href} href={it.href} className="item" aria-current={isActive(it.href) ? "page" : undefined}>
                <Icon name={it.icon} />
                <span>{it.label}</span>
                {it.status && (
                  <span className={`st ${ST[it.status].cls}`} title={it.dilim ? `Dilim ${it.dilim}` : undefined}>
                    {ST[it.status].text}
                  </span>
                )}
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
