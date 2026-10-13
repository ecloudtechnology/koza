# Hesap motoru sözleşmesi — `koza_calc` 0.1

Bu belge `packages/calc-engine` paketinin dış sözleşmesidir. Motor **saf Python**'dır: I/O yok, ağ yok, saat yok, rastgelelik yok, `float` yok. Girdi JSON-uyumlu bir sözlük, çıktı JSON-uyumlu bir sözlüktür. Aynı girdi → aynı çıktı (§18, kural 1).

Motor şu an yalnız **Dilim 1** kapsamını destekler: sabit yakma (doğal gaz) için gaz bazlı veya CO₂e bazlı faktörle tek kayıt hesabı. Desteklenmeyen her şey açıkça `blocked` döner; genel bir formülle taklit edilmez (§30).

```python
from koza_calc import calculate, ENGINE_VERSION
result = calculate(request)        # dict -> dict
```

Aynı kodu Pyodide (tarayıcı) ve FastAPI (sunucu) çalıştırır; bu yüzden paket yalnız standart kütüphane kullanır (`decimal`, `hashlib`, `json`).

## Sayılar

* Tüm sayılar **ondalık dize** olarak girer ve çıkar: `"100"`, `"0.4"`, `"38.5"`. Girdide `float`/`int` gelirse `INVALID_NUMBER` ile reddedilir (sessiz dönüşüm yok).
* `decimal.Decimal`, `prec=34`, `ROUND_HALF_EVEN`. Çıktı dizeleri normalize edilir; üstel gösterim kullanılmaz (`"5000"`, `"0.4"`).
* Yuvarlama **yapılmaz**; sunum katmanı yuvarlar (§18 işlem sırası).

## İstek

```jsonc
{
  "activity": {
    "id": "act-…",                   // kayıt kimliği (iz için)
    "version": 3,                    // kayıt sürümü (iz için)
    "source_type": "stationary_combustion",
    "fuel": "natural_gas",
    "quantity": "100",
    "unit": "GJ",                    // bkz. Birimler
    "heating_value_basis": "LHV",    // "LHV" | "HHV" | null — enerji miktarının esası
    "reference_conditions": null,    // m3 için {"temperature_c": "15", "pressure_kpa": "101.325"} | null
    "calorific_value": null,         // hacim→enerji için {"value": "38.5", "unit": "MJ/m3", "basis": "LHV", "source_ref": "…"} | null
    "basis_conversion": null,        // {"ratio": "0.9", "from": "HHV", "to": "LHV", "source_ref": "…"} | null — kullanıcı açıkça verirse
    "data_quality": "measured",      // "measured" | "estimated"
    "period": {"start": "2026-01-01", "end": "2026-01-31"}
  },
  "factors": [                       // bir veya daha fazla faktör; aynı gazdan iki faktör hata
    {
      "id": "TEST-NG-CO2", "version": "1.0",
      "value": "50",
      "numerator_unit": "kg",        // kg | t
      "gas": "CO2",                  // "CO2" | "CH4" | "N2O" | "CO2e"
      "denominator_unit": "GJ",      // enerji/hacim/kütle birimi
      "basis": "LHV",                // enerji paydası için "LHV" | "HHV"; diğerleri için null
      "reference_conditions": null,  // hacim paydası için (Nm3/Sm3 tanımlı sayılır)
      "boundary": "combustion",      // "combustion" | "upstream" | "cradle_to_gate" | "well_to_wheel"
      "gwp_set_id": null,            // CO2e faktörlerde hangi GWP setiyle üretildiği (bilgi)
      "source_ref": "tests/golden — kurgusal", // ZORUNLU; yoksa FACTOR_MISSING_SOURCE
      "license": "test-only",
      "valid_from": "2026-01-01", "valid_to": null
    }
  ],
  "method": {
    "id": "ghgp-corporate-test", "version": "0.1",
    "gwp_set": {"id": "TEST-GWP", "CH4": "28", "N2O": "265"}   // kurgusal test değerleri
  }
}
```

### Birimler

| Aile | Birimler | Dönüşüm |
| --- | --- | --- |
| Enerji | `MJ`, `GJ`, `kWh`, `MWh` | Sabit: GJ=1000 MJ, kWh=3.6 MJ, MWh=3600 MJ |
| Kütle | `kg`, `t` | t = 1000 kg |
| Hacim | `m3`, `Nm3`, `Sm3` | Bkz. aşağıda |

* `Nm3` (0 °C, 101.325 kPa) ve `Sm3` (15 °C, 101.325 kPa) **tanımlı** standart hacimlerdir. Birbirine ideal gaz oranıyla (`V₂ = V₁ · T₂/T₁ · P₁/P₂`, kelvin) dönüşür ve dönüşüm izde kaynağıyla yazılır.
* Düz `m3`, `reference_conditions` olmadan Nm3/Sm3'e **eşitlenmez** → `UNIT_CONDITIONS_UNKNOWN` (T03).
* Hacim → enerji yalnız `calorific_value` ile; `calorific_value.basis` faktör esasıyla uyuşmazsa `BASIS_MISMATCH`.
* Enerji miktarının `heating_value_basis`'i faktörün `basis`'inden farklıysa `BASIS_MISMATCH` (T04). Kullanıcı `basis_conversion` (oran + kaynak) verirse hesap yapılır fakat durum `review_required` olur; iz kaydında oran ve kaynak görünür.
* `heating_value_basis` null ve faktör esaslıysa → `BASIS_UNKNOWN` (bloke; "bilmiyorum" durumunda taslak kalır, T20).
* Enerji ↔ kütle dönüşümü desteklenmez → `UNIT_INCOMPATIBLE`.

## Yanıt

```jsonc
{
  "engine_version": "0.1.0",
  "method": {"id": "…", "version": "…"},
  "status": "computed" | "review_required" | "blocked",
  "blocks":   [{"code": "UNIT_CONDITIONS_UNKNOWN", "field": "activity.reference_conditions", "message_tr": "…"}],
  "warnings": [{"code": "…", "message_tr": "…"}],
  "normalized_activity": {"quantity": "100", "unit": "GJ", "basis": "LHV"} | null,
  "components": [                                   // gaz başına; blocked ise boş
    {"gas": "CO2", "factor_id": "TEST-NG-CO2", "factor_version": "1.0",
     "mass_kg": "5000", "gwp": null, "gwp_applied": false, "co2e_kg": "5000"}
  ],
  "total_co2e_kg": "5000" | null,                   // blocked ise null
  "coverage": "co2_only" | "partial_ghg" | "full_ghg" | "co2e_factor" | null,
  "claim_tr": "Yalnız CO₂ bileşeni; tam CO₂e sonucu değildir.",
  "boundary": "combustion",
  "trace": [
    {"step": "validate_input", "ok": true},
    {"step": "unit_conversion", "from": "100 GJ", "to": "100 GJ", "ratio": "1", "source": "sabit tablo"},
    {"step": "factor_match", "factor_id": "TEST-NG-CO2", "factor_version": "1.0", "basis_check": "LHV=LHV"},
    {"step": "gas_calculation", "gas": "CO2", "formula": "100 × 50 = 5000 kg"},
    {"step": "gwp", "gas": "CO2", "applied": false, "reason": "CO2 için GWP 1; CO2e faktöre GWP uygulanmaz"},
    {"step": "result", "total_co2e_kg": "5000", "coverage": "co2_only"}
  ],
  "inputs_hash": "sha256:…"                          // kanonik JSON (sorted keys, ascii) üzerinden
}
```

### Kapsama (`coverage`) kuralları

* Yalnız `CO2` faktörü → `co2_only`; `claim_tr` tam CO₂e olmadığını söyler (T01).
* `CO2e` faktörü → `co2e_factor`; `gwp_applied=false`; GWP ikinci kez uygulanmaz (T02). `CO2e` faktörle birlikte gaz faktörü verilirse `FACTOR_MIX_CO2E_AND_GAS` ile bloke.
* `CO2 + CH4 + N2O` → `full_ghg`; `CO2` + yalnız biri → `partial_ghg`.
* Gaz faktörü var, `method.gwp_set` ilgili gazı içermiyor → `GWP_MISSING` (bloke).
* Farklı `boundary` değerine sahip faktörler tek istekte toplanmaz → `BOUNDARY_MIX` (yanma ile üst aşama ayrı sonuçlardır, §12).

### Durum kuralları

* Herhangi bir `block` → `status="blocked"`, `components=[]`, `total_co2e_kg=null`.
* `basis_conversion` kullanıldı veya `data_quality="estimated"` → `review_required` (hesap yapılır; onay öncesi inceleme zorunlu).
* Aksi hâlde `computed`. **`computed` onaylandı demek değildir** (§21); onay iş akışı katmanındadır.

### Hata kodları

| Kod | Ne zaman | Test |
| --- | --- | --- |
| `INVALID_NUMBER` | Sayı dize değil, parse edilemiyor, NaN/Inf | — |
| `NEGATIVE_QUANTITY` | Miktar < 0 (iade/düzeltme ayrı işlem türüdür, §11) | — |
| `UNIT_UNKNOWN` | Birim tabloda yok | T20 |
| `UNIT_INCOMPATIBLE` | Enerji↔kütle vb. | — |
| `UNIT_CONDITIONS_UNKNOWN` | `m3` → Nm3/Sm3, koşul yok | T03 |
| `CALORIFIC_VALUE_REQUIRED` | Hacim miktar, enerji paydalı faktör, ısıl değer yok | — |
| `BASIS_UNKNOWN` | Enerji esası bilinmiyor, faktör esaslı | T20 |
| `BASIS_MISMATCH` | HHV≠LHV, oran yok | T04 |
| `FACTOR_MISSING_SOURCE` | `source_ref` boş | §18 |
| `FACTOR_UNIT_MISSING` | pay/payda birimi yok | §18 |
| `FACTOR_DUPLICATE_GAS` | Aynı gaz iki faktörde | — |
| `FACTOR_MIX_CO2E_AND_GAS` | CO2e ile gaz faktörü birlikte | T02 |
| `GWP_MISSING` | Gaz için GWP yok | — |
| `BOUNDARY_MIX` | Farklı sınırlar tek sonuçta | §12 |
| `DIVISION_BY_ZERO` | Dönüşümde sıfır payda | §18 |
| `UNSUPPORTED_SOURCE_TYPE` | `stationary_combustion` dışı | §30 |

Her blok Türkçe, sade `message_tr` taşır; kullanıcıya "neden hesaplanmadı" bu metinle gösterilir.

## Altın set biçimi — `tests/golden/*.json`

```jsonc
{
  "id": "T01-co2-only",
  "title_tr": "100 GJ × 50 kg CO₂/GJ → yalnız CO₂ bileşeni 5 t",
  "requirements": ["T01", "§18"],
  "note_tr": "Katsayılar kurgusaldır; yalnız yazılım testi içindir.",
  "request": { … },
  "expected": {
    "status": "computed",
    "total_co2e_kg": "5000",
    "coverage": "co2_only",
    "block_codes": [],
    "components": [{"gas": "CO2", "mass_kg": "5000", "gwp_applied": false}]
  }
}
```

`expected` içindeki alanlar **alt küme eşleşmesi** ile karşılaştırılır (listelenen alanlar birebir eşit olmalı; listelenmeyenler kontrol edilmez). `koza_calc.golden.run_file(path)` ve `run_dir(dir)` yardımcıları hem pytest hem tarayıcı (Pyodide) tarafından kullanılır ve `{"passed": n, "failed": n, "results": [{"id", "ok", "diff"}]}` döner.

**Altın set uzman imzası bekliyor** (§29). Bu sürümdeki tüm faktörler kurgusaldır ve `license: "test-only"` taşır; üretim kataloğuna aktarılamaz (kural 12).
