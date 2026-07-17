import { access, readFile, realpath, stat } from "node:fs/promises";
import { constants } from "node:fs";
import path from "node:path";
import { TOOL_ERROR_CODE } from "../types/tool-result.js";
import type { Tool } from "./tool.js";
import type { ToolContext } from "./tool-context.js";
import { ToolExecutionError } from "./tool-error.js";
import { throwIfAborted } from "./tool-executor.js";

export interface ReadToolInput {
  readonly path: string;
}

export const DEFAULT_MAX_FILE_SIZE_BYTES = 256 * 1024;

/** Read-only UTF-8 file tool constrained to an explicit workspace. */
export class ReadTool implements Tool<ReadToolInput> {
  readonly name = "read_file";
  readonly description = "Read a UTF-8 text file inside the workspace.";
  readonly isReadOnly = true;
  readonly inputSchema = {
    type: "object",
    properties: {
      path: {
        type: "string",
        description: "Workspace-relative path of the text file to read."
      }
    },
    required: ["path"],
    additionalProperties: false
  } as const;
  readonly #maxFileSizeBytes: number;

  constructor(maxFileSizeBytes = DEFAULT_MAX_FILE_SIZE_BYTES) {
    this.#maxFileSizeBytes = maxFileSizeBytes;
  }

  validateInput(input: unknown): ReadToolInput {
    if (!isPlainObject(input)) {
      throw new Error("read_file input must be an object");
    }
    if (Object.keys(input).some((key) => key !== "path")) {
      throw new Error("read_file input only accepts the path field");
    }
    const inputPath = input["path"];
    if (typeof inputPath !== "string" || inputPath.trim().length === 0) {
      throw new Error("path must be a non-empty string");
    }
    if (inputPath.includes("\0")) {
      throw new Error("path must not contain a null byte");
    }
    if (path.isAbsolute(inputPath)) {
      throw new Error("path must be relative to the workspace");
    }
    return { path: inputPath };
  }

  async execute(input: ReadToolInput, context: ToolContext): Promise<string> {
    throwIfAborted(context.signal);
    const root = await realpath(path.resolve(context.workspaceRoot));
    const requestedPath = path.resolve(root, input.path);
    assertInsideWorkspace(root, requestedPath);

    let target: string;
    try {
      target = await realpath(requestedPath);
    } catch (error) {
      if (isNodeError(error) && error.code === "ENOENT") {
        throw new ToolExecutionError(
          TOOL_ERROR_CODE.FILE_NOT_FOUND,
          `File not found: ${input.path}`,
          { cause: error }
        );
      }
      throw error;
    }
    assertInsideWorkspace(root, target);

    const metadata = await stat(target);
    if (!metadata.isFile()) {
      throw new ToolExecutionError(
        TOOL_ERROR_CODE.NOT_A_FILE,
        `Path is not a regular file: ${input.path}`
      );
    }
    if (metadata.size > this.#maxFileSizeBytes) {
      throw new ToolExecutionError(
        TOOL_ERROR_CODE.FILE_TOO_LARGE,
        `File exceeds ${this.#maxFileSizeBytes} byte limit: ${input.path}`
      );
    }

    try {
      await access(target, constants.R_OK);
      throwIfAborted(context.signal);
      console.log(`[ReadTool] reading ${input.path}`);
      const content = await readFile(target, "utf8");
      throwIfAborted(context.signal);
      return `File: ${input.path}\n---\n${content}`;
    } catch (error) {
      if (isNodeError(error) && error.code === "EACCES") {
        throw new ToolExecutionError(
          TOOL_ERROR_CODE.FILE_NOT_READABLE,
          `File is not readable: ${input.path}`,
          { cause: error }
        );
      }
      throw error;
    }
  }
}

function assertInsideWorkspace(root: string, target: string): void {
  const relative = path.relative(root, target);
  if (
    relative === ".." ||
    relative.startsWith(`..${path.sep}`) ||
    path.isAbsolute(relative)
  ) {
    throw new ToolExecutionError(
      TOOL_ERROR_CODE.PATH_OUTSIDE_WORKSPACE,
      "Requested path is outside the workspace"
    );
  }
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== "object") return false;
  const prototype: unknown = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error;
}
