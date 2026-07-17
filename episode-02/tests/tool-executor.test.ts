import { describe, expect, it, vi } from "vitest";
import {
  TOOL_ERROR_CODE,
  ToolExecutionError,
  ToolExecutor,
  ToolRegistry
} from "../src/index.js";
import type { Tool } from "../src/index.js";

function testTool(overrides: Partial<Tool<string>> = {}): Tool<string> {
  return {
    name: "echo",
    description: "Echo input",
    inputSchema: {},
    isReadOnly: true,
    validateInput(input) {
      if (typeof input !== "string") throw new Error("input must be a string");
      return input;
    },
    async execute(input) {
      return input;
    },
    ...overrides
  };
}

describe("ToolExecutor", () => {
  it("returns a linked failure for unknown tools", async () => {
    const executor = new ToolExecutor(new ToolRegistry());
    await expect(
      executor.execute(
        { id: "use-1", name: "missing", input: {} },
        { workspaceRoot: "." }
      )
    ).resolves.toEqual({
      toolUseId: "use-1",
      toolName: "missing",
      ok: false,
      content: "Unknown tool: missing",
      errorCode: TOOL_ERROR_CODE.UNKNOWN_TOOL
    });
  });

  it("wraps validation errors without executing", async () => {
    const execute = vi.fn();
    const registry = new ToolRegistry();
    registry.register(testTool({ execute }));
    const result = await new ToolExecutor(registry).execute(
      { id: "use-2", name: "echo", input: 42 },
      { workspaceRoot: "." }
    );
    expect(result.errorCode).toBe(TOOL_ERROR_CODE.INVALID_INPUT);
    expect(execute).not.toHaveBeenCalled();
  });

  it("executes any registered tool without a ReadTool special case", async () => {
    const registry = new ToolRegistry();
    registry.register(testTool());
    await expect(
      new ToolExecutor(registry).execute(
        { id: "use-3", name: "echo", input: "hello" },
        { workspaceRoot: "." }
      )
    ).resolves.toEqual({
      toolUseId: "use-3",
      toolName: "echo",
      ok: true,
      content: "hello"
    });
  });

  it("wraps expected execution errors but rethrows programming errors", async () => {
    const expectedRegistry = new ToolRegistry();
    expectedRegistry.register(
      testTool({
        execute: async () => {
          throw new ToolExecutionError(
            TOOL_ERROR_CODE.FILE_NOT_FOUND,
            "not found"
          );
        }
      })
    );
    expect(
      (
        await new ToolExecutor(expectedRegistry).execute(
          { id: "use-4", name: "echo", input: "x" },
          { workspaceRoot: "." }
        )
      ).errorCode
    ).toBe(TOOL_ERROR_CODE.FILE_NOT_FOUND);

    const brokenRegistry = new ToolRegistry();
    brokenRegistry.register(
      testTool({ execute: async () => Promise.reject(new TypeError("bug")) })
    );
    await expect(
      new ToolExecutor(brokenRegistry).execute(
        { id: "use-5", name: "echo", input: "x" },
        { workspaceRoot: "." }
      )
    ).rejects.toThrow("bug");
  });

  it("honors AbortSignal before execution", async () => {
    const registry = new ToolRegistry();
    const execute = vi.fn();
    registry.register(testTool({ execute }));
    const controller = new AbortController();
    controller.abort();
    await expect(
      new ToolExecutor(registry).execute(
        { id: "use-6", name: "echo", input: "x" },
        { workspaceRoot: ".", signal: controller.signal }
      )
    ).rejects.toMatchObject({ name: "AbortError" });
    expect(execute).not.toHaveBeenCalled();
  });
});
