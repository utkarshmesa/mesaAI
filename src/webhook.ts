// PRD §6.2 request lifecycle. Testable core; api/webhook.ts wires the real deps.
import { timingSafeEqual } from 'node:crypto';
import { handleCommand } from './commands.js';
import { errMessage } from './log.js';
import { type Deadline, makeDeadline } from './pipeline/deadline.js';
import { TEXT_ONLY_REPLY } from './pipeline/format.js';
import { type PipelineDeps, processNote } from './pipeline/processNote.js';
import { route } from './router.js';
import type { TgMessage, TgUpdate } from './types.js';

export interface WebhookDeps extends PipelineDeps {
  secret: string;
  allowedChatIds: string[];
}

export interface Runtime {
  waitUntil(p: Promise<unknown>): void;
  platformDeadline?(): Date | undefined;
}

function secretOk(header: string | null, secret: string): boolean {
  if (!header) return false;
  const a = Buffer.from(header);
  const b = Buffer.from(secret);
  return a.length === b.length && timingSafeEqual(a, b);
}

const ok = () => new Response('ok', { status: 200 });

export async function handleWebhook(req: Request, deps: WebhookDeps, rt: Runtime): Promise<Response> {
  // 1. Secret header.
  if (!secretOk(req.headers.get('x-telegram-bot-api-secret-token'), deps.secret)) {
    return new Response('unauthorized', { status: 401 });
  }
  // 2. Parse.
  let update: TgUpdate;
  try {
    update = (await req.json()) as TgUpdate;
  } catch {
    return ok();
  }
  const msg = update.channel_post ?? update.message;
  if (!msg) return ok();
  // 3. Chat allowlist.
  if (!deps.allowedChatIds.includes(String(msg.chat.id))) {
    deps.log({ stage: 'allowlist', ok: false, chat_id: msg.chat.id });
    return ok();
  }
  // 4. Idempotency for every update.
  if (!(await deps.repo.markUpdateProcessed(update.update_id))) {
    deps.log({ stage: 'dedupe', ok: true, update_id: update.update_id });
    return ok();
  }
  // 5. Ack now, work in the background.
  const dl = makeDeadline(Date.now(), rt.platformDeadline?.());
  rt.waitUntil(handle(msg, deps, dl).catch((err) => deps.log({ stage: 'handle', ok: false, err: errMessage(err) })));
  return ok();
}

export async function handle(msg: TgMessage, deps: WebhookDeps, dl: Deadline): Promise<void> {
  const replyTo = msg.reply_to_message?.message_id;
  const target = replyTo ? await deps.repo.findReplyTarget(msg.chat.id, replyTo) : null;
  const r = route(msg, target);
  deps.log({ stage: 'route', ok: true, rule: r.rule });
  switch (r.action) {
    case 'ignore':
      return;
    case 'text_only':
      await deps.tg.sendMessage(msg.chat.id, TEXT_ONLY_REPLY, msg.message_id);
      return;
    case 'note':
      return processNote(msg, r.body, deps, dl);
    default:
      return handleCommand(r, msg, deps);
  }
}
