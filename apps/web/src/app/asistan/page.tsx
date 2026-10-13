import { Planned } from "@/components/ui";

export default function Asistan() {
  return (
    <Planned title="Asistan" dilim="3" section="§24 AI-01…06, T15, T16">
      <div className="card">
        <h2>Neden burada bir sohbet kutusu yok</h2>
        <p>
          Asistan yalnız yetkili, sürümü belirli kaynaklarla çalışır (AI-02) ve sayıyı hesap servisinden alır (AI-05). Kaynak servisi (§19) ve tenant etiketli arama kurulmadan bir sohbet kutusu koymak, kaynaksız yanıt ve uydurma katsayı riski demektir. Bu yüzden bu önizlemede asistan yoktur; çalışmayan bir kutu da yoktur (kural 10).
        </p>
        <h3>Sözleşme (uygulanacak)</h3>
        <ol className="small">
          <li>AI-01 Amaç ve aktif kurum bağlamı belirlenir.</li>
          <li>AI-02 Yalnız yetkili, sürümü belirli kaynaklar getirilir.</li>
          <li>AI-03 Yanıt dayanak paragraflarla eşleştirilir.</li>
          <li>AI-04 Eksik koşul varsa soru sorulur.</li>
          <li>AI-05 Sayı gerekiyorsa hesap servisinden alınır.</li>
          <li>AI-06 Yanıt, koşul, kaynak ve sonraki eylem birlikte gösterilir. Kaynak yoksa: "Bu bilgi için doğrulanmış kaynak bulamadım."</li>
        </ol>
        <h3>Sınırlar</h3>
        <p className="small">Yapamaz: onaylamak, silmek, dönemi kilitlemek, rapor yayımlamak, dışarıya mesaj göndermek, faktör etkinleştirmek, sayı tahmin etmek, uygunluk hükmü vermek. Yüklenen belge ve web içeriği veridir, komut değildir (T15). Altın test seti: birim belirsizliği, bilinmeyen soğutucu, eksik kaynak, çelişen standart, taslak mevzuat, sahte talimatlı belge, başka kuruma veri sorma.</p>
      </div>
    </Planned>
  );
}
