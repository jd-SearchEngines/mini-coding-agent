import { describe, expect, it, vi } from "vitest";
import {
  AgentLoop,
  ScriptedModelClient,
  SESSION_STATUS,
  SessionRuntime,
  ToolExecutor,
  ToolRegistry
} from "../src/index.js";
import type { ModelClient, ModelResponse, Tool } from "../src/index.js";
import { deferred, MemoryTranscriptStore } from "./helpers.js";

function echoTool(): Tool<string> {
  return {
    name: "echo",
    description: "Echo",
    inputSchema: {},
    isReadOnly: true,
    validateInput(input) {
      if (typeof input !== "string") throw new Error("string required");
      return input;
    },
    async execute(input) {
      return input;
    }
  };
}

function runtimeWith(modelClient: ModelClient): {
  runtime: SessionRuntime;
  store: MemoryTranscriptStore;
} {
  const registry = new ToolRegistry();
  registry.register(echoTool());
  const store = new MemoryTranscriptStore();
  return {
    store,
    runtime: new SessionRuntime({
      sessionId: "runtime-test",
      workspaceRoot: ".",
      transcriptStore: store,
      agentLoop: new AgentLoop({
        modelClient,
        toolExecutor: new ToolExecutor(registry),
        toolDefinitions: registry.listDefinitions()
      })
    })
  };
}

function successfulRuntime() {
  return runtimeWith(
    new ScriptedModelClient([
      {
        type: "tool_use",
        toolUse: { id: "use-1", name: "echo", input: "observed" }
      },
      { type: "final", content: "final analysis" }
    ])
  );
}

describe("SessionRuntime tools", () => {
  it("persists user, tool_use, tool_result and final answer in order", async () => {
    const { runtime, store } = successfulRuntime();
    const responses = await runtime.receive("run tool");
    expect(responses[0]?.content).toBe("final analysis");
    expect(runtime.getStatus()).toBe(SESSION_STATUS.IDLE);
    expect(
      store.events
        .filter(({ eventType }) => eventType === "status_change")
        .map(({ status }) => status)
    ).toEqual([SESSION_STATUS.RUNNING, SESSION_STATUS.IDLE]);
    expect(runtime.getMessages().map(({ kind }) => kind)).toEqual([
      "text",
      "tool_use",
      "tool_result",
      "text"
    ]);
    expect(
      store.events
        .filter(({ eventType }) =>
          ["text_message", "tool_use", "tool_result"].includes(eventType)
        )
        .map(({ eventType }) => eventType)
    ).toEqual(["text_message", "tool_use", "tool_result", "text_message"]);
  });

  it("returns copies instead of mutable internal state", async () => {
    const { runtime } = successfulRuntime();
    await runtime.receive("run");
    const copy = runtime.getMessages();
    expect(runtime.getMessages()).not.toBe(copy);
    expect(runtime.getMessages()[0]).not.toBe(copy[0]);
    expect(runtime.getMessages()[0]).toMatchObject({ content: "run" });
  });

  it("becomes failed when the model has a programming error", async () => {
    const { runtime, store } = runtimeWith({
      generate: async () => Promise.reject(new Error("model unavailable"))
    });
    await expect(runtime.receive("run")).rejects.toThrow("model unavailable");
    expect(runtime.getStatus()).toBe(SESSION_STATUS.FAILED);
    expect(store.events.some(({ eventType }) => eventType === "error")).toBe(
      true
    );
  });

  it("rejects a second receive while running", async () => {
    const pending = deferred<ModelResponse>();
    const { runtime } = runtimeWith({ generate: () => pending.promise });
    const first = runtime.receive("first");
    await vi.waitFor(() =>
      expect(runtime.getStatus()).toBe(SESSION_STATUS.RUNNING)
    );
    await expect(runtime.receive("second")).rejects.toThrow("already running");
    pending.resolve({ type: "final", content: "done" });
    await first;
  });

  it("stop aborts the loop and leaves status stopped", async () => {
    const pending = deferred<ModelResponse>();
    const { runtime, store } = runtimeWith({ generate: () => pending.promise });
    const receive = runtime.receive("run");
    await vi.waitFor(() =>
      expect(runtime.getStatus()).toBe(SESSION_STATUS.RUNNING)
    );
    await runtime.stop();
    await runtime.stop();
    pending.resolve({ type: "final", content: "late" });
    await expect(receive).rejects.toMatchObject({ name: "AbortError" });
    expect(runtime.getStatus()).toBe(SESSION_STATUS.STOPPED);
    expect(
      store.events.filter(({ eventType }) => eventType === "session_stopped")
    ).toHaveLength(1);
  });

  it.each(["", "   "])("rejects empty input %j", async (content) => {
    const { runtime } = successfulRuntime();
    await expect(runtime.receive(content)).rejects.toThrow("cannot be empty");
  });
});
