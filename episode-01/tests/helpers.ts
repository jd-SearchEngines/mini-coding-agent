import type { TranscriptEvent, TranscriptStore } from "../src/index.js";

export class MemoryTranscriptStore implements TranscriptStore {
  readonly events: TranscriptEvent[] = [];

  async append(event: TranscriptEvent): Promise<void> {
    this.events.push({ ...event });
  }

  async load(sessionId: string): Promise<TranscriptEvent[]> {
    return this.events
      .filter((event) => event.sessionId === sessionId)
      .map((event) => ({ ...event }));
  }
}

export interface Deferred<T> {
  readonly promise: Promise<T>;
  readonly resolve: (value: T) => void;
  readonly reject: (reason?: unknown) => void;
}

export function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}
