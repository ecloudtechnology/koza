import Link from "next/link";
import { PageHeader } from "@/components/ui";

const FLOW = [
  ["Görev", "Ne yapmak istiyorsun?", "Sistem sonraki adımı gösterir; teknik terim seçim olarak dayatılmaz."],
  ["Veri", "Kanıtlı kayıt", "Fatura, miktar, birim, dönem; eksik bilgi sıfır sayılmaz, görev olur."],
  ["Hesap", "Deterministik motor", "Aynı girdi + faktör + yöntem = aynı sonuç; izi kaynağa kadar gider."],
  ["Kontrol", "Uzman incelemesi", "Hesaplandı ≠ onaylandı. Veri giren ile onaylayan farklıdır."],
  ["Rapor", "Sabit manifest", "Her rapor sürümü veri/faktör kimliklerini ve karmasını taşır."],
];

const LAYERS = [
  ["1", "Strateji ve sahiplik", "Hedef kartı, RACI, karar kapısı", "§04, §21, §22"],
  ["2", "Süreç mimarisi", "Üretim, yatırım, satın alma, İK, bakım süreçlerinde sürdürülebilirlik kapıları", "AKS"],
  ["3", "Veri yönetişimi", "Gösterge sözlüğü: tanım, sahip, birim, kalite kuralı, erişim", "GÖS"],
  ["4", "Entegrasyon", "ERP, MES, sayaç/IoT, tedarikçi → kontrollü veri girişi", "§11, §27"],
  ["5", "Ortak ESG veri katmanı", "Enerji, su, emisyon, atık, üretim, İSG, çalışan, finans, tedarikçi", "§18, §20"],
  ["6", "Karar ve aksiyon motoru", "KPI sapması → görev → kök neden → düzeltici faaliyet → etki doğrulama", "AKS (v1.1)"],
];

export default function Hakkinda() {
  return (
    <>
      <section className="hero">
        <div className="eyebrow" style={{ fontSize: "0.7rem", letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--accent)", fontWeight: 600 }}>
          MEXT · İş Dünyasında Sorumlu Üretim
        </div>
        <h1>Koza nedir?</h1>
        <p className="lead">
          Koza, sürdürülebilirlik görevine yeni başlayan bir çalışanın ilk faturayı doğru girip ne yaptığını anlamasından, uzman onaylı ve
          denetlenebilir bir rapora kadar tüm zinciri tek bir rehberli akışta toplayan, her sektöre uyarlanabilir bir uygulamadır.
          <br />
          <b>Hesabı motor yapar; yapay zekâ açıklar ve yönlendirir.</b>
        </p>
        <div className="actions">
          <Link className="btn primary" href="/kurulum/">
            Akışı deneyin
          </Link>
          <Link className="btn" href="/belgeler/?d=sartname">
            Şartname v1.0
          </Link>
          <Link className="btn" href="/ekip/">
            Ekip
          </Link>
        </div>
      </section>

      <div className="grid-3">
        <div className="card">
          <h2>Hangi sorunu çözüyor</h2>
          <p>
            GreenSync Young Professionals Forum'da grubun ESG balık kılçığı tek bir ana probleme çıktı: <b>işletmede sürdürülebilirlik odaklı bir sistem mimarisi yok.</b> Veri dağınık ve
            güvenilmez, sahiplik ve hedef belirsiz, tedarikçi verisi gelmiyor, saha sürece katılmıyor, regülasyon ve finansman takip edilemiyor.
          </p>
        </div>
        <div className="card">
          <h2>Neyi amaçlıyor</h2>
          <p>
            Forumun iki hedefini ölçülebilir hâle getirmek: <b>verimlilik</b> (kaynak tüketimi, hurda ve süreç kayıplarını azaltmak) ve <b>çalışan memnuniyeti</b> (katılım, yetkinlik,
            güvenlik, çalışma deneyimi). Her modül bu iki hedeften en az birine ölçülebilir katkı sağlar; hedef değerler pilot başlangıcındaki ölçümle belirlenir, önceden vaat edilmez.
          </p>
        </div>
        <div className="card">
          <h2>Kime hizmet ediyor</h2>
          <p>
            Birincil kullanıcı konuya yeni başlayan "yeşil yakalı" çalışandır. Çevresinde veri sağlayıcı birimler ve tedarikçiler, uzman kontrolör ve onaylayan, yönetici/sponsor, saha
            operatörü, sürdürülebilirlik elçisi ve finans/karbon masası vardır. İlk pazar Türkiye'de üretim yapan işletmeler; sektör, sürümlü profil verisi olarak yüklenir.
          </p>
        </div>
      </div>

      <h2>Çalışma zinciri</h2>
      <p className="muted">Her ek modül bu zincire bağlanır; Koza genel bir ESG platformuna dönüşmez.</p>
      <div className="flow">
        {FLOW.map(([k, t, d]) => (
          <div className="node" key={k}>
            <div className="k">{k}</div>
            <div className="t">{t}</div>
            <div className="d">{d}</div>
          </div>
        ))}
      </div>

      <h2>Forum mimarisinin kullanıcı yüzü</h2>
      <p className="muted">Grubun önerdiği altı katman (Havva Dönmez) Koza'nın iç yapısına oturur; ilk beşi şartnamede vardı, altıncısı v1.1 ile eklendi.</p>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Katman</th>
              <th>İçerik</th>
              <th>Koza'daki karşılığı</th>
            </tr>
          </thead>
          <tbody>
            {LAYERS.map(([n, t, d, r]) => (
              <tr key={n}>
                <td>
                  <b>
                    {n}. {t}
                  </b>
                </td>
                <td>{d}</td>
                <td className="small">{r}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2>Vazgeçilmez ilkeler</h2>
      <div className="grid-3">
        {[
          ["Deterministik hesap", "Sayısal sonucu yalnız hesap motoru üretir. Yapay zekâ çıktısı hiçbir zaman sayı, faktör veya sınıflandırma kararı olarak kaydedilmez."],
          ["Durumlar ayrıdır", "Bilinmiyor, ölçülmüş sıfır, uygulanamaz ve tahmini birbirinden farklıdır; eksik veriye asla sıfır atanmaz."],
          ["Kurum izolasyonu", "Her katmanda (veritabanı, dosya, arama) kurum ayrımı. İstemciden gelen kurum kimliği yetki kanıtı değildir."],
          ["Yetki sunucuda", "Arayüzde gizlemek yetkilendirme değildir. Veri giren ile onaylayan varsayılan olarak farklıdır."],
          ["Sektör = veri", "Sektöre özgü gösterge, payda, soru ve öncelik sürümlü profil verisinden gelir; koda gömülmez."],
          ["Geçmiş sessizce değişmez", "Onaylı sonuç, kilitli dönem ve rapor manifesti yeni sürümle düzeltilir; eskisi korunur."],
          ["Senaryo ≠ envanter", "Karbon fiyatı, tahsis ve alım-satım senaryoları ayrı defterde; envanter toplamını değiştiremez."],
          ["Sahte tamamlama yok", "Çalışmayan buton, uydurma grafik, kalıcı kayıt olmadan başarı mesajı, doğrulanmamış tasarruf yüzdesi yok."],
          ["Kişisel sıralama yok", "Green Kaizen ve öğrenme verisi birim düzeyinde toplulaştırılır."],
        ].map(([t, d]) => (
          <div className="card quiet" key={t}>
            <h3 style={{ marginTop: 0 }}>{t}</h3>
            <p className="small" style={{ marginBottom: 0 }}>
              {d}
            </p>
          </div>
        ))}
      </div>

      <h2>Bu önizleme neyi gösteriyor</h2>
      <p>
        Dilim 0 (depo iskeleti, veritabanı göçleri, kurum izolasyonu, denetim izi) ve Dilim 1 (kurum kurulumu → doğal gaz kaydı → hesap → inceleme → dönem → rapor) çalışır durumda.
        Kayıtlar yalnız bu tarayıcıda saklanır; hesap motoru tarayıcıda aynı Python koduyla çalışır; tüm faktörler kurgusal test değeridir. Neyin tamam, neyin planlı olduğu{" "}
        <Link href="/durum/">Proje durumu</Link> sayfasında gereklilik kimliğiyle listelenir; inceleme yolu <Link href="/belgeler/?d=inceleme-rehberi">İnceleme rehberi</Link>nde.
      </p>
    </>
  );
}
