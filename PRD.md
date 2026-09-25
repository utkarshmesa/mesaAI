# PRD: Meera LinkedIn Draft Bot ("Skinstinct Drafts")

| | |
|---|---|
| **Status** | Ready for build · v1.1 (post-TPM review) · 25 Sep 2026 |
| **Owner (product)** | Utkarsh (Founder's Office, Cohort C4) |
| **End user** | Meera Pillai, founder of Skinstinct (single user) |
| **Builder** | Claude Code |
| **Context files** | `context/voice-skill.txt`, `context/examples/*.txt`, `context/published-index.json`, `tests/fixtures/notes.json` |

---

## 1. Problem

Meera captures 2–3 content ideas a week in a private Telegram channel. In 8 months, 60 notes produced 0 posts. Her 40 Drive drafts were abandoned after two lines. The bottleneck is **the stall between capturing an idea and having a shaped first draft**, not ideas or writing skill. ("I open the doc, I write two lines, I decide it's not good enough, I close it.") A hired writer failed because the posts were correct but didn't argue the way she does.

Content is her growth channel: 4 posts brought 47K impressions, and one post brought 340 profile visits and 3 wholesale enquiries. She has not posted in 11 weeks.

**Product thesis:** if every good note comes back as a draft that already sounds like her, within a minute and in the place she already writes, then her job goes from *writing* to *editing and approving*, and 3 posts a week becomes realistic.

## 2. Goals, non-goals, and the Cut

**Goals**
- G1. Turn each worthwhile note into a LinkedIn draft in Meera's voice, delivered back in Telegram.
- G2. Filter out notes that aren't worth drafting, and tell her why in one line.
- G3. Where it helps, give the draft a current news angle, with the source always shown for her to verify.
- G4. Record every note, draft and decision so we can measure quality and improve it.

**Non-goals (v1)**
- **NG1. THE CUT: no publishing or scheduling to LinkedIn, ever.** The system has no LinkedIn credentials and no LinkedIn API code. Meera copies the text and publishes it herself. (Nine Checks → Check 07 "Judgment Protected" fails for end-to-end automation. She turned down two consultants for exactly this reason.)
- NG2. Multiple users, a web dashboard, or an editing UI.
- NG3. Transcribing voice notes (v1 replies "text only". P2).
- NG4. Images or carousels for posts.
- NG5. Posting to other platforms (newsletter, Instagram).

## 3. Success metrics

| Type | Metric | Baseline | Target (4 weeks after launch) | Source |
|---|---|---|---|---|
| **North star** | Posts Meera publishes per week (approved drafts as a proxy) | ~0.1/week | **3/week** | `drafts.status='approved'` per ISO week |
| Guardrail | Approval rate (approved ÷ decided drafts) | n/a | ≥ 60% | `drafts` |
| Guardrail | Meera's active time per week | 90–180 min per post | ≤ 15 min/week (self-reported, weekly check-in) | Survey |
| Guardrail | Time from note to draft (p95) | n/a | ≤ 60 s | `drafts.created_at − notes.created_at` |
| Guardrail | Drafts published with a false claim | n/a | **0** | Meera reports it. Every news claim carries a verify block |
| Diagnostic | Scorer pass rate | n/a | 40–70% (outside this range → recalibrate) | `notes` |
| Diagnostic | Voice lint violations at delivery | n/a | 0 hard violations | `drafts.lint_violations` |

`sql/metrics.sql` defines a `weekly_metrics` view that computes these (§9). **Definitions:**
- Weeks are ISO weeks in `Asia/Kolkata`.
- "Decided" = `approved` + `rejected`. `superseded` drafts are excluded.
- Note→draft latency counts only each note's **first** draft where `notes.source='telegram'` and `override=false`. REDO, NEXT and DRAFT ANYWAY drafts are excluded.

## 4. User & core flows

**Persona.** Meera is a technical founder. She's on her phone, captures between tasks, and reviews in short windows. She won't change her capture habit. She is sensitive to generic "LinkedIn voice" and to any claim she hasn't checked.

**Flow A: Note → draft (happy path)**
1. Meera posts a text note in her private channel.
2. Within 60 s the bot posts **two messages** in the channel:
   - **Message 1, the post:** clean draft text only, so she can copy it straight into LinkedIn.
   - **Message 2, the review card** (a reply to Message 1): score, reason, risk flags, `[CHECK]` count, character count, the NEWS VERIFY block (if news was used), and the reply options.
3. Meera replies to either message with `APPROVE`, `REJECT: <optional reason>` or `REDO: <feedback>`.
4. The bot confirms in one line and updates the status.

**Flow B: Note rejected by the scorer**
The bot replies to the note: `No draft (score 4/10): <reason>. Try: <suggested angle>`. She can override by replying `DRAFT ANYWAY` to that message.

**Flow C: Backlog (P1)**
Meera (or Utkarsh) imports the 60 historical notes with a script. They are scored and stored as `backlog`, and none are drafted yet. Sending `NEXT` drafts the highest-scoring backlog note that hasn't been drafted. This fills the gap between ~10 new notes a month and the 12 drafts she needs.

## 5. Scope & priorities

| ID | Requirement | Priority | Milestone |
|---|---|---|---|
| R1 | Receive notes from the private channel (`channel_post`) **and** from a DM (`message`) | P0 | M1 |
| R2 | Authenticate the webhook (secret header) and allow only the configured chat ID | P0 | M1 |
| R3 | Draft in Meera's voice using the voice skill + few-shot examples | P0 | M1 |
| R4 | Return the draft to the same chat | P0 | M1 |
| R5 | Score the note (0–10) against a rubric. Below the threshold → rejection message and no draft | P0 | M2 |
| R6 | Pull a search phrase from the note → Google News RSS → top 3 recent items → the drafter decides whether one fits | P0 | M3 |
| R7 | Mandatory NEWS VERIFY block whenever a news item is used | P0 | M3 |
| R8 | Persist notes, drafts, voice-skill versions in Supabase | P0 | M4 |
| R9 | APPROVE / REJECT via reply. Status persists. Nothing is ever deleted | P0 | M4 |
| R10 | Idempotency: a repeated Telegram update (note **or** command) never produces a second draft or state change | P0 | M4 (M1–M3: rely on the fast ack) |
| R11 | Voice lint (deterministic) + one regeneration if hard violations are found | P0 | M1 |
| R12 | Drafter provider can be switched (`DRAFT_PROVIDER=gemini\|anthropic`) + a model-comparison script | P0 | M5 |
| R13 | Novelty check against `published-index.json` (M2) + the last 20 drafts (M4) | P0 | M2/M4 |
| R14 | `[CHECK: …]` placeholders instead of invented facts, and a count shown on the review card | P0 | M1 |
| R15 | `REDO: <feedback>` regenerates the draft (max 3 per note). The previous draft becomes `superseded` | P1 | M6 |
| R16 | `DRAFT ANYWAY` overrides a scorer rejection | P1 | M6 |
| R17 | Backlog import script + `NEXT` command | P1 | M6 |
| R18 | `STATS` command: this week's weekly_metrics row | P1 | M6 |
| R19 | Non-text messages (voice, sticker, photo without caption) → reply "Text notes only for now". A caption counts as a note | P0 | M1 |
| R22 | `RETRY` on a failed note | P1 | M6 |
| R20 | Transcribe voice notes | P2 | — |
| R21 | Weekly digest message (Monday: pending drafts + stats) | P2 | — |

## 6. System design

### 6.1 Stack (one job per tool)

| Concern | Choice | Why |
|---|---|---|
| Runtime | **TypeScript, Node 20+, Vercel Functions** (`api/webhook.ts`) | Native to Vercel. Type safety for the JSON contracts |
| Telegram | Raw Bot API via `fetch` (no SDK) | 3 endpoints needed. Zero dependency weight |
| Scoring + search phrase | **Gemini Flash** (`GEMINI_MODEL`) | Cheap, fast classification. **One call** returns score + search phrase |
| Drafting | **Claude** (`ANTHROPIC_MODEL`) by default. Gemini as fallback/comparison | Holds a long-form voice better (course B1 finding) |
| News | Google News RSS (no key) | Free, no account |
| Storage | Supabase Postgres (`@supabase/supabase-js`, service-role key, server only) | Free, persistent, SQL for metrics |
| Validation | `zod` for env + every LLM JSON response | Fail loudly, not silently |
| RSS parsing | `fast-xml-parser` | Small, no native deps |
| Tests | `vitest` | Fast, TS-native |

> **Model IDs change.** Before coding, Claude Code must check the current model IDs in the Google AI and Anthropic docs and put them in `.env.example`. Defaults are env-driven and never hard-coded.

### 6.2 Request lifecycle

```
POST /api/webhook
 ├─ 1. Check header X-Telegram-Bot-Api-Secret-Token == TELEGRAM_WEBHOOK_SECRET   else 401
 ├─ 2. Parse update → msg = update.channel_post ?? update.message               else 200 (ignore)
 ├─ 3. String(msg.chat.id) ∈ TELEGRAM_ALLOWED_CHAT_IDS (comma list: channel -100… and/or
 │     Meera's DM chat id)                                                     else 200 (ignore, log)
 ├─ 4. INSERT processed_updates(update_id) — unique conflict → 200, STOP     ← idempotency for ALL updates
 ├─ 5. Return 200 immediately; continue in waitUntil(handle(msg, deadline))   ← stops Telegram retrying
 └─ handle: sweepStale() → replyTarget = repo.findByBotMessageId(msg.reply_to_message?.message_id)
            → route(msg, replyTarget) by the decision table (§6.3)
```
- `set-webhook` passes `allowed_updates=["message","channel_post"]`, so edits and member updates are never delivered.
- `vercel.json`: `maxDuration` = the highest value the free plan allows (expected 300 s with fluid compute; check the docs), and `includeFiles: "context/**"`. Claude Code must check the current Vercel limits and the `waitUntil` API (`@vercel/functions`).
- **Deadline budget.** `deadline = start + min(maxDuration − 20 s, 240 s)`. Before each LLM call, if the remaining time is under 40 s, skip the optional work: no JSON-retry and no lint regeneration. If a required step can't start, go to the error path.
- **Stale sweep.** At the start of every `handle`, find notes in `received`/`passed` that are older than 10 minutes with no draft. Mark them `failed` (`failed_stage='timeout'`) and send "Something failed at timeout. Your note is saved." This covers functions that Vercel killed.

### 6.3 Update routing: decision table (evaluated top to bottom, first match wins)

`route(msg, replyTarget)` is a **pure function**. `replyTarget` is looked up beforehand: it is the draft or note whose `post_message_id`, `card_message_id`, `rejection_message_id` or `error_message_id` equals `msg.reply_to_message.message_id`, or `null`. That lookup is the only definition of "a bot message". (In channels, `reply_to_message` has `sender_chat`, not `from.is_bot`. Bots never receive their own sent messages as updates, so no loop guard is needed.)

`body = (msg.text ?? msg.caption ?? "").trim()`. Command regex (case-insensitive, whole message): `^(APPROVE|REJECT|REDO|DRAFT ANYWAY|RETRY)\b\s*(?::\s*(.*))?$`. Bare commands: `^/?(NEXT|STATS|HELP|START)(@\w+)?$`.

| # | Condition | Action |
|---|---|---|
| 1 | Service message (no `text`, no `caption`, and has `pinned_message`, `new_chat_title`, etc.) | Ignore |
| 2 | `body` empty (voice, sticker, photo without caption, document) | Reply "Text notes only for now. Send the note as text." |
| 3 | `body` matches the command regex **and** `replyTarget != null` | → **Command handler** (§6.6) on `replyTarget` |
| 4 | `body` matches the command regex, `replyTarget == null`, and `body` has ≤ 3 words | → Command handler with fallback resolution (§6.6 b) |
| 5 | `body` matches the bare-command regex | → Command handler (NEXT / STATS / HELP) |
| 6 | `replyTarget != null` and not a command | Reply with the HELP text (no state change) |
| 7 | Anything else (including notes that happen to start with "Rejected…" or "Redo…") | → **Note pipeline** (§6.4) |

### 6.4 Note pipeline

```
1. INSERT note (chat_id, message_id UNIQUE) status='received'
      on unique conflict → STOP (second line of defence after processed_updates)
2. PRE-FILTER (deterministic, no LLM): word_count(body) < MIN_NOTE_WORDS (12)
      → status='rejected', score=0, reason='Too short to develop'. Reply (Flow B),
        save rejection_message_id. STOP
3. ANALYSE (Gemini Flash, 1 call) → AnalysisResult (§7.1)
      score = computeScore(criteria, category)   ← CODE computes it, never the model
      flags = normaliseFlags(flags, duplicate_of) ← code: REPEAT ⇔ duplicate_of != null
      save category, score, criteria, reason, flags, duplicate_of, suggested_angle,
           search_phrase, entities
4. GATE: score < SCORE_THRESHOLD (6)
      → status='rejected'. Reply "No draft (score X/10): <reason>." + (if suggested_angle)
        " Try: <angle>". Save rejection_message_id. STOP
      else status='passed'
5. NEWS (no LLM): fetch RSS for search_phrase + NEWS_WINDOW, top 3 items, 5 s timeout.
      Keep only {headline (title minus the trailing " - Source"), source, date, url (the
      news.google.com link as-is)}. The <description> field is HTML links, so drop it.
      failure/empty → news=[] and news_status='none'|'error' (never blocks drafting)
6. DRAFT (Claude, 1 call) → DraftResult (§7.2)
      inputs: voice skill (active DB version, file fallback) + 3 examples + note +
              flags + news[] + (REDO feedback, if any)
7. LINT (deterministic, §7.3)
      hard violations → regenerate ONCE with the violations listed; lint again
      still failing → deliver anyway with a "⚠ Lint: …" line on the review card
8. INSERT draft status='pending' (with voice_version, prompt_version, model, lint result)
9. SEND Message 1 (post) → SEND Message 2 (review card, reply_to Message 1)
      save both telegram message ids on the draft; note.status='drafted'
      if either send fails after 1 retry → draft.status='superseded' (decision_reason=
      'send_failed'), then the error path
ERROR at any step (from received or passed) → note.status='failed', failed_stage=<step>;
      reply "Something failed at <stage>. Your note is saved." (+ " Reply RETRY to this
      message." once R22 ships). Save error_message_id.
```

### 6.5 Score computation (deterministic)

The model rates criteria. Code adds them up.

| Criterion | Range | 0 | Top of range |
|---|---|---|---|
| `specificity` | 0–3 | No concrete event, number or mechanism | A first-hand event with specifics (numbers, process, outcome) |
| `clear_point` | 0–3 | No discernible point | One clear, stateable lesson |
| `novelty` | 0–2 | **0** = same core claim as a published item and no new first-hand anecdote or angle. **1** = same core claim, but a new first-hand anecdote or a clearly new angle | **2** = a core claim she hasn't published |
| `reader_value` | 0–2 | Nothing the reader can use | A reader can act on or check something |

```
score = specificity + clear_point + novelty + reader_value      // 0..10
if novelty == 0: score = min(score, 5)                          // repeat cap → always below the gate
if category in {logistics, venting, fragment}: score = min(score, 2)
```
`flags` (they don't change the score; they're shown on the review card and passed to the drafter):
- `LEGAL`: the note describes a third party (supplier, manufacturer, brand) falling short, whether or not it's named.
- `PRIVACY`: the note concerns a specific real customer or person's situation, even if unnamed.
- `MEDICAL`: the note involves a skin condition, symptom or treatment.
- `REPEAT`: set **by code** if and only if `duplicate_of != null`. The model sets `duplicate_of` whenever `novelty ≤ 1`, pointing to the published item with the same core claim.

Calibration against `tests/fixtures/notes.json` (must pass before M2 is done):
- note_01 and note_02 ≥ 7. note_02 carries PRIVACY.
- note_05 ≤ 5 (novelty 0 → capped), REPEAT/NL-009, with a suggested angle.
- All junk ≤ 3 (junk_02 is rejected by the pre-filter with no LLM call).
- note_03 carries LEGAL + REPEAT with `duplicate_of = NL-008`. Pass or reject is acceptable (novelty 0 or 1).
- note_04 ≥ 5 with MEDICAL.
- If every fixture passes the gate, the rubric is too lenient and the milestone fails.

### 6.6 Commands

Target resolution: (a) `replyTarget` from §6.2 (a draft via post/card message id, or a note via rejection/error message id). (b) No reply (routing rule 4 only): APPROVE/REJECT/REDO → the single `pending` draft if exactly one exists. DRAFT ANYWAY/RETRY → the most recent rejected/failed note if it is < 24 h old. (c) Otherwise → "Reply to the message you mean."

**Concurrency rule:** every state transition is a conditional update, `update … set status=$new where id=$id and status=$expected returning *`. The action only continues if a row came back. Otherwise it replies `That draft is already <status>.` So two simultaneous REDOs can't both run.

| Command | Precondition | Effect | Bot reply |
|---|---|---|---|
| `APPROVE` | draft is `pending` | status→`approved`, `decided_at=now()` | `✓ Approved. Copy Message 1 into LinkedIn when ready.` |
| `REJECT[: reason]` | draft is `pending` | status→`rejected`, `decision_reason` | `✓ Rejected. Kept for learning.` |
| `REDO: feedback` (P1) | draft `pending` and `draft.redo_count < 3` | old→`superseded`. Re-run steps 6–9 (reusing the stored news) with the feedback. The new draft gets `redo_count = old.redo_count + 1` | New draft pair, or `Redo limit reached (3). Edit this one by hand.` |
| `DRAFT ANYWAY` (P1) | target is a `rejected` note | Set override=true. If `criteria` is null (pre-filter reject), run step 3 without the gate. Then note→`passed` and steps 5–9 | Draft pair |
| `RETRY` (R22, P1) | target is a `failed` note | note→`received`, re-run the pipeline from step 2 | Draft pair or rejection |
| `NEXT` (P1) | ≥ 1 note with `status='backlog'` and `score ≥ SCORE_THRESHOLD` | Highest score (ties → oldest) → note `passed` → steps 5–9 | Draft pair, or "No backlog notes above the threshold" |
| `STATS` (P1) | — | Read `weekly_metrics` for the current week | 4-line summary |
| `HELP`, `/start` | — | — | Command list |
| Any command on a non-pending draft | — | No state change | `That draft is already <status>.` |

### 6.7 State machines

```
note:  received → rejected                          (pre-filter or gate)
       received → passed → drafted
       received → failed ;  passed → failed         (error path or stale sweep)
       failed   → received                          (RETRY, P1)
       backlog  → passed → drafted                  (NEXT, P1)
       rejected → passed → drafted                  (DRAFT ANYWAY, P1)
       drafted  → drafted                           (REDO creates a new draft; the note keeps its state)

draft: pending → approved | rejected | superseded   (terminal; rows never deleted)
```

### 6.8 Telegram message formats

**Message 1 (post):** only the post text. No prefix, no suffix. Plain text (no `parse_mode`, so there's nothing to escape).

**Message 2 (review card):**
```
DRAFT · #<draft_short_id> · Score 8/10
Why: <reason>
Flags: LEGAL, REPEAT (NL-008)            ← line omitted if no flags
Checks needed: 2 [CHECK] items            ← omitted if 0
Length: 2,640 / 3,000 chars
─────────────────────────────────
NEWS SOURCE: <headline>
FROM: <publication> · <date>
LINK: <url>
⚠ Check this before publishing — you are the author of this claim
─────────────────────────────────         ← news block only if news_item_used != null
Reply: APPROVE · REJECT: reason · REDO: what to change
```
Any message over 4,096 chars is split on paragraph boundaries (unlikely, but it must be handled).

## 7. AI contracts

All prompts live in `src/prompts/*.ts` and export `PROMPT_VERSION`. Every LLM response is JSON, validated with zod. On a parse or validation failure: retry once with "Return valid JSON only matching the schema." If it fails a second time, the step fails (§6.4 error path). Temperatures: analyse 0.2, draft 0.7.

### 7.1 Analyse (Gemini Flash)

**System:** You are the editorial screener for Meera Pillai's LinkedIn. Rate the note using the rubric (§6.5 table, included verbatim). Compare it against the published index. A note repeats a published item only if it has the same core claim AND the same anecdote. The same broad topic is not a repeat. Categorise it as `insight | logistics | venting | fragment`. If novelty ≤ 1 or the score would fall below the threshold, suggest one concrete new angle she hasn't published. Produce a 3–6 word news search phrase about the underlying industry topic, never a brand or person.
Also list every named person, company, brand or supplier in the note as `entities` (not ingredients or technical terms).
**Input:** note text, `published-index.json` items, and from M4 the first lines of the last 20 drafts. (M2–M3 test novelty against the published index only.)
**Output schema:**
```ts
{
  category: "insight" | "logistics" | "venting" | "fragment",
  criteria: { specificity: 0|1|2|3, clear_point: 0|1|2|3, novelty: 0|1|2, reader_value: 0|1|2 },
  reason: string,                 // ≤ 20 words, written to Meera
  flags: ("LEGAL"|"PRIVACY"|"MEDICAL"|"REPEAT")[],
  duplicate_of: string | null,    // published id, e.g. "NL-008"
  suggested_angle: string | null, // ≤ 25 words
  search_phrase: string,          // 3–6 words
  entities: string[]              // named people/companies/brands in the note; [] if none
}
```

### 7.2 Draft (Claude default)

**System** = `voice-skill.txt` (verbatim) + the three example posts, each wrapped in `<example>` + these rules:
1. Write one LinkedIn post from Meera's note. Keep her point. Don't invent a different one.
2. Use only facts from the note or the chosen news item. For any missing fact write `[CHECK: what's needed]`.
3. News: use at most one item, and only if it is directly relevant to the note's point. Otherwise set `news_item_used: null`. Never let the news become the main subject. You only have the headline, source and date. Any claim about the article beyond what the headline says must be written as `[CHECK: …]`.
4. Flags: LEGAL → name no third party and imply no intent. PRIVACY → anonymise fully. MEDICAL → no diagnosis or treatment advice; suggest seeing a dermatologist where a condition is involved. REPEAT → take the suggested angle, not the published one.
5. Length: 2,200–2,900 characters. Hard cap 3,000.
6. If REDO feedback is present, apply it and keep everything else that worked.

**User:** note, flags, suggested_angle, news items `[{i, headline, source, date}]`, optional redo feedback + previous draft.
**Output schema:** `{ post: string, news_item_used: number | null }`

### 7.3 Voice lint (deterministic, `src/pipeline/lint.ts`)

| Rule | Severity |
|---|---|
| Length > 3,000 chars | hard |
| Any emoji (Unicode `\p{Extended_Pictographic}`) | hard |
| Any hashtag (`(^|\s)#\w`) | hard |
| Any `!` | hard |
| Lines starting with `-`, `•`, `*`, or `\d+\.` (lists) | hard |
| Any phrase from `context/banned-phrases.json` (case-insensitive, whole-phrase match. Only this lexical list is linted; non-lexical rules in the voice skill are enforced by the prompt) | hard |
| Any string in the note's `entities` (from analyse) appears in the post (case-insensitive) | hard |
| > 2 question marks | soft |
| > 3 em dashes (—) | soft |
| Length < 1,800 chars | soft |
| `[CHECK:` count | info (shown on card) |

Hard violations → one regeneration with the list of violations appended. Soft → shown on the card only.

## 8. Data model (Supabase, `supabase/migrations/001_init.sql`)

```sql
create table voice_skill (
  id uuid primary key default gen_random_uuid(),
  version text not null unique,           -- e.g. '1.0.0'
  content text not null,
  active boolean not null default false,
  created_at timestamptz not null default now()
);
create unique index one_active_voice on voice_skill (active) where active;

create table processed_updates (
  update_id bigint primary key,               -- Telegram update_id; insert-first idempotency for ALL updates
  created_at timestamptz not null default now()
);

create table notes (
  id uuid primary key default gen_random_uuid(),
  chat_id bigint,                             -- null for backlog imports
  message_id bigint,                          -- null for backlog imports
  import_key text unique,                     -- backlog: sha256(text); idempotent import
  text text not null,
  source text not null default 'telegram',    -- 'telegram' | 'backlog'
  status text not null check (status in ('received','rejected','passed','drafted','failed','backlog')),
  category text, score int, criteria jsonb, reason text, flags text[] default '{}',
  duplicate_of text, suggested_angle text, search_phrase text, entities text[] default '{}',
  override boolean not null default false,
  failed_stage text, rejection_message_id bigint, error_message_id bigint,
  created_at timestamptz not null default now(),
  unique (chat_id, message_id)                -- idempotency
);

create table drafts (
  id uuid primary key default gen_random_uuid(),
  note_id uuid not null references notes(id),
  body text not null,
  status text not null default 'pending' check (status in ('pending','approved','rejected','superseded')),
  news jsonb,                                 -- chosen item {headline, source, date, url} or null
  news_status text,                           -- 'used' | 'unused' | 'none' | 'error'
  model text not null, voice_version text not null, prompt_version text not null,
  lint jsonb,                                 -- {hard:[], soft:[], check_count:n}
  redo_feedback text, redo_count int not null default 0,
  post_message_id bigint, card_message_id bigint,
  decision_reason text, decided_at timestamptz,
  created_at timestamptz not null default now()
);
create index on drafts (status);
create index on drafts (post_message_id);
create index on drafts (card_message_id);

alter table processed_updates enable row level security;
alter table voice_skill enable row level security;
alter table notes enable row level security;
alter table drafts enable row level security;   -- no policies: only the service role can access
```
The table names map to the course B1·3 wording: "notes, drafts, voice skill".

## 9. Non-functional requirements

| Area | Requirement |
|---|---|
| Latency | Webhook acknowledged in < 1 s. Note → draft p95 ≤ 60 s |
| Reliability | Idempotent on `update_id` (all updates) and `(chat_id, message_id)` (notes). State changes are conditional updates. News failure never blocks a draft. Timeouts: Telegram 10 s, LLM 60 s, RSS 5 s, Supabase 5 s, all inside the §6.2 deadline budget. The stale sweep catches killed functions |
| Security | Webhook secret header. Chat-ID allowlist. Secrets only in env (`.env` is git-ignored; `.env.example` is committed). Service-role key server-side only. RLS on. No secrets in logs |
| Privacy | Note text is stored only in Supabase. Log lines contain note_id and stage, never the note text |
| Cost | ≤ 2 LLM calls per note in the happy path (analyse + draft), +1 on a lint regeneration. Rejected notes cost 1 call or 0 |
| Observability | One JSON log line per stage: `{note_id, stage, ms, model?, ok, err?}`. `voice_version` + `prompt_version` stored on every draft |
| Maintainability | Provider interface `LLM.generateJSON(schema, system, user, opts)` with `gemini` and `anthropic` implementations. No framework |
| Metrics | `sql/metrics.sql` creates the `weekly_metrics` view: week, notes_received, notes_passed, drafts_created, approved, rejected, approval_rate, p95_note_to_draft_seconds |

## 10. Repository layout

```
api/webhook.ts                 # auth → ack → waitUntil(route)
src/config.ts                  # zod-validated env
src/router.ts                  # decision table §6.3 (pure function, unit-tested)
src/commands.ts                # §6.6
src/pipeline/processNote.ts    # §6.4 orchestration
src/pipeline/score.ts          # computeScore §6.5 (pure)
src/pipeline/news.ts           # Google News RSS fetch + parse
src/pipeline/lint.ts           # §7.3 (pure)
src/pipeline/format.ts         # §6.8 message builders + splitter (pure)
src/prompts/analyse.ts, draft.ts
src/llm/{index,gemini,anthropic}.ts
src/telegram.ts                # sendMessage (fetch)
src/db/repo.ts                 # Repo interface; supabaseRepo + memoryRepo (tests, M1–M3)
context/…                      # voice skill, examples, published index, banned-phrases.json
supabase/migrations/001_init.sql
sql/metrics.sql
scripts/set-webhook.ts         # setWebhook with secret_token, prints getWebhookInfo
scripts/seed-voice.ts          # inserts context/voice-skill.txt as a new active version
scripts/eval.ts                # runs fixtures through the real analyse (+ optional draft), prints a pass/fail table
scripts/compare-models.ts      # same note → Gemini vs Claude drafter, side by side + lint
scripts/import-backlog.ts      # P1: file of notes → analyse → status='backlog'
tests/*.test.ts
```

## 11. Env vars (`.env.example`)
```
TELEGRAM_BOT_TOKEN=
TELEGRAM_ALLOWED_CHAT_IDS=     # comma list: channel id (-100…) and/or Meera's DM chat id
TELEGRAM_WEBHOOK_SECRET=       # random 32+ chars, [A-Za-z0-9_-]
GEMINI_API_KEY=
GEMINI_MODEL=                  # current Flash model ID, check the docs
ANTHROPIC_API_KEY=             # optional until M5; if empty, the drafter falls back to Gemini
ANTHROPIC_MODEL=               # current Sonnet-class model ID, check the docs
DRAFT_PROVIDER=anthropic       # anthropic | gemini
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
SCORE_THRESHOLD=6
MIN_NOTE_WORDS=12
NEWS_LOCALE=hl=en-IN&gl=IN&ceid=IN:en
NEWS_WINDOW=when:30d
```

## 12. Milestones & acceptance criteria

The milestones map to the course checkpoints. Each one ends with `npm test` green + its manual check + a git commit.

| M | Course checkpoint | Scope | Done when (all must pass) |
|---|---|---|---|
| **M0** | pre-L3 | Scaffold, config, lint/test tooling, `.env.example`, `.gitignore` | `npm test` runs. `.env` is git-ignored (verified with `git check-ignore .env`) |
| **M1** | L3·1–L3·3 | R1–R4, R11, R14, R19. memoryRepo. `set-webhook` script | Unit tests for router, lint, format. Deployed to Vercel. `getWebhookInfo` shows the URL with no errors. **note_01 posted in the channel → draft pair within 60 s, zero hard lint violations.** Wrong secret → 401. Other chat → ignored |
| **M2** | B1·1 | R5, R13, computeScore, rejection message | Unit tests for computeScore (incl. the novelty cap). **`npm run eval` meets every fixture expectation (§6.5 calibration).** junk_01 in Telegram → a "No draft" reply and no draft |
| **M3** | B1·2 | R6, R7 | RSS parser unit test on a saved XML fixture. A live note gives a card with the headline, source, date, link and ⚠ line when news is used. With RSS unreachable (simulated), the draft is still delivered with `news_status='error'` |
| **M4** | B1·3 | R8–R10, supabaseRepo, seed-voice, metrics view | Send a note → rows in `notes` + `drafts` (pending). Reply APPROVE → `approved`, and it stays after a refresh. Replaying the same note update JSON **and** the same APPROVE update twice → one draft, one transition. REJECT keeps the row. A note that starts with "Rejected a sample…" is treated as a note, not a command. A note left in `passed` for 10+ minutes is swept to `failed` on the next update |
| **M5** | Final 15 min | R12, compare-models | `npm run compare -- note_01` prints both drafts + lint results. A one-sentence finding is recorded in `docs/model-comparison.md` |
| **M6** | post-course | R15–R18 | REDO gives a new pair and marks the old one superseded (the 4th REDO on a chain is refused). DRAFT ANYWAY works on both pre-filter and gate rejections. RETRY works on a failed note. Importing the fixtures twice creates each note once. NEXT drafts the top-scoring above-threshold backlog note. STATS replies |

**Global Definition of Done:** all P0 requirements met. No secret in the git history. The README explains setup in ≤ 10 steps. Every requirement ID shows up in at least one test name or eval check.

## 13. Risks & mitigations

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Drafts sound generic, and Meera stops using the bot (the content writer failure again) | Med | **High** | Detailed voice spec + 3 examples + lint + Claude drafter + REDO. Track the approval rate weekly. Rejection reasons feed voice-skill v1.1 |
| A made-up fact is published under her name | Low | **High** | Facts only from the note or news. `[CHECK]` markers. Mandatory verify block. The human gate (the Cut) |
| Defamation or privacy (supplier/customer notes) | Med | High | LEGAL/PRIVACY flags → drafter rules + lint name check |
| Scorer is miscalibrated (passes everything, or repeats slip through) | Med | Med | Code computes the score. Novelty cap. Eval set as a regression gate. Watch the pass rate (40–70%) |
| Webhook retries or timeouts create duplicates | Med | Med | Fast ack + waitUntil. Unique constraint |
| Irrelevant news gets forced in | Med | Low | Top 3 candidates. The drafter may choose none. Rule 3 |
| Not enough passing notes for 3 a week | Med | Med | Backlog import + NEXT (P1) |
| Model or platform limits change | Med | Low | Env-driven model IDs. Claude Code checks the docs at build time |

## 14. Assumptions & open questions

**Assumptions (made so the build isn't blocked; revisit them later):**
- A1. Capture happens in a private channel where the bot is an admin with "Post Messages". DMs are also supported.
- A2. Meera reviews in Telegram, and copying Message 1 is enough to publish (no rich formatting needed).
- A3. The Vercel free tier + `waitUntil` allows ≥ 120 s of background processing (check at build and record in `docs/decisions.md`. If it's lower, shrink the deadline budget).
- A4. Draft length of 2,200–2,900 chars matches her published LinkedIn posts (measured at 2,450–2,890 for LI-002/003/004).

**Open questions (they don't block M0–M5):**
- Q1. Does Meera want a Monday digest of pending drafts (R21)?
- Q2. Should approved drafts be used later as extra few-shot examples (a voice learning loop)? Proposed for v1.1 once there are ≥ 10 approvals.
- Q3. Where are the 60 backlog notes, and in what format? (Needed for M6.)

## 15. Glossary
**CoA:** Certificate of Analysis. **INCI:** ingredient naming standard. **The Cut:** the part of Meera's ask that a Nine Checks boundary check removes (auto-publishing). **Review card:** Message 2, with the metadata for a draft. **Voice lint:** deterministic style checks on a draft.
