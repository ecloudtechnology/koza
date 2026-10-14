"use client";
import Link from "next/link";
import { marked } from "marked";
import { useMemo } from "react";
import { STATE_LABEL, type RecordState } from "@/lib/domain";
import { explain, LAYER_LABEL } from "@/lib/errors";
import { StoreError } from "@/lib/store";

const KIND_LABEL = { info: "Bilgi", warn: "Dikkat", crit: "Hata", ok: "Tamam" } as const;

export function Notice({ kind = "info", title, children }: { kind?: "info" | "warn" | "crit" | "ok"; title?: string; children: React.ReactNode }) {
  // Bilgi notları varsayılan olarak kapalıdır (tek satır başlık; açılır). Uyarı, hata ve başarı her zaman açık.
  if (kind === "info") {
    return (
      <details className="notice info compact">
        <summary>
          <span className="label">{title ?? "Bilgi"}</span>
          <span className="small muted"> · ayrıntı için tıklayın</span>
        </summary>
        <div>{children}</div>
      </details>
    );
  }
  return (
    <div className={`notice ${kind}`} role={kind === "crit" ? "alert" : "status"}>
      <div>
        <span className="label">{title ?? KIND_LABEL[kind]}</span>
        {children}
      </div>
    </div>
  );
}

// Üst bilgi satırındaki teknik dayanaklar (§22, T13, GÖS-01…04, kural 2) sade görünümde gizlenir; "rol:" parçası rozet olur.
const REF_RE = /§\d|[A-ZÖĞÜŞİÇ]{2,5}-\d|\bT\d{2}\b|\bkural\b|AI-0|forum/;
function splitEyebrow(eyebrow?: string): { plain: string; role: string | null; refs: string[] } {
  if (!eyebrow) return { plain: "", role: null, refs: [] };
  const parts = eyebrow.split("·").map((x) => x.trim()).filter(Boolean);
  const refs: string[] = [];
  let role: string | null = null;
  const plain: string[] = [];
  for (const p of parts) {
    if (p.startsWith("rol:")) role = p.replace(/^rol:\s*/, "");
    else if (REF_RE.test(p)) refs.push(p);
    else plain.push(p);
  }
  return { plain: plain.join(" · "), role, refs };
}

export function PageHeader({ eyebrow, title, lead, tags, children }: { eyebrow?: string; title: string; lead?: React.ReactNode; tags?: string[]; children?: React.ReactNode }) {
  const e = splitEyebrow(eyebrow);
  const refs = [...e.refs, ...(tags ?? [])];
  return (
    <header className="page-head">
      {(e.plain || e.role) && (
        <div className="eyebrow">
          {e.plain}
          {e.role && <span className="badge neutral role-badge">rol: {e.role}</span>}
        </div>
      )}
      <h1>{title}</h1>
      {lead && <p className="lead">{lead}</p>}
      {refs.length > 0 && (
        <div className="tags adv">
          <span className="small muted">Dayanak:</span>
          {refs.map((t) => (
            <span key={t} className="badge neutral">
              {t}
            </span>
          ))}
        </div>
      )}
      {children}
    </header>
  );
}

// Hata kutusu: kod → sözlükten kaynak, neden, sonuç, yapılacak iş (§28 hata durumu: sorun, verinin korunma durumu, güvenli tekrar)
export function ErrorBox({ error }: { error: unknown }) {
  if (!error) return null;
  const code = error instanceof StoreError ? error.code : "RENDER_ERROR";
  const entry = explain(code);
  const kind = error instanceof StoreError && (error.status === 403 || error.status === 409) ? "warn" : "crit";
  const message = String((error as Error)?.message ?? error);
  return (
    <Notice kind={kind} title={entry?.title ?? "Hata"}>
      <p>{message}</p>
      {entry && (
        <dl className="err-detail">
          <dt>Kaynak</dt>
          <dd>
            {LAYER_LABEL[entry.layer]} — {entry.source}
          </dd>
          <dt>Neden</dt>
          <dd>{entry.cause}</dd>
          <dt>Sonuç</dt>
          <dd>{entry.consequence}</dd>
          <dt>Ne yapmalı</dt>
          <dd>{entry.action}</dd>
        </dl>
      )}
      {error instanceof StoreError && Array.isArray(error.extra?.duplicates) && (
        <p className="small" style={{ marginTop: "0.5rem" }}>
          Aday kayıtlar:{" "}
          {(error.extra!.duplicates as string[]).map((id) => (
            <Link key={id} href={`/kayit/?id=${id}`} className="mono">
              {id.slice(0, 12)}{" "}
            </Link>
          ))}
        </p>
      )}
      <p className="small" style={{ marginTop: "0.5rem" }}>
        Girdiğiniz veri formda korunuyor. Kod: <code>{code}</code> · <Link href={`/hatalar/#${code}`}>hata sözlüğü</Link>
      </p>
    </Notice>
  );
}

export function StateBadge({ state }: { state: RecordState }) {
  const cls: Record<RecordState, string> = { draft: "neutral", validation_required: "warn", calculated: "info", in_review: "info", changes_requested: "warn", approved: "ok", locked: "accent" };
  return <span className={`badge ${cls[state]}`}>{STATE_LABEL[state]}</span>;
}

export function Empty({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div className="card quiet">
      <h3>{title}</h3>
      {children}
    </div>
  );
}

export function Loading({ what = "Veriler" }: { what?: string }) {
  return (
    <p className="muted" role="status" aria-live="polite">
      {what} yükleniyor…
    </p>
  );
}

export function NoTenant() {
  return (
    <Notice kind="warn" title="Kurum seçilmedi">
      <p>
        Bu ekran bir kurum bağlamında çalışır. <Link href="/kurulum/">Kurum kurulumu</Link> ile başlayın veya üst çubuktan kurum seçin.
      </p>
    </Notice>
  );
}

export function Markdown({ body }: { body: string }) {
  const html = useMemo(() => marked.parse(body, { gfm: true, breaks: false }) as string, [body]);
  return <article className="doc" dangerouslySetInnerHTML={{ __html: html }} />;
}

