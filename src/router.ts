// PRD §6.3 decision table. Pure: the replyTarget DB lookup happens before this is called.
import type { ReplyTarget, TgMessage } from './types.js';

export type CommandName = 'APPROVE' | 'REJECT' | 'REDO' | 'DRAFT ANYWAY' | 'RETRY';
export interface Command {
  name: CommandName;
  arg: string | null; // REJECT reason / REDO feedback
}
export type BareCommand = 'NEXT' | 'STATS' | 'HELP' | 'START';

export type Route =
  | { rule: 1; action: 'ignore' }
  | { rule: 2; action: 'text_only' }
  | { rule: 3; action: 'command'; command: Command; target: ReplyTarget }
  | { rule: 4; action: 'command_fallback'; command: Command }
  | { rule: 5; action: 'bare_command'; command: BareCommand }
  | { rule: 6; action: 'help' }
  | { rule: 7; action: 'note'; body: string };

export const COMMAND_RE = /^(APPROVE|REJECT|REDO|DRAFT ANYWAY|RETRY)\b\s*(?::\s*(.*))?$/is;
export const BARE_RE = /^\/?(NEXT|STATS|HELP|START)(@\w+)?$/i;

// Telegram service-message fields (Bot API "Message" object).
const SERVICE_FIELDS = [
  'new_chat_members', 'left_chat_member', 'new_chat_title', 'new_chat_photo', 'delete_chat_photo',
  'group_chat_created', 'supergroup_chat_created', 'channel_chat_created',
  'message_auto_delete_timer_changed', 'migrate_to_chat_id', 'migrate_from_chat_id', 'pinned_message',
  'video_chat_scheduled', 'video_chat_started', 'video_chat_ended', 'video_chat_participants_invited',
  'forum_topic_created', 'forum_topic_edited', 'forum_topic_closed', 'forum_topic_reopened',
  'general_forum_topic_hidden', 'general_forum_topic_unhidden', 'boost_added', 'chat_background_set',
  'write_access_allowed', 'users_shared', 'chat_shared', 'proximity_alert_triggered',
];

export function messageBody(msg: TgMessage): string {
  return (msg.text ?? msg.caption ?? '').trim();
}

export function isServiceMessage(msg: TgMessage): boolean {
  if (msg.text !== undefined || msg.caption !== undefined) return false;
  return SERVICE_FIELDS.some((f) => msg[f] !== undefined);
}

/** Tokens containing at least one letter or digit (decisions B3). */
export function wordCount(s: string): number {
  return s.split(/\s+/).filter((t) => /[\p{L}\p{N}]/u.test(t)).length;
}

export function parseCommand(body: string): Command | null {
  const m = COMMAND_RE.exec(body);
  if (!m) return null;
  const name = m[1]!.toUpperCase().replace(/\s+/, ' ') as CommandName;
  const arg = m[2]?.trim() || null;
  return { name, arg };
}

export function parseBareCommand(body: string): BareCommand | null {
  const m = BARE_RE.exec(body);
  return m ? (m[1]!.toUpperCase() as BareCommand) : null;
}

export function route(msg: TgMessage, replyTarget: ReplyTarget | null): Route {
  if (isServiceMessage(msg)) return { rule: 1, action: 'ignore' };
  const body = messageBody(msg);
  if (body === '') return { rule: 2, action: 'text_only' };

  const command = parseCommand(body);
  if (command && replyTarget) return { rule: 3, action: 'command', command, target: replyTarget };
  if (command && wordCount(body) <= 3) return { rule: 4, action: 'command_fallback', command };

  const bare = parseBareCommand(body);
  if (bare) return { rule: 5, action: 'bare_command', command: bare };

  if (replyTarget) return { rule: 6, action: 'help' };
  return { rule: 7, action: 'note', body };
}
