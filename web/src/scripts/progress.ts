/** Practice progress, kept in this browser. Nothing here leaves the device. */
export type Result = { c: number; m: number; last: 'c' | 'm'; at: number };
export type State = 'correct' | 'missed' | 'unseen';

const PRACTICE = 'olympiad:practice';
const LAST = 'olympiad:last-practice';
const HISTORY = 'olympiad:history';

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}
function write(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* private mode: progress simply is not kept */
  }
}

export const loadPractice = () => read<Record<string, Result>>(PRACTICE, {});

export function record(id: string, ok: boolean) {
  const all = loadPractice();
  const prev = all[id] ?? { c: 0, m: 0, last: 'c', at: 0 };
  all[id] = { c: prev.c + (ok ? 1 : 0), m: prev.m + (ok ? 0 : 1), last: ok ? 'c' : 'm', at: Date.now() };
  write(PRACTICE, all);
}

export const stateOf = (all: Record<string, Result>, id: string): State =>
  !all[id] ? 'unseen' : all[id].last === 'c' ? 'correct' : 'missed';

export function summarize(all: Record<string, Result>, ids: string[]) {
  const out = { correct: 0, missed: 0, unseen: 0 };
  for (const id of ids) out[stateOf(all, id)] += 1;
  return out;
}

export type Last = { course: string; topic: string; name: string; at: number };
export const lastPractice = () => read<Last | null>(LAST, null);
export const setLastPractice = (l: Omit<Last, 'at'>) => write(LAST, { ...l, at: Date.now() });

export type Done = { id: string; at: number; score: number; total: number; seconds: number };
export const examHistory = (paperId: string) => read<Done[]>(HISTORY, []).filter((d) => d.id === paperId);

export type Attempt = { startedAt: number; answers: (number | null)[]; flagged: number[]; submittedAt?: number };
export const attemptFor = (paperId: string) => read<Attempt | null>(`olympiad:attempt:${paperId}`, null);
