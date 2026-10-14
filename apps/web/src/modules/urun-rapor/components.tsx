"use client";
// urun-rapor paylaşılan görünümler: motor sonucu, rapor paketi bölümleri (ekran + yazdırma), motor durumu.
import { useEffect, useState } from "react";
import { engineReady } from "@/lib/calc";
import type { CalcResult } from "@/lib/domain";
import { explain } from "@/lib/errors";
import { fmtDec } from "@/lib/useStore";
import { Notice } from "@/components/ui";
import { packageSections, type Section } from "./export";
import type { IndexRow } from "./report";
import type { Assurance, Publication, ReportPackage, ReportingMap } from "./types";

export function useEngine(): { engine: "loading" | "ready" | "failed"; engineErr: string } {
  const [engine, setEngine] = useState<"loading" | "ready" | "failed">("loading");
  const [engineErr, setEngineErr] = useState("");
  useEffect(() => {
    let alive = true;
    engineReady()
      .then(() => alive && setEngine("ready"))
      .catch((e) => {
        if (!alive) return;
        setEngine("failed");
        setEngineErr(String(e?.message ?? e));
      });
    return () => {
      alive = false;
    };
  }, []);
  return { engine, engineErr };
}

export function EngineStatus({ engine, engineErr }: { engine: "loading" | "ready" | "failed"; engineErr: string }) {
  if (engine === "ready") return null;
  if (engine === "loading") return <p className="muted ur-no-print">Hesap motoru yükleniyor (Pyodide)…</p>;
  const ex = explain("ENGINE_LOAD_FAILED");
  return (
    <Notice kind="crit" title={ex?.title}>
      <p>{engineErr}</p>
      <p className="small">{ex?.consequence} {ex?.action}</p>
    </Notice>
  );
}

/** Tek motor sonucu: engeller sözlükle açıklanır (T08/T09 dahil), bileşenler ve iddia metni. */
export function CalcResultView({ r, compact = false }: { r: CalcResult; compact?: boolean }) {
  const ctx = r as unknown as { context?: string; value_state?: string };
  if (r.status === "blocked") {
    return (
      <Notice kind="crit" title="Hesap yapılamadı">
        <ul className="small">
          {r.blocks.map((b, i) => {
            const ex = explain(b.code);
            return (
              <li key={i}>
                <b>{ex?.title ?? b.code}</b> <code>{b.code}</code> — {b.message_tr} {b.field && <span className="muted">({b.field})</span>}
                {ex && (
                  <div className="small" style={{ marginTop: "0.2rem" }}>
                    <b>Neden:</b> {ex.cause} <b>Ne yapmalı:</b> {ex.action}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </Notice>
    );
  }
  return (
    <div>
      {r.status === "review_required" && (
        <Notice kind="warn" title="İnceleme gerekli">
          <p>{r.warnings.map((w) => w.message_tr).join(" ") || "Tahmini veri veya esas dönüşümü."}</p>
        </Notice>
      )}
      {r.warnings.length > 0 && r.status !== "review_required" && <p className="small muted">{r.warnings.map((w) => `${w.code}: ${w.message_tr}`).join(" · ")}</p>}
      <div className="ur-total">
        <span className="big-num">{ctx.value_state === "not_applicable" ? "uygulanmaz" : r.total_co2e_kg === null ? "—" : fmtDec(r.total_co2e_kg, 6)}</span>
        <span className="small">{r.total_co2e_kg !== null && "kg CO₂e"} · kapsama: {r.coverage ?? "—"} · sınır: {r.boundary ?? "—"}{ctx.context ? ` · bağlam: ${ctx.context === "product" ? "ürün" : ctx.context}` : ""}</span>
      </div>
      <p className="small">{r.claim_tr}</p>
      {!compact && r.components.length > 0 && (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Gaz</th>
                <th>Faktör</th>
                <th className="num">Kütle (kg)</th>
                <th>GWP</th>
                <th className="num">CO₂e (kg)</th>
              </tr>
            </thead>
            <tbody>
              {r.components.map((c, i) => (
                <tr key={i}>
                  <td>{c.gas}</td>
                  <td className="mono small">
                    {c.factor_id}@{c.factor_version}
                  </td>
                  <td className="num">{fmtDec(c.mass_kg, 6)}</td>
                  <td>{c.gwp_applied ? c.gwp : "uygulanmadı"}</td>
                  <td className="num">{fmtDec(c.co2e_kg, 6)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {!compact && r.trace.length > 0 && (
        <details>
          <summary>İz ({r.trace.length} adım)</summary>
          <pre className="trace">{JSON.stringify(r.trace, null, 1)}</pre>
        </details>
      )}
    </div>
  );
}

function SectionView({ s, open }: { s: Section; open: boolean }) {
  const body = (
    <>
      {s.paragraphs.map((p, i) => (
        <p key={i} className="small">
          {p}
        </p>
      ))}
      {s.table && (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                {s.table[0].map((h, i) => (
                  <th key={i}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {s.table.slice(1).map((row, i) => (
                <tr key={i}>
                  {row.map((c, j) => (
                    <td key={j} className={/^[\d.,—-]+$/.test(c) && j > 0 ? "num" : /^[0-9a-f]{64}$/.test(c) ? "mono small" : ""}>
                      {c}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
  if (open) {
    return (
      <section className="ur-section">
        <h2>{s.title}</h2>
        {body}
      </section>
    );
  }
  return (
    <details className="ur-section">
      <summary>{s.title}</summary>
      {body}
    </details>
  );
}

export function ReportPackageView({ p, publications, assurances, index, mode }: { p: ReportPackage; publications: Publication[]; assurances: Assurance[]; index: { map: ReportingMap; rows: IndexRow[] }[]; mode: "screen" | "print" }) {
  const sections = packageSections(p.manifest, { publications, assurances, index, report_id: p.report_id, report_version: p.report_version, package_sha256: p.package_sha256 });
  return (
    <div>
      {sections.map((s, i) => (
        <SectionView key={i} s={s} open={mode === "print" || i === 0} />
      ))}
    </div>
  );
}
