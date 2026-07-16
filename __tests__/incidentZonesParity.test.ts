import {
  buildCanonicalIncidentZones,
  STALE_WINDOW_MS
} from "@/functions/src/incidentZones/domain";
import type {
  IncidentZoneBuildResult,
  IncidentZoneRecomputationPlan,
  IncidentZoneReport
} from "@/functions/src/incidentZones/types";
import { buildAlertZones } from "@/lib/incidentIntelligence";
import type { Report } from "@/lib/types";

const NOW = new Date("2026-07-16T05:00:00.000Z");
const MINUTE_MS = 60_000;

function makeClientReport(
  id: string,
  overrides: Partial<Omit<Report, "id">> = {}
): Report {
  return {
    id,
    lat: 18.7883,
    lng: 98.9853,
    geohash: "w5q6ukqc",
    photoURL: "https://example.test/report.jpg",
    category: "open_burning",
    severity: 2,
    createdAt: new Date(NOW.getTime() - 10 * MINUTE_MS).toISOString(),
    userId: `user-${id}`,
    verificationStatus: "รอการยืนยัน",
    confirmedByReportIds: [],
    isThrottled: false,
    flaggedCount: 0,
    moderationStatus: "ปกติ",
    addressLabel: "เชียงใหม่",
    notes: "fixture",
    ...overrides
  };
}

function toServerReport(report: Report): IncidentZoneReport {
  return {
    id: report.id,
    lat: report.lat,
    lng: report.lng,
    category: report.category,
    severity: report.severity,
    createdAt: new Date(report.createdAt).getTime(),
    verificationStatus: report.verificationStatus,
    moderationStatus: report.moderationStatus,
    addressLabel: report.addressLabel
  };
}

function getPlan(result: IncidentZoneBuildResult): IncidentZoneRecomputationPlan {
  if (result.status !== "ok") {
    throw new Error(`Expected a recomputation plan, got ${result.limit}.`);
  }

  return result.plan;
}

describe("client/server incident-zone parity preparation", () => {
  it("keeps active clustering and risk aggregates aligned for shared fixtures", () => {
    const reports = [
      makeClientReport("a", {
        lat: 18.7883,
        category: "wildfire_smoke",
        severity: 3,
        verificationStatus: "ยืนยันแล้ว"
      }),
      makeClientReport("b", { lat: 18.7903, severity: 1 })
    ];
    const [clientZone] = buildAlertZones(reports, NOW);
    const [serverZone] = getPlan(
      buildCanonicalIncidentZones(
        reports.map(toServerReport),
        [],
        NOW.getTime()
      )
    ).zones;

    expect(serverZone).toMatchObject({
      reportIds: clientZone?.reportIds,
      reportCount: clientZone?.reportCount,
      maxSeverity: clientZone?.maxSeverity,
      averageSeverity: clientZone?.averageSeverity,
      verifiedReportCount: clientZone?.verifiedReportCount,
      riskLevel: clientZone?.riskLevel,
      riskScore: clientZone?.riskScore
    });
    expect(serverZone?.centerLat).toBeCloseTo(clientZone!.centerLat, 6);
    expect(serverZone?.centerLng).toBeCloseTo(clientZone!.centerLng, 6);
  });

  it("intentionally uses stable IDs and category aggregates on the server", () => {
    const reports = [
      makeClientReport("a", { category: "open_burning" }),
      makeClientReport("b", { category: "industrial_smoke" })
    ];
    const [clientZone] = buildAlertZones(reports, NOW);
    const [serverZone] = getPlan(
      buildCanonicalIncidentZones(
        reports.map(toServerReport),
        [],
        NOW.getTime()
      )
    ).zones;

    expect(clientZone?.id).toBe("zone-a-b");
    expect(serverZone?.id).toBe("zone_a");
    expect(serverZone?.categories).toEqual([
      "industrial_smoke",
      "open_burning"
    ]);
    expect(serverZone?.categoryCounts).toMatchObject({
      industrial_smoke: 1,
      open_burning: 1
    });
  });

  it("intentionally prevents stale history from bridging server zones", () => {
    const reports = [
      makeClientReport("west", { lat: 18.78 }),
      makeClientReport("bridge", {
        lat: 18.784,
        createdAt: new Date(NOW.getTime() - STALE_WINDOW_MS).toISOString()
      }),
      makeClientReport("east", { lat: 18.788 })
    ];
    const clientZones = buildAlertZones(reports, NOW);
    const serverPlan = getPlan(
      buildCanonicalIncidentZones(
        reports.map(toServerReport),
        [],
        NOW.getTime()
      )
    );

    expect(clientZones).toHaveLength(1);
    expect(serverPlan.zones.filter((zone) => zone.status === "active")).toHaveLength(
      2
    );
    expect(serverPlan.excludedReports).toContainEqual({
      reportId: "bridge",
      reason: "stale"
    });
  });

  it("intentionally retains resolved server zones while the client returns none", () => {
    const report = makeClientReport("a");
    const firstPlan = getPlan(
      buildCanonicalIncidentZones(
        [toServerReport(report)],
        [],
        NOW.getTime() - MINUTE_MS
      )
    );
    const nextPlan = getPlan(
      buildCanonicalIncidentZones([], firstPlan.zones, NOW.getTime())
    );

    expect(buildAlertZones([], NOW)).toEqual([]);
    expect(nextPlan.zones).toEqual([
      expect.objectContaining({ id: "zone_a", status: "resolved" })
    ]);
  });
});
