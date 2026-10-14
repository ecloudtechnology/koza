// disiliskiler modülü: yetki ve hata kaydı (TDR-01…04, REG-01…06, AKS-05, §09, §14, §19, §21, §22).
// Yan etkili içe aktarma; src/modules/index.ts yükler.
import { registerPermissions } from "@/lib/domain";
import { registerErrors } from "@/lib/errors";

registerPermissions({
  // Tedarikçi programı
  "disiliskiler.supplier.write": ["data_owner", "admin"], // tedarikçi kaydı, sınıflandırma, anket
  "disiliskiler.request.write": ["data_owner", "admin", "data_entry"], // talep taslağı ve tamamlayıcı talep
  "disiliskiler.request.authorize": ["admin", "data_owner"], // dış tarafa gönderim yetkisi (§09) — denetim izine yazılır
  "disiliskiler.questionnaire.write": ["data_owner", "admin", "data_entry"], // öz değerlendirme girişi (TDR-03)
  // Regülasyon paketleri
  "disiliskiler.package.assess": ["data_owner", "admin", "reviewer", "approver"], // uygulanabilirlik cevapları (§08)
  "disiliskiler.package.decide": ["reviewer", "approver", "admin"], // paket aç/kapat kararı (K-06/K-07/K-08 sahibi)
  "disiliskiler.source.record": ["data_owner", "admin", "reviewer"], // kaynak sürümü kaydı (SRC-01/03)
  "disiliskiler.source.approve": ["reviewer"], // değişiklik kartı uzman onayı (SRC-06); kuralı etkinleştirir
  "disiliskiler.mrv.write": ["data_owner", "admin", "reviewer"], // izleme planı sürümü (REG-02)
  "disiliskiler.carbon_cost.write": ["admin", "approver"], // finans: ödenen karbon maliyeti girişi (REG-04)
  // Senaryo defteri — finans notu: gölge fiyat ve tahsis senaryosu finans + sürdürülebilirlik ortak kararıdır (K-11);
  // önizleme rolleri arasında "finans" yok; approver ve admin bu rolü temsil eder. Envantere hiçbir zaman yazmaz.
  "disiliskiler.scenario.write": ["admin", "approver"],
});

registerErrors([
  {
    code: "CONFIDENTIALITY_ACK_REQUIRED",
    title: "Gizlilik taahhüdü onaylanmadı",
    layer: "depo",
    source: "Tedarikçi görünümü — veri formu",
    cause: "Tedarikçi, gizlilik ve 'yalnız toplulaştırılmış kullanım' taahhüdünü okuyup onaylamadan veri formuna geçmeye çalıştı.",
    consequence: "Form açılmaz; hiçbir veri alınmaz.",
    action: "İlk ekrandaki taahhüdü okuyup 'Okudum, onaylıyorum' ile devam edin. Onay sürümüyle birlikte kaydedilir.",
    requirement: "TDR-02",
    severity: "conflict",
  },
  {
    code: "EXTERNAL_SEND_AUTHORIZATION_REQUIRED",
    title: "Dış gönderim yetkisi yok",
    layer: "depo",
    source: "Veri talebi — kopyala / indir",
    cause: "Talep metni dış tarafa verilmeden önce yetkili (kurum yöneticisi veya veri sorumlusu) açık onay vermedi.",
    consequence: "Metin kopyalanmaz/indirilmez. Uygulama hiçbir zaman e-posta göndermez; gönderim kullanıcı eliyle yapılır.",
    action: "Muhatap, kapsam ve ekleri doğrulayıp 'Dış gönderimi yetkilendir' adımını gerekçeyle tamamlayın; yetki denetim izine yazılır.",
    requirement: "§09, §21",
    severity: "forbidden",
  },
  {
    code: "RULE_UNVERIFIED",
    title: "Kural doğrulanmamış",
    layer: "depo",
    source: "Regülasyon paketi — uygulanabilirlik / kural etkinleştirme",
    cause: "Kullanılan kuralın kaynak metni doğrulanmamış (source_status ≠ verified) ya da eşik/tarih değeri yok.",
    consequence: "Sonuç 'inceleme gerekli' olur; kural etkinleşmez, yükümlülük görevi doğrulanmış sayılmaz.",
    action: "Kaynak sürümünü kaydedin, değişiklik kartı açın ve uzman onayıyla kuralı etkinleştirin (§19 SRC-03…06).",
    requirement: "REG-06, kural 6",
    severity: "conflict",
  },
  {
    code: "PACKAGE_NOT_OPEN",
    title: "Paket açık değil",
    layer: "depo",
    source: "İzleme planı, kanıt paketi, CBAM işareti",
    cause: "İlgili regülasyon paketi bu kurum için 'açık' durumda değil (kapalı veya inceleme gerekli).",
    consequence: "Pakete bağlı işlev kullanılamaz; görev üretilmez.",
    action: "Regülasyon sekmesinde uygulanabilirlik değerlendirmesini yapın; karar sahibi paketi açsın.",
    requirement: "REG-01, REG-02, REG-04, §08",
    severity: "conflict",
  },
  {
    code: "SCENARIO_NOT_INVENTORY",
    title: "Senaryo envantere yazamaz",
    layer: "depo",
    source: "Senaryo defteri",
    cause: "Senaryo işlemi sırasında envanter tabloları (kayıt, koşu, rapor, onay, dönem) değişmeye çalıştı; değişmezlik denetimi yakaladı.",
    consequence: "İşlem geri alınır; envanter toplamı ve rapor manifesti değişmez.",
    action: "Senaryo yalnız senaryo tablolarına yazar. Bu hata görülürse geliştiriciye bildirin.",
    requirement: "REG-05, §22, kural 7",
    severity: "block",
  },
  {
    code: "SUPPLIER_SCOPE_VIOLATION",
    title: "Tedarikçi kapsam ihlali",
    layer: "depo",
    source: "Tedarikçi görünümü",
    cause: "Tedarikçi kimliği, kendisine atanmamış bir talebe veya kurumun başka verisine erişmeye çalıştı.",
    consequence: "Erişim reddedilir; varlık bilgisi açıklanmaz.",
    action: "Tedarikçi yalnız kendisine atanan talepleri görür. Doğru tedarikçiyi seçin.",
    requirement: "§21, kural 3",
    severity: "forbidden",
  },
]);

export {};
