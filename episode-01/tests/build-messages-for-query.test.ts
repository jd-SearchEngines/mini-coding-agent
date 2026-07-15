import { describe, expect, it } from "vitest";
import { buildMessagesForQuery } from "../src/index.js";
import type { Message, MessageRole } from "../src/index.js";

function message(id: string, role: MessageRole): Message {
  return {
    id,
    sessionId: "session",
    role,
    content: id,
    createdAt: "2026-01-01T00:00:00.000Z"
  };
}

describe("buildMessagesForQuery", () => {
  it("returns an empty array for empty input", () => {
    expect(buildMessagesForQuery([])).toEqual([]);
  });

  it("returns the latest N conversation messages and retains system messages", () => {
    const messages = [
      message("system", "system"),
      message("user-1", "user"),
      message("assistant-1", "assistant"),
      message("user-2", "user")
    ];

    expect(buildMessagesForQuery(messages, 2).map(({ id }) => id)).toEqual([
      "system",
      "assistant-1",
      "user-2"
    ]);
  });

  it("does not mutate or reuse the original array", () => {
    const messages = [message("user", "user")];
    const snapshot = [...messages];
    const result = buildMessagesForQuery(messages);

    expect(messages).toEqual(snapshot);
    expect(result).not.toBe(messages);
  });

  it("can return only system messages when N is zero", () => {
    const messages = [message("system", "system"), message("user", "user")];
    expect(buildMessagesForQuery(messages, 0)).toEqual([messages[0]]);
  });
});
