import type { Tool, ToolDefinition } from "./tool.js";

/** Registers the only actions a model is allowed to request. */
export class ToolRegistry {
  readonly #tools = new Map<string, Tool>();

  register(tool: Tool): void {
    if (this.#tools.has(tool.name)) {
      throw new Error(`Tool already registered: ${tool.name}`);
    }
    this.#tools.set(tool.name, tool);
  }

  get(name: string): Tool | undefined {
    return this.#tools.get(name);
  }

  has(name: string): boolean {
    return this.#tools.has(name);
  }

  listDefinitions(): ToolDefinition[] {
    return [...this.#tools.values()].map(
      ({ name, description, inputSchema }) => ({
        name,
        description,
        inputSchema: structuredClone(inputSchema)
      })
    );
  }
}
