# Voice v3: Pushing for a Mean Score > 8 (26 Sep 2026)

Strategy prompt: `docs/03-voice-v3-strategy-prompt.md` · raw data: `docs/voice-v3-artifacts/`

## Result: the target wasn't reached

The best configuration scored a mean of **6.77**, not above 8. Everything below is from blind raters (fresh instances, 13-parameter rubric, 4 unseen notes, Meera's real LI-001 as a hidden anchor).

| Writer | R4 mean | R5 mean | Edit min (R5) |
|---|---|---|---|
| v2.0.2, single pass | 5.73 | — | 15.0 (R4) |
| **v3**: 3 candidates → editor | **6.79** | 6.71 | 9.25 |
| **v3 + 1 critique loop** | — | **6.77** | **8.0** |
| Ghostwriter benchmark | 5.60 | 6.08 | 15.5 |
| **Meera's own LI-001 (anchor)** | **5.46** | **5.31** | 30 |

v3 is the best writer in every round. It beats the ghostwriter by about 0.7–1.2 points and needs about half the edit time. The best single drafts reach 7.3–7.5: the rich notes T4 (7.31) and T8 (7.54).

## Why "above 8" is capped on this rubric

1. **The rater scores Meera's own best post around 5.3.** That's her best-performing post: 340 profile visits and 3 wholesale enquiries. The rater marks it down for density and gives it fact discipline 3/10, because it contains claims the rater can't find in `founder-facts.json`. So a mean above 8 on this rubric means "better than Meera by an editor's taste". The rubric is partly measuring polish, not her.
2. **Thin notes cap the score.** The "10,000 customers" note scored 5.6–5.9 for every writer, the ghostwriter included. There isn't enough substance in the note, and the rater penalises both padding and [NOTE] gaps.
3. **Rater noise is about ±0.35.** v3 versus v3 + loop (+0.06) is within noise. The loop's real gains are the ending (+1.25) and edit time (−1.25 min). A second loop round started adding repetition (T2 regressed), so the pipeline uses one round.

## What moved the score (v2.0.2 → v3)

| Lever | Evidence |
|---|---|
| Generate 3 candidates and let an editor pick one | Removed the bad tail. Fact discipline went 7.25 → 8.25 and publish-readiness 5.0 → 6.5 (R4) |
| An editor line-edit pass (remove, reorder, tighten; never add) | Economy 4.75 → 6.0. Reader value 5.25 → 7.25 |
| The strongest model for draft and edit | The v3 drafts were Opus-class. Earlier rounds used Sonnet-class |
| [CHECK] policy: write around gaps | Unresolved placeholders fell from 1–4 per draft to 0–1 |
| All 4 of her posts as examples | Precision 5.75 → 6.75 |
| A critique → revise loop (1 round) | Ending 4.5 → 5.75. Edit time 9.25 → 8.0 min |
| Voice 2.2.x: no echo endings, no aphorisms, an optional hedge, varied closers | These target the rater's most-repeated complaints ("templated 'I'm not saying' paragraph", "echo ending") |

## The realistic route to 8+

These aren't more prompt tuning. Each one attacks a cause of the cap above.

| # | Lever | Why it works | Expected effect |
|---|---|---|---|
| 1 | **A clarify step** (product): for notes scoring 6–7, the bot asks Meera 1–2 questions in Telegram before drafting ("Which product is batch 14?", "Can we say what the listing was worth?") | The rater's top deductions are [NOTE] gaps, missing specifics and thin notes. Only Meera can supply real facts | Largest. It turns thin notes into rich ones. Can't be tested without her |
| 2 | **Draft only rich notes** (analyse score ≥ 7), and fill the 3-a-week cadence from the 60-note backlog | The rich notes already score 7.3–7.5 | Rich-note mean ≈ 7.4 today |
| 3 | **Fix the measurement.** Add every fact from her published posts to `founder-facts.json`. Re-anchor the rubric so that 8 = "matches her published standard". Use her approved posts as anchors | Her own post scores 3/10 on facts only because the file is incomplete. A rubric that scores the author at 5 isn't measuring her voice | Makes the score mean what we want. The anchor should then land around 8 |
| 4 | **Her edited, approved posts as examples** (after about 10 approvals) | This is the only source of her real texture beyond 4 posts | Biggest lift on voice fidelity, which is stuck at about 6.25 |
| 5 | Keep the human gate | An 8-minute edit by Meera is what makes the published post a 9 | This is the actual goal |

**Recommendation:** ship the v3 pipeline now. Build the clarify step (1) and rich-note gating (2) next, and fix the rubric (3) before trusting any "8".

## Files

| File | Change |
|---|---|
| `context/voice-skill.txt` | **v2.2.1**: [CHECK] policy (write around gaps), no echo endings or aphorisms, optional hedge, varied closers |
| `context/editor-prompt-v3.md` | **New**: select-and-line-edit contract (system, user template, schema) |
| `context/critic-prompt-v3.md` | **New**: critique → revise contract, 1 round, with a revert-on-lint rule |
| `context/rubric.md` | **New**: the 13-parameter rubric used by the editor and critic |
| `context/examples/linkedin_post_001.txt` | **New**: 4th example, cleanly re-paragraphed |
| `PRD.md` | v1.4: §7.2b generation pipeline v3 |

## Migration prompt for your bot (paste into Claude Code)

```
Upgrade the drafting step to the v3 pipeline in PRD §7.2b. Read context/editor-prompt-v3.md,
context/critic-prompt-v3.md, context/rubric.md, context/voice-skill.txt (v2.2.1) and
context/examples/ (now 4 posts). Then:
1. Replace the single draft call with 3 parallel drafter calls (the drafter-prompt-v2 contract,
   temperature 0.9, one angle hint each).
2. Lint each candidate. Then call the editor (editor-prompt-v3) with all 3 candidates and their
   lint results. Store candidate_scores and edits on the draft row (jsonb).
3. Run one critic → revise round (critic-prompt-v3). Skip it if min_param ≥ 8. Revert if the
   revision fails the hard lint.
4. Keep the existing lint and fact audit after that. Use the strongest available model for
   every call. Put the model ID in env.
5. Review card: add "Edited: <n> changes" and "Critic: <mean>/10".
6. Fallbacks: if the editor fails, use the best-linting candidate. If the critic or revise
   fails, keep the editor output.
Write unit tests for the candidate selection and the revert logic. Show me drafts for note_01 and
note_02 before deploying. Don't change anything else.
```
