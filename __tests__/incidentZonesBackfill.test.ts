import { planIncidentZoneBackfillDryRun } from "@/functions/src/incidentZones/backfill";
import type { IncidentZoneReport } from "@/functions/src/incidentZones/types";

const NOW = Date.parse("2026-07-16T05:00:00.000Z");

function makeReport(id: string): IncidentZoneReport {
  return {
    id,
    lat: 18.7883,
    lng: 98.9853,
    category: "open_burning",
    severity: 2,
    createdAt: NOW - 60_000,
    verificationStatus: "รอการยืนยัน",
    moderationStatus: "ปกติ",
    addressLabel: "เชียงใหม่"
  };
}

describe("incident-zone backfill dry-run", () => {
  it("returns only a safe planning summary and performs no apply step", () => {
    const result = planIncidentZoneBackfillDryRun(
      [makeReport("report-a")],
      [],
      NOW
    );

    expect(result).toEqual({
      status: "dry-run-ready",
      summary: {
        reportsConsidered: 1,
        zonesCreated: 1,
        zonesMerged: 0,
        zonesSplit: 0,
        reportsExcluded: 0,
        aliasesPlanned: 0,
        membershipsPlanned: 1,
        stateChangesPlanned: 1
      }
    });
    expect(JSON.stringify(result)).not.toMatch(/photoURL|notes|userId/);
    expect("plan" in result).toBe(false);
  });

  it("propagates limit failures without returning a partial plan", () => {
    const result = planIncidentZoneBackfillDryRun(
      [makeReport("a"), makeReport("b")],
      [],
      NOW,
      { maxCandidateReports: 1 }
    );

    expect(result).toEqual({
      status: "limit-exceeded",
      limit: "candidate-reports",
      maximum: 1,
      observed: 2,
      reportsConsidered: 2
    });
    expect("summary" in result).toBe(false);
  });
});
