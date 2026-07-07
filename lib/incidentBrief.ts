import { buildGoogleMapsUrl, formatHandoffCoordinate } from "@/lib/emergencyHandoff";
import type { IncidentDetail, IncidentTimelineEvent } from "@/lib/incidentDetail";
import { formatZoneAge } from "@/lib/incidentIntelligence";
import { getCategoryLabel, getSeverityLabel } from "@/lib/reportLabels";
import type { SmokePlume } from "@/lib/smokePlume";
import type { Report } from "@/lib/types";

const FALLBACK_TEXT = "ไม่ระบุ";
const DEFAULT_BASE_URL = "https://firewatch.local/";
const MAX_TIMELINE_ITEMS = 5;

export const INCIDENT_BRIEF_DISCLAIMER =
  "เอกสารนี้เป็นสรุปรายงานจากประชาชนเพื่อช่วยสื่อสารและตรวจสอบเบื้องต้น ไม่ใช่คำสั่ง dispatch ทางการ";

export const INCIDENT_BRIEF_EMERGENCY_NOTICE =
  "หากมีไฟไหม้หรืออันตรายเร่งด่วน ให้โทร 199 ทันที";

export type IncidentBriefTarget =
  | {
      kind: "zone";
      detail: IncidentDetail;
    }
  | {
      kind: "report";
      report: Report;
    };

export interface BuildBriefTargetInput {
  selectedIncidentDetail: IncidentDetail | null;
  selectedReport: Report | null;
}

export interface IncidentBriefBuildOptions {
  generatedAt: Date;
  shareUrl?: string;
  smokePlume?: SmokePlume | null;
}

export interface IncidentBrief {
  title: string;
  targetKind: IncidentBriefTarget["kind"];
  targetLabel: string;
  generatedAtLabel: string;
  statusLabel: string;
  statusValue: string;
  coordinateLabel: string;
  mapsUrl: string;
  shareUrl: string;
  body: string;
}

function cleanText(value: string | null | undefined): string {
  return value?.trim() || FALLBACK_TEXT;
}

function formatBriefDateTime(value: Date): string {
  if (Number.isNaN(value.getTime())) {
    return FALLBACK_TEXT;
  }

  return new Intl.DateTimeFormat("th-TH", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(value);
}

function formatReportTime(value: string): string {
  const parsed = new Date(value);
  return formatBriefDateTime(parsed);
}

function getTargetId(target: IncidentBriefTarget | null): string | null {
  if (!target) {
    return null;
  }

  return target.kind === "zone" ? target.detail.zone.id : target.report.id;
}

function getTargetCoordinate(target: IncidentBriefTarget): { lat: number; lng: number } {
  if (target.kind === "zone") {
    return {
      lat: target.detail.zone.centerLat,
      lng: target.detail.zone.centerLng
    };
  }

  return {
    lat: target.report.lat,
    lng: target.report.lng
  };
}

function getCoordinateLabel(lat: number, lng: number): string {
  return `${formatHandoffCoordinate(lat)}, ${formatHandoffCoordinate(lng)}`;
}

function buildSafeUrl(baseUrl: string): URL {
  try {
    return new URL(baseUrl);
  } catch {
    return new URL(baseUrl, DEFAULT_BASE_URL);
  }
}

function buildTimelineLines(timeline: readonly IncidentTimelineEvent[]): string[] {
  if (timeline.length === 0) {
    return ["- ยังไม่มี evidence timeline จากรายงานที่โหลดอยู่ในฝั่ง client"];
  }

  return timeline.slice(0, MAX_TIMELINE_ITEMS).map((event) => {
    const ageLabel = event.ageMinutes === null ? "เวลาไม่ชัดเจน" : formatZoneAge(event.ageMinutes);
    return `- ${event.title}: ${event.categoryLabel}, ${event.severityLabel}, ${event.verificationStatus}, ${ageLabel} (#${event.reportId.slice(-6)})`;
  });
}

function buildRiskFactorLines(riskFactors: readonly string[]): string[] {
  if (riskFactors.length === 0) {
    return ["- ไม่มี risk factor เพิ่มเติมในชุดข้อมูลปัจจุบัน"];
  }

  return riskFactors.map((factor) => `- ${factor}`);
}

function buildRecommendationLines(detail: IncidentDetail): string[] {
  return [
    `หัวข้อ: ${detail.recommendation.title}`,
    detail.recommendation.detail,
    ...detail.recommendation.steps.map((step) => `- ${step}`)
  ];
}

function buildSmokePlumeLines(
  target: IncidentBriefTarget,
  smokePlume: SmokePlume | null | undefined
): string[] {
  if (target.kind !== "zone" || !smokePlume || smokePlume.zoneId !== target.detail.zone.id) {
    return [];
  }

  return [
    "Smoke plume simulation",
    `ทิศทางที่ควันอาจเคลื่อนไป: ${smokePlume.windDirectionLabel} (${smokePlume.windDirectionDegrees}°)`,
    `ระดับลม: ${smokePlume.windSpeedLevel}`,
    `ระยะจำลองโดยประมาณ: ${smokePlume.lengthMeters} เมตร`,
    `ความกว้างจำลองโดยประมาณ: ${smokePlume.widthMeters} เมตร`,
    `สรุปแนวปลายลม: ${smokePlume.watchSummary}`,
    `หมายเหตุแบบจำลอง: ${smokePlume.disclaimer}`
  ];
}

function buildReportBriefText(
  report: Report,
  generatedAt: Date,
  shareUrl: string
): string {
  const mapsUrl = buildGoogleMapsUrl(report.lat, report.lng);

  return [
    "FireWatch Incident Brief",
    `เวลาสร้าง brief: ${formatBriefDateTime(generatedAt)}`,
    "ประเภท brief: รายงานเดี่ยว",
    `สถานะยืนยัน: ${report.verificationStatus}`,
    `ประเภทเหตุ: ${getCategoryLabel(report.category)}`,
    `ความรุนแรง: ${getSeverityLabel(report.severity)}`,
    `เวลาแจ้ง: ${formatReportTime(report.createdAt)}`,
    `พิกัดตำแหน่งเหตุ: ${getCoordinateLabel(report.lat, report.lng)}`,
    `Google Maps: ${mapsUrl}`,
    `พื้นที่โดยประมาณ: ${cleanText(report.addressLabel)}`,
    `หมายเหตุผู้แจ้ง: ${cleanText(report.notes)}`,
    `ลิงก์ brief: ${shareUrl}`,
    INCIDENT_BRIEF_DISCLAIMER,
    INCIDENT_BRIEF_EMERGENCY_NOTICE
  ].join("\n");
}

function buildZoneBriefText(
  detail: IncidentDetail,
  generatedAt: Date,
  shareUrl: string,
  smokePlume: SmokePlume | null | undefined
): string {
  const zone = detail.zone;
  const mapsUrl = buildGoogleMapsUrl(zone.centerLat, zone.centerLng);
  const smokeLines = buildSmokePlumeLines({ kind: "zone", detail }, smokePlume);

  return [
    "FireWatch Incident Brief",
    `เวลาสร้าง brief: ${formatBriefDateTime(generatedAt)}`,
    "ประเภท brief: Alert zone",
    `ระดับความเสี่ยง: ${zone.riskLevel}`,
    `จำนวนรายงานใน zone: ${zone.reportCount}`,
    `รายงานที่ยืนยันแล้ว: ${zone.verifiedReportCount}`,
    `ความรุนแรงสูงสุด/เฉลี่ย: ${zone.maxSeverity}/${zone.averageSeverity}`,
    `รายงานล่าสุด: ${formatZoneAge(zone.latestReportAgeMinutes)}`,
    `พิกัดกลางพื้นที่: ${getCoordinateLabel(zone.centerLat, zone.centerLng)}`,
    `Google Maps: ${mapsUrl}`,
    `พื้นที่โดยประมาณ: ${cleanText(zone.primaryAddressLabel)}`,
    `ลิงก์ brief: ${shareUrl}`,
    "",
    "Risk factors",
    ...buildRiskFactorLines(zone.riskFactors),
    "",
    "Evidence timeline",
    ...buildTimelineLines(detail.timeline),
    "",
    "Field recommendation",
    ...buildRecommendationLines(detail),
    ...(smokeLines.length > 0 ? ["", ...smokeLines] : []),
    "",
    INCIDENT_BRIEF_DISCLAIMER,
    INCIDENT_BRIEF_EMERGENCY_NOTICE
  ].join("\n");
}

export function buildBriefTarget({
  selectedIncidentDetail,
  selectedReport
}: BuildBriefTargetInput): IncidentBriefTarget | null {
  if (selectedIncidentDetail) {
    return {
      kind: "zone",
      detail: selectedIncidentDetail
    };
  }

  if (selectedReport) {
    return {
      kind: "report",
      report: selectedReport
    };
  }

  return null;
}

export function buildBriefTitle(target: IncidentBriefTarget | null): string {
  if (!target) {
    return "FireWatch Incident Brief";
  }

  if (target.kind === "zone") {
    const zone = target.detail.zone;
    return `FireWatch Incident Brief - ${zone.primaryAddressLabel || zone.id}`;
  }

  return `FireWatch Incident Brief - ${getCategoryLabel(target.report.category)}`;
}

export function buildBriefShareUrl(
  target: IncidentBriefTarget | null,
  baseUrl = DEFAULT_BASE_URL
): string {
  const url = buildSafeUrl(baseUrl);
  url.searchParams.delete("zone");
  url.searchParams.delete("report");

  if (target?.kind === "zone") {
    url.searchParams.set("zone", target.detail.zone.id);
  } else if (target?.kind === "report") {
    url.searchParams.set("report", target.report.id);
  }

  return url.toString();
}

export function buildIncidentBriefText(
  target: IncidentBriefTarget | null,
  options: IncidentBriefBuildOptions
): string {
  const shareUrl = options.shareUrl ?? buildBriefShareUrl(target);

  if (!target) {
    return [
      "FireWatch Incident Brief",
      `เวลาสร้าง brief: ${formatBriefDateTime(options.generatedAt)}`,
      "ยังไม่ได้เลือก report หรือ alert zone สำหรับสร้าง brief",
      INCIDENT_BRIEF_DISCLAIMER,
      INCIDENT_BRIEF_EMERGENCY_NOTICE
    ].join("\n");
  }

  if (target.kind === "zone") {
    return buildZoneBriefText(
      target.detail,
      options.generatedAt,
      shareUrl,
      options.smokePlume
    );
  }

  return buildReportBriefText(target.report, options.generatedAt, shareUrl);
}

export function buildIncidentBrief(
  target: IncidentBriefTarget | null,
  options: IncidentBriefBuildOptions
): IncidentBrief | null {
  if (!target) {
    return null;
  }

  const { lat, lng } = getTargetCoordinate(target);
  const mapsUrl = buildGoogleMapsUrl(lat, lng);
  const shareUrl = options.shareUrl ?? buildBriefShareUrl(target);
  const body = buildIncidentBriefText(target, {
    ...options,
    shareUrl
  });
  const targetId = getTargetId(target) ?? FALLBACK_TEXT;

  if (target.kind === "zone") {
    const zone = target.detail.zone;
    return {
      title: buildBriefTitle(target),
      targetKind: "zone",
      targetLabel: zone.primaryAddressLabel || targetId,
      generatedAtLabel: formatBriefDateTime(options.generatedAt),
      statusLabel: "Risk level",
      statusValue: zone.riskLevel,
      coordinateLabel: getCoordinateLabel(zone.centerLat, zone.centerLng),
      mapsUrl,
      shareUrl,
      body
    };
  }

  const report = target.report;
  return {
    title: buildBriefTitle(target),
    targetKind: "report",
    targetLabel: report.addressLabel || targetId,
    generatedAtLabel: formatBriefDateTime(options.generatedAt),
    statusLabel: "Verification",
    statusValue: report.verificationStatus,
    coordinateLabel: getCoordinateLabel(report.lat, report.lng),
    mapsUrl,
    shareUrl,
    body
  };
}
