# KOZA — Ekip Çalışma Dosyası

Üretim tarihi: 2026-10-14. Bu dosya depodaki tüm proje belgelerini tek yerde toplar; ekip bunun üzerinden çalışır. Kaynak dosyalar depoda ayrı ayrı durur; bu dosya `python3 docs/birlestir.py` ile yeniden üretilir, elle düzenlenmez. Uygulama: https://ecloudtechnology.github.io/koza/ · Depo: https://github.com/ecloudtechnology/koza

## İçindekiler

- **A. Projeye giriş**
  - [README](#readme)
  - [Ekip ve mentor](#ekip-ve-mentor)
  - [İnceleme rehberi](#inceleme-rehberi)
  - [Geliştirme kuralları](#gelistirme-kurallari)
- **B. Grubun forum çıktıları**
  - [ESG balık kılçığı: çözüm önerileri (TR)](#esg-balik-kilcigi-cozum-onerileri-tr)
  - [ESG fishbone: solution proposals (EN)](#esg-fishbone-solution-proposals-en)
  - [Sistem mimarisi ve karar akışı notu](#sistem-mimarisi-ve-karar-akisi-notu)
- **C. Ürün şartnamesi**
  - [Şartname v1.0 (§01–§34)](#sartname-v1-0-01-34)
  - [v1.1 gereklilik eki](#v1-1-gereklilik-eki)
  - [v1.1 rehber (uzun biçim)](#v1-1-rehber-uzun-bicim)
- **D. Kararlar ve izleme**
  - [Karar kaydı](#karar-kaydi)
  - [Gereklilik izleme matrisi](#gereklilik-izleme-matrisi)
  - [Teslim notu](#teslim-notu)
- **E. Tasarım ve mimari**
  - [Rol ve yetki matrisi](#rol-ve-yetki-matrisi)
  - [Veri modeli ve göçler](#veri-modeli-ve-gocler)
  - [Geliştirici iş akışı](#gelistirici-is-akisi)
  - [Hesap motoru sözleşmesi v0.1](#hesap-motoru-sozlesmesi-v0-1)
  - [Hesap motoru sözleşmesi v0.2](#hesap-motoru-sozlesmesi-v0-2)
  - [Hesap motoru README](#hesap-motoru-readme)
  - [İş API'si README](#is-api-si-readme)
  - [Web modül sözleşmesi](#web-modul-sozlesmesi)
- **F. Süreç ve işletim**
  - [Dilim döngüsü](#dilim-dongusu)
  - [Kural kontrol listesi](#kural-kontrol-listesi)
  - [Üretime geçiş yönergesi](#uretime-gecis-yonergesi)
- **G. Ekler**
  - [Hata sözlüğü](#hata-sozlugu)
  - [Sektör profilleri (YAML)](#sektor-profilleri-yaml)


---

# A. Projeye giriş


## README

<a id="readme"></a>

*Kaynak dosya: `README.md`*

## Koza

Sürdürülebilirlik görevine yeni başlayan çalışanı adım adım yönlendiren, veriyi kanıtıyla toplayan, hesabı denetlenebilir motorla yapan ve sonucu rapora bağlayan, her sektöre uyarlanabilir uygulama. **Hesabı motor yapar; yapay zekâ açıklar ve yönlendirir.**

Bu depo, MEXT "İş Dünyasında Sorumlu Üretim" çalışma grubunun forum çıktısını (ESG balık kılçığı, altı katmanlı sistem mimarisi, TR ETS eki) ürün şartnamesine ve çalışan bir iskelete bağlar. Önizleme grup incelemesi içindir; üretim değildir.

### Önizleme

- Yayın: GitHub Pages (`.github/workflows/pages.yml`), statik dışa aktarma. Adres depo ayarlarında "Pages" altında görünür.
- Önizlemede kayıtlar yalnız tarayıcıda saklanır; hesap motoru (Python) tarayıcıda Pyodide ile çalışır; tüm faktörler kurgusal test değerleridir. İnceleme yolu: `docs/inceleme-rehberi.md`.
- Nereden başlamalı: önizlemede **Belgeler → İnceleme rehberi**, sonra **Ana sayfa → Sonraki adım**.

### Depo düzeni

```
GELISTIRME-KURALLARI.md                  # 12 değiştirilemez kural, dilim sırası, komutlar
docs/
  spec/                    # Şartname v1.0 (§01–§34), v1.1 eki, v1.1 rehber
  forum/                   # Forum bulguları (TR/EN), sistem mimarisi ve karar akışı notu
  kaynak/                  # Özgün DOCX / Pages / ZIP dosyaları
  karar-kaydi.md           # K-01…K-17 açık kararlar
  gereklilik-izleme.{json,md}   # Gereklilik kimliği → durum → kanıt
  inceleme-rehberi.md      # Grup için 10 dakikalık inceleme yolu
  teslim-notu-dilim-0-1.md # Teslim notu: karşılanan kimlikler, test kanıtı, açık eksikler
  rol-matrisi.md  veri-modeli.md  gelistirici-is-akisi.md  api/openapi.yaml  img/
apps/web/                  # Arayüz (Next.js, TypeScript, statik dışa aktarma)
apps/api/                  # İş API'si (FastAPI): yetki, iş akışı, idempotency, denetim izi
packages/calc-engine/      # Deterministik hesap motoru koza_calc (saf Python, Decimal, I/O yok)
content/
  sector-profiles/         # SEK: şema + genel, agir-sanayi, gida-icecek (YAML, sürümlü, taslak)
  terms/  lessons/  sources/    # Sözlük, ders iskeletleri, kaynak kartları
db/migrations/             # PostgreSQL: tenant_id + RLS + append-only (up/down)
tests/golden/              # 32 kurgusal altın senaryo (T01–T04, T20 …)
tests/factors/             # Kurgusal test faktör kataloğu (yalnız test ve önizleme)
tests/isolation/           # Kurumlar arası erişim testleri (T14)
docs/surec/                # dilim döngüsü ve kural kontrol listesi
docs/uretime-gecis.md      # üretim altyapısı adımları
```

### Çalıştırma

```bash
# Hesap motoru + API + izolasyon testleri
python3 -m venv .venv && . .venv/bin/activate
pip install -e packages/calc-engine -e "apps/api[dev]"
pytest -q

# Arayüz (geliştirme)
cd apps/web && npm install && npm run dev

# Statik dışa aktarma (GitHub Pages için NEXT_PUBLIC_BASE_PATH=/koza)
cd apps/web && npm run build   # → apps/web/out
```

### Durum (14 Ekim 2026)

Tüm dilimler (0–8) uygulandı: kurulum, tüm kaynak türleri için veri girişi (OCR, CSV/XLSX), Kapsam 1–2–3 ve ürün hesapları (motor 0.2.0, 200 test, 77 altın senaryo), inceleme/onay/dönem/rapor paketi, analiz/hedef/RACI, aksiyon döngüsü, Green Kaizen, tedarikçi programı, regülasyon paketleri, senaryo defteri, gündem, 101, protokoller, sözlük, kaynaklı asistan; API PostgreSQL deposu ve kalan uçlar. Gereklilik bazında kanıt: `docs/gereklilik-izleme.md`. Teslim notu: `docs/teslim-notu-dilim-0-1.md`. Üretim adımları: `docs/uretime-gecis.md`.

### Ekip

Çalışma grubu: Muhammet Polat, Enes Koç, Çağla Kumru, Elif Sarıkaş, Havva Dönmez, Mısra Toprak, Okan Yılmaz, Zeynep Esmer. Mentor: Onur Dedeoğlu. Ayrıntı: `docs/ekip.md`.

### Geri bildirim

Konu açarken gereklilik kimliğini yazın (ör. `DAT-04`, `T07`, `K-06`); izleme matrisine doğrudan işlenir.

### Lisans ve içerik hakları

Standart metinleri kopyalanmaz; yalnız resmî bağlantı ve özgün kısa açıklama kullanılır (K-12). Test katsayıları kurgusaldır ve üretim kataloğuna giremez (kural 12).


## Ekip ve mentor

<a id="ekip-ve-mentor"></a>

*Kaynak dosya: `docs/ekip.md`*

## Ekip

MEXT Teknoloji Merkezi · GreenSync Young Professionals Forum · Tema: İş Dünyasında Sorumlu Üretim

### Çalışma grubu

- Muhammet Polat
- Enes Koç
- Çağla Kumru
- Elif Sarıkaş
- Havva Dönmez
- Mısra Toprak
- Okan Yılmaz
- Zeynep Esmer

### Mentor

- Onur Dedeoğlu

### Grubun çıktıları

| Çıktı | Depodaki yeri |
| --- | --- |
| ESG balık kılçığı: çözüm önerileri (EN, özgün) ve TR çevirisi; Ek B TR ETS (Enes Koç) | `docs/forum/YPF-ESG-cozum-onerileri-{EN,TR}.md`, kaynak `docs/kaynak/YPF-ESG-Fishbone-Solution-Proposals.docx` |
| Sürdürülebilirlik odaklı sistem mimarisi ve karar akışı (Havva Dönmez) | `docs/forum/sistem-mimarisi-karar-akisi.md`, kaynak `docs/kaynak/Sistem-Mimarisi-Karar-Akisi-Notu.docx` |
| KOZA v1.1 ürün yönü ve yapay zekâ geliştirme rehberi | `docs/spec/KOZA_v1.1_rehber.md`, `docs/spec/KOZA_v1.1_gereklilikler.md` |
| KOZA Ürün ve Geliştirme Şartnamesi v1.0 | `docs/spec/KOZA_sartname_v1.0.md`, kaynak `docs/kaynak/KOZA_Urun_ve_Gelistirme_Sartnamesi.pages` |

İsimler grup tarafından bildirilen listedir; rol ve iletişim bilgisi grubun onayıyla eklenir.


## İnceleme rehberi

<a id="inceleme-rehberi"></a>

*Kaynak dosya: `docs/inceleme-rehberi.md`*

## İnceleme rehberi — MEXT "İş Dünyasında Sorumlu Üretim" grubu için

Bu önizleme, grubun forum çıktısını (ESG balık kılçığı, altı katmanlı mimari, TR ETS eki) tam işlevli bir ürüne bağlar. Hiçbir ekran "bitmiş gibi" süslenmemiştir: çalışmayan buton, uydurma grafik ve gerçek olmayan katsayı yoktur; her sayı motordan, her karar yetkiden geçer.

### 1. Neye bakıyorsunuz

| Alan | Sekmeler |
| --- | --- |
| Başlangıç | Koza nedir? · Ekip |
| Veri ve hesap | Kurum kurulumu · Veri girişi (tüm kaynak türleri, OCR) · İçe aktarma (CSV/XLSX) · Emisyon envanteri (Kapsam 1/2/3, 15 kategori) · Ürün ve yaşam döngüsü · Faktör kataloğu |
| Kontrol ve rapor | Görevler · İnceleme kuyruğu · Dönem kapanışı (uzlaştırma, kilit, yeniden açma) · Raporlar (manifest, GRI/TSRS indeksi, JSON/CSV/DOCX/yazdır, yayım, güvence) |
| Performans ve katılım | Analiz ve hedefler (gösterge sözlüğü, yoğunluk, hedef kartı, RACI) · Karar kapısı ve aksiyon · Green Kaizen |
| Dış ilişkiler ve uyum | Tedarikçi programı · Regülasyon paketleri (CBAM, ulusal ETS/MRV, TSRS, AB tedarik) · Senaryo defteri · Gündem ve takvim |
| Öğrenme ve kaynak | Sürdürülebilirlik 101 (10 ders) · Protokoller ve standartlar · Sözlük (48 terim) · Asistan (kaynaklı, kural tabanlı) |
| Yönetim ve doğrulama | Kurum ayarları · Denetim izi · Proje durumu · Belgeler · Altın set · Hata sözlüğü |

### 2. Yirmi dakikalık inceleme yolu

1. **Koza nedir?** → problem, iki hedef, altı katman, ilkeler.
2. **Kurum kurulumu** → NACE `C24` ağır sanayi profilini önerir (`C10` gıda; boş → genel). Tesis, dönem, sınır ("bilmiyorum" → uzman görevi), kaynak envanteri (yakıt, elektrik, soğutucu, satın alma).
3. **Veri girişi** → doğal gaz faturası: miktara `1.234` yazın (ayraç sorulur), birimde "bilmiyorum" (taslak + görev, T20), dosya yükleyin ve aynı dosyayı tekrar yükleyin (mükerrer, T07). "Belgeden oku" ile bir fatura görüntüsünden alanları çıkarın; her alan tek tek onaylanır.
4. **Kayıt sayfası** → Önizle: `m³` + koşul yok → engel (T03); HHV → engel (T04); CO₂e + gaz faktörü birlikte → engel (T02). Engellerde "neden / ne yapmalı" sözlükten gelir. Koşuyu kaydedin; iz kaydı sonuçtan faktöre ve kaynağa gider.
5. **Elektrik kaydı** → konum ve piyasa bazlı iki sonuç ayrı; menşe garantisi tüketimi aşarsa engel (T06); toplamda kullanılan yöntemi seçin (T05).
6. **Soğutucu kaydı** → "yeni ekipman dolumu" emisyon sayılmaz (T11); "ekleme" inceleme ister.
7. **Kapsam 3** → kategori 1 ortalama veri ile kapıdan kapıya faktör: üst aşama eksik uyarısı (T08); kategori 11 ömür boyu: aynı satış grubu ikinci yıl tekrar eklenemez (T12); veri yoksa "bilinmiyor", sıfır değil (T10).
8. **Kontrole gönder → İnceleme** → onaylayan rolüyle onaylayın; aynı kullanıcı kendi kaydını onaylayamaz (§04). Onaylı kaydı değiştirin: onay geçersizleşir (§21).
9. **Faktör kataloğu** → uzman rolünde yeni sürümü etkinleştirin: eski sonuç korunur, yeni koşu önerilir (T13).
10. **Dönem kapanışı** → uzlaştırma listesi, kilit, yeniden açma (gerekçe + etki, T17).
11. **Raporlar** → paket oluşturun; toplamlar motorun `aggregate()` çıktısı; Kapsam 2 alternatif yöntem ayrı gösterilir, toplanmaz; ürün çalışması ayrı bölümde. Yeniden oluşturun: aynı karma (T19). CSV/DOCX/yazdır alın; yayım kilitli dönem ister.
12. **Analiz** → payda girilmeden yoğunluk hesaplanmaz; üretim düşerken "verimlilik arttı" denmez; hedef kartı ve RACI.
13. **Aksiyon** → sapma → ön değerlendirme ("bilinmiyor" varsayılan) → seçenekler → pilot → ölçüm → kapı; etki ölçülmeden kapanmaz.
14. **Green Kaizen** → 3 alanlı öneri; elçi değerlendirmesi; birim düzeyinde toplam, kişi sıralaması yok.
15. **Tedarikçi programı** → kritik %20; talep ilk ekranda gizlilik taahhüdü; dış gönderim yetkili onayı ister.
16. **Regülasyon paketleri** → doğrulanmamış kuralla paket açılmaz; kaynak sürümü → değişiklik kartı → uzman onayı akışı.
17. **Senaryo defteri** → gölge karbon fiyatı ve tahsis senaryoları envanteri değiştirmez (rapor karması aynı kalır).
18. **Asistan** → "CO₂e ne demek?", "Kaydım ne durumda?", "Raporlamak zorunda mıyım?" (hüküm vermez); fatura metni yapıştırıp sahte talimat ekleyin: veri olarak işlenir (T15). Değerlendirme setini çalıştırın.
19. **Altın set** → 77 senaryo aynı motorla tarayıcıda koşar.
20. **Hata sözlüğü** → her kodun kaynağı, nedeni, sonucu, eylemi.

### 3. Sizden beklenen geri bildirim

- Belgeler: şartname ve v1.1 eki forum bulgularını doğru karşılıyor mu? (`docs/spec/KOZA_v1.1_gereklilikler.md` §2)
- Karar kaydı: K-02…K-15 için kim, ne zaman? Özellikle profil onayı (K-02), hesap otoritesi ve faktör kataloğu (K-04/K-05), ETS/CBAM/TSRS resmî metinleri (K-06/K-07/K-08), KVKK (K-09).
- Akış: yeni başlayan bir çalışan kapsam terimini bilmeden ilk taslağı oluşturabiliyor mu? Nerede takıldınız, hangi metin anlaşılmadı?
- Sektör profilleri: `content/sector-profiles/*.yaml` sorular, paydalar, öncelikler doğru mu? Hangi profil eksik?
- Yöntem: altın setteki senaryolar alan uzmanının beklediği davranışı veriyor mu? İmzalanabilir mi?

Geri bildirimi depo konuları (GitHub Issues) veya grup kanalı üzerinden gereklilik kimliğiyle (ör. `DAT-04`, `T07`, `K-06`) verin; izleme matrisine doğrudan işlenir.

### 4. Önizlemenin doğası

- Kayıtlar bu tarayıcıda saklanır; başka cihazda görünmez; "Kurum ayarları → sıfırla" her şeyi siler.
- Tüm faktörler kurgusaldır; sonuçlar gerçek emisyon değildir. Gerçek katalog uzman onayıyla yüklenir.
- Hesap motoru, OCR, XLSX ve DOCX kütüphaneleri ağdan yüklenir; yüklenemezse ekran bunu söyler, sahte sonuç göstermez.
- Üretimde aynı kurallar sunucu ve PostgreSQL üzerinde çalışır (`docs/uretime-gecis.md`).

### 5. Depo ve yerel çalıştırma

```
git clone https://github.com/ecloudtechnology/koza
cd koza/apps/web && npm install && npm run dev            # arayüz
python3 -m venv .venv && . .venv/bin/activate
pip install -e packages/calc-engine -e "apps/api[dev]"
pytest -q                                                 # motor + API + izolasyon
```


## Geliştirme kuralları

<a id="gelistirme-kurallari"></a>

*Kaynak dosya: `GELISTIRME-KURALLARI.md`*

## Geliştirme kuralları — Koza

Bu dosya, Koza'yı geliştiren herkesin her çalışma oturumunda okuduğu kurallar belgesidir. Kısa tutulur; ayrıntı `docs/` altındadır.

### Ürün tek cümlede

Koza, sürdürülebilirlik görevine yeni başlayan çalışanı adım adım yönlendiren, veriyi kanıtıyla toplayan, hesabı denetlenebilir motorla yapan ve sonucu rapora bağlayan, **her sektöre uyarlanabilir** bir uygulamadır.

**Hesabı motor yapar; yapay zekâ açıklar ve yönlendirir.**

### Kaynak belgeler ve öncelik sırası

1. `docs/spec/KOZA_v1.1_gereklilikler.md` — v1.1 eki (sektör uyarlama, aksiyon döngüsü, Green Kaizen, regülasyon paketleri…). Çelişkide **v1.1 geçerlidir**.
2. `docs/spec/KOZA_sartname_v1.0.md` — ana şartname (§01–§34). Bölüm numarasıyla atıf yap: `§18`.
3. `docs/gelistirici-is-akisi.md` — geliştirme döngüsü ve sistem akışı şemaları.
4. `docs/karar-kaydi.md` — açık kararlar. Belirsiz bir noktayı burada çözmeden kodlama.

Gereklilik kimlikleri: v1.0 (`ONB-01`, `DAT-03`, `MTH-02`, `SRC-05`, `AI-04`, testler `T01–T20`) ve v1.1 (`SEK`, `GÖS`, `AKS`, `KZN`, `REG`, `TDR`, `ÖĞR`). Her commit ve PR karşıladığı kimlikleri yazar.

### Değiştirilemez kurallar

Bunlardan birini çiğneyen değişiklik "tamamlandı" sayılmaz.

1. **Deterministik hesap.** Sayısal sonuç yalnız `packages/calc-engine` üretir. Aynı girdi + faktör sürümü + yöntem sürümü = aynı sonuç. LLM çıktısı hiçbir zaman sayı, faktör veya sınıflandırma kararı olarak kaydedilmez.
2. **Durumlar ayrıdır.** `NULL`=bilinmiyor, `0`=ölçülmüş sıfır, `not_applicable`=gerekçeli karar, `estimated`=veri niteliği. API, ekran, dışa aktarma ve raporda bu ayrım korunur. Eksik veriye asla sıfır atanmaz.
3. **Tenant izolasyonu her katmanda.** DB (RLS + `tenant_id` FK doğrulaması), nesne deposu, vektör/arama indeksi. İstemciden gelen `tenant_id` yetki kanıtı değildir.
4. **Yetki sunucuda.** Arayüzde gizlemek yetkilendirme değildir. Veri giren ile onaylayan varsayılan olarak farklıdır.
5. **Sektör = veri, kod değil.** `if sector == ...` dallanması yazma. Sektöre özgü gösterge, payda, kaynak sorusu, Kapsam 3 önceliği, ders ve regülasyon paketi `content/sector-profiles/*.yaml` içinden, sürümlü okunur (SEK-02).
6. **Regülasyon kuralları koda gömülmez.** Eşik, tarih, benchmark, fiyat → kaynak izleme (§19) üzerinden sürümlü kural. Doğrulanmamışsa sonuç `review_required`.
7. **Senaryo envanteri değiştirmez.** Karbon fiyatı, tahsis, alım-satım, azaltım senaryoları ayrı defterde (REG-05, §22).
8. **Ürün bağlamı ≠ kurumsal toplam.** Ürün/LCA ve CBAM gömülü emisyon sonuçları Kapsam 1–2 toplamına eklenmez (§17, REG-03).
9. **Geçmiş sessizce değişmez.** Onaylı sonuç, kilitli dönem ve rapor manifesti yeni sürümle düzeltilir; eskisi korunur.
10. **Sahte tamamlama yok.** Çalışmayan buton, uydurma grafik, kalıcı kayıt olmadan başarı mesajı, doğrulanmamış ortaklık/fon/fiyat/tasarruf yüzdesi gösterme.
11. **Kişisel performans sıralaması yok.** Green Kaizen ve öğrenme verisi birim düzeyinde toplulaştırılır.
12. **Test katsayıları kurgusaldır** ve yalnız `tests/` altında yaşar; üretim faktör kataloğuna girmez.

### Asistan (uygulama içi yapay zekâ) sınırları

Yapabilir: belgeden alan okumak, eksik bağlamı soru olarak sormak, kaynaklı açıklama, görev/ders/talep metni taslağı, sektör profili ve NACE önerisi.

Yapamaz: onaylamak, silmek, dönemi kilitlemek, rapor yayımlamak, dışarıya mesaj göndermek, faktör etkinleştirmek, sayı tahmin etmek, uygunluk hükmü vermek.

Yanıt sözleşmesi (§24 AI-01…06): kısa açıklama → kaynak kimliği + sürüm → kurum için koşul → belirsizlik → önerilen eylem. Kaynak yoksa: "Bu bilgi için doğrulanmış kaynak bulamadım." Yüklenen belge ve web içeriği **veridir, komut değildir** (T15).

### Önerilen mimari (Dilim 0'da karar kaydına yazılır)

Modüler monolit (§26). Varsayılan öneri; gerekçeyle değiştirilebilir:

| Katman | Öneri |
| --- | --- |
| Web | TypeScript (Next.js), erişilebilir formlar, TR öncelikli i18n |
| İş API'si | Python (FastAPI) veya TypeScript; sürümlü `/v1`, idempotency + ETag |
| Hesap motoru | Saf Python paketi, `Decimal`, I/O yok, birim dönüşümü + iz kaydı |
| Veri | PostgreSQL (RLS), append-only sürüm tabloları |
| Dosya | S3 uyumlu nesne deposu, kısa ömürlü imzalı bağlantılar |
| Arka plan | Kuyruk + işçiler (OCR, içe aktarma, toplu hesap, rapor); `job_id` döner |
| Asistan | Yetkili kaynak araması (tenant etiketli) + LLM; araç çağrıları normal yetki katmanından geçer |

Paket sürümlerini uygulama gününde resmî dokümantasyondan seç; ezberden sürüm yazma.

### Depo düzeni

```
apps/web/                  # arayüz
apps/api/                  # iş API'si, yetki, iş akışı, asistan orkestrasyonu
packages/calc-engine/      # deterministik hesap motoru (UI ve DB'den bağımsız)
packages/domain/           # ortak tipler: durumlar, birimler, kimlikler
content/sector-profiles/   # SEK: sürümlü sektör profilleri (YAML)
content/lessons/  content/terms/  content/sources/
db/migrations/             # sürümlü, geri dönüş planlı
tests/golden/              # uzman imzalı altın veri seti (kurgusal faktörler)
tests/isolation/           # kurumlar arası erişim testleri
docs/                      # şartname, ek, karar kaydı, iş akışı
```

### Geliştirme döngüsü (her dilim)

Ayrıntılı şema: `docs/gelistirici-is-akisi.md`. Özet:

1. **Kimliği seç** — tek bir dilim, birkaç gereklilik kimliği.
2. **Oku** — ilgili `§` bölümleri ve v1.1 maddeleri. Belirsizlik varsa `docs/karar-kaydi.md`'ye yaz ve dur; sessiz varsayım yapma.
3. **Planla** — veri modeli etkisi, göçler, API ucu, ekran durumları (§28 durum sözleşmesi).
4. **Önce testler** — kabul koşulunu teste çevir (ilgili `T` kimlikleri + v1.1 kabul maddeleri).
5. **Uygula** — en küçük çalışan değişiklik.
6. **Doğrula** — birim + altın set + izolasyon + değiştirilemez kurallar kontrolü (`/kontrol`).
7. **Teslim notu** — karşılanan kimlikler, test kanıtı, desteklenen yöntemler, bilinen eksikler.
8. **İnsan kapısı** — hesap/standart değişikliği alan uzmanı onayı olmadan "bitti" değildir.

### Dilim sırası

| Dilim | Kapsam | Çıkış koşulu |
| --- | --- | --- |
| 0 | Depo iskeleti, karar kaydı, CI, kimlik + tenant izolasyonu, audit | T14 ve izolasyon testleri geçer |
| 1 | Kurum kurulumu (ONB) → doğal gaz kaydı → hesap → inceleme → rapor | T01–T04, T07, T13, T17–T20 |
| 2 | Elektrik (konum + piyasa bazlı) ve diğer Kapsam 1 şablonları | T05, T06, T11 |
| 3 | Asistan: kaynaklı yanıt, belge güvenliği; 101 ve sözlük temeli | T15, T16 |
| 4 | SEK + GÖS: profil şeması, `genel` + 2 örnek profil, yoğunluk panosu | SEK/GÖS kabul maddeleri |
| 5 | KZN + ÖĞR: saha mobil görünüm, Green Kaizen, rol bazlı dersler | Kişi bazlı sıralama yok testi |
| 6 | AKS: sapma → görev → kök neden → düzeltici faaliyet → etki doğrulama | Etki ölçülmeden kapanmaz testi |
| 7 | TDR + Kapsam 3 (profilin öncelikli kategorileri) | T08–T10, T12 |
| 8 | REG paketleri + senaryo defteri | Senaryo envanteri değiştirmez testi |

Pilot kapısı (Dilim 1–4 sonrası): kurumlar arası erişim testi + yeni kullanıcının yardımsız ilk taslağı. Ölçekleme kapısı (Dilim 6–8 sonrası): iki hedefin eşikleri + uzman onaylı altın set.

### Komutlar

Dilim 0'da dolduruldu (13 Ekim 2026).

```
# kurulum:     python3 -m venv .venv && . .venv/bin/activate && pip install -e packages/calc-engine -e "apps/api[dev]"
#              cd apps/web && npm install
# test:        pytest -q
# altın set:   python -c "from koza_calc.golden import run_dir; print(run_dir('tests/golden'))"
# izolasyon:   pytest tests/isolation -q
# lint/tip:    cd apps/web && npx eslint src && npm run typecheck
# arayüz:      cd apps/web && npm run dev        (önizleme deposu tarayıcıda; bkz. K-16)
# API:         cd apps/api && KOZA_DEV_TOKENS='{...}' uvicorn koza_api.main:app --reload   (bkz. apps/api/README.md)
# dışa aktar:  cd apps/web && npm run build      (statik; GitHub Pages için NEXT_PUBLIC_BASE_PATH=/koza)
```

Süreç listeleri: `docs/surec/dilim.md` bir dilimi döngüye göre yürütür; `docs/surec/kontrol.md` değiştirilemez kuralları denetler.

### Dil ve üslup

Arayüz metni Türkçe, kısa ve sade. Teknik terim açıklamasız seçim olarak sunulmaz. Kod, tablo ve değişken adları İngilizce; kullanıcıya görünen metin i18n dosyalarında.


---

# B. Grubun forum çıktıları


## ESG balık kılçığı: çözüm önerileri (TR)

<a id="esg-balik-kilcigi-cozum-onerileri-tr"></a>

*Kaynak dosya: `docs/forum/YPF-ESG-cozum-onerileri-TR.md`*

## ESG Balık Kılçığı: Çözüm Önerileri (Türkçe çeviri)

GreenSync Ecosystem · Young Professionals Forum
Tema: İş Dünyasında Sorumlu Üretim · Grup: EMES

Bu metin, grubun İngilizce çalışma belgesinin (`YPF-ESG-cozum-onerileri-EN.md`) Türkçe çevirisidir. Anlaşmazlıkta İngilizce metin esastır.

**Ana problem:** İşletmede sürdürülebilirlik odaklı bir sistem mimarisi yok.
**Hedefler:** Daha yüksek verimlilik ve daha yüksek çalışan memnuniyeti.

Atölye çıktısındaki problem notları ve ESG balık kılçığındaki kök nedenler beş eksende toplandı. Her eksende grubun kendi çözümleri, ihtiyaçları ve beklenen etkileri eyleme çevrildi. Kılçığın "Diğer" dalı boş bırakıldığı için "Teknolojik altyapı" notu 2. eksene (Veri ve dijital altyapı) alındı.

### Eksenler bir bakışta

| Eksen | Ana kök nedenler | Dayandığı pano önerisi |
| --- | --- | --- |
| 1. Yönetişim | Sahiplik, öncelik, hedef ve ekip çalışması eksikliği | Sürdürülebilirlik iş akışlarını tanımla; üst yönetim katılımı; tanımlı hedefler |
| 2. Veri ve dijital altyapı | Güvenilmez, dağınık veri; zayıf altyapı | Veriyi dijitale taşı, gerçek zamanlı izle; dijital altyapı ve veri tabanı |
| 3. Tedarik zinciri | Tedarikçi verisi yok, uyum yok, denetim yok | İnsan odaklı denetim mekanizması |
| 4. Sosyal | Farkındalık düşük; operatör sürece dahil değil; nitelikli personel az | Nitelikli insan kaynağı; personel eğitimi |
| 5. Çevre ve dış ekosistem | Regülasyon, finansman, paydaş iş birliği, artan maliyetler | Kamu politikası teşvikleri; finansman |

### 1. Yönetişim: sahiplik ve öncelikler

Kök nedenler: Üst yönetim konuyu sahiplenmiyor. Ekip yok. Öncelikler, hedefler ve sorumluluklar belirsiz. Ekipler birlikte çalışmıyor. Kararlar sürdürülebilirlik düşünülerek alınmıyor.

- **Sponsor ve ekip:** Üst yönetimden bir sponsor belirlenir. Üretim, kalite, satın alma, İK, finans ve BT'den fonksiyonlar arası bir sürdürülebilirlik ekibi kurulur.
- **Tanımlı iş akışları:** RACI matrisiyle her süreçte kimin sorumlu olduğu yazılır.
- **Öncelikler:** Çifte önemlilik analiziyle 5–7 öncelikli konu seçilir; her birine ölçülebilir hedef ve sahip atanır.
- **Performans ve yatırımla bağ:** KPI'lar yönetici performans kartlarına eklenir. Her yatırım talebine "enerji/emisyon etkisi" alanı eklenir.
- **Ek bürokrasi yok:** Ayrı toplantı yerine mevcut aylık üretim toplantısına ESG maddesi eklenir.
- **Maliyet:** Enerji, hurda ve suda hızlı geri ödemeli projelerle başlanır; tasarruf sonraki yatırımı finanse eder.

### 2. Veri ve dijital altyapı: tek doğru kaynak

Kök nedenler: Güvenilir veriye ulaşmak zor. Veri dağınık yerlerden toplanıyor. Veri yönetişimi, raporlama ve analiz yok. Teknolojik altyapı zayıf.

- **Gösterge sözlüğü:** Her gösterge için tanım, birim, kaynak, veri sahibi ve güncelleme sıklığı kaydedilir.
- **Adım adım dijitalleşme:** Önce 10–15 kritik gösterge (enerji, Kapsam 1–2 emisyonları, su, atık ve hurda, iş kazaları, eğitim saati); sonra kapsam genişletilir.
- **Ölçüm:** Hat veya makine bazında enerji ve suyu ölçen akıllı sayaçlar ya da IoT sensörleri.
- **Otomatik veri akışı:** MES/ERP'den merkezî ESG veri tabanına otomatik veri; dağınık Excel dosyalarına gerek kalmaz.
- **Gerçek zamanlı pano:** kWh/ton ve kg CO₂e/ton gibi birim başına göstergeler.
- **Denetim izi:** Her rakamın nereden geldiği kayıt altında tutulur; veri CBAM, TSRS ve dış güvenceye hazır olur.

### 3. Tedarik zinciri: tedarikçinin güvenle paylaştığı veri

Kök nedenler: Tedarikçiden veri toplanamıyor. Tedarikçiler veri paylaşmaktan çekiniyor ya da hiç ulaşılamıyor. Süreçleri uyumlu değil. Denetim mekanizması yok.

- **Segmentasyon:** Tedarikçiler harcama ve emisyon yoğunluğuna göre sıralanır; kritik %20 ile başlanır.
- **Standart talep:** Kısa, standart veri talep şablonu ve tedarikçi portalı.
- **Sözleşmeler:** Sürdürülebilirlik maddeleri ve tedarikçi davranış kuralları.
- **Paylaşım endişesini azaltma:** Gizlilik anlaşması; veriyi yalnız toplulaştırılmış kullanma taahhüdü; verinin neden gerektiğinin açık anlatımı.
- **Tedarikçi geliştirme programı:** Özellikle KOBİ tedarikçilere eğitim ve ortak araçlar; veri paylaşan tedarikçiye tercihli tedarikçi statüsü.
- **İnsan odaklı denetim** (risk temelli): önce öz değerlendirme; yalnız yüksek riskte saha ziyareti; ceza yerine düzeltici plan ve koçluk.
- **Metal sektörü için kritik:** CBAM kapsamındaki ürünler için gömülü emisyon verisi sistematik olarak istenir.

### 4. Sosyal: farkındalık ve katılım

Kök nedenler: Bilgi ve farkındalık düşük. Verimlilik çalışmalarında operatörün fikri sorulmuyor. Nitelikli personel eksik.

- **Rol bazlı eğitim:** Yöneticiler: strateji ve regülasyon. Mühendis ve uzmanlar: karbon ayak izi, yaşam döngüsü değerlendirmesi ve veri. Operatörler: sahada atık, enerji ve güvenlik.
- **Operatörü tasarımın parçası yapmak:** Hat bazlı enerji ve hurda hedefleriyle "green kaizen" öneri sistemi; uygulanan öneriye takdir ve ödül. Çalışan memnuniyeti hedefini doğrudan besler.
- **Sürdürülebilirlik elçileri:** Her departmandan bir elçiyle ağ.
- **Nitelikli personel:** İşe alım ve kariyer planlarına sürdürülebilirlik yetkinliği; üniversite iş birlikleri ve staj.

### 5. Çevre ve dış ekosistem: regülasyon, finansman, paydaşlar

Kök nedenler: Paydaş iş birliği, regülasyon ve finansman boşlukları. Altyapı eksik, maliyetler artıyor.

- **Regülasyon radarı:** CBAM, TSRS, İklim Kanunu ve kurulacak emisyon ticaret sistemi, AB müşterilerinin tedarik zinciri talepleri izlenir. Tek sahip; her çeyrek etki incelemesi.
- **Fon haritası:** AB programları (Horizon Europe, LIFE, IPA), TÜBİTAK, KOSGEB, kalkınma ajansları, yeşil / sürdürülebilirlik bağlantılı krediler.
- **Sektörel ortak çalışma:** MESS, OSB'ler ve üniversitelerle ortak veri standardı, ortak tedarikçi eğitimi ve ortak proje başvurusu; maliyet bölüşülür.
- **Politika savunuculuğu:** Sektör olarak KOBİ dijitalleşmesi ve ölçüm altyapısı için teşvik talebi.

### Yol haritası

| Dönem | Odak |
| --- | --- |
| 0–6 ay | Sponsor ve ekip, önemlilik analizi, gösterge sözlüğü, kritik tedarikçi listesi, farkındalık eğitimi, hızlı kazanım projeleri |
| 6–18 ay | Ölçüm altyapısı ve ESG veri tabanı, pano, tedarikçi portalı ve sözleşme maddeleri, operatör öneri sistemi, fon başvuruları |
| 18–36 ay | Otomatik MES/ERP veri akışı, dış güvence, öngörü analizi, tedarikçi programının yaygınlaşması, uluslararası standartlara tam uyum |

### Beklenen etkiler ve ölçümü

| Etki (panodan) | Gösterge |
| --- | --- |
| Doğru veriye hızlı erişim | Otomatik toplanan veri payı (%), rapor hazırlama süresi |
| Mevcut durum ve öngörü analizi | Emisyon envanteri, birim başına enerji ve emisyon eğilimi |
| Daha nitelikli personel | Kişi başı eğitim saati, sertifikalı uzman sayısı |
| Uluslararası standartlara uyum | CBAM ve TSRS raporlarının düzeltmesiz, zamanında teslimi |
| Rekabet gücü | Yeşil koşul taşıyan müşteri ve ihracat payı |
| Daha yüksek verimlilik (ana hedef) | kWh/ton, hurda oranı |
| Daha yüksek çalışan memnuniyeti (ana hedef) | Öneri sayısı ve uygulanma payı, bağlılık skoru |

### Ek B: TR ETS entegrasyonu ve karbon varlık yönetimi (Enes Koç)

*Pasif izlemeden aktif uyuma ve sektörel iş birliğine geçiş*

**Gerekçe.** Mevcut taslakta ETS yalnız 5. eksende regülasyon radarı maddesi. Oysa İklim Kanunu ve yeni Türkiye Emisyon Ticaret Sistemi (TR ETS) ile karbon, raporlama metriğinden bilanço kalemine, finansal riske ve piyasa mekanizmasına dönüşüyor. İmalat ve metal sektörü için TR ETS, yurt içinde ödenen karbon fiyatının AB CBAM yükümlülüğünden düşülmesini sağlayan stratejik bir tampondur.

#### B.1 Operasyonel ve finansal eylemler

- **İç karbon fiyatı (Eksen 1):** Yatırım taleplerine yalnız "enerji/emisyon etkisi" notu yerine iç gölge karbon fiyatı (ör. €/tCO₂e); kaçınılan ETS uyum maliyeti yatırım getirisine yansır.
- **MRV ve güvence hazırlığı (Eksen 2):** Merkezî ESG veri tabanı ulusal İzleme, Raporlama ve Doğrulama (MRV) mevzuatıyla doğrudan uyumlu; otomatik, denetlenebilir izleme planı akredite üçüncü taraf doğrulamasını destekler.
- **Karbon portföy yönetimi (Eksen 5):** Sürdürülebilirlik, operasyon ve finans/hazine arasında ortak karbon varlık masası; tesisin baz emisyonu ulusal ücretsiz tahsis benchmark'larına karşı modellenir, fazla/açık senaryoları ve EPİAŞ'ta alım-satım stratejileri simüle edilir.

#### B.2 Ekosistem ve sektörel iş birliği

- **Tedarikçiler için ortak ETS/MRV kapasitesi:** MESS ve OSB ortaklıklarıyla "Gölge ETS Çalışma Grubu"; kritik KOBİ tedarikçilere standart MRV araç seti ve ortak karbon muhasebesi eğitimi.
- **CBAM – TR ETS mahsup uyumu:** Sektör dernekleriyle standart "Gömülü Karbon Maliyeti Doğrulama Protokolü"; yurt içinde ödenen karbon maliyeti ihracat müşterisince AB CBAM yükümlülüğünden düşülebilsin.

#### B.3 Yol haritasıyla hizalama

| Dönem | Eylem |
| --- | --- |
| 0–6 ay | Kapsam 1 sınırlarını ulusal MRV kılavuzuna eşle; yatırım onayları için baz iç gölge karbon fiyatı belirle |
| 6–18 ay | Zorunlu izleme planını dijitalleştir; ücretsiz tahsis tavanı ile gerçek üretim stres testleri; platform simülasyonlarına katılım |
| 18–36 ay | Tam ölçekli karbon varlık ve tahsis yönetimi; sürekli doğrulanmış uyum; değer zincirinde yaygın karbon maliyeti entegrasyonu |

---

KOZA'nın bu belgeyi nasıl karşıladığı: `docs/spec/KOZA_v1.1_gereklilikler.md` §2 ve `docs/gereklilik-izleme.md`. Fiyat, tahsis ve alım-satım konuları KOZA'da **senaryo defterinde** kalır (REG-05); gölge karbon fiyatının sahibi ve güncelleme sıklığı karar kaydında açıktır (K-11).


## ESG fishbone: solution proposals (EN)

<a id="esg-fishbone-solution-proposals-en"></a>

*Kaynak dosya: `docs/forum/YPF-ESG-cozum-onerileri-EN.md`*

## ESG Fishbone: Solution Proposals

GreenSync Ecosystem · Young Professionals Forum
Theme: Responsible Production in Business · Group: EMES

Source file: `docs/kaynak/YPF-ESG-Fishbone-Solution-Proposals.docx` (this Markdown is a faithful transcription; the original workshop board appears only in the source file).

**Core problem:** The company has no sustainability-focused system architecture.
**Targets:** Higher productivity and higher employee satisfaction.

This document develops the group's workshop output into concrete solution proposals. The root causes on the board's problem notes and ESG fishbone are grouped under five axes. For each axis, the group's own solutions, needs and expected effects are expanded into actions.

The fishbone's "Other" branch was left empty, so the "Technological infrastructure" note is included under Axis 2 (Data and digital infrastructure).

### Solution axes at a glance

| Axis | Main root causes | Board proposals it builds on |
| --- | --- | --- |
| 1. Governance | Lack of ownership, priorities, targets and teamwork | Define sustainability workflows; senior management involvement; defined targets |
| 2. Data and digital infrastructure | Unreliable, scattered data; weak infrastructure | Move data to digital, track in real time; digital infrastructure and database |
| 3. Supply chain | No supplier data, no alignment, no audits | People-focused audit mechanism |
| 4. Social | Low awareness; operators not involved; few qualified staff | Qualified human resources; staff training |
| 5. Environmental and external ecosystem | Regulation, financing, stakeholder cooperation, rising costs | Public policy incentives; financing |

### 1. Governance: ownership and priorities

Root causes: Senior management doesn't own the issue. There is no team. Priorities, targets and responsibilities are unclear. Teams don't work together. Decisions aren't made with sustainability in mind.

- **Sponsor and team:** Name a sponsor from senior management. Set up a cross-functional sustainability team with production, quality, purchasing, HR, finance and IT.
- **Defined workflows:** Builds on the board's "define sustainability workflows" proposal. Use a RACI matrix to set out who is responsible for each process.
- **Priorities:** Use a double materiality analysis to pick 5–7 priority topics. Give each one a measurable target and an owner.
- **Link to performance and investment:** Add the KPIs to managers' performance scorecards. Add an "energy/emissions impact" field to every investment request.
- **No extra bureaucracy:** Add an ESG item to the existing monthly production meeting instead of creating a separate one.
- **Cost:** Start with quick-payback projects in energy, scrap and water. Their savings can fund the next investments.

### 2. Data and digital infrastructure: a single source of truth

Root causes: Reliable data is hard to get. Data is collected from scattered places. There is no data governance, reporting or analysis. Technological infrastructure is weak.

Builds on: the board's "move data to digital and track it in real time" proposal, and its "digital infrastructure – database" need.

- **Indicator dictionary:** For each indicator, record its definition, unit, source, data owner and update frequency.
- **Step-by-step digitalisation:** First the 10–15 critical indicators (energy, Scope 1–2 emissions, water, waste and scrap, workplace accidents, training hours); then widen the scope.
- **Measurement:** Smart meters or IoT sensors to measure energy and water per line or machine.
- **Automatic data flow:** Pull data automatically from MES/ERP into a central ESG database, so the scattered Excel files are no longer needed.
- **Real-time dashboard:** Show per-unit indicators such as kWh/ton and kg CO₂e/ton.
- **Audit trail:** Keep a record of where each figure came from, so the data is ready for CBAM and TSRS reporting and external assurance.

### 3. Supply chain: data that suppliers share with confidence

Root causes: Data can't be collected from suppliers. Suppliers worry about sharing data, or can't be reached at all. Their processes aren't aligned. There is no audit mechanism.

- **Segmentation:** Rank suppliers by spend and emissions intensity, and start with the critical 20%.
- **Standard requests:** Use a short, standard data request template and a supplier portal.
- **Contracts:** Add sustainability clauses and a supplier code of conduct.
- **Easing data-sharing concerns:** Sign confidentiality agreements; commit to using the data only in aggregate; explain clearly why the data is needed.
- **Supplier development program:** Offer training and shared tools, especially for SME suppliers. Reward suppliers who share data with preferred-supplier status.
- **People-focused audits** (one of the board's needs), risk-based: start with a self-assessment; visit the site only when the risk is high; respond with a corrective action plan and coaching rather than penalties.
- **Critical for the metal sector:** Systematically request embedded-emissions data for products covered by CBAM.

### 4. Social: awareness and participation

Root causes: Knowledge and awareness are low. Operators aren't asked for their ideas in productivity work. Qualified staff are lacking.

Builds on: the board's "qualified human resources" proposal and its "staff training" need.

- **Role-based training:** Managers: strategy and regulation. Engineers and specialists: carbon footprint, life-cycle assessment and data. Operators: waste, energy and safety on the shop floor.
- **Make operators part of the design:** Run a "green kaizen" suggestion system with line-level energy and scrap targets. Give recognition and rewards when a suggestion is implemented. This feeds the employee-satisfaction target directly.
- **Sustainability ambassadors:** Build a network with one ambassador from each department.
- **Qualified staff:** Add sustainability skills to hiring and career plans. Set up university partnerships and internships.

### 5. Environmental and external ecosystem: regulation, financing, stakeholders

Root causes: Stakeholder cooperation, regulation and financing are gaps. Infrastructure is lacking and costs are rising.

Builds on: the board's "public policy incentives" proposal and its "financing" need.

- **Regulation radar:** Track CBAM, TSRS, the Climate Law and the emissions trading system to be set up under it, and EU customers' supply-chain requirements. Give this to one owner and run an impact review every quarter.
- **Funding map:** EU programmes (Horizon Europe, LIFE, IPA), TÜBİTAK, KOSGEB, regional development agencies, and green or sustainability-linked loans.
- **Shared work across the sector:** Work with MESS, organised industrial zones and universities on a shared data standard, joint supplier training and joint project applications. This splits the cost.
- **Policy advocacy:** As a sector, ask for incentives for SME digitalisation and measurement infrastructure.

### Roadmap

| Period | Focus |
| --- | --- |
| 0–6 months | Sponsor and team, materiality analysis, indicator dictionary, critical supplier list, awareness training, quick-win projects |
| 6–18 months | Measurement infrastructure and ESG database, dashboard, supplier portal and contract clauses, operator suggestion system, funding applications |
| 18–36 months | Automatic MES/ERP data flow, external assurance, forecasting analysis, wider rollout of the supplier program, full compliance with international standards |

### Expected effects and how to measure them

| Effect (from the board) | Indicator |
| --- | --- |
| Fast access to accurate data | Share of data collected automatically (%), time to prepare a report |
| Current-state and forecasting analysis | Emissions inventory, per-unit energy and emissions trend |
| More qualified staff | Training hours per person, number of certified specialists |
| Compliance with international standards | CBAM and TSRS reports submitted on time without corrections |
| Competitiveness | Share of customers and exports with green requirements |
| Higher productivity (core target) | kWh/ton, scrap rate |
| Higher employee satisfaction (core target) | Number of suggestions and share implemented, engagement score |

### Appendix A: Workshop board

The group's original board from the forum session (problem notes, ESG fishbone and solution proposals) is an image in the source file and is not reproduced here.

### Appendix B: TR ETS Integration and Carbon Asset Management

Contributed by Enes Koç: "I thought about going a little deeper on the ETS and drafted the proposal below."

*Transitioning from Passive Tracking to Active Compliance and Sectoral Collaboration*

**Rationale and context.** In the current working draft, the Emissions Trading System (ETS) is framed primarily as a regulatory radar item under Axis 5. However, under the Climate Law and the newly enacted Turkish Emissions Trading System (TR ETS), carbon transitions from a reporting metric into a balance sheet item, financial risk, and market mechanism. For the manufacturing and metals sector, TR ETS also serves as a strategic financial buffer, allowing domestic carbon pricing to be credited against EU CBAM liabilities. The proposal adds a three-dimensional action and collaboration framework.

#### B.1 Operational and financial actions (enhancements to existing axes)

- **Internal carbon pricing (Axis 1, Governance):** Rather than merely adding an "energy/emissions impact" note to CapEx requests, implement an internal shadow carbon price (e.g. in €/tCO₂e), so that decarbonisation investments reflect real economic returns by pricing in avoided ETS compliance costs.
- **MRV and assurance readiness (Axis 2, Data infrastructure):** Ensure the centralised ESG database directly aligns with national Monitoring, Reporting and Verification (MRV) regulations. Establish an automated, auditable monitoring plan designed to support accredited third-party verification without friction.
- **Carbon portfolio management (Axis 5, External ecosystem):** Define a joint carbon asset desk across Sustainability, Operations and Finance/Treasury. Model the facility's baseline emissions against national free-allocation benchmarks, simulating surplus/deficit scenarios and trading strategies on the energy exchange (EPİAŞ).

#### B.2 Ecosystem and sector-wide collaboration (MESS, OIZs, supply chain)

- **Joint ETS/MRV capacity building for suppliers:** Leverage Axis 3 and Axis 5 partnerships (MESS, organised industrial zones) to establish a "Shadow ETS Working Group". Provide tier-1 and critical SME suppliers with standardised MRV toolkits and joint training on carbon accounting.
- **CBAM – TR ETS deduction alignment:** Partner with sectoral associations to formulate a standard "Embedded Carbon Cost Verification Protocol", so that domestic carbon costs paid under TR ETS are credited against EU CBAM obligations by export customers.

#### B.3 Roadmap alignment

| Period | Actions |
| --- | --- |
| 0–6 months | Map Scope 1 boundaries to national MRV guidelines; establish a baseline internal shadow carbon price for investment approvals |
| 6–18 months | Digitise the mandatory monitoring plan; run stress tests on free-allowance caps versus actual output; participate in platform simulation runs |
| 18–36 months | Full-scale carbon asset and allowance management; continuous verified compliance; extended carbon cost integration across the value chain |

---

How KOZA absorbs this document: see `docs/spec/KOZA_v1.1_gereklilikler.md` §2 (axis → requirement mapping) and `docs/gereklilik-izleme.md`.


## Sistem mimarisi ve karar akışı notu

<a id="sistem-mimarisi-ve-karar-akisi-notu"></a>

*Kaynak dosya: `docs/forum/sistem-mimarisi-karar-akisi.md`*

## Sürdürülebilirlik odaklı sistem mimarisi ve karar akışı

Hazırlayan: Havva Dönmez · Kaynak dosya: `docs/kaynak/Sistem-Mimarisi-Karar-Akisi-Notu.docx` (tek sayfalık şema; bu Markdown sadık bir aktarımdır).

**Ana problem:** Sürdürülebilirlik odaklı sistem mimarisi bulunmuyor.

| Hedef | Tanım |
| --- | --- |
| Hedef 1 · Verimlilik | Kaynak tüketimi, hurda ve süreç kayıplarını azaltmak |
| Hedef 2 · Çalışan memnuniyeti | Katılım, yetkinlik, güvenlik ve çalışma deneyimini iyileştirmek |

### Altı katman

1. **Strateji ve sahiplik** — Yönetim sponsoru → süreç sahipleri → ortak hedefler → bütçe ve yetki.
2. **Süreç mimarisi** — Üretim, yatırım, satın alma, İK ve bakım süreçlerinde sürdürülebilirlik karar kapıları.
3. **Veri yönetişimi** — KPI tanımı → veri sahibi → ölçüm standardı → kalite kuralı → erişim yetkisi.
4. **Entegrasyon katmanı** — ERP + MES + sayaç/IoT + çevre + İK + tedarikçi → API / kontrollü veri girişi.
5. **Ortak ESG veri katmanı** — Enerji • su • emisyon • atık • üretim • İSG • çalışan • finans • tedarikçi.
6. **Karar ve aksiyon motoru** — KPI sapması → görev → kök neden → düzeltici faaliyet → etki doğrulaması.

| Çıktı türü | İçerik |
| --- | --- |
| Operasyonel | Hat bazlı verimlilik projeleri, yatırım öncelikleri, kaynak optimizasyonu |
| İnsan odaklı | Green Kaizen, eğitim, iş yükü/ergonomi kontrolü, çalışan geri bildirimi |
| Kurumsal | Yönetim panosu, uyum veri seti, tedarikçi geliştirme, denetlenebilir kayıt |

### Sistemin işleyişi: karar akışı

Süreç sahipleri, veri akışı ve iyileştirme kararları tek bir işletim döngüsünde çalışır.

| Adım | Kapı | İçerik |
| --- | --- | --- |
| 1 Başlat | Yeni ihtiyaç veya performans sapması | Yeni yatırım, hat değişikliği, tüketim artışı, çalışan önerisi ya da mevzuat gereksinimi |
| 2 Ön değerlendir | Sürdürülebilirlik karar kapısı | Enerji, su, karbon, hurda, İSG, ergonomi, iş yükü ve maliyet etkilerini belirle |
| 3 Veriyi doğrula | Güvenilir kayıt | Veri sözleşmesi testleri: kaynak, birim, zaman, tutarlılık; uygunsuz kayıt → düzeltme kuyruğu |
| 4 Seçenek üret | Karşılaştırmalı karar | Alternatif proses / ekipman / çalışma yöntemi; ekonomik ve çevresel fayda ile çalışan etkisini birlikte karşılaştır |
| 5 Pilot uygula | Saha ve çalışan katılımı | Üretim, bakım, İK, İSG ve çalışan temsilcileriyle kontrollü deneme; eğitim ve geri bildirim |
| 6 Sonucu ölç | İki hedefi birlikte doğrula | Baz dönem ile kWh/ton, hurda, m³/ton, öneri uygulama oranı ve çalışan memnuniyet skorunu karşılaştır |
| 7 Karar | Ölçekleme kapısı | Her iki hedef eşiği karşılıyorsa standardize et ve yaygınlaştır; değilse kök neden ve yeniden tasarım |

### Yönetim modeli ve uygulama planı

| Mimari bileşen | Sorumlu birimler | Somut teslimat | Başarı ölçütü |
| --- | --- | --- | --- |
| Yönetişim ve strateji | Üst yönetim, sürdürülebilirlik, finans | Hedef kartı, RACI, yatırım onay kuralları | Hedef sahibi atanma oranı |
| Süreç mimarisi | Üretim, bakım, satın alma, İK | Karar kapıları ve süreç akışları | ESG değerlendirmesinden geçen değişiklik oranı |
| Veri ve entegrasyon | BT, enerji, çevre, kalite | Veri sözleşmeleri, entegrasyon, kontrol kayıtları | Otomatik veri ve geçerli veri oranı |
| Karar ve aksiyon | Üretim, bakım, İSG | Sapma uyarısı, görev, düzeltici faaliyet | Aksiyon kapanış süresi, tekrar eden sapmalar |
| Çalışan deneyimi | İK, İSG, üretim | Green Kaizen, eğitim ve etki kontrolü | Memnuniyet skoru, uygulanan öneri oranı |
| Tedarik ve dış paydaş | Satın alma, sürdürülebilirlik | Tedarikçi veri ve gelişim programı | Katılan kritik tedarikçi oranı |
| Güvence ve süreklilik | BT, iç kontrol, sürdürülebilirlik | Denetim izi, yedek süreç, veri mutabakatı | Veri kesintisi ve düzeltme süresi |

---

KOZA'daki karşılığı: katman 3 → GÖS, katman 4–5 → §11/§18/§20/§27, katman 6 → AKS (v1.1). Karar akışının 3. adımı (veri sözleşmesi testleri) GÖS-04; 6–7. adımlar AKS-04. Ayrıntı: `docs/spec/KOZA_v1.1_gereklilikler.md` §2.


---

# C. Ürün şartnamesi


## Şartname v1.0 (§01–§34)

<a id="sartname-v1-0-01-34"></a>

*Kaynak dosya: `docs/spec/KOZA_sartname_v1.0.md`*

> Kaynak: KOZA Ürün ve Geliştirme Şartnamesi, Sürüm 1.0 (12 Ekim 2026). Pages belgesinden metin ve tablolar otomatik aktarılmıştır; görseller/diyagramlar bu dosyada yer almaz.

## KOZA

Öğrenme, gelişme ve dönüşüm için destekleyici bir alan.

### Proje özeti

Koza, sürdürülebilirlik görevine yeni başlayan çalışanların ne yapacaklarını öğrenirken kurumsal verilerini doğru toplamalarını, hesaplamalarını ve raporlamaya hazırlamalarını sağlayan rehberli bir uygulamadır. Ürün, öğrenme içeriğini günlük iş akışına ve kaynakları izlenebilen veri altyapısına bağlar.

Sorun: Yeni çalışan; hangi verinin istendiğini, nereden alınacağını, hangi birimle girileceğini ve sonucun hangi raporda kullanılacağını çoğu zaman bilmiyor. Dağınık dosyalar, değişen kaynaklar ve açıklanamayan hesaplar kurum içinde tekrar iş yaratıyor.

Hedef kullanıcı ve müşteri: Birincil kullanıcı deneyimi sınırlı yeşil yakalı; satın alan taraf sürdürülebilirlik yöneticisi veya işletme. İlk odak Türkiye’de üretim yapan işletmeler; sonraki genişleme danışmanlık şirketleri, hizmet işletmeleri ve eğitim kurumları.

Değer önerisi: Kullanıcıya anlaşılır bir sonraki adım; kuruma kanıtı, yöntemi, kaynağı ve onayı izlenebilen veri. Başarı; ilk doğru kayda ulaşma süresi, düzeltme oranı, kanıt tamlığı ve dönem kapanış süresiyle ölçülür. Sayısal kazanım vaatleri pilot sonuçlarıyla belirlenecektir.

Nasıl çalışır: Kurumu tanı → görev planı oluştur → kısa açıklamayla veri topla → uygun yöntemle hesapla → sonucu açıkla → uzman kontrolüne gönder → rapora bağla. Kapsam 1, 2 ve Kapsam 3’ün 15 kategorisi ortak envanterde; ürün yaşam döngüsü çalışmaları ilişkili fakat ayrı hesap bağlamında yönetilir.

Gelir modeli: Yıllık veya aylık kurumsal abonelik; tesis sayısı, aktif kullanıcı, entegrasyon ve işlem hacmine göre paketleme. Ek gelirler veri aktarımı ve kurulum, kurum eğitimleri, tedarikçi portalı ve gelişmiş entegrasyonlardır. Temel öğrenme alanı ücretsiz veya deneme erişimli olabilir. Kesin fiyatlandırma pilotta doğrulanacaktır.

Ürün farkı: Öğretici görevler, güncel kaynak kontrolü, sürümlü hesaplama ve onaylı rapor hazırlığı aynı iş akışındadır. Hesabı yapay zekâ değil denetlenebilir hesap motoru yapar; yapay zekâ açıklar ve yönlendirir.

Ürün ve geliştirme şartnamesi • Sürüm 1.0 • 12 Ekim 2026

### 01 Belgenin kullanımı ve karar düzeyi

Bu belge ürün sahibinin, tasarımcının, sürdürülebilirlik uzmanının ve uygulamayı geliştirecek yapay zekânın ortak çalışma sözleşmesidir. Ekranların görünümünden önce kullanıcı problemi, veri doğruluğu ve kabul koşulları uygulanır. Belge çalışan bir uygulamanın teslim edildiği anlamına gelmez.

#### Gereklilik dili

Zorunlu: İlk ilgili sürümde karşılanmadan tamamlandı denemez. Önerilen: Gerekçeli teknik kararla değiştirilebilir. Sonraki aşama: Mimari hazır tutulur; çalışıyormuş gibi gösterilmez. Kaynaklardan türetilen açıklamalar [K01] biçiminde kaynak numarası taşır. Kaynaksız tasarım maddeleri bu ürün için önerilen gerekliliklerdir.

#### Bölüm haritası

| Katman | Bölümler | Beklenen çıktı |
| --- | --- | --- |
| Ürün ve deneyim | 02–06 | İş modeli, roller, navigasyon, kurulum |
| Bilgi ve öğrenme | 07–10 | 101, protokoller, gündem, sözlük |
| Veri ve hesap | 11–19 | Giriş, kapsamlar, sınırlar, faktörler, güncellemeler |
| İşletim ve raporlama | 20–23 | Veri modeli, iş akışı, rapor, ESG kapsamı |
| Güven ve mühendislik | 24–28 | Yapay zekâ, güvenlik, mimari, API, ekran sözleşmeleri |
| Doğrulama ve teslim | 29–34 | Testler, yol haritası, yapay zekâ talimatı, kararlar, kaynaklar |

#### Temel sınırlar

Türkiye başlangıç pazarı ve Türkçe başlangıç dilidir. Çoklu ülke ve İngilizce desteği veri modelinde hazırlanır. Standartların güncel yayınları, yürürlük tarihleri ve ülkeye özgü yükümlülükler üretim sürümü öncesinde yeniden doğrulanır. Bir yazılımın kullanılması tek başına GRI veya TSRS uyum beyanı, bağımsız güvence ya da resmî sertifika sağlamaz.

Koza ürün adı önerisidir. Ticari kullanımdan önce marka, alan adı ve benzer ürün adı incelemesi yapılır. Kurumsal müşteri, fiyat, tasarruf yüzdesi, ortaklık veya devlet desteği kazanılmış kabul edilmez.

#### Belge değişiklik yönetimi

Her revizyonda değişiklik nedeni, etkilenen gereklilikler ve kabul testleri kaydedilir. Alan uzmanı hesap ve standart kurallarını; ürün sahibi deneyim ve öncelikleri; teknik sorumlu uygulama ve güvenliği onaylar. Çelişen gereklilikler karar kaydına alınır; yapay zekâ sessiz varsayım yapmaz.

### 02 Ürün ilkeleri ve hedef kullanıcı

Birincil kullanıcı konuya yeni başlamıştır. Kapsam, faktör, GWP, önemlilik veya sistem sınırı terimlerini bilmesi beklenmez. Arayüz, kullanıcının uzmanlık açığını güvenilir iş akışlarıyla karşılamalıdır.

#### Değiştirilemez deneyim kuralları

Kullanıcıdan bilmediği teknik sınıflandırmayı seçmesi istenmez. Faaliyeti, belgeyi ve iş ilişkisini anlatması istenir; önerinin gerekçesi gösterilir.

Her adımda neden istendiği, nereden bulunacağı, örneği ve “Bilmiyorum” yolu bulunur. Bilgi yoksa eksik durum saklanır; sıfır atanmaz.

Açıklama önce iki veya üç kısa cümledir. Ayrıntı, yöntem ve kaynak isteğe bağlı açılır. Yanlış anlaşılabilecek sonuçlarda kritik koşul gizlenmez.

Öğrenme ve çalışma bağlantılıdır. Bir dersin sonunda gerçek veri görevi; veri görevinde ilgili kısa ders açılır. Öğrenme denemeleri kurumsal envantere karışmaz.

Hesaplanan, tahmini, incelenmiş ve onaylı sonuçlar farklı statülerle gösterilir. Renk tek durum göstergesi olamaz.

Asistan kullanıcı adına kayıt silemez, dönemi kilitleyemez, rapor yayımlayamaz veya dış kişiye mesaj gönderemez; ilgili yetkili işlem açık eylem gerektirir.

GRI tamamlama oranı sürdürülebilirlik başarısı puanı değildir. Eğitim başarısı da mesleki yetkinlik belgesi olarak sunulmaz.

#### Kullanıcıların işleri

Yeni çalışan “İlk faturayı doğru gireyim ve ne yaptığımı anlayayım” der. Veri sağlayıcı “Benden istenen bilgiyi kısa sürede teslim edeyim” der. Uzman “Varsayımları ve hesapları kontrol edeyim” der. Yönetici “Eksikleri, riskleri ve dönem kapanışını göreyim” der. Bu kullanıcılar aynı ayrıntı düzeyine zorlanmaz.

#### Başarı göstergeleri

İlk doğru kayıt süresi, kullanıcı düzeltme sayısı, kanıtı tam kayıt oranı, kategori bazında veri kapsamı, yanlış kaynaklı yanıt oranı ve uzman incelemesinde geri dönen kayıt oranı izlenir. Pilot başlangıcında mevcut süreç ölçülür; pilot sonunda aynı tanımlarla karşılaştırılır. Başarı hedefleri ürün hedefidir; doğrulanmış pazar sonucu değildir.

### 03 İş modeli ve ticari işletim

#### Paket önerisi

| Paket | Hedef | İçerik |
| --- | --- | --- |
| Öğrenme | Bireysel başlangıç | 101, sözlük, örnek veri ortamı, sınırlı kaynaklı soru |
| Ekip | Tek kuruluş | Rehberli kayıt, emisyon envanteri, onay, temel rapor |
| Kurumsal | Çok tesisli yapı | İleri roller, SSO, entegrasyon, tedarikçi akışı, sözleşmeli destek |
| Danışman | Birden çok müşteri | İzole müşteri çalışma alanları ve yetkilendirilmiş geçiş |

Fiyatın ana belirleyicisi işletme ve tesis sayısı olmalıdır; kullanıcı, depolama ve hesap/yapay zekâ kullanım limitleri açıkça belirtilir. Kullanıcı limitine ulaşıldığında veri dışa aktarımı ve mevcut kayda erişim engellenmez. Deneme sonunda veri silme ve dışa aktarma seçenekleri sunulur.

#### Gelir ve maliyet

Abonelik tekrar eden ana gelirdir. Kurulum, tarihsel veri temizliği, eğitim ve özel entegrasyon proje geliridir. Faktör lisansları, uzman incelemesi, barındırma, belge işleme, yapay zekâ kullanımı ve destek maliyet merkezleri ayrı ölçülür. Her müşteri için brüt katkı; gelirden doğrudan hizmet maliyetleri çıkarılarak takip edilir.

Teşvikler, iş modelinin gerçekleşmiş geliri olarak yazılmaz. Ürün olası destekleri keşfetmeye yardımcı olur; başvuru uygunluğu resmî çağrı metni, kurum profili ve uzman kontrolüyle belirlenir. İşe yerleştirme garantisi veya sürdürülebilirlik istihdamı artışı için kanıtsız oran verilmez.

#### Satış ve pilot tasarımı

İlk pilotta farklı veri olgunluğunda az sayıda üretim işletmesi seçilir. Pilot kapsamı; bir raporlama dönemi, önceden belirlenmiş faaliyetler ve müşteri tarafından atanmış bir uzman onaylayıcıdır. Kullanıcı görüşmesi, görev gözlemi ve hata analizi birlikte yapılır. Ücretli dönüşüm, ancak veri kalitesi ve kullanıcı faydası gösterildikten sonra değerlendirilir.

#### Bağımsızlık

Sponsorlu gündem veya eğitim varsa açıkça etiketlenir. Sponsor, emisyon faktörü sıralamasını veya uygunluk sonucunu değiştiremez. Ticari teşvikler kullanıcıya daha düşük emisyon sonucu üreten yöntemi seçtirmek için kullanılamaz. Kurum verisi varsayılan olarak model eğitimi ya da üçüncü taraf pazarlaması için kullanılamaz.

### 04 Roller ve yetki modeli

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

#### Görevlerin ayrılığı

Kurumsal varsayılan veri giren ile onaylayanın farklı olmasıdır. Küçük ekip istisnasında gerekçe, izin veren ve süre kaydedilir; raporda görünür. Platform destek ekibinin müşteri verisine sürekli erişimi olmaz. Süreli destek erişimi müşteri yetkilisi tarafından açılır, kayda alınır ve otomatik sona erer.

#### Davet ve hesap yaşam döngüsü

Davetler süreli ve tek kullanımlıdır. E-posta adresi doğrulanır; yanlış kuruma katılım engellenir. Ayrılan çalışanın erişimi sonlandırılır, açık görevleri devredilir; eski kayıtların yazarı korunur. Danışmanın müşteri alanları arasında veri kopyalaması açık işlem ve yetki gerektirir. Her ekranda aktif kuruluş görünür.

#### Kabul koşulu

Bir kullanıcı başka kuruma ait kayıt kimliğini bilse bile kaydı okuyamaz, hesaplatamaz veya indiremez. Tedarikçi daveti başka talebe erişim vermez. Yetki değişikliği açık oturumda da etkili olur.

### 05 Sekmeler ve bilgi mimarisi

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

#### Ortak bileşenler

Global arama; dersleri, terimleri, kaynakları ve yetkili kayıtları ayrı sonuç gruplarında gösterir. Asistan her sayfanın bağlamını izin dahilinde bilir. Yardım çekmecesi terim, örnek belge ve ilgili kişiyi gösterir. Bildirim merkezi okunma ve eylem durumunu ayırır. Kaynak ayrıntısında yayın, yürürlük ve son kontrol tarihleri birlikte görünür.

Görünür olmayan bir modül çalışıyor gibi sunulmaz. Henüz hazır olmayan özellik açıklaması ve gerçek geliştirme durumu gösterilir; boş buton veya sahte sonuç kullanılmaz.

### 06 Kurulum ve ilk gün deneyimi

#### Kurum profilini oluşturma

ONB-01: Kullanıcı görevini ve deneyimini belirtir; isteğe bağlı kısa başlangıç değerlendirmesi önerilir. Şirketin adı, faaliyet sektörü, ülkeler, tesisler, şirket ilişkileri ve raporlama dönemi alınır. Kurum büyüklüğü ve mevzuat açısından gereken bilgiler yalnızca ilgili yükümlülük değerlendirmesinde istenir.

ONB-02: Kuruluş ve envanter sınırı uzmanla belirlenir. Kontrol veya özkaynak payı yaklaşımı, kapsanan kuruluşlar, ortak girişimler, kiralamalar ve değişiklik gerekçesi sürümlenir. Başlangıç kullanıcısı bu kararı bilmiyorsa taslak profil açılır; nihai sınıflandırma beklemeye alınır.

ONB-03: Kullanıcı “Elektrik satın alıyor musunuz?”, “Yakıt yakan ekipman var mı?”, “Malzeme satın alıyor musunuz?”, “Ürün satıyor musunuz?” gibi soruları yanıtlar. Cevaplar kaynak envanteri ve Kapsam 3 ön değerlendirmesi oluşturur; kategori otomatik olarak silinmez.

#### İlk görev

Sistem bir örnek eğitim kaydı veya gerçek elektrik/doğal gaz faturası ile başlamayı önerir. Eğitim alanı açıkça etiketlidir. Gerçek belge yüklenirse OCR çıktısı kullanıcı doğrulamasına sunulur. İlk sonuçta sayıdan önce dönem, birim, durum ve eksikler görünür. Kullanıcı “Neden bu kapsam?” açıklamasını açabilir.

#### İlk ay planı

Hafta 1 kurum ve kaynak envanteri; hafta 2 kanıtlı temel tüketim; hafta 3 satın alma, lojistik ve atık veri talepleri; hafta 4 uzman kontrolü ve kapanış provası önerilir. Plan kurumun fiilî takvimine uyarlanır; sabit bir yasal süre gibi sunulmaz.

#### Veri olgunluğu

Başlangıç düzeyi dosya ve fatura; gelişen düzey sorumlu ve dönemsel kontrol; ileri düzey entegrasyon ve izlenebilir yöntem olarak tanımlanır. Olgunluk, bir sertifika veya çevresel başarı puanı değildir. Kullanıcıya tamamlayabileceği en yakın iyileştirme önerilir.

#### Kabul koşulu

Kapsam terimlerini bilmeyen kullanıcı ilk taslağı oluşturabilmelidir. Zorunlu teknik karar bilinmiyorsa kayıt kaybolmadan uzman görevine dönüşmelidir. Geri dönülen kurulum kaldığı adımdan devam etmelidir.

### 07 Sürdürülebilirlik 101 sekmesi

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

#### Ders şablonu

Her dersin kimliği, seviyesi, amacı, tahmini süresi, ön koşulu, sade açıklaması, iş örneği, sık yapılan hatası, küçük uygulaması, cevap gerekçesi, kaynakları ve gözden geçirme tarihi bulunur. Video varsa altyazı ve metin alternatifi zorunludur. Ders süresi tasarım hedefidir; tamamlama zorlaması değildir.

#### Değerlendirme ve ilerleme

Yanlış yanıtta yalnız doğru seçenek değil neden yanlış olduğu anlatılır. İlerleme kullanıcı bazında saklanır. Resmî yetkinlik sertifikası izlenimi veren rozet kullanılmaz; “modül tamamlandı” ifadesi kullanılır. Yöneticinin ayrıntılı bireysel öğrenme verisine erişimi kurumun tanımlı politikası ve kullanıcı bilgilendirmesiyle sınırlandırılır.

#### Kabul koşulu

Bir ders güncellenince eski tamamlama kaydı korunur; değişiklik esaslıysa kısa tazeleme önerilir. Ders içindeki örnekler hiçbir zaman üretim emisyon toplamına eklenmez.

### 08 Protokoller ve standartlar sekmesi

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

#### Kaynak kartı

Başlık, yayımlayan kurum, resmî URL, sürüm, dil, yayın tarihi, yürürlük, geçiş koşulu, yürürlükten kalkma, erişim tarihi ve lisans alanları gösterilir. “Bu bana neden gösteriliyor?” gerekçesi kurum profilinden gelir. Standart metni ile uygulamanın sade açıklaması görsel ve veri düzeyinde ayrılır.

#### Uygulanabilirlik

Değerlendirme uygulanır, uygulanmaz veya inceleme gerekli durumlarından birini üretir. Karar, kullanılan kurum verisi ve kural sürümüne bağlanır. Geçerli eşikler ve geçiş hükümleri kod içine sabit yazılmaz. Kaynak metni doğrulanmadan yeni hukuki kural etkinleştirilmez. GRI konu seçimi ile bir emisyon kategorisinin veri eksikliği birbirinin yerine kullanılamaz.

#### Kabul koşulu

Kullanıcı güncel ve geçmiş sürümü yan yana açabilmelidir. Kaynağa erişilemediğinde son başarılı kontrol tarihi gösterilir; “güncel” etiketi süresiz kalmaz. Lisans izni olmayan tam metin depolanmaz veya tekrar yayımlanmaz.

### 09 Gündem ve takvim sekmesi

Gündem akışı kullanıcının işiyle ilgili değişiklikleri anlaşılır görevlere çevirir. Her haber bildirim değildir; her yayın da yürürlükte bir yükümlülük değildir.

#### İçerik türleri

Mevzuat değişikliği, standart güncellemesi, resmî duyuru, destek/teşvik çağrısı, eğitim/etkinlik ve seçilmiş sektör gelişmesi ayrı etiketlenir. Taslak, istişare metni ve yürürlükteki düzenleme açıkça ayrılır. Haber ikincil kaynaktan gelirse hukuki sonuç resmî kaynakla doğrulanır.

#### Gündem kartının alanları

Başlık; üç cümlelik özet; yayımlayan; resmî kaynak; yayın tarihi; olay veya yürürlük tarihi; etkilenen ülkeler/sektörler; kurumla ilgisi; önerilen eylem; son kontrol; editör durumu. “Ne değişti, beni neden ilgilendiriyor, şimdi ne yapmalıyım?” soruları cevaplanır.

#### Takvim ve destekler

Kurum içi veri teslim tarihi ile yasal son tarih farklı ikon ve etiket taşır. Saat dilimi Europe/Istanbul varsayılanıdır; saatler sistemde UTC saklanır. Hatırlatmalar kullanıcı tercihine göre uygulama içi, e-posta veya izinli entegrasyonla gönderilir. Dış kişiye veri talebi gönderimi açık yetki gerektirir.

Destek kartında program sahibi, yararlanıcı koşulları, açık/kapalı durumu, çağrı tarihi, başvuru bağlantısı ve kontrol tarihi bulunur. “Size uygun olabilir” ön değerlendirmedir; destek almaya hak kazanıldığı anlamına gelmez. Teşvik tutarı veya son tarih kaynak olmadan üretilmez.

#### İçerik işletimi

Resmî kaynaklar planlı aralıklarla kontrol edilir; erişim ve değişiklik geçmişi tutulur. Kritik değişiklik uzman kuyruğuna alınır. Yeni kural yayımlandığında ilgili görev sahipleri bir kez bilgilendirilir; tekrar bildirimler birleştirilir. Sessize alma, takip ve takvime ekleme seçenekleri vardır.

#### Kabul koşulu

Geçmiş son tarih yaklaşan iş gibi gösterilemez. Taslak düzenleme yürürlükteymiş gibi görev yaratamaz. Kullanıcı bildirimden etkilenen kayda veya kaynağa tek adımda ulaşır.

### 10 Sözlük ve bağlamsal yardım

Sözlük başlangıç kullanıcısının teknik dili çözmesine yardımcı olur. Arama Türkçe karakter, yaygın yazım hataları, kısaltmalar ve İngilizce eş anlamlıları destekler. Kapsam, sistem sınırı, emisyon faktörü, GWP, fonksiyonel birim ve tahsis başlangıç terimleridir.

#### Terim kaydı

Terim kimliği, Türkçe başlık, İngilizce karşılık, kısaltma, sade tanım, kaynağın teknik tanımı, örnek, karıştırılan kavram, ilgili görev ve kaynak sürümü tutulur. Aynı terimin standartlara göre farklı kullanımı varsa bağlam seçimi gösterilir; tek tanıma zorlanmaz.

#### İçerik hakları

SKD Türkiye için doğrulanmış başlangıç kaynağı “100 Maddede Sürdürülebilirlik Rehberi”dir. Kullanıcının kastettiği ayrı sözlüğün yayın kimliği ve kullanım izni kesinleştirilir. İzin verilene kadar kaynak bağlantısı ve özgün kısa açıklamalar kullanılır; tam içeriğin uygulamaya aktarılacağı varsayılmaz. GRI, ISO ve lisanslı veri tabanları için de kullanım hakkı ayrıca tutulur. [K09]

#### Örnek yardım davranışı

“CO₂e ne demek?” sorusunda farklı sera gazlarının iklim etkilerini ortak birimle ifade ettiği açıklanır. “Bu kutuya ne yazacağım?” sorusunda kavram tanımı yerine kullanıcının belgesindeki ilgili alan gösterilir. Yanlış birim girdiğinde sistem “Bu alan miktar bekliyor; ödeme tutarını ayrı alana girebilirsin” der.

#### Yardım yolları

Bilgiyi bulamıyorum seçeneği örnek belge ve olası departmanı açar. Belge elimde yok seçeneği görev oluşturur. Emin değilim seçeneği uzman kontrolüne işaretler. Asistan yanıtı yetersizse destek talebine geçilir; kaynaklar ve kullanıcının onayladığı bağlam eklenir.

#### Kabul koşulu

Sözlük tanımı güncellendiğinde ilgili ders ve yardım metinleri etki analizine girer. Kullanıcı görevinden ayrılmadan açıklamayı okuyup kaldığı alana dönebilir. Bir kaynaktaki teknik tanım uygulamanın kendi görüşü gibi sunulmaz.

### 11 Rehberli veri girişinin ortak sözleşmesi

Veri girişi “Ne kaydetmek istiyorsun?” ile başlar. Fatura/tüketim, malzeme/hizmet, sevkiyat, atık, seyahat, soğutucu, ürün, çalışan veya diğer seçenekleri bulunur. Kapsam seçimi ileri alandadır; normal akışta sistem sorularla önerir.

#### Ortak akış

DAT-01: Faaliyeti ve kurumu seç. DAT-02: Belge yükle, elle gir veya içe aktar. DAT-03: Okunan alanları doğrula. DAT-04: Eksik bağlamı cevapla. DAT-05: Hesap ve sınır önerisini incele. DAT-06: Taslağı kaydet veya kontrole gönder. Her adım otomatik taslak kaydı ve geri dönüşü destekler.

#### Ortak alanlar ve kontroller

Kuruluş, tesis/kaynak, başlangıç-bitiş tarihi, veri türü, miktar, birim, veri kaynağı, ölçülmüş/tahmini durumu ve sorumlu tutulur. Nokta/virgül ayracı kullanıcı yereline göre okunur; “1.234” belirsizse sessiz karar verilmez. Negatif tüketim normal kayıt olamaz; iade/düzeltme ayrı işlem türüdür. Sıfır kabul edilir ama gerekçe veya kanıt istenebilir.

OCR belge kimliği, sayfa ve alan konumunu saklar. Düşük güvenli alanlar vurgulanır; OCR doğruluğu emisyon hesabının doğruluğu değildir. Aynı belge karması, fatura numarası, tedarikçi, tesis ve dönem üzerinden mükerrerlik adayı üretilir. Kullanıcı gerçek yinelenen işlem varsa gerekçeyle devam edebilir.

#### İçe aktarma

Excel/CSV önce eşleme ve önizleme alanına alınır. Birim, tarih, kurum ve tekrar kontrolü uygulanır. Hatalı satırlar açıklamalı döner; başarılı satırların tekrar yüklenmesi ikinci kayıt oluşturmaz. İçe aktarma işi geri alınabilir; onaylı kayıtların üzerine yazılmaz.

#### Sonuç ekranı

Sonuç; dönem, faaliyet miktarı, standart birime dönüşüm, kapsam/kategori önerisi, tCO₂e, faktör kaynağı, yöntem sürümü ve onay durumuyla gösterilir. Hesap yapılamıyorsa eksik neden açıkça yazılır. Birimin bilinmediği miktardan kesin sonuç üretilmez.

#### Kabul koşulu

Form kapanınca taslak kaybolmaz. Güncelleme çakışmasında diğer kullanıcının verisi ezilmez. Belge silinirse bağlı hesap ve raporlardaki kanıt etkisi görünür.

### 12 Kapsam 1 veri ve hesap akışları

Kapsam 1 kaynakları organizasyonel sınır içindeki doğrudan emisyonlarla ilişkilendirilir. Sabit yanma, hareketli yanma, proses ve kaçak emisyonlar ayrı şablonlardır. İlgili gazlar ve yöntem kaynak türüne göre seçilir. [K03]

| Şablon | Zorunlu bağlam | Yönteme bağlı veriler |
| --- | --- | --- |
| Sabit yanma | Ekipman, yakıt, dönem, tüketim birimi | Isıl değer, yoğunluk, ölçüm veya karbon içeriği |
| Hareketli yanma | Araç, kontrol ilişkisi, yakıt | Litre/kg veya mesafe, araç özellikleri |
| Proses | Proses ve ürün/hammadde | Reaksiyon, bileşim, kütle dengesi, ölçüm |
| Kaçak | Gaz türü, ekipman, işlem | Stok, dolum, geri kazanım, imha, sızıntı verisi |

#### Doğal gaz örneği

Kullanıcı faturadaki hacim veya enerji miktarını girer. m³, Sm³ ve Nm³ referans sıcaklık/basınç bilgisi olmadan eşitlenmez. Alt ve üst ısıl değer esası ayrı alanlardır. Enerji bazlı faktörle hesapta hacimden enerjiye dönüşümün kaynağı kaydedilir; faturada uygun enerji verisi varsa gereksiz çift dönüşüm yapılmaz.

#### Hesap ilkesi

Faaliyet miktarı, uyumlu birimde gaz bazlı faktörle çarpılır. Gaz kütleleri seçilen yöntemin GWP setiyle CO₂e’ye çevrilir. Faktör zaten CO₂e ise tekrar GWP uygulanmaz. Yanma ve yakıtın üst aşamaları ayrı sonuçlardır. Kaynak yalnız CO₂ veriyorsa eksik gazlar yöntem kapsamında değerlendirilir; tam sera gazı sonucu gibi etiketlenmez.

#### Kritik istisnalar

Soğutucuya eklenen miktar her durumda sızıntı değildir; yeni dolum ile kaçak telafisi ayrılır. Yakıt alımı ile tüketimi stok değişimi nedeniyle farklı olabilir. Aynı ekipmanda sayaç ve fatura birlikte varsa ikisi toplanmaz. Biyojenik CO₂ ayrı tutulur; ilgili diğer sera gazları gerekli hesapta kalır. Doğrudan ölçüm kullanılırsa cihaz, kalibrasyon ve veri kapsama bilgisi tutulur.

#### Kabul koşulu

Gaz türü bilinmeyen soğutucu kaydı hesap bekler. Karışım gaz için uygun karışım/GWP tanımı gerekir. Ekipman envanter dışında ise Kapsam 1 ataması yapılmadan ilişki tekrar değerlendirilir.

### 13 Kapsam 2 veri ve hesap akışları

Satın alınan veya edinilen elektrik, buhar, ısıtma ve soğutma için ayrı enerji kayıtları bulunur. Konum bazlı ve piyasa bazlı sonuçlar aynı tüketimin alternatif hesap görünümleridir; toplanmaz. İlgili piyasalarda çift raporlama gerekliliği değerlendirilir. [K04]

#### Konum bazlı akış

Tesisin ülke/şebeke bölgesi, dönem ve enerji türü uygun faktörle eşleştirilir. Şebeke üretim ve tüketim noktası faktörlerinin farkı kontrol edilir; sınırın şebeke kayıplarını içerip içermediği bilinmelidir. Faktör yoksa uygun alternatif seçim gerekçesi uzman onayına gider.

#### Piyasa bazlı akış

Sözleşmesel araç kaydında tür, tedarikçi, üretim yeri, enerji dönemi, miktar, belge seri bilgisi, faydalanan kuruluş, itfa/iptal durumu ve ilgili kalite koşulları tutulur. Uygun araçla kapsanan ve kapsanmayan tüketimler ayrı hesaplanır. Kalan tüketim için geçerli faktör hiyerarşisi, artık karışımın kullanılabilirliği ve izin verilen alternatifler uygulanır.

#### Kontroller

Belge miktarı tüketimi aşan kısım için negatif emisyon yaratamaz. Belge iki tesis veya döneme tekrar tahsis edilemez.

“Yenilenebilir satın aldım” cevabı tek başına sıfır emisyon sonucu üretmez. Koşullar ve kanıt doğrulanır.

Şirket içindeki yakıtlı üretim, satın alınmış elektrik gibi yeniden Kapsam 2’ye eklenmez. Enerji ve emisyon çift sayımı ayrı kontrollerdir.

Öz tüketim, şebekeye satış ve depolama akışları ayrılır. Satılan enerji otomatik olarak brüt kurumsal emisyonlardan düşülmez.

Kullanılan GHG Protocol sürümü saklanır. Taslak güncelleme üretim kuralı olarak etkinleştirilmez.

#### Sonuç görünümü

Elektrik miktarı, iki hesap sonucu, belgeyle eşleşen miktar, kapsanmayan miktar, kullanılan faktörler ve inceleme durumu gösterilir. Kurumsal toplamın yanında hangi Kapsam 2 yönteminin kullanıldığı açıkça yazar.

#### Kabul koşulu

100 MWh tüketimin 60 MWh’ı uygun belgeyle kapsanırsa kalan 40 MWh hesap dışı bırakılamaz. Konum ve piyasa sonucu toplam enerji tüketimini iki katına çıkaramaz.

### 14 Kapsam 3 kategorileri 1 ile 8

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

#### Görev sahipleri

Satın alma 1–2; enerji/teknik ekip 3; lojistik 4; çevre sorumlusu 5; seyahat/idari işler 6; insan kaynakları 7; idari işler/finans 8 için başlangıç sorumlu önerisidir. Kurum gerçek organizasyonuna göre değiştirir. Sistem departman adını uzmanlık veya veri doğruluğu garantisi saymaz.

#### Veri talebi

Tedarikçiye giden şablon ürün, referans birim, sistem sınırı, kapsanan yıl/coğrafya, yöntem, doğrulama durumu ve belge ister. Yalnız toplam şirket emisyonu ürün faktörü gibi kullanılamaz; uygun tahsis bilgisi gerekir. Eksik yanıtta tamamlayıcı talep oluşturulur.

#### Kabul koşulu

Bir kaydın hem kategori 1 hem 2’ye atanması inceleme gerektirir. Anket yanıtı vermeyen çalışan otomatik sıfır kabul edilmez. “Geri dönüşüm” seçimi atık sonucunu otomatik negatif yapmaz.

### 15 Kapsam 3 kategorileri 9 ile 15

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

#### Zaman ve senaryo

Kategori 11’de satış yılı ve beklenen emisyon gerçekleşme yılları ayrı tutulur. Ömür, yıllık kullanım, enerji karışımı ve bakım senaryoları sürümlenir. Kullanım verisi olmayan üründe tek bir varsayılan gizlice atanmaz. Senaryo sonucu ölçülmüş gerçekleşme gibi gösterilmez. [K07]

Kategori 15’te özkaynak, borç ve proje finansmanı aynı formülle genellenmez. İlgili finansal muhasebe yöntemi, atıf payının pay/payda tanımları ve veri yılı alan uzmanı tarafından belirlenir. Finans kuruluşlarına açılacak ileri modül için ek yöntem incelemesi gerekir. [K10]

#### Uygulanabilirlik ve eksikler

Franchise vermeyen işletmede gerekçeli uygulanamaz kaydı tutulabilir. Veri vermeyen müşteriye ilişkin kategori ise veri eksik olarak kalır. Kategori bazında sonuç, kapsam açıklaması, birincil/ikincil veri niteliği ve iyileştirme görevi birlikte sunulur.

#### Kabul koşulu

Ömür sonu senaryo oranları uygun toplamı sağlamalıdır. Ömrü on yıl olan ürünün toplamı her yıl aynı satış grubu için yeniden envantere eklenmemelidir. Aynı yatırım konsolidasyon ve Kategori 15 altında tekrar sayılmamalıdır.

### 16 Kapsam 3 yöntem ve kalite yönetimi

Hesap yöntemi kategoriye göre değişir. Sistemde tüm kategorilere tek bir “miktar çarpı faktör” formu dayatılmaz. Ön tarama daha az ayrıntılı verilerle başlayabilir; sonuç açıkça tahmini olarak etiketlenir. Öncelik emisyon büyüklüğü, veri kalitesi, risk ve iyileştirme kapasitesiyle belirlenir. [K05]

#### Yöntem seçme sözleşmesi

MTH-01: Uygulanabilir kategori ve minimum sınırı belirle. MTH-02: Kullanılabilir birincil ve ikincil veriyi listele. MTH-03: İlgili kategoride izin verilen yöntemleri değerlendir. MTH-04: Seçim gerekçesi ve alternatifleri kaydet. MTH-05: Kalite kontrolü ve uzman onayı sonrası yöntemi etkinleştir.

Satın alınan mal ve hizmetlerde tedarikçiye özgü, hibrit, ortalama veri veya harcama bazlı yaklaşımlar değerlendirilebilir. Tedarikçi verisi yanlış sınırda veya eskiyse daha kaliteli ortalama veri karşısında otomatik üstün değildir. [K11]

#### Harcama ve fiziksel veri

Harcama bazlı hesapta para birimi, harcama tarihi, vergilerin ele alınışı, sektör sınıfı, faktör fiyat yılı ve kur/enflasyon yaklaşımı saklanır. Fiziksel yönteme geçişte aynı işlemin harcama sonucu devre dışı bırakılır; eski sonuç tarihçede kalır. Kur değişimi emisyon performansında gerçek fiziksel azalma gibi yorumlanmaz.

#### Kalite değerlendirmesi

Teknoloji, coğrafya, zaman, tamlık ve güvenilirlik boyutları ayrı değerlendirilir. Birleşik kalite puanı kullanılırsa ağırlıklar ve ölçütler açıklanır; bilimsel belirsizlik yüzdesi gibi sunulmaz. Ölçüm belirsizliği, faktör belirsizliği ve senaryo belirsizliği farklı alanlardır. Veri yoksa rastgele bir güven aralığı üretilemez.

#### Tahsis ve örnekleme

Ortak tedarikçi veya tesis emisyonu ilgili ürüne/kuruma uygun yöntemle paylaştırılır. Paylaştırma temeli, payda dönemi ve tahsis oranı saklanır. Birden fazla alıcıya dağıtılan toplamda sınır aşımı kontrol edilir. Örneklem verisi nüfusa genişletilirse örneklem büyüklüğü, seçimi, yanıt oranı ve ağırlıklar tutulur.

#### Kabul koşulu

Yöntem değişimi karşılaştırma etkisini gösterir. Kullanıcı toplamın ne kadarının tahmini ve hangi kategorilerin eksik olduğunu görebilir. Birincil veri oranı kayıt sayısı ile emisyon ağırlıklı oran olarak karıştırılmaz.

### 17 Yaşam döngüsü ve ürün çalışmaları

Ürün çalışması, kurumsal envanterin yanında ayrı hesap bağlamıdır. Ürün sonucu kurumsal toplamın üzerine eklenmez. Aynı ham veri kullanılabilir; dönemi, tahsisi, referans birimi ve sınırı ayrı tutulur. GHG Protocol Product Standard ürün; Corporate ve Scope 3 standartları kuruluş düzeyinde çalışır. [K03, K12]

| Kullanıcıya sorulan | Teknik sınır | Gerekli açıklama |
| --- | --- | --- |
| Yalnız belirli üretim işlemlerini mi inceleyeceksin | Kapıdan kapıya | Başlangıç ve bitiş prosesi |
| Ham maddeden tesis çıkışına kadar mı | Beşikten kapıya | Hangi tesisin çıkışı ve üst aşamalar |
| Kullanım ve ömür sonu da dahil mi | Beşikten mezara | Dağıtım, kullanım ve ömür sonu senaryoları |
| Müşterinin talebine göre farklı bir bölüm mü | Özel kısmi sınır | Dahil/hariç tüm süreçler ve gerekçe |

Bu sınırlar çalışma amacını açıklar; veri tabanındaki bir faktörün gerçek sınırını kullanıcı seçimiyle değiştirmez. “Beşikten beşiğe” ifadesi otomatik geri dönüşüm kredisi veya standart bir hesap kısayolu olarak sunulmaz. Döngüsel senaryoda tahsis ve geri dönüşüm yöntemi açıkça belirlenir. [K08, K13]

#### Ürün veri modeli

Ürün sürümü, malzeme listesi, üretim rotası, miktarlar, fire, ambalaj, enerji tahsisi, sevkiyat, kullanım, ömür sonu ve ortak ürünler tanımlanır. Referans akış ile gerekiyorsa fonksiyonel birim, performans ve kullanım süresi açıklanır. Bir kilogram farklı performanslı ürünleri otomatik olarak karşılaştırılabilir yapmaz.

#### Çakışma ve eksik aşama

Tedarikçinin beşikten kapıya verisine aynı ham madde üretimi yeniden eklenmez. Kapıdan kapıya faktör üst aşamalar olmadan tam ürün ayak izi gibi adlandırılmaz. Beşikten mezara toplam, Kategori 1’de kullanılmadan uygun bileşenlere ayrıştırılır. Sistem her faktör için kapsanan süreçleri ve kesişimleri tutar.

#### Kabul koşulu

Sonuç ekranı birim, sınır, dönem, yöntem, tahsis ve eksikleri gösterir. Yalnız karbon hesaplandıysa “ürün karbon ayak izi” veya “kısmi ürün karbon ayak izi” denir; tam LCA veya EPD belgesi oluşturulduğu iddia edilmez.

### 18 Faktör kataloğu ve hesaplama motoru

Hesaplama deterministik ve tekrar üretilebilir olmalıdır. Yapay zekâ sayı tahmin ederek üretim sonucu veremez. Aynı girdiler, aynı yöntem ve faktör sürümüyle aynı sonucu üretir. Önizleme ve onaylı hesap aynı çekirdek motoru kullanır.

#### Faktör kaydı

Faktör kimliği/sürümü, değer, pay ve payda birimleri, gaz veya CO₂e niteliği, coğrafya, yıl, teknoloji, yaşam döngüsü sınırı, alt/üst ısıl değer esası, GWP seti, kaynak sayfa/tablo, lisans, geçerlilik, inceleyen ve onay durumu tutulur. Kaynağı ve birimi olmayan katsayı üretim kataloğuna giremez.

#### İşlem sırası

Girdi doğrulama → birim/koşul dönüşümü → sınır ve faktör uyumu → gaz bazlı hesap → gerekiyorsa GWP dönüşümü → tahsis → sonuç ve iz kaydı → kalite durumu. İç hesapta yeterli ondalık hassasiyet korunur; yuvarlama yalnız sunumda veya tanımlı yöntem gereğinde yapılır.

#### Aritmetik doğrulama örnekleri

Yalnız yazılım testi için kurgusal veriler: 100 GJ × 50 kg CO₂/GJ = 5.000 kg CO₂ = 5 t CO₂. Diğer gazlar yoksa bu yalnız CO₂ bileşenidir. 1.000 kWh × 0,4 kg CO₂e/kWh = 400 kg CO₂e = 0,4 t CO₂e. Bu katsayılar gerçek müşteri hesabına aktarılmaz.

#### Versiyon ve yeniden hesap

Her çalıştırmada girdi sürümleri, faktör kimlikleri, formül sürümü, motor sürümü, zaman ve sonucu oluşturan kullanıcı/iş saklanır. Yeni faktör bildirimi eski sonucu değiştirmez; etkilenmiş kayıt listesi ve fark önizlemesi oluşturur. Onaylı dönemde düzeltme yeni sürüm ve gerekçe gerektirir. Baz yıl yeniden hesap politikası ayrı tutulur.

#### Hata davranışı

Uyumsuz birim, eksik sınır veya desteklenmeyen yöntem hesap engelidir. Daha düşük kalite veri kullanılabiliyorsa sonuç açıkça tahmini ve inceleme gerekli olur. Sıfıra bölme, taşma ve geçersiz sayı işlemi reddedilir. Ölçüm ile satın alma verisi arasında stok uzlaştırması gereken kaynaklar işaretlenir.

#### Kabul koşulu

Kullanıcı sonuçtan faktöre, oradan kaynak tablosuna ve ham belgeye ulaşır. CO₂e faktörüne GWP ikinci kez uygulanamaz. Lisansı süresi dolan faktörün geçmiş kullanımı kanıtıyla korunur; yeni kullanım politikaya göre engellenir.

### 19 Kaynak ve değişiklik izleme altyapısı

Resmî yayınlar izlenir; internetten bulunan her metin güvenilir kaynak sayılmaz. Kaynak önceliği yayımlayan kurum, resmî metodoloji ve lisanslı veri sağlayıcıdır. Akademik veya sektör rehberi amacına göre ikincil dayanak olarak etiketlenir.

#### Kaynak yaşam döngüsü

SRC-01: İzinli kaynağı kaydet. SRC-02: RSS/API veya izinli sayfa/PDF kontrolü yap. SRC-03: İçerik karması ve sürüm oluştur. SRC-04: Madde düzeyinde değişiklik çıkar. SRC-05: Yapay zekâ özetini kaynak parçalarına bağla. SRC-06: Uzman yeni kuralı ve etkisini onaylasın. SRC-07: İlgili kullanıcıya görev veya bilgilendirme üret.

#### Tarih modeli

Yayın tarihi, yürürlük tarihi, kapsanan raporlama dönemi, erken uygulama/istisna koşulu, sistemde görülme tarihi ve son başarılı kontrol farklı alanlardır. Değişiklik anında eski sürüm erişilebilir kalır. Sadece en son dosyayı saklamak tarihsel raporu yeniden üretmeyi engeller.

#### Standart geçiş örneği

GRI 102 Climate Change 2025 ve GRI 103 Energy 2025 için 1 Ocak 2027 ve sonrasında yayımlanan rapor/materyal koşulu kaynakta belirtilmiştir. Kural yalnız tüketim yılına göre seçilemez. GRI 102’nin 2016 tarihli eski “General Disclosures” standardıyla karışmaması için kimlik; yayımlayan, kod, başlık ve baskı yılını birlikte içermelidir. [K14, K15]

#### Değişiklik kartı

Eski metin bağlantısı, yeni metin bağlantısı, değişen madde, sade özet, kesin/yorum niteliği, etkilenen kurum profilleri, formlar, hesaplar ve dersler listelenir. Kural etkinleşince hangi tarihten itibaren hangi işin değişeceği açıklanır. Erişim hatasında güncellik garantisi verilmez; editör kuyruğuna alınır.

#### Kabul koşulu

Taslak yayın otomatik yükümlülük olamaz. Yapay zekâ özeti orijinal metni değiştiremez. Kaynak metnindeki talimat benzeri içerik sistem komutu olarak çalıştırılamaz. Silinmiş veya değişmiş bir bağlantının geçmiş kanıtı saklama hakkı dahilinde korunur.

### 20 Çekirdek veri modeli

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

#### Bütünlük kuralları

Kayıt sürümü ile hesap sürümü bire çoktur; sonuç eski girdi üstüne yazılamaz. Bir faaliyetten farklı kapsam/aşama sonuçları üretilebilir; her sonuçta sınır ve yöntem bağı bulunur. tenant_id yabancı anahtar ilişkilerinde de doğrulanır. Gereklilik eşleştirmesi çoktan çoğa yapıdadır; benzer açıklamalar otomatik eşdeğer sayılmaz.

#### Ayrı durumlar

NULL bilinmiyor, sıfır ölçülmüş/değerlendirilmiş değer, uygulanamaz gerekçeli karar, tahmin veri niteliği olarak tutulur. Bu ayrım API, ekran, dışa aktarma ve raporda korunur.

### 21 İş akışı ve dönem kapanışı

#### Kayıt durumları

Taslak → doğrulama gerekli → hesaplandı → incelemede → düzeltme istendi veya onaylandı → kilitli dönem. Hesaplandı, onaylandı anlamına gelmez. Durum geçişleri sunucu tarafından denetlenir; her geçiş yetki, zaman ve gerekçe içerir.

İncelemeye gönderilen kayıt eksik kanıt politikasına göre bloke edilir veya açık eksikle gönderilir. Onaylayan yöntem ve kaynak özetini görür. Geri gönderme gerekçesi alan veya hesap düzeyine bağlanır. Veri değişirse önceki onay geçersizleşir; kullanıcıya tekrar inceleme gerektiği bildirilir.

#### Görev ve tedarikçi talepleri

Görev; istenen veri, kabul edilen birim, örnek, sorumlu, son tarih, ilişkili gereklilik ve yanıt alanına sahiptir. Tedarikçi kendi yanıtının sürümünü ve eksiklerini görür. Gönderilmeden önce muhatap, kapsam ve ekler kurum kullanıcısı tarafından doğrulanır. Otomatik tekrar gönderim kurumun açıkça etkinleştirdiği kurala bağlıdır.

#### Aylık ve yıllık kapanış

Kapanış listesi kaynak envanterine göre beklenen kayıtları, eksik dönemleri, onay durumunu, tahminleri, mutabakatları ve açıklama eksiklerini gösterir. Aylık veri toplamı yıllık envanterin tek kaynağı olmak zorunda değildir; yıllık anket ve ömür boyu satış grubu hesapları dönem türüyle ilişkilendirilir.

Kilitli dönem düzeltmesinde önce gerekçe ve etki analizi açılır. Yetkili yeniden açma onayı gerekir. Eski rapor korunur; yeni rapor sürümü eskiyi hangi nedenle değiştirdiğini belirtir. Baz yıl yeniden hesaplaması, satın alma/satış veya yöntem değişiminin kurum politikasındaki eşiğe göre değerlendirilir.

#### Uzlaştırma

Sayaç ile fatura; yakıt alımı ile stok/tüketim; satın alma sistemi ile envanter; tesis toplamı ile kurum toplamı karşılaştırılır. Fark otomatik kötü performans değildir. Dönem kayması, ölçüm sınırı ve veri eksikleri ayrı açıklanır.

#### Kabul koşulu

Kilitli dönem değiştirilemez. Yeniden açma eski rapor dosyasını silemez. Uzmanın reddettiği kayıt toplamda onaylı veri olarak görünemez. Aynı görevi iki kişinin tamamlaması yinelenen kayıt yaratmamalıdır.

### 22 Analiz hedefler ve raporlama

Analiz ekranı onaylı, taslak ve senaryo verisini açıkça ayırır. Kapsam 2 yöntemi, dönem, tesis ve veri kalite filtresi görünürdür. Eksik Kapsam 3 kategorileri varsa toplam “hesaplanan envanter toplamı” olarak adlandırılır.

#### Analizler

Toplam ve kaynak kırılımları; kategori bazında değişim; üretim veya faaliyet başına yoğunluk; tahmini veri payı; açık kanıtlar ve veri tamlığı gösterilir. Yoğunlukta payda tanımı, birimi ve dönemi zorunludur. Mutlak emisyon azalırken üretim de düşmüşse verimlilik iyileştiği otomatik söylenmez. Fark ayrıştırmasında faaliyet, faktör, sınır ve yöntem değişimleri ayrılır.

#### Hedef ve senaryo

Hedef; baz yıl, hedef yılı, kapsanan kaynaklar, mutlak/yoğunluk türü, ara hedef ve sorumlu içerir. Öngörü ve azaltım senaryosu gerçek envanteri değiştirmez. Karbon kredisi, giderim ve kaçınılan emisyonlar ayrı defter/görünümdedir; brüt toplamdan otomatik düşülmez.

#### Rapor üretimi

GRI için gereklilik indeksi; TSRS için ayrı açıklama matrisi hazırlanır. GRI 305-1/2/3 ile yeni GRI 102-5/6/7 eşleştirmesi uygulanabilir sürüme göre tutulur. Bir sayısal kayıt bir açıklamanın tamamını karşılamaz. Politika, yönetim yaklaşımı, risk ve varsayım metinleri kanıtlarıyla ayrıca gerekir. [K01, K14]

Rapor paketi yönetici özeti, sınır, dönem, yöntem, kapsam/kategori sonuçları, eksikler, kalite, karşılaştırmalar, kaynaklar ve kanıt indeksini içerir. DOCX/PDF ve makine okunur CSV/JSON dışa aktarma önerilir. Yayımlama ayrı yetkili işlemdir; taslak indirmek yayımlamak değildir.

#### Sabit rapor sürümü

Her rapor veri/hesap/faktör/standart kimliklerini içeren manifest ve dosya karması taşır. Sonradan değişen kaynak raporu sessizce değiştiremez. Bağımsız güvence raporu varsa dosya, kapsam ve görüşü eklenir; platform kendi kendine güvence etiketi veremez.

#### Kabul koşulu

Toplamlar detaydan yeniden üretilebilir. Konum ve piyasa bazlı Kapsam 2 toplanmaz. Raporun eksik açıklamaları görünür kalır; otomatik “tam uyum” rozeti üretilemez.

### 23 Karbon dışındaki sürdürülebilirlik kapsamı

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

#### Etki ve önemlilik akışı

Faaliyet/değer zinciri bağlamı → gerçek ve potansiyel etkiler → ilgili paydaş ve kanıt → değerlendirme → konu kararı → yönetim yaklaşımı → izleme. Finansal risk ve fırsat değerlendirmesi ayrı tutulur; ortak veri bağlantıları kurulur. Çifte önemlilik etiketi kullanılıyorsa iki yaklaşım da tanımlı ve uygulanmış olmalıdır.

#### Anlatısal veri

Politika, hedef, sorumlu yönetim organı, aksiyon, kaynak tahsisi ve sonuç metinleri sürümlenir. Yapay zekâ mevcut olmayan politika veya yapılmamış uygulamayı yazamaz. Eksiklikler görev olarak gösterilir; kurum adına gerçek olmayan taahhüt oluşturulmaz.

#### Kabul koşulu

Her modül aynı kanıt/onay altyapısını kullanır. Eğitim saatini çalışan sayısı olmadan oranlamak engellenir. Hassas kişi bilgileri genel sürdürülebilirlik kullanıcısına açılmaz.

### 24 Yapay zekâ ve kaynaklı yanıt mimarisi

Asistanın görevi anlamak, soru sormak, kaynak göstermek ve sonraki adıma yönlendirmektir. Sonuçların sayısal otoritesi hesaplama servisidir; kaynak metni, arama sonucu veya dil modeli çıktısı değildir.

#### Yanıt sözleşmesi

AI-01: Kullanıcının amacı ve aktif kurum bağlamı belirlenir. AI-02: Yalnız yetkili, sürümü belirli kaynaklar getirilir. AI-03: Yanıt dayanak paragraflarla eşleştirilir. AI-04: Eksik koşul varsa soru sorulur. AI-05: Sayı gerekiyorsa hesap servisinden alınır. AI-06: Yanıt, koşul, kaynak ve sonraki eylem birlikte gösterilir.

Yanıtın zorunlu alanları kısa açıklama, dayanak kaynak kimliği ve madde, geçerli sürüm/tarih, kurum için koşul, belirsizlik ve önerilen eylemdir. Kaynak bulunamıyorsa “Bu bilgi için doğrulanmış kaynak bulamadım” denir. Yüzde güven değeri kalibre edilmedikçe uydurulmaz.

#### Araç sınırları

Asistan taslak görev ve açıklama önerebilir. Üretim faktörünü etkinleştirme, kaydı onaylama, silme, dışa gönderme ve rapor yayımlama yetkisi yoktur. Kullanıcı onayından geçen eylem normal yetki katmanına gider; sohbet komutu bu katmanı aşamaz.

#### Belge ve arama güvenliği

Yüklenen belge ve web içeriği güvenilmeyen veridir. İçindeki “önceki talimatı yok say” gibi metinler komut olarak işlenmez. Doküman parçalarına tenant_id ve erişim etiketleri eklenir; vektör araması da aynı izolasyonu uygular. Kanıt dosyaları izinsiz dış modele gönderilmez; kurumun veri işleme politikası uygulanır.

#### Değerlendirme

Altın test seti; birim belirsizliği, bilinmeyen soğutucu, eksik kaynak, çelişen standart, taslak mevzuat, sahte talimatlı belge ve başka kuruma veri sorma örneklerini içerir. Ölçütler kaynak desteği, yanlış kesinlik, uygun soru sorma, veri sızdırmama ve hesap servisinin sonucunu değiştirmemedir.

#### Kabul koşulu

Kullanıcı faktör istemeden tahmini katsayı uydurulmaz. Kaynak bağlantısı yanıtı gerçekten destekler. Başka müşteri verisi örnek veya öneri olarak bile gösterilmez.

### 25 Güvenlik mahremiyet ve süreklilik

Bu bölüm ürün güvenlik gereklilikleridir; belirli bir mevzuata uyum sertifikası beyanı değildir. Veri işleme, saklama ve aktarım yükümlülükleri sözleşme ve ilgili hukuk bakımından yayına çıkmadan incelenir.

#### Erişim ve veri koruma

Güçlü oturum yönetimi, yönetici hesaplarında çok faktörlü doğrulama, kurumsal SSO seçeneği ve sunucu tarafı rol/alan denetimi uygulanır. Aktarımda ve depolamada şifreleme; anahtar ve sır yönetimi ayrı servisle sağlanır. Dosya indirmeleri kısa süreli, yetki kontrollü bağlantılar kullanır.

Yüklenen dosyalarda boyut/tür sınırı, zararlı içerik taraması, güvenli işleme ve makro/aktif içerik politikası bulunur. CSV dışa aktarmada formül enjeksiyonu önlenir. URL’den kaynak alımında izinli alan adı ve sunucu tarafı istek sahteciliği kontrolleri uygulanır.

#### Mahremiyet

Çalışan anketleri mümkün olduğunca toplulaştırılır. İşe gidiş geliş için açık ev adresi yerine gerekli en düşük ayrıntı tercih edilir. Küçük gruplarda yeniden tanımlama riski değerlendirilir. Kişisel veriye erişim ve silme talepleri için iş akışı bulunur. Silme, yasal/kontratsal saklama ve kanıt gereklilikleriyle birlikte değerlendirilir.

#### Denetim ve olay müdahalesi

Giriş, rol değişimi, dışa aktarma, onay, faktör değişimi ve rapor işlemleri kayda alınır. Loglara sır, tam kişisel içerik veya belge metni gereksiz yazılmaz. Güvenlik olayında etkilenen alanlar, erişim kesme, kurtarma ve bildirim sorumluları tanımlıdır.

#### Süreklilik hedefleri

Pilot için günlük yedek ve düzenli geri yükleme provası; kurumsal sürüm için önerilen RPO 24 saat, RTO 8 saat hedefidir. Bunlar sözleşme taahhüdü değildir; mimari ve maliyet doğrulamasıyla kesinleşir. Kaynak veya yapay zekâ servisi kapalıyken mevcut onaylı veriye erişim ve manuel taslak girişi sürmelidir.

#### Kabul koşulu

Kurumlar arası erişim testleri geçmeden pilot gerçek veriye açılamaz. Yedekten geri yükleme gösterilir. Erişimi kaldırılan kullanıcı dosya linki ve açık oturumla erişmeye devam edemez.

### 26 Önerilen teknik mimari

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

#### Teknik seçim ilkeleri

Örnek başlangıç seçimi TypeScript tabanlı web arayüzü, Python veya TypeScript iş API’si, PostgreSQL, S3 uyumlu nesne deposu ve kuyruk sistemidir. Sürümler uygulama tarihinde resmî dokümantasyon ve destek durumuyla seçilir. Hesap motoru UI’dan bağımsızdır. Kritik iş kuralları istemciye bırakılmaz.

#### İşletim

Geliştirme, test ve üretim ortamları ayrıdır. Veri tabanı göçleri sürümlü, geri dönüş planlı ve üretim verisi üzerinde prova edilmiş olmalıdır. İçerik/faktör yayınları kod dağıtımından ayrıdır ama test ve onay gerektirir. Uzun işler job_id döndürür; ilerleme, iptal ve güvenli tekrar destekler.

#### Hedef performans

Pilot için normal form işlemlerinde p95 iki saniye; standart tek kayıt hesap önizlemesinde p95 üç saniye önerilir. Belge işleme ve raporlar asenkron çalışır. Hedefler veri hacmi ve donanım profiliyle yük testinde doğrulanır; ölçülmeden SLA ilan edilmez.

### 27 API ve entegrasyon sözleşmeleri

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

#### Yanıt ve hata modeli

Başarılı sonuç data, meta ve request_id taşır. Hata code, kullanıcıya uygun message, field_errors, retryable ve request_id içerir. Yetkisiz nesnenin varlığı açıklanmaz. 401 oturum, 403 yetki, 409 sürüm, 422 alan, 429 hız sınırı ayrımı tutarlıdır; güvenlik politikasına göre nesne erişimi 404 dönebilir.

#### Entegrasyonlar

ERP, sayaç, seyahat ve satın alma sistemleri önce staging alanına yazar. Kaynak sistem kimliği, kayıt kimliği, çekilme zamanı ve eşleme sürümü tutulur. Webhook imzası doğrulanır; aynı olay tekrar işlenmez. Başarısız işler kontrollü tekrar ve hata kuyruğuna gider. Entegrasyon kesildiğinde veri güncellik durumu görünür olur.

#### Kabul koşulu

Aynı idempotency anahtarlı aynı istek ikinci faaliyet yaratmaz. Aynı anahtarla farklı içerik reddedilir. Kısmi içe aktarmada hangi satırın işlendiği kesindir. API dışa aktarması UI’daki yetki ve filtrelerle aynı sonucu verir.

### 28 Ekran durumları ve tasarım sistemi

Arayüz profesyonel, sade ve öğrenmeyi destekleyen bir dil kullanır. Açık zemin, yüksek kontrast, okunabilir yazı, tutarlı boşluklar ve sınırlı vurgu rengi önerilir. Yeşil renk tek başına “iyi sürdürülebilirlik” anlamına gelmez. Grafikler sayı ve tablo alternatifiyle sunulur.

#### Her ekranın durum sözleşmesi

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

#### Erişilebilirlik hedefi

Klavye ile tam kullanım, görünür odak, ekran okuyucu etiketleri, alanla ilişkili hata metinleri, yeterli kontrast ve ölçeklenebilir metin hedeflenir. WCAG 2.2 AA uygulama hedefidir; uygunluk beyanı erişilebilirlik denetimi sonrası yapılır. Mobilde uzun tablolar anlamsız sıkıştırılmaz; kart veya yatay gezinme ve başlık sabitleme sağlanır.

#### Form bileşenleri

Miktar ve birim birlikte; tarih aralığı açık; örnek değer gerçek veri gibi doldurulmamış; zorunlu alan nedenleri açıklanmış olmalıdır. Silme eylemi geri alınabilirlik ve bağlı etkiyi gösterir. Taslak kaydet ile kontrole gönder ayrıdır. Teknik yardım, alanın yanından açılır.

#### Asistan görünümü

Yan panel görev bağlamını gösterir ve kullanıcı yazarken formu kapatmaz. Yanıtın kaynakları açılabilir; önerilen değer bir tıklamayla onay alınmadan forma yazılmaz. Uzun yanıt yerine kısa açıklama ve ayrıntı bağlantısı tercih edilir.

#### Kabul koşulu

Türkçe karakterler, dar ekran, büyük yazı ve yalnız klavye kullanımında form tamamlanabilir. Renkleri ayırt edemeyen kullanıcı onay/tahmin/eksik durumlarını metinden anlayabilir.

### 29 Kabul testleri ve doğruluk kapıları

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

#### Alan uzmanı onayı

Altın veri seti her desteklenen kategori ve yöntemi kapsar. Referans sonuç, yöntem kaynağı ve tolerans uzman tarafından imzalanır. Yalnız ekranda sonuç görünmesi hesap özelliğinin tamamlandığı anlamına gelmez.

### 30 Yol haritası ve teslim koşulları

Tam ürün kapsamı bu belgede tanımlıdır; aşamalar doğrulama ve işletim riskini yönetir. Her sürümde desteklenen kategori/yöntem matrisi yayımlanır. Desteklenmeyen hesaplar genel bir formülle taklit edilmez.

| Aşama | Teslim | Çıkış koşulu |
| --- | --- | --- |
| A Keşif ve yöntem | Kullanıcı görevleri, kaynak hakları, kurum sınırı, veri şeması | Ürün sahibi ve alan uzmanı onayı |
| B Temel altyapı | Kimlik, izolasyon, taslak, kanıt, audit, kaynak kataloğu | Yetki ve veri bütünlüğü testleri |
| C Uçtan uca pilot | Doğal gaz, elektrik, seçilmiş satın alma/taşıma/atık akışları | Altın hesaplar ve gerçek kullanıcı görevleri |
| D Kapsam genişleme | 15 kategori için doğrulanmış yöntemler, tedarikçi talepleri | Kategori bazında yöntem ve kabul matrisi |
| E Tam öğrenme ve rapor | 101, sözlük, gündem, değişiklik, GRI/TSRS hazırlığı | İçerik editörü ve rapor uzmanı kontrolü |
| F Kurumsal yaygınlaşma | SSO, entegrasyon, ürün çalışmaları, diğer ESG alanları | Yük, güvenlik, kurtarma ve destek hazırlığı |

#### Her aşamada beklenen teslimatlar

Çalışan uygulama, veri tabanı göçleri, API tanımı, rol matrisi, test sonuçları, desteklenen yöntemler, kaynak/faktör listesi, bilinen eksikler ve işletim yönergesi teslim edilir. Geliştirme ortamı örnek verileri üretimden ayrıdır. Kurulum ve geri alma adımları başka geliştirici tarafından uygulanabilir olmalıdır.

#### Pilot değerlendirme

Yeni başlayan kullanıcıların yardımsız ilk taslak oluşturması, eksik bilgiyi bulma yolu ve sonucu doğru yorumlaması gözlenir. Kullanıcının sayıyı gördüğü halde yanlış anladığı durum hata sayılır. Alan uzmanı yanlış kapsam, sınır, faktör, birim ve rapor eşleştirmelerini inceler.

#### Yayın engelleri

Kurumlar arası veri sızıntısı, yanlış toplam, sessiz faktör değişimi, kaynaksız kesin mevzuat yorumu, lisanssız içerik, eksikleri gizleyen rapor veya geri yüklenemeyen veri yayın engelidir. Pilotun dar kapsamı kullanıcıya açıkça belirtilir; “tam GRI uyumlu” pazarlaması yapılmaz.

#### Planlama

Takvim ve bütçe ekip kapasitesi, lisanslar ve entegrasyon keşfi sonrasında belirlenir. Bu belge kesin teslim tarihi veya maliyet taahhüdü içermez.

### 31 Uygulamayı geliştirecek yapay zekâya talimat

Aşağıdaki talimat bu belgenin tamamıyla birlikte kullanılmalıdır. Ürün sahibinin amacı yalnız ekran prototipi değil, rehberlik ve doğrulanabilir hesaplamayı birleştiren çalışan uygulamadır.

#### Ana geliştirme talimatı

Koza adlı Türkçe öncelikli sürdürülebilirlik uygulamasını bu şartnameye göre geliştir. Birincil kullanıcının konuya yeni başladığını kabul et. Ekranları “ne yapmak istiyorsun” ve “sonraki adım” etrafında kur. Teknik terimleri açıklamasız seçim olarak sunma. Kapsam 1, 2, Kapsam 3’ün 15 kategorisi ve yaşam döngüsü sınırlarını ayrı fakat ilişkili modeller olarak uygula.

Önce mevcut çalışma ortamını ve kodu incele. Gereklilik kimliklerini uygulanacak modül ve testlerle eşleştir. Uygulama planını, veri modelini, rol matrisini ve ilk uçtan uca akışı üret. Rutin geri alınabilir kararları belgedeki varsayımlarla ilerlet; hesap yöntemi, veri hakkı veya hukuki uygulanabilirlikte eksik otoriteyi uydurma.

#### Kodlama kuralları

Hesaplamayı deterministik, sürümlü ve test edilebilir servis olarak uygula. Yapay zekâdan gelen serbest metni hesap sonucu veya üretim faktörü olarak kullanma.

Yetkiyi sunucuda denetle; tenant izolasyonunu veri tabanı, dosya ve bilgi arama katmanlarında koru. Anahtarları istemciye veya depoya yazma.

Taslak, hesaplandı, incelemede, onaylandı ve kilitli durumlarını uygula. Gerçek kalıcı kayıt olmadan başarı mesajı gösterme.

Boş, sıfır, bilinmeyen, uygulanamaz ve tahmini durumlarını ayır. Her ekranda yüklenme, hata, boş sonuç ve yetki durumunu tamamla.

Kaynak sürümü ve kullanım hakkı doğrulanmamış içeriği tam metin olarak kopyalama. Örnek katsayıları yalnız test alanında kullan.

Bir özellik desteklenmiyorsa dürüstçe belirt; sahte grafik, uydurma belge veya çalışmayan butonla tamamlandı deme.

#### Teslim biçimi

Her geliştirme diliminde çalışan değişiklik, etkilenen dosyalar, göçler, test kanıtı, desteklenen yöntemler ve açık eksikleri sun. 29 numaralı bölümdeki test ailesindeki ilgili kontrolleri ve uzman onayını tamamla. İlk olarak kurum kurulumu → doğal gaz kaydı → hesap → inceleme → rapor izini çalıştır; ardından elektrik ve Kapsam 3’ü ekle. Ürünü yalnız sohbet botu veya yalnız karbon hesap makinesi seviyesinde bırakma.

### 32 Karar kaydı ve üretim öncesi kontroller

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

#### Tutarlılık kontrol listesi

İlk sayfadaki değer önerisi çalışan özelliklerle karşılanıyor mu? Acemi kullanıcı teknik karar vermeden ilerleyebiliyor mu? Hesap sonucu kanıta kadar izlenebiliyor mu? Kapsam 3’te eksik kategori görünür mü? Ürün sınırı ile kurumsal kapsam ayrılmış mı? Kaynak güncelliği ve uygulama tarihi ayrı mı? Onay ve rapor sürümü korunuyor mu?

#### Profesyonel inceleme kapısı

Geliştirme tamamlandığında alan uzmanı hesap ve standart eşleştirmelerini; hukuk/lisans sorumlusu kullanım ve veri koşullarını; güvenlik sorumlusu izolasyon ve işletimi; ürün sahibi başlangıç kullanıcısı deneyimini kabul eder. Bu incelemeler yalnız geliştirme ekibinin “çalışıyor” beyanıyla ikame edilmez.

#### Sürüm sonrası işletim

Hata ve yöntem düzeltmeleri önem derecesine göre ele alınır. Hesap etkisi olan hata için etkilenen kurum/dönem listesi çıkarılır, yeni sürüm ve yeniden hesap planı hazırlanır. Kullanıcıya etki ve yapılacak işlem açıkça bildirilir. Geçmiş sonuçlar sessizce değiştirilmez.

### 33 Kaynaklar ve uygulama dayanakları

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

### 34 Kaynaklar ve izlenebilirlik devamı

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

#### Kaynak kullanma kuralı

Üretim hesap motorunda yalnız bu URL listesinin bulunması yeterli değildir. Kullanılan tablonun veya maddenin tam kimliği, sürümü, birimi, sınırı, izin durumu ve uzman onayı gerekir. Bu belgedeki sayısal test örnekleri kaynak faktörü değildir.

#### Gereklilik izinin korunması

Ürün sahibi bu belgeyi geliştirme talimatı olarak verir. Geliştirici gerekliliği modüle ve kabul testine bağlar. Alan uzmanı yöntem/kaynak eşleştirmesini onaylar. Kullanıcı verisi kaynaktan hesap ve rapora kadar izlenir. Ürün değiştiğinde bu dört bağın birlikte güncellenmesi gerekir.


## v1.1 gereklilik eki

<a id="v1-1-gereklilik-eki"></a>

*Kaynak dosya: `docs/spec/KOZA_v1.1_gereklilikler.md`*

## KOZA v1.1 — Gereklilik eki

Sürüm 1.1 · 13 Ekim 2026 · v1.0 şartnamesini genişletir; çelişkide bu ek geçerlidir.

### 1. Neden bu ek

Koza'nın ana mantığı değişmez: rehberli görev → kanıtlı veri → deterministik hesap → uzman kontrolü → rapor. Bu ek, Young Professionals Forum'da ortaya çıkan ana sorunu ("işletmede sürdürülebilirlik odaklı sistem mimarisi yok") ve iki hedefi (**verimlilik** ve **çalışan memnuniyeti**) ürüne bağlar. Ürün **tüm sektörlere** uyarlanabilir; sektöre özgü her şey sürümlü profil verisidir.

v1.0'daki "İlk odak Türkiye'de üretim yapan işletmeler" ifadesi şöyle okunur: ilk pazar Türkiye; sektör, pilot kararıyla seçilir ve sektör profili olarak yüklenir.

### 2. Forum eksenleri → Koza

| Forum ekseni | Kök neden | Koza'daki karşılığı | v1.1 eki |
| --- | --- | --- | --- |
| Yönetişim | Sahiplik, hedef, öncelik yok | §04, §21, §22 | Hedef kartı + RACI, yatırım talebine karar kapısı, gölge karbon fiyatı senaryosu |
| Veri ve dijital altyapı | Dağınık, güvenilmez veri | §11, §18, §27 | Gösterge sözlüğü, çekirdek gösterge paketi, profile göre yoğunluk panosu, MRV uyumlu izleme planı |
| Tedarik zinciri | Tedarikçi verisi yok, güven sorunu | §14, §21 | Segmentasyon, gizlilik taahhüdü, öz değerlendirme, gömülü emisyon talebi |
| Sosyal | Farkındalık düşük, saha katılmıyor | §07, §23 | Rol bazlı öğrenme, Green Kaizen, sürdürülebilirlik elçisi |
| Dış ekosistem | Regülasyon, finansman, maliyet | §09, §19 | Regülasyon paketleri, fon haritası (ön değerlendirme), ortak veri şablonu |

Sistem mimarisi önerisi (strateji ve sahiplik → süreç mimarisi → veri yönetişimi → entegrasyon → ortak ESG veri katmanı → karar ve aksiyon motoru): Koza bu katmanların kullanıcı yüzüdür; altıncı katman (AKS) bu ekle gelir. Karbon finansal kalem önerisi (ETS): MRV verisi üretim verisidir; fiyat/tahsis/alım-satım senaryo defterindedir.

### 3. Yeni roller

| Rol | Görür / yapar | Sınır |
| --- | --- | --- |
| Saha çalışanı / operatör | Mobil sade görünüm, alan/hat hedefi, Green Kaizen önerisi, kısa saha dersleri | Envanter verisi yazamaz; kişisel sıralamada görünmez |
| Sürdürülebilirlik elçisi | Birim görevleri, öneri ön değerlendirmesi, ders önerme | Onay veremez |
| Finans / karbon masası | Senaryo defteri, gölge karbon fiyatı, regülasyon maruziyet özeti | Envanter salt okunur |
| Yönetici / sponsor (genişletildi) | Hedef kartı, RACI, iki hedefin durumu | — |

### 4. Gereklilikler

#### SEK — Sektör uyarlama katmanı

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

#### GÖS — Gösterge sözlüğü ve veri sözleşmesi

- **GÖS-01** Her gösterge: tanım, birim, kaynak sistem, veri sahibi, güncelleme sıklığı, kalite kuralı, erişim yetkisi.
- **GÖS-02** Çekirdek paket (tüm sektörler): enerji (elektrik, yakıtlar), Kapsam 1–2, su, atık, iş kazası, kişi başı eğitim saati, faaliyet çıktısı. Sektöre özgü göstergeler profilden eklenir.
- **GÖS-03** Yoğunluk göstergesi, profildeki payda tanımı ve dönemi olmadan hesaplanmaz.
- **GÖS-04** Veri sözleşmesi testleri (kaynak, birim, zaman, tutarlılık); uygunsuz kayıt düzeltme kuyruğuna.

#### AKS — Karar kapısı ve aksiyon motoru

- **AKS-01** Tetikleyiciler: KPI sapması, yeni yatırım, süreç/hat değişikliği, çalışan önerisi, mevzuat gereği.
- **AKS-02** Ön değerlendirme: enerji, su, karbon, atık/fire, İSG, ergonomi, iş yükü, maliyet; bilinmeyen alan "bilinmiyor" kalır.
- **AKS-03** Seçenekler ekonomik, çevresel ve çalışan etkisiyle yan yana; pilot sorumlusu ve süresi atanır.
- **AKS-04** Baz dönemle ölç (profildeki yoğunluklar, atık/fire, öneri uygulama oranı, memnuniyet). İki hedef de eşiği karşılarsa standardize et; değilse kök neden ve yeniden tasarım.
- **AKS-05** Yatırım talebinde "enerji/emisyon etkisi" zorunlu; gölge karbon fiyatı varsa senaryo olarak eklenir.

#### KZN — Green Kaizen

- **KZN-01** Saha çalışanı mobilde 3 alanlı öneri girer: ne gördüm, ne öneriyorum, hangi alan/hat/ekipman. Fotoğraf isteğe bağlı.
- **KZN-02** Elçi ön değerlendirir; uygun öneri AKS-01 tetikleyicisi olur.
- **KZN-03** Uygulanan öneri, ölçülen etkisiyle öneri sahibine geri bildirilir.

#### REG — Regülasyon uyum paketleri

- **REG-01** Her yükümlülük (CBAM, ulusal ETS/MRV, TSRS, AB müşterilerinin tedarik zinciri talepleri vb.) ayrı, sürümlü pakettir; §08 uygulanabilirlik değerlendirmesiyle açılır.
- **REG-02** Tesis ETS kapsamındaysa Kapsam 1 sınırı ulusal MRV kılavuzuna eşlenir; izleme planı sürümlü ve denetlenebilir.
- **REG-03** Ürün düzeyi yükümlülükler (ör. CBAM gömülü emisyon) ürün bağlamında (§17) hesaplanır; kurumsal toplama eklenmez.
- **REG-04** Yurt içinde ödenen karbon maliyetinin kanıtı ihracat müşterisine verilecek biçimde hazırlanır (paket açıksa).
- **REG-05** Tahsis, açık/fazla ve alım-satım senaryoları yalnız senaryo defterinde.
- **REG-06** Eşik, tarih, benchmark koda yazılmaz; §19 üzerinden sürümlü kural.

#### TDR — Tedarikçi veri programı

- **TDR-01** Harcama ve emisyon yoğunluğuna göre sıralama; ilk dalga kritik %20.
- **TDR-02** Kısa standart talep + gizlilik ve "yalnız toplulaştırılmış kullanım" taahhüdü ilk ekranda.
- **TDR-03** Risk temelli denetim: önce öz değerlendirme; yüksek riskte saha ziyareti görevi; ceza yerine düzeltici plan.
- **TDR-04** KOBİ tedarikçiye kısa MRV/karbon muhasebesi dersi ve örnek dolu şablon.

#### ÖĞR — Rol bazlı öğrenme

- **ÖĞR-01** Yönetici: strateji ve kurum için açık regülasyon paketleri.
- **ÖĞR-02** Mühendis/uzman: karbon ayak izi, yaşam döngüsü, veri kalitesi, MRV.
- **ÖĞR-03** Saha: enerji, atık/fire, güvenlik; ≤3 dakikalık mobil dersler; örnekler profilden.
- **ÖĞR-04** Her ders gerçek bir göreve bağlanır (§07); eğitim saati GÖS paketine toplu yazılır.

### 5. Asistanın rolü

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

### 6. Başarı ölçütleri

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

### 7. Kabul koşulları (v1.1)

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

### 8. Kaynak belgeler

KOZA Ürün ve Geliştirme Şartnamesi v1.0 (12 Ekim 2026); GreenSync Young Professionals Forum — ESG Fishbone: Solution Proposals ve ETS eki; sürdürülebilirlik sistem mimarisi ve karar akışı önerisi.


## v1.1 rehber (uzun biçim)

<a id="v1-1-rehber-uzun-bicim"></a>

*Kaynak dosya: `docs/spec/KOZA_v1.1_rehber.md`*

## KOZA v1.1 — Forum Bulgularıyla Geliştirilmiş Ürün Yönü ve Yapay Zekâ Geliştirme Rehberi

13 Ekim 2026 · EU Projects

Bu belge, `KOZA_v1.1_gereklilikler.md` dosyasındaki gereklilik ekinin **uzun biçimidir** (gerekçe, kullanıcı tablosu, modül anlatımı, yol haritası ve açık kararlar). Kaynak dosya: `docs/kaynak/KOZA_v1.1_Urun_Yonu_ve_YZ_Gelistirme_Rehberi.docx`. Gereklilik kimlikleri ve kabul koşulları iki belgede aynıdır; çelişkide kısa ek (`KOZA_v1.1_gereklilikler.md`) geçerlidir.

### 1. Özet

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

### 2. Forum bulgularının Koza'ya eşlenmesi

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

### 3. Genişletilmiş kullanıcılar ve roller

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

### 4. Yeni ve genişletilen modüller

Yedi modül eklenir; ilki (SEK) ürünü tüm sektörlere uyarlayan katmandır. Her biri mevcut veri modelini, kanıt/onay altyapısını ve hesap motorunu kullanır; kendi hesabını yapmaz.

#### 4.1 Sektör uyarlama katmanı (SEK)

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

#### 4.2 Gösterge sözlüğü ve veri sözleşmesi (GÖS)

- **GÖS-01:** Her gösterge için tanım, birim, kaynak sistem, veri sahibi, güncelleme sıklığı, kalite kuralı ve erişim yetkisi tutulur.
- **GÖS-02:** Çekirdek paket (tüm sektörler): enerji (elektrik, yakıtlar), Kapsam 1–2 emisyon, su, atık, iş kazası, kişi başı eğitim saati ve faaliyet çıktısı. Sektöre özgü göstergeler SEK profilinden eklenir.
- **GÖS-03:** Yoğunluk göstergeleri (ör. kWh/ton, kWh/m², kg CO₂e/çalışan) profildeki payda tanımı ve dönemi olmadan hesaplanmaz.
- **GÖS-04:** Veri sözleşmesi testleri (kaynak, birim, zaman, tutarlılık); uygunsuz kayıt düzeltme kuyruğuna gider.

#### 4.3 Karar kapısı ve aksiyon motoru (AKS)

- **AKS-01 Başlat:** Tetikleyici türleri: KPI sapması, yeni yatırım, süreç veya hat değişikliği, çalışan önerisi, mevzuat gereği.
- **AKS-02 Ön değerlendir:** Enerji, su, karbon, atık/fire, İSG, ergonomi, iş yükü ve maliyet etkisi alanları doldurulur; bilinmeyen alan "bilinmiyor" kalır.
- **AKS-03 Seçenek ve pilot:** Alternatifler ekonomik, çevresel ve çalışan etkisiyle yan yana; pilot sorumlusu ve süresi atanır.
- **AKS-04 Ölç ve karar ver:** Baz dönemle karşılaştırma (profildeki yoğunluk göstergeleri, atık/fire, öneri uygulama oranı, memnuniyet skoru). İki hedef de eşiği karşılıyorsa standardize et; değilse kök neden ve yeniden tasarım.
- **AKS-05:** Yatırım talebinde "enerji/emisyon etkisi" alanı zorunlu; gölge karbon fiyatı varsa senaryo olarak eklenir.

#### 4.4 Green Kaizen (KZN)

- **KZN-01:** Saha çalışanı mobilde 3 alanlı öneri girer: ne gördüm, ne öneriyorum, hangi alan/hat/ekipman. Fotoğraf isteğe bağlı.
- **KZN-02:** Elçi ön değerlendirir; uygun öneri AKS-01'e tetikleyici olarak geçer.
- **KZN-03:** Uygulanan öneri, ölçülen etkisiyle birlikte öneri sahibine geri bildirilir; tanıma görünür.

#### 4.5 Regülasyon uyum paketleri (REG)

- **REG-01:** Her yükümlülük (CBAM, ulusal ETS/MRV, TSRS, AB müşterilerinin tedarik zinciri talepleri vb.) ayrı ve sürümlü bir pakettir; kurum profiline göre §08 uygulanabilirlik değerlendirmesiyle açılır.
- **REG-02:** Tesis ETS kapsamındaysa Kapsam 1 sınırı ulusal MRV kılavuzuna eşlenir; izleme planı sürümlü ve denetlenebilir üretilir.
- **REG-03:** Ürün düzeyi yükümlülükler (ör. CBAM gömülü emisyon) ürün bağlamında (§17) hesaplanır; kurumsal toplama eklenmez.
- **REG-04:** Yurt içinde ödenen karbon maliyetinin kanıtı, ihracat müşterisine verilecek biçimde hazırlanır (ilgili paket açıksa).
- **REG-05:** Ücretsiz tahsis, açık/fazla ve alım-satım senaryoları yalnız senaryo defterinde çalışır.
- **REG-06:** Eşikler, tarihler ve benchmark değerleri kod içine yazılmaz; §19 kaynak izleme ile sürümlü kural olarak gelir.

#### 4.6 Tedarikçi veri programı (TDR)

- **TDR-01:** Tedarikçiler harcama ve emisyon yoğunluğuna göre sıralanır; ilk dalga kritik %20.
- **TDR-02:** Kısa standart talep şablonu + gizlilik ve "yalnız toplulaştırılmış kullanım" taahhüdü talebin ilk ekranında görünür.
- **TDR-03:** Risk temelli denetim: önce öz değerlendirme; yüksek riskte saha ziyareti görevi; ceza yerine düzeltici plan.
- **TDR-04:** KOBİ tedarikçiye kısa MRV/karbon muhasebesi dersi ve örnek dolu şablon açılır.

#### 4.7 Rol bazlı öğrenme yolları (ÖĞR)

- **ÖĞR-01:** Yönetici: strateji ve regülasyon (kurum için açık paketler).
- **ÖĞR-02:** Mühendis/uzman: karbon ayak izi, yaşam döngüsü, veri kalitesi, MRV.
- **ÖĞR-03:** Saha çalışanı: kendi alanında enerji, atık/fire ve güvenlik; 3 dakikayı geçmeyen mobil dersler. Örnekler sektör profilinden gelir.
- **ÖĞR-04:** Her ders bir gerçek göreve bağlanır (§07 kuralı korunur); eğitim saati GÖS paketine toplu olarak yazılır.

### 5. Yapay zekânın yönlendirici rolü ve sınırları

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

### 6. Aşamalı yol haritası

Forumun 0–6 / 6–18 / 18–36 ay yol haritası, şartnamenin "ilk uçtan uca iz" kuralıyla birleştirildi: önce tek bir doğru veri-hesap-rapor zinciri, sonra iki hedefi besleyen döngü, en son entegrasyon ve dış uyum.

| Faz | İçerik | Kapı |
| --- | --- | --- |
| Faz 1 · Doğru zincir | Kurum kurulumu → doğal gaz → hesap → inceleme → rapor; elektrik; SEK + GÖS (Dilim 0–4) | **Pilot kapısı:** kurumlar arası erişim testi + yeni kullanıcının yardımsız ilk taslağı |
| Faz 2 · İki hedefi besleyen döngü | KZN + ÖĞR, AKS (Dilim 5–6) | — |
| Faz 3 · Entegrasyon ve dış uyum | TDR + Kapsam 3, REG paketleri + senaryo defteri (Dilim 7–8) | **Ölçekleme kapısı:** iki hedefin eşikleri + uzman onaylı altın set |

Bir sonraki faza yalnız kapı koşulları sağlandığında geçilir; süreler pilot kapasitesine göre güncellenir ve teslim taahhüdü değildir (§30). Dilim tanımları `GELISTIRME-KURALLARI.md` "Dilim sırası" tablosundadır.

### 7. Başarı ölçütleri ve yeni kabul koşulları

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

#### Yeni kabul koşulları

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

### 8. Uygulamayı geliştirecek yapay zekâya güncellenmiş talimat

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

### 9. Açık kararlar ve doğrulanacak konular

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


---

# D. Kararlar ve izleme


## Karar kaydı

<a id="karar-kaydi"></a>

*Kaynak dosya: `docs/karar-kaydi.md`*

## Karar kaydı

Belirsiz noktalar burada çözülür; çözülmeden ilgili kod yazılmaz (§32). Geliştirici yeni bir belirsizlik bulursa satır ekler ve durur.

| # | Karar | Önerilen başlangıç | Kesinleştiren | Durum | Kanıt / tarih |
| --- | --- | --- | --- | --- | --- |
| K-01 | Teknoloji yığını ve sürümler | GELISTIRME-KURALLARI.md'deki öneri | Teknik sorumlu | **Dilim 0 kararı** | 13 Eki 2026: Next.js 16 (statik dışa aktarma, TypeScript), FastAPI + Pydantic v2 (Python ≥3.11), saf Python `koza_calc` (Decimal, stdlib), PostgreSQL 15 (RLS). Sürümler `apps/web/package.json`, `apps/api/pyproject.toml`. Gerekçeyle değiştirilebilir. |
| K-02 | Pilot sektör profilleri | `genel` + 2 profil | Ürün sahibi + alan uzmanı | Açık | Taslak profiller: `genel`, `agir-sanayi`, `gida-icecek` (status: draft) |
| K-03 | Profil sınıflandırması (NACE düzeyi, çok faaliyetli kurum kuralı) | NACE bölüm düzeyi; tesis bazlı profil | Alan uzmanı | Açık | Önizlemede bölüm/grup ön ek eşleşmesi; tesise profil alanı var |
| K-04 | Hesap otoritesi | GHG Protocol tabanlı sürümlü yöntemler | Alan uzmanı | Açık | Test yöntemi `ghgp-corporate-test@0.1`, `approved: false` |
| K-05 | Faktör kaynakları ve lisansları | Resmî / tedarikçi / lisanslı kaynaklar | Yöntem ve lisans sorumlusu | Açık | Üretim kataloğu boş; yalnız kurgusal test kataloğu |
| K-06 | Ulusal ETS: ikincil mevzuat, MRV kılavuzu, tahsis kuralları | Resmî kaynaktan doğrulanana kadar `review_required` | Raporlama uzmanı | Açık | |
| K-07 | CBAM'de menşe ülkede ödenen karbon fiyatının kanıt formatı | AB güncel uygulama mevzuatı | Raporlama uzmanı | Açık | |
| K-08 | TSRS uygulanabilirliği | Güncel KGK kararı + kurum profili | Raporlama uzmanı | Açık | |
| K-09 | Green Kaizen ve saha verisi için KVKK | Birim düzeyinde toplulaştırma | Hukuk + çalışan temsilcisi | Açık | Dilim 5 bu karara bağlı |
| K-10 | Memnuniyet / bağlılık ölçüm yöntemi | Anonim, çeyreklik kısa anket | İK | Açık | |
| K-11 | Gölge karbon fiyatını belirleyen ve güncelleme sıklığı | Finans + sürdürülebilirlik, yıllık | Yönetim | Açık | |
| K-12 | Sözlük ve GRI/ISO içerik kullanım hakları | Bağlantı + özgün kısa açıklama | Hukuk/lisans | Açık | `content/terms` özgün kısa açıklama; `content/sources` yalnız bağlantı |
| K-13 | Veri saklama süresi ve bölgesi | Sözleşmeye uygun en düşük gerekli saklama | Güvenlik + hukuk | Açık | |
| K-14 | Ortak veri şablonu için sektör dernekleri / OSB / üniversite iş birliği | Kazanılmış kabul edilmez | Ürün sahibi | Açık | |
| K-15 | Fon haritası kaynakları | Yalnız resmî çağrı metinleri | İçerik sorumlusu | Açık | |
| K-16 | Önizleme yayın biçimi: sunucusuz statik site, tarayıcı deposu, Pyodide ile motor | Grup incelemesi için yeterli; pilot öncesi sunucu + Postgres zorunlu | Teknik sorumlu | **Geçici karar (13 Eki 2026)** | Ekranlarda "önizleme deposu: bu tarayıcı" etiketi; kural 4 sunucu uygulaması `apps/api` ile sağlanır, önizlemede çalışmaz |
| K-17 | Toplama (onaylı kayıtların CO₂e toplamı) kimin işi | Motorda `aggregate()` | Teknik sorumlu + alan uzmanı | **Karar (14 Eki 2026)** | `koza_calc.aggregate()` tek toplama otoritesi: kurumsal/ürün ayrımı, Kapsam 2 tek yöntem, unknown/NA listeleri; arayüz ve API yalnız bu çıktıyı gösterir |


## Gereklilik izleme matrisi

<a id="gereklilik-izleme-matrisi"></a>

*Kaynak dosya: `docs/gereklilik-izleme.md`*

## Gereklilik izleme matrisi

Güncelleme: 2026-10-14. Kaynak: `docs/gereklilik-izleme.json` (arayüzdeki Proje durumu sekmesi aynı dosyayı okur; bu dosya betikle üretilir, düzenleme JSON'da yapılır).

Durumlar: **tamam** — Uygulandı; test veya ekran gösterimi var; **tamam · karar bekliyor** — Uygulandı; ürün kararı grup/uzman onayı bekliyor (karar kaydı)

| Kimlik | Gereklilik | Durum | Nerede | Kanıt |
| --- | --- | --- | --- | --- |
| `ONB-01` | Kurum profili: ad, sektör (NACE), ülke, tesisler, dönem | tamam | /kurulum | Kurulum akışı; kaldığı adımdan devam; vitest store.test |
| `ONB-02` | Envanter sınırı; bilinmiyorsa uzman görevi | tamam | /kurulum, Store.setBoundary | 'Bilmiyorum' → pending_expert + görev |
| `ONB-03` | Kaynak envanteri soruları profilden; tüm kaynak türleri | tamam | /kurulum, content/sector-profiles | Yakıt/gaz/şebeke/kategori alanları; hiçbir kategori silinmez |
| `DAT-01…06` | Rehberli veri girişi: tüm §11 seçenekleri, şema-güdümlü form, OCR, kanıt, taslak/gönder | tamam | /veri-girisi, src/modules/kayit/schemas.ts | 24 şema; 38 vitest; OCR Tesseract (tur+eng) alan bazlı onay; asistan önerisi onayla |
| `§11 içe aktarma` | CSV/XLSX eşleme, önizleme, satır hataları, idempotent, geri alma | tamam | /ice-aktar, src/modules/kayit/importer.ts | Dosya ve satır karması; yalnız taslaklar geri alınır |
| `§12 Kapsam 1` | Sabit/mobil yakma, proses, soğutucu (yeni dolum ≠ kaçak) | tamam | koza_calc engine/refrigerant; /kayit | T11 fixture'ları; birim/esas/koşul engelleri |
| `§13 Kapsam 2` | Konum ve piyasa bazlı; araçlar; kalan tüketim; toplanmaz | tamam | koza_calc scope2; /kayit yöntem seçici | T05/T06 fixture'ları; araç > tüketim bloke |
| `§14–§16 Kapsam 3` | 15 kategori, yöntem matrisi (MTH-01…05), kalite boyutları, harcama, ömür boyu | tamam | koza_calc scope3 + SUPPORTED; /veri-girisi; /envanter | T08–T10, T12 fixture'ları; kategori değerlendirmesi unknown/NA |
| `§17 Ürün` | Ürün çalışması: dört sınır sorusu, tahsis, kısmi/ürün karbon ayak izi; kurumsal toplama girmez | tamam | /urun, src/modules/urun-rapor | 15 vitest; aggregate ürün bölümü ayrı |
| `§18 Motor` | Deterministik Decimal motor, iz kaydı, sürümlü faktör/yöntem, hata davranışı | tamam | packages/calc-engine (0.2.0) | 200 pytest; 77 altın örnek; tarayıcıda Pyodide aynı kod |
| `§19 SRC-01…07` | Kaynak sürümü, karma, değişiklik kartı, uzman onayı, görev | tamam | /regulasyon, /protokoller, content/sources | Yayın/yürürlük/görülme/kontrol tarihleri ayrı; doğrulanmamış kural → review_required |
| `§20 Veri modeli` | tenant_id, RLS, append-only, değer durumu | tamam | db/migrations | PostgreSQL 15 up→down→up; CHECK ve tetikleyiciler |
| `§21 İş akışı` | Durumlar, inceleme, onay geçersizliği, kapanış, kilit/yeniden açma, uzlaştırma | tamam | Store, /inceleme, /donem; apps/api workflow | T17, T18; uzlaştırma listesi; 37 API testi |
| `§22 Analiz ve rapor` | Yoğunluk (payda+dönem şartı), fark ayrıştırması, hedef kartı, rapor paketi, GRI/TSRS indeksi, dışa aktarma, yayım | tamam | /analiz, /raporlar, content/reporting-maps | aggregate() toplamları; JSON/CSV/DOCX/yazdır; T19 |
| `§23 Karbon dışı` | Çekirdek gösterge paketi: su, atık, İSG, eğitim, çıktı | tamam | content/indicators, /analiz | GÖS-04 veri sözleşmesi; düzeltme kuyruğu |
| `§24 AI-01…06` | Kaynaklı asistan: kaynak, koşul, belirsizlik, eylem; araç sınırları; belge güvenliği | tamam | /asistan, src/modules/asistan | 12 değerlendirme senaryosu; 34 vitest; T15/T16 |
| `§25 Güvenlik` | Yetki sunucuda, izolasyon, denetim izi, hız sınırı, CSV enjeksiyon, imzalı bağlantı | tamam | apps/api, db/migrations, docs/uretime-gecis.md | İzolasyon testleri; üretim adımları yönergede |
| `§26–§27 API` | /v1 uçları, idempotency, ETag, hata zarfı, içe aktarma, kaynak sürümleri, toplama | tamam | apps/api, docs/api/openapi.yaml | pytest; openapi üretildi |
| `§28 Ekran durumları` | İlk kullanım/yükleniyor/boş/kısmi/hata/yetki yok/çakışma/başarılı; klavye; hata sözlüğü | tamam | src/components/ui.tsx, /hatalar | Hata sözlüğü kaynak/neden/sonuç/eylem; hata sınırı; 404 |
| `T01–T04` | CO₂ bileşeni, çift GWP yok, m³ koşulu, esas uyumu | tamam | tests/golden | pytest + tarayıcı altın set |
| `T05–T06` | Elektrik iki yöntem; belge kısmi kapsama | tamam | tests/golden/T05-*, T06-* | fixture'lar geçer |
| `T07` | Aynı fatura yeniden yükleme | tamam | Store.addEvidence/duplicateCandidates | vitest; karma + fatura no + dönem |
| `T08–T10` | Kat.1 kapıdan kapıya; üst aşama çakışması; veri yok → sıfır değil | tamam | tests/golden/T08-*, T09-*, T10-* | fixture'lar geçer |
| `T11` | Soğutucu yeni dolum kaçak sayılmaz | tamam | tests/golden/T11-* | not_applicable; top-up review |
| `T12` | Ömür boyu satış grubu tekrar eklenmez | tamam | tests/golden/T12-*; src/modules/kayit/store.ts lifetime_groups | motor grup bilgisi + depo kontrolü (vitest) |
| `T13` | Faktör güncellenince eski sonuç korunur | tamam | /faktorler, Store.publishFactorVersion | vitest; etkilenen kayıt listesi |
| `T14` | Başka kurumun kaydı reddedilir | tamam | tests/isolation; RLS | 13 işlemde 404; vitest izolasyon |
| `T15–T16` | Belgede talimat veridir; kaynaksız hukuki soruya hüküm yok | tamam | src/modules/asistan | E06/E05/E10 senaryoları |
| `T17–T19` | Kilitli dönem; sürüm çakışması; rapor manifesti | tamam | Store, /donem, /raporlar | vitest + API testleri |
| `T20` | Birim bilinmiyor → taslak korunur | tamam | /veri-girisi, tests/golden/T20-* | görev + motor UNIT_UNKNOWN |
| `SEK-01…05` | NACE profil önerisi, profil = veri, önerir/silmez, sürüm değişince geçmiş değişmez, genel profil | tamam · karar bekliyor | /kurulum, content/sector-profiles | Profiller taslak; alan uzmanı onayı K-02, NACE düzeyi K-03 |
| `GÖS-01…04` | Gösterge sözlüğü, çekirdek paket, yoğunluk şartı, veri sözleşmesi | tamam | /analiz, content/indicators | 17 vitest (performans) |
| `AKS-01…05` | Tetikleyici → ön değerlendirme → seçenek → pilot → ölçüm → kapı | tamam | /aksiyon | Etki ölçülmeden kapanmaz testi; gölge fiyat senaryo satırı |
| `KZN-01…03` | Green Kaizen: 3 alanlı öneri, elçi değerlendirmesi, geri bildirim; birim toplulaştırma | tamam · karar bekliyor | /kaizen | Kişi bazlı sıralama yok testi; KVKK görüşü K-09 |
| `REG-01…06` | Paketler (CBAM, ulusal ETS/MRV, TSRS, AB tedarik), uygulanabilirlik, MRV planı, kanıt paketi, senaryo, eşik koda yazılmaz | tamam · karar bekliyor | /regulasyon, /senaryo, content/regulation-packages | Doğrulanmamış kural → review_required; resmî metin K-06/K-07/K-08 |
| `TDR-01…04` | Segmentasyon, gizlilik taahhüdü kapısı, öz değerlendirme, KOBİ dersi | tamam | /tedarikci, content/supplier-program | 23 vitest (disiliskiler); dış gönderim açık yetki |
| `ÖĞR-01…04` | Rol bazlı ders yolları, 3 dk saha dersi, ders→görev, eğitim saati birim toplamı | tamam | /101, content/lessons | 10 ders tam içerik; 21 vitest (ogrenme) |
| `§07–§10` | 101, protokoller (kaynak kartı + uygulanabilirlik), gündem/takvim/destek, sözlük (48 terim) ve yardım yolları | tamam | /101, /protokoller, /gundem, /sozluk | Taslak yayın görev üretmez; geçmiş tarih yaklaşan değil; TSRS review_required (K-08) |
| `Yönetişim (v1.1)` | Hedef kartı, RACI, iki hedefin durumu, memnuniyet toplulaştırması | tamam · karar bekliyor | /analiz | RACI varsayılanı forum tablosundan; ölçüm yöntemi K-10 |

Özet: tamam 35, tamam · karar bekliyor 4 (toplam 39).


## Teslim notu

<a id="teslim-notu"></a>

*Kaynak dosya: `docs/teslim-notu-dilim-0-1.md`*

## Teslim notu — tam sürüm (önizleme yayını)

Tarih: 14 Ekim 2026. Biçim: GELISTIRME-KURALLARI.md "Teslim notu" ve şartname §31 "Teslim biçimi". Tüm dilimler (0–8) uygulanmıştır; gereklilik bazında kanıt `docs/gereklilik-izleme.md`.

### Karşılanan kimlikler

- v1.0: ONB-01…03, DAT-01…06, MTH-01…05, SRC-01…07, AI-01…06, T01–T20, §04 rol matrisi, §11–§25 akışları, §26–§28 mimari/API/ekran durumları, §29 test aileleri.
- v1.1: SEK-01…05, GÖS-01…04, AKS-01…05, KZN-01…03, REG-01…06, TDR-01…04, ÖĞR-01…04, yönetişim (hedef kartı, RACI, iki hedef).

### Bileşenler

| Bileşen | İçerik | Test |
| --- | --- | --- |
| `packages/calc-engine` (koza_calc 0.2.0) | Sabit/mobil yakma, proses, soğutucu, Kapsam 2 (konum/piyasa, araçlar), Kapsam 3 (15 kategori, yöntem matrisi), ürün çalışması, `aggregate()` | 200 pytest, 77 altın senaryo; aynı kod tarayıcıda (Pyodide) |
| `apps/api` (FastAPI) | Kimlik ve kurum bağlamı, §21 iş akışı, §27 uçları, idempotency/ETag, denetim izi, PostgreSQL deposu + bellek içi depo, içe aktarma, kaynak sürümleri, faktör etkinleştirme, toplama, nesne deposu, hız sınırı | pytest (bkz. `apps/api/README.md`) ve `tests/isolation` |
| `db/migrations` | tenant_id + RLS + append-only, değer durumu CHECK | PostgreSQL 15 up→down→up |
| `apps/web` | 35 ekran: kurulum, veri girişi (24 şema, OCR, CSV/XLSX), envanter, ürün, faktör kataloğu, görevler, inceleme, dönem (uzlaştırma, kilit), rapor paketi (GRI/TSRS indeksi, JSON/CSV/DOCX/yazdır, yayım, güvence), analiz/hedef/RACI, aksiyon, Kaizen, tedarikçi, regülasyon, senaryo, gündem, 101, protokoller, sözlük, asistan, ayarlar, denetim izi, durum, belgeler, altın set, hata sözlüğü | 163 vitest; ESLint/TypeScript temiz; statik derleme |
| `content/` | 3 sektör profili, 10 ders, 48 terim, 16 kaynak kartı, 4 gündem, 2 destek, çekirdek gösterge paketi, RACI, 4 regülasyon paketi, tedarikçi programı, 3 raporlama eşlemesi | gen-content doğrulaması |

### Desteklenen yöntemler

`koza_calc.SUPPORTED` (arayüzde kayıt sayfasında görünür): Kapsam 1 `activity_x_factor`/`fuel_based`/`mass_balance`; Kapsam 2 `location_based`, `market_based`; Kapsam 3 kategori başına izinli yöntemler (1–2: tedarikçiye özgü/hibrit/ortalama/harcama; 4: mesafe/yakıt/harcama; 5/12: atık türü; 6/7/9: mesafe; 11: ömür boyu kullanım; 15: yatırıma özgü; diğerleri ortalama veri). Matris dışı yöntem `METHOD_NOT_ALLOWED` ile reddedilir.

### Kurgusal katsayılar

`tests/factors/test-catalog.json` (23 faktör) ve `tests/fixtures/test_catalog.json` yalnız test ve önizleme içindir; üretim kataloğu boştur ve uzman onayıyla doldurulur (K-04, K-05).

### Karar kaydı

Grubun kesinleştireceği ürün kararları: K-02…K-15 (bkz. `docs/karar-kaydi.md`). K-16 önizleme yayın biçimi ve K-17 toplama (motor `aggregate()`) karara bağlandı.

### Alan uzmanı onayı

Hesap yöntemi, GWP seti, birim dönüşüm kuralları, altın set referans sonuçları ve sektör profilleri alan uzmanı imzası olmadan "üretim" sayılmaz (§29). Uygulama bu imzayı beklerken tam işlevle çalışır ve her yerde "test / taslak / inceleme gerekli" durumunu gösterir.


---

# E. Tasarım ve mimari


## Rol ve yetki matrisi

<a id="rol-ve-yetki-matrisi"></a>

*Kaynak dosya: `docs/rol-matrisi.md`*

## Rol ve yetki matrisi

Kaynak: şartname §04 (roller), v1.1 §3 (yeni roller), GELISTIRME-KURALLARI.md kural 4 (yetki sunucuda). Sunucu tarafı uygulaması `apps/api/koza_api/workflow.py`; önizleme eşdeğeri `apps/web/src/lib/domain.ts` (`PERMISSIONS`). Arayüzde gizlemek yetkilendirme değildir.

### İşlem × rol

| İşlem | Kurum yöneticisi | Veri giren | Veri sorumlusu | Uzman kontrolör | Onaylayan | İzleyici / denetçi | Tedarikçi | İçerik editörü | Saha çalışanı (v1.1) | Elçi (v1.1) | Finans / karbon masası (v1.1) |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Kurulum, tesis, dönem, sınır | ✓ | ✓ (taslak) | | | | | | | | | |
| Üyelik ve rol yönetimi | ✓ | | | | | | | | | | |
| Taslak kayıt oluştur / düzelt (kendi alanı) | ✓ | ✓ | ✓ | | | | | | | | |
| Kanıt ekle | ✓ | ✓ | ✓ | | | | yalnız kendi talebi | | | | |
| Hesap önizle / koşu kaydet | ✓ | ✓ | ✓ | ✓ | | | | | | | |
| Kontrole gönder | ✓ | ✓ | ✓ | | | | | | | | |
| İnceleme: düzeltme iste | | | | ✓ | ✓ | | | | | | |
| Onay ver | | | | | ✓ | | | | | | |
| Kendi girdiği kaydı onaylama | politika + gerekçe + süre ile istisna; raporda görünür | | | | | | | | | | |
| Faktör sürümü etkinleştir | | | | ✓ (alan uzmanı onayı) | | | | | | | |
| Dönemi kilitle / yeniden aç | ✓ (gerekçe + etki) | | | kilidi tek başına kaldırmaz | | | | | | | |
| Rapor sürümü oluştur | ✓ | | | | ✓ | | | | | | |
| Rapor yayımla (ayrı yetkili işlem) | ✓ | | | | ✓ | | | | | | |
| Denetim izi oku | ✓ | | | ✓ | ✓ | ✓ | | | | | |
| Dosya indir | ✓ | ✓ | ✓ | ✓ | ✓ | ayrıca sınırlandırılabilir | kendi ekleri | | | | |
| Ders / kaynak taslağı | | | | | | | | ✓ | | ✓ (öneri) | |
| Üretim hesap kuralı yayımla | yalnız yöntem sorumlusu + uzman onayı | | | | | | | ✗ | | | |
| Green Kaizen önerisi gir | | | | | | | | | ✓ | ön değerlendirme | |
| Senaryo defteri (karbon fiyatı, tahsis) | | | | | | | | | | | ✓ (envanter salt okunur) |
| Dış kişiye veri talebi gönder | ✓ (açık yetki) | | ✓ (açık yetki) | | | | | | | | |

### Kurallar

- Varsayılan: veri giren ile onaylayan farklıdır. Küçük ekip istisnası gerekçe, izin veren ve süre ile kaydedilir; raporda görünür.
- Yetki değişikliği açık oturumda da etkilidir; erişimi kaldırılan kullanıcı dosya bağlantısı ve açık oturumla devam edemez (§25).
- Tedarikçi daveti yalnız kendi talebine erişim verir; kurum envanterini ve diğer tedarikçileri göremez.
- Platform destek ekibinin müşteri verisine sürekli erişimi yoktur; süreli erişim müşteri yetkilisince açılır ve otomatik sona erer.
- Saha çalışanı envanter verisi yazamaz; kişisel sıralamada görünmez (kural 11).
- Asistanın araç çağrıları da bu matristen geçer; sohbet komutu yetki katmanını aşamaz (§24).

### Önizlemedeki durum

Önizlemede beş kullanıcı (yönetici, veri giren, uzman kontrolör, onaylayan, izleyici) üst çubuktan seçilir; her biri ayrı kimliktir, böylece görev ayrılığı denenebilir. Tedarikçi, veri sorumlusu, içerik editörü ve v1.1 rolleri henüz kullanıcı olarak yoktur. Kimlik doğrulama (OIDC/SSO, MFA) Dilim 0 kapsamında kod olarak dev-token düzeyindedir; üretim için açık eksiktir (bkz. teslim notu).


## Veri modeli ve göçler

<a id="veri-modeli-ve-gocler"></a>

*Kaynak dosya: `docs/veri-modeli.md`*

## Veri modeli ve göçler

Kaynak: şartname §20 (çekirdek model), §21 (durumlar), GELISTIRME-KURALLARI.md kural 2, 3, 9. Uygulama: `db/migrations/0001_init.sql` + `0002_api_dilim1.sql` (PostgreSQL), geri dönüşler `*.down.sql`; çalıştırıcı `apps/api/scripts/migrate.py`. Önizleme karşılığı: `apps/web/src/lib/domain.ts`.

### İlkeler

- Kimlikler UUID; sayısal alanlar `numeric(28,10)` (asla float); zamanlar UTC; dönemler tarih aralığı.
- Her kurumsal tabloda `tenant_id NOT NULL` ve RLS (`ENABLE` + `FORCE`, politika `current_setting('app.tenant_id')`). Satırlar arası ilişkilerde bileşik yabancı anahtar `(tenant_id, x_id)`: başka kurumun dönemine/kaynağına referans veritabanında reddedilir.
- Değer durumu ayrımı: `quantity` + `quantity_state ∈ {known, unknown, not_applicable}` ve `CHECK ((quantity_state='known') = (quantity IS NOT NULL))`. NULL bilinmiyor, 0 ölçülmüş sıfır, `not_applicable` gerekçeli karar; `data_quality ∈ {measured, estimated}` ayrı sütun.
- Append-only: `activity_record_version`, `activity_detail`, `calculation_run`, `calculation_result`, `approval`, `report_snapshot`, `period_reopen`, `audit_event` üzerinde UPDATE/DELETE tetikleyiciyle reddedilir. Güncel sürüm `activity_record_current` görünümü (`security_invoker`).
- `data_version` yalnız veri değiştiğinde ilerler; durum geçişi yeni satır ekler ama veri sürümü üretmez (onay geçerliliği `data_version` üzerinden türetilir).

### Varlıklar (§20 tablosu ↔ migration)

| §20 varlığı | Tablo | Not |
| --- | --- | --- |
| Organization, Facility | `organization`, `facility` | tesis profili `profile_id` (SEK-01) |
| InventoryBoundary | `inventory_boundary` | sürümlü; yaklaşım + gerekçe + onay |
| ReportingPeriod | `reporting_period` | `status ∈ {open, closing, locked}`; yeniden açma `period_reopen` |
| EmissionSource | `emission_source` | tür, yakıt, kontrol/kiralama |
| ActivityRecord (+Detail) | `activity_record`, `activity_record_version`, `activity_detail` | sürümler append-only; detay JSON şema sürümlü |
| Evidence | `evidence` | sha256, boyut, tür, tarama durumu, nesne anahtarı (`KOZA_OBJECT_STORE_DIR`), `record_id` (0002) |
| FactorVersion | `factor_version` | değer, pay/payda birimi, gaz, sınır, esas, kaynak, lisans, onay |
| MethodVersion | `method_version` | GWP seti, formül sürümü, onay |
| CalculationRun / Result | `calculation_run`, `calculation_result` | girdi karması, faktör kimlikleri, motor sürümü; değişmez |
| StandardVersion / Requirement / Mapping | `standard_version`, `requirement`, `requirement_mapping` | SRC altyapısı için iskelet |
| TopicAssessment | `topic_assessment` | §23 iskelet |
| Task / Approval | `task`, `approval` | onay geçersizliği türetilir |
| ProductStudy | `product_study` | §17 iskelet; kurumsal toplama girmez |
| ReportSnapshot | `report_snapshot` | `manifest jsonb` + `manifest_sha256` |
| Lesson / Term | `lesson`, `term` | içerik sürümü |
| AuditEvent | `audit_event` | aktör, işlem, nesne/sürüm, gerekçe; append-only |
| — | `idempotency_key` | §27 aynı anahtar aynı yanıt |
| — | `app_user`, `membership` | rol üyeliği (`member_role`) |

### Durum makinesi (§21)

`draft → validation_required → calculated → in_review → (approved | changes_requested) → locked`. Hesaplandı ≠ onaylandı. Onaylı kayıt değişirse onay geçersizleşir ve kayıt `validation_required`'a döner; kilitli dönem düzenlemesi `PERIOD_LOCKED` ile reddedilir, yeniden açma gerekçe + etki + yetkili ister.

### Doğrulama

Migration PostgreSQL 15 üzerinde `up → smoke → down → up` ile çalıştırıldı: değer durumu CHECK'i, append-only tetikleyicileri, RLS (yabancı tenant 0 satır; tenant ayarlanmadan 0 satır) ve bileşik FK reddi doğrulandı. Komut ve ayrıntı: `apps/api/README.md`.

### 0002_api_dilim1 (Dilim 1 API ekleri)

Gerekçeler dosya başında madde madde yazılıdır; özet:

| Ek | Neden |
| --- | --- |
| `app_user.oidc_subject` | OIDC `sub` → kullanıcı eşlemesi (§25 SSO) |
| `audit_event.object_id` → `text` | faktör/kaynak kimlikleri UUID değil; §25 "faktör değişimi kayda alınır" |
| `calculation_result.raw jsonb` | motor 0.2 çıktısı iç içe (Kapsam 2 `results`, `lifetime_group`); koşum sonucu birebir saklanır |
| `factor_version.activated_at/retired_at/created_by` | etkinleştirme izi (T13, §18) |
| `activity_record.import_job_id/row_hash/withdrawn_*` | içe aktarma tekrarı (aynı satır ikinci kayıt yaratmaz) ve geri alma: taslak kayıt geri çekilir, sürümleri silinmez (kural 9) |
| `evidence.record_id` | yükleme oturumunun kayıt bağı; sürüm bağı `activity_evidence`'ta |
| `import_job` | 202 + job_id, satır sonuçları, dosya sha256 |
| `session_revocation` (platform), `session_seen` (tenant) | jti iptal listesi; giriş audit'i bir kez |
| `reference_source`, `reference_source_version` | §19 kaynak kayıt defteri: yayın/yürürlük/kapsanan dönem/görülme/son kontrol ayrı alanlar, içerik karması, değişiklik kartı, uzman onayı; içerik değişmez (yalnız onay ve son kontrol alanları güncellenir — tetikleyici) |
| `integration_staging` | §27 staging; `(tenant_id, source_system, external_id, event_id)` tekil |
| `schema_migration` | çalıştırıcının sürüm kaydı |

Yeni tenant tablolarında RLS `ENABLE + FORCE`. Uygulama rolü (`migrate.py grant`) `NOBYPASSRLS`, yalnız SELECT/INSERT/UPDATE;
DELETE/TRUNCATE yetkisi yoktur. Doğrulama: `tests/isolation/test_rls_postgres.py` ve iki depolu API test paketi
(`apps/api/README.md`).

### Açık

- S3 uyumlu nesne deposu uyarlayıcısı (yerel dosya uyarlayıcısı var).
- Vektör/arama indeksi tenant etiketi (Dilim 3).
- Baz yıl yeniden hesap politikası tabloları (Dilim 8).


## Geliştirici iş akışı

<a id="gelistirici-is-akisi"></a>

*Kaynak dosya: `docs/gelistirici-is-akisi.md`*

## Geliştirici iş akışı

İki şema: (1) her geliştirme diliminin döngüsü, (2) uygulamanın çalışma anındaki akışı. Şemalar Mermaid ile yazılmıştır; GitHub, GitLab ve çoğu Markdown görüntüleyicide çizilir. Aynı şemaların görsel hâli `docs/img/` altındadır.

### 1. Geliştirme döngüsü (her dilim)

![Geliştirme döngüsü](img/gelistirme-dongusu.svg)

```mermaid
flowchart TD
    A["Gereklilik kimliklerini seç<br/>ör. DAT-01, T07"] --> B["Şartname + v1.1 ekini oku<br/>kabul koşullarını listele"]
    B --> C{"Hesap yöntemi, veri hakkı,<br/>hukuk veya sektör kuralı belirsiz mi?"}
    C -- evet --> D["Karar kaydına yaz<br/>ürün sahibine / uzmana sor"]
    D --> B
    C -- hayır --> E["Plan: veri modeli, göç,<br/>API, ekran durumları"]
    E --> F["Önce testler<br/>birim + altın set + izolasyon"]
    F --> G["En küçük çalışan değişiklik"]
    G --> H{"Testler ve /kontrol<br/>geçti mi?"}
    H -- hayır --> G
    H -- evet --> I["Teslim notu<br/>kimlikler, test kanıtı, eksikler"]
    I --> J{"Hesap veya standart<br/>değişti mi?"}
    J -- evet --> K["Alan uzmanı onayı"]
    J -- hayır --> L["Ürün sahibi incelemesi"]
    K --> L
    L --> M{"Onay?"}
    M -- hayır --> B
    M -- evet --> N["Birleştir ve sonraki dilim"]
```

### 2. Çalışma anı: kullanıcıdan rapora

![Sistem akışı](img/sistem-akisi.svg)

```mermaid
flowchart LR
    U["Yeni başlayan çalışan"] --> ONB["Kurum kurulumu<br/>NACE → sektör profili önerisi"]
    PROF[("Sektör profilleri<br/>sürümlü YAML")] -.öneri.-> ONB
    ONB --> TASK["Görev planı<br/>kaynak envanteri"]
    TASK --> DATA["Rehberli veri girişi<br/>belge / elle / içe aktarma"]
    AST["Asistan<br/>açıklar, sorar, kaynak gösterir"] -.yönlendirir.-> DATA
    SRC[("Kaynak izleme<br/>sürümlü kurallar")] -.dayanak.-> AST
    DATA --> ENG["Hesap motoru<br/>deterministik, sürümlü"]
    FAC[("Faktör kataloğu")] --> ENG
    ENG --> REV["Uzman incelemesi<br/>onay / geri gönder"]
    REV --> REP["Rapor paketi<br/>sabit manifest"]
    ENG --> KPI["Gösterge ve yoğunluk panosu"]
    KPI --> AKS["Sapma → görev → kök neden<br/>→ düzeltici faaliyet → etki"]
    KZN["Green Kaizen<br/>saha önerisi"] --> AKS
    AKS --> KPI
    ENG -.salt okunur.-> SCN["Senaryo defteri<br/>fiyat, tahsis"]
```

Kesik çizgiler veri veya öneri akışıdır; asistan ve senaryo defteri hesap sonucunu değiştiremez.


## Hesap motoru sözleşmesi v0.1

<a id="hesap-motoru-sozlesmesi-v0-1"></a>

*Kaynak dosya: `packages/calc-engine/CONTRACT.md`*

## Hesap motoru sözleşmesi — `koza_calc` 0.1

Bu belge `packages/calc-engine` paketinin dış sözleşmesidir. Motor **saf Python**'dır: I/O yok, ağ yok, saat yok, rastgelelik yok, `float` yok. Girdi JSON-uyumlu bir sözlük, çıktı JSON-uyumlu bir sözlüktür. Aynı girdi → aynı çıktı (§18, kural 1).

Motor şu an yalnız **Dilim 1** kapsamını destekler: sabit yakma (doğal gaz) için gaz bazlı veya CO₂e bazlı faktörle tek kayıt hesabı. Desteklenmeyen her şey açıkça `blocked` döner; genel bir formülle taklit edilmez (§30).

```python
from koza_calc import calculate, ENGINE_VERSION
result = calculate(request)        # dict -> dict
```

Aynı kodu Pyodide (tarayıcı) ve FastAPI (sunucu) çalıştırır; bu yüzden paket yalnız standart kütüphane kullanır (`decimal`, `hashlib`, `json`).

### Sayılar

* Tüm sayılar **ondalık dize** olarak girer ve çıkar: `"100"`, `"0.4"`, `"38.5"`. Girdide `float`/`int` gelirse `INVALID_NUMBER` ile reddedilir (sessiz dönüşüm yok).
* `decimal.Decimal`, `prec=34`, `ROUND_HALF_EVEN`. Çıktı dizeleri normalize edilir; üstel gösterim kullanılmaz (`"5000"`, `"0.4"`).
* Yuvarlama **yapılmaz**; sunum katmanı yuvarlar (§18 işlem sırası).

### İstek

```jsonc
{
  "activity": {
    "id": "act-…",                   // kayıt kimliği (iz için)
    "version": 3,                    // kayıt sürümü (iz için)
    "source_type": "stationary_combustion",
    "fuel": "natural_gas",
    "quantity": "100",
    "unit": "GJ",                    // bkz. Birimler
    "heating_value_basis": "LHV",    // "LHV" | "HHV" | null — enerji miktarının esası
    "reference_conditions": null,    // m3 için {"temperature_c": "15", "pressure_kpa": "101.325"} | null
    "calorific_value": null,         // hacim→enerji için {"value": "38.5", "unit": "MJ/m3", "basis": "LHV", "source_ref": "…"} | null
    "basis_conversion": null,        // {"ratio": "0.9", "from": "HHV", "to": "LHV", "source_ref": "…"} | null — kullanıcı açıkça verirse
    "data_quality": "measured",      // "measured" | "estimated"
    "period": {"start": "2026-01-01", "end": "2026-01-31"}
  },
  "factors": [                       // bir veya daha fazla faktör; aynı gazdan iki faktör hata
    {
      "id": "TEST-NG-CO2", "version": "1.0",
      "value": "50",
      "numerator_unit": "kg",        // kg | t
      "gas": "CO2",                  // "CO2" | "CH4" | "N2O" | "CO2e"
      "denominator_unit": "GJ",      // enerji/hacim/kütle birimi
      "basis": "LHV",                // enerji paydası için "LHV" | "HHV"; diğerleri için null
      "reference_conditions": null,  // hacim paydası için (Nm3/Sm3 tanımlı sayılır)
      "boundary": "combustion",      // "combustion" | "upstream" | "cradle_to_gate" | "well_to_wheel"
      "gwp_set_id": null,            // CO2e faktörlerde hangi GWP setiyle üretildiği (bilgi)
      "source_ref": "tests/golden — kurgusal", // ZORUNLU; yoksa FACTOR_MISSING_SOURCE
      "license": "test-only",
      "valid_from": "2026-01-01", "valid_to": null
    }
  ],
  "method": {
    "id": "ghgp-corporate-test", "version": "0.1",
    "gwp_set": {"id": "TEST-GWP", "CH4": "28", "N2O": "265"}   // kurgusal test değerleri
  }
}
```

#### Birimler

| Aile | Birimler | Dönüşüm |
| --- | --- | --- |
| Enerji | `MJ`, `GJ`, `kWh`, `MWh` | Sabit: GJ=1000 MJ, kWh=3.6 MJ, MWh=3600 MJ |
| Kütle | `kg`, `t` | t = 1000 kg |
| Hacim | `m3`, `Nm3`, `Sm3` | Bkz. aşağıda |

* `Nm3` (0 °C, 101.325 kPa) ve `Sm3` (15 °C, 101.325 kPa) **tanımlı** standart hacimlerdir. Birbirine ideal gaz oranıyla (`V₂ = V₁ · T₂/T₁ · P₁/P₂`, kelvin) dönüşür ve dönüşüm izde kaynağıyla yazılır.
* Düz `m3`, `reference_conditions` olmadan Nm3/Sm3'e **eşitlenmez** → `UNIT_CONDITIONS_UNKNOWN` (T03).
* Hacim → enerji yalnız `calorific_value` ile; `calorific_value.basis` faktör esasıyla uyuşmazsa `BASIS_MISMATCH`.
* Enerji miktarının `heating_value_basis`'i faktörün `basis`'inden farklıysa `BASIS_MISMATCH` (T04). Kullanıcı `basis_conversion` (oran + kaynak) verirse hesap yapılır fakat durum `review_required` olur; iz kaydında oran ve kaynak görünür.
* `heating_value_basis` null ve faktör esaslıysa → `BASIS_UNKNOWN` (bloke; "bilmiyorum" durumunda taslak kalır, T20).
* Enerji ↔ kütle dönüşümü desteklenmez → `UNIT_INCOMPATIBLE`.

### Yanıt

```jsonc
{
  "engine_version": "0.1.0",
  "method": {"id": "…", "version": "…"},
  "status": "computed" | "review_required" | "blocked",
  "blocks":   [{"code": "UNIT_CONDITIONS_UNKNOWN", "field": "activity.reference_conditions", "message_tr": "…"}],
  "warnings": [{"code": "…", "message_tr": "…"}],
  "normalized_activity": {"quantity": "100", "unit": "GJ", "basis": "LHV"} | null,
  "components": [                                   // gaz başına; blocked ise boş
    {"gas": "CO2", "factor_id": "TEST-NG-CO2", "factor_version": "1.0",
     "mass_kg": "5000", "gwp": null, "gwp_applied": false, "co2e_kg": "5000"}
  ],
  "total_co2e_kg": "5000" | null,                   // blocked ise null
  "coverage": "co2_only" | "partial_ghg" | "full_ghg" | "co2e_factor" | null,
  "claim_tr": "Yalnız CO₂ bileşeni; tam CO₂e sonucu değildir.",
  "boundary": "combustion",
  "trace": [
    {"step": "validate_input", "ok": true},
    {"step": "unit_conversion", "from": "100 GJ", "to": "100 GJ", "ratio": "1", "source": "sabit tablo"},
    {"step": "factor_match", "factor_id": "TEST-NG-CO2", "factor_version": "1.0", "basis_check": "LHV=LHV"},
    {"step": "gas_calculation", "gas": "CO2", "formula": "100 × 50 = 5000 kg"},
    {"step": "gwp", "gas": "CO2", "applied": false, "reason": "CO2 için GWP 1; CO2e faktöre GWP uygulanmaz"},
    {"step": "result", "total_co2e_kg": "5000", "coverage": "co2_only"}
  ],
  "inputs_hash": "sha256:…"                          // kanonik JSON (sorted keys, ascii) üzerinden
}
```

#### Kapsama (`coverage`) kuralları

* Yalnız `CO2` faktörü → `co2_only`; `claim_tr` tam CO₂e olmadığını söyler (T01).
* `CO2e` faktörü → `co2e_factor`; `gwp_applied=false`; GWP ikinci kez uygulanmaz (T02). `CO2e` faktörle birlikte gaz faktörü verilirse `FACTOR_MIX_CO2E_AND_GAS` ile bloke.
* `CO2 + CH4 + N2O` → `full_ghg`; `CO2` + yalnız biri → `partial_ghg`.
* Gaz faktörü var, `method.gwp_set` ilgili gazı içermiyor → `GWP_MISSING` (bloke).
* Farklı `boundary` değerine sahip faktörler tek istekte toplanmaz → `BOUNDARY_MIX` (yanma ile üst aşama ayrı sonuçlardır, §12).

#### Durum kuralları

* Herhangi bir `block` → `status="blocked"`, `components=[]`, `total_co2e_kg=null`.
* `basis_conversion` kullanıldı veya `data_quality="estimated"` → `review_required` (hesap yapılır; onay öncesi inceleme zorunlu).
* Aksi hâlde `computed`. **`computed` onaylandı demek değildir** (§21); onay iş akışı katmanındadır.

#### Hata kodları

| Kod | Ne zaman | Test |
| --- | --- | --- |
| `INVALID_NUMBER` | Sayı dize değil, parse edilemiyor, NaN/Inf | — |
| `NEGATIVE_QUANTITY` | Miktar < 0 (iade/düzeltme ayrı işlem türüdür, §11) | — |
| `UNIT_UNKNOWN` | Birim tabloda yok | T20 |
| `UNIT_INCOMPATIBLE` | Enerji↔kütle vb. | — |
| `UNIT_CONDITIONS_UNKNOWN` | `m3` → Nm3/Sm3, koşul yok | T03 |
| `CALORIFIC_VALUE_REQUIRED` | Hacim miktar, enerji paydalı faktör, ısıl değer yok | — |
| `BASIS_UNKNOWN` | Enerji esası bilinmiyor, faktör esaslı | T20 |
| `BASIS_MISMATCH` | HHV≠LHV, oran yok | T04 |
| `FACTOR_MISSING_SOURCE` | `source_ref` boş | §18 |
| `FACTOR_UNIT_MISSING` | pay/payda birimi yok | §18 |
| `FACTOR_DUPLICATE_GAS` | Aynı gaz iki faktörde | — |
| `FACTOR_MIX_CO2E_AND_GAS` | CO2e ile gaz faktörü birlikte | T02 |
| `GWP_MISSING` | Gaz için GWP yok | — |
| `BOUNDARY_MIX` | Farklı sınırlar tek sonuçta | §12 |
| `DIVISION_BY_ZERO` | Dönüşümde sıfır payda | §18 |
| `UNSUPPORTED_SOURCE_TYPE` | `stationary_combustion` dışı | §30 |

Her blok Türkçe, sade `message_tr` taşır; kullanıcıya "neden hesaplanmadı" bu metinle gösterilir.

### Altın set biçimi — `tests/golden/*.json`

```jsonc
{
  "id": "T01-co2-only",
  "title_tr": "100 GJ × 50 kg CO₂/GJ → yalnız CO₂ bileşeni 5 t",
  "requirements": ["T01", "§18"],
  "note_tr": "Katsayılar kurgusaldır; yalnız yazılım testi içindir.",
  "request": { … },
  "expected": {
    "status": "computed",
    "total_co2e_kg": "5000",
    "coverage": "co2_only",
    "block_codes": [],
    "components": [{"gas": "CO2", "mass_kg": "5000", "gwp_applied": false}]
  }
}
```

`expected` içindeki alanlar **alt küme eşleşmesi** ile karşılaştırılır (listelenen alanlar birebir eşit olmalı; listelenmeyenler kontrol edilmez). `koza_calc.golden.run_file(path)` ve `run_dir(dir)` yardımcıları hem pytest hem tarayıcı (Pyodide) tarafından kullanılır ve `{"passed": n, "failed": n, "results": [{"id", "ok", "diff"}]}` döner.

**Altın set uzman imzası bekliyor** (§29). Bu sürümdeki tüm faktörler kurgusaldır ve `license: "test-only"` taşır; üretim kataloğuna aktarılamaz (kural 12).


## Hesap motoru sözleşmesi v0.2

<a id="hesap-motoru-sozlesmesi-v0-2"></a>

*Kaynak dosya: `packages/calc-engine/CONTRACT-v0.2.md`*

## Hesap motoru sözleşmesi — `koza_calc` 0.2 (genişletme)

0.1 sözleşmesi (`CONTRACT.md`) **aynen geçerlidir**; bu belge onu genişletir. 0.1'deki tüm istek/yanıt alanları, hata kodları ve altın set davranışı korunur (geriye uyumluluk: 0.1 fixture'ları değişmeden geçmelidir).

`ENGINE_VERSION = "0.2.0"`. Yeni dışa aktarımlar: `calculate(request)`, `aggregate(request)`, `ENGINE_VERSION`, `SUPPORTED` (desteklenen kaynak türü × yöntem matrisi; §30 "her sürümde desteklenen kategori/yöntem matrisi yayımlanır").

Tüm sayılar yine ondalık **dize**; `float` yok; I/O yok; stdlib yalnız.

### 1. Kaynak türleri (`activity.source_type`)

| source_type | Kapsam/bağlam | Yöntem | Ek alanlar |
| --- | --- | --- | --- |
| `stationary_combustion` | Kapsam 1 | 0.1 ile aynı | — |
| `mobile_combustion` | Kapsam 1 | 0.1 ile aynı mantık (yakıt miktarı × faktör); `fuel ∈ {diesel, gasoline, lpg, natural_gas}`; birimler litre (`L`), kg, GJ, kWh | `vehicle_class` (bilgi) |
| `process` | Kapsam 1 | üretim miktarı (t) × proses faktörü (kg CO2/t); `process_id` zorunlu | — |
| `refrigerant` | Kapsam 1 | bkz. §3 | `refrigerant` |
| `purchased_electricity` / `purchased_steam` / `purchased_heat` / `purchased_cooling` | Kapsam 2 | bkz. §4 | `scope2` |
| `scope3` | Kapsam 3 kategori 1–15 | bkz. §5 | `scope3` |
| `product_process` | Ürün çalışması (§17) | bkz. §6 | `product` |

Desteklenmeyen tür → `UNSUPPORTED_SOURCE_TYPE` (0.1 ile aynı).

### 2. Birimler (ek)

| Aile | Birimler |
| --- | --- |
| Hacim-sıvı | `L` (litre), `m3_liquid` (=1000 L) — gaz hacmiyle karışmaz |
| Mesafe | `km` |
| Kütle-mesafe | `t.km` (ton-kilometre), `kg.km` |
| Para | `TRY`, `EUR`, `USD` — birbirine **dönüştürülmez**; faktör para birimiyle eşleşmezse `CURRENCY_MISMATCH` |
| Adet | `unit` |
| Yolcu-mesafe | `p.km` |

Yakıt kütle↔hacim dönüşümü yalnız istekte `density: {"value","unit":"kg/L","source_ref"}` verilirse; yoksa `UNIT_INCOMPATIBLE`.

### 3. Soğutucu (`refrigerant`) — T11

```jsonc
"refrigerant": {
  "gas": "R-134a" | "R-410A" | "unknown" | "<karışım kodu>",
  "charge_type": "new_equipment_fill" | "top_up" | "recovered" | "leak_measured" | "disposal",
  "equipment_in_inventory": true
}
```
Faktör: `gas` için GWP yöntemin `gwp_set`'inde veya faktörde (`gas: "R-134a"`, `value` = GWP, `numerator_unit: "kg"`, `denominator_unit: "kg"`, `boundary: "fugitive"`).

Kurallar (§12 kritik istisnalar):
- `new_equipment_fill` → emisyon **0 değil, "not_applicable"**: `status="computed"`, `components=[]`, `total_co2e_kg=null`, `coverage=null`, `value_state="not_applicable"`, `claim_tr="Yeni ekipman dolumu sızıntı değildir; emisyon sayılmaz."` (T11).
- `top_up` → eklenen miktar kaçak telafisi varsayımıyla emisyon = miktar × GWP; `warnings: REFRIGERANT_TOPUP_ASSUMPTION` ve `status="review_required"`.
- `leak_measured` → miktar × GWP, `computed`.
- `recovered` → negatif kütle hareketi; envantere emisyon yazılmaz (`not_applicable`, uyarı `RECOVERED_NOT_EMISSION`).
- `gas == "unknown"` → `REFRIGERANT_GAS_UNKNOWN` (bloke, "hesap bekler").
- Karışım gaz için GWP tanımı yoksa → `GWP_MISSING`.
- `equipment_in_inventory == false` → `EQUIPMENT_NOT_IN_INVENTORY` (bloke; Kapsam 1 ataması yapılmadan ilişki tekrar değerlendirilir).

### 4. Kapsam 2 — T05, T06

```jsonc
"scope2": {
  "method": "location_based" | "market_based" | "both",
  "grid_region": "TR",
  "instruments": [   // sözleşmesel araçlar (piyasa bazlı)
    {"id": "GO-2026-001", "type": "guarantee_of_origin" | "ppa" | "supplier_specific" | "residual_mix",
     "mwh": "60", "generation_period": {"start":"2026-01-01","end":"2026-12-31"}, "retired": true,
     "quality_criteria_met": true, "beneficiary": "org-…", "factor": {<faktör>} }
  ],
  "residual_mix_factor": {<faktör>} | null,
  "self_generation_mwh": "0", "sold_to_grid_mwh": "0"
}
```
Faktörler: `factors` listesinde `role: "location"` ve/veya `role: "market_residual"` alanı; `instruments[].factor` araç faktörü (ör. 0).

Çıktı: `results: {"location_based": {<0.1 sonucu>}, "market_based": {<0.1 sonucu> + "covered_mwh","uncovered_mwh","instrument_ids"}}` ve `total_co2e_kg = null` (iki yöntem toplanmaz; §13). `coverage` her sonuçta ayrı. `primary_method` istekten gelir (`scope2.method`, `both` ise `"location_based"` birincil olarak işaretlenir ama her ikisi döner; kurumsal toplamda hangisinin kullanıldığı manifestte yazılır).

Kurallar:
- `instruments` toplam MWh > tüketim → `INSTRUMENT_EXCEEDS_CONSUMPTION` (negatif emisyon yaratamaz; bloke).
- Kapsanmayan kısım `residual_mix_factor` ile; yoksa `location` faktörüyle ve `warnings: RESIDUAL_MIX_UNAVAILABLE` + `review_required` (T06: kalan 40 MWh hesap dışı bırakılamaz).
- `retired == false` veya `quality_criteria_met == false` → araç sayılmaz, `warnings: INSTRUMENT_NOT_ELIGIBLE`, ilgili MWh kapsanmayan sayılır.
- Aynı `instruments[].id` iki kez → `INSTRUMENT_DUPLICATE` (bloke).
- `sold_to_grid_mwh` brüt sonuçtan düşülmez; yalnız `trace`'te ayrı.

### 5. Kapsam 3 — T08, T09, T10, T12, MTH

```jsonc
"scope3": {
  "category": 1,            // 1–15
  "method": "supplier_specific" | "hybrid" | "average_data" | "spend_based" | "distance_based" | "fuel_based" | "waste_type_specific" | "lifetime_use" | "investment_specific",
  "applicability": "applicable" | "not_applicable" | "unknown",
  "not_applicable_reason": null,
  "data_quality_dims": {"technology":"1-5","geography":"1-5","time":"1-5","completeness":"1-5","reliability":"1-5"} | null,
  "spend": {"currency":"TRY","date":"2026-03-01","tax_treatment":"excl_vat","sector_class":"NACE C24","price_year":"2024","deflator":{"value":"1.0","source_ref":"…"} } | null,
  "sold_products": {"sale_year":"2026","lifetime_years":"10","annual_use_kwh":"120","units_sold":"1000","group_id":"grp-2026-A"} | null
}
```
Faktör `boundary`: `cradle_to_gate` | `gate_to_gate` | `cradle_to_grave` | `upstream` | `well_to_tank` | `tank_to_wheel` | `well_to_wheel` | `end_of_life`.

Kurallar:
- `applicability == "not_applicable"` → gerekçe zorunlu (`NA_REASON_REQUIRED`); sonuç `value_state="not_applicable"`, `total=null` (T10: sıfır yapılmaz).
- `applicability == "unknown"` veya miktar `null` → `value_state="unknown"`, `status="blocked"`, blok `DATA_MISSING` (T10: veri eksikliği uygulanamazlık değildir).
- Kategori 1'de `gate_to_gate` faktör → `warnings: UPSTREAM_MISSING`, `coverage="partial_boundary"`, `review_required` (T08).
- Faktör `cradle_to_grave` ise `scope3.category in {1,2}` → `LCA_FACTOR_IN_CATEGORY` (bloke): beşikten mezara toplam kategori 1'de kullanılmadan bileşenlere ayrıştırılmalı (§17). Faktörler listesinde `cradle_to_gate` + `upstream` birlikte → `BOUNDARY_OVERLAP` (T09).
- `spend_based`: faktör `denominator_unit` para birimi; `spend.currency` ile eşleşmeli (`CURRENCY_MISMATCH`); `deflator` varsa uygulanır ve izde kaynak yazılır; `warnings: SPEND_BASED_ESTIMATE` ve `status="review_required"` (tahmini).
- `lifetime_use` (kategori 11): toplam = `units_sold × annual_use × lifetime_years × faktör`; sonuç `attribution_year = sale_year` ve `group_id` taşır; aynı `group_id` için ikinci koşu **engel değildir** (motor durumsuz) ama yanıtta `lifetime_group: {"group_id","sale_year"}` döner; tekrar eklememe kontrolü depo/API tarafındadır (T12). `lifetime_years` veya `annual_use` yoksa `DEFAULT_SCENARIO_FORBIDDEN` (gizli varsayılan yok, §15).
- `method` kategori için izin verilen listede değilse `METHOD_NOT_ALLOWED` (matris `SUPPORTED` içinde).
- `data_quality_dims` verilirse birleşik puan hesaplanmaz; yalnız döndürülür (§16: bilimsel belirsizlik yüzdesi gibi sunulmaz).

### 6. Ürün çalışması — §17

```jsonc
"product": {
  "study_id": "ps-…", "boundary": "gate_to_gate" | "cradle_to_gate" | "cradle_to_grave" | "custom",
  "reference_flow": {"quantity":"1","unit":"kg"}, "functional_unit": "…" | null,
  "allocation": {"basis":"mass"|"energy"|"economic"|"none","share":"0.6","source_ref":"…"} | null
}
```
Sonuç `context="product"`; kurumsal toplama girmez (aggregate bunu ayırır). `coverage` yalnız karbon olduğu için `"carbon_only"`; `claim_tr` "kısmi ürün karbon ayak izi" / "ürün karbon ayak izi" (sınıra göre); tam LCA/EPD iddiası yok. `allocation` varsa sonuç `share` ile çarpılır ve izde görünür; `share` 0–1 dışında → `ALLOCATION_INVALID`.

### 7. Toplama — `aggregate(request)` (K-17)

```jsonc
{
  "results": [ {"record_id":"…","context":"corporate"|"product","scope":1|2|3,"category":null|1..15,
                "state":"approved"|"locked"|"draft"|…, "result": {<calculate çıktısı>},
                "scope2_method_used": "location_based"|"market_based"|null} ],
  "policy": {"include_states": ["approved","locked"], "scope2_method": "location_based"|"market_based"}
}
```
Çıktı:
```jsonc
{"engine_version":"0.2.0",
 "corporate": {"scope1_kg":"…","scope2_kg":"…","scope2_method":"location_based","scope3_kg":"…","scope3_by_category":{"1":"…"},
               "total_kg":"…","label_tr":"Hesaplanan envanter toplamı","excluded":[{"record_id","reason"}],
               "coverage_notes_tr":["…yalnız CO₂…"], "estimated_share_by_count":"0.25","estimated_share_by_kg":"0.1"},
 "product": {"<study_id>": {"total_kg":"…","claim_tr":"…"}},
 "biogenic_co2_kg": "…" | null,
 "not_applicable": [record_id…], "unknown": [record_id…]}
```
Kurallar: ürün sonuçları kurumsal toplama girmez (kural 8); Kapsam 2'de tek yöntem seçilir, diğer yöntem `scope2_alternative_kg` olarak ayrıca döner, **toplanmaz**; `include_states` dışı kayıtlar `excluded`; `value_state` unknown/not_applicable olanlar toplanmaz ve listelenir; tahmini pay hem kayıt sayısı hem kg ağırlıklı olarak ayrı verilir (§16). Toplama tam ondalıktır.

### 8. Yeni hata/uyarı kodları (hepsi `message_tr` ile)

Blok: `REFRIGERANT_GAS_UNKNOWN`, `EQUIPMENT_NOT_IN_INVENTORY`, `INSTRUMENT_EXCEEDS_CONSUMPTION`, `INSTRUMENT_DUPLICATE`, `CURRENCY_MISMATCH`, `NA_REASON_REQUIRED`, `DATA_MISSING`, `LCA_FACTOR_IN_CATEGORY`, `BOUNDARY_OVERLAP`, `METHOD_NOT_ALLOWED`, `DEFAULT_SCENARIO_FORBIDDEN`, `ALLOCATION_INVALID`, `PROCESS_ID_REQUIRED`, `DENSITY_REQUIRED`.
Uyarı: `REFRIGERANT_TOPUP_ASSUMPTION`, `RECOVERED_NOT_EMISSION`, `RESIDUAL_MIX_UNAVAILABLE`, `INSTRUMENT_NOT_ELIGIBLE`, `UPSTREAM_MISSING`, `SPEND_BASED_ESTIMATE`, `PARTIAL_BOUNDARY`.

### 9. `SUPPORTED` matrisi

`koza_calc.SUPPORTED` → `{"stationary_combustion": ["activity_x_factor"], "purchased_electricity": ["location_based","market_based"], "scope3": {"1": ["supplier_specific","hybrid","average_data","spend_based"], "2": [...], "3": ["average_data"], "4": ["distance_based","fuel_based","spend_based"], "5": ["waste_type_specific","average_data"], "6": ["distance_based","spend_based"], "7": ["distance_based","average_data"], "8": ["average_data"], "9": ["distance_based"], "10": ["average_data"], "11": ["lifetime_use"], "12": ["waste_type_specific"], "13": ["average_data"], "14": ["average_data"], "15": ["investment_specific"]}, "refrigerant": ["mass_balance"], "process": ["activity_x_factor"], "mobile_combustion": ["fuel_based"], "product_process": ["activity_x_factor"]}`. Arayüz bu matrisi gösterir; matris dışı yöntem `METHOD_NOT_ALLOWED`.

### 10. Altın set ekleri (`tests/golden/`)

En az: T05 (elektrik iki yöntem, toplanmaz), T06 (60/100 MWh belge, kalan residual), T06b (belge > tüketim bloke), T08 (kat.1 gate-to-gate uyarı), T09 (overlap bloke), T10 (veri yok → unknown, sıfır değil; NA gerekçesiz bloke), T11 (yeni dolum NA; top-up review), T12 (kat.11 lifetime hesabı + group), spend-based (kur eşleşmesi), mobile (litre × faktör), process, product (cradle_to_gate, allocation), aggregate (ürün hariç, Kapsam 2 tek yöntem, unknown listelenir). Mevcut 32 fixture değişmeden geçer.


## Hesap motoru README

<a id="hesap-motoru-readme"></a>

*Kaynak dosya: `packages/calc-engine/README.md`*

## koza_calc — deterministik hesap motoru

Koza'nın sayısal sonuç üreten tek bileşeni. Saf Python, yalnız standart kütüphane (`decimal`, `hashlib`, `json`). I/O yok, ağ yok, saat yok, rastgelelik yok, `float` yok. Aynı girdi + aynı faktör sürümü + aynı yöntem sürümü → aynı çıktı ve aynı `inputs_hash` (GELISTIRME-KURALLARI.md kural 1, §18).

Dış sözleşme: [`CONTRACT.md`](CONTRACT.md) (0.1, aynen geçerli) + [`CONTRACT-v0.2.md`](CONTRACT-v0.2.md) (genişletme). Bu sürüm **0.2.0**: Kapsam 1 (sabit yakma, hareketli yakma, proses, soğutucu), Kapsam 2 (konum + piyasa bazlı), Kapsam 3 kategori 1–15 ve ürün çalışması; ayrıca `aggregate()` ile kurumsal toplama.

```python
from koza_calc import calculate, aggregate, SUPPORTED, ENGINE_VERSION
result = calculate(request)      # dict -> dict; istisna fırlatmaz, bloke döner
totals = aggregate({"results": [...], "policy": {...}})
```

### Ne yapar

* Girdi doğrulama → birim/koşul dönüşümü → faktör ve esas uyumu → gaz bazlı hesap → gerekirse GWP → kapsama ve iddia metni → iz kaydı → kalite durumu.
* Sayılar yalnız ondalık **dize** olarak girer ve çıkar (`"100"`, `"0.4"`); 34 basamak, banker yuvarlaması, yuvarlama yok, üstel gösterim yok.
* Her yanıtta `context` (`corporate` | `product`), `scope` (1 | 2 | 3 | null) ve `value_state` (`known` | `unknown` | `not_applicable`) bulunur; bilinmeyen ve uygulanamaz değerler sıfırdan ayrıdır (kural 2).

### Desteklenen matris (`koza_calc.SUPPORTED`)

| Kaynak türü | Yöntem(ler) | Not |
| --- | --- | --- |
| `stationary_combustion` | `activity_x_factor` | 0.1 ile aynı; enerji, kütle, gaz hacmi (Nm³/Sm³/m³ + koşul) |
| `mobile_combustion` | `fuel_based` | yakıt `diesel`, `gasoline`, `lpg`, `natural_gas`; birim L, m3_liquid, kg, t veya enerji; kütle↔hacim yalnız kaynaklı `density` (kg/L) ile |
| `process` | `activity_x_factor` | `process_id` zorunlu; miktar t/kg |
| `refrigerant` | `mass_balance` | `charge_type`: yeni dolum ve geri kazanım → `not_applicable`; `top_up` → inceleme; `leak_measured` → hesap; `disposal` bu sürümde tanımsız (bloke) |
| `purchased_electricity` / `purchased_steam` / `purchased_heat` / `purchased_cooling` | `location_based`, `market_based` | iki yöntem `results` altında ayrı döner, toplanmaz (`total_co2e_kg = null`) |
| `scope3` kategori 1, 2 | `supplier_specific`, `hybrid`, `average_data`, `spend_based` | |
| `scope3` kategori 3, 8, 10, 13, 14 | `average_data` | |
| `scope3` kategori 4 | `distance_based`, `fuel_based`, `spend_based` | |
| `scope3` kategori 5 | `waste_type_specific`, `average_data` | |
| `scope3` kategori 6 | `distance_based`, `spend_based` | |
| `scope3` kategori 7 | `distance_based`, `average_data` | |
| `scope3` kategori 9 | `distance_based` | |
| `scope3` kategori 11 | `lifetime_use` | adet × yıllık kullanım × ömür; satış yılına atfedilir, `lifetime_group` döner |
| `scope3` kategori 12 | `waste_type_specific` | |
| `scope3` kategori 15 | `investment_specific` | |
| `product_process` | `activity_x_factor` | `context="product"`, `coverage="carbon_only"`; kurumsal toplama girmez (kural 8) |

Birimler: enerji (MJ, GJ, kWh, MWh), kütle (kg, t), gaz hacmi (m3, Nm3, Sm3), sıvı hacim (L, m3_liquid), mesafe (km), kütle-mesafe (t.km, kg.km), yolcu-mesafe (p.km), adet (unit), para (TRY, EUR, USD — birbirine dönüştürülmez).

### Neyi reddeder (bloke)

Bloke olan istekte `components=[]`, `total_co2e_kg=null`; her blok Türkçe `message_tr` taşır (tam liste `koza_calc/errors.py`).

* **0.1 ile aynı:** düz m³ koşulsuz (`UNIT_CONDITIONS_UNKNOWN`), HHV/LHV uyuşmazlığı oransız (`BASIS_MISMATCH`), esası bilinmeyen enerji (`BASIS_UNKNOWN`), kaynaksız faktör (`FACTOR_MISSING_SOURCE`), CO₂e ile gaz faktörü karışımı (`FACTOR_MIX_CO2E_AND_GAS`), farklı sınırların toplanması (`BOUNDARY_MIX`), eksik GWP (`GWP_MISSING`), negatif miktar, dize olmayan sayı (`INVALID_NUMBER`), sıfıra bölme, tanınmayan kaynak türü (`UNSUPPORTED_SOURCE_TYPE`), uyumsuz birim (`UNIT_INCOMPATIBLE`).
* **Soğutucu:** gaz türü bilinmiyor (`REFRIGERANT_GAS_UNKNOWN`), ekipman envanter dışında (`EQUIPMENT_NOT_IN_INVENTORY`), karışım için GWP yok (`GWP_MISSING`), `disposal` kuralı tanımsız (`METHOD_NOT_ALLOWED`).
* **Kapsam 2:** araç toplamı tüketimi aşıyor (`INSTRUMENT_EXCEEDS_CONSUMPTION`), aynı belge iki kez (`INSTRUMENT_DUPLICATE`), faktörde `role` yok (`INVALID_REQUEST`).
* **Kapsam 3:** gerekçesiz uygulanamaz (`NA_REASON_REQUIRED`), miktar/uygulanabilirlik bilinmiyor (`DATA_MISSING`, `value_state="unknown"`), kategori 1–2'de beşikten mezara faktör (`LCA_FACTOR_IN_CATEGORY`), beşikten kapıya + üst aşama birlikte (`BOUNDARY_OVERLAP`), matris dışı yöntem (`METHOD_NOT_ALLOWED`), para birimi uyuşmazlığı (`CURRENCY_MISMATCH`), kategori 11'de ömür/kullanım verilmemiş (`DEFAULT_SCENARIO_FORBIDDEN`).
* **Ürün:** tahsis payı 0–1 dışında veya kaynaksız (`ALLOCATION_INVALID`).
* **Proses / hareketli yanma:** `process_id` yok (`PROCESS_ID_REQUIRED`), kütle↔hacim için yoğunluk yok (`DENSITY_REQUIRED`).

Hesabı engellemeyen ama `review_required` üreten uyarılar: `BASIS_CONVERSION_APPLIED`, `DATA_QUALITY_ESTIMATED`, `REFRIGERANT_TOPUP_ASSUMPTION`, `RESIDUAL_MIX_UNAVAILABLE`, `UPSTREAM_MISSING`, `SPEND_BASED_ESTIMATE`, ürün sınırı uyuşmazlığında `PARTIAL_BOUNDARY`. Yalnız bilgi veren uyarılar: `RECOVERED_NOT_EMISSION`, `INSTRUMENT_NOT_ELIGIBLE`, kapıdan kapıya ürün çalışmasında `PARTIAL_BOUNDARY`. `computed` onaylandı demek değildir (§21).

### Toplama — `aggregate(request)`

Onaylı/kilitli (`policy.include_states`) kayıt sonuçlarını Kapsam 1/2/3 toplamına çevirir. Ürün sonuçları `product` altında ayrı listelenir; Kapsam 2'de `policy.scope2_method` tek yöntem seçer, diğeri `scope2_alternative_kg` olarak döner ve toplanmaz; `value_state` unknown / not_applicable kayıtlar toplanmaz, `unknown` / `not_applicable` listelerinde görünür; politika dışı veya bloke kayıtlar `excluded` içindedir; tahmini pay hem kayıt sayısı hem kg ağırlıklı verilir. Toplama tam ondalıktır.

### Testler

```bash
python3 -m venv .venv && . .venv/bin/activate
pip install pytest && pip install -e packages/calc-engine
pytest -q                                      # depo kökünden (motor + API + izolasyon)
pytest packages/calc-engine/tests -q
```

Altın set `tests/golden/*.json` (depo kökü) altındadır; `koza_calc.golden.run_dir("tests/golden")` ile pytest'ten veya tarayıcıdan koşulur. `expected` alanları alt küme eşleşmesiyle karşılaştırılır. Kayıt `request` taşıyorsa `calculate()`, `aggregate_request` taşıyorsa `aggregate()` koşulur.

**Testlerdeki ve `tests/factors/test-catalog.json` içindeki tüm katsayılar kurgusaldır**; yalnız yazılım doğrulaması içindir, `license: "test-only"` taşır ve üretim faktör kataloğuna aktarılamaz (kural 12). Altın set alan uzmanı imzası beklemektedir (§29).

### Pyodide (tarayıcı)

Aynı kaynak tarayıcıda Pyodide altında çalışır; üçüncü taraf bağımlılık yoktur, paket içi içe aktarımlar dışında hiçbir numara kullanılmaz. Dosya sistemi olmadan altın set koşmak için ayrıştırılmış JSON'ı doğrudan verin: `golden.run_fixture(fixture_dict)` veya `golden.run_fixtures([...])`.


## İş API'si README

<a id="is-api-si-readme"></a>

*Kaynak dosya: `apps/api/README.md`*

## Koza API — Dilim 1

İş API'si: kimlik + tenant bağlamı, §21 kayıt iş akışı, hesap/onay/rapor/içe aktarma/kaynak/katalog uçları (§27),
§25 güvenlik maddeleri, denetim izi. Sayısal sonucu yalnız `packages/calc-engine` (`koza_calc`) üretir; bu katman
hesap ve toplam yapmaz (kural 1; toplama `koza_calc.aggregate`, K-17).

### Çalıştırma

```bash
python3 -m venv .venv && . .venv/bin/activate
pip install -e "apps/api[dev]" -e packages/calc-engine          # dev: pytest, httpx, psycopg, PyJWT

# 1) Bellek içi depo (kalıcı değil) — hızlı deneme
export KOZA_DEV_TOKENS='{"dev-admin":{"user_id":"<uuid>","memberships":[{"tenant_id":"<uuid>","role":"admin"}],"mfa":true}}'
uvicorn koza_api.main:app --reload --app-dir apps/api

# 2) PostgreSQL deposu
export KOZA_DATABASE_URL=postgresql://koza_app@127.0.0.1:5432/koza        # uygulama rolü (BYPASSRLS yok, DELETE yok)
export KOZA_MIGRATE_DATABASE_URL=postgresql://koza@127.0.0.1:5432/koza    # şema sahibi (yalnız göç/tohum)
python apps/api/scripts/migrate.py up                                      # 0001_init, 0002_api_dilim1
python apps/api/scripts/migrate.py grant --role koza_app --password '...'  # SELECT/INSERT/UPDATE; DELETE/TRUNCATE yok
eval "$(python apps/api/scripts/seed_dev.py | grep '^export')"             # kurgusal kurum + 7 kullanıcı + dönem; KOZA_DEV_TOKENS basar
uvicorn koza_api.main:app --app-dir apps/api
curl -s localhost:8000/healthz      # {"status":"ok","version":"0.2.0","repo":"postgres"}
```

Başlangıçta tek satır log hangi depo/kimlik/nesne deposu/tarayıcı/politikanın etkin olduğunu yazar:
`koza_api 0.2.0: depo=postgres kimlik=dev nesne_deposu=local tarayici=none imza=var admin_mfa=False hiz_siniri=20.0/60`.

Her `/v1` isteği `Authorization: Bearer <token>` ve `X-Tenant: <uuid>` ister; `X-Tenant` kullanıcının bir
üyeliğiyle eşleşmezse 403. Gövdedeki `tenant_id` 422 ile reddedilir (kural 3). Tek istisna imzalı dosya indirme
(`GET /v1/evidence/files/...`): bearer yerine HMAC imzası + süre doğrulanır.

### Ortam değişkenleri

| Değişken | Varsayılan | Açıklama |
| --- | --- | --- |
| `KOZA_DATABASE_URL` | boş → `InMemoryRepo` | psycopg v3 DSN; ayarlıysa `PostgresRepo`. Uygulama rolü **`migrate.py grant`** ile yetkilendirilen roldür. |
| `KOZA_MIGRATE_DATABASE_URL` | `KOZA_DATABASE_URL` | Göç ve tohum için şema sahibi DSN'i. |
| `KOZA_INSPECT_DATABASE_URL` | boş | Yalnız test/işletim: RLS'i aşan sahip DSN'i (`repo.records/runs/audit` incelemesi). Üretimde ayarlanmaz. |
| `KOZA_DEV_TOKENS` | boş (hiçbir token geçerli değil) | Geliştirme tokenları (JSON): `{"<token>": {"user_id", "memberships": [{"tenant_id","role"}], "mfa": bool}}`. **OIDC ayarlıyken okunmaz.** |
| `KOZA_OIDC_ISSUER`, `KOZA_OIDC_AUDIENCE` | boş | İkisi birlikte ayarlanınca JWT doğrulaması (PyJWT). Bkz. OIDC. |
| `KOZA_OIDC_JWKS_URL` / `KOZA_OIDC_JWKS_FILE` / `KOZA_OIDC_ALGORITHMS` | `<issuer>/.well-known/jwks.json` / boş / `RS256,ES256` | Anahtar kaynağı (dosya URL'ye üstün gelir; çevrimdışı ortam) ve algoritmalar. |
| `KOZA_ADMIN_MFA` | OIDC varsa `required`, yoksa `off` | `required`: admin işlemleri (dönem oluştur/kilitle/aç, üyelik, başkasının oturumunu kapatma) MFA doğrulanmış oturum ister → aksi 403 `MFA_REQUIRED`. |
| `KOZA_RATE_LIMIT_RPS`, `KOZA_RATE_LIMIT_BURST` | `20`, `60` | Asıl başına token kovası; aşımda 429 `RATE_LIMITED` (`retryable: true`, `Retry-After`). `0` kapatır. |
| `KOZA_OBJECT_STORE_DIR` | boş (nesne deposu yok) | Yerel nesne deposu kökü: `<kök>/<tenant_id>/<evidence_id>`. S3 uyumlu depo aynı `ObjectStore` protokolünü uygular. |
| `KOZA_SIGNING_SECRET` | boş (imzalı bağlantı üretilmez: 503) | HMAC-SHA256 sırrı (≥16 karakter) — kısa ömürlü indirme bağlantıları. |
| `KOZA_SIGNED_URL_TTL`, `KOZA_SIGNED_URL_MAX_TTL` | `300`, `900` sn | Bağlantı ömrü ve üst sınırı. |
| `KOZA_SCANNER` | boş → `pending` | `none`: tarama YAPILMADIĞI açıkça beyan edilir, dosya `clean` (yalnız geliştirme); `command`: `KOZA_SCANNER_COMMAND` çalışır (çıkış 0 clean, 1 rejected, diğer pending; ör. `clamscan --no-summary`). Boş: dosya `pending` kalır, indirilemez. |
| `KOZA_EVIDENCE_MAX_BYTES`, `KOZA_EVIDENCE_ALLOWED_TYPES` | 25 MiB, pdf/png/jpeg/csv/txt/xlsx/docx | Boyut/tür sınırı. Makro/aktif içerik uzantıları (`.xlsm .docm .html .js .exe ...`) her zaman engelli. |
| `KOZA_WEBHOOK_SECRETS` | boş | `{"<source_system>": "<secret>"}`; sırrı olmayan sistem için webhook 503 `WEBHOOK_SECRET_MISSING`. |
| `KOZA_TEST_DATABASE_URL` | boş | Testler için hazır PostgreSQL (şema sahibi DSN). Yoksa `initdb`/`pg_ctl` ile geçici küme denenir. |

Roller: `admin, data_entry, data_owner, reviewer, approver, viewer, supplier, content_editor` (§04).

### Depolar

| | `InMemoryRepo` | `PostgresRepo` (`koza_api/repo_postgres.py`) |
| --- | --- | --- |
| Seçim | `KOZA_DATABASE_URL` boş | `KOZA_DATABASE_URL` dolu |
| Kalıcılık | süreç belleği | PostgreSQL 15+, `db/migrations` |
| Tenant ayrımı | `(tenant_id, id)` anahtarı | aynı + RLS: istek başına bir bağlantı/işlem, ilk sorgudan önce `set_config('app.tenant_id', <X-Tenant>, true)` (= `SET LOCAL`); üyelik doğrulanmadan satır dönmez, hata → rollback |
| Append-only | arayüzde update/delete yok | aynı + tetikleyiciler + uygulama rolünde DELETE/TRUNCATE yetkisi yok |
| Sayılar | ondalık dize | `numeric(28,10)`; okumada sondaki sıfırlar düşer (`100.0000000000` → `"100"`), float asla |
| Bağlantı havuzu | — | yok (istek başına `psycopg.connect`); yük altında PgBouncer/`psycopg_pool` eklenir |

Her iki depo da aynı `Repository` protokolünü uygular ve **aynı test paketiyle** koşar (aşağıda).

### Göçler

`db/migrations/NNNN_ad.sql` + `NNNN_ad.down.sql`; `apps/api/scripts/migrate.py up|down [--to N]|status|grant`. Uygulanan
sürümler `schema_migration` tablosunda. `0002_api_dilim1` eklemeleri ve gerekçeleri dosya başındadır (OIDC `sub`, metin
`audit_event.object_id`, `calculation_result.raw`, faktör etkinleştirme zamanları, içe aktarma/geri çekme sütunları,
`evidence.record_id`, `import_job`, `session_revocation`/`session_seen`, `reference_source(_version)`, `integration_staging`).
Geri alma `0002_*.down.sql` kayıplıdır (UUID olmayan audit nesne kimlikleri NULL olur); üretimde yalnız yedekle.

### Kimlik: dev token ve OIDC

- **Dev token** (`KOZA_DEV_TOKENS`): üyelik ve `mfa` bayrağı token içinde. Yalnız OIDC ayarlı değilken geçerlidir;
  `jti = dev-<sha256(token)[:32]>`. Üretimde boş bırakılır.
- **OIDC** (`KOZA_OIDC_ISSUER` + `KOZA_OIDC_AUDIENCE`): Bearer JWT, JWKS ile imza + `iss`/`aud`/`exp` doğrulanır
  (`OidcTokenStore`, PyJWT). `sub` → `app_user.oidc_subject` (yedek: `email` → `app_user.email`); tanımsız kullanıcı 401
  (davet akışı ayrı). Roller her istekte `membership` tablosundan okunur → rol değişikliği açık oturumda etkilidir (§04).
  MFA: `amr` içinde `mfa|otp|hwk|sms|swk|fido|webauthn` ya da `acr ∈ {mfa, aal2, aal3}` → `mfa_verified`.
- **Oturum iptali**: `POST /v1/sessions/revoke` (kendi oturumu; admin+MFA başkasının jti'sini) → iptal listesi; sonraki
  istek 401 `SESSION_REVOKED`. `GET /v1/sessions/me` oturum bilgisini verir.
- **Giriş audit'i**: bir `jti` kurumda ilk görüldüğünde `session.login` olayı bir kez yazılır (`session_seen`).

### Nesne deposu ve kanıt akışı (§25)

1. `POST /v1/evidence/uploads` — sha256 + ad + boyut; yinelenen adaylar (T07); engelli uzantı 422, boyut aşımı 413.
   Nesne deposu varsa `upload: {method: PUT, path, max_bytes, allowed_content_types}`; yoksa `upload: null`.
2. `PUT /v1/evidence/uploads/{id}/content` — ham gövde; tür/boyut sınırı; içerik karması beyanla uyuşmazsa 422 ve **hiçbir
   şey saklanmaz**; tarama kancası `scan_status` yazar (`clean | rejected | pending`); `rejected` dosya silinir.
3. `GET /v1/evidence/{id}/download-url` — yalnız `clean` dosya; `{url, expires_at, ttl_seconds}`; bağlantı
   `/v1/evidence/files/{tenant}/{id}?exp=&sig=` HMAC imzalıdır, süre dolunca 403; erişimi kaldırılan kullanıcı yeni bağlantı
   alamaz, eskisi en çok `KOZA_SIGNED_URL_MAX_TTL` yaşar.

### Sınırlar ve hata kodları (seçme)

`RATE_LIMITED` 429 · `MFA_REQUIRED` 403 · `SESSION_REVOKED` 401 · `TENANT_FORBIDDEN/TENANT_REQUIRED` 403 ·
`VERSION_CONFLICT` 409 · `PERIOD_LOCKED` 409 (+`reopen_path`) · `IDEMPOTENCY_MISMATCH` 409 · `AGGREGATE_UNAVAILABLE` 503
(motor 0.2 yok; API toplam üretmez) · `OBJECT_STORE_UNAVAILABLE` 503 · `SIGNING_SECRET_MISSING` 503 ·
`EVIDENCE_HASH_MISMATCH` 422 · `EVIDENCE_TYPE_NOT_ALLOWED` 415 · `EVIDENCE_TOO_LARGE` 413 · `EVIDENCE_NOT_AVAILABLE` 409 ·
`IMPORT_EMPTY/IMPORT_ENCODING/IMPORT_TOO_MANY_ROWS` 422 · `IMPORT_NOT_ROLLBACKABLE` 409 · `SOURCE_CONTENT_UNCHANGED` 409 ·
`FACTOR_VERSION_EXISTS/FACTOR_RETIRED` 409 · `WEBHOOK_SECRET_MISSING` 503 · `WEBHOOK_SIGNATURE_INVALID` 401.
Tüm hatalar `{code, message (TR), field_errors, retryable, request_id[, details]}` zarfındadır.

### Uçlar (§27) — tam liste `docs/api/openapi.yaml`

| Alan | Uçlar | Not |
| --- | --- | --- |
| Kayıt | `POST/GET/PATCH /v1/activities[/{id}]`, `/versions`, `/runs`, `/submit` | Idempotency-Key, If-Match/ETag |
| Hesap | `POST /v1/calculations/preview`, `POST /v1/activities/{id}/calculate`, `POST /v1/calculations/aggregate` | aggregate: `koza_calc.aggregate`, kurumsal/ürün ayrı, saklanmaz |
| Sınıflandırma | `POST /v1/classifications/preview` | `koza_api/data/classification_rules.json` (sürümlü kural; LLM yok) |
| İçe aktarma | `POST /v1/imports[?preview=true]`, `GET /v1/imports/{job}`, `POST /v1/imports/{job}/rollback` | 202 + job_id, senkron; sha256/row_hash tekrar; geri alma yalnız taslak |
| Onay / dönem / rapor | `POST /v1/approvals`, `/v1/periods...`, `POST/GET /v1/reports` | değişmedi |
| Kanıt | `POST /v1/evidence/uploads`, `PUT .../content`, `GET /v1/evidence/{id}[/download-url]`, `GET /v1/evidence/files/...` | yukarıda |
| Katalog | `GET /v1/factors`, `GET /v1/factors/{id}/versions`, `POST /v1/factors/{id}/versions`, `POST .../{v}/activate`, `GET /v1/methods` | ekleme/etkinleştirme yalnız reviewer; source_ref zorunlu; etkinleştirme etkilenen kayıt listesi döner, eski koşum değişmez (T13) |
| Kaynak (§19) | `POST/GET /v1/sources`, `GET /v1/sources/{id}/versions`, `POST .../versions`, `POST .../{v}/approve`, `POST .../{v}/checked` | tarihler ayrı alan, içerik karması, değişiklik kartı, uzman onayı |
| Entegrasyon | `POST /v1/integrations/{sys}/events`, `GET /v1/integrations/staging`, `GET /v1/integrations/status` | HMAC imza + zaman damgası; `(source_system, external_id, event_id)` tekil |
| Güvenlik | `GET /v1/sessions/me`, `POST /v1/sessions/revoke`, `GET/POST /v1/memberships`, `GET /v1/exports/activities.csv`, `GET /v1/audit` | CSV formül temizliği; audit: login/rol/dışa aktarma/onay/faktör/rapor |

### Testler ve test matrisi

```bash
pytest -q                                   # depo kökünden: motor + API + izolasyon
pytest apps/api/tests tests/isolation -q    # yalnız API + izolasyon
python apps/api/scripts/export_openapi.py   # docs/api/openapi.yaml üretir
```

`env` fixture'ı her testi iki depoyla koşar: `[memory]` ve `[postgres]`. PostgreSQL bulunamazsa `[postgres]` ve RLS
testleri açık nedenle **skip** edilir (`KOZA_TEST_DATABASE_URL yok ve pg_ctl/initdb bulunamadı`); sahte geçme yoktur.

| Paket | Test dosyası | Kimlik |
| --- | --- | --- |
| Çekirdek (her iki depo) | `test_idempotency`, `test_version_conflict`, `test_locked_period`, `test_separation_of_duties`, `test_approval_invalidation`, `test_factor_update`, `test_report_manifest`, `test_evidence_duplicate`, `test_value_states`, `test_audit_append_only` | §27 kabul, T18, T17, §04, §21, T13, T19, T07, kural 2, §25 |
| Dilim 1 (her iki depo) | `test_classification_preview`, `test_imports`, `test_sources`, `test_factor_catalog`, `test_aggregate`, `test_evidence_store`, `test_security` | §27 sınıflandırma/içe aktarma/kaynak, §18–19, K-17, §25 |
| İzolasyon (her iki depo) | `tests/isolation/test_tenant_isolation.py` | T14, §04 kabul |
| RLS (yalnız PostgreSQL) | `tests/isolation/test_rls_postgres.py` | kural 3: sahte kimlikle 0 satır, `app.tenant_id` yokken 0 satır, uygulama rolü DELETE/TRUNCATE yapamaz, append-only UPDATE reddi, SET LOCAL sızmaz |

Test kümesi: `KOZA_TEST_DATABASE_URL` varsa o; yoksa `pg_ctl`/`initdb` (PATH veya Homebrew/Debian yolları) ile geçici küme
(TCP, unix soketi kapalı). Göçler `down 0 → up` ile uygulanır, `koza_app` rolü yetkilendirilir, API bu rolle bağlanır;
tablo temizliği ve kurumlar arası inceleme yalnız sahip DSN'i ile yapılır. Kurgusal faktörler yalnız
`tests/fixtures/test_catalog.json` (kural 12). `koza_calc` kuruluysa gerçek motor, değilse sözleşme biçimli taklit kullanılır.

### Gerçek olan / sınırlar

| Parça | Durum |
| --- | --- |
| Yetki, tenant bağlamı, durum makinesi, idempotency, sürüm çakışması, kilit/yeniden açma, onay ayrılığı, manifest + sha256, audit | Gerçek; her iki depoda testli |
| PostgreSQL deposu, RLS, göç çalıştırıcı, tohum | Gerçek; PostgreSQL 15 üzerinde testli. Havuz yok (istek başına bağlantı). |
| Sınıflandırma önerisi, içe aktarma (CSV/JSON, önizleme, tekrar, geri alma), kaynak kayıt defteri, faktör kataloğu + etkinleştirme, toplama ucu, nesne deposu + imzalı bağlantı + tarama kancası, webhook + staging, oturum iptali, MFA politikası, hız sınırı, CSV temizliği | Gerçek; testli |
| Toplama sonucu | Yalnız `koza_calc.aggregate` (motor ≥0.2). Yoksa 503; API toplam üretmez. |
| İçe aktarma / rapor | Senkron, süreç içinde; `job_id` semantiği korunur. Kuyruk/işçi yok. Rapor dosyası (DOCX/PDF) üretilmez. |
| Zararlı içerik taraması | Kanca gerçek; tarayıcı dışarıdan takılır (`KOZA_SCANNER=command`). Varsayılan `pending` → indirilemez. |
| OIDC | Doğrulama kodu gerçek (PyJWT); sağlayıcı yapılandırmadır. Davet/ilk giriş kullanıcı oluşturma akışı yok (kullanıcı `app_user` tablosunda tanımlı olmalı). |
| S3 nesne deposu | Protokol hazır; yalnız yerel dosya uyarlayıcısı uygulandı. |
| Tedarikçi akışı, görevler, eksik kanıt politikası (submit'te) | Yok. |

### Durum geçişleri (özet)

`draft → calculated → in_review → approved → locked`; `in_review → changes_requested`; veri değişikliği
(`PATCH`) onaylı/hesaplanmış kaydı `validation_required`'a döndürür ve önceki onayı geçersizleştirir.
Her geçiş `activity_record_version`'a yeni satır ekler; `data_version` yalnız veri değişince ilerler.
Kilitli dönemde her yazma 409 `PERIOD_LOCKED` + `details.reopen_path` döner. İçe aktarma geri alması yalnız
`draft` kaydı geri çeker (`withdrawn_*`); sürüm satırları kalır (kural 9).


## Web modül sözleşmesi

<a id="web-modul-sozlesmesi"></a>

*Kaynak dosya: `apps/web/src/modules/README.md`*

## Modül geliştirme sözleşmesi (apps/web)

Her ürün modülü `src/modules/<ad>/` altında yaşar ve sayfaları `src/app/<rota>/page.tsx` altındadır. Ortak altyapı değiştirilmez; modül onu kullanır.

### Ortak altyapı (DEĞİŞTİRİLMEZ — ihtiyaç varsa bütünleştiriciye bildir)
- `src/lib/store.ts` — `Store`: oturum, kurum, kayıt iş akışı (§21), kanıt, koşu, onay, dönem, rapor, görev, denetim izi. Modüller için: `rows/row/insert/update` (modül tabloları, kuruma süzülü), `audit`, `commit`, `require(action)`, `createTask`, `records/current/latestRun/sources/periods/facilities/tenant`.
- `src/lib/domain.ts` — tipler, `ROLE_LABEL`, `PERMISSIONS`, `registerPermissions`, `SOURCE_TYPE_LABEL`, `SCOPE3_CATEGORIES`, `can`.
- `src/lib/errors.ts` — hata sözlüğü; `registerErrors([...])` ile modül kodları eklenir (kaynak/neden/sonuç/eylem Türkçe, zorunlu).
- `src/lib/calc.ts` — `calculate(request)`, `aggregate(request)`, `supportedMatrix()`, `engineReady()`: tek sayısal otorite (kural 1). TypeScript'te hesap YAPILMAZ.
- `src/lib/content.ts` — `contentOf<T>("<content dizini>")`, `PROFILES`, `TERMS`, `LESSONS`, `SOURCES`, `SPEC_SECTIONS`, `TEST_CATALOG`.
- `src/lib/useStore.ts` — `useStore()` (store|null, ready), `fmtDate`, `fmtDec`, `kgToT`.
- `src/components/ui.tsx` — `PageHeader`, `Notice`, `ErrorBox`, `StateBadge`, `Loading`, `NoTenant`, `Markdown`. `src/components/Shell.tsx` — menü (rotalar önceden kayıtlı).
- `src/app/globals.css` — belirteçler ve ortak sınıflar (`card`, `grid-2/3`, `badge ok|warn|crit|info|neutral|accent|copper`, `notice`, `kv`, `table-wrap`, `steps`, `flow`, `hero`, `stat`). Modüle özgü stil: `src/modules/<ad>/style.css`, sayfadan `import "@/modules/<ad>/style.css"`.

### Modül dosyaları
- `register.ts` — `registerPermissions({...})` ve `registerErrors([...])`; yan etkili içe aktarma (`src/modules/index.ts` zaten içe aktarır).
- `store.ts` — saf fonksiyonlar: `(s: Store, …) => …`. Tablolar: `s.insert<T>("<ad>", "<tablo>", {...})`. Satır tipi `ModuleRow` üzerine kurulur. Değişmez olması gereken şeyler (onay, ölçüm, sürüm) için `update` yerine yeni satır.
- `*.test.ts` — vitest (`npx vitest run`), `src/test/setup.ts` depo taklidi sağlar; `new Store()` doğrudan kullanılabilir (bkz. `src/lib/store.test.ts`).
- İçerik `content/<dizin>/*.yaml` (gen-content tüm dizinleri otomatik alır; `_` ile başlayan dosya şemadır). İçerik veridir, koda gömülmez (kural 5, 6).

### Ekran kuralları (§28)
Her ekranda: ilk kullanım (amaç + başlangıç eylemi), yükleniyor (`Loading`), boş sonuç (veri yok ≠ filtre sonucu yok), kısmi veri (eksik kapsam açık), hata (`ErrorBox`; veri korunur), yetki yok (`store.require` → `FORBIDDEN`), çakışma (`expected_version`), başarılı (ne kaydedildi, durumu, sonraki adım). Çalışmayan buton, uydurma grafik, kalıcı kayıt olmadan başarı mesajı YOK (kural 10). Sayı yalnız motordan; arayüz yuvarlamayı sunumda yapar. Türkçe, kısa, sade metin; teknik terim açıklamasız seçim olarak sunulmaz. Kişi bazlı sıralama yok (kural 11). Kurum bağlamı yoksa `NoTenant`.

### Yasaklar
- `float` ile emisyon/para hesabı; LLM çıktısını sayı/faktör olarak kaydetmek; `if (sector == …)`; koda gömülü eşik/tarih/benchmark/fiyat; senaryo verisinin envantere karışması; ürün sonucunun kurumsal toplama eklenmesi; eksik veriye 0 atamak; araç veya üretici adı izi (hiçbir dosyada).

### Tip notu
`ModuleRow` dizin imzası (`[key: string]: unknown`) yüzünden `Omit<T, keyof ModuleRow>` tüm alanları siler. Doğru kalıp: `type XData = {...}`; `type XRow = ModuleRow & XData`; `insert<XRow>("mod","tablo", data as XData)`.


---

# F. Süreç ve işletim


## Dilim döngüsü

<a id="dilim-dongusu"></a>

*Kaynak dosya: `docs/surec/dilim.md`*

## Dilim döngüsü (süreç listesi)
Hedef gereklilikler: <kimlikler>

GELISTIRME-KURALLARI.md'deki "Geliştirme döngüsü"nü sırayla uygula:

1. **Oku.** Her kimliğin geçtiği bölümü `docs/spec/KOZA_sartname_v1.0.md` ve `docs/spec/KOZA_v1.1_gereklilikler.md` içinde bul. İlgili "Kabul koşulu" paragraflarını ve `T` testlerini listele.
2. **Belirsizlik kontrolü.** Hesap yöntemi, veri hakkı, hukuki uygulanabilirlik veya sektöre özgü bir kural belirsizse `docs/karar-kaydi.md`'ye satır ekle, ürün sahibine sor ve **dur**. Varsayım uydurma.
3. **Plan.** Kısa plan yaz: veri modeli/göç etkisi, API uçları, ekran durumları (§28), etkilenen değiştirilemez kurallar. Ürün sahibinin onayını bekle.
4. **Önce testler.** Kabul koşullarını başarısız testler olarak yaz (birim, altın set, gerekiyorsa izolasyon). Test katsayıları kurgusal ve yalnız `tests/` altında.
5. **Uygula.** Testleri geçiren en küçük değişiklik. Sektöre özgü hiçbir şeyi koda gömme; profil verisinden oku.
6. **Doğrula.** Tüm test paketini çalıştır, ardından `/kontrol` adımlarını uygula.
7. **Teslim notu.** Şu başlıklarla bitir:
   - Karşılanan kimlikler
   - Değişen dosyalar ve göçler
   - Test kanıtı (komut + sonuç)
   - Desteklenen yöntemler / profiller
   - Açık eksikler ve karar kaydına eklenenler
   - Alan uzmanı onayı gerekiyor mu? (hesap/standart değiştiyse evet)


## Kural kontrol listesi

<a id="kural-kontrol-listesi"></a>

*Kaynak dosya: `docs/surec/kontrol.md`*

## Değiştirilemez kural kontrol listesi
`git diff` (ya da belirtilen kapsam) üzerinde GELISTIRME-KURALLARI.md'deki 12 değiştirilemez kuralı tek tek kontrol et. Her kural için: **Geçti / İhlal / İlgisiz** ve ihlalse dosya:satır + önerilen düzeltme.

Özellikle ara:

- `packages/calc-engine` dışında sayısal emisyon hesabı; `float` ile para/emisyon hesabı.
- LLM çıktısının faktör, sayı veya sınıflandırma olarak kaydedilmesi.
- Eksik veri için `0` / varsayılan değer atanması; `NULL`, `not_applicable`, `estimated` ayrımının kaybı.
- `tenant_id` filtresi olmayan sorgu, nesne yolu veya arama çağrısı; istemciden gelen `tenant_id`'ye güvenme.
- Yalnız arayüzde yapılan yetki kontrolü.
- Sektör adına göre dallanma (`if sector`, `switch (sector)`), koda gömülü eşik/tarih/benchmark/fiyat.
- Senaryo verisinin envanter toplamına, ürün/CBAM sonucunun Kapsam 1–2 toplamına karışması.
- Onaylı kayıt, kilitli dönem veya rapor manifestinin yerinde güncellenmesi.
- Kalıcı kayıt olmadan başarı mesajı; çalışmayan buton; sahte veri.
- Kişi bazlı sıralama üreten sorgu veya ekran (Green Kaizen, öğrenme).
- `tests/` dışında test katsayısı.

Sonunda tek satır özet: ihlal sayısı ve birleştirmeye engel olup olmadığı.


## Üretime geçiş yönergesi

<a id="uretime-gecis-yonergesi"></a>

*Kaynak dosya: `docs/uretime-gecis.md`*

## Üretime geçiş yönergesi

Bu belge, statik önizlemeden (GitHub Pages, tarayıcı deposu) pilot ve kurumsal işletime geçişte yapılacakları sırayla verir. Ürün işlevleri depoda tamdır; bu yönerge **altyapı ve işletim** adımlarıdır (§25, §26, §30). Her adım başka bir geliştirici tarafından uygulanabilir olmalıdır; geri alma adımları yazılıdır.

### 1. Mimari (K-01)

| Katman | Üretim | Önizleme karşılığı |
| --- | --- | --- |
| Web | `apps/web` — Next.js statik dışa aktarma; `NEXT_PUBLIC_API_URL` tanımlanınca arayüz `/v1` API'sine bağlanır | Tarayıcı deposu (`src/lib/store.ts`), aynı iş kuralları |
| İş API'si | `apps/api` — FastAPI, `KOZA_DATABASE_URL` ile PostgreSQL deposu | Çalışmaz |
| Hesap motoru | `packages/calc-engine` — API içinde Python | Aynı kod Pyodide ile tarayıcıda |
| Veri | PostgreSQL 15+, RLS, `db/migrations` | localStorage |
| Dosya | S3 uyumlu depo veya `KOZA_OBJECT_STORE_DIR`; imzalı kısa ömürlü bağlantı | Yalnız karma ve üst veri |
| Kuyruk | OCR, içe aktarma, toplu hesap, rapor; `job_id` | Eşzamanlı, tarayıcıda |
| Kimlik | OIDC/SSO (`KOZA_OIDC_ISSUER`), yönetici hesaplarında MFA zorunlu | Rol seçici |

### 2. Adımlar

1. **Ortamlar:** geliştirme, test, üretim ayrı (§26). Sırlar yalnız ortam değişkeninde; depoya ve istemciye yazılmaz.
2. **Veritabanı:** `python apps/api/scripts/migrate.py up` (geri alma: `down`). Göçler üretim verisi kopyasında prova edilir. RLS politikaları `FORCE` ile açıktır; uygulama her işlemde `SET LOCAL app.tenant_id` verir.
3. **Kimlik:** OIDC sağlayıcı bağlanır; `KOZA_DEV_TOKENS` üretimde boş bırakılır. Davetler süreli ve tek kullanımlık; ayrılan çalışanın erişimi sonlandırılır; yetki değişikliği açık oturumda etkili (jti iptal listesi).
4. **Nesne deposu:** boyut/tür sınırı, zararlı içerik taraması (`KOZA_SCANNER`), imzalı bağlantılar (`KOZA_SIGNING_SECRET`). Tarama tamamlanmadan dosya kullanılmaz.
5. **Arka plan işleri:** kuyruk ve işçiler; uzun işler `job_id` döner, iptal ve güvenli tekrar.
6. **Arayüz bağlantısı:** `NEXT_PUBLIC_API_URL` verilerek derlenir; tarayıcı deposu devre dışı kalır. Pyodide yalnız çevrimdışı önizleme/altın set için kalır; üretimde sayısal otorite API içindeki motordur.
7. **Faktör ve içerik yayını:** kod dağıtımından ayrı; uzman onayıyla (`/v1/factors/{id}/versions/{v}/activate`). Üretim kataloğu kurgusal test kataloğunu **içermez** (kural 12).
8. **Gözlemlenebilirlik:** metrik, iz, alarm, hata takibi; loglara sır veya belge içeriği yazılmaz.
9. **Yedek ve kurtarma:** pilot için günlük yedek ve geri yükleme provası; kurumsal sürüm hedefi RPO 24 saat, RTO 8 saat (sözleşme taahhüdü değil; maliyet doğrulamasıyla kesinleşir).
10. **Yük ve performans:** p95 hedefleri (form 2 sn, tek kayıt hesap önizlemesi 3 sn) yük testiyle doğrulanmadan SLA ilan edilmez.
11. **Pilot kapısı (§30):** kurumlar arası erişim testleri geçmeden pilot gerçek veriye açılmaz; yedekten geri yükleme gösterilir; erişimi kaldırılan kullanıcı dosya bağlantısı ve açık oturumla devam edemez.

### 3. Yayın engelleri (§30)

Kurumlar arası veri sızıntısı, yanlış toplam, sessiz faktör değişimi, kaynaksız kesin mevzuat yorumu, lisanssız içerik, eksikleri gizleyen rapor, geri yüklenemeyen veri. Pilotun kapsamı kullanıcıya açıkça yazılır; "tam GRI uyumlu" pazarlaması yapılmaz.

### 4. Geri alma

Her göç `down` betiğiyle; her yayın önceki statik çıktı ve API imajı ile geri alınır. Onaylı kayıt, kilitli dönem ve rapor manifesti hiçbir geri almada silinmez (kural 9).


---

# G. Ekler

## Hata sözlüğü

<a id="hata-sozlugu"></a>

*Kaynak: `apps/web/src/lib/errors.ts` (modül kodları çalışma anında eklenir; bkz. uygulamadaki Hata sözlüğü sayfası)*

| Kod | Başlık | Katman | Kaynak | Neden | Sonuç | Ne yapmalı | Dayanak |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `INVALID_NUMBER` | Sayı geçersiz | motor | Hesap isteğindeki miktar, faktör değeri veya GWP alanı | Sayı ondalık dize değil (ör. JSON sayısı, metin, NaN) ya da okunamıyor. Motor sessiz dönüşüm yapmaz. | Hesap engellenir; sonuç üretilmez. | Miktarı yalnız rakam ve ondalık ayraçla girin. Form zaten ayracı sorar; geliştirici tarafında istek şeması kontrol edilir. | §18 hata davranışı |
| `NEGATIVE_QUANTITY` | Negatif miktar | motor | Miktar alanı | Tüketim negatif girildi. Negatif tüketim normal kayıt olamaz; iade/düzeltme ayrı işlem türüdür. | Hesap engellenir. | Faturadaki tüketimi pozitif girin; iade varsa ayrı düzeltme kaydı (sonraki dilim). | §11 |
| `UNIT_UNKNOWN` | Birim bilinmiyor | motor | Birim alanı | Birim seçilmedi ('bilmiyorum') veya tabloda yok. | Kesin sonuç üretilmez; kayıt taslak kalır ve eksik bilgi görevi açılır. | Faturada enerji (GJ, kWh, MWh) veya hacim (Sm³, Nm³, m³) hangisi yazıyorsa onu seçin. Emin değilseniz görevi uzmana bırakın. | T20, §11 |
| `UNIT_INCOMPATIBLE` | Birimler uyumsuz | motor | Miktar birimi ile faktör paydası | Örneğin enerji miktarına kütle paydalı faktör seçildi; bu dönüşüm desteklenmiyor. | Hesap engellenir. | Miktarın birim ailesiyle uyumlu faktör seçin (enerji ↔ GJ/kWh, hacim ↔ Nm³). | §18 |
| `UNIT_CONDITIONS_UNKNOWN` | Hacim koşulları bilinmiyor | motor | m³ miktar ile Nm³/Sm³ faktör | Düz m³ için sıcaklık/basınç verilmedi. m³, koşul bilinmeden Nm³ veya Sm³ ile eşitlenmez. | Hesap engellenir; otomatik eşitleme yapılmaz. | Faturada 'Sm³' veya 'Nm³' yazıyorsa birimi ona çevirin; yoksa faturadaki referans koşullarını girin. | T03, §12 |
| `CALORIFIC_VALUE_REQUIRED` | Isıl değer gerekli | motor | Hacim miktar ile enerji paydalı faktör | Hacimden enerjiye geçmek için kaynaklı ısıl değer (MJ/m³, kWh/m³) verilmedi veya kaynağı yok. | Hesap engellenir. | Faturadaki ısıl değeri, esasını (alt/üst) ve kaynağını girin; ya da hacim paydalı faktör seçin. | §12 |
| `BASIS_UNKNOWN` | Isıl değer esası bilinmiyor | motor | Enerji miktarının esası (alt/üst) | Esas 'bilmiyorum' bırakıldı; faktör esaslı. | Hesap engellenir; kayıt taslak kalır, görev açılır. | Faturada 'alt ısıl değer / net' ya da 'üst ısıl değer / brüt' ifadesini bulun; yoksa tedarikçiye sorun. | T20, T04 |
| `BASIS_MISMATCH` | Isıl değer esası uyuşmuyor | motor | Miktar esası (HHV/LHV) ile faktör esası | Örneğin fatura üst ısıl değer (HHV), faktör alt ısıl değer (LHV) esaslı; kaynaklı dönüşüm oranı yok. | Hesap engellenir; uyum çözülmeden onay yok. Oran kaynağıyla verilirse hesap yapılır ama 'inceleme gerekli' olur. | Kaynaklı HHV→LHV oranı girin (düzeltme formu) veya uyumlu esaslı faktör seçin. | T04, §12 |
| `FACTOR_MISSING_SOURCE` | Faktör kaynağı yok | motor | Faktör kaydı | Faktörün kaynak referansı boş. Kaynağı olmayan katsayı kataloğa giremez. | Hesap engellenir. | Faktörü kaynak sayfası/tablosuyla kataloğa kaydedin (uzman). | §18 |
| `FACTOR_UNIT_MISSING` | Faktör birimi eksik | motor | Faktör kaydı | Pay veya payda birimi tanımsız. | Hesap engellenir. | Faktörü düzeltin (uzman). | §18 |
| `FACTOR_DUPLICATE_GAS` | Aynı gaz iki faktörde | motor | Seçilen faktör kümesi | Aynı gaz (ör. CO₂) için iki faktör seçildi. | Hesap engellenir; çift sayım önlenir. | Her gaz için tek faktör seçin. | §18 |
| `FACTOR_MIX_CO2E_AND_GAS` | CO₂e ile gaz faktörü karıştı | motor | Seçilen faktör kümesi | CO₂e (GWP uygulanmış) faktörle gaz bazlı faktör aynı istekte. | Hesap engellenir; GWP ikinci kez uygulanamaz. | Ya yalnız CO₂e faktörü ya da yalnız gaz faktörleri seçin. | T02 |
| `GWP_MISSING` | GWP değeri yok | motor | Yöntemin GWP seti | Gaz faktörü var ama yöntem bu gaz için GWP içermiyor. | Hesap engellenir; uydurma katsayı kullanılmaz. | Yöntem sürümünü uzmanla güncelleyin. | §18 |
| `BOUNDARY_MIX` | Farklı sınırlar tek sonuçta | motor | Seçilen faktör kümesi | Yanma (Kapsam 1) ile üst aşama (Kapsam 3 kat. 3) faktörleri birlikte seçildi. | Hesap engellenir; yanma ve üst aşama ayrı sonuçlardır. | Tek sınır seçin; üst aşama için ayrı koşu yapın. | §12, T08 |
| `DIVISION_BY_ZERO` | Sıfıra bölme | motor | Birim veya koşul dönüşümü | Sıfır referans sıcaklık/basınç veya sıfır payda. | Hesap engellenir. | Referans koşullarını kontrol edin (kelvin cinsinden sıfır olamaz). | §18 |
| `UNSUPPORTED_SOURCE_TYPE` | Kaynak türü desteklenmiyor | motor | Kaynak türü | Motor bu sürümde yalnız sabit yakma (doğal gaz) hesaplar. | Hesap engellenir; genel formülle taklit edilmez. | Elektrik Dilim 2, Kapsam 3 Dilim 7'de gelir. | §30 |
| `INVALID_REQUEST` | İstek yapısı geçersiz | motor | Hesap isteği | Zorunlu alan eksik veya değeri tanınmıyor (ör. gaz adı). | Hesap engellenir. | Geliştirici: sözleşmeye (CONTRACT.md) uyun. | CONTRACT.md |
| `FORBIDDEN` | Yetki yok | depo | Her yazma işlemi | Aktif rol bu işlem için yetkili değil (rol matrisi). | İşlem yapılmaz; veri değişmez. Arayüzde gizlemek yetkilendirme sayılmaz; kontrol sunucuda da yapılır. | Üst çubuktan uygun rolü seçin veya yetkiliden erişim isteyin. | §04, kural 4 |
| `NOT_FOUND` | Bulunamadı | depo | Kayıt, dönem, kaynak kimliği | Kimlik aktif kurumda yok. Başka kuruma ait kayıt kimliği bilinse bile okunamaz; varlığı açıklanmaz. | Ekran 'bulunamadı' gösterir. | Üst çubuktan doğru kurumu seçin. | T14, §27 |
| `NO_TENANT` | Kurum seçilmedi | depo | Kurum bağlamı gerektiren ekranlar | Oturumda aktif kurum yok. | Kayıt işlemleri yapılamaz. | Kurum kurulumunu başlatın veya üst çubuktan kurum seçin. | §04 'her ekranda aktif kuruluş' |
| `VALIDATION` | Eksik veya hatalı alan | depo | Formlar | Zorunlu alan boş (ör. değişiklik gerekçesi) veya tutarsız (dönem bitişi başlangıçtan önce). | Kayıt yapılmaz; girilen veri formda korunur. | Alanın yanındaki açıklamayı izleyin. | §28 form bileşenleri |
| `DUPLICATE_CANDIDATE` | Mükerrer aday | depo | Yeni kayıt / kanıt yükleme | Aynı belge karması, aynı fatura numarası + tedarikçi, ya da aynı kaynak + dönem + miktar zaten var. | Kayıt gerekçesiz oluşturulmaz; aynı fatura iki kez sayılmaz. | Gerçekten ayrı işlemse gerekçe yazıp devam edin; inceleme görevi açılır. | T07, §11 |
| `VERSION_CONFLICT` | Sürüm çakışması | depo | Kayıt düzeltme | Siz formu açtıktan sonra kayıt başka bir sekme/kullanıcı tarafından değişti (beklenen sürüm ≠ güncel sürüm). | Yazma reddedilir; kimsenin verisi ezilmez. | Güncel sürümü görüp düzeltmeyi yeniden uygulayın. | T18, §27 ETag |
| `PERIOD_LOCKED` | Dönem kilitli | depo | Kilitli dönemdeki kayıt veya koşu | Dönem yönetici tarafından kilitlendi. | Düzenleme ve yeni koşu yapılmaz. | Dönem sayfasından gerekçe + etki analiziyle yeniden açma (yönetici). | T17, §21 |
| `INVALID_TRANSITION` | Geçersiz durum geçişi | depo | İş akışı | Kayıt bu durumdan hedef duruma geçemez (ör. incelemede olmayan kayda karar). | Durum değişmez. | Kayıt sayfasındaki mevcut durumu ve izin verilen eylemi izleyin. | §21 |
| `CALC_REQUIRED` | Hesap gerekli | depo | Kontrole gönder / karar | Güncel kayıt sürümü için kaydedilmiş hesap koşusu yok (kayıt değiştiyse eski koşu geçersiz). | Gönderim yapılmaz. | Kayıt sayfasında 'Önizle' → 'Bu koşuyu kaydet'. | DAT-05, DAT-06 |
| `CALC_BLOCKED` | Hesap engelli | depo | Kontrole gönder | Son koşu 'blocked' durumunda. | Engel çözülmeden kontrole gönderilemez. | Koşudaki engel kodlarını (yukarıdaki motor blokları) giderin. | §18 |
| `CALC_INPUT` | Hesap girdisi eksik | depo | Hesap önizlemesi | Miktar bilinmiyor. | Motor çağrılmaz; kesin sonuç üretilmez. | Eksik bilgi görevini tamamlayın. | §11 |
| `SEPARATION_OF_DUTIES` | Görev ayrılığı | depo | Onay | Onaylayan, kaydı giren kişiyle aynı; kurum politikası istisna açmamış. | Onay verilmez. | Başka bir onaylayan karar versin. Küçük ekip istisnası gerekçe, izin veren ve süreyle açılır; raporda görünür. | §04 |
| `EVIDENCE_REQUIRED` | Kanıt gerekli | depo | Onay | Kayıtta kanıt dosyası yok. | Onay verilmez; düzeltme istenir. | Fatura/belge ekleyin. | §21 eksik kanıt politikası |
| `REVIEW_ACK_REQUIRED` | İnceleme beyanı gerekli | depo | Onay | Koşu 'inceleme gerekli' (esas dönüşümü veya tahmini veri) ama gerekçede ne incelendiği yazılmamış. | Onay verilmez. | Gerekçeye 'inceledim' ifadesiyle neyi kontrol ettiğinizi yazın. | §21, §16 |
| `CLOSE_BLOCKED` | Kapanış engeli | depo | Dönem kilitleme | Onaylı olmayan kayıtlar var; açık eksik notu yazılmadı. | Dönem kilitlenmez. | Kayıtları onaylatın ya da açık eksik notu yazıp kilitleyin (eksikler raporda görünür). | §21 kapanış |
| `ENGINE_LOAD_FAILED` | Hesap motoru yüklenemedi | altyapi | Pyodide (CDN) ve motor dosyaları | Ağ engeli, CDN erişimi veya WebAssembly desteği yok. | Hesap yapılmaz; sahte sonuç gösterilmez. Mevcut kayıtlar korunur. | Bağlantıyı kontrol edip sayfayı yenileyin. Aynı testler CI'da pytest ile koşar. | §25 süreklilik, kural 10 |
| `STORAGE_UNAVAILABLE` | Tarayıcı deposu kapalı | altyapi | localStorage | Gizli pencere, site verisi engeli veya dolu depo. | Önizlemede kayıt yapılamaz. | Normal pencerede açın; site verisine izin verin. | K-16 |
| `RENDER_ERROR` | Ekran hatası | arayuz | Sayfa bileşeni | Beklenmeyen bir istisna (hata sınırı yakaladı). | Yalnız bu ekran etkilenir; depo verisi değişmez. | Tekrar deneyin; sürerse hata metnini ve URL'yi bildirin. | §28 hata durumu |
| `PAGE_NOT_FOUND` | Sayfa yok | arayuz | Adres | Bu adreste sayfa yok veya taşındı. | — | Menüden ilgili sekmeye gidin. | §28 |
| `UNAUTHENTICATED` | Oturum yok (401) | api | Her /v1 isteği | Bearer token yok veya geçersiz. | İstek reddedilir. | Oturum açın. | §27 hata modeli |
| `TENANT_REQUIRED` | Kurum başlığı eksik (400) | api | X-Tenant başlığı | İstek kurum bağlamı taşımıyor. | İstek reddedilir. | X-Tenant başlığı gönderin. | §27 |
| `TENANT_FORBIDDEN` | Kuruma üye değil (403) | api | X-Tenant ile üyelik karşılaştırması | Kullanıcı bu kurumun üyesi değil. İstemciden gelen tenant_id yetki kanıtı değildir. | İstek reddedilir. | Üyesi olduğunuz kurumu seçin. | kural 3, T14 |
| `IDEMPOTENCY_KEY_REQUIRED` | Idempotency anahtarı gerekli (400) | api | POST yazma uçları | Idempotency-Key başlığı yok. | İstek reddedilir. | Her yazma isteğine benzersiz anahtar ekleyin. | §27 |
| `IDEMPOTENCY_MISMATCH` | Aynı anahtar, farklı içerik (409) | api | POST yazma uçları | Daha önce kullanılan anahtarla farklı gövde gönderildi. | İkinci kayıt oluşturulmaz; istek reddedilir. | Yeni istek için yeni anahtar kullanın. | §27 kabul koşulu |
| `VERSION_REQUIRED` | Beklenen sürüm eksik (428) | api | PATCH /v1/activities/{id} | If-Match / expected_version gönderilmedi. | İstek reddedilir. | Güncel sürümü If-Match ile gönderin. | §27 |
| `STATE_CONFLICT` | Durum çakışması (409) | api | İş akışı uçları | Kayıt istenen eyleme uygun durumda değil. | Eylem yapılmaz. | Kaydın güncel durumunu okuyun. | §21 |
| `CALCULATION_STALE` | Hesap eski sürüme ait (409) | api | submit / approvals | Son koşu güncel veri sürümüne ait değil. | Gönderim/onay yapılmaz. | Yeniden hesaplayın. | DAT-05 |
| `QUANTITY_NOT_KNOWN` | Miktar bilinmiyor (409) | api | calculate | quantity_state ≠ known. | Hesap koşusu yapılmaz. | Miktarı tamamlayın. | kural 2 |
| `SELF_APPROVAL_FORBIDDEN` | Kendi kaydını onaylama (403) | api | POST /v1/approvals | Onaylayan kaydın yazarı; politika kapalı. | Onay verilmez. | Başka onaylayan. | §04 |
| `SELF_APPROVAL_REASON_REQUIRED` | İstisna gerekçesi gerekli (422) | api | POST /v1/approvals | Politika açık ama ≥10 karakter gerekçe yok. | Onay verilmez. | Gerekçe yazın; audit'e işlenir. | §04 |
| `PERIOD_NOT_READY` | Dönem kapanışa hazır değil (409) | api | POST /v1/periods/{id}/lock | Onaylı olmayan kayıtlar var. | Kilitlenmez. | Kayıtları onaylatın. | §21 |
| `PERIOD_ALREADY_LOCKED` | Dönem zaten kilitli (409) | api | lock | Tekrar kilitleme. | — | — | §21 |
| `PERIOD_NOT_LOCKED` | Dönem kilitli değil (409) | api | reopen | Açık dönem yeniden açılamaz. | — | — | T17 |
| `REASON_REQUIRED` | Gerekçe gerekli (422) | api | reopen, approvals, PATCH | Gerekçe alanı boş. | İşlem yapılmaz. | Gerekçe yazın. | §21 |
| `SUPERSEDE_REASON_REQUIRED` | Yeni rapor sürümü nedeni gerekli (422) | api | POST /v1/reports | Aynı dönem için ikinci rapor nedensiz istendi. | Rapor oluşturulmaz. | Eskiyi neden değiştirdiğinizi yazın. | §22 sabit rapor sürümü |
| `VALIDATION_ERROR` | Alan hatası (422) | api | Tüm uçlar | Şema doğrulaması başarısız; gövdede tenant_id gönderilmesi de bu hatadır. | İstek reddedilir; field_errors döner. | Alan hatalarını düzeltin. | §27, kural 3 |

## Sektör profilleri (YAML)

<a id="sektor-profilleri-yaml"></a>

*Kaynak: `content/sector-profiles/`*

### _schema.yaml

```yaml
# Sektör profili şeması (SEK-02)
# Profil kod değil veridir. Her profil sürümlüdür ve alan uzmanı onayı olmadan
# "approved" durumuna geçemez. Profil yalnız önerir/önceliklendirir (SEK-03).

id: string                 # ör. "genel", "agir-sanayi"
version: semver            # profil değişince yeni sürüm (SEK-04)
status: draft | review | approved | retired
title: {tr: string, en: string}
nace_codes: [string]       # eşleşen NACE bölüm/grup kodları
approved_by: string | null
approved_at: date | null

indicators:                # GÖS-02: çekirdek paket her profilde otomatik vardır; burada yalnız eklenenler
  - id: string
    name: {tr: string, en: string}
    unit: string
    definition: string
    suggested_owner_role: string
    frequency: monthly | quarterly | annual

intensity_denominators:    # GÖS-03
  - id: string
    name: {tr: string}
    unit: string           # ör. "t", "m2", "employee", "t.km"
    source_hint: string    # verinin genelde nereden geleceği

onboarding_questions:      # ONB-03 kaynak envanteri soruları
  - id: string
    text: {tr: string}
    creates_source_type: string   # ör. stationary_combustion, refrigerant

scope3_priorities: [int]   # 1–15; yalnız öncelik sırası, diğer kategoriler silinmez

lesson_paths:              # ÖĞR
  manager: [lesson_id]
  specialist: [lesson_id]
  field: [lesson_id]

example_documents: [string]

regulation_packages:       # REG-01: aday paketler; açılması §08 değerlendirmesine bağlıdır
  - package_id: string     # ör. "cbam", "national-ets"
    note: string
```

### agir-sanayi.yaml

```yaml
# ÖRNEK — uzman onayı bekliyor. Değerler yapıyı göstermek içindir, kaynak değildir.
id: agir-sanayi
version: 0.1.0
status: draft
title: {tr: "Ağır sanayi (metal, çimento, cam)", en: "Heavy industry"}
nace_codes: ["C23", "C24"]
approved_by: null
approved_at: null

indicators:
  - id: scrap_rate
    name: {tr: "Hurda oranı", en: "Scrap rate"}
    unit: "%"
    definition: "Dönemde oluşan hurda kütlesi / toplam çıktı kütlesi"
    suggested_owner_role: "Üretim"
    frequency: monthly
  - id: process_emissions
    name: {tr: "Proses emisyonu", en: "Process emissions"}
    unit: tCO2e
    definition: "Yanma dışı kimyasal/fiziksel proseslerden doğan doğrudan emisyon (Kapsam 1 proses şablonu)"
    suggested_owner_role: "Çevre / enerji"
    frequency: monthly

intensity_denominators:
  - id: production_tonnes
    name: {tr: "Ürün miktarı"}
    unit: t
    source_hint: "Üretim planlama / MES"

onboarding_questions:
  - id: buys_electricity
    text: {tr: "Elektrik satın alıyor musunuz?"}
    creates_source_type: purchased_electricity
  - id: furnaces
    text: {tr: "Ergitme, ısıl işlem veya pişirme fırınınız var mı?"}
    creates_source_type: stationary_combustion
  - id: process_reactions
    text: {tr: "Hammaddeden kimyasal reaksiyonla gaz çıkan prosesiniz var mı?"}
    creates_source_type: process
  - id: exports_eu
    text: {tr: "Ürünlerinizi AB'ye ihraç ediyor musunuz?"}
    creates_source_type: null

scope3_priorities: [1, 3, 4]

lesson_paths:
  manager: ["101-01", "101-07", "101-09"]
  specialist: ["101-03", "101-04", "101-05", "101-06", "101-08"]
  field: ["101-01", "101-02"]

example_documents: ["Elektrik faturası", "Doğal gaz faturası", "Hammadde alım belgesi", "Hurda satış formu"]

regulation_packages:
  - package_id: cbam
    note: "Ürün AB'ye ihraç ediliyor ve CBAM kapsamındaysa; §08 değerlendirmesi gerekir"
  - package_id: national-ets
    note: "Tesis ulusal ETS kapsamındaysa; eşikler kaynak izleme üzerinden doğrulanır (K-06)"
```

### genel.yaml

```yaml
# ÖRNEK — uzman onayı bekliyor. Uygun profil bulunmayan kurumlar bununla başlar (SEK-05).
id: genel
version: 0.1.0
status: draft
title: {tr: "Genel profil", en: "General profile"}
nace_codes: []
approved_by: null
approved_at: null

indicators: []             # yalnız çekirdek paket

intensity_denominators:
  - id: employees
    name: {tr: "Çalışan sayısı (FTE)"}
    unit: employee
    source_hint: "İK kayıtları"
  - id: floor_area
    name: {tr: "Kullanım alanı"}
    unit: m2
    source_hint: "Kira sözleşmesi veya tesis kaydı"

onboarding_questions:
  - id: buys_electricity
    text: {tr: "Elektrik satın alıyor musunuz?"}
    creates_source_type: purchased_electricity
  - id: burns_fuel
    text: {tr: "Yakıt yakan ekipmanınız (kazan, jeneratör, araç) var mı?"}
    creates_source_type: stationary_combustion
  - id: has_cooling
    text: {tr: "Klima veya soğutma ekipmanınız var mı?"}
    creates_source_type: refrigerant
  - id: buys_goods
    text: {tr: "Malzeme veya hizmet satın alıyor musunuz?"}
    creates_source_type: purchased_goods

scope3_priorities: [1, 6, 7, 5]

lesson_paths:
  manager: ["101-01", "101-07", "101-09"]
  specialist: ["101-02", "101-03", "101-04", "101-05", "101-08"]
  field: ["101-01", "101-02"]

example_documents: ["Elektrik faturası", "Doğal gaz faturası", "Yakıt alım fişi"]

regulation_packages: []
```

### gida-icecek.yaml

```yaml
# ÖRNEK — uzman onayı bekliyor. Değerler yapıyı göstermek içindir, kaynak değildir.
id: gida-icecek
version: 0.1.0
status: draft
title: {tr: "Gıda ve içecek üretimi", en: "Food and beverage manufacturing"}
nace_codes: ["C10", "C11"]
approved_by: null
approved_at: null

indicators:
  - id: water_intensity
    name: {tr: "Su yoğunluğu", en: "Water intensity"}
    unit: m3/t
    definition: "Dönemdeki toplam su çekimi / dönemdeki üretim miktarı"
    suggested_owner_role: "Üretim veya çevre sorumlusu"
    frequency: monthly
  - id: food_loss_rate
    name: {tr: "Gıda kaybı oranı", en: "Food loss rate"}
    unit: "%"
    definition: "Üretimde kaybolan ürün kütlesi / girdi kütlesi"
    suggested_owner_role: "Kalite"
    frequency: monthly

intensity_denominators:
  - id: production_tonnes
    name: {tr: "Üretim miktarı"}
    unit: t
    source_hint: "Üretim planlama / ERP"

onboarding_questions:
  - id: buys_electricity
    text: {tr: "Elektrik satın alıyor musunuz?"}
    creates_source_type: purchased_electricity
  - id: boilers
    text: {tr: "Buhar kazanı veya fırın kullanıyor musunuz?"}
    creates_source_type: stationary_combustion
  - id: cold_chain
    text: {tr: "Soğuk oda veya soğutma hattınız var mı?"}
    creates_source_type: refrigerant
  - id: packaging
    text: {tr: "Ürünlerinizi ambalajlıyor musunuz?"}
    creates_source_type: purchased_goods

scope3_priorities: [1, 4, 5, 12]

lesson_paths:
  manager: ["101-01", "101-07", "101-09"]
  specialist: ["101-03", "101-04", "101-05", "101-06", "101-08"]
  field: ["101-01", "101-02", "101-10"]

example_documents: ["Elektrik faturası", "Doğal gaz faturası", "Soğutucu gaz servis formu", "Atık teslim formu"]

regulation_packages: []
```

