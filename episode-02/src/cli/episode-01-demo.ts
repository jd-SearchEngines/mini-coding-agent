import path from "node:path";
import { AgentLoop } from "../agent/agent-loop.js";
import { ScriptedModelClient } from "../model/scripted-model-client.js";
import { SessionRuntime } from "../runtime/session-runtime.js";
import { JsonlTranscriptStore } from "../transcript/jsonl-transcript-store.js";
import { ToolExecutor } from "../tools/tool-executor.js";
import { ToolRegistry } from "../tools/tool-registry.js";

async function demo(): Promise<void> {
  const workspaceRoot = path.resolve(".");
  const registry = new ToolRegistry();
  const runtime = new SessionRuntime({
    workspaceRoot,
    transcriptStore: new JsonlTranscriptStore(
      path.join(workspaceRoot, "transcripts")
    ),
    agentLoop: new AgentLoop({
      modelClient: new ScriptedModelClient([
        {
          type: "final",
          content: "Episode 01 只展示模型回复与 SessionRuntime 生命周期。"
        }
      ]),
      toolExecutor: new ToolExecutor(registry),
      toolDefinitions: []
    })
  });
  const responses = await runtime.receive("Agent 怎么连续思考？");
  console.log(responses[0]?.content);
}

demo().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
