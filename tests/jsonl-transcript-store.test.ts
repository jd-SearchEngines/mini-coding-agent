import { readFile, mkdtemp } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { rm } from "node:fs/promises";
import { JsonlTranscriptStore } from "../src/index.js";
import type { TranscriptEvent } from "../src/index.js";

const temporaryDirectories: string[] = [];

async function temporaryDirectory(): Promise<string> {
  const directory = await mkdtemp(path.join(os.tmpdir(), "mini-agent-"));
  temporaryDirectories.push(directory);
  return path.join(directory, "nested", "transcripts");
}

function event(sessionId: string, eventId: string): TranscriptEvent {
  return {
    eventId,
    sessionId,
    eventType: "message",
    timestamp: "2026-01-01T00:00:00.000Z",
    role: "user",
    content: eventId
  };
}

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { recursive: true, force: true }))
  );
});

describe("JsonlTranscriptStore", () => {
  it("creates the directory and appends valid JSONL records", async () => {
    const directory = await temporaryDirectory();
    const store = new JsonlTranscriptStore(directory);
    await store.append(event("session-a", "one"));
    await store.append(event("session-a", "two"));

    const contents = await readFile(
      path.join(directory, "session-a.jsonl"),
      "utf8"
    );
    const lines = contents.trim().split("\n");
    expect(lines).toHaveLength(2);
    expect(lines.map((line) => JSON.parse(line) as unknown)).toEqual([
      event("session-a", "one"),
      event("session-a", "two")
    ]);
  });

  it("loads all events for a session", async () => {
    const store = new JsonlTranscriptStore(await temporaryDirectory());
    await store.append(event("session-a", "one"));
    await store.append(event("session-a", "two"));
    expect(await store.load("session-a")).toEqual([
      event("session-a", "one"),
      event("session-a", "two")
    ]);
  });

  it("writes different sessions to different files", async () => {
    const directory = await temporaryDirectory();
    const store = new JsonlTranscriptStore(directory);
    await Promise.all([
      store.append(event("session-a", "one")),
      store.append(event("session-b", "two"))
    ]);

    expect(await store.load("session-a")).toEqual([event("session-a", "one")]);
    expect(await store.load("session-b")).toEqual([event("session-b", "two")]);
  });
});
