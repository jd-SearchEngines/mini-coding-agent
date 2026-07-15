import type { Message } from "../types/message.js";

export const DEFAULT_RECENT_MESSAGE_LIMIT = 20;

/**
 * Builds the context visible to the model without mutating session messages.
 * All system messages are retained, followed by the latest non-system messages.
 */
export function buildMessagesForQuery(
  messages: readonly Message[],
  recentMessageLimit = DEFAULT_RECENT_MESSAGE_LIMIT
): Message[] {
  if (!Number.isInteger(recentMessageLimit) || recentMessageLimit < 0) {
    throw new Error("recentMessageLimit must be a non-negative integer");
  }

  const systemMessages = messages.filter(
    (message) => message.role === "system"
  );
  const conversationMessages = messages.filter(
    (message) => message.role !== "system"
  );
  const recentMessages =
    recentMessageLimit === 0
      ? []
      : conversationMessages.slice(-recentMessageLimit);

  return [...systemMessages, ...recentMessages];
}
