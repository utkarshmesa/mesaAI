import { describe, expect, it } from 'vitest';
import { blankDraft, blankNote } from '../src/db/repo.js';
import { parseCommand, route, wordCount } from '../src/router.js';
import type { ReplyTarget } from '../src/types.js';
import { msg } from './helpers.js';

const card: ReplyTarget = {
  kind: 'draft',
  via: 'card',
  draft: blankDraft({ note_id: 'n', body: 'x', news: null, news_status: 'none', model: 'm', voice_version: 'v', prompt_version: 'p', lint: null }),
};
const rejection: ReplyTarget = { kind: 'note', via: 'rejection', note: blankNote({ chat_id: 1, message_id: 1, text: 't' }) };

describe('router §6.3', () => {
  it('rule 1: service message is ignored', () => {
    expect(route(msg({ pinned_message: { message_id: 3 } }), null).rule).toBe(1);
  });
  it('R19 voice message gets the text-only reply', () => {
    expect(route(msg({ voice: { file_id: 'x', duration: 3 } }), null)).toEqual({ rule: 2, action: 'text_only' });
  });
  it('R19 sticker and photo without caption get the text-only reply', () => {
    expect(route(msg({ sticker: {} }), null).action).toBe('text_only');
    expect(route(msg({ photo: [{}] }), null).action).toBe('text_only');
  });
  it('R19 caption-only photo counts as a note', () => {
    const r = route(msg({ photo: [{}], caption: '  Batch fourteen pH drifted by 0.4 units  ' }), null);
    expect(r).toEqual({ rule: 7, action: 'note', body: 'Batch fourteen pH drifted by 0.4 units' });
  });
  it('R1 a note starting with "Rejected a sample…" goes to the pipeline', () => {
    const body = 'Rejected a sample from a supplier today because the CoA did not match the spec sheet at all';
    expect(route(msg({ text: body }), null)).toEqual({ rule: 7, action: 'note', body });
  });
  it('R1 a note starting with "Redo…" goes to the pipeline', () => {
    expect(route(msg({ text: 'Redo the stability test on the new base because humidity changed' }), null).rule).toBe(7);
  });
  it('R9 reply to a card with "approve" goes to the command handler', () => {
    const r = route(msg({ text: 'approve', reply_to_message: { message_id: 9 } }), card);
    expect(r).toMatchObject({ rule: 3, action: 'command', command: { name: 'APPROVE', arg: null }, target: card });
  });
  it('R9 REJECT with a reason on a card carries the reason', () => {
    const r = route(msg({ text: 'REJECT: too generic, not my voice at all' }), card);
    expect(r).toMatchObject({ rule: 3, command: { name: 'REJECT', arg: 'too generic, not my voice at all' } });
  });
  it('R16 DRAFT ANYWAY on a rejection message is a command', () => {
    expect(route(msg({ text: 'draft anyway' }), rejection)).toMatchObject({ rule: 3, command: { name: 'DRAFT ANYWAY' } });
  });
  it('rule 4: short unreplied command uses fallback resolution', () => {
    expect(route(msg({ text: 'APPROVE' }), null)).toMatchObject({ rule: 4, command: { name: 'APPROVE' } });
    expect(route(msg({ text: 'REJECT: too long' }), null)).toMatchObject({ rule: 4, command: { name: 'REJECT', arg: 'too long' } });
  });
  it('rule 4 limit: an unreplied command with more than 3 words is a note', () => {
    expect(route(msg({ text: 'REJECT: not my voice' }), null).rule).toBe(7);
  });
  it('rule 5: bare commands, with or without slash and bot suffix', () => {
    expect(route(msg({ text: '/start@MeeraDraftBot' }), null)).toEqual({ rule: 5, action: 'bare_command', command: 'START' });
    expect(route(msg({ text: 'stats' }), null)).toMatchObject({ rule: 5, command: 'STATS' });
    expect(route(msg({ text: 'HELP' }), card)).toMatchObject({ rule: 5, command: 'HELP' });
  });
  it('rule 6: a non-command reply to a bot message gets HELP, not a new note', () => {
    expect(route(msg({ text: 'love this one, will post tomorrow morning' }), card)).toEqual({ rule: 6, action: 'help' });
  });
  it('"APPROVE." with punctuation is not a command (PRD regex, plan A13)', () => {
    expect(parseCommand('APPROVE.')).toBeNull();
  });
  it('wordCount ignores tokens with no letters or digits', () => {
    expect(wordCount('niacinamide + something about humidity?? come back to this')).toBe(8);
  });
});
