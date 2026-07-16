import type { AlertZone, RiskLevel } from "@/lib/incidentIntelligence";
import type { Severity } from "@/lib/types";

export type ServerIncidentZoneDocumentStatus = "active" | "resolved";

export interface AdaptedServerIncidentZone {
  zone: AlertZone;
  status: ServerIncidentZoneDocumentStatus;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function toEpochMilliseconds(value: unknown): number | null {
  if (value instanceof Date) {
    return value.getTime();
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.trunc(value);
  }
  if (typeof value === "string") {
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  if (isRecord(value) && typeof value.toMillis === "function") {
    const milliseconds = value.toMillis();
    return typeof milliseconds === "number" && Number.isFinite(milliseconds)
      ? Math.trunc(milliseconds)
      : null;
  }
  if (
    isRecord(value) &&
    typeof value.seconds === "number" &&
    typeof value.nanoseconds === "number"
  ) {
    return Math.trunc(value.seconds * 1_000 + value.nanoseconds / 1_000_000);
  }
  return null;
}

function readStringArray(value: unknown): string[] | null {
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) {
    return null;
  }
  return [...new Set(value)];
}

export function adaptServerIncidentZonePayload(
  zoneId: string,
  value: unknown,
  now = new Date()
): AdaptedServerIncidentZone | null {
  if (!isRecord(value) || zoneId.trim().length === 0) {
    return null;
  }

  const reportIds = readStringArray(value.reportIds);
  const riskFactors = readStringArray(value.riskFactors);
  const latestReportAt = toEpochMilliseconds(value.latestReportAt);
  const status = value.status;
  const riskLevel = value.riskLevel;
  const maxSeverity = value.maxSeverity;
  if (
    reportIds === null ||
    reportIds.length === 0 ||
    riskFactors === null ||
    latestReportAt === null ||
    (status !== "active" && status !== "resolved") ||
    (riskLevel !== "เฝ้าระวัง" &&
      riskLevel !== "น่ากังวล" &&
      riskLevel !== "ควรตรวจสอบเร่งด่วน") ||
    (maxSeverity !== 1 && maxSeverity !== 2 && maxSeverity !== 3) ||
    typeof value.centerLat !== "number" ||
    !Number.isFinite(value.centerLat) ||
    typeof value.centerLng !== "number" ||
    !Number.isFinite(value.centerLng) ||
    typeof value.riskScore !== "number" ||
    !Number.isFinite(value.riskScore) ||
    typeof value.averageSeverity !== "number" ||
    !Number.isFinite(value.averageSeverity) ||
    typeof value.verifiedReportCount !== "number" ||
    !Number.isInteger(value.verifiedReportCount)
  ) {
    return null;
  }

  const nowMilliseconds = now.getTime();
  const latestReportAgeMinutes = Number.isFinite(nowMilliseconds)
    ? Math.max(0, Math.floor((nowMilliseconds - latestReportAt) / 60_000))
    : 0;

  return {
    status,
    zone: {
      id: zoneId,
      reportIds,
      reportCount:
        typeof value.reportCount === "number" &&
        Number.isInteger(value.reportCount) &&
        value.reportCount >= 0
          ? value.reportCount
          : reportIds.length,
      centerLat: value.centerLat,
      centerLng: value.centerLng,
      latestReportAt: new Date(latestReportAt).toISOString(),
      latestReportAgeMinutes,
      maxSeverity: maxSeverity as Severity,
      averageSeverity: Number(value.averageSeverity.toFixed(1)),
      verifiedReportCount: value.verifiedReportCount,
      riskLevel: riskLevel as RiskLevel,
      riskScore: value.riskScore,
      primaryAddressLabel:
        typeof value.primaryAddressLabel === "string" &&
        value.primaryAddressLabel.trim().length > 0
          ? value.primaryAddressLabel.trim()
          : "ไม่ระบุพื้นที่",
      riskFactors
    }
  };
}

export type IncidentZoneReadinessStatus =
  | "not-ready"
  | "backfilling"
  | "ready"
  | "error";

export function readIncidentZoneReadinessStatus(
  value: unknown
): IncidentZoneReadinessStatus {
  if (!isRecord(value)) {
    return "not-ready";
  }
  const status = value.status;
  return status === "backfilling" || status === "ready" || status === "error"
    ? status
    : "not-ready";
}

