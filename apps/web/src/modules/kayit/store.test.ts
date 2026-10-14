import { describe, expect, it } from "vitest";
import { StoreError } from "@/lib/store";
import { PERMISSIONS } from "@/lib/domain";
import { explain } from "@/lib/errors";
import { assessCategory, categoryAssessments, createKayitRecord, lifetimeGroups, scope2MethodUsed, setScope2MethodUsed, setSourceMeta, sourceMeta } from "./store";
import { base, fresh, version } from "./testutil";

describe("kayıt modülü: yetki ve hata sözlüğü", () => {
  it("izinler kayıtlı", () => {
    expect(PERMISSIONS["kayit.import.run"]).toEqual(["data_entry", "data_owner", "admin"]);
    expect(PERMISSIONS["kayit.import.rollback"]).toEqual(["admin"]);
    expect(PERMISSIONS["kayit.category.assess"]).toEqual(["reviewer", "admin"]);
  });
  it("CONTRACT-v0.2 §8 kodları ve modül kodları Türkçe açıklamalı", () => {
    for (const c of ["REFRIGERANT_GAS_UNKNOWN", "EQUIPMENT_NOT_IN_INVENTORY", "INSTRUMENT_EXCEEDS_CONSUMPTION", "INSTRUMENT_DUPLICATE", "CURRENCY_MISMATCH", "NA_REASON_REQUIRED", "DATA_MISSING", "LCA_FACTOR_IN_CATEGORY", "BOUNDARY_OVERLAP", "METHOD_NOT_ALLOWED", "DEFAULT_SCENARIO_FORBIDDEN", "ALLOCATION_INVALID", "PROCESS_ID_REQUIRED", "DENSITY_REQUIRED", "REFRIGERANT_TOPUP_ASSUMPTION", "RECOVERED_NOT_EMISSION", "RESIDUAL_MIX_UNAVAILABLE", "INSTRUMENT_NOT_ELIGIBLE", "UPSTREAM_MISSING", "SPEND_BASED_ESTIMATE", "PARTIAL_BOUNDARY", "IMPORT_ROW_INVALID", "IMPORT_DUPLICATE_FILE", "OCR_UNAVAILABLE", "LIFETIME_GROUP_ALREADY_ACCOUNTED", "CATEGORY_NA_REASON_REQUIRED"]) {
      const e = explain(c);
      expect(e, c).toBeDefined();
      expect(e!.cause.length).toBeGreaterThan(5);
      expect(e!.action.length).toBeGreaterThan(5);
    }
  });
});

describe("kategori değerlendirmesi (T10)", () => {
  it("değerlendirilmemiş kategori 'bilinmiyor'dur; asla sıfır", () => {
    const s = fresh();
    const a = categoryAssessments(s);
    expect(Object.keys(a).length).toBe(15);
    for (let n = 1; n <= 15; n++) expect(a[n].state).toBe("unknown");
    expect(JSON.stringify(a)).not.toMatch(/"total"|"0"/);
  });
  it("uygulanamaz gerekçesiz reddedilir; gerekçeli kaydedilir; yetki uzman/yönetici", () => {
    const s = fresh();
    expect(() => assessCategory(s, 14, "not_applicable", "")).toThrowError(StoreError);
    try {
      assessCategory(s, 14, "not_applicable", " ");
    } catch (e) {
      expect((e as StoreError).code).toBe("CATEGORY_NA_REASON_REQUIRED");
    }
    assessCategory(s, 14, "not_applicable", "Franchise verilmiyor");
    expect(categoryAssessments(s)[14]).toMatchObject({ state: "not_applicable", reason: "Franchise verilmiyor" });
    s.switchUser("u-veri");
    expect(() => assessCategory(s, 1, "applicable", null)).toThrow(/yetki/i);
  });
});

describe("kayıt oluşturma (şema) ve T12", () => {
  it("kat. 11: aynı satış grubu sonraki yıl yeniden eklenemez", () => {
    const s = fresh();
    const { p, src } = base(s);
    const sales = src("scope3", "Satış");
    const detail = (year: string) => ({ scope3: { applicability: "applicable", method: "lifetime_use", sold_products: { sale_year: year, lifetime_years: "10", annual_use_kwh: "120", units_sold: "1000", group_id: "grp-A" } }, "scope3.data": {} , scope3_data_product: "x" });
    const r1 = createKayitRecord(s, { schema_key: "scope3:11", version: { ...version(sales.id, p.id, { unit: "unit", heating_value_basis: null, quantity: "1000" }) }, detail: { ...detail("2026"), scope3: { ...detail("2026").scope3, data: { product: "Isıtıcı X" } } } });
    expect(lifetimeGroups(s).map((g) => g.group_id)).toEqual(["grp-A"]);
    expect(() =>
      createKayitRecord(s, { schema_key: "scope3:11", version: { ...version(sales.id, p.id, { unit: "unit", heating_value_basis: null, quantity: "1200", period_start: "2027-01-01", period_end: "2027-12-31" }) }, detail: { scope3: { ...detail("2027").scope3, data: { product: "Isıtıcı X" } } } })
    ).toThrowError(/T12|yeniden/);
    try {
      createKayitRecord(s, { schema_key: "scope3:11", version: { ...version(sales.id, p.id, { unit: "unit", heating_value_basis: null, quantity: "1300" }) }, detail: { scope3: { ...detail("2027").scope3, data: { product: "Isıtıcı X" } } } });
    } catch (e) {
      expect((e as StoreError).code).toBe("LIFETIME_GROUP_ALREADY_ACCOUNTED");
    }
    expect(s.records().length).toBe(1);
    expect(s.records()[0].id).toBe(r1.id);
    // farklı grup serbest
    createKayitRecord(s, { schema_key: "scope3:11", version: { ...version(sales.id, p.id, { unit: "unit", heating_value_basis: null, quantity: "500" }) }, detail: { scope3: { ...detail("2027").scope3, sold_products: { ...detail("2027").scope3.sold_products, group_id: "grp-B" }, data: { product: "Isıtıcı Y" } } } });
    expect(s.records().length).toBe(2);
  });
  it("uygulanamaz gerekçesiz Kapsam 3 kaydı reddedilir; 'bilinmiyor' miktar sıfır olmaz", () => {
    const s = fresh();
    const { p, src } = base(s);
    const buy = src("scope3", "Satın alma");
    expect(() => createKayitRecord(s, { schema_key: "scope3:1", version: version(buy.id, p.id, { unit: "kg", heating_value_basis: null }), detail: { scope3: { applicability: "not_applicable", method: "average_data", data: { item: "çelik" } } } })).toThrow(/gerekçe|zorunlu/i);
    const r = createKayitRecord(s, { schema_key: "scope3:1", version: version(buy.id, p.id, { unit: "kg", heating_value_basis: null, quantity: null, quantity_state: "unknown" }), detail: { scope3: { applicability: "unknown", method: "average_data", data: { item: "çelik" } } } });
    const v = s.current(r.id);
    expect(v.quantity).toBeNull();
    expect(v.quantity_state).toBe("unknown");
    expect(v.detail?.schema_key).toBe("scope3:1");
    expect((v.detail?.scope3 as Record<string, unknown>).category).toBe(1);
    expect(s.record(r.id).state).toBe("validation_required");
  });
  it("zorunlu şema alanı eksikse SCHEMA_FIELD_REQUIRED; 'bilmiyorum' taslağı korur ve görev açar; tür uyuşmazlığı reddedilir", () => {
    const s = fresh();
    const { p, src } = base(s);
    const ref = src("refrigerant", "Klima");
    expect(() => createKayitRecord(s, { schema_key: "refrigerant", version: version(ref.id, p.id, { unit: "kg", heating_value_basis: null }), detail: { refrigerant: { gas: "R-134a" } } })).toThrow(/Zorunlu alan eksik/);
    const kazan = src("stationary_combustion", "Kazan", "natural_gas");
    const r = createKayitRecord(s, { schema_key: "stationary_combustion", version: version(kazan.id, p.id), detail: {}, unknown_fields: ["fuel"] });
    expect(s.current(r.id).detail?.fuel).toBeNull();
    expect(s.tasks().some((t) => t.related_record_id === r.id && t.kind === "missing_info" && /Yakıt/.test(t.title))).toBe(true);
    expect(() => createKayitRecord(s, { schema_key: "refrigerant", version: version(kazan.id, p.id, { unit: "kg" }), detail: { refrigerant: { gas: "R-134a", charge_type: "top_up", equipment_in_inventory: true } } })).toThrow(/uyuşmuyor/);
  });
  it("kaynak ek bilgisi ve Kapsam 2 yöntem seçimi kayıt bazında saklanır", () => {
    const s = fresh();
    const { p, src } = base(s);
    const el = src("purchased_electricity", "Şebeke");
    setSourceMeta(s, el.id, { grid_region: "TR" });
    expect(sourceMeta(s, el.id)?.grid_region).toBe("TR");
    const r = createKayitRecord(s, { schema_key: "purchased_electricity", version: version(el.id, p.id, { unit: "MWh", heating_value_basis: null }), detail: { scope2: { method: "both", grid_region: "TR", instruments: [] } } });
    expect(scope2MethodUsed(s, r.id)).toBeNull();
    setScope2MethodUsed(s, r.id, "market_based");
    expect(scope2MethodUsed(s, r.id)).toBe("market_based");
    expect(s.current(r.id).detail?.scope2_method_used).toBe("market_based"); // diğer modüller buradan okur
    expect(s.current(r.id).version).toBe(2); // yeni sürüm, gerekçeli
    expect((s.current(r.id).detail?.scope2 as Record<string, unknown>).method).toBe("both");
  });
});
