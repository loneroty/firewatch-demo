import {
  INCIDENT_BRIEF_DISCLAIMER,
  INCIDENT_BRIEF_EMERGENCY_NOTICE,
  buildBriefShareUrl,
  buildBriefTarget,
  buildIncidentBriefText
} from "@/lib/incidentBrief";
import { buildIncidentDetail } from "@/lib/incidentDetail";
import type { AlertZone } from "@/lib/incidentIntelligence";
import { buildSmokePlume } from "@/lib/smokePlume";
import type { Report } from "@/lib/types";

const now = new Date("2026-06-29T03:00:00.000Z");
const forbiddenPhrases = [
  "ส่งถึงเจ้าหน้าที่แล้ว",
  "แจ้งนักดับเพลิงสำเร็จ",
  "dispatch แล้ว",
  "ยืนยันเหตุจริงแน่นอน"
];

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
    severity: 3,
    createdAt: minutesAgo(15),
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
    latestReportAt: minutesAgo(10),
    latestReportAgeMinutes: 10,
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

function makeDetail(zoneOverrides: Partial<AlertZone> = {}) {
  const zone = makeZone(zoneOverrides);

  return buildIncidentDetail(
    zone.id,
    [zone],
    [
      makeReport({ id: "report-a", createdAt: minutesAgo(20), severity: 2 }),
      makeReport({
        id: "report-b",
        createdAt: minutesAgo(10),
        severity: 3,
        verificationStatus: "ยืนยันแล้ว",
        confirmedByReportIds: ["report-a"]
      })
    ],
    now
  );
}

function expectNoForbiddenPhrases(value: string): void {
  forbiddenPhrases.forEach((phrase) => {
    expect(value).not.toContain(phrase);
  });
}

describe("incident command brief", () => {
  it("builds a report brief with coordinates and Google Maps link", () => {
    const target = buildBriefTarget({
      selectedIncidentDetail: null,
      selectedReport: makeReport()
    });
    const text = buildIncidentBriefText(target, {
      generatedAt: now,
      shareUrl: buildBriefShareUrl(target, "https://example.test/firewatch")
    });

    expect(text).toContain("FireWatch Incident Brief");
    expect(text).toContain("สถานะยืนยัน: รอการยืนยัน");
    expect(text).toContain("พิกัดตำแหน่งเหตุ: 18.788300, 98.985300");
    expect(text).toContain(
      "https://www.google.com/maps/search/?api=1&query=18.788300%2C98.985300"
    );
  });

  it("builds a zone brief with risk, report count, and evidence timeline", () => {
    const detail = makeDetail();
    const target = buildBriefTarget({
      selectedIncidentDetail: detail,
      selectedReport: makeReport({ id: "selected-report" })
    });
    const text = buildIncidentBriefText(target, {
      generatedAt: now,
      shareUrl: buildBriefShareUrl(target, "https://example.test/firewatch")
    });

    expect(target?.kind).toBe("zone");
    expect(text).toContain("ประเภท brief: Alert zone");
    expect(text).toContain("ระดับความเสี่ยง: ควรตรวจสอบเร่งด่วน");
    expect(text).toContain("จำนวนรายงานใน zone: 2");
    expect(text).toContain("Evidence timeline");
    expect(text).toContain("#report-b".slice(-6));
  });

  it("includes smoke plume settings when plume simulation is enabled for the selected zone", () => {
    const detail = makeDetail();
    if (!detail) {
      throw new Error("Expected incident detail");
    }

    const plume = buildSmokePlume(detail.zone, {
      enabled: true,
      windDirectionDegrees: 45,
      windSpeedLevel: "แรง"
    });
    const target = buildBriefTarget({
      selectedIncidentDetail: detail,
      selectedReport: null
    });
    const text = buildIncidentBriefText(target, {
      generatedAt: now,
      smokePlume: plume
    });

    expect(text).toContain("Smoke plume simulation");
    expect(text).toContain("ทิศทางที่ควันอาจเคลื่อนไป");
    expect(text).toContain("ระดับลม: แรง");
    expect(text).toContain("ไม่ใช่การพยากรณ์ควันจริง");
  });

  it("handles missing optional fields without breaking report brief", () => {
    const target = buildBriefTarget({
      selectedIncidentDetail: null,
      selectedReport: makeReport({
        addressLabel: "",
        notes: ""
      })
    });
    const text = buildIncidentBriefText(target, {
      generatedAt: now
    });

    expect(text).toContain("พื้นที่โดยประมาณ: ไม่ระบุ");
    expect(text).toContain("หมายเหตุผู้แจ้ง: ไม่ระบุ");
  });

  it("uses safe wording and avoids forbidden dispatch claims", () => {
    const reportTarget = buildBriefTarget({
      selectedIncidentDetail: null,
      selectedReport: makeReport()
    });
    const zoneTarget = buildBriefTarget({
      selectedIncidentDetail: makeDetail(),
      selectedReport: null
    });
    const reportText = buildIncidentBriefText(reportTarget, { generatedAt: now });
    const zoneText = buildIncidentBriefText(zoneTarget, { generatedAt: now });

    expect(reportText).toContain(INCIDENT_BRIEF_DISCLAIMER);
    expect(zoneText).toContain(INCIDENT_BRIEF_EMERGENCY_NOTICE);
    expectNoForbiddenPhrases(reportText);
    expectNoForbiddenPhrases(zoneText);
  });

  it("encodes zone and report deep-link query parameters", () => {
    const zoneTarget = buildBriefTarget({
      selectedIncidentDetail: makeDetail({ id: "zone a/1" }),
      selectedReport: null
    });
    const reportTarget = buildBriefTarget({
      selectedIncidentDetail: null,
      selectedReport: makeReport({ id: "report x/1" })
    });

    expect(buildBriefShareUrl(zoneTarget, "https://example.test/firewatch?report=old")).toBe(
      "https://example.test/firewatch?zone=zone+a%2F1"
    );
    expect(buildBriefShareUrl(reportTarget, "https://example.test/firewatch?zone=old")).toBe(
      "https://example.test/firewatch?report=report+x%2F1"
    );
  });

  it("handles no selected target gracefully", () => {
    const target = buildBriefTarget({
      selectedIncidentDetail: null,
      selectedReport: null
    });
    const text = buildIncidentBriefText(target, {
      generatedAt: now
    });

    expect(target).toBeNull();
    expect(text).toContain("ยังไม่ได้เลือก report หรือ alert zone");
    expect(text).toContain(INCIDENT_BRIEF_DISCLAIMER);
  });
});
