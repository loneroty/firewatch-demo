import type { Report, Severity } from "@/lib/types";
import { distanceMeters } from "@/lib/verification/geo";
import { VERIFICATION_RADIUS_METERS } from "@/lib/verification/reputation";

export const ALERT_ZONE_RADIUS_METERS = VERIFICATION_RADIUS_METERS;
export const FRESH_REPORT_MINUTES = 60;
export const AGING_REPORT_MINUTES = 180;
export const CONCERN_RISK_SCORE = 5;
export const URGENT_RISK_SCORE = 7;
export const ALERT_ZONE_RADIUS_STEP_METERS = 100;
export const ALERT_ZONE_MAX_OVERLAY_RADIUS_METERS = 900;

export type RiskLevel = "เฝ้าระวัง" | "น่ากังวล" | "ควรตรวจสอบเร่งด่วน";

export interface AlertZone {
  id: string;
  reportIds: string[];
  reportCount: number;
  centerLat: number;
  centerLng: number;
  latestReportAt: string;
  latestReportAgeMinutes: number;
  maxSeverity: Severity;
  averageSeverity: number;
  verifiedReportCount: number;
  riskLevel: RiskLevel;
  riskScore: number;
  primaryAddressLabel: string;
  riskFactors: string[];
}

export function getAlertZoneOverlayRadiusMeters(reportCount: number): number {
  const normalizedReportCount = Math.max(1, Math.floor(reportCount));
  const expandedRadius =
    ALERT_ZONE_RADIUS_METERS +
    (normalizedReportCount - 1) * ALERT_ZONE_RADIUS_STEP_METERS;

  return Math.min(expandedRadius, ALERT_ZONE_MAX_OVERLAY_RADIUS_METERS);
}

interface EligibleReport extends Report {
  parsedCreatedAt: number;
}

const riskRank: Record<RiskLevel, number> = {
  "ควรตรวจสอบเร่งด่วน": 3,
  "น่ากังวล": 2,
  "เฝ้าระวัง": 1
};

function isEligibleReport(report: Report): boolean {
  const parsedCreatedAt = new Date(report.createdAt).getTime();

  return (
    report.moderationStatus !== "ถูกซ่อน" &&
    report.verificationStatus !== "ถูกปฏิเสธ" &&
    Number.isFinite(report.lat) &&
    Number.isFinite(report.lng) &&
    Number.isFinite(parsedCreatedAt)
  );
}

function toEligibleReport(report: Report): EligibleReport {
  return {
    ...report,
    parsedCreatedAt: new Date(report.createdAt).getTime()
  };
}

function compareReports(a: EligibleReport, b: EligibleReport): number {
  if (b.parsedCreatedAt !== a.parsedCreatedAt) {
    return b.parsedCreatedAt - a.parsedCreatedAt;
  }

  if (b.severity !== a.severity) {
    return b.severity - a.severity;
  }

  return a.id.localeCompare(b.id);
}

function calculateRiskLevel(riskScore: number, latestReportAgeMinutes: number): RiskLevel {
  if (latestReportAgeMinutes > AGING_REPORT_MINUTES) {
    return "เฝ้าระวัง";
  }

  if (riskScore >= URGENT_RISK_SCORE) {
    return "ควรตรวจสอบเร่งด่วน";
  }

  if (riskScore >= CONCERN_RISK_SCORE) {
    return "น่ากังวล";
  }

  return "เฝ้าระวัง";
}

function calculateRiskScore(
  reportCount: number,
  maxSeverity: Severity,
  verifiedReportCount: number,
  latestReportAgeMinutes: number
): number {
  const reportCountScore = reportCount <= 1 ? 0 : reportCount >= 3 ? 3 : 2;
  const verifiedScore = verifiedReportCount > 0 ? 1 : 0;
  const freshnessScore =
    latestReportAgeMinutes <= FRESH_REPORT_MINUTES
      ? 2
      : latestReportAgeMinutes <= AGING_REPORT_MINUTES
        ? 0
        : -2;

  return reportCountScore + maxSeverity + verifiedScore + freshnessScore;
}

function buildRiskFactors(
  reportCount: number,
  maxSeverity: Severity,
  verifiedReportCount: number,
  latestReportAgeMinutes: number
): string[] {
  const factors = [
    `${reportCount} รายงานในรัศมี ${ALERT_ZONE_RADIUS_METERS} เมตร`,
    `ความรุนแรงสูงสุดระดับ ${maxSeverity}`
  ];

  if (latestReportAgeMinutes <= FRESH_REPORT_MINUTES) {
    factors.push("มีรายงานใหม่ใน 60 นาที");
  } else if (latestReportAgeMinutes <= AGING_REPORT_MINUTES) {
    factors.push("ยังอยู่ในช่วงติดตามต่อเนื่อง");
  } else {
    factors.push("รายงานล่าสุดเริ่มเก่าแล้ว");
  }

  if (verifiedReportCount > 0) {
    factors.push(`${verifiedReportCount} รายงานผ่านการยืนยันแล้ว`);
  } else {
    factors.push("ยังรอหลักฐานยืนยันเพิ่มเติม");
  }

  return factors;
}

function createZone(reports: readonly EligibleReport[], nowMs: number): AlertZone {
  const reportIds = reports.map((report) => report.id).sort();
  const reportCount = reports.length;
  const severityTotal = reports.reduce((sum, report) => sum + report.severity, 0);
  const latTotal = reports.reduce((sum, report) => sum + report.lat, 0);
  const lngTotal = reports.reduce((sum, report) => sum + report.lng, 0);
  const latestReport = reports.reduce((latest, report) =>
    report.parsedCreatedAt > latest.parsedCreatedAt ? report : latest
  );
  const maxSeverity = reports.reduce<Severity>(
    (currentMax, report) => (report.severity > currentMax ? report.severity : currentMax),
    1
  );
  const verifiedReportCount = reports.filter(
    (report) => report.verificationStatus === "ยืนยันแล้ว"
  ).length;
  const latestReportAgeMinutes = Math.max(
    0,
    Math.floor((nowMs - latestReport.parsedCreatedAt) / 60_000)
  );
  const averageSeverity = Number((severityTotal / reportCount).toFixed(1));
  const riskScore = calculateRiskScore(
    reportCount,
    maxSeverity,
    verifiedReportCount,
    latestReportAgeMinutes
  );
  const riskLevel = calculateRiskLevel(riskScore, latestReportAgeMinutes);

  return {
    id: `zone-${reportIds.join("-")}`,
    reportIds,
    reportCount,
    centerLat: latTotal / reportCount,
    centerLng: lngTotal / reportCount,
    latestReportAt: latestReport.createdAt,
    latestReportAgeMinutes,
    maxSeverity,
    averageSeverity,
    verifiedReportCount,
    riskLevel,
    riskScore,
    primaryAddressLabel: latestReport.addressLabel,
    riskFactors: buildRiskFactors(
      reportCount,
      maxSeverity,
      verifiedReportCount,
      latestReportAgeMinutes
    )
  };
}

function compareZones(a: AlertZone, b: AlertZone): number {
  const riskDifference = riskRank[b.riskLevel] - riskRank[a.riskLevel];
  if (riskDifference !== 0) {
    return riskDifference;
  }

  if (b.riskScore !== a.riskScore) {
    return b.riskScore - a.riskScore;
  }

  if (b.reportCount !== a.reportCount) {
    return b.reportCount - a.reportCount;
  }

  if (b.latestReportAgeMinutes !== a.latestReportAgeMinutes) {
    return a.latestReportAgeMinutes - b.latestReportAgeMinutes;
  }

  return a.id.localeCompare(b.id);
}

export function buildAlertZones(
  reports: readonly Report[],
  now = new Date()
): AlertZone[] {
  const nowMs = now.getTime();
  const eligibleReports = reports
    .filter(isEligibleReport)
    .map(toEligibleReport)
    .sort(compareReports);
  const visitedReportIds = new Set<string>();
  const zones: AlertZone[] = [];

  eligibleReports.forEach((seedReport) => {
    if (visitedReportIds.has(seedReport.id)) {
      return;
    }

    const zoneReports: EligibleReport[] = [];
    const queue: EligibleReport[] = [seedReport];
    visitedReportIds.add(seedReport.id);

    while (queue.length > 0) {
      const currentReport = queue.shift();
      if (!currentReport) {
        continue;
      }

      zoneReports.push(currentReport);

      eligibleReports.forEach((candidateReport) => {
        if (visitedReportIds.has(candidateReport.id)) {
          return;
        }

        if (distanceMeters(currentReport, candidateReport) <= ALERT_ZONE_RADIUS_METERS) {
          visitedReportIds.add(candidateReport.id);
          queue.push(candidateReport);
        }
      });
    }

    zones.push(createZone(zoneReports.sort(compareReports), nowMs));
  });

  return zones.sort(compareZones);
}

export function formatZoneAge(minutes: number): string {
  if (minutes <= 0) {
    return "เมื่อสักครู่";
  }

  if (minutes < 60) {
    return `${minutes} นาทีที่แล้ว`;
  }

  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return `${hours} ชั่วโมงที่แล้ว`;
  }

  const days = Math.floor(hours / 24);
  return `${days} วันที่แล้ว`;
}
