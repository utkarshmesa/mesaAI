// Loads context/ files at runtime. Content is used as-is, never paraphrased into code.
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

export interface PublishedItem {
  id: string;
  type: string;
  title: string;
  core_claim: string;
  anecdotes: string[];
  topics: string[];
}

export interface ContextBundle {
  voiceSkill: string;
  voiceVersion: string;
  examples: string[];
  banned: string[];
  published: PublishedItem[];
}

export function parseVoiceVersion(voiceSkill: string): string {
  return /^version:\s*(\S+)/m.exec(voiceSkill)?.[1] ?? 'unknown';
}

/** Remove the leading "Category: …" line (and the blank line after it). */
export function stripCategory(example: string): string {
  return example.replace(/^Category:.*\r?\n(\r?\n)?/, '');
}

let cached: ContextBundle | null = null;

export function loadContext(dir = join(process.cwd(), 'context')): ContextBundle {
  if (cached) return cached;
  const read = (p: string) => readFileSync(join(dir, p), 'utf8');
  const voiceSkill = read('voice-skill.txt');
  const examples = readdirSync(join(dir, 'examples'))
    .filter((f) => f.endsWith('.txt'))
    .sort()
    .map((f) => stripCategory(read(join('examples', f))));
  cached = {
    voiceSkill,
    voiceVersion: parseVoiceVersion(voiceSkill),
    examples,
    banned: (JSON.parse(read('banned-phrases.json')) as { phrases: string[] }).phrases,
    published: (JSON.parse(read('published-index.json')) as { items: PublishedItem[] }).items,
  };
  return cached;
}
