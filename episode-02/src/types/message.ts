import type { ToolResult } from "./tool-result.js";
import type { ToolUseRequest } from "./tool-use.js";

/** Fields shared by every immutable session message. */
export interface BaseMessage {
  readonly id: string;
  readonly sessionId: string;
  readonly createdAt: string;
}

/** A normal system, user or assistant text message. */
export interface TextMessage extends BaseMessage {
  readonly kind: "text";
  readonly role: "system" | "user" | "assistant";
  readonly content: string;
}

/** A structured tool request proposed by the model. */
export interface AssistantToolUseMessage extends BaseMessage {
  readonly kind: "tool_use";
  readonly role: "assistant";
  readonly toolUse: ToolUseRequest;
}

/** A structured observation returned by the environment. */
export interface ToolResultMessage extends BaseMessage {
  readonly kind: "tool_result";
  readonly role: "tool";
  readonly result: ToolResult;
}

/** All observable message kinds supported by Episode 02. */
export type Message = TextMessage | AssistantToolUseMessage | ToolResultMessage;

export type TextMessageRole = TextMessage["role"];
