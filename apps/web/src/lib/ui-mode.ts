"use client";
import { useSyncExternalStore } from "react";

// Görünüm kipi: "basit" (varsayılan) teknik panelleri, dayanak kodlarını ve sistem menüsünü gizler;
// "ayrintili" her şeyi gösterir. Kişisel tercihtir; tarayıcıda saklanır, veriyi etkilemez.
export type UiMode = "basit" | "ayrintili";
const KEY = "koza.ui.mode";
let version = 0;

export function getUiMode(): UiMode {
  try {
    return localStorage.getItem(KEY) === "ayrintili" ? "ayrintili" : "basit";
  } catch {
    return "basit";
  }
}
export function setUiMode(m: UiMode): void {
  try {
    localStorage.setItem(KEY, m);
  } catch {
    /* yoksay */
  }
  version += 1;
  window.dispatchEvent(new CustomEvent("koza:ui"));
}
function subscribe(cb: () => void) {
  const h = () => {
    version += 1;
    cb();
  };
  window.addEventListener("koza:ui", h);
  window.addEventListener("storage", h);
  return () => {
    window.removeEventListener("koza:ui", h);
    window.removeEventListener("storage", h);
  };
}
export function useUiMode(): UiMode {
  const v = useSyncExternalStore(subscribe, () => version, () => -1);
  return v < 0 ? "basit" : getUiMode();
}
