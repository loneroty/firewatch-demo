import { encodeGeohash } from "@/lib/geohash";
import type { Report, ReportDraft } from "@/lib/types";
import {
  evaluateCandidateReport,
  type VerificationEvaluation
} from "@/lib/verification/reputation";

function createReportId(now: Date): string {
  const timestamp = now.toISOString().replace(/[^0-9]/g, "");
  const randomPart =
    globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2);
  return `report-${timestamp}-${randomPart}`;
}

export function createLocalReport(
  draft: ReportDraft,
  existingReports: readonly Report[],
  userId: string,
  userReputationScore: number,
  now = new Date()
): Report {
  const createdAt = now.toISOString();
  const evaluation: VerificationEvaluation = evaluateCandidateReport(
    {
      lat: draft.lat,
      lng: draft.lng,
      createdAt,
      userId
    },
    existingReports,
    userReputationScore
  );

  return {
    id: createReportId(now),
    lat: draft.lat,
    lng: draft.lng,
    geohash: encodeGeohash(draft.lat, draft.lng),
    photoURL: draft.photoURL,
    category: draft.category,
    severity: draft.severity,
    createdAt,
    userId,
    verificationStatus: evaluation.verificationStatus,
    confirmedByReportIds: evaluation.confirmedByReportIds,
    isThrottled: evaluation.isThrottled,
    flaggedCount: 0,
    moderationStatus: "ปกติ",
    addressLabel: draft.addressLabel.trim() || "ไม่ระบุพื้นที่",
    notes: draft.notes.trim()
  };
}
