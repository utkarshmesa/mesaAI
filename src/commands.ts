// PRD §6.6 command handler.
import type { Command, Route } from './router.js';
import type { Draft, TgMessage } from './types.js';
import type { PipelineDeps } from './pipeline/processNote.js';
import { HELP_TEXT, NOT_YET_REPLY } from './pipeline/format.js';

type CommandRoute = Extract<Route, { action: 'command' | 'command_fallback' | 'bare_command' | 'help' }>;

export const REPLY_TO_MEAN = 'Reply to the message you mean.';
export const APPROVED_REPLY = '✓ Approved. Copy Message 1 into LinkedIn when ready.';
export const REJECTED_REPLY = '✓ Rejected. Kept for learning.';
export const alreadyReply = (status: string) => `That draft is already ${status}.`;

export async function handleCommand(r: CommandRoute, msg: TgMessage, deps: PipelineDeps): Promise<void> {
  const reply = (text: string) => deps.tg.sendMessage(msg.chat.id, text, msg.message_id).then(() => undefined);

  if (r.action === 'help') return reply(HELP_TEXT);
  if (r.action === 'bare_command') return reply(r.command === 'HELP' || r.command === 'START' ? HELP_TEXT : NOT_YET_REPLY);

  const { command } = r;
  // REDO / DRAFT ANYWAY / RETRY arrive in M6 (plan A5).
  if (command.name !== 'APPROVE' && command.name !== 'REJECT') return reply(NOT_YET_REPLY);

  const draft = r.action === 'command' ? (r.target.kind === 'draft' ? r.target.draft : null) : await singlePending(msg.chat.id, deps);
  if (!draft) return reply(REPLY_TO_MEAN);
  return reply(await decide(draft, command, deps));
}

/** §6.6 (b): the single pending draft in this chat, if exactly one exists. */
async function singlePending(chatId: number, deps: PipelineDeps): Promise<Draft | null> {
  const pending = await deps.repo.pendingDrafts(chatId);
  return pending.length === 1 ? pending[0]! : null;
}

/** Conditional transition pending → approved|rejected. Only one concurrent caller wins. */
export async function decide(draft: Draft, command: Command, deps: PipelineDeps): Promise<string> {
  const approve = command.name === 'APPROVE';
  const patch = approve
    ? { status: 'approved' as const, decided_at: new Date().toISOString() }
    : { status: 'rejected' as const, decided_at: new Date().toISOString(), decision_reason: command.arg };
  const updated = await deps.repo.updateDraft(draft.id, patch, ['pending']);
  if (!updated) {
    const current = await deps.repo.getDraft(draft.id);
    return alreadyReply(current?.status ?? draft.status);
  }
  deps.log({ note_id: draft.note_id, stage: 'command', ok: true, command: command.name });
  return approve ? APPROVED_REPLY : REJECTED_REPLY;
}
