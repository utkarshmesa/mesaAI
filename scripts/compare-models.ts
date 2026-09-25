// npm run compare -- note_01 [modelA] [modelB]
// Same fixture note → two Gemini drafter models, side by side, with voice-lint results (R12).
// Defaults: modelA = DRAFT_MODEL, modelB = gemini-3.5-flash-lite.
import { loadScriptConfig as loadConfig } from '../src/config.js';
import { loadContext } from '../src/context.js';
import { geminiLLM } from '../src/llm/gemini.js';
import { lintPost } from '../src/pipeline/lint.js';
import { LLM_TIMEOUT_MS } from '../src/pipeline/processNote.js';
import { scoreAnalysis } from '../src/pipeline/score.js';
import { ANALYSE_SYSTEM, AnalysisSchema, buildAnalyseUserPrompt } from '../src/prompts/analyse.js';
import { DraftResultSchema, buildDraftSystemPrompt, buildDraftUserPrompt, sha256 } from '../src/prompts/draft.js';
import fixtures from '../tests/fixtures/notes.json' with { type: 'json' };

const [id = 'note_01', modelA, modelB] = process.argv.slice(2);
const fixture = fixtures.notes.find((n) => n.id === id);
if (!fixture) {
  console.error(`Unknown fixture "${id}". Options: ${fixtures.notes.map((n) => n.id).join(', ')}`);
  process.exit(1);
}

const config = loadConfig();
const ctx = loadContext();
const models = [modelA ?? config.DRAFT_MODEL, modelB ?? 'gemini-3.5-flash-lite'];

// Analyse once so both drafters get identical flags / angle / entities.
const analysis = await geminiLLM(config.GEMINI_API_KEY, config.GEMINI_MODEL).generateJSON(
  AnalysisSchema,
  ANALYSE_SYSTEM,
  buildAnalyseUserPrompt(fixture.text, ctx.published),
  { timeoutMs: LLM_TIMEOUT_MS, allowRetry: true, thinkingLevel: 'low' },
);
const s = scoreAnalysis(analysis, new Set(ctx.published.map((p) => p.id)));
const system = buildDraftSystemPrompt(ctx.voiceSkill, ctx.examples);
const user = buildDraftUserPrompt({ note: fixture.text, flags: s.flags, suggestedAngle: s.suggested_angle, news: [] });
console.log(`${id} · score ${s.score}/10 · flags [${s.flags.join(', ')}] · system_sha256 ${sha256(system).slice(0, 12)}\n`);

for (const model of models) {
  const t0 = Date.now();
  const d = await geminiLLM(config.GEMINI_API_KEY, model).generateJSON(DraftResultSchema, system, user, { timeoutMs: LLM_TIMEOUT_MS, allowRetry: true });
  const lint = lintPost(d.post, { banned: ctx.banned, entities: s.entities });
  console.log(`===== ${model} · ${Date.now() - t0} ms · ${[...d.post].length} chars`);
  console.log(`lint hard=${JSON.stringify(lint.hard)} soft=${JSON.stringify(lint.soft)} checks=${lint.check_count}\n`);
  console.log(d.post);
  console.log();
}
