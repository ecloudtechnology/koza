# Koza API — Dilim 1

İş API'si: kimlik + tenant bağlamı, §21 kayıt iş akışı, hesap/onay/rapor/içe aktarma/kaynak/katalog uçları (§27),
§25 güvenlik maddeleri, denetim izi. Sayısal sonucu yalnız `packages/calc-engine` (`koza_calc`) üretir; bu katman
hesap ve toplam yapmaz (kural 1; toplama `koza_calc.aggregate`, K-17).

## Çalıştırma

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

## Ortam değişkenleri

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

## Depolar

| | `InMemoryRepo` | `PostgresRepo` (`koza_api/repo_postgres.py`) |
| --- | --- | --- |
| Seçim | `KOZA_DATABASE_URL` boş | `KOZA_DATABASE_URL` dolu |
| Kalıcılık | süreç belleği | PostgreSQL 15+, `db/migrations` |
| Tenant ayrımı | `(tenant_id, id)` anahtarı | aynı + RLS: istek başına bir bağlantı/işlem, ilk sorgudan önce `set_config('app.tenant_id', <X-Tenant>, true)` (= `SET LOCAL`); üyelik doğrulanmadan satır dönmez, hata → rollback |
| Append-only | arayüzde update/delete yok | aynı + tetikleyiciler + uygulama rolünde DELETE/TRUNCATE yetkisi yok |
| Sayılar | ondalık dize | `numeric(28,10)`; okumada sondaki sıfırlar düşer (`100.0000000000` → `"100"`), float asla |
| Bağlantı havuzu | — | yok (istek başına `psycopg.connect`); yük altında PgBouncer/`psycopg_pool` eklenir |

Her iki depo da aynı `Repository` protokolünü uygular ve **aynı test paketiyle** koşar (aşağıda).

## Göçler

`db/migrations/NNNN_ad.sql` + `NNNN_ad.down.sql`; `apps/api/scripts/migrate.py up|down [--to N]|status|grant`. Uygulanan
sürümler `schema_migration` tablosunda. `0002_api_dilim1` eklemeleri ve gerekçeleri dosya başındadır (OIDC `sub`, metin
`audit_event.object_id`, `calculation_result.raw`, faktör etkinleştirme zamanları, içe aktarma/geri çekme sütunları,
`evidence.record_id`, `import_job`, `session_revocation`/`session_seen`, `reference_source(_version)`, `integration_staging`).
Geri alma `0002_*.down.sql` kayıplıdır (UUID olmayan audit nesne kimlikleri NULL olur); üretimde yalnız yedekle.

## Kimlik: dev token ve OIDC

- **Dev token** (`KOZA_DEV_TOKENS`): üyelik ve `mfa` bayrağı token içinde. Yalnız OIDC ayarlı değilken geçerlidir;
  `jti = dev-<sha256(token)[:32]>`. Üretimde boş bırakılır.
- **OIDC** (`KOZA_OIDC_ISSUER` + `KOZA_OIDC_AUDIENCE`): Bearer JWT, JWKS ile imza + `iss`/`aud`/`exp` doğrulanır
  (`OidcTokenStore`, PyJWT). `sub` → `app_user.oidc_subject` (yedek: `email` → `app_user.email`); tanımsız kullanıcı 401
  (davet akışı ayrı). Roller her istekte `membership` tablosundan okunur → rol değişikliği açık oturumda etkilidir (§04).
  MFA: `amr` içinde `mfa|otp|hwk|sms|swk|fido|webauthn` ya da `acr ∈ {mfa, aal2, aal3}` → `mfa_verified`.
- **Oturum iptali**: `POST /v1/sessions/revoke` (kendi oturumu; admin+MFA başkasının jti'sini) → iptal listesi; sonraki
  istek 401 `SESSION_REVOKED`. `GET /v1/sessions/me` oturum bilgisini verir.
- **Giriş audit'i**: bir `jti` kurumda ilk görüldüğünde `session.login` olayı bir kez yazılır (`session_seen`).

## Nesne deposu ve kanıt akışı (§25)

1. `POST /v1/evidence/uploads` — sha256 + ad + boyut; yinelenen adaylar (T07); engelli uzantı 422, boyut aşımı 413.
   Nesne deposu varsa `upload: {method: PUT, path, max_bytes, allowed_content_types}`; yoksa `upload: null`.
2. `PUT /v1/evidence/uploads/{id}/content` — ham gövde; tür/boyut sınırı; içerik karması beyanla uyuşmazsa 422 ve **hiçbir
   şey saklanmaz**; tarama kancası `scan_status` yazar (`clean | rejected | pending`); `rejected` dosya silinir.
3. `GET /v1/evidence/{id}/download-url` — yalnız `clean` dosya; `{url, expires_at, ttl_seconds}`; bağlantı
   `/v1/evidence/files/{tenant}/{id}?exp=&sig=` HMAC imzalıdır, süre dolunca 403; erişimi kaldırılan kullanıcı yeni bağlantı
   alamaz, eskisi en çok `KOZA_SIGNED_URL_MAX_TTL` yaşar.

## Sınırlar ve hata kodları (seçme)

`RATE_LIMITED` 429 · `MFA_REQUIRED` 403 · `SESSION_REVOKED` 401 · `TENANT_FORBIDDEN/TENANT_REQUIRED` 403 ·
`VERSION_CONFLICT` 409 · `PERIOD_LOCKED` 409 (+`reopen_path`) · `IDEMPOTENCY_MISMATCH` 409 · `AGGREGATE_UNAVAILABLE` 503
(motor 0.2 yok; API toplam üretmez) · `OBJECT_STORE_UNAVAILABLE` 503 · `SIGNING_SECRET_MISSING` 503 ·
`EVIDENCE_HASH_MISMATCH` 422 · `EVIDENCE_TYPE_NOT_ALLOWED` 415 · `EVIDENCE_TOO_LARGE` 413 · `EVIDENCE_NOT_AVAILABLE` 409 ·
`IMPORT_EMPTY/IMPORT_ENCODING/IMPORT_TOO_MANY_ROWS` 422 · `IMPORT_NOT_ROLLBACKABLE` 409 · `SOURCE_CONTENT_UNCHANGED` 409 ·
`FACTOR_VERSION_EXISTS/FACTOR_RETIRED` 409 · `WEBHOOK_SECRET_MISSING` 503 · `WEBHOOK_SIGNATURE_INVALID` 401.
Tüm hatalar `{code, message (TR), field_errors, retryable, request_id[, details]}` zarfındadır.

## Uçlar (§27) — tam liste `docs/api/openapi.yaml`

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

## Testler ve test matrisi

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

## Gerçek olan / sınırlar

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

## Durum geçişleri (özet)

`draft → calculated → in_review → approved → locked`; `in_review → changes_requested`; veri değişikliği
(`PATCH`) onaylı/hesaplanmış kaydı `validation_required`'a döndürür ve önceki onayı geçersizleştirir.
Her geçiş `activity_record_version`'a yeni satır ekler; `data_version` yalnız veri değişince ilerler.
Kilitli dönemde her yazma 409 `PERIOD_LOCKED` + `details.reopen_path` döner. İçe aktarma geri alması yalnız
`draft` kaydı geri çeker (`withdrawn_*`); sürüm satırları kalır (kural 9).
