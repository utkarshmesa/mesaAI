# Voice Stress Test: Meera Voice Skill (25 Sep 2026)

**Question:** does `voice-skill.txt` + 3 examples make a model write like Meera, safely, across edge cases?
**Method:**
- Isolated drafter agents (Sonnet-class) received the exact production system prompt and no other context.
- They drafted 8 edge cases: `tests/fixtures/voice-cases.json`.
- A baseline drafter (no voice skill) wrote 3 of the cases for comparison.
- Every draft went through the deterministic lint, voice metrics measured against her real posts, and a manual read.
- A blind judge agent classified shuffled real vs generated posts.
- There were 3 rounds (v1.0 → v1.1 → v1.2), with fixes between rounds.

## Results

| Measure | Her real posts | v1.0 | v1.1 | v1.2 |
|---|---|---|---|---|
| Hard lint violations (8 drafts) | — | 0 | 0 | 0 |
| Length in the 2,200–2,900 band | 2,450–2,890 | 8/8 | 8/8 | 5/5 |
| Contraction ratio (avg) | **0.79–0.96** | 0.46 | 0.97 | 0.89 |
| Sentences ≤ 7 words per post | **6–7** | 3.9 | 4.3 | 2.4 |
| Final sentence length (words) | **13–21** | 37 | 15 | 24 |
| Drafts with an invented time ("last week"…) | 0 | **5/8** | 1/8 | 2/5 |
| Drafts with meta/reframe lines | 0 | 4/8 | 0/8 | 0/5 |
| Drafts with other invented facts (manual read) | — | ≥ 3/8 | 3/8 | 3/5 |
| Blind judge correctly spotted the AI drafts | — | **4/4** | **4/4** | not rerun |

A **baseline without the voice skill** fooled the judge (judged "human", confidence 5), but it was 1,093 chars. That's less than half her length, with none of her mechanism depth or hedging, and it invented details ("got buried in the inbox", "That's the whole win"). Sounding casual isn't the same as sounding like her.

**What passed every round:** format rules; no leaked entities (Nykaa never appeared); anonymising the customer; dermatologist referral on medical notes; following the REPEAT suggested angle instead of rehashing NL-008; choosing the relevant news item (CDSCO) over the celebrity one, with a `[CHECK]` on the details; no hype on the "10,000 customers!!" bait note.

## Failures found → fixes shipped

| # | Failure | Evidence | Fix | Where |
|---|---|---|---|---|
| 1 | **Invented specifics.** Times, scenes, policies, business claims | "A customer asked me last week…" (the note said "I keep seeing people"). "more visibility and volume than most of our other channels combined". "two years checking" (the brand is 18 months old) | HARD RULE 0 in the voice skill. Deterministic time-phrase lint. **A fact-audit step using the strong model** (a cheap-model audit caught only ~half of these) | voice-skill v1.1, PRD §7.3, §7.4 (R23) |
| 2 | Formal register (0% contractions in 4/8 drafts) | "I am not saying", "do not" | Contraction rule + a hard lint at < 0.6 | voice v1.1, §7.3 |
| 3 | Moral/quotable endings and "This isn't about X, it's about Y" | Final sentences of 37 words on average | Closing rules + meta-pattern lint + a soft lint on final-sentence length | voice v1.1, §7.3 |
| 4 | The LEGAL rule produced unprompted absolutions ("I'm not saying this was done to deceive us") | The judge named it a top tell | Rewrote the rule: report the documented sequence and don't speculate either way | voice v1.1/1.2, PRD §7.2 |
| 5 | The signature hedge became a tic | "I want to be careful/precise…" in 3/8 | Max once every 3 posts + a soft lint against the last 2 drafts | voice v1.1, §7.3 |
| 6 | Standalone one-line paragraphs ("We said no.") | Judge tell in round 2. Her posts have 0–1 | Short verdicts go inside paragraphs. Soft lint for > 1 | voice v1.2, §7.3 |
| 7 | Contradicted her published facts ("I don't know a benchmark" vs NL-011's 20–40%) | T6 v1.1 | `context/founder-facts.json` goes to the drafter and the audit | v1.2 |
| 8 | Founder facts pasted in word for word | "including the preservative system, the emollients and the carriers" in 2/5 drafts | Max 2 per post, in her own words | voice v1.2 |
| 9 | The ban list had words she actually uses | "genuinely", "in the room" appear in her corpus | Checked the list against the corpus and removed them | banned-phrases.json |

## Honest conclusions

1. **The voice guide works on structure and safety, and partly on texture.** Drafts follow her skeleton, her hedging and her India-specific framing. A careful reader can still tell they're AI: too even, too clean, occasionally aphoristic.
2. **Prompt tuning has diminishing returns.** v1.2 fixed facts but regressed on rhythm (fewer short verdicts, longer endings). More prompt text starts trading one rule against another.
3. **Invented specifics are the #1 risk, and prompts alone don't stop them.** This is why the pipeline now has deterministic lint + a fact audit + "Unverified" lines + Meera's gate. They don't depend on the model obeying.
4. **"Undetectable" is the wrong goal.** The bar is: **Meera approves with light edits in ≤ 5 minutes.** Measure it with approval rate + edit distance (PRD Q4). The drafts are a first draft to edit, never a final.
5. **Test limitation:** the real samples carry PDF-extraction artefacts (dropped dashes, a stray fragment), and the judge partly used those as "human" signals. Generated drafts also shared source material with some real samples. Treat the judge result as directional.

## Recommended next steps (in the build)
- M5: run `npm run voice:stress` with Claude **and** the strongest available model as the drafter. At ~12 drafts a month, cost doesn't matter; quality does.
- After 10 approvals, add her approved (edited) posts as extra few-shot examples. That's the fastest route to her real texture.
