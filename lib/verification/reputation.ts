import type { Report, VerificationStatus } from "@/lib/types";
import { distanceMeters } from "@/lib/verification/geo";

export const VERIFICATION_RADIUS_METERS = 500;
export const VERIFICATION_WINDOW_MS = 60 * 60 * 1000;
export const LOW_REPUTATION_THRESHOLD = 20;
export const MAX_REPORTS_PER_HOUR = 10;

export interface CandidateReport {
  lat: number;
  lng: number;
  createdAt: string;
  userId: string;
}

export interface VerificationEvaluation {
  verificationStatus: VerificationStatus;
  confirmedByReportIds: string[];
  isThrottled: boolean;
}

export interface RateLimitEvaluation {
  allowed: boolean;
  countInWindow: number;
  limit: number;
}

export function findCorroboratingReports(
  candidate: CandidateReport,
  existingReports: readonly Report[]
): Report[] {
  const candidateTime = new Date(candidate.createdAt).getTime();

  return existingReports.filter((report) => {
    if (report.userId === candidate.userId) {
      return false;
    }

    if (report.moderationStatus === "ถูกซ่อน") {
      return false;
    }

    const reportTime = new Date(report.createdAt).getTime();
    const isWithinWindow = Math.abs(candidateTime - reportTime) <= VERIFICATION_WINDOW_MS;
    const isWithinRadius =
      distanceMeters(candidate, report) <= VERIFICATION_RADIUS_METERS;

    return isWithinWindow && isWithinRadius;
  });
}

export function evaluateCandidateReport(
  candidate: CandidateReport,
  existingReports: readonly Report[],
  userReputationScore: number
): VerificationEvaluation {
  const corroboratingReports = findCorroboratingReports(candidate, existingReports);

  return {
    verificationStatus: corroboratingReports.length > 0 ? "ยืนยันแล้ว" : "รอการยืนยัน",
    confirmedByReportIds: corroboratingReports.map((report) => report.id),
    isThrottled: userReputationScore < LOW_REPUTATION_THRESHOLD
  };
}

export function applyVerificationToReputation(
  currentScore: number,
  status: VerificationStatus
): number {
  if (status === "ยืนยันแล้ว") {
    return currentScore + 5;
  }

  if (status === "ถูกปฏิเสธ") {
    return Math.max(0, currentScore - 15);
  }

  return currentScore;
}

export function evaluateHourlyRateLimit(
  userId: string,
  reports: readonly Report[],
  now: Date
): RateLimitEvaluation {
  const windowStart = now.getTime() - VERIFICATION_WINDOW_MS;
  const countInWindow = reports.filter((report) => {
    const createdAt = new Date(report.createdAt).getTime();
    return report.userId === userId && createdAt >= windowStart && createdAt <= now.getTime();
  }).length;

  return {
    allowed: countInWindow < MAX_REPORTS_PER_HOUR,
    countInWindow,
    limit: MAX_REPORTS_PER_HOUR
  };
}
