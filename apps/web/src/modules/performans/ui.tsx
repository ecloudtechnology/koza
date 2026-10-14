"use client";
// Modül içi sunum bileşenleri. Sayı yalnız kayıtlı değerlerden gelir; burada ölçek (piksel) için
// dizeden sayıya çevrim yalnız çubuk uzunluğu içindir ve ekranda yazılan değer daima kayıtlı dizedir.
import { useId } from "react";
import { fmtDec } from "@/lib/useStore";
import type { PeriodValue } from "./indicators";

export type BarVariant = "approved" | "draft" | "scenario" | "plain";
export interface BarRow {
  label: string;
  value: string | null; // ondalık dize; null = bilinmiyor → çubuk çizilmez, "—" yazılır
  unit: string;
  variant: BarVariant;
  note?: string;
}

const VARIANT_LABEL: Record<BarVariant, string> = { approved: "onaylı", draft: "taslak / onaysız", scenario: "senaryo (envantere girmez)", plain: "kayıtlı değer" };

/** Yatay çubuklar: her çubukta metin etiketi; onaylı dolu, taslak taralı, senaryo kesikli çerçeve. Tablo alternatifi altta. */
export function Bars({ title, rows, caption }: { title: string; rows: BarRow[]; caption?: string }) {
  const id = useId();
  const nums = rows.map((r) => (r.value === null ? 0 : Math.abs(Number(r.value))));
  const max = Math.max(...nums, 0) || 1;
  const rowH = 26;
  const labelW = 190;
  const width = 700;
  const barMax = width - labelW - 120;
  const height = rows.length * rowH + 10;
  const variants = Array.from(new Set(rows.map((r) => r.variant)));
  return (
    <figure style={{ margin: 0 }}>
      <svg className="pf-bars" viewBox={`0 0 ${width} ${height}`} role="img" aria-labelledby={`${id}-t`} aria-describedby={`${id}-d`}>
        <title id={`${id}-t`}>{title}</title>
        <desc id={`${id}-d`}>{rows.map((r) => `${r.label}: ${r.value === null ? "bilinmiyor" : `${fmtDec(r.value)} ${r.unit}`} (${VARIANT_LABEL[r.variant]})`).join("; ")}</desc>
        <defs>
          <pattern id="pf-hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <rect width="6" height="6" fill="var(--surface)" />
            <line x1="0" y1="0" x2="0" y2="6" stroke="var(--ink-3)" strokeWidth="2" />
          </pattern>
        </defs>
        <line className="axis" x1={labelW} y1={4} x2={labelW} y2={height - 4} />
        {rows.map((r, i) => {
          const y = i * rowH + 5;
          const w = r.value === null ? 0 : Math.max(2, Math.round((Math.abs(Number(r.value)) / max) * barMax));
          return (
            <g key={i}>
              <text className="lbl" x={labelW - 8} y={y + 15} textAnchor="end">
                {r.label.length > 30 ? r.label.slice(0, 29) + "…" : r.label}
              </text>
              {r.value !== null ? <rect className={`bar-${r.variant}`} x={labelW + 1} y={y + 3} width={w} height={rowH - 8} rx={2} /> : null}
              <text x={labelW + 6 + w} y={y + 15}>
                {r.value === null ? "— (bilinmiyor)" : `${fmtDec(r.value)} ${r.unit}`}
              </text>
            </g>
          );
        })}
      </svg>
      <div className="pf-legend" aria-hidden="true">
        {variants.map((v) => (
          <span key={v} className={v}>
            {VARIANT_LABEL[v]}
          </span>
        ))}
      </div>
      <details>
        <summary className="small">Tablo olarak göster</summary>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Seri</th>
                <th>Değer</th>
                <th>Birim</th>
                <th>Durum</th>
                <th>Not</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i}>
                  <td>{r.label}</td>
                  <td className="num">{r.value === null ? "bilinmiyor" : fmtDec(r.value)}</td>
                  <td>{r.unit}</td>
                  <td>{VARIANT_LABEL[r.variant]}</td>
                  <td className="small">{r.note ?? ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
      {caption && <figcaption className="small muted">{caption}</figcaption>}
    </figure>
  );
}

export const PV_LABEL: Record<PeriodValue["state"], string> = { known: "biliniyor", unknown: "bilinmiyor", not_applicable: "uygulanamaz", missing: "girilmemiş", needs_fix: "düzeltme bekliyor" };

export function PeriodValueCell({ v }: { v: PeriodValue }) {
  if (v.state === "known") {
    return (
      <>
        <span className="num">{fmtDec(v.value)}</span> {v.unit}
        {v.quality === "estimated" && <span className="badge warn">tahmini</span>}
        {v.quality === "mixed" && <span className="badge warn">kısmen tahmini</span>}
      </>
    );
  }
  const cls = v.state === "needs_fix" ? "warn" : v.state === "not_applicable" ? "neutral" : "warn";
  return (
    <>
      <span className={`badge ${cls}`}>{PV_LABEL[v.state]}</span> <span className="pf-state">{v.note}</span>
    </>
  );
}

export function Steps({ items, current }: { items: { key: string; label: string }[]; current: string }) {
  const idx = items.findIndex((i) => i.key === current);
  return (
    <ol className="pf-steps">
      {items.map((it, i) => (
        <li key={it.key} aria-current={it.key === current ? "step" : undefined} className={i < idx ? "done" : undefined}>
          {it.label}
        </li>
      ))}
    </ol>
  );
}
