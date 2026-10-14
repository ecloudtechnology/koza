"use client";
// Modül içi küçük arayüz yardımcıları (ortak altyapıya dokunmadan).
import { useState } from "react";
import type { TemplateField } from "../content";

export function Tabs({ items, value, onChange }: { items: { id: string; label: string }[]; value: string; onChange: (id: string) => void }) {
  return (
    <div className="dis-tabs" role="tablist">
      {items.map((t) => (
        <button key={t.id} role="tab" aria-selected={value === t.id} onClick={() => onChange(t.id)} type="button">
          {t.label}
        </button>
      ))}
    </div>
  );
}

/** Hata ve meşguliyet durumu; başarı mesajı yalnız depo yazdıktan sonra (kural 10). */
export function useAction() {
  const [err, setErr] = useState<unknown>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const run = async (fn: () => Promise<string | void> | string | void) => {
    setBusy(true);
    setErr(null);
    setOk(null);
    try {
      const msg = await fn();
      if (msg) setOk(msg);
    } catch (e) {
      setErr(e);
    } finally {
      setBusy(false);
    }
  };
  return { err, ok, busy, run, clear: () => { setErr(null); setOk(null); } };
}

export function TemplateInput({ f, value, onChange }: { f: TemplateField; value: string; onChange: (v: string) => void }) {
  const id = `tf-${f.id}`;
  return (
    <div className="field">
      <label htmlFor={id}>
        {f.label}
        {f.required && " *"}
      </label>
      {f.kind === "select" ? (
        <select id={id} value={value} onChange={(e) => onChange(e.target.value)}>
          <option value="">Seçin</option>
          {(f.options ?? []).map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
      ) : f.kind === "textarea" ? (
        <textarea id={id} value={value} onChange={(e) => onChange(e.target.value)} />
      ) : (
        <input id={id} value={value} onChange={(e) => onChange(e.target.value)} />
      )}
      {f.hint && <span className="hint">{f.hint}</span>}
    </div>
  );
}

export function downloadText(text: string, name: string, mime = "text/plain") {
  const blob = new Blob([text], { type: `${mime};charset=utf-8` });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  URL.revokeObjectURL(a.href);
}

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

export const PREVIEW_NOTE = "Önizleme deposu: bu tarayıcıda kaydedildi.";
