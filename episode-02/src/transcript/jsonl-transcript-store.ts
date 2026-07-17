import { mkdir, readFile, appendFile } from "node:fs/promises";
import path from "node:path";
import type { TranscriptEvent, TranscriptStore } from "./transcript-store.js";

/** Append-only JSONL TranscriptStore with one file per session. */
export class JsonlTranscriptStore implements TranscriptStore {
  readonly #directory: string;
  #writeQueue: Promise<void> = Promise.resolve();

  constructor(directory = path.resolve("transcripts")) {
    this.#directory = directory;
  }

  append(event: TranscriptEvent): Promise<void> {
    const operation = this.#writeQueue.then(async () => {
      try {
        await mkdir(this.#directory, { recursive: true });
        await appendFile(
          this.#filePath(event.sessionId),
          `${JSON.stringify(event)}\n`,
          "utf8"
        );
      } catch (error) {
        const reason = error instanceof Error ? error.message : String(error);
        throw new Error(`Failed to append transcript: ${reason}`, {
          cause: error
        });
      }
    });

    this.#writeQueue = operation.catch(() => undefined);
    return operation;
  }

  async load(sessionId: string): Promise<TranscriptEvent[]> {
    await this.#writeQueue;
    let contents: string;
    try {
      contents = await readFile(this.#filePath(sessionId), "utf8");
    } catch (error) {
      if (isNodeError(error) && error.code === "ENOENT") {
        return [];
      }
      const reason = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to load transcript: ${reason}`, { cause: error });
    }

    return contents
      .split("\n")
      .filter((line) => line.length > 0)
      .map((line, index) => {
        try {
          return JSON.parse(line) as TranscriptEvent;
        } catch (error) {
          throw new Error(
            `Invalid JSONL in session ${sessionId} at line ${index + 1}`,
            { cause: error }
          );
        }
      });
  }

  #filePath(sessionId: string): string {
    if (!/^[a-zA-Z0-9_-]+$/.test(sessionId)) {
      throw new Error("sessionId may only contain letters, numbers, _ and -");
    }
    return path.join(this.#directory, `${sessionId}.jsonl`);
  }
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error;
}
