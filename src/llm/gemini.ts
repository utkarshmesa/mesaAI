import { GoogleGenAI, ThinkingLevel } from '@google/genai';
import { z } from 'zod';
import { type GenerateOptions, type LLM, withJsonRetry } from './index.js';

const LEVELS = { low: ThinkingLevel.LOW, medium: ThinkingLevel.MEDIUM, high: ThinkingLevel.HIGH } as const;

/** Rate limit, quota, bad/blocked key or a server error: worth trying the next key. */
export function shouldTryNextKey(err: unknown): boolean {
  const status = (err as { status?: unknown })?.status;
  return typeof status === 'number' && (status === 429 || status === 401 || status === 403 || status >= 500);
}

/** Try each client in order; move on only for errors another key could fix. */
export async function withKeyFallback<C, T>(clients: C[], fn: (client: C) => Promise<T>): Promise<T> {
  let lastErr: unknown;
  for (const client of clients) {
    try {
      return await fn(client);
    } catch (err) {
      lastErr = err;
      if (!shouldTryNextKey(err)) throw err;
    }
  }
  throw lastErr;
}

/**
 * Gemini adapter. `apiKeys` is one key or several; later keys are fallbacks (decisions O2).
 * No temperature is sent: Gemini 3 guidance is to keep the default (decisions O1).
 */
export function geminiLLM(apiKeys: string[], model: string): LLM {
  const clients = apiKeys.map((apiKey) => new GoogleGenAI({ apiKey }));
  return {
    name: 'gemini',
    model,
    async generateJSON<T>(schema: z.ZodType<T>, system: string, user: string, opts: GenerateOptions): Promise<T> {
      const jsonSchema = z.toJSONSchema(schema);
      const call = (u: string) =>
        withKeyFallback(clients, async (ai) => {
          const res = await ai.models.generateContent({
            model,
            contents: u,
            config: {
              systemInstruction: system,
              responseMimeType: 'application/json',
              responseJsonSchema: jsonSchema,
              abortSignal: AbortSignal.timeout(opts.timeoutMs),
              ...(opts.thinkingLevel ? { thinkingConfig: { thinkingLevel: LEVELS[opts.thinkingLevel] } } : {}),
            },
          });
          return res.text;
        });
      return withJsonRetry(schema, call, user, opts.allowRetry);
    },
  };
}
