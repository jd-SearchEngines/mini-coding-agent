/** All lifecycle states supported by the first SessionRuntime. */
export const SESSION_STATUS = {
  IDLE: "idle",
  RUNNING: "running",
  COMPLETED: "completed",
  STOPPED: "stopped",
  FAILED: "failed"
} as const;

export type SessionStatus =
  (typeof SESSION_STATUS)[keyof typeof SESSION_STATUS];
