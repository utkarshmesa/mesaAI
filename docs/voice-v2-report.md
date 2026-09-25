# Voice v2.0: Ghostwriter Benchmark, Ratings & Changes (25 Sep 2026)

Planning prompt: `docs/02-voice-v2-planning-prompt.md`. Raw drafts, keys and scores: `docs/voice-v2-artifacts/`.

## How it was tested

1. **Benchmark.** A simulated senior LinkedIn ghostwriter studied 14 of Meera's pieces (LI-001 held out) and wrote posts from her notes. It never saw our voice skill. It also wrote down its craft principles.
2. **Blind rating.** A separate editor agent scored shuffled, unlabelled drafts on 13 parameters (1–10, anchored rubric), using her real posts as the reference. From round 2 onwards the rater also had `founder-facts.json`, so her published facts weren't counted as invented.
3. **Three rounds.**
   - R1: 4 notes, v1.2 vs ghostwriter, plus her real LI-001 as a hidden anchor.
   - R2: 4 **unseen** notes, v1.2 vs v2.0 vs ghostwriter.
   - R3: the same unseen notes, all four writers under one rater.
   - Then a v2.0.2 spot-check. v2.0 was only validated on notes whose drafts weren't used to write its examples.

## Scorecard: Round 3 (one rater, 4 unseen notes, all writers)

| Parameter | v1.2 | v2.0 | v2.0.1 | Ghostwriter |
|---|---|---|---|---|
| Fold hook (first ~200 chars) | 5.25 | **6.75** | **6.75** | 4.75 |
| Voice fidelity | 5.25 | 5.00 | 5.50 | **6.50** |
| Rhythm & texture | 4.75 | 5.25 | **6.00** | 5.75 |
| Precision & evidence | 6.25 | 6.00 | 6.00 | **6.75** |
| Fact discipline | 6.50 | **7.50** | 6.00 | 7.25 |
| Argument clarity | 4.75 | 5.25 | 5.75 | **6.50** |
| Ownership & fairness | 5.75 | 6.00 | 6.25 | **7.00** |
| Reader value | 5.50 | 6.00 | 6.00 | **7.50** |
| Ending | 3.75 | 4.75 | **5.25** | 4.00 |
| Economy | 3.50 | 5.25 | 5.25 | **5.75** |
| Constraint handling | 5.25 | 6.75 | 7.00 | **7.50** |
| Publish-readiness | 4.00 | 5.00 | **5.25** | 4.75 |
| Business outcome | 5.50 | 6.00 | 6.25 | **7.50** |
| **Mean** | **5.08** | **5.81** | **5.94** | **6.27** |
| Edit minutes (lower is better) | 18.5 | 15.5 | **13.75** | 17.0 |

**v2.0.1 closes 72% of the gap from v1.2 to the ghostwriter.** It beats the ghostwriter on the fold, rhythm, ending, publish-readiness and edit time. Round 2 (a different rater instance) gave the same ordering: v1.2 4.94 → v2.0 6.17 → ghostwriter 6.60.

**Rater noise:** the same drafts scored about ±0.35 differently between rounds. So v2.0 vs v2.0.1 is within noise, while v1.2 → v2.x (+0.7 to +1.2) is a real improvement.

## What the ghostwriter did that the bot didn't → the v2.0 changes

| Gap (R1 bot → ghost) | What the ghostwriter did | v2.0 change |
|---|---|---|
| Economy 4.2 → 7.5 | Cut backstory. Let thin notes be short | "Length follows the note". Removed the fixed 2,200–2,900 band. "If a sentence could appear on another brand's page, cut it" |
| Fold 5.2 → 7.0 | Opened on the decision: "We're holding batch fourteen." | Blueprint step 1: the first ≤ 200 chars state the most concrete, consequential fact |
| Ownership 5.5 → 7.2 | "It got buried on our side." instead of "both sides" | Blueprint step 2: own her side's miss before any critique |
| Reader value 5.0 → 6.0 | Gave the literal questions to email a brand | Blueprint step 6: the practical turn = questions the reader can actually send |
| Ending 4.2 → 6.2 | A flat callback: "It's just not the first question." | Blueprint step 7 + ✗/✓ pairs. No second ending |
| Constraint handling 5.8 → 7.2 | Mechanism only on medical. No announced restraint | Priority 2 rewritten. ✗/✓ pairs for medical and restraint |
| Precision 6.0 → 7.2 | Reused her published figures (1–3% sensitisation, 2/4–5/10% niacinamide) | `founder-facts.json` → a new `published_figures` array (10 items) |
| (structure) | Planned before writing | `plan` object in the output schema. The code can check it (fold, facts_used, target length) |

**Where the bot beat the ghostwriter (kept in v2):** fact discipline and the fold. The ghostwriter invented "last week" and "recently", quoted Meera saying things she never published, and signed off with "Meera" and "write to us" CTAs. v2 bans sign-offs and contact CTAs explicitly.

**v2.0 → v2.0.1 (after R2):**
- Drafts had become too short (precision fell).
- The rule against pronouns made customer posts cold ("the customer" repeated).
- A draft ignored the note's ask to thank people.
- A draft misread "67% repeat rate" as "67% of customers".

Fixes: length bands raised, first-person customer framing, "honour the note's intent", "keep what a number measures", "say each caveat once".

**v2.0.1 → v2.0.2 (after R3):** honouring intent pushed thin notes to invent ("a fair number of you have written in"). Added: "Honouring intent never licenses new facts. A thin note makes a shorter post."

## What prompts couldn't fix → moved into code

The v2.0.2 spot-check showed two tics that survived every prompt version:

1. **Announced absolution:** "I'm not saying anyone was trying to mislead us." Now a **hard lint** (PRD §7.3).
2. **Number meaning drift** ("67% of them coming back") and **once-off → habitual policy** ("it's a standing request"). Both are now explicit **fact-audit checks** (PRD §7.4). The audit also receives `plan.facts_used`.

Also moved into lint: sign-offs and contact CTAs (hard); fold length and fold drift from the plan (soft); a "may be thin" check (soft). Models can't count characters, so length is enforced in code, never in the prompt.

## Calibration warning

In R1, the rater scored **Meera's own LI-001 lowest** (publish-readiness 2/10), although it's her best-performing post (340 profile visits, 3 wholesale enquiries). Two causes: PDF-extraction damage in the sample, and the rater's editorial preference for tight LinkedIn copy. **So the editor rubric is a proxy, and it leans towards polish.** v2 takes the ghostwriter's craft but keeps her density (rich notes stay at 2,200–2,800 chars, where her own posts sit). The real metric is still Meera's approval rate and how much she edits (PRD Q4).

## Files changed

| File | Change |
|---|---|
| `context/voice-skill.txt` | Rewritten as **v2.0.2**: priority-ordered, 7-step blueprint, 8 contrastive ✗/✓ pairs, self-check. v1.2 archived in `context/archive/` |
| `context/drafter-prompt-v2.md` | **New.** The drop-in contract: system assembly order, user template, zod schema with an optional `plan`, and code checks that use the plan |
| `context/founder-facts.json` | Added the `published_figures` array (10 items) |
| `PRD.md` | v1.3: §7.2 now points to the v2 contract. 5 new lint rules. Fact-audit checks for number meaning and invented habits |
| `CLAUDE.md` | Context list updated |

## Migration prompt for your existing bot (paste into Claude Code)

```
Our bot is already built. We're upgrading the drafter to voice v2.0.2. Read these files first:
context/drafter-prompt-v2.md, context/voice-skill.txt, context/founder-facts.json, and
PRD.md §7.2–7.4.

1. Make the drafter's system prompt follow the assembly order in drafter-prompt-v2.md exactly:
   voice skill → FOUNDER FACTS → PUBLISHED FIGURES → examples → DRAFTING RULES → schema.
   The user message must follow the template.
2. Update the draft response schema to DraftV2. `plan` is optional, and post/news_item_used
   stay as they are. Store `plan` as JSON on the draft row (add a nullable jsonb column
   `plan`). Set PROMPT_VERSION to draft-2.0.2 and voice_version to 2.0.2.
3. Add the new lint rules from PRD §7.3 (announced absolution, sign-off/contact CTA, fold
   length/drift, may-be-thin) with unit tests. Use the phrases from
   docs/voice-v2-artifacts as positive test cases.
4. Fact audit (PRD §7.4): pass plan.facts_used, and add the number-meaning and
   once-off-vs-habitual checks. If no audit step exists yet, add it as described.
5. Show plan.core_point on the review card as "Point: …".
6. Run `npm test` and the voice stress script, then show me 3 drafts (note_01, note_02,
   note_05's suggested angle) before deploying.
Don't change anything else.
```

## Remaining gaps (be honest with Meera)
- **Voice fidelity** (5.5 vs ghostwriter 6.5) is the biggest remaining gap. The fastest fix is her real approved posts as examples, once there are about 10.
- **Thin notes** produce thin posts (the 10k-milestone post came out at 1,030 chars). That's by design, because the alternative is invention. The review card flags them as "may be thin".
- **A detector can still tell.** The target is ≤ 10 minutes of editing by Meera, and v2.0.1 measured 13.75 against v1.2's 18.5.
