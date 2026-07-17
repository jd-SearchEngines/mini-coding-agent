import { mkdtemp, mkdir, readFile, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { rm } from "node:fs/promises";
import { ReadTool, TOOL_ERROR_CODE, ToolExecutionError } from "../src/index.js";

const roots: string[] = [];
async function workspace(): Promise<string> {
  const root = await mkdtemp(path.join(os.tmpdir(), "read-tool-"));
  roots.push(root);
  return root;
}

afterEach(async () => {
  await Promise.all(
    roots.splice(0).map((root) => rm(root, { recursive: true }))
  );
});

describe("ReadTool", () => {
  it("validates a strict path-only object", () => {
    const tool = new ReadTool();
    expect(tool.validateInput({ path: "hello.txt" })).toEqual({
      path: "hello.txt"
    });
    for (const input of [null, {}, { path: " " }, { path: "x", extra: true }]) {
      expect(() => tool.validateInput(input)).toThrow();
    }
    expect(() => tool.validateInput({ path: "/tmp/secret" })).toThrow(
      "relative"
    );
    expect(() => tool.validateInput({ path: "bad\0path" })).toThrow(
      "null byte"
    );
  });

  it("reads real UTF-8 content without modifying the file", async () => {
    const root = await workspace();
    const file = path.join(root, "你好.txt");
    await writeFile(file, "真实中文内容", "utf8");
    const before = await readFile(file, "utf8");
    const result = await new ReadTool().execute(
      { path: "你好.txt" },
      { workspaceRoot: root }
    );
    expect(result).toContain("真实中文内容");
    expect(await readFile(file, "utf8")).toBe(before);
  });

  it("rejects missing paths and directories with stable codes", async () => {
    const root = await workspace();
    await mkdir(path.join(root, "folder"));
    await expect(
      new ReadTool().execute({ path: "missing.txt" }, { workspaceRoot: root })
    ).rejects.toMatchObject({ code: TOOL_ERROR_CODE.FILE_NOT_FOUND });
    await expect(
      new ReadTool().execute({ path: "folder" }, { workspaceRoot: root })
    ).rejects.toMatchObject({ code: TOOL_ERROR_CODE.NOT_A_FILE });
  });

  it("rejects traversal and symlink escape", async () => {
    const root = await workspace();
    const outside = await workspace();
    await writeFile(path.join(outside, "secret.txt"), "secret");
    await symlink(
      path.join(outside, "secret.txt"),
      path.join(root, "link.txt")
    );
    const tool = new ReadTool();
    for (const requestedPath of ["../secret.txt", "link.txt"]) {
      await expect(
        tool.execute({ path: requestedPath }, { workspaceRoot: root })
      ).rejects.toMatchObject({
        code: TOOL_ERROR_CODE.PATH_OUTSIDE_WORKSPACE
      });
    }
  });

  it("rejects oversized files", async () => {
    const root = await workspace();
    await writeFile(path.join(root, "large.txt"), "12345");
    await expect(
      new ReadTool(4).execute({ path: "large.txt" }, { workspaceRoot: root })
    ).rejects.toMatchObject({ code: TOOL_ERROR_CODE.FILE_TOO_LARGE });
  });

  it("honors an aborted signal", async () => {
    const controller = new AbortController();
    controller.abort();
    await expect(
      new ReadTool().execute(
        { path: "anything" },
        { workspaceRoot: ".", signal: controller.signal }
      )
    ).rejects.toMatchObject({ name: "AbortError" });
  });

  it("uses ToolExecutionError for expected failures", () => {
    expect(
      new ToolExecutionError(TOOL_ERROR_CODE.FILE_NOT_FOUND, "missing")
    ).toBeInstanceOf(Error);
  });
});
