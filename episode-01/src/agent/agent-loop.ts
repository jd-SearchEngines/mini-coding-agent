import {
  buildMessagesForQuery,
  DEFAULT_RECENT_MESSAGE_LIMIT
} from "../context/build-messages-for-query.js";
import type { ModelClient } from "../model/model-client.js";
import type { Message } from "../types/message.js";
import type { ModelResponse } from "../types/model-response.js";

/** Dependencies and safety limits used to construct an AgentLoop. */
export interface AgentLoopOptions {
  readonly modelClient: ModelClient;
  readonly maxIterations?: number;
  readonly recentMessageLimit?: number;
  readonly messageBuilder?: (
    messages: readonly Message[],
    recentMessageLimit: number
  ) => Message[];
}

/** Per-turn inputs supplied by SessionRuntime. */
export interface AgentLoopRunOptions {
  readonly messages: readonly Message[];
  readonly signal?: AbortSignal;
  readonly onAssistantMessage: (
    response: ModelResponse
  ) => void | Promise<void>;
}

/** Runs model iterations for one user turn, not the session lifecycle. */
export class AgentLoop {
  readonly #modelClient: ModelClient;
  readonly #maxIterations: number;
  readonly #recentMessageLimit: number;
  readonly #messageBuilder: NonNullable<AgentLoopOptions["messageBuilder"]>;

  constructor(options: AgentLoopOptions) {
    this.#modelClient = options.modelClient;
    this.#maxIterations = options.maxIterations ?? 10;
    this.#recentMessageLimit =
      options.recentMessageLimit ?? DEFAULT_RECENT_MESSAGE_LIMIT;
    this.#messageBuilder = options.messageBuilder ?? buildMessagesForQuery;

    if (!Number.isInteger(this.#maxIterations) || this.#maxIterations < 1) {
      throw new Error("maxIterations must be a positive integer");
    }
  }

  async run(options: AgentLoopRunOptions): Promise<void> {
    for (let iteration = 0; iteration < this.#maxIterations; iteration += 1) {
      throwIfAborted(options.signal);
      console.log("[AgentLoop] building messagesForQuery");
      const messagesForQuery = this.#messageBuilder(
        options.messages,
        this.#recentMessageLimit
      );
      console.log("[AgentLoop] messagesForQuery ready");

      throwIfAborted(options.signal);
      const response = await this.#modelClient.generate(messagesForQuery);
      throwIfAborted(options.signal);
      console.log("[AgentLoop] model response received");
      await options.onAssistantMessage(response);

      if (response.finishReason === "stop") {
        console.log("[AgentLoop] finished");
        return;
      }
    }

    throw new Error(
      `AgentLoop exceeded maxIterations (${this.#maxIterations}) without stopping`
    );
  }
}

function throwIfAborted(signal: AbortSignal | undefined): void {
  if (signal?.aborted === true) {
    const error = new Error("AgentLoop was aborted");
    error.name = "AbortError";
    throw error;
  }
}
