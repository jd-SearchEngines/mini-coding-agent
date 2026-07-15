import type { Message } from "../types/message.js";
import type { ModelResponse } from "../types/model-response.js";

/** Provider-independent model boundary used by AgentLoop. */
export interface ModelClient {
  generate(messagesForQuery: readonly Message[]): Promise<ModelResponse>;
}
