import { describe, expect, it } from "vitest";
import { StoreError } from "@/lib/store";
import type { CalcResult } from "@/lib/domain";
import { sha256Hex } from "@/lib/hash";
import { detectDelimiter, normalizeDate, parseCsv, prepareRows, suggestMapping, targetsFor } from "./importer";
import { SCHEMA_BY_KEY } from "./schemas";
import { commitImport, importJobs, rollbackImport } from "./store";
import { base, fresh } from "./testutil";

const CSV = `Kaynak;Başlangıç;Bitiş;Miktar;Birim;Fatura No;Tedarikçi;Yakıt
Kazan;01.01.2026;31.01.2026;1.250,5;GJ;F-001;GazCo;natural_gas
Kazan;01.02.2026;28.02.2026;1.300;GJ;F-002;GazCo;natural_gas
Kazan;01.03.2026;31.03.2026;900;MJx;F-003;GazCo;natural_gas
Yok;01.04.2026;30.04.2026;100;GJ;F-004;GazCo;natural_gas
Kazan;01.05.2026;31.05.2026;;GJ;F-005;GazCo;natural_gas
`;
const RESULT: CalcResult = { engine_version: "0.2.0", method: { id: "m", version: "0.1" }, status: "computed", blocks: [], warnings: [], normalized_activity: null, components: [], total_co2e_kg: "1", coverage: "co2_only", claim_tr: "x", boundary: "combustion", trace: [], inputs_hash: "sha256:x" };

describe("CSV okuma", () => {
  it("ayraç tespiti, tırnak, BOM", () => {
    expect(detectDelimiter("a;b;c\n1;2;3")).toBe(";");
    const t = parseCsv('﻿a,b\n"x, y","1""2"\n');
    expect(t.headers).toEqual(["a", "b"]);
    expect(t.rows[0]).toEqual(["x, y", '1"2']);
  });
  it("tarih biçimleri", () => {
    expect(normalizeDate("01.02.2026")).toBe("2026-02-01");
    expect(normalizeDate("2026-2-1")).toBe("2026-02-01");
    expect(normalizeDate("Şubat")).toBeNull();
  });
  it("eşleme önerisi başlıklardan", () => {
    const t = parseCsv(CSV);
    const m = suggestMapping(t.headers, targetsFor(SCHEMA_BY_KEY.stationary_combustion));
    expect(m.source).toBe("Kaynak");
    expect(m.period_start).toBe("Başlangıç");
    expect(m.quantity).toBe("Miktar");
    expect(m.invoice_no).toBe("Fatura No");
    expect(m["detail:fuel"]).toBe("Yakıt");
  });
});

describe("içe aktarma: doğrulama, idempotentlik, geri alma", () => {
  const mapping = { source: "Kaynak", period_start: "Başlangıç", period_end: "Bitiş", quantity: "Miktar", unit: "Birim", invoice_no: "Fatura No", supplier: "Tedarikçi", "detail:fuel": "Yakıt" };
  it("satır hataları nedenli döner; başarılı satırlar taslak olur; miktarı boş satır 'bilinmiyor'", async () => {
    const s = fresh();
    const { p, src } = base(s);
    src("stationary_combustion", "Kazan", "natural_gas");
    const t = parseCsv(CSV);
    const prep = await prepareRows(s, SCHEMA_BY_KEY.stationary_combustion, t, mapping);
    expect(prep[0].error).toBeNull();
    expect(prep[1].error).toMatch(/belirsiz/);
    expect(prep[2].error).toMatch(/Birim 'MJx'/);
    expect(prep[3].error).toMatch(/Kaynak 'Yok'/);
    expect(prep[4].error).toBeNull();
    expect(prep[4].input?.version.quantity_state).toBe("unknown");
    const sha = await sha256Hex(CSV);
    const job = commitImport(s, { name: "ocak.csv", sha256: sha }, "stationary_combustion", mapping, prep);
    expect(job.ok_count).toBe(2);
    expect(job.error_count).toBe(3);
    expect(job.rows.filter((r) => r.status === "error").every((r) => r.reason)).toBe(true);
    const recs = s.records();
    expect(recs.length).toBe(2);
    expect(recs.every((r) => r.state === "draft" || r.state === "validation_required")).toBe(true);
    expect(s.current(recs[0].id).quantity).toBe("1250.5");
    expect(s.current(recs[0].id).period_id).toBe(p.id);
    expect(s.current(recs[0].id).detail?.fuel).toBe("natural_gas");
  });
  it("aynı dosya ikinci kez → IMPORT_DUPLICATE_FILE; aynı satır başka dosyada → atlanır (ikinci kayıt yok)", async () => {
    const s = fresh();
    const { src } = base(s);
    src("stationary_combustion", "Kazan", "natural_gas");
    const t = parseCsv(CSV);
    const sha = await sha256Hex(CSV);
    commitImport(s, { name: "a.csv", sha256: sha }, "stationary_combustion", mapping, await prepareRows(s, SCHEMA_BY_KEY.stationary_combustion, t, mapping));
    expect(s.records().length).toBe(2);
    expect(() => commitImport(s, { name: "a.csv", sha256: sha }, "stationary_combustion", mapping, [])).toThrowError(StoreError);
    try {
      commitImport(s, { name: "a.csv", sha256: sha }, "stationary_combustion", mapping, []);
    } catch (e) {
      expect((e as StoreError).code).toBe("IMPORT_DUPLICATE_FILE");
    }
    // Aynı satırlar + yeni bir satır içeren farklı dosya
    const CSV2 = CSV + "Kazan;01.06.2026;30.06.2026;700;GJ;F-006;GazCo;natural_gas\n";
    const prep2 = await prepareRows(s, SCHEMA_BY_KEY.stationary_combustion, parseCsv(CSV2), mapping);
    expect(prep2[0].existing_record_id).not.toBeNull();
    const job2 = commitImport(s, { name: "b.csv", sha256: await sha256Hex(CSV2) }, "stationary_combustion", mapping, prep2);
    expect(job2.skipped_count).toBe(2);
    expect(job2.ok_count).toBe(1);
    expect(s.records().length).toBe(3);
  });
  it("geri alma yalnız taslakları siler; onaylı kayıt korunur; geri alınan satırlar yeniden yüklenebilir", async () => {
    const s = fresh();
    const { src } = base(s);
    src("stationary_combustion", "Kazan", "natural_gas");
    const t = parseCsv(CSV);
    const sha = await sha256Hex(CSV);
    const job = commitImport(s, { name: "a.csv", sha256: sha }, "stationary_combustion", mapping, await prepareRows(s, SCHEMA_BY_KEY.stationary_combustion, t, mapping));
    const [r1, r2] = s.records();
    // r1 onaylanır (kanıt + hesap + inceleme + onay; görev ayrılığı için ayrı kullanıcı)
    s.db.evidence.push({ id: "evd-x", tenant_id: s.tenantId, file_name: "f.pdf", size_bytes: 1, sha256: "00", mime: "application/pdf", uploaded_at: "", uploaded_by: "u-yonetici", stored: false });
    s.updateRecord(r1.id, 1, { evidence_ids: ["evd-x"] }, "kanıt eklendi");
    s.saveRun(r1.id, RESULT, [{ id: "F", version: "1.0" }], { id: "m", version: "0.1" });
    s.submit(r1.id);
    s.switchUser("u-onay");
    s.decide(r1.id, "approved", "uygun");
    expect(s.record(r1.id).state).toBe("approved");
    s.switchUser("u-veri");
    expect(() => rollbackImport(s, job.id)).toThrow(/yetki/i);
    s.switchUser("u-yonetici");
    const res = rollbackImport(s, job.id);
    expect(res.deleted).toEqual([r2.id]);
    expect(res.kept).toEqual([{ record_id: r1.id, state: "approved" }]);
    expect(s.records().map((r) => r.id)).toEqual([r1.id]);
    expect(importJobs(s)[0].status).toBe("rolled_back");
    // geri alınan satır artık "var" sayılmaz; aynı dosya yeniden yüklenebilir
    const prep = await prepareRows(s, SCHEMA_BY_KEY.stationary_combustion, t, mapping);
    expect(prep[4].existing_record_id).toBeNull();
    expect(prep[0].error).toMatch(/Fatura no 'F-001' zaten kayıtlı/);
  });
});
