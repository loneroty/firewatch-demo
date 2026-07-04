import {
  buildIncidentDetail,
  getFieldRecommendation
} from "@/lib/incidentDetail";
import type { AlertZone, RiskLevel } from "@/lib/incidentIntelligence";
import type { Report } from "@/lib/types";

const now = new Date("2026-06-29T03:00:00.000Z");

function minutesAgo(minutes: number): string {
  return new Date(now.getTime() - minutes * 60_000).toISOString();
}

function makeReport(overrides: Partial<Report> = {}): Report {
  return {
    id: "report-a",
    lat: 18.7883,
    lng: 98.9853,
    geohash: "w5q6utfh",
    photoURL: "/report-placeholder.svg",
    category: "open_burning",
    severity: 1,
    createdAt: minutesAgo(15),
    userId: "user-a",
    verificationStatus: "รอการยืนยัน",
    confirmedByReportIds: [],
    isThrottled: false,
    flaggedCount: 0,
    moderationStatus: "ปกติ",
    addressLabel: "เชียงใหม่",
    notes: "",
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
    latestReportAt: minutesAgo(15),
    latestReportAgeMinutes: 15,
    maxSeverity: 2,
    averageSeverity: 1.5,
    verifiedReportCount: 0,
    riskLevel: "เฝ้าระวัง",
    riskScore: 4,
    primaryAddressLabel: "เชียงใหม่",
    riskFactors: ["2 รายงานในรัศมี 500 เมตร"],
    ...overrides
  };
}

describe("incident detail", () => {
  it("returns null when no alert zone is selected", () => {
    expect(buildIncidentDetail(null, [makeZone()], [makeReport()], now)).toBeNull();
  });

  it("builds detail for a selected zone with matching reports", () => {
    const detail = buildIncidentDetail(
      "zone-report-a-report-b",
      [makeZone()],
      [
        makeReport({ id: "report-b", createdAt: minutesAgo(10), severity: 2 }),
        makeReport({ id: "report-a", createdAt: minutesAgo(25), severity: 1 })
      ],
      now
    );

    expect(detail?.zone.id).toBe("zone-report-a-report-b");
    expect(detail?.reports.map((report) => report.id)).toEqual(["report-a", "report-b"]);
    expect(detail?.timeline).toHaveLength(2);
    expect(detail?.missingReportIds).toEqual([]);
  });

  it("handles missing report ids gracefully", () => {
    const detail = buildIncidentDetail(
      "zone-report-a-report-b",
      [makeZone()],
      [makeReport({ id: "report-a" })],
      now
    );

    expect(detail?.reports.map((report) => report.id)).toEqual(["report-a"]);
    expect(detail?.timeline).toHaveLength(1);
    expect(detail?.missingReportIds).toEqual(["report-b"]);
  });

  it("marks old report timeline events as context instead of fresh evidence", () => {
    const detail = buildIncidentDetail(
      "zone-report-a-report-b",
      [makeZone({ reportIds: ["old-report"], latestReportAgeMinutes: 360 })],
      [makeReport({ id: "old-report", createdAt: minutesAgo(360), severity: 3 })],
      now
    );

    expect(detail?.timeline[0]?.isOldReport).toBe(true);
    expect(detail?.timeline[0]?.ageMinutes).toBe(360);
    expect(detail?.timeline[0]?.detail).toContain("เริ่มเก่าแล้ว");
  });

  it("marks verified reports in the evidence timeline", () => {
    const detail = buildIncidentDetail(
      "zone-report-a-report-b",
      [makeZone({ reportIds: ["verified-report"], verifiedReportCount: 1 })],
      [
        makeReport({
          id: "verified-report",
          verificationStatus: "ยืนยันแล้ว",
          confirmedByReportIds: ["nearby-report"]
        })
      ],
      now
    );

    expect(detail?.timeline[0]?.kind).toBe("verified-report");
    expect(detail?.timeline[0]?.title).toBe("รายงานที่ยืนยันแล้ว");
    expect(detail?.reports[0]?.confirmedByReportIds).toEqual(["nearby-report"]);
  });

  it.each<RiskLevel>(["เฝ้าระวัง", "น่ากังวล", "ควรตรวจสอบเร่งด่วน"])(
    "returns deterministic field recommendation for %s",
    (riskLevel) => {
      const recommendation = getFieldRecommendation(riskLevel);

      expect(recommendation.title).toEqual(expect.any(String));
      expect(recommendation.detail).toEqual(expect.any(String));
      expect(recommendation.steps.length).toBeGreaterThanOrEqual(3);
      expect(recommendation.detail).not.toContain("ยืนยันแล้วว่าเกิดเหตุจริง");
    }
  );
});
