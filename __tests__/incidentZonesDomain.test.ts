import {
  ACTIVE_MEMBERSHIP_WINDOW_MS,
  buildCanonicalIncidentZones,
  INCIDENT_ZONE_RADIUS_METERS,
  STALE_WINDOW_MS,
  WATCH_WINDOW_MS
} from "@/functions/src/incidentZones/domain";
import { calculateZoneStateHash } from "@/functions/src/incidentZones/stateHash";
import { selectCanonicalMergeZone } from "@/functions/src/incidentZones/stableIdentity";
import type {
  IncidentZoneBuildResult,
  IncidentZoneCategoryCounts,
  IncidentZoneRecomputationPlan,
  IncidentZoneReport,
  IncidentZoneState
} from "@/functions/src/incidentZones/types";

const NOW = Date.parse("2026-07-16T05:00:00.000Z");
const MINUTE_MS = 60_000;

function makeReport(
  id: string,
  overrides: Partial<Omit<IncidentZoneReport, "id">> = {}
): IncidentZoneReport {
  return {
    id,
    lat: 18.7883,
    lng: 98.9853,
    category: "open_burning",
    severity: 2,
    createdAt: NOW - 10 * MINUTE_MS,
    verificationStatus: "รอการยืนยัน",
    moderationStatus: "ปกติ",
    addressLabel: "เชียงใหม่",
    ...overrides
  };
}

function getPlan(result: IncidentZoneBuildResult): IncidentZoneRecomputationPlan {
  if (result.status !== "ok") {
    throw new Error(`Expected a recomputation plan, got ${result.limit}.`);
  }

  return result.plan;
}

function getActiveZones(plan: IncidentZoneRecomputationPlan): IncidentZoneState[] {
  return plan.zones.filter((zone) => zone.status === "active");
}

describe("server incident-zone domain engine", () => {
  it("returns an empty deterministic plan when there are no reports", () => {
    const plan = getPlan(buildCanonicalIncidentZones([], [], NOW));

    expect(plan.zones).toEqual([]);
    expect(plan.memberships).toEqual([]);
    expect(plan.stats).toMatchObject({
      reportsConsidered: 0,
      reportsEligible: 0,
      activeZones: 0,
      stateChangesPlanned: 0
    });
  });

  it("creates a single canonical zone from one report", () => {
    const plan = getPlan(
      buildCanonicalIncidentZones([makeReport("report-a")], [], NOW)
    );
    const [zone] = getActiveZones(plan);

    expect(INCIDENT_ZONE_RADIUS_METERS).toBe(500);
    expect(zone).toMatchObject({
      id: "zone_report-a",
      anchorReportId: "report-a",
      reportIds: ["report-a"],
      reportCount: 1,
      status: "active",
      version: 1
    });
    expect(zone?.stateHash).toMatch(/^[a-f0-9]{64}$/);
    expect(plan.memberships).toEqual([
      expect.objectContaining({
        reportId: "report-a",
        zoneId: "zone_report-a",
        status: "active"
      })
    ]);
  });

  it("clusters reports within 500 metres", () => {
    const reports = [
      makeReport("report-a", { lat: 18.7883 }),
      makeReport("report-b", { lat: 18.7903 })
    ];
    const [zone] = getActiveZones(
      getPlan(buildCanonicalIncidentZones(reports, [], NOW))
    );

    expect(zone?.reportIds).toEqual(["report-a", "report-b"]);
  });

  it("keeps distant reports in separate zones", () => {
    const reports = [
      makeReport("report-a", { lat: 18.7883 }),
      makeReport("report-b", { lat: 18.8083 })
    ];
    const zones = getActiveZones(
      getPlan(buildCanonicalIncidentZones(reports, [], NOW))
    );

    expect(zones.map((zone) => zone.reportIds)).toEqual([
      ["report-a"],
      ["report-b"]
    ]);
  });

  it("uses transitive connected components for nearby report chains", () => {
    const reports = [
      makeReport("report-a", { lat: 18.78 }),
      makeReport("report-b", { lat: 18.784 }),
      makeReport("report-c", { lat: 18.788 })
    ];
    const zones = getActiveZones(
      getPlan(buildCanonicalIncidentZones(reports, [], NOW))
    );

    expect(zones).toHaveLength(1);
    expect(zones[0]?.reportIds).toEqual([
      "report-a",
      "report-b",
      "report-c"
    ]);
  });

  it("excludes hidden and rejected reports from active intelligence", () => {
    const reports = [
      makeReport("active"),
      makeReport("hidden", { moderationStatus: "ถูกซ่อน" }),
      makeReport("rejected", { verificationStatus: "ถูกปฏิเสธ" })
    ];
    const plan = getPlan(buildCanonicalIncidentZones(reports, [], NOW));

    expect(getActiveZones(plan)[0]?.reportIds).toEqual(["active"]);
    expect(plan.excludedReports).toEqual([
      { reportId: "hidden", reason: "hidden" },
      { reportId: "rejected", reason: "rejected" }
    ]);
  });

  it("does not let stale reports bridge otherwise distant active zones", () => {
    const reports = [
      makeReport("active-west", { lat: 18.78 }),
      makeReport("stale-bridge", {
        lat: 18.784,
        createdAt: NOW - STALE_WINDOW_MS
      }),
      makeReport("active-east", { lat: 18.788 })
    ];
    const plan = getPlan(buildCanonicalIncidentZones(reports, [], NOW));

    expect(getActiveZones(plan)).toHaveLength(2);
    expect(plan.excludedReports).toContainEqual({
      reportId: "stale-bridge",
      reason: "stale"
    });
  });

  it("classifies reports between 180 and 360 minutes as inactive", () => {
    const plan = getPlan(
      buildCanonicalIncidentZones(
        [
          makeReport("aging", {
            createdAt: NOW - ACTIVE_MEMBERSHIP_WINDOW_MS
          })
        ],
        [],
        NOW
      )
    );

    expect(getActiveZones(plan)).toHaveLength(0);
    expect(plan.excludedReports).toEqual([
      { reportId: "aging", reason: "inactive-window" }
    ]);
    expect(plan.memberships[0]).toMatchObject({
      reportId: "aging",
      zoneId: null,
      status: "inactive"
    });
  });

  it("aggregates confirmation, severity, categories, and risk", () => {
    const reports = [
      makeReport("a", {
        category: "wildfire_smoke",
        severity: 3,
        verificationStatus: "ยืนยันแล้ว"
      }),
      makeReport("b", { category: "open_burning", severity: 2 }),
      makeReport("c", { category: "wildfire_smoke", severity: 1 })
    ];
    const [zone] = getActiveZones(
      getPlan(buildCanonicalIncidentZones(reports, [], NOW))
    );

    expect(zone).toMatchObject({
      reportCount: 3,
      verifiedReportCount: 1,
      maxSeverity: 3,
      averageSeverity: 2,
      riskScore: 9,
      riskLevel: "ควรตรวจสอบเร่งด่วน",
      riskRank: 3,
      categories: ["open_burning", "wildfire_smoke"],
      categoryCounts: {
        industrial_smoke: 0,
        open_burning: 1,
        other: 0,
        wildfire_smoke: 2
      }
    });
  });

  it("schedules reevaluation at the watch and active-window boundaries", () => {
    const fresh = makeReport("fresh", {
      createdAt: NOW - 10 * MINUTE_MS
    });
    const freshZone = getActiveZones(
      getPlan(buildCanonicalIncidentZones([fresh], [], NOW))
    )[0];
    const watchZone = getActiveZones(
      getPlan(
        buildCanonicalIncidentZones(
          [makeReport("watch", { createdAt: NOW - WATCH_WINDOW_MS })],
          [],
          NOW
        )
      )
    )[0];

    expect(freshZone?.nextEvaluationAt).toBe(fresh.createdAt + WATCH_WINDOW_MS);
    expect(watchZone?.nextEvaluationAt).toBe(
      NOW - WATCH_WINDOW_MS + ACTIVE_MEMBERSHIP_WINDOW_MS
    );
  });

  it("keeps a zone ID when a member is added", () => {
    const firstReports = [makeReport("report-a", { lat: 18.7883 })];
    const firstPlan = getPlan(
      buildCanonicalIncidentZones(firstReports, [], NOW - MINUTE_MS)
    );
    const firstZone = getActiveZones(firstPlan)[0];
    const nextPlan = getPlan(
      buildCanonicalIncidentZones(
        [...firstReports, makeReport("report-b", { lat: 18.7893 })],
        firstPlan.zones,
        NOW
      )
    );
    const nextZone = getActiveZones(nextPlan)[0];

    expect(nextZone?.id).toBe(firstZone?.id);
    expect(nextZone?.anchorReportId).toBe(firstZone?.anchorReportId);
  });

  it("keeps a zone ID and immutable anchor when a member is removed", () => {
    const reports = [
      makeReport("anchor", { createdAt: NOW - 30 * MINUTE_MS }),
      makeReport("remaining", { createdAt: NOW - 20 * MINUTE_MS })
    ];
    const firstPlan = getPlan(
      buildCanonicalIncidentZones(reports, [], NOW - MINUTE_MS)
    );
    const nextPlan = getPlan(
      buildCanonicalIncidentZones([reports[1]!], firstPlan.zones, NOW)
    );
    const zone = getActiveZones(nextPlan)[0];

    expect(zone?.id).toBe("zone_anchor");
    expect(zone?.anchorReportId).toBe("anchor");
  });

  it("merges into the oldest previous zone and creates an alias", () => {
    const oldReport = makeReport("old", {
      lat: 18.78,
      createdAt: NOW - 40 * MINUTE_MS
    });
    const newerReport = makeReport("newer", {
      lat: 18.788,
      createdAt: NOW - 35 * MINUTE_MS
    });
    const oldZone = getActiveZones(
      getPlan(
        buildCanonicalIncidentZones(
          [oldReport],
          [],
          NOW - 30 * MINUTE_MS
        )
      )
    )[0]!;
    const newerZone = getActiveZones(
      getPlan(
        buildCanonicalIncidentZones(
          [newerReport],
          [],
          NOW - 20 * MINUTE_MS
        )
      )
    )[0]!;
    const bridge = makeReport("bridge", { lat: 18.784 });
    const mergedPlan = getPlan(
      buildCanonicalIncidentZones(
        [oldReport, newerReport, bridge],
        [newerZone, oldZone],
        NOW
      )
    );

    expect(getActiveZones(mergedPlan)[0]?.id).toBe(oldZone.id);
    expect(mergedPlan.aliases).toEqual([
      expect.objectContaining({
        oldZoneId: newerZone.id,
        canonicalZoneId: oldZone.id,
        reason: "merged"
      })
    ]);
    expect(mergedPlan.zones.find((zone) => zone.id === newerZone.id)?.status).toBe(
      "resolved"
    );
  });

  it("uses lexical zone ID as the deterministic merge tie-break", () => {
    const reportA = makeReport("a");
    const reportZ = makeReport("z");
    const zoneA = getActiveZones(
      getPlan(buildCanonicalIncidentZones([reportA], [], NOW))
    )[0]!;
    const zoneZ = getActiveZones(
      getPlan(buildCanonicalIncidentZones([reportZ], [], NOW))
    )[0]!;

    expect(
      selectCanonicalMergeZone([
        { ...zoneZ, createdAt: zoneA.createdAt },
        zoneA
      ]).id
    ).toBe(zoneA.id);
  });

  it("retains the old ID on the split component with greatest overlap", () => {
    const initialReports = [
      makeReport("a", { lat: 18.78, createdAt: NOW - 40 * MINUTE_MS }),
      makeReport("b", { lat: 18.783, createdAt: NOW - 35 * MINUTE_MS }),
      makeReport("c", { lat: 18.786, createdAt: NOW - 30 * MINUTE_MS }),
      makeReport("d", { lat: 18.789, createdAt: NOW - 25 * MINUTE_MS })
    ];
    const previousPlan = getPlan(
      buildCanonicalIncidentZones(initialReports, [], NOW - 20 * MINUTE_MS)
    );
    const previousZone = getActiveZones(previousPlan)[0]!;
    const splitReports = [
      { ...initialReports[0]!, lat: 18.78 },
      { ...initialReports[1]!, lat: 18.781 },
      { ...initialReports[2]!, lat: 18.81 },
      { ...initialReports[3]!, lat: 18.811 }
    ];
    const splitPlan = getPlan(
      buildCanonicalIncidentZones(splitReports, previousPlan.zones, NOW)
    );
    const activeZones = getActiveZones(splitPlan);

    expect(splitPlan.stats.zonesSplit).toBe(1);
    expect(
      activeZones.find((zone) => zone.id === previousZone.id)?.reportIds
    ).toEqual(["a", "b"]);
    expect(activeZones.find((zone) => zone.id !== previousZone.id)?.reportIds).toEqual([
      "c",
      "d"
    ]);
  });

  it("does not rename a zone when its original anchor is hidden", () => {
    const reports = [
      makeReport("anchor", { createdAt: NOW - 30 * MINUTE_MS }),
      makeReport("active", { createdAt: NOW - 20 * MINUTE_MS })
    ];
    const firstPlan = getPlan(
      buildCanonicalIncidentZones(reports, [], NOW - MINUTE_MS)
    );
    const nextPlan = getPlan(
      buildCanonicalIncidentZones(
        [{ ...reports[0]!, moderationStatus: "ถูกซ่อน" }, reports[1]!],
        firstPlan.zones,
        NOW
      )
    );
    const zone = getActiveZones(nextPlan)[0];

    expect(zone?.id).toBe("zone_anchor");
    expect(zone?.anchorReportId).toBe("anchor");
    expect(zone?.reportIds).toEqual(["active"]);
  });

  it("is deterministic across report and previous-zone input ordering", () => {
    const reports = [
      makeReport("c", { lat: 18.81 }),
      makeReport("a", { lat: 18.78 }),
      makeReport("b", { lat: 18.781 })
    ];
    const first = getPlan(buildCanonicalIncidentZones(reports, [], NOW));
    const forward = getPlan(
      buildCanonicalIncidentZones(reports, first.zones, NOW)
    );
    const reverse = getPlan(
      buildCanonicalIncidentZones(
        [...reports].reverse(),
        [...first.zones].reverse(),
        NOW
      )
    );

    expect(reverse).toEqual(forward);
  });

  it("does not bump version or updatedAt on an idempotent recomputation", () => {
    const reports = [makeReport("report-a")];
    const firstPlan = getPlan(
      buildCanonicalIncidentZones(reports, [], NOW - MINUTE_MS)
    );
    const firstZone = firstPlan.zones[0]!;
    const secondPlan = getPlan(
      buildCanonicalIncidentZones(reports, firstPlan.zones, NOW)
    );
    const secondZone = secondPlan.zones[0]!;

    expect(secondZone.stateHash).toBe(firstZone.stateHash);
    expect(secondZone.version).toBe(firstZone.version);
    expect(secondZone.updatedAt).toBe(firstZone.updatedAt);
    expect(secondPlan.zoneUpserts).toEqual([]);
    expect(secondPlan.unchangedZoneIds).toEqual([firstZone.id]);
  });

  it("changes state hash and version when semantic state changes", () => {
    const report = makeReport("report-a", { severity: 1 });
    const firstPlan = getPlan(
      buildCanonicalIncidentZones([report], [], NOW - MINUTE_MS)
    );
    const nextPlan = getPlan(
      buildCanonicalIncidentZones(
        [{ ...report, severity: 3 }],
        firstPlan.zones,
        NOW
      )
    );

    expect(nextPlan.zones[0]?.stateHash).not.toBe(firstPlan.zones[0]?.stateHash);
    expect(nextPlan.zones[0]?.version).toBe(firstPlan.zones[0]!.version + 1);
    expect(nextPlan.zoneUpserts).toHaveLength(1);
  });

  it("hashes equivalent object key order to the same value", () => {
    const zone = getPlan(
      buildCanonicalIncidentZones([makeReport("report-a")], [], NOW)
    ).zones[0]!;
    const reorderedCounts: IncidentZoneCategoryCounts = {
      wildfire_smoke: zone.categoryCounts.wildfire_smoke,
      other: zone.categoryCounts.other,
      open_burning: zone.categoryCounts.open_burning,
      industrial_smoke: zone.categoryCounts.industrial_smoke
    };

    expect(calculateZoneStateHash({ ...zone, categoryCounts: reorderedCounts })).toBe(
      calculateZoneStateHash(zone)
    );
  });

  it("keeps an empty previous zone as resolved instead of deleting it", () => {
    const firstPlan = getPlan(
      buildCanonicalIncidentZones([makeReport("report-a")], [], NOW - MINUTE_MS)
    );
    const nextPlan = getPlan(
      buildCanonicalIncidentZones([], firstPlan.zones, NOW)
    );

    expect(nextPlan.zones).toHaveLength(1);
    expect(nextPlan.zones[0]).toMatchObject({
      id: firstPlan.zones[0]?.id,
      status: "resolved",
      reportIds: ["report-a"]
    });
  });

  it("marks an empty zone hidden when all known members are hidden", () => {
    const report = makeReport("report-a");
    const firstPlan = getPlan(
      buildCanonicalIncidentZones([report], [], NOW - MINUTE_MS)
    );
    const nextPlan = getPlan(
      buildCanonicalIncidentZones(
        [{ ...report, moderationStatus: "ถูกซ่อน" }],
        firstPlan.zones,
        NOW
      )
    );

    expect(nextPlan.zones[0]?.status).toBe("hidden");
  });

  it("keeps an incomplete historical zone resolved when missing members are unknown", () => {
    const reports = [makeReport("a"), makeReport("b")];
    const firstPlan = getPlan(
      buildCanonicalIncidentZones(reports, [], NOW - MINUTE_MS)
    );
    const nextPlan = getPlan(
      buildCanonicalIncidentZones(
        [{ ...reports[0]!, moderationStatus: "ถูกซ่อน" }],
        firstPlan.zones,
        NOW
      )
    );

    expect(nextPlan.zones[0]?.status).toBe("resolved");
  });

  it("uses collision-safe component keys for report IDs containing separators", () => {
    const reports = [
      makeReport("a|b", { lat: 18.78 }),
      makeReport("c", { lat: 18.781 }),
      makeReport("a", { lat: 18.81 }),
      makeReport("b|c", { lat: 18.811 })
    ];
    const zones = getActiveZones(
      getPlan(buildCanonicalIncidentZones(reports, [], NOW))
    );

    expect(zones).toHaveLength(2);
    expect(zones.map((zone) => zone.reportIds)).toEqual([
      ["a", "b|c"],
      ["a|b", "c"]
    ]);
  });

  it("returns an explicit result when the candidate cap is exceeded", () => {
    const result = buildCanonicalIncidentZones(
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
    expect("plan" in result).toBe(false);
  });

  it("returns an explicit result when BFS expansion exceeds its cap", () => {
    const result = buildCanonicalIncidentZones(
      [
        makeReport("a", { lat: 18.78 }),
        makeReport("b", { lat: 18.784 }),
        makeReport("c", { lat: 18.788 })
      ],
      [],
      NOW,
      { maxBfsRounds: 1 }
    );

    expect(result).toEqual({
      status: "limit-exceeded",
      limit: "bfs-rounds",
      maximum: 1,
      observed: 2,
      reportsConsidered: 3
    });
    expect("plan" in result).toBe(false);
  });
});
