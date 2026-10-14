// kayit modülü: yetki ve hata kaydı (yan etkili içe aktarma; src/modules/index.ts çağırır).
// Hata kodları: CONTRACT-v0.2 §8 (motor) + modülün kendi kodları (içe aktarma, OCR, T12, T10).
import { registerPermissions } from "@/lib/domain";
import { registerErrors, type ErrorEntry } from "@/lib/errors";

registerPermissions({
  "kayit.import.run": ["data_entry", "data_owner", "admin"],
  "kayit.import.rollback": ["admin"],
  "kayit.category.assess": ["reviewer", "admin"],
});

const motor = (code: string, title: string, source: string, cause: string, consequence: string, action: string, requirement: string, severity: ErrorEntry["severity"] = "block"): ErrorEntry => ({
  code,
  title,
  layer: "motor",
  source,
  cause,
  consequence,
  action,
  requirement,
  severity,
});

export const KAYIT_ERRORS: ErrorEntry[] = [
  // ---- CONTRACT-v0.2 §8 blok kodları ----
  motor("REFRIGERANT_GAS_UNKNOWN", "Soğutucu gaz türü bilinmiyor", "Soğutucu kaydı, gaz alanı", "Gaz türü 'bilmiyorum' olarak girildi; GWP eşleşmesi yapılamaz.", "Hesap bekler; kayıt taslak kalır.", "Ekipman etiketinden veya servis formundan gaz kodunu (ör. R-134a) bulup girin; bilinmiyorsa servis firmasına görev açın.", "§12 kabul koşulu, T11"),
  motor("EQUIPMENT_NOT_IN_INVENTORY", "Ekipman kaynak envanterinde değil", "Soğutucu kaydı, ekipman alanı", "Soğutucu içeren ekipman kurumun kaynak envanterinde tanımlı değil.", "Kapsam 1 ataması yapılmaz; ilişki yeniden değerlendirilmeden hesap engellenir.", "Ekipman kurumun kontrolündeyse kaynak envanterine ekleyin; kiralık/dış ekipmansa kontrol ilişkisini uzmanla netleştirin.", "§12 kabul koşulu"),
  motor("INSTRUMENT_EXCEEDS_CONSUMPTION", "Belge miktarı tüketimi aşıyor", "Kapsam 2 sözleşmesel araçlar", "Araçların toplam MWh değeri kayıttaki tüketimden fazla.", "Negatif emisyon yaratılamaz; hesap engellenir.", "Belge miktarını bu tesise/döneme düşen payla sınırlayın; belge başka tesis veya döneme tekrar tahsis edilemez (§13).", "§13 kontroller, T06b"),
  motor("INSTRUMENT_DUPLICATE", "Aynı belge iki kez", "Kapsam 2 sözleşmesel araçlar", "Aynı araç kimliği listede iki kez geçiyor.", "Hesap engellenir.", "Yinelenen satırı kaldırın; aynı belge iki tesise veya döneme tahsis edilemez.", "§13"),
  motor("CURRENCY_MISMATCH", "Para birimi uyuşmuyor", "Harcama bazlı Kapsam 3 kaydı", "Harcamanın para birimi faktörün paydasındaki para birimiyle aynı değil; motor kur dönüşümü yapmaz.", "Hesap engellenir.", "Faktörle aynı para biriminde faktör seçin veya harcamayı belgelenmiş kurla ayrı kayıtta dönüştürüp kaynağını yazın (§16).", "§16 harcama ve fiziksel veri"),
  motor("NA_REASON_REQUIRED", "Uygulanamaz gerekçesi eksik", "Kapsam 3 uygulanabilirlik alanı", "Kategori 'uygulanamaz' işaretlendi ama gerekçe yazılmadı.", "Hesap engellenir; uygulanamazlık kaydı gerekçesiz tutulamaz.", "Neden uygulanmadığını yazın (ör. 'franchise verilmiyor'). Veri eksikliği uygulanamazlık değildir; o durumda 'bilinmiyor' seçin.", "§14, T10"),
  motor("DATA_MISSING", "Veri eksik (bilinmiyor)", "Kapsam 3 kaydı, miktar veya uygulanabilirlik", "Uygulanabilirlik 'bilinmiyor' ya da miktar boş.", "Sonuç 'bilinmiyor' olarak işaretlenir; sıfır atanmaz; toplam bu kategoriyi eksik gösterir.", "İlgili departmandan veri isteyin (görev açılır). Kategori gerçekten yoksa gerekçeli 'uygulanamaz' seçin.", "§14, T10"),
  motor("LCA_FACTOR_IN_CATEGORY", "Beşikten mezara faktör kategori 1/2'de", "Kapsam 3 kategori 1–2 faktörü", "Seçilen faktör beşikten mezara toplamdır; kategori 1/2 yalnız üst aşamayı kapsar.", "Hesap engellenir.", "Faktörü bileşenlerine ayrıştırın (beşikten kapıya için ayrı faktör) veya tedarikçiden ayrıştırılmış veri isteyin (§17).", "§17 çakışma ve eksik aşama"),
  motor("BOUNDARY_OVERLAP", "Faktör sınırları çakışıyor", "Kapsam 3 faktör listesi", "Beşikten kapıya ile üst aşama faktörü birlikte seçildi; aynı aşama iki kez sayılır.", "Hesap engellenir.", "Yalnız bir sınır seçin; tedarikçinin beşikten kapıya verisine ham madde üretimi yeniden eklenmez (T09).", "T09"),
  motor("METHOD_NOT_ALLOWED", "Yöntem bu kategori için izinli değil", "Kapsam 3 yöntem alanı", "Seçilen yöntem motorun desteklenen matrisinde bu kategori için yok.", "Hesap engellenir.", "Kategorinin izin verilen yöntemlerinden birini seçin (form listeler; §30 matrisi).", "§16 MTH-03, §30"),
  motor("DEFAULT_SCENARIO_FORBIDDEN", "Gizli varsayılan senaryo yok", "Kategori 11 ömür/kullanım alanları", "Ömür yılı veya yıllık kullanım verilmedi; motor varsayılan atamaz.", "Hesap engellenir.", "Ürün grubunun ömür ve yıllık kullanım senaryosunu kaynağıyla girin; senaryo sürümlenir (§15).", "§15 zaman ve senaryo"),
  motor("ALLOCATION_INVALID", "Tahsis payı geçersiz", "Ürün çalışması tahsis alanı", "Tahsis payı 0–1 aralığında değil.", "Hesap engellenir.", "Payı oran olarak girin (ör. 0.6) ve tahsis temelini kaynağıyla yazın.", "§17"),
  motor("PROCESS_ID_REQUIRED", "Proses kimliği gerekli", "Proses emisyonu kaydı", "Proses tanımlanmadan proses faktörü eşleştirilemez.", "Hesap engellenir.", "Prosesi (ör. klinker üretimi) seçin veya tanımlayın.", "§12 proses şablonu"),
  motor("DENSITY_REQUIRED", "Yoğunluk gerekli", "Yakıt miktarı birim dönüşümü", "Kütle↔hacim dönüşümü için yoğunluk verilmedi.", "Hesap engellenir.", "Yakıtın yoğunluğunu (kg/L) kaynağıyla girin veya faktörle aynı birimde miktar kullanın.", "CONTRACT-v0.2 §2"),
  // ---- CONTRACT-v0.2 §8 uyarı kodları (hesap yapılır; inceleme gerekir veya bilgi) ----
  motor("REFRIGERANT_TOPUP_ASSUMPTION", "Ekleme = kaçak telafisi varsayımı", "Soğutucu kaydı, ekleme işlemi", "Eklenen miktar kaçak telafisi varsayılarak emisyon sayıldı.", "Sonuç 'inceleme gerekli' olur.", "Servis formuyla eklemenin kaçak telafisi olduğunu doğrulayın; yeni ekipman dolumuysa işlem türünü değiştirin (§12).", "§12 kritik istisnalar, T11", "input"),
  motor("RECOVERED_NOT_EMISSION", "Geri kazanım emisyon değildir", "Soğutucu kaydı, geri kazanım işlemi", "Geri kazanılan gaz negatif kütle hareketidir; envantere emisyon yazılmaz.", "Sonuç 'uygulanamaz' olarak işaretlenir.", "Kaydı stok izlemesi için tutun; emisyon beklemeyin.", "§12", "input"),
  motor("RESIDUAL_MIX_UNAVAILABLE", "Artık karışım faktörü yok", "Kapsam 2 piyasa bazlı hesap", "Kapsanmayan tüketim için artık karışım faktörü verilmedi; konum faktörü kullanıldı.", "Sonuç 'inceleme gerekli' olur.", "Artık karışım faktörü yayımlanmışsa seçin; yoksa uzman alternatif faktör gerekçesini onaylasın (§13).", "§13 piyasa bazlı akış, T06", "input"),
  motor("INSTRUMENT_NOT_ELIGIBLE", "Araç uygun değil", "Kapsam 2 sözleşmesel araçlar", "Araç itfa edilmemiş veya kalite koşullarını karşılamıyor.", "Araç sayılmaz; ilgili MWh kapsanmayan sayılır.", "İtfa/iptal belgesini ve kalite koşullarını doğrulayın; 'yenilenebilir satın aldım' tek başına sıfır emisyon üretmez (§13).", "§13 kontroller", "input"),
  motor("UPSTREAM_MISSING", "Üst aşama eksik", "Kapsam 3 kategori 1 faktörü", "Kapıdan kapıya faktör kullanıldı; ham madde üst aşamaları kapsanmıyor.", "Kapsama 'kısmi sınır' olur; inceleme gerekir.", "Beşikten kapıya faktör veya tedarikçinin üst aşama verisini ekleyin (T08).", "T08", "input"),
  motor("SPEND_BASED_ESTIMATE", "Harcama bazlı tahmin", "Kapsam 3 harcama bazlı yöntem", "Harcama bazlı sonuç tahminidir.", "Sonuç 'tahmini' etiketi taşır; inceleme gerekir.", "Fiziksel veriye geçince aynı işlemin harcama sonucu devre dışı bırakılır; eski sonuç tarihçede kalır (§16).", "§16", "input"),
  motor("PARTIAL_BOUNDARY", "Kısmi sınır", "Kapsam 3 faktör sınırı", "Faktörün sınırı kategorinin asgari sınırını tam kapsamıyor.", "Sonuç kısmi sınır olarak etiketlenir.", "Eksik aşamayı ayrı faktörle tamamlayın veya sonucu kısmi olarak raporlayın.", "§14, §17", "input"),
  // ---- Modül kodları (önizleme deposu / arayüz) ----
  { code: "IMPORT_ROW_INVALID", title: "İçe aktarma satırı geçersiz", layer: "depo", source: "İçe aktarma önizlemesi, satır doğrulama", cause: "Satırda birim, tarih, kaynak/tesis veya miktar hatası var ya da satır mükerrer.", consequence: "Yalnız bu satır atlanır; diğer satırlar kaydedilir. Satır nedeniyle birlikte listelenir.", action: "Dosyada satırı düzeltip yeniden yükleyin; başarılı satırlar ikinci kez kaydedilmez (aynı satır karması).", requirement: "§11 içe aktarma", severity: "input" },
  { code: "IMPORT_DUPLICATE_FILE", title: "Aynı dosya daha önce içe aktarıldı", layer: "depo", source: "İçe aktarma, dosya karması kontrolü", cause: "Dosyanın SHA-256 karması daha önce tamamlanmış bir içe aktarma işine ait.", consequence: "Yeni kayıt oluşturulmaz (idempotent).", action: "Dosya değiştiyse yeni sürümü yükleyin; önceki işi geri almak için 'içe aktarmayı geri al' kullanın (yalnız taslaklar silinir).", requirement: "§11 içe aktarma", severity: "conflict" },
  { code: "IMPORT_NOT_REVERSIBLE", title: "Geri alınacak taslak yok", layer: "depo", source: "İçe aktarma geri alma", cause: "İşin oluşturduğu kayıtların tamamı taslak aşamasını geçmiş (hesaplandı, incelemede, onaylı veya kilitli).", consequence: "Hiçbir kayıt silinmez; onaylı kayıtların üzerine yazılmaz.", action: "Düzeltme gerekiyorsa kayıtları tek tek yeni sürümle düzeltin (§21).", requirement: "§11 içe aktarma", severity: "conflict" },
  { code: "OCR_UNAVAILABLE", title: "Belge okuma (OCR) kullanılamıyor", layer: "altyapi", source: "Veri girişi, 'Belgeden oku' adımı (Tesseract.js, CDN)", cause: "OCR kütüphanesi veya dil verisi (tur+eng) indirilemedi ya da belge işlenemedi.", consequence: "Alan önerisi üretilmez; form elle doldurulur. Sessiz atlama yoktur.", action: "Ağ bağlantısını kontrol edip tekrar deneyin; olmazsa alanları faturadan elle girin. OCR doğruluğu emisyon hesabının doğruluğu değildir (§11).", requirement: "DAT-03", severity: "infra" },
  { code: "LIFETIME_GROUP_ALREADY_ACCOUNTED", title: "Satış grubu zaten envantere eklendi", layer: "depo", source: "Kategori 11 (satılan ürünlerin kullanımı) kaydı", cause: "Aynı satış grubu kimliği için ömür boyu kullanım toplamı daha önce başka bir kayıtla envantere alınmış.", consequence: "İkinci kayıt oluşturulmaz; ömrü on yıl olan ürünün toplamı her yıl yeniden eklenmez (T12).", action: "Yeni satış yılı için yeni grup kimliği kullanın; önceki grubun düzeltmesi gerekiyorsa o kaydı yeni sürümle düzeltin.", requirement: "§15 kabul koşulu, T12", severity: "conflict" },
  { code: "CATEGORY_NA_REASON_REQUIRED", title: "Kategori 'uygulanamaz' için gerekçe zorunlu", layer: "depo", source: "Envanter, Kapsam 3 kategori değerlendirmesi", cause: "Kategori uygulanamaz işaretlendi ama gerekçe boş.", consequence: "Değerlendirme kaydedilmez; kategori 'bilinmiyor' kalır.", action: "Neden uygulanmadığını yazın. Veri eksikliği uygulanamazlık değildir; o durumda 'bilinmiyor' bırakın (T10).", requirement: "§14, T10", severity: "input" },
  { code: "SCHEMA_FIELD_REQUIRED", title: "Zorunlu alan eksik", layer: "arayuz", source: "Veri girişi, kayıt türü şeması", cause: "Bu kayıt türü için zorunlu bir alan boş bırakıldı ve 'bilmiyorum' işaretlenmedi.", consequence: "Kayıt oluşturulmaz; form verisi korunur.", action: "Alanı doldurun ya da 'bilmiyorum' işaretleyin; taslak korunur ve görev açılır (T20).", requirement: "§11 ortak alanlar", severity: "input" },
  { code: "SOURCE_TYPE_MISMATCH", title: "Kaynak türü kayıt türüyle uyuşmuyor", layer: "arayuz", source: "Veri girişi, kaynak seçimi", cause: "Seçilen kaynak bu kayıt türünün beklediği türde değil.", consequence: "Kayıt oluşturulmaz.", action: "Uygun türde kaynak seçin veya kurulumda yeni kaynak ekleyin.", requirement: "§11, §12", severity: "input" },
];

registerErrors(KAYIT_ERRORS);
