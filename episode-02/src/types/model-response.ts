import type { ToolUseRequest } from "./tool-use.js";

/** Provider-independent model response for a final answer or one tool request. */
export type ModelResponse =
  | { readonly type: "final"; readonly content: string }
  | {
      readonly type: "tool_use";
      readonly toolUse: ToolUseRequest;
      readonly content?: string;
    };
