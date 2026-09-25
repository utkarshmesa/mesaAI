# Drafter model comparison (R12)

Run 25 Sep 2026: `npm run compare -- note_01 gemini-3.8-flash gemini-3.5-flash-lite` (same analyse output, same system prompt `f41f2d2244b9…`).

| Model | Latency | Length | Hard lint | Soft lint | [CHECK] |
|---|---|---|---|---|---|
| gemini-3.8-flash | 14.7 s | 2,865 chars | 0 | 0 | 0 |
| gemini-3.5-flash-lite | 2.7 s | 1,868 chars | 0 | 0 | 0 |

**Finding:** both are lint-clean, but only `gemini-3.8-flash` writes in Meera's structure (mechanism, the calibrated "what I'm not saying" hedge, a reader action) within the 2,200–2,900 target. Flash-Lite is 5× faster but mostly restates the note and lands under the length floor, so `DRAFT_MODEL=gemini-3.8-flash` stays the default.
