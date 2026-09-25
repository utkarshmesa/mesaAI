// Builds the real dependencies once per function instance.
import { type Config, loadConfig } from './config.js';
import { loadContext } from './context.js';
import { MemoryRepo, type Repo } from './db/repo.js';
import { SupabaseRepo } from './db/supabaseRepo.js';
import { geminiLLM } from './llm/gemini.js';
import { log } from './log.js';
import { googleNews } from './pipeline/news.js';
import { telegramClient } from './telegram.js';
import type { WebhookDeps } from './webhook.js';

let deps: WebhookDeps | null = null;

/** Supabase when configured (M4+), otherwise in-memory (M1–M3, tests). */
export function makeRepo(url: string, key: string): Repo {
  return url && key ? new SupabaseRepo(url, key) : new MemoryRepo();
}

export function appDeps(): WebhookDeps {
  deps ??= buildDeps(loadConfig());
  return deps;
}

/** R12: the drafter model (DRAFT_MODEL) is switched independently of the analyse model (GEMINI_MODEL). */
export function buildDeps(config: Config): WebhookDeps {
  return {
    secret: config.TELEGRAM_WEBHOOK_SECRET,
    allowedChatIds: config.TELEGRAM_ALLOWED_CHAT_IDS,
    repo: makeRepo(config.SUPABASE_URL, config.SUPABASE_SERVICE_ROLE_KEY),
    tg: telegramClient(config.TELEGRAM_BOT_TOKEN),
    analyseLLM: geminiLLM(config.GEMINI_API_KEY, config.GEMINI_MODEL),
    draftLLM: geminiLLM(config.GEMINI_API_KEY, config.DRAFT_MODEL),
    news: googleNews({ window: config.NEWS_WINDOW, locale: config.NEWS_LOCALE, forceError: config.NEWS_FORCE_ERROR === '1' }),
    settings: { scoreThreshold: config.SCORE_THRESHOLD, minNoteWords: config.MIN_NOTE_WORDS },
    ctx: loadContext(),
    log,
  };
}
