// PRD §6.6 command handler.
import type { Route } from './router.js';
import type { TgMessage } from './types.js';
import type { PipelineDeps } from './pipeline/processNote.js';
import { HELP_TEXT, NOT_YET_REPLY } from './pipeline/format.js';

type CommandRoute = Extract<Route, { action: 'command' | 'command_fallback' | 'bare_command' | 'help' }>;

export async function handleCommand(r: CommandRoute, msg: TgMessage, deps: PipelineDeps): Promise<void> {
  const reply = (text: string) => deps.tg.sendMessage(msg.chat.id, text, msg.message_id);
  if (r.action === 'help') return void (await reply(HELP_TEXT));
  if (r.action === 'bare_command') {
    return void (await reply(r.command === 'HELP' || r.command === 'START' ? HELP_TEXT : NOT_YET_REPLY));
  }
  // APPROVE / REJECT arrive in M4; REDO / DRAFT ANYWAY / RETRY in M6 (plan A5).
  await reply(NOT_YET_REPLY);
}
