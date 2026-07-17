import { randomUUID } from "node:crypto";
import type { AgentLoop } from "../agent/agent-loop.js";
import type {
  AssistantToolUseMessage,
  Message,
  TextMessage,
  TextMessageRole,
  ToolResultMessage
} from "../types/message.js";
import { SESSION_STATUS, type SessionStatus } from "../types/session-status.js";
import type { ToolResult } from "../types/tool-result.js";
import type { ToolUseRequest } from "../types/tool-use.js";
import { isAbortError } from "../tools/tool-executor.js";
import type {
  TranscriptEvent,
  TranscriptEventType,
  TranscriptStore
} from "../transcript/transcript-store.js";

/** Dependencies and explicit workspace used to create a SessionRuntime. */
export interface SessionRuntimeOptions {
  readonly sessionId?: string;
  readonly agentLoop: AgentLoop;
  readonly transcriptStore: TranscriptStore;
  readonly workspaceRoot: string;
  readonly systemPrompt?: string;
}

/** Owns one complete session: messages, status, persistence and cancellation. */
export class SessionRuntime {
  readonly #sessionId: string;
  readonly #agentLoop: AgentLoop;
  readonly #transcriptStore: TranscriptStore;
  readonly #workspaceRoot: string;
  readonly #messages: Message[] = [];
  readonly #initialization: Promise<void>;
  #status: SessionStatus = SESSION_STATUS.IDLE;
  #abortController: AbortController | undefined;

  constructor(options: SessionRuntimeOptions) {
    this.#sessionId = options.sessionId ?? randomUUID();
    this.#agentLoop = options.agentLoop;
    this.#transcriptStore = options.transcriptStore;
    this.#workspaceRoot = options.workspaceRoot;
    this.#initialization = this.#initialize(options.systemPrompt);
  }

  async ready(): Promise<void> {
    await this.#initialization;
  }

  /** Saves a user message, runs the tool loop and returns new assistant text. */
  async receive(content: string): Promise<readonly TextMessage[]> {
    await this.ready();
    if (content.trim().length === 0) {
      throw new Error("User message cannot be empty");
    }
    if (this.#status === SESSION_STATUS.RUNNING) {
      throw new Error("SessionRuntime is already running");
    }
    if (this.#status !== SESSION_STATUS.IDLE) {
      throw new Error(
        `Cannot receive a message while session is ${this.#status}`
      );
    }

    console.log("[SessionRuntime] message received");
    const userMessage = this.#createTextMessage("user", content.trim());
    this.#messages.push(userMessage);
    await this.#persistTextMessage(userMessage);
    console.log("[Transcript] user message persisted");
    await this.#transitionTo(SESSION_STATUS.RUNNING);

    const controller = new AbortController();
    this.#abortController = controller;
    const assistantMessages: TextMessage[] = [];

    try {
      await this.#agentLoop.run({
        messages: this.#messages,
        signal: controller.signal,
        toolContext: { workspaceRoot: this.#workspaceRoot },
        onToolUse: async (toolUse) => this.#appendToolUse(toolUse),
        onToolResult: async (result) => this.#appendToolResult(result),
        onFinalAnswer: async (answer) => {
          const message = this.#createTextMessage("assistant", answer);
          this.#messages.push(message);
          assistantMessages.push(message);
          await this.#persistTextMessage(message);
          console.log("[Transcript] assistant message persisted");
        }
      });
      if (this.getStatus() === SESSION_STATUS.RUNNING) {
        await this.#transitionTo(SESSION_STATUS.IDLE);
      }
      return assistantMessages.map((message) => structuredClone(message));
    } catch (error) {
      if (this.getStatus() !== SESSION_STATUS.STOPPED) {
        if (isAbortError(error)) {
          await this.#transitionTo(SESSION_STATUS.STOPPED);
        } else {
          await this.#appendEvent("error", {
            content: error instanceof Error ? error.message : String(error)
          });
          await this.#transitionTo(SESSION_STATUS.FAILED);
        }
      }
      throw error;
    } finally {
      if (this.#abortController === controller) {
        this.#abortController = undefined;
      }
    }
  }

  /** Aborts the active turn. Repeated calls are safe. */
  async stop(): Promise<void> {
    await this.ready();
    if (this.#status === SESSION_STATUS.STOPPED) return;
    this.#abortController?.abort();
    await this.#transitionTo(SESSION_STATUS.STOPPED);
    await this.#appendEvent("session_stopped", {
      status: SESSION_STATUS.STOPPED
    });
  }

  getSessionId(): string {
    return this.#sessionId;
  }

  getStatus(): SessionStatus {
    return this.#status;
  }

  getMessages(): readonly Message[] {
    return this.#messages.map((message) => structuredClone(message));
  }

  async #initialize(systemPrompt: string | undefined): Promise<void> {
    console.log(`[SessionRuntime] session created: ${this.#sessionId}`);
    await this.#appendEvent("session_created", { status: SESSION_STATUS.IDLE });
    if (systemPrompt !== undefined && systemPrompt.trim().length > 0) {
      const message = this.#createTextMessage("system", systemPrompt.trim());
      this.#messages.push(message);
      await this.#persistTextMessage(message);
    }
  }

  #createTextMessage(role: TextMessageRole, content: string): TextMessage {
    return Object.freeze({
      kind: "text",
      id: randomUUID(),
      sessionId: this.#sessionId,
      role,
      content,
      createdAt: new Date().toISOString()
    });
  }

  async #appendToolUse(toolUse: ToolUseRequest): Promise<void> {
    const message: AssistantToolUseMessage = Object.freeze({
      kind: "tool_use",
      id: randomUUID(),
      sessionId: this.#sessionId,
      role: "assistant",
      toolUse: structuredClone(toolUse),
      createdAt: new Date().toISOString()
    });
    this.#messages.push(message);
    await this.#appendEvent("tool_use", {
      toolUseId: toolUse.id,
      toolName: toolUse.name,
      input: structuredClone(toolUse.input)
    });
    console.log("[Transcript] tool_use persisted");
  }

  async #appendToolResult(result: ToolResult): Promise<void> {
    const message: ToolResultMessage = Object.freeze({
      kind: "tool_result",
      id: randomUUID(),
      sessionId: this.#sessionId,
      role: "tool",
      result: structuredClone(result),
      createdAt: new Date().toISOString()
    });
    this.#messages.push(message);
    await this.#appendEvent("tool_result", {
      toolUseId: result.toolUseId,
      toolName: result.toolName,
      ok: result.ok,
      content: result.content,
      ...(result.errorCode === undefined ? {} : { errorCode: result.errorCode })
    });
    console.log("[Transcript] tool_result persisted");
  }

  async #persistTextMessage(message: TextMessage): Promise<void> {
    await this.#appendEvent("text_message", {
      role: message.role,
      content: message.content
    });
  }

  async #transitionTo(status: SessionStatus): Promise<void> {
    const previousStatus = this.#status;
    this.#status = status;
    console.log(`[SessionRuntime] status: ${previousStatus} -> ${status}`);
    await this.#appendEvent("status_change", { status });
  }

  async #appendEvent(
    eventType: TranscriptEventType,
    details: Omit<
      Partial<TranscriptEvent>,
      "eventId" | "sessionId" | "eventType" | "timestamp"
    >
  ): Promise<void> {
    await this.#transcriptStore.append({
      eventId: randomUUID(),
      sessionId: this.#sessionId,
      eventType,
      timestamp: new Date().toISOString(),
      ...details
    });
  }
}
