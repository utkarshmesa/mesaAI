import type { z } from 'zod';
import { loadContext } from '../src/context.js';
import { MemoryRepo } from '../src/db/repo.js';
import type { GenerateOptions, LLM } from '../src/llm/index.js';
import type { LogLine } from '../src/log.js';
import { makeDeadline } from '../src/pipeline/deadline.js';
import type { Telegram } from '../src/telegram.js';
import type { TgMessage } from '../src/types.js';
import type { WebhookDeps } from '../src/webhook.js';

export interface Sent { chatId: number; text: string; replyTo?: number; id: number }

export function fakeTelegram(opts: { failTimes?: number } = {}) {
  const sent: Sent[] = [];
  let nextId = 1000;
  let fails = opts.failTimes ?? 0;
  const tg: Telegram = {
    async sendMessage(chatId, text, replyTo) {
      if (fails > 0) { fails--; throw new Error('telegram down'); }
      const id = nextId++;
      sent.push({ chatId, text, replyTo, id });
      return id;
    },
  };
  return { tg, sent };
}

/** Returns queued responses in order (objects are returned as-is; Errors are thrown). */
export function fakeLLM(responses: unknown[], model = 'fake-model') {
  const calls: { system: string; user: string; opts: GenerateOptions }[] = [];
  const llm: LLM = {
    name: 'fake',
    model,
    async generateJSON<T>(schema: z.ZodType<T>, system: string, user: string, opts: GenerateOptions): Promise<T> {
      calls.push({ system, user, opts });
      const r = responses.shift();
      if (r === undefined) throw new Error('fakeLLM: no response queued');
      if (r instanceof Error) throw r;
      return schema.parse(r);
    },
  };
  return { llm, calls };
}

export const CHAT = -1001;

export function msg(partial: Partial<TgMessage> = {}): TgMessage {
  return { message_id: 1, chat: { id: CHAT, type: 'channel' }, ...partial };
}

export function goodPost(extra = ''): string {
  const para = 'I checked the certificate of analysis against the baseline and the numbers had moved in a way that matters for texture. ';
  return (para.repeat(5) + '\n\n').repeat(4).trim() + extra;
}

export function makeDeps(over: Partial<WebhookDeps> = {}) {
  const logs: LogLine[] = [];
  const { tg, sent } = fakeTelegram();
  const repo = new MemoryRepo();
  const { llm, calls } = fakeLLM([]);
  const deps: WebhookDeps = {
    secret: 's'.repeat(32),
    allowedChatIds: [String(CHAT)],
    repo,
    tg,
    draftLLM: llm,
    ctx: loadContext(),
    log: (l) => logs.push(l),
    ...over,
  };
  return { deps, repo, sent, logs, calls };
}

export const deadline = () => makeDeadline(Date.now());
