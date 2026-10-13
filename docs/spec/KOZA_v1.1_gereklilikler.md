# KOZA v1.1 — Gereklilik eki

Sürüm 1.1 · 13 Ekim 2026 · v1.0 şartnamesini genişletir; çelişkide bu ek geçerlidir.

## 1. Neden bu ek

Koza'nın ana mantığı değişmez: rehberli görev → kanıtlı veri → deterministik hesap → uzman kontrolü → rapor. Bu ek, Young Professionals Forum'da ortaya çıkan ana sorunu ("işletmede sürdürülebilirlik odaklı sistem mimarisi yok") ve iki hedefi (**verimlilik** ve **çalışan memnuniyeti**) ürüne bağlar. Ürün **tüm sektörlere** uyarlanabilir; sektöre özgü her şey sürümlü profil verisidir.

v1.0'daki "İlk odak Türkiye'de üretim yapan işletmeler" ifadesi şöyle okunur: ilk pazar Türkiye; sektör, pilot kararıyla seçilir ve sektör profili olarak yüklenir.

## 2. Forum eksenleri → Koza

| Forum ekseni | Kök neden | Koza'daki karşılığı | v1.1 eki |
| --- | --- | --- | --- |
| Yönetişim | Sahiplik, hedef, öncelik yok | §04, §21, §22 | Hedef kartı + RACI, yatırım talebine karar kapısı, gölge karbon fiyatı senaryosu |
| Veri ve dijital altyapı | Dağınık, güvenilmez veri | §11, §18, §27 | Gösterge sözlüğü, çekirdek gösterge paketi, profile göre yoğunluk panosu, MRV uyumlu izleme planı |
| Tedarik zinciri | Tedarikçi verisi yok, güven sorunu | §14, §21 | Segmentasyon, gizlilik taahhüdü, öz değerlendirme, gömülü emisyon talebi |
| Sosyal | Farkındalık düşük, saha katılmıyor | §07, §23 | Rol bazlı öğrenme, Green Kaizen, sürdürülebilirlik elçisi |
| Dış ekosistem | Regülasyon, finansman, maliyet | §09, §19 | Regülasyon paketleri, fon haritası (ön değerlendirme), ortak veri şablonu |

Sistem mimarisi önerisi (strateji ve sahiplik → süreç mimarisi → veri yönetişimi → entegrasyon → ortak ESG veri katmanı → karar ve aksiyon motoru): Koza bu katmanların kullanıcı yüzüdür; altıncı katman (AKS) bu ekle gelir. Karbon finansal kalem önerisi (ETS): MRV verisi üretim verisidir; fiyat/tahsis/alım-satım senaryo defterindedir.

## 3. Yeni roller

| Rol | Görür / yapar | Sınır |
| --- | --- | --- |
| Saha çalışanı / operatör | Mobil sade görünüm, alan/hat hedefi, Green Kaizen önerisi, kısa saha dersleri | Envanter verisi yazamaz; kişisel sıralamada görünmez |
| Sürdürülebilirlik elçisi | Birim görevleri, öneri ön değerlendirmesi, ders önerme | Onay veremez |
| Finans / karbon masası | Senaryo defteri, gölge karbon fiyatı, regülasyon maruziyet özeti | Envanter salt okunur |
| Yönetici / sponsor (genişletildi) | Hedef kartı, RACI, iki hedefin durumu | — |

## 4. Gereklilikler

### SEK — Sektör uyarlama katmanı

- **SEK-01** Kurum kurulumunda faaliyet alanı NACE koduyla alınır; sistem profil önerir, kullanıcı onaylar. Kurumda birden fazla faaliyet alanı ve tesis bazında farklı profil olabilir.
- **SEK-02** Profil; sektöre özgü göstergeler, yoğunluk paydaları, kaynak envanteri soruları (ONB-03), öncelikli Kapsam 3 kategorileri, ders yolları, örnek belgeler ve olası regülasyon paketlerini taşır. Şema: `content/sector-profiles/_schema.yaml`.
- **SEK-03** Profil yalnız önerir ve önceliklendirir; kategori silmez, uygulanabilirlik kararı vermez.
- **SEK-04** Profil sürümü değişince geçmiş hesap ve raporlar değişmez; etkilenen kayıt listesi ve fark önizlemesi oluşur.
- **SEK-05** Uygun profil yoksa `genel` profil; eksik sektör talebi içerik ekibine görev olur.

Örnek profiller (uzman onayıyla yüklenir):

| Profil | Yoğunluk paydası | Öncelikli Kapsam 3 | Sektöre özgü gösterge |
| --- | --- | --- | --- |
| Ağır sanayi (metal, çimento, cam) | ton ürün | 1, 3, 4 | Proses emisyonu, hurda oranı |
| Genel imalat | adet veya ton ürün | 1, 4, 11, 12 | Fire oranı, makine başı enerji |
| Gıda ve içecek | ton ürün, m³ su | 1, 4, 5, 12 | Soğutucu kaçağı, gıda kaybı |
| Tekstil ve hazır giyim | kg kumaş, adet | 1, 4, 5 | Su ve kimyasal tüketimi |
| Lojistik ve taşımacılık | ton-km | 1, 3, 4 | Filo yakıt verimi |
| Perakende | m² satış alanı | 1, 4, 9, 12 | Ambalaj, soğutma |
| Hizmet, ofis ve yazılım | çalışan, m² | 1, 6, 7 | Veri merkezi / bulut tüketimi |

TSRS gibi ölçeğe bağlı yükümlülükler sektörden bağımsız olarak §08 uygulanabilirlik değerlendirmesiyle belirlenir.

### GÖS — Gösterge sözlüğü ve veri sözleşmesi

- **GÖS-01** Her gösterge: tanım, birim, kaynak sistem, veri sahibi, güncelleme sıklığı, kalite kuralı, erişim yetkisi.
- **GÖS-02** Çekirdek paket (tüm sektörler): enerji (elektrik, yakıtlar), Kapsam 1–2, su, atık, iş kazası, kişi başı eğitim saati, faaliyet çıktısı. Sektöre özgü göstergeler profilden eklenir.
- **GÖS-03** Yoğunluk göstergesi, profildeki payda tanımı ve dönemi olmadan hesaplanmaz.
- **GÖS-04** Veri sözleşmesi testleri (kaynak, birim, zaman, tutarlılık); uygunsuz kayıt düzeltme kuyruğuna.

### AKS — Karar kapısı ve aksiyon motoru

- **AKS-01** Tetikleyiciler: KPI sapması, yeni yatırım, süreç/hat değişikliği, çalışan önerisi, mevzuat gereği.
- **AKS-02** Ön değerlendirme: enerji, su, karbon, atık/fire, İSG, ergonomi, iş yükü, maliyet; bilinmeyen alan "bilinmiyor" kalır.
- **AKS-03** Seçenekler ekonomik, çevresel ve çalışan etkisiyle yan yana; pilot sorumlusu ve süresi atanır.
- **AKS-04** Baz dönemle ölç (profildeki yoğunluklar, atık/fire, öneri uygulama oranı, memnuniyet). İki hedef de eşiği karşılarsa standardize et; değilse kök neden ve yeniden tasarım.
- **AKS-05** Yatırım talebinde "enerji/emisyon etkisi" zorunlu; gölge karbon fiyatı varsa senaryo olarak eklenir.

### KZN — Green Kaizen

- **KZN-01** Saha çalışanı mobilde 3 alanlı öneri girer: ne gördüm, ne öneriyorum, hangi alan/hat/ekipman. Fotoğraf isteğe bağlı.
- **KZN-02** Elçi ön değerlendirir; uygun öneri AKS-01 tetikleyicisi olur.
- **KZN-03** Uygulanan öneri, ölçülen etkisiyle öneri sahibine geri bildirilir.

### REG — Regülasyon uyum paketleri

- **REG-01** Her yükümlülük (CBAM, ulusal ETS/MRV, TSRS, AB müşterilerinin tedarik zinciri talepleri vb.) ayrı, sürümlü pakettir; §08 uygulanabilirlik değerlendirmesiyle açılır.
- **REG-02** Tesis ETS kapsamındaysa Kapsam 1 sınırı ulusal MRV kılavuzuna eşlenir; izleme planı sürümlü ve denetlenebilir.
- **REG-03** Ürün düzeyi yükümlülükler (ör. CBAM gömülü emisyon) ürün bağlamında (§17) hesaplanır; kurumsal toplama eklenmez.
- **REG-04** Yurt içinde ödenen karbon maliyetinin kanıtı ihracat müşterisine verilecek biçimde hazırlanır (paket açıksa).
- **REG-05** Tahsis, açık/fazla ve alım-satım senaryoları yalnız senaryo defterinde.
- **REG-06** Eşik, tarih, benchmark koda yazılmaz; §19 üzerinden sürümlü kural.

### TDR — Tedarikçi veri programı

- **TDR-01** Harcama ve emisyon yoğunluğuna göre sıralama; ilk dalga kritik %20.
- **TDR-02** Kısa standart talep + gizlilik ve "yalnız toplulaştırılmış kullanım" taahhüdü ilk ekranda.
- **TDR-03** Risk temelli denetim: önce öz değerlendirme; yüksek riskte saha ziyareti görevi; ceza yerine düzeltici plan.
- **TDR-04** KOBİ tedarikçiye kısa MRV/karbon muhasebesi dersi ve örnek dolu şablon.

### ÖĞR — Rol bazlı öğrenme

- **ÖĞR-01** Yönetici: strateji ve kurum için açık regülasyon paketleri.
- **ÖĞR-02** Mühendis/uzman: karbon ayak izi, yaşam döngüsü, veri kalitesi, MRV.
- **ÖĞR-03** Saha: enerji, atık/fire, güvenlik; ≤3 dakikalık mobil dersler; örnekler profilden.
- **ÖĞR-04** Her ders gerçek bir göreve bağlanır (§07); eğitim saati GÖS paketine toplu yazılır.

## 5. Asistanın rolü

| Modül | Yapar | Yapamaz |
| --- | --- | --- |
| Sektör profili | Faaliyet tanımından profil ve NACE önerir, ne getirdiğini açıklar | Profili onaylamak, kategori silmek |
| Veri girişi | Belgeden alan okur, eksik bağlamı sorar, "neden bu kapsam?" açıklar | Kapsam kararını kesinleştirmek, eksik değere sayı atamak |
| Gösterge sözlüğü | Tanım taslağı ve veri sahibi önerir | Onaylamak, birim uydurmak |
| Karar ve aksiyon | Sapmayı anlatır, kök neden soruları listeler, görev taslağı yazar | Aksiyonu kapatmak, etki tahmin etmek |
| Green Kaizen | Öneriyi düzenler, kurum içindeki benzer önerileri bulur | Reddetmek, puanlamak |
| Regülasyon | Değişikliği kaynaklı özetler | Uygunluk hükmü, fiyat/tahsis tahmini |
| Tedarikçi | Talep metnini sadeleştirir, tamamlayıcı soru önerir | Kendi başına mesaj göndermek |
| Öğrenme | Göreve uygun dersi açar, yanlışın nedenini anlatır | Yetkinlik belgesi izlenimi |
| Fon haritası | "Uygun olabilir" çağrıları listeler | Hak kazanıldığını söylemek, tutar/tarih uydurmak |

## 6. Başarı ölçütleri

| Katman | Gösterge |
| --- | --- |
| Ürün | İlk doğru kayıt süresi, düzeltme sayısı, kanıtı tam kayıt oranı, uzmandan geri dönen kayıt oranı |
| Veri | Otomatik veri oranı, rapor hazırlama süresi, geçerli veri oranı |
| Verimlilik (hedef 1) | Profildeki yoğunluklar, atık/fire oranı, su yoğunluğu |
| Çalışan memnuniyeti (hedef 2) | Öneri sayısı ve uygulanma oranı, bağlılık skoru, kişi başı eğitim saati |
| Yönetişim | Hedef sahibi atanma oranı, karar kapısından geçen değişiklik oranı, aksiyon kapanış süresi |
| Tedarik | Katılan kritik tedarikçi oranı |
| Uyum | Açık paket çıktılarının düzeltmesiz, zamanında hazırlanması |
| Sektör kapsamı | Onaylı profil sayısı, `genel` profille başlayan kurum oranı |

Hedef değerler pilot başlangıcındaki ölçümle belirlenir.

## 7. Kabul koşulları (v1.1)

- [ ] Faaliyet çıktısı düşen dönemde yoğunluk göstergesi otomatik "verimlilik arttı" demez; fark ayrıştırması görünür.
- [ ] Sektöre özgü gösterge, payda, eşik veya kural kodda yoktur; yalnız sürümlü profilden okunur.
- [ ] Profil değişikliği geçmiş hesap ve raporları değiştirmez.
- [ ] Aynı kurumdaki iki tesis farklı profillerle çalışabilir; kurum toplamı doğru kalır.
- [ ] Aksiyon, etki ölçülmeden "tamamlandı" olamaz.
- [ ] Green Kaizen önerisi yönetici panosunda kişi bazlı sıralama olarak görünmez.
- [ ] Senaryo defterindeki fiyat veya tahsis envanter toplamını değiştiremez.
- [ ] Ürün düzeyi regülasyon sonucu Kapsam 1–2 toplamına eklenmez.
- [ ] Tedarikçi, gizlilik taahhüdünü görmeden veri gönderme ekranına ulaşamaz.
- [ ] Taslak düzenleme görev yaratmaz; uygulanamaz paket görev üretmez.
- [ ] Asistan yanıtı hiçbir modülde hesap motorunun sonucunu değiştirmez (altın sete eklenir).

## 8. Kaynak belgeler

KOZA Ürün ve Geliştirme Şartnamesi v1.0 (12 Ekim 2026); GreenSync Young Professionals Forum — ESG Fishbone: Solution Proposals ve ETS eki; sürdürülebilirlik sistem mimarisi ve karar akışı önerisi.
