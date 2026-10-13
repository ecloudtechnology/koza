"use client";
import { useMemo, useSyncExternalStore } from "react";
import { Store, storageAvailable } from "./store";

// Depo, tarayıcı olayına (koza:db / storage) abone bir dış kaynak olarak okunur.
// Sunucu tarafı render'da anlık görüntü -1'dir → `ready` false ve bileşenler "yükleniyor" gösterir (§28).
let version = 0;
function subscribe(cb: () => void) {
  const h = () => {
    version += 1;
    cb();
  };
  window.addEventListener("koza:db", h);
  window.addEventListener("storage", h);
  return () => {
    window.removeEventListener("koza:db", h);
    window.removeEventListener("storage", h);
  };
}

export function useStore(): { store: Store | null; ready: boolean; storage: boolean; tick: number } {
  const tick = useSyncExternalStore(
    subscribe,
    () => version,
    () => -1
  );
  const store = useMemo(() => (tick < 0 ? null : new Store()), [tick]);
  const storage = useMemo(() => (tick < 0 ? true : storageAvailable()), [tick]);
  return { store, ready: store !== null, storage, tick };
}

export function fmtDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString("tr-TR", { dateStyle: "medium", timeStyle: "short" });
  } catch {
    return iso;
  }
}

// Ondalık dizeyi Türkçe yerelle gösterir (yalnız sunum; hesap yapılmaz — §18 yuvarlama sunumda)
export function fmtDec(s: string | null | undefined, maxFrac = 3): string {
  if (s === null || s === undefined) return "—";
  const neg = s.startsWith("-");
  const [ip, fp = ""] = (neg ? s.slice(1) : s).split(".");
  const ipFmt = ip.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  const frac = fp.slice(0, maxFrac).replace(/0+$/, "");
  const truncated = fp.length > maxFrac && fp.slice(maxFrac).replace(/0+$/, "").length > 0;
  return `${neg ? "-" : ""}${ipFmt}${frac ? "," + frac : ""}${truncated ? "…" : ""}`;
}

export function kgToT(kg: string | null): string {
  if (kg === null) return "—";
  // kg → t: ondalık noktayı 3 basamak sola kaydır (aritmetik değil, gösterim)
  const neg = kg.startsWith("-");
  const [ip, fp = ""] = (neg ? kg.slice(1) : kg).split(".");
  const digits = ip.padStart(4, "0");
  const t = `${digits.slice(0, -3)}.${digits.slice(-3)}${fp}`.replace(/^0+(?=\d)/, "").replace(/\.?0+$/, "");
  return fmtDec((neg ? "-" : "") + (t === "" ? "0" : t), 6);
}
