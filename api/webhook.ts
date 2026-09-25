// POST /api/webhook: auth → ack → waitUntil(handle). All logic lives in src/webhook.ts.
import { getDeadline, waitUntil } from '@vercel/functions';
import { appDeps } from '../src/app.js';
import { handleWebhook } from '../src/webhook.js';

export default {
  async fetch(request: Request): Promise<Response> {
    if (request.method !== 'POST') return new Response('ok', { status: 200 });
    return handleWebhook(request, appDeps(), { waitUntil, platformDeadline: getDeadline });
  },
};
