> Kaynak: KOZA Ürün ve Geliştirme Şartnamesi, Sürüm 1.0 (12 Ekim 2026). Pages belgesinden metin ve tablolar otomatik aktarılmıştır; görseller/diyagramlar bu dosyada yer almaz.

# KOZA

Öğrenme, gelişme ve dönüşüm için destekleyici bir alan.

## Proje özeti

Koza, sürdürülebilirlik görevine yeni başlayan çalışanların ne yapacaklarını öğrenirken kurumsal verilerini doğru toplamalarını, hesaplamalarını ve raporlamaya hazırlamalarını sağlayan rehberli bir uygulamadır. Ürün, öğrenme içeriğini günlük iş akışına ve kaynakları izlenebilen veri altyapısına bağlar.

Sorun: Yeni çalışan; hangi verinin istendiğini, nereden alınacağını, hangi birimle girileceğini ve sonucun hangi raporda kullanılacağını çoğu zaman bilmiyor. Dağınık dosyalar, değişen kaynaklar ve açıklanamayan hesaplar kurum içinde tekrar iş yaratıyor.

Hedef kullanıcı ve müşteri: Birincil kullanıcı deneyimi sınırlı yeşil yakalı; satın alan taraf sürdürülebilirlik yöneticisi veya işletme. İlk odak Türkiye’de üretim yapan işletmeler; sonraki genişleme danışmanlık şirketleri, hizmet işletmeleri ve eğitim kurumları.

Değer önerisi: Kullanıcıya anlaşılır bir sonraki adım; kuruma kanıtı, yöntemi, kaynağı ve onayı izlenebilen veri. Başarı; ilk doğru kayda ulaşma süresi, düzeltme oranı, kanıt tamlığı ve dönem kapanış süresiyle ölçülür. Sayısal kazanım vaatleri pilot sonuçlarıyla belirlenecektir.

Nasıl çalışır: Kurumu tanı → görev planı oluştur → kısa açıklamayla veri topla → uygun yöntemle hesapla → sonucu açıkla → uzman kontrolüne gönder → rapora bağla. Kapsam 1, 2 ve Kapsam 3’ün 15 kategorisi ortak envanterde; ürün yaşam döngüsü çalışmaları ilişkili fakat ayrı hesap bağlamında yönetilir.

Gelir modeli: Yıllık veya aylık kurumsal abonelik; tesis sayısı, aktif kullanıcı, entegrasyon ve işlem hacmine göre paketleme. Ek gelirler veri aktarımı ve kurulum, kurum eğitimleri, tedarikçi portalı ve gelişmiş entegrasyonlardır. Temel öğrenme alanı ücretsiz veya deneme erişimli olabilir. Kesin fiyatlandırma pilotta doğrulanacaktır.

Ürün farkı: Öğretici görevler, güncel kaynak kontrolü, sürümlü hesaplama ve onaylı rapor hazırlığı aynı iş akışındadır. Hesabı yapay zekâ değil denetlenebilir hesap motoru yapar; yapay zekâ açıklar ve yönlendirir.

Ürün ve geliştirme şartnamesi • Sürüm 1.0 • 12 Ekim 2026

## 01 Belgenin kullanımı ve karar düzeyi

Bu belge ürün sahibinin, tasarımcının, sürdürülebilirlik uzmanının ve uygulamayı geliştirecek yapay zekânın ortak çalışma sözleşmesidir. Ekranların görünümünden önce kullanıcı problemi, veri doğruluğu ve kabul koşulları uygulanır. Belge çalışan bir uygulamanın teslim edildiği anlamına gelmez.

### Gereklilik dili

Zorunlu: İlk ilgili sürümde karşılanmadan tamamlandı denemez. Önerilen: Gerekçeli teknik kararla değiştirilebilir. Sonraki aşama: Mimari hazır tutulur; çalışıyormuş gibi gösterilmez. Kaynaklardan türetilen açıklamalar [K01] biçiminde kaynak numarası taşır. Kaynaksız tasarım maddeleri bu ürün için önerilen gerekliliklerdir.

### Bölüm haritası

| Katman | Bölümler | Beklenen çıktı |
| --- | --- | --- |
| Ürün ve deneyim | 02–06 | İş modeli, roller, navigasyon, kurulum |
| Bilgi ve öğrenme | 07–10 | 101, protokoller, gündem, sözlük |
| Veri ve hesap | 11–19 | Giriş, kapsamlar, sınırlar, faktörler, güncellemeler |
| İşletim ve raporlama | 20–23 | Veri modeli, iş akışı, rapor, ESG kapsamı |
| Güven ve mühendislik | 24–28 | Yapay zekâ, güvenlik, mimari, API, ekran sözleşmeleri |
| Doğrulama ve teslim | 29–34 | Testler, yol haritası, yapay zekâ talimatı, kararlar, kaynaklar |

### Temel sınırlar

Türkiye başlangıç pazarı ve Türkçe başlangıç dilidir. Çoklu ülke ve İngilizce desteği veri modelinde hazırlanır. Standartların güncel yayınları, yürürlük tarihleri ve ülkeye özgü yükümlülükler üretim sürümü öncesinde yeniden doğrulanır. Bir yazılımın kullanılması tek başına GRI veya TSRS uyum beyanı, bağımsız güvence ya da resmî sertifika sağlamaz.

Koza ürün adı önerisidir. Ticari kullanımdan önce marka, alan adı ve benzer ürün adı incelemesi yapılır. Kurumsal müşteri, fiyat, tasarruf yüzdesi, ortaklık veya devlet desteği kazanılmış kabul edilmez.

### Belge değişiklik yönetimi

Her revizyonda değişiklik nedeni, etkilenen gereklilikler ve kabul testleri kaydedilir. Alan uzmanı hesap ve standart kurallarını; ürün sahibi deneyim ve öncelikleri; teknik sorumlu uygulama ve güvenliği onaylar. Çelişen gereklilikler karar kaydına alınır; yapay zekâ sessiz varsayım yapmaz.

## 02 Ürün ilkeleri ve hedef kullanıcı

Birincil kullanıcı konuya yeni başlamıştır. Kapsam, faktör, GWP, önemlilik veya sistem sınırı terimlerini bilmesi beklenmez. Arayüz, kullanıcının uzmanlık açığını güvenilir iş akışlarıyla karşılamalıdır.

### Değiştirilemez deneyim kuralları

Kullanıcıdan bilmediği teknik sınıflandırmayı seçmesi istenmez. Faaliyeti, belgeyi ve iş ilişkisini anlatması istenir; önerinin gerekçesi gösterilir.

Her adımda neden istendiği, nereden bulunacağı, örneği ve “Bilmiyorum” yolu bulunur. Bilgi yoksa eksik durum saklanır; sıfır atanmaz.

Açıklama önce iki veya üç kısa cümledir. Ayrıntı, yöntem ve kaynak isteğe bağlı açılır. Yanlış anlaşılabilecek sonuçlarda kritik koşul gizlenmez.

Öğrenme ve çalışma bağlantılıdır. Bir dersin sonunda gerçek veri görevi; veri görevinde ilgili kısa ders açılır. Öğrenme denemeleri kurumsal envantere karışmaz.

Hesaplanan, tahmini, incelenmiş ve onaylı sonuçlar farklı statülerle gösterilir. Renk tek durum göstergesi olamaz.

Asistan kullanıcı adına kayıt silemez, dönemi kilitleyemez, rapor yayımlayamaz veya dış kişiye mesaj gönderemez; ilgili yetkili işlem açık eylem gerektirir.

GRI tamamlama oranı sürdürülebilirlik başarısı puanı değildir. Eğitim başarısı da mesleki yetkinlik belgesi olarak sunulmaz.

### Kullanıcıların işleri

Yeni çalışan “İlk faturayı doğru gireyim ve ne yaptığımı anlayayım” der. Veri sağlayıcı “Benden istenen bilgiyi kısa sürede teslim edeyim” der. Uzman “Varsayımları ve hesapları kontrol edeyim” der. Yönetici “Eksikleri, riskleri ve dönem kapanışını göreyim” der. Bu kullanıcılar aynı ayrıntı düzeyine zorlanmaz.

### Başarı göstergeleri

İlk doğru kayıt süresi, kullanıcı düzeltme sayısı, kanıtı tam kayıt oranı, kategori bazında veri kapsamı, yanlış kaynaklı yanıt oranı ve uzman incelemesinde geri dönen kayıt oranı izlenir. Pilot başlangıcında mevcut süreç ölçülür; pilot sonunda aynı tanımlarla karşılaştırılır. Başarı hedefleri ürün hedefidir; doğrulanmış pazar sonucu değildir.

## 03 İş modeli ve ticari işletim

### Paket önerisi

| Paket | Hedef | İçerik |
| --- | --- | --- |
| Öğrenme | Bireysel başlangıç | 101, sözlük, örnek veri ortamı, sınırlı kaynaklı soru |
| Ekip | Tek kuruluş | Rehberli kayıt, emisyon envanteri, onay, temel rapor |
| Kurumsal | Çok tesisli yapı | İleri roller, SSO, entegrasyon, tedarikçi akışı, sözleşmeli destek |
| Danışman | Birden çok müşteri | İzole müşteri çalışma alanları ve yetkilendirilmiş geçiş |

Fiyatın ana belirleyicisi işletme ve tesis sayısı olmalıdır; kullanıcı, depolama ve hesap/yapay zekâ kullanım limitleri açıkça belirtilir. Kullanıcı limitine ulaşıldığında veri dışa aktarımı ve mevcut kayda erişim engellenmez. Deneme sonunda veri silme ve dışa aktarma seçenekleri sunulur.

### Gelir ve maliyet

Abonelik tekrar eden ana gelirdir. Kurulum, tarihsel veri temizliği, eğitim ve özel entegrasyon proje geliridir. Faktör lisansları, uzman incelemesi, barındırma, belge işleme, yapay zekâ kullanımı ve destek maliyet merkezleri ayrı ölçülür. Her müşteri için brüt katkı; gelirden doğrudan hizmet maliyetleri çıkarılarak takip edilir.

Teşvikler, iş modelinin gerçekleşmiş geliri olarak yazılmaz. Ürün olası destekleri keşfetmeye yardımcı olur; başvuru uygunluğu resmî çağrı metni, kurum profili ve uzman kontrolüyle belirlenir. İşe yerleştirme garantisi veya sürdürülebilirlik istihdamı artışı için kanıtsız oran verilmez.

### Satış ve pilot tasarımı

İlk pilotta farklı veri olgunluğunda az sayıda üretim işletmesi seçilir. Pilot kapsamı; bir raporlama dönemi, önceden belirlenmiş faaliyetler ve müşteri tarafından atanmış bir uzman onaylayıcıdır. Kullanıcı görüşmesi, görev gözlemi ve hata analizi birlikte yapılır. Ücretli dönüşüm, ancak veri kalitesi ve kullanıcı faydası gösterildikten sonra değerlendirilir.

### Bağımsızlık

Sponsorlu gündem veya eğitim varsa açıkça etiketlenir. Sponsor, emisyon faktörü sıralamasını veya uygunluk sonucunu değiştiremez. Ticari teşvikler kullanıcıya daha düşük emisyon sonucu üreten yöntemi seçtirmek için kullanılamaz. Kurum verisi varsayılan olarak model eğitimi ya da üçüncü taraf pazarlaması için kullanılamaz.

## 04 Roller ve yetki modeli

Yetkilendirme kuruluş, tesis, veri alanı ve işlem düzeyinde uygulanır. Arayüzde gizlemek yeterli değildir; sunucu her istekte yetki kontrolü yapar. Kullanıcının rolü oturum değişiminde ve yetki iptalinde yeniden değerlendirilir.

| Rol | Yapabilir | Sınır |
| --- | --- | --- |
| Kurum yöneticisi | Kurulum, üyelik, rol, dönem ve politika yönetimi | Uzmanlık yetkisi ayrıca atanmadıkça teknik onay veremez |
| Veri giren | Yetkili alanda taslak oluşturur, kanıt ekler | Onaylı kayıt ve hesap yöntemini değiştiremez |
| Veri sorumlusu | Departman verisini toplar, eksikleri giderir | Başka tesis veya departman verisine otomatik erişemez |
| Uzman kontrolör | Sınır, yöntem, faktör ve kanıtı inceler | Dönem kilidini tek başına kaldırmaz |
| Onaylayan | İncelenmiş sonuçları onaylar, rapor paketini kabul eder | Kendi girdiği kaydı onaylama kuralı kurum politikasına tabidir |
| İzleyici veya denetçi | İzinli rapor ve iz zincirini okur | Yazamaz; dosya indirme ayrıca sınırlandırılabilir |
| Tedarikçi | Kendisine atanmış talebe yanıt verir | Kurum envanterini ve diğer tedarikçileri göremez |
| İçerik editörü | Ders ve kaynak taslağı hazırlar | Üretim hesap kuralını doğrudan yayımlayamaz |

### Görevlerin ayrılığı

Kurumsal varsayılan veri giren ile onaylayanın farklı olmasıdır. Küçük ekip istisnasında gerekçe, izin veren ve süre kaydedilir; raporda görünür. Platform destek ekibinin müşteri verisine sürekli erişimi olmaz. Süreli destek erişimi müşteri yetkilisi tarafından açılır, kayda alınır ve otomatik sona erer.

### Davet ve hesap yaşam döngüsü

Davetler süreli ve tek kullanımlıdır. E-posta adresi doğrulanır; yanlış kuruma katılım engellenir. Ayrılan çalışanın erişimi sonlandırılır, açık görevleri devredilir; eski kayıtların yazarı korunur. Danışmanın müşteri alanları arasında veri kopyalaması açık işlem ve yetki gerektirir. Her ekranda aktif kuruluş görünür.

### Kabul koşulu

Bir kullanıcı başka kuruma ait kayıt kimliğini bilse bile kaydı okuyamaz, hesaplatamaz veya indiremez. Tedarikçi daveti başka talebe erişim vermez. Yetki değişikliği açık oturumda da etkili olur.

## 05 Sekmeler ve bilgi mimarisi

Masaüstünde sol menü, mobilde öncelikli görevleri taşıyan sade navigasyon önerilir. Teknik ayrıntılar ileri görünümde bulunur; başlangıç görünümü eksik ve gerekli işleri öne çıkarır.

| Sekme | Ana ekran ve eylem | Beklenen çıktı |
| --- | --- | --- |
| Ana sayfa | Bugünkü işler, eksikler, son değişiklikler | Kullanıcının sonraki adımı |
| Sürdürülebilirlik 101 | Öğrenme yolu, kısa ders, uygulama | Göreve bağlı öğrenme |
| Protokoller ve standartlar | Kaynak kartları, karşılaştırma, uygulanabilirlik | Gerekçeli gereklilik listesi |
| Gündem ve takvim | Güncellemeler, son tarihler, etkinlik ve destekler | Kuruma ilgili eylem |
| Sözlük | Türkçe ve İngilizce terim, örnek, kaynak | Bağlama uygun tanım |
| Veri girişi | Rehber, belge yükleme, Excel ve entegrasyon | Kanıtlı taslak kayıt |
| Emisyon envanteri | Kapsam 1, 2 ve 15 kategori | Kalitesi görünen hesaplar |
| Ürün ve yaşam döngüsü | Ürün sınırı ve süreç modeli | Ayrı ürün hesap çalışması |
| Görevler ve veri talepleri | Sorumlu, tarih, eksik bilgi, tedarikçi talebi | Tamamlanan iş akışı |
| Analiz ve hedefler | Yoğunluk, değişim, hedef, senaryo | Açıklanabilir performans takibi |
| Raporlar ve kanıtlar | Gereklilik indeksi, taslak, kanıt zinciri | Onaylı rapor paketi |
| Kurum ayarları | Tesisler, roller, sınırlar, entegrasyon, abonelik | Kontrollü yapılandırma |

### Ortak bileşenler

Global arama; dersleri, terimleri, kaynakları ve yetkili kayıtları ayrı sonuç gruplarında gösterir. Asistan her sayfanın bağlamını izin dahilinde bilir. Yardım çekmecesi terim, örnek belge ve ilgili kişiyi gösterir. Bildirim merkezi okunma ve eylem durumunu ayırır. Kaynak ayrıntısında yayın, yürürlük ve son kontrol tarihleri birlikte görünür.

Görünür olmayan bir modül çalışıyor gibi sunulmaz. Henüz hazır olmayan özellik açıklaması ve gerçek geliştirme durumu gösterilir; boş buton veya sahte sonuç kullanılmaz.

## 06 Kurulum ve ilk gün deneyimi

### Kurum profilini oluşturma

ONB-01: Kullanıcı görevini ve deneyimini belirtir; isteğe bağlı kısa başlangıç değerlendirmesi önerilir. Şirketin adı, faaliyet sektörü, ülkeler, tesisler, şirket ilişkileri ve raporlama dönemi alınır. Kurum büyüklüğü ve mevzuat açısından gereken bilgiler yalnızca ilgili yükümlülük değerlendirmesinde istenir.

ONB-02: Kuruluş ve envanter sınırı uzmanla belirlenir. Kontrol veya özkaynak payı yaklaşımı, kapsanan kuruluşlar, ortak girişimler, kiralamalar ve değişiklik gerekçesi sürümlenir. Başlangıç kullanıcısı bu kararı bilmiyorsa taslak profil açılır; nihai sınıflandırma beklemeye alınır.

ONB-03: Kullanıcı “Elektrik satın alıyor musunuz?”, “Yakıt yakan ekipman var mı?”, “Malzeme satın alıyor musunuz?”, “Ürün satıyor musunuz?” gibi soruları yanıtlar. Cevaplar kaynak envanteri ve Kapsam 3 ön değerlendirmesi oluşturur; kategori otomatik olarak silinmez.

### İlk görev

Sistem bir örnek eğitim kaydı veya gerçek elektrik/doğal gaz faturası ile başlamayı önerir. Eğitim alanı açıkça etiketlidir. Gerçek belge yüklenirse OCR çıktısı kullanıcı doğrulamasına sunulur. İlk sonuçta sayıdan önce dönem, birim, durum ve eksikler görünür. Kullanıcı “Neden bu kapsam?” açıklamasını açabilir.

### İlk ay planı

Hafta 1 kurum ve kaynak envanteri; hafta 2 kanıtlı temel tüketim; hafta 3 satın alma, lojistik ve atık veri talepleri; hafta 4 uzman kontrolü ve kapanış provası önerilir. Plan kurumun fiilî takvimine uyarlanır; sabit bir yasal süre gibi sunulmaz.

### Veri olgunluğu

Başlangıç düzeyi dosya ve fatura; gelişen düzey sorumlu ve dönemsel kontrol; ileri düzey entegrasyon ve izlenebilir yöntem olarak tanımlanır. Olgunluk, bir sertifika veya çevresel başarı puanı değildir. Kullanıcıya tamamlayabileceği en yakın iyileştirme önerilir.

### Kabul koşulu

Kapsam terimlerini bilmeyen kullanıcı ilk taslağı oluşturabilmelidir. Zorunlu teknik karar bilinmiyorsa kayıt kaybolmadan uzman görevine dönüşmelidir. Geri dönülen kurulum kaldığı adımdan devam etmelidir.

## 07 Sürdürülebilirlik 101 sekmesi

Öğrenme alanı iş başında rehberdir. İçerik kısa, kaynaklı ve kullanıcı görevleriyle ilişkili olmalıdır. Tam kursu bitirmek veri girişinin ön koşulu yapılamaz; kritik yanlış anlama için bağlamsal açıklama gösterilir.

| Modül | Öğrenme hedefi | Uygulama |
| --- | --- | --- |
| 101 01 Temel çerçeve | Çevresel, sosyal ve yönetişim boyutlarını ayırmak | İşletmedeki etki örneklerini seçmek |
| 101 02 Veri okuryazarlığı | Miktar, birim, dönem, kaynak ve tahmini ayırmak | Örnek faturayı okumak |
| 101 03 Emisyon mantığı | Faaliyet, faktör ve CO₂e ilişkisini anlamak | Eğitim hesabını izlemek |
| 101 04 Kapsamlar | Kurumsal ilişkiye göre 1, 2, 3 ayrımını kavramak | Gerekçeli örnek sınıflandırma |
| 101 05 Değer zinciri | 15 kategoriye aşinalık kazanmak | Departman veri planı |
| 101 06 Yaşam döngüsü | Sistem sınırı ve referans birimi anlamak | Dahil edilen aşamaları işaretlemek |
| 101 07 Standartlar | GRI, TSRS ve hesap yöntemlerinin rollerini ayırmak | Kaynak kartı okuma |
| 101 08 Kanıt ve kalite | Eksik veri, varsayım ve onayı anlamak | Hatalı kaydı düzeltmek |
| 101 09 Rapor ve hedef | Brüt sonuç, yoğunluk ve hedefi ayırmak | İki dönem karşılaştırmak |
| 101 10 Diğer konular | Su, atık, çalışan ve etik verilerini tanımak | İlgili veri sahibini bulmak |

### Ders şablonu

Her dersin kimliği, seviyesi, amacı, tahmini süresi, ön koşulu, sade açıklaması, iş örneği, sık yapılan hatası, küçük uygulaması, cevap gerekçesi, kaynakları ve gözden geçirme tarihi bulunur. Video varsa altyazı ve metin alternatifi zorunludur. Ders süresi tasarım hedefidir; tamamlama zorlaması değildir.

### Değerlendirme ve ilerleme

Yanlış yanıtta yalnız doğru seçenek değil neden yanlış olduğu anlatılır. İlerleme kullanıcı bazında saklanır. Resmî yetkinlik sertifikası izlenimi veren rozet kullanılmaz; “modül tamamlandı” ifadesi kullanılır. Yöneticinin ayrıntılı bireysel öğrenme verisine erişimi kurumun tanımlı politikası ve kullanıcı bilgilendirmesiyle sınırlandırılır.

### Kabul koşulu

Bir ders güncellenince eski tamamlama kaydı korunur; değişiklik esaslıysa kısa tazeleme önerilir. Ders içindeki örnekler hiçbir zaman üretim emisyon toplamına eklenmez.

## 08 Protokoller ve standartlar sekmesi

Bu sekme belge deposundan fazlasıdır: her kaynağın ne işe yaradığını, kime uygulanabileceğini ve hangi göreve dönüştüğünü açıklar. Mevzuat, raporlama standardı, hesap protokolü, rehber ve haber aynı türde sınıflandırılamaz.

| Kaynak ailesi | İşlev | Uygulama davranışı |
| --- | --- | --- |
| GRI | Etki raporlaması | Evrensel, sektörel ve konu gereklilikleri için indeks |
| TSRS | Sürdürülebilirlikle ilgili finansal açıklamalar | Kurum kapsamı ve dönemle ilişkili ayrı açıklama listesi |
| GHG Protocol | Kurumsal ve ürün sera gazı hesap yaklaşımı | Sınır, kategori ve yöntem kuralları |
| ISO 14040 ve 14044 | Yaşam döngüsü çerçevesi | İlgili ürün çalışma yöntemine bağlantı |
| ISO 14067 | Ürün karbon ayak izi | Ürün veya kısmi ürün karbon çalışması |
| Ulusal ve uluslararası mevzuat | Hukuki yükümlülük | Yetki alanı, kapsam, tarih ve uzman kontrolü |

GRI etki odağı, TSRS finansal risk ve fırsat odağı, GHG Protocol hesaplama işlevi ayrı tutulur. ISO 14067 sera gazına odaklanır; yalnız karbon hesaplamak tüm çevresel etkileri kapsayan LCA yapmak değildir. [K01, K02, K03, K08]

### Kaynak kartı

Başlık, yayımlayan kurum, resmî URL, sürüm, dil, yayın tarihi, yürürlük, geçiş koşulu, yürürlükten kalkma, erişim tarihi ve lisans alanları gösterilir. “Bu bana neden gösteriliyor?” gerekçesi kurum profilinden gelir. Standart metni ile uygulamanın sade açıklaması görsel ve veri düzeyinde ayrılır.

### Uygulanabilirlik

Değerlendirme uygulanır, uygulanmaz veya inceleme gerekli durumlarından birini üretir. Karar, kullanılan kurum verisi ve kural sürümüne bağlanır. Geçerli eşikler ve geçiş hükümleri kod içine sabit yazılmaz. Kaynak metni doğrulanmadan yeni hukuki kural etkinleştirilmez. GRI konu seçimi ile bir emisyon kategorisinin veri eksikliği birbirinin yerine kullanılamaz.

### Kabul koşulu

Kullanıcı güncel ve geçmiş sürümü yan yana açabilmelidir. Kaynağa erişilemediğinde son başarılı kontrol tarihi gösterilir; “güncel” etiketi süresiz kalmaz. Lisans izni olmayan tam metin depolanmaz veya tekrar yayımlanmaz.

## 09 Gündem ve takvim sekmesi

Gündem akışı kullanıcının işiyle ilgili değişiklikleri anlaşılır görevlere çevirir. Her haber bildirim değildir; her yayın da yürürlükte bir yükümlülük değildir.

### İçerik türleri

Mevzuat değişikliği, standart güncellemesi, resmî duyuru, destek/teşvik çağrısı, eğitim/etkinlik ve seçilmiş sektör gelişmesi ayrı etiketlenir. Taslak, istişare metni ve yürürlükteki düzenleme açıkça ayrılır. Haber ikincil kaynaktan gelirse hukuki sonuç resmî kaynakla doğrulanır.

### Gündem kartının alanları

Başlık; üç cümlelik özet; yayımlayan; resmî kaynak; yayın tarihi; olay veya yürürlük tarihi; etkilenen ülkeler/sektörler; kurumla ilgisi; önerilen eylem; son kontrol; editör durumu. “Ne değişti, beni neden ilgilendiriyor, şimdi ne yapmalıyım?” soruları cevaplanır.

### Takvim ve destekler

Kurum içi veri teslim tarihi ile yasal son tarih farklı ikon ve etiket taşır. Saat dilimi Europe/Istanbul varsayılanıdır; saatler sistemde UTC saklanır. Hatırlatmalar kullanıcı tercihine göre uygulama içi, e-posta veya izinli entegrasyonla gönderilir. Dış kişiye veri talebi gönderimi açık yetki gerektirir.

Destek kartında program sahibi, yararlanıcı koşulları, açık/kapalı durumu, çağrı tarihi, başvuru bağlantısı ve kontrol tarihi bulunur. “Size uygun olabilir” ön değerlendirmedir; destek almaya hak kazanıldığı anlamına gelmez. Teşvik tutarı veya son tarih kaynak olmadan üretilmez.

### İçerik işletimi

Resmî kaynaklar planlı aralıklarla kontrol edilir; erişim ve değişiklik geçmişi tutulur. Kritik değişiklik uzman kuyruğuna alınır. Yeni kural yayımlandığında ilgili görev sahipleri bir kez bilgilendirilir; tekrar bildirimler birleştirilir. Sessize alma, takip ve takvime ekleme seçenekleri vardır.

### Kabul koşulu

Geçmiş son tarih yaklaşan iş gibi gösterilemez. Taslak düzenleme yürürlükteymiş gibi görev yaratamaz. Kullanıcı bildirimden etkilenen kayda veya kaynağa tek adımda ulaşır.

## 10 Sözlük ve bağlamsal yardım

Sözlük başlangıç kullanıcısının teknik dili çözmesine yardımcı olur. Arama Türkçe karakter, yaygın yazım hataları, kısaltmalar ve İngilizce eş anlamlıları destekler. Kapsam, sistem sınırı, emisyon faktörü, GWP, fonksiyonel birim ve tahsis başlangıç terimleridir.

### Terim kaydı

Terim kimliği, Türkçe başlık, İngilizce karşılık, kısaltma, sade tanım, kaynağın teknik tanımı, örnek, karıştırılan kavram, ilgili görev ve kaynak sürümü tutulur. Aynı terimin standartlara göre farklı kullanımı varsa bağlam seçimi gösterilir; tek tanıma zorlanmaz.

### İçerik hakları

SKD Türkiye için doğrulanmış başlangıç kaynağı “100 Maddede Sürdürülebilirlik Rehberi”dir. Kullanıcının kastettiği ayrı sözlüğün yayın kimliği ve kullanım izni kesinleştirilir. İzin verilene kadar kaynak bağlantısı ve özgün kısa açıklamalar kullanılır; tam içeriğin uygulamaya aktarılacağı varsayılmaz. GRI, ISO ve lisanslı veri tabanları için de kullanım hakkı ayrıca tutulur. [K09]

### Örnek yardım davranışı

“CO₂e ne demek?” sorusunda farklı sera gazlarının iklim etkilerini ortak birimle ifade ettiği açıklanır. “Bu kutuya ne yazacağım?” sorusunda kavram tanımı yerine kullanıcının belgesindeki ilgili alan gösterilir. Yanlış birim girdiğinde sistem “Bu alan miktar bekliyor; ödeme tutarını ayrı alana girebilirsin” der.

### Yardım yolları

Bilgiyi bulamıyorum seçeneği örnek belge ve olası departmanı açar. Belge elimde yok seçeneği görev oluşturur. Emin değilim seçeneği uzman kontrolüne işaretler. Asistan yanıtı yetersizse destek talebine geçilir; kaynaklar ve kullanıcının onayladığı bağlam eklenir.

### Kabul koşulu

Sözlük tanımı güncellendiğinde ilgili ders ve yardım metinleri etki analizine girer. Kullanıcı görevinden ayrılmadan açıklamayı okuyup kaldığı alana dönebilir. Bir kaynaktaki teknik tanım uygulamanın kendi görüşü gibi sunulmaz.

## 11 Rehberli veri girişinin ortak sözleşmesi

Veri girişi “Ne kaydetmek istiyorsun?” ile başlar. Fatura/tüketim, malzeme/hizmet, sevkiyat, atık, seyahat, soğutucu, ürün, çalışan veya diğer seçenekleri bulunur. Kapsam seçimi ileri alandadır; normal akışta sistem sorularla önerir.

### Ortak akış

DAT-01: Faaliyeti ve kurumu seç. DAT-02: Belge yükle, elle gir veya içe aktar. DAT-03: Okunan alanları doğrula. DAT-04: Eksik bağlamı cevapla. DAT-05: Hesap ve sınır önerisini incele. DAT-06: Taslağı kaydet veya kontrole gönder. Her adım otomatik taslak kaydı ve geri dönüşü destekler.

### Ortak alanlar ve kontroller

Kuruluş, tesis/kaynak, başlangıç-bitiş tarihi, veri türü, miktar, birim, veri kaynağı, ölçülmüş/tahmini durumu ve sorumlu tutulur. Nokta/virgül ayracı kullanıcı yereline göre okunur; “1.234” belirsizse sessiz karar verilmez. Negatif tüketim normal kayıt olamaz; iade/düzeltme ayrı işlem türüdür. Sıfır kabul edilir ama gerekçe veya kanıt istenebilir.

OCR belge kimliği, sayfa ve alan konumunu saklar. Düşük güvenli alanlar vurgulanır; OCR doğruluğu emisyon hesabının doğruluğu değildir. Aynı belge karması, fatura numarası, tedarikçi, tesis ve dönem üzerinden mükerrerlik adayı üretilir. Kullanıcı gerçek yinelenen işlem varsa gerekçeyle devam edebilir.

### İçe aktarma

Excel/CSV önce eşleme ve önizleme alanına alınır. Birim, tarih, kurum ve tekrar kontrolü uygulanır. Hatalı satırlar açıklamalı döner; başarılı satırların tekrar yüklenmesi ikinci kayıt oluşturmaz. İçe aktarma işi geri alınabilir; onaylı kayıtların üzerine yazılmaz.

### Sonuç ekranı

Sonuç; dönem, faaliyet miktarı, standart birime dönüşüm, kapsam/kategori önerisi, tCO₂e, faktör kaynağı, yöntem sürümü ve onay durumuyla gösterilir. Hesap yapılamıyorsa eksik neden açıkça yazılır. Birimin bilinmediği miktardan kesin sonuç üretilmez.

### Kabul koşulu

Form kapanınca taslak kaybolmaz. Güncelleme çakışmasında diğer kullanıcının verisi ezilmez. Belge silinirse bağlı hesap ve raporlardaki kanıt etkisi görünür.

## 12 Kapsam 1 veri ve hesap akışları

Kapsam 1 kaynakları organizasyonel sınır içindeki doğrudan emisyonlarla ilişkilendirilir. Sabit yanma, hareketli yanma, proses ve kaçak emisyonlar ayrı şablonlardır. İlgili gazlar ve yöntem kaynak türüne göre seçilir. [K03]

| Şablon | Zorunlu bağlam | Yönteme bağlı veriler |
| --- | --- | --- |
| Sabit yanma | Ekipman, yakıt, dönem, tüketim birimi | Isıl değer, yoğunluk, ölçüm veya karbon içeriği |
| Hareketli yanma | Araç, kontrol ilişkisi, yakıt | Litre/kg veya mesafe, araç özellikleri |
| Proses | Proses ve ürün/hammadde | Reaksiyon, bileşim, kütle dengesi, ölçüm |
| Kaçak | Gaz türü, ekipman, işlem | Stok, dolum, geri kazanım, imha, sızıntı verisi |

### Doğal gaz örneği

Kullanıcı faturadaki hacim veya enerji miktarını girer. m³, Sm³ ve Nm³ referans sıcaklık/basınç bilgisi olmadan eşitlenmez. Alt ve üst ısıl değer esası ayrı alanlardır. Enerji bazlı faktörle hesapta hacimden enerjiye dönüşümün kaynağı kaydedilir; faturada uygun enerji verisi varsa gereksiz çift dönüşüm yapılmaz.

### Hesap ilkesi

Faaliyet miktarı, uyumlu birimde gaz bazlı faktörle çarpılır. Gaz kütleleri seçilen yöntemin GWP setiyle CO₂e’ye çevrilir. Faktör zaten CO₂e ise tekrar GWP uygulanmaz. Yanma ve yakıtın üst aşamaları ayrı sonuçlardır. Kaynak yalnız CO₂ veriyorsa eksik gazlar yöntem kapsamında değerlendirilir; tam sera gazı sonucu gibi etiketlenmez.

### Kritik istisnalar

Soğutucuya eklenen miktar her durumda sızıntı değildir; yeni dolum ile kaçak telafisi ayrılır. Yakıt alımı ile tüketimi stok değişimi nedeniyle farklı olabilir. Aynı ekipmanda sayaç ve fatura birlikte varsa ikisi toplanmaz. Biyojenik CO₂ ayrı tutulur; ilgili diğer sera gazları gerekli hesapta kalır. Doğrudan ölçüm kullanılırsa cihaz, kalibrasyon ve veri kapsama bilgisi tutulur.

### Kabul koşulu

Gaz türü bilinmeyen soğutucu kaydı hesap bekler. Karışım gaz için uygun karışım/GWP tanımı gerekir. Ekipman envanter dışında ise Kapsam 1 ataması yapılmadan ilişki tekrar değerlendirilir.

## 13 Kapsam 2 veri ve hesap akışları

Satın alınan veya edinilen elektrik, buhar, ısıtma ve soğutma için ayrı enerji kayıtları bulunur. Konum bazlı ve piyasa bazlı sonuçlar aynı tüketimin alternatif hesap görünümleridir; toplanmaz. İlgili piyasalarda çift raporlama gerekliliği değerlendirilir. [K04]

### Konum bazlı akış

Tesisin ülke/şebeke bölgesi, dönem ve enerji türü uygun faktörle eşleştirilir. Şebeke üretim ve tüketim noktası faktörlerinin farkı kontrol edilir; sınırın şebeke kayıplarını içerip içermediği bilinmelidir. Faktör yoksa uygun alternatif seçim gerekçesi uzman onayına gider.

### Piyasa bazlı akış

Sözleşmesel araç kaydında tür, tedarikçi, üretim yeri, enerji dönemi, miktar, belge seri bilgisi, faydalanan kuruluş, itfa/iptal durumu ve ilgili kalite koşulları tutulur. Uygun araçla kapsanan ve kapsanmayan tüketimler ayrı hesaplanır. Kalan tüketim için geçerli faktör hiyerarşisi, artık karışımın kullanılabilirliği ve izin verilen alternatifler uygulanır.

### Kontroller

Belge miktarı tüketimi aşan kısım için negatif emisyon yaratamaz. Belge iki tesis veya döneme tekrar tahsis edilemez.

“Yenilenebilir satın aldım” cevabı tek başına sıfır emisyon sonucu üretmez. Koşullar ve kanıt doğrulanır.

Şirket içindeki yakıtlı üretim, satın alınmış elektrik gibi yeniden Kapsam 2’ye eklenmez. Enerji ve emisyon çift sayımı ayrı kontrollerdir.

Öz tüketim, şebekeye satış ve depolama akışları ayrılır. Satılan enerji otomatik olarak brüt kurumsal emisyonlardan düşülmez.

Kullanılan GHG Protocol sürümü saklanır. Taslak güncelleme üretim kuralı olarak etkinleştirilmez.

### Sonuç görünümü

Elektrik miktarı, iki hesap sonucu, belgeyle eşleşen miktar, kapsanmayan miktar, kullanılan faktörler ve inceleme durumu gösterilir. Kurumsal toplamın yanında hangi Kapsam 2 yönteminin kullanıldığı açıkça yazar.

### Kabul koşulu

100 MWh tüketimin 60 MWh’ı uygun belgeyle kapsanırsa kalan 40 MWh hesap dışı bırakılamaz. Konum ve piyasa sonucu toplam enerji tüketimini iki katına çıkaramaz.

## 14 Kapsam 3 kategorileri 1 ile 8

Her kategori için uygulanabilirlik, minimum/isteğe bağlı sınır, yöntem, veri sorumlusu, dönem, kanıt ve dışlama gerekçesi tutulur. Veri eksikliği uygulanamazlık değildir. Aşağıdaki veri görevleri ürün şablonlarıdır; sınır ve yöntem seçimi GHG Protocol kategori rehberleriyle doğrulanır. [K05, K06]

| Kategori | Toplanacak veri | Başlıca kontrol |
| --- | --- | --- |
| 1 Mal ve hizmetler | Malzeme/hizmet, tedarikçi, miktar veya tutar, ürün faktörü | Üst aşama sınırı; harcama ve miktarın aynı alımı tekrar saymaması |
| 2 Sermaye malları | Makine/yapı/ekipman alımı, miktar, üretim verisi | Satın alma sınıfı; emisyonun muhasebe amortismanıyla yıllara yayılmaması |
| 3 Yakıt ve enerji üst aşamaları | Kapsam 1–2 faaliyet bağlantısı, üst aşama ve kayıp faktörü | Yanma/üretim ve kayıpların mükerrerliği |
| 4 Yukarı yönlü taşıma | Hizmeti satın alan, sevkiyat, kütle, mesafe, araç, depo | Gelen/giden etiketi yerine hizmet ilişkisine göre sınıflandırma |
| 5 Operasyon atıkları | Atık türü, kütle, işleme yolu, işletmeci | Oluşan atık ile satılan ürün ömür sonunun ayrılması |
| 6 İş seyahatleri | Ulaşım, rota, sınıf, yolcu, mesafe; ayrı konaklama | Şirket araçlarının Kapsam 1 ile tekrar sayılmaması |
| 7 İşe gidiş geliş | Ulaşım, mesafe, çalışma günü, doluluk, örneklem | Anketin kapsadığı nüfus, ağırlık ve varsayımlar |
| 8 Kiralanan varlıklar | Kiracı olunan varlık, enerji, pay ve dönem | Seçilen sınırda Kapsam 1–2’ye dahil olup olmadığı |

### Görev sahipleri

Satın alma 1–2; enerji/teknik ekip 3; lojistik 4; çevre sorumlusu 5; seyahat/idari işler 6; insan kaynakları 7; idari işler/finans 8 için başlangıç sorumlu önerisidir. Kurum gerçek organizasyonuna göre değiştirir. Sistem departman adını uzmanlık veya veri doğruluğu garantisi saymaz.

### Veri talebi

Tedarikçiye giden şablon ürün, referans birim, sistem sınırı, kapsanan yıl/coğrafya, yöntem, doğrulama durumu ve belge ister. Yalnız toplam şirket emisyonu ürün faktörü gibi kullanılamaz; uygun tahsis bilgisi gerekir. Eksik yanıtta tamamlayıcı talep oluşturulur.

### Kabul koşulu

Bir kaydın hem kategori 1 hem 2’ye atanması inceleme gerektirir. Anket yanıtı vermeyen çalışan otomatik sıfır kabul edilmez. “Geri dönüşüm” seçimi atık sonucunu otomatik negatif yapmaz.

## 15 Kapsam 3 kategorileri 9 ile 15

Satılan ürünler ve finansal ilişkiler, satış miktarı veya yatırım tutarından ibaret değildir. Kullanım senaryosu, yaşam süresi, kontrol ilişkisi ve uygun tahsis belirleyicidir. [K05, K06]

| Kategori | Toplanacak veri | Başlıca kontrol |
| --- | --- | --- |
| 9 Aşağı yönlü taşıma | Satış sonrası taşıma/depo, hizmet ilişkisi, mesafe, kütle | Kategori 4 ile sınır; şirketçe satın alınan hizmetin doğru yeri |
| 10 Satılan ürünlerin işlenmesi | Ara ürün miktarı, müşteri prosesi, enerji/işleme senaryosu | Nihai ürün ile ara ürün ayrımı |
| 11 Satılan ürünlerin kullanımı | Satış adedi, ömür, kullanım sıklığı, tüketim, coğrafya | Dönemde satılan ürünlerin ömür boyu kullanım hesabı |
| 12 Ürünlerin ömür sonu | Ürün/ambalaj kütlesi, malzeme, ülke, işleme senaryosu | Operasyon atıklarıyla ayrım; oranların toplamı |
| 13 Kiraya verilen varlıklar | Kiraya veren olunan varlık, kullanım ve enerji | Kapsam 1–2 ile çakışma; atıf payı |
| 14 Franchise | İşletme, enerji/yakıt, dönem, sınır ilişkisi | Franchise dışındaki ticari ilişkinin yanlış sınıflanmaması |
| 15 Yatırımlar | Yatırım sınıfı, karşı taraf, emisyon, finansal payda | Varlık sınıfına özgü yöntem ve konsolidasyon |

### Zaman ve senaryo

Kategori 11’de satış yılı ve beklenen emisyon gerçekleşme yılları ayrı tutulur. Ömür, yıllık kullanım, enerji karışımı ve bakım senaryoları sürümlenir. Kullanım verisi olmayan üründe tek bir varsayılan gizlice atanmaz. Senaryo sonucu ölçülmüş gerçekleşme gibi gösterilmez. [K07]

Kategori 15’te özkaynak, borç ve proje finansmanı aynı formülle genellenmez. İlgili finansal muhasebe yöntemi, atıf payının pay/payda tanımları ve veri yılı alan uzmanı tarafından belirlenir. Finans kuruluşlarına açılacak ileri modül için ek yöntem incelemesi gerekir. [K10]

### Uygulanabilirlik ve eksikler

Franchise vermeyen işletmede gerekçeli uygulanamaz kaydı tutulabilir. Veri vermeyen müşteriye ilişkin kategori ise veri eksik olarak kalır. Kategori bazında sonuç, kapsam açıklaması, birincil/ikincil veri niteliği ve iyileştirme görevi birlikte sunulur.

### Kabul koşulu

Ömür sonu senaryo oranları uygun toplamı sağlamalıdır. Ömrü on yıl olan ürünün toplamı her yıl aynı satış grubu için yeniden envantere eklenmemelidir. Aynı yatırım konsolidasyon ve Kategori 15 altında tekrar sayılmamalıdır.

## 16 Kapsam 3 yöntem ve kalite yönetimi

Hesap yöntemi kategoriye göre değişir. Sistemde tüm kategorilere tek bir “miktar çarpı faktör” formu dayatılmaz. Ön tarama daha az ayrıntılı verilerle başlayabilir; sonuç açıkça tahmini olarak etiketlenir. Öncelik emisyon büyüklüğü, veri kalitesi, risk ve iyileştirme kapasitesiyle belirlenir. [K05]

### Yöntem seçme sözleşmesi

MTH-01: Uygulanabilir kategori ve minimum sınırı belirle. MTH-02: Kullanılabilir birincil ve ikincil veriyi listele. MTH-03: İlgili kategoride izin verilen yöntemleri değerlendir. MTH-04: Seçim gerekçesi ve alternatifleri kaydet. MTH-05: Kalite kontrolü ve uzman onayı sonrası yöntemi etkinleştir.

Satın alınan mal ve hizmetlerde tedarikçiye özgü, hibrit, ortalama veri veya harcama bazlı yaklaşımlar değerlendirilebilir. Tedarikçi verisi yanlış sınırda veya eskiyse daha kaliteli ortalama veri karşısında otomatik üstün değildir. [K11]

### Harcama ve fiziksel veri

Harcama bazlı hesapta para birimi, harcama tarihi, vergilerin ele alınışı, sektör sınıfı, faktör fiyat yılı ve kur/enflasyon yaklaşımı saklanır. Fiziksel yönteme geçişte aynı işlemin harcama sonucu devre dışı bırakılır; eski sonuç tarihçede kalır. Kur değişimi emisyon performansında gerçek fiziksel azalma gibi yorumlanmaz.

### Kalite değerlendirmesi

Teknoloji, coğrafya, zaman, tamlık ve güvenilirlik boyutları ayrı değerlendirilir. Birleşik kalite puanı kullanılırsa ağırlıklar ve ölçütler açıklanır; bilimsel belirsizlik yüzdesi gibi sunulmaz. Ölçüm belirsizliği, faktör belirsizliği ve senaryo belirsizliği farklı alanlardır. Veri yoksa rastgele bir güven aralığı üretilemez.

### Tahsis ve örnekleme

Ortak tedarikçi veya tesis emisyonu ilgili ürüne/kuruma uygun yöntemle paylaştırılır. Paylaştırma temeli, payda dönemi ve tahsis oranı saklanır. Birden fazla alıcıya dağıtılan toplamda sınır aşımı kontrol edilir. Örneklem verisi nüfusa genişletilirse örneklem büyüklüğü, seçimi, yanıt oranı ve ağırlıklar tutulur.

### Kabul koşulu

Yöntem değişimi karşılaştırma etkisini gösterir. Kullanıcı toplamın ne kadarının tahmini ve hangi kategorilerin eksik olduğunu görebilir. Birincil veri oranı kayıt sayısı ile emisyon ağırlıklı oran olarak karıştırılmaz.

## 17 Yaşam döngüsü ve ürün çalışmaları

Ürün çalışması, kurumsal envanterin yanında ayrı hesap bağlamıdır. Ürün sonucu kurumsal toplamın üzerine eklenmez. Aynı ham veri kullanılabilir; dönemi, tahsisi, referans birimi ve sınırı ayrı tutulur. GHG Protocol Product Standard ürün; Corporate ve Scope 3 standartları kuruluş düzeyinde çalışır. [K03, K12]

| Kullanıcıya sorulan | Teknik sınır | Gerekli açıklama |
| --- | --- | --- |
| Yalnız belirli üretim işlemlerini mi inceleyeceksin | Kapıdan kapıya | Başlangıç ve bitiş prosesi |
| Ham maddeden tesis çıkışına kadar mı | Beşikten kapıya | Hangi tesisin çıkışı ve üst aşamalar |
| Kullanım ve ömür sonu da dahil mi | Beşikten mezara | Dağıtım, kullanım ve ömür sonu senaryoları |
| Müşterinin talebine göre farklı bir bölüm mü | Özel kısmi sınır | Dahil/hariç tüm süreçler ve gerekçe |

Bu sınırlar çalışma amacını açıklar; veri tabanındaki bir faktörün gerçek sınırını kullanıcı seçimiyle değiştirmez. “Beşikten beşiğe” ifadesi otomatik geri dönüşüm kredisi veya standart bir hesap kısayolu olarak sunulmaz. Döngüsel senaryoda tahsis ve geri dönüşüm yöntemi açıkça belirlenir. [K08, K13]

### Ürün veri modeli

Ürün sürümü, malzeme listesi, üretim rotası, miktarlar, fire, ambalaj, enerji tahsisi, sevkiyat, kullanım, ömür sonu ve ortak ürünler tanımlanır. Referans akış ile gerekiyorsa fonksiyonel birim, performans ve kullanım süresi açıklanır. Bir kilogram farklı performanslı ürünleri otomatik olarak karşılaştırılabilir yapmaz.

### Çakışma ve eksik aşama

Tedarikçinin beşikten kapıya verisine aynı ham madde üretimi yeniden eklenmez. Kapıdan kapıya faktör üst aşamalar olmadan tam ürün ayak izi gibi adlandırılmaz. Beşikten mezara toplam, Kategori 1’de kullanılmadan uygun bileşenlere ayrıştırılır. Sistem her faktör için kapsanan süreçleri ve kesişimleri tutar.

### Kabul koşulu

Sonuç ekranı birim, sınır, dönem, yöntem, tahsis ve eksikleri gösterir. Yalnız karbon hesaplandıysa “ürün karbon ayak izi” veya “kısmi ürün karbon ayak izi” denir; tam LCA veya EPD belgesi oluşturulduğu iddia edilmez.

## 18 Faktör kataloğu ve hesaplama motoru

Hesaplama deterministik ve tekrar üretilebilir olmalıdır. Yapay zekâ sayı tahmin ederek üretim sonucu veremez. Aynı girdiler, aynı yöntem ve faktör sürümüyle aynı sonucu üretir. Önizleme ve onaylı hesap aynı çekirdek motoru kullanır.

### Faktör kaydı

Faktör kimliği/sürümü, değer, pay ve payda birimleri, gaz veya CO₂e niteliği, coğrafya, yıl, teknoloji, yaşam döngüsü sınırı, alt/üst ısıl değer esası, GWP seti, kaynak sayfa/tablo, lisans, geçerlilik, inceleyen ve onay durumu tutulur. Kaynağı ve birimi olmayan katsayı üretim kataloğuna giremez.

### İşlem sırası

Girdi doğrulama → birim/koşul dönüşümü → sınır ve faktör uyumu → gaz bazlı hesap → gerekiyorsa GWP dönüşümü → tahsis → sonuç ve iz kaydı → kalite durumu. İç hesapta yeterli ondalık hassasiyet korunur; yuvarlama yalnız sunumda veya tanımlı yöntem gereğinde yapılır.

### Aritmetik doğrulama örnekleri

Yalnız yazılım testi için kurgusal veriler: 100 GJ × 50 kg CO₂/GJ = 5.000 kg CO₂ = 5 t CO₂. Diğer gazlar yoksa bu yalnız CO₂ bileşenidir. 1.000 kWh × 0,4 kg CO₂e/kWh = 400 kg CO₂e = 0,4 t CO₂e. Bu katsayılar gerçek müşteri hesabına aktarılmaz.

### Versiyon ve yeniden hesap

Her çalıştırmada girdi sürümleri, faktör kimlikleri, formül sürümü, motor sürümü, zaman ve sonucu oluşturan kullanıcı/iş saklanır. Yeni faktör bildirimi eski sonucu değiştirmez; etkilenmiş kayıt listesi ve fark önizlemesi oluşturur. Onaylı dönemde düzeltme yeni sürüm ve gerekçe gerektirir. Baz yıl yeniden hesap politikası ayrı tutulur.

### Hata davranışı

Uyumsuz birim, eksik sınır veya desteklenmeyen yöntem hesap engelidir. Daha düşük kalite veri kullanılabiliyorsa sonuç açıkça tahmini ve inceleme gerekli olur. Sıfıra bölme, taşma ve geçersiz sayı işlemi reddedilir. Ölçüm ile satın alma verisi arasında stok uzlaştırması gereken kaynaklar işaretlenir.

### Kabul koşulu

Kullanıcı sonuçtan faktöre, oradan kaynak tablosuna ve ham belgeye ulaşır. CO₂e faktörüne GWP ikinci kez uygulanamaz. Lisansı süresi dolan faktörün geçmiş kullanımı kanıtıyla korunur; yeni kullanım politikaya göre engellenir.

## 19 Kaynak ve değişiklik izleme altyapısı

Resmî yayınlar izlenir; internetten bulunan her metin güvenilir kaynak sayılmaz. Kaynak önceliği yayımlayan kurum, resmî metodoloji ve lisanslı veri sağlayıcıdır. Akademik veya sektör rehberi amacına göre ikincil dayanak olarak etiketlenir.

### Kaynak yaşam döngüsü

SRC-01: İzinli kaynağı kaydet. SRC-02: RSS/API veya izinli sayfa/PDF kontrolü yap. SRC-03: İçerik karması ve sürüm oluştur. SRC-04: Madde düzeyinde değişiklik çıkar. SRC-05: Yapay zekâ özetini kaynak parçalarına bağla. SRC-06: Uzman yeni kuralı ve etkisini onaylasın. SRC-07: İlgili kullanıcıya görev veya bilgilendirme üret.

### Tarih modeli

Yayın tarihi, yürürlük tarihi, kapsanan raporlama dönemi, erken uygulama/istisna koşulu, sistemde görülme tarihi ve son başarılı kontrol farklı alanlardır. Değişiklik anında eski sürüm erişilebilir kalır. Sadece en son dosyayı saklamak tarihsel raporu yeniden üretmeyi engeller.

### Standart geçiş örneği

GRI 102 Climate Change 2025 ve GRI 103 Energy 2025 için 1 Ocak 2027 ve sonrasında yayımlanan rapor/materyal koşulu kaynakta belirtilmiştir. Kural yalnız tüketim yılına göre seçilemez. GRI 102’nin 2016 tarihli eski “General Disclosures” standardıyla karışmaması için kimlik; yayımlayan, kod, başlık ve baskı yılını birlikte içermelidir. [K14, K15]

### Değişiklik kartı

Eski metin bağlantısı, yeni metin bağlantısı, değişen madde, sade özet, kesin/yorum niteliği, etkilenen kurum profilleri, formlar, hesaplar ve dersler listelenir. Kural etkinleşince hangi tarihten itibaren hangi işin değişeceği açıklanır. Erişim hatasında güncellik garantisi verilmez; editör kuyruğuna alınır.

### Kabul koşulu

Taslak yayın otomatik yükümlülük olamaz. Yapay zekâ özeti orijinal metni değiştiremez. Kaynak metnindeki talimat benzeri içerik sistem komutu olarak çalıştırılamaz. Silinmiş veya değişmiş bir bağlantının geçmiş kanıtı saklama hakkı dahilinde korunur.

## 20 Çekirdek veri modeli

Önerilen ilişkisel çekirdek, veri bütünlüğünü ve kurum ayrımını önceler. Aşağıdaki varlıklar asgari modeldir. Kimlikler UUID; sayısal hesaplar ondalık; zamanlar UTC; faaliyet dönemleri tarih aralığıdır. Her kurumsal kayıtta tenant_id zorunludur.

| Varlık | Temel alanlar ve ilişki |
| --- | --- |
| Organization ve Facility | tenant_id, ülke, sektör, üst kuruluş, tesis; sürümlü sınır üyeliği |
| InventoryBoundary | yaklaşım, dahil kuruluş/paylar, dönem, gerekçe, onay |
| ReportingPeriod | başlangıç, bitiş, yayın tarihi, durum, baz yıl ilişkisi |
| EmissionSource | kaynak türü, tesis, kontrol/kiralama, sayaç/ekipman |
| ActivityRecord | kaynak, dönem, değer, birim, veri niteliği, kanıt; append-only sürüm |
| ActivityDetail | kategoriye özgü doğrulanan JSON şema sürümü |
| Evidence | nesne anahtarı, dosya karması, sayfa, hak/erişim, saklama |
| FactorVersion | değer, birimler, gaz, sınır, ülke/yıl, kaynak, lisans |
| MethodVersion | formül, uygun girdiler, sınır, test paketi, onay |
| CalculationRun ve Result | girdi sürümleri, faktörler, dönüşümler, sonuç, motor sürümü |
| StandardVersion ve Requirement | kaynak sürümü, madde, yükümlülük tipi, geçerlilik |
| RequirementMapping | gereklilik ile veri/kanıt bağlantısı, tam/kısmi/koşullu ilişki |
| TopicAssessment | etkiler, paydaşlar, önemlilik yaklaşımı, karar ve onay |
| Task ve Approval | sorumlu, tarih, durum, karar, yorum, sürüm |
| ProductStudy | ürün, referans birim, süreçler, sınır, tahsis ve senaryo |
| ReportSnapshot | rapor sürümü, sabit veri/hesap/kaynak manifesti |
| Lesson ve Term | içerik sürümü, kaynak, dil, editör durumu |
| AuditEvent | aktör, işlem, nesne/sürüm, zaman, değişim gerekçesi |

### Bütünlük kuralları

Kayıt sürümü ile hesap sürümü bire çoktur; sonuç eski girdi üstüne yazılamaz. Bir faaliyetten farklı kapsam/aşama sonuçları üretilebilir; her sonuçta sınır ve yöntem bağı bulunur. tenant_id yabancı anahtar ilişkilerinde de doğrulanır. Gereklilik eşleştirmesi çoktan çoğa yapıdadır; benzer açıklamalar otomatik eşdeğer sayılmaz.

### Ayrı durumlar

NULL bilinmiyor, sıfır ölçülmüş/değerlendirilmiş değer, uygulanamaz gerekçeli karar, tahmin veri niteliği olarak tutulur. Bu ayrım API, ekran, dışa aktarma ve raporda korunur.

## 21 İş akışı ve dönem kapanışı

### Kayıt durumları

Taslak → doğrulama gerekli → hesaplandı → incelemede → düzeltme istendi veya onaylandı → kilitli dönem. Hesaplandı, onaylandı anlamına gelmez. Durum geçişleri sunucu tarafından denetlenir; her geçiş yetki, zaman ve gerekçe içerir.

İncelemeye gönderilen kayıt eksik kanıt politikasına göre bloke edilir veya açık eksikle gönderilir. Onaylayan yöntem ve kaynak özetini görür. Geri gönderme gerekçesi alan veya hesap düzeyine bağlanır. Veri değişirse önceki onay geçersizleşir; kullanıcıya tekrar inceleme gerektiği bildirilir.

### Görev ve tedarikçi talepleri

Görev; istenen veri, kabul edilen birim, örnek, sorumlu, son tarih, ilişkili gereklilik ve yanıt alanına sahiptir. Tedarikçi kendi yanıtının sürümünü ve eksiklerini görür. Gönderilmeden önce muhatap, kapsam ve ekler kurum kullanıcısı tarafından doğrulanır. Otomatik tekrar gönderim kurumun açıkça etkinleştirdiği kurala bağlıdır.

### Aylık ve yıllık kapanış

Kapanış listesi kaynak envanterine göre beklenen kayıtları, eksik dönemleri, onay durumunu, tahminleri, mutabakatları ve açıklama eksiklerini gösterir. Aylık veri toplamı yıllık envanterin tek kaynağı olmak zorunda değildir; yıllık anket ve ömür boyu satış grubu hesapları dönem türüyle ilişkilendirilir.

Kilitli dönem düzeltmesinde önce gerekçe ve etki analizi açılır. Yetkili yeniden açma onayı gerekir. Eski rapor korunur; yeni rapor sürümü eskiyi hangi nedenle değiştirdiğini belirtir. Baz yıl yeniden hesaplaması, satın alma/satış veya yöntem değişiminin kurum politikasındaki eşiğe göre değerlendirilir.

### Uzlaştırma

Sayaç ile fatura; yakıt alımı ile stok/tüketim; satın alma sistemi ile envanter; tesis toplamı ile kurum toplamı karşılaştırılır. Fark otomatik kötü performans değildir. Dönem kayması, ölçüm sınırı ve veri eksikleri ayrı açıklanır.

### Kabul koşulu

Kilitli dönem değiştirilemez. Yeniden açma eski rapor dosyasını silemez. Uzmanın reddettiği kayıt toplamda onaylı veri olarak görünemez. Aynı görevi iki kişinin tamamlaması yinelenen kayıt yaratmamalıdır.

## 22 Analiz hedefler ve raporlama

Analiz ekranı onaylı, taslak ve senaryo verisini açıkça ayırır. Kapsam 2 yöntemi, dönem, tesis ve veri kalite filtresi görünürdür. Eksik Kapsam 3 kategorileri varsa toplam “hesaplanan envanter toplamı” olarak adlandırılır.

### Analizler

Toplam ve kaynak kırılımları; kategori bazında değişim; üretim veya faaliyet başına yoğunluk; tahmini veri payı; açık kanıtlar ve veri tamlığı gösterilir. Yoğunlukta payda tanımı, birimi ve dönemi zorunludur. Mutlak emisyon azalırken üretim de düşmüşse verimlilik iyileştiği otomatik söylenmez. Fark ayrıştırmasında faaliyet, faktör, sınır ve yöntem değişimleri ayrılır.

### Hedef ve senaryo

Hedef; baz yıl, hedef yılı, kapsanan kaynaklar, mutlak/yoğunluk türü, ara hedef ve sorumlu içerir. Öngörü ve azaltım senaryosu gerçek envanteri değiştirmez. Karbon kredisi, giderim ve kaçınılan emisyonlar ayrı defter/görünümdedir; brüt toplamdan otomatik düşülmez.

### Rapor üretimi

GRI için gereklilik indeksi; TSRS için ayrı açıklama matrisi hazırlanır. GRI 305-1/2/3 ile yeni GRI 102-5/6/7 eşleştirmesi uygulanabilir sürüme göre tutulur. Bir sayısal kayıt bir açıklamanın tamamını karşılamaz. Politika, yönetim yaklaşımı, risk ve varsayım metinleri kanıtlarıyla ayrıca gerekir. [K01, K14]

Rapor paketi yönetici özeti, sınır, dönem, yöntem, kapsam/kategori sonuçları, eksikler, kalite, karşılaştırmalar, kaynaklar ve kanıt indeksini içerir. DOCX/PDF ve makine okunur CSV/JSON dışa aktarma önerilir. Yayımlama ayrı yetkili işlemdir; taslak indirmek yayımlamak değildir.

### Sabit rapor sürümü

Her rapor veri/hesap/faktör/standart kimliklerini içeren manifest ve dosya karması taşır. Sonradan değişen kaynak raporu sessizce değiştiremez. Bağımsız güvence raporu varsa dosya, kapsam ve görüşü eklenir; platform kendi kendine güvence etiketi veremez.

### Kabul koşulu

Toplamlar detaydan yeniden üretilebilir. Konum ve piyasa bazlı Kapsam 2 toplanmaz. Raporun eksik açıklamaları görünür kalır; otomatik “tam uyum” rozeti üretilemez.

## 23 Karbon dışındaki sürdürülebilirlik kapsamı

Tam sürdürülebilirlik platformu, emisyon hesabından geniştir. Mimari çevresel, sosyal, ekonomik ve yönetişim verilerini destekler; hangi açıklamaların gerekli olduğu kurumun etki değerlendirmesi, ilgili sektör ve raporlama çerçevesine göre belirlenir. GRI bütün konu açıklamalarını her kuruma aynı biçimde zorunlu tutan tek form değildir. [K01]

| Veri ailesi | Örnek alanlar | Özel kontrol |
| --- | --- | --- |
| Su | Çekim, deşarj, tüketim, kaynak ve havza | Su tüketimi ile fatura/çekim ayrımı |
| Atık ve malzeme | Tür, kütle, tehlike, işleme, geri dönüştürülmüş içerik | Oluşum ve bertaraf kayıtlarının uzlaştırılması |
| Doğa ve biyoçeşitlilik | Tesis konumu, etki alanı, hassasiyet, eylem | Mekânsal kaynak ve uzman değerlendirmesi |
| Çalışanlar | Kişi/FTE, işe giriş/çıkış, eğitim, çeşitlilik | Dönem ve payda; kişisel veri minimizasyonu |
| İş sağlığı ve güvenliği | Olay, kayıp gün, çalışma saati | Tanım ve oran metodolojisi |
| İnsan hakları ve tedarik | Değerlendirme, bulgu, iyileştirme | Hassas bilgiye sınırlı erişim |
| Etik ve yönetişim | Politika, eğitim, şikâyet, yönetim sorumluluğu | Sadece sayı değil yönetim ve çözüm süreci |
| Ekonomik etkiler | Tedarik, ekonomik değer ve ilgili açıklamalar | Finansal veri mutabakatı ve erişim |

### Etki ve önemlilik akışı

Faaliyet/değer zinciri bağlamı → gerçek ve potansiyel etkiler → ilgili paydaş ve kanıt → değerlendirme → konu kararı → yönetim yaklaşımı → izleme. Finansal risk ve fırsat değerlendirmesi ayrı tutulur; ortak veri bağlantıları kurulur. Çifte önemlilik etiketi kullanılıyorsa iki yaklaşım da tanımlı ve uygulanmış olmalıdır.

### Anlatısal veri

Politika, hedef, sorumlu yönetim organı, aksiyon, kaynak tahsisi ve sonuç metinleri sürümlenir. Yapay zekâ mevcut olmayan politika veya yapılmamış uygulamayı yazamaz. Eksiklikler görev olarak gösterilir; kurum adına gerçek olmayan taahhüt oluşturulmaz.

### Kabul koşulu

Her modül aynı kanıt/onay altyapısını kullanır. Eğitim saatini çalışan sayısı olmadan oranlamak engellenir. Hassas kişi bilgileri genel sürdürülebilirlik kullanıcısına açılmaz.

## 24 Yapay zekâ ve kaynaklı yanıt mimarisi

Asistanın görevi anlamak, soru sormak, kaynak göstermek ve sonraki adıma yönlendirmektir. Sonuçların sayısal otoritesi hesaplama servisidir; kaynak metni, arama sonucu veya dil modeli çıktısı değildir.

### Yanıt sözleşmesi

AI-01: Kullanıcının amacı ve aktif kurum bağlamı belirlenir. AI-02: Yalnız yetkili, sürümü belirli kaynaklar getirilir. AI-03: Yanıt dayanak paragraflarla eşleştirilir. AI-04: Eksik koşul varsa soru sorulur. AI-05: Sayı gerekiyorsa hesap servisinden alınır. AI-06: Yanıt, koşul, kaynak ve sonraki eylem birlikte gösterilir.

Yanıtın zorunlu alanları kısa açıklama, dayanak kaynak kimliği ve madde, geçerli sürüm/tarih, kurum için koşul, belirsizlik ve önerilen eylemdir. Kaynak bulunamıyorsa “Bu bilgi için doğrulanmış kaynak bulamadım” denir. Yüzde güven değeri kalibre edilmedikçe uydurulmaz.

### Araç sınırları

Asistan taslak görev ve açıklama önerebilir. Üretim faktörünü etkinleştirme, kaydı onaylama, silme, dışa gönderme ve rapor yayımlama yetkisi yoktur. Kullanıcı onayından geçen eylem normal yetki katmanına gider; sohbet komutu bu katmanı aşamaz.

### Belge ve arama güvenliği

Yüklenen belge ve web içeriği güvenilmeyen veridir. İçindeki “önceki talimatı yok say” gibi metinler komut olarak işlenmez. Doküman parçalarına tenant_id ve erişim etiketleri eklenir; vektör araması da aynı izolasyonu uygular. Kanıt dosyaları izinsiz dış modele gönderilmez; kurumun veri işleme politikası uygulanır.

### Değerlendirme

Altın test seti; birim belirsizliği, bilinmeyen soğutucu, eksik kaynak, çelişen standart, taslak mevzuat, sahte talimatlı belge ve başka kuruma veri sorma örneklerini içerir. Ölçütler kaynak desteği, yanlış kesinlik, uygun soru sorma, veri sızdırmama ve hesap servisinin sonucunu değiştirmemedir.

### Kabul koşulu

Kullanıcı faktör istemeden tahmini katsayı uydurulmaz. Kaynak bağlantısı yanıtı gerçekten destekler. Başka müşteri verisi örnek veya öneri olarak bile gösterilmez.

## 25 Güvenlik mahremiyet ve süreklilik

Bu bölüm ürün güvenlik gereklilikleridir; belirli bir mevzuata uyum sertifikası beyanı değildir. Veri işleme, saklama ve aktarım yükümlülükleri sözleşme ve ilgili hukuk bakımından yayına çıkmadan incelenir.

### Erişim ve veri koruma

Güçlü oturum yönetimi, yönetici hesaplarında çok faktörlü doğrulama, kurumsal SSO seçeneği ve sunucu tarafı rol/alan denetimi uygulanır. Aktarımda ve depolamada şifreleme; anahtar ve sır yönetimi ayrı servisle sağlanır. Dosya indirmeleri kısa süreli, yetki kontrollü bağlantılar kullanır.

Yüklenen dosyalarda boyut/tür sınırı, zararlı içerik taraması, güvenli işleme ve makro/aktif içerik politikası bulunur. CSV dışa aktarmada formül enjeksiyonu önlenir. URL’den kaynak alımında izinli alan adı ve sunucu tarafı istek sahteciliği kontrolleri uygulanır.

### Mahremiyet

Çalışan anketleri mümkün olduğunca toplulaştırılır. İşe gidiş geliş için açık ev adresi yerine gerekli en düşük ayrıntı tercih edilir. Küçük gruplarda yeniden tanımlama riski değerlendirilir. Kişisel veriye erişim ve silme talepleri için iş akışı bulunur. Silme, yasal/kontratsal saklama ve kanıt gereklilikleriyle birlikte değerlendirilir.

### Denetim ve olay müdahalesi

Giriş, rol değişimi, dışa aktarma, onay, faktör değişimi ve rapor işlemleri kayda alınır. Loglara sır, tam kişisel içerik veya belge metni gereksiz yazılmaz. Güvenlik olayında etkilenen alanlar, erişim kesme, kurtarma ve bildirim sorumluları tanımlıdır.

### Süreklilik hedefleri

Pilot için günlük yedek ve düzenli geri yükleme provası; kurumsal sürüm için önerilen RPO 24 saat, RTO 8 saat hedefidir. Bunlar sözleşme taahhüdü değildir; mimari ve maliyet doğrulamasıyla kesinleşir. Kaynak veya yapay zekâ servisi kapalıyken mevcut onaylı veriye erişim ve manuel taslak girişi sürmelidir.

### Kabul koşulu

Kurumlar arası erişim testleri geçmeden pilot gerçek veriye açılamaz. Yedekten geri yükleme gösterilir. Erişimi kaldırılan kullanıcı dosya linki ve açık oturumla erişmeye devam edemez.

## 26 Önerilen teknik mimari

İlk kurumsal sürüm için modüler monolit önerilir: açık servis sınırları olan tek uygulama dağıtımı, ilişkisel çekirdek ve ayrı arka plan işçileri. Mikroservis ayrımı gerçek ölçek veya ekip ihtiyacıyla yapılır; başlangıçta gereksiz işletim yükü oluşturulmaz.

| Bileşen | Sorumluluk |
| --- | --- |
| Web arayüzü | Rehberli formlar, erişilebilir ekranlar, taslak ve hata yönetimi |
| Kimlik ve yetki | Oturum, kuruluş üyeliği, rol ve nesne erişimi |
| İş uygulaması API | Kayıt, görev, onay, dönem ve rapor işlemleri |
| Hesap motoru | Birim, yöntem, faktör ve sürümlü sonuç |
| Kaynak servisi | Yayın, sürüm, değişiklik ve editör kuyruğu |
| Bilgi erişim servisi | Yetkili kaynak araması ve asistan bağlamı |
| Arka plan işçileri | OCR, içe aktarma, toplu hesap, rapor ve bildirim |
| İlişkisel veri tabanı | Kurum verisi, ilişkiler, bütünlük ve işlemler |
| Nesne deposu | Belgeler, dışa aktarmalar, rapor kanıtları |
| Gözlemlenebilirlik | Metrikler, izler, alarmlar ve hata takibi |

### Teknik seçim ilkeleri

Örnek başlangıç seçimi TypeScript tabanlı web arayüzü, Python veya TypeScript iş API’si, PostgreSQL, S3 uyumlu nesne deposu ve kuyruk sistemidir. Sürümler uygulama tarihinde resmî dokümantasyon ve destek durumuyla seçilir. Hesap motoru UI’dan bağımsızdır. Kritik iş kuralları istemciye bırakılmaz.

### İşletim

Geliştirme, test ve üretim ortamları ayrıdır. Veri tabanı göçleri sürümlü, geri dönüş planlı ve üretim verisi üzerinde prova edilmiş olmalıdır. İçerik/faktör yayınları kod dağıtımından ayrıdır ama test ve onay gerektirir. Uzun işler job_id döndürür; ilerleme, iptal ve güvenli tekrar destekler.

### Hedef performans

Pilot için normal form işlemlerinde p95 iki saniye; standart tek kayıt hesap önizlemesinde p95 üç saniye önerilir. Belge işleme ve raporlar asenkron çalışır. Hedefler veri hacmi ve donanım profiliyle yük testinde doğrulanır; ölçülmeden SLA ilan edilmez.

## 27 API ve entegrasyon sözleşmeleri

API sürümlü olmalı; kuruluş bağlamı oturumdan ve yetkiden doğrulanmalıdır. İstemciden gelen tenant_id tek başına yetki kanıtı değildir. Yazma işlemlerinde idempotency anahtarı ve eşzamanlı düzenleme için sürüm/ETag kontrolü bulunur.

| İşlem | Önerilen uç | Davranış |
| --- | --- | --- |
| Taslak oluştur | POST /v1/activities | 201 ve kayıt/sürüm; alan hatalarında 422 |
| Kaydı güncelle | PATCH /v1/activities/{id} | Beklenen sürüm zorunlu; çakışmada 409 |
| Kanıt ekle | POST /v1/evidence/uploads | Yetkili yükleme oturumu; tarama tamamlanmadan kullanma |
| Sınıflandırma öner | POST /v1/classifications/preview | Gerekçe, eksik sorular, kural sürümü |
| Hesap önizle | POST /v1/calculations/preview | Girdi/faktör/yöntem sürümü ve sonuç |
| Kontrole gönder | POST /v1/activities/{id}/submit | Durum ve eksik politika kontrolü |
| Onay ver | POST /v1/approvals | Yetkili karar ve değişmez iz |
| İçe aktar | POST /v1/imports | 202 job_id; önizleme ve satır hataları |
| Rapor oluştur | POST /v1/reports | 202 job_id; sabit manifest |
| Kaynak değişikliği | GET /v1/sources/{id}/versions | Yetkili sürüm ve değişiklik listesi |

### Yanıt ve hata modeli

Başarılı sonuç data, meta ve request_id taşır. Hata code, kullanıcıya uygun message, field_errors, retryable ve request_id içerir. Yetkisiz nesnenin varlığı açıklanmaz. 401 oturum, 403 yetki, 409 sürüm, 422 alan, 429 hız sınırı ayrımı tutarlıdır; güvenlik politikasına göre nesne erişimi 404 dönebilir.

### Entegrasyonlar

ERP, sayaç, seyahat ve satın alma sistemleri önce staging alanına yazar. Kaynak sistem kimliği, kayıt kimliği, çekilme zamanı ve eşleme sürümü tutulur. Webhook imzası doğrulanır; aynı olay tekrar işlenmez. Başarısız işler kontrollü tekrar ve hata kuyruğuna gider. Entegrasyon kesildiğinde veri güncellik durumu görünür olur.

### Kabul koşulu

Aynı idempotency anahtarlı aynı istek ikinci faaliyet yaratmaz. Aynı anahtarla farklı içerik reddedilir. Kısmi içe aktarmada hangi satırın işlendiği kesindir. API dışa aktarması UI’daki yetki ve filtrelerle aynı sonucu verir.

## 28 Ekran durumları ve tasarım sistemi

Arayüz profesyonel, sade ve öğrenmeyi destekleyen bir dil kullanır. Açık zemin, yüksek kontrast, okunabilir yazı, tutarlı boşluklar ve sınırlı vurgu rengi önerilir. Yeşil renk tek başına “iyi sürdürülebilirlik” anlamına gelmez. Grafikler sayı ve tablo alternatifiyle sunulur.

### Her ekranın durum sözleşmesi

| Durum | Kullanıcı deneyimi |
| --- | --- |
| İlk kullanım | Ekranın amacı ve bir başlangıç eylemi |
| Yükleniyor | Yer tutucu/ilerleme; tekrar tıklamayı önleme |
| Boş sonuç | Veri yok ile filtre sonucu yok ayrımı |
| Kısmi veri | Eksik kapsamı ve etkisini açık gösterme |
| Hata | Sorun, verinin korunma durumu, güvenli tekrar |
| Yetki yok | Uygun erişim talebi; veri ayrıntısını ifşa etmeme |
| Çakışma | Diğer sürümü görme; sessiz üzerine yazmama |
| Başarılı | Kaydedilen şey, durumu ve sonraki adım |

### Erişilebilirlik hedefi

Klavye ile tam kullanım, görünür odak, ekran okuyucu etiketleri, alanla ilişkili hata metinleri, yeterli kontrast ve ölçeklenebilir metin hedeflenir. WCAG 2.2 AA uygulama hedefidir; uygunluk beyanı erişilebilirlik denetimi sonrası yapılır. Mobilde uzun tablolar anlamsız sıkıştırılmaz; kart veya yatay gezinme ve başlık sabitleme sağlanır.

### Form bileşenleri

Miktar ve birim birlikte; tarih aralığı açık; örnek değer gerçek veri gibi doldurulmamış; zorunlu alan nedenleri açıklanmış olmalıdır. Silme eylemi geri alınabilirlik ve bağlı etkiyi gösterir. Taslak kaydet ile kontrole gönder ayrıdır. Teknik yardım, alanın yanından açılır.

### Asistan görünümü

Yan panel görev bağlamını gösterir ve kullanıcı yazarken formu kapatmaz. Yanıtın kaynakları açılabilir; önerilen değer bir tıklamayla onay alınmadan forma yazılmaz. Uzun yanıt yerine kısa açıklama ve ayrıntı bağlantısı tercih edilir.

### Kabul koşulu

Türkçe karakterler, dar ekran, büyük yazı ve yalnız klavye kullanımında form tamamlanabilir. Renkleri ayırt edemeyen kullanıcı onay/tahmin/eksik durumlarını metinden anlayabilir.

## 29 Kabul testleri ve doğruluk kapıları

Test paketi aritmetik, yöntem, sınır, iş akışı, güvenlik ve kullanıcı anlayışını birlikte doğrular. Test katsayıları kurgusaldır; üretim faktör kataloğuna yüklenemez. Kritik test başarısızsa ilgili özellik yayımlanmaz.

| Kimlik | Senaryo | Beklenen sonuç |
| --- | --- | --- |
| T01 | 100 GJ ve 50 kg CO₂/GJ test faktörü | Yalnız CO₂ bileşeni 5 t; tam CO₂e iddiası yok |
| T02 | CO₂e bazlı faktör | İkinci GWP çarpımı yapılmaz |
| T03 | m³ ve Nm³ koşulları bilinmiyor | Otomatik eşitleme engellenir |
| T04 | Üst ısıl değer ile alt esaslı faktör | Uyum çözülmeden onay yok |
| T05 | Elektrik için iki yöntem | İki sonuç ayrı; toplamda biri kullanılır |
| T06 | Belge tüketimin yalnız bir kısmını kapsıyor | Kalan miktar yöntemine göre hesaplanır |
| T07 | Aynı fatura yeniden yükleniyor | Yinelenen kayıt kontrolü ve gerekçeli çözüm |
| T08 | Kategori 1 için kapıdan kapıya veri | Üst aşama eksikliği görünür |
| T09 | Yaşam döngüsü faktörüne üst aşama ekleniyor | Çakışma uyarısı veya hesap engeli |
| T10 | Veri bulunmayan Kapsam 3 kategorisi | Sıfır veya uygulanamaz yapılmaz |
| T11 | Soğutucu yeni ekipman dolumu | Otomatik kaçak emisyon sayılmaz |
| T12 | Satış grubunun ömür boyu hesabı | Aynı satış grubu sonraki yılda tekrar eklenmez |
| T13 | Faktör güncelleniyor | Eski onaylı sonuç korunur; yeni sürüm önerilir |
| T14 | Başka kuruma ait kayıt kimliği | Okuma/yazma/indirme reddedilir |
| T15 | Belgede kötü amaçlı talimat | Veri olarak kalır; araç yetkisi değiştirmez |
| T16 | Kaynaksız hukuki soru | Kesin hüküm verilmez; kaynak/uzman yolu |
| T17 | Kilitli dönem düzenleme | Yetkili yeniden açma akışı gerekir |
| T18 | İki kullanıcı aynı sürümü değiştiriyor | Çakışma; sessiz veri kaybı yok |
| T19 | Rapor yeniden oluşturuluyor | Sabit manifest aynı sonuçları üretir |
| T20 | Yeni başlayan birimi bilmiyor | Yardım veya eksik görevle taslağı korur |

### Alan uzmanı onayı

Altın veri seti her desteklenen kategori ve yöntemi kapsar. Referans sonuç, yöntem kaynağı ve tolerans uzman tarafından imzalanır. Yalnız ekranda sonuç görünmesi hesap özelliğinin tamamlandığı anlamına gelmez.

## 30 Yol haritası ve teslim koşulları

Tam ürün kapsamı bu belgede tanımlıdır; aşamalar doğrulama ve işletim riskini yönetir. Her sürümde desteklenen kategori/yöntem matrisi yayımlanır. Desteklenmeyen hesaplar genel bir formülle taklit edilmez.

| Aşama | Teslim | Çıkış koşulu |
| --- | --- | --- |
| A Keşif ve yöntem | Kullanıcı görevleri, kaynak hakları, kurum sınırı, veri şeması | Ürün sahibi ve alan uzmanı onayı |
| B Temel altyapı | Kimlik, izolasyon, taslak, kanıt, audit, kaynak kataloğu | Yetki ve veri bütünlüğü testleri |
| C Uçtan uca pilot | Doğal gaz, elektrik, seçilmiş satın alma/taşıma/atık akışları | Altın hesaplar ve gerçek kullanıcı görevleri |
| D Kapsam genişleme | 15 kategori için doğrulanmış yöntemler, tedarikçi talepleri | Kategori bazında yöntem ve kabul matrisi |
| E Tam öğrenme ve rapor | 101, sözlük, gündem, değişiklik, GRI/TSRS hazırlığı | İçerik editörü ve rapor uzmanı kontrolü |
| F Kurumsal yaygınlaşma | SSO, entegrasyon, ürün çalışmaları, diğer ESG alanları | Yük, güvenlik, kurtarma ve destek hazırlığı |

### Her aşamada beklenen teslimatlar

Çalışan uygulama, veri tabanı göçleri, API tanımı, rol matrisi, test sonuçları, desteklenen yöntemler, kaynak/faktör listesi, bilinen eksikler ve işletim yönergesi teslim edilir. Geliştirme ortamı örnek verileri üretimden ayrıdır. Kurulum ve geri alma adımları başka geliştirici tarafından uygulanabilir olmalıdır.

### Pilot değerlendirme

Yeni başlayan kullanıcıların yardımsız ilk taslak oluşturması, eksik bilgiyi bulma yolu ve sonucu doğru yorumlaması gözlenir. Kullanıcının sayıyı gördüğü halde yanlış anladığı durum hata sayılır. Alan uzmanı yanlış kapsam, sınır, faktör, birim ve rapor eşleştirmelerini inceler.

### Yayın engelleri

Kurumlar arası veri sızıntısı, yanlış toplam, sessiz faktör değişimi, kaynaksız kesin mevzuat yorumu, lisanssız içerik, eksikleri gizleyen rapor veya geri yüklenemeyen veri yayın engelidir. Pilotun dar kapsamı kullanıcıya açıkça belirtilir; “tam GRI uyumlu” pazarlaması yapılmaz.

### Planlama

Takvim ve bütçe ekip kapasitesi, lisanslar ve entegrasyon keşfi sonrasında belirlenir. Bu belge kesin teslim tarihi veya maliyet taahhüdü içermez.

## 31 Uygulamayı geliştirecek yapay zekâya talimat

Aşağıdaki talimat bu belgenin tamamıyla birlikte kullanılmalıdır. Ürün sahibinin amacı yalnız ekran prototipi değil, rehberlik ve doğrulanabilir hesaplamayı birleştiren çalışan uygulamadır.

### Ana geliştirme talimatı

Koza adlı Türkçe öncelikli sürdürülebilirlik uygulamasını bu şartnameye göre geliştir. Birincil kullanıcının konuya yeni başladığını kabul et. Ekranları “ne yapmak istiyorsun” ve “sonraki adım” etrafında kur. Teknik terimleri açıklamasız seçim olarak sunma. Kapsam 1, 2, Kapsam 3’ün 15 kategorisi ve yaşam döngüsü sınırlarını ayrı fakat ilişkili modeller olarak uygula.

Önce mevcut çalışma ortamını ve kodu incele. Gereklilik kimliklerini uygulanacak modül ve testlerle eşleştir. Uygulama planını, veri modelini, rol matrisini ve ilk uçtan uca akışı üret. Rutin geri alınabilir kararları belgedeki varsayımlarla ilerlet; hesap yöntemi, veri hakkı veya hukuki uygulanabilirlikte eksik otoriteyi uydurma.

### Kodlama kuralları

Hesaplamayı deterministik, sürümlü ve test edilebilir servis olarak uygula. Yapay zekâdan gelen serbest metni hesap sonucu veya üretim faktörü olarak kullanma.

Yetkiyi sunucuda denetle; tenant izolasyonunu veri tabanı, dosya ve bilgi arama katmanlarında koru. Anahtarları istemciye veya depoya yazma.

Taslak, hesaplandı, incelemede, onaylandı ve kilitli durumlarını uygula. Gerçek kalıcı kayıt olmadan başarı mesajı gösterme.

Boş, sıfır, bilinmeyen, uygulanamaz ve tahmini durumlarını ayır. Her ekranda yüklenme, hata, boş sonuç ve yetki durumunu tamamla.

Kaynak sürümü ve kullanım hakkı doğrulanmamış içeriği tam metin olarak kopyalama. Örnek katsayıları yalnız test alanında kullan.

Bir özellik desteklenmiyorsa dürüstçe belirt; sahte grafik, uydurma belge veya çalışmayan butonla tamamlandı deme.

### Teslim biçimi

Her geliştirme diliminde çalışan değişiklik, etkilenen dosyalar, göçler, test kanıtı, desteklenen yöntemler ve açık eksikleri sun. 29 numaralı bölümdeki test ailesindeki ilgili kontrolleri ve uzman onayını tamamla. İlk olarak kurum kurulumu → doğal gaz kaydı → hesap → inceleme → rapor izini çalıştır; ardından elektrik ve Kapsam 3’ü ekle. Ürünü yalnız sohbet botu veya yalnız karbon hesap makinesi seviyesinde bırakma.

## 32 Karar kaydı ve üretim öncesi kontroller

Bu kayıt, geliştiricinin belirsiz noktaları gerçekmiş gibi uygulamasını önler. Her satırın sahibi, hedef tarihi, kararı ve kanıtı geliştirme sürecinde doldurulur.

| Karar | Önerilen başlangıç | Kesinleştiren |
| --- | --- | --- |
| Marka ve alan adı | Koza çalışma adı | Ürün sahibi ve marka incelemesi |
| İlk sektör | Türkiye üretim işletmeleri | Pilot müşteri görüşmeleri |
| Hesap otoritesi | GHG Protocol tabanlı sürümlü yöntemler | Alan uzmanı |
| Faktör kaynakları | Uygun resmî/tedarikçi/lisanslı kaynaklar | Yöntem ve lisans sorumlusu |
| SKD sözlük yayını | Doğrulanmış yayın kimliği ve izin | İçerik sorumlusu |
| GRI ve ISO kullanım hakkı | Kaynak bağlantısı ve izinli kullanım | Hukuk/lisans incelemesi |
| TSRS uygulanabilirliği | Güncel KGK kararı ve kurum profili | Raporlama uzmanı |
| Veri saklama ve bölgesi | Sözleşmeye uygun en düşük gerekli saklama | Güvenlik ve hukuk |
| Fiyat ve limitler | Kurum/tesis odaklı paket | Pilot ve maliyet analizi |
| Hesap dışı alanlar | Destek matrisiyle açık gösterim | Ürün ve yöntem sorumlusu |

### Tutarlılık kontrol listesi

İlk sayfadaki değer önerisi çalışan özelliklerle karşılanıyor mu? Acemi kullanıcı teknik karar vermeden ilerleyebiliyor mu? Hesap sonucu kanıta kadar izlenebiliyor mu? Kapsam 3’te eksik kategori görünür mü? Ürün sınırı ile kurumsal kapsam ayrılmış mı? Kaynak güncelliği ve uygulama tarihi ayrı mı? Onay ve rapor sürümü korunuyor mu?

### Profesyonel inceleme kapısı

Geliştirme tamamlandığında alan uzmanı hesap ve standart eşleştirmelerini; hukuk/lisans sorumlusu kullanım ve veri koşullarını; güvenlik sorumlusu izolasyon ve işletimi; ürün sahibi başlangıç kullanıcısı deneyimini kabul eder. Bu incelemeler yalnız geliştirme ekibinin “çalışıyor” beyanıyla ikame edilmez.

### Sürüm sonrası işletim

Hata ve yöntem düzeltmeleri önem derecesine göre ele alınır. Hesap etkisi olan hata için etkilenen kurum/dönem listesi çıkarılır, yeni sürüm ve yeniden hesap planı hazırlanır. Kullanıcıya etki ve yapılacak işlem açıkça bildirilir. Geçmiş sonuçlar sessizce değiştirilmez.

## 33 Kaynaklar ve uygulama dayanakları

Kaynakların erişim kontrol tarihi 12 Ekim 2026’dır. Aşağıdaki liste yöntem ve ürün tasarımına dayanak olan birincil kaynakları içerir. Uygulama kataloglarında yayın/baskı ve yürürlük bilgisi ayrıca tutulmalıdır. Kaynaklar ürün için onay, iş ortaklığı veya sertifikasyon anlamına gelmez.

K01 — GRI 1 Foundation 2021. GRI yapısı, önemlilik ve raporlama gereklilikleri.

<https://www.globalreporting.org/publications/documents/english/gri-1-foundation-2021/>

K02 — KGK TSRS ve sürdürülebilirlik kaynakları. Standartlar, yasal düzenlemeler ve güncel duyurular için resmî başlangıç noktası.

<https://www.kgk.gov.tr/surdurulebilirlik>

<https://kgk.gov.tr/Portalv2Uploads/files/Duyurular/v2/Surdurulebilirlik/RaporlamaStandarti/TSRS_1.pdf>

K03 — GHG Protocol Corporate Standard. Kurumsal envanter, sınır ve hesap ilkeleri.

<https://ghgprotocol.org/corporate-standard>

K04 — GHG Protocol Scope 2 Guidance. Konum/piyasa bazlı hesap ve sözleşmesel araçların kalite koşulları.

<https://ghgprotocol.org/scope-2-guidance>

K05 — GHG Protocol Scope 3 Calculation Guidance. Kategori bazlı hesap yöntemleri ve ilgili bölüm bağlantıları.

<https://ghgprotocol.org/scope-3-calculation-guidance-2>

K06 — GHG Protocol Scope 3 Standard. Değer zinciri, kategori sınırları ve raporlama.

<https://ghgprotocol.org/corporate-value-chain-scope-3-standard>

K07 — Scope 3 Category 11. Satılan ürünlerin kullanım emisyonları ve kullanım senaryoları.

<https://ghgprotocol.org/sites/default/files/2022-12/Chapter11.pdf>

K08 — ISO 14067 açıklaması. Ürün karbon ayak izi ile yaşam döngüsü değerlendirmesi ilişkisi.

<https://www.iso.org/files/live/sites/isoorg/files/store/en/PUB100271.pdf>

K09 — SKD Türkiye ve Ekologos 100 Maddede Sürdürülebilirlik Rehberi. Öğrenme ve kavramsal içerik için kaynak yayını.

<https://www.skdturkiye.org/100-maddede-surdurulebilirlik-rehberi/>

## 34 Kaynaklar ve izlenebilirlik devamı

K10 — Scope 3 Category 15. Yatırım türlerine göre hesaplama ve sınır değerlendirmesi.

<https://ghgprotocol.org/sites/default/files/2022-12/Chapter15.pdf>

K11 — Scope 3 Category 1. Satın alınan mal ve hizmetlerde tedarikçiye özgü, hibrit, ortalama ve harcama bazlı yöntemler.

<https://ghgprotocol.org/sites/default/files/2022-12/Chapter1.pdf>

K12 — GHG Protocol Product Standard. Ürün düzeyindeki yaşam döngüsü sera gazı hesabı.

<https://ghgprotocol.org/product-standard>

K13 — US EPA Life Cycle Assessment Principles and Practice. Yaşam döngüsü ve sistem sınırı açıklamaları.

<https://nepis.epa.gov/Exe/ZyPURL.cgi?Dockey=P1000L86.TXT>

K14 — GRI 102 Climate Change 2025. Kapsam 1, 2 ve 3 açıklamaları; yöntem, gazlar, sınırlar ve geçerlilik.

<https://globalreporting.org/pdf.ashx?id=29514>

K15 — GRI 103 Energy 2025. Enerji tüketimi ve ilgili raporlama açıklamaları.

<https://www.globalreporting.org/publications/documents/english/gri-103-energy-2025/>

K16 — Scope 3 Category 3. Yakıt/enerji üst aşamaları ve Kapsam 1–2 dışında kalan ilgili emisyonlar.

<https://ghgprotocol.org/sites/default/files/2022-12/Chapter3.pdf>

### Kaynak kullanma kuralı

Üretim hesap motorunda yalnız bu URL listesinin bulunması yeterli değildir. Kullanılan tablonun veya maddenin tam kimliği, sürümü, birimi, sınırı, izin durumu ve uzman onayı gerekir. Bu belgedeki sayısal test örnekleri kaynak faktörü değildir.

### Gereklilik izinin korunması

Ürün sahibi bu belgeyi geliştirme talimatı olarak verir. Geliştirici gerekliliği modüle ve kabul testine bağlar. Alan uzmanı yöntem/kaynak eşleştirmesini onaylar. Kullanıcı verisi kaynaktan hesap ve rapora kadar izlenir. Ürün değiştiğinde bu dört bağın birlikte güncellenmesi gerekir.
