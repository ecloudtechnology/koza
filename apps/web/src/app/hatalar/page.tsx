"use client";
import { useState } from "react";
import { ERRORS, LAYER_LABEL, type ErrorLayer } from "@/lib/errors";
import { PageHeader } from "@/components/ui";

const SEV: Record<string, { cls: string; text: string }> = {
  block: { cls: "crit", text: "hesap engeli" },
  conflict: { cls: "warn", text: "çakışma / durum" },
  forbidden: { cls: "warn", text: "yetki" },
  input: { cls: "neutral", text: "girdi" },
  infra: { cls: "info", text: "altyapı" },
};

export default function Hatalar() {
  const [layer, setLayer] = useState<ErrorLayer | "">("");
  const [q, setQ] = useState("");
  const list = ERRORS.filter((e) => (!layer || e.layer === layer) && (!q || `${e.code} ${e.title} ${e.cause}`.toLocaleLowerCase("tr").includes(q.toLocaleLowerCase("tr"))));
  const counts = ERRORS.reduce<Record<string, number>>((a, e) => ({ ...a, [e.layer]: (a[e.layer] ?? 0) + 1 }), {});
  return (
    <>
      <PageHeader
        eyebrow="Doğrulama"
        title="Hata sözlüğü"
        lead="Uygulamanın üretebileceği her hata kodu: nerede oluşur, neden oluşur, neyi engeller ve ne yapmanız gerekir. Hata kutuları bu sözlükten beslenir; hiçbir hata gizlenmez, sessizce sıfır veya varsayılan değer atanmaz (kural 2 ve 10)."
        tags={[`${ERRORS.length} kod`, "§18 hata davranışı", "§27 hata modeli", "§28 hata durumu"]}
      />
      <div className="row" style={{ marginBottom: "1rem" }}>
        <input placeholder="Kod veya başlık ara" value={q} onChange={(e) => setQ(e.target.value)} style={{ maxWidth: 280 }} aria-label="Ara" />
        <select value={layer} onChange={(e) => setLayer(e.target.value as ErrorLayer | "")} aria-label="Katman" style={{ maxWidth: 260 }}>
          <option value="">Tüm katmanlar</option>
          {(Object.keys(LAYER_LABEL) as ErrorLayer[]).map((l) => (
            <option key={l} value={l}>
              {LAYER_LABEL[l]} ({counts[l] ?? 0})
            </option>
          ))}
        </select>
      </div>
      {list.length === 0 && <p className="muted">Filtreyle eşleşen kod yok ({ERRORS.length} kod var).</p>}
      {list.map((e) => (
        <div className="card" key={e.code} id={e.code}>
          <div className="spread">
            <h2 style={{ marginTop: 0 }}>
              {e.title} <code>{e.code}</code>
            </h2>
            <div className="row">
              <span className={`badge ${SEV[e.severity].cls}`}>{SEV[e.severity].text}</span>
              <span className="badge neutral">{LAYER_LABEL[e.layer]}</span>
              <span className="badge accent">{e.requirement}</span>
            </div>
          </div>
          <dl className="err-detail">
            <dt>Kaynak</dt>
            <dd>{e.source}</dd>
            <dt>Neden</dt>
            <dd>{e.cause}</dd>
            <dt>Sonuç</dt>
            <dd>{e.consequence}</dd>
            <dt>Ne yapmalı</dt>
            <dd>{e.action}</dd>
          </dl>
        </div>
      ))}
    </>
  );
}
