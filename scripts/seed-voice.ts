// npm run voice:seed: inserts context/voice-skill.txt as the active voice_skill version.
import { createClient } from '@supabase/supabase-js';
import { loadContext } from '../src/context.js';

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error('Need SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env');
  process.exit(1);
}
const db = createClient(url, key, { auth: { persistSession: false } });
const { voiceSkill, voiceVersion } = loadContext();

const existing = await db.from('voice_skill').select('version, content').eq('version', voiceVersion).maybeSingle();
if (existing.error) throw existing.error;
if (existing.data && existing.data.content !== voiceSkill) {
  console.error(`Version ${voiceVersion} already exists with different content. Bump "version:" in voice-skill.txt.`);
  process.exit(1);
}

// Only one row may be active (unique partial index), so deactivate first.
const off = await db.from('voice_skill').update({ active: false }).eq('active', true).neq('version', voiceVersion);
if (off.error) throw off.error;
const up = await db.from('voice_skill').upsert({ version: voiceVersion, content: voiceSkill, active: true }, { onConflict: 'version' });
if (up.error) throw up.error;
console.log(`voice_skill ${voiceVersion} is active (${voiceSkill.length} chars).`);
