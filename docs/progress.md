# Progress

Status as of 25 Sep 2026. Code for M0–M5 is complete and `npm run typecheck && npm test` is green (99 tests). The live checks need keys and a deploy, and are marked ⏳.

| M | Code + tests | Live "Done when" (PRD §12) |
|---|---|---|
| M0 | ✅ | ✅ `npm test` runs · ✅ `git check-ignore .env` → `.env` |
| M1 | ✅ router, lint, format, webhook, pipeline (steps 1, 6, 7, 8, 9 + error path) | ⏳ deploy · ⏳ `getWebhookInfo` clean · ⏳ note_01 → pair in 60 s, 0 hard lint · ✅ wrong secret → 401 (test) · ✅ other chat ignored (test) |
| M2 | ✅ computeScore incl. novelty cap, pre-filter, gate, eval script | ⏳ `npm run eval -- --runs 3` meets every expectation · ⏳ junk_01 in Telegram → "No draft" |
| M3 | ✅ RSS parser on saved fixture, verify block, RSS-down path | ⏳ live card with news block · ⏳ `NEWS_FORCE_ERROR=1` → draft with `news_status='error'` |
| M4 | ✅ Supabase repo, migration, APPROVE/REJECT, replay tests, sweep, "Rejected a sample…" | ⏳ rows in Supabase · ⏳ APPROVE persists after refresh · ⏳ replay via curl |
| M5 | ✅ `DRAFT_MODEL` switch (R12), compare script, README, coverage check | ⏳ `npm run compare -- note_01` + one-sentence finding |

Owner decisions: Gemini only (decisions O1). Plan recommendations A1–A17 accepted.
