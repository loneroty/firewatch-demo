import type { Report } from "@/lib/types";
import {
  buildAlertZones,
  formatZoneAge
} from "@/lib/incidentIntelligence";

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

describe("incident intelligence", () => {
  it("returns no alert zones when there are no reports", () => {
    expect(buildAlertZones([], now)).toEqual([]);
  });

  it("creates one watch zone for a single recent report", () => {
    const zones = buildAlertZones([makeReport()], now);

    expect(zones).toHaveLength(1);
    expect(zones[0]?.reportCount).toBe(1);
    expect(zones[0]?.riskLevel).toBe("เฝ้าระวัง");
    expect(zones[0]?.latestReportAgeMinutes).toBe(15);
  });

  it("groups nearby reports into one alert zone", () => {
    const zones = buildAlertZones(
      [
        makeReport({ id: "report-a", lat: 18.7883, lng: 98.9853 }),
        makeReport({ id: "report-b", lat: 18.7891, lng: 98.9861 }),
        makeReport({ id: "report-c", lat: 18.7901, lng: 98.9871 })
      ],
      now
    );

    expect(zones).toHaveLength(1);
    expect(zones[0]?.reportIds).toEqual(["report-a", "report-b", "report-c"]);
    expect(zones[0]?.reportCount).toBe(3);
  });

  it("keeps distant reports in separate zones", () => {
    const zones = buildAlertZones(
      [
        makeReport({ id: "chiang-mai", lat: 18.7883, lng: 98.9853 }),
        makeReport({ id: "lamphun", lat: 18.5767, lng: 99.0087 })
      ],
      now
    );

    expect(zones).toHaveLength(2);
    expect(zones.map((zone) => zone.reportCount)).toEqual([1, 1]);
  });

  it("raises risk when nearby reports have high severity", () => {
    const zones = buildAlertZones(
      [
        makeReport({ id: "high-a", severity: 3, lat: 18.7883, lng: 98.9853 }),
        makeReport({ id: "high-b", severity: 3, lat: 18.789, lng: 98.986 })
      ],
      now
    );

    expect(zones[0]?.riskLevel).toBe("ควรตรวจสอบเร่งด่วน");
    expect(zones[0]?.maxSeverity).toBe(3);
    expect(zones[0]?.averageSeverity).toBe(3);
  });

  it("does not let old reports keep risk elevated", () => {
    const zones = buildAlertZones(
      [
        makeReport({
          id: "old-a",
          severity: 3,
          createdAt: minutesAgo(360),
          verificationStatus: "ยืนยันแล้ว"
        }),
        makeReport({
          id: "old-b",
          severity: 3,
          lat: 18.789,
          lng: 98.986,
          createdAt: minutesAgo(360),
          verificationStatus: "ยืนยันแล้ว"
        }),
        makeReport({
          id: "old-c",
          severity: 3,
          lat: 18.7893,
          lng: 98.9863,
          createdAt: minutesAgo(360),
          verificationStatus: "ยืนยันแล้ว"
        })
      ],
      now
    );

    expect(zones[0]?.riskLevel).toBe("เฝ้าระวัง");
    expect(zones[0]?.latestReportAgeMinutes).toBe(360);
  });

  it("excludes hidden and rejected reports from intelligence", () => {
    const zones = buildAlertZones(
      [
        makeReport({ id: "visible" }),
        makeReport({ id: "hidden", moderationStatus: "ถูกซ่อน" }),
        makeReport({ id: "rejected", verificationStatus: "ถูกปฏิเสธ" })
      ],
      now
    );

    expect(zones).toHaveLength(1);
    expect(zones[0]?.reportIds).toEqual(["visible"]);
  });

  it("formats zone age labels for common cases", () => {
    expect(formatZoneAge(0)).toBe("เมื่อสักครู่");
    expect(formatZoneAge(12)).toBe("12 นาทีที่แล้ว");
    expect(formatZoneAge(125)).toBe("2 ชั่วโมงที่แล้ว");
    expect(formatZoneAge(1_500)).toBe("1 วันที่แล้ว");
  });
});
