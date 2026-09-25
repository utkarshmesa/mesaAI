// Builds the real dependencies once per function instance.
import { loadConfig } from './config.js';
import { loadContext } from './context.js';
import { MemoryRepo, type Repo } from './db/repo.js';
import { geminiLLM } from './llm/gemini.js';
import { log } from './log.js';
import { telegramClient } from './telegram.js';
import type { WebhookDeps } from './webhook.js';

let deps: WebhookDeps | null = null;

export function makeRepo(): Repo {
  return new MemoryRepo();
}

export function appDeps(): WebhookDeps {
  if (deps) return deps;
  const config = loadConfig();
  deps = {
    secret: config.TELEGRAM_WEBHOOK_SECRET,
    allowedChatIds: config.TELEGRAM_ALLOWED_CHAT_IDS,
    repo: makeRepo(),
    tg: telegramClient(config.TELEGRAM_BOT_TOKEN),
    analyseLLM: geminiLLM(config.GEMINI_API_KEY, config.GEMINI_MODEL),
    draftLLM: geminiLLM(config.GEMINI_API_KEY, config.DRAFT_MODEL),
    settings: { scoreThreshold: config.SCORE_THRESHOLD, minNoteWords: config.MIN_NOTE_WORDS },
    ctx: loadContext(),
    log,
  };
  return deps;
}
