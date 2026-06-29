import { Timestamp } from "firebase-admin/firestore";

export const reportCategories = [
  "open_burning",
  "wildfire_smoke",
  "industrial_smoke",
  "other"
] as const;

export type ReportCategory = (typeof reportCategories)[number];
export type Severity = 1 | 2 | 3;

export interface ImageMetadata {
  contentType: "image/jpeg" | "image/png" | "image/webp";
  sizeBytes: number;
  width?: number;
  height?: number;
}

export interface ValidatedCreateReportInput {
  lat: number;
  lng: number;
  category: ReportCategory;
  severity: Severity;
  photoURL: string;
  addressLabel: string;
  notes: string;
  imageMetadata?: ImageMetadata;
}

export interface ReportDocument {
  id: string;
  lat: number;
  lng: number;
  geohash: string;
  photoURL: string;
  category: ReportCategory;
  severity: Severity;
  createdAt: Timestamp;
  userId: string;
  verificationStatus: "รอการยืนยัน";
  confirmedByReportIds: [];
  isThrottled: boolean;
  flaggedCount: 0;
  moderationStatus: "ปกติ";
  addressLabel: string;
  notes: string;
}

export type ReportErrorCode =
  | "unauthenticated"
  | "invalid-argument"
  | "failed-precondition"
  | "resource-exhausted"
  | "internal";

export class ReportFunctionError extends Error {
  readonly code: ReportErrorCode;

  constructor(code: ReportErrorCode, message: string) {
    super(message);
    this.name = "ReportFunctionError";
    this.code = code;
  }
}

const allowedClientFields = new Set([
  "lat",
  "lng",
  "category",
  "severity",
  "photoURL",
  "addressLabel",
  "notes",
  "imageMetadata",
  "userId"
]);

const serverControlledFields = new Set([
  "id",
  "geohash",
  "createdAt",
  "verificationStatus",
  "moderationStatus",
  "confirmedByReportIds",
  "isThrottled",
  "flaggedCount",
  "reputationScore",
  "reportsCount",
  "verifiedReportsCount",
  "rejectedReportsCount",
  "isSuspended"
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requireString(value: unknown, fieldName: string, maxLength: number): string {
  if (typeof value !== "string") {
    throw new ReportFunctionError("invalid-argument", `${fieldName} must be a string.`);
  }

  const trimmed = value.trim();
  if (trimmed.length > maxLength) {
    throw new ReportFunctionError(
      "invalid-argument",
      `${fieldName} must be ${maxLength} characters or fewer.`
    );
  }

  return trimmed;
}

function validateCoordinate(value: unknown, fieldName: "lat" | "lng"): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new ReportFunctionError("invalid-argument", `${fieldName} must be a finite number.`);
  }

  const min = fieldName === "lat" ? -90 : -180;
  const max = fieldName === "lat" ? 90 : 180;
  if (value < min || value > max) {
    throw new ReportFunctionError(
      "invalid-argument",
      `${fieldName} must be between ${min} and ${max}.`
    );
  }

  return value;
}

function validateCategory(value: unknown): ReportCategory {
  if (
    typeof value !== "string" ||
    !reportCategories.includes(value as ReportCategory)
  ) {
    throw new ReportFunctionError("invalid-argument", "category is not supported.");
  }

  return value as ReportCategory;
}

function validateSeverity(value: unknown): Severity {
  if (value !== 1 && value !== 2 && value !== 3) {
    throw new ReportFunctionError("invalid-argument", "severity must be 1, 2, or 3.");
  }

  return value;
}

function validatePhotoURL(value: unknown): string {
  const photoURL = requireString(value, "photoURL", 2048);
  if (!photoURL.startsWith("https://") && !photoURL.startsWith("gs://")) {
    throw new ReportFunctionError(
      "invalid-argument",
      "photoURL must be an https:// or gs:// URL."
    );
  }

  return photoURL;
}

function validatePositiveInteger(
  value: unknown,
  fieldName: string,
  maxValue: number
): number {
  if (!Number.isInteger(value) || typeof value !== "number") {
    throw new ReportFunctionError("invalid-argument", `${fieldName} must be an integer.`);
  }

  if (value <= 0 || value > maxValue) {
    throw new ReportFunctionError(
      "invalid-argument",
      `${fieldName} must be between 1 and ${maxValue}.`
    );
  }

  return value;
}

function validateImageMetadata(value: unknown): ImageMetadata | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (!isRecord(value)) {
    throw new ReportFunctionError("invalid-argument", "imageMetadata must be an object.");
  }

  const contentType = value.contentType;
  if (
    contentType !== "image/jpeg" &&
    contentType !== "image/png" &&
    contentType !== "image/webp"
  ) {
    throw new ReportFunctionError("invalid-argument", "imageMetadata.contentType is not supported.");
  }

  const metadata: ImageMetadata = {
    contentType,
    sizeBytes: validatePositiveInteger(
      value.sizeBytes,
      "imageMetadata.sizeBytes",
      500 * 1024
    )
  };

  if (value.width !== undefined) {
    metadata.width = validatePositiveInteger(value.width, "imageMetadata.width", 10_000);
  }

  if (value.height !== undefined) {
    metadata.height = validatePositiveInteger(value.height, "imageMetadata.height", 10_000);
  }

  return metadata;
}

export function validateCreateReportPayload(
  payload: unknown,
  authUid: string
): ValidatedCreateReportInput {
  if (!isRecord(payload)) {
    throw new ReportFunctionError("invalid-argument", "payload must be an object.");
  }

  for (const key of Object.keys(payload)) {
    if (serverControlledFields.has(key)) {
      throw new ReportFunctionError(
        "invalid-argument",
        `${key} is controlled by the server and cannot be supplied by the client.`
      );
    }

    if (!allowedClientFields.has(key)) {
      throw new ReportFunctionError("invalid-argument", `${key} is not a supported field.`);
    }
  }

  if (typeof payload.userId === "string" && payload.userId !== authUid) {
    throw new ReportFunctionError("failed-precondition", "payload userId must match auth.uid.");
  }

  return {
    lat: validateCoordinate(payload.lat, "lat"),
    lng: validateCoordinate(payload.lng, "lng"),
    category: validateCategory(payload.category),
    severity: validateSeverity(payload.severity),
    photoURL: validatePhotoURL(payload.photoURL),
    addressLabel: requireString(payload.addressLabel, "addressLabel", 160) || "ไม่ระบุพื้นที่",
    notes: requireString(payload.notes, "notes", 500),
    imageMetadata: validateImageMetadata(payload.imageMetadata)
  };
}
