// PRD §7.3 voice lint. Pure and deterministic.
import type { LintResult } from '../types.js';

export const HARD_MAX_CHARS = 3000;
export const SOFT_MIN_CHARS = 1800;

/** Length in Unicode code points, which is what LinkedIn counts (decisions B1). */
export function charCount(s: string): number {
  return [...s].length;
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Case-insensitive whole-phrase match: no letter/digit directly before or after (decisions B4). */
export function containsPhrase(text: string, phrase: string): boolean {
  const re = new RegExp(`(?<![\\p{L}\\p{N}])${escapeRe(phrase)}(?![\\p{L}\\p{N}])`, 'iu');
  return re.test(text);
}

export function countChecks(post: string): number {
  return post.match(/\[CHECK:/g)?.length ?? 0;
}

export interface LintOptions {
  banned: string[];
  entities: string[];
}

export function lintPost(post: string, { banned, entities }: LintOptions): LintResult {
  const hard: string[] = [];
  const soft: string[] = [];
  const len = charCount(post);

  if (len > HARD_MAX_CHARS) hard.push(`Length ${len} > ${HARD_MAX_CHARS} chars`);
  if (/\p{Extended_Pictographic}/u.test(post)) hard.push('Contains an emoji');
  if (/(^|\s)#\w/u.test(post)) hard.push('Contains a hashtag');
  if (post.includes('!')) hard.push('Contains "!"');
  if (/^\s*([-•*]|\d+\.)\s/m.test(post)) hard.push('Contains a list line');
  for (const p of banned) if (containsPhrase(post, p)) hard.push(`Banned phrase "${p}"`);
  for (const e of entities) if (containsPhrase(post, e)) hard.push(`Names "${e}"`);

  const questions = post.split('?').length - 1;
  if (questions > 2) soft.push(`${questions} question marks`);
  const emDashes = post.split('—').length - 1;
  if (emDashes > 3) soft.push(`${emDashes} em dashes`);
  if (len < SOFT_MIN_CHARS) soft.push(`Short: ${len} chars`);

  return { hard, soft, check_count: countChecks(post) };
}
