# Progress

Status 25 Sep 2026. M0–M5 are live at `https://meera-linkedin-bot-rho.vercel.app/api/webhook` (Vercel), backed by Supabase. Code: https://github.com/utkarshmesa/mesaAI · 103 unit tests green.

Live checks below were run against production with signed, simulated channel posts (update_id 900000001–3, message_id 900001–3) in the real channel "My Notes". One check is still open: a note typed by Meera in Telegram (the real delivery path).

| M | "Done when" (PRD §12) | Result |
|---|---|---|
| M0 | `npm test` runs · `.env` git-ignored · no secrets in history | ✅ ✅ ✅ |
| M1 | Deployed · `getWebhookInfo` shows URL with no errors | ✅ ✅ |
| M1 | note_01 → draft pair within 60 s, zero hard lint | ✅ drafted in < 31 s (p95 23.6 s), lint hard=[] |
| M1 | Wrong secret → 401 · other chat → ignored | ✅ 401 · ✅ 200 + ignored |
| M2 | `npm run eval` meets every expectation | ✅ 3/3 runs, gate 2/8 |
| M2 | junk_01 in Telegram → "No draft", no draft | ✅ rejected, score 2 |
| M3 | Parser unit test · live card with news block · RSS down → still delivered | ✅ · ⏳ note_01's news was offered but not used (`unused`) · ✅ (unit test) |
| M4 | note → rows in notes + drafts (pending) | ✅ |
| M4 | APPROVE → approved, persists | ✅ `approved`, decided_at set |
| M4 | Replay same note + same APPROVE twice → one draft, one transition | ✅ |
| M4 | "Rejected a sample…" is a note · stale sweep | ✅ (unit tests) |
| M5 | `npm run compare -- note_01` + finding | ✅ docs/model-comparison.md |

Test rows (message_id ≥ 900001) are real rows in Supabase and count in `weekly_metrics` for the week of 21 Sep 2026.
