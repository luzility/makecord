export interface Reveal {
  line: number;
  column: number;
  length: number;
}

const pending = new Map<string, Reveal>();
const listeners = new Set<(path: string) => void>();

export function requestReveal(path: string, reveal: Reveal) {
  pending.set(path, reveal);
  for (const l of listeners) l(path);
}

export function takeReveal(path: string): Reveal | undefined {
  const r = pending.get(path);
  pending.delete(path);
  return r;
}

export function onReveal(fn: (path: string) => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
