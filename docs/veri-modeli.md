# Veri modeli ve göçler

Kaynak: şartname §20 (çekirdek model), §21 (durumlar), GELISTIRME-KURALLARI.md kural 2, 3, 9. Uygulama: `db/migrations/0001_init.sql` + `0002_api_dilim1.sql` (PostgreSQL), geri dönüşler `*.down.sql`; çalıştırıcı `apps/api/scripts/migrate.py`. Önizleme karşılığı: `apps/web/src/lib/domain.ts`.

## İlkeler

- Kimlikler UUID; sayısal alanlar `numeric(28,10)` (asla float); zamanlar UTC; dönemler tarih aralığı.
- Her kurumsal tabloda `tenant_id NOT NULL` ve RLS (`ENABLE` + `FORCE`, politika `current_setting('app.tenant_id')`). Satırlar arası ilişkilerde bileşik yabancı anahtar `(tenant_id, x_id)`: başka kurumun dönemine/kaynağına referans veritabanında reddedilir.
- Değer durumu ayrımı: `quantity` + `quantity_state ∈ {known, unknown, not_applicable}` ve `CHECK ((quantity_state='known') = (quantity IS NOT NULL))`. NULL bilinmiyor, 0 ölçülmüş sıfır, `not_applicable` gerekçeli karar; `data_quality ∈ {measured, estimated}` ayrı sütun.
- Append-only: `activity_record_version`, `activity_detail`, `calculation_run`, `calculation_result`, `approval`, `report_snapshot`, `period_reopen`, `audit_event` üzerinde UPDATE/DELETE tetikleyiciyle reddedilir. Güncel sürüm `activity_record_current` görünümü (`security_invoker`).
- `data_version` yalnız veri değiştiğinde ilerler; durum geçişi yeni satır ekler ama veri sürümü üretmez (onay geçerliliği `data_version` üzerinden türetilir).

## Varlıklar (§20 tablosu ↔ migration)

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

## Durum makinesi (§21)

`draft → validation_required → calculated → in_review → (approved | changes_requested) → locked`. Hesaplandı ≠ onaylandı. Onaylı kayıt değişirse onay geçersizleşir ve kayıt `validation_required`'a döner; kilitli dönem düzenlemesi `PERIOD_LOCKED` ile reddedilir, yeniden açma gerekçe + etki + yetkili ister.

## Doğrulama

Migration PostgreSQL 15 üzerinde `up → smoke → down → up` ile çalıştırıldı: değer durumu CHECK'i, append-only tetikleyicileri, RLS (yabancı tenant 0 satır; tenant ayarlanmadan 0 satır) ve bileşik FK reddi doğrulandı. Komut ve ayrıntı: `apps/api/README.md`.

## 0002_api_dilim1 (Dilim 1 API ekleri)

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

## Açık

- S3 uyumlu nesne deposu uyarlayıcısı (yerel dosya uyarlayıcısı var).
- Vektör/arama indeksi tenant etiketi (Dilim 3).
- Baz yıl yeniden hesap politikası tabloları (Dilim 8).
