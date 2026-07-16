import { adaptServerIncidentZonePayload } from "@/lib/firebase/incidentZonePayload";
import type { AlertZone } from "@/lib/incidentIntelligence";
import {
  resolveIncidentZoneAliasMap,
  resolveIncidentZoneWithAliasLookup,
  selectIncidentZoneSource
} from "@/lib/incidentZoneSource";
import { hasRelevantIncidentZoneReportChange } from "../functions/src/incidentZones/reportChange";
import {
  getIncidentZonePartitionKey,
  getNeighboringPartitionKeys
} from "../functions/src/incidentZones/spatialPartition";

const NOW = new Date("2026-07-16T12:00:00.000Z");

function zone(id: string): AlertZone {
  return {
    id,
    reportIds: [`report-${id}`],
    reportCount: 1,
    centerLat: 18.7883,
    centerLng: 98.9853,
    latestReportAt: "2026-07-16T11:30:00.000Z",
    latestReportAgeMinutes: 30,
    maxSeverity: 2,
    averageSeverity: 2,
    verifiedReportCount: 0,
    riskLevel: "เฝ้าระวัง",
    riskScore: 4,
    primaryAddressLabel: "เชียงใหม่",
    riskFactors: ["มีรายงานใหม่ใน 60 นาที"]
  };
}

function reportRecord(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    lat: 18.7883,
    lng: 98.9853,
    geohash: "w5q6ukqc",
    category: "open_burning",
    severity: 2,
    createdAt: { seconds: 1_752_665_400, nanoseconds: 0 },
    verificationStatus: "รอการยืนยัน",
    moderationStatus: "ปกติ",
    confirmedByReportIds: [],
    addressLabel: "เชียงใหม่",
    flaggedCount: 0,
    ...overrides
  };
}

describe("incident-zone relevant report changes", () => {
  it("detects intelligence fields and ignores flaggedCount-only updates", () => {
    expect(
      hasRelevantIncidentZoneReportChange(
        reportRecord(),
        reportRecord({ severity: 3 })
      )
    ).toBe(true);
    expect(
      hasRelevantIncidentZoneReportChange(
        reportRecord(),
        reportRecord({ flaggedCount: 2 })
      )
    ).toBe(false);
  });

  it("treats create and delete as relevant", () => {
    expect(hasRelevantIncidentZoneReportChange(null, reportRecord())).toBe(true);
    expect(hasRelevantIncidentZoneReportChange(reportRecord(), null)).toBe(true);
    expect(hasRelevantIncidentZoneReportChange(null, null)).toBe(false);
  });

  it("does not depend on object key order", () => {
    const before = reportRecord({
      createdAt: { seconds: 10, nanoseconds: 20 }
    });
    const after = {
      ...before,
      createdAt: { nanoseconds: 20, seconds: 10 }
    };
    expect(hasRelevantIncidentZoneReportChange(before, after)).toBe(false);
  });
});

describe("incident-zone spatial partitions", () => {
  it("uses a deterministic geohash prefix and a bounded 3x3 neighborhood", () => {
    const key = getIncidentZonePartitionKey(
      { lat: 18.7883, lng: 98.9853 },
      "w5q6ukqc"
    );
    const neighbors = getNeighboringPartitionKeys(key);

    expect(key).toBe("w5q6u");
    expect(neighbors).toHaveLength(9);
    expect(neighbors).toContain(key);
    expect(getNeighboringPartitionKeys(key)).toEqual(neighbors);
  });
});

describe("server incident-zone payload adapter", () => {
  it("maps timestamp-like values to the existing AlertZone UI shape", () => {
    const adapted = adaptServerIncidentZonePayload(
      "zone-a",
      {
        reportIds: ["report-a", "report-b"],
        reportCount: 2,
        centerLat: 18.7883,
        centerLng: 98.9853,
        latestReportAt: { toMillis: () => NOW.getTime() - 30 * 60_000 },
        maxSeverity: 3,
        averageSeverity: 2.5,
        verifiedReportCount: 1,
        riskLevel: "น่ากังวล",
        riskScore: 6,
        primaryAddressLabel: "ช้างเผือก",
        riskFactors: ["2 รายงานในรัศมี 500 เมตร"],
        status: "active"
      },
      NOW
    );

    expect(adapted?.status).toBe("active");
    expect(adapted?.zone).toMatchObject({
      id: "zone-a",
      reportCount: 2,
      latestReportAgeMinutes: 30,
      maxSeverity: 3
    });
  });

  it("gracefully defaults an optional address and rejects malformed required fields", () => {
    const base = {
      reportIds: ["report-a"],
      centerLat: 18.7883,
      centerLng: 98.9853,
      latestReportAt: NOW.toISOString(),
      maxSeverity: 1,
      averageSeverity: 1,
      verifiedReportCount: 0,
      riskLevel: "เฝ้าระวัง",
      riskScore: 3,
      riskFactors: [],
      status: "resolved"
    };

    expect(
      adaptServerIncidentZonePayload("zone-a", base, NOW)?.zone
        .primaryAddressLabel
    ).toBe("ไม่ระบุพื้นที่");
    expect(
      adaptServerIncidentZonePayload(
        "zone-a",
        { ...base, centerLat: "invalid" },
        NOW
      )
    ).toBeNull();
  });
});

describe("dual-mode incident-zone source", () => {
  const clientZones = [zone("client")];
  const serverZones = [zone("server")];

  it("always uses client-derived zones in local demo", () => {
    expect(
      selectIncidentZoneSource(false, "ready", serverZones, clientZones)
    ).toEqual({ source: "local-demo", zones: clientZones });
  });

  it("uses canonical server zones only when readiness is settled", () => {
    expect(
      selectIncidentZoneSource(true, "ready", serverZones, clientZones)
    ).toEqual({ source: "server", zones: serverZones });
  });

  it("keeps a ready-empty server result instead of falling back", () => {
    expect(
      selectIncidentZoneSource(true, "empty", [], clientZones)
    ).toEqual({ source: "server", zones: [] });
  });

  it.each(["loading", "not-ready", "error"] as const)(
    "uses the client fallback while server status is %s",
    (status) => {
      expect(
        selectIncidentZoneSource(true, status, serverZones, clientZones)
      ).toEqual({ source: "client-fallback", zones: clientZones });
    }
  );
});

describe("incident-zone alias resolution", () => {
  it("resolves canonical, merged, and chained IDs deterministically", () => {
    expect(resolveIncidentZoneAliasMap("zone-a", new Map())).toEqual({
      status: "resolved",
      canonicalZoneId: "zone-a",
      hops: 0
    });
    expect(
      resolveIncidentZoneAliasMap(
        "zone-old",
        new Map([
          ["zone-old", "zone-middle"],
          ["zone-middle", "zone-current"]
        ])
      )
    ).toEqual({
      status: "resolved",
      canonicalZoneId: "zone-current",
      hops: 2
    });
  });

  it("guards loops and excessive alias chains", () => {
    expect(
      resolveIncidentZoneAliasMap(
        "zone-a",
        new Map([
          ["zone-a", "zone-b"],
          ["zone-b", "zone-a"]
        ])
      )
    ).toEqual({ status: "loop" });
    expect(
      resolveIncidentZoneAliasMap(
        "zone-a",
        new Map([
          ["zone-a", "zone-b"],
          ["zone-b", "zone-c"]
        ]),
        1
      )
    ).toEqual({ status: "max-hops" });
  });

  it("handles missing IDs and keeps resolved-zone lookup data", async () => {
    const aliases = new Map([["zone-old", "zone-resolved"]]);
    const resolved = await resolveIncidentZoneWithAliasLookup(
      "zone-old",
      async (zoneId) =>
        zoneId === "zone-resolved" ? { status: "resolved" as const } : null,
      async (zoneId) => aliases.get(zoneId) ?? null
    );
    const missing = await resolveIncidentZoneWithAliasLookup(
      "zone-missing",
      async () => null,
      async () => null
    );

    expect(resolved).toEqual({
      status: "found",
      canonicalZoneId: "zone-resolved",
      hops: 1,
      value: { status: "resolved" }
    });
    expect(missing).toEqual({ status: "missing" });
  });
});
