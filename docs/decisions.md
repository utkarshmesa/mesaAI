# Decisions log

Each entry: date · decision · source/evidence · status. "PROPOSED" entries are waiting for the product owner's answer (see build-plan §5).

---

## External-docs checks (25 Sep 2026)

### D1. Anthropic drafter model → `claude-sonnet-5`
- **Checked:** Anthropic model table (Claude API skill reference, cached 2026-06-24) + `shared/models.md`. Current Sonnet-class ID is `claude-sonnet-5` (1M context, 128K output, Active). No date suffix.
- PRD §11 asks for a "Sonnet-class" model, so `.env.example` gets `ANTHROPIC_MODEL=claude-sonnet-5`. Stronger alternative if drafts sound generic: `claude-opus-5` (costs more; env change only).
- **API constraints that matter here (Sonnet 5):**
  - `temperature` / `top_p` / `top_k` are **removed: sending them returns HTTP 400.** This conflicts with PRD §7 "draft 0.7". See build-plan §5, issue A1.
  - Thinking: adaptive is on by default; `budget_tokens` returns 400. Effort is set through `output_config.effort` (`low`…`max`, default `high`). I'll start at the default and measure latency against the 60 s p95 target in M1.
  - No assistant prefill (400). JSON comes from structured outputs: `client.messages.parse({ output_config: { format: zodOutputFormat(schema) } })` from `@anthropic-ai/sdk/helpers/zod`. zod validation + one retry (PRD §7) stays as the second line of defence.
- **Status:** confirmed (the ID); temperature handling PROPOSED (A1).

### D2. Gemini analyse model → `gemini-3.8-flash`
- **Checked:** https://ai.google.dev/gemini-api/docs/models (25 Sep 2026). Stable Flash models: `gemini-3.8-flash` (newest), `gemini-3.7-flash`, `gemini-3.6-flash`, `gemini-3.5-flash`; Flash-Lite: `gemini-3.5-flash-lite`, `gemini-3.1-flash-lite`. `gemini-2.0-flash*` are shut down.
- `.env.example` gets `GEMINI_MODEL=gemini-3.8-flash`. If cost or latency becomes a problem, `gemini-3.5-flash-lite` is the fallback, but I'd have to re-run eval before switching.
- **Gemini 3 guidance (https://ai.google.dev/gemini-api/docs/gemini-3):** keep temperature at the default **1.0**. Google warns that values below 1.0 "may lead to unexpected behavior, such as looping or degraded performance". This conflicts with PRD §7 "analyse 0.2" (see A1). Thinking levels: `minimal | low | medium | high`, and some Flash models default to `high`. For a one-shot rubric rating I'll use `low` to protect latency, and eval will confirm the calibration holds.
- SDK: `@google/genai`. The docs I fetched weren't consistent about the JSON-schema field names (`responseMimeType`/`responseJsonSchema` vs `response_format`). I'll settle this against the installed SDK's TypeScript types at M1 using a compile-fix loop, then record the final field names here.
- **Status:** ID confirmed; config details to be finalised in M1.

### D3. Vercel limits (Hobby / free plan)
- **Checked:** https://vercel.com/docs/functions/limitations (last updated 2026-08-24).
- Fluid compute is **on by default** for new projects. Hobby: `maxDuration` is **300 s default and maximum**; memory 2 GB / 1 vCPU; request body 4.5 MB.
- → `vercel.json`: `"functions": { "api/webhook.ts": { "maxDuration": 300, "includeFiles": "context/**" } }`.
- Deadline budget (PRD §6.2): `min(300 − 20, 240)` = **240 s**. **Assumption A3 (≥ 120 s of background work) holds.**
- **Status:** confirmed.

### D4. `waitUntil` / `getDeadline` (`@vercel/functions`)
- **Checked:** https://vercel.com/docs/functions/functions-api-reference/vercel-functions-package (last updated 2026-09-03).
- `import { waitUntil } from '@vercel/functions'`, signature `waitUntil(promise)`. "Promises passed to `waitUntil()` will have the same timeout as the function itself. If the function times out, the promises will be cancelled." That's the killed-function case the stale sweep covers.
- `getDeadline(): Date | undefined` returns the real invocation deadline, including `waitUntil` tasks. **Decision:** `deadline = min(getDeadline() − 20 s, start + 240 s)`, and fall back to `start + 240 s` when it returns `undefined` (local runs and tests). This follows the PRD formula and uses the platform's own number instead of a copy of it.
- Handler shape: web-standard `export default { fetch(request: Request) }` (the pattern in the docs for non-Next.js projects).
- **Status:** confirmed.

### D5. Telegram `setWebhook`
- **Checked:** https://core.telegram.org/bots/api#setwebhook (25 Sep 2026).
- `secret_token`: 1–256 chars, only `A-Z a-z 0-9 _ -`. Sent in the header **`X-Telegram-Bot-Api-Secret-Token`** on every webhook request. PRD §11 says "32+ chars [A-Za-z0-9_-]", which is compatible. `config.ts` validates it with `/^[A-Za-z0-9_-]{32,256}$/`.
- `allowed_updates` is a JSON array, and we pass `["message","channel_post"]`. `drop_pending_updates` is optional, and `webhook:set` will expose it as a `--drop-pending` flag (off by default).
- `getWebhookInfo` reports errors in `last_error_date` / `last_error_message`, so "no errors" means both are absent.
- Retries: Telegram "will repeat the request and give up after a reasonable amount of attempts" on any non-2xx, which confirms why we ack fast.
- Replies: we'll send them with `reply_parameters: { message_id }`, the current field. `reply_to_message_id` is the older form. I'll check this against the live API in M1.
- **Status:** confirmed.

### D6. Google News RSS
- **Checked:** live request on 25 Sep 2026 to `https://news.google.com/rss/search?q=<phrase>+when:30d&hl=en-IN&gl=IN&ceid=IN:en`. It returns RSS 2.0 whose `<item>` has `title` ("Headline - Source"), `link` (a news.google.com URL), `pubDate`, `description` (HTML, which we drop per PRD) and **`<source url=…>Publisher</source>`**.
- **Decision:** `source` = the `<source>` element text. Headline = title with the trailing `" - " + source` removed (and we fall back to the last `" - "` split if `<source>` is missing).
- ⚠ **Terms flag:** the feed's `<copyright>` says it is for "personal, non-commercial use" in a feed reader. Meera's use is for a commercial brand. Raised as issue A12 in the build plan; not resolved by me.
- **Status:** format confirmed; licensing is the product owner's call.

---

## Owner decisions (25 Sep 2026)

### O1. Gemini is the only LLM provider (overrides PRD §6.1 "Drafting: Claude" and §11 Anthropic vars)
- The owner has Gemini keys only. No Anthropic SDK, adapter or env vars are in the codebase, so D1 no longer applies.
- **R12 is reinterpreted** as "the drafter model can be switched": `DRAFT_MODEL` (any Gemini ID) is separate from `GEMINI_MODEL` (analyse). `npm run compare -- note_01 [modelA] [modelB]` compares two Gemini drafter models side by side, with lint.
- Temperature (A1): Gemini 3 guidance says keep the default 1.0, so no temperature is sent. Analyse uses `thinkingLevel: low`. Calibration stability comes from `npm run eval -- --runs 3`.
- Plan recommendations A1–A17 accepted as proposed. The owner asked for the simplest logic.

### O2. Several Gemini keys, used as fallbacks (25 Sep 2026)
- `GEMINI_API_KEY` takes a comma-separated list. Each call tries key 1 and moves to the next key only on 429 / 401 / 403 / 5xx (quota, rate limit, bad key, server error). A 400 or a timeout is not retried on another key; the PRD JSON-retry and error path still apply.
- `loadScriptConfig` lets `npm run eval` / `compare` run with only the Gemini variables set.
- The Supabase URL comes from the `ref` claim of the service-role key (`https://<ref>.supabase.co`). It lives only in `.env`.

## Build decisions (PRD silent → simplest consistent option)

Everything with PROPOSED is listed in build-plan §5, waiting for the owner.

- **B1.** Character counting uses Unicode code points (`[...s].length`), not UTF-16 units, so the length on the card matches what LinkedIn counts.
- **B2.** `draft_short_id` = the first 6 hex chars of the draft UUID.
- **B3.** `word_count` = whitespace-split tokens that contain at least one letter or digit.
- **B4.** Banned-phrase match: case-insensitive, with "not a letter/digit" boundaries on both sides (`(?<![\p{L}\p{N}])phrase(?![\p{L}\p{N}])`, `u` flag). This makes phrases ending in `?` (e.g. `thoughts?`) match correctly, where `\b` would not.
- **B5.** Scripts run with `tsx` and load env with Node's `--env-file=.env`. No dotenv dependency.
- **B6.** Gemini SDK = `@google/genai`; Anthropic SDK = `@anthropic-ai/sdk`. Both sit behind `LLM.generateJSON`.
- **B7.** A list line is a line starting with `-`, `•`, `*` or `\d+.` **followed by whitespace**, so `pH 5.5` or `-0.4 units` at the start of a line isn't a false positive.
- **B8.** Message 1 (the post) is sent as a reply to Meera's note so she can see which note it answers. Copying the text is unaffected.
- **B9.** The Gemini SDK field names were confirmed from the installed `@google/genai` 2.24 types: `config.systemInstruction`, `responseMimeType: 'application/json'`, `responseJsonSchema` (from `z.toJSONSchema`), `thinkingConfig.thinkingLevel`, `abortSignal`.
- **B10.** A required LLM call does not start with < 10 s left before the deadline. That goes to the error path (PRD §6.2 "if a required step can't start").
- **B11.** The stale sweep selects notes in `received`/`passed` older than 10 min. A separate "no draft" check isn't needed: a delivered draft moves the note to `drafted`, and a failed send moves it to `failed`.
- **B12.** `npm run compare` defaults to `DRAFT_MODEL` vs `gemini-3.5-flash-lite` (the cheapest current stable Flash-Lite, D2). Both drafters get the same analyse output.
- **B13.** A guard test (`NG1 the Cut`) fails the build if any LinkedIn host, API or credential string shows up in `src/`, `api/`, `scripts/` or the dependencies.

## Calibration (25 Sep 2026)

- **C1.** First live eval (3 runs): note_04 was rated `fragment` (capped at 2, needs ≥ 5). analyse-1.0.1 narrows "fragment" to scraps too thin to state a point, and says to rate the idea, not the polish. Result: all expectations met in 3/3 runs; gate pass rate 2/8 fixtures (not too lenient).
- **C2.** The drafts added details the note never stated ("delayed our restock and added real expense", named test parameters). draft-1.0.1 lists what counts as an invented fact. Re-read note_01 after the change: no invented events. note_01/note_02: zero hard lint in 6/6 drafts. Drafter system prompt SHA-256 (file voice 1.0.0): `f41f2d2244b9…`.

## Deployment (25 Sep 2026)

- **E1.** Supabase: `001_init.sql` + `metrics.sql` were run in the SQL editor; `npm run voice:seed` → voice_skill 1.0.0 active.
- **E2.** Vercel project `meera-linkedin-bot`, deployed with the Vercel CLI from the local checkout. The browser pane couldn't finish the Vercel↔GitHub link, so pushes to GitHub **do not auto-deploy** yet; redeploy with `npx vercel deploy --prod`. `.vercelignore` keeps `.env` out of the upload. Webhook URL: `https://meera-linkedin-bot-rho.vercel.app/api/webhook`. (`meera-linkedin-bot.vercel.app` is a different, unrelated project.)
