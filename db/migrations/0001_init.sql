-- 0001_init.sql — Koza çekirdek veri modeli (§20), kayıt durumları (§21), audit (§25)
-- PostgreSQL 15+. Geri alma: 0001_init.down.sql
--
-- İlkeler (GELISTIRME-KURALLARI.md değiştirilemez kurallar):
--   2  NULL = bilinmiyor, 0 = ölçülmüş sıfır, not_applicable = gerekçeli karar; estimated = veri niteliği.
--   3  Her kurumsal tabloda tenant_id NOT NULL + organization FK; tenant-içi referanslar
--      bileşik FK (tenant_id, x_id) ile doğrulanır; RLS ENABLE + FORCE.
--   9  Sürüm/hesap/rapor/audit satırları append-only; UPDATE/DELETE tetikleyiciyle reddedilir.
--  12  Test faktörleri yalnız tests/ altında yaşar; bu göç faktör VERİSİ yüklemez.
--
-- Uygulama bağlantısı her işlemde `SET LOCAL app.tenant_id = '<uuid>'` çalıştırır;
-- ayarlanmamışsa politika hiçbir satır döndürmez (NULLIF boş dize → NULL).

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;  -- gen_random_uuid()

-- ---------------------------------------------------------------------------
-- Enum tipleri
-- ---------------------------------------------------------------------------

-- §21 kayıt durumları
CREATE TYPE record_state AS ENUM (
  'draft',                -- taslak
  'validation_required',  -- doğrulama gerekli (veri değişti / onay geçersiz)
  'calculated',           -- hesaplandı (onaylandı değildir)
  'in_review',            -- incelemede
  'changes_requested',    -- düzeltme istendi
  'approved',             -- onaylandı
  'locked'                -- kilitli dönem
);

-- Kural 2: veri niteliği
CREATE TYPE data_quality AS ENUM ('measured', 'estimated');

-- Kural 2: değer durumu (NULL / 0 / uygulanamaz ayrımı)
CREATE TYPE value_state AS ENUM ('known', 'unknown', 'not_applicable');

-- Dönem durumu; 'locked' kilitli dönem (T17)
CREATE TYPE period_status AS ENUM ('open', 'closing', 'locked');

-- §04 roller
CREATE TYPE member_role AS ENUM (
  'admin',           -- kurum yöneticisi
  'data_entry',      -- veri giren
  'data_owner',      -- veri sorumlusu
  'reviewer',        -- uzman kontrolör
  'approver',        -- onaylayan
  'viewer',          -- izleyici / denetçi
  'supplier',        -- tedarikçi
  'content_editor'   -- içerik editörü
);

-- Onay kararı
CREATE TYPE approval_decision AS ENUM ('approved', 'changes_requested');

-- Hesap motoru durumu (CONTRACT.md)
CREATE TYPE calc_status AS ENUM ('computed', 'review_required', 'blocked');

-- ---------------------------------------------------------------------------
-- Yardımcı fonksiyonlar
-- ---------------------------------------------------------------------------

-- Aktif tenant; ayarlanmamışsa NULL (politika hiçbir satır eşlemez)
CREATE FUNCTION app_current_tenant() RETURNS uuid
LANGUAGE sql STABLE AS $$
  SELECT NULLIF(current_setting('app.tenant_id', true), '')::uuid
$$;

-- Append-only tablolar için: UPDATE/DELETE reddedilir (kural 9)
CREATE FUNCTION reject_mutation() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'append_only_violation: % tablosunda % yasak', TG_TABLE_NAME, TG_OP
    USING ERRCODE = 'integrity_constraint_violation';
END;
$$;

-- ---------------------------------------------------------------------------
-- Kurum ve kullanıcı
-- ---------------------------------------------------------------------------

-- Kurum (tenant kökü). tenant_id = id; alt kuruluşlar parent_id ile bağlanır.
CREATE TABLE organization (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name            text NOT NULL,
  country         text NOT NULL,                 -- ISO 3166-1 alpha-2
  sector_profile  text,                          -- content/sector-profiles/<id>.yaml (SEK-02)
  sector_profile_version text,
  parent_id       uuid REFERENCES organization(id),
  -- Kurum politikaları; ör. {"allow_self_approval": false} (§04 görevlerin ayrılığı)
  policy          jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at      timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE organization IS 'Kurum (tenant kökü). policy.allow_self_approval varsayılan false.';

-- Platform kullanıcısı (tenant-bağımsız kimlik; yetki membership tablosundadır)
CREATE TABLE app_user (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email         text NOT NULL UNIQUE,
  display_name  text NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  disabled_at   timestamptz                    -- erişimi sonlandırılan kullanıcı (§04)
);
COMMENT ON TABLE app_user IS 'Kullanıcı kimliği; rol ve kurum bağlamı membership tablosundan gelir.';

-- Kurum üyeliği ve rol (§04)
CREATE TABLE membership (
  tenant_id   uuid NOT NULL REFERENCES organization(id),
  user_id     uuid NOT NULL REFERENCES app_user(id),
  role        member_role NOT NULL,
  granted_by  uuid REFERENCES app_user(id),
  created_at  timestamptz NOT NULL DEFAULT now(),
  revoked_at  timestamptz,
  PRIMARY KEY (tenant_id, user_id, role)
);
COMMENT ON TABLE membership IS 'Kullanıcının kurumdaki rolü; iptal revoked_at ile, satır silinmez.';

-- Tesis
CREATE TABLE facility (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid NOT NULL REFERENCES organization(id),
  name        text NOT NULL,
  country     text NOT NULL,
  address     text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, id)
);
COMMENT ON TABLE facility IS 'Tesis; sınır üyeliği inventory_boundary üzerinden sürümlüdür.';

-- ---------------------------------------------------------------------------
-- Dönem, sınır, kaynak
-- ---------------------------------------------------------------------------

-- Raporlama dönemi; status=locked kilitli dönem (T17)
CREATE TABLE reporting_period (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid NOT NULL REFERENCES organization(id),
  start_date      date NOT NULL,
  end_date        date NOT NULL,
  publish_date    date,
  status          period_status NOT NULL DEFAULT 'open',
  base_year_period_id uuid,
  locked_at       timestamptz,
  locked_by       uuid REFERENCES app_user(id),
  created_at      timestamptz NOT NULL DEFAULT now(),
  CHECK (end_date >= start_date),
  CHECK ((status = 'locked') = (locked_at IS NOT NULL)),
  UNIQUE (tenant_id, id),
  FOREIGN KEY (tenant_id, base_year_period_id) REFERENCES reporting_period (tenant_id, id)
);
COMMENT ON TABLE reporting_period IS 'Raporlama dönemi. Kilit açma period_reopen tablosuna yazılır; eski rapor silinmez.';

-- Kilitli dönemin yeniden açılması: gerekçe + onaylayan zorunlu (§21)
CREATE TABLE period_reopen (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     uuid NOT NULL REFERENCES organization(id),
  period_id     uuid NOT NULL,
  reason        text NOT NULL CHECK (length(btrim(reason)) >= 10),
  impact_note   text,                                  -- etki analizi özeti
  requested_by  uuid NOT NULL REFERENCES app_user(id),
  approved_by   uuid NOT NULL REFERENCES app_user(id),
  created_at    timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (tenant_id, period_id) REFERENCES reporting_period (tenant_id, id)
);
COMMENT ON TABLE period_reopen IS 'Dönem yeniden açma kaydı; append-only.';
CREATE TRIGGER period_reopen_append_only BEFORE UPDATE OR DELETE ON period_reopen
  FOR EACH ROW EXECUTE FUNCTION reject_mutation();

-- Envanter sınırı (sürümlü)
CREATE TABLE inventory_boundary (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid NOT NULL REFERENCES organization(id),
  version         integer NOT NULL CHECK (version >= 1),
  approach        text NOT NULL,                 -- operational_control | financial_control | equity_share
  included        jsonb NOT NULL DEFAULT '[]'::jsonb,  -- [{facility_id, share}]
  period_id       uuid,
  rationale       text,
  approved_by     uuid REFERENCES app_user(id),
  approved_at     timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, id),
  FOREIGN KEY (tenant_id, period_id) REFERENCES reporting_period (tenant_id, id)
);
COMMENT ON TABLE inventory_boundary IS 'Envanter sınırı; yaklaşım, dahil tesisler/paylar, gerekçe, onay.';

-- Emisyon kaynağı
CREATE TABLE emission_source (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     uuid NOT NULL REFERENCES organization(id),
  facility_id   uuid,
  source_type   text NOT NULL,                   -- stationary_combustion | ... (profil verisinden)
  control_type  text,                            -- owned | leased | ...
  meter_ref     text,                            -- sayaç / ekipman kimliği
  name          text NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, id),
  FOREIGN KEY (tenant_id, facility_id) REFERENCES facility (tenant_id, id)
);
COMMENT ON TABLE emission_source IS 'Emisyon kaynağı; tesis, kontrol/kiralama, sayaç.';

-- ---------------------------------------------------------------------------
-- Faaliyet kaydı: kimlik + append-only sürümler
-- ---------------------------------------------------------------------------

-- Kayıt kimliği (değişmez başlık)
CREATE TABLE activity_record (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid NOT NULL REFERENCES organization(id),
  source_id   uuid,
  period_id   uuid NOT NULL,
  created_by  uuid NOT NULL REFERENCES app_user(id),
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, id),
  FOREIGN KEY (tenant_id, source_id) REFERENCES emission_source (tenant_id, id),
  FOREIGN KEY (tenant_id, period_id) REFERENCES reporting_period (tenant_id, id)
);
COMMENT ON TABLE activity_record IS 'Faaliyet kaydı kimliği; içerik activity_record_version tablosunda sürümlüdür.';

-- Faaliyet kaydı sürümü — ASLA UPDATE edilmez, yeni sürüm eklenir (kural 9, T18)
CREATE TABLE activity_record_version (
  tenant_id       uuid NOT NULL REFERENCES organization(id),
  record_id       uuid NOT NULL,
  version         integer NOT NULL CHECK (version >= 1),
  -- Verinin en son değiştiği sürüm. Yalnız durum geçişi olan sürümlerde (submit/approve/lock)
  -- data_version öncekiyle aynı kalır; hesap koşumu data_version'a bağlanır.
  data_version    integer NOT NULL CHECK (data_version >= 1 AND data_version <= version),
  state           record_state NOT NULL,
  source_type     text NOT NULL,
  fuel            text,
  -- Kural 2: miktar ve miktar durumu birlikte okunur
  quantity        numeric(28,10),
  quantity_state  value_state NOT NULL,
  not_applicable_reason text,
  unit            text,
  heating_value_basis text CHECK (heating_value_basis IN ('LHV', 'HHV')),
  data_quality    data_quality NOT NULL DEFAULT 'measured',
  activity_start  date NOT NULL,
  activity_end    date NOT NULL,
  note            text,
  author_id       uuid NOT NULL REFERENCES app_user(id),
  change_reason   text,                           -- sürüm gerekçesi (§21 her geçiş gerekçe içerir)
  transition      text,                           -- create | update | calculate | submit | approve | ... (audit ile eşleşir)
  created_at      timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, record_id, version),
  FOREIGN KEY (tenant_id, record_id) REFERENCES activity_record (tenant_id, id),
  CHECK (activity_end >= activity_start),
  -- known <=> quantity IS NOT NULL; unknown/not_applicable → quantity NULL
  CHECK ((quantity_state = 'known') = (quantity IS NOT NULL)),
  CHECK ((quantity_state = 'not_applicable') = (not_applicable_reason IS NOT NULL)),
  CHECK (quantity IS NULL OR quantity >= 0)
);
COMMENT ON TABLE activity_record_version IS 'Append-only kayıt sürümü. quantity NULL=bilinmiyor; 0=ölçülmüş sıfır; not_applicable gerekçeli.';
CREATE TRIGGER activity_record_version_append_only BEFORE UPDATE OR DELETE ON activity_record_version
  FOR EACH ROW EXECUTE FUNCTION reject_mutation();

-- Güncel sürüm görünümü
CREATE VIEW activity_record_current AS
  SELECT DISTINCT ON (v.tenant_id, v.record_id) v.*
  FROM activity_record_version v
  ORDER BY v.tenant_id, v.record_id, v.version DESC;
COMMENT ON VIEW activity_record_current IS 'Her kaydın en yüksek sürümü. RLS alttaki tablodan uygulanır (security_invoker).';
ALTER VIEW activity_record_current SET (security_invoker = true);

-- Kategoriye özgü doğrulanan JSON (şema sürümlü); sürüme bağlı, append-only
CREATE TABLE activity_detail (
  tenant_id       uuid NOT NULL REFERENCES organization(id),
  record_id       uuid NOT NULL,
  version         integer NOT NULL,
  schema_id       text NOT NULL,                  -- ör. stationary_combustion.natural_gas
  schema_version  text NOT NULL,
  payload         jsonb NOT NULL,
  PRIMARY KEY (tenant_id, record_id, version),
  FOREIGN KEY (tenant_id, record_id, version) REFERENCES activity_record_version (tenant_id, record_id, version)
);
COMMENT ON TABLE activity_detail IS 'Kayıt sürümüne bağlı kategoriye özgü ayrıntı; doğrulanan şema sürümüyle saklanır.';
CREATE TRIGGER activity_detail_append_only BEFORE UPDATE OR DELETE ON activity_detail
  FOR EACH ROW EXECUTE FUNCTION reject_mutation();

-- ---------------------------------------------------------------------------
-- Kanıt
-- ---------------------------------------------------------------------------

-- Kanıt dosyası meta verisi; nesne deposu anahtarı + karma (T07 yinelenen kontrolü)
CREATE TABLE evidence (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid NOT NULL REFERENCES organization(id),
  object_key      text,                           -- nesne deposu anahtarı (tarama bitene kadar NULL olabilir)
  sha256          text NOT NULL CHECK (sha256 ~ '^[0-9a-f]{64}$'),
  filename        text NOT NULL,
  size_bytes      bigint NOT NULL CHECK (size_bytes >= 0),
  content_type    text,
  page_ref        text,                           -- sayfa / alan referansı
  scan_status     text NOT NULL DEFAULT 'pending' CHECK (scan_status IN ('pending', 'clean', 'rejected')),
  access_level    text NOT NULL DEFAULT 'tenant',
  retention_until date,
  uploaded_by     uuid NOT NULL REFERENCES app_user(id),
  created_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, id)
);
CREATE INDEX evidence_tenant_sha256_idx ON evidence (tenant_id, sha256);
COMMENT ON TABLE evidence IS 'Kanıt dosyası; tarama tamamlanmadan kullanılmaz. Aynı sha256 tenant içinde yinelenen adayıdır (T07).';

-- Kanıt ↔ kayıt sürümü bağı
CREATE TABLE activity_evidence (
  tenant_id   uuid NOT NULL REFERENCES organization(id),
  record_id   uuid NOT NULL,
  version     integer NOT NULL,
  evidence_id uuid NOT NULL,
  PRIMARY KEY (tenant_id, record_id, version, evidence_id),
  FOREIGN KEY (tenant_id, record_id, version) REFERENCES activity_record_version (tenant_id, record_id, version),
  FOREIGN KEY (tenant_id, evidence_id) REFERENCES evidence (tenant_id, id)
);
COMMENT ON TABLE activity_evidence IS 'Kayıt sürümüne bağlı kanıtlar.';

-- ---------------------------------------------------------------------------
-- Faktör ve yöntem kataloğu (platform düzeyi, tenant-bağımsız; kural 12)
-- ---------------------------------------------------------------------------

-- Faktör sürümü; değer değişmez, yeni sürüm eklenir (T13)
CREATE TABLE factor_version (
  factor_id         text NOT NULL,
  version           text NOT NULL,
  value             numeric(28,10) NOT NULL,
  numerator_unit    text NOT NULL,                 -- kg | t
  gas               text NOT NULL CHECK (gas IN ('CO2', 'CH4', 'N2O', 'CO2e')),
  denominator_unit  text NOT NULL,
  basis             text CHECK (basis IN ('LHV', 'HHV')),
  reference_conditions jsonb,
  boundary          text NOT NULL,
  gwp_set_id        text,
  country           text,
  year              integer,
  source_ref        text NOT NULL CHECK (length(btrim(source_ref)) > 0),
  license           text NOT NULL,
  valid_from        date NOT NULL,
  valid_to          date,
  status            text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'retired')),
  activated_by      uuid REFERENCES app_user(id),
  created_at        timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (factor_id, version)
);
COMMENT ON TABLE factor_version IS 'Faktör kataloğu. license=test-only satırlar üretime giremez (kural 12); etkinleştirme yetkili işlemdir.';
CREATE TRIGGER factor_version_append_only BEFORE DELETE ON factor_version
  FOR EACH ROW EXECUTE FUNCTION reject_mutation();

-- Yöntem sürümü
CREATE TABLE method_version (
  method_id     text NOT NULL,
  version       text NOT NULL,
  formula_ref   text NOT NULL,                     -- motor içindeki yöntem anahtarı
  gwp_set       jsonb NOT NULL,                    -- {"id": "...", "CH4": "28", "N2O": "265"}
  boundary      text NOT NULL,
  eligible_inputs jsonb NOT NULL DEFAULT '[]'::jsonb,
  test_suite_ref text,                             -- tests/golden referansı
  approved_by   uuid REFERENCES app_user(id),
  approved_at   timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (method_id, version)
);
COMMENT ON TABLE method_version IS 'Yöntem sürümü; formül, uygun girdiler, sınır, test paketi, onay.';

-- ---------------------------------------------------------------------------
-- Hesap koşumu ve sonucu (değişmez)
-- ---------------------------------------------------------------------------

-- Hesap koşumu: hangi kayıt sürümü, hangi faktör/yöntem/motor sürümüyle (§18, T13)
CREATE TABLE calculation_run (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid NOT NULL REFERENCES organization(id),
  record_id       uuid NOT NULL,
  record_version  integer NOT NULL,
  data_version    integer NOT NULL,                -- koşumun ait olduğu veri sürümü
  method_id       text NOT NULL,
  method_version  text NOT NULL,
  engine_version  text NOT NULL,
  factor_refs     jsonb NOT NULL,                  -- [{"id": "...", "version": "..."}]
  request         jsonb NOT NULL,                  -- motora giden tam istek (tekrar üretilebilirlik)
  inputs_hash     text NOT NULL,
  status          calc_status NOT NULL,
  run_by          uuid NOT NULL REFERENCES app_user(id),
  created_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, id),
  FOREIGN KEY (tenant_id, record_id, record_version) REFERENCES activity_record_version (tenant_id, record_id, version)
);
COMMENT ON TABLE calculation_run IS 'Değişmez hesap koşumu. Faktör güncellenince eski koşum korunur, yeni koşum eklenir (T13).';
CREATE TRIGGER calculation_run_append_only BEFORE UPDATE OR DELETE ON calculation_run
  FOR EACH ROW EXECUTE FUNCTION reject_mutation();

-- Hesap sonucu (motor çıktısı; yuvarlanmamış)
CREATE TABLE calculation_result (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid NOT NULL REFERENCES organization(id),
  run_id          uuid NOT NULL,
  total_co2e_kg   numeric(28,10),                  -- blocked ise NULL (bilinmiyor); 0 ölçülmüş sıfırdır
  coverage        text,                            -- co2_only | partial_ghg | full_ghg | co2e_factor
  boundary        text,
  claim_tr        text,
  components      jsonb NOT NULL DEFAULT '[]'::jsonb,
  warnings        jsonb NOT NULL DEFAULT '[]'::jsonb,
  blocks          jsonb NOT NULL DEFAULT '[]'::jsonb,
  trace           jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, id),
  UNIQUE (tenant_id, run_id),
  FOREIGN KEY (tenant_id, run_id) REFERENCES calculation_run (tenant_id, id)
);
COMMENT ON TABLE calculation_result IS 'Değişmez hesap sonucu; koşumla bire bir.';
CREATE TRIGGER calculation_result_append_only BEFORE UPDATE OR DELETE ON calculation_result
  FOR EACH ROW EXECUTE FUNCTION reject_mutation();

-- ---------------------------------------------------------------------------
-- Görev ve onay
-- ---------------------------------------------------------------------------

-- Görev / tedarikçi talebi (§21)
CREATE TABLE task (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     uuid NOT NULL REFERENCES organization(id),
  title         text NOT NULL,
  requested_data text,
  accepted_unit text,
  assignee_id   uuid REFERENCES app_user(id),
  due_date      date,
  status        text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'done', 'cancelled')),
  record_id     uuid,
  requirement_ref text,
  version       integer NOT NULL DEFAULT 1,
  created_by    uuid NOT NULL REFERENCES app_user(id),
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, id),
  FOREIGN KEY (tenant_id, record_id) REFERENCES activity_record (tenant_id, id)
);
COMMENT ON TABLE task IS 'Görev; sorumlu, tarih, durum, ilişkili gereklilik.';

-- Onay kararı: değişmez iz. Bir onay yalnız (record_id, record_version, run_id) için geçerlidir;
-- kayıt yeni sürüm alınca onay kendiliğinden "geçmiş" olur (§21: veri değişirse onay geçersizleşir).
CREATE TABLE approval (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid NOT NULL REFERENCES organization(id),
  record_id       uuid NOT NULL,
  record_version  integer NOT NULL,
  run_id          uuid,
  decision        approval_decision NOT NULL,
  decided_by      uuid NOT NULL REFERENCES app_user(id),
  comment         text,
  -- Görevlerin ayrılığı istisnası: kendi kaydını onaylayan için gerekçe zorunlu (§04)
  self_approval   boolean NOT NULL DEFAULT false,
  self_approval_reason text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  CHECK (NOT self_approval OR self_approval_reason IS NOT NULL),
  UNIQUE (tenant_id, id),
  FOREIGN KEY (tenant_id, record_id, record_version) REFERENCES activity_record_version (tenant_id, record_id, version),
  FOREIGN KEY (tenant_id, run_id) REFERENCES calculation_run (tenant_id, id)
);
COMMENT ON TABLE approval IS 'Append-only onay/geri gönderme kararı; sürüme bağlıdır.';
CREATE TRIGGER approval_append_only BEFORE UPDATE OR DELETE ON approval
  FOR EACH ROW EXECUTE FUNCTION reject_mutation();

-- ---------------------------------------------------------------------------
-- Standart, gereklilik, eşleştirme, önemlilik, ürün çalışması, içerik
-- ---------------------------------------------------------------------------

-- Standart sürümü (GRI, TSRS, ISO...) — platform düzeyi
CREATE TABLE standard_version (
  standard_id   text NOT NULL,
  version       text NOT NULL,
  title         text NOT NULL,
  source_ref    text NOT NULL,
  valid_from    date,
  valid_to      date,
  created_at    timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (standard_id, version)
);
COMMENT ON TABLE standard_version IS 'Standart/çerçeve sürümü; kaynak izleme (§19) ile beslenir.';

-- Gereklilik maddesi
CREATE TABLE requirement (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  standard_id     text NOT NULL,
  standard_version text NOT NULL,
  clause          text NOT NULL,
  obligation_type text NOT NULL,                   -- shall | should | may
  description     text NOT NULL,
  valid_from      date,
  valid_to        date,
  FOREIGN KEY (standard_id, standard_version) REFERENCES standard_version (standard_id, version),
  UNIQUE (standard_id, standard_version, clause)
);
COMMENT ON TABLE requirement IS 'Standart maddesi; yükümlülük tipi ve geçerlilik.';

-- Gereklilik ↔ veri/kanıt eşleştirmesi (çoktan çoğa; tam/kısmi/koşullu)
CREATE TABLE requirement_mapping (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid NOT NULL REFERENCES organization(id),
  requirement_id  uuid NOT NULL REFERENCES requirement(id),
  object_type     text NOT NULL,                   -- activity_record | evidence | text
  object_id       uuid,
  relation        text NOT NULL CHECK (relation IN ('full', 'partial', 'conditional')),
  note            text,
  created_by      uuid NOT NULL REFERENCES app_user(id),
  created_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, id)
);
COMMENT ON TABLE requirement_mapping IS 'Bir sayısal kayıt bir açıklamanın tamamını karşılamaz; ilişki türü açıkça yazılır (§22).';

-- Önemlilik değerlendirmesi
CREATE TABLE topic_assessment (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     uuid NOT NULL REFERENCES organization(id),
  topic         text NOT NULL,
  impacts       jsonb NOT NULL DEFAULT '[]'::jsonb,
  stakeholders  jsonb NOT NULL DEFAULT '[]'::jsonb,
  approach      text,
  decision      text,
  approved_by   uuid REFERENCES app_user(id),
  approved_at   timestamptz,
  version       integer NOT NULL DEFAULT 1,
  created_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, id)
);
COMMENT ON TABLE topic_assessment IS 'Önemlilik: etkiler, paydaşlar, yaklaşım, karar ve onay.';

-- Ürün / LCA çalışması — kurumsal toplama EKLENMEZ (kural 8)
CREATE TABLE product_study (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid NOT NULL REFERENCES organization(id),
  product_name    text NOT NULL,
  reference_unit  text NOT NULL,
  processes       jsonb NOT NULL DEFAULT '[]'::jsonb,
  boundary        text NOT NULL,
  allocation      jsonb,
  scenario        jsonb,
  created_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, id)
);
COMMENT ON TABLE product_study IS 'Ürün bağlamı; sonuçları Kapsam 1–2 toplamına eklenmez (§17).';

-- Ders ve terim içeriği (platform düzeyi; sürümlü)
CREATE TABLE lesson (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug          text NOT NULL,
  version       integer NOT NULL,
  language      text NOT NULL DEFAULT 'tr',
  title         text NOT NULL,
  body_ref      text NOT NULL,                     -- content/lessons/... yolu
  source_refs   jsonb NOT NULL DEFAULT '[]'::jsonb,
  editor_status text NOT NULL DEFAULT 'draft' CHECK (editor_status IN ('draft', 'review', 'published')),
  created_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (slug, version, language)
);
COMMENT ON TABLE lesson IS 'Ders içeriği sürümü; content/lessons kaynağına işaret eder.';

CREATE TABLE term (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug          text NOT NULL,
  version       integer NOT NULL,
  language      text NOT NULL DEFAULT 'tr',
  title         text NOT NULL,
  definition    text NOT NULL,
  source_refs   jsonb NOT NULL DEFAULT '[]'::jsonb,
  editor_status text NOT NULL DEFAULT 'draft' CHECK (editor_status IN ('draft', 'review', 'published')),
  created_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (slug, version, language)
);
COMMENT ON TABLE term IS 'Sözlük terimi sürümü.';

-- ---------------------------------------------------------------------------
-- Rapor anlık görüntüsü (sabit manifest, T19)
-- ---------------------------------------------------------------------------

CREATE TABLE report_snapshot (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid NOT NULL REFERENCES organization(id),
  period_id       uuid NOT NULL,
  version         integer NOT NULL CHECK (version >= 1),
  manifest        jsonb NOT NULL,                  -- kayıt sürümleri, koşum/faktör/yöntem/motor kimlikleri
  manifest_sha256 text NOT NULL CHECK (manifest_sha256 ~ '^[0-9a-f]{64}$'),
  file_key        text,                            -- nesne deposundaki rapor dosyası (henüz yok)
  file_sha256     text,
  supersedes_id   uuid,
  supersede_reason text,                           -- yeni sürüm eskiyi hangi nedenle değiştirdi (§21)
  created_by      uuid NOT NULL REFERENCES app_user(id),
  created_at      timestamptz NOT NULL DEFAULT now(),
  CHECK (supersedes_id IS NULL OR supersede_reason IS NOT NULL),
  UNIQUE (tenant_id, id),
  UNIQUE (tenant_id, period_id, version),
  FOREIGN KEY (tenant_id, period_id) REFERENCES reporting_period (tenant_id, id),
  FOREIGN KEY (tenant_id, supersedes_id) REFERENCES report_snapshot (tenant_id, id)
);
COMMENT ON TABLE report_snapshot IS 'Değişmez rapor sürümü; manifest ve karması. Yeniden açma eski raporu silemez.';
CREATE TRIGGER report_snapshot_append_only BEFORE UPDATE OR DELETE ON report_snapshot
  FOR EACH ROW EXECUTE FUNCTION reject_mutation();

-- ---------------------------------------------------------------------------
-- Idempotency anahtarı (§27)
-- ---------------------------------------------------------------------------

CREATE TABLE idempotency_key (
  tenant_id     uuid NOT NULL REFERENCES organization(id),
  user_id       uuid NOT NULL REFERENCES app_user(id),
  endpoint      text NOT NULL,
  key           text NOT NULL,
  request_hash  text NOT NULL,                     -- kanonik gövde sha256
  status_code   integer NOT NULL,
  response      jsonb NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, user_id, endpoint, key)
);
COMMENT ON TABLE idempotency_key IS 'Aynı anahtar + aynı gövde → aynı yanıt; farklı gövde → 409 IDEMPOTENCY_MISMATCH.';

-- ---------------------------------------------------------------------------
-- Audit (append-only)
-- ---------------------------------------------------------------------------

CREATE TABLE audit_event (
  id              bigserial PRIMARY KEY,
  tenant_id       uuid NOT NULL REFERENCES organization(id),
  actor_id        uuid REFERENCES app_user(id),      -- NULL: sistem
  action          text NOT NULL,                     -- activity.create | approval.approve | period.lock ...
  object_type     text NOT NULL,
  object_id       uuid,
  object_version  integer,
  reason          text,
  request_id      text,
  payload         jsonb NOT NULL DEFAULT '{}'::jsonb, -- sır / tam kişisel içerik yazılmaz (§25)
  occurred_at     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX audit_event_tenant_time_idx ON audit_event (tenant_id, occurred_at);
COMMENT ON TABLE audit_event IS 'Append-only denetim izi; UPDATE/DELETE tetikleyiciyle reddedilir.';
CREATE TRIGGER audit_event_append_only BEFORE UPDATE OR DELETE ON audit_event
  FOR EACH ROW EXECUTE FUNCTION reject_mutation();

-- ---------------------------------------------------------------------------
-- Row Level Security — her tenant tablosunda ENABLE + FORCE (kural 3)
-- ---------------------------------------------------------------------------

-- organization: tenant_id = id
ALTER TABLE organization ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON organization
  USING (id = app_current_tenant())
  WITH CHECK (id = app_current_tenant());

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'membership', 'facility', 'reporting_period', 'period_reopen', 'inventory_boundary',
    'emission_source', 'activity_record', 'activity_record_version', 'activity_detail',
    'evidence', 'activity_evidence', 'calculation_run', 'calculation_result', 'task',
    'approval', 'requirement_mapping', 'topic_assessment', 'product_study',
    'report_snapshot', 'idempotency_key', 'audit_event'
  ] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format(
      'CREATE POLICY tenant_isolation ON %I USING (tenant_id = app_current_tenant()) WITH CHECK (tenant_id = app_current_tenant())',
      t);
  END LOOP;
END $$;

COMMIT;
