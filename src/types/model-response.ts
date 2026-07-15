/** Why a model generation ended. */
export type FinishReason = "stop" | "continue";

/** Provider-independent result returned by a ModelClient. */
export interface ModelResponse {
  readonly content: string;
  readonly finishReason: FinishReason;
}
