// npm run webhook:set -- https://<your-app>.vercel.app/api/webhook [--drop-pending]
// Calls setWebhook with secret_token + allowed_updates, then prints getWebhookInfo (no secrets).
const token = process.env.TELEGRAM_BOT_TOKEN;
const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
const url = process.argv.slice(2).find((a) => a.startsWith('https://')) ?? process.env.WEBHOOK_URL;
const dropPending = process.argv.includes('--drop-pending');

if (!token || !secret || !url) {
  console.error('Need TELEGRAM_BOT_TOKEN, TELEGRAM_WEBHOOK_SECRET in .env and the webhook URL as an argument.');
  process.exit(1);
}

const api = (method: string, body?: unknown) =>
  fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  }).then((r) => r.json() as Promise<{ ok: boolean; result?: unknown; description?: string }>);

const set = await api('setWebhook', {
  url,
  secret_token: secret,
  allowed_updates: ['message', 'channel_post'],
  drop_pending_updates: dropPending,
});
console.log('setWebhook:', set.ok ? 'ok' : `FAILED: ${set.description}`);

const info = await api('getWebhookInfo');
console.log('getWebhookInfo:', JSON.stringify(info.result, null, 2));
const r = info.result as { url?: string; last_error_message?: string } | undefined;
if (!set.ok || r?.url !== url || r?.last_error_message) process.exit(1);
