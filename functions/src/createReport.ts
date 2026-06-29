import {
  FieldValue,
  Timestamp,
  type Firestore
} from "firebase-admin/firestore";
import { encodeGeohash } from "./geohash";
import {
  ReportFunctionError,
  type ReportDocument,
  validateCreateReportPayload
} from "./reportValidation";

export const REPORT_RATE_LIMIT_PER_HOUR = 10;
export const DEFAULT_REPUTATION_SCORE = 35;
export const LOW_REPUTATION_THRESHOLD = 20;

export interface CreateReportRequest {
  authUid: string | null;
  payload: unknown;
}

export interface CreateReportOptions {
  db: Firestore;
  now?: Timestamp;
}

export interface CreateReportResult {
  reportId: string;
  rateLimit: {
    bucketId: string;
    count: number;
    limit: number;
  };
}

function pad(value: number): string {
  return value.toString().padStart(2, "0");
}

export function getHourlyBucketId(date: Date): string {
  return [
    date.getUTCFullYear().toString(),
    pad(date.getUTCMonth() + 1),
    pad(date.getUTCDate()),
    pad(date.getUTCHours())
  ].join("");
}

function getHourStart(date: Date): Date {
  return new Date(Date.UTC(
    date.getUTCFullYear(),
    date.getUTCMonth(),
    date.getUTCDate(),
    date.getUTCHours(),
    0,
    0,
    0
  ));
}

function readInteger(value: unknown, fallback: number): number {
  return Number.isInteger(value) && typeof value === "number" ? value : fallback;
}

export async function createReportForRequest(
  request: CreateReportRequest,
  options: CreateReportOptions
): Promise<CreateReportResult> {
  if (!request.authUid) {
    throw new ReportFunctionError("unauthenticated", "Authentication is required.");
  }

  const authUid = request.authUid;
  const validated = validateCreateReportPayload(request.payload, authUid);
  const now = options.now ?? Timestamp.now();
  const nowDate = now.toDate();
  const bucketId = getHourlyBucketId(nowDate);
  const bucketRef = options.db.doc(`rateLimits/${authUid}/hours/${bucketId}`);
  const userRef = options.db.doc(`users/${authUid}`);
  const reportRef = options.db.collection("reports").doc();

  return options.db.runTransaction(async (transaction) => {
    const bucketSnapshot = await transaction.get(bucketRef);
    const existingCount = bucketSnapshot.exists
      ? readInteger(bucketSnapshot.get("count"), 0)
      : 0;

    if (existingCount >= REPORT_RATE_LIMIT_PER_HOUR) {
      throw new ReportFunctionError(
        "resource-exhausted",
        "Report rate limit exceeded. Please try again later."
      );
    }

    const userSnapshot = await transaction.get(userRef);
    const reputationScore = userSnapshot.exists
      ? readInteger(userSnapshot.get("reputationScore"), DEFAULT_REPUTATION_SCORE)
      : DEFAULT_REPUTATION_SCORE;

    const report: ReportDocument = {
      id: reportRef.id,
      lat: validated.lat,
      lng: validated.lng,
      geohash: encodeGeohash(validated.lat, validated.lng),
      photoURL: validated.photoURL,
      category: validated.category,
      severity: validated.severity,
      createdAt: now,
      userId: authUid,
      verificationStatus: "รอการยืนยัน",
      confirmedByReportIds: [],
      isThrottled: reputationScore < LOW_REPUTATION_THRESHOLD,
      flaggedCount: 0,
      moderationStatus: "ปกติ",
      addressLabel: validated.addressLabel,
      notes: validated.notes
    };

    const nextCount = existingCount + 1;
    transaction.set(reportRef, report);
    transaction.set(
      bucketRef,
      {
        uid: authUid,
        bucketId,
        count: nextCount,
        limit: REPORT_RATE_LIMIT_PER_HOUR,
        windowStartAt: Timestamp.fromDate(getHourStart(nowDate)),
        updatedAt: now
      },
      { merge: true }
    );
    if (userSnapshot.exists) {
      transaction.set(
        userRef,
        {
          reportsCount: FieldValue.increment(1)
        },
        { merge: true }
      );
    }

    return {
      reportId: reportRef.id,
      rateLimit: {
        bucketId,
        count: nextCount,
        limit: REPORT_RATE_LIMIT_PER_HOUR
      }
    };
  });
}
