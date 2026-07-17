import { TOOL_ERROR_CODE, type ToolResult } from "../types/tool-result.js";
import type { ToolUseRequest } from "../types/tool-use.js";
import type { ToolContext } from "./tool-context.js";
import { ToolExecutionError } from "./tool-error.js";
import type { ToolRegistry } from "./tool-registry.js";

/** Validates and executes registered tools without tool-specific branches. */
export class ToolExecutor {
  readonly #registry: ToolRegistry;

  constructor(registry: ToolRegistry) {
    this.#registry = registry;
  }

  async execute(
    toolUse: ToolUseRequest,
    context: ToolContext
  ): Promise<ToolResult> {
    console.log(`[ToolExecutor] received tool_use: ${toolUse.name}`);
    const tool = this.#registry.get(toolUse.name);
    if (tool === undefined) {
      return failure(
        toolUse,
        TOOL_ERROR_CODE.UNKNOWN_TOOL,
        `Unknown tool: ${toolUse.name}`
      );
    }

    console.log("[ToolExecutor] validating tool input");
    let validatedInput: unknown;
    try {
      validatedInput = tool.validateInput(toolUse.input);
    } catch (error) {
      return failure(
        toolUse,
        TOOL_ERROR_CODE.INVALID_INPUT,
        error instanceof Error ? error.message : "Invalid tool input"
      );
    }

    throwIfAborted(context.signal);
    console.log(`[ToolExecutor] executing tool: ${toolUse.name}`);
    try {
      const content = await tool.execute(validatedInput, context);
      throwIfAborted(context.signal);
      console.log(`[ToolExecutor] tool completed: ${toolUse.name}`);
      return {
        toolUseId: toolUse.id,
        toolName: toolUse.name,
        ok: true,
        content
      };
    } catch (error) {
      if (isAbortError(error)) throw error;
      if (error instanceof ToolExecutionError) {
        return failure(toolUse, error.code, error.message);
      }
      throw error;
    }
  }
}

function failure(
  toolUse: ToolUseRequest,
  errorCode: ToolResult["errorCode"],
  content: string
): ToolResult {
  return {
    toolUseId: toolUse.id,
    toolName: toolUse.name,
    ok: false,
    content,
    ...(errorCode === undefined ? {} : { errorCode })
  };
}

export function throwIfAborted(signal: AbortSignal | undefined): void {
  if (signal?.aborted === true) {
    const error = new Error("Operation was aborted");
    error.name = "AbortError";
    throw error;
  }
}

export function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === "AbortError";
}
