/** Stable error codes visible to the model and tests. */
export const TOOL_ERROR_CODE = {
  UNKNOWN_TOOL: "UNKNOWN_TOOL",
  INVALID_INPUT: "INVALID_INPUT",
  PATH_OUTSIDE_WORKSPACE: "PATH_OUTSIDE_WORKSPACE",
  FILE_NOT_FOUND: "FILE_NOT_FOUND",
  NOT_A_FILE: "NOT_A_FILE",
  FILE_TOO_LARGE: "FILE_TOO_LARGE",
  FILE_NOT_READABLE: "FILE_NOT_READABLE"
} as const;

export type ToolErrorCode =
  (typeof TOOL_ERROR_CODE)[keyof typeof TOOL_ERROR_CODE];

/** A successful or expected-failure observation linked to one tool request. */
export interface ToolResult {
  readonly toolUseId: string;
  readonly toolName: string;
  readonly ok: boolean;
  readonly content: string;
  readonly errorCode?: ToolErrorCode;
}
