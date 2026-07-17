import type { ModelResponse } from "../types/model-response.js";
import type { ModelClient, ModelGenerateOptions } from "./model-client.js";

/** Test model that returns configured responses in order and records inputs. */
export class ScriptedModelClient implements ModelClient {
  readonly calls: ModelGenerateOptions[] = [];
  readonly #responses: ModelResponse[];

  constructor(responses: readonly ModelResponse[]) {
    this.#responses = responses.map((response) => structuredClone(response));
  }

  generate(options: ModelGenerateOptions): Promise<ModelResponse> {
    this.calls.push(structuredClone(options));
    const response = this.#responses.shift();
    if (response === undefined) {
      throw new Error("ScriptedModelClient has no response remaining");
    }
    return Promise.resolve(structuredClone(response));
  }
}
