// Küçük, çizgisel simge seti (16px). Süs değil yönlendirme: her simge bir menü öğesini işaretler.
export type IconName =
  | "home" | "info" | "people" | "building" | "edit" | "layers" | "check" | "eye" | "lock" | "file" | "grid"
  | "book" | "shield" | "calendar" | "search" | "spark" | "box" | "chart" | "settings" | "flag" | "docs" | "beaker" | "alert" | "list" | "menu";

const P: Record<IconName, string> = {
  home: "M3 10.5 12 3l9 7.5V21H15v-6H9v6H3z",
  info: "M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zm0-11v6m0-10v1",
  people: "M16 11a4 4 0 1 0-8 0 4 4 0 0 0 8 0zM4 21a8 8 0 0 1 16 0",
  building: "M4 21V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v16M16 9h2a2 2 0 0 1 2 2v10M8 7h4M8 11h4M8 15h4",
  edit: "M4 20h4l10-10-4-4L4 16v4zM13 7l4 4",
  layers: "m12 3 9 5-9 5-9-5 9-5zM3 13l9 5 9-5M3 17l9 5 9-5",
  check: "M4 12l5 5L20 6",
  eye: "M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12zm10 3a3 3 0 1 0 0-6 3 3 0 0 0 0 6z",
  lock: "M6 11V8a6 6 0 0 1 12 0v3M5 11h14v10H5z",
  file: "M6 2h8l5 5v15H6zM14 2v5h5M9 13h6M9 17h6",
  grid: "M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z",
  book: "M4 4h7a2 2 0 0 1 2 2v14a2 2 0 0 0-2-2H4zM20 4h-7a2 2 0 0 0-2 2v14a2 2 0 0 1 2-2h7z",
  shield: "M12 2 4 6v6c0 5 3.5 8.5 8 10 4.5-1.5 8-5 8-10V6z",
  calendar: "M4 6h16v15H4zM4 10h16M8 3v4M16 3v4",
  search: "M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM21 21l-5-5",
  spark: "M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M6 18l2.5-2.5M15.5 8.5 18 6",
  box: "M3 7l9-4 9 4v10l-9 4-9-4zM3 7l9 4 9-4M12 11v10",
  chart: "M4 20V10M10 20V4M16 20v-8M22 20H2",
  settings: "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19 12a7 7 0 0 0-.1-1l2-1.5-2-3.4-2.3.9a7 7 0 0 0-1.7-1L14.5 3h-5l-.4 2.4a7 7 0 0 0-1.7 1L5 5.5l-2 3.4L5 10.4a7 7 0 0 0 0 2L3 14l2 3.4 2.4-.9a7 7 0 0 0 1.7 1l.4 2.5h5l.4-2.5a7 7 0 0 0 1.7-1l2.3.9 2-3.4-2-1.5c.1-.3.1-.7.1-1z",
  flag: "M5 21V4h12l-2 4 2 4H5",
  docs: "M8 3h9l4 4v12a2 2 0 0 1-2 2H8zM4 7v14h11M16 3v5h5",
  beaker: "M9 3h6M10 3v6L4 20h16l-6-11V3",
  alert: "M12 3 2 21h20zM12 10v5m0 3v1",
  list: "M8 6h13M8 12h13M8 18h13M3 6h1M3 12h1M3 18h1",
  menu: "M4 7h16M4 12h16M4 17h16",
};

export function Icon({ name, size = 16 }: { name: IconName; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={P[name]} />
    </svg>
  );
}
