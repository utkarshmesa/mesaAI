// One JSON line per stage. Never log note text or secrets.
export interface LogLine {
  note_id?: string;
  stage: string;
  ms?: number;
  ok: boolean;
  model?: string;
  err?: string;
  [key: string]: unknown;
}

export type Logger = (line: LogLine) => void;

export const log: Logger = (line) => console.log(JSON.stringify(line));

export function errMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
