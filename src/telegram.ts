// Raw Bot API via fetch. Plain text only (no parse_mode).
export interface Telegram {
  /** Returns the sent message_id. */
  sendMessage(chatId: number, text: string, replyTo?: number): Promise<number>;
}

const TIMEOUT_MS = 10_000;

export function telegramClient(token: string): Telegram {
  return {
    async sendMessage(chatId, text, replyTo) {
      const body: Record<string, unknown> = { chat_id: chatId, text, link_preview_options: { is_disabled: true } };
      if (replyTo) body.reply_parameters = { message_id: replyTo, allow_sending_without_reply: true };
      const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      const json = (await res.json()) as { ok: boolean; result?: { message_id: number }; description?: string };
      if (!json.ok || !json.result) throw new Error(`sendMessage failed: ${json.description ?? res.status}`);
      return json.result.message_id;
    },
  };
}

/** Send each part in order; returns the message ids. One retry per part (PRD §6.4 step 9). */
export async function sendParts(tg: Telegram, chatId: number, parts: string[], replyTo?: number): Promise<number[]> {
  const ids: number[] = [];
  for (const part of parts) {
    const reply = ids.length ? undefined : replyTo;
    try {
      ids.push(await tg.sendMessage(chatId, part, reply));
    } catch {
      ids.push(await tg.sendMessage(chatId, part, reply));
    }
  }
  return ids;
}
