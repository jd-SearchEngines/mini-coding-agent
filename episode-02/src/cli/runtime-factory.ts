import path from "node:path";
import { AgentLoop } from "../agent/agent-loop.js";
import { MockModelClient } from "../model/mock-model-client.js";
import { SessionRuntime } from "../runtime/session-runtime.js";
import { JsonlTranscriptStore } from "../transcript/jsonl-transcript-store.js";
import { ReadTool } from "../tools/read-tool.js";
import { ToolExecutor } from "../tools/tool-executor.js";
import { ToolRegistry } from "../tools/tool-registry.js";

/** Wires the concrete Episode 02 demo dependencies at the composition root. */
export function createEpisode02Runtime(workspaceRoot: string): {
  runtime: SessionRuntime;
  registry: ToolRegistry;
} {
  const registry = new ToolRegistry();
  registry.register(new ReadTool());
  const agentLoop = new AgentLoop({
    modelClient: new MockModelClient(),
    toolExecutor: new ToolExecutor(registry),
    toolDefinitions: registry.listDefinitions()
  });
  return {
    registry,
    runtime: new SessionRuntime({
      agentLoop,
      transcriptStore: new JsonlTranscriptStore(
        path.join(workspaceRoot, "transcripts")
      ),
      workspaceRoot
    })
  };
}
