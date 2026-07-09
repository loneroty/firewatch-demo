import { type Firestore } from "firebase-admin/firestore";
import { ReportFunctionError } from "./reportValidation";

const HIDDEN_MODERATION_STATUS = "ถูกซ่อน";
const NORMAL_MODERATION_STATUS = "ปกติ";
const allowedAdminRoles = new Set(["moderator", "superadmin"]);

interface ModerateReportRequest {
  authUid: string | null;
  payload: unknown;
}

interface ModerateReportOptions {
  db: Firestore;
}

export type ModerateReportAction = "hide" | "restore";

export interface ModerateReportResult {
  reportId: string;
  action: ModerateReportAction;
  moderationStatus: typeof HIDDEN_MODERATION_STATUS | typeof NORMAL_MODERATION_STATUS;
}

interface ValidatedModerateReportInput {
  reportId: string;
  action: ModerateReportAction;
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

function validateModerateAction(value: unknown): ModerateReportAction {
  if (value !== "hide" && value !== "restore") {
    throw new ReportFunctionError("invalid-argument", "moderation-action-invalid");
  }

  return value;
}

function validateModerateReportPayload(payload: unknown): ValidatedModerateReportInput {
  if (!isRecord(payload)) {
    throw new ReportFunctionError("invalid-argument", "payload must be an object.");
  }

  for (const key of Object.keys(payload)) {
    if (key !== "reportId" && key !== "action") {
      throw new ReportFunctionError("invalid-argument", `${key} is not a supported field.`);
    }
  }

  return {
    reportId: validateDocumentId(payload.reportId, "reportId"),
    action: validateModerateAction(payload.action)
  };
}

function isAllowedAdminRole(value: unknown): boolean {
  return typeof value === "string" && allowedAdminRoles.has(value);
}

export async function moderateReportForRequest(
  request: ModerateReportRequest,
  options: ModerateReportOptions
): Promise<ModerateReportResult> {
  if (!request.authUid) {
    throw new ReportFunctionError("unauthenticated", "authentication-required");
  }

  const authUid = validateDocumentId(request.authUid, "auth.uid");
  const input = validateModerateReportPayload(request.payload);
  const adminRef = options.db.doc(`admins/${authUid}`);
  const reportRef = options.db.doc(`reports/${input.reportId}`);

  return options.db.runTransaction(async (transaction) => {
    const adminSnapshot = await transaction.get(adminRef);
    const reportSnapshot = await transaction.get(reportRef);

    if (!adminSnapshot.exists || !isAllowedAdminRole(adminSnapshot.get("role"))) {
      throw new ReportFunctionError("permission-denied", "operator-role-required");
    }

    if (!reportSnapshot.exists) {
      throw new ReportFunctionError("not-found", "report-not-found");
    }

    const nextModerationStatus =
      input.action === "hide" ? HIDDEN_MODERATION_STATUS : NORMAL_MODERATION_STATUS;

    transaction.update(reportRef, {
      moderationStatus: nextModerationStatus
    });

    return {
      reportId: input.reportId,
      action: input.action,
      moderationStatus: nextModerationStatus
    };
  });
}
