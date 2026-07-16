export type IncidentZoneRuntimeErrorCode =
  | "candidate-limit-exceeded"
  | "concurrent-state-change"
  | "connected-partition-limit-exceeded"
  | "invalid-job"
  | "lease-lost"
  | "malformed-zone-state"
  | "membership-conflict"
  | "write-limit-exceeded";

export class IncidentZoneRuntimeError extends Error {
  readonly code: IncidentZoneRuntimeErrorCode;

  constructor(code: IncidentZoneRuntimeErrorCode, message: string) {
    super(message);
    this.name = "IncidentZoneRuntimeError";
    this.code = code;
  }
}

