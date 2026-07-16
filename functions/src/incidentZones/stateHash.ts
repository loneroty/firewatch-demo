import { createHash } from "node:crypto";
import type {
  IncidentZoneCategoryCounts,
  IncidentZoneReportCategory,
  IncidentZoneState
} from "./types";

export const INCIDENT_ZONE_CENTER_PRECISION = 6;

function compareText(a: string, b: string): number {
  if (a < b) {
    return -1;
  }

  if (a > b) {
    return 1;
  }

  return 0;
}

function roundNumber(value: number, precision: number): number {
  const factor = 10 ** precision;
  return Math.round(value * factor) / factor;
}

function normalizeCategoryCounts(
  counts: IncidentZoneCategoryCounts
): IncidentZoneCategoryCounts {
  return {
    industrial_smoke: Math.max(0, Math.trunc(counts.industrial_smoke)),
    open_burning: Math.max(0, Math.trunc(counts.open_burning)),
    other: Math.max(0, Math.trunc(counts.other)),
    wildfire_smoke: Math.max(0, Math.trunc(counts.wildfire_smoke))
  };
}

function uniqueSorted(values: readonly string[]): string[] {
  return [...new Set(values)].sort(compareText);
}

export function normalizeIncidentZoneState(
  state: IncidentZoneState
): IncidentZoneState {
  return {
    ...state,
    reportIds: uniqueSorted(state.reportIds),
    reportCount: Math.max(0, Math.trunc(state.reportCount)),
    centerLat: roundNumber(state.centerLat, INCIDENT_ZONE_CENTER_PRECISION),
    centerLng: roundNumber(state.centerLng, INCIDENT_ZONE_CENTER_PRECISION),
    categories: uniqueSorted(state.categories) as IncidentZoneReportCategory[],
    categoryCounts: normalizeCategoryCounts(state.categoryCounts),
    riskRank: Math.max(1, Math.trunc(state.riskRank)),
    riskScore: Math.trunc(state.riskScore),
    averageSeverity: roundNumber(state.averageSeverity, 1),
    verifiedReportCount: Math.max(0, Math.trunc(state.verifiedReportCount)),
    latestReportAt: Math.trunc(state.latestReportAt),
    primaryAddressLabel: state.primaryAddressLabel.trim(),
    riskFactors: uniqueSorted(state.riskFactors),
    nextEvaluationAt:
      state.nextEvaluationAt === null
        ? null
        : Math.trunc(state.nextEvaluationAt),
    createdAt: Math.trunc(state.createdAt),
    updatedAt: Math.trunc(state.updatedAt),
    version: Math.max(1, Math.trunc(state.version))
  };
}

function canonicalize(value: unknown): unknown {
  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "boolean"
  ) {
    return value;
  }

  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      throw new TypeError("Canonical state cannot contain non-finite numbers.");
    }

    return Object.is(value, -0) ? 0 : value;
  }

  if (Array.isArray(value)) {
    return value.map((item) => canonicalize(item));
  }

  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    const normalized: Record<string, unknown> = {};

    Object.keys(record)
      .sort(compareText)
      .forEach((key) => {
        const child = record[key];
        if (child !== undefined) {
          normalized[key] = canonicalize(child);
        }
      });

    return normalized;
  }

  throw new TypeError(`Unsupported canonical state value: ${typeof value}.`);
}

export function canonicalSerialize(value: unknown): string {
  return JSON.stringify(canonicalize(value));
}

export function calculateZoneStateHash(state: IncidentZoneState): string {
  const normalized = normalizeIncidentZoneState(state);
  const semanticState = {
    algorithmVersion: normalized.algorithmVersion,
    anchorReportId: normalized.anchorReportId,
    averageSeverity: normalized.averageSeverity,
    categories: normalized.categories,
    categoryCounts: normalized.categoryCounts,
    centerLat: normalized.centerLat,
    centerLng: normalized.centerLng,
    geohash: normalized.geohash,
    latestReportAt: normalized.latestReportAt,
    maxSeverity: normalized.maxSeverity,
    nextEvaluationAt: normalized.nextEvaluationAt,
    primaryAddressLabel: normalized.primaryAddressLabel,
    reportCount: normalized.reportCount,
    reportIds: normalized.reportIds,
    riskFactors: normalized.riskFactors,
    riskLevel: normalized.riskLevel,
    riskRank: normalized.riskRank,
    riskScore: normalized.riskScore,
    status: normalized.status,
    verifiedReportCount: normalized.verifiedReportCount
  };

  return createHash("sha256")
    .update(canonicalSerialize(semanticState), "utf8")
    .digest("hex");
}
