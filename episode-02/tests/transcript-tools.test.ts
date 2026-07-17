import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { JsonlTranscriptStore } from "../src/index.js";
import type { TranscriptEvent } from "../src/index.js";

const roots: string[] = [];
async function transcriptDirectory(): Promise<string> {
  const root = await mkdtemp(path.join(os.tmpdir(), "transcript-tools-"));
  roots.push(root);
  return path.join(root, "nested");
}

afterEach(async () => {
  await Promise.all(
    roots.splice(0).map((root) => rm(root, { recursive: true, force: true }))
  );
});

function event(
  eventId: string,
  sessionId: string,
  details: Partial<TranscriptEvent>
): TranscriptEvent {
  return {
    eventId,
    sessionId,
    eventType: "tool_use",
    timestamp: "2026-01-01T00:00:00.000Z",
    ...details
  };
}

describe("JsonlTranscriptStore tool events", () => {
  it("appends structured tool events as valid JSONL and loads them", async () => {
    const directory = await transcriptDirectory();
    const store = new JsonlTranscriptStore(directory);
    const toolUse = event("one", "session-a", {
      eventType: "tool_use",
      toolUseId: "use-1",
      toolName: "read_file",
      input: { path: "file.ts" }
    });
    const toolResult = event("two", "session-a", {
      eventType: "tool_result",
      toolUseId: "use-1",
      toolName: "read_file",
      ok: true,
      content: "real code"
    });
    await Promise.all([store.append(toolUse), store.append(toolResult)]);
    expect(await store.load("session-a")).toEqual([toolUse, toolResult]);

    const lines = (
      await readFile(path.join(directory, "session-a.jsonl"), "utf8")
    )
      .trim()
      .split("\n");
    expect(lines).toHaveLength(2);
    expect(lines.map((line) => JSON.parse(line) as unknown)).toEqual([
      toolUse,
      toolResult
    ]);
  });

  it("keeps sessions in separate files", async () => {
    const store = new JsonlTranscriptStore(await transcriptDirectory());
    await store.append(event("one", "session-a", {}));
    await store.append(event("two", "session-b", {}));
    expect(await store.load("session-a")).toHaveLength(1);
    expect(await store.load("session-b")).toHaveLength(1);
  });
});
