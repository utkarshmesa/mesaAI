// PRD §7.2 drafter prompt. Bump PROMPT_VERSION whenever the text below changes.
import { createHash } from 'node:crypto';
import { z } from 'zod';
import type { Flag, NewsItem } from '../types.js';

export const PROMPT_VERSION = 'draft-1.0.0';

export const DraftResultSchema = z.object({
  post: z.string().min(1),
  news_item_used: z.number().int().nullable(),
});
export type DraftResult = z.infer<typeof DraftResultSchema>;

const RULES = `RULES FOR THIS TASK
1. Write one LinkedIn post from Meera's note. Keep her point. Don't invent a different one.
2. Use only facts from the note or the chosen news item. For any missing fact write [CHECK: what's needed].
3. News: use at most one item, and only if it is directly relevant to the note's point. Otherwise set news_item_used to null. Never let the news become the main subject. You only have the headline, source and date. Any claim about the article beyond what the headline says must be written as [CHECK: …].
4. Flags: LEGAL → name no third party and imply no intent. PRIVACY → anonymise fully. MEDICAL → no diagnosis or treatment advice; suggest seeing a dermatologist where a condition is involved. REPEAT → take the suggested angle, not the published one.
5. Length: 2,200–2,900 characters. Hard cap 3,000.
6. If REDO feedback is present, apply it and keep everything else that worked.

Return JSON only: {"post": string, "news_item_used": number | null}. "post" is plain text with paragraphs separated by a blank line. "news_item_used" is the "i" of the news item you used, or null.`;

/** System prompt = voice skill (verbatim) + the example posts + the task rules. */
export function buildDraftSystemPrompt(voiceSkill: string, examples: string[]): string {
  const ex = examples.map((e) => `<example>\n${e.trim()}\n</example>`).join('\n\n');
  return `${voiceSkill}\n\nEXAMPLE POSTS BY MEERA (match this voice; do not copy their content)\n\n${ex}\n\n${RULES}`;
}

export function sha256(s: string): string {
  return createHash('sha256').update(s, 'utf8').digest('hex');
}

export interface DraftInput {
  note: string;
  flags: Flag[];
  suggestedAngle: string | null;
  news: NewsItem[];
  redoFeedback?: string | null;
  previousDraft?: string | null;
  lintViolations?: string[];
}

export function buildDraftUserPrompt(d: DraftInput): string {
  const parts = [`NOTE FROM MEERA:\n${d.note}`];
  parts.push(`FLAGS: ${d.flags.length ? d.flags.join(', ') : 'none'}`);
  if (d.suggestedAngle) parts.push(`SUGGESTED ANGLE: ${d.suggestedAngle}`);
  const news = d.news.map((n, i) => ({ i: i + 1, headline: n.headline, source: n.source, date: n.date }));
  parts.push(`NEWS ITEMS: ${news.length ? JSON.stringify(news) : 'none (set news_item_used to null)'}`);
  if (d.redoFeedback) parts.push(`REDO FEEDBACK: ${d.redoFeedback}`);
  if (d.previousDraft) parts.push(`PREVIOUS DRAFT:\n${d.previousDraft}`);
  if (d.lintViolations?.length) {
    parts.push(`YOUR LAST DRAFT BROKE THESE RULES. Rewrite it without them:\n- ${d.lintViolations.join('\n- ')}`);
  }
  return parts.join('\n\n');
}
