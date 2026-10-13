import { Planned } from "@/components/ui";

export default function Urun() {
  return (
    <Planned title="Ürün ve yaşam döngüsü" dilim="7 ve sonrası (Aşama F)" section="§17, REG-03, T08, T09, T12">
      <div className="card">
        <h2>Ne yapacak</h2>
        <ul className="small">
          <li>Ürün çalışması kurumsal envanterin yanında ayrı hesap bağlamıdır; sonucu kurumsal toplama eklenmez (kural 8).</li>
          <li>Sınır soruları sade dille: yalnız belirli işlemler mi (kapıdan kapıya), ham maddeden tesis çıkışına mı (beşikten kapıya), kullanım ve ömür sonu da mı (beşikten mezara), müşteriye özel kısmi sınır mı.</li>
          <li>Yalnız karbon hesaplandıysa "ürün karbon ayak izi" veya "kısmi ürün karbon ayak izi" denir; tam LCA veya EPD iddiası yok.</li>
          <li>CBAM gömülü emisyon bu bağlamda hesaplanır (REG-03); kanıt formatı açık karar K-07.</li>
        </ul>
      </div>
    </Planned>
  );
}
