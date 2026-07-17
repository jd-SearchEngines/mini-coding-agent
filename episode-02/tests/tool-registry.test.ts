import { describe, expect, it } from "vitest";
import { ReadTool, ToolRegistry } from "../src/index.js";

describe("ToolRegistry", () => {
  it("registers and gets ReadTool by its unique name", () => {
    const registry = new ToolRegistry();
    const tool = new ReadTool();
    registry.register(tool);
    expect(registry.has("read_file")).toBe(true);
    expect(registry.get("read_file")).toBe(tool);
    expect(registry.get("missing")).toBeUndefined();
  });

  it("rejects duplicate names", () => {
    const registry = new ToolRegistry();
    registry.register(new ReadTool());
    expect(() => registry.register(new ReadTool())).toThrow(
      "Tool already registered: read_file"
    );
  });

  it("only exposes model-visible definitions", () => {
    const registry = new ToolRegistry();
    registry.register(new ReadTool());
    const definition = registry.listDefinitions()[0];
    expect(definition).toMatchObject({ name: "read_file" });
    expect(definition).not.toHaveProperty("execute");
    expect(definition).not.toHaveProperty("isReadOnly");
  });
});
