// PRD §6.4 note pipeline: orchestration only. Each step is a small named function.
import type { ContextBundle } from '../context.js';
import type { Repo } from '../db/repo.js';
import type { LLM } from '../llm/index.js';
import { type Logger, errMessage } from '../log.js';
import { type DraftInput, type DraftResult, DraftResultSchema, PROMPT_VERSION, buildDraftSystemPrompt, buildDraftUserPrompt, sha256 } from '../prompts/draft.js';
import { type Telegram, sendParts } from '../telegram.js';
import type { Draft, LintResult, NewsItem, Note, TgMessage } from '../types.js';
import { type Deadline, callTimeout } from './deadline.js';
import { formatError, formatPost, formatReviewCard } from './format.js';
import { lintPost } from './lint.js';

export const LLM_TIMEOUT_MS = 60_000;
const MIN_TO_START_MS = 10_000;

export interface PipelineDeps {
  repo: Repo;
  tg: Telegram;
  draftLLM: LLM;
  ctx: ContextBundle;
  log: Logger;
}

type Stage = 'received' | 'draft' | 'save' | 'send';

class StageError extends Error {
  constructor(public stage: Stage, cause: unknown) {
    super(errMessage(cause));
  }
}

async function step<T>(stage: Stage, fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    throw err instanceof StageError ? err : new StageError(stage, err);
  }
}

function requireTime(dl: Deadline): void {
  if (dl.remainingMs() < MIN_TO_START_MS) throw new Error('deadline reached');
}

/** Entry point for a Telegram note (routing rule 7). */
export async function processNote(msg: TgMessage, body: string, deps: PipelineDeps, dl: Deadline): Promise<void> {
  // 1. INSERT note; a unique conflict means we've seen it → STOP.
  const note = await deps.repo.insertNote({ chat_id: msg.chat.id, message_id: msg.message_id, text: body });
  if (!note) return deps.log({ stage: 'insert_note', ok: true, duplicate: true });
  deps.log({ note_id: note.id, stage: 'insert_note', ok: true });
  await runFromReceived(note, deps, dl);
}

export async function runFromReceived(note: Note, deps: PipelineDeps, dl: Deadline): Promise<void> {
  try {
    // M1 has no scoring: received → passed is a pass-through (plan A3).
    const passed = await step('received', () => deps.repo.updateNote(note.id, { status: 'passed' }, ['received']));
    if (!passed) return;
    await draftAndDeliver(passed, [], 'none', deps, dl);
  } catch (err) {
    await failNote(note, err instanceof StageError ? err.stage : 'received', err, deps);
  }
}

/** Steps 6–9 for a note that is `passed`. */
export type FetchStatus = 'ok' | 'none' | 'error';

export async function draftAndDeliver(note: Note, news: NewsItem[], newsStatus: FetchStatus, deps: PipelineDeps, dl: Deadline): Promise<Draft> {
  // 6 + 7. DRAFT and LINT (one regeneration on hard violations).
  const input: DraftInput = { note: note.text, flags: note.flags, suggestedAngle: note.suggested_angle, news };
  const { result, lint } = await step('draft', () => draftWithLint(note.id, input, note.entities, deps, dl));
  const chosen = pickNews(result.news_item_used, news);

  // 8. INSERT draft (pending).
  const draft = await step('save', () =>
    deps.repo.insertDraft({
      note_id: note.id,
      body: result.post,
      news: chosen,
      news_status: chosen ? 'used' : newsStatus === 'ok' ? 'unused' : newsStatus,
      model: `${deps.draftLLM.name}:${deps.draftLLM.model}`,
      voice_version: deps.ctx.voiceVersion,
      prompt_version: PROMPT_VERSION,
      lint,
    }),
  );

  // 9. SEND post, then card as a reply to it.
  return step('send', () => deliver(note, draft, lint, deps));
}

export function pickNews(i: number | null, news: NewsItem[]): NewsItem | null {
  return i !== null && Number.isInteger(i) && i >= 1 && i <= news.length ? news[i - 1]! : null;
}

export async function draftWithLint(
  noteId: string,
  input: DraftInput,
  entities: string[],
  deps: PipelineDeps,
  dl: Deadline,
): Promise<{ result: DraftResult; lint: LintResult; regenerated: boolean }> {
  const system = buildDraftSystemPrompt(deps.ctx.voiceSkill, deps.ctx.examples);
  const call = async (inp: DraftInput) => {
    requireTime(dl);
    const t0 = Date.now();
    // Debug proof that the voice reaches the model: hash of the exact system prompt sent.
    deps.log({ note_id: noteId, stage: 'draft_call', ok: true, model: deps.draftLLM.model, system_sha256: sha256(system), voice_version: deps.ctx.voiceVersion, prompt_version: PROMPT_VERSION });
    const r = await deps.draftLLM.generateJSON(DraftResultSchema, system, buildDraftUserPrompt(inp), {
      timeoutMs: callTimeout(dl, LLM_TIMEOUT_MS),
      allowRetry: dl.canRunOptional(),
    });
    deps.log({ note_id: noteId, stage: 'draft', ms: Date.now() - t0, ok: true, model: deps.draftLLM.model });
    return r;
  };
  const lintOf = (post: string) => lintPost(post, { banned: deps.ctx.banned, entities });

  let result = await call(input);
  let lint = lintOf(result.post);
  let regenerated = false;
  if (lint.hard.length && dl.canRunOptional()) {
    deps.log({ note_id: noteId, stage: 'lint', ok: false, hard: lint.hard });
    result = await call({ ...input, previousDraft: result.post, lintViolations: lint.hard });
    lint = lintOf(result.post);
    regenerated = true;
  }
  deps.log({ note_id: noteId, stage: 'lint', ok: lint.hard.length === 0, hard: lint.hard, soft: lint.soft, regenerated });
  return { result, lint, regenerated };
}

export async function deliver(note: Note, draft: Draft, lint: LintResult, deps: PipelineDeps): Promise<Draft> {
  const chatId = note.chat_id!;
  try {
    const postIds = await sendParts(deps.tg, chatId, formatPost(draft.body), note.message_id ?? undefined);
    const card = formatReviewCard({ draft, lint, score: note.score, reason: note.reason, flags: note.flags, duplicateOf: note.duplicate_of });
    const cardIds = await sendParts(deps.tg, chatId, card, postIds[postIds.length - 1]);
    const saved = await deps.repo.updateDraft(draft.id, { post_message_id: postIds[0]!, card_message_id: cardIds[0]! });
    await deps.repo.updateNote(note.id, { status: 'drafted' }, ['passed']);
    deps.log({ note_id: note.id, stage: 'send', ok: true });
    return saved ?? draft;
  } catch (err) {
    await deps.repo.updateDraft(draft.id, { status: 'superseded', decision_reason: 'send_failed' }, ['pending']);
    throw err;
  }
}

/** Error path: note → failed, tell Meera, save error_message_id. Never throws. */
export async function failNote(note: Note, stage: string, err: unknown, deps: PipelineDeps): Promise<void> {
  deps.log({ note_id: note.id, stage, ok: false, err: errMessage(err) });
  try {
    const failed = await deps.repo.updateNote(note.id, { status: 'failed', failed_stage: stage }, ['received', 'passed']);
    if (!failed || note.chat_id === null) return;
    const id = await deps.tg.sendMessage(note.chat_id, formatError(stage), note.message_id ?? undefined);
    await deps.repo.updateNote(note.id, { error_message_id: id });
  } catch (e) {
    deps.log({ note_id: note.id, stage: 'error_path', ok: false, err: errMessage(e) });
  }
}
