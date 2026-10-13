"use client";
import { LESSONS, PROFILES } from "@/lib/content";
import { Planned } from "@/components/ui";

export default function Yuzbir() {
  return (
    <Planned title="Sürdürülebilirlik 101" dilim="3 ve 5" section="§07, ÖĞR-01…04">
      <div className="card">
        <h2>Hazır olan</h2>
        <p>Modül iskeleti (10 modül, §07 tablosu) ve sektör profillerindeki rol bazlı ders yolları (ÖĞR). Ders gövdeleri yazılmadı; içerik editörü onayı olmadan yayımlanmaz.</p>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Kimlik</th>
                <th>Modül</th>
                <th>Öğrenme hedefi</th>
                <th>Uygulama</th>
                <th>Durum</th>
              </tr>
            </thead>
            <tbody>
              {LESSONS.map((l) => (
                <tr key={l.id}>
                  <td className="mono small">{l.id}</td>
                  <td>{l.title.tr}</td>
                  <td className="small">{l.goal}</td>
                  <td className="small">{l.application}</td>
                  <td>
                    <span className="badge neutral">{l.status}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <h3>Profillerdeki ders yolları (ÖĞR-01…03)</h3>
        <ul className="small">
          {PROFILES.map((p) => (
            <li key={p.id}>
              <b>{p.title.tr}</b>: yönetici {p.lesson_paths.manager?.join(", ") || "—"} · uzman {p.lesson_paths.specialist?.join(", ") || "—"} · saha {p.lesson_paths.field?.join(", ") || "—"}
            </li>
          ))}
        </ul>
      </div>
      <div className="card">
        <h2>Gelecek</h2>
        <ul className="small">
          <li>Ders şablonu: kimlik, seviye, amaç, süre, ön koşul, sade açıklama, iş örneği, sık hata, küçük uygulama, cevap gerekçesi, kaynak, gözden geçirme tarihi.</li>
          <li>Yanlış yanıtta neden yanlış olduğu anlatılır; "modül tamamlandı" ifadesi, rozet/sertifika izlenimi yok.</li>
          <li>Ders örnekleri hiçbir zaman üretim toplamına eklenmez; eğitim saati GÖS paketine toplu yazılır (ÖĞR-04).</li>
        </ul>
      </div>
    </Planned>
  );
}
