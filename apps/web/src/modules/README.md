# Modül geliştirme sözleşmesi (apps/web)

Her ürün modülü `src/modules/<ad>/` altında yaşar ve sayfaları `src/app/<rota>/page.tsx` altındadır. Ortak altyapı değiştirilmez; modül onu kullanır.

## Ortak altyapı (DEĞİŞTİRİLMEZ — ihtiyaç varsa bütünleştiriciye bildir)
- `src/lib/store.ts` — `Store`: oturum, kurum, kayıt iş akışı (§21), kanıt, koşu, onay, dönem, rapor, görev, denetim izi. Modüller için: `rows/row/insert/update` (modül tabloları, kuruma süzülü), `audit`, `commit`, `require(action)`, `createTask`, `records/current/latestRun/sources/periods/facilities/tenant`.
- `src/lib/domain.ts` — tipler, `ROLE_LABEL`, `PERMISSIONS`, `registerPermissions`, `SOURCE_TYPE_LABEL`, `SCOPE3_CATEGORIES`, `can`.
- `src/lib/errors.ts` — hata sözlüğü; `registerErrors([...])` ile modül kodları eklenir (kaynak/neden/sonuç/eylem Türkçe, zorunlu).
- `src/lib/calc.ts` — `calculate(request)`, `aggregate(request)`, `supportedMatrix()`, `engineReady()`: tek sayısal otorite (kural 1). TypeScript'te hesap YAPILMAZ.
- `src/lib/content.ts` — `contentOf<T>("<content dizini>")`, `PROFILES`, `TERMS`, `LESSONS`, `SOURCES`, `SPEC_SECTIONS`, `TEST_CATALOG`.
- `src/lib/useStore.ts` — `useStore()` (store|null, ready), `fmtDate`, `fmtDec`, `kgToT`.
- `src/components/ui.tsx` — `PageHeader`, `Notice`, `ErrorBox`, `StateBadge`, `Loading`, `NoTenant`, `Markdown`. `src/components/Shell.tsx` — menü (rotalar önceden kayıtlı).
- `src/app/globals.css` — belirteçler ve ortak sınıflar (`card`, `grid-2/3`, `badge ok|warn|crit|info|neutral|accent|copper`, `notice`, `kv`, `table-wrap`, `steps`, `flow`, `hero`, `stat`). Modüle özgü stil: `src/modules/<ad>/style.css`, sayfadan `import "@/modules/<ad>/style.css"`.

## Modül dosyaları
- `register.ts` — `registerPermissions({...})` ve `registerErrors([...])`; yan etkili içe aktarma (`src/modules/index.ts` zaten içe aktarır).
- `store.ts` — saf fonksiyonlar: `(s: Store, …) => …`. Tablolar: `s.insert<T>("<ad>", "<tablo>", {...})`. Satır tipi `ModuleRow` üzerine kurulur. Değişmez olması gereken şeyler (onay, ölçüm, sürüm) için `update` yerine yeni satır.
- `*.test.ts` — vitest (`npx vitest run`), `src/test/setup.ts` depo taklidi sağlar; `new Store()` doğrudan kullanılabilir (bkz. `src/lib/store.test.ts`).
- İçerik `content/<dizin>/*.yaml` (gen-content tüm dizinleri otomatik alır; `_` ile başlayan dosya şemadır). İçerik veridir, koda gömülmez (kural 5, 6).

## Ekran kuralları (§28)
Her ekranda: ilk kullanım (amaç + başlangıç eylemi), yükleniyor (`Loading`), boş sonuç (veri yok ≠ filtre sonucu yok), kısmi veri (eksik kapsam açık), hata (`ErrorBox`; veri korunur), yetki yok (`store.require` → `FORBIDDEN`), çakışma (`expected_version`), başarılı (ne kaydedildi, durumu, sonraki adım). Çalışmayan buton, uydurma grafik, kalıcı kayıt olmadan başarı mesajı YOK (kural 10). Sayı yalnız motordan; arayüz yuvarlamayı sunumda yapar. Türkçe, kısa, sade metin; teknik terim açıklamasız seçim olarak sunulmaz. Kişi bazlı sıralama yok (kural 11). Kurum bağlamı yoksa `NoTenant`.

## Yasaklar
- `float` ile emisyon/para hesabı; LLM çıktısını sayı/faktör olarak kaydetmek; `if (sector == …)`; koda gömülü eşik/tarih/benchmark/fiyat; senaryo verisinin envantere karışması; ürün sonucunun kurumsal toplama eklenmesi; eksik veriye 0 atamak; araç veya üretici adı izi (hiçbir dosyada).

## Tip notu
`ModuleRow` dizin imzası (`[key: string]: unknown`) yüzünden `Omit<T, keyof ModuleRow>` tüm alanları siler. Doğru kalıp: `type XData = {...}`; `type XRow = ModuleRow & XData`; `insert<XRow>("mod","tablo", data as XData)`.
