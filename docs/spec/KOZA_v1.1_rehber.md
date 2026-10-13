# KOZA v1.1 — Forum Bulgularıyla Geliştirilmiş Ürün Yönü ve Yapay Zekâ Geliştirme Rehberi

13 Ekim 2026 · EU Projects

Bu belge, `KOZA_v1.1_gereklilikler.md` dosyasındaki gereklilik ekinin **uzun biçimidir** (gerekçe, kullanıcı tablosu, modül anlatımı, yol haritası ve açık kararlar). Kaynak dosya: `docs/kaynak/KOZA_v1.1_Urun_Yonu_ve_YZ_Gelistirme_Rehberi.docx`. Gereklilik kimlikleri ve kabul koşulları iki belgede aynıdır; çelişkide kısa ek (`KOZA_v1.1_gereklilikler.md`) geçerlidir.

## 1. Özet

Koza'nın ana mantığı değişmiyor: yeni başlayan çalışanı adım adım yönlendiren, veriyi kanıtıyla toplayan, hesabı denetlenebilir motorla yapan ve sonucu rapora bağlayan bir uygulama. Hesabı motor yapar; yapay zekâ açıklar ve yönlendirir.

Bu sürüm, GreenSync Young Professionals Forum'da (EMES grubu) ortaya çıkan ana sorunu Koza'nın çözdüğü probleme bağlıyor: "İşletmede sürdürülebilirlik odaklı bir sistem mimarisi yok." Forumun iki hedefi (verimlilik ve çalışan memnuniyeti) Koza'nın başarı ölçütlerine eklendi.

Bu sürümde eklenenler:

- **Sektör uyarlama katmanı:** çekirdek her sektörde aynı kalır; gösterge seti, yoğunluk paydası, öncelikli Kapsam 3 kategorileri ve dersler sürümlü sektör profilinden gelir.
- **Gösterge sözlüğü ve veri sözleşmesi:** her göstergenin tanımı, birimi, kaynağı, sahibi ve güncelleme sıklığı.
- **Sapma → aksiyon döngüsü:** KPI sapmasından düzeltici faaliyete ve etki doğrulamasına giden yönlendirilmiş iş akışı.
- **Saha katılımı (Green Kaizen):** sahadan öneri toplama; çalışan memnuniyeti hedefini doğrudan besler.
- **Regülasyon uyum paketleri:** CBAM, ulusal ETS/MRV, TSRS gibi yükümlülükler yalnız uygulanabilir olduğunda açılan, mevcut Kapsam 1–2 akışlarının üzerine kurulu paketler.
- **Rol bazlı öğrenme yolları:** yönetici, uzman/mühendis, saha çalışanı.
- **Tedarikçi veri programı:** kritik tedarikçilerle başlayan, güven odaklı veri talebi.

Hiçbiri Koza'yı genel bir ESG platformuna çevirmez. Her ek, mevcut "görev → veri → hesap → kontrol → rapor" zincirine bağlanır.

## 2. Forum bulgularının Koza'ya eşlenmesi

Forumun beş çözüm ekseni, Koza'da zaten var olan sekmelere ve şartname bölümlerine bağlanır. Yeni modül yalnız mevcut yapının karşılamadığı yerde açılır.

| Forum ekseni | Kök neden (forum) | Koza'daki karşılığı | Bu sürümdeki ek |
| --- | --- | --- | --- |
| 1. Yönetişim | Sahiplik, hedef, öncelik yok | Roller ve yetki (§04), dönem kapanışı (§21), hedefler (§22) | Hedef kartı + RACI, yatırım talebine "karar kapısı", gölge karbon fiyatı senaryosu |
| 2. Veri ve dijital altyapı | Dağınık, güvenilmez veri | Rehberli veri girişi (§11), hesap motoru (§18), entegrasyon (§27) | Gösterge sözlüğü, kritik 10–15 gösterge paketi, sektör profiline göre yoğunluk panosu (ör. kWh/ton, kWh/m², kg CO₂e/çalışan), MRV uyumlu izleme planı |
| 3. Tedarik zinciri | Tedarikçi verisi yok, güven sorunu | Kapsam 3 veri talebi (§14), görev ve tedarikçi talepleri (§21) | Segmentasyon (kritik %20), gizlilik taahhüdü, öz değerlendirme, regülasyon kapsamındaki ürünler için gömülü emisyon talebi |
| 4. Sosyal | Farkındalık düşük, operatör sürece katılmıyor | Sürdürülebilirlik 101 (§07), karbon dışı kapsam (§23) | Rol bazlı öğrenme yolları, Green Kaizen öneri modülü, sürdürülebilirlik elçisi rolü |
| 5. Çevre ve dış ekosistem | Regülasyon, finansman, maliyet | Gündem ve takvim (§09), kaynak izleme (§19) | CBAM / TSRS / İklim Kanunu / TR ETS izleme listesi, fon haritası (ön değerlendirme), sektörel ortak veri şablonu |

Havva Dönmez'in mimari önerisi Koza'nın iç yapısına doğrudan oturur: strateji ve sahiplik → süreç mimarisi → veri yönetişimi → entegrasyon → ortak ESG veri katmanı → karar ve aksiyon motoru. Koza bu altı katmanın "kullanıcı yüzü" olur; ilk beşi zaten şartnamede var, altıncısı (karar ve aksiyon motoru) bu sürümde eklenir.

Enes Koç'un TR ETS önerisi karbonu raporlama metriğinden finansal kaleme taşır. Koza bunu ETS kapsamındaki kurumlar için açılan bir paket olarak ve kendi ilkeleriyle alır: MRV uyumlu veri ve izleme planı üretim verisidir; gölge karbon fiyatı, ücretsiz tahsis ve EPİAŞ senaryoları ise senaryo defterinde tutulur, envanteri değiştirmez (§22 ile uyumlu).

## 3. Genişletilmiş kullanıcılar ve roller

Birincil kullanıcı değişmez: konuya yeni başlayan yeşil yakalı çalışan. Forum bulguları üç yeni rol ekler; her biri §04'teki yetki modeline (sunucu tarafı kontrol, görevlerin ayrılığı) tabidir.

| Rol | "Benim işim…" | Ne görür / ne yapar | Yeni mi? |
| --- | --- | --- | --- |
| Yeni başlayan çalışan | "İlk faturayı doğru gireyim ve ne yaptığımı anlayayım." | Görev listesi, rehberli veri girişi, bağlamsal dersler | Mevcut |
| Veri sağlayıcı (birim / tedarikçi) | "İstenen bilgiyi kısa sürede teslim edeyim." | Yalnız kendi talebi, örnek belge, eksik listesi | Mevcut |
| Uzman onaylayıcı | "Varsayımları ve hesapları kontrol edeyim." | Yöntem, faktör, kanıt; onay / geri gönderme | Mevcut |
| Yönetici / sponsor | "Eksikleri, riskleri ve dönem kapanışını göreyim." | Hedef kartı, RACI, yönetim panosu, iki hedefin durumu | Genişletildi |
| Operatör | "Çalıştığım alandaki enerji, atık ve fireden haberim olsun, fikrimi söyleyeyim." | Mobil sade görünüm: alan/hat hedefi, Green Kaizen önerisi, kısa saha dersleri | Yeni |
| Sürdürülebilirlik elçisi | "Birimimde görevleri takip edip arkadaşlarıma yardım edeyim." | Birim görevleri, öneri ön değerlendirmesi, ders önerme | Yeni |
| Finans / karbon masası | "Karbonun maliyet ve yatırım etkisini göreyim." | Senaryo defteri, gölge karbon fiyatı, CBAM/ETS maruziyet özeti (salt okunur envanter) | Yeni |

Operatör verisi kişisel performans değerlendirmesine dönüştürülmez; öneriler ve katılım birim düzeyinde toplulaştırılır (§25 mahremiyet).

## 4. Yeni ve genişletilen modüller

Yedi modül eklenir; ilki (SEK) ürünü tüm sektörlere uyarlayan katmandır. Her biri mevcut veri modelini, kanıt/onay altyapısını ve hesap motorunu kullanır; kendi hesabını yapmaz.

### 4.1 Sektör uyarlama katmanı (SEK)

Çekirdek (Kapsam 1–2, Kapsam 3'ün 15 kategorisi, hesap motoru, kanıt ve onay akışı) her sektörde aynıdır. Sektöre göre değişen her şey kod değil, sürümlü ve uzman onaylı sektör profili verisidir.

- **SEK-01:** Kurum kurulumunda (ONB-01) faaliyet alanı NACE koduyla alınır; sistem profil önerir, kullanıcı onaylar. Bir kurumun birden fazla faaliyet alanı ve tesis bazında farklı profili olabilir.
- **SEK-02:** Profil şunları taşır: sektöre özgü göstergeler, yoğunluk paydaları, kaynak envanteri soruları (ONB-03), öncelikli Kapsam 3 kategorileri, ders yolları, örnek belgeler ve uygulanabilir olabilecek regülasyon paketleri.
- **SEK-03:** Profil yalnız önerir ve önceliklendirir; hiçbir kategoriyi otomatik silmez, uygulanabilirlik kararını vermez.
- **SEK-04:** Profil sürümü değiştiğinde geçmiş hesaplar ve raporlar değişmez; etkilenen kayıt listesi ve fark önizlemesi oluşur.
- **SEK-05:** Uygun profil yoksa "genel profil" ile başlanır; eksik sektör talebi içerik ekibine görev olarak gider.

| Sektör profili (örnek) | Yoğunluk paydası | Öncelikli Kapsam 3 | Sektöre özgü gösterge örneği |
| --- | --- | --- | --- |
| Ağır sanayi (metal, çimento, cam) | ton ürün | 1, 3, 4 | Proses emisyonu, hurda oranı |
| Genel imalat (makine, plastik, elektronik) | adet veya ton ürün | 1, 4, 11, 12 | Fire oranı, makine başı enerji |
| Gıda ve içecek | ton ürün, m³ su | 1, 4, 5, 12 | Soğutucu kaçağı, gıda kaybı |
| Tekstil ve hazır giyim | kg kumaş, adet | 1, 4, 5 | Su ve kimyasal tüketimi |
| Lojistik ve taşımacılık | ton-km | 1, 3, 4 | Filo yakıt verimi |
| Perakende | m² satış alanı | 1, 4, 9, 12 | Ambalaj, soğutma |
| Hizmet, ofis ve yazılım | çalışan, m² | 1, 6, 7 | Veri merkezi / bulut tüketimi |

Tablo yalnız başlangıç örneğidir; profiller alan uzmanı onayıyla yüklenir. TSRS gibi ölçeğe bağlı yükümlülükler sektörden bağımsız olarak §08 uygulanabilirlik değerlendirmesiyle belirlenir.

### 4.2 Gösterge sözlüğü ve veri sözleşmesi (GÖS)

- **GÖS-01:** Her gösterge için tanım, birim, kaynak sistem, veri sahibi, güncelleme sıklığı, kalite kuralı ve erişim yetkisi tutulur.
- **GÖS-02:** Çekirdek paket (tüm sektörler): enerji (elektrik, yakıtlar), Kapsam 1–2 emisyon, su, atık, iş kazası, kişi başı eğitim saati ve faaliyet çıktısı. Sektöre özgü göstergeler SEK profilinden eklenir.
- **GÖS-03:** Yoğunluk göstergeleri (ör. kWh/ton, kWh/m², kg CO₂e/çalışan) profildeki payda tanımı ve dönemi olmadan hesaplanmaz.
- **GÖS-04:** Veri sözleşmesi testleri (kaynak, birim, zaman, tutarlılık); uygunsuz kayıt düzeltme kuyruğuna gider.

### 4.3 Karar kapısı ve aksiyon motoru (AKS)

- **AKS-01 Başlat:** Tetikleyici türleri: KPI sapması, yeni yatırım, süreç veya hat değişikliği, çalışan önerisi, mevzuat gereği.
- **AKS-02 Ön değerlendir:** Enerji, su, karbon, atık/fire, İSG, ergonomi, iş yükü ve maliyet etkisi alanları doldurulur; bilinmeyen alan "bilinmiyor" kalır.
- **AKS-03 Seçenek ve pilot:** Alternatifler ekonomik, çevresel ve çalışan etkisiyle yan yana; pilot sorumlusu ve süresi atanır.
- **AKS-04 Ölç ve karar ver:** Baz dönemle karşılaştırma (profildeki yoğunluk göstergeleri, atık/fire, öneri uygulama oranı, memnuniyet skoru). İki hedef de eşiği karşılıyorsa standardize et; değilse kök neden ve yeniden tasarım.
- **AKS-05:** Yatırım talebinde "enerji/emisyon etkisi" alanı zorunlu; gölge karbon fiyatı varsa senaryo olarak eklenir.

### 4.4 Green Kaizen (KZN)

- **KZN-01:** Saha çalışanı mobilde 3 alanlı öneri girer: ne gördüm, ne öneriyorum, hangi alan/hat/ekipman. Fotoğraf isteğe bağlı.
- **KZN-02:** Elçi ön değerlendirir; uygun öneri AKS-01'e tetikleyici olarak geçer.
- **KZN-03:** Uygulanan öneri, ölçülen etkisiyle birlikte öneri sahibine geri bildirilir; tanıma görünür.

### 4.5 Regülasyon uyum paketleri (REG)

- **REG-01:** Her yükümlülük (CBAM, ulusal ETS/MRV, TSRS, AB müşterilerinin tedarik zinciri talepleri vb.) ayrı ve sürümlü bir pakettir; kurum profiline göre §08 uygulanabilirlik değerlendirmesiyle açılır.
- **REG-02:** Tesis ETS kapsamındaysa Kapsam 1 sınırı ulusal MRV kılavuzuna eşlenir; izleme planı sürümlü ve denetlenebilir üretilir.
- **REG-03:** Ürün düzeyi yükümlülükler (ör. CBAM gömülü emisyon) ürün bağlamında (§17) hesaplanır; kurumsal toplama eklenmez.
- **REG-04:** Yurt içinde ödenen karbon maliyetinin kanıtı, ihracat müşterisine verilecek biçimde hazırlanır (ilgili paket açıksa).
- **REG-05:** Ücretsiz tahsis, açık/fazla ve alım-satım senaryoları yalnız senaryo defterinde çalışır.
- **REG-06:** Eşikler, tarihler ve benchmark değerleri kod içine yazılmaz; §19 kaynak izleme ile sürümlü kural olarak gelir.

### 4.6 Tedarikçi veri programı (TDR)

- **TDR-01:** Tedarikçiler harcama ve emisyon yoğunluğuna göre sıralanır; ilk dalga kritik %20.
- **TDR-02:** Kısa standart talep şablonu + gizlilik ve "yalnız toplulaştırılmış kullanım" taahhüdü talebin ilk ekranında görünür.
- **TDR-03:** Risk temelli denetim: önce öz değerlendirme; yüksek riskte saha ziyareti görevi; ceza yerine düzeltici plan.
- **TDR-04:** KOBİ tedarikçiye kısa MRV/karbon muhasebesi dersi ve örnek dolu şablon açılır.

### 4.7 Rol bazlı öğrenme yolları (ÖĞR)

- **ÖĞR-01:** Yönetici: strateji ve regülasyon (kurum için açık paketler).
- **ÖĞR-02:** Mühendis/uzman: karbon ayak izi, yaşam döngüsü, veri kalitesi, MRV.
- **ÖĞR-03:** Saha çalışanı: kendi alanında enerji, atık/fire ve güvenlik; 3 dakikayı geçmeyen mobil dersler. Örnekler sektör profilinden gelir.
- **ÖĞR-04:** Her ders bir gerçek göreve bağlanır (§07 kuralı korunur); eğitim saati GÖS paketine toplu olarak yazılır.

## 5. Yapay zekânın yönlendirici rolü ve sınırları

Yapay zekâ Koza'da "bir sonraki doğru adımı" bulan rehberdir: anlar, sorar, kaynak gösterir, görev önerir. Sayıyı hesap motoru, kararı yetkili insan verir (§24 AI-01–06 aynen geçerli).

| Modül | Yapay zekâ ne yapar | Yapay zekâ ne yapamaz |
| --- | --- | --- |
| Sektör profili | Faaliyet tanımından uygun profili ve NACE kodunu önerir, profilin ne getirdiğini açıklar | Profili onaylamak, kategori silmek |
| Rehberli veri girişi | Belgeden alanları okur, eksik bağlamı soru olarak sorar, "neden bu kapsam?" açıklar | Kapsam/kategori kararını kesinleştirmek, eksik değere sayı atamak |
| Gösterge sözlüğü | Tanım taslağı ve olası veri sahibi birimi önerir | Göstergeyi onaylamak, birim uydurmak |
| Karar ve aksiyon | Sapmayı sade dille anlatır, olası kök neden sorularını listeler, görev taslağı yazar | Aksiyonu kapatmak, etki sayısı tahmin etmek |
| Green Kaizen | Öneriyi düzenler, benzer geçmiş önerileri (aynı kurum içinde) bulur | Öneriyi reddetmek veya puanlamak |
| Regülasyon paketleri | Mevzuat değişikliğini kaynaklı özetler, kurum için ne değiştiğini açıklar | Uygunluk hükmü vermek, karbon fiyatı veya tahsis miktarı tahmin etmek |
| Tedarikçi programı | Talep metnini sadeleştirir, eksik yanıta tamamlayıcı soru önerir | Tedarikçiye kendi başına mesaj göndermek |
| Öğrenme | Kullanıcının o anki görevine uygun kısa dersi açar, yanlış cevabın nedenini anlatır | Yetkinlik belgesi izlenimi vermek |
| Fon haritası | Kurum profiline göre "uygun olabilir" çağrıları listeler | Hak kazanıldığını söylemek, tutar/tarih uydurmak |

Yanıt biçimi her yerde aynıdır: 2–3 cümle açıklama → dayanak kaynak ve sürüm → kurum için koşul → belirsizlik → önerilen sonraki eylem. Kaynak yoksa: "Bu bilgi için doğrulanmış kaynak bulamadım."

## 6. Aşamalı yol haritası

Forumun 0–6 / 6–18 / 18–36 ay yol haritası, şartnamenin "ilk uçtan uca iz" kuralıyla birleştirildi: önce tek bir doğru veri-hesap-rapor zinciri, sonra iki hedefi besleyen döngü, en son entegrasyon ve dış uyum.

| Faz | İçerik | Kapı |
| --- | --- | --- |
| Faz 1 · Doğru zincir | Kurum kurulumu → doğal gaz → hesap → inceleme → rapor; elektrik; SEK + GÖS (Dilim 0–4) | **Pilot kapısı:** kurumlar arası erişim testi + yeni kullanıcının yardımsız ilk taslağı |
| Faz 2 · İki hedefi besleyen döngü | KZN + ÖĞR, AKS (Dilim 5–6) | — |
| Faz 3 · Entegrasyon ve dış uyum | TDR + Kapsam 3, REG paketleri + senaryo defteri (Dilim 7–8) | **Ölçekleme kapısı:** iki hedefin eşikleri + uzman onaylı altın set |

Bir sonraki faza yalnız kapı koşulları sağlandığında geçilir; süreler pilot kapasitesine göre güncellenir ve teslim taahhüdü değildir (§30). Dilim tanımları `GELISTIRME-KURALLARI.md` "Dilim sırası" tablosundadır.

## 7. Başarı ölçütleri ve yeni kabul koşulları

Mevcut ürün ölçütleri korunur; forumun iki hedefi üzerine eklenir. Hedef değerler pilot başlangıcındaki ölçümle belirlenir, önceden vaat edilmez.

| Katman | Gösterge | Kaynak |
| --- | --- | --- |
| Ürün (mevcut) | İlk doğru kayıt süresi, düzeltme sayısı, kanıtı tam kayıt oranı, uzmandan geri dönen kayıt oranı | Şartname §02 |
| Veri | Otomatik toplanan veri oranı, rapor hazırlama süresi, geçerli veri oranı | Forum, Havva Dönmez |
| Verimlilik (hedef 1) | Sektör profilindeki yoğunluk göstergeleri (ör. kWh/ton, kWh/m²), atık/fire oranı, su yoğunluğu | Forum |
| Çalışan memnuniyeti (hedef 2) | Öneri sayısı ve uygulanma oranı, bağlılık skoru, kişi başı eğitim saati | Forum |
| Yönetişim | Hedef sahibi atanma oranı, karar kapısından geçen değişiklik oranı, aksiyon kapanış süresi | Havva Dönmez |
| Tedarik zinciri | Katılan kritik tedarikçi oranı | Forum |
| Uyum hazırlığı | Açık regülasyon paketlerinin çıktılarının düzeltmesiz zamanında hazırlanması | Forum, Enes Koç |
| Sektör kapsamı | Onaylı sektör profili sayısı, "genel profil"le başlayan kurum oranı | Bu sürüm |

### Yeni kabul koşulları

- [ ] Yoğunluk göstergesi, faaliyet çıktısı düştüğü dönemde "verimlilik arttı" sonucu üretmez; fark ayrıştırması gösterilir.
- [ ] Sektöre özgü gösterge, payda, eşik veya kural kod içinde bulunmaz; yalnız sürümlü profil verisinden okunur.
- [ ] Profil değişikliği geçmiş hesap ve raporları değiştirmez.
- [ ] Aynı kurumdaki iki tesis farklı profillerle çalışabilir; kurum toplamı doğru kalır.
- [ ] Bir aksiyon, etki ölçülmeden "tamamlandı" durumuna geçemez.
- [ ] Green Kaizen önerisi yönetici panosunda kişi bazlı sıralama olarak görünmez.
- [ ] Senaryo defterindeki karbon fiyatı veya tahsis sayısı envanter toplamını değiştiremez.
- [ ] Ürün düzeyi regülasyon sonucu (ör. CBAM gömülü emisyon) kurumsal Kapsam 1–2 toplamına eklenmez.
- [ ] Tedarikçi, gizlilik taahhüdünü görmeden veri gönderme ekranına ulaşamaz.
- [ ] Taslak düzenleme yürürlükteymiş gibi görev yaratmaz; uygulanamaz paket kurumda görev üretmez.
- [ ] Yapay zekâ yanıtı hiçbir modülde hesap motorunun sonucunu değiştirmez (altın test setine eklenir).

## 8. Uygulamayı geliştirecek yapay zekâya güncellenmiş talimat

Aşağıdaki metin şartnamenin §31'ine eklenir. geliştirme ortamı ile geliştirmede aynı kurallar, depo kökündeki `GELISTIRME-KURALLARI.md` dosyasında geliştirici iş akışı şemasıyla birlikte yer alır.

```
# KOZA — Geliştirme talimatı (v1.1 eki)

Rolün: Koza'yı, KOZA Ürün ve Geliştirme Şartnamesi v1.0 ve bu v1.1 ekine göre geliştiren yazılım ekibisin.

Değişmeyen çekirdek:
- Birincil kullanıcı konuya yeni başlayan çalışandır. Ekranlar "Ne yapmak istiyorsun?" ve "Sonraki adım" etrafında kurulur.
- Hesabı deterministik, sürümlü hesap motoru yapar. Yapay zekâ açıklar, sorar, kaynak gösterir, görev önerir; sayı üretmez, onaylamaz, yayımlamaz, dışarıya mesaj göndermez.
- Boş, sıfır, bilinmeyen, uygulanamaz ve tahmini durumları her katmanda ayır.

Sektörden bağımsızlık:
- Çekirdek her sektörde aynıdır. Sektöre özgü gösterge, yoğunluk paydası, kaynak sorusu, öncelikli Kapsam 3 kategorisi, ders ve regülasyon paketi sürümlü sektör profili verisidir (SEK). Koda sektör adıyla dallanma (if sector == ...) yazma.
- Kurumun iki hedefi vardır: verimlilik (profildeki yoğunluk göstergeleri, atık/fire) ve çalışan memnuniyeti (öneri uygulama oranı, bağlılık). Her modül bu hedeflerden en az birine ölçülebilir katkı sağlar.

Uygulama sırası:
1. Şartname §31'deki ilk uçtan uca iz: kurum kurulumu → doğal gaz kaydı → hesap → inceleme → rapor. Ardından elektrik (konum ve piyasa bazlı).
2. SEK + GÖS: sektör profili şeması, "genel profil" ve iki örnek profil; çekirdek gösterge paketi ve yoğunluk panosu.
3. KZN + ÖĞR: saha mobil görünümü, Green Kaizen, rol bazlı ders yolları.
4. AKS: sapma → görev → kök neden → düzeltici faaliyet → etki doğrulaması; yatırım talebi karar kapısı.
5. TDR + Kapsam 3: profilin öncelikli kategorileri.
6. REG: uygulanabilirlik değerlendirmesiyle açılan paketler (MRV izleme planı, ürün düzeyi gömülü emisyon), senaryo defteri.

Kurallar:
- Her yeni modül mevcut kanıt/onay, yetki ve tenant izolasyonunu kullanır; ayrı hesap yolu açmaz.
- Regülasyon eşik, tarih, benchmark ve fiyatlarını koda yazma; kaynak izleme (§19) üzerinden sürümlü kural olarak al. Kaynak doğrulanmadıysa "inceleme gerekli" göster.
- Senaryo defteri (karbon fiyatı, tahsis, alım-satım) envanteri değiştiremez.
- Saha ve öğrenme verisini kişisel performans sıralamasına çevirme; birim düzeyinde toplulaştır.
- Doğrulanmamış iş ortağı, fon, fiyat veya tasarruf yüzdesi gösterme.

Teslim biçimi (her dilimde):
- Çalışan değişiklik, etkilenen dosyalar, göçler, test kanıtı.
- Karşılanan gereklilik kimlikleri (örn. SEK-03, AKS-04) ve kabul testleri.
- Desteklenen yöntemler ve açık eksikler. Sessiz varsayım yapma; belirsizliği karar kaydına yaz.
```

## 9. Açık kararlar ve doğrulanacak konular

Bunlar geliştirme başlamadan karar kaydına (§32) alınır; yapay zekâ bu noktalarda varsayım yapmaz. Karar kaydındaki karşılıkları parantezde.

- [ ] Pilotun hangi sektör profilleriyle başlayacağı ve ilk profillerin alan uzmanı tarafından onaylanması. (K-02)
- [ ] Sektör profili sınıflandırması: NACE düzeyi (bölüm/grup) ve çok faaliyetli kurumlarda profil birleştirme kuralı. (K-03)
- [ ] Ulusal ETS'nin güncel durumu: ikincil mevzuat, pilot dönem, MRV kılavuzu ve ücretsiz tahsis kuralları resmî kaynaktan doğrulanacak. (K-06)
- [ ] CBAM'de menşe ülkede ödenen karbon fiyatının düşülmesi için gereken kanıt formatı AB'nin güncel uygulama mevzuatından doğrulanacak. (K-07)
- [ ] Sektör dernekleri, OSB'ler ve üniversitelerle ortak veri şablonu ve tedarikçi eğitimi: iş birliği kazanılmış kabul edilmez; teklif ve onay süreci tanımlanacak. (K-14)
- [ ] Green Kaizen ve saha çalışanı verisi için KVKK değerlendirmesi ve çalışan temsilcisi görüşü alınacak. (K-09)
- [ ] Bağlılık/memnuniyet skorunun ölçüm yöntemi (anket, sıklık, anonimlik) seçilecek. (K-10)
- [ ] Gölge karbon fiyatı değerini kimin belirleyeceği ve ne sıklıkla güncelleneceği netleştirilecek. (K-11)
- [ ] Fon haritası kaynakları (Horizon Europe, LIFE, IPA, TÜBİTAK, KOSGEB, kalkınma ajansları, yeşil krediler) yalnız resmî çağrı metinleriyle beslenecek. (K-15)

Kaynak belgeler: KOZA Ürün ve Geliştirme Şartnamesi v1.0 (12 Ekim 2026); GreenSync Young Professionals Forum — ESG Fishbone: Solution Proposals (EMES grubu) ve Enes Koç'un TR ETS eki; Havva Dönmez — sürdürülebilirlik sistem mimarisi ve karar akışı.
