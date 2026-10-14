import { describe, expect, it } from "vitest";
import "./register";
import { evaluate, runEvaluation, sandbox, scenarios } from "./evalset";

describe("asistan değerlendirme seti (§24)", () => {
  const results = runEvaluation();
  it("en az 8 senaryo var", () => expect(results.length).toBeGreaterThanOrEqual(8));
  for (const r of results) {
    it(`${r.scenario.id} ${r.scenario.title}: beş ölçüt geçer`, () => {
      const failed = r.criteria.filter((c) => !c.pass).map((c) => `${c.key}: ${c.note}`);
      expect(failed, `${r.scenario.question}\n${r.answer.summary}`).toEqual([]);
    });
  }
  it("aynı girdi aynı sonucu verir (deterministik)", () => {
    const sb = sandbox();
    const sc = scenarios(sb);
    const a = JSON.stringify(sc.map((x) => evaluate(sb, x).answer));
    const b = JSON.stringify(sc.map((x) => evaluate(sb, x).answer));
    expect(a).toBe(b);
    expect(sc.map((s) => s.id)).toContain("E06");
  });
});
