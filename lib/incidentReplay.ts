import {
  buildAlertZones,
  type AlertZone,
  type RiskLevel
} from "@/lib/incidentIntelligence";
import type { Report, Severity } from "@/lib/types";

export type ReplayMode = "live" | "replay";
export type ReplaySpeed = 1 | 2 | 4;
export type ReplayWindowKey = "1h" | "3h" | "6h" | "12h" | "24h" | "all";

export const REPLAY_DEFAULT_WINDOW: ReplayWindowKey = "6h";
export const REPLAY_BASE_PLAYBACK_DURATION_MS = 30_000;
export const MAX_REPLAY_BUCKETS = 60;

export const REPLAY_WINDOW_MS: Readonly<Record<ReplayWindowKey, number | null>> = {
  "1h": 60 * 60 * 1_000,
  "3h": 3 * 60 * 60 * 1_000,
  "6h": 6 * 60 * 60 * 1_000,
  "12h": 12 * 60 * 60 * 1_000,
  "24h": 24 * 60 * 60 * 1_000,
  all: null
};

export interface PreparedReplayReport {
  report: Report;
  createdAtMs: number;
}

export interface ReplayTimeBounds {
  startMs: number;
  endMs: number;
}

export interface ReplayBucket {
  index: number;
  startMs: number;
  endMs: number;
  reportCount: number;
  severity3Count: number;
  verifiedCount: number;
}

export interface ReplayHeatPoint {
  reportId: string;
  lat: number;
  lng: number;
  severity: Severity;
  verified: boolean;
  weight: number;
}

export interface ReplayMetrics {
  reportCount: number;
  alertZoneCount: number;
  severity3Count: number;
  verifiedCount: number;
}

export interface ReplaySnapshot {
  cursorMs: number;
  reports: Report[];
  alertZones: AlertZone[];
  heatPoints: ReplayHeatPoint[];
  metrics: ReplayMetrics;
}

export interface ReplayChangeSummary {
  newReportCount: number;
  newZoneCount: number;
  riskEscalationCount: number;
  zoneMergeCount: number;
  severity3Delta: number;
  confirmedDelta: number;
}

export interface ReplayViewData {
  reports: readonly Report[];
  alertZones: readonly AlertZone[];
}

const riskRank: Readonly<Record<RiskLevel, number>> = {
  "เฝ้าระวัง": 1,
  "น่ากังวล": 2,
  "ควรตรวจสอบเร่งด่วน": 3
};

const severityHeatWeight: Readonly<Record<Severity, number>> = {
  1: 0.3,
  2: 0.55,
  3: 0.8
};

function parseReportTime(report: Report): number | null {
  const parsed = Date.parse(report.createdAt);
  return Number.isFinite(parsed) ? Math.trunc(parsed) : null;
}

function isReplayEligible(report: Report, createdAtMs: number | null): createdAtMs is number {
  return (
    createdAtMs !== null &&
    report.moderationStatus !== "ถูกซ่อน" &&
    report.verificationStatus !== "ถูกปฏิเสธ" &&
    Number.isFinite(report.lat) &&
    report.lat >= -90 &&
    report.lat <= 90 &&
    Number.isFinite(report.lng) &&
    report.lng >= -180 &&
    report.lng <= 180
  );
}

function comparePreparedReports(
  first: PreparedReplayReport,
  second: PreparedReplayReport
): number {
  if (first.createdAtMs !== second.createdAtMs) {
    return first.createdAtMs - second.createdAtMs;
  }
  if (first.report.id !== second.report.id) {
    return first.report.id.localeCompare(second.report.id);
  }
  if (first.report.severity !== second.report.severity) {
    return first.report.severity - second.report.severity;
  }
  if (first.report.lat !== second.report.lat) {
    return first.report.lat - second.report.lat;
  }
  return first.report.lng - second.report.lng;
}

function lowerBound(
  reports: readonly PreparedReplayReport[],
  timestampMs: number
): number {
  let low = 0;
  let high = reports.length;
  while (low < high) {
    const middle = Math.floor((low + high) / 2);
    const candidate = reports[middle];
    if (candidate && candidate.createdAtMs < timestampMs) {
      low = middle + 1;
    } else {
      high = middle;
    }
  }
  return low;
}

function upperBound(
  reports: readonly PreparedReplayReport[],
  timestampMs: number
): number {
  let low = 0;
  let high = reports.length;
  while (low < high) {
    const middle = Math.floor((low + high) / 2);
    const candidate = reports[middle];
    if (candidate && candidate.createdAtMs <= timestampMs) {
      low = middle + 1;
    } else {
      high = middle;
    }
  }
  return low;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

export function prepareReplayReports(
  reports: readonly Report[]
): PreparedReplayReport[] {
  return reports
    .map((report) => ({ report, createdAtMs: parseReportTime(report) }))
    .filter(
      (
        entry
      ): entry is { report: Report; createdAtMs: number } =>
        isReplayEligible(entry.report, entry.createdAtMs)
    )
    .sort(comparePreparedReports);
}

export function filterReportsAtCursor(
  preparedReports: readonly PreparedReplayReport[],
  cursorMs: number,
  windowStartMs = Number.NEGATIVE_INFINITY
): Report[] {
  if (!Number.isFinite(cursorMs) || !Number.isFinite(windowStartMs) && windowStartMs !== Number.NEGATIVE_INFINITY) {
    return [];
  }

  const startIndex = lowerBound(preparedReports, windowStartMs);
  const endIndex = upperBound(preparedReports, cursorMs);
  if (endIndex <= startIndex) {
    return [];
  }

  return preparedReports
    .slice(startIndex, endIndex)
    .map((entry) => entry.report);
}

export function findReplayTimeBounds(
  preparedReports: readonly PreparedReplayReport[],
  windowMs: number | null,
  nowMs: number
): ReplayTimeBounds | null {
  if (
    !Number.isFinite(nowMs) ||
    nowMs < 0 ||
    (windowMs !== null && (!Number.isFinite(windowMs) || windowMs <= 0))
  ) {
    return null;
  }

  const endIndex = upperBound(preparedReports, nowMs);
  const windowStartMs = windowMs === null
    ? Number.NEGATIVE_INFINITY
    : nowMs - windowMs;
  const startIndex = lowerBound(preparedReports, windowStartMs);
  const first = preparedReports[startIndex];
  if (!first || startIndex >= endIndex) {
    return null;
  }

  return {
    startMs: first.createdAtMs,
    endMs: Math.max(first.createdAtMs, Math.trunc(nowMs))
  };
}

export function buildReplayBuckets(
  preparedReports: readonly PreparedReplayReport[],
  bounds: ReplayTimeBounds | null,
  maximumBuckets = MAX_REPLAY_BUCKETS
): ReplayBucket[] {
  if (
    bounds === null ||
    !Number.isInteger(maximumBuckets) ||
    maximumBuckets < 1 ||
    bounds.endMs < bounds.startMs
  ) {
    return [];
  }

  const durationMs = Math.max(1, bounds.endMs - bounds.startMs);
  const bucketSizeMs = Math.max(1, Math.ceil(durationMs / maximumBuckets));
  const bucketCount = Math.max(
    1,
    Math.min(maximumBuckets, Math.ceil(durationMs / bucketSizeMs))
  );
  const buckets: ReplayBucket[] = Array.from(
    { length: bucketCount },
    (_, index) => ({
      index,
      startMs: bounds.startMs + index * bucketSizeMs,
      endMs:
        index === bucketCount - 1
          ? bounds.endMs
          : Math.min(bounds.endMs, bounds.startMs + (index + 1) * bucketSizeMs),
      reportCount: 0,
      severity3Count: 0,
      verifiedCount: 0
    })
  );

  const firstIndex = lowerBound(preparedReports, bounds.startMs);
  const lastIndex = upperBound(preparedReports, bounds.endMs);
  preparedReports.slice(firstIndex, lastIndex).forEach(({ report, createdAtMs }) => {
    const bucketIndex = Math.min(
      bucketCount - 1,
      Math.max(0, Math.floor((createdAtMs - bounds.startMs) / bucketSizeMs))
    );
    const bucket = buckets[bucketIndex];
    if (!bucket) {
      return;
    }
    bucket.reportCount += 1;
    bucket.severity3Count += report.severity === 3 ? 1 : 0;
    bucket.verifiedCount += report.verificationStatus === "ยืนยันแล้ว" ? 1 : 0;
  });

  return buckets;
}

export function calculateHeatPoints(
  reports: readonly Report[]
): ReplayHeatPoint[] {
  return reports
    .filter((report) => isReplayEligible(report, parseReportTime(report)))
    .map((report) => {
      const verified = report.verificationStatus === "ยืนยันแล้ว";
      return {
        reportId: report.id,
        lat: report.lat,
        lng: report.lng,
        severity: report.severity,
        verified,
        weight: Math.min(1, severityHeatWeight[report.severity] + (verified ? 0.15 : 0))
      };
    })
    .sort((first, second) => first.reportId.localeCompare(second.reportId));
}

export function calculateReplayMetrics(
  reports: readonly Report[],
  alertZones: readonly AlertZone[]
): ReplayMetrics {
  return {
    reportCount: reports.length,
    alertZoneCount: alertZones.length,
    severity3Count: reports.filter((report) => report.severity === 3).length,
    verifiedCount: reports.filter(
      (report) => report.verificationStatus === "ยืนยันแล้ว"
    ).length
  };
}

export function buildReplaySnapshot(
  preparedReports: readonly PreparedReplayReport[],
  cursorMs: number,
  windowStartMs = Number.NEGATIVE_INFINITY
): ReplaySnapshot {
  const normalizedCursorMs = Number.isFinite(cursorMs) ? Math.trunc(cursorMs) : 0;
  const reports = filterReportsAtCursor(
    preparedReports,
    normalizedCursorMs,
    windowStartMs
  );
  const alertZones = buildAlertZones(reports, new Date(normalizedCursorMs));

  return {
    cursorMs: normalizedCursorMs,
    reports,
    alertZones,
    heatPoints: calculateHeatPoints(reports),
    metrics: calculateReplayMetrics(reports, alertZones)
  };
}

export function buildReplayChangeSummary(
  previous: ReplaySnapshot,
  current: ReplaySnapshot
): ReplayChangeSummary {
  const previousReportIds = new Set(
    previous.reports.map((report) => report.id)
  );
  const previousZoneByReportId = new Map<string, AlertZone>();
  previous.alertZones.forEach((zone) => {
    zone.reportIds.forEach((reportId) => {
      previousZoneByReportId.set(reportId, zone);
    });
  });

  let newZoneCount = 0;
  let riskEscalationCount = 0;
  let zoneMergeCount = 0;
  current.alertZones.forEach((zone) => {
    const previousZones = new Map<string, AlertZone>();
    zone.reportIds.forEach((reportId) => {
      const previousZone = previousZoneByReportId.get(reportId);
      if (previousZone) {
        previousZones.set(previousZone.id, previousZone);
      }
    });

    if (previousZones.size === 0) {
      newZoneCount += 1;
      return;
    }
    if (previousZones.size > 1) {
      zoneMergeCount += 1;
    }
    const previousMaximumRiskRank = Math.max(
      ...[...previousZones.values()].map(
        (previousZone) => riskRank[previousZone.riskLevel]
      )
    );
    if (riskRank[zone.riskLevel] > previousMaximumRiskRank) {
      riskEscalationCount += 1;
    }
  });

  return {
    newReportCount: current.reports.filter(
      (report) => !previousReportIds.has(report.id)
    ).length,
    newZoneCount,
    riskEscalationCount,
    zoneMergeCount,
    severity3Delta:
      current.metrics.severity3Count - previous.metrics.severity3Count,
    confirmedDelta:
      current.metrics.verifiedCount - previous.metrics.verifiedCount
  };
}

export function snapReplayCursorToBucket(
  cursorMs: number,
  bounds: ReplayTimeBounds,
  buckets: readonly ReplayBucket[]
): number {
  const clamped = clamp(cursorMs, bounds.startMs, bounds.endMs);
  if (clamped <= bounds.startMs || buckets.length === 0) {
    return bounds.startMs;
  }
  if (clamped >= bounds.endMs) {
    return bounds.endMs;
  }

  let snapped = bounds.startMs;
  for (const bucket of buckets) {
    if (bucket.endMs > clamped) {
      break;
    }
    snapped = bucket.endMs;
  }
  return snapped;
}

export function advanceReplayCursor(
  startCursorMs: number,
  elapsedRealMs: number,
  bounds: ReplayTimeBounds,
  speed: ReplaySpeed
): { cursorMs: number; ended: boolean } {
  const durationMs = Math.max(0, bounds.endMs - bounds.startMs);
  if (
    durationMs === 0 ||
    !Number.isFinite(startCursorMs) ||
    !Number.isFinite(elapsedRealMs)
  ) {
    return { cursorMs: bounds.endMs, ended: true };
  }

  // The first requestAnimationFrame timestamp can trail performance.now()
  // slightly. Treat that frame as zero elapsed time instead of ending replay.
  const safeElapsedRealMs = Math.max(0, elapsedRealMs);
  const rate = durationMs / REPLAY_BASE_PLAYBACK_DURATION_MS;
  const cursorMs = clamp(
    startCursorMs + safeElapsedRealMs * rate * speed,
    bounds.startMs,
    bounds.endMs
  );
  return { cursorMs, ended: cursorMs >= bounds.endMs };
}

export function parseReplayTimestamp(
  value: string | null | undefined,
  fallbackMs: number
): number {
  if (!value || value.trim().length === 0) {
    return fallbackMs;
  }

  const normalized = value.trim();
  const numeric = Number(normalized);
  let parsed = Number.NaN;
  if (/^\d+(?:\.\d+)?$/.test(normalized) && Number.isFinite(numeric)) {
    parsed = numeric >= 1_000_000_000 && numeric < 1_000_000_000_000
      ? numeric * 1_000
      : numeric;
  } else {
    parsed = Date.parse(normalized);
  }

  return Number.isFinite(parsed) && parsed > 0 && parsed <= 8_640_000_000_000_000
    ? Math.trunc(parsed)
    : fallbackMs;
}

export function parseReplayWindow(
  value: string | null | undefined,
  fallback: ReplayWindowKey = REPLAY_DEFAULT_WINDOW
): ReplayWindowKey {
  return value === "1h" ||
    value === "3h" ||
    value === "6h" ||
    value === "12h" ||
    value === "24h" ||
    value === "all"
    ? value
    : fallback;
}

export function clampReplayCursor(
  cursorMs: number,
  bounds: ReplayTimeBounds
): number {
  return clamp(cursorMs, bounds.startMs, bounds.endMs);
}

export function shouldClearSelectedReplayZone(
  selectedZoneId: string | null,
  zones: readonly AlertZone[]
): boolean {
  return (
    selectedZoneId !== null &&
    !zones.some((zone) => zone.id === selectedZoneId)
  );
}

export function selectReplayViewData(
  mode: ReplayMode,
  liveReports: readonly Report[],
  liveAlertZones: readonly AlertZone[],
  replaySnapshot: ReplaySnapshot
): ReplayViewData {
  return mode === "live"
    ? { reports: liveReports, alertZones: liveAlertZones }
    : {
        reports: replaySnapshot.reports,
        alertZones: replaySnapshot.alertZones
      };
}
