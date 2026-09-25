// npm run eval [-- --runs 3] [--draft]
// Runs every fixture through the real pre-filter + analyse call and checks it against `expect`.
// --draft also drafts the "decision: draft" fixtures and requires zero hard lint violations.
import { loadScriptConfig as loadConfig } from '../src/config.js';
import { loadContext } from '../src/context.js';
import { geminiLLM } from '../src/llm/gemini.js';
import { lintPost } from '../src/pipeline/lint.js';
import { LLM_TIMEOUT_MS } from '../src/pipeline/processNote.js';
import { gate, preFilter, scoreAnalysis } from '../src/pipeline/score.js';
import { ANALYSE_SYSTEM, AnalysisSchema, buildAnalyseUserPrompt } from '../src/prompts/analyse.js';
import { type DraftInput, DraftResultSchema, buildDraftSystemPrompt, buildDraftUserPrompt, sha256 } from '../src/prompts/draft.js';
import type { Flag } from '../src/types.js';
import fixtures from '../tests/fixtures/notes.json' with { type: 'json' };

interface Expect {
  decision: 'draft' | 'reject' | 'either';
  min_score?: number;
  max_score?: number;
  flags_include?: string[];
  duplicate_of?: string;
  suggested_angle_required?: boolean;
}

const args = process.argv.slice(2);
const runs = Number(args[args.indexOf('--runs') + 1]) || 1;
const withDraft = args.includes('--draft');

const config = loadConfig();
const ctx = loadContext();
const analyse = geminiLLM(config.GEMINI_API_KEY, config.GEMINI_MODEL);
const drafter = geminiLLM(config.GEMINI_API_KEY, config.DRAFT_MODEL);
const known = new Set(ctx.published.map((p) => p.id));

function check(e: Expect, r: { score: number; decision: string; flags: string[]; duplicate_of: string | null; suggested_angle: string | null }): string[] {
  const miss: string[] = [];
  if (e.decision !== 'either' && r.decision !== e.decision) miss.push(`decision ${r.decision}≠${e.decision}`);
  if (e.min_score !== undefined && r.score < e.min_score) miss.push(`score ${r.score}<${e.min_score}`);
  if (e.max_score !== undefined && r.score > e.max_score) miss.push(`score ${r.score}>${e.max_score}`);
  for (const f of e.flags_include ?? []) if (!r.flags.includes(f)) miss.push(`missing ${f}`);
  if (e.duplicate_of && r.duplicate_of !== e.duplicate_of) miss.push(`duplicate_of ${r.duplicate_of}≠${e.duplicate_of}`);
  if (e.suggested_angle_required && !r.suggested_angle) miss.push('no suggested_angle');
  return miss;
}

let failures = 0;
for (let run = 1; run <= runs; run++) {
  console.log(`\n=== Run ${run}/${runs} · analyse=${config.GEMINI_MODEL} · threshold=${config.SCORE_THRESHOLD}`);
  console.log('id        | decision | score | criteria (s/c/n/r) | flags                 | dup    | result');
  let passedGate = 0;
  for (const f of fixtures.notes) {
    const e = f.expect as Expect;
    let row: { score: number; decision: string; flags: string[]; duplicate_of: string | null; suggested_angle: string | null; criteria: string; entities: string[] };
    const pre = preFilter(f.text, config.MIN_NOTE_WORDS);
    if (!pre.pass) {
      row = { score: 0, decision: 'reject', flags: [], duplicate_of: null, suggested_angle: null, criteria: 'pre-filter (0 LLM)', entities: [] };
    } else {
      const a = await analyse.generateJSON(AnalysisSchema, ANALYSE_SYSTEM, buildAnalyseUserPrompt(f.text, ctx.published), {
        timeoutMs: LLM_TIMEOUT_MS,
        allowRetry: true,
        thinkingLevel: 'low',
      });
      const s = scoreAnalysis(a, known);
      const c = s.criteria;
      row = { ...s, decision: gate(s.score, config.SCORE_THRESHOLD) === 'pass' ? 'draft' : 'reject', criteria: `${c.specificity}/${c.clear_point}/${c.novelty}/${c.reader_value} ${s.category}` };
    }
    if (row.decision === 'draft') passedGate++;
    const miss = check(e, row);
    if (miss.length) failures++;
    console.log(
      [f.id.padEnd(9), row.decision.padEnd(8), String(row.score).padEnd(5), row.criteria.padEnd(18), row.flags.join(',').padEnd(21), String(row.duplicate_of ?? '-').padEnd(6), miss.length ? `FAIL ${miss.join('; ')}` : 'ok'].join(' | '),
    );
    if (row.suggested_angle) console.log(`          angle: ${row.suggested_angle}`);

    if (withDraft && e.decision === 'draft' && row.decision === 'draft') {
      const system = buildDraftSystemPrompt(ctx.voiceSkill, ctx.examples);
      const input: DraftInput = { note: f.text, flags: row.flags as Flag[], suggestedAngle: row.suggested_angle, news: [] };
      let d = await drafter.generateJSON(DraftResultSchema, system, buildDraftUserPrompt(input), { timeoutMs: LLM_TIMEOUT_MS, allowRetry: true });
      let lint = lintPost(d.post, { banned: ctx.banned, entities: row.entities });
      if (lint.hard.length) {
        d = await drafter.generateJSON(DraftResultSchema, system, buildDraftUserPrompt({ ...input, previousDraft: d.post, lintViolations: lint.hard }), { timeoutMs: LLM_TIMEOUT_MS, allowRetry: true });
        lint = lintPost(d.post, { banned: ctx.banned, entities: row.entities });
      }
      if (lint.hard.length) failures++;
      console.log(`          draft: ${[...d.post].length} chars · hard=${JSON.stringify(lint.hard)} · soft=${JSON.stringify(lint.soft)} · checks=${lint.check_count} · system_sha256=${sha256(system).slice(0, 12)}`);
      console.log(d.post.split('\n').map((l) => `          > ${l}`).join('\n'));
    }
  }
  if (passedGate === fixtures.notes.length) {
    failures++;
    console.log('FAIL every fixture passed the gate: rubric too lenient (PRD §6.5)');
  }
  console.log(`gate pass rate: ${passedGate}/${fixtures.notes.length}`);
}

console.log(failures ? `\n❌ ${failures} expectation(s) failed` : '\n✅ all expectations met');
process.exit(failures ? 1 : 0);
