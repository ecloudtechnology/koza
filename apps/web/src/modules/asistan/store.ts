// Asistan konuşma kaydı: modül tablosu "asistan/conversations" (kuruma süzülü; kullanıcı bazlı okunur).
// Satırlar değişmezdir (soru + yanıt); belge ham metni saklanmaz, yalnız alan adayları.
import type { Task } from "@/lib/domain";
import type { ModuleRow, Store } from "@/lib/store";
import { ask, type Answer, type AskOptions, type TaskDraft } from "./engine";

export const MODULE = "asistan";
export const TABLE = "conversations";

export interface ConversationRow extends ModuleRow {
  user_id: string;
  question: string;
  answer: Answer;
}

/** Aktif kurumda, bu kullanıcının konuşma geçmişi (eskiden yeniye). */
export function history(s: Store): ConversationRow[] {
  return s
    .rows<ConversationRow>(MODULE, TABLE)
    .filter((r) => r.user_id === s.user.id)
    .sort((a, b) => a.created_at.localeCompare(b.created_at));
}

/** Soruyu motora verir ve yanıtı konuşma tablosuna yazar. */
export function askAndSave(s: Store, question: string, opts: AskOptions = {}): ConversationRow {
  const answer = ask(s, question, opts);
  const label = opts.document !== undefined ? "[Belge metni tarandı]" : question.trim();
  return s.insert<ConversationRow>(MODULE, TABLE, { user_id: s.user.id, question: label, answer }, "asistan.ask");
}

/** Araç önerisi: yalnız kullanıcının açık tıklamasıyla, normal görev yoluyla (store.createTask) oluşturulur. */
export function createTaskFromDraft(s: Store, draft: TaskDraft): Task {
  return s.createTask(draft);
}
