import { createLocalReport } from "@/lib/reportFactory";
import type { Report, ReportDraft, ReportImageMetadata } from "@/lib/types";

export const REPORT_IMAGE_MAX_BYTES = 500 * 1024;

export interface BackendReportPayload {
  lat: number;
  lng: number;
  category: ReportDraft["category"];
  severity: ReportDraft["severity"];
  photoURL: string;
  addressLabel: string;
  notes: string;
  imageMetadata?: ReportImageMetadata;
}

export interface CreateReportCallableResponse {
  reportId: string;
  rateLimit: {
    bucketId: string;
    count: number;
    limit: number;
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeErrorCode(code: string | null): string | null {
  if (!code) {
    return null;
  }

  return code.startsWith("functions/") ? code.slice("functions/".length) : code;
}

function readErrorCode(error: unknown): string | null {
  if (!isRecord(error) || typeof error.code !== "string") {
    return null;
  }

  return normalizeErrorCode(error.code);
}

function readErrorMessage(error: unknown): string | null {
  if (error instanceof Error) {
    return error.message;
  }

  if (isRecord(error) && typeof error.message === "string") {
    return error.message;
  }

  return null;
}

export function buildReportImagePath(uid: string, imageId: string): string {
  if (!uid || uid.includes("/")) {
    throw new Error("Authenticated user id is not valid for a storage path.");
  }

  if (!/^[A-Za-z0-9._-]+$/.test(imageId)) {
    throw new Error("Report image id is not valid.");
  }

  return `reportImages/${uid}/${imageId}`;
}

export function buildGsReportImageUrl(bucket: string, path: string): string {
  const normalizedBucket = bucket.replace(/^gs:\/\//, "").replace(/\/+$/, "");
  if (!normalizedBucket || normalizedBucket.includes("/")) {
    throw new Error("Firebase Storage bucket is not configured correctly.");
  }

  return `gs://${normalizedBucket}/${path}`;
}

export function buildBackendReportPayload(
  draft: ReportDraft,
  gsPhotoURL: string
): BackendReportPayload {
  return {
    lat: draft.lat,
    lng: draft.lng,
    category: draft.category,
    severity: draft.severity,
    photoURL: gsPhotoURL,
    addressLabel: draft.addressLabel,
    notes: draft.notes,
    imageMetadata: draft.imageMetadata
  };
}

export function readCreateReportCallableResponse(
  data: unknown
): CreateReportCallableResponse {
  if (!isRecord(data) || typeof data.reportId !== "string") {
    throw new Error("Backend did not return a report id.");
  }

  const rateLimit = data.rateLimit;
  if (
    !isRecord(rateLimit) ||
    typeof rateLimit.bucketId !== "string" ||
    typeof rateLimit.count !== "number" ||
    typeof rateLimit.limit !== "number"
  ) {
    throw new Error("Backend did not return rate limit metadata.");
  }

  return {
    reportId: data.reportId,
    rateLimit: {
      bucketId: rateLimit.bucketId,
      count: rateLimit.count,
      limit: rateLimit.limit
    }
  };
}

export function createBackendDisplayReport(
  draft: ReportDraft,
  reportId: string,
  userId: string,
  now = new Date()
): Report {
  const report = createLocalReport(draft, [], userId, 35, now);

  return {
    ...report,
    id: reportId,
    userId
  };
}

export function mapCreateReportError(error: unknown): string {
  const code = readErrorCode(error);
  const message = readErrorMessage(error);

  if (message?.includes("App Check") || message?.includes("not configured")) {
    return message;
  }

  switch (code) {
    case "unauthenticated":
      return "Sign in is required before sending a report.";
    case "resource-exhausted":
      return "You have reached 10 reports in this hour. Please try again later.";
    case "failed-precondition":
      return "The report session does not match the signed-in user. Please refresh and try again.";
    case "invalid-argument":
      return "The report details are invalid. Check location, category, severity, note length, and photo.";
    case "permission-denied":
    case "storage/unauthorized":
      return "This account is not allowed to upload the selected photo path.";
    case "storage/canceled":
      return "Photo upload was canceled before the report was sent.";
    case "storage/retry-limit-exceeded":
      return "Photo upload timed out. Please try again on a stable connection.";
    default:
      return message || "Could not send the report. Please try again.";
  }
}
