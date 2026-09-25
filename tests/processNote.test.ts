import { describe, expect, it } from 'vitest';
import { makeDeadline } from '../src/pipeline/deadline.js';
import { processNote } from '../src/pipeline/processNote.js';
import { CHAT, PASS_ANALYSIS, deadline, fakeLLM, fakeTelegram, fixedLLM, goodPost, makeDeps, msg } from './helpers.js';

const BODY = 'A long enough note about the preservative change and the pH drift in batch fourteen';

describe('note pipeline §6.4', () => {
  it('R4 happy path: post first, then the card as a reply to it; note drafted, draft pending', async () => {
    const { llm } = fakeLLM([{ post: goodPost(), news_item_used: null }]);
    const { deps, sent, repo, logs } = makeDeps({ draftLLM: llm });
    await processNote(msg({ message_id: 77, text: BODY }), BODY, deps, deadline());

    expect(sent).toHaveLength(2);
    expect(sent[0]!.text).toBe(goodPost());
    expect(sent[0]!.replyTo).toBe(77);
    expect(sent[1]!.text).toMatch(/^DRAFT · #[0-9a-f]{6} · Score 9\/10\n/);
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

  it('R5 short note: pre-filter rejects with no LLM call and saves rejection_message_id', async () => {
    const { llm: analyse, calls: aCalls } = fakeLLM([]);
    const { deps, sent, repo, calls } = makeDeps({ analyseLLM: analyse });
    await processNote(msg({ message_id: 3, text: 'niacinamide + humidity?? come back' }), 'niacinamide + humidity?? come back', deps, deadline());
    expect(aCalls).toHaveLength(0);
    expect(calls).toHaveLength(0);
    expect(sent[0]).toMatchObject({ text: 'No draft (score 0/10): Too short to develop.', replyTo: 3 });
    expect([...repo.notes.values()][0]).toMatchObject({ status: 'rejected', score: 0, criteria: null, rejection_message_id: sent[0]!.id });
  });

  it('R5 below the gate: rejection with reason + angle, no draft', async () => {
    const weak = { ...PASS_ANALYSIS, criteria: { specificity: 3, clear_point: 3, novelty: 0, reader_value: 2 }, reason: 'You covered this in NL-009', duplicate_of: 'NL-009', suggested_angle: 'What a checklist cannot tell you about concentration' };
    const { deps, sent, repo, calls } = makeDeps({ analyseLLM: fixedLLM(weak) });
    await processNote(msg({ text: BODY }), BODY, deps, deadline());
    expect(calls).toHaveLength(0);
    expect(repo.drafts.size).toBe(0);
    expect(sent.map((s) => s.text)).toEqual(['No draft (score 5/10): You covered this in NL-009. Try: What a checklist cannot tell you about concentration']);
    expect([...repo.notes.values()][0]).toMatchObject({ status: 'rejected', score: 5, flags: ['REPEAT'], duplicate_of: 'NL-009' });
  });

  it('R5 above the gate: score, reason and flags reach the card and the drafter', async () => {
    const strong = { ...PASS_ANALYSIS, flags: ['PRIVACY'] };
    const { llm, calls } = fakeLLM([{ post: goodPost(), news_item_used: null }]);
    const { deps, sent } = makeDeps({ analyseLLM: fixedLLM(strong), draftLLM: llm });
    await processNote(msg({ text: BODY }), BODY, deps, deadline());
    expect(sent[1]!.text).toContain('Score 9/10\nWhy: First-hand batch event with a clear lesson\nFlags: PRIVACY');
    expect(calls[0]!.user).toContain('FLAGS: PRIVACY');
  });

  it('analyse failure → note failed at "analyse"', async () => {
    const { llm } = fakeLLM([new Error('quota')]);
    const { deps, sent, repo } = makeDeps({ analyseLLM: llm });
    await processNote(msg({ text: BODY }), BODY, deps, deadline());
    expect([...repo.notes.values()][0]).toMatchObject({ status: 'failed', failed_stage: 'analyse' });
    expect(sent[0]!.text).toBe('Something failed at analyse. Your note is saved.');
  });

  const ITEMS = [
    { headline: 'Regulator tightens preservative disclosure', source: 'Mint', date: '20 Sep 2026', url: 'https://news.google.com/a' },
    { headline: 'Other story', source: 'ET', date: '19 Sep 2026', url: 'https://news.google.com/b' },
  ];

  it('R6 news items go to the drafter; R7 a used item puts the verify block on the card', async () => {
    const { llm, calls } = fakeLLM([{ post: goodPost(), news_item_used: 1 }]);
    const { deps, sent, repo } = makeDeps({ draftLLM: llm, news: { fetch: async () => ({ items: ITEMS, status: 'ok' }) } });
    await processNote(msg({ text: BODY }), BODY, deps, deadline());
    expect(calls[0]!.user).toContain('"headline":"Regulator tightens preservative disclosure"');
    expect(calls[0]!.user).not.toContain('news.google.com'); // the drafter never sees URLs
    expect(sent[1]!.text).toContain('NEWS SOURCE: Regulator tightens preservative disclosure\nFROM: Mint · 20 Sep 2026\nLINK: https://news.google.com/a\n⚠ Check this before publishing');
    expect([...repo.drafts.values()][0]).toMatchObject({ news: ITEMS[0], news_status: 'used' });
  });

  it('R7 news offered but not used → no verify block, news_status unused', async () => {
    const { llm } = fakeLLM([{ post: goodPost(), news_item_used: null }]);
    const { deps, sent, repo } = makeDeps({ draftLLM: llm, news: { fetch: async () => ({ items: ITEMS, status: 'ok' }) } });
    await processNote(msg({ text: BODY }), BODY, deps, deadline());
    expect(sent[1]!.text).not.toContain('NEWS SOURCE');
    expect([...repo.drafts.values()][0]).toMatchObject({ news: null, news_status: 'unused' });
  });

  it('R6 out-of-range news_item_used is treated as null', async () => {
    const { llm } = fakeLLM([{ post: goodPost(), news_item_used: 7 }]);
    const { deps, repo } = makeDeps({ draftLLM: llm, news: { fetch: async () => ({ items: ITEMS, status: 'ok' }) } });
    await processNote(msg({ text: BODY }), BODY, deps, deadline());
    expect([...repo.drafts.values()][0]!.news).toBeNull();
  });

  it('R6 RSS unreachable → the draft is still delivered with news_status error', async () => {
    const { llm } = fakeLLM([{ post: goodPost(), news_item_used: null }]);
    const { deps, sent, repo } = makeDeps({ draftLLM: llm, news: { fetch: async () => { throw new Error('down'); } } });
    await processNote(msg({ text: BODY }), BODY, deps, deadline());
    expect(sent).toHaveLength(2);
    expect([...repo.drafts.values()][0]).toMatchObject({ status: 'pending', news_status: 'error' });
  });

  it('log lines never contain the note text', async () => {
    const { llm } = fakeLLM([{ post: goodPost(), news_item_used: null }]);
    const { deps, logs } = makeDeps({ draftLLM: llm });
    await processNote(msg({ chat: { id: CHAT }, text: BODY }), BODY, deps, deadline());
    expect(JSON.stringify(logs)).not.toContain('preservative change');
  });
});
