import type { AlertZone } from "@/lib/incidentIntelligence";
import { formatZoneAge } from "@/lib/incidentIntelligence";
import { getCategoryLabel, getSeverityLabel } from "@/lib/reportLabels";
import type { Report } from "@/lib/types";

export const EMERGENCY_HANDOFF_NOTICE =
  "หากมีไฟไหม้หรืออันตรายเร่งด่วน ให้โทร 199 ทันที แอปนี้ช่วยจัดรูปแบบข้อมูลประกอบการแจ้งเหตุ ไม่ใช่ระบบ dispatch ทางการ";

const FALLBACK_TEXT = "ไม่ระบุ";

export interface EmergencyHandoffSummary {
  title: string;
  body: string;
  mapsUrl: string;
  lat: number;
  lng: number;
}

export function formatHandoffCoordinate(value: number): string {
  return value.toFixed(6);
}

export function buildGoogleMapsUrl(lat: number, lng: number): string {
  const coordinateQuery = `${formatHandoffCoordinate(lat)},${formatHandoffCoordinate(lng)}`;

  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(coordinateQuery)}`;
}

function formatReportTime(value: string): string {
  const parsedTime = new Date(value);
  if (Number.isNaN(parsedTime.getTime())) {
    return FALLBACK_TEXT;
  }

  return new Intl.DateTimeFormat("th-TH", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(parsedTime);
}

function cleanText(value: string): string {
  return value.trim() || FALLBACK_TEXT;
}

function buildCommonFooter(): string {
  return [
    "หมายเหตุ: ข้อมูลนี้เป็นรายงานจากประชาชน ควรตรวจสอบก่อนดำเนินการ",
    EMERGENCY_HANDOFF_NOTICE
  ].join("\n");
}

export function buildReportHandoffSummary(report: Report): EmergencyHandoffSummary {
  const mapsUrl = buildGoogleMapsUrl(report.lat, report.lng);
  const coordinateLabel = `${formatHandoffCoordinate(report.lat)}, ${formatHandoffCoordinate(report.lng)}`;
  const title = `เตรียมข้อมูลแจ้งเหตุ: ${getCategoryLabel(report.category)}`;
  const body = [
    title,
    `ประเภทเหตุ: ${getCategoryLabel(report.category)}`,
    `ความรุนแรง: ${getSeverityLabel(report.severity)}`,
    `สถานะยืนยัน: ${report.verificationStatus}`,
    `เวลาแจ้ง: ${formatReportTime(report.createdAt)}`,
    `พิกัดตำแหน่งเหตุ: ${coordinateLabel}`,
    `Google Maps: ${mapsUrl}`,
    `พื้นที่โดยประมาณ: ${cleanText(report.addressLabel)}`,
    `หมายเหตุ: ${cleanText(report.notes)}`,
    buildCommonFooter()
  ].join("\n");

  return {
    title,
    body,
    mapsUrl,
    lat: report.lat,
    lng: report.lng
  };
}

export function buildAlertZoneHandoffSummary(zone: AlertZone): EmergencyHandoffSummary {
  const mapsUrl = buildGoogleMapsUrl(zone.centerLat, zone.centerLng);
  const coordinateLabel = `${formatHandoffCoordinate(zone.centerLat)}, ${formatHandoffCoordinate(zone.centerLng)}`;
  const title = `เตรียมข้อมูลพื้นที่เสี่ยง: ${zone.primaryAddressLabel || zone.id}`;
  const body = [
    title,
    `ระดับความเสี่ยง: ${zone.riskLevel}`,
    `จำนวนรายงานในพื้นที่: ${zone.reportCount}`,
    `รายงานล่าสุด: ${formatZoneAge(zone.latestReportAgeMinutes)}`,
    `พิกัดกลางของพื้นที่: ${coordinateLabel}`,
    `Google Maps: ${mapsUrl}`,
    `เหตุผลที่ควรติดตาม: ${zone.riskFactors.length > 0 ? zone.riskFactors.join(" · ") : FALLBACK_TEXT}`,
    buildCommonFooter()
  ].join("\n");

  return {
    title,
    body,
    mapsUrl,
    lat: zone.centerLat,
    lng: zone.centerLng
  };
}
