import { describe, expect, it } from 'vitest';
import { APPROVED_REPLY, REJECTED_REPLY, REPLY_TO_MEAN, handleCommand } from '../src/commands.js';
import type { MemoryRepo } from '../src/db/repo.js';
import { HELP_TEXT, NOT_YET_REPLY } from '../src/pipeline/format.js';
import { route } from '../src/router.js';
import type { Draft, TgMessage } from '../src/types.js';
import { CHAT, makeDeps, msg } from './helpers.js';

async function seedDraft(repo: MemoryRepo, chatId = CHAT, messageId = 1): Promise<Draft> {
  const note = (await repo.insertNote({ chat_id: chatId, message_id: messageId, text: 'note' }))!;
  await repo.updateNote(note.id, { status: 'drafted' });
  const d = await repo.insertDraft({ note_id: note.id, body: 'post', news: null, news_status: 'none', model: 'm', voice_version: '1.0.0', prompt_version: 'p', lint: null });
  return (await repo.updateDraft(d.id, { post_message_id: 500 + messageId, card_message_id: 600 + messageId }))!;
}

async function run(deps: ReturnType<typeof makeDeps>['deps'], m: TgMessage) {
  const target = m.reply_to_message ? await deps.repo.findReplyTarget(m.chat.id, m.reply_to_message.message_id) : null;
  const r = route(m, target);
  if (r.action === 'note' || r.action === 'ignore' || r.action === 'text_only') throw new Error(`not a command: ${r.action}`);
  await handleCommand(r, m, deps);
}

describe('commands §6.6', () => {
  it('R9 APPROVE on the card → approved with decided_at; the row stays', async () => {
    const { deps, repo, sent } = makeDeps();
    const d = await seedDraft(repo);
    await run(deps, msg({ message_id: 9, text: 'APPROVE', reply_to_message: { message_id: d.card_message_id! } }));
    expect(sent.at(-1)).toMatchObject({ text: APPROVED_REPLY, replyTo: 9 });
    expect(repo.drafts.get(d.id)).toMatchObject({ status: 'approved' });
    expect(repo.drafts.get(d.id)!.decided_at).not.toBeNull();
  });
  it('R9 REJECT: reason on Message 1 → rejected with reason, nothing deleted', async () => {
    const { deps, repo, sent } = makeDeps();
    const d = await seedDraft(repo);
    await run(deps, msg({ text: 'reject: too salesy at the end', reply_to_message: { message_id: d.post_message_id! } }));
    expect(sent.at(-1)!.text).toBe(REJECTED_REPLY);
    expect(repo.drafts.get(d.id)).toMatchObject({ status: 'rejected', decision_reason: 'too salesy at the end', body: 'post' });
    expect(repo.drafts.size).toBe(1);
  });
  it('R10 a second APPROVE changes nothing and says the current status', async () => {
    const { deps, repo, sent } = makeDeps();
    const d = await seedDraft(repo);
    const approve = msg({ text: 'APPROVE', reply_to_message: { message_id: d.card_message_id! } });
    await run(deps, approve);
    const decidedAt = repo.drafts.get(d.id)!.decided_at;
    await run(deps, approve);
    await run(deps, msg({ text: 'REJECT', reply_to_message: { message_id: d.card_message_id! } }));
    expect(sent.map((s) => s.text)).toEqual([APPROVED_REPLY, 'That draft is already approved.', 'That draft is already approved.']);
    expect(repo.drafts.get(d.id)!.decided_at).toBe(decidedAt);
  });
  it('R10 two concurrent APPROVEs → exactly one transition', async () => {
    const { deps, repo, sent } = makeDeps();
    const d = await seedDraft(repo);
    const m = msg({ text: 'APPROVE', reply_to_message: { message_id: d.card_message_id! } });
    await Promise.all([run(deps, m), run(deps, m)]);
    expect(sent.filter((s) => s.text === APPROVED_REPLY)).toHaveLength(1);
  });
  it('R9 unreplied APPROVE resolves to the single pending draft in this chat', async () => {
    const { deps, repo, sent } = makeDeps();
    const d = await seedDraft(repo);
    await seedDraft(repo, 42, 2); // pending draft in another chat is ignored (plan A4)
    await run(deps, msg({ text: 'approve' }));
    expect(sent.at(-1)!.text).toBe(APPROVED_REPLY);
    expect(repo.drafts.get(d.id)!.status).toBe('approved');
  });
  it('R9 unreplied APPROVE with 0 or 2 pending drafts → "Reply to the message you mean."', async () => {
    const { deps, repo, sent } = makeDeps();
    await run(deps, msg({ text: 'APPROVE' }));
    await seedDraft(repo, CHAT, 1);
    await seedDraft(repo, CHAT, 2);
    await run(deps, msg({ text: 'APPROVE' }));
    expect(sent.map((s) => s.text)).toEqual([REPLY_TO_MEAN, REPLY_TO_MEAN]);
  });
  it('A4 a reply in the DM does not match a draft whose message id lives in the channel', async () => {
    const { deps, repo } = makeDeps();
    const d = await seedDraft(repo, CHAT);
    expect(await repo.findReplyTarget(42, d.card_message_id!)).toBeNull();
  });
  it('M6 commands reply "not switched on yet" with no state change; HELP works', async () => {
    const { deps, repo, sent } = makeDeps();
    const d = await seedDraft(repo);
    await run(deps, msg({ text: 'REDO: shorter', reply_to_message: { message_id: d.card_message_id! } }));
    await run(deps, msg({ text: '/help' }));
    await run(deps, msg({ text: 'NEXT' }));
    expect(sent.map((s) => s.text)).toEqual([NOT_YET_REPLY, HELP_TEXT, NOT_YET_REPLY]);
    expect(repo.drafts.get(d.id)!.status).toBe('pending');
  });
});
