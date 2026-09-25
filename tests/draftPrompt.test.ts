import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { loadContext } from '../src/context.js';
import { buildDraftSystemPrompt, buildDraftUserPrompt, lengthBand, sha256 } from '../src/prompts/draft.js';

const ctx = loadContext();
const system = buildDraftSystemPrompt(ctx.voiceSkill, ctx.examples);

describe('drafter prompt §7.2', () => {
  it('R3 system prompt contains voice-skill.txt verbatim', () => {
    expect(system.includes(readFileSync('context/voice-skill.txt', 'utf8'))).toBe(true);
    expect(ctx.voiceVersion).toBe('2.2.1');
  });
  it('R3 system prompt has the 3 example posts in <example> tags, Category line stripped', () => {
    expect(system.match(/<example>/g)).toHaveLength(3);
    expect(system).not.toMatch(/^Category:/m);
    expect(system).toContain('In 2021 I was sitting in a stability review meeting');
    expect(system).toContain('In the 12 months to June 2025, 23% of our product returns');
    expect(system).toContain('Last September I was at a trade fair in Mumbai.');
  });
  it('R3 system prompt hash is stable across builds', () => {
    expect(sha256(system)).toBe(sha256(buildDraftSystemPrompt(ctx.voiceSkill, ctx.examples)));
    expect(sha256(system)).toMatch(/^[0-9a-f]{64}$/);
  });
  it('R14 rules demand [CHECK: …] for missing facts', () => {
    expect(system).toContain('[CHECK: question for Meera]');
    expect(system).toContain('the note and the news item are the only sources');
  });
  it('R11 user prompt lists lint violations on regeneration', () => {
    const u = buildDraftUserPrompt({ note: 'n', flags: ['PRIVACY'], suggestedAngle: null, news: [], lintViolations: ['Contains "!"'] });
    expect(u).toContain('FLAGS: PRIVACY');
    expect(u).toContain('- Contains "!"');
  });
  it('R3 code sets the length band from the note score (voice skill v2.2.1)', () => {
    expect(lengthBand(9)).toBe('2,200-2,800 characters (rich note)');
    expect(lengthBand(null)).toBe('2,200-2,800 characters (rich note)');
    expect(lengthBand(6)).toBe('1,600-2,100 characters (thin note)');
    expect(buildDraftUserPrompt({ note: 'n', score: 10, flags: [], suggestedAngle: null, news: [] })).toContain('TARGET LENGTH: 2,200-2,800');
  });
});
