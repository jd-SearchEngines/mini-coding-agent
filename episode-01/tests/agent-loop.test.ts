import { describe, expect, it, vi } from "vitest";
import { AgentLoop } from "../src/index.js";
import type { Message, ModelClient, ModelResponse } from "../src/index.js";
import { deferred } from "./helpers.js";

const userMessage: Message = {
  id: "message",
  sessionId: "session",
  role: "user",
  content: "hello",
  createdAt: "2026-01-01T00:00:00.000Z"
};

describe("AgentLoop", () => {
  it("builds query messages, calls the model and reports a stop response", async () => {
    const builder = vi.fn(() => [userMessage]);
    const generate = vi.fn(async (): Promise<ModelResponse> => ({
      content: "done",
      finishReason: "stop"
    }));
    const onAssistantMessage = vi.fn();
    const loop = new AgentLoop({
      modelClient: { generate },
      messageBuilder: builder
    });

    await loop.run({ messages: [userMessage], onAssistantMessage });

    expect(builder).toHaveBeenCalledOnce();
    expect(generate).toHaveBeenCalledWith([userMessage]);
    expect(onAssistantMessage).toHaveBeenCalledWith({
      content: "done",
      finishReason: "stop"
    });
  });

  it("continues until finishReason is stop", async () => {
    const responses: ModelResponse[] = [
      { content: "again", finishReason: "continue" },
      { content: "done", finishReason: "stop" }
    ];
    const generate = vi.fn(async () => {
      const response = responses.shift();
      if (response === undefined) throw new Error("No response configured");
      return response;
    });
    const onAssistantMessage = vi.fn();

    await new AgentLoop({ modelClient: { generate } }).run({
      messages: [userMessage],
      onAssistantMessage
    });

    expect(generate).toHaveBeenCalledTimes(2);
    expect(onAssistantMessage).toHaveBeenCalledTimes(2);
  });

  it("throws a clear error after maxIterations", async () => {
    const modelClient: ModelClient = {
      generate: async () => ({ content: "again", finishReason: "continue" })
    };
    const loop = new AgentLoop({ modelClient, maxIterations: 2 });

    await expect(
      loop.run({ messages: [userMessage], onAssistantMessage: () => undefined })
    ).rejects.toThrow("exceeded maxIterations (2)");
  });

  it("stops when AbortSignal is already aborted", async () => {
    const controller = new AbortController();
    controller.abort();
    const generate = vi.fn();

    await expect(
      new AgentLoop({ modelClient: { generate } }).run({
        messages: [userMessage],
        signal: controller.signal,
        onAssistantMessage: () => undefined
      })
    ).rejects.toMatchObject({ name: "AbortError" });
    expect(generate).not.toHaveBeenCalled();
  });

  it("observes an abort that occurs during model generation", async () => {
    const pending = deferred<ModelResponse>();
    const controller = new AbortController();
    const run = new AgentLoop({
      modelClient: { generate: () => pending.promise }
    }).run({
      messages: [userMessage],
      signal: controller.signal,
      onAssistantMessage: () => undefined
    });

    controller.abort();
    pending.resolve({ content: "late", finishReason: "stop" });

    await expect(run).rejects.toMatchObject({ name: "AbortError" });
  });
});
