// PRD §6.4 note pipeline: orchestration only. Each step is a small named function.
import type { ContextBundle } from '../context.js';
import type { Repo } from '../db/repo.js';
import type { LLM } from '../llm/index.js';
import { type Logger, errMessage } from '../log.js';
import { type DraftInput, type DraftResult, DraftResultSchema, PROMPT_VERSION, buildDraftSystemPrompt, buildDraftUserPrompt, sha256 } from '../prompts/draft.js';
import { type Telegram, sendParts } from '../telegram.js';
import type { Draft, LintResult, NewsItem, Note, TgMessage } from '../types.js';
import { type Deadline, callTimeout } from './deadline.js';
import { ANALYSE_SYSTEM, AnalysisSchema, buildAnalyseUserPrompt } from '../prompts/analyse.js';
import { formatError, formatPost, formatRejection, formatReviewCard, shortId } from './format.js';
import { lintPost } from './lint.js';
import type { News, NewsFetch } from './news.js';
import { gate, preFilter, scoreAnalysis } from './score.js';

export const LLM_TIMEOUT_MS = 60_000;
const MIN_TO_START_MS = 10_000;

export interface PipelineDeps {
  repo: Repo;
  tg: Telegram;
  analyseLLM: LLM;
  draftLLM: LLM;
  news: News;
  ctx: ContextBundle;
  settings: { scoreThreshold: number; minNoteWords: number };
  log: Logger;
}

type Stage = 'received' | 'analyse' | 'draft' | 'save' | 'send';

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
    // 2. PRE-FILTER (no LLM).
    const pre = preFilter(note.text, deps.settings.minNoteWords);
    if (!pre.pass) return await reject(note, { score: 0, reason: pre.reason }, deps);

    // 3. ANALYSE (1 LLM call; code computes the score).
    const scored = await step('analyse', () => analyseNote(note, deps, dl));
    const analysed = await step('analyse', () => deps.repo.updateNote(note.id, scored, ['received']));
    if (!analysed) return;

    // 4. GATE.
    if (gate(scored.score, deps.settings.scoreThreshold) === 'reject') return await reject(analysed, scored, deps);
    const passed = await step('analyse', () => deps.repo.updateNote(note.id, { status: 'passed' }, ['received']));
    if (!passed) return;

    // 5. NEWS (no LLM; failure never blocks drafting).
    const news = await fetchNews(passed, deps);

    await draftAndDeliver(passed, news.items, news.status, deps, dl);
  } catch (err) {
    await failNote(note, err instanceof StageError ? err.stage : 'received', err, deps);
  }
}

export async function analyseNote(note: Note, deps: PipelineDeps, dl: Deadline) {
  requireTime(dl);
  const t0 = Date.now();
  // Novelty is checked against the published index and the first lines of the last 20 drafts (R13).
  const priors = (await deps.repo.recentDrafts(20)).map((d) => ({ id: `D-${shortId(d.id)}`, first_line: d.body.split('\n')[0]!.slice(0, 200) }));
  const a = await deps.analyseLLM.generateJSON(AnalysisSchema, ANALYSE_SYSTEM, buildAnalyseUserPrompt(note.text, deps.ctx.published, priors), {
    timeoutMs: callTimeout(dl, LLM_TIMEOUT_MS),
    allowRetry: dl.canRunOptional(),
    thinkingLevel: 'low',
  });
  const scored = scoreAnalysis(a, new Set([...deps.ctx.published.map((p) => p.id), ...priors.map((p) => p.id)]));
  deps.log({ note_id: note.id, stage: 'analyse', ms: Date.now() - t0, ok: true, model: deps.analyseLLM.model, score: scored.score });
  return scored;
}

export async function fetchNews(note: Note, deps: PipelineDeps): Promise<NewsFetch> {
  if (!note.search_phrase) return { items: [], status: 'none' };
  const t0 = Date.now();
  const r = await deps.news.fetch(note.search_phrase).catch((): NewsFetch => ({ items: [], status: 'error' }));
  deps.log({ note_id: note.id, stage: 'news', ms: Date.now() - t0, ok: r.status !== 'error', status: r.status, count: r.items.length });
  return r;
}

/** Rejection (pre-filter or gate): status → rejected, reply to the note, save rejection_message_id. */
async function reject(note: Note, r: { score: number; reason: string; suggested_angle?: string | null }, deps: PipelineDeps): Promise<void> {
  const updated = await deps.repo.updateNote(note.id, { status: 'rejected', score: r.score, reason: r.reason }, ['received']);
  if (!updated || note.chat_id === null) return;
  try {
    const id = await deps.tg.sendMessage(note.chat_id, formatRejection(r.score, r.reason, r.suggested_angle ?? null), note.message_id ?? undefined);
    await deps.repo.updateNote(note.id, { rejection_message_id: id });
    deps.log({ note_id: note.id, stage: 'reject', ok: true, score: r.score });
  } catch (err) {
    deps.log({ note_id: note.id, stage: 'reject', ok: false, err: errMessage(err) });
  }
}

/** Steps 6–9 for a note that is `passed`. */
export async function draftAndDeliver(note: Note, news: NewsItem[], newsStatus: NewsFetch['status'], deps: PipelineDeps, dl: Deadline): Promise<Draft> {
  // 6 + 7. DRAFT and LINT (one regeneration on hard violations).
  const input: DraftInput = { note: note.text, flags: note.flags, suggestedAngle: note.suggested_angle, news };
  const voice = await step('draft', () => loadVoice(deps));
  const { result, lint } = await step('draft', () => draftWithLint(note.id, input, note.entities, voice, deps, dl));
  const chosen = pickNews(result.news_item_used, news);

  // 8. INSERT draft (pending).
  const draft = await step('save', () =>
    deps.repo.insertDraft({
      note_id: note.id,
      body: result.post,
      news: chosen,
      news_status: chosen ? 'used' : newsStatus === 'ok' ? 'unused' : newsStatus,
      model: `${deps.draftLLM.name}:${deps.draftLLM.model}`,
      voice_version: voice.version,
      prompt_version: PROMPT_VERSION,
      lint,
    }),
  );

  // 9. SEND post, then card as a reply to it.
  return step('send', () => deliver(note, draft, lint, deps));
}

export interface Voice {
  version: string;
  content: string;
}

/** Active DB voice_skill row takes precedence; context/voice-skill.txt is the fallback. */
export async function loadVoice(deps: PipelineDeps): Promise<Voice> {
  return (await deps.repo.activeVoice()) ?? { version: deps.ctx.voiceVersion, content: deps.ctx.voiceSkill };
}

export function pickNews(i: number | null, news: NewsItem[]): NewsItem | null {
  return i !== null && Number.isInteger(i) && i >= 1 && i <= news.length ? news[i - 1]! : null;
}

export async function draftWithLint(
  noteId: string,
  input: DraftInput,
  entities: string[],
  voice: Voice,
  deps: PipelineDeps,
  dl: Deadline,
): Promise<{ result: DraftResult; lint: LintResult; regenerated: boolean }> {
  const system = buildDraftSystemPrompt(voice.content, deps.ctx.examples);
  const call = async (inp: DraftInput) => {
    requireTime(dl);
    const t0 = Date.now();
    // Debug proof that the voice reaches the model: hash of the exact system prompt sent.
    deps.log({ note_id: noteId, stage: 'draft_call', ok: true, model: deps.draftLLM.model, system_sha256: sha256(system), voice_version: voice.version, prompt_version: PROMPT_VERSION });
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

export const STALE_AFTER_MS = 10 * 60_000;

/** PRD §6.2: notes stuck in received/passed for 10+ minutes were killed mid-run → failed at 'timeout'. */
export async function sweepStale(deps: PipelineDeps, now = new Date()): Promise<number> {
  const stale = await deps.repo.listStaleNotes(new Date(now.getTime() - STALE_AFTER_MS));
  for (const note of stale) await failNote(note, 'timeout', new Error('stale'), deps);
  return stale.length;
}
