// npx tsx scripts/check-coverage.ts: every M0–M5 requirement ID appears in a test name (PRD §12 global DoD).
import { readdirSync, readFileSync } from 'node:fs';

const REQUIRED = ['R1', 'R2', 'R3', 'R4', 'R5', 'R6', 'R7', 'R8', 'R9', 'R10', 'R11', 'R12', 'R13', 'R14', 'R19'];
const names = readdirSync('tests')
  .filter((f) => f.endsWith('.test.ts'))
  .flatMap((f) => [...readFileSync(`tests/${f}`, 'utf8').matchAll(/\bit\(\s*['"`]([^'"`]+)/g)].map((m) => m[1]!));

const missing = REQUIRED.filter((id) => !names.some((n) => new RegExp(`\\b${id}\\b`).test(n)));
for (const id of REQUIRED) console.log(`${missing.includes(id) ? '❌' : '✅'} ${id} (${names.filter((n) => new RegExp(`\\b${id}\\b`).test(n)).length} tests)`);
process.exit(missing.length ? 1 : 0);
