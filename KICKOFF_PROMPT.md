# Kickoff prompt for Claude Code

Paste this as the first message in a fresh Claude Code session, run from the root of this folder. The folder should already contain `PRD.md`, `CLAUDE.md`, `context/` and `tests/fixtures/`.

---

```
You're building the "Meera LinkedIn Draft Bot" described in PRD.md. CLAUDE.md has the
standing rules. Read both fully, then read every file in context/ and
tests/fixtures/notes.json before you do anything else.

How I want you to work:

1. UNDERSTAND FIRST (no code yet)
   Think it through step by step, and write docs/build-plan.md containing:
   - A 5-line restatement of the product and the Cut, in your own words.
   - For each milestone M0–M5: the files you will create, the requirement IDs they
     cover, and the tests you will write.
   - The update-routing decision table (PRD §6.3) and the note pipeline (§6.4), turned
     into function signatures.
   - Any ambiguity or contradiction you find in the PRD, with your proposed resolution.
     Don't silently resolve anything that changes behaviour.
   - What you need to check against current external docs (model IDs, Vercel limits,
     Telegram secret_token), and then check it. Record the results in docs/decisions.md.
   Show me the plan and wait for my "go".

2. BUILD MILESTONE BY MILESTONE (M0 → M5; M6 only when I ask)
   For each milestone:
   - Implement only that milestone's requirement IDs.
   - Unit tests first for the pure modules (router, score, lint, format, news parser).
     Router tests must include: a note starting with "Rejected a sample…" goes to the
     pipeline, a caption-only photo counts as a note, a voice message gets the text-only
     reply, and a reply to a card with "approve" goes to the command handler.
   - Run `npm run typecheck && npm test`. Fix it until it's green.
   - Tell me exactly which manual step I have to do (keys, Vercel env vars, deploy,
     `npm run webhook:set`, sending a Telegram note), then wait for my result.
   - Check the milestone's "Done when" line in PRD §12 item by item and report ✅/❌.
   - Update docs/progress.md, and commit as "M<n>: <summary>".
   M1 note: the pipeline runs steps 1, 6, 7, 9 of §6.4 (no scoring or news yet) with
   memoryRepo. Steps are added in later milestones, not rewritten.

3. QUALITY BARS YOU MUST HOLD
   - The drafter system prompt must contain voice-skill.txt verbatim + the 3 examples.
     Add a debug log that prints the SHA-256 of the system prompt on every draft call,
     so we can prove the voice reaches the model.
   - The score is computed in code from the criteria, never taken from the model.
   - `npm run eval` must meet every expectation in notes.json before M2 is done. If
     every note passes the gate, the rubric is too lenient: tighten it and rerun.
   - Zero hard voice-lint violations on delivered drafts for note_01 and note_02.
   - No LinkedIn integration of any kind.

4. WHEN UNSURE
   Follow the PRD. If the PRD is silent, choose the simplest option consistent with it,
   note it in docs/decisions.md, and tell me in your milestone report.

Start with step 1.
```

---

## What you'll need ready before M1 (have these open)
1. Telegram bot token (BotFather) and the channel chat ID (`-100…`) → `TELEGRAM_ALLOWED_CHAT_IDS`. Add your DM chat ID too if you want to test by DM. The bot must be an admin of the channel with **Post Messages** enabled.
2. Gemini API key (Google AI Studio).
3. Anthropic API key (needed from M5. Before that the drafter falls back to Gemini).
4. A Supabase project (URL + service-role key). Needed from M4.
5. GitHub repo + Vercel account linked to it.
6. A random webhook secret: `openssl rand -hex 24`.
