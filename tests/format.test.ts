import { describe, expect, it } from 'vitest';
import { formatRejection, formatReviewCard, shortId, splitMessage } from '../src/pipeline/format.js';

const draft = { id: 'abcdef12-3456-7890-abcd-ef1234567890', body: 'x'.repeat(2640), news: null };
const lint = { hard: [], soft: [], check_count: 0 };

describe('message formats §6.8', () => {
  it('R4 M1 card: no score, no flags, no checks', () => {
    const [card] = formatReviewCard({ draft, lint, score: null, reason: null, flags: [], duplicateOf: null });
    expect(card).toBe(
      ['DRAFT · #abcdef', 'Length: 2,640 / 3,000 chars', '─────────────────────────────────', 'Reply: APPROVE · REJECT: reason · REDO: what to change'].join('\n'),
    );
  });
  it('R14 full card with score, flags, REPEAT id, checks and lint lines', () => {
    const [card] = formatReviewCard({
      draft,
      lint: { hard: ['Contains "!"'], soft: ['3 question marks'], check_count: 2 },
      score: 8,
      reason: 'Strong first-hand event',
      flags: ['LEGAL', 'REPEAT'],
      duplicateOf: 'NL-008',
    });
    expect(card).toContain('DRAFT · #abcdef · Score 8/10\nWhy: Strong first-hand event\nFlags: LEGAL, REPEAT (NL-008)\nChecks needed: 2 [CHECK] items');
    expect(card).toContain('Style: 3 question marks');
    expect(card).toContain('⚠ Lint: Contains "!"');
    expect(card).not.toContain('NEWS SOURCE');
  });
  it('R7 news block appears only when a news item was used', () => {
    const news = { headline: 'CDSCO tightens labelling', source: 'Mint', date: '2026-09-20', url: 'https://news.google.com/x' };
    const [card] = formatReviewCard({ draft: { ...draft, news }, lint, score: 7, reason: 'r', flags: [], duplicateOf: null });
    expect(card).toContain('NEWS SOURCE: CDSCO tightens labelling\nFROM: Mint · 2026-09-20\nLINK: https://news.google.com/x\n⚠ Check this before publishing — you are the author of this claim');
  });
  it('R5 rejection message with and without a suggested angle', () => {
    expect(formatRejection(4, 'Same point as NL-009.', 'What checklists miss')).toBe('No draft (score 4/10): Same point as NL-009. Try: What checklists miss');
    expect(formatRejection(0, 'Too short to develop', null)).toBe('No draft (score 0/10): Too short to develop.');
  });
  it('R4 splits messages over 4,096 chars on paragraph boundaries', () => {
    const p = 'y'.repeat(1500);
    const parts = splitMessage([p, p, p, p].join('\n\n'));
    expect(parts).toEqual([`${p}\n\n${p}`, `${p}\n\n${p}`]);
    expect(splitMessage('short')).toEqual(['short']);
    expect(splitMessage('z'.repeat(5000)).map((s) => s.length)).toEqual([4096, 904]);
  });
  it('shortId is 6 hex chars', () => {
    expect(shortId(draft.id)).toBe('abcdef');
  });
});
