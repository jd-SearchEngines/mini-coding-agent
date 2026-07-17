import type { ToolContext } from "./tool-context.js";

/** Model-visible metadata for one registered tool. */
export interface ToolDefinition {
  readonly name: string;
  readonly description: string;
  readonly inputSchema: Readonly<Record<string, unknown>>;
}

/** Contract implemented by an executable Agent tool. */
export interface Tool<TInput = unknown> extends ToolDefinition {
  readonly isReadOnly: boolean;
  validateInput(input: unknown): TInput;
  execute(input: TInput, context: ToolContext): Promise<string>;
}
