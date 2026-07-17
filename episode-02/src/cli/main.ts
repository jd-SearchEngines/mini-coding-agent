import { createInterface } from "node:readline/promises";
import path from "node:path";
import { stdin as input, stdout as output } from "node:process";
import { createEpisode02Runtime } from "./runtime-factory.js";

async function main(): Promise<void> {
  const workspaceRoot = path.resolve(".");
  const { runtime, registry } = createEpisode02Runtime(workspaceRoot);
  console.log("Mini Coding Agent — Episode 02");
  console.log(`Workspace: ${workspaceRoot}`);
  console.log(
    `Available tools: ${registry
      .listDefinitions()
      .map(({ name }) => name)
      .join(", ")}\n`
  );
  await runtime.ready();

  const readline = createInterface({ input, output });
  readline.setPrompt("You: ");
  try {
    readline.prompt();
    for await (const content of readline) {
      if (content.trim().toLowerCase() === "exit") break;
      try {
        const responses = await runtime.receive(content);
        for (const response of responses) {
          console.log(`\nAssistant:\n${response.content}\n`);
        }
      } catch (error) {
        console.error(
          `\nError: ${error instanceof Error ? error.message : String(error)}\n`
        );
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
