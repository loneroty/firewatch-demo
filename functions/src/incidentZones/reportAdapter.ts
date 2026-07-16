import { encodeGeohash } from "../geohash";
import { isRecord, toEpochMilliseconds } from "./firestoreAdapter";
import {
  INCIDENT_ZONE_REPORT_CATEGORIES,
  type IncidentZoneModerationStatus,
  type IncidentZoneReport,
  type IncidentZoneSeverity,
  type IncidentZoneVerificationStatus
} from "./types";

const VERIFICATION_STATUSES: IncidentZoneVerificationStatus[] = [
  "รอการยืนยัน",
  "ยืนยันแล้ว",
  "ถูกปฏิเสธ"
];
const MODERATION_STATUSES: IncidentZoneModerationStatus[] = [
  "ปกติ",
  "รอตรวจสอบ",
  "ถูกซ่อน"
];

export interface AdaptedIncidentZoneReport {
  report: IncidentZoneReport;
  geohash: string;
}

export type IncidentZoneReportAdaptResult =
  | { status: "ok"; value: AdaptedIncidentZoneReport }
  | { status: "malformed"; reason: string };

export function adaptReportDocument(
  reportId: string,
  value: unknown
): IncidentZoneReportAdaptResult {
  if (!isRecord(value)) {
    return { status: "malformed", reason: "document-not-object" };
  }

  const createdAt = toEpochMilliseconds(value.createdAt);
  if (
    reportId.trim().length === 0 ||
    typeof value.lat !== "number" ||
    !Number.isFinite(value.lat) ||
    value.lat < -90 ||
    value.lat > 90 ||
    typeof value.lng !== "number" ||
    !Number.isFinite(value.lng) ||
    value.lng < -180 ||
    value.lng > 180 ||
    typeof value.category !== "string" ||
    !INCIDENT_ZONE_REPORT_CATEGORIES.includes(
      value.category as (typeof INCIDENT_ZONE_REPORT_CATEGORIES)[number]
    ) ||
    (value.severity !== 1 && value.severity !== 2 && value.severity !== 3) ||
    createdAt === null
  ) {
    return { status: "malformed", reason: "invalid-required-field" };
  }

  const verificationStatus =
    value.verificationStatus === undefined
      ? "รอการยืนยัน"
      : value.verificationStatus;
  const moderationStatus =
    value.moderationStatus === undefined ? "ปกติ" : value.moderationStatus;
  if (
    typeof verificationStatus !== "string" ||
    !VERIFICATION_STATUSES.includes(
      verificationStatus as IncidentZoneVerificationStatus
    ) ||
    typeof moderationStatus !== "string" ||
    !MODERATION_STATUSES.includes(moderationStatus as IncidentZoneModerationStatus)
  ) {
    return { status: "malformed", reason: "invalid-status" };
  }

  const addressLabel =
    typeof value.addressLabel === "string" && value.addressLabel.trim().length > 0
      ? value.addressLabel.trim()
      : undefined;
  const geohash =
    typeof value.geohash === "string" &&
    /^[0123456789bcdefghjkmnpqrstuvwxyz]{5,12}$/.test(
      value.geohash.trim().toLowerCase()
    )
      ? value.geohash.trim().toLowerCase()
      : encodeGeohash(value.lat, value.lng, 8);

  return {
    status: "ok",
    value: {
      geohash,
      report: {
        id: reportId,
        lat: value.lat,
        lng: value.lng,
        category:
          value.category as (typeof INCIDENT_ZONE_REPORT_CATEGORIES)[number],
        severity: value.severity as IncidentZoneSeverity,
        createdAt,
        verificationStatus:
          verificationStatus as IncidentZoneVerificationStatus,
        moderationStatus: moderationStatus as IncidentZoneModerationStatus,
        ...(addressLabel === undefined ? {} : { addressLabel })
      }
    }
  };
}
