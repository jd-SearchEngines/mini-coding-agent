import { randomUUID } from "node:crypto";
import type { Message, ToolResultMessage } from "../types/message.js";
import type { ModelResponse } from "../types/model-response.js";
import type { ModelClient, ModelGenerateOptions } from "./model-client.js";

const FINAL_ANSWER = `auth.ts 中的时间单位不一致。

issuedAtSeconds 和 TOKEN_TTL_SECONDS 使用秒，但 Date.now() 返回毫秒。
代码把毫秒时间戳直接与秒级 expiresAtSeconds 比较，因此刚生成的 Token 也会被错误判断为已过期。

下一步可以把 Date.now() 除以 1000 并向下取整，或者统一将所有时间改成毫秒。
当前 Episode 02 只读取和分析，不修改文件。`;

/** Deterministic two-stage model that learns file content only from messages. */
export class MockModelClient implements ModelClient {
  generate(options: ModelGenerateOptions): Promise<ModelResponse> {
    const successfulRead = [...options.messages]
      .reverse()
      .find(isSuccessfulReadResult);

    if (successfulRead === undefined) {
      console.log("[ModelClient] generating response");
      return Promise.resolve({
        type: "tool_use",
        toolUse: {
          id: randomUUID(),
          name: "read_file",
          input: { path: "examples/login/auth.ts" }
        }
      });
    }

    console.log("[ModelClient] generating final answer");
    if (!successfulRead.result.content.includes("Date.now()")) {
      return Promise.resolve({
        type: "final",
        content:
          "读取结果中没有找到预期代码，请检查文件内容。本集不会修改文件。"
      });
    }
    return Promise.resolve({ type: "final", content: FINAL_ANSWER });
  }
}

function isSuccessfulReadResult(
  message: Message
): message is ToolResultMessage {
  return (
    message.kind === "tool_result" &&
    message.result.toolName === "read_file" &&
    message.result.ok
  );
}
