import { describe, expect, it } from 'vitest';
import { cleanEntities, computeScore, gate, normaliseFlags, preFilter, scoreAnalysis } from '../src/pipeline/score.js';
import notes from './fixtures/notes.json' with { type: 'json' };
import { PASS_ANALYSIS } from './helpers.js';

const known = new Set(['NL-008', 'NL-009']);
const c = (specificity: number, clear_point: number, novelty: number, reader_value: number) => ({ specificity, clear_point, novelty, reader_value });

describe('computeScore §6.5', () => {
  it('R5 adds the four criteria (0..10)', () => {
    expect(computeScore(c(3, 3, 2, 2), 'insight')).toBe(10);
    expect(computeScore(c(2, 2, 1, 1), 'insight')).toBe(6);
    expect(computeScore(c(0, 0, 1, 0), 'insight')).toBe(1);
  });
  it('R13 novelty 0 caps the score at 5, always below the gate', () => {
    expect(computeScore(c(3, 3, 0, 2), 'insight')).toBe(5);
    expect(gate(computeScore(c(3, 3, 0, 2), 'insight'), 6)).toBe('reject');
  });
  it('R13 novelty 1 is not capped', () => {
    expect(computeScore(c(3, 3, 1, 2), 'insight')).toBe(9);
  });
  it('R5 logistics, venting and fragment are capped at 2', () => {
    for (const cat of ['logistics', 'venting', 'fragment'] as const) expect(computeScore(c(3, 3, 2, 2), cat)).toBe(2);
  });
  it('R5 gate: below threshold rejects, at threshold passes', () => {
    expect(gate(5, 6)).toBe('reject');
    expect(gate(6, 6)).toBe('pass');
  });
});

describe('preFilter', () => {
  it('R5 junk_02 is rejected before any LLM call', () => {
    const junk02 = notes.notes.find((n) => n.id === 'junk_02')!;
    expect(preFilter(junk02.text, 12)).toEqual({ pass: false, reason: 'Too short to develop' });
  });
  it('R5 every other fixture passes the pre-filter', () => {
    for (const n of notes.notes.filter((x) => x.id !== 'junk_02')) expect(preFilter(n.text, 12).pass).toBe(true);
  });
});

describe('normaliseFlags', () => {
  it('R13 REPEAT is set iff duplicate_of is set', () => {
    expect(normaliseFlags(['LEGAL'], 'NL-008', 0, known)).toEqual({ flags: ['LEGAL', 'REPEAT'], duplicate_of: 'NL-008' });
    expect(normaliseFlags(['REPEAT', 'MEDICAL'], null, 1, known)).toEqual({ flags: ['MEDICAL'], duplicate_of: null });
  });
  it('R13 unknown ids and novelty 2 clear duplicate_of', () => {
    expect(normaliseFlags([], 'NL-999', 0, known).duplicate_of).toBeNull();
    expect(normaliseFlags(['REPEAT'], 'NL-008', 2, known)).toEqual({ flags: [], duplicate_of: null });
  });
});

describe('scoreAnalysis', () => {
  it('R5 the score comes from code, not the model', () => {
    const s = scoreAnalysis({ ...PASS_ANALYSIS, category: 'insight', criteria: c(1, 1, 0, 1), flags: [], score: 10 } as never, known);
    expect(s.score).toBe(3);
  });
  it('drops own brand from entities (plan A2)', () => {
    expect(cleanEntities(['Skinstinct', ' Acme Oils ', 'meera', 'Acme Oils'])).toEqual(['Acme Oils']);
  });
});
