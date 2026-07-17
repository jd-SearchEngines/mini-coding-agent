import { describe, expect, it, vi } from "vitest";
import {
  AgentLoop,
  ScriptedModelClient,
  ToolExecutor,
  ToolRegistry
} from "../src/index.js";
import type {
  Message,
  Tool,
  ToolResult,
  ToolUseRequest
} from "../src/index.js";

const userMessage: Message = {
  kind: "text",
  id: "user-1",
  sessionId: "session",
  role: "user",
  content: "read it",
  createdAt: "2026-01-01T00:00:00.000Z"
};

function echoTool(
  execute = vi.fn(async (input: string) => input)
): Tool<string> {
  return {
    name: "echo",
    description: "Echo",
    inputSchema: {},
    isReadOnly: true,
    validateInput(input) {
      if (typeof input !== "string") throw new Error("string required");
      return input;
    },
    execute
  };
}

function createHarness(
  responses: ConstructorParameters<typeof ScriptedModelClient>[0]
) {
  const registry = new ToolRegistry();
  const execute = vi.fn(async (input: string) => input);
  registry.register(echoTool(execute));
  const model = new ScriptedModelClient(responses);
  const messages: Message[] = [structuredClone(userMessage)];
  const loop = new AgentLoop({
    modelClient: model,
    toolExecutor: new ToolExecutor(registry),
    toolDefinitions: registry.listDefinitions()
  });
  const onToolUse = vi.fn((toolUse: ToolUseRequest) => {
    messages.push({
      kind: "tool_use",
      id: "tool-message",
      sessionId: "session",
      role: "assistant",
      toolUse,
      createdAt: "2026-01-01T00:00:01.000Z"
    });
  });
  const onToolResult = vi.fn((result: ToolResult) => {
    messages.push({
      kind: "tool_result",
      id: "result-message",
      sessionId: "session",
      role: "tool",
      result,
      createdAt: "2026-01-01T00:00:02.000Z"
    });
  });
  const onFinalAnswer = vi.fn((content: string) => {
    messages.push({
      kind: "text",
      id: "final-message",
      sessionId: "session",
      role: "assistant",
      content,
      createdAt: "2026-01-01T00:00:03.000Z"
    });
  });
  return {
    loop,
    model,
    messages,
    execute,
    onToolUse,
    onToolResult,
    onFinalAnswer
  };
}

describe("AgentLoop tool cycle", () => {
  it("appends tool_use and result, then lets the model see the observation", async () => {
    const harness = createHarness([
      {
        type: "tool_use",
        toolUse: { id: "use-1", name: "echo", input: "real content" }
      },
      { type: "final", content: "analysis" }
    ]);
    await harness.loop.run({
      messages: harness.messages,
      toolContext: { workspaceRoot: "." },
      onToolUse: harness.onToolUse,
      onToolResult: harness.onToolResult,
      onFinalAnswer: harness.onFinalAnswer
    });

    expect(harness.execute).toHaveBeenCalledWith(
      "real content",
      expect.objectContaining({ workspaceRoot: "." })
    );
    expect(harness.messages.map(({ kind }) => kind)).toEqual([
      "text",
      "tool_use",
      "tool_result",
      "text"
    ]);
    expect(harness.model.calls[1]?.messages[2]).toMatchObject({
      kind: "tool_result",
      result: { content: "real content", ok: true }
    });
  });

  it("feeds a failed tool result back and still reaches a final answer", async () => {
    const harness = createHarness([
      {
        type: "tool_use",
        toolUse: { id: "bad", name: "missing", input: {} }
      },
      { type: "final", content: "tool failed visibly" }
    ]);
    await harness.loop.run({
      messages: harness.messages,
      toolContext: { workspaceRoot: "." },
      onToolUse: harness.onToolUse,
      onToolResult: harness.onToolResult,
      onFinalAnswer: harness.onFinalAnswer
    });
    expect(harness.onToolResult).toHaveBeenCalledWith(
      expect.objectContaining({ ok: false, toolUseId: "bad" })
    );
    expect(harness.onFinalAnswer).toHaveBeenCalledWith("tool failed visibly");
  });

  it("enforces maxIterations", async () => {
    const registry = new ToolRegistry();
    registry.register(echoTool());
    const loop = new AgentLoop({
      modelClient: new ScriptedModelClient([
        { type: "tool_use", toolUse: { id: "1", name: "echo", input: "a" } },
        { type: "tool_use", toolUse: { id: "2", name: "echo", input: "b" } }
      ]),
      toolExecutor: new ToolExecutor(registry),
      toolDefinitions: registry.listDefinitions(),
      maxIterations: 2
    });
    await expect(
      loop.run({
        messages: [userMessage],
        toolContext: { workspaceRoot: "." },
        onToolUse: () => undefined,
        onToolResult: () => undefined,
        onFinalAnswer: () => undefined
      })
    ).rejects.toThrow("exceeded maxIterations (2)");
  });

  it("stops before calling the model when aborted", async () => {
    const harness = createHarness([{ type: "final", content: "never" }]);
    const controller = new AbortController();
    controller.abort();
    await expect(
      harness.loop.run({
        messages: harness.messages,
        signal: controller.signal,
        toolContext: { workspaceRoot: "." },
        onToolUse: harness.onToolUse,
        onToolResult: harness.onToolResult,
        onFinalAnswer: harness.onFinalAnswer
      })
    ).rejects.toMatchObject({ name: "AbortError" });
    expect(harness.model.calls).toHaveLength(0);
  });
});
