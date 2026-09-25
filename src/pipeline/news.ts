// PRD §6.4 step 5: Google News RSS → top 3 items. No LLM. Never blocks drafting.
import { XMLParser } from 'fast-xml-parser';
import type { NewsItem } from '../types.js';

export const NEWS_TIMEOUT_MS = 5_000;
export const NEWS_LIMIT = 3;

export type NewsFetch = { items: NewsItem[]; status: 'ok' | 'none' | 'error' };

export interface News {
  fetch(phrase: string): Promise<NewsFetch>;
}

export function buildNewsUrl(phrase: string, window: string, locale: string): string {
  return `https://news.google.com/rss/search?q=${encodeURIComponent(`${phrase} ${window}`.trim())}&${locale}`;
}

function text(v: unknown): string {
  if (v && typeof v === 'object' && '#text' in v) return String((v as { '#text': unknown })['#text']).trim();
  return v === undefined || v === null ? '' : String(v).trim();
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function displayDate(pubDate: string): string {
  const d = new Date(pubDate);
  if (!pubDate || Number.isNaN(d.getTime())) return '';
  const ist = new Date(d.getTime() + 330 * 60_000); // Asia/Kolkata, UTC+5:30, no DST
  return `${ist.getUTCDate()} ${MONTHS[ist.getUTCMonth()]} ${ist.getUTCFullYear()}`;
}

/** Pure. Keeps {headline, source, date, url}; drops <description> (HTML). Feed order, undated items last (plan A14). */
export function parseNewsRss(xml: string, limit = NEWS_LIMIT): NewsItem[] {
  const doc = new XMLParser({ ignoreAttributes: false }).parse(xml) as { rss?: { channel?: { item?: unknown } } };
  if (doc.rss?.channel === undefined) throw new Error('not an RSS feed');
  const raw = doc.rss.channel.item;
  const list = (Array.isArray(raw) ? raw : raw ? [raw] : []) as Record<string, unknown>[];
  const items = list
    .map((it) => {
      const title = text(it.title);
      const source = text(it.source);
      const suffix = source ? ` - ${source}` : '';
      const headline = suffix && title.endsWith(suffix) ? title.slice(0, -suffix.length) : title.replace(/ - [^-]+$/, '');
      return { headline: headline.trim(), source: source || title.split(' - ').pop()!.trim(), date: displayDate(text(it.pubDate)), url: text(it.link) };
    })
    .filter((n) => n.headline && n.url);
  return [...items.filter((n) => n.date), ...items.filter((n) => !n.date)].slice(0, limit);
}

export function googleNews(cfg: { window: string; locale: string; forceError?: boolean }): News {
  return {
    async fetch(phrase) {
      if (cfg.forceError) return { items: [], status: 'error' }; // test hook (plan A11)
      try {
        const res = await fetch(buildNewsUrl(phrase, cfg.window, cfg.locale), { signal: AbortSignal.timeout(NEWS_TIMEOUT_MS) });
        if (!res.ok) return { items: [], status: 'error' };
        const items = parseNewsRss(await res.text());
        return { items, status: items.length ? 'ok' : 'none' };
      } catch {
        return { items: [], status: 'error' };
      }
    },
  };
}
