import type { Message } from "../types/message.js";
import type { ModelResponse } from "../types/model-response.js";
import type { ToolDefinition } from "../tools/tool.js";

export interface ModelGenerateOptions {
  readonly messages: readonly Message[];
  readonly tools: readonly ToolDefinition[];
}

/** Provider-independent model boundary used by AgentLoop. */
export interface ModelClient {
  generate(options: ModelGenerateOptions): Promise<ModelResponse>;
}
