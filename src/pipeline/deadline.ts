// PRD §6.2 deadline budget: min(platform deadline − 20 s, start + 240 s).
export const BUDGET_MS = 240_000;
export const PLATFORM_MARGIN_MS = 20_000;
export const OPTIONAL_MIN_MS = 40_000;

export interface Deadline {
  at: number;
  remainingMs(): number;
  /** Optional work (JSON retry, lint regeneration) needs ≥ 40 s left. */
  canRunOptional(): boolean;
}

export function makeDeadline(start: number, platformDeadline?: Date, now: () => number = Date.now): Deadline {
  const fromPlatform = platformDeadline ? platformDeadline.getTime() - PLATFORM_MARGIN_MS : Infinity;
  const at = Math.min(fromPlatform, start + BUDGET_MS);
  return {
    at,
    remainingMs: () => at - now(),
    canRunOptional: () => at - now() >= OPTIONAL_MIN_MS,
  };
}

/** Per-call timeout: the stage timeout, but never past the deadline. */
export function callTimeout(dl: Deadline, stageMs: number): number {
  return Math.max(1_000, Math.min(stageMs, dl.remainingMs()));
}
