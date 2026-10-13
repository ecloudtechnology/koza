"use client";
import Link from "next/link";
import { marked } from "marked";
import { useMemo } from "react";
import { STATE_LABEL, type RecordState } from "@/lib/domain";
import { StoreError } from "@/lib/store";

export function Notice({ kind = "info", children }: { kind?: "info" | "warn" | "crit" | "ok"; children: React.ReactNode }) {
  return (
    <div className={`notice ${kind}`} role={kind === "crit" ? "alert" : "status"}>
      {children}
    </div>
  );
}

export function ErrorBox({ error }: { error: unknown }) {
  if (!error) return null;
  if (error instanceof StoreError) {
    return (
      <Notice kind={error.status === 403 || error.status === 409 ? "warn" : "crit"}>
        <p>
          <strong>{labelFor(error.code)}</strong> — {error.message}
        </p>
        {error.extra?.duplicates && Array.isArray(error.extra.duplicates) ? (
          <p className="small">
            Aday kayıtlar:{" "}
            {(error.extra.duplicates as string[]).map((id) => (
              <Link key={id} href={`/kayit/?id=${id}`} className="mono">
                {id}{" "}
              </Link>
            ))}
          </p>
        ) : null}
        <p className="small">Girdiğiniz veri formda korunuyor; sorunu giderip tekrar deneyebilirsiniz.</p>
      </Notice>
    );
  }
  return (
    <Notice kind="crit">
      <p>
        <strong>Beklenmeyen hata</strong> — {String((error as Error)?.message ?? error)}
      </p>
    </Notice>
  );
}

function labelFor(code: string): string {
  const m: Record<string, string> = {
    FORBIDDEN: "Yetki yok",
    NOT_FOUND: "Bulunamadı",
    VERSION_CONFLICT: "Sürüm çakışması",
    PERIOD_LOCKED: "Dönem kilitli",
    DUPLICATE_CANDIDATE: "Mükerrer aday",
    SEPARATION_OF_DUTIES: "Görev ayrılığı",
    VALIDATION: "Eksik alan",
    CALC_REQUIRED: "Hesap gerekli",
    CALC_BLOCKED: "Hesap engelli",
    CLOSE_BLOCKED: "Kapanış engeli",
    NO_TENANT: "Kurum seçilmedi",
    EVIDENCE_REQUIRED: "Kanıt gerekli",
    REVIEW_ACK_REQUIRED: "İnceleme beyanı gerekli",
    INVALID_TRANSITION: "Geçersiz durum geçişi",
  };
  return m[code] ?? code;
}

export function StateBadge({ state }: { state: RecordState }) {
  const cls: Record<RecordState, string> = {
    draft: "neutral",
    validation_required: "warn",
    calculated: "info",
    in_review: "info",
    changes_requested: "warn",
    approved: "ok",
    locked: "accent",
  };
  return <span className={`badge ${cls[state]}`}>{STATE_LABEL[state]}</span>;
}

export function Empty({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div className="card">
      <h3>{title}</h3>
      {children}
    </div>
  );
}

export function Loading({ what = "Veriler" }: { what?: string }) {
  return (
    <p className="muted" role="status">
      {what} yükleniyor…
    </p>
  );
}

export function NoTenant() {
  return (
    <Notice kind="warn">
      <p>
        <strong>Kurum seçilmedi.</strong> Bu ekran bir kurum bağlamında çalışır. <Link href="/kurulum/">Kurum kurulumu</Link> ile başlayın veya üst
        çubuktan kurum seçin.
      </p>
    </Notice>
  );
}

export function Markdown({ body }: { body: string }) {
  const html = useMemo(() => marked.parse(body, { gfm: true, breaks: false }) as string, [body]);
  return <article className="doc" dangerouslySetInnerHTML={{ __html: html }} />;
}

export function Planned({ title, dilim, section, children }: { title: string; dilim: string; section: string; children: React.ReactNode }) {
  return (
    <>
      <h1>{title}</h1>
      <Notice kind="info">
        <p>
          <strong>Bu sekme henüz uygulanmadı.</strong> Planlandığı dilim: <b>Dilim {dilim}</b>. Şartname bölümü: {section}. Burada çalışmayan buton veya örnek veri
          yoktur (CLAUDE.md kural 10); aşağıda bu sekmenin ne yapacağı ve hazır olan parçalar listelenir.
        </p>
      </Notice>
      {children}
      <p className="small">
        Ayrıntı: <Link href="/durum/">Proje durumu</Link> · <Link href={`/belgeler/?d=sartname`}>Şartname</Link>
      </p>
    </>
  );
}
