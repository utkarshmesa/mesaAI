// Supabase implementation of Repo (service-role key, server only). Same contract as MemoryRepo.
import { type SupabaseClient, createClient } from '@supabase/supabase-js';
import type { Draft, DraftStatus, Note, NoteStatus, ReplyTarget } from '../types.js';
import type { NewDraft, NewNote, Repo } from './repo.js';

const TIMEOUT_MS = 5_000;
const UNIQUE_VIOLATION = '23505';

type DraftRow = Draft & { notes?: unknown };
const cleanDraft = ({ notes: _join, ...d }: DraftRow): Draft => d;

function fail(op: string, error: { message: string; code?: string }): never {
  throw new Error(`supabase ${op}: ${error.code ?? ''} ${error.message}`);
}

export class SupabaseRepo implements Repo {
  private db: SupabaseClient;

  constructor(url: string, serviceRoleKey: string) {
    this.db = createClient(url, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { fetch: (input, init) => fetch(input, { ...init, signal: AbortSignal.timeout(TIMEOUT_MS) }) },
    });
  }

  async markUpdateProcessed(updateId: number) {
    const { error } = await this.db.from('processed_updates').insert({ update_id: updateId });
    if (error?.code === UNIQUE_VIOLATION) return false;
    if (error) fail('markUpdateProcessed', error);
    return true;
  }

  async insertNote(n: NewNote) {
    const { data, error } = await this.db.from('notes').insert({ status: 'received', ...n }).select().single();
    if (error?.code === UNIQUE_VIOLATION) return null;
    if (error) fail('insertNote', error);
    return data as Note;
  }

  async updateNote(id: string, patch: Partial<Note>, expected?: NoteStatus[]) {
    let q = this.db.from('notes').update(patch).eq('id', id);
    if (expected) q = q.in('status', expected);
    const { data, error } = await q.select();
    if (error) fail('updateNote', error);
    return (data?.[0] as Note | undefined) ?? null;
  }

  async insertDraft(d: NewDraft) {
    const { data, error } = await this.db.from('drafts').insert(d).select().single();
    if (error) fail('insertDraft', error);
    return data as Draft;
  }

  async updateDraft(id: string, patch: Partial<Draft>, expected?: DraftStatus[]) {
    let q = this.db.from('drafts').update(patch).eq('id', id);
    if (expected) q = q.in('status', expected);
    const { data, error } = await q.select();
    if (error) fail('updateDraft', error);
    return (data?.[0] as Draft | undefined) ?? null;
  }

  async findReplyTarget(chatId: number, messageId: number): Promise<ReplyTarget | null> {
    const d = await this.db
      .from('drafts')
      .select('*, notes!inner(chat_id)')
      .eq('notes.chat_id', chatId)
      .or(`post_message_id.eq.${messageId},card_message_id.eq.${messageId}`)
      .limit(1);
    if (d.error) fail('findReplyTarget', d.error);
    const draft = d.data?.[0] as DraftRow | undefined;
    if (draft) return { kind: 'draft', draft: cleanDraft(draft), via: draft.post_message_id === messageId ? 'post' : 'card' };

    const n = await this.db
      .from('notes')
      .select()
      .eq('chat_id', chatId)
      .or(`rejection_message_id.eq.${messageId},error_message_id.eq.${messageId}`)
      .limit(1);
    if (n.error) fail('findReplyTarget', n.error);
    const note = n.data?.[0] as Note | undefined;
    if (note) return { kind: 'note', note, via: note.rejection_message_id === messageId ? 'rejection' : 'error' };
    return null;
  }

  async getDraft(id: string) {
    const { data, error } = await this.db.from('drafts').select().eq('id', id).maybeSingle();
    if (error) fail('getDraft', error);
    return (data as Draft | null) ?? null;
  }

  async listStaleNotes(before: Date) {
    const { data, error } = await this.db.from('notes').select().in('status', ['received', 'passed']).lt('created_at', before.toISOString());
    if (error) fail('listStaleNotes', error);
    return (data ?? []) as Note[];
  }

  async pendingDrafts(chatId: number) {
    const { data, error } = await this.db.from('drafts').select('*, notes!inner(chat_id)').eq('notes.chat_id', chatId).eq('status', 'pending');
    if (error) fail('pendingDrafts', error);
    return ((data ?? []) as DraftRow[]).map(cleanDraft);
  }

  async recentDrafts(limit: number) {
    const { data, error } = await this.db.from('drafts').select().order('created_at', { ascending: false }).limit(limit);
    if (error) fail('recentDrafts', error);
    return (data ?? []) as Draft[];
  }

  async activeVoice() {
    const { data, error } = await this.db.from('voice_skill').select('version, content').eq('active', true).maybeSingle();
    if (error) fail('activeVoice', error);
    return (data as { version: string; content: string } | null) ?? null;
  }
}
