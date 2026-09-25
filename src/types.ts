export type NoteStatus = 'received' | 'rejected' | 'passed' | 'drafted' | 'failed' | 'backlog';
export type DraftStatus = 'pending' | 'approved' | 'rejected' | 'superseded';
export type Flag = 'LEGAL' | 'PRIVACY' | 'MEDICAL' | 'REPEAT';
export type Category = 'insight' | 'logistics' | 'venting' | 'fragment';
export type NewsStatus = 'used' | 'unused' | 'none' | 'error';

export interface Criteria {
  specificity: number;
  clear_point: number;
  novelty: number;
  reader_value: number;
}

export interface Note {
  id: string;
  chat_id: number | null;
  message_id: number | null;
  import_key: string | null;
  text: string;
  source: 'telegram' | 'backlog';
  status: NoteStatus;
  category: Category | null;
  score: number | null;
  criteria: Criteria | null;
  reason: string | null;
  flags: Flag[];
  duplicate_of: string | null;
  suggested_angle: string | null;
  search_phrase: string | null;
  entities: string[];
  override: boolean;
  failed_stage: string | null;
  rejection_message_id: number | null;
  error_message_id: number | null;
  created_at: string;
}

export interface NewsItem {
  headline: string;
  source: string;
  date: string;
  url: string;
}

export interface LintResult {
  hard: string[];
  soft: string[];
  check_count: number;
}

export interface Draft {
  id: string;
  note_id: string;
  body: string;
  status: DraftStatus;
  news: NewsItem | null;
  news_status: NewsStatus | null;
  model: string;
  voice_version: string;
  prompt_version: string;
  lint: LintResult | null;
  redo_feedback: string | null;
  redo_count: number;
  post_message_id: number | null;
  card_message_id: number | null;
  decision_reason: string | null;
  decided_at: string | null;
  created_at: string;
}

/** The subset of a Telegram Message we read. Other fields pass through untyped. */
export interface TgMessage {
  message_id: number;
  chat: { id: number; type?: string };
  text?: string;
  caption?: string;
  reply_to_message?: { message_id: number };
  [key: string]: unknown;
}

export interface TgUpdate {
  update_id: number;
  message?: TgMessage;
  channel_post?: TgMessage;
}

/** The bot message a reply points at (PRD §6.3). */
export type ReplyTarget =
  | { kind: 'draft'; draft: Draft; via: 'post' | 'card' }
  | { kind: 'note'; note: Note; via: 'rejection' | 'error' };
