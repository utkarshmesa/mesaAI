import { describe, expect, it } from 'vitest';
import { loadConfig } from '../src/config.js';

const base = {
  TELEGRAM_BOT_TOKEN: 't',
  TELEGRAM_ALLOWED_CHAT_IDS: ' -1001234 , 5678 ',
  TELEGRAM_WEBHOOK_SECRET: 'a'.repeat(32),
  GEMINI_API_KEY: 'k',
  GEMINI_MODEL: 'gemini-3.8-flash',
  DRAFT_MODEL: 'gemini-3.8-flash',
};

describe('config', () => {
  it('R2 parses the chat allowlist into trimmed ids', () => {
    expect(loadConfig(base).TELEGRAM_ALLOWED_CHAT_IDS).toEqual(['-1001234', '5678']);
  });
  it('applies numeric defaults', () => {
    const c = loadConfig(base);
    expect(c.SCORE_THRESHOLD).toBe(6);
    expect(c.MIN_NOTE_WORDS).toBe(12);
  });
  it('R2 rejects a webhook secret with bad characters, without printing it', () => {
    const bad = 'x'.repeat(31) + '!';
    expect(() => loadConfig({ ...base, TELEGRAM_WEBHOOK_SECRET: bad })).toThrow(/TELEGRAM_WEBHOOK_SECRET/);
    try { loadConfig({ ...base, TELEGRAM_WEBHOOK_SECRET: bad }); } catch (e) { expect(String(e)).not.toContain(bad); }
  });
  it('allows Supabase to be unset (memory repo)', () => {
    expect(loadConfig(base).SUPABASE_URL).toBe('');
  });
});
