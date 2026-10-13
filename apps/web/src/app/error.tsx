"use client";
import Link from "next/link";
import { explain } from "@/lib/errors";

// Hata sınırı (§28 hata durumu): sorun, verinin korunma durumu, güvenli tekrar.
export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const e = explain("RENDER_ERROR")!;
  return (
    <div className="error-page">
      <div className="card">
        <span className="badge crit">Ekran hatası</span>
        <h1 style={{ marginTop: "0.6rem" }}>{e.title}</h1>
        <p>{e.cause}</p>
        <dl className="err-detail">
          <dt>Hata metni</dt>
          <dd className="mono small">{error.message || "(boş)"}{error.digest ? ` · ${error.digest}` : ""}</dd>
          <dt>Kaynak</dt>
          <dd>{e.source}</dd>
          <dt>Sonuç</dt>
          <dd>{e.consequence}</dd>
          <dt>Ne yapmalı</dt>
          <dd>{e.action}</dd>
        </dl>
        <div className="actions" style={{ marginTop: "1rem" }}>
          <button className="primary" onClick={reset}>
            Tekrar dene
          </button>
          <Link className="btn" href="/">
            Ana sayfa
          </Link>
          <Link className="btn" href="/hatalar/">
            Hata sözlüğü
          </Link>
        </div>
      </div>
    </div>
  );
}
