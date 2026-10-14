# Teslim notu — tam sürüm (önizleme yayını)

Tarih: 14 Ekim 2026. Biçim: GELISTIRME-KURALLARI.md "Teslim notu" ve şartname §31 "Teslim biçimi". Tüm dilimler (0–8) uygulanmıştır; gereklilik bazında kanıt `docs/gereklilik-izleme.md`.

## Karşılanan kimlikler

- v1.0: ONB-01…03, DAT-01…06, MTH-01…05, SRC-01…07, AI-01…06, T01–T20, §04 rol matrisi, §11–§25 akışları, §26–§28 mimari/API/ekran durumları, §29 test aileleri.
- v1.1: SEK-01…05, GÖS-01…04, AKS-01…05, KZN-01…03, REG-01…06, TDR-01…04, ÖĞR-01…04, yönetişim (hedef kartı, RACI, iki hedef).

## Bileşenler

| Bileşen | İçerik | Test |
| --- | --- | --- |
| `packages/calc-engine` (koza_calc 0.2.0) | Sabit/mobil yakma, proses, soğutucu, Kapsam 2 (konum/piyasa, araçlar), Kapsam 3 (15 kategori, yöntem matrisi), ürün çalışması, `aggregate()` | 200 pytest, 77 altın senaryo; aynı kod tarayıcıda (Pyodide) |
| `apps/api` (FastAPI) | Kimlik ve kurum bağlamı, §21 iş akışı, §27 uçları, idempotency/ETag, denetim izi, PostgreSQL deposu + bellek içi depo, içe aktarma, kaynak sürümleri, faktör etkinleştirme, toplama, nesne deposu, hız sınırı | pytest (bkz. `apps/api/README.md`) ve `tests/isolation` |
| `db/migrations` | tenant_id + RLS + append-only, değer durumu CHECK | PostgreSQL 15 up→down→up |
| `apps/web` | 35 ekran: kurulum, veri girişi (24 şema, OCR, CSV/XLSX), envanter, ürün, faktör kataloğu, görevler, inceleme, dönem (uzlaştırma, kilit), rapor paketi (GRI/TSRS indeksi, JSON/CSV/DOCX/yazdır, yayım, güvence), analiz/hedef/RACI, aksiyon, Kaizen, tedarikçi, regülasyon, senaryo, gündem, 101, protokoller, sözlük, asistan, ayarlar, denetim izi, durum, belgeler, altın set, hata sözlüğü | 163 vitest; ESLint/TypeScript temiz; statik derleme |
| `content/` | 3 sektör profili, 10 ders, 48 terim, 16 kaynak kartı, 4 gündem, 2 destek, çekirdek gösterge paketi, RACI, 4 regülasyon paketi, tedarikçi programı, 3 raporlama eşlemesi | gen-content doğrulaması |

## Desteklenen yöntemler

`koza_calc.SUPPORTED` (arayüzde kayıt sayfasında görünür): Kapsam 1 `activity_x_factor`/`fuel_based`/`mass_balance`; Kapsam 2 `location_based`, `market_based`; Kapsam 3 kategori başına izinli yöntemler (1–2: tedarikçiye özgü/hibrit/ortalama/harcama; 4: mesafe/yakıt/harcama; 5/12: atık türü; 6/7/9: mesafe; 11: ömür boyu kullanım; 15: yatırıma özgü; diğerleri ortalama veri). Matris dışı yöntem `METHOD_NOT_ALLOWED` ile reddedilir.

## Kurgusal katsayılar

`tests/factors/test-catalog.json` (23 faktör) ve `tests/fixtures/test_catalog.json` yalnız test ve önizleme içindir; üretim kataloğu boştur ve uzman onayıyla doldurulur (K-04, K-05).

## Karar kaydı

Grubun kesinleştireceği ürün kararları: K-02…K-15 (bkz. `docs/karar-kaydi.md`). K-16 önizleme yayın biçimi ve K-17 toplama (motor `aggregate()`) karara bağlandı.

## Alan uzmanı onayı

Hesap yöntemi, GWP seti, birim dönüşüm kuralları, altın set referans sonuçları ve sektör profilleri alan uzmanı imzası olmadan "üretim" sayılmaz (§29). Uygulama bu imzayı beklerken tam işlevle çalışır ve her yerde "test / taslak / inceleme gerekli" durumunu gösterir.
