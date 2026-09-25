import { describe, expect, it } from 'vitest';
import { processNote, sweepStale } from '../src/pipeline/processNote.js';
import { buildDraftSystemPrompt, sha256 } from '../src/prompts/draft.js';
import { handleWebhook } from '../src/webhook.js';
import { CHAT, PASS_ANALYSIS, deadline, fakeLLM, fixedLLM, goodPost, makeDeps, msg } from './helpers.js';

const NOTE = 'Okay so batch fourteen came back from the manufacturer and the pH stability data looked off again today';
const post = () => ({ post: goodPost(), news_item_used: null });

function req(body: unknown) {
  return new Request('https://x/api/webhook', { method: 'POST', headers: { 'x-telegram-bot-api-secret-token': 's'.repeat(32) }, body: JSON.stringify(body) });
}
function runtime() {
  const tasks: Promise<unknown>[] = [];
  return { rt: { waitUntil: (p: Promise<unknown>) => void tasks.push(p) }, drain: () => Promise.all(tasks) };
}

describe('M4 persistence and idempotency', () => {
  it('R10 replaying the same note update AND the same APPROVE update twice → one draft, one transition', async () => {
    const { llm } = fakeLLM([post(), post()]);
    const { deps, repo, sent } = makeDeps({ draftLLM: llm });
    const { rt, drain } = runtime();
    const noteUpdate = { update_id: 100, channel_post: { message_id: 5, chat: { id: CHAT }, text: NOTE } };
    await handleWebhook(req(noteUpdate), deps, rt);
    await handleWebhook(req(noteUpdate), deps, rt);
    await drain();
    const [draft] = [...repo.drafts.values()];
    const approveUpdate = { update_id: 101, channel_post: { message_id: 6, chat: { id: CHAT }, text: 'APPROVE', reply_to_message: { message_id: draft!.card_message_id } } };
    await handleWebhook(req(approveUpdate), deps, rt);
    await handleWebhook(req(approveUpdate), deps, rt);
    await drain();
    expect(repo.drafts.size).toBe(1);
    expect(repo.drafts.get(draft!.id)!.status).toBe('approved');
    expect(sent.filter((s) => s.text.startsWith('✓ Approved'))).toHaveLength(1);
  });

  it('R1 a note that starts with "Rejected a sample…" is treated as a note, not a command', async () => {
    const { llm } = fakeLLM([post()]);
    const { deps, repo } = makeDeps({ draftLLM: llm });
    const { rt, drain } = runtime();
    const text = 'Rejected a sample from a new supplier today because the CoA pH did not match the spec sheet';
    await handleWebhook(req({ update_id: 200, channel_post: { message_id: 7, chat: { id: CHAT }, text } }), deps, rt);
    await drain();
    expect([...repo.notes.values()][0]).toMatchObject({ text, status: 'drafted' });
  });

  it('R10 a note left in passed for 10+ minutes is swept to failed on the next update', async () => {
    const { deps, repo, sent } = makeDeps();
    const old = (await repo.insertNote({ chat_id: CHAT, message_id: 8, text: 'x' }))!;
    await repo.updateNote(old.id, { status: 'passed', created_at: new Date(Date.now() - 11 * 60_000).toISOString() });
    const fresh = (await repo.insertNote({ chat_id: CHAT, message_id: 9, text: 'y' }))!;
    await repo.updateNote(fresh.id, { created_at: new Date(Date.now() - 9 * 60_000).toISOString() });
    const { rt, drain } = runtime();
    await handleWebhook(req({ update_id: 300, channel_post: { message_id: 10, chat: { id: CHAT }, text: '/help' } }), deps, rt);
    await drain();
    expect(repo.notes.get(old.id)).toMatchObject({ status: 'failed', failed_stage: 'timeout' });
    expect(repo.notes.get(fresh.id)!.status).toBe('received');
    expect(sent[0]).toMatchObject({ text: 'Something failed at timeout. Your note is saved.', replyTo: 8 });
    expect(await sweepStale(deps)).toBe(0); // idempotent: already failed
  });

  it('R8 the active DB voice takes precedence over the file, and its version is stored on the draft', async () => {
    const { llm, calls } = fakeLLM([post()]);
    const { deps, repo, logs } = makeDeps({ draftLLM: llm });
    repo.voice = { version: '1.1.0', content: 'VOICE SKILL v1.1 (from DB)' };
    await processNote(msg({ text: NOTE }), NOTE, deps, deadline());
    expect(calls[0]!.system.startsWith('VOICE SKILL v1.1 (from DB)')).toBe(true);
    expect([...repo.drafts.values()][0]!.voice_version).toBe('1.1.0');
    const expected = sha256(buildDraftSystemPrompt('VOICE SKILL v1.1 (from DB)', deps.ctx.examples));
    expect(logs.find((l) => l.stage === 'draft_call')!.system_sha256).toBe(expected);
  });

  it('R13 the analyse call sees the last drafts, and a draft id is a valid duplicate_of', async () => {
    const { llm: first } = fakeLLM([post()]);
    const { deps, repo } = makeDeps({ draftLLM: first });
    await processNote(msg({ message_id: 1, text: NOTE }), NOTE, deps, deadline());
    const [d] = [...repo.drafts.values()];
    const dupId = `D-${d!.id.replace(/-/g, '').slice(0, 6)}`;
    const { llm: analyse, calls } = fakeLLM([{ ...PASS_ANALYSIS, criteria: { specificity: 3, clear_point: 3, novelty: 0, reader_value: 2 }, duplicate_of: dupId }]);
    await processNote(msg({ message_id: 2, text: NOTE + ' again' }), NOTE + ' again', { ...deps, analyseLLM: analyse }, deadline());
    expect(calls[0]!.user).toContain(`"id":"${dupId}"`);
    const second = [...repo.notes.values()].find((n) => n.message_id === 2)!;
    expect(second).toMatchObject({ status: 'rejected', duplicate_of: dupId, flags: ['REPEAT'] });
  });

  it('R8 nothing is deleted: rejected notes keep their analysis', async () => {
    const weak = { ...PASS_ANALYSIS, category: 'logistics' };
    const { deps, repo } = makeDeps({ analyseLLM: fixedLLM(weak) });
    await processNote(msg({ text: NOTE }), NOTE, deps, deadline());
    expect([...repo.notes.values()][0]).toMatchObject({ status: 'rejected', score: 2, category: 'logistics', criteria: PASS_ANALYSIS.criteria });
  });
});
