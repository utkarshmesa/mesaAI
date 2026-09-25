// PRD §7.1 analyse prompt (Gemini Flash, one call → score criteria + search phrase).
// Bump PROMPT_VERSION whenever the text below changes.
import { z } from 'zod';
import type { PublishedItem } from '../context.js';

export const PROMPT_VERSION = 'analyse-1.0.0';

export const AnalysisSchema = z.object({
  category: z.enum(['insight', 'logistics', 'venting', 'fragment']),
  criteria: z.object({
    specificity: z.number().int().min(0).max(3),
    clear_point: z.number().int().min(0).max(3),
    novelty: z.number().int().min(0).max(2),
    reader_value: z.number().int().min(0).max(2),
  }),
  reason: z.string().min(1),
  flags: z.array(z.enum(['LEGAL', 'PRIVACY', 'MEDICAL', 'REPEAT'])),
  duplicate_of: z.string().nullable(),
  suggested_angle: z.string().nullable(),
  search_phrase: z.string().min(1),
  entities: z.array(z.string()),
});
export type Analysis = z.infer<typeof AnalysisSchema>;

// §6.5 rubric table, verbatim.
const RUBRIC = `| Criterion | Range | 0 | Top of range |
|---|---|---|---|
| specificity | 0–3 | No concrete event, number or mechanism | A first-hand event with specifics (numbers, process, outcome) |
| clear_point | 0–3 | No discernible point | One clear, stateable lesson |
| novelty | 0–2 | 0 = same core claim as a published item and no new first-hand anecdote or angle. 1 = same core claim, but a new first-hand anecdote or a clearly new angle | 2 = a core claim she hasn't published |
| reader_value | 0–2 | Nothing the reader can use | A reader can act on or check something |`;

export const ANALYSE_SYSTEM = `You are the editorial screener for Meera Pillai's LinkedIn. Meera is the founder of Skinstinct, a minimal-ingredient skincare brand, and a former pharmaceutical formulation scientist.

Rate the note using this rubric:
${RUBRIC}

Compare it against the published index. A note repeats a published item only if it has the same core claim AND the same anecdote. The same broad topic is not a repeat. Whenever novelty is 0 or 1, set duplicate_of to the id of the published item with the same core claim; otherwise set duplicate_of to null.

Categorise it as insight | logistics | venting | fragment. Reminders, to-dos and admin are logistics. Complaints about her day with no lesson are venting. Unfinished half-thoughts are fragment.

If novelty ≤ 1 or the note is weak, suggest one concrete new angle she hasn't published (suggested_angle, ≤ 25 words); otherwise null.

Flags (include every one that applies):
- LEGAL: the note describes a third party (supplier, manufacturer, brand) falling short, whether or not it's named.
- PRIVACY: the note concerns a specific real customer or person's situation, even if unnamed.
- MEDICAL: the note involves a skin condition, symptom or treatment.
- REPEAT: include when duplicate_of is set.

reason: ≤ 20 words, written to Meera in the second person, plain and direct.
search_phrase: a 3–6 word news search phrase about the underlying industry topic, never a brand or person.
entities: every named person, company, brand or supplier in the note (not ingredients or technical terms, and not Skinstinct or Meera herself); [] if none.

Return JSON only matching the schema.`;

export interface PriorDraft {
  id: string;
  first_line: string;
}

export function buildAnalyseUserPrompt(note: string, published: PublishedItem[], recentDrafts: PriorDraft[] = []): string {
  const index = published.map(({ id, title, core_claim, anecdotes }) => ({ id, title, core_claim, anecdotes }));
  const parts = [`PUBLISHED INDEX:\n${JSON.stringify(index)}`];
  if (recentDrafts.length) {
    parts.push(`RECENT DRAFTS (not yet published; a repeat of one of these also counts, use its id as duplicate_of):\n${JSON.stringify(recentDrafts)}`);
  }
  parts.push(`NOTE:\n${note}`);
  return parts.join('\n\n');
}
