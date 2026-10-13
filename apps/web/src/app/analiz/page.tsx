"use client";
import { PROFILES } from "@/lib/content";
import { Planned } from "@/components/ui";

export default function Analiz() {
  return (
    <Planned title="Analiz ve hedefler" dilim="4, 6 ve 8" section="§22, GÖS-01…04, AKS-01…05, REG-05">
      <div className="card">
        <h2>Neden grafik yok</h2>
        <p className="small">Yoğunluk göstergesi, profildeki payda tanımı ve dönemi olmadan hesaplanmaz (GÖS-03). Payda verisi (ürün miktarı, çalışan, alan) henüz toplanmıyor; uydurma grafik gösterilmez (kural 10). Onaylı Kapsam 1 toplamı rapor manifestinde görünür.</p>
        <h3>Profillerden gelen paydalar (veri, kod değil — SEK-02)</h3>
        <ul className="small">
          {PROFILES.map((p) => (
            <li key={p.id}>
              <b>{p.title.tr}</b>: {p.intensity_denominators.map((d) => `${d.name.tr} (${d.unit}; ${d.source_hint})`).join(" · ")}
              {p.indicators.length > 0 && <> · sektöre özgü gösterge: {p.indicators.map((i) => `${i.name.tr} [${i.unit}]`).join(", ")}</>}
            </li>
          ))}
        </ul>
      </div>
      <div className="card">
        <h2>Gelecek</h2>
        <ul className="small">
          <li>Çekirdek gösterge paketi (GÖS-02): enerji, Kapsam 1–2, su, atık, iş kazası, kişi başı eğitim saati, faaliyet çıktısı; veri sözleşmesi testleri (GÖS-04).</li>
          <li>Mutlak emisyon azalırken üretim de düşmüşse "verimlilik arttı" denmez; fark ayrıştırması (faaliyet / faktör / sınır / yöntem).</li>
          <li>Hedef kartı + RACI; AKS karar kapısı: sapma → görev → kök neden → düzeltici faaliyet → etki doğrulama; etki ölçülmeden kapanmaz.</li>
          <li>Senaryo defteri (karbon fiyatı, tahsis, alım-satım) envanteri değiştirmez (kural 7, REG-05); gölge karbon fiyatının sahibi K-11.</li>
        </ul>
      </div>
    </Planned>
  );
}
