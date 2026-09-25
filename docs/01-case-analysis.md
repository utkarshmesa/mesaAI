# Meera LinkedIn Bot — Analysis Prompt + Full Breakdown

Part A is the chain-of-thought prompt. Part B is that prompt run against all 11 files you shared.

---

## PART A — The Chain-of-Thought Analysis Prompt

```
ROLE
You are the lead builder on "Case 1: Meera and the Content Backlog". You will build a
Telegram bot that turns Meera Pillai's raw notes into LinkedIn drafts in her voice.
Before writing any code, you have to understand the whole case. Work through the steps
below in order. Show your reasoning at each step. Don't move on until the step's output
is concrete and backed by evidence from the source files, not generic advice.

SOURCE FILES
- Case pre-read (the problem, what Meera wants, what she's providing)
- Automation Brief slides + Answer Key (Nine Checks, the Cut, stack, checkpoints L3/B1)
- Telegram setup guide (channel, BotFather, admin rights, chat ID)
- published/ corpus (4 LinkedIn posts + 11 newsletters), the only voice reference
- 5 sample notes (Note 01–05), representative of the notes/ input
- Blank templates (Automation Brief, Nine Checks, Components Map)

STEP 1: WHAT (the problem, restated)
1.1 In one sentence, what is actually broken? (Hint: it isn't "writing".)
1.2 Who is the single user? What does she keep doing, and what won't she change?
1.3 What does success look like as numbers? Give the baseline and the target.
1.4 Write down the Journey Today, step by step.

STEP 2: WHY (does it deserve to be built, and where does it stop?)
2.1 Go through all nine checks with evidence. Mark the kill switches, sizing and
    boundary checks.
2.2 Find the Cut: which thing Meera asks for does a check stop us building? Why?
2.3 List what gets automated and what stays human.
2.4 List anything in the source files that contradicts itself, and resolve it.

STEP 3: VOICE (the heart of the product)
3.1 Read all 15 published pieces. Pull out patterns and quote evidence for each:
    how she opens, sentence rhythm, how she uses data, how she hedges, what she
    discloses, how she closes, formatting, spelling, length.
3.2 List what she NEVER does (banned words, formats, tones).
3.3 Pull out the post "skeleton" she reuses.
3.4 Explain why the hired writer failed. Turn that into rules the model must follow.

STEP 4: INPUT (the notes)
4.1 Classify each sample note: strength, topic, what's new about it, risks.
4.2 Check each note against the published corpus. Has she already said this?
4.3 Pull out the scoring criteria a 0–10 scorer needs, and set the 6/10 threshold
    against these real notes.
4.4 Spot risks in the input: legal (naming suppliers), privacy (customers),
    made-up facts, voice notes arriving as audio.

STEP 5: HOW (architecture)
5.1 Fill in the Components Map: Actor × (Trigger → Input → Context → Processing
    → AI → Output). Mark the human gate.
5.2 Lay out the pipeline in order, with the model and job for each step.
5.3 Describe the data model (Supabase tables, statuses).
5.4 Give the Telegram specifics: update types, auth, reply-to, message limits.
5.5 Give the hosting specifics: Vercel timeouts, webhook retries, idempotency, secrets.

STEP 6: RISKS & EDGE CASES
List every way this fails. For each one, give the mitigation and say whether it
needs code, a prompt change or a human.

STEP 7: BUILD PLAN
Map the work to checkpoints (L3·1–3, B1·1–3, model comparison). Give each one a
test and a "done when". Say what we build beyond the syllabus, and why.

STEP 8: OPEN QUESTIONS
List what we can't decide from the files alone and have to settle with the user.

OUTPUT RULES
Cite the file for every claim ("newsletter_009", "Note 03", "Answer Key p.3").
Give specifics, not generic advice. If something is an assumption, label it.
```

---

## PART B — The Analysis (prompt executed)

### STEP 1: WHAT

**1.1 What's actually broken.** Meera doesn't lack ideas or skill. She has 60 notes, 40 drafts and published work that performs well. The problem is **the stall between capture and a shaped first draft** ("I open the doc, I write two lines, I decide it's not good enough, I close it"). The bot's job is to **remove the blank page**. Replacing Meera as the author is not the job.

**1.2 User.** Meera Pillai is the founder of Skinstinct: Mumbai, D2C skincare, ₹14–16L a month, 18 months old, and she spent 2 years in pharma formulation before that. The habit she won't give up is dropping notes into a private Telegram channel, 2–3 a week. Her audience is urban women aged 28–40 "tired of being sold to", plus wholesale buyers.

**1.3 Success metrics.**

| Metric | Baseline | Target |
|---|---|---|
| Posts published | ~0.5/month (4 in 8 months) | 3/week |
| Meera's active time | 90–180 min "stall time" per post | <15 min/week (Answer Key) |
| Proxy metrics (ours) | none | approval rate, how much she edits each draft, notes→drafts ratio |

Note: 3 posts a week means about 12 notes a month have to pass the scorer, but she only drops about 10. **The 60-note backlog is the buffer**, so the backlog needs a way in, not just new notes. (This is our inference.)

**1.4 Journey Today.** Note goes into Telegram → sits there unprocessed → sometimes she opens Drive and finds a note or draft → writes 2 lines → abandons it → the draft joins the 40 others → nothing is published.

### STEP 2: WHY

**2.1 Nine Checks (condensed)**

| # | Check | Result | Evidence |
|---|---|---|---|
| 01 | Problem real | YES | 60 notes, 40 drafts, 11 weeks silent |
| 02 | Workflow repeated | YES | 2–3 notes/week for 8 months |
| 03 | Input available | YES | Telegram active, 60 notes, 15 published pieces |
| 04 | Output valuable | YES | 47K impressions from 4 posts. One post → 340 visits + 3 wholesale enquiries |
| 05 | Impact measurable | YES | 0.5/month → 3/week, and 90–180 min → 15 min |
| 08 | ROI worth it | YES | One converted wholesale enquiry is worth more than the build cost |
| 06 | Failure risk OK | YES | Only if nothing reaches LinkedIn without her |
| **07** | **Judgment protected** | **NO → THE CUT** | She turned down 2 consultants who built end-to-end tools |
| 09 | Owner clear | YES | Meera reviews, edits, publishes |

**2.2 The Cut.** We **don't auto-post or auto-schedule to LinkedIn.** Meera wants to stay the author of everything published. The system stops at "draft ready in Telegram, status pending." Only she approves and publishes.

**2.3 Automated vs. human.** Automated: capture, scoring, news research, drafting, storage. Human: review, edit, approve/reject, **fact-checking the news claim**, publishing.

**2.4 Contradictions in the source files, and how to resolve them**

1. **Check 07 is YES on the slides but NO in the Answer Key.** The Answer Key is right: 07 fails *as she originally described the ask*, and that's what creates the human gate. After the Cut, the scoped build passes.
2. **The slides number ROI as 06; the Answer Key numbers it 08.** Cosmetic. We follow the Answer Key.
3. **Telegram guide: "Post Messages only" vs. "It cannot post by itself — it can only listen."** Wrong. The bot *must* post: the drafts come back into the same channel. It needs the Post Messages permission, and it does post.
4. **Channel vs. DM.** The L3 Claude Code prompt says "sends notes as text messages to a Telegram bot" (a DM). The setup guide uses a **channel**. These arrive as different update types: `message` for a DM, `channel_post` for a channel. **The code has to handle both**, or the channel version silently does nothing. This is the most common reason these builds fail.
5. **The setup guide skips Section 06.** Nothing is missing. It's only a numbering gap.

### STEP 3: VOICE

**3.1 Her patterns, with evidence**

| Dimension | Pattern | Evidence |
|---|---|---|
| **Opening** | Starts on a concrete fact, scene or number. No hook question, no "Let's talk about…" | "In 2021 I was sitting in a stability review meeting…" (LI-002). "In the 12 months to June 2025, 23% of our product returns…" (LI-003). "Last September I was at a trade fair in Mumbai." (LI-004) |
| **Early purpose line** | Says why she's writing, in the first person | "I want to explain why, because I've seen this misunderstood enough times…" (LI-001). "I want to talk about how actives work…" (NL-002) |
| **Rhythm** | Long explanatory sentences, then short flat verdicts | "Most serums don't list their pH on the label. This is legal. It is also not helpful." (LI-001) |
| **Data** | Exact figures, units, ranges, mechanisms: pH 3.2, 71%, 2mg/cm², 49°C | Every piece. Numbers explain the mechanism. They aren't there as social proof |
| **Structure** | Numbered reasoning in prose: "The second thing…", "The third thing…" | LI-001, NL-006 |
| **Hedging / precision** | Says what she is *not* claiming | "I want to be precise about what I'm not saying here." (LI-002). "I am not making a case that niacinamide doesn't work." (LI-001). "I'm not saying…" appears in ~10 of 15 pieces |
| **Self-disclosure** | Admits her own mistakes and discloses commercial interest | "it should have been right the first time" (LI-003). "We don't currently sell a peptide product… I don't have a commercial stake" (NL-010) |
| **Fairness** | Doesn't blame people; blames systems | "I'm not saying the people in that room were incompetent or malicious. I'm saying the system had a gap" (LI-002) |
| **Closing** | An empowering action for the reader: *ask for documentation*. Silence or a vague answer "is useful information" | LI-001, LI-004, NL-003, NL-008. "that's useful information" is her signature line |
| **Personal level** | Professionally personal: pharma past, founding moment, mistakes. Never family, feelings or lifestyle | LI-002, NL-011 |
| **Stance** | Anti-marketing and pro-evidence, but not cynical. Gives credit where it's due | NL-009 (what clean beauty "gets right" comes first) |
| **Spelling** | British/Indian English | oxidise, sensitisation, moisturiser, colour, organisation |
| **Format** | Plain prose paragraphs, 5–9 of them. No headings, bullets, emojis, hashtags or exclamation marks | All 4 LinkedIn posts |
| **Length** | LinkedIn posts run 426–536 words / ~2,500–3,350 chars | Measured. **LinkedIn caps posts at 3,000 chars**, so aim for 2,200–2,900 |
| **Context** | India-specific details: humidity, Mumbai summer, Indian labelling rules, UV index | LI-003, LI-004, NL-004, NL-006 |

**3.2 What she never does (hard bans for the model)**
Emojis. Hashtag blocks. "🚀 / Game-changer / Unlock / Glow / Skin-loving / Holy grail / Journey / Excited to share / Thoughts? / Agree?" Rhetorical-question hooks. One-line-per-sentence "broetry". Sales CTAs ("shop now", "link in bio"). Claims of medical authority ("I'm not a dermatologist", NL-001). Unqualified absolutes. Attacking a named competitor or supplier. Invented statistics.

**3.3 Her reusable skeleton**
1. A concrete trigger (an event, a data point, a customer question)
2. "I want to explain / be careful / be precise…" (why this matters)
3. The mechanism, explained plainly with real numbers
4. Complicating factors, in numbered prose ("The second thing…")
5. What I'm *not* saying (the calibrated hedge)
6. What we do / did, with honest disclosure (including mistakes or no commercial stake)
7. What *you* can do: ask for X. If they can't answer, "that's useful information."

**3.4 Why the content writer failed, and what that means for us**
The drafts were "grammatically clean and factually accurate", and she still rewrote them. So correctness isn't enough. What was missing was *her reasoning moves*: the hedges, the disclosures, the mechanism-first explanation, and the refusal to hype. **Rule: the model has to reproduce how she argues, not just her topics and tone.**

**Implication for the Voice Skill.** The syllabus asks for a 150–200 word profile. That's too thin to hold a voice across 450 words. **Recommendation:** make `voice-skill.txt` a structured spec (patterns + bans + skeleton + length limits), **and include 2 full LinkedIn posts as few-shot examples** in the drafting prompt. (This goes beyond the syllabus. Your call.)

### STEP 4: INPUT (the 5 sample notes)

| Note | Topic | Strength | Already in published? | Risks | Predicted score |
|---|---|---|---|---|---|
| **01** Batch 14 pH drift | Supplier silently changed the preservative; pH dropped 0.4; batch held | **Strong.** Real event, mechanism, a clear lesson ("same formula reorder isn't the same formula"), an action (check the CoA against a baseline) | New. Related to her batch-consistency theme (LI-001) | Don't name the supplier. Don't invent batch size or number of customers | **8–9** |
| **02** Serum "stopped working" | Layering order: occlusive before serum | **Strong.** A customer story, a clear misconception, practical | Partly (NL-003 covers layering and pH). The occlusive-order angle is new | Anonymise the customer completely. Don't give medical advice about "congestion" | **7–8** |
| **03** Fake "cold-pressed" | Spec says cold-pressed; the log shows 70–85°C | Strong story, **but** | **Largely already published** in NL-008 (same temperature-log anecdote) | **Legal/defamation:** implies the supplier misrepresented. She's cautious ("either a labelling error or not"). Must never name the supplier or imply intent | **5–7 (borderline)**, and it needs a "repeat" flag |
| **04** Barrier: different damage causes | Over-exfoliation vs lipid depletion vs genetic ceramide issues | **Medium.** A half-formed insight with a good new angle ("the solution isn't always the same") | Overlaps NL-007 (brick/mortar, "it's not really a wall") | Mentions a "genetic condition", so it needs medical-claim care. The note trails off, so the model will want to fill gaps | **6** |
| **05** Clean beauty | Label imprecise, but customer intent is real | Thoughtful, but she says herself "I've said some version of this before and I'm not sure what the new angle is" | **Yes**, NL-009 | Repetition. Commercial tension | **4–5 → reject, or return with "suggested new angles"** |

**Key insight: the scorer needs a novelty check against the published corpus.** The syllabus scorer only judges the note on its own. Notes 03 and 05 show that Meera repeats her themes, and a 3-posts-a-week cadence will make that worse. **Recommendation:** pass a short index of the published pieces (topics + key anecdotes) into the scoring prompt, and score these criteria:

1. **Specificity**: a concrete event, number or mechanism (0–3)
2. **Clear point / lesson** (0–3)
3. **Novelty** against published and past drafts (0–2)
4. **Audience value**: can the reader act on it? (0–2)
5. **Risk flags**: legal, medical, privacy. These don't lower the score. They're attached to the draft as warnings.
6. **Auto-reject** (score ≤3): logistics, reminders, fragments under ~25 words, pure emotion with no insight

The 6/10 threshold, set against these notes: 01 and 02 pass comfortably, 04 is just at the line, 03 depends on the novelty weighting, and 05 fails. That spread is a good calibration set. **If all 5 pass, the scorer is too lenient** (as the Answer Key warns).

**Other input risks**
- **Voice notes.** The case says the notes are "voice note transcriptions". If Meera sends real Telegram voice messages, text-only code ignores them. Options: Gemini accepts audio directly, or we just reply "text only for now".
- **Made-up facts.** The model must use only facts in the note. If a post "needs" a number the note doesn't have, it inserts `[CHECK: …]` rather than making one up. (The notes have exact figures like 0.4 pH and 70–85°C. An invented neighbour to those would be dangerous under her name.)
- **Backlog.** 60 historical notes need a bulk path, or they stay dead. A later feature could be a `/backlog` command or a one-time import script.

### STEP 5: HOW

**5.1 Components Map**

| Actor | Trigger | Input | Context | Processing | AI | Output |
|---|---|---|---|---|---|---|
| **Meera** | Posts a note in her channel ● | Raw note text | — | — | — | **Reviews → APPROVE / REJECT → publishes to LinkedIn herself** ◆ HUMAN GATE |
| **Telegram** | Webhook → Vercel `/api/webhook` ● | `channel_post` / `message` payload | — | Chat-ID allowlist, dedupe on update_id | — | Delivers score message or draft back to the channel ● |
| **Vercel function** | — | Parsed note | Loads voice-skill + published index (Supabase) | Orchestrates the steps. Saves note/draft | — | Formats message, adds verify block |
| **Gemini Flash** | — | Note | Scoring rubric + published index | — | ① Score 0–10 + reason ② Extract 3–5 keywords | Score JSON, search phrase |
| **Google News RSS** | — | Search phrase | — | Fetch top result: headline, source, date, link | — | News item (or none) |
| **Claude / Gemini (drafter)** | — | Note + news item | **Voice Skill** + few-shot posts + bans | — | ③ Draft post, use news only if it fits | Draft text |
| **Supabase** | — | — | voice_skill table | Stores notes, drafts, status | — | Audit trail |
| **Review Gate** | Meera replies to the draft ● | APPROVE / REJECT (reply-to) | — | Updates draft status | — | Confirmation ✓ |

**5.2 Pipeline sequence**
```
Telegram update → verify secret header + chat_id → dedupe (update_id)
→ save note (status: received)
→ [Gemini Flash] score {score, reason, flags, duplicate_of}
   ├─ <6 → reply "No draft: <reason>" → note.status = rejected_by_scorer → stop
   └─ ≥6 ↓
→ [Gemini Flash] keywords → search phrase
→ Google News RSS (en-IN, recent) → top item or null
→ [Drafter] voice skill + examples + note + news + rules
→ save draft (status: pending)
→ send to Telegram: draft + score + risk flags + NEWS VERIFY BLOCK (if news used)
→ Meera replies APPROVE / REJECT → draft.status updated (both kept, never deleted)
```

**5.3 Data model (Supabase)**
- `notes`: id, telegram_message_id, chat_id, text, score, score_reason, flags, status, created_at
- `drafts`: id, note_id, telegram_message_id (of the bot's draft message, used to match replies), body, news_headline, news_source, news_date, news_url, model, status (`pending|approved|rejected`), created_at, decided_at
- `voice_skill`: id, version, content, active, created_at. Versioned, so we can tell which voice produced which draft.

**5.4 Telegram specifics**
- Handle both `channel_post` and `message`. Channel posts have **no `from` user**, so authenticate on `chat.id == TELEGRAM_CHAT_ID` (the -100… value).
- Match APPROVE/REJECT through `reply_to_message.message_id` → `drafts.telegram_message_id`. If there's no reply-to, fall back to the latest pending draft.
- Bots don't receive their own channel posts, so there's no self-loop. Still ignore anything that starts with our own markers (e.g. "No draft:", "DRAFT").
- **Message limit is 4,096 chars.** A draft of ~2,900 chars plus the verify block fits, but split the message defensively.
- Set the webhook with `secret_token`, and check the `X-Telegram-Bot-Api-Secret-Token` header. (The syllabus URL skips this. Anyone who finds the URL could trigger Gemini calls.)

**5.5 Vercel specifics**
- 3 LLM calls plus an RSS fetch can take 10–30s. Telegram **retries the webhook if we don't return 200 quickly**, and a retry means a duplicate draft. Mitigations: dedupe on `update_id` in Supabase, raise `maxDuration`, and/or acknowledge immediately and continue with `waitUntil`. (We'll check the current Vercel limits at build time.)
- `.env` goes in `.gitignore`. Keys live in Vercel env vars: `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`, `TELEGRAM_WEBHOOK_SECRET`, `GEMINI_API_KEY`, `ANTHROPIC_API_KEY` (B1), `SUPABASE_URL`, `SUPABASE_KEY`.
- Voice skill: in L3 it's bundled as a file. In B1 it comes from the Supabase `voice_skill` table, with the file as fallback. Log the prompt hash so "is the voice reaching the model?" can be answered in a few seconds.

### STEP 6: RISKS & EDGE CASES

| Risk | Mitigation | Type |
|---|---|---|
| Draft sounds generic ("LinkedIn-y") | Richer voice spec + few-shot examples + ban list + Claude as drafter | Prompt |
| Invented facts or stats | "Only facts from the note or the news item". `[CHECK]` placeholders | Prompt + human |
| News item irrelevant or wrong | "Use only if genuinely relevant". Mandatory verify block. Recency filter | Prompt + code + human |
| Google News links are redirect URLs | Show the source + date clearly. Meera clicks through to verify | Code |
| Defamation (Note 03 type) | Never name suppliers or competitors. Add a risk flag to the draft | Prompt |
| Customer privacy (Note 02) | Anonymise. No identifying details | Prompt |
| Medical-claim creep | Keep her "not a dermatologist" stance. Explain mechanisms, don't diagnose | Prompt |
| Repeating published themes | Novelty check against the published index + past drafts | Prompt + data |
| Webhook retries → duplicates | Dedupe on update_id / message_id | Code |
| Timeouts | maxDuration / waitUntil. Cheap models for scoring | Code |
| Voice/photo messages ignored | Detect them and reply "text only" (or transcribe later) | Code |
| Scorer too lenient or too strict | Calibrate on the 5 notes. Log scores and review weekly | Human |
| Post over 3,000 chars | A length rule in the prompt + a code check with a warning | Prompt + code |
| Leaked keys / open webhook | .gitignore, env vars, secret_token, chat-ID allowlist | Code |

### STEP 7: BUILD PLAN

| Checkpoint | Build | Test / Done when |
|---|---|---|
| **L3·1** Voice Skill | voice-skill.txt, built from Step 3 above (richer than 150–200 words) | Reads as specific to Meera. Every rule traces back to a quote |
| **L3·2** Project | Vercel serverless `/api/webhook`, Telegram handler, Gemini draft call, env + gitignore | Deployed. The URL is live |
| **L3·3** Connect | setWebhook (+ secret_token) | Note 01 → a draft in her voice arrives in the channel |
| **B1·1** Scoring | Gemini Flash rubric (+ novelty) → reject message under 6 | Notes 01/02 pass, Note 05 is rejected, and a "buy labels" reminder scores ≤3 |
| **B1·2** News angle | Keywords → Google News RSS → draft + verify block | A draft shows headline, source, date, link and ⚠ |
| **B1·3** Memory | Supabase 3 tables + APPROVE/REJECT via reply | Status persists after a refresh. Rejected rows are kept |
| **Final** Model comparison | Swap the drafter to Claude. Run the same note through both | A one-line comparison is written down |

**Beyond the syllabus (proposed):** idempotency, webhook secret, channel_post handling, novelty check, `[CHECK]` placeholders, risk flags, few-shot examples, a length guard, voice-message handling, a backlog import, a `REDO: <feedback>` command, and a metrics view (approval rate, time-to-approve).

### STEP 8: OPEN QUESTIONS FOR YOU

1. **Language/runtime:** Node/TypeScript or Python on Vercel? (TS is the more natural fit for Vercel.)
2. **Voice Skill depth:** follow the syllabus (150–200 words) or build the richer spec + few-shot version?
3. **Scope:** stick strictly to the L3 → B1 checkpoints, or also add the "beyond syllabus" items?
4. **Channel or DM** as the capture point? (We'll support both either way.)
5. **Do you have the Telegram bot token, chat ID, Gemini key, Supabase project and Vercel/GitHub accounts ready**, and do you want me to build in this workspace or in a folder on your computer?
6. **Drafter model:** Gemini first (per syllabus) and then Claude, or go straight to Claude?
