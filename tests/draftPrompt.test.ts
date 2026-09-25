import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { loadContext } from '../src/context.js';
import { buildDraftSystemPrompt, buildDraftUserPrompt, sha256 } from '../src/prompts/draft.js';

const ctx = loadContext();
const system = buildDraftSystemPrompt(ctx.voiceSkill, ctx.examples);

describe('drafter prompt §7.2', () => {
  it('R3 system prompt contains voice-skill.txt verbatim', () => {
    expect(system.includes(readFileSync('context/voice-skill.txt', 'utf8'))).toBe(true);
    expect(ctx.voiceVersion).toBe('1.0.0');
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
    expect(system).toContain('[CHECK: what');
  });
  it('R11 user prompt lists lint violations on regeneration', () => {
    const u = buildDraftUserPrompt({ note: 'n', flags: ['PRIVACY'], suggestedAngle: null, news: [], lintViolations: ['Contains "!"'] });
    expect(u).toContain('FLAGS: PRIVACY');
    expect(u).toContain('- Contains "!"');
  });
});
