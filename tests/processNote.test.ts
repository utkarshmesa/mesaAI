import { describe, expect, it } from 'vitest';
import { makeDeadline } from '../src/pipeline/deadline.js';
import { processNote } from '../src/pipeline/processNote.js';
import { CHAT, deadline, fakeLLM, fakeTelegram, goodPost, makeDeps, msg } from './helpers.js';

const BODY = 'A long enough note about the preservative change and the pH drift in batch fourteen';

describe('note pipeline §6.4', () => {
  it('R4 happy path: post first, then the card as a reply to it; note drafted, draft pending', async () => {
    const { llm } = fakeLLM([{ post: goodPost(), news_item_used: null }]);
    const { deps, sent, repo, logs } = makeDeps({ draftLLM: llm });
    await processNote(msg({ message_id: 77, text: BODY }), BODY, deps, deadline());

    expect(sent).toHaveLength(2);
    expect(sent[0]!.text).toBe(goodPost());
    expect(sent[0]!.replyTo).toBe(77);
    expect(sent[1]!.text).toMatch(/^DRAFT · #[0-9a-f]{6}\n/);
    expect(sent[1]!.replyTo).toBe(sent[0]!.id);

    const [draft] = [...repo.drafts.values()];
    const [note] = [...repo.notes.values()];
    expect(note!.status).toBe('drafted');
    expect(draft).toMatchObject({ status: 'pending', post_message_id: sent[0]!.id, card_message_id: sent[1]!.id, voice_version: '1.0.0', prompt_version: 'draft-1.0.0', news_status: 'none' });
    expect(logs.some((l) => l.stage === 'draft_call' && /^[0-9a-f]{64}$/.test(String(l.system_sha256)))).toBe(true);
  });

  it('R3 the system prompt sent to the model contains the voice skill verbatim', async () => {
    const { llm, calls } = fakeLLM([{ post: goodPost(), news_item_used: null }]);
    const { deps } = makeDeps({ draftLLM: llm });
    await processNote(msg({ text: BODY }), BODY, deps, deadline());
    expect(calls[0]!.system).toContain(deps.ctx.voiceSkill);
  });

  it('R11 hard lint violation → exactly one regeneration with the violations listed', async () => {
    const { llm, calls } = fakeLLM([
      { post: goodPost(' Amazing!'), news_item_used: null },
      { post: goodPost(' Still amazing!'), news_item_used: null },
    ]);
    const { deps, sent, repo } = makeDeps({ draftLLM: llm });
    await processNote(msg({ text: BODY }), BODY, deps, deadline());
    expect(calls).toHaveLength(2);
    expect(calls[1]!.user).toContain('Contains "!"');
    expect(sent[1]!.text).toContain('⚠ Lint: Contains "!"'); // delivered anyway
    expect([...repo.drafts.values()][0]!.lint!.hard).toEqual(['Contains "!"']);
  });

  it('R11 no regeneration when under 40 s remain (deadline budget)', async () => {
    const { llm, calls } = fakeLLM([{ post: goodPost('!'), news_item_used: null }]);
    const { deps } = makeDeps({ draftLLM: llm });
    const now = Date.now();
    await processNote(msg({ text: BODY }), BODY, deps, makeDeadline(now - 210_000));
    expect(calls).toHaveLength(1);
    expect(calls[0]!.opts.allowRetry).toBe(false);
  });

  it('R14 [CHECK] count shows on the card', async () => {
    const { llm } = fakeLLM([{ post: goodPost(' [CHECK: batch size]'), news_item_used: null }]);
    const { deps, sent } = makeDeps({ draftLLM: llm });
    await processNote(msg({ text: BODY }), BODY, deps, deadline());
    expect(sent[1]!.text).toContain('Checks needed: 1 [CHECK] item');
  });

  it('draft failure → note failed at "draft" with an error reply saved', async () => {
    const { llm } = fakeLLM([new Error('model down')]);
    const { deps, sent, repo } = makeDeps({ draftLLM: llm });
    await processNote(msg({ message_id: 12, text: BODY }), BODY, deps, deadline());
    const [note] = [...repo.notes.values()];
    expect(note).toMatchObject({ status: 'failed', failed_stage: 'draft', error_message_id: sent[0]!.id });
    expect(sent[0]).toMatchObject({ text: 'Something failed at draft. Your note is saved.', replyTo: 12 });
    expect(repo.drafts.size).toBe(0);
  });

  it('send failure after retry → draft superseded (send_failed) and note failed at "send"', async () => {
    const { llm } = fakeLLM([{ post: goodPost(), news_item_used: null }]);
    const { tg, sent } = fakeTelegram({ failTimes: 2 });
    const { deps, repo } = makeDeps({ draftLLM: llm, tg });
    await processNote(msg({ text: BODY }), BODY, deps, deadline());
    const [draft] = [...repo.drafts.values()];
    expect(draft).toMatchObject({ status: 'superseded', decision_reason: 'send_failed' });
    expect([...repo.notes.values()][0]).toMatchObject({ status: 'failed', failed_stage: 'send' });
    expect(sent.at(-1)!.text).toBe('Something failed at send. Your note is saved.');
  });

  it('log lines never contain the note text', async () => {
    const { llm } = fakeLLM([{ post: goodPost(), news_item_used: null }]);
    const { deps, logs } = makeDeps({ draftLLM: llm });
    await processNote(msg({ chat: { id: CHAT }, text: BODY }), BODY, deps, deadline());
    expect(JSON.stringify(logs)).not.toContain('preservative change');
  });
});
