import type { TextMessageRole } from "../types/message.js";
import type { SessionStatus } from "../types/session-status.js";
import type { ToolErrorCode } from "../types/tool-result.js";

export type TranscriptEventType =
  | "session_created"
  | "status_change"
  | "text_message"
  | "tool_use"
  | "tool_result"
  | "session_stopped"
  | "error";

/** One structured, append-only observable runtime event. */
export interface TranscriptEvent {
  readonly eventId: string;
  readonly sessionId: string;
  readonly eventType: TranscriptEventType;
  readonly timestamp: string;
  readonly role?: TextMessageRole;
  readonly content?: string;
  readonly status?: SessionStatus;
  readonly toolUseId?: string;
  readonly toolName?: string;
  readonly input?: unknown;
  readonly ok?: boolean;
  readonly errorCode?: ToolErrorCode;
}

/** Persistence boundary for a session's observable execution history. */
export interface TranscriptStore {
  append(event: TranscriptEvent): Promise<void>;
  load(sessionId: string): Promise<TranscriptEvent[]>;
}
