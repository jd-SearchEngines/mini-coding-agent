import type { Message } from "../types/message.js";

/**
 * Episode 02 retains the complete ordered history so tool_use/tool_result pairs
 * cannot be split. Token budgets and compaction arrive in a later episode.
 */
export function buildMessagesForQuery(messages: readonly Message[]): Message[] {
  return messages.map((message) => structuredClone(message));
}
