import path from "node:path";
import { createEpisode02Runtime } from "./runtime-factory.js";

async function demo(): Promise<void> {
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
  const question =
    "请读取 examples/login/auth.ts，并分析登录后 Token 立刻过期的原因。";
  console.log(`User:\n${question}\n`);
  const responses = await runtime.receive(question);
  for (const response of responses) {
    console.log(`\nAssistant:\n${response.content}\n`);
  }
  console.log(
    `Transcript: ${path.join(workspaceRoot, "transcripts", `${runtime.getSessionId()}.jsonl`)}`
  );
}

demo().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
