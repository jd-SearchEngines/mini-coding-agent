import type { ToolErrorCode } from "../types/tool-result.js";

/** Expected tool failure that is safe to return as a ToolResult. */
export class ToolExecutionError extends Error {
  readonly code: ToolErrorCode;

  constructor(code: ToolErrorCode, message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "ToolExecutionError";
    this.code = code;
  }
}
