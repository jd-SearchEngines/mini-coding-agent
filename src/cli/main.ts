import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { AgentLoop } from "../agent/agent-loop.js";
import { MockModelClient } from "../model/mock-model-client.js";
import { SessionRuntime } from "../runtime/session-runtime.js";
import { JsonlTranscriptStore } from "../transcript/jsonl-transcript-store.js";

async function main(): Promise<void> {
  console.log("Mini Coding Agent - Episode 01");
  console.log('Type a message, or type "exit" to quit.\n');

  const runtime = new SessionRuntime({
    agentLoop: new AgentLoop({ modelClient: new MockModelClient() }),
    transcriptStore: new JsonlTranscriptStore()
  });
  await runtime.ready();
  const readline = createInterface({ input, output });
  readline.setPrompt("You: ");

  try {
    readline.prompt();
    for await (const content of readline) {
      if (content.trim().toLowerCase() === "exit") {
        break;
      }

      try {
        const responses = await runtime.receive(content);
        for (const response of responses) {
          console.log(`\nAssistant:\n${response.content}\n`);
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error(`\nError: ${message}\n`);
      }
      readline.prompt();
    }
  } finally {
    readline.close();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
