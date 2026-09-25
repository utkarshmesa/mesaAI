# Meera LinkedIn Draft Bot

Meera posts a raw note in her private Telegram channel. The bot scores it, optionally finds a news angle, and replies with a LinkedIn draft in her voice plus a review card. She replies `APPROVE` / `REJECT: reason`. **It never publishes to LinkedIn**: she copies the post herself (PRD NG1, "the Cut").

Source of truth: [PRD.md](PRD.md). Rules for contributors: [CLAUDE.md](CLAUDE.md). Build notes: [docs/](docs/).

## Setup (10 steps)

1. `npm install` (Node 20+).
2. In Telegram, create a bot with @BotFather and copy the token. Create a private channel, add the bot as an **admin with "Post Messages"**, and get the channel id (`-100…`, e.g. forward a channel post to @JsonDumpBot).
3. Get a Gemini API key at https://aistudio.google.com/apikey.
4. Create a Supabase project. In **SQL Editor**, run `supabase/migrations/001_init.sql`, then `sql/metrics.sql`. Copy the project URL and the **service-role** key (Settings → API).
5. `cp .env.example .env` and fill it in. Generate the webhook secret with `openssl rand -hex 24`.
6. `npm run typecheck && npm test`, then `npm run eval -- --runs 3 --draft` (live Gemini calls; must end with ✅).
7. `npm run voice:seed` stores `context/voice-skill.txt` as the active voice version.
8. Push to GitHub, import the repo in Vercel, and add every variable from `.env` under Project → Settings → Environment Variables. Every push to `main` then redeploys automatically.
9. `npm run webhook:set -- https://<your-app>.vercel.app/api/webhook` prints `getWebhookInfo`; it must show your URL and no `last_error_message`.
10. Post a note in the channel. The draft and its review card arrive within a minute.

## Commands

| Command | What it does |
|---|---|
| `npm test` / `npm run typecheck` | Unit tests (no network) / strict TS |
| `npm run eval [-- --runs 3] [--draft]` | Fixtures → real analyse call → pass/fail table; `--draft` also drafts note_01/02 and requires zero hard lint |
| `npm run compare -- note_01 [modelA] [modelB]` | Two Gemini drafter models side by side, with lint |
| `npm run webhook:set -- <url> [--drop-pending]` | `setWebhook` with `secret_token`, then `getWebhookInfo` |
| `npm run voice:seed` | Insert the voice skill as the new active version |

In Telegram: reply to a draft with `APPROVE`, `REJECT: reason`, or send `HELP`. `REDO`, `DRAFT ANYWAY`, `RETRY`, `NEXT` and `STATS` are M6 and reply "not switched on yet".

## How it works

`api/webhook.ts` checks the secret header and chat allowlist, dedupes on `update_id`, acks 200 and continues in `waitUntil`. `src/router.ts` (pure) maps each message to one action. `src/pipeline/processNote.ts` runs: pre-filter → Gemini analyse (code computes the score) → gate → Google News RSS → Gemini draft (voice skill verbatim + 3 examples) → deterministic lint (+1 regeneration) → save → send post + card. Every state change is a conditional update; nothing is deleted.
