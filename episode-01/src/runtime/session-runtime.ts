import { randomUUID } from "node:crypto";
import type { AgentLoop } from "../agent/agent-loop.js";
import type { Message, MessageRole } from "../types/message.js";
import { SESSION_STATUS, type SessionStatus } from "../types/session-status.js";
import type {
  TranscriptEvent,
  TranscriptEventType,
  TranscriptStore
} from "../transcript/transcript-store.js";

/** Dependencies and optional identity used to create a SessionRuntime. */
export interface SessionRuntimeOptions {
  readonly sessionId?: string;
  readonly agentLoop: AgentLoop;
  readonly transcriptStore: TranscriptStore;
  readonly systemPrompt?: string;
}

/** Owns one complete session: messages, status, persistence and cancellation. */
export class SessionRuntime {
  readonly #sessionId: string;
  readonly #agentLoop: AgentLoop;
  readonly #transcriptStore: TranscriptStore;
  readonly #messages: Message[] = [];
  readonly #initialization: Promise<void>;
  #status: SessionStatus = SESSION_STATUS.IDLE;
  #abortController: AbortController | undefined;

  constructor(options: SessionRuntimeOptions) {
    this.#sessionId = options.sessionId ?? randomUUID();
    this.#agentLoop = options.agentLoop;
    this.#transcriptStore = options.transcriptStore;
    this.#initialization = this.#initialize(options.systemPrompt);
  }

  /** Waits until session_created and the optional system message are persisted. */
  async ready(): Promise<void> {
    await this.#initialization;
  }

  /** Accepts one user message and runs one complete agent turn. */
  async receive(content: string): Promise<readonly Message[]> {
    await this.ready();
    if (content.trim().length === 0) {
      throw new Error("User message cannot be empty");
    }
    if (this.#status === SESSION_STATUS.RUNNING) {
      throw new Error("SessionRuntime is already running");
    }
    if (
      this.#status === SESSION_STATUS.STOPPED ||
      this.#status === SESSION_STATUS.FAILED ||
      this.#status === SESSION_STATUS.COMPLETED
    ) {
      throw new Error(
        `Cannot receive a message while session is ${this.#status}`
      );
    }

    console.log("[SessionRuntime] message received");
    const userMessage = this.#createMessage("user", content.trim());
    this.#messages.push(userMessage);
    await this.#persistMessage(userMessage);
    console.log("[Transcript] user message persisted");

    await this.#transitionTo(SESSION_STATUS.RUNNING);
    const controller = new AbortController();
    this.#abortController = controller;
    const assistantMessages: Message[] = [];

    try {
      await this.#agentLoop.run({
        messages: this.#messages,
        signal: controller.signal,
        onAssistantMessage: async (response) => {
          const message = this.#createMessage("assistant", response.content);
          this.#messages.push(message);
          assistantMessages.push(message);
          await this.#persistMessage(message);
          console.log("[Transcript] assistant message persisted");
        }
      });

      if (this.getStatus() === SESSION_STATUS.RUNNING) {
        await this.#transitionTo(SESSION_STATUS.IDLE);
      }
      return assistantMessages.map((message) => ({ ...message }));
    } catch (error) {
      if (this.getStatus() !== SESSION_STATUS.STOPPED) {
        await this.#appendEvent("error", {
          content: error instanceof Error ? error.message : String(error)
        });
        await this.#transitionTo(SESSION_STATUS.FAILED);
      }
      throw error;
    } finally {
      if (this.#abortController === controller) {
        this.#abortController = undefined;
      }
    }
  }

  /** Stops the active turn. Repeated calls are safe. */
  async stop(): Promise<void> {
    await this.ready();
    if (this.#status === SESSION_STATUS.STOPPED) {
      return;
    }

    this.#abortController?.abort();
    const previousStatus = this.#status;
    this.#status = SESSION_STATUS.STOPPED;
    console.log(
      `[SessionRuntime] status: ${previousStatus} -> ${SESSION_STATUS.STOPPED}`
    );
    await this.#appendEvent("status_change", {
      status: SESSION_STATUS.STOPPED
    });
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
    return this.#messages.map((message) => ({ ...message }));
  }

  async #initialize(systemPrompt: string | undefined): Promise<void> {
    console.log(`[SessionRuntime] session created: ${this.#sessionId}`);
    await this.#appendEvent("session_created", {
      status: SESSION_STATUS.IDLE
    });
    if (systemPrompt !== undefined && systemPrompt.trim().length > 0) {
      const message = this.#createMessage("system", systemPrompt.trim());
      this.#messages.push(message);
      await this.#persistMessage(message);
    }
  }

  #createMessage(role: MessageRole, content: string): Message {
    return Object.freeze({
      id: randomUUID(),
      sessionId: this.#sessionId,
      role,
      content,
      createdAt: new Date().toISOString()
    });
  }

  async #persistMessage(message: Message): Promise<void> {
    await this.#appendEvent("message", {
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
    details: Pick<TranscriptEvent, "role" | "content" | "status">
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
