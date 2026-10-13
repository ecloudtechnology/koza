# Veri modeli ve göçler

Kaynak: şartname §20 (çekirdek model), §21 (durumlar), CLAUDE.md kural 2, 3, 9. Uygulama: `db/migrations/0001_init.sql` (PostgreSQL), geri dönüş `0001_init.down.sql`. Önizleme karşılığı: `apps/web/src/lib/domain.ts`.

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
| Evidence | `evidence` | sha256, boyut, tür, tarama durumu; nesne anahtarı (depo henüz yok) |
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

## Açık

- Nesne deposu anahtarı ve imzalı bağlantı (Dilim 2).
- Vektör/arama indeksi tenant etiketi (Dilim 3).
- Baz yıl yeniden hesap politikası tabloları (Dilim 8).
