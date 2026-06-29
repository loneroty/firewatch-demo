import type { Report } from "@/lib/types";
import {
  LOW_REPUTATION_THRESHOLD,
  applyVerificationToReputation,
  evaluateCandidateReport,
  findCorroboratingReports
} from "@/lib/verification/reputation";

function makeReport(overrides: Partial<Report> = {}): Report {
  return {
    id: "existing",
    lat: 18.7883,
    lng: 98.9853,
    geohash: "w5q6utfh",
    photoURL: "/report-placeholder.svg",
    category: "open_burning",
    severity: 2,
    createdAt: "2026-06-29T02:00:00.000Z",
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

describe("verification and reputation logic", () => {
  it("confirms a report when another user reports within 500m and 60 minutes", () => {
    const result = evaluateCandidateReport(
      {
        lat: 18.7883,
        lng: 98.9899,
        createdAt: "2026-06-29T02:30:00.000Z",
        userId: "user-b"
      },
      [makeReport()],
      35
    );

    expect(result.verificationStatus).toBe("ยืนยันแล้ว");
    expect(result.confirmedByReportIds).toEqual(["existing"]);
    expect(result.isThrottled).toBe(false);
  });

  it("does not use the same user's report as corroboration", () => {
    const result = findCorroboratingReports(
      {
        lat: 18.7883,
        lng: 98.9853,
        createdAt: "2026-06-29T02:30:00.000Z",
        userId: "user-a"
      },
      [makeReport()]
    );

    expect(result).toHaveLength(0);
  });

  it("keeps a report pending when it is just outside the 60 minute window", () => {
    const result = evaluateCandidateReport(
      {
        lat: 18.7883,
        lng: 98.9853,
        createdAt: "2026-06-29T03:00:01.000Z",
        userId: "user-b"
      },
      [makeReport()],
      35
    );

    expect(result.verificationStatus).toBe("รอการยืนยัน");
  });

  it("throttles low reputation users below the threshold", () => {
    const result = evaluateCandidateReport(
      {
        lat: 18.7883,
        lng: 98.9853,
        createdAt: "2026-06-29T02:30:00.000Z",
        userId: "user-b"
      },
      [makeReport()],
      LOW_REPUTATION_THRESHOLD - 1
    );

    expect(result.isThrottled).toBe(true);
  });

  it("applies reputation score changes deterministically", () => {
    expect(applyVerificationToReputation(20, "ยืนยันแล้ว")).toBe(25);
    expect(applyVerificationToReputation(20, "ถูกปฏิเสธ")).toBe(5);
    expect(applyVerificationToReputation(10, "ถูกปฏิเสธ")).toBe(0);
    expect(applyVerificationToReputation(20, "รอการยืนยัน")).toBe(20);
  });
});
