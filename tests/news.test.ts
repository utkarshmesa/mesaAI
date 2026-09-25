import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildNewsUrl, googleNews, parseNewsRss } from '../src/pipeline/news.js';

const xml = readFileSync('tests/fixtures/news-rss.xml', 'utf8');

describe('Google News RSS parser', () => {
  it('R6 parses the saved feed into at most 3 {headline, source, date, url} items', () => {
    const items = parseNewsRss(xml);
    expect(items).toHaveLength(3);
    for (const n of items) {
      expect(Object.keys(n).sort()).toEqual(['date', 'headline', 'source', 'url']);
      expect(n.url).toMatch(/^https:\/\/news\.google\.com\//);
      expect(n.date).toMatch(/^\d{1,2} [A-Z][a-z]{2} \d{4}$/);
    }
  });
  it('R6 strips the trailing " - Source" from the headline and keeps feed order', () => {
    const [first] = parseNewsRss(xml);
    expect(first!.source).toBe('ANI News');
    expect(first!.headline).toBe("Enstylz Cosmetics Strengthens Its Presence in India's Skincare Market with a New De-Tan Range");
  });
  it('R6 drops the HTML description', () => {
    expect(JSON.stringify(parseNewsRss(xml))).not.toContain('<a href');
  });
  it('R6 an empty channel gives no items; non-RSS throws', () => {
    expect(parseNewsRss('<rss><channel><title>x</title></channel></rss>')).toEqual([]);
    expect(() => parseNewsRss('<html>nope</html>')).toThrow();
  });
  it('R6 a single <item> is handled', () => {
    const one = '<rss><channel><item><title>Rule change - Mint</title><link>https://news.google.com/a</link><source url="x">Mint</source></item></channel></rss>';
    expect(parseNewsRss(one)).toEqual([{ headline: 'Rule change', source: 'Mint', date: '', url: 'https://news.google.com/a' }]);
  });
  it('R6 builds the search URL with window and locale', () => {
    expect(buildNewsUrl('preservative reformulation', 'when:30d', 'hl=en-IN&gl=IN&ceid=IN:en')).toBe(
      'https://news.google.com/rss/search?q=preservative%20reformulation%20when%3A30d&hl=en-IN&gl=IN&ceid=IN:en',
    );
  });
});

describe('googleNews.fetch', () => {
  afterEach(() => vi.unstubAllGlobals());
  it('R6 network failure → status error, never throws', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('ENOTFOUND')));
    expect(await googleNews({ window: 'when:30d', locale: 'hl=en-IN' }).fetch('x')).toEqual({ items: [], status: 'error' });
  });
  it('R6 empty feed → status none', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('<rss><channel></channel></rss>')));
    expect((await googleNews({ window: '', locale: '' }).fetch('x')).status).toBe('none');
  });
  it('R6 NEWS_FORCE_ERROR hook returns error with no network call', async () => {
    const f = vi.fn();
    vi.stubGlobal('fetch', f);
    expect((await googleNews({ window: '', locale: '', forceError: true }).fetch('x')).status).toBe('error');
    expect(f).not.toHaveBeenCalled();
  });
});
