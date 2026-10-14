# Gereklilik izleme matrisi

Güncelleme: 2026-10-14. Kaynak: `docs/gereklilik-izleme.json` (arayüzdeki Proje durumu sekmesi aynı dosyayı okur; bu dosya betikle üretilir, düzenleme JSON'da yapılır).

Durumlar: **tamam** — Uygulandı; test veya ekran gösterimi var; **tamam · karar bekliyor** — Uygulandı; ürün kararı grup/uzman onayı bekliyor (karar kaydı)

| Kimlik | Gereklilik | Durum | Nerede | Kanıt |
| --- | --- | --- | --- | --- |
| `ONB-01` | Kurum profili: ad, sektör (NACE), ülke, tesisler, dönem | tamam | /kurulum | Kurulum akışı; kaldığı adımdan devam; vitest store.test |
| `ONB-02` | Envanter sınırı; bilinmiyorsa uzman görevi | tamam | /kurulum, Store.setBoundary | 'Bilmiyorum' → pending_expert + görev |
| `ONB-03` | Kaynak envanteri soruları profilden; tüm kaynak türleri | tamam | /kurulum, content/sector-profiles | Yakıt/gaz/şebeke/kategori alanları; hiçbir kategori silinmez |
| `DAT-01…06` | Rehberli veri girişi: tüm §11 seçenekleri, şema-güdümlü form, OCR, kanıt, taslak/gönder | tamam | /veri-girisi, src/modules/kayit/schemas.ts | 24 şema; 38 vitest; OCR Tesseract (tur+eng) alan bazlı onay; asistan önerisi onayla |
| `§11 içe aktarma` | CSV/XLSX eşleme, önizleme, satır hataları, idempotent, geri alma | tamam | /ice-aktar, src/modules/kayit/importer.ts | Dosya ve satır karması; yalnız taslaklar geri alınır |
| `§12 Kapsam 1` | Sabit/mobil yakma, proses, soğutucu (yeni dolum ≠ kaçak) | tamam | koza_calc engine/refrigerant; /kayit | T11 fixture'ları; birim/esas/koşul engelleri |
| `§13 Kapsam 2` | Konum ve piyasa bazlı; araçlar; kalan tüketim; toplanmaz | tamam | koza_calc scope2; /kayit yöntem seçici | T05/T06 fixture'ları; araç > tüketim bloke |
| `§14–§16 Kapsam 3` | 15 kategori, yöntem matrisi (MTH-01…05), kalite boyutları, harcama, ömür boyu | tamam | koza_calc scope3 + SUPPORTED; /veri-girisi; /envanter | T08–T10, T12 fixture'ları; kategori değerlendirmesi unknown/NA |
| `§17 Ürün` | Ürün çalışması: dört sınır sorusu, tahsis, kısmi/ürün karbon ayak izi; kurumsal toplama girmez | tamam | /urun, src/modules/urun-rapor | 15 vitest; aggregate ürün bölümü ayrı |
| `§18 Motor` | Deterministik Decimal motor, iz kaydı, sürümlü faktör/yöntem, hata davranışı | tamam | packages/calc-engine (0.2.0) | 200 pytest; 77 altın örnek; tarayıcıda Pyodide aynı kod |
| `§19 SRC-01…07` | Kaynak sürümü, karma, değişiklik kartı, uzman onayı, görev | tamam | /regulasyon, /protokoller, content/sources | Yayın/yürürlük/görülme/kontrol tarihleri ayrı; doğrulanmamış kural → review_required |
| `§20 Veri modeli` | tenant_id, RLS, append-only, değer durumu | tamam | db/migrations | PostgreSQL 15 up→down→up; CHECK ve tetikleyiciler |
| `§21 İş akışı` | Durumlar, inceleme, onay geçersizliği, kapanış, kilit/yeniden açma, uzlaştırma | tamam | Store, /inceleme, /donem; apps/api workflow | T17, T18; uzlaştırma listesi; 37 API testi |
| `§22 Analiz ve rapor` | Yoğunluk (payda+dönem şartı), fark ayrıştırması, hedef kartı, rapor paketi, GRI/TSRS indeksi, dışa aktarma, yayım | tamam | /analiz, /raporlar, content/reporting-maps | aggregate() toplamları; JSON/CSV/DOCX/yazdır; T19 |
| `§23 Karbon dışı` | Çekirdek gösterge paketi: su, atık, İSG, eğitim, çıktı | tamam | content/indicators, /analiz | GÖS-04 veri sözleşmesi; düzeltme kuyruğu |
| `§24 AI-01…06` | Kaynaklı asistan: kaynak, koşul, belirsizlik, eylem; araç sınırları; belge güvenliği | tamam | /asistan, src/modules/asistan | 12 değerlendirme senaryosu; 34 vitest; T15/T16 |
| `§25 Güvenlik` | Yetki sunucuda, izolasyon, denetim izi, hız sınırı, CSV enjeksiyon, imzalı bağlantı | tamam | apps/api, db/migrations, docs/uretime-gecis.md | İzolasyon testleri; üretim adımları yönergede |
| `§26–§27 API` | /v1 uçları, idempotency, ETag, hata zarfı, içe aktarma, kaynak sürümleri, toplama | tamam | apps/api, docs/api/openapi.yaml | pytest; openapi üretildi |
| `§28 Ekran durumları` | İlk kullanım/yükleniyor/boş/kısmi/hata/yetki yok/çakışma/başarılı; klavye; hata sözlüğü | tamam | src/components/ui.tsx, /hatalar | Hata sözlüğü kaynak/neden/sonuç/eylem; hata sınırı; 404 |
| `T01–T04` | CO₂ bileşeni, çift GWP yok, m³ koşulu, esas uyumu | tamam | tests/golden | pytest + tarayıcı altın set |
| `T05–T06` | Elektrik iki yöntem; belge kısmi kapsama | tamam | tests/golden/T05-*, T06-* | fixture'lar geçer |
| `T07` | Aynı fatura yeniden yükleme | tamam | Store.addEvidence/duplicateCandidates | vitest; karma + fatura no + dönem |
| `T08–T10` | Kat.1 kapıdan kapıya; üst aşama çakışması; veri yok → sıfır değil | tamam | tests/golden/T08-*, T09-*, T10-* | fixture'lar geçer |
| `T11` | Soğutucu yeni dolum kaçak sayılmaz | tamam | tests/golden/T11-* | not_applicable; top-up review |
| `T12` | Ömür boyu satış grubu tekrar eklenmez | tamam | tests/golden/T12-*; src/modules/kayit/store.ts lifetime_groups | motor grup bilgisi + depo kontrolü (vitest) |
| `T13` | Faktör güncellenince eski sonuç korunur | tamam | /faktorler, Store.publishFactorVersion | vitest; etkilenen kayıt listesi |
| `T14` | Başka kurumun kaydı reddedilir | tamam | tests/isolation; RLS | 13 işlemde 404; vitest izolasyon |
| `T15–T16` | Belgede talimat veridir; kaynaksız hukuki soruya hüküm yok | tamam | src/modules/asistan | E06/E05/E10 senaryoları |
| `T17–T19` | Kilitli dönem; sürüm çakışması; rapor manifesti | tamam | Store, /donem, /raporlar | vitest + API testleri |
| `T20` | Birim bilinmiyor → taslak korunur | tamam | /veri-girisi, tests/golden/T20-* | görev + motor UNIT_UNKNOWN |
| `SEK-01…05` | NACE profil önerisi, profil = veri, önerir/silmez, sürüm değişince geçmiş değişmez, genel profil | tamam · karar bekliyor | /kurulum, content/sector-profiles | Profiller taslak; alan uzmanı onayı K-02, NACE düzeyi K-03 |
| `GÖS-01…04` | Gösterge sözlüğü, çekirdek paket, yoğunluk şartı, veri sözleşmesi | tamam | /analiz, content/indicators | 17 vitest (performans) |
| `AKS-01…05` | Tetikleyici → ön değerlendirme → seçenek → pilot → ölçüm → kapı | tamam | /aksiyon | Etki ölçülmeden kapanmaz testi; gölge fiyat senaryo satırı |
| `KZN-01…03` | Green Kaizen: 3 alanlı öneri, elçi değerlendirmesi, geri bildirim; birim toplulaştırma | tamam · karar bekliyor | /kaizen | Kişi bazlı sıralama yok testi; KVKK görüşü K-09 |
| `REG-01…06` | Paketler (CBAM, ulusal ETS/MRV, TSRS, AB tedarik), uygulanabilirlik, MRV planı, kanıt paketi, senaryo, eşik koda yazılmaz | tamam · karar bekliyor | /regulasyon, /senaryo, content/regulation-packages | Doğrulanmamış kural → review_required; resmî metin K-06/K-07/K-08 |
| `TDR-01…04` | Segmentasyon, gizlilik taahhüdü kapısı, öz değerlendirme, KOBİ dersi | tamam | /tedarikci, content/supplier-program | 23 vitest (disiliskiler); dış gönderim açık yetki |
| `ÖĞR-01…04` | Rol bazlı ders yolları, 3 dk saha dersi, ders→görev, eğitim saati birim toplamı | tamam | /101, content/lessons | 10 ders tam içerik; 21 vitest (ogrenme) |
| `§07–§10` | 101, protokoller (kaynak kartı + uygulanabilirlik), gündem/takvim/destek, sözlük (48 terim) ve yardım yolları | tamam | /101, /protokoller, /gundem, /sozluk | Taslak yayın görev üretmez; geçmiş tarih yaklaşan değil; TSRS review_required (K-08) |
| `Yönetişim (v1.1)` | Hedef kartı, RACI, iki hedefin durumu, memnuniyet toplulaştırması | tamam · karar bekliyor | /analiz | RACI varsayılanı forum tablosundan; ölçüm yöntemi K-10 |

Özet: tamam 35, tamam · karar bekliyor 4 (toplam 39).
