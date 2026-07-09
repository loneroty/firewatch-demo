import {
  Timestamp,
  type DocumentSnapshot,
  type Firestore
} from "firebase-admin/firestore";
import { ReportFunctionError } from "./reportValidation";

export const FLAG_REVIEW_THRESHOLD = 3;

const DEFAULT_MODERATION_STATUS = "ปกติ";
const REVIEW_MODERATION_STATUS = "รอตรวจสอบ";
const HIDDEN_MODERATION_STATUS = "ถูกซ่อน";

interface FlagReportRequest {
  authUid: string | null;
  payload: unknown;
}

interface FlagReportOptions {
  db: Firestore;
  now?: Timestamp;
}

export interface FlagReportResult {
  reportId: string;
  flaggedCount: number;
  moderationStatus: string;
}

interface ValidatedFlagReportInput {
  reportId: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function validateDocumentId(value: unknown, fieldName: string): string {
  if (typeof value !== "string") {
    throw new ReportFunctionError("invalid-argument", `${fieldName} must be a string.`);
  }

  const trimmed = value.trim();
  if (
    trimmed.length === 0 ||
    trimmed.length > 128 ||
    trimmed.includes("/")
  ) {
    throw new ReportFunctionError("invalid-argument", `${fieldName} is invalid.`);
  }

  return trimmed;
}

function validateAuthUid(authUid: string): string {
  return validateDocumentId(authUid, "auth.uid");
}

function validateFlagReportPayload(payload: unknown): ValidatedFlagReportInput {
  if (!isRecord(payload)) {
    throw new ReportFunctionError("invalid-argument", "payload must be an object.");
  }

  for (const key of Object.keys(payload)) {
    if (key !== "reportId") {
      throw new ReportFunctionError("invalid-argument", `${key} is not a supported field.`);
    }
  }

  return {
    reportId: validateDocumentId(payload.reportId, "reportId")
  };
}

function readFlaggedCount(snapshot: DocumentSnapshot): number {
  const value = snapshot.get("flaggedCount");
  if (value === undefined || value === null) {
    return 0;
  }

  if (!Number.isInteger(value) || typeof value !== "number" || value < 0) {
    throw new ReportFunctionError("failed-precondition", "flagged-count-invalid");
  }

  return value;
}

function readModerationStatus(snapshot: DocumentSnapshot): string {
  const value = snapshot.get("moderationStatus");
  if (value === undefined || value === null || value === "") {
    return DEFAULT_MODERATION_STATUS;
  }

  if (
    value !== DEFAULT_MODERATION_STATUS &&
    value !== REVIEW_MODERATION_STATUS &&
    value !== HIDDEN_MODERATION_STATUS
  ) {
    throw new ReportFunctionError("failed-precondition", "moderation-status-invalid");
  }

  if (typeof value !== "string") {
    throw new ReportFunctionError("failed-precondition", "moderation-status-invalid");
  }

  return value;
}

export async function flagReportForRequest(
  request: FlagReportRequest,
  options: FlagReportOptions
): Promise<FlagReportResult> {
  if (!request.authUid) {
    throw new ReportFunctionError("unauthenticated", "authentication-required");
  }

  const authUid = validateAuthUid(request.authUid);
  const input = validateFlagReportPayload(request.payload);
  const now = options.now ?? Timestamp.now();
  const reportRef = options.db.doc(`reports/${input.reportId}`);
  const flagRef = reportRef.collection("flags").doc(authUid);

  return options.db.runTransaction(async (transaction) => {
    const reportSnapshot = await transaction.get(reportRef);
    const flagSnapshot = await transaction.get(flagRef);

    if (!reportSnapshot.exists) {
      throw new ReportFunctionError("not-found", "report-not-found");
    }

    if (flagSnapshot.exists) {
      throw new ReportFunctionError("already-exists", "duplicate-report-flag");
    }

    const currentFlaggedCount = readFlaggedCount(reportSnapshot);
    const currentModerationStatus = readModerationStatus(reportSnapshot);
    const nextFlaggedCount = currentFlaggedCount + 1;
    const nextModerationStatus =
      currentModerationStatus === HIDDEN_MODERATION_STATUS
        ? HIDDEN_MODERATION_STATUS
        : nextFlaggedCount >= FLAG_REVIEW_THRESHOLD
          ? REVIEW_MODERATION_STATUS
          : currentModerationStatus;

    transaction.create(flagRef, {
      uid: authUid,
      reportId: input.reportId,
      createdAt: now
    });
    transaction.update(reportRef, {
      flaggedCount: nextFlaggedCount,
      moderationStatus: nextModerationStatus
    });

    return {
      reportId: input.reportId,
      flaggedCount: nextFlaggedCount,
      moderationStatus: nextModerationStatus
    };
  });
}
