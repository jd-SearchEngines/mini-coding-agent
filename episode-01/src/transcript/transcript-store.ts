import type { MessageRole } from "../types/message.js";
import type { SessionStatus } from "../types/session-status.js";

/** Event kinds persisted in an Episode 01 transcript. */
export type TranscriptEventType =
  "message" | "status_change" | "session_created" | "session_stopped" | "error";

/** One append-only, observable runtime event. */
export interface TranscriptEvent {
  readonly eventId: string;
  readonly sessionId: string;
  readonly eventType: TranscriptEventType;
  readonly timestamp: string;
  readonly role?: MessageRole;
  readonly content?: string;
  readonly status?: SessionStatus;
}

/** Persistence boundary for a session's observable execution history. */
export interface TranscriptStore {
  append(event: TranscriptEvent): Promise<void>;
  load(sessionId: string): Promise<TranscriptEvent[]>;
}
