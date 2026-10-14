# Hesap motoru sözleşmesi — `koza_calc` 0.2 (genişletme)

0.1 sözleşmesi (`CONTRACT.md`) **aynen geçerlidir**; bu belge onu genişletir. 0.1'deki tüm istek/yanıt alanları, hata kodları ve altın set davranışı korunur (geriye uyumluluk: 0.1 fixture'ları değişmeden geçmelidir).

`ENGINE_VERSION = "0.2.0"`. Yeni dışa aktarımlar: `calculate(request)`, `aggregate(request)`, `ENGINE_VERSION`, `SUPPORTED` (desteklenen kaynak türü × yöntem matrisi; §30 "her sürümde desteklenen kategori/yöntem matrisi yayımlanır").

Tüm sayılar yine ondalık **dize**; `float` yok; I/O yok; stdlib yalnız.

## 1. Kaynak türleri (`activity.source_type`)

| source_type | Kapsam/bağlam | Yöntem | Ek alanlar |
| --- | --- | --- | --- |
| `stationary_combustion` | Kapsam 1 | 0.1 ile aynı | — |
| `mobile_combustion` | Kapsam 1 | 0.1 ile aynı mantık (yakıt miktarı × faktör); `fuel ∈ {diesel, gasoline, lpg, natural_gas}`; birimler litre (`L`), kg, GJ, kWh | `vehicle_class` (bilgi) |
| `process` | Kapsam 1 | üretim miktarı (t) × proses faktörü (kg CO2/t); `process_id` zorunlu | — |
| `refrigerant` | Kapsam 1 | bkz. §3 | `refrigerant` |
| `purchased_electricity` / `purchased_steam` / `purchased_heat` / `purchased_cooling` | Kapsam 2 | bkz. §4 | `scope2` |
| `scope3` | Kapsam 3 kategori 1–15 | bkz. §5 | `scope3` |
| `product_process` | Ürün çalışması (§17) | bkz. §6 | `product` |

Desteklenmeyen tür → `UNSUPPORTED_SOURCE_TYPE` (0.1 ile aynı).

## 2. Birimler (ek)

| Aile | Birimler |
| --- | --- |
| Hacim-sıvı | `L` (litre), `m3_liquid` (=1000 L) — gaz hacmiyle karışmaz |
| Mesafe | `km` |
| Kütle-mesafe | `t.km` (ton-kilometre), `kg.km` |
| Para | `TRY`, `EUR`, `USD` — birbirine **dönüştürülmez**; faktör para birimiyle eşleşmezse `CURRENCY_MISMATCH` |
| Adet | `unit` |
| Yolcu-mesafe | `p.km` |

Yakıt kütle↔hacim dönüşümü yalnız istekte `density: {"value","unit":"kg/L","source_ref"}` verilirse; yoksa `UNIT_INCOMPATIBLE`.

## 3. Soğutucu (`refrigerant`) — T11

```jsonc
"refrigerant": {
  "gas": "R-134a" | "R-410A" | "unknown" | "<karışım kodu>",
  "charge_type": "new_equipment_fill" | "top_up" | "recovered" | "leak_measured" | "disposal",
  "equipment_in_inventory": true
}
```
Faktör: `gas` için GWP yöntemin `gwp_set`'inde veya faktörde (`gas: "R-134a"`, `value` = GWP, `numerator_unit: "kg"`, `denominator_unit: "kg"`, `boundary: "fugitive"`).

Kurallar (§12 kritik istisnalar):
- `new_equipment_fill` → emisyon **0 değil, "not_applicable"**: `status="computed"`, `components=[]`, `total_co2e_kg=null`, `coverage=null`, `value_state="not_applicable"`, `claim_tr="Yeni ekipman dolumu sızıntı değildir; emisyon sayılmaz."` (T11).
- `top_up` → eklenen miktar kaçak telafisi varsayımıyla emisyon = miktar × GWP; `warnings: REFRIGERANT_TOPUP_ASSUMPTION` ve `status="review_required"`.
- `leak_measured` → miktar × GWP, `computed`.
- `recovered` → negatif kütle hareketi; envantere emisyon yazılmaz (`not_applicable`, uyarı `RECOVERED_NOT_EMISSION`).
- `gas == "unknown"` → `REFRIGERANT_GAS_UNKNOWN` (bloke, "hesap bekler").
- Karışım gaz için GWP tanımı yoksa → `GWP_MISSING`.
- `equipment_in_inventory == false` → `EQUIPMENT_NOT_IN_INVENTORY` (bloke; Kapsam 1 ataması yapılmadan ilişki tekrar değerlendirilir).

## 4. Kapsam 2 — T05, T06

```jsonc
"scope2": {
  "method": "location_based" | "market_based" | "both",
  "grid_region": "TR",
  "instruments": [   // sözleşmesel araçlar (piyasa bazlı)
    {"id": "GO-2026-001", "type": "guarantee_of_origin" | "ppa" | "supplier_specific" | "residual_mix",
     "mwh": "60", "generation_period": {"start":"2026-01-01","end":"2026-12-31"}, "retired": true,
     "quality_criteria_met": true, "beneficiary": "org-…", "factor": {<faktör>} }
  ],
  "residual_mix_factor": {<faktör>} | null,
  "self_generation_mwh": "0", "sold_to_grid_mwh": "0"
}
```
Faktörler: `factors` listesinde `role: "location"` ve/veya `role: "market_residual"` alanı; `instruments[].factor` araç faktörü (ör. 0).

Çıktı: `results: {"location_based": {<0.1 sonucu>}, "market_based": {<0.1 sonucu> + "covered_mwh","uncovered_mwh","instrument_ids"}}` ve `total_co2e_kg = null` (iki yöntem toplanmaz; §13). `coverage` her sonuçta ayrı. `primary_method` istekten gelir (`scope2.method`, `both` ise `"location_based"` birincil olarak işaretlenir ama her ikisi döner; kurumsal toplamda hangisinin kullanıldığı manifestte yazılır).

Kurallar:
- `instruments` toplam MWh > tüketim → `INSTRUMENT_EXCEEDS_CONSUMPTION` (negatif emisyon yaratamaz; bloke).
- Kapsanmayan kısım `residual_mix_factor` ile; yoksa `location` faktörüyle ve `warnings: RESIDUAL_MIX_UNAVAILABLE` + `review_required` (T06: kalan 40 MWh hesap dışı bırakılamaz).
- `retired == false` veya `quality_criteria_met == false` → araç sayılmaz, `warnings: INSTRUMENT_NOT_ELIGIBLE`, ilgili MWh kapsanmayan sayılır.
- Aynı `instruments[].id` iki kez → `INSTRUMENT_DUPLICATE` (bloke).
- `sold_to_grid_mwh` brüt sonuçtan düşülmez; yalnız `trace`'te ayrı.

## 5. Kapsam 3 — T08, T09, T10, T12, MTH

```jsonc
"scope3": {
  "category": 1,            // 1–15
  "method": "supplier_specific" | "hybrid" | "average_data" | "spend_based" | "distance_based" | "fuel_based" | "waste_type_specific" | "lifetime_use" | "investment_specific",
  "applicability": "applicable" | "not_applicable" | "unknown",
  "not_applicable_reason": null,
  "data_quality_dims": {"technology":"1-5","geography":"1-5","time":"1-5","completeness":"1-5","reliability":"1-5"} | null,
  "spend": {"currency":"TRY","date":"2026-03-01","tax_treatment":"excl_vat","sector_class":"NACE C24","price_year":"2024","deflator":{"value":"1.0","source_ref":"…"} } | null,
  "sold_products": {"sale_year":"2026","lifetime_years":"10","annual_use_kwh":"120","units_sold":"1000","group_id":"grp-2026-A"} | null
}
```
Faktör `boundary`: `cradle_to_gate` | `gate_to_gate` | `cradle_to_grave` | `upstream` | `well_to_tank` | `tank_to_wheel` | `well_to_wheel` | `end_of_life`.

Kurallar:
- `applicability == "not_applicable"` → gerekçe zorunlu (`NA_REASON_REQUIRED`); sonuç `value_state="not_applicable"`, `total=null` (T10: sıfır yapılmaz).
- `applicability == "unknown"` veya miktar `null` → `value_state="unknown"`, `status="blocked"`, blok `DATA_MISSING` (T10: veri eksikliği uygulanamazlık değildir).
- Kategori 1'de `gate_to_gate` faktör → `warnings: UPSTREAM_MISSING`, `coverage="partial_boundary"`, `review_required` (T08).
- Faktör `cradle_to_grave` ise `scope3.category in {1,2}` → `LCA_FACTOR_IN_CATEGORY` (bloke): beşikten mezara toplam kategori 1'de kullanılmadan bileşenlere ayrıştırılmalı (§17). Faktörler listesinde `cradle_to_gate` + `upstream` birlikte → `BOUNDARY_OVERLAP` (T09).
- `spend_based`: faktör `denominator_unit` para birimi; `spend.currency` ile eşleşmeli (`CURRENCY_MISMATCH`); `deflator` varsa uygulanır ve izde kaynak yazılır; `warnings: SPEND_BASED_ESTIMATE` ve `status="review_required"` (tahmini).
- `lifetime_use` (kategori 11): toplam = `units_sold × annual_use × lifetime_years × faktör`; sonuç `attribution_year = sale_year` ve `group_id` taşır; aynı `group_id` için ikinci koşu **engel değildir** (motor durumsuz) ama yanıtta `lifetime_group: {"group_id","sale_year"}` döner; tekrar eklememe kontrolü depo/API tarafındadır (T12). `lifetime_years` veya `annual_use` yoksa `DEFAULT_SCENARIO_FORBIDDEN` (gizli varsayılan yok, §15).
- `method` kategori için izin verilen listede değilse `METHOD_NOT_ALLOWED` (matris `SUPPORTED` içinde).
- `data_quality_dims` verilirse birleşik puan hesaplanmaz; yalnız döndürülür (§16: bilimsel belirsizlik yüzdesi gibi sunulmaz).

## 6. Ürün çalışması — §17

```jsonc
"product": {
  "study_id": "ps-…", "boundary": "gate_to_gate" | "cradle_to_gate" | "cradle_to_grave" | "custom",
  "reference_flow": {"quantity":"1","unit":"kg"}, "functional_unit": "…" | null,
  "allocation": {"basis":"mass"|"energy"|"economic"|"none","share":"0.6","source_ref":"…"} | null
}
```
Sonuç `context="product"`; kurumsal toplama girmez (aggregate bunu ayırır). `coverage` yalnız karbon olduğu için `"carbon_only"`; `claim_tr` "kısmi ürün karbon ayak izi" / "ürün karbon ayak izi" (sınıra göre); tam LCA/EPD iddiası yok. `allocation` varsa sonuç `share` ile çarpılır ve izde görünür; `share` 0–1 dışında → `ALLOCATION_INVALID`.

## 7. Toplama — `aggregate(request)` (K-17)

```jsonc
{
  "results": [ {"record_id":"…","context":"corporate"|"product","scope":1|2|3,"category":null|1..15,
                "state":"approved"|"locked"|"draft"|…, "result": {<calculate çıktısı>},
                "scope2_method_used": "location_based"|"market_based"|null} ],
  "policy": {"include_states": ["approved","locked"], "scope2_method": "location_based"|"market_based"}
}
```
Çıktı:
```jsonc
{"engine_version":"0.2.0",
 "corporate": {"scope1_kg":"…","scope2_kg":"…","scope2_method":"location_based","scope3_kg":"…","scope3_by_category":{"1":"…"},
               "total_kg":"…","label_tr":"Hesaplanan envanter toplamı","excluded":[{"record_id","reason"}],
               "coverage_notes_tr":["…yalnız CO₂…"], "estimated_share_by_count":"0.25","estimated_share_by_kg":"0.1"},
 "product": {"<study_id>": {"total_kg":"…","claim_tr":"…"}},
 "biogenic_co2_kg": "…" | null,
 "not_applicable": [record_id…], "unknown": [record_id…]}
```
Kurallar: ürün sonuçları kurumsal toplama girmez (kural 8); Kapsam 2'de tek yöntem seçilir, diğer yöntem `scope2_alternative_kg` olarak ayrıca döner, **toplanmaz**; `include_states` dışı kayıtlar `excluded`; `value_state` unknown/not_applicable olanlar toplanmaz ve listelenir; tahmini pay hem kayıt sayısı hem kg ağırlıklı olarak ayrı verilir (§16). Toplama tam ondalıktır.

## 8. Yeni hata/uyarı kodları (hepsi `message_tr` ile)

Blok: `REFRIGERANT_GAS_UNKNOWN`, `EQUIPMENT_NOT_IN_INVENTORY`, `INSTRUMENT_EXCEEDS_CONSUMPTION`, `INSTRUMENT_DUPLICATE`, `CURRENCY_MISMATCH`, `NA_REASON_REQUIRED`, `DATA_MISSING`, `LCA_FACTOR_IN_CATEGORY`, `BOUNDARY_OVERLAP`, `METHOD_NOT_ALLOWED`, `DEFAULT_SCENARIO_FORBIDDEN`, `ALLOCATION_INVALID`, `PROCESS_ID_REQUIRED`, `DENSITY_REQUIRED`.
Uyarı: `REFRIGERANT_TOPUP_ASSUMPTION`, `RECOVERED_NOT_EMISSION`, `RESIDUAL_MIX_UNAVAILABLE`, `INSTRUMENT_NOT_ELIGIBLE`, `UPSTREAM_MISSING`, `SPEND_BASED_ESTIMATE`, `PARTIAL_BOUNDARY`.

## 9. `SUPPORTED` matrisi

`koza_calc.SUPPORTED` → `{"stationary_combustion": ["activity_x_factor"], "purchased_electricity": ["location_based","market_based"], "scope3": {"1": ["supplier_specific","hybrid","average_data","spend_based"], "2": [...], "3": ["average_data"], "4": ["distance_based","fuel_based","spend_based"], "5": ["waste_type_specific","average_data"], "6": ["distance_based","spend_based"], "7": ["distance_based","average_data"], "8": ["average_data"], "9": ["distance_based"], "10": ["average_data"], "11": ["lifetime_use"], "12": ["waste_type_specific"], "13": ["average_data"], "14": ["average_data"], "15": ["investment_specific"]}, "refrigerant": ["mass_balance"], "process": ["activity_x_factor"], "mobile_combustion": ["fuel_based"], "product_process": ["activity_x_factor"]}`. Arayüz bu matrisi gösterir; matris dışı yöntem `METHOD_NOT_ALLOWED`.

## 10. Altın set ekleri (`tests/golden/`)

En az: T05 (elektrik iki yöntem, toplanmaz), T06 (60/100 MWh belge, kalan residual), T06b (belge > tüketim bloke), T08 (kat.1 gate-to-gate uyarı), T09 (overlap bloke), T10 (veri yok → unknown, sıfır değil; NA gerekçesiz bloke), T11 (yeni dolum NA; top-up review), T12 (kat.11 lifetime hesabı + group), spend-based (kur eşleşmesi), mobile (litre × faktör), process, product (cradle_to_gate, allocation), aggregate (ürün hariç, Kapsam 2 tek yöntem, unknown listelenir). Mevcut 32 fixture değişmeden geçer.
