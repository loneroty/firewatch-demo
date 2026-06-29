import {
  Timestamp,
  type DocumentSnapshot,
  type Firestore
} from "firebase-admin/firestore";
import { ReportFunctionError } from "./reportValidation";

export const CONFIRMATION_RADIUS_METERS = 500;
export const CONFIRMATION_WINDOW_MS = 60 * 60 * 1000;

const CONFIRMED_STATUS = "ยืนยันแล้ว";
const REJECTED_STATUS = "ถูกปฏิเสธ";
const HIDDEN_MODERATION_STATUS = "ถูกซ่อน";

interface ConfirmReportRequest {
  authUid: string | null;
  payload: unknown;
}

interface ConfirmReportOptions {
  db: Firestore;
}

export interface ConfirmReportResult {
  targetReportId: string;
  confirmingReportId: string;
  confirmedByReportIds: string[];
  verificationStatus: typeof CONFIRMED_STATUS;
}

interface ValidatedConfirmReportInput {
  targetReportId: string;
  confirmingReportId: string;
}

interface ReportForConfirmation {
  id: string;
  lat: number;
  lng: number;
  createdAt: Timestamp;
  userId: string;
  verificationStatus: string;
  moderationStatus: string;
  confirmedByReportIds: string[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function validateReportId(value: unknown, fieldName: string): string {
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

function validateConfirmReportPayload(payload: unknown): ValidatedConfirmReportInput {
  if (!isRecord(payload)) {
    throw new ReportFunctionError("invalid-argument", "payload must be an object.");
  }

  for (const key of Object.keys(payload)) {
    if (key !== "targetReportId" && key !== "confirmingReportId") {
      throw new ReportFunctionError("invalid-argument", `${key} is not a supported field.`);
    }
  }

  const targetReportId = validateReportId(payload.targetReportId, "targetReportId");
  const confirmingReportId = validateReportId(payload.confirmingReportId, "confirmingReportId");

  if (targetReportId === confirmingReportId) {
    throw new ReportFunctionError(
      "failed-precondition",
      "cannot-confirm-with-same-report"
    );
  }

  return {
    targetReportId,
    confirmingReportId
  };
}

function readNumber(value: unknown, fieldName: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new ReportFunctionError("internal", `${fieldName} is not a valid number.`);
  }

  return value;
}

function readString(value: unknown, fieldName: string): string {
  if (typeof value !== "string") {
    throw new ReportFunctionError("internal", `${fieldName} is not a valid string.`);
  }

  return value;
}

function readTimestamp(value: unknown, fieldName: string): Timestamp {
  if (!(value instanceof Timestamp)) {
    throw new ReportFunctionError("internal", `${fieldName} is not a Firestore Timestamp.`);
  }

  return value;
}

function readStringArray(value: unknown, fieldName: string): string[] {
  if (!Array.isArray(value)) {
    throw new ReportFunctionError("internal", `${fieldName} is not an array.`);
  }

  if (!value.every((item): item is string => typeof item === "string")) {
    throw new ReportFunctionError("internal", `${fieldName} must contain only strings.`);
  }

  return [...value];
}

function readReportForConfirmation(
  snapshot: DocumentSnapshot,
  notFoundMessage: string
): ReportForConfirmation {
  if (!snapshot.exists) {
    throw new ReportFunctionError("not-found", notFoundMessage);
  }

  const data = snapshot.data();
  if (!isRecord(data)) {
    throw new ReportFunctionError("internal", "report document is invalid.");
  }

  return {
    id: snapshot.id,
    lat: readNumber(data.lat, "lat"),
    lng: readNumber(data.lng, "lng"),
    createdAt: readTimestamp(data.createdAt, "createdAt"),
    userId: readString(data.userId, "userId"),
    verificationStatus: readString(data.verificationStatus, "verificationStatus"),
    moderationStatus: readString(data.moderationStatus, "moderationStatus"),
    confirmedByReportIds: readStringArray(
      data.confirmedByReportIds,
      "confirmedByReportIds"
    )
  };
}

function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

function distanceMeters(
  a: Readonly<{ lat: number; lng: number }>,
  b: Readonly<{ lat: number; lng: number }>
): number {
  const earthRadiusMeters = 6_371_000;
  const deltaLat = toRadians(b.lat - a.lat);
  const deltaLng = toRadians(b.lng - a.lng);
  const lat1 = toRadians(a.lat);
  const lat2 = toRadians(b.lat);
  const haversine =
    Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
    Math.cos(lat1) *
      Math.cos(lat2) *
      Math.sin(deltaLng / 2) *
      Math.sin(deltaLng / 2);

  return 2 * earthRadiusMeters * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
}

function isRejectedOrHidden(report: ReportForConfirmation): boolean {
  return (
    report.verificationStatus === REJECTED_STATUS ||
    report.moderationStatus === HIDDEN_MODERATION_STATUS
  );
}

export async function confirmReportForRequest(
  request: ConfirmReportRequest,
  options: ConfirmReportOptions
): Promise<ConfirmReportResult> {
  if (!request.authUid) {
    throw new ReportFunctionError("unauthenticated", "authentication-required");
  }

  const authUid = request.authUid;
  const input = validateConfirmReportPayload(request.payload);
  const targetReportRef = options.db.doc(`reports/${input.targetReportId}`);
  const confirmingReportRef = options.db.doc(`reports/${input.confirmingReportId}`);

  return options.db.runTransaction(async (transaction) => {
    const targetSnapshot = await transaction.get(targetReportRef);
    const confirmingSnapshot = await transaction.get(confirmingReportRef);
    const targetReport = readReportForConfirmation(
      targetSnapshot,
      "target-report-not-found"
    );
    const confirmingReport = readReportForConfirmation(
      confirmingSnapshot,
      "confirming-report-not-found"
    );

    if (targetReport.userId === authUid) {
      throw new ReportFunctionError("failed-precondition", "cannot-confirm-own-report");
    }

    if (confirmingReport.userId !== authUid) {
      throw new ReportFunctionError(
        "failed-precondition",
        "confirming-report-not-owned"
      );
    }

    if (isRejectedOrHidden(targetReport)) {
      throw new ReportFunctionError("failed-precondition", "target-report-not-confirmable");
    }

    if (isRejectedOrHidden(confirmingReport)) {
      throw new ReportFunctionError(
        "failed-precondition",
        "confirming-report-not-confirmable"
      );
    }

    if (targetReport.confirmedByReportIds.includes(input.confirmingReportId)) {
      throw new ReportFunctionError("already-exists", "duplicate-confirmation");
    }

    const existingConfirmationSnapshots = await Promise.all(
      targetReport.confirmedByReportIds.map((reportId) =>
        transaction.get(options.db.doc(`reports/${reportId}`))
      )
    );
    const alreadyConfirmedByUser = existingConfirmationSnapshots.some(
      (snapshot) => snapshot.exists && snapshot.get("userId") === authUid
    );
    if (alreadyConfirmedByUser) {
      throw new ReportFunctionError("already-exists", "duplicate-confirmation");
    }

    const timeDeltaMs = Math.abs(
      targetReport.createdAt.toMillis() - confirmingReport.createdAt.toMillis()
    );
    if (timeDeltaMs > CONFIRMATION_WINDOW_MS) {
      throw new ReportFunctionError(
        "failed-precondition",
        "confirming-report-outside-window"
      );
    }

    if (distanceMeters(targetReport, confirmingReport) > CONFIRMATION_RADIUS_METERS) {
      throw new ReportFunctionError(
        "failed-precondition",
        "confirming-report-outside-radius"
      );
    }

    const confirmedByReportIds = [
      ...targetReport.confirmedByReportIds,
      input.confirmingReportId
    ];
    transaction.update(targetReportRef, {
      confirmedByReportIds,
      verificationStatus: CONFIRMED_STATUS
    });

    return {
      targetReportId: input.targetReportId,
      confirmingReportId: input.confirmingReportId,
      confirmedByReportIds,
      verificationStatus: CONFIRMED_STATUS
    };
  });
}
