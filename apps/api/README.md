# Koza API — Dilim 0

İş API'si: kimlik + tenant bağlamı, §21 kayıt iş akışı, hesap/onay/rapor uçları (§27), denetim izi.
Sayısal sonucu yalnız `packages/calc-engine` (`koza_calc`) üretir; bu katman hesap yapmaz.

## Çalıştırma

```bash
python3 -m venv .venv && . .venv/bin/activate
pip install -e "apps/api[dev]" -e packages/calc-engine
export KOZA_DEV_TOKENS='{"dev-admin":{"user_id":"<uuid>","memberships":[{"tenant_id":"<uuid>","role":"admin"}]}}'
uvicorn koza_api.main:app --reload --app-dir apps/api
curl -s localhost:8000/healthz
```

Her `/v1` isteği `Authorization: Bearer <token>` ve `X-Tenant: <uuid>` ister; `X-Tenant` kullanıcının bir
üyeliğiyle eşleşmezse 403. Gövdedeki `tenant_id` 422 ile reddedilir (kural 3).

## Ortam değişkenleri

| Değişken | Açıklama |
| --- | --- |
| `KOZA_DEV_TOKENS` | Geliştirme token'ları (JSON): `{"<token>": {"user_id", "memberships": [{"tenant_id", "role"}]}}`. Koda sır gömülmez; boşsa hiçbir token geçerli değildir. |

Roller: `admin, data_entry, data_owner, reviewer, approver, viewer, supplier, content_editor` (§04).

## Testler

```bash
pytest apps/api/tests tests/isolation -q          # depo kökünden
python apps/api/scripts/export_openapi.py         # docs/api/openapi.yaml üretir
```

`koza_calc` kurulu değilse `koza_api.testing.ensure_calc_engine()` sözleşme biçimli bir taklit yükler;
kuruluysa gerçek motor kullanılır. Test faktörleri kurgusaldır ve yalnız `tests/fixtures/test_catalog.json`
içinde yaşar (kural 12).

## Gerçek olan / taslak olan

| Parça | Durum |
| --- | --- |
| Yetki, tenant bağlamı, durum makinesi, idempotency, sürüm çakışması, kilit/yeniden açma, onay ayrılığı, manifest + sha256, kanıt karma kontrolü, audit | Gerçek; testlerle kanıtlı |
| Depo | `InMemoryRepo` (süreç belleği, kalıcı değil). `PostgresRepo` yalnız taslak: `db/migrations/0001_init.sql` şeması hazır ve PostgreSQL 15'te doğrulandı; API'ye bağlanmadı. |
| Kanıt dosyası | Nesne deposu YOK. `POST /v1/evidence/uploads` yalnız sha256/ad/boyut kaydeder, `upload: null` döner, tarama yapılmaz. |
| Rapor | `POST /v1/reports` senkron çalışır; 202 + `status: "ready"` döner (kuyruk/işçi yok). DOCX/PDF dosyası üretilmez; yalnız manifest. Manifest toplam üretmez (toplulaştırma motor işi). |
| Faktör/yöntem kataloğu | Depodan okunur; yönetim ucu yok. Dilim 1'de faktör etkinleştirme + kaynak izleme (§18–19) gelir. |
| Oturum | Yalnız dev token. OIDC/SSO, MFA, oturum iptali (§25) yok. |
| Eksik kanıt politikası, görev/tedarikçi akışı, içe aktarma, sınıflandırma önizleme | Yok. |

## Testlerle karşılanan kimlikler

| Kimlik | Test |
| --- | --- |
| T07 | `tests/test_evidence_duplicate.py` |
| T13 | `tests/test_factor_update.py` |
| T14 | `tests/isolation/test_tenant_isolation.py` (depo kökü) |
| T17 | `tests/test_locked_period.py` |
| T18 | `tests/test_version_conflict.py` |
| T19 | `tests/test_report_manifest.py` |
| §27 idempotency kabulü | `tests/test_idempotency.py` |
| §21 onay geçersizleşmesi | `tests/test_approval_invalidation.py` |
| §04 görevlerin ayrılığı | `tests/test_separation_of_duties.py` |
| §25 audit append-only | `tests/test_audit_append_only.py` |
| Kural 2 (NULL / 0 / uygulanamaz / tahmini) | `tests/test_value_states.py` |

## Durum geçişleri (özet)

`draft → calculated → in_review → approved → locked`; `in_review → changes_requested`; veri değişikliği
(`PATCH`) onaylı/hesaplanmış kaydı `validation_required`'a döndürür ve önceki onayı geçersizleştirir.
Her geçiş `activity_record_version`'a yeni satır ekler; `data_version` yalnız veri değişince ilerler.
Kilitli dönemde her yazma 409 `PERIOD_LOCKED` + `details.reopen_path` döner.
