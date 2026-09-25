import { describe, expect, it } from 'vitest';
import { charCount, containsPhrase, lintPost } from '../src/pipeline/lint.js';
import { goodPost } from './helpers.js';

const opts = { banned: ['unlock', 'thoughts?', 'game-changer', "here's the thing"], entities: [] as string[] };
const lint = (p: string, o = opts) => lintPost(p, o);

describe('voice lint §7.3', () => {
  it('R11 a clean post has no hard or soft violations', () => {
    const r = lint(goodPost());
    expect(r.hard).toEqual([]);
    expect(r.soft).toEqual([]);
  });
  it('R11 length over 3,000 chars is hard', () => {
    expect(lint('a'.repeat(3001)).hard.join()).toMatch(/Length 3001/);
  });
  it('R11 emoji, hashtag and "!" are hard', () => {
    expect(lint(goodPost(' ✨')).hard).toContain('Contains an emoji');
    expect(lint(goodPost(' #skincare')).hard).toContain('Contains a hashtag');
    expect(lint(goodPost(' Wow!')).hard).toContain('Contains "!"');
  });
  it('R11 pH 5.5 and a mid-line hyphen aside are not lists; list lines are', () => {
    expect(lint(goodPost(' pH 5.5 - roughly - is fine.')).hard).toEqual([]);
    expect(lint(goodPost('\n- first point')).hard).toContain('Contains a list line');
    expect(lint(goodPost('\n• first point')).hard).toContain('Contains a list line');
    expect(lint(goodPost('\n2. second point')).hard).toContain('Contains a list line');
  });
  it('R11 banned phrases match whole phrases only, case-insensitive', () => {
    expect(lint(goodPost(' This will UNLOCK results.')).hard).toContain('Banned phrase "unlock"');
    expect(lint(goodPost(' The door was unlocked.')).hard).toEqual([]);
    expect(lint(goodPost(' Thoughts?')).hard).toContain('Banned phrase "thoughts?"');
    expect(lint(goodPost(" Here’s the thing.")).hard).toEqual([]); // curly apostrophe is a different phrase
  });
  it('R11 a named entity from the note is hard', () => {
    const r = lint(goodPost(' Acme Chemicals changed the blend.'), { ...opts, entities: ['Acme Chemicals'] });
    expect(r.hard).toContain('Names "Acme Chemicals"');
  });
  it('R11 soft: > 2 question marks, > 3 em dashes, < 1,800 chars', () => {
    const r = lint('Why? How? When? — — — — short');
    expect(r.soft).toEqual(['3 question marks', '4 em dashes', `Short: ${charCount('Why? How? When? — — — — short')} chars`]);
  });
  it('R14 counts [CHECK: …] placeholders', () => {
    expect(lint(goodPost(' [CHECK: batch size] and [CHECK: date].')).check_count).toBe(2);
  });
  it('containsPhrase handles regex characters', () => {
    expect(containsPhrase('100% natural oils', '100% natural')).toBe(true);
  });
});
