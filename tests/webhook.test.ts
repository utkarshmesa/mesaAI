import { describe, expect, it } from 'vitest';
import { handleWebhook } from '../src/webhook.js';
import { CHAT, fakeLLM, goodPost, makeDeps } from './helpers.js';

function req(body: unknown, secret = 's'.repeat(32)) {
  return new Request('https://x/api/webhook', {
    method: 'POST',
    headers: { 'x-telegram-bot-api-secret-token': secret, 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function runtime() {
  const tasks: Promise<unknown>[] = [];
  return { rt: { waitUntil: (p: Promise<unknown>) => void tasks.push(p) }, drain: () => Promise.all(tasks) };
}

const NOTE = 'Okay so batch fourteen came back from the manufacturer and the pH stability data looked off again today';

describe('webhook §6.2', () => {
  it('R2 wrong secret → 401 and nothing scheduled', async () => {
    const { deps } = makeDeps();
    const { rt, drain } = runtime();
    const res = await handleWebhook(req({ update_id: 1 }, 'w'.repeat(32)), deps, rt);
    expect(res.status).toBe(401);
    await drain();
  });
  it('R2 missing secret → 401', async () => {
    const { deps } = makeDeps();
    const r = new Request('https://x', { method: 'POST', body: '{}' });
    expect((await handleWebhook(r, deps, runtime().rt)).status).toBe(401);
  });
  it('R2 other chat → 200 and ignored', async () => {
    const { deps, sent, repo } = makeDeps();
    const { rt, drain } = runtime();
    const res = await handleWebhook(req({ update_id: 2, channel_post: { message_id: 5, chat: { id: 999 }, text: NOTE } }), deps, rt);
    await drain();
    expect(res.status).toBe(200);
    expect(sent).toEqual([]);
    expect(repo.notes.size).toBe(0);
  });
  it('R1 accepts channel_post and DM message; R4 replies in the same chat', async () => {
    const { llm } = fakeLLM([{ post: goodPost(), news_item_used: null }, { post: goodPost(), news_item_used: null }]);
    const { deps, sent, repo } = makeDeps({ draftLLM: llm, allowedChatIds: [String(CHAT), '42'] });
    const { rt, drain } = runtime();
    await handleWebhook(req({ update_id: 3, channel_post: { message_id: 5, chat: { id: CHAT }, text: NOTE } }), deps, rt);
    await handleWebhook(req({ update_id: 4, message: { message_id: 6, chat: { id: 42 }, text: NOTE } }), deps, rt);
    await drain();
    expect(repo.drafts.size).toBe(2);
    expect(sent.map((s) => s.chatId)).toEqual([CHAT, CHAT, 42, 42]);
  });
  it('R10 the same update delivered twice produces one draft', async () => {
    const { llm, calls } = fakeLLM([{ post: goodPost(), news_item_used: null }, { post: goodPost(), news_item_used: null }]);
    const { deps, repo } = makeDeps({ draftLLM: llm });
    const { rt, drain } = runtime();
    const u = { update_id: 7, channel_post: { message_id: 5, chat: { id: CHAT }, text: NOTE } };
    await handleWebhook(req(u), deps, rt);
    await handleWebhook(req(u), deps, rt);
    await drain();
    expect(repo.drafts.size).toBe(1);
    expect(calls).toHaveLength(1);
  });
  it('R10 a new update_id for the same message still creates one note (unique chat_id+message_id)', async () => {
    const { llm } = fakeLLM([{ post: goodPost(), news_item_used: null }]);
    const { deps, repo } = makeDeps({ draftLLM: llm });
    const { rt, drain } = runtime();
    const post = { message_id: 5, chat: { id: CHAT }, text: NOTE };
    await handleWebhook(req({ update_id: 8, channel_post: post }), deps, rt);
    await drain();
    await handleWebhook(req({ update_id: 9, channel_post: post }), deps, rt);
    await drain();
    expect(repo.notes.size).toBe(1);
    expect(repo.drafts.size).toBe(1);
  });
  it('R19 a voice message gets the text-only reply', async () => {
    const { deps, sent } = makeDeps();
    const { rt, drain } = runtime();
    await handleWebhook(req({ update_id: 10, channel_post: { message_id: 5, chat: { id: CHAT }, voice: { duration: 2 } } }), deps, rt);
    await drain();
    expect(sent.map((s) => s.text)).toEqual(['Text notes only for now. Send the note as text.']);
  });
});
