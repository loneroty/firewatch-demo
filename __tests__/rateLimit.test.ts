import type { Report } from "@/lib/types";
import {
  MAX_REPORTS_PER_HOUR,
  evaluateHourlyRateLimit
} from "@/lib/verification/reputation";

function reportAt(index: number, createdAt: string, userId = "user-a"): Report {
  return {
    id: `report-${index}`,
    lat: 18.7883,
    lng: 98.9853,
    geohash: "w5q6utfh",
    photoURL: "/report-placeholder.svg",
    category: "open_burning",
    severity: 1,
    createdAt,
    userId,
    verificationStatus: "รอการยืนยัน",
    confirmedByReportIds: [],
    isThrottled: false,
    flaggedCount: 0,
    moderationStatus: "ปกติ",
    addressLabel: "เชียงใหม่",
    notes: ""
  };
}

describe("evaluateHourlyRateLimit", () => {
  it("allows the first ten reports in a rolling hour", () => {
    const reports = Array.from({ length: MAX_REPORTS_PER_HOUR - 1 }, (_, index) =>
      reportAt(index, "2026-06-29T02:30:00.000Z")
    );

    const result = evaluateHourlyRateLimit(
      "user-a",
      reports,
      new Date("2026-06-29T03:00:00.000Z")
    );

    expect(result.allowed).toBe(true);
    expect(result.countInWindow).toBe(9);
  });

  it("rejects when the user already has ten reports inside the rolling hour", () => {
    const reports = Array.from({ length: MAX_REPORTS_PER_HOUR }, (_, index) =>
      reportAt(index, "2026-06-29T02:30:00.000Z")
    );

    const result = evaluateHourlyRateLimit(
      "user-a",
      reports,
      new Date("2026-06-29T03:00:00.000Z")
    );

    expect(result.allowed).toBe(false);
    expect(result.countInWindow).toBe(10);
  });

  it("ignores reports by other users and reports outside the window", () => {
    const reports = [
      reportAt(1, "2026-06-29T01:59:59.000Z"),
      reportAt(2, "2026-06-29T02:30:00.000Z", "user-b")
    ];

    const result = evaluateHourlyRateLimit(
      "user-a",
      reports,
      new Date("2026-06-29T03:00:00.000Z")
    );

    expect(result.allowed).toBe(true);
    expect(result.countInWindow).toBe(0);
  });
});
