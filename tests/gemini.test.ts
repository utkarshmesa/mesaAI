import { describe, expect, it } from 'vitest';
import { shouldTryNextKey, withKeyFallback } from '../src/llm/gemini.js';

const apiErr = (status: number) => Object.assign(new Error(`status ${status}`), { status });

describe('Gemini key fallback', () => {
  it('R12 moves to the next key on 429 / quota / server errors', async () => {
    const seen: string[] = [];
    const r = await withKeyFallback(['a', 'b', 'c'], async (k) => {
      seen.push(k);
      if (k === 'a') throw apiErr(429);
      if (k === 'b') throw apiErr(503);
      return `ok-${k}`;
    });
    expect(r).toBe('ok-c');
    expect(seen).toEqual(['a', 'b', 'c']);
  });
  it('R12 does not retry other keys on a bad request (400) or a timeout', async () => {
    const seen: string[] = [];
    await expect(withKeyFallback(['a', 'b'], async (k) => { seen.push(k); throw apiErr(400); })).rejects.toThrow('status 400');
    expect(seen).toEqual(['a']);
    expect(shouldTryNextKey(new Error('aborted'))).toBe(false);
  });
  it('R12 a dropped connection (fetch failed) tries the next key', () => {
    expect(shouldTryNextKey(new TypeError('fetch failed'))).toBe(true);
  });
  it('R12 throws the last error when every key fails', async () => {
    await expect(withKeyFallback(['a', 'b'], async () => { throw apiErr(429); })).rejects.toThrow('status 429');
  });
});
