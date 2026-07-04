import type { AlertZone, RiskLevel } from "@/lib/incidentIntelligence";

export type WindSpeedLevel = "เบา" | "ปานกลาง" | "แรง";

export interface SmokePlumeOptions {
  enabled: boolean;
  windDirectionDegrees: number;
  windSpeedLevel: WindSpeedLevel;
}

export interface SmokePlumePoint {
  lat: number;
  lng: number;
}

export interface SmokePlume {
  zoneId: string;
  riskLevel: RiskLevel;
  center: SmokePlumePoint;
  polygon: SmokePlumePoint[];
  windDirectionDegrees: number;
  windDirectionLabel: string;
  windSpeedLevel: WindSpeedLevel;
  lengthMeters: number;
  widthMeters: number;
  watchSummary: string;
  disclaimer: string;
}

const EARTH_RADIUS_METERS = 6_371_000;
const MAX_PLUME_DISTANCE_METERS = 2_400;
const MAX_PLUME_WIDTH_METERS = 820;
const MIN_PLUME_WIDTH_METERS = 280;

export const SMOKE_PLUME_DISCLAIMER =
  "แบบจำลองนี้ใช้เพื่อสาธิตและช่วยประเมินเบื้องต้น ไม่ใช่การพยากรณ์ควันจริง";

const riskDistanceMeters: Record<RiskLevel, number> = {
  "เฝ้าระวัง": 900,
  "น่ากังวล": 1_300,
  "ควรตรวจสอบเร่งด่วน": 1_700
};

const speedDistanceMultiplier: Record<WindSpeedLevel, number> = {
  เบา: 0.75,
  ปานกลาง: 1,
  แรง: 1.35
};

const directionLabels: readonly { degrees: number; label: string }[] = [
  { degrees: 0, label: "เหนือ" },
  { degrees: 45, label: "ตะวันออกเฉียงเหนือ" },
  { degrees: 90, label: "ตะวันออก" },
  { degrees: 135, label: "ตะวันออกเฉียงใต้" },
  { degrees: 180, label: "ใต้" },
  { degrees: 225, label: "ตะวันตกเฉียงใต้" },
  { degrees: 270, label: "ตะวันตก" },
  { degrees: 315, label: "ตะวันตกเฉียงเหนือ" }
];

function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

function toDegrees(radians: number): number {
  return (radians * 180) / Math.PI;
}

function normalizeDegrees(degrees: number): number {
  return ((degrees % 360) + 360) % 360;
}

function normalizeLng(lng: number): number {
  return ((lng + 540) % 360) - 180;
}

function roundCoordinate(value: number): number {
  return Number(value.toFixed(6));
}

function roundMeters(value: number): number {
  return Math.round(value / 10) * 10;
}

export function getWindDirectionLabel(degrees: number): string {
  const normalizedDegrees = normalizeDegrees(degrees);
  const nearestIndex = Math.round(normalizedDegrees / 45) % directionLabels.length;

  return directionLabels[nearestIndex]?.label ?? "เหนือ";
}

export function calculateDestinationPoint(
  lat: number,
  lng: number,
  bearingDegrees: number,
  distanceMeters: number
): SmokePlumePoint {
  const angularDistance = distanceMeters / EARTH_RADIUS_METERS;
  const bearingRadians = toRadians(normalizeDegrees(bearingDegrees));
  const latRadians = toRadians(lat);
  const lngRadians = toRadians(lng);

  const destinationLatRadians = Math.asin(
    Math.sin(latRadians) * Math.cos(angularDistance) +
      Math.cos(latRadians) * Math.sin(angularDistance) * Math.cos(bearingRadians)
  );
  const destinationLngRadians =
    lngRadians +
    Math.atan2(
      Math.sin(bearingRadians) * Math.sin(angularDistance) * Math.cos(latRadians),
      Math.cos(angularDistance) - Math.sin(latRadians) * Math.sin(destinationLatRadians)
    );

  return {
    lat: roundCoordinate(toDegrees(destinationLatRadians)),
    lng: roundCoordinate(normalizeLng(toDegrees(destinationLngRadians)))
  };
}

export function getPlumeDistanceMeters(
  riskLevel: RiskLevel,
  windSpeedLevel: WindSpeedLevel
): number {
  const baseDistance = riskDistanceMeters[riskLevel];
  const multipliedDistance = baseDistance * speedDistanceMultiplier[windSpeedLevel];

  return Math.min(roundMeters(multipliedDistance), MAX_PLUME_DISTANCE_METERS);
}

function getPlumeWidthMeters(
  riskLevel: RiskLevel,
  windSpeedLevel: WindSpeedLevel
): number {
  const distanceMeters = getPlumeDistanceMeters(riskLevel, windSpeedLevel);
  const riskWidthBonus = riskLevel === "ควรตรวจสอบเร่งด่วน" ? 120 : riskLevel === "น่ากังวล" ? 60 : 0;
  const speedWidthBonus = windSpeedLevel === "แรง" ? 90 : windSpeedLevel === "ปานกลาง" ? 40 : 0;
  const widthMeters = distanceMeters * 0.26 + riskWidthBonus + speedWidthBonus;

  return Math.min(
    Math.max(roundMeters(widthMeters), MIN_PLUME_WIDTH_METERS),
    MAX_PLUME_WIDTH_METERS
  );
}

function buildPlumePolygon(
  zone: AlertZone,
  windDirectionDegrees: number,
  lengthMeters: number,
  widthMeters: number
): SmokePlumePoint[] {
  const center: SmokePlumePoint = {
    lat: roundCoordinate(zone.centerLat),
    lng: roundCoordinate(zone.centerLng)
  };
  const leftBearing = windDirectionDegrees - 90;
  const rightBearing = windDirectionDegrees + 90;
  const halfWidthMeters = widthMeters / 2;
  const shoulderCenter = calculateDestinationPoint(
    zone.centerLat,
    zone.centerLng,
    windDirectionDegrees,
    lengthMeters * 0.72
  );

  return [
    calculateDestinationPoint(center.lat, center.lng, leftBearing, halfWidthMeters * 0.16),
    calculateDestinationPoint(
      shoulderCenter.lat,
      shoulderCenter.lng,
      leftBearing,
      halfWidthMeters
    ),
    calculateDestinationPoint(center.lat, center.lng, windDirectionDegrees, lengthMeters),
    calculateDestinationPoint(
      shoulderCenter.lat,
      shoulderCenter.lng,
      rightBearing,
      halfWidthMeters
    ),
    calculateDestinationPoint(center.lat, center.lng, rightBearing, halfWidthMeters * 0.16)
  ];
}

function buildWatchSummary(
  zone: AlertZone,
  directionLabel: string
): string {
  const areaLabel = zone.primaryAddressLabel || "พื้นที่ที่เลือก";

  if (zone.riskLevel === "ควรตรวจสอบเร่งด่วน") {
    return `แนวปลายลมไปทาง${directionLabel}จาก${areaLabel} ควรให้ความสำคัญและติดตามรายงานเพิ่ม ใช้เป็นข้อมูลช่วยประเมินเบื้องต้นร่วมกับหลักฐานภาคสนาม`;
  }

  if (zone.riskLevel === "น่ากังวล") {
    return `แนวปลายลมไปทาง${directionLabel}จาก${areaLabel} ควรเฝ้าระวังและตรวจความสอดคล้องของรายงานใกล้เคียงเพิ่มเติม`;
  }

  return `แนวปลายลมไปทาง${directionLabel}จาก${areaLabel} ควรติดตามรายงานเพิ่มและใช้เป็นบริบทช่วยประเมินเบื้องต้น`;
}

export function buildSmokePlume(
  zone: AlertZone | null,
  options: SmokePlumeOptions
): SmokePlume | null {
  if (!options.enabled || !zone) {
    return null;
  }

  const windDirectionDegrees = normalizeDegrees(options.windDirectionDegrees);
  const windDirectionLabel = getWindDirectionLabel(windDirectionDegrees);
  const lengthMeters = getPlumeDistanceMeters(zone.riskLevel, options.windSpeedLevel);
  const widthMeters = getPlumeWidthMeters(zone.riskLevel, options.windSpeedLevel);

  return {
    zoneId: zone.id,
    riskLevel: zone.riskLevel,
    center: {
      lat: roundCoordinate(zone.centerLat),
      lng: roundCoordinate(zone.centerLng)
    },
    polygon: buildPlumePolygon(zone, windDirectionDegrees, lengthMeters, widthMeters),
    windDirectionDegrees,
    windDirectionLabel,
    windSpeedLevel: options.windSpeedLevel,
    lengthMeters,
    widthMeters,
    watchSummary: buildWatchSummary(zone, windDirectionLabel),
    disclaimer: SMOKE_PLUME_DISCLAIMER
  };
}
