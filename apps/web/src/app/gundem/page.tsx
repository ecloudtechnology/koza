import { Planned } from "@/components/ui";

export default function Gundem() {
  return (
    <Planned title="Gündem ve takvim" dilim="8" section="§09, §19, REG-01">
      <div className="card">
        <h2>Ne yapacak</h2>
        <ul className="small">
          <li>Mevzuat değişikliği, standart güncellemesi, resmî duyuru, destek çağrısı ve etkinlik ayrı etiketlenir; taslak ile yürürlük ayrılır.</li>
          <li>Gündem kartı: ne değişti, beni neden ilgilendiriyor, şimdi ne yapmalıyım; yayın / yürürlük / son kontrol tarihleri ayrı.</li>
          <li>Kurum içi teslim tarihi ile yasal son tarih farklı etiket; saat dilimi Europe/Istanbul, saklama UTC.</li>
          <li>Destek kartı "size uygun olabilir" ön değerlendirmedir; tutar ve son tarih kaynak olmadan üretilmez (K-15).</li>
          <li>Geçmiş son tarih yaklaşan iş gibi gösterilemez; taslak düzenleme görev yaratamaz.</li>
        </ul>
        <p className="small muted">Önizlemede hiçbir gündem kartı yok: kaynak izleme altyapısı (SRC-01…07) kurulmadan içerik gösterilmez.</p>
      </div>
    </Planned>
  );
}
