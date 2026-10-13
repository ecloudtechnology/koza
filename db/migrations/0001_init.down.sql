-- 0001_init.down.sql — 0001_init.sql geri alma
-- Uyarı: Tüm çekirdek tabloları ve veriyi siler. Yalnız geliştirme/test ortamında veya
-- yedekten geri yükleme provası sonrasında çalıştırılır (§25).

BEGIN;

-- Politikalar tabloyla birlikte düşer; tetikleyiciler de. Bağımlılık sırasına göre düşür.
DROP TABLE IF EXISTS audit_event;
DROP TABLE IF EXISTS idempotency_key;
DROP TABLE IF EXISTS report_snapshot;
DROP TABLE IF EXISTS term;
DROP TABLE IF EXISTS lesson;
DROP TABLE IF EXISTS product_study;
DROP TABLE IF EXISTS topic_assessment;
DROP TABLE IF EXISTS requirement_mapping;
DROP TABLE IF EXISTS requirement;
DROP TABLE IF EXISTS standard_version;
DROP TABLE IF EXISTS approval;
DROP TABLE IF EXISTS task;
DROP TABLE IF EXISTS calculation_result;
DROP TABLE IF EXISTS calculation_run;
DROP TABLE IF EXISTS method_version;
DROP TABLE IF EXISTS factor_version;
DROP TABLE IF EXISTS activity_evidence;
DROP TABLE IF EXISTS evidence;
DROP TABLE IF EXISTS activity_detail;
DROP VIEW  IF EXISTS activity_record_current;
DROP TABLE IF EXISTS activity_record_version;
DROP TABLE IF EXISTS activity_record;
DROP TABLE IF EXISTS emission_source;
DROP TABLE IF EXISTS inventory_boundary;
DROP TABLE IF EXISTS period_reopen;
DROP TABLE IF EXISTS reporting_period;
DROP TABLE IF EXISTS facility;
DROP TABLE IF EXISTS membership;
DROP TABLE IF EXISTS app_user;
DROP TABLE IF EXISTS organization;

DROP FUNCTION IF EXISTS reject_mutation();
DROP FUNCTION IF EXISTS app_current_tenant();

DROP TYPE IF EXISTS calc_status;
DROP TYPE IF EXISTS approval_decision;
DROP TYPE IF EXISTS member_role;
DROP TYPE IF EXISTS period_status;
DROP TYPE IF EXISTS value_state;
DROP TYPE IF EXISTS data_quality;
DROP TYPE IF EXISTS record_state;

COMMIT;
