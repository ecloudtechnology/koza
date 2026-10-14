"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { PREVIEW_USERS, ROLE_LABEL } from "@/lib/domain";
import { useStore } from "@/lib/useStore";
import { setUiMode, useUiMode } from "@/lib/ui-mode";
import { Icon, type IconName } from "./icons";
import "@/modules";

type NavItem = { href: string; label: string; icon: IconName; hint?: string };
type NavGroup = { id: string; group: string; items: NavItem[]; advanced?: boolean };

// Sade bilgi mimarisi: altı alan, alan başına en çok dört öğe; teknik alan yalnız ayrıntılı görünümde.
export const NAV: NavGroup[] = [
  {
    id: "basla",
    group: "Başla",
    items: [
      { href: "/", label: "Bugün", icon: "home", hint: "Sonraki adım ve yapılacaklar" },
      { href: "/kurulum/", label: "Kurulum", icon: "building", hint: "Kurum, tesis, dönem, kaynaklar" },
      { href: "/hakkinda/", label: "Koza nedir?", icon: "info" },
    ],
  },
  {
    id: "veri",
    group: "Veri",
    items: [
      { href: "/veri-girisi/", label: "Kayıt gir", icon: "edit", hint: "Fatura, malzeme, sevkiyat, atık…" },
      { href: "/ice-aktar/", label: "Dosyadan yükle", icon: "list", hint: "CSV / Excel" },
      { href: "/envanter/", label: "Envanter", icon: "layers", hint: "Kapsam 1 · 2 · 3" },
      { href: "/urun/", label: "Ürün çalışması", icon: "box" },
    ],
  },
  {
    id: "kontrol",
    group: "Kontrol ve rapor",
    items: [
      { href: "/gorevler/", label: "Görevler", icon: "check" },
      { href: "/inceleme/", label: "İnceleme", icon: "eye", hint: "Onay kuyruğu" },
      { href: "/donem/", label: "Dönem kapanışı", icon: "lock" },
      { href: "/raporlar/", label: "Raporlar", icon: "file" },
    ],
  },
  {
    id: "performans",
    group: "Performans",
    items: [
      { href: "/analiz/", label: "Analiz ve hedefler", icon: "chart" },
      { href: "/aksiyon/", label: "Aksiyonlar", icon: "flag", hint: "Karar kapısı" },
      { href: "/kaizen/", label: "Green Kaizen", icon: "spark", hint: "Saha önerileri" },
    ],
  },
  {
    id: "uyum",
    group: "Uyum ve dış ilişkiler",
    items: [
      { href: "/regulasyon/", label: "Regülasyon", icon: "shield", hint: "CBAM, ETS, TSRS" },
      { href: "/tedarikci/", label: "Tedarikçiler", icon: "people" },
      { href: "/senaryo/", label: "Senaryo defteri", icon: "chart" },
      { href: "/gundem/", label: "Gündem", icon: "calendar" },
    ],
  },
  {
    id: "ogren",
    group: "Öğren",
    items: [
      { href: "/101/", label: "Sürdürülebilirlik 101", icon: "book" },
      { href: "/sozluk/", label: "Sözlük", icon: "search" },
      { href: "/asistan/", label: "Asistan", icon: "spark" },
      { href: "/protokoller/", label: "Standartlar", icon: "docs" },
    ],
  },
  {
    id: "sistem",
    group: "Sistem ve doğrulama",
    advanced: true,
    items: [
      { href: "/ayarlar/", label: "Kurum ayarları", icon: "settings" },
      { href: "/faktorler/", label: "Faktör kataloğu", icon: "grid" },
      { href: "/denetim-izi/", label: "Denetim izi", icon: "list" },
      { href: "/durum/", label: "Proje durumu", icon: "flag" },
      { href: "/belgeler/", label: "Belgeler", icon: "docs" },
      { href: "/altin-set/", label: "Altın set", icon: "beaker" },
      { href: "/hatalar/", label: "Hata sözlüğü", icon: "alert" },
      { href: "/ekip/", label: "Ekip", icon: "people" },
    ],
  },
];

function readOpen(): Record<string, boolean> {
  try {
    return JSON.parse(localStorage.getItem("koza.ui.nav") ?? "{}");
  } catch {
    return {};
  }
}

export function Shell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [groupOpen, setGroupOpen] = useState<Record<string, boolean>>({});
  const { store, ready, storage } = useStore();
  const mode = useUiMode();
  const base = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
  const path = (pathname ?? "/").replace(base, "") || "/";
  const isActive = (href: string) => (href === "/" ? path === "/" : path.startsWith(href.replace(/\/$/, "")));

  useEffect(() => {
    document.documentElement.setAttribute("data-ui", mode);
  }, [mode]);
  useEffect(() => {
    const t = setTimeout(() => setGroupOpen(readOpen()), 0);
    return () => clearTimeout(t);
  }, []);
  const toggleGroup = (id: string, isOpen: boolean) => {
    const next = { ...groupOpen, [id]: isOpen };
    setGroupOpen(next);
    try {
      localStorage.setItem("koza.ui.nav", JSON.stringify(next));
    } catch {
      /* yoksay */
    }
  };

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
        {NAV.filter((g) => !g.advanced || mode === "ayrintili").map((g) => {
          const active = g.items.some((it) => isActive(it.href));
          const isOpen = groupOpen[g.id] ?? (active || g.id === "basla" || g.id === "veri" || g.id === "kontrol");
          return (
            <details key={g.id} className="nav-grp" open={isOpen || active} onToggle={(e) => toggleGroup(g.id, (e.target as HTMLDetailsElement).open)}>
              <summary className="nav-group">{g.group}</summary>
              {g.items.map((it) => (
                <Link key={it.href} href={it.href} className="item" aria-current={isActive(it.href) ? "page" : undefined} onClick={() => setOpen(false)} title={it.hint}>
                  <Icon name={it.icon} />
                  <span>
                    {it.label}
                    {it.hint && <span className="hint">{it.hint}</span>}
                  </span>
                </Link>
              ))}
            </details>
          );
        })}
        <div className="nav-foot">
          <button className="mode-btn" onClick={() => setUiMode(mode === "basit" ? "ayrintili" : "basit")} aria-pressed={mode === "ayrintili"}>
            {mode === "basit" ? "Ayrıntılı görünüme geç" : "Sade görünüme dön"}
          </button>
          <span>{mode === "basit" ? "Sade görünüm: teknik paneller ve sistem menüsü gizli." : "Ayrıntılı görünüm: dayanak kodları, iz kayıtları ve sistem menüsü açık."}</span>
        </div>
      </nav>
      <div className="main">
        <div className="topbar">
          <div className="row">
            <button className="menu-toggle" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-controls="nav">
              <Icon name="menu" /> Menü
            </button>
            {!storage && <span className="badge crit">Tarayıcı deposu kapalı — kayıt yapılamaz</span>}
          </div>
          {ready && store && (
            <div className="ctx">
              <label title="Kayıtların ait olduğu kurum">
                Kurum
                <select
                  value={store.session.tenant_id ?? ""}
                  onChange={(e) => {
                    if (e.target.value) store.switchTenant(e.target.value);
                  }}
                  aria-label="Aktif kurum"
                >
                  <option value="">— seçilmedi —</option>
                  {store.db.tenants.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </label>
              <label title="Önizlemede rolü buradan değiştirirsiniz; her rol ayrı bir kullanıcıdır">
                Rol
                <select value={store.session.user_id} onChange={(e) => store.switchUser(e.target.value)} aria-label="Aktif kullanıcı ve rol">
                  {PREVIEW_USERS.map((u) => (
                    <option key={u.id} value={u.id}>
                      {ROLE_LABEL[u.role]} · {u.name.split(" ")[0]}
                    </option>
                  ))}
                </select>
              </label>
              <span className="badge info adv" title="Kayıtlar yalnız bu tarayıcıda saklanır">
                önizleme deposu: bu tarayıcı
              </span>
            </div>
          )}
        </div>
        <div className="content">{children}</div>
      </div>
    </div>
  );
}
