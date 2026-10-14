# Karar kaydı

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
