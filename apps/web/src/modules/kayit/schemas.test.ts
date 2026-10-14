import { describe, expect, it } from "vitest";
import { SCOPE3_CATEGORIES } from "@/lib/domain";
import { parseQuantity } from "@/lib/quantity";
import { buildRequest, defaultFactorSelection, factorOptions, SCHEMAS, SCHEMA_BY_KEY, SUPPORTED_METHODS, unitFamily, validateDetail, type CatalogFactor } from "./schemas";
import { base, fresh, fullVersion } from "./testutil";

const METHOD = { id: "ghgp-corporate-test", version: "0.1", gwp_set: { id: "TEST-GWP", CH4: "28", N2O: "265" } };
const factor = (over: Partial<CatalogFactor>): CatalogFactor => ({
  id: "F", version: "1.0", title_tr: "t", fuel: "", value: "1", numerator_unit: "kg", gas: "CO2e", denominator_unit: "GJ", basis: "LHV", reference_conditions: null, boundary: "combustion", gwp_set_id: "TEST-GWP",
  source_ref: "test", license: "test-only", valid_from: "2026-01-01", valid_to: null, status: "test", reviewed_by: null, ...over,
});

// CONTRACT-v0.2 §9 — birebir
const CONTRACT_SUPPORTED = {
  stationary_combustion: ["activity_x_factor"], purchased_electricity: ["location_based", "market_based"],
  scope3: { "1": ["supplier_specific", "hybrid", "average_data", "spend_based"], "2": ["supplier_specific", "hybrid", "average_data", "spend_based"], "3": ["average_data"], "4": ["distance_based", "fuel_based", "spend_based"], "5": ["waste_type_specific", "average_data"], "6": ["distance_based", "spend_based"], "7": ["distance_based", "average_data"], "8": ["average_data"], "9": ["distance_based"], "10": ["average_data"], "11": ["lifetime_use"], "12": ["waste_type_specific"], "13": ["average_data"], "14": ["average_data"], "15": ["investment_specific"] },
  refrigerant: ["mass_balance"], process: ["activity_x_factor"], mobile_combustion: ["fuel_based"], product_process: ["activity_x_factor"],
};

describe("şema verisi", () => {
  it("15 Kapsam 3 kategorisinin her biri için şema vardır; hiçbiri silinmez", () => {
    for (const c of SCOPE3_CATEGORIES) expect(SCHEMA_BY_KEY[`scope3:${c.n}`]?.category).toBe(c.n);
  });
  it("izinli yöntemler CONTRACT-v0.2 SUPPORTED ile aynı", () => {
    for (const [k, v] of Object.entries(CONTRACT_SUPPORTED)) expect(SUPPORTED_METHODS[k]).toEqual(v);
    for (const s of SCHEMAS) {
      const allowed = s.scope === 3 ? CONTRACT_SUPPORTED.scope3[String(s.category) as keyof typeof CONTRACT_SUPPORTED.scope3] : (CONTRACT_SUPPORTED as Record<string, unknown>)[s.engine_source_type] ?? ["location_based", "market_based"];
      expect(s.methods).toEqual(allowed);
    }
  });
  it("her şemada 'neden bu kapsam', birim, kanıt ve kontrol metni var", () => {
    for (const s of SCHEMAS) {
      expect(s.why_scope.length).toBeGreaterThan(10);
      expect(s.units.length).toBeGreaterThan(0);
      expect(s.evidence.length).toBeGreaterThan(0);
      expect(s.controls.length).toBeGreaterThan(0);
    }
  });
  it("Kapsam 3 kalite boyutları beş ayrı alandır (birleşik puan yok)", () => {
    const dq = SCHEMA_BY_KEY["scope3:1"].fields.filter((f) => f.key.startsWith("scope3.data_quality_dims."));
    expect(dq.map((f) => f.key.split(".").pop())).toEqual(["technology", "geography", "time", "completeness", "reliability"]);
  });
  it("kategori 11 ömür alanları: satış yılı, ömür, yıllık kullanım, adet, grup kimliği", () => {
    const keys = SCHEMA_BY_KEY["scope3:11"].fields.map((f) => f.key);
    for (const k of ["sale_year", "lifetime_years", "annual_use_kwh", "units_sold", "group_id"]) expect(keys).toContain(`scope3.sold_products.${k}`);
  });
  it("miktar okuma yeniden kullanılır (§11) ve birim aileleri sözleşmeyle uyumlu", () => {
    expect(parseQuantity("1.234", null).ambiguous).toBe(true);
    expect(parseQuantity("1.234,5", null).value).toBe("1234.5");
    expect(unitFamily("Sm3")).toBe("volume_gas");
    expect(unitFamily("t.km")).toBe("mass_distance");
    expect(unitFamily("TRY")).toBe("money");
    expect(unitFamily("bilinmiyor")).toBeNull();
  });
  it("validateDetail: zorunlu eksik → missing; 'bilmiyorum' izinli alan → unknown", () => {
    const sc = SCHEMA_BY_KEY.refrigerant;
    const r = validateDetail(sc, { refrigerant: { gas: "R-134a" } });
    expect(r.missing.map((m) => m.key)).toContain("refrigerant.charge_type");
    const u = validateDetail(SCHEMA_BY_KEY.stationary_combustion, { fuel: null }, ["fuel"]);
    expect(u.unknown.map((m) => m.key)).toEqual(["fuel"]);
    expect(u.missing).toEqual([]);
  });
});

describe("istek kurucu (CONTRACT-v0.2)", () => {
  it("sabit yakma: 0.1 şekli, ek nesne yok", () => {
    const s = fresh();
    const { p, src } = base(s);
    const source = src("stationary_combustion", "Kazan", "natural_gas");
    const v = fullVersion(s, source.id, p.id, { detail: { schema_key: "stationary_combustion" } });
    const req = buildRequest({ record_id: "act-1", version: v, source, factors: [factor({ id: "TEST-NG-CO2", gas: "CO2", fuel: "natural_gas" })], method: METHOD });
    expect(req.activity.source_type).toBe("stationary_combustion");
    expect(req.activity.fuel).toBe("natural_gas");
    expect(req.activity.quantity).toBe("100");
    expect(req.activity.unit).toBe("GJ");
    expect(req.activity.period).toEqual({ start: "2026-01-01", end: "2026-01-31" });
    expect(req.factors[0]).toMatchObject({ id: "TEST-NG-CO2", version: "1.0", value: "1", gas: "CO2", denominator_unit: "GJ", source_ref: "test" });
    expect(req.method).toEqual(METHOD);
    expect(req.activity.scope2).toBeUndefined();
    expect(req.activity.scope3).toBeUndefined();
    expect(req.activity.refrigerant).toBeUndefined();
  });
  it("miktar bilinmiyor → quantity null (sıfır değil)", () => {
    const s = fresh();
    const { p, src } = base(s);
    const source = src("stationary_combustion", "Kazan", "natural_gas");
    const v = fullVersion(s, source.id, p.id, { quantity: null, quantity_state: "unknown" });
    const req = buildRequest({ record_id: "a", version: v, source, factors: [], method: METHOD });
    expect(req.activity.quantity).toBeNull();
    expect(req.activity.unit).toBe("GJ");
  });
  it("mobil yakma: yakıt, litre, araç sınıfı, yoğunluk", () => {
    const s = fresh();
    const { p, src } = base(s);
    const source = src("mobile_combustion", "Forklift", "diesel");
    const v = fullVersion(s, source.id, p.id, { unit: "L", heating_value_basis: null, detail: { schema_key: "mobile_combustion", fuel: "diesel", vehicle_class: "forklift", density: { value: "0.84", source_ref: "ürün föyü" } } });
    const req = buildRequest({ record_id: "a", version: v, source, factors: [factor({ fuel: "diesel", denominator_unit: "L" })], method: METHOD });
    expect(req.activity.source_type).toBe("mobile_combustion");
    expect(req.activity.fuel).toBe("diesel");
    expect(req.activity.unit).toBe("L");
    expect(req.activity.vehicle_class).toBe("forklift");
    expect(req.activity.density).toEqual({ value: "0.84", unit: "kg/L", source_ref: "ürün föyü" });
  });
  it("proses: process_id taşınır", () => {
    const s = fresh();
    const { p, src } = base(s);
    const source = src("process", "Klinker");
    const v = fullVersion(s, source.id, p.id, { unit: "t", heating_value_basis: null, detail: { schema_key: "process", process_id: "klinker" } });
    const req = buildRequest({ record_id: "a", version: v, source, factors: [], method: METHOD });
    expect(req.activity.process_id).toBe("klinker");
  });
  it("soğutucu: gaz, işlem türü, envanter bayrağı; 'other' kodu kullanılır", () => {
    const s = fresh();
    const { p, src } = base(s);
    const source = src("refrigerant", "Klima");
    const v = fullVersion(s, source.id, p.id, { unit: "kg", heating_value_basis: null, quantity: "2", detail: { schema_key: "refrigerant", refrigerant: { gas: "other", gas_other: "R-507A", charge_type: "new_equipment_fill", equipment_in_inventory: true } } });
    const req = buildRequest({ record_id: "a", version: v, source, factors: [factor({ gas: "R-507A", denominator_unit: "kg", boundary: "fugitive" })], method: METHOD });
    expect(req.activity.refrigerant).toEqual({ gas: "R-507A", charge_type: "new_equipment_fill", equipment_in_inventory: true });
    expect(req.activity.source_type).toBe("refrigerant");
  });
  it("Kapsam 2 (T05/T06 altın biçimi): activity.scope2, araç faktörü, factors[] yalnız konum rolü, artık karışım residual_mix_factor", () => {
    const s = fresh();
    const { p, src } = base(s);
    const source = src("purchased_electricity", "Şebeke");
    const v = fullVersion(s, source.id, p.id, {
      unit: "MWh", heating_value_basis: null,
      detail: { schema_key: "purchased_electricity", scope2: { method: "both", grid_region: "TR", instruments: [{ id: "GO-1", type: "guarantee_of_origin", mwh: "60", generation_period: { start: "2026-01-01", end: "2026-12-31" }, retired: true, quality_criteria_met: true, beneficiary: "org-1", serial: "S-9" }], self_generation_mwh: "0", sold_to_grid_mwh: "5" } },
    });
    const loc = factor({ id: "GRID-TR", source_type: "purchased_electricity", role: "location", denominator_unit: "kWh", basis: null });
    const res = factor({ id: "RES-TR", source_type: "purchased_electricity", role: "market_residual", denominator_unit: "kWh", basis: null });
    const other = factor({ id: "X", source_type: "purchased_electricity", role: null, denominator_unit: "MWh", basis: null });
    const req = buildRequest({ record_id: "a", version: v, source, factors: [loc, res, other], method: METHOD });
    const s2 = req.activity.scope2!;
    expect(s2.method).toBe("both");
    expect(s2.grid_region).toBe("TR");
    const inst = (s2.instruments as Record<string, unknown>[])[0];
    expect(inst.id).toBe("GO-1");
    expect(inst.mwh).toBe("60");
    expect(inst.generation_period).toEqual({ start: "2026-01-01", end: "2026-12-31" });
    expect(inst.retired).toBe(true);
    const instFactor = inst.factor as Record<string, unknown>;
    expect(instFactor.value).toBe("0");
    expect(instFactor.denominator_unit).toBe("kWh");
    expect(instFactor.boundary).toBe("combustion");
    expect(typeof instFactor.source_ref).toBe("string");
    expect((s2.residual_mix_factor as Record<string, unknown>).id).toBe("RES-TR");
    expect((s2.residual_mix_factor as Record<string, unknown>).role).toBe("market_residual");
    expect(s2.sold_to_grid_mwh).toBe("5");
    expect(s2.self_generation_mwh).toBe("0");
    expect(req.factors.map((f) => f.id)).toEqual(["GRID-TR"]);
    expect(req.factors[0].role).toBe("location");
    expect((req as unknown as Record<string, unknown>).scope2).toBeUndefined();
  });
  it("Kapsam 3 kat. 1 harcama bazlı: spend alanları, para birimi, beş kalite boyutu, uygulanabilirlik", () => {
    const s = fresh();
    const { p, src } = base(s);
    const source = src("scope3", "Satın alma");
    const v = fullVersion(s, source.id, p.id, {
      unit: "TRY", heating_value_basis: null, quantity: "250000",
      detail: { schema_key: "scope3:1", scope3: { category: 1, applicability: "applicable", method: "spend_based", spend: { currency: "TRY", date: "2026-03-01", tax_treatment: "excl_vat", sector_class: "NACE C24", price_year: "2024", deflator: { value: "1.0", source_ref: "TÜİK" } }, data_quality_dims: { technology: "3", geography: "2", time: "2", completeness: "4", reliability: "3" } } },
    });
    const req = buildRequest({ record_id: "a", version: v, source, factors: [factor({ source_type: "scope3", category: 1, denominator_unit: "TRY", basis: null, boundary: "cradle_to_gate" })], method: METHOD });
    expect(req.activity.source_type).toBe("scope3");
    expect(req.activity.scope3).toMatchObject({ category: 1, method: "spend_based", applicability: "applicable", not_applicable_reason: null });
    expect(req.activity.unit).toBe("TRY");
    expect(req.activity.scope3?.spend).toEqual({ currency: "TRY", date: "2026-03-01", tax_treatment: "excl_vat", sector_class: "NACE C24", price_year: "2024", deflator: { value: "1.0", source_ref: "TÜİK" } });
    expect(req.activity.scope3?.data_quality_dims).toEqual({ technology: "3", geography: "2", time: "2", completeness: "4", reliability: "3" });
    expect(req.activity.scope3?.sold_products).toBeNull();
  });
  it("Kapsam 3 kat. 11: sold_products ve group_id; uygulanabilirlik bilinmiyor → unknown", () => {
    const s = fresh();
    const { p, src } = base(s);
    const source = src("scope3", "Satış");
    const v = fullVersion(s, source.id, p.id, { unit: "unit", heating_value_basis: null, quantity: "1000", detail: { schema_key: "scope3:11", scope3: { category: 11, applicability: "unknown", method: "lifetime_use", sold_products: { sale_year: "2026", lifetime_years: "10", annual_use_kwh: "120", units_sold: "1000", group_id: "grp-2026-A" } } } });
    const req = buildRequest({ record_id: "a", version: v, source, factors: [], method: METHOD });
    expect(req.activity.scope3?.sold_products).toEqual({ sale_year: "2026", lifetime_years: "10", annual_use_kwh: "120", units_sold: "1000", group_id: "grp-2026-A" });
    expect(req.activity.scope3?.applicability).toBe("unknown");
    expect(req.activity.scope3?.method).toBe("lifetime_use");
    expect(typeof req.activity.scope3?.category).toBe("number");
  });
  it("eski purchased_goods kaynağı kategori 1 olarak işlenir", () => {
    const s = fresh();
    const { p, src } = base(s);
    const source = src("purchased_goods", "Mal");
    const v = fullVersion(s, source.id, p.id, { unit: "kg", heating_value_basis: null, detail: null });
    const req = buildRequest({ record_id: "a", version: v, source, factors: [], method: METHOD });
    expect(req.activity.source_type).toBe("scope3");
    expect(req.activity.scope3?.category).toBe(1);
  });
  it("ürün çalışması: product nesnesi ve tahsis", () => {
    const s = fresh();
    const { p, src } = base(s);
    const source = src("product_process", "Hat 1");
    const v = fullVersion(s, source.id, p.id, { unit: "kg", heating_value_basis: null, detail: { schema_key: "product_process", product: { study_id: "ps-1", boundary: "cradle_to_gate", reference_flow: { quantity: "1", unit: "kg" }, functional_unit: null, allocation: { basis: "mass", share: "0.6", source_ref: "reçete" } } } });
    const req = buildRequest({ record_id: "a", version: v, source, factors: [], method: METHOD });
    expect(req.activity.product).toEqual({ study_id: "ps-1", boundary: "cradle_to_gate", reference_flow: { quantity: "1", unit: "kg" }, functional_unit: null, allocation: { basis: "mass", share: "0.6", source_ref: "reçete" } });
  });
});

describe("faktör süzme", () => {
  it("proses: 'process' sınırlı faktör varsayılan seçilir; Kapsam 3 kat. 1'de ömür sonu faktörü süzülür, kat. 5'te kalır", () => {
    const s = fresh();
    const { p, src } = base(s);
    const proc = src("process", "Klinker");
    const pv = fullVersion(s, proc.id, p.id, { unit: "t", heating_value_basis: null, detail: { schema_key: "process", process_id: "clinker" } });
    const pc: CatalogFactor[] = [factor({ id: "CLINKER", source_type: "process", gas: "CO2", denominator_unit: "t", basis: null, boundary: "process" })];
    const popts = factorOptions(SCHEMA_BY_KEY.process, proc, pv, pc, () => "1.0");
    expect(defaultFactorSelection(SCHEMA_BY_KEY.process, popts).map((f) => f.id)).toEqual(["CLINKER"]);
    const buy = src("scope3", "Satın alma");
    const c3: CatalogFactor[] = [
      factor({ id: "STEEL-C2G", source_type: "scope3", denominator_unit: "kg", basis: null, boundary: "cradle_to_gate" }),
      factor({ id: "STEEL-G2G", source_type: "scope3", denominator_unit: "kg", basis: null, boundary: "gate_to_gate" }),
      factor({ id: "EOL", source_type: "scope3", denominator_unit: "kg", basis: null, boundary: "end_of_life" }),
      factor({ id: "LCA", source_type: "scope3", denominator_unit: "kg", basis: null, boundary: "cradle_to_grave" }),
    ];
    const v1 = fullVersion(s, buy.id, p.id, { unit: "kg", heating_value_basis: null, detail: { schema_key: "scope3:1", scope3: { category: 1 } } });
    expect(factorOptions(SCHEMA_BY_KEY["scope3:1"], buy, v1, c3, () => "1.0").map((f) => f.id)).toEqual(["STEEL-C2G", "STEEL-G2G"]);
    const v5 = fullVersion(s, buy.id, p.id, { unit: "kg", heating_value_basis: null, detail: { schema_key: "scope3:5", scope3: { category: 5 } } });
    expect(factorOptions(SCHEMA_BY_KEY["scope3:5"], buy, v5, c3, () => "1.0").map((f) => f.id)).toEqual(["EOL"]);
  });
  it("yayımlı sürüm, birim ailesi ve kaynak türüne göre süzer; Kapsam 2'de varsayılan konum+artık", () => {
    const s = fresh();
    const { p, src } = base(s);
    const source = src("purchased_electricity", "Şebeke");
    const v = fullVersion(s, source.id, p.id, { unit: "MWh", heating_value_basis: null, detail: { schema_key: "purchased_electricity", scope2: { method: "location_based", grid_region: "TR" } } });
    const catalog: CatalogFactor[] = [
      factor({ id: "GRID-TR", version: "1.0", source_type: "purchased_electricity", role: "location", denominator_unit: "MWh", basis: null }),
      factor({ id: "GRID-TR", version: "0.9", source_type: "purchased_electricity", role: "location", denominator_unit: "MWh", basis: null }),
      factor({ id: "RES-TR", source_type: "purchased_electricity", role: "market_residual", denominator_unit: "MWh", basis: null }),
      factor({ id: "WRONG-UNIT", source_type: "purchased_electricity", role: "location", denominator_unit: "kg", basis: null }),
      factor({ id: "NG", fuel: "natural_gas", gas: "CO2" }),
    ];
    const pub = (id: string) => ({ "GRID-TR": "1.0", "RES-TR": "1.0", "WRONG-UNIT": "1.0", NG: "1.0" })[id];
    const opts = factorOptions(SCHEMA_BY_KEY.purchased_electricity, source, v, catalog, pub);
    expect(opts.map((f) => `${f.id}@${f.version}`)).toEqual(["GRID-TR@1.0", "RES-TR@1.0"]);
    expect(defaultFactorSelection(SCHEMA_BY_KEY.purchased_electricity, opts).map((f) => f.id)).toEqual(["GRID-TR", "RES-TR"]);
  });
  it("0.1 kataloğu (source_type yok): yakıt eşleşen yanma faktörleri; soğutucu gaz eşleşmesi", () => {
    const s = fresh();
    const { p, src } = base(s);
    const ng = src("stationary_combustion", "Kazan", "natural_gas");
    const v = fullVersion(s, ng.id, p.id, { detail: { schema_key: "stationary_combustion", fuel: "natural_gas" } });
    const catalog: CatalogFactor[] = [factor({ id: "NG-CO2", fuel: "natural_gas", gas: "CO2" }), factor({ id: "NG-UP", fuel: "natural_gas", boundary: "upstream" }), factor({ id: "D", fuel: "diesel", gas: "CO2" })];
    const pub = () => "1.0";
    expect(factorOptions(SCHEMA_BY_KEY.stationary_combustion, ng, v, catalog, pub).map((f) => f.id)).toEqual(["NG-CO2"]);
    const ref = src("refrigerant", "Klima");
    const rv = fullVersion(s, ref.id, p.id, { unit: "kg", heating_value_basis: null, detail: { schema_key: "refrigerant", refrigerant: { gas: "R-134a" } } });
    const rc: CatalogFactor[] = [factor({ id: "GWP-134a", source_type: "refrigerant", gas: "R-134a", denominator_unit: "kg", basis: null, boundary: "fugitive" }), factor({ id: "GWP-410A", source_type: "refrigerant", gas: "R-410A", denominator_unit: "kg", basis: null, boundary: "fugitive" })];
    expect(factorOptions(SCHEMA_BY_KEY.refrigerant, ref, rv, rc, pub).map((f) => f.id)).toEqual(["GWP-134a"]);
  });
});
