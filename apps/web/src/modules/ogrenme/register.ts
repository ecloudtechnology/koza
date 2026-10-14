// ogrenme modülü: yetki ve hata kaydı (§07 101, §08 protokoller, §09 gündem, §10 sözlük; ÖĞR-01…04, REG-01).
import { registerPermissions } from "@/lib/domain";
import { registerErrors } from "@/lib/errors";

const ALL = ["admin", "data_entry", "data_owner", "reviewer", "approver", "viewer"] as const;

registerPermissions({
  "ogrenme.progress.write": [...ALL], // herkes kendi ilerlemesini yazar (§07: ilerleme kullanıcı bazında)
  "ogrenme.applicability.decide": ["reviewer", "admin"], // §08 uygulanabilirlik kararı (uzman kontrolü)
  "ogrenme.agenda.follow": [...ALL], // takip / sessize al / takvime ekle (kişisel tercih)
  "ogrenme.agenda.task": ["data_entry", "data_owner", "reviewer", "approver", "admin"], // yürürlükteki maddeden görev
  "ogrenme.help.task": [...ALL], // §10 yardım yolları: "belge elimde yok", "emin değilim" görev açar
});

registerErrors([
  { code: "LESSON_NOT_FOUND", title: "Ders bulunamadı", layer: "depo", source: "Sürdürülebilirlik 101 — ders tamamlama", cause: "Ders kimliği içerik kataloğunda (content/lessons) yok ya da adres hatalı.", consequence: "İlerleme kaydı yazılmaz.", action: "101 listesinden dersi seçin; bağlantı eskiyse ders yolunu yeniden açın.", requirement: "§07", severity: "input" },
  { code: "LESSON_QUIZ_INCOMPLETE", title: "Sorular cevaplanmadı", layer: "depo", source: "Sürdürülebilirlik 101 — modül tamamlama", cause: "Dersin üç sorusundan en az biri cevapsız. Doğru cevap şart değildir; her soruya cevap verip gerekçeyi okumak gerekir.", consequence: "'Modül tamamlandı' kaydı yazılmaz; okuduğunuz içerik kaybolmaz.", action: "Kalan soruları cevaplayın, yanlışsa açıklamayı okuyun, sonra tamamlayın.", requirement: "§07 değerlendirme", severity: "input" },
  { code: "APPLICABILITY_REASON_REQUIRED", title: "Gerekçe gerekli", layer: "depo", source: "Protokoller — uygulanabilirlik kararı", cause: "Uygulanır / uygulanmaz / inceleme gerekli kararı için gerekçe boş veya çok kısa (en az 10 karakter).", consequence: "Karar kaydedilmez; önceki karar geçerli kalır.", action: "Kararın dayandığı kurum verisini (ülke, profil, paket, ihracat durumu vb.) bir cümleyle yazın.", requirement: "§08 uygulanabilirlik", severity: "input" },
  { code: "APPLICABILITY_UNKNOWN_SOURCE", title: "Kaynak kartı yok", layer: "depo", source: "Protokoller — uygulanabilirlik kararı", cause: "Karar verilmek istenen kaynak kodu content/sources altında kayıtlı değil.", consequence: "Karar kaydedilmez.", action: "Kaynağı önce kaynak izleme (SRC-01) ile kaydettirin; içerik ekibine görev açın.", requirement: "§08, §19 SRC-01", severity: "input" },
  { code: "APPLICABILITY_RESULT_INVALID", title: "Geçersiz karar değeri", layer: "depo", source: "Protokoller — uygulanabilirlik kararı", cause: "Karar 'applies', 'not_applicable' veya 'review_required' dışında bir değer.", consequence: "Karar kaydedilmez.", action: "Üç seçenekten birini seçin.", requirement: "§08", severity: "input" },
  { code: "AGENDA_DRAFT_NO_TASK", title: "Taslak düzenleme görev üretmez", layer: "depo", source: "Gündem — görev oluştur", cause: "Madde 'taslak' veya 'istişare' durumunda; yalnız yürürlükteki düzenleme/standart görev üretebilir.", consequence: "Görev açılmaz. Maddeyi takip edebilir veya takvime ekleyebilirsiniz.", action: "Madde yürürlüğe girince (editör kaynaktan doğrulayınca) görev oluşturun.", requirement: "§09 kabul koşulu, §19 'taslak yayın otomatik yükümlülük olamaz'", severity: "conflict" },
  { code: "AGENDA_ITEM_NOT_FOUND", title: "Gündem maddesi yok", layer: "depo", source: "Gündem", cause: "Madde kimliği content/agenda altında yok.", consequence: "İşlem yapılmaz.", action: "Gündem listesinden maddeyi yeniden seçin.", requirement: "§09", severity: "input" },
  { code: "HELP_TERM_NOT_FOUND", title: "Terim bulunamadı", layer: "depo", source: "Sözlük — yardım yolları", cause: "Terim kimliği content/terms altında yok.", consequence: "Görev açılmaz.", action: "Sözlükte terimi arayıp yeniden deneyin.", requirement: "§10", severity: "input" },
]);
