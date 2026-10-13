"use client";
import { useState } from "react";
import { TERMS } from "@/lib/content";
import { Notice, PageHeader } from "@/components/ui";

const fold = (s: string) => s.toLocaleLowerCase("tr").replace(/ı/g, "i").replace(/ğ/g, "g").replace(/ü/g, "u").replace(/ş/g, "s").replace(/ö/g, "o").replace(/ç/g, "c");

export default function Sozluk() {
  const [q, setQ] = useState("");
  const list = TERMS.filter((t) => !q || fold(`${t.tr} ${t.en} ${t.abbr ?? ""} ${t.definition}`).includes(fold(q)));
  return (
    <>
      <PageHeader eyebrow="Öğrenme · §10 · kısmi (Dilim 3)" title="Sözlük" lead="Başlangıç terimleri: kapsam, sistem sınırı, emisyon faktörü, GWP, fonksiyonel birim, tahsis. Arama Türkçe karakter ve İngilizce karşılıkla çalışır; tam sözlük ve bağlamsal yardım Dilim 3." />
      <Notice kind="info">
        <p>Tanımlar özgün kısa açıklamalardır; standart metinleri kopyalanmamıştır (K-12). Her terim "editör onayı bekliyor" durumundadır. Kaynak bağlantıları §33–§34 listesindendir.</p>
      </Notice>
      <div className="field">
        <label htmlFor="q">Ara</label>
        <input id="q" value={q} onChange={(e) => setQ(e.target.value)} placeholder="ör. GWP, kapsam, boundary" />
      </div>
      {list.length === 0 ? (
        <p className="muted">Eşleşen terim yok (filtre sonucu boş; sözlükte {TERMS.length} terim var).</p>
      ) : (
        list.map((t) => (
          <div className="card" key={t.id}>
            <h2 style={{ marginTop: 0 }}>
              {t.tr} <span className="muted small">{t.en}{t.abbr ? ` · ${t.abbr}` : ""}</span> <span className="badge warn">{t.status}</span>
            </h2>
            <p>{t.definition}</p>
            <dl className="kv">
              <dt>Örnek</dt>
              <dd>{t.example}</dd>
              {t.confused_with && (
                <>
                  <dt>Karıştırılan</dt>
                  <dd>{t.confused_with}</dd>
                </>
              )}
              {t.related_task && (
                <>
                  <dt>İlgili görev</dt>
                  <dd>{t.related_task}</dd>
                </>
              )}
              <dt>Kaynak</dt>
              <dd className="small">{t.source}</dd>
            </dl>
          </div>
        ))
      )}
    </>
  );
}
