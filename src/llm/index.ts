import type { z } from 'zod';

export interface GenerateOptions {
  timeoutMs: number;
  /** One retry with "Return valid JSON only…" on a parse/validation failure (PRD §7). */
  allowRetry: boolean;
  thinkingLevel?: 'low' | 'medium' | 'high';
}

export interface LLM {
  name: string;
  model: string;
  generateJSON<T>(schema: z.ZodType<T>, system: string, user: string, opts: GenerateOptions): Promise<T>;
}

export const JSON_RETRY_SUFFIX = '\n\nReturn valid JSON only matching the schema.';

/** Parse + validate a model's text; throws on failure. */
export function parseJSON<T>(schema: z.ZodType<T>, text: string | undefined): T {
  const cleaned = (text ?? '').trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  return schema.parse(JSON.parse(cleaned));
}

/** Shared retry wrapper: call once, and on bad JSON call once more with the retry suffix. */
export async function withJsonRetry<T>(
  schema: z.ZodType<T>,
  call: (user: string) => Promise<string | undefined>,
  user: string,
  allowRetry: boolean,
): Promise<T> {
  try {
    return parseJSON(schema, await call(user));
  } catch (err) {
    if (!allowRetry || !isJsonError(err)) throw err;
    return parseJSON(schema, await call(user + JSON_RETRY_SUFFIX));
  }
}

function isJsonError(err: unknown): boolean {
  return err instanceof SyntaxError || (err as { name?: string })?.name === 'ZodError';
}
