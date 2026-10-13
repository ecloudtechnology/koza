# Teslim notu — Dilim 0 ve Dilim 1 (önizleme)

Tarih: 13 Ekim 2026. Biçim: GELISTIRME-KURALLARI.md "Teslim notu" ve şartname §31 "Teslim biçimi".

## Karşılanan kimlikler

- **Dilim 0:** §20 veri modeli (migration + RLS + append-only), §27 API sözleşmesi (idempotency, If-Match/ETag, hata zarfı), §25 denetim izi, T14 (13 işlemde 404), kural 2/3/4/9 testleri.
- **Dilim 1:** ONB-01, ONB-02, ONB-03, DAT-01, DAT-04, DAT-05, DAT-06 (tam); DAT-02, DAT-03 (kısmi: OCR ve nesne deposu yok); T01, T02, T03, T04, T07, T13, T17, T18, T19, T20; SEK-02, SEK-03, SEK-05 (tam), SEK-01 (kısmi).
- Tam liste ve kanıt: `docs/gereklilik-izleme.md` / Proje durumu sekmesi.

## Değişen dosyalar

| Alan | Dosyalar |
| --- | --- |
| Hesap motoru | `packages/calc-engine/koza_calc/{engine,units,numbers,errors,golden}.py`, `CONTRACT.md`, `README.md`, `tests/` |
| Altın set | `tests/golden/*.json` (32), `tests/factors/test-catalog.json` (kurgusal katalog) |
| API | `apps/api/koza_api/**`, `apps/api/tests/**`, `apps/api/README.md`, `docs/api/openapi.yaml` |
| Veritabanı | `db/migrations/0001_init.sql`, `0001_init.down.sql` |
| İzolasyon | `tests/isolation/test_tenant_isolation.py` |
| Arayüz | `apps/web/src/**` (22 sayfa), `scripts/gen-content.mjs` |
| İçerik | `content/sector-profiles/*.yaml` (şema + 3 profil), `content/terms` (6), `content/lessons` (10 iskelet), `content/sources` (16 kart) |
| Belgeler | `docs/spec/*` (v1.0, v1.1 eki, v1.1 rehber), `docs/forum/*` (TR/EN bulgular, mimari notu), `docs/{karar-kaydi,rol-matrisi,veri-modeli,gereklilik-izleme,inceleme-rehberi}.md`, `docs/kaynak/*` (özgün dosyalar) |
| CI | `.github/workflows/ci.yml` (pytest + build), `pages.yml` (GitHub Pages yayını) |

## Göçler

`0001_init` (up/down). PostgreSQL 15 üzerinde `up → smoke → down → up` doğrulandı. Üretim verisi üzerinde prova henüz yok (üretim yok).

## Test kanıtı

```
pytest packages/calc-engine/tests -q        → 109 passed
pytest apps/api/tests tests/isolation -q    → 37 passed
run_dir("tests/golden")                     → passed 32, failed 0
npm run build (apps/web)                    → statik dışa aktarma, tip hatası yok
```

Tarayıcıda: Altın set sekmesi aynı 32 senaryoyu Pyodide ile koşar.

## Desteklenen yöntemler / profiller

- Yöntem: `ghgp-corporate-test@0.1` (GHG Protocol Kurumsal Standart tabanlı, **test sürümü**, uzman onaysız). GWP seti `TEST-GWP` (kurgusal).
- Kaynak türü: yalnız sabit yakma / doğal gaz. Birimler GJ, MJ, kWh, MWh, Nm³, Sm³, m³ (koşullu), kg, t.
- Faktör sınırları: yanma; üst aşama ayrı sonuç (toplanmaz).
- Profiller: `genel`, `agir-sanayi`, `gida-icecek` (hepsi taslak, uzman onayı bekliyor).

## Açık eksikler

1. Kimlik: OIDC/SSO, MFA, davet, oturum iptali yok (dev token).
2. Depolama: nesne deposu, zararlı içerik taraması, imzalı bağlantı yok; önizlemede dosya içeriği saklanmaz.
3. API `PostgresRepo` stub; API `InMemoryRepo` ile çalışır. Kuyruk/işçi yok; rapor eşzamanlı.
4. OCR, Excel/CSV içe aktarma, ERP/sayaç entegrasyonu yok.
5. Rapor DOCX/PDF, GRI/TSRS gereklilik indeksi, yayımlama yetkisi yok; manifest JSON var.
6. Kapsam 2, Kapsam 3, ürün çalışması, asistan, gündem, regülasyon paketleri yok (Dilim 2–8).
7. WCAG 2.2 AA denetimi ve p95 performans ölçümü yapılmadı.
8. Toplama (onaylı kayıtların toplamı) önizlemede arayüzde BigInt ile tam ondalık toplanır; API manifesti toplam içermez — toplama motoru görevi olarak Dilim 2'ye bırakıldı (kural 1 okuması).
9. İki kurgusal katalog dosyası var (`tests/factors/test-catalog.json` arayüz, `tests/fixtures/test_catalog.json` API testleri); birleştirilecek.

## Karar kaydına eklenenler

- K-01 Dilim 0'da karara bağlandı (Next.js statik dışa aktarma + FastAPI + saf Python motor + PostgreSQL).
- K-16 (yeni): önizleme deposu tarayıcıda; sunucusuz statik yayın. Pilot öncesi kapatılmalı.
- K-17 (yeni): toplama işleminin motor mu, API mi yapacağı (kural 1 yorumu).

## Alan uzmanı onayı gerekiyor mu?

**Evet.** Yöntem sürümü, GWP seti, birim dönüşüm kuralları (ideal gaz oranı, LHV/HHV) ve altın set referans sonuçları alan uzmanı imzası olmadan "tamamlandı" sayılmaz (§29). Sektör profilleri için de uzman onayı (K-02) gerekir.

## İnsan kapısı durumu

Pilot kapısı (Dilim 1–4 sonrası) **açılmadı**: kurumlar arası erişim testi geçti; yeni kullanıcının yardımsız ilk taslak gözlemi henüz yapılmadı — bu önizlemenin grup incelemesi bunun ilk provasıdır.
