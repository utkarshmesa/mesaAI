import { z } from 'zod';

const EnvSchema = z.object({
  TELEGRAM_BOT_TOKEN: z.string().min(1),
  TELEGRAM_ALLOWED_CHAT_IDS: z
    .string()
    .min(1)
    .transform((s) => s.split(',').map((x) => x.trim()).filter(Boolean)),
  TELEGRAM_WEBHOOK_SECRET: z.string().regex(/^[A-Za-z0-9_-]{32,256}$/, '32-256 chars of A-Z a-z 0-9 _ -'),
  GEMINI_API_KEY: z.string().min(1),
  GEMINI_MODEL: z.string().min(1),
  DRAFT_MODEL: z.string().min(1),
  SUPABASE_URL: z.string().default(''),
  SUPABASE_SERVICE_ROLE_KEY: z.string().default(''),
  SCORE_THRESHOLD: z.coerce.number().int().min(0).max(10).default(6),
  MIN_NOTE_WORDS: z.coerce.number().int().min(1).default(12),
  NEWS_LOCALE: z.string().default('hl=en-IN&gl=IN&ceid=IN:en'),
  NEWS_WINDOW: z.string().default('when:30d'),
  NEWS_FORCE_ERROR: z.string().default(''),
});

export type Config = z.infer<typeof EnvSchema>;

/** Parse and validate env. Throws with the names of bad variables (never their values). */
export function loadConfig(env: Record<string, string | undefined> = process.env): Config {
  const parsed = EnvSchema.safeParse(env);
  if (!parsed.success) {
    const names = parsed.error.issues.map((i) => i.path.join('.')).join(', ');
    throw new Error(`Invalid env: ${names}`);
  }
  return parsed.data;
}
