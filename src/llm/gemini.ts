import { GoogleGenAI, ThinkingLevel } from '@google/genai';
import { z } from 'zod';
import { type GenerateOptions, type LLM, withJsonRetry } from './index.js';

const LEVELS = { low: ThinkingLevel.LOW, medium: ThinkingLevel.MEDIUM, high: ThinkingLevel.HIGH } as const;

/** Gemini adapter. No temperature is sent: Gemini 3 guidance is to keep the default (decisions O1). */
export function geminiLLM(apiKey: string, model: string): LLM {
  const ai = new GoogleGenAI({ apiKey });
  return {
    name: 'gemini',
    model,
    async generateJSON<T>(schema: z.ZodType<T>, system: string, user: string, opts: GenerateOptions): Promise<T> {
      const jsonSchema = z.toJSONSchema(schema);
      const call = async (u: string) => {
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
      };
      return withJsonRetry(schema, call, user, opts.allowRetry);
    },
  };
}
