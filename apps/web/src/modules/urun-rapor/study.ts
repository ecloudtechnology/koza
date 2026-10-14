// Ürün çalışması (§17, REG-03, T08, T09): saf fonksiyonlar. Hesap yalnız motorda (calculate / aggregate).
// Ürün sonucu kurumsal envantere GİRMEZ (kural 8); bu dosya yalnız ürün bağlamını kurar.
import type { AggregateResult } from "@/lib/calc";
import { TEST_CATALOG, type TestFactor } from "@/lib/content";
import type { CalcResult, FactorRef } from "@/lib/domain";
import { Store, StoreError } from "@/lib/store";
import { MODULE, type AggregateRequest, type BoundaryExplanation, type LineResult, type ProcessKind, type ProcessLine, type Study, type StudyBoundary, type StudyInput, type StudyResult } from "./types";

export type { StudyInput } from "./types";

export const STUDIES = "studies";
export const STUDY_RESULTS = "study_results";

// §17 sınır soruları tablosu: kullanıcıya sorulan sade soru → teknik sınır → gerekli açıklama
export const BOUNDARY_QUESTIONS: { boundary: StudyBoundary; question: string; technical: string; explanation: string; required: (keyof BoundaryExplanation)[] }[] = [
  { boundary: "gate_to_gate", question: "Yalnız belirli üretim işlemlerini mi inceleyeceksin?", technical: "Kapıdan kapıya", explanation: "Başlangıç ve bitiş prosesi", required: ["start_process", "end_process"] },
  { boundary: "cradle_to_gate", question: "Ham maddeden tesis çıkışına kadar mı?", technical: "Beşikten kapıya", explanation: "Hangi tesisin çıkışı ve üst aşamalar", required: ["facility_exit", "upstream_note"] },
  { boundary: "cradle_to_grave", question: "Kullanım ve ömür sonu da dahil mi?", technical: "Beşikten mezara", explanation: "Dağıtım, kullanım ve ömür sonu senaryoları", required: ["distribution_scenario", "use_scenario", "eol_scenario"] },
  { boundary: "custom", question: "Müşterinin talebine göre farklı bir bölüm mü?", technical: "Özel kısmi sınır", explanation: "Dahil/hariç tüm süreçler ve gerekçe", required: ["included", "excluded", "rationale"] },
];

export const EXPLANATION_LABEL: Record<keyof BoundaryExplanation, string> = {
  start_process: "Başlangıç prosesi",
  end_process: "Bitiş prosesi",
  facility_exit: "Hangi tesisin çıkışı",
  upstream_note: "Üst aşamalar (ham madde, tedarikçi verisi)",
  distribution_scenario: "Dağıtım senaryosu",
  use_scenario: "Kullanım senaryosu",
  eol_scenario: "Ömür sonu senaryosu",
  included: "Dahil süreçler",
  excluded: "Hariç süreçler",
  rationale: "Gerekçe",
};

// "Beşikten beşiğe" neden sunulmuyor (§17): otomatik geri dönüşüm kredisi veya hesap kısayolu değildir.
export const CRADLE_TO_CRADLE_NOTE_TR =
  "“Beşikten beşiğe” bir sınır seçeneği olarak sunulmaz: otomatik geri dönüşüm kredisi ya da standart bir hesap kısayolu değildir. Döngüsel senaryo kurmak istiyorsanız özel kısmi sınır seçip ömür sonu ve ortak ürün satırlarını açıkça tanımlayın; tahsis ve geri dönüşüm yöntemi kaynağıyla yazılır, brüt sonuçtan otomatik düşüm yapılmaz.";

export const PROCESS_KIND_LABEL: Record<ProcessKind, string> = {
  material: "Malzeme listesi (ham madde / girdi)",
  route: "Üretim rotası (proses adımı)",
  scrap: "Fire ve hurda",
  packaging: "Ambalaj",
  energy: "Enerji tahsisi (elektrik, yakıt, buhar)",
  transport: "Sevkiyat / taşıma",
  use: "Kullanım aşaması",
  eol: "Ömür sonu",
  coproduct: "Ortak ürün (tahsis gerekir)",
};

// Sınır → sonuç etiketi. Yalnız karbon hesaplandığı için hiçbir sınırda "LCA" veya "EPD" denmez (§17 kabul koşulu).
export function boundaryLabel(b: StudyBoundary): string {
  switch (b) {
    case "cradle_to_grave":
      return "ürün karbon ayak izi (beşikten mezara)";
    case "cradle_to_gate":
      return "kısmi ürün karbon ayak izi (beşikten kapıya)";
    case "gate_to_gate":
      return "kısmi ürün karbon ayak izi (kapıdan kapıya)";
    case "custom":
      return "kısmi ürün karbon ayak izi (özel kısmi sınır)";
  }
}

export function boundaryTitle(b: StudyBoundary): string {
  return BOUNDARY_QUESTIONS.find((q) => q.boundary === b)?.technical ?? b;
}

export function emptyExplanation(): BoundaryExplanation {
  return { start_process: "", end_process: "", facility_exit: "", upstream_note: "", distribution_scenario: "", use_scenario: "", eol_scenario: "", included: "", excluded: "", rationale: "" };
}

export function missingExplanation(b: StudyBoundary, e: BoundaryExplanation): (keyof BoundaryExplanation)[] {
  const q = BOUNDARY_QUESTIONS.find((x) => x.boundary === b)!;
  return q.required.filter((k) => !e[k] || !e[k].trim());
}

function validateStudy(input: StudyInput): void {
  if (!input.product_name.trim()) throw new StoreError("VALIDATION", "Ürün adı zorunlu.", 422);
  if (!input.product_version.trim()) throw new StoreError("VALIDATION", "Ürün sürümü zorunlu (ör. 2026-A). Her sürüm ayrı çalışmadır.", 422);
  if (!input.reference_flow.quantity.trim() || !/^\d+(\.\d+)?$/.test(input.reference_flow.quantity)) throw new StoreError("VALIDATION", "Referans akış miktarı pozitif ondalık olmalı (ör. 1 veya 0.5).", 422);
  if (!input.reference_flow.unit.trim()) throw new StoreError("VALIDATION", "Referans akış birimi zorunlu (ör. kg, adet, m²).", 422);
  if (!(input.period.start < input.period.end)) throw new StoreError("VALIDATION", "Çalışma dönemi bitişi başlangıçtan sonra olmalı.", 422);
  const missing = missingExplanation(input.boundary, input.boundary_explanation);
  if (missing.length) throw new StoreError("STUDY_BOUNDARY_INCOMPLETE", `Seçilen sınır için eksik açıklama: ${missing.map((k) => EXPLANATION_LABEL[k]).join(", ")}.`, 422, { missing });
}

export function studies(s: Store): Study[] {
  return s.rows<Study>(MODULE, STUDIES);
}
export function study(s: Store, id: string): Study {
  return s.row<Study>(MODULE, STUDIES, id);
}

export function createStudy(s: Store, input: StudyInput): Study {
  s.require("urun-rapor.study.write");
  validateStudy(input);
  return s.insert<Study>(MODULE, STUDIES, { ...input, processes: input.processes ?? [] }, "urun-rapor.study.create");
}

/** Çalışma tanımı taslak olarak yerinde güncellenir (sürüm artar); SONUÇLAR değişmez satırlardır (saveStudyResult). */
export function updateStudy(s: Store, id: string, patch: Partial<StudyInput>, reason: string, expected_version: number): Study {
  s.require("urun-rapor.study.write");
  if (!reason.trim()) throw new StoreError("VALIDATION", "Değişiklik gerekçesi zorunlu.", 422);
  const cur = study(s, id);
  validateStudy({ ...cur, ...patch });
  return s.update<Study>(MODULE, STUDIES, id, patch, reason, expected_version);
}

export function newLineId(): string {
  const bytes = new Uint8Array(4);
  crypto.getRandomValues(bytes);
  return `ln-${Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("")}`;
}

export function addLine(s: Store, st: Study, line: Omit<ProcessLine, "id">, reason: string): Study {
  if (!line.name.trim()) throw new StoreError("VALIDATION", "Süreç satırı adı zorunlu.", 422);
  if (line.kind === "coproduct" && !line.allocation) throw new StoreError("VALIDATION", "Ortak ürün satırı tahsis (temel + pay + kaynak) ister (§16, §17).", 422);
  if (line.allocation) {
    if (!/^\d+(\.\d+)?$/.test(line.allocation.share)) throw new StoreError("VALIDATION", "Tahsis payı 0–1 arası ondalık olmalı (ör. 0.6).", 422);
    if (!line.allocation.source_ref.trim()) throw new StoreError("VALIDATION", "Tahsis kaynağı zorunlu (hangi veriye göre paylaştırıldı).", 422);
  }
  if (line.link.type === "record") s.record(line.link.record_id); // aktif kurumda var mı (T14)
  return updateStudy(s, st.id, { processes: [...st.processes, { ...line, id: newLineId() }] }, reason, st.version);
}

export function removeLine(s: Store, st: Study, line_id: string, reason: string): Study {
  return updateStudy(s, st.id, { processes: st.processes.filter((l) => l.id !== line_id) }, reason, st.version);
}

/** Yayımlı test kataloğu faktörleri ("ID@sürüm" anahtarıyla). Ürün satırı herhangi bir yayımlı faktörü seçebilir; sınırı motor denetler. */
export function publishedFactors(s: Store): TestFactor[] {
  return TEST_CATALOG.factors.filter((f) => s.publishedVersion(f.id) === f.version);
}
export function factorKey(f: TestFactor): string {
  return `${f.id}@${f.version}`;
}

function factorPayload(f: TestFactor) {
  return {
    id: f.id,
    version: f.version,
    value: f.value,
    numerator_unit: f.numerator_unit,
    gas: f.gas,
    denominator_unit: f.denominator_unit,
    basis: f.basis,
    reference_conditions: f.reference_conditions,
    boundary: f.boundary,
    gwp_set_id: f.gwp_set_id,
    source_ref: f.source_ref,
    license: f.license,
    valid_from: f.valid_from,
    valid_to: f.valid_to,
  };
}

/** Satır için hesap isteği (CONTRACT-v0.2 §6): source_type "product_process", çalışmanın sınırı ve tahsisi. */
export function buildLineRequest(s: Store, st: Study, line: ProcessLine): { request: Record<string, unknown>; factor_refs: FactorRef[] } {
  const factors = publishedFactors(s).filter((f) => line.factor_keys.includes(factorKey(f)));
  if (!factors.length) throw new StoreError("STUDY_LINE_INPUT", `"${line.name}" satırında yayımlı faktör seçilmemiş.`, 422);
  let activity: Record<string, unknown>;
  if (line.link.type === "record") {
    const v = s.current(line.link.record_id);
    const src = s.source(v.source_id);
    if (v.quantity_state !== "known" || v.quantity === null) throw new StoreError("STUDY_LINE_INPUT", `"${line.name}" satırının bağlı kaydında miktar bilinmiyor; önce kaydı tamamlayın.`, 422);
    activity = {
      id: `${st.id}:${line.id}`,
      version: st.version,
      source_type: "product_process",
      fuel: src.fuel,
      quantity: v.quantity,
      unit: v.unit ?? "bilinmiyor",
      heating_value_basis: v.heating_value_basis,
      reference_conditions: v.reference_conditions,
      calorific_value: v.calorific_value,
      basis_conversion: v.basis_conversion,
      data_quality: v.data_quality,
      period: { start: st.period.start, end: st.period.end },
      linked_record: { record_id: v.record_id, version: v.version }, // iz: aynı ham veri, ayrı bağlam (§17)
    };
  } else {
    const own = line.link;
    if (own.quantity_state !== "known" || own.quantity === null || !own.unit) throw new StoreError("STUDY_LINE_INPUT", `"${line.name}" satırında miktar veya birim eksik.`, 422);
    activity = {
      id: `${st.id}:${line.id}`,
      version: st.version,
      source_type: "product_process",
      fuel: own.fuel,
      quantity: own.quantity,
      unit: own.unit,
      heating_value_basis: own.heating_value_basis,
      reference_conditions: null,
      calorific_value: null,
      basis_conversion: null,
      data_quality: own.data_quality,
      period: { start: st.period.start, end: st.period.end },
    };
  }
  activity.product = {
    study_id: st.id,
    boundary: st.boundary,
    reference_flow: st.reference_flow,
    functional_unit: st.functional_unit,
    allocation: line.allocation,
    process_kind: line.kind,
  };
  return {
    request: {
      activity,
      factors: factors.map(factorPayload),
      method: { id: TEST_CATALOG.method.id, version: TEST_CATALOG.method.version, gwp_set: TEST_CATALOG.method.gwp_set },
    },
    factor_refs: factors.map((f) => ({ id: f.id, version: f.version })),
  };
}

/** Çalışma satır sonuçlarından ürün bağlamlı toplama isteği (CONTRACT-v0.2 §7). Kurumsal kayıt YOK; context her zaman "product". */
export function buildStudyAggregateRequest(st: Study, lines: LineResult[]): AggregateRequest {
  return {
    results: lines.map((l) => ({
      record_id: `${st.id}:${l.line_id}`,
      context: "product",
      scope: null,
      category: null,
      state: "calculated",
      result: l.result,
      scope2_method_used: null,
      study_id: st.id,
    })),
    policy: { include_states: ["calculated", "approved", "locked"], scope2_method: "location_based" },
  };
}

export function studyGaps(st: Study, lines: LineResult[]): string[] {
  const gaps: string[] = [];
  const blocked = lines.filter((l) => l.result.status === "blocked");
  if (blocked.length) gaps.push(`${blocked.length} satır hesaplanamadı (engel): ${blocked.map((l) => l.line_name).join(", ")}`);
  const review = lines.filter((l) => l.result.status === "review_required");
  if (review.length) gaps.push(`${review.length} satır inceleme gerekli (tahmini veri veya esas dönüşümü)`);
  const kinds = new Set(st.processes.map((p) => p.kind));
  if (st.boundary === "cradle_to_grave") {
    for (const k of ["transport", "use", "eol"] as ProcessKind[]) if (!kinds.has(k)) gaps.push(`Beşikten mezara sınırda '${PROCESS_KIND_LABEL[k]}' satırı yok; sonuç bu aşamayı içermiyor`);
  }
  if (st.boundary === "cradle_to_gate" && !kinds.has("material")) gaps.push("Beşikten kapıya sınırda malzeme (üst aşama) satırı yok; sonuç üst aşamaları içermiyor");
  if (st.boundary !== "cradle_to_grave") gaps.push("Kullanım ve ömür sonu bu sınırın dışında; sonuç tam ürün ayak izi değildir");
  if (st.functional_unit === null) gaps.push("Fonksiyonel birim tanımlı değil; farklı performanslı ürünlerle karşılaştırma yapılamaz (§17)");
  gaps.push("Yalnız sera gazı (karbon) hesaplandı; diğer çevresel etkiler kapsam dışı — bu bir LCA veya EPD değildir");
  return gaps;
}

/** Sonuç satırı değişmezdir: her hesap yeni satır; çalışma tanımı sürümüyle bağlanır. */
export function saveStudyResult(s: Store, st: Study, lines: LineResult[], agg: AggregateResult | null, aggError: string | null): StudyResult {
  s.require("urun-rapor.study.write");
  if (!lines.length) throw new StoreError("STUDY_LINE_INPUT", "Hesaplanacak süreç satırı yok.", 422);
  const engine = lines[0].result.engine_version;
  const prod = agg?.product?.[st.id] ?? null;
  const anyBlocked = lines.some((l) => l.result.status === "blocked");
  const row = s.insert<StudyResult>(
    MODULE,
    STUDY_RESULTS,
    {
      study_id: st.id,
      study_version: st.version,
      boundary: st.boundary,
      label_tr: boundaryLabel(st.boundary),
      reference_flow: st.reference_flow,
      functional_unit: st.functional_unit,
      period: st.period,
      method: lines[0].result.method,
      engine_version: engine,
      lines,
      study_total_kg: anyBlocked ? null : (prod?.total_kg ?? null),
      study_claim_tr: prod?.claim_tr ?? null,
      total_note_tr: anyBlocked ? "Engelli satır var; çalışma toplamı üretilmedi." : prod ? null : (aggError ?? "Motor toplama çıktısı (aggregate) bu çalışma için sonuç döndürmedi."),
      gaps_tr: studyGaps(st, lines),
      included_in_corporate_total: false,
    },
    "urun-rapor.study.calculate"
  );
  return row;
}

export function resultsOf(s: Store, study_id: string): StudyResult[] {
  return s.rows<StudyResult>(MODULE, STUDY_RESULTS).filter((r) => r.study_id === study_id);
}
export function latestResult(s: Store, st: Study): StudyResult | null {
  const rs = resultsOf(s, st.id);
  return rs.length ? rs[rs.length - 1] : null;
}
/** Güncel tanım için sonuç var mı (tanım değiştiyse eski sonuç korunur ama "güncel değil"). */
export function isCurrentResult(st: Study, r: StudyResult | null): boolean {
  return !!r && r.study_version === st.version;
}

export function lineResultFrom(line: ProcessLine, result: CalcResult, factor_refs: FactorRef[]): LineResult {
  return { line_id: line.id, line_name: line.name, kind: line.kind, request_hash: result.inputs_hash ?? null, factor_refs, result };
}
