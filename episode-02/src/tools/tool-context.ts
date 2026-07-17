/** Explicit environment passed into every tool execution. */
export interface ToolContext {
  readonly workspaceRoot: string;
  readonly signal?: AbortSignal;
}
