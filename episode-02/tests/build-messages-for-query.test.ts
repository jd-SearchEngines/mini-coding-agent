import { describe, expect, it } from "vitest";
import { buildMessagesForQuery } from "../src/index.js";
import type { Message } from "../src/index.js";

const messages: Message[] = [
  {
    kind: "text",
    id: "system",
    sessionId: "s",
    role: "system",
    content: "system",
    createdAt: "1"
  },
  {
    kind: "text",
    id: "user",
    sessionId: "s",
    role: "user",
    content: "read",
    createdAt: "2"
  },
  {
    kind: "tool_use",
    id: "use-message",
    sessionId: "s",
    role: "assistant",
    toolUse: { id: "use", name: "read_file", input: { path: "file.ts" } },
    createdAt: "3"
  },
  {
    kind: "tool_result",
    id: "result-message",
    sessionId: "s",
    role: "tool",
    result: {
      toolUseId: "use",
      toolName: "read_file",
      ok: true,
      content: "real content"
    },
    createdAt: "4"
  }
];

describe("buildMessagesForQuery", () => {
  it("handles empty history", () => {
    expect(buildMessagesForQuery([])).toEqual([]);
  });

  it("retains system and complete tool pairs in order", () => {
    expect(buildMessagesForQuery(messages).map(({ kind }) => kind)).toEqual([
      "text",
      "text",
      "tool_use",
      "tool_result"
    ]);
    expect(buildMessagesForQuery(messages)[3]).toMatchObject({
      result: { content: "real content" }
    });
  });

  it("returns a deep copy and never mutates the session history", () => {
    const result = buildMessagesForQuery(messages);
    expect(result).not.toBe(messages);
    expect(result[2]).not.toBe(messages[2]);
    const clonedInput = (result[2] as { toolUse: { input: { path: string } } })
      .toolUse.input;
    clonedInput.path = "changed";
    expect(messages[2]).toMatchObject({
      toolUse: { input: { path: "file.ts" } }
    });
  });
});
