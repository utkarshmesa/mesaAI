// PRD §6.8 message builders. Pure. Plain text only (no parse_mode).
import type { Draft, Flag, LintResult, NewsItem } from '../types.js';
import { HARD_MAX_CHARS, charCount } from './lint.js';

export const TG_LIMIT = 4096;
const RULE = '─────────────────────────────────';

export const TEXT_ONLY_REPLY = 'Text notes only for now. Send the note as text.';
export const HELP_TEXT = [
  'Post a note and I will send back a draft.',
  'Reply to a draft with: APPROVE · REJECT: reason · REDO: what to change',
  'Reply to a "No draft" message with: DRAFT ANYWAY',
  'Reply to the draft when you add a reason.',
].join('\n');
export const NOT_YET_REPLY = "That command isn't switched on yet.";

/** Split on paragraph boundaries so every part is ≤ limit; hard-cuts a single oversized paragraph. */
export function splitMessage(text: string, limit = TG_LIMIT): string[] {
  if (text.length <= limit) return [text];
  const parts: string[] = [];
  let current = '';
  for (const para of text.split('\n\n')) {
    const candidate = current ? `${current}\n\n${para}` : para;
    if (candidate.length <= limit) {
      current = candidate;
      continue;
    }
    if (current) parts.push(current);
    let rest = para;
    while (rest.length > limit) {
      parts.push(rest.slice(0, limit));
      rest = rest.slice(limit);
    }
    current = rest;
  }
  if (current) parts.push(current);
  return parts;
}

export function formatPost(post: string): string[] {
  return splitMessage(post);
}

export function shortId(id: string): string {
  return id.replace(/-/g, '').slice(0, 6);
}

export interface CardInput {
  draft: Pick<Draft, 'id' | 'body' | 'news'>;
  lint: LintResult;
  score: number | null; // null before scoring exists (M1)
  reason: string | null;
  flags: Flag[];
  duplicateOf: string | null;
}

export function formatReviewCard(c: CardInput): string[] {
  const head = `DRAFT · #${shortId(c.draft.id)}` + (c.score === null ? '' : ` · Score ${c.score}/10`);
  const lines = [head];
  if (c.reason) lines.push(`Why: ${c.reason}`);
  if (c.flags.length) {
    lines.push('Flags: ' + c.flags.map((f) => (f === 'REPEAT' && c.duplicateOf ? `REPEAT (${c.duplicateOf})` : f)).join(', '));
  }
  if (c.lint.check_count > 0) lines.push(`Checks needed: ${c.lint.check_count} [CHECK] item${c.lint.check_count === 1 ? '' : 's'}`);
  lines.push(`Length: ${charCount(c.draft.body).toLocaleString('en-US')} / ${HARD_MAX_CHARS.toLocaleString('en-US')} chars`);
  if (c.lint.soft.length) lines.push(`Style: ${c.lint.soft.join(', ')}`);
  if (c.lint.hard.length) lines.push(`⚠ Lint: ${c.lint.hard.join('; ')}`);
  if (c.draft.news) lines.push(...newsBlock(c.draft.news));
  lines.push(RULE, 'Reply: APPROVE · REJECT: reason · REDO: what to change');
  return splitMessage(lines.join('\n'));
}

function newsBlock(n: NewsItem): string[] {
  return [
    RULE,
    `NEWS SOURCE: ${n.headline}`,
    `FROM: ${n.source} · ${n.date}`,
    `LINK: ${n.url}`,
    '⚠ Check this before publishing — you are the author of this claim',
  ];
}

export function formatRejection(score: number, reason: string, angle: string | null): string {
  const why = reason.trim().replace(/[.\s]+$/, '');
  return `No draft (score ${score}/10): ${why}.` + (angle ? ` Try: ${angle.trim()}` : '');
}

export function formatError(stage: string): string {
  return `Something failed at ${stage}. Your note is saved.`;
}
