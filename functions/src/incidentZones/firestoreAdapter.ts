import { Timestamp } from "firebase-admin/firestore";
import type {
  IncidentZoneCategoryCounts,
  IncidentZoneReportCategory,
  IncidentZoneRiskLevel,
  IncidentZoneSeverity,
  IncidentZoneState,
  IncidentZoneStatus
} from "./types";

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function toEpochMilliseconds(value: unknown): number | null {
  if (value instanceof Timestamp) {
    return value.toMillis();
  }

  if (value instanceof Date) {
    return value.getTime();
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.trunc(value);
  }

  if (typeof value === "string" && value.trim().length > 0) {
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

export function toFirestoreTimestamp(epochMilliseconds: number): Timestamp {
  if (!Number.isFinite(epochMilliseconds)) {
    throw new RangeError("A Firestore timestamp requires finite milliseconds.");
  }

  return Timestamp.fromMillis(Math.trunc(epochMilliseconds));
}

function readStringArray(value: unknown): string[] | null {
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) {
    return null;
  }

  return [...new Set(value)].sort();
}

function readCategoryCounts(value: unknown): IncidentZoneCategoryCounts | null {
  if (!isRecord(value)) {
    return null;
  }

  const keys: (keyof IncidentZoneCategoryCounts)[] = [
    "industrial_smoke",
    "open_burning",
    "other",
    "wildfire_smoke"
  ];
  const entries = keys.map((key) => [key, value[key]] as const);
  if (
    entries.some(
      ([, count]) =>
        typeof count !== "number" || !Number.isInteger(count) || count < 0
    )
  ) {
    return null;
  }

  return Object.fromEntries(entries) as unknown as IncidentZoneCategoryCounts;
}

export function incidentZoneStateToFirestore(
  zone: IncidentZoneState
): Record<string, unknown> {
  return {
    ...zone,
    createdAt: toFirestoreTimestamp(zone.createdAt),
    latestReportAt: toFirestoreTimestamp(zone.latestReportAt),
    nextEvaluationAt:
      zone.nextEvaluationAt === null
        ? null
        : toFirestoreTimestamp(zone.nextEvaluationAt),
    updatedAt: toFirestoreTimestamp(zone.updatedAt)
  };
}

export function incidentZoneStateFromFirestore(
  zoneId: string,
  value: unknown
): IncidentZoneState | null {
  if (!isRecord(value)) {
    return null;
  }

  const reportIds = readStringArray(value.reportIds);
  const categories = readStringArray(value.categories);
  const categoryCounts = readCategoryCounts(value.categoryCounts);
  const riskFactors = readStringArray(value.riskFactors);
  const createdAt = toEpochMilliseconds(value.createdAt);
  const updatedAt = toEpochMilliseconds(value.updatedAt);
  const latestReportAt = toEpochMilliseconds(value.latestReportAt);
  const nextEvaluationAt =
    value.nextEvaluationAt === null || value.nextEvaluationAt === undefined
      ? null
      : toEpochMilliseconds(value.nextEvaluationAt);

  if (
    zoneId.trim().length === 0 ||
    reportIds === null ||
    categories === null ||
    categoryCounts === null ||
    riskFactors === null ||
    createdAt === null ||
    updatedAt === null ||
    latestReportAt === null ||
    (value.nextEvaluationAt !== null &&
      value.nextEvaluationAt !== undefined &&
      nextEvaluationAt === null) ||
    typeof value.centerLat !== "number" ||
    !Number.isFinite(value.centerLat) ||
    typeof value.centerLng !== "number" ||
    !Number.isFinite(value.centerLng) ||
    typeof value.geohash !== "string" ||
    typeof value.riskLevel !== "string" ||
    typeof value.riskRank !== "number" ||
    typeof value.riskScore !== "number" ||
    typeof value.maxSeverity !== "number" ||
    typeof value.averageSeverity !== "number" ||
    typeof value.verifiedReportCount !== "number" ||
    typeof value.primaryAddressLabel !== "string" ||
    typeof value.status !== "string" ||
    typeof value.anchorReportId !== "string" ||
    typeof value.algorithmVersion !== "string" ||
    typeof value.stateHash !== "string" ||
    typeof value.version !== "number"
  ) {
    return null;
  }

  const riskLevel = value.riskLevel as IncidentZoneRiskLevel;
  const status = value.status as IncidentZoneStatus;
  const maxSeverity = value.maxSeverity as IncidentZoneSeverity;
  const typedCategories = categories as IncidentZoneReportCategory[];
  if (
    !["เฝ้าระวัง", "น่ากังวล", "ควรตรวจสอบเร่งด่วน"].includes(riskLevel) ||
    !["active", "resolved", "hidden"].includes(status) ||
    ![1, 2, 3].includes(maxSeverity) ||
    typedCategories.some(
      (category) =>
        !["open_burning", "wildfire_smoke", "industrial_smoke", "other"].includes(
          category
        )
    )
  ) {
    return null;
  }

  return {
    id: zoneId,
    reportIds,
    reportCount: reportIds.length,
    centerLat: value.centerLat,
    centerLng: value.centerLng,
    geohash: value.geohash,
    categories: typedCategories,
    categoryCounts,
    riskLevel,
    riskRank: value.riskRank,
    riskScore: value.riskScore,
    maxSeverity,
    averageSeverity: value.averageSeverity,
    verifiedReportCount: value.verifiedReportCount,
    latestReportAt,
    primaryAddressLabel: value.primaryAddressLabel,
    riskFactors,
    status,
    anchorReportId: value.anchorReportId,
    algorithmVersion: value.algorithmVersion,
    stateHash: value.stateHash,
    nextEvaluationAt,
    createdAt,
    updatedAt,
    version: value.version
  };
}

