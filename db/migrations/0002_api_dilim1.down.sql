-- 0002_api_dilim1.down.sql — 0002_api_dilim1.sql geri alma
-- Uyarı: import_job, integration_staging, reference_source*, session_* tabloları ve verileri silinir.
-- audit_event.object_id uuid'ye döner; UUID olmayan kimlikler (faktör/kaynak anahtarları) NULL olur — kayıplı.

BEGIN;

DROP TABLE IF EXISTS integration_staging;
DROP TRIGGER IF EXISTS reference_source_version_guard ON reference_source_version;
DROP TABLE IF EXISTS reference_source_version;
DROP FUNCTION IF EXISTS reference_source_version_guard();
DROP TABLE IF EXISTS reference_source;
DROP TABLE IF EXISTS session_seen;
DROP TABLE IF EXISTS session_revocation;

ALTER TABLE activity_record DROP CONSTRAINT IF EXISTS activity_record_tenant_id_import_job_id_fkey;
DROP TABLE IF EXISTS import_job;
DROP INDEX IF EXISTS activity_record_row_hash_idx;
ALTER TABLE activity_record
  DROP CONSTRAINT IF EXISTS activity_record_withdrawn_reason,
  DROP COLUMN IF EXISTS import_job_id,
  DROP COLUMN IF EXISTS row_hash,
  DROP COLUMN IF EXISTS withdrawn_at,
  DROP COLUMN IF EXISTS withdrawn_by,
  DROP COLUMN IF EXISTS withdrawn_reason;

ALTER TABLE evidence DROP COLUMN IF EXISTS record_id;

ALTER TABLE factor_version
  DROP COLUMN IF EXISTS activated_at,
  DROP COLUMN IF EXISTS retired_at,
  DROP COLUMN IF EXISTS created_by;

ALTER TABLE calculation_result DROP COLUMN IF EXISTS raw;

ALTER TABLE audit_event ALTER COLUMN object_id TYPE uuid
  USING (CASE WHEN object_id ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
              THEN object_id::uuid ELSE NULL END);

ALTER TABLE app_user DROP COLUMN IF EXISTS oidc_subject;

-- schema_migration tablosu çalıştırıcıya aittir; burada düşürülmez.

COMMIT;
