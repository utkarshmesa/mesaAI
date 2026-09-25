// Repo interface + in-memory implementation (tests, and M1–M3 before Supabase).
import { randomUUID } from 'node:crypto';
import type { Draft, DraftStatus, Note, NoteStatus, ReplyTarget } from '../types.js';

export type NewNote = Pick<Note, 'chat_id' | 'message_id' | 'text'> & Partial<Pick<Note, 'source' | 'status' | 'import_key'>>;
export type NewDraft = Pick<Draft, 'note_id' | 'body' | 'news' | 'news_status' | 'model' | 'voice_version' | 'prompt_version' | 'lint'> &
  Partial<Pick<Draft, 'redo_feedback' | 'redo_count'>>;

export interface Repo {
  /** Insert-first idempotency. false = this update_id was seen before. */
  markUpdateProcessed(updateId: number): Promise<boolean>;
  /** null = unique (chat_id, message_id) conflict. */
  insertNote(n: NewNote): Promise<Note | null>;
  /** Conditional update: only applies when the current status is in `expected`. null = no row changed. */
  updateNote(id: string, patch: Partial<Note>, expected?: NoteStatus[]): Promise<Note | null>;
  insertDraft(d: NewDraft): Promise<Draft>;
  updateDraft(id: string, patch: Partial<Draft>, expected?: DraftStatus[]): Promise<Draft | null>;
  /** Which bot message (in this chat) does message_id belong to? (PRD §6.3, scoped by chat: plan A4) */
  findReplyTarget(chatId: number, messageId: number): Promise<ReplyTarget | null>;
}

export function blankNote(n: NewNote): Note {
  return {
    id: randomUUID(),
    import_key: null,
    source: 'telegram',
    status: 'received',
    category: null,
    score: null,
    criteria: null,
    reason: null,
    flags: [],
    duplicate_of: null,
    suggested_angle: null,
    search_phrase: null,
    entities: [],
    override: false,
    failed_stage: null,
    rejection_message_id: null,
    error_message_id: null,
    created_at: new Date().toISOString(),
    ...n,
  };
}

export function blankDraft(d: NewDraft): Draft {
  return {
    id: randomUUID(),
    status: 'pending',
    redo_feedback: null,
    redo_count: 0,
    post_message_id: null,
    card_message_id: null,
    decision_reason: null,
    decided_at: null,
    created_at: new Date().toISOString(),
    ...d,
  };
}

export class MemoryRepo implements Repo {
  updates = new Set<number>();
  notes = new Map<string, Note>();
  drafts = new Map<string, Draft>();

  async markUpdateProcessed(updateId: number) {
    if (this.updates.has(updateId)) return false;
    this.updates.add(updateId);
    return true;
  }

  async insertNote(n: NewNote) {
    if (n.chat_id !== null) {
      for (const x of this.notes.values()) if (x.chat_id === n.chat_id && x.message_id === n.message_id) return null;
    }
    const note = blankNote(n);
    this.notes.set(note.id, note);
    return { ...note };
  }

  async updateNote(id: string, patch: Partial<Note>, expected?: NoteStatus[]) {
    const cur = this.notes.get(id);
    if (!cur || (expected && !expected.includes(cur.status))) return null;
    const next = { ...cur, ...patch, id };
    this.notes.set(id, next);
    return { ...next };
  }

  async insertDraft(d: NewDraft) {
    const draft = blankDraft(d);
    this.drafts.set(draft.id, draft);
    return { ...draft };
  }

  async updateDraft(id: string, patch: Partial<Draft>, expected?: DraftStatus[]) {
    const cur = this.drafts.get(id);
    if (!cur || (expected && !expected.includes(cur.status))) return null;
    const next = { ...cur, ...patch, id };
    this.drafts.set(id, next);
    return { ...next };
  }

  async findReplyTarget(chatId: number, messageId: number): Promise<ReplyTarget | null> {
    for (const d of this.drafts.values()) {
      if (this.notes.get(d.note_id)?.chat_id !== chatId) continue;
      if (d.post_message_id === messageId) return { kind: 'draft', draft: { ...d }, via: 'post' };
      if (d.card_message_id === messageId) return { kind: 'draft', draft: { ...d }, via: 'card' };
    }
    for (const n of this.notes.values()) {
      if (n.chat_id !== chatId) continue;
      if (n.rejection_message_id === messageId) return { kind: 'note', note: { ...n }, via: 'rejection' };
      if (n.error_message_id === messageId) return { kind: 'note', note: { ...n }, via: 'error' };
    }
    return null;
  }
}
