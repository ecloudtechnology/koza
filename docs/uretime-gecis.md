# Üretime geçiş yönergesi

Bu belge, statik önizlemeden (GitHub Pages, tarayıcı deposu) pilot ve kurumsal işletime geçişte yapılacakları sırayla verir. Ürün işlevleri depoda tamdır; bu yönerge **altyapı ve işletim** adımlarıdır (§25, §26, §30). Her adım başka bir geliştirici tarafından uygulanabilir olmalıdır; geri alma adımları yazılıdır.

## 1. Mimari (K-01)

| Katman | Üretim | Önizleme karşılığı |
| --- | --- | --- |
| Web | `apps/web` — Next.js statik dışa aktarma; `NEXT_PUBLIC_API_URL` tanımlanınca arayüz `/v1` API'sine bağlanır | Tarayıcı deposu (`src/lib/store.ts`), aynı iş kuralları |
| İş API'si | `apps/api` — FastAPI, `KOZA_DATABASE_URL` ile PostgreSQL deposu | Çalışmaz |
| Hesap motoru | `packages/calc-engine` — API içinde Python | Aynı kod Pyodide ile tarayıcıda |
| Veri | PostgreSQL 15+, RLS, `db/migrations` | localStorage |
| Dosya | S3 uyumlu depo veya `KOZA_OBJECT_STORE_DIR`; imzalı kısa ömürlü bağlantı | Yalnız karma ve üst veri |
| Kuyruk | OCR, içe aktarma, toplu hesap, rapor; `job_id` | Eşzamanlı, tarayıcıda |
| Kimlik | OIDC/SSO (`KOZA_OIDC_ISSUER`), yönetici hesaplarında MFA zorunlu | Rol seçici |

## 2. Adımlar

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

## 3. Yayın engelleri (§30)

Kurumlar arası veri sızıntısı, yanlış toplam, sessiz faktör değişimi, kaynaksız kesin mevzuat yorumu, lisanssız içerik, eksikleri gizleyen rapor, geri yüklenemeyen veri. Pilotun kapsamı kullanıcıya açıkça yazılır; "tam GRI uyumlu" pazarlaması yapılmaz.

## 4. Geri alma

Her göç `down` betiğiyle; her yayın önceki statik çıktı ve API imajı ile geri alınır. Onaylı kayıt, kilitli dönem ve rapor manifesti hiçbir geri almada silinmez (kural 9).
