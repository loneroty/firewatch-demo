import {
  AGING_REPORT_MINUTES,
  formatZoneAge,
  type AlertZone,
  type RiskLevel
} from "@/lib/incidentIntelligence";
import { getCategoryLabel, getSeverityLabel } from "@/lib/reportLabels";
import type { Report, Severity, VerificationStatus } from "@/lib/types";

export type IncidentTimelineEventKind =
  | "new-report"
  | "high-severity"
  | "verified-report";

export interface IncidentTimelineEvent {
  id: string;
  reportId: string;
  occurredAt: string;
  ageMinutes: number | null;
  isOldReport: boolean;
  kind: IncidentTimelineEventKind;
  title: string;
  detail: string;
  categoryLabel: string;
  severity: Severity;
  severityLabel: string;
  verificationStatus: VerificationStatus;
  addressLabel: string;
}

export interface FieldRecommendation {
  title: string;
  detail: string;
  steps: string[];
}

export interface IncidentDetail {
  zone: AlertZone;
  reports: Report[];
  missingReportIds: string[];
  timeline: IncidentTimelineEvent[];
  recommendation: FieldRecommendation;
}

const recommendations: Record<RiskLevel, FieldRecommendation> = {
  "เฝ้าระวัง": {
    title: "ติดตามต่อและตรวจความสอดคล้อง",
    detail:
      "พื้นที่นี้ยังควรใช้เป็นสัญญาณเฝ้าระวัง ไม่ใช่ข้อสรุปว่าเกิดเหตุจริง ควรรอหลักฐานเพิ่มและดูว่ารูปกับพิกัดสอดคล้องกันหรือไม่",
    steps: [
      "ติดตามรายงานใหม่ในพื้นที่ใกล้เคียง",
      "ตรวจว่ารูปถ่าย พิกัด และเวลารายงานไปในทิศทางเดียวกัน",
      "ใช้เป็นบริบทประกอบการเฝ้าระวัง ไม่ใช้เป็นคำสั่งปฏิบัติการโดยลำพัง"
    ]
  },
  "น่ากังวล": {
    title: "ตรวจสอบหลักฐานก่อนสรุปสถานการณ์",
    detail:
      "พื้นที่นี้มีสัญญาณที่ควรตรวจเพิ่ม ควรดูรูปถ่าย รายงานใกล้เคียง และความสดของข้อมูลก่อนประเมินระดับสถานการณ์",
    steps: [
      "ตรวจสอบรูปและตำแหน่งของรายงานใน zone",
      "เทียบกับรายงานใกล้เคียงในช่วงเวลาเดียวกัน",
      "เตรียมพื้นที่นี้ไว้เป็นจุดที่ควรถูกทบทวนก่อนรายงานเดี่ยวทั่วไป"
    ]
  },
  "ควรตรวจสอบเร่งด่วน": {
    title: "จัดเป็นลำดับต้นสำหรับการตรวจสอบภาคสนาม",
    detail:
      "พื้นที่นี้ควรถูกให้ความสำคัญสูงในการตรวจสอบ แต่ระบบยังเป็นเครื่องมือช่วยจัดลำดับ ไม่ใช่การยืนยันเหตุจริงแทนเจ้าหน้าที่",
    steps: [
      "ให้ความสำคัญกับพื้นที่นี้ก่อน zone ระดับต่ำกว่า",
      "ตรวจสอบรายงานความรุนแรงสูงและรายงานที่ได้รับการยืนยันแล้ว",
      "ใช้ข้อมูลนี้ประกอบการตัดสินใจภาคสนามร่วมกับแหล่งข้อมูลทางการ"
    ]
  }
};

function parseTime(value: string): number | null {
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : null;
}

function getEventKind(report: Report): IncidentTimelineEventKind {
  if (report.verificationStatus === "ยืนยันแล้ว") {
    return "verified-report";
  }

  if (report.severity === 3) {
    return "high-severity";
  }

  return "new-report";
}

function getEventTitle(kind: IncidentTimelineEventKind): string {
  if (kind === "verified-report") {
    return "รายงานที่ยืนยันแล้ว";
  }

  if (kind === "high-severity") {
    return "รายงานความรุนแรงสูง";
  }

  return "รายงานใหม่เข้าพื้นที่";
}

function buildEventDetail(report: Report, ageMinutes: number | null): string {
  const ageLabel = ageMinutes === null ? "เวลาไม่ชัดเจน" : formatZoneAge(ageMinutes);
  const oldContext =
    ageMinutes !== null && ageMinutes > AGING_REPORT_MINUTES
      ? " รายงานนี้เริ่มเก่าแล้ว ควรใช้เป็นบริบทประกอบการติดตาม"
      : "";

  return `${getCategoryLabel(report.category)} · ${getSeverityLabel(report.severity)} · ${report.addressLabel} · ${ageLabel}${oldContext}`;
}

function buildTimelineEvent(report: Report, nowMs: number): IncidentTimelineEvent {
  const parsedTime = parseTime(report.createdAt);
  const ageMinutes =
    parsedTime === null ? null : Math.max(0, Math.floor((nowMs - parsedTime) / 60_000));
  const kind = getEventKind(report);

  return {
    id: `event-${report.id}`,
    reportId: report.id,
    occurredAt: report.createdAt,
    ageMinutes,
    isOldReport: ageMinutes !== null && ageMinutes > AGING_REPORT_MINUTES,
    kind,
    title: getEventTitle(kind),
    detail: buildEventDetail(report, ageMinutes),
    categoryLabel: getCategoryLabel(report.category),
    severity: report.severity,
    severityLabel: getSeverityLabel(report.severity),
    verificationStatus: report.verificationStatus,
    addressLabel: report.addressLabel
  };
}

function compareReportsByCreatedAt(a: Report, b: Report): number {
  const aTime = parseTime(a.createdAt) ?? 0;
  const bTime = parseTime(b.createdAt) ?? 0;

  if (aTime !== bTime) {
    return aTime - bTime;
  }

  return a.id.localeCompare(b.id);
}

export function getFieldRecommendation(riskLevel: RiskLevel): FieldRecommendation {
  return recommendations[riskLevel];
}

export function buildIncidentDetail(
  selectedZoneId: string | null,
  zones: readonly AlertZone[],
  reports: readonly Report[],
  now = new Date()
): IncidentDetail | null {
  if (!selectedZoneId) {
    return null;
  }

  const zone = zones.find((candidateZone) => candidateZone.id === selectedZoneId);
  if (!zone) {
    return null;
  }

  const reportsById = new Map(reports.map((report) => [report.id, report]));
  const zoneReports = zone.reportIds
    .map((reportId) => reportsById.get(reportId) ?? null)
    .filter((report): report is Report => report !== null)
    .sort(compareReportsByCreatedAt);
  const missingReportIds = zone.reportIds.filter((reportId) => !reportsById.has(reportId));
  const nowMs = now.getTime();
  const timeline = zoneReports.map((report) => buildTimelineEvent(report, nowMs));

  return {
    zone,
    reports: zoneReports,
    missingReportIds,
    timeline,
    recommendation: getFieldRecommendation(zone.riskLevel)
  };
}
