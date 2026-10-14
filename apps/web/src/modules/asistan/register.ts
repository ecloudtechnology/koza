// asistan modülü: yetki ve hata kaydı (§24 AI-01…06, T15, T16).
import { registerPermissions } from "@/lib/domain";
import { registerErrors } from "@/lib/errors";

// Soru sormak her role açıktır; yanıt yalnız aktif kurumun verisiyle ve yetkili kaynaklarla kurulur.
// Asistanın önerdiği eylem (görev taslağı) normal yetki katmanından geçer; sohbet bu katmanı aşamaz.
registerPermissions({
  "asistan.ask": ["admin", "data_entry", "data_owner", "reviewer", "approver", "viewer"],
});

registerErrors([
  {
    code: "ASSISTANT_NO_SOURCE",
    title: "Doğrulanmış kaynak yok",
    layer: "arayuz",
    source: "Asistan yanıt motoru (kaynak dizini araması)",
    cause: "Soru, yetkili ve sürümü belirli kaynaklarla (şartname, sözlük, kaynak kartları, hata sözlüğü, kurum verisi) eşleşmedi.",
    consequence: "Yanıt üretilmez; 'Bu bilgi için doğrulanmış kaynak bulamadım' denir. Tahmin veya serbest metin yazılmaz.",
    action: "Soruyu terim veya alan adıyla yeniden sorun ya da destek talebi görevi açın; kaynak ekibi içeriği ekler (§10 yardım yolları).",
    requirement: "§24 AI-02, AI-06",
    severity: "input",
  },
  {
    code: "ASSISTANT_CONTEXT_REQUIRED",
    title: "Eksik bağlam",
    layer: "arayuz",
    source: "Asistan yanıt motoru (bağlam çözümleme)",
    cause: "Soru bir kayda, alana veya birime bağlı ama hangisi olduğu belli değil (ör. 'bu kayıt' kimliksiz, birim bilinmeden birim sorusu).",
    consequence: "Yanıt yerine tek bir netleştirme sorusu sorulur; varsayım yapılmaz.",
    action: "Hızlı yanıt seçeneklerinden birini seçin veya kayıt kimliğini / birimi soruya ekleyin.",
    requirement: "§24 AI-04",
    severity: "input",
  },
  {
    code: "ASSISTANT_NO_RUN",
    title: "Kaydedilmiş hesap koşusu yok",
    layer: "arayuz",
    source: "Asistan yanıt motoru (sayısal soru)",
    cause: "Sayı istendi ama kayıt için hesap motoru koşusu kaydedilmemiş. Asistan sayı hesaplamaz ve tahmin etmez.",
    consequence: "Sayı verilmez; kayıt sayfasındaki hesap düğmesine yönlendirilir.",
    action: "Kayıt sayfasında 'Hesapla' ile motoru çalıştırın; sonuç kaydedilince asistan aynı sayıyı okur.",
    requirement: "§24 AI-05, kural 1",
    severity: "input",
  },
  {
    code: "ASSISTANT_DOCUMENT_INSTRUCTION",
    title: "Belgede talimat benzeri içerik",
    layer: "arayuz",
    source: "Asistan belge tarayıcı",
    cause: "Yapıştırılan belge metninde 'önceki talimatı yok say', 'sistem komutu' gibi ifadeler bulundu.",
    consequence: "İfade veri olarak kalır; hiçbir davranış, yetki veya alan önerisi değişmez. Görünür uyarı gösterilir.",
    action: "Belgeyi normal şekilde doğrulayın; şüpheli belgeyi uzman kontrolüne işaretleyin.",
    requirement: "§24 belge güvenliği, T15",
    severity: "input",
  },
]);
