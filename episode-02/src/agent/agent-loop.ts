import { buildMessagesForQuery } from "../context/build-messages-for-query.js";
import type { ModelClient } from "../model/model-client.js";
import type { Message, TextMessage } from "../types/message.js";
import type { ToolResult } from "../types/tool-result.js";
import type { ToolUseRequest } from "../types/tool-use.js";
import type { ToolContext } from "../tools/tool-context.js";
import type { ToolExecutor } from "../tools/tool-executor.js";
import { throwIfAborted } from "../tools/tool-executor.js";
import type { ToolDefinition } from "../tools/tool.js";

/** Dependencies and safety limits used to construct an AgentLoop. */
export interface AgentLoopOptions {
  readonly modelClient: ModelClient;
  readonly toolExecutor: ToolExecutor;
  readonly toolDefinitions: readonly ToolDefinition[];
  readonly maxIterations?: number;
  readonly messageBuilder?: (messages: readonly Message[]) => Message[];
}

/** Per-turn inputs and persistence callbacks supplied by SessionRuntime. */
export interface AgentLoopRunOptions {
  readonly messages: readonly Message[];
  readonly toolContext: ToolContext;
  readonly signal?: AbortSignal;
  readonly onToolUse: (toolUse: ToolUseRequest) => void | Promise<void>;
  readonly onToolResult: (result: ToolResult) => void | Promise<void>;
  readonly onFinalAnswer: (content: string) => void | Promise<void>;
}

/** Drives one model-tool-observation loop, not the complete session lifecycle. */
export class AgentLoop {
  readonly #modelClient: ModelClient;
  readonly #toolExecutor: ToolExecutor;
  readonly #toolDefinitions: readonly ToolDefinition[];
  readonly #maxIterations: number;
  readonly #messageBuilder: NonNullable<AgentLoopOptions["messageBuilder"]>;

  constructor(options: AgentLoopOptions) {
    this.#modelClient = options.modelClient;
    this.#toolExecutor = options.toolExecutor;
    this.#toolDefinitions = structuredClone(options.toolDefinitions);
    this.#maxIterations = options.maxIterations ?? 10;
    this.#messageBuilder = options.messageBuilder ?? buildMessagesForQuery;
    if (!Number.isInteger(this.#maxIterations) || this.#maxIterations < 1) {
      throw new Error("maxIterations must be a positive integer");
    }
  }

  async run(options: AgentLoopRunOptions): Promise<void> {
    for (let iteration = 0; iteration < this.#maxIterations; iteration += 1) {
      throwIfAborted(options.signal);
      console.log("[AgentLoop] building messagesForQuery");
      const messagesForQuery = this.#messageBuilder(options.messages);
      console.log("[AgentLoop] messagesForQuery ready");
      const response = await this.#modelClient.generate({
        messages: messagesForQuery,
        tools: this.#toolDefinitions
      });
      throwIfAborted(options.signal);

      if (response.type === "final") {
        console.log("[AgentLoop] final answer received");
        await options.onFinalAnswer(response.content);
        console.log("[AgentLoop] finished");
        return;
      }

      console.log(`[AgentLoop] model requested tool: ${response.toolUse.name}`);
      await options.onToolUse(response.toolUse);
      const result = await this.#toolExecutor.execute(response.toolUse, {
        ...options.toolContext,
        ...(options.signal === undefined ? {} : { signal: options.signal })
      });
      await options.onToolResult(result);
      console.log("[AgentLoop] tool_result appended");
    }

    throw new Error(
      `AgentLoop exceeded maxIterations (${this.#maxIterations}) without a final answer`
    );
  }
}

/** Type guard useful to CLI consumers selecting final text messages. */
export function isAssistantTextMessage(
  message: Message
): message is TextMessage {
  return message.kind === "text" && message.role === "assistant";
}
