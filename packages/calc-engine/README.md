# koza_calc — deterministik hesap motoru

Koza'nın sayısal sonuç üreten tek bileşeni. Saf Python, yalnız standart kütüphane (`decimal`, `hashlib`, `json`). I/O yok, ağ yok, saat yok, rastgelelik yok, `float` yok. Aynı girdi + aynı faktör sürümü + aynı yöntem sürümü → aynı çıktı ve aynı `inputs_hash` (GELISTIRME-KURALLARI.md kural 1, §18).

Dış sözleşme: [`CONTRACT.md`](CONTRACT.md) (0.1, aynen geçerli) + [`CONTRACT-v0.2.md`](CONTRACT-v0.2.md) (genişletme). Bu sürüm **0.2.0**: Kapsam 1 (sabit yakma, hareketli yakma, proses, soğutucu), Kapsam 2 (konum + piyasa bazlı), Kapsam 3 kategori 1–15 ve ürün çalışması; ayrıca `aggregate()` ile kurumsal toplama.

```python
from koza_calc import calculate, aggregate, SUPPORTED, ENGINE_VERSION
result = calculate(request)      # dict -> dict; istisna fırlatmaz, bloke döner
totals = aggregate({"results": [...], "policy": {...}})
```

## Ne yapar

* Girdi doğrulama → birim/koşul dönüşümü → faktör ve esas uyumu → gaz bazlı hesap → gerekirse GWP → kapsama ve iddia metni → iz kaydı → kalite durumu.
* Sayılar yalnız ondalık **dize** olarak girer ve çıkar (`"100"`, `"0.4"`); 34 basamak, banker yuvarlaması, yuvarlama yok, üstel gösterim yok.
* Her yanıtta `context` (`corporate` | `product`), `scope` (1 | 2 | 3 | null) ve `value_state` (`known` | `unknown` | `not_applicable`) bulunur; bilinmeyen ve uygulanamaz değerler sıfırdan ayrıdır (kural 2).

## Desteklenen matris (`koza_calc.SUPPORTED`)

| Kaynak türü | Yöntem(ler) | Not |
| --- | --- | --- |
| `stationary_combustion` | `activity_x_factor` | 0.1 ile aynı; enerji, kütle, gaz hacmi (Nm³/Sm³/m³ + koşul) |
| `mobile_combustion` | `fuel_based` | yakıt `diesel`, `gasoline`, `lpg`, `natural_gas`; birim L, m3_liquid, kg, t veya enerji; kütle↔hacim yalnız kaynaklı `density` (kg/L) ile |
| `process` | `activity_x_factor` | `process_id` zorunlu; miktar t/kg |
| `refrigerant` | `mass_balance` | `charge_type`: yeni dolum ve geri kazanım → `not_applicable`; `top_up` → inceleme; `leak_measured` → hesap; `disposal` bu sürümde tanımsız (bloke) |
| `purchased_electricity` / `purchased_steam` / `purchased_heat` / `purchased_cooling` | `location_based`, `market_based` | iki yöntem `results` altında ayrı döner, toplanmaz (`total_co2e_kg = null`) |
| `scope3` kategori 1, 2 | `supplier_specific`, `hybrid`, `average_data`, `spend_based` | |
| `scope3` kategori 3, 8, 10, 13, 14 | `average_data` | |
| `scope3` kategori 4 | `distance_based`, `fuel_based`, `spend_based` | |
| `scope3` kategori 5 | `waste_type_specific`, `average_data` | |
| `scope3` kategori 6 | `distance_based`, `spend_based` | |
| `scope3` kategori 7 | `distance_based`, `average_data` | |
| `scope3` kategori 9 | `distance_based` | |
| `scope3` kategori 11 | `lifetime_use` | adet × yıllık kullanım × ömür; satış yılına atfedilir, `lifetime_group` döner |
| `scope3` kategori 12 | `waste_type_specific` | |
| `scope3` kategori 15 | `investment_specific` | |
| `product_process` | `activity_x_factor` | `context="product"`, `coverage="carbon_only"`; kurumsal toplama girmez (kural 8) |

Birimler: enerji (MJ, GJ, kWh, MWh), kütle (kg, t), gaz hacmi (m3, Nm3, Sm3), sıvı hacim (L, m3_liquid), mesafe (km), kütle-mesafe (t.km, kg.km), yolcu-mesafe (p.km), adet (unit), para (TRY, EUR, USD — birbirine dönüştürülmez).

## Neyi reddeder (bloke)

Bloke olan istekte `components=[]`, `total_co2e_kg=null`; her blok Türkçe `message_tr` taşır (tam liste `koza_calc/errors.py`).

* **0.1 ile aynı:** düz m³ koşulsuz (`UNIT_CONDITIONS_UNKNOWN`), HHV/LHV uyuşmazlığı oransız (`BASIS_MISMATCH`), esası bilinmeyen enerji (`BASIS_UNKNOWN`), kaynaksız faktör (`FACTOR_MISSING_SOURCE`), CO₂e ile gaz faktörü karışımı (`FACTOR_MIX_CO2E_AND_GAS`), farklı sınırların toplanması (`BOUNDARY_MIX`), eksik GWP (`GWP_MISSING`), negatif miktar, dize olmayan sayı (`INVALID_NUMBER`), sıfıra bölme, tanınmayan kaynak türü (`UNSUPPORTED_SOURCE_TYPE`), uyumsuz birim (`UNIT_INCOMPATIBLE`).
* **Soğutucu:** gaz türü bilinmiyor (`REFRIGERANT_GAS_UNKNOWN`), ekipman envanter dışında (`EQUIPMENT_NOT_IN_INVENTORY`), karışım için GWP yok (`GWP_MISSING`), `disposal` kuralı tanımsız (`METHOD_NOT_ALLOWED`).
* **Kapsam 2:** araç toplamı tüketimi aşıyor (`INSTRUMENT_EXCEEDS_CONSUMPTION`), aynı belge iki kez (`INSTRUMENT_DUPLICATE`), faktörde `role` yok (`INVALID_REQUEST`).
* **Kapsam 3:** gerekçesiz uygulanamaz (`NA_REASON_REQUIRED`), miktar/uygulanabilirlik bilinmiyor (`DATA_MISSING`, `value_state="unknown"`), kategori 1–2'de beşikten mezara faktör (`LCA_FACTOR_IN_CATEGORY`), beşikten kapıya + üst aşama birlikte (`BOUNDARY_OVERLAP`), matris dışı yöntem (`METHOD_NOT_ALLOWED`), para birimi uyuşmazlığı (`CURRENCY_MISMATCH`), kategori 11'de ömür/kullanım verilmemiş (`DEFAULT_SCENARIO_FORBIDDEN`).
* **Ürün:** tahsis payı 0–1 dışında veya kaynaksız (`ALLOCATION_INVALID`).
* **Proses / hareketli yanma:** `process_id` yok (`PROCESS_ID_REQUIRED`), kütle↔hacim için yoğunluk yok (`DENSITY_REQUIRED`).

Hesabı engellemeyen ama `review_required` üreten uyarılar: `BASIS_CONVERSION_APPLIED`, `DATA_QUALITY_ESTIMATED`, `REFRIGERANT_TOPUP_ASSUMPTION`, `RESIDUAL_MIX_UNAVAILABLE`, `UPSTREAM_MISSING`, `SPEND_BASED_ESTIMATE`, ürün sınırı uyuşmazlığında `PARTIAL_BOUNDARY`. Yalnız bilgi veren uyarılar: `RECOVERED_NOT_EMISSION`, `INSTRUMENT_NOT_ELIGIBLE`, kapıdan kapıya ürün çalışmasında `PARTIAL_BOUNDARY`. `computed` onaylandı demek değildir (§21).

## Toplama — `aggregate(request)`

Onaylı/kilitli (`policy.include_states`) kayıt sonuçlarını Kapsam 1/2/3 toplamına çevirir. Ürün sonuçları `product` altında ayrı listelenir; Kapsam 2'de `policy.scope2_method` tek yöntem seçer, diğeri `scope2_alternative_kg` olarak döner ve toplanmaz; `value_state` unknown / not_applicable kayıtlar toplanmaz, `unknown` / `not_applicable` listelerinde görünür; politika dışı veya bloke kayıtlar `excluded` içindedir; tahmini pay hem kayıt sayısı hem kg ağırlıklı verilir. Toplama tam ondalıktır.

## Testler

```bash
python3 -m venv .venv && . .venv/bin/activate
pip install pytest && pip install -e packages/calc-engine
pytest -q                                      # depo kökünden (motor + API + izolasyon)
pytest packages/calc-engine/tests -q
```

Altın set `tests/golden/*.json` (depo kökü) altındadır; `koza_calc.golden.run_dir("tests/golden")` ile pytest'ten veya tarayıcıdan koşulur. `expected` alanları alt küme eşleşmesiyle karşılaştırılır. Kayıt `request` taşıyorsa `calculate()`, `aggregate_request` taşıyorsa `aggregate()` koşulur.

**Testlerdeki ve `tests/factors/test-catalog.json` içindeki tüm katsayılar kurgusaldır**; yalnız yazılım doğrulaması içindir, `license: "test-only"` taşır ve üretim faktör kataloğuna aktarılamaz (kural 12). Altın set alan uzmanı imzası beklemektedir (§29).

## Pyodide (tarayıcı)

Aynı kaynak tarayıcıda Pyodide altında çalışır; üçüncü taraf bağımlılık yoktur, paket içi içe aktarımlar dışında hiçbir numara kullanılmaz. Dosya sistemi olmadan altın set koşmak için ayrıştırılmış JSON'ı doğrudan verin: `golden.run_fixture(fixture_dict)` veya `golden.run_fixtures([...])`.
