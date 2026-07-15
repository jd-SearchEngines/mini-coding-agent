import { describe, expect, it, vi } from "vitest";
import { AgentLoop, SESSION_STATUS, SessionRuntime } from "../src/index.js";
import type { ModelClient, ModelResponse } from "../src/index.js";
import { deferred, MemoryTranscriptStore } from "./helpers.js";

function createRuntime(
  modelClient: ModelClient = {
    generate: async () => ({ content: "assistant reply", finishReason: "stop" })
  }
): { runtime: SessionRuntime; store: MemoryTranscriptStore } {
  const store = new MemoryTranscriptStore();
  const runtime = new SessionRuntime({
    sessionId: "test-session",
    agentLoop: new AgentLoop({ modelClient }),
    transcriptStore: store
  });
  return { runtime, store };
}

describe("SessionRuntime", () => {
  it("starts idle and persists session creation", async () => {
    const { runtime, store } = createRuntime();
    expect(runtime.getStatus()).toBe(SESSION_STATUS.IDLE);
    await runtime.ready();
    expect(store.events[0]?.eventType).toBe("session_created");
  });

  it("saves user first, transitions idle-running-idle, and saves assistant", async () => {
    const { runtime, store } = createRuntime();
    const responses = await runtime.receive("hello");

    expect(runtime.getStatus()).toBe(SESSION_STATUS.IDLE);
    expect(runtime.getMessages().map(({ role }) => role)).toEqual([
      "user",
      "assistant"
    ]);
    expect(responses[0]?.content).toBe("assistant reply");
    expect(
      store.events
        .filter(({ eventType }) => eventType === "message")
        .map(({ role }) => role)
    ).toEqual(["user", "assistant"]);
    expect(
      store.events
        .filter(({ eventType }) => eventType === "status_change")
        .map(({ status }) => status)
    ).toEqual([SESSION_STATUS.RUNNING, SESSION_STATUS.IDLE]);
  });

  it("persists the user message before calling the model", async () => {
    const store = new MemoryTranscriptStore();
    const generate = vi.fn(async (): Promise<ModelResponse> => {
      expect(store.events.some(({ role }) => role === "user")).toBe(true);
      return { content: "done", finishReason: "stop" };
    });
    const runtime = new SessionRuntime({
      sessionId: "ordered-session",
      agentLoop: new AgentLoop({ modelClient: { generate } }),
      transcriptStore: store
    });

    await runtime.receive("hello");
    expect(generate).toHaveBeenCalledOnce();
  });

  it("becomes failed and records an error when the model throws", async () => {
    const { runtime, store } = createRuntime({
      generate: async () => {
        throw new Error("model unavailable");
      }
    });

    await expect(runtime.receive("hello")).rejects.toThrow("model unavailable");
    expect(runtime.getStatus()).toBe(SESSION_STATUS.FAILED);
    expect(store.events.some(({ eventType }) => eventType === "error")).toBe(
      true
    );
  });

  it("rejects another receive while running", async () => {
    const pending = deferred<ModelResponse>();
    const { runtime } = createRuntime({ generate: () => pending.promise });
    const firstReceive = runtime.receive("first");
    await vi.waitFor(() =>
      expect(runtime.getStatus()).toBe(SESSION_STATUS.RUNNING)
    );

    await expect(runtime.receive("second")).rejects.toThrow("already running");
    pending.resolve({ content: "done", finishReason: "stop" });
    await firstReceive;
  });

  it("getMessages does not expose the internal array or message objects", async () => {
    const { runtime } = createRuntime();
    await runtime.receive("hello");
    const messages = runtime.getMessages() as unknown as Array<{
      content: string;
    }>;
    messages[0]!.content = "changed";
    messages.push({ content: "injected" });

    expect(runtime.getMessages()).toHaveLength(2);
    expect(runtime.getMessages()[0]?.content).toBe("hello");
  });

  it("stop aborts an active turn and is idempotent", async () => {
    const pending = deferred<ModelResponse>();
    const { runtime, store } = createRuntime({
      generate: () => pending.promise
    });
    const receive = runtime.receive("hello");
    await vi.waitFor(() =>
      expect(runtime.getStatus()).toBe(SESSION_STATUS.RUNNING)
    );

    await runtime.stop();
    await runtime.stop();
    pending.resolve({ content: "late", finishReason: "stop" });

    await expect(receive).rejects.toMatchObject({ name: "AbortError" });
    expect(runtime.getStatus()).toBe(SESSION_STATUS.STOPPED);
    expect(
      store.events.filter(({ eventType }) => eventType === "session_stopped")
    ).toHaveLength(1);
    expect(store.events.some(({ eventType }) => eventType === "error")).toBe(
      false
    );
  });

  it.each(["", "   ", "\n\t"])("rejects empty input %j", async (content) => {
    const { runtime } = createRuntime();
    await expect(runtime.receive(content)).rejects.toThrow(
      "User message cannot be empty"
    );
  });
});
