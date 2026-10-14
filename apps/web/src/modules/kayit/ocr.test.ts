import { describe, expect, it } from "vitest";
import { extractCandidates, LOW_CONFIDENCE, parseAssistantPayload, type OcrWord } from "./ocr";

const TEXT = `GAZDAŞ DOĞAL GAZ DAĞITIM A.Ş.
Fatura No: GD-2026-000123
Tüketim Dönemi: 01.01.2026 - 31.01.2026
Tüketim: 1.250 Sm3
Üst Isıl Değer: 9.155,5 kcal/m3
Toplam Tutar: 12.345,67 TL`;
const words: OcrWord[] = TEXT.split(/\s+/).map((t) => ({ text: t, confidence: t.includes("9.155,5") ? 40 : 92 }));

describe("OCR aday alanları (DAT-03)", () => {
  it("fatura no, dönem, miktar+birim, ısıl değer, tedarikçi çıkarılır; güven kelimelerden gelir", () => {
    const c = extractCandidates(TEXT, words);
    const by = Object.fromEntries(c.map((x) => [x.key, x]));
    expect(by.invoice_no.value).toBe("GD-2026-000123");
    expect(by.period_start.value).toBe("2026-01-01");
    expect(by.period_end.value).toBe("2026-01-31");
    expect(by.unit.value).toBe("Sm3");
    expect(by.quantity.raw).toMatch(/1\.250 Sm3/);
    expect(by.quantity.note).toMatch(/belirsiz/); // 1.250 → kullanıcı seçer
    expect(by.quantity.confidence).toBeLessThan(LOW_CONFIDENCE);
    expect(by.calorific_value.value).toBe("9155.5");
    expect(by.calorific_unit.value).toBe("kcal/m3");
    expect(by.calorific_value.confidence).toBeLessThan(LOW_CONFIDENCE); // düşük kelime güveni vurgulanır
    expect(by.invoice_no.confidence).toBeGreaterThanOrEqual(LOW_CONFIDENCE);
    expect(by.supplier.value).toMatch(/GAZDAŞ/);
  });
  it("kWh faturası: MWh/kWh birimi ve iki tarih yedeği", () => {
    const c = extractCandidates("ABC Elektrik Perakende A.Ş.\nFatura numarası 2026/77\n15.02.2026 tarihli\n14.03.2026 son ödeme\nAktif tüketim 48.250,00 kWh");
    const by = Object.fromEntries(c.map((x) => [x.key, x]));
    expect(by.unit.value).toBe("kWh");
    expect(by.quantity.value).toBe("48250");
    expect(by.period_start.value).toBe("2026-02-15");
    expect(by.period_end.note).toMatch(/doğrulayın/);
  });
  it("boş metin → aday yok (sessiz uydurma yok)", () => {
    expect(extractCandidates("")).toEqual([]);
  });
  it("asistan yükü (fields nesnesi) alan bazlı adaya dönüşür; boş ve bilinmeyen alanlar atlanır", () => {
    const c = parseAssistantPayload(JSON.stringify({ source: "asistan", at: "2026-10-14T09:00:00Z", fields: { invoice_no: "F-9", supplier: "GazCo", period_start: "2026-01-01", period_end: "2026-01-31", quantity: "1250.5", unit: "GJ", tutar: "99", note: "" } }));
    expect(c.map((x) => x.key)).toEqual(["invoice_no", "supplier", "period_start", "period_end", "quantity", "unit"]);
    expect(c[0].note).toMatch(/Asistan önerisi/);
    expect(c.every((x) => x.confidence === 0.5)).toBe(true);
  });
});
