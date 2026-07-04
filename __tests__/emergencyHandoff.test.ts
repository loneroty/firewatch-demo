import type { AlertZone } from "@/lib/incidentIntelligence";
import {
  EMERGENCY_HANDOFF_NOTICE,
  buildAlertZoneHandoffSummary,
  buildGoogleMapsUrl,
  buildReportHandoffSummary,
  formatHandoffCoordinate
} from "@/lib/emergencyHandoff";
import type { Report } from "@/lib/types";

const forbiddenPhrases = [
  "ส่งถึงนักดับเพลิงแล้ว",
  "แจ้งเจ้าหน้าที่เรียบร้อย",
  "ระบบ dispatch แล้ว"
];

function makeReport(overrides: Partial<Report> = {}): Report {
  return {
    id: "report-a",
    lat: 18.7883,
    lng: 98.9853,
    geohash: "w5q6utfh",
    photoURL: "/report-placeholder.svg",
    category: "open_burning",
    severity: 3,
    createdAt: "2026-06-29T03:00:00.000Z",
    userId: "user-a",
    verificationStatus: "รอการยืนยัน",
    confirmedByReportIds: [],
    isThrottled: false,
    flaggedCount: 0,
    moderationStatus: "ปกติ",
    addressLabel: "เชียงใหม่",
    notes: "เห็นควันจากเชิงดอย",
    ...overrides
  };
}

function makeZone(overrides: Partial<AlertZone> = {}): AlertZone {
  return {
    id: "zone-report-a-report-b",
    reportIds: ["report-a", "report-b"],
    reportCount: 2,
    centerLat: 18.7888,
    centerLng: 98.9858,
    latestReportAt: "2026-06-29T03:00:00.000Z",
    latestReportAgeMinutes: 18,
    maxSeverity: 3,
    averageSeverity: 2.5,
    verifiedReportCount: 1,
    riskLevel: "ควรตรวจสอบเร่งด่วน",
    riskScore: 8,
    primaryAddressLabel: "เชียงใหม่",
    riskFactors: ["2 รายงานในรัศมี 500 เมตร", "มีรายงานใหม่ใน 60 นาที"],
    ...overrides
  };
}

function expectNoForbiddenPhrases(value: string): void {
  forbiddenPhrases.forEach((phrase) => {
    expect(value).not.toContain(phrase);
  });
}

describe("emergency handoff", () => {
  it("builds a report summary with coordinates and Google Maps link", () => {
    const summary = buildReportHandoffSummary(makeReport());

    expect(summary.body).toContain("ประเภทเหตุ");
    expect(summary.body).toContain("ความรุนแรง");
    expect(summary.body).toContain("สถานะยืนยัน");
    expect(summary.body).toContain("18.788300, 98.985300");
    expect(summary.body).toContain(summary.mapsUrl);
    expect(summary.mapsUrl).toBe(
      "https://www.google.com/maps/search/?api=1&query=18.788300%2C98.985300"
    );
  });

  it("builds an alert zone summary with risk level and report count", () => {
    const summary = buildAlertZoneHandoffSummary(makeZone());

    expect(summary.body).toContain("ระดับความเสี่ยง: ควรตรวจสอบเร่งด่วน");
    expect(summary.body).toContain("จำนวนรายงานในพื้นที่: 2");
    expect(summary.body).toContain("2 รายงานในรัศมี 500 เมตร");
    expect(summary.mapsUrl).toContain("18.788800%2C98.985800");
  });

  it("handles empty optional text fields without breaking report summary", () => {
    const summary = buildReportHandoffSummary(
      makeReport({
        addressLabel: "",
        notes: ""
      })
    );

    expect(summary.body).toContain("พื้นที่โดยประมาณ: ไม่ระบุ");
    expect(summary.body).toContain("หมายเหตุ: ไม่ระบุ");
  });

  it("uses safe wording and does not claim official dispatch happened", () => {
    const reportSummary = buildReportHandoffSummary(makeReport()).body;
    const zoneSummary = buildAlertZoneHandoffSummary(makeZone()).body;

    expect(reportSummary).toContain("รายงานจากประชาชน ควรตรวจสอบก่อนดำเนินการ");
    expect(reportSummary).toContain(EMERGENCY_HANDOFF_NOTICE);
    expect(zoneSummary).toContain(EMERGENCY_HANDOFF_NOTICE);
    expectNoForbiddenPhrases(reportSummary);
    expectNoForbiddenPhrases(zoneSummary);
  });

  it("encodes map coordinates and formats coordinates consistently", () => {
    expect(formatHandoffCoordinate(18.7)).toBe("18.700000");
    expect(buildGoogleMapsUrl(-12.3456789, 100.000001)).toBe(
      "https://www.google.com/maps/search/?api=1&query=-12.345679%2C100.000001"
    );
  });
});
