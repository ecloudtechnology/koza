import Link from "next/link";
import { TRACE } from "@/lib/content";
import { PageHeader } from "@/components/ui";

const CLS: Record<string, string> = { done: "ok", decision: "copper" };
const TXT: Record<string, string> = { done: "tamam", decision: "tamam · karar bekliyor" };

const EVIDENCE = [
  ["Hesap motoru", "pytest packages/calc-engine/tests", "200 test; 77 altın senaryo (T01–T12, T20); tarayıcıda Pyodide ile aynı kod"],
  ["İş API'si ve izolasyon", "pytest apps/api/tests tests/isolation", "Kurumlar arası 404; idempotency; ETag; kilit; PostgreSQL RLS"],
  ["Arayüz modülleri", "npx vitest run (apps/web)", "163 test: iş akışı, içe aktarma, asistan değerlendirme seti, performans, tedarikçi/regülasyon/senaryo, ürün/rapor, öğrenme"],
  ["Statik derleme", "npm run build", "35 sayfa; ESLint ve TypeScript temiz"],
];

export default function Durum() {
  const counts = TRACE.rows.reduce<Record<string, number>>((a, r) => ({ ...a, [r.status]: (a[r.status] ?? 0) + 1 }), {});
  return (
    <>
      <PageHeader
        eyebrow={`Proje · güncelleme ${TRACE.updated}`}
        title="Proje durumu"
        lead="Şartname v1.0 ve v1.1 ekindeki her gereklilik kimliği için uygulandığı yer ve kanıt. 'Tamam' yalnız test veya ekran gösterimiyle desteklenir; 'karar bekliyor' olanlar uygulanmıştır, içerikteki ürün kararı (profil onayı, KVKK görüşü, resmî mevzuat metni) grup veya uzman tarafından kesinleştirilir."
        tags={[`${TRACE.rows.length} gereklilik satırı`, `tamam ${counts.done ?? 0}`, `karar bekliyor ${counts.decision ?? 0}`]}
      />

      <div className="card">
        <h2>Test kanıtı</h2>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Katman</th>
                <th>Komut</th>
                <th>Sonuç</th>
              </tr>
            </thead>
            <tbody>
              {EVIDENCE.map(([k, c, r]) => (
                <tr key={k}>
                  <td>{k}</td>
                  <td>
                    <code>{c}</code>
                  </td>
                  <td className="small">{r}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="small">
          Altın seti bu tarayıcıda çalıştırın: <Link href="/altin-set/?auto=1">Altın set</Link>. Asistan değerlendirme seti: <Link href="/asistan/">Asistan</Link>.
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
                <th>Durum</th>
                <th>Nerede</th>
                <th>Kanıt</th>
              </tr>
            </thead>
            <tbody>
              {TRACE.rows.map((r) => (
                <tr key={r.id}>
                  <td className="mono small">{r.id}</td>
                  <td>{r.title}</td>
                  <td>
                    <span className={`badge ${CLS[r.status] ?? "neutral"}`}>{TXT[r.status] ?? r.status}</span>
                  </td>
                  <td className="small">{r.where}</td>
                  <td className="small">{r.evidence}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card">
        <h2>Grubun kesinleştireceği kararlar</h2>
        <p className="small">
          Uygulama bu kararları beklemeden çalışır; karar girilince ilgili içerik "onaylı" olur. Tam liste ve sahipleri: <Link href="/belgeler/?d=karar-kaydi">Karar kaydı</Link>.
        </p>
        <ul className="small">
          <li>K-02 / K-03 — pilot sektör profilleri ve NACE düzeyi (alan uzmanı onayı; profiller şu an "taslak").</li>
          <li>K-04 / K-05 — hesap otoritesi ve gerçek faktör kataloğu (bugünkü katalog kurgusal test değerleridir).</li>
          <li>K-06 / K-07 / K-08 — ulusal ETS/MRV, CBAM kanıt formatı, TSRS uygulanabilirliği: resmî metin doğrulanana kadar paketler "inceleme gerekli".</li>
          <li>K-09 / K-10 / K-11 — Green Kaizen için KVKK görüşü, memnuniyet ölçüm yöntemi, gölge karbon fiyatının sahibi.</li>
        </ul>
      </div>

      <div className="card quiet">
        <h3 style={{ marginTop: 0 }}>Önizleme ile üretim arasındaki fark</h3>
        <p className="small" style={{ marginBottom: 0 }}>
          Bu yayın statiktir: kayıtlar tarayıcıda saklanır, hesap motoru tarayıcıda çalışır. Üretimde aynı kurallar <code>apps/api</code> ve PostgreSQL üzerinde çalışır; adımlar{" "}
          <Link href="/belgeler/?d=uretime-gecis">Üretime geçiş</Link> belgesinde.
        </p>
      </div>
    </>
  );
}
