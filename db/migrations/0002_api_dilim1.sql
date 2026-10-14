-- 0002_api_dilim1.sql — Dilim 1 API'sinin gerektirdiği şema ekleri. Geri alma: 0002_api_dilim1.down.sql
--
-- Neden gerekli (her madde apps/api içindeki bir işleve karşılık gelir):
--   A  app_user.oidc_subject        : OIDC `sub` talebi → kullanıcı eşlemesi (§25 SSO). E-posta değişebilir, sub değişmez.
--   B  audit_event.object_id text   : faktör (`TEST-NG-CO2`) ve kaynak sürümü gibi nesnelerin kimliği UUID değildir;
--                                     §25 "faktör değişimi kayda alınır" için nesne kimliği metin olmalı.
--   C  calculation_result.raw       : motor 0.2 çıktısı iç içe yapılar taşır (Kapsam 2 `results`, `lifetime_group`,
--                                     `value_state`); sabit sütunlar bunu kaybeder. Koşum sonucu birebir saklanır (T13/T19).
--   D  factor_version etkinleştirme : activated_at / retired_at / created_by — "kim, ne zaman etkinleştirdi" (T13, §18).
--   E  activity_record içe aktarma  : import_job_id + row_hash (aynı satır ikinci kaydı yaratmaz, §11) ve
--                                     withdrawn_* (içe aktarma geri alma yalnız taslakları "geri çeker"; sürüm satırları
--                                     append-only olduğundan fiziksel silme yoktur, kural 9).
--   E2 evidence.record_id          : yükleme oturumu kanıtı kayda bağlar (sürüm bağı activity_evidence'ta ayrıca tutulur).
--   F  import_job                   : 202 + job_id semantiği, satır bazlı sonuç, dosya sha256 ile tekrar (§27).
--   G  session_revocation / seen    : jti iptal listesi (§04 "yetki değişikliği açık oturumda etkili") ve giriş audit'i.
--   H  reference_source(+_version)  : §19 kaynak kayıt defteri — yayın/yürürlük/görülme/kontrol tarihleri ayrı alan,
--                                     içerik karması, değişiklik kartı, uzman onayı bayrağı.
--   I  integration_staging          : §27 entegrasyon staging; (source_system, external_id, event_id) tekilliği.
--   J  schema_migration             : göç çalıştırıcısının uygulanan sürüm kaydı (apps/api/scripts/migrate.py).
--
-- Tüm yeni tenant tablolarında RLS ENABLE + FORCE (kural 3). Platform tabloları (reference_source*, session_revocation)
-- tenant_id taşımaz; yazma yetkisi uygulama katmanında role bağlıdır.

BEGIN;

-- A
ALTER TABLE app_user ADD COLUMN oidc_subject text UNIQUE;
COMMENT ON COLUMN app_user.oidc_subject IS 'OIDC sağlayıcının sub talebi; KOZA_OIDC_ISSUER ayarlıyken kimlik buradan eşlenir.';

-- B
ALTER TABLE audit_event ALTER COLUMN object_id TYPE text USING object_id::text;
COMMENT ON COLUMN audit_event.object_id IS 'Nesne kimliği (UUID veya katalog anahtarı gibi metin).';

-- C
ALTER TABLE calculation_result ADD COLUMN raw jsonb NOT NULL DEFAULT '{}'::jsonb;
COMMENT ON COLUMN calculation_result.raw IS 'Motor çıktısı birebir (yuvarlanmamış, iç içe yapılar dahil).';

-- D
ALTER TABLE factor_version
  ADD COLUMN activated_at timestamptz,
  ADD COLUMN retired_at   timestamptz,
  ADD COLUMN created_by   uuid REFERENCES app_user(id);

-- E
ALTER TABLE activity_record
  ADD COLUMN import_job_id   uuid,
  ADD COLUMN row_hash        text,
  ADD COLUMN withdrawn_at    timestamptz,
  ADD COLUMN withdrawn_by    uuid REFERENCES app_user(id),
  ADD COLUMN withdrawn_reason text,
  ADD CONSTRAINT activity_record_withdrawn_reason CHECK ((withdrawn_at IS NULL) = (withdrawn_reason IS NULL));
CREATE INDEX activity_record_row_hash_idx ON activity_record (tenant_id, row_hash) WHERE row_hash IS NOT NULL;
COMMENT ON COLUMN activity_record.withdrawn_at IS 'İçe aktarma geri alması: yalnız taslak kayıt geri çekilir; sürümleri korunur.';

-- E2
ALTER TABLE evidence ADD COLUMN record_id uuid;
ALTER TABLE evidence ADD FOREIGN KEY (tenant_id, record_id) REFERENCES activity_record (tenant_id, id);
COMMENT ON COLUMN evidence.record_id IS 'Yükleme oturumunda belirtilen kayıt (T07 yinelenen bağlamı); sürüm bağı activity_evidence.';

-- F
CREATE TABLE import_job (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid NOT NULL REFERENCES organization(id),
  period_id       uuid NOT NULL,
  filename        text,
  file_sha256     text NOT NULL CHECK (file_sha256 ~ '^[0-9a-f]{64}$'),
  mode            text NOT NULL CHECK (mode IN ('preview', 'apply')),
  status          text NOT NULL CHECK (status IN ('preview', 'done', 'rolled_back')),
  summary         jsonb NOT NULL DEFAULT '{}'::jsonb,
  rows            jsonb NOT NULL DEFAULT '[]'::jsonb,   -- [{row_no, row_hash, status, record_id, errors}]
  created_by      uuid NOT NULL REFERENCES app_user(id),
  created_at      timestamptz NOT NULL DEFAULT now(),
  rolled_back_at  timestamptz,
  rolled_back_by  uuid REFERENCES app_user(id),
  UNIQUE (tenant_id, id),
  FOREIGN KEY (tenant_id, period_id) REFERENCES reporting_period (tenant_id, id)
);
CREATE INDEX import_job_sha_idx ON import_job (tenant_id, file_sha256);
COMMENT ON TABLE import_job IS 'İçe aktarma işi; satır sonuçları ve dosya karması. Geri alma yalnız taslak kayıtları geri çeker.';
ALTER TABLE activity_record ADD FOREIGN KEY (tenant_id, import_job_id) REFERENCES import_job (tenant_id, id);

-- G
CREATE TABLE session_revocation (
  jti         text PRIMARY KEY,
  user_id     uuid REFERENCES app_user(id),
  reason      text,
  expires_at  timestamptz,                          -- token süresi; sonrasında satır temizlenebilir
  revoked_at  timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE session_revocation IS 'İptal edilen oturum belirteçleri (jti). Platform düzeyi; kimlik doğrulamada okunur.';

CREATE TABLE session_seen (
  tenant_id     uuid NOT NULL REFERENCES organization(id),
  jti           text NOT NULL,
  user_id       uuid NOT NULL REFERENCES app_user(id),
  first_seen_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, jti)
);
COMMENT ON TABLE session_seen IS 'Bir oturumun kurumda ilk görüldüğü an; session.login audit olayı bir kez üretilir.';

-- H
CREATE TABLE reference_source (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL,
  publisher   text NOT NULL,
  url         text,
  kind        text NOT NULL,                        -- standard | methodology | regulation | dataset | guidance
  license     text,
  created_by  uuid NOT NULL REFERENCES app_user(id),
  created_at  timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE reference_source IS '§19 izlenen kaynak (yayımlayan kurum, resmî metodoloji, lisanslı veri).';

CREATE TABLE reference_source_version (
  source_id             uuid NOT NULL REFERENCES reference_source(id),
  version               integer NOT NULL CHECK (version >= 1),
  publication_date      date,
  effective_date        date,
  covered_period_start  date,
  covered_period_end    date,
  early_adoption_note   text,
  seen_at               timestamptz NOT NULL,
  last_checked_at       timestamptz,
  content_hash          text NOT NULL CHECK (content_hash ~ '^[0-9a-f]{64}$'),
  content_url           text,
  change_card           jsonb NOT NULL DEFAULT '{}'::jsonb,
  expert_approved       boolean NOT NULL DEFAULT false,
  approved_by           uuid REFERENCES app_user(id),
  approved_at           timestamptz,
  created_by            uuid NOT NULL REFERENCES app_user(id),
  created_at            timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (source_id, version),
  CHECK (NOT expert_approved OR (approved_by IS NOT NULL AND approved_at IS NOT NULL))
);
COMMENT ON TABLE reference_source_version IS 'Kaynak sürümü: tarih modeli ayrı alanlar, içerik karması, değişiklik kartı. Yalnız onay alanları güncellenebilir.';

-- Sürüm içeriği değişmez; yalnız uzman onayı alanları (expert_approved, approved_by, approved_at) güncellenebilir.
CREATE FUNCTION reference_source_version_guard() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'append_only_violation: reference_source_version tablosunda DELETE yasak'
      USING ERRCODE = 'integrity_constraint_violation';
  END IF;
  IF ROW(NEW.source_id, NEW.version, NEW.publication_date, NEW.effective_date, NEW.covered_period_start,
         NEW.covered_period_end, NEW.early_adoption_note, NEW.seen_at, NEW.content_hash, NEW.content_url,
         NEW.change_card, NEW.created_by, NEW.created_at)
     IS DISTINCT FROM
     ROW(OLD.source_id, OLD.version, OLD.publication_date, OLD.effective_date, OLD.covered_period_start,
         OLD.covered_period_end, OLD.early_adoption_note, OLD.seen_at, OLD.content_hash, OLD.content_url,
         OLD.change_card, OLD.created_by, OLD.created_at) THEN
    RAISE EXCEPTION 'append_only_violation: kaynak sürümü içeriği değiştirilemez; yeni sürüm ekleyin'
      USING ERRCODE = 'integrity_constraint_violation';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER reference_source_version_guard BEFORE UPDATE OR DELETE ON reference_source_version
  FOR EACH ROW EXECUTE FUNCTION reference_source_version_guard();

-- I
CREATE TABLE integration_staging (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid NOT NULL REFERENCES organization(id),
  source_system   text NOT NULL,                    -- erp | meter | travel | procurement ...
  external_id     text NOT NULL,                    -- kaynak sistemdeki kayıt kimliği
  event_id        text NOT NULL,                    -- webhook olay kimliği
  pulled_at       timestamptz,                      -- çekilme zamanı (kaynak sistem saati)
  mapping_version text NOT NULL,
  payload         jsonb NOT NULL,
  status          text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processed', 'rejected')),
  request_id      text,
  received_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, source_system, external_id, event_id),
  UNIQUE (tenant_id, id)
);
COMMENT ON TABLE integration_staging IS '§27 entegrasyon staging; aynı olay tekrar işlenmez (tekillik anahtarı).';

-- J
CREATE TABLE IF NOT EXISTS schema_migration (
  version     integer PRIMARY KEY,
  name        text NOT NULL,
  applied_at  timestamptz NOT NULL DEFAULT now()
);

-- RLS: yeni tenant tabloları
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['import_job', 'session_seen', 'integration_staging'] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format(
      'CREATE POLICY tenant_isolation ON %I USING (tenant_id = app_current_tenant()) WITH CHECK (tenant_id = app_current_tenant())',
      t);
  END LOOP;
END $$;

COMMIT;
