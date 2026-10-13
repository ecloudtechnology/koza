# koza_calc — deterministik hesap motoru

Koza'nın sayısal sonuç üreten tek bileşeni. Saf Python, yalnız standart kütüphane (`decimal`, `hashlib`, `json`). I/O yok, ağ yok, saat yok, rastgelelik yok, `float` yok. Aynı girdi + aynı faktör sürümü + aynı yöntem sürümü → aynı çıktı ve aynı `inputs_hash` (GELISTIRME-KURALLARI.md kural 1, §18).

Dış sözleşme: [`CONTRACT.md`](CONTRACT.md). Bu sürüm (0.1.0) yalnız **Dilim 1** kapsamını destekler: sabit yakma için tek kayıt, gaz bazlı (CO₂/CH₄/N₂O) veya CO₂e bazlı faktör.

```python
from koza_calc import calculate, ENGINE_VERSION
result = calculate(request)   # dict -> dict; hiçbir durumda istisna fırlatmaz, bloke döner
```

## Ne yapar

* Girdi doğrulama → birim/koşul dönüşümü → faktör ve esas uyumu → gaz bazlı hesap → gerekirse GWP → kapsama ve iddia metni → iz kaydı → kalite durumu.
* Sayılar yalnız ondalık **dize** olarak girer ve çıkar (`"100"`, `"0.4"`); 34 basamak, banker yuvarlaması, yuvarlama yok, üstel gösterim yok.
* Enerji (MJ, GJ, kWh, MWh) ve kütle (kg, t) sabit tablo ile; Nm³ (0 °C) ve Sm³ (15 °C) tanımlı standart hacimler arasında ideal gaz oranıyla dönüşür ve oran izde kaynağıyla görünür.
* Hacim → enerji yalnız kaynaklı `calorific_value` ile.
* CO₂e faktöre GWP ikinci kez uygulanmaz; CO₂ için GWP "uygulandı" sayılmaz.
* Yalnız CO₂ faktörü varsa sonuç `co2_only` etiketlenir ve `claim_tr` tam CO₂e olmadığını söyler.

## Neyi reddeder (bloke)

Düz `m³` koşulsuz (`UNIT_CONDITIONS_UNKNOWN`), HHV/LHV uyuşmazlığı oran olmadan (`BASIS_MISMATCH`), esası bilinmeyen enerji (`BASIS_UNKNOWN`), kaynaksız faktör (`FACTOR_MISSING_SOURCE`), CO₂e ile gaz faktörü karışımı, farklı sınırların toplanması (`BOUNDARY_MIX`), eksik GWP, negatif miktar, dize olmayan sayı (`INVALID_NUMBER`), sıfıra bölme, sabit yakma dışı kaynak türü. Tam liste ve Türkçe mesajlar `koza_calc/errors.py` içindedir. Bloke olan istekte `components=[]`, `total_co2e_kg=null`.

`basis_conversion` kullanımı veya `data_quality="estimated"` hesabı engellemez; durum `review_required` olur. `computed` onaylandı demek değildir (§21).

## Testler

```bash
python3 -m venv .venv && . .venv/bin/activate
pip install pytest && pip install -e packages/calc-engine
pytest packages/calc-engine/tests -q          # depo kökünden
```

Altın set `tests/golden/*.json` (depo kökü) altındadır; `koza_calc.golden.run_dir("tests/golden")` ile pytest'ten veya tarayıcıdan koşulur. `expected` alanları alt küme eşleşmesiyle karşılaştırılır.

**Testlerdeki tüm katsayılar kurgusaldır**; yalnız yazılım doğrulaması içindir, `license: "test-only"` taşır ve üretim faktör kataloğuna aktarılamaz (kural 12). Altın set alan uzmanı imzası beklemektedir (§29).

## Pyodide (tarayıcı)

Aynı kaynak tarayıcıda Pyodide altında çalışır; üçüncü taraf bağımlılık yoktur. Dosya sistemi olmadan altın set koşmak için ayrıştırılmış JSON'ı doğrudan verin: `golden.run_fixture(fixture_dict)` veya `golden.run_fixtures([...])`.
