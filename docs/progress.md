# Progress

Status 25 Sep 2026. Code for M0–M5 is complete and pushed to https://github.com/utkarshmesa/mesaAI (public). `npm run typecheck && npm test` is green (103 tests).

| M | Code + tests | Live "Done when" (PRD §12) |
|---|---|---|
| M0 | ✅ | ✅ `npm test` runs · ✅ `git check-ignore .env` · ✅ no secret in git history (scanned before push) |
| M1 | ✅ | ⏳ deploy · ⏳ `getWebhookInfo` clean · ⏳ note_01 in Telegram → pair in 60 s · ✅ wrong secret → 401 · ✅ other chat ignored |
| M2 | ✅ | ✅ `npm run eval -- --runs 3 --draft` meets every expectation 3/3 (after calibration C1), gate 2/8 · ⏳ junk_01 in Telegram → "No draft" |
| M3 | ✅ | ⏳ live card with news block · ⏳ `NEWS_FORCE_ERROR=1` live check |
| M4 | ✅ | ⏳ run migration in Supabase · ⏳ rows + APPROVE persists · ⏳ replay via curl |
| M5 | ✅ | ✅ `npm run compare -- note_01` + finding in docs/model-comparison.md |

Quality bars: ✅ voice skill verbatim + 3 examples (tested; SHA-256 logged on every draft call) · ✅ score computed in code · ✅ eval passes and isn't too lenient · ✅ zero hard lint on note_01/note_02 (6/6 drafts) · ✅ no LinkedIn integration (guard test).
