import type { Message } from "../types/message.js";
import type { ModelResponse } from "../types/model-response.js";
import type { ModelClient } from "./model-client.js";

const DEFAULT_RESPONSE =
  "我需要先查看项目目录，并搜索与 login、auth 和 token 相关的文件。当前版本尚未接入文件工具，下一集将实现 Read Tool。";

export type MockResponseFactory = (
  messagesForQuery: readonly Message[]
) => ModelResponse | Promise<ModelResponse>;

/** Offline model implementation for demos and tests. */
export class MockModelClient implements ModelClient {
  readonly #responseFactory: MockResponseFactory;

  constructor(response: string | MockResponseFactory = DEFAULT_RESPONSE) {
    this.#responseFactory =
      typeof response === "string"
        ? () => ({ content: response, finishReason: "stop" })
        : response;
  }

  async generate(messagesForQuery: readonly Message[]): Promise<ModelResponse> {
    console.log("[ModelClient] generating response");
    return this.#responseFactory(messagesForQuery);
  }
}
