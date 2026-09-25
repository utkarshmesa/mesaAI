# CLAUDE.md: Meera LinkedIn Draft Bot

A Telegram bot. Meera posts a raw note, and the bot scores it, finds an optional news angle, and sends back a LinkedIn draft in her voice for her to approve. **`PRD.md` is the source of truth.** Read it before any work. When the PRD and your own judgment disagree, follow the PRD and raise the conflict.

## Non-negotiables
1. **Never publish to LinkedIn.** No LinkedIn API, credentials, scheduling or auto-post code of any kind (PRD NG1, "the Cut"). The system stops at a pending draft in Telegram.
2. **Code decides, the model rates.** Score arithmetic, thresholds, the novelty cap, routing, command parsing and lint are deterministic TypeScript. LLMs only return JSON that is validated with zod.
3. **Never invent facts in prompts or fixtures.** Drafts use only facts from the note or the chosen news item, and put `[CHECK: …]` where something is missing.
4. **Secrets:** only in env. `.env` is git-ignored. Never print keys or note text in logs.
5. **Idempotency:** one Telegram update → at most one draft or state change. Enforced by `processed_updates(update_id)` + the unique `(chat_id, message_id)` + conditional status updates (`where status=$expected`).
6. **Keep to scope:** build only the current milestone's requirement IDs. Put ideas in `docs/ideas.md` and don't implement them.
7. **Nothing is ever deleted.** Rejected notes and drafts are kept.

## Stack
TypeScript (strict), Node 20+, Vercel Functions (`api/webhook.ts`), raw Telegram Bot API via `fetch`, Gemini Flash (analyse), Claude (draft, switchable), Google News RSS, Supabase, zod, fast-xml-parser, vitest. No web framework, no Telegram SDK.

## Context files: load at runtime, don't paraphrase them into code
- `context/voice-skill.txt`: goes verbatim into the drafter system prompt (DB `voice_skill` active row takes precedence from M4, and the file is the fallback)
- `context/examples/*.txt`: the 3 few-shot posts (strip the `Category:` line)
- `context/published-index.json`: goes into the analyse prompt for the novelty check
- `context/banned-phrases.json`: the lexical ban list for the voice lint (the only list the lint uses)
- `tests/fixtures/notes.json`: the eval set. `npm run eval` must meet every `expect`

## Commands (create these in M0)
- `npm test`: vitest unit tests (no network)
- `npm run typecheck`
- `npm run eval`: fixtures → real analyse call → pass/fail table (needs keys)
- `npm run compare -- <fixture_id>`: Gemini vs Claude drafts + lint
- `npm run webhook:set`: calls setWebhook with `secret_token`, then prints getWebhookInfo
- `npm run voice:seed`: inserts voice-skill.txt as the new active version

## Conventions
- `route(msg, replyTarget)` is pure. The DB lookup for `replyTarget` happens before it.
- Pure functions for `router`, `score`, `lint`, `format`, each with unit tests named after the PRD requirement IDs (e.g. `R10 duplicate update creates no second draft`).
- All I/O goes behind interfaces: `Repo` (memory + Supabase), `LLM` (gemini + anthropic), `Telegram`, `News`. Pipeline tests use fakes.
- Every prompt module exports `PROMPT_VERSION`. Bump it when the prompt changes.
- Log one JSON line per stage: `{note_id, stage, ms, ok, model?, err?}`.
- Telegram messages are plain text (no parse_mode). Split any message over 4,096 chars on paragraph boundaries.
- British spelling in user-facing bot copy.

## Before coding anything that depends on an external platform
Check the current docs: Gemini + Anthropic model IDs, the Vercel `maxDuration` / `waitUntil` (`@vercel/functions`) behaviour on the free plan, and the Telegram `setWebhook` `secret_token`. Record what you found in `docs/decisions.md` with the date.

## Workflow per milestone
Plan → implement → `npm run typecheck && npm test` → the milestone's manual check from PRD §12 → update `docs/progress.md` → commit (`M<n>: <summary>`). Stop and ask the user when you need secrets, a deploy or a Telegram action.
