// Test yardımcıları (vitest): taze depo + kurum + tesis + dönem + kaynaklar. Üretim koduna girmez.
import type { ActivityRecordVersion, SourceType } from "@/lib/domain";
import { resetAll, Store } from "@/lib/store";
import "./register";

export function fresh(): Store {
  resetAll();
  const s = new Store();
  s.switchUser("u-yonetici");
  s.createTenant({ name: "Test AŞ", country: "TR", nace_code: "C24", profile_id: "agir-sanayi", profile_version: "0.1.0" });
  s.confirmProfile("agir-sanayi", "0.1.0");
  return s;
}
export function base(s: Store) {
  const f = s.addFacility({ name: "Tesis", city: "Gebze", profile_id: null });
  const p = s.addPeriod({ start: "2026-01-01", end: "2026-12-31" });
  const src = (type: SourceType, name: string, fuel: string | null = null) => s.addSource({ facility_id: f.id, name, source_type: type, fuel, control: "owned", created_from: "manual" });
  return { f, p, src };
}
export type VersionInput = Omit<ActivityRecordVersion, "record_id" | "tenant_id" | "version" | "created_at" | "created_by">;
export function version(source_id: string, period_id: string, over: Partial<VersionInput> = {}): VersionInput {
  return {
    change_reason: null, source_id, period_id, period_start: "2026-01-01", period_end: "2026-01-31", quantity: "100", quantity_state: "known", unit: "GJ", heating_value_basis: "LHV",
    reference_conditions: null, calorific_value: null, basis_conversion: null, data_quality: "measured", invoice_no: null, supplier: null, evidence_ids: [], duplicate_override_reason: null, note: "", detail: null, ...over,
  };
}
export function fullVersion(s: Store, source_id: string, period_id: string, over: Partial<ActivityRecordVersion> = {}): ActivityRecordVersion {
  return { ...version(source_id, period_id), record_id: "act-test", tenant_id: s.tenantId, version: 1, created_at: "2026-02-01T00:00:00Z", created_by: "u-veri", ...over };
}
