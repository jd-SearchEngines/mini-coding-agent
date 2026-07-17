/** A model-proposed action. Input stays unknown until its Tool validates it. */
export interface ToolUseRequest {
  readonly id: string;
  readonly name: string;
  readonly input: unknown;
}
