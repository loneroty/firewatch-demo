import { encodeGeohash } from "../geohash";
import {
  assignStableZoneIds,
  type StableIdentityComponent
} from "./stableIdentity";
import {
  calculateZoneStateHash,
  normalizeIncidentZoneState
} from "./stateHash";
import {
  INCIDENT_ZONE_REPORT_CATEGORIES,
  type ExcludedIncidentZoneReport,
  type IncidentZoneBuildOptions,
  type IncidentZoneBuildResult,
  type IncidentZoneCategoryCounts,
  type IncidentZoneMembership,
  type IncidentZoneReport,
  type IncidentZoneReportCategory,
  type IncidentZoneRiskLevel,
  type IncidentZoneSeverity,
  type IncidentZoneState
} from "./types";

export const INCIDENT_ZONE_ALGORITHM_VERSION = "incident-zone-v1";
export const INCIDENT_ZONE_RADIUS_METERS = 500;
export const WATCH_WINDOW_MS = 60 * 60 * 1000;
export const ACTIVE_MEMBERSHIP_WINDOW_MS = 180 * 60 * 1000;
export const STALE_WINDOW_MS = 360 * 60 * 1000;
export const MAX_CANDIDATE_REPORTS = 1_000;
export const MAX_BFS_EXPANSION_ROUNDS = 64;
export const CONCERN_RISK_SCORE = 5;
export const URGENT_RISK_SCORE = 7;

const EARTH_RADIUS_METERS = 6_371_000;

interface EligibleIncidentZoneReport extends IncidentZoneReport {
  ageMs: number;
}

interface ReportComponent extends StableIdentityComponent {
  reports: EligibleIncidentZoneReport[];
}

type ClusterResult =
  | {
      status: "ok";
      components: ReportComponent[];
    }
  | {
      status: "limit-exceeded";
      observed: number;
    };

function compareText(a: string, b: string): number {
  if (a < b) {
    return -1;
  }

  if (a > b) {
    return 1;
  }

  return 0;
}

function compareNumbers(a: number, b: number): number {
  if (Object.is(a, b) || a === b) {
    return 0;
  }

  if (Number.isFinite(a) && Number.isFinite(b)) {
    return a < b ? -1 : 1;
  }

  return compareText(String(a), String(b));
}

function compareReportsForDeduplication(
  a: IncidentZoneReport,
  b: IncidentZoneReport
): number {
  const comparisons = [
    compareText(a.id, b.id),
    compareNumbers(a.createdAt, b.createdAt),
    compareNumbers(a.lat, b.lat),
    compareNumbers(a.lng, b.lng),
    compareText(a.category, b.category),
    compareNumbers(a.severity, b.severity),
    compareText(a.verificationStatus, b.verificationStatus),
    compareText(a.moderationStatus, b.moderationStatus),
    compareText(a.addressLabel ?? "", b.addressLabel ?? "")
  ];

  return comparisons.find((comparison) => comparison !== 0) ?? 0;
}

function compareReportsByAnchor(
  a: EligibleIncidentZoneReport,
  b: EligibleIncidentZoneReport
): number {
  if (a.createdAt !== b.createdAt) {
    return a.createdAt - b.createdAt;
  }

  return compareText(a.id, b.id);
}

function comparePreviousZones(a: IncidentZoneState, b: IncidentZoneState): number {
  if (a.createdAt !== b.createdAt) {
    return a.createdAt - b.createdAt;
  }

  return compareText(a.id, b.id);
}

function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

function distanceMeters(
  a: Readonly<{ lat: number; lng: number }>,
  b: Readonly<{ lat: number; lng: number }>
): number {
  const deltaLat = toRadians(b.lat - a.lat);
  const deltaLng = toRadians(b.lng - a.lng);
  const lat1 = toRadians(a.lat);
  const lat2 = toRadians(b.lat);
  const haversine =
    Math.sin(deltaLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLng / 2) ** 2;

  return (
    2 *
    EARTH_RADIUS_METERS *
    Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine))
  );
}

function normalizeLimit(value: number | undefined, fallback: number): number {
  if (value === undefined) {
    return fallback;
  }

  if (!Number.isInteger(value) || value < 1) {
    throw new RangeError("Incident-zone limits must be positive integers.");
  }

  return value;
}

function isValidReport(report: IncidentZoneReport): boolean {
  return (
    report.id.trim().length > 0 &&
    Number.isFinite(report.lat) &&
    report.lat >= -90 &&
    report.lat <= 90 &&
    Number.isFinite(report.lng) &&
    report.lng >= -180 &&
    report.lng <= 180 &&
    Number.isFinite(report.createdAt) &&
    INCIDENT_ZONE_REPORT_CATEGORIES.includes(report.category) &&
    (report.severity === 1 || report.severity === 2 || report.severity === 3)
  );
}

function selectEligibleReports(
  reports: readonly IncidentZoneReport[],
  now: number
): {
  eligibleReports: EligibleIncidentZoneReport[];
  excludedReports: ExcludedIncidentZoneReport[];
  uniqueReports: IncidentZoneReport[];
} {
  const seenReportIds = new Set<string>();
  const eligibleReports: EligibleIncidentZoneReport[] = [];
  const excludedReports: ExcludedIncidentZoneReport[] = [];
  const uniqueReports: IncidentZoneReport[] = [];

  [...reports]
    .sort(compareReportsForDeduplication)
    .forEach((report) => {
      if (seenReportIds.has(report.id)) {
        excludedReports.push({
          reportId: report.id,
          reason: "duplicate-id"
        });
        return;
      }

      seenReportIds.add(report.id);
      uniqueReports.push(report);

      if (!isValidReport(report)) {
        excludedReports.push({ reportId: report.id, reason: "invalid" });
        return;
      }

      if (report.moderationStatus === "ถูกซ่อน") {
        excludedReports.push({ reportId: report.id, reason: "hidden" });
        return;
      }

      if (report.verificationStatus === "ถูกปฏิเสธ") {
        excludedReports.push({ reportId: report.id, reason: "rejected" });
        return;
      }

      const ageMs = now - report.createdAt;
      if (ageMs < 0) {
        excludedReports.push({ reportId: report.id, reason: "future" });
        return;
      }

      if (ageMs >= STALE_WINDOW_MS) {
        excludedReports.push({ reportId: report.id, reason: "stale" });
        return;
      }

      if (ageMs >= ACTIVE_MEMBERSHIP_WINDOW_MS) {
        excludedReports.push({
          reportId: report.id,
          reason: "inactive-window"
        });
        return;
      }

      eligibleReports.push({ ...report, ageMs });
    });

  eligibleReports.sort(compareReportsByAnchor);
  excludedReports.sort((a, b) => {
    const idDifference = compareText(a.reportId, b.reportId);
    return idDifference !== 0
      ? idDifference
      : compareText(a.reason, b.reason);
  });

  return { eligibleReports, excludedReports, uniqueReports };
}

function clusterReports(
  reports: readonly EligibleIncidentZoneReport[],
  maxBfsRounds: number
): ClusterResult {
  const unvisitedReportIds = new Set(reports.map((report) => report.id));
  const components: ReportComponent[] = [];

  for (const seed of reports) {
    if (!unvisitedReportIds.has(seed.id)) {
      continue;
    }

    unvisitedReportIds.delete(seed.id);
    let frontier: EligibleIncidentZoneReport[] = [seed];
    const componentReports: EligibleIncidentZoneReport[] = [];
    let expansionRound = 0;

    while (frontier.length > 0) {
      expansionRound += 1;
      if (expansionRound > maxBfsRounds) {
        return { status: "limit-exceeded", observed: expansionRound };
      }

      const nextFrontier: EligibleIncidentZoneReport[] = [];
      frontier.forEach((currentReport) => {
        componentReports.push(currentReport);

        reports.forEach((candidateReport) => {
          if (!unvisitedReportIds.has(candidateReport.id)) {
            return;
          }

          if (
            distanceMeters(currentReport, candidateReport) <=
            INCIDENT_ZONE_RADIUS_METERS
          ) {
            unvisitedReportIds.delete(candidateReport.id);
            nextFrontier.push(candidateReport);
          }
        });
      });

      frontier = nextFrontier.sort(compareReportsByAnchor);
    }

    componentReports.sort(compareReportsByAnchor);
    const anchor = componentReports[0];
    if (!anchor) {
      continue;
    }

    const reportIds = componentReports.map((report) => report.id).sort(compareText);
    components.push({
      key: JSON.stringify(reportIds),
      reportIds,
      anchorReportId: anchor.id,
      anchorCreatedAt: anchor.createdAt,
      reports: componentReports
    });
  }

  components.sort((a, b) => compareText(a.key, b.key));
  return { status: "ok", components };
}

function emptyCategoryCounts(): IncidentZoneCategoryCounts {
  return {
    industrial_smoke: 0,
    open_burning: 0,
    other: 0,
    wildfire_smoke: 0
  };
}

function calculateCategoryState(
  reports: readonly EligibleIncidentZoneReport[]
): {
  categories: IncidentZoneReportCategory[];
  categoryCounts: IncidentZoneCategoryCounts;
} {
  const categoryCounts = emptyCategoryCounts();
  reports.forEach((report) => {
    categoryCounts[report.category] += 1;
  });

  const categories = INCIDENT_ZONE_REPORT_CATEGORIES.filter(
    (category) => categoryCounts[category] > 0
  );

  return { categories, categoryCounts };
}

function calculateRiskScore(
  reportCount: number,
  maxSeverity: IncidentZoneSeverity,
  verifiedReportCount: number,
  latestReportAgeMs: number
): number {
  const reportCountScore = reportCount <= 1 ? 0 : reportCount >= 3 ? 3 : 2;
  const verifiedScore = verifiedReportCount > 0 ? 1 : 0;
  const freshnessScore = latestReportAgeMs < WATCH_WINDOW_MS ? 2 : 0;

  return reportCountScore + maxSeverity + verifiedScore + freshnessScore;
}

function calculateRiskLevel(riskScore: number): IncidentZoneRiskLevel {
  if (riskScore >= URGENT_RISK_SCORE) {
    return "ควรตรวจสอบเร่งด่วน";
  }

  if (riskScore >= CONCERN_RISK_SCORE) {
    return "น่ากังวล";
  }

  return "เฝ้าระวัง";
}

function riskRankFor(level: IncidentZoneRiskLevel): number {
  if (level === "ควรตรวจสอบเร่งด่วน") {
    return 3;
  }

  if (level === "น่ากังวล") {
    return 2;
  }

  return 1;
}

function buildRiskFactors(
  reportCount: number,
  maxSeverity: IncidentZoneSeverity,
  verifiedReportCount: number,
  latestReportAgeMs: number
): string[] {
  const factors = [
    `${reportCount} รายงานในรัศมี ${INCIDENT_ZONE_RADIUS_METERS} เมตร`,
    `ความรุนแรงสูงสุดระดับ ${maxSeverity}`,
    latestReportAgeMs < WATCH_WINDOW_MS
      ? "มีรายงานใหม่ใน 60 นาที"
      : "อยู่ในช่วงติดตามต่อเนื่องไม่เกิน 180 นาที"
  ];

  factors.push(
    verifiedReportCount > 0
      ? `${verifiedReportCount} รายงานผ่านการยืนยันแล้ว`
      : "ยังรอหลักฐานยืนยันเพิ่มเติม"
  );

  return factors;
}

function calculateNextEvaluationAt(
  latestReportAt: number,
  now: number
): number | null {
  const watchBoundary = latestReportAt + WATCH_WINDOW_MS;
  if (now < watchBoundary) {
    return watchBoundary;
  }

  const activeBoundary = latestReportAt + ACTIVE_MEMBERSHIP_WINDOW_MS;
  return now < activeBoundary ? activeBoundary : null;
}

function selectLatestReport(
  reports: readonly EligibleIncidentZoneReport[]
): EligibleIncidentZoneReport {
  const [latest] = [...reports].sort((a, b) => {
    if (a.createdAt !== b.createdAt) {
      return b.createdAt - a.createdAt;
    }

    return compareText(a.id, b.id);
  });

  if (!latest) {
    throw new Error("An active incident zone requires at least one report.");
  }

  return latest;
}

function finalizeZoneState(
  candidate: IncidentZoneState,
  previousZone: IncidentZoneState | null,
  now: number
): IncidentZoneState {
  const normalizedCandidate = normalizeIncidentZoneState(candidate);
  const stateHash = calculateZoneStateHash(normalizedCandidate);
  const stateChanged = previousZone?.stateHash !== stateHash;

  return {
    ...normalizedCandidate,
    stateHash,
    createdAt: previousZone?.createdAt ?? Math.trunc(now),
    updatedAt:
      previousZone && !stateChanged ? previousZone.updatedAt : Math.trunc(now),
    version: previousZone
      ? stateChanged
        ? previousZone.version + 1
        : previousZone.version
      : 1
  };
}

function buildActiveZone(
  component: ReportComponent,
  zoneId: string,
  anchorReportId: string,
  previousZone: IncidentZoneState | null,
  now: number
): IncidentZoneState {
  const reportCount = component.reports.length;
  const latestReport = selectLatestReport(component.reports);
  const severityTotal = component.reports.reduce(
    (total, report) => total + report.severity,
    0
  );
  const maxSeverity = component.reports.reduce<IncidentZoneSeverity>(
    (currentMax, report) =>
      report.severity > currentMax ? report.severity : currentMax,
    1
  );
  const verifiedReportCount = component.reports.filter(
    (report) => report.verificationStatus === "ยืนยันแล้ว"
  ).length;
  const centerLat =
    component.reports.reduce((total, report) => total + report.lat, 0) /
    reportCount;
  const centerLng =
    component.reports.reduce((total, report) => total + report.lng, 0) /
    reportCount;
  const latestReportAgeMs = Math.max(0, now - latestReport.createdAt);
  const riskScore = calculateRiskScore(
    reportCount,
    maxSeverity,
    verifiedReportCount,
    latestReportAgeMs
  );
  const riskLevel = calculateRiskLevel(riskScore);
  const { categories, categoryCounts } = calculateCategoryState(
    component.reports
  );

  return finalizeZoneState(
    {
      id: zoneId,
      reportIds: component.reportIds,
      reportCount,
      centerLat,
      centerLng,
      geohash: encodeGeohash(centerLat, centerLng, 8),
      categories,
      categoryCounts,
      riskLevel,
      riskRank: riskRankFor(riskLevel),
      riskScore,
      maxSeverity,
      averageSeverity: severityTotal / reportCount,
      verifiedReportCount,
      latestReportAt: latestReport.createdAt,
      primaryAddressLabel:
        latestReport.addressLabel?.trim() || "ไม่ระบุพื้นที่",
      riskFactors: buildRiskFactors(
        reportCount,
        maxSeverity,
        verifiedReportCount,
        latestReportAgeMs
      ),
      status: "active",
      anchorReportId,
      algorithmVersion: INCIDENT_ZONE_ALGORITHM_VERSION,
      stateHash: "",
      nextEvaluationAt: calculateNextEvaluationAt(latestReport.createdAt, now),
      createdAt: previousZone?.createdAt ?? now,
      updatedAt: previousZone?.updatedAt ?? now,
      version: previousZone?.version ?? 1
    },
    previousZone,
    now
  );
}

function buildInactiveZone(
  previousZone: IncidentZoneState,
  reportsById: ReadonlyMap<string, IncidentZoneReport>,
  now: number
): IncidentZoneState {
  const knownReports = previousZone.reportIds
    .map((reportId) => reportsById.get(reportId))
    .filter((report): report is IncidentZoneReport => report !== undefined);
  const allKnownReportsHidden =
    knownReports.length === previousZone.reportIds.length &&
    knownReports.length > 0 &&
    knownReports.every((report) => report.moderationStatus === "ถูกซ่อน");

  return finalizeZoneState(
    {
      ...previousZone,
      status: allKnownReportsHidden ? "hidden" : "resolved",
      algorithmVersion: INCIDENT_ZONE_ALGORITHM_VERSION,
      stateHash: "",
      nextEvaluationAt: null
    },
    previousZone,
    now
  );
}

function buildMemberships(
  reports: readonly IncidentZoneReport[],
  previousZones: readonly IncidentZoneState[],
  components: readonly ReportComponent[],
  zoneIdByComponent: ReadonlyMap<string, string>,
  aliases: ReadonlyMap<string, string>,
  now: number
): IncidentZoneMembership[] {
  const memberships = new Map<string, IncidentZoneMembership>();

  reports.forEach((report) => {
    if (!memberships.has(report.id)) {
      memberships.set(report.id, {
        reportId: report.id,
        zoneId: null,
        status: "inactive",
        algorithmVersion: INCIDENT_ZONE_ALGORITHM_VERSION,
        updatedAt: Math.trunc(now)
      });
    }
  });

  [...previousZones].sort(comparePreviousZones).forEach((zone) => {
    const canonicalZoneId = aliases.get(zone.id) ?? zone.id;
    zone.reportIds.forEach((reportId) => {
      const current = memberships.get(reportId);
      if (!current || current.zoneId === null) {
        memberships.set(reportId, {
          reportId,
          zoneId: canonicalZoneId,
          status: "inactive",
          algorithmVersion: INCIDENT_ZONE_ALGORITHM_VERSION,
          updatedAt: Math.trunc(now)
        });
      }
    });
  });

  components.forEach((component) => {
    const zoneId = zoneIdByComponent.get(component.key);
    if (!zoneId) {
      throw new Error(`Missing stable zone assignment for ${component.key}.`);
    }

    component.reportIds.forEach((reportId) => {
      memberships.set(reportId, {
        reportId,
        zoneId,
        status: "active",
        algorithmVersion: INCIDENT_ZONE_ALGORITHM_VERSION,
        updatedAt: Math.trunc(now)
      });
    });
  });

  return [...memberships.values()].sort((a, b) =>
    compareText(a.reportId, b.reportId)
  );
}

export function buildCanonicalIncidentZones(
  reports: readonly IncidentZoneReport[],
  previousZones: readonly IncidentZoneState[],
  now: number,
  options: IncidentZoneBuildOptions = {}
): IncidentZoneBuildResult {
  if (!Number.isFinite(now)) {
    throw new RangeError("Incident-zone recomputation requires a finite now value.");
  }

  const maxCandidateReports = normalizeLimit(
    options.maxCandidateReports,
    MAX_CANDIDATE_REPORTS
  );
  const maxBfsRounds = normalizeLimit(
    options.maxBfsRounds,
    MAX_BFS_EXPANSION_ROUNDS
  );

  if (reports.length > maxCandidateReports) {
    return {
      status: "limit-exceeded",
      limit: "candidate-reports",
      maximum: maxCandidateReports,
      observed: reports.length,
      reportsConsidered: reports.length
    };
  }

  const { eligibleReports, excludedReports, uniqueReports } =
    selectEligibleReports(reports, now);
  const clusterResult = clusterReports(eligibleReports, maxBfsRounds);
  if (clusterResult.status === "limit-exceeded") {
    return {
      status: "limit-exceeded",
      limit: "bfs-rounds",
      maximum: maxBfsRounds,
      observed: clusterResult.observed,
      reportsConsidered: reports.length
    };
  }

  const previousZoneById = new Map<string, IncidentZoneState>();
  [...previousZones].sort(comparePreviousZones).forEach((zone) => {
    if (!previousZoneById.has(zone.id)) {
      previousZoneById.set(zone.id, zone);
    }
  });
  const normalizedPreviousZones = [...previousZoneById.values()];
  const identity = assignStableZoneIds(
    clusterResult.components,
    normalizedPreviousZones,
    now,
    INCIDENT_ZONE_ALGORITHM_VERSION
  );
  const componentByKey = new Map(
    clusterResult.components.map((component) => [component.key, component])
  );
  const activeZones: IncidentZoneState[] = [];
  const activePreviousZoneIds = new Set<string>();
  const zoneIdByComponent = new Map<string, string>();

  identity.assignments.forEach((assignment) => {
    const component = componentByKey.get(assignment.componentKey);
    if (!component) {
      throw new Error(`Missing incident-zone component ${assignment.componentKey}.`);
    }

    if (assignment.previousZone) {
      activePreviousZoneIds.add(assignment.previousZone.id);
    }
    zoneIdByComponent.set(component.key, assignment.zoneId);
    activeZones.push(
      buildActiveZone(
        component,
        assignment.zoneId,
        assignment.anchorReportId,
        assignment.previousZone,
        now
      )
    );
  });

  const reportsById = new Map(
    uniqueReports.map((report) => [report.id, report] as const)
  );
  const inactiveZones = normalizedPreviousZones
    .filter((zone) => !activePreviousZoneIds.has(zone.id))
    .map((zone) => buildInactiveZone(zone, reportsById, now));
  const zoneById = new Map<string, IncidentZoneState>();

  [...activeZones, ...inactiveZones].forEach((zone) => {
    if (zoneById.has(zone.id)) {
      throw new Error(`Stable identity produced duplicate zone ID ${zone.id}.`);
    }
    zoneById.set(zone.id, zone);
  });

  const zones = [...zoneById.values()].sort((a, b) => compareText(a.id, b.id));
  const zoneUpserts = zones.filter((zone) => {
    const previousZone = previousZoneById.get(zone.id);
    return !previousZone || previousZone.stateHash !== zone.stateHash;
  });
  const unchangedZoneIds = zones
    .filter((zone) => previousZoneById.get(zone.id)?.stateHash === zone.stateHash)
    .map((zone) => zone.id);
  const aliasTargets = new Map(
    identity.aliases.map((alias) => [alias.oldZoneId, alias.canonicalZoneId])
  );
  const memberships = buildMemberships(
    uniqueReports,
    normalizedPreviousZones,
    clusterResult.components,
    zoneIdByComponent,
    aliasTargets,
    now
  );

  return {
    status: "ok",
    plan: {
      zones,
      zoneUpserts,
      unchangedZoneIds,
      aliases: identity.aliases,
      memberships,
      excludedReports,
      stats: {
        reportsConsidered: reports.length,
        reportsEligible: eligibleReports.length,
        reportsExcluded: excludedReports.length,
        activeZones: activeZones.length,
        zonesCreated: activeZones.filter(
          (zone) => !previousZoneById.has(zone.id)
        ).length,
        zonesMerged: identity.mergedZoneCount,
        zonesSplit: identity.splitZoneCount,
        aliasesPlanned: identity.aliases.length,
        membershipsPlanned: memberships.length,
        stateChangesPlanned: zoneUpserts.length
      }
    }
  };
}
