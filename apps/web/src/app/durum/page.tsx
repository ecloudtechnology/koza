import Link from "next/link";
import { TRACE } from "@/lib/content";

const DILIM = [
  ["0", "Depo iskeleti, karar kaydı, CI, kimlik + tenant izolasyonu, audit", "T14 ve izolasyon testleri geçer", "done", "37 API/izolasyon testi; RLS PostgreSQL 15'te doğrulandı; CI iş akışı; kimlik katmanı dev-token (OIDC yok)"],
  ["1", "Kurum kurulumu → doğal gaz kaydı → hesap → inceleme → rapor", "T01–T04, T07, T13, T17–T20", "partial", "Akış uçtan uca çalışır (önizleme deposu); 109 motor testi, 32 altın örnek; eksik: OCR, nesne deposu, DOCX/PDF, uzman imzalı altın set"],
  ["2", "Elektrik (konum + piyasa) ve diğer Kapsam 1 şablonları", "T05, T06, T11", "planned", ""],
  ["3", "Asistan, belge güvenliği, 101 ve sözlük temeli", "T15, T16", "planned", "Sözlük 6 terim, 10 ders iskeleti hazır"],
  ["4", "SEK + GÖS: profil şeması, genel + 2 profil, yoğunluk panosu", "SEK/GÖS kabul", "partial", "Profil şeması ve 3 profil YAML; NACE önerisi; pano yok"],
  ["5", "KZN + ÖĞR", "Kişi bazlı sıralama yok testi", "blocked", "K-09 KVKK"],
  ["6", "AKS karar kapısı", "Etki ölçülmeden kapanmaz testi", "planned", ""],
  ["7", "TDR + Kapsam 3", "T08–T10, T12", "planned", ""],
  ["8", "REG paketleri + senaryo defteri", "Senaryo envanteri değiştirmez testi", "blocked", "K-06, K-07, K-08"],
] as const;

const CLS: Record<string, string> = { done: "ok", partial: "warn", planned: "neutral", blocked: "crit" };
const TXT: Record<string, string> = { done: "tamam", partial: "kısmi", planned: "planlı", blocked: "karar bekliyor" };

export default function Durum() {
  const counts = TRACE.rows.reduce<Record<string, number>>((a, r) => ({ ...a, [r.status]: (a[r.status] ?? 0) + 1 }), {});
  return (
    <>
      <h1>Proje durumu</h1>
      <p className="muted">Güncelleme: {TRACE.updated}. Her gereklilik kimliği için durum, yer ve kanıt. "Tamam" yalnız test veya gösterimle desteklenir; sahte tamamlama yok (kural 10).</p>
      <div className="row">
        {Object.entries(TXT).map(([k, v]) => (
          <span key={k} className={`badge ${CLS[k]}`}>
            {v}: {counts[k] ?? 0}
          </span>
        ))}
      </div>

      <div className="card">
        <h2>Dilim sırası (CLAUDE.md)</h2>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Dilim</th>
                <th>Kapsam</th>
                <th>Çıkış koşulu</th>
                <th>Durum</th>
                <th>Not</th>
              </tr>
            </thead>
            <tbody>
              {DILIM.map(([d, k, c, s, n]) => (
                <tr key={d}>
                  <td className="num">{d}</td>
                  <td>{k}</td>
                  <td className="small">{c}</td>
                  <td>
                    <span className={`badge ${CLS[s]}`}>{TXT[s]}</span>
                  </td>
                  <td className="small">{n}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="small">
          Pilot kapısı (Dilim 1–4 sonrası): kurumlar arası erişim testi + yeni kullanıcının yardımsız ilk taslağı — <b>henüz açılmadı</b>. Test kanıtı: <code>pytest packages/calc-engine/tests</code> 109 geçti; <code>pytest apps/api/tests tests/isolation</code> 37 geçti; <code>npm run build</code> statik dışa aktarma.
        </p>
      </div>

      <div className="card">
        <h2>Gereklilik izleme matrisi</h2>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Kimlik</th>
                <th>Gereklilik</th>
                <th>Dilim</th>
                <th>Durum</th>
                <th>Nerede</th>
                <th>Kanıt / not</th>
              </tr>
            </thead>
            <tbody>
              {TRACE.rows.map((r) => (
                <tr key={r.id}>
                  <td className="mono small">{r.id}</td>
                  <td>{r.title}</td>
                  <td className="num">{r.dilim}</td>
                  <td>
                    <span className={`badge ${CLS[r.status]}`}>{TXT[r.status]}</span>
                  </td>
                  <td className="small">{r.where}</td>
                  <td className="small">
                    {r.evidence}
                    {r.note && <div className="muted">{r.note}</div>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card">
        <h2>Bilinen eksikler (açıkça)</h2>
        <ul className="small">
          <li>Önizleme deposu tarayıcıdadır; sunucu yetkisi ve PostgreSQL RLS yalnız depodaki kodda ve testlerde çalışır (K-16).</li>
          <li>Kimlik: OIDC/SSO, MFA, davet ve oturum iptali yok (dev token). Nesne deposu, zararlı içerik taraması, imzalı bağlantı yok.</li>
          <li>OCR, Excel/CSV içe aktarma, entegrasyon (ERP/sayaç) yok. Rapor DOCX/PDF ve GRI/TSRS indeksi yok.</li>
          <li>Altın set uzman imzasız; yöntem ve GWP seti test sürümü (K-04, K-05). Tüm faktörler kurgusal.</li>
          <li>WCAG 2.2 AA denetimi yapılmadı; p95 performans hedefleri ölçülmedi.</li>
          <li>Sektör profilleri taslak (uzman onayı bekliyor, K-02). Ders ve sözlük içerikleri editör onaysız.</li>
        </ul>
        <p className="small">
          Ayrıntı: <Link href="/belgeler/?d=teslim-notu">Teslim notu</Link> · <Link href="/belgeler/?d=karar-kaydi">Karar kaydı</Link> · <Link href="/belgeler/?d=inceleme-rehberi">İnceleme rehberi</Link>
        </p>
      </div>
    </>
  );
}
