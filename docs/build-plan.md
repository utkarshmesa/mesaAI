# Build plan: Meera LinkedIn Draft Bot

Status: **waiting for "go"** · 25 Sep 2026 · Source of truth: `PRD.md` v1.1. External-docs results are in `docs/decisions.md`.

## 1. The product in five lines

1. Meera drops raw content ideas into a private Telegram channel (or a DM), and that capture habit doesn't change.
2. For each note, code screens it (a word-count pre-filter, then Gemini rates the rubric criteria and **code** does the arithmetic, the novelty cap and the gate) and tells her in one line why a weak note won't be drafted.
3. Good notes go to Claude with her voice skill verbatim and her 3 real posts. Claude may use one checked Google News item, puts `[CHECK: …]` in place of missing facts, and returns a post that a deterministic lint then checks.
4. She gets two messages: the clean post to copy, and a review card (score, flags, checks, length, news verify block). She replies APPROVE / REJECT / REDO, and every note, draft and decision is kept for measurement.
5. **The Cut:** the system never publishes or schedules to LinkedIn. It has no credentials, no API code and no auto-post path. It stops at a *pending draft in Telegram*, and Meera publishes by hand. Her judgment on what goes out under her name stays hers.

## 2. Milestones: files, requirement IDs, tests

The test names carry requirement IDs (e.g. `R19 voice message gets text-only reply`). Pure modules get their tests written first.

### M0: Scaffold (pre-L3)
| | |
|---|---|
| **Req IDs** | none (tooling). Global DoD items: `.env` ignored, no secrets |
| **Files** | `package.json` (`type: module`; scripts `test`, `typecheck`, `eval`, `compare`, `webhook:set`, `voice:seed`), `tsconfig.json` (strict, `noUncheckedIndexedAccess`), `vitest.config.ts`, `.gitignore` (`.env`, `node_modules`, `.vercel`), `.env.example` (PRD §11 + model IDs from D1/D2), `vercel.json` (D3), `src/config.ts` (zod env schema; `TELEGRAM_ALLOWED_CHAT_IDS` → `string[]`; numeric coercions), `docs/progress.md`, `docs/ideas.md` |
| **Tests** | `tests/config.test.ts`: valid env parses; bad secret charset rejected; chat-ID list split and trimmed; `ANTHROPIC_API_KEY` empty → allowed |
| **Also** | `git init` in `meera-linkedin-bot/` (it isn't a repo yet); check with `git check-ignore .env` |

### M1: Note → draft, end to end (L3·1–3)
| | |
|---|---|
| **Req IDs** | R1, R2, R3, R4, R11, R14, R19 (plus R10 partly: `processed_updates` against memoryRepo) |
| **Files** | `api/webhook.ts`, `src/webhook.ts` (testable core of steps 1–5), `src/types.ts`, `src/router.ts`, `src/commands.ts` (HELP/START only; others stubbed, see A5), `src/pipeline/processNote.ts` (steps 1, 6, 7, 8, 9 + error path; see A3), `src/pipeline/lint.ts`, `src/pipeline/format.ts`, `src/pipeline/deadline.ts`, `src/context.ts` (loads voice skill, examples with the `Category:` line stripped, banned phrases, published index), `src/prompts/draft.ts` (`PROMPT_VERSION`, `buildDraftSystemPrompt`, `buildDraftUserPrompt`, `DraftResultSchema`), `src/llm/{index,gemini,anthropic}.ts`, `src/telegram.ts`, `src/db/repo.ts` (`Repo` interface + `memoryRepo`), `src/log.ts`, `scripts/set-webhook.ts` |
| **Tests** | `router.test.ts`: every decision-table row, **including** "Rejected a sample…" → pipeline (R1), caption-only photo → note (R19), voice → text-only (R19), reply to card with `approve` → command handler, service message → ignore, `REJECT: too long` with no reply and ≤3 words → fallback, bare `/start@MeeraBot` → bare command, non-command reply to card → HELP. `lint.test.ts`: every §7.3 rule (R11), `[CHECK:` count (R14), phrase-boundary cases (`thoughts?`, `unlocked` ≠ `unlock`). `format.test.ts`: card with/without flags, checks, news; M1 card without score; splitter on paragraph boundaries >4,096 (R4). `draftPrompt.test.ts`: system prompt contains `voice-skill.txt` **byte-for-byte**, has 3 `<example>` blocks with no `Category:` line, and the SHA-256 is stable (R3). `webhook.test.ts`: wrong secret → 401 (R2); other chat → 200 + no work (R2); `channel_post` and `message` are both accepted (R1); duplicate `update_id` → one draft (R10 partial). `processNote.test.ts` (fakes): happy path sends post then card as a reply (R4); hard lint → one regeneration only (R11); send failure → draft `superseded` + error message |
| **Manual** | Deploy, set env vars, `npm run webhook:set`, post note_01 |

### M2: Scoring and gate (B1·1)
| | |
|---|---|
| **Req IDs** | R5, R13 (published index) |
| **Files** | `src/pipeline/score.ts` (`computeScore`, `normaliseFlags`, `preFilter`, `gate`), `src/prompts/analyse.ts` (rubric §6.5 verbatim, `AnalysisSchema`, `PROMPT_VERSION`), `processNote.ts` gains steps 2–4 (added, not rewritten), `format.ts` gains `formatRejection`, `scripts/eval.ts` |
| **Tests** | `score.test.ts`: sum; **novelty 0 → capped at 5 (R13)**; category cap at 2 for logistics/venting/fragment; REPEAT ⇔ `duplicate_of` (R13); pre-filter on junk_02 = 0 LLM calls (R5). `processNote.test.ts`: below gate → rejection reply + `rejection_message_id` saved, no draft (R5); angle appended only when present |
| **Eval gate** | `npm run eval` meets every `expect` in `notes.json` **and** fails if every fixture passes the gate. Sign-off: I run it 3 times and all 3 must pass (A9) |
| **Manual** | Post junk_01 in Telegram → "No draft" reply |

### M3: News angle (B1·2)
| | |
|---|---|
| **Req IDs** | R6, R7 |
| **Files** | `src/pipeline/news.ts` (`buildNewsUrl`, `parseNewsRss` (pure), `fetchNews` with a 5 s timeout), `tests/fixtures/news-rss.xml` (a saved real feed), step 5 added to `processNote`, draft user prompt gets the `news[]` list, card news block |
| **Tests** | `news.test.ts`: parses the fixture into `{headline, source, date, url}`, strips " - Source", drops description, caps at 3 (R6); empty feed → `none`; malformed XML/timeout → `error`. `format.test.ts`: news block present iff `news_item_used != null`, includes the ⚠ line (R7). `processNote.test.ts`: news fetch throws → draft still delivered with `news_status='error'` (R6); `news_item_used` out of range → treated as null |
| **Manual** | Live note with a topical angle; simulate RSS being down with the `NEWS_FORCE_ERROR=1` test hook (A11) |

### M4: Persistence, commands, idempotency (B1·3)
| | |
|---|---|
| **Req IDs** | R8, R9, R10, R13 (last 20 drafts) |
| **Files** | `supabase/migrations/001_init.sql` (§8 + the chat-scoping fix, A4), `sql/metrics.sql`, `src/db/supabaseRepo.ts`, `scripts/seed-voice.ts`, `src/commands.ts` (APPROVE, REJECT with conditional updates + fallback resolution §6.6b), `sweepStale` added at the start of `handle`, voice loaded from the DB active row with file fallback, analyse input gets the first lines of the last 20 drafts |
| **Tests** | `commands.test.ts` (memoryRepo, same contract as Supabase): APPROVE pending → approved (R9); APPROVE twice → second reply "already approved", one transition (R10); REJECT keeps the row with its reason (R9); no-reply APPROVE with exactly one pending → resolves; with 0 or 2 pending → "Reply to the message you mean." `webhook.test.ts`: replaying the same note JSON and the same APPROVE JSON → one draft, one transition (R10). `sweep.test.ts`: note `passed` for 11 min without a draft → `failed`/`timeout` + message; 9 min → untouched. `repoContract.test.ts`: the same suite runs against memoryRepo (and against Supabase when `SUPABASE_TEST_URL` is set) |
| **Manual** | Supabase project, run the migration, `npm run voice:seed`, replay test with curl |

### M5: Provider switch + comparison (final 15 min)
| | |
|---|---|
| **Req IDs** | R12 |
| **Files** | `src/llm/index.ts` gets the explicit `DRAFT_PROVIDER` selection tests (the fallback already exists since M1, see A6), `scripts/compare-models.ts`, `docs/model-comparison.md`, `README.md` (≤ 10 setup steps), final requirement-ID coverage check |
| **Tests** | `llm.test.ts`: `DRAFT_PROVIDER=gemini` → gemini; `anthropic` + key → anthropic; `anthropic` + no key → gemini with a warning log (R12). `scripts/check-coverage.ts`: every R-ID of M0–M5 appears in a test name or eval check |
| **Manual** | `npm run compare -- note_01` needs both keys |

M6 (R15–R18, R22) is not planned in detail until you ask.

## 3. Routing (§6.3) as signatures, in `src/router.ts`, pure

```ts
export type TgMessage = {
  message_id: number; chat: { id: number; type: string };
  text?: string; caption?: string;
  reply_to_message?: { message_id: number };
  // service fields: pinned_message, new_chat_title, new_chat_members, ... (SERVICE_FIELDS)
  [k: string]: unknown;
};

export type ReplyTarget =
  | { kind: 'draft'; draft: Draft; via: 'post' | 'card' }
  | { kind: 'note';  note: Note;   via: 'rejection' | 'error' };

export type Command =
  | { name: 'APPROVE' } | { name: 'REJECT'; reason: string | null }
  | { name: 'REDO'; feedback: string | null } | { name: 'DRAFT ANYWAY' } | { name: 'RETRY' };
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
export const BARE_RE    = /^\/?(NEXT|STATS|HELP|START)(@\w+)?$/i;

export function messageBody(msg: TgMessage): string;           // (text ?? caption ?? "").trim()
export function isServiceMessage(msg: TgMessage): boolean;      // no text/caption AND has a SERVICE_FIELDS key
export function parseCommand(body: string): Command | null;
export function parseBareCommand(body: string): BareCommand | null;
export function wordCount(s: string): number;                   // B3
export function route(msg: TgMessage, replyTarget: ReplyTarget | null): Route;
```

Around it, in `src/webhook.ts` (I/O, fakes injected):
```ts
export async function handleWebhook(req: Request, deps: Deps, waitUntil: (p: Promise<unknown>) => void): Promise<Response>; // §6.2 steps 1–5
export async function handle(msg: TgMessage, deps: Deps, deadline: Deadline): Promise<void>;
//   → sweepStale (M4) → repo.findByBotMessageId(chatId, reply_to.message_id) → route → dispatch
export async function dispatch(r: Route, msg: TgMessage, deps: Deps, deadline: Deadline): Promise<void>;
```

## 4. Note pipeline (§6.4) as signatures

```ts
// src/pipeline/processNote.ts: orchestration only; each step is a named function
export async function processNote(msg: TgMessage, body: string, deps: PipelineDeps, dl: Deadline): Promise<void>;

// 1  INSERT note (unique chat_id+message_id). null → conflict → STOP
repo.insertNote(n: NewNote): Promise<Note | null>;
// 2  pure (M2)
export function preFilter(body: string, minWords: number): { pass: true } | { pass: false; reason: 'Too short to develop' };
// 3  LLM (M2) + pure post-processing
export async function analyseNote(llm: LLM, body: string, ctx: AnalyseContext, dl: Deadline): Promise<Analysis>;
export function computeScore(c: Criteria, category: Category): number;              // src/pipeline/score.ts
export function normaliseFlags(a: Analysis, publishedIds: Set<string>): Pick<Analysis, 'flags' | 'duplicate_of'>;
// 4  pure (M2)
export function gate(score: number, threshold: number): 'pass' | 'reject';
// 5  I/O, never throws (M3)
export async function fetchNews(phrase: string, cfg: NewsConfig): Promise<{ items: NewsItem[]; status: 'ok' | 'none' | 'error' }>;
export function parseNewsRss(xml: string, limit?: number): NewsItem[];                  // pure
// 6  LLM
export function buildDraftSystemPrompt(voiceSkill: string, examples: string[]): string;  // pure; sha256 logged per call
export async function draftPost(llm: LLM, input: DraftInput, dl: Deadline): Promise<DraftResult>;
// 7  pure + one regeneration
export function lintPost(post: string, opts: { entities: string[]; banned: string[] }): LintResult; // {hard, soft, check_count}
export async function draftWithLint(llm: LLM, input: DraftInput, ctx: LintCtx, dl: Deadline): Promise<{ result: DraftResult; lint: LintResult; regenerated: boolean }>;
// 8
repo.insertDraft(d: NewDraft): Promise<Draft>;
// 9  pure builders + send
export function formatPost(post: string): string[];                         // split ≤ 4,096
export function formatReviewCard(c: CardInput): string[];
export function formatRejection(score: number, reason: string, angle: string | null): string;
export async function deliver(tg: Telegram, repo: Repo, note: Note, draft: Draft, card: CardInput): Promise<void>;
// error path + sweep
export async function failNote(deps: PipelineDeps, note: Note, stage: Stage, err: unknown): Promise<void>;
export async function sweepStale(deps: PipelineDeps, now: Date): Promise<number>;           // M4

// Shared contracts
interface LLM { name: string; model: string;
  generateJSON<T>(schema: z.ZodType<T>, system: string, user: string, opts: { temperature?: number; timeoutMs: number; allowRetry: boolean }): Promise<T>; }
interface Deadline { remainingMs(): number; canRunOptional(): boolean /* ≥ 40 s left */; canStart(): boolean; }
```

## 5. Ambiguities and contradictions (the ones marked ⚠ change behaviour and need your answer)

| # | Issue | Proposed resolution |
|---|---|---|
| **A1** ⚠ | **Temperatures in PRD §7 (analyse 0.2, draft 0.7) can't be applied as written.** `claude-sonnet-5` **rejects** `temperature` with a 400, and Google says Gemini 3 should stay at 1.0 because lower values risk looping or degraded output. | Make temperature an optional per-call field that the adapter drops when the model doesn't accept it. Drafter: no temperature. Analyse: default temperature, `thinking_level: low`. Calibration stability is proven by eval (3 runs must all pass) instead of by low temperature. |
| **A2** ⚠ | **Own brand counts as an "entity".** The analyse prompt says to list every named company/brand, so "Skinstinct" gets listed, and the lint makes any entity in the post a *hard* violation. But the voice skill *requires* disclosing what Skinstinct does (step 6), and every example post names Skinstinct. | Code removes a fixed `SELF_ENTITIES = ["Skinstinct", "Meera", "Meera Pillai"]` from `entities` before lint. The prompt also says "exclude Skinstinct and Meera". The entity match is whole-word, case-insensitive. |
| **A3** ⚠ | **M1 step list "1, 6, 7, 9" has no step 8**, but step 9 saves the message IDs *on the draft*, so a draft row has to exist. Also, with no gate in M1, the note would jump `received → drafted`, which the state machine doesn't allow. The error path isn't in the list either. | M1 runs **1, 6, 7, 8, 9 + the error path**. Right after step 1 the note goes `received → passed` (the M1 "gate" is a pass-through), so the state machine holds. M2 inserts steps 2–4 in front of that transition. |
| **A4** ⚠ | **Bot-message lookup isn't scoped by chat.** Telegram `message_id`s are unique *per chat*, and the PRD allows a channel *and* a DM. `findByBotMessageId(reply_to.message_id)` can match a draft from the other chat, and `drafts` has no `chat_id`. | Look up by `(chat_id, message_id)`: join `drafts → notes.chat_id` (no new column), and scope the §6.6b fallbacks (single pending draft, most recent rejected note) to the same chat as well. Migration: add a `notes (chat_id, rejection_message_id)` / `(chat_id, error_message_id)` index. |
| **A5** ⚠ | **Commands before M4.** The router (M1) must send "approve" on a card to the command handler, but APPROVE/REJECT are R9 (M4), and NEXT/STATS/REDO/DRAFT ANYWAY/RETRY are M6. | M1–M3: HELP/START fully work. Every other command replies `That command isn't switched on yet.` and changes no state. APPROVE/REJECT go live in M4, and the rest in M6 (the same stub until then). |
| **A6** | **R12 is M5, but §11 already says that without an Anthropic key the drafter falls back to Gemini**, so both providers and the selection rule are needed from M1. | Build both adapters and `selectDrafter(config)` in M1 (needed for the fallback). M5 adds the R12 tests, the compare script and the write-up. The behaviour is the same either way. |
| **A7** | **Review card in M1** has no score or reason yet, and §6.8 has no line for **soft** lint findings, although §7.3 says "Soft → shown on the card". | M1 card: `DRAFT · #abc123` (no `· Score`, no `Why:`). From M2 on, the full format. Soft findings get a line `Style: 3 question marks, 4 em dashes`, placed under `Length:` and left out when there are none. Hard-after-regen findings go on `⚠ Lint: …` as the PRD says. |
| **A8** | **`novelty` vs `duplicate_of` can disagree** (e.g. novelty 2 with a duplicate set, or a `duplicate_of` that isn't a real published ID). | `normaliseFlags`: `duplicate_of` must be an ID in the published index (M4: or a recent draft, see A10), otherwise null. If novelty = 2, force `duplicate_of = null`. REPEAT ⇔ `duplicate_of != null`, as the PRD says. A novelty ≤ 1 with no duplicate is kept as it is and logged as `warn`. |
| **A9** | **"Eval meets every expectation"** with a non-deterministic model: one lucky run could pass. | `npm run eval` does one run by default and exits non-zero on any miss **or** when every fixture passes the gate. `npm run eval -- --runs 3` for M2 sign-off, and I'll report all 3 tables. |
| **A10** | **M4 novelty against the last 20 drafts**: `duplicate_of` is typed as "published id", but a repeat of a *draft* has no published ID. | The draft list is passed with IDs like `D-abc123`, so `duplicate_of` can be `D-abc123` and the card shows `REPEAT (D-abc123)`. Metrics are unaffected. |
| **A11** | **Simulating RSS failure in M3** (the "Done when" asks for it), but the PRD gives no mechanism. | Unit test with a throwing fake, plus for the live check an env `NEWS_FORCE_ERROR=1` that makes `fetchNews` return `error` without a network call. Documented as test-only. |
| **A12** ⚠ | **Google News RSS terms**: the feed says it's for "personal, non-commercial use" in a feed reader. Meera uses it for a commercial brand. | Not a code decision. I'll build it as specified (R6 is P0). **Your call** whether to accept this, or later swap in a licensed news API behind the `News` interface (no pipeline change). Logged in `docs/ideas.md`. |
| **A13** | **Rule 4 "≤ 3 words"**: an unreplied `REJECT: not my voice` (4 words) becomes a **note**, which the pre-filter then rejects as "Too short to develop" (harmless, but noise in `notes`). `APPROVE.` with a trailing full stop doesn't match either, and becomes HELP (if it's a reply) or a note. | Keep the PRD exactly as written. It's the safety valve that keeps real notes from being eaten as commands. I'll mention in HELP text: "Reply to the draft when you add a reason." |
| **A14** | **"Top 3 recent items"**: is that feed order (relevance) or newest by `pubDate`? | Feed order, since `when:30d` already bounds recency, and I'll keep items with no `pubDate` last. |
| **A15** | **Message 1 split** (post > 4,096 after a failed lint, extremely unlikely): which part is `post_message_id`? | The first part's ID is stored, and the card replies to the last part. |
| **A16** | **Latency metric and RETRY** (M4 view, M6 feature): RETRY's first draft would count a large latency. | `failed_stage` is **not cleared** on RETRY, and the view excludes notes with `failed_stage is not null` from p95. Only matters once M6 ships; I'm noting it now so the view is right at M4. |
| **A17** | **Repo layout**: the parent folder has a duplicate `PRD.md` and a `Mesa Assignment/` folder with PDFs and notes. | The git repo root = `meera-linkedin-bot/` only. Nothing outside it is committed. |

Things I checked and found **consistent** (no action): the command regex correctly treats "Rejected a sample…" and "Redo the whole…" as non-commands; the repeat cap (≤ 5) is always below the gate (6); the category cap (≤ 2) satisfies "junk ≤ 3"; junk_02 has 8 counted words (< 12), so it's pre-filtered; Hobby's 300 s gives the full 240 s budget.

## 6. External checks → `docs/decisions.md`

| Item | Result |
|---|---|
| Anthropic model ID | `claude-sonnet-5`. **No `temperature`** (400), adaptive thinking, structured outputs via `output_config.format` (D1) |
| Gemini model ID | `gemini-3.8-flash` (stable). Temperature should stay at 1.0, use `thinking_level` (D2). SDK field names finalised by compiler in M1 |
| Vercel Hobby | Fluid on by default, `maxDuration` 300 s max, so the budget = 240 s, A3 holds (D3) |
| `waitUntil` | Same timeout as the function, cancelled on timeout. `getDeadline()` available and used (D4) |
| Telegram `secret_token` | 1–256 chars `[A-Za-z0-9_-]`, header `X-Telegram-Bot-Api-Secret-Token`. Retries on non-2xx (D5) |
| Google News RSS | Format confirmed live, `<source>` element used. Terms flag (D6 / A12) |

## 7. What I need from you before M1 (not needed for M0)

Telegram bot token + channel ID (bot is an admin with Post Messages) · Gemini API key · a Vercel project linked to a GitHub repo · a webhook secret (`openssl rand -hex 24`). Anthropic key optional until M5, Supabase from M4.
