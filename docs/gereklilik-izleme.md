# Gereklilik izleme matrisi

Güncelleme: 2026-10-13. Kaynak: `docs/gereklilik-izleme.json` (arayüzdeki Proje durumu sekmesi aynı dosyayı okur). Bu dosya betikle üretilir; düzenleme JSON'da yapılır.

Durumlar: **tamam** — Uygulandı ve testi/gösterimi var; **kısmi** — Kısmen uygulandı; eksik açıkça yazılı; **planlı** — Henüz yok; dilimi belli; **karar bekliyor** — Karar kaydındaki açık karar olmadan yapılamaz

| Kimlik | Gereklilik | Dilim | Durum | Nerede | Kanıt / not |
| --- | --- | --- | --- | --- | --- |
| `ONB-01` | Kurum profili: ad, sektör (NACE), ülke, tesisler, dönem | 1 | tamam | apps/web /kurulum adım 1–3 | Önizleme: kurulum akışı; kaldığı adımdan devam (setupProgress) |
| `ONB-02` | Kuruluş ve envanter sınırı; bilinmiyorsa uzman görevi | 1 | tamam | /kurulum adım 3; Store.setBoundary | 'Bilmiyorum' → pending_expert + görev (expert_decision) |
| `ONB-03` | Kaynak envanteri soruları profilden; kategori silinmez | 1 | tamam | /kurulum adım 4; content/sector-profiles/*.yaml onboarding_questions | Sorular YAML'dan; 'bilmiyorum' görev açar, hiçbir şey silmez |
| `DAT-01` | Faaliyet ve kurum seçimi | 1 | tamam | /veri-girisi | Kaynak + dönem seçimi; kapsam önerisi açıklamalı |
| `DAT-02` | Belge yükle / elle gir / içe aktar | 1 | kısmi | /veri-girisi; apps/api POST /v1/evidence/uploads | Dosya karması + üst veri; dosya içeriği saklanmaz; OCR ve Excel içe aktarma yok *Nesne deposu ve tarama Dilim 2; içe aktarma (§11) sonraki dilim* |
| `DAT-03` | Okunan alanları doğrula | 1 | kısmi | /veri-girisi | OCR olmadığı için alanlar elle; ayraç belirsizliği (1.234) sorulur *OCR Dilim 2+* |
| `DAT-04` | Eksik bağlamı cevapla (esas, koşul, ısıl değer, nitelik) | 1 | tamam | /veri-girisi; Store.applyMissingInfoTasks | 'Bilmiyorum' seçenekleri; eksik → görev; sıfır atanmaz |
| `DAT-05` | Hesap ve sınır önerisini incele | 1 | tamam | /kayit; packages/calc-engine; apps/api POST /v1/calculations/preview | Önizleme ve kaydedilen koşu aynı motor (Pyodide ile tarayıcıda, FastAPI'de sunucuda) |
| `DAT-06` | Taslağı kaydet veya kontrole gönder (ayrı eylemler) | 1 | tamam | /veri-girisi, /kayit; apps/api POST /v1/activities/{id}/submit | Taslak kaydet ≠ kontrole gönder; gönderim hesap koşusu ister |
| `MTH-01…05` | Kapsam 3 yöntem seçme sözleşmesi | 7 | planlı | — | — |
| `SRC-01…07` | Kaynak yaşam döngüsü ve değişiklik izleme | 8 | planlı | — | Kaynak kartları (K01–K16) yalnız bağlantı olarak content/sources |
| `AI-01…06` | Asistan yanıt sözleşmesi | 3 | planlı | /asistan (açıklama sayfası) | Sohbet kutusu kasıtlı olarak yok (kural 10) |
| `T01` | 100 GJ × 50 kg CO₂/GJ → yalnız CO₂ bileşeni 5 t | 1 | tamam | tests/golden/T01-co2-only.json; packages/calc-engine/tests | pytest 109 geçti; /altin-set tarayıcıda |
| `T02` | CO₂e faktörüne ikinci GWP yok | 1 | tamam | tests/golden/T02-*.json | gwp_applied=false; CO2e+gaz karışımı bloke |
| `T03` | m³ / Nm³ koşulu bilinmiyor → eşitleme engeli | 1 | tamam | tests/golden/T03-*.json | UNIT_CONDITIONS_UNKNOWN; koşul verilince ideal gaz oranı izde |
| `T04` | Üst ısıl değer ile alt esaslı faktör → onay yok | 1 | tamam | tests/golden/T04-*.json | BASIS_MISMATCH; kaynaklı oranla review_required |
| `T05` | Elektrik için iki yöntem ayrı | 2 | planlı | — | — |
| `T06` | Belge tüketimin bir kısmını kapsıyor | 2 | planlı | — | — |
| `T07` | Aynı fatura yeniden yükleniyor → mükerrer kontrol | 1 | tamam | Store.addEvidence/duplicateCandidates; apps/api evidence tests | SHA-256 eş karma, fatura no, dönem+miktar; gerekçeyle devam + görev |
| `T08` | Kategori 1 kapıdan kapıya veri → üst aşama eksikliği | 7 | planlı | — | BOUNDARY_MIX engeli motorda hazır |
| `T09` | Yaşam döngüsü faktörüne üst aşama ekleme → çakışma | 7 | planlı | — | — |
| `T10` | Veri bulunmayan Kapsam 3 kategorisi sıfır/uygulanamaz yapılmaz | 7 | planlı | — | value_state (known/unknown/not_applicable) DB ve API'de hazır |
| `T11` | Soğutucu yeni dolum ≠ kaçak | 2 | planlı | — | — |
| `T12` | Satış grubu ömür boyu hesabı tekrar eklenmez | 7 | planlı | — | — |
| `T13` | Faktör güncellenince eski onaylı sonuç korunur | 1 | tamam | /faktorler; Store.publishFactorVersion; apps/api tests | Yeni koşu eskisini silmez (superseded_by); etkilenen kayıt listesi |
| `T14` | Başka kuruma ait kayıt kimliği reddedilir | 0 | tamam | tests/isolation/test_tenant_isolation.py; db/migrations RLS | 13 işlemde 404; RLS FORCE PostgreSQL 15 üzerinde doğrulandı; önizlemede istemci gösterimi |
| `T15` | Belgede kötü amaçlı talimat veri olarak kalır | 3 | planlı | — | — |
| `T16` | Kaynaksız hukuki soruya kesin hüküm yok | 3 | planlı | — | — |
| `T17` | Kilitli dönem düzenleme → yetkili yeniden açma | 1 | tamam | /donem; Store.lockPeriod/reopenPeriod; apps/api periods | PERIOD_LOCKED 409; gerekçe + etki analizi; eski rapor korunur |
| `T18` | İki kullanıcı aynı sürümü değiştiriyor → çakışma | 1 | tamam | Store.updateRecord expected_version; apps/api If-Match | VERSION_CONFLICT 409; veri ezilmez (ikinci sekmeyle denenebilir) |
| `T19` | Rapor yeniden oluşturma → aynı manifest | 1 | tamam | /raporlar; Store.createReport; apps/api reports | Kanonik JSON SHA-256; 'önceki sürümle aynı' rozeti |
| `T20` | Yeni başlayan birimi bilmiyor → taslak korunur | 1 | tamam | /veri-girisi; tests/golden/T20-*.json | Birim/esas 'bilmiyorum' → taslak + görev; motor UNIT_UNKNOWN/BASIS_UNKNOWN |
| `§20` | Çekirdek veri modeli, tenant_id, append-only, RLS | 0 | tamam | db/migrations/0001_init.sql | up→smoke→down→up PostgreSQL 15; değer durumu CHECK |
| `§27` | API sözleşmesi: /v1, idempotency, ETag, hata modeli | 0 | kısmi | apps/api; docs/api/openapi.yaml | 17 uç, 37 test; InMemoryRepo; PostgresRepo stub *Nesne deposu, kuyruk, OIDC yok* |
| `§28` | Ekran durum sözleşmesi ve erişilebilirlik | 1 | kısmi | apps/web | Yükleniyor/boş/hata/yetki yok/çakışma/başarılı durumları; klavye odak; tablolar yatay kaydırma *WCAG denetimi yapılmadı; uygunluk beyanı yok* |
| `SEK-01` | NACE ile profil önerisi, kullanıcı onayı, tesis bazlı profil | 4 | kısmi | /kurulum; lib/content.suggestProfile | Öneri + onay + tesis profili alanı *NACE düzeyi ve çok faaliyet kuralı K-03 açık* |
| `SEK-02` | Profil şeması ve içeriği YAML | 4 | tamam | content/sector-profiles/_schema.yaml, genel, agir-sanayi, gida-icecek | Kod sektöre göre dallanmaz; gen-content YAML→JSON |
| `SEK-03` | Profil yalnız önerir, silmez | 4 | tamam | Store.sources/onboarding | 'Hayır' kaynak yaratmaz; hiçbir kategori silinmez |
| `SEK-04` | Profil sürümü değişince geçmiş değişmez; fark önizlemesi | 4 | planlı | — | Tenant profile_version saklanır |
| `SEK-05` | Uygun profil yoksa genel; içerik görevi | 4 | tamam | /kurulum | genel öneri + content görevi |
| `GÖS-01…04` | Gösterge sözlüğü ve veri sözleşmesi | 4 | planlı | /analiz (açıklama) | Profillerde payda tanımları hazır |
| `AKS-01…05` | Karar kapısı ve aksiyon motoru | 6 | planlı | — | — |
| `KZN-01…03` | Green Kaizen | 5 | karar bekliyor | — | K-09 (KVKK) kararı bekliyor |
| `REG-01…06` | Regülasyon paketleri | 8 | karar bekliyor | — | K-06, K-07, K-08 açık; eşikler koda yazılmaz |
| `TDR-01…04` | Tedarikçi veri programı | 7 | planlı | — | — |
| `ÖĞR-01…04` | Rol bazlı öğrenme | 5 | kısmi | content/lessons (10 iskelet), profiller lesson_paths | Gövde yok; içerik editörü onayı yok |

Özet: tamam 22, kısmi 6, planlı 16, karar bekliyor 2 (toplam 46).
