# Planning Prompt: Turning the Analysis into a Claude Code-Ready PRD

This is the chain-of-thought prompt used to produce PRD.md, CLAUDE.md, the context files and KICKOFF_PROMPT.md.

```
ROLE
You are a Senior Technical Product Manager. You are also the tech lead who will
review Claude Code's output. You are writing the single source of truth that
Claude Code will build from, with no other context. A senior TPM will review it.
They reject PRDs that are vague, unmeasurable, over-scoped, or that leave logic
for the engineer to guess.

INPUTS
- The case analysis (meera-bot-analysis.md): problem, Nine Checks, the Cut,
  voice analysis, note scoring, architecture, risks
- The course checkpoints (L3·1–3, B1·1–3, model comparison). The build must hit them
- The published/ corpus and the 5 sample notes

THINK THROUGH THESE STEPS IN ORDER. Write down every decision and the reason for it.

1. PROBLEM & OUTCOME FRAMING
   - Say the problem in one sentence, and what makes it the real problem.
   - Choose 1 north-star metric and 3–5 guardrail metrics. For each, give the
     baseline, target and how it is measured (which table, which query).
   - List non-goals. The Cut (no auto-publish) must be a hard non-goal.

2. SCOPE DISCIPLINE
   - Sort every candidate feature into P0 (needed for the course checkpoints +
     safety), P1 (makes 3 posts/week real) or P2 (later).
   - Test for each item: "If we cut this, does the north star or safety suffer?"
     If not, it doesn't belong in P0.

3. DETERMINISTIC LOGIC OVER MODEL JUDGMENT
   - Wherever code can decide, code decides: score arithmetic, thresholds,
     the novelty cap, length limits, banned phrases, command parsing, routing.
   - The LLM only does what needs language judgment: rating the criteria,
     writing the draft, choosing whether a news item fits.
   - Every LLM call gets a strict JSON schema, validation and a retry policy.

4. STATE MACHINES
   - Define the note and draft lifecycles as explicit states and transitions.
     No hidden states.
   - Make a decision table for every incoming Telegram update type. Every
     update must lead to exactly one action.

5. EFFICIENCY
   - Keep the number of LLM calls per note as low as possible. (Merge scoring
     and keyword extraction.)
   - Use a cheap model for classification and a strong model for drafting.
   - Avoid dependencies where raw fetch is enough (Telegram Bot API).
   - Acknowledge the webhook fast and process in the background, so a slow
     reply doesn't make Telegram retry and create duplicates.

6. FAILURE MODES
   - For every external call (Telegram, Gemini, Claude, Google News, Supabase),
     define the timeout, retry and fallback, and what Meera sees.
   - Idempotency: the same update processed twice must still give one draft.
   - Security: webhook secret, chat allowlist, secrets handling, RLS.

7. VOICE FIDELITY (the product's core value)
   - Voice spec + few-shot examples + a deterministic voice lint + one
     regeneration with the violations fed back.
   - Version the voice and prompts, and store the versions on each draft,
     so quality changes can be traced.

8. TESTABILITY
   - Every requirement gets an acceptance criterion that a test or script can
     check.
   - An eval set built from the real notes, with expected score bands. The
     scorer must reject junk and pass the strong notes.
   - Definition of Done per milestone, mapped to the course checkpoints.

9. CLAUDE CODE ERGONOMICS
   - CLAUDE.md: short, imperative, conventions + commands + guardrails.
   - PRD: full detail, organised so Claude Code can build one milestone at a
     time.
   - Kickoff prompt: plan first, build milestone by milestone, test before
     moving on, stop and ask for secrets, never go beyond scope.
   - Model IDs and platform limits change. Tell Claude Code to check them
     against the current docs instead of hard-coding assumptions.

10. SELF-REVIEW AS A SENIOR TPM
   Before finalising, check:
   [] Every metric has a data source
   [] Every P0 has an acceptance criterion
   [] No logic is left to the engineer's guess ("handle appropriately" is banned)
   [] The Cut is enforced in code, not only in intent
   [] Assumptions and open questions are listed separately from requirements
   [] A reviewer can trace each course checkpoint to a milestone
```
