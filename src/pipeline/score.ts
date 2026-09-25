// PRD §6.5: the model rates criteria, code does the arithmetic. Pure.
import type { Analysis } from '../prompts/analyse.js';
import type { Category, Criteria, Flag } from '../types.js';
import { wordCount } from '../router.js';

export const CAPPED_CATEGORIES: Category[] = ['logistics', 'venting', 'fragment'];
/** Own brand/person are never "third-party entities" (plan A2). */
export const SELF_ENTITIES = ['skinstinct', 'meera', 'meera pillai'];
export const PREFILTER_REASON = 'Too short to develop';

export function computeScore(c: Criteria, category: Category): number {
  let score = c.specificity + c.clear_point + c.novelty + c.reader_value;
  if (c.novelty === 0) score = Math.min(score, 5); // repeat cap → always below the gate
  if (CAPPED_CATEGORIES.includes(category)) score = Math.min(score, 2);
  return score;
}

export function preFilter(body: string, minWords: number): { pass: true } | { pass: false; reason: string } {
  return wordCount(body) < minWords ? { pass: false, reason: PREFILTER_REASON } : { pass: true };
}

export function gate(score: number, threshold: number): 'pass' | 'reject' {
  return score < threshold ? 'reject' : 'pass';
}

/** REPEAT ⇔ duplicate_of != null, and duplicate_of must be a known id (plan A8). */
export function normaliseFlags(
  flags: Flag[],
  duplicateOf: string | null,
  novelty: number,
  knownIds: Set<string>,
): { flags: Flag[]; duplicate_of: string | null } {
  const dup = novelty < 2 && duplicateOf && knownIds.has(duplicateOf) ? duplicateOf : null;
  const rest = [...new Set(flags.filter((f) => f !== 'REPEAT'))];
  return { flags: dup ? [...rest, 'REPEAT'] : rest, duplicate_of: dup };
}

/** Model output → the fields we store on the note. The score is computed here, never taken from the model. */
export function scoreAnalysis(a: Analysis, knownIds: Set<string>) {
  const { flags, duplicate_of } = normaliseFlags(a.flags, a.duplicate_of, a.criteria.novelty, knownIds);
  return {
    category: a.category,
    criteria: a.criteria,
    score: computeScore(a.criteria, a.category),
    reason: a.reason,
    flags,
    duplicate_of,
    suggested_angle: a.suggested_angle?.trim() || null,
    search_phrase: a.search_phrase,
    entities: cleanEntities(a.entities),
  };
}

export function cleanEntities(entities: string[]): string[] {
  return [...new Set(entities.map((e) => e.trim()).filter((e) => e && !SELF_ENTITIES.includes(e.toLowerCase())))];
}
