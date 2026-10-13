"use client";
import { SOURCES } from "@/lib/content";
import { Planned } from "@/components/ui";

export default function Protokoller() {
  return (
    <Planned title="Protokoller ve standartlar" dilim="3 ve 8" section="§08, §19, REG-01…06">
      <div className="card">
        <h2>Hazır olan: kaynak kartları (§33–§34, erişim kontrolü 12 Ekim 2026)</h2>
        <p className="small">Yalnız resmî URL, yayımlayan ve rol; tam metin saklanmaz (lisans, K-12). Uygulanabilirlik değerlendirmesi (uygulanır / uygulanmaz / inceleme gerekli) ve değişiklik izleme (SRC-01…07) henüz yok.</p>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Kod</th>
                <th>Kaynak</th>
                <th>Yayımlayan</th>
                <th>Koza'daki rolü</th>
                <th>Bağlantı</th>
              </tr>
            </thead>
            <tbody>
              {SOURCES.map((s) => (
                <tr key={s.code}>
                  <td className="mono">{s.code}</td>
                  <td>{s.title}</td>
                  <td className="small">{s.publisher}</td>
                  <td className="small">{s.role}</td>
                  <td className="small">
                    {s.urls.map((u) => (
                      <div key={u}>
                        <a href={u} target="_blank" rel="noreferrer">
                          {u.replace(/^https?:\/\//, "").slice(0, 48)}…
                        </a>
                      </div>
                    ))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <div className="card">
        <h2>Gelecek</h2>
        <ul className="small">
          <li>Kaynak kartı alanları: sürüm, dil, yayın, yürürlük, geçiş koşulu, yürürlükten kalkma, erişim tarihi, lisans; "bu bana neden gösteriliyor?" gerekçesi profilden.</li>
          <li>GRI 102/103 2025 geçişi gibi tarih modeli (yayın ≠ yürürlük ≠ raporlama dönemi) — K-14/K-15 örneği.</li>
          <li>Regülasyon paketleri (CBAM, ulusal ETS/MRV, TSRS) uygulanabilirlik değerlendirmesiyle açılır; eşik/tarih koda yazılmaz (REG-06). Açık kararlar: K-06, K-07, K-08.</li>
        </ul>
      </div>
    </Planned>
  );
}
