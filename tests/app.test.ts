import { describe, expect, it } from 'vitest';
import { buildDeps } from '../src/app.js';
import { loadConfig } from '../src/config.js';
import { MemoryRepo } from '../src/db/repo.js';
import { SupabaseRepo } from '../src/db/supabaseRepo.js';

const env = {
  TELEGRAM_BOT_TOKEN: 't',
  TELEGRAM_ALLOWED_CHAT_IDS: '-100',
  TELEGRAM_WEBHOOK_SECRET: 'a'.repeat(32),
  GEMINI_API_KEY: 'k',
  GEMINI_MODEL: 'gemini-3.8-flash',
  DRAFT_MODEL: 'gemini-3.8-flash',
};

describe('app wiring', () => {
  it('R12 the drafter model is switched by DRAFT_MODEL, independently of the analyse model', () => {
    const d = buildDeps(loadConfig({ ...env, DRAFT_MODEL: 'gemini-3.7-flash' }));
    expect(d.draftLLM.model).toBe('gemini-3.7-flash');
    expect(d.analyseLLM.model).toBe('gemini-3.8-flash');
  });
  it('R8 uses Supabase when configured, memory otherwise', () => {
    expect(buildDeps(loadConfig(env)).repo).toBeInstanceOf(MemoryRepo);
    const withDb = buildDeps(loadConfig({ ...env, SUPABASE_URL: 'https://x.supabase.co', SUPABASE_SERVICE_ROLE_KEY: 'k' }));
    expect(withDb.repo).toBeInstanceOf(SupabaseRepo);
  });
  it('NG1 the Cut: no LinkedIn integration anywhere in the source', async () => {
    const { readdirSync, readFileSync, statSync } = await import('node:fs');
    const walk = (dir: string): string[] =>
      readdirSync(dir).flatMap((f) => (statSync(`${dir}/${f}`).isDirectory() ? walk(`${dir}/${f}`) : [`${dir}/${f}`]));
    const code = [...walk('src'), ...walk('api'), ...walk('scripts')].map((f) => readFileSync(f, 'utf8')).join('\n');
    expect(code).not.toMatch(/linkedin\.com|api\.linkedin|LINKEDIN_(TOKEN|CLIENT|KEY|SECRET)/i);
    const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
    expect(Object.keys({ ...pkg.dependencies, ...pkg.devDependencies }).join()).not.toMatch(/linkedin/i);
  });
});
