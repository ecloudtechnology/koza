// Green Kaizen (KZN-01…03). Birim düzeyinde toplulaştırma; kişi bazlı liste/sıralama yok (kural 11, K-09).
// KVKK (K-09 açık): muhafazakâr tasarım — yazar kimliği yalnız kendi geri bildirimi için tutulur, hiçbir
// özet/pano çıktısında yer almaz.
import { StoreError, type Store } from "@/lib/store";
import { divide, mul } from "./decimal";
import { MODULE } from "./indicators";
import { T_KAIZEN } from "./metrics";
import { action, effectsOf, startAction } from "./actions";
import type { ActionEffectRow, ActionRow, KaizenRow, KaizenStatus } from "./types";

export const KAIZEN_STATUS_LABEL: Record<KaizenStatus, string> = {
  received: "Alındı",
  pre_evaluated: "Ön değerlendirildi",
  transferred: "Aksiyona aktarıldı",
  not_suitable: "Uygun değil",
};

export function suggestions(s: Store): KaizenRow[] {
  return s.rows<KaizenRow>(MODULE, T_KAIZEN);
}

/** KZN-01: 3 alanlı öneri. Fotoğraf yalnız ad + sha256 (içerik saklanmaz; kanıtla aynı ilke). */
export function submitSuggestion(s: Store, input: { observed: string; proposal: string; area: string; unit: string; photo?: { file_name: string; sha256: string; size_bytes: number } | null }): KaizenRow {
  s.require("performans.kaizen.submit");
  const miss: string[] = [];
  if (!input.observed.trim()) miss.push("ne gördüm");
  if (!input.proposal.trim()) miss.push("ne öneriyorum");
  if (!input.area.trim()) miss.push("alan/hat/ekipman");
  if (!input.unit.trim()) miss.push("birim");
  if (miss.length) throw new StoreError("VALIDATION", `Eksik alan: ${miss.join(", ")}.`, 422);
  return s.insert<KaizenRow>(MODULE, T_KAIZEN, {
    observed: input.observed.trim(),
    proposal: input.proposal.trim(),
    area: input.area.trim(),
    unit: input.unit.trim(),
    photo: input.photo ?? null,
    author_id: s.user.id,
    status: "received",
    evaluation_note: null,
    rejection_reason: null,
    action_id: null,
  });
}

/** KZN-02: elçi ön değerlendirmesi. Puan/sıra yok. 'Uygun değil' gerekçe ister; 'aksiyona aktar' AKS tetikleyicisi oluşturur. */
export function evaluateSuggestion(s: Store, id: string, decision: "pre_evaluated" | "transferred" | "not_suitable", note: string): KaizenRow {
  s.require("performans.kaizen.evaluate");
  const k = s.row<KaizenRow>(MODULE, T_KAIZEN, id);
  if (k.status === "transferred" || k.status === "not_suitable") throw new StoreError("INVALID_TRANSITION", `Öneri zaten '${KAIZEN_STATUS_LABEL[k.status]}'.`, 409);
  if (decision === "not_suitable" && note.trim().length < 5) throw new StoreError("KAIZEN_REASON_REQUIRED", "'Uygun değil' kararı için öneri sahibine iletilecek gerekçe yazın.", 422);
  if (decision === "transferred") {
    const a = startAction(s, { title: `Öneri: ${k.proposal.slice(0, 80)}`, trigger_type: "employee_suggestion", trigger_ref: k.id, trigger_note: `${k.unit} · ${k.area} — ${k.observed}` });
    return s.update<KaizenRow>(MODULE, T_KAIZEN, id, { status: "transferred", evaluation_note: note.trim() || null, action_id: a.id }, "aksiyona aktarıldı");
  }
  if (decision === "not_suitable") return s.update<KaizenRow>(MODULE, T_KAIZEN, id, { status: "not_suitable", rejection_reason: note.trim() }, "uygun değil");
  return s.update<KaizenRow>(MODULE, T_KAIZEN, id, { status: "pre_evaluated", evaluation_note: note.trim() || null }, "ön değerlendirildi");
}

export interface UnitSummary {
  unit: string;
  received: number;
  pre_evaluated: number;
  transferred: number;
  not_suitable: number;
  implemented: number; // aktarılan ve aksiyonu tamamlanan
  implementation_rate_pct: string | null; // implemented / toplam; öneri yoksa null
}

const PERSONAL_KEYS = ["author_id", "created_by", "user_id", "actor_id", "name", "person"];

/** Çıktıda kişi anahtarı varsa fırlatır (kural 11). Özetler bu denetimden geçerek döner. */
export function assertNoPersonalData(value: unknown): void {
  const walk = (v: unknown): void => {
    if (Array.isArray(v)) return v.forEach(walk);
    if (v && typeof v === "object") {
      for (const [k, x] of Object.entries(v as Record<string, unknown>)) {
        if (PERSONAL_KEYS.includes(k)) throw new StoreError("PERSONAL_RANKING_FORBIDDEN", `Birim özeti kişi alanı içeremez: ${k}`, 403);
        walk(x);
      }
    }
  };
  walk(value);
}

/** KZN panosu: yalnız birim düzeyi sayılar ve uygulanma oranı. */
export function summaryByUnit(s: Store): UnitSummary[] {
  const byUnit = new Map<string, KaizenRow[]>();
  for (const k of suggestions(s)) (byUnit.get(k.unit) ?? byUnit.set(k.unit, []).get(k.unit)!).push(k);
  const out: UnitSummary[] = [];
  for (const [unit, rows] of Array.from(byUnit.entries()).sort((a, b) => a[0].localeCompare(b[0]))) {
    const implemented = rows.filter((k) => k.action_id && safeAction(s, k.action_id)?.status === "completed").length;
    const r = divide(String(implemented), String(rows.length), 4);
    out.push({
      unit,
      received: rows.length,
      pre_evaluated: rows.filter((k) => k.status === "pre_evaluated").length,
      transferred: rows.filter((k) => k.status === "transferred").length,
      not_suitable: rows.filter((k) => k.status === "not_suitable").length,
      implemented,
      implementation_rate_pct: r === null ? null : mul(r, "100"),
    });
  }
  assertNoPersonalData(out);
  return out;
}

function safeAction(s: Store, id: string): ActionRow | null {
  try {
    return action(s, id);
  } catch {
    return null;
  }
}

export interface Feedback {
  suggestion: KaizenRow;
  action: ActionRow | null;
  effect: ActionEffectRow | null;
  message: string; // KZN-03: ölçülen etki + takdir ifadesi
}

/** KZN-03: yalnız oturumdaki kullanıcının kendi önerileri; başkasının önerisi listelenmez. */
export function myFeedback(s: Store): Feedback[] {
  return suggestions(s)
    .filter((k) => k.author_id === s.user.id)
    .map((k) => {
      const a = k.action_id ? safeAction(s, k.action_id) : null;
      const effs = a ? effectsOf(s, a.id) : [];
      const effect = effs.length ? effs[effs.length - 1] : null;
      let message: string;
      if (k.status === "received") message = "Öneriniz alındı; elçi ön değerlendirmesi bekleniyor.";
      else if (k.status === "pre_evaluated") message = `Ön değerlendirildi.${k.evaluation_note ? ` Not: ${k.evaluation_note}` : ""}`;
      else if (k.status === "not_suitable") message = `Bu öneri şu an uygulanamadı. Gerekçe: ${k.rejection_reason}. Gözleminiz için teşekkürler; benzer bir gözlemi yeniden iletebilirsiniz.`;
      else if (a?.status === "completed" && effect) {
        const parts = effect.metrics.map((m) => `${m.label}: ${m.baseline} → ${m.pilot} ${m.unit}${m.change_pct !== null ? ` (%${m.change_pct})` : ""}`);
        message = `Öneriniz uygulandı ve standardize edildi. Ölçülen etki — ${parts.join("; ")}. Katkınız için teşekkür ederiz; bu iyileştirme sizin gözleminizle başladı.`;
      } else if (effect) {
        message = `Öneriniz pilot olarak denendi; ölçüm iki hedefin eşiğini birlikte karşılamadı, kök neden ve yeniden tasarım sürüyor. Gözleminiz için teşekkürler.`;
      } else message = `Öneriniz aksiyona aktarıldı (${a ? a.status : "—"}); etki ölçülünce burada göreceksiniz.`;
      return { suggestion: k, action: a, effect, message };
    });
}
