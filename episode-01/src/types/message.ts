/** Roles supported by Episode 01. */
export type MessageRole = "system" | "user" | "assistant";

/** An immutable message in the in-memory session history. */
export interface Message {
  readonly id: string;
  readonly sessionId: string;
  readonly role: MessageRole;
  readonly content: string;
  readonly createdAt: string;
}
