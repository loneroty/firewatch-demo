import type { Report, Severity } from "@/lib/types";
import {
  MAX_REPLAY_BUCKETS,
  REPLAY_WINDOW_MS,
  advanceReplayCursor,
  buildReplayBuckets,
  buildReplayChangeSummary,
  buildReplaySnapshot,
  calculateHeatPoints,
  calculateReplayMetrics,
  filterReportsAtCursor,
  findReplayTimeBounds,
  parseReplayTimestamp,
  prepareReplayReports,
  selectReplayViewData,
  shouldClearSelectedReplayZone,
  snapReplayCursorToBucket,
  type ReplaySnapshot,
  type ReplayWindowKey
} from "@/lib/incidentReplay";
import { buildAlertZones } from "@/lib/incidentIntelligence";

const now = new Date("2026-06-29T12:00:00.000Z");
const nowMs = now.getTime();

function hoursAgo(hours: number): string {
  return new Date(nowMs - hours * 60 * 60 * 1_000).toISOString();
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
    createdAt: hoursAgo(1),
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

function makeSnapshot(reports: readonly Report[], cursorMs = nowMs): ReplaySnapshot {
  const alertZones = buildAlertZones(reports, new Date(cursorMs));
  return {
    cursorMs,
    reports: [...reports],
    alertZones,
    heatPoints: calculateHeatPoints(reports),
    metrics: calculateReplayMetrics(reports, alertZones)
  };
}

describe("incident replay", () => {
  it("handles an empty report collection without invalid bounds", () => {
    const prepared = prepareReplayReports([]);

    expect(findReplayTimeBounds(prepared, REPLAY_WINDOW_MS["6h"], nowMs)).toBeNull();
    expect(buildReplayBuckets(prepared, null)).toEqual([]);
    expect(buildReplaySnapshot(prepared, nowMs).reports).toEqual([]);
  });

  it("builds a deterministic snapshot for a single report", () => {
    const report = makeReport();
    const snapshot = buildReplaySnapshot(prepareReplayReports([report]), nowMs);

    expect(snapshot.reports).toEqual([report]);
    expect(snapshot.alertZones).toHaveLength(1);
    expect(snapshot.metrics.reportCount).toBe(1);
  });

  it("returns no reports when the cursor is before the first report", () => {
    const report = makeReport();
    const prepared = prepareReplayReports([report]);

    expect(filterReportsAtCursor(prepared, Date.parse(report.createdAt) - 1)).toEqual([]);
  });

  it("returns all eligible reports when the cursor is after the latest report", () => {
    const reports = [
      makeReport({ id: "older", createdAt: hoursAgo(4) }),
      makeReport({ id: "newer", createdAt: hoursAgo(1) })
    ];

    expect(
      filterReportsAtCursor(prepareReplayReports(reports), nowMs).map(
        (report) => report.id
      )
    ).toEqual(["older", "newer"]);
  });

  it("filters createdAt inclusively at the replay cursor", () => {
    const cursorMs = nowMs - 2 * 60 * 60 * 1_000;
    const reports = [
      makeReport({ id: "before", createdAt: hoursAgo(3) }),
      makeReport({ id: "at-cursor", createdAt: new Date(cursorMs).toISOString() }),
      makeReport({ id: "after", createdAt: hoursAgo(1) })
    ];

    expect(
      filterReportsAtCursor(prepareReplayReports(reports), cursorMs).map(
        (report) => report.id
      )
    ).toEqual(["before", "at-cursor"]);
  });

  it("excludes hidden reports from replay and heat data", () => {
    const prepared = prepareReplayReports([
      makeReport({ id: "visible" }),
      makeReport({ id: "hidden", moderationStatus: "ถูกซ่อน" })
    ]);

    expect(prepared.map(({ report }) => report.id)).toEqual(["visible"]);
    expect(calculateHeatPoints(prepared.map(({ report }) => report))).toHaveLength(1);
  });

  it("excludes rejected reports from replay and heat data", () => {
    const prepared = prepareReplayReports([
      makeReport({ id: "pending" }),
      makeReport({ id: "rejected", verificationStatus: "ถูกปฏิเสธ" })
    ]);

    expect(prepared.map(({ report }) => report.id)).toEqual(["pending"]);
  });

  it("adds heat weight to verified reports", () => {
    const pending = makeReport({ id: "pending", severity: 2 });
    const verified = makeReport({
      id: "verified",
      severity: 2,
      verificationStatus: "ยืนยันแล้ว"
    });
    const points = calculateHeatPoints([pending, verified]);

    expect(points.find((point) => point.reportId === "verified")?.weight).toBeGreaterThan(
      points.find((point) => point.reportId === "pending")?.weight ?? 0
    );
  });

  it.each<[Severity, number]>([
    [1, 0.3],
    [2, 0.55],
    [3, 0.8]
  ])("maps severity %s to heat weight %s", (severity, expectedWeight) => {
    expect(calculateHeatPoints([makeReport({ severity })])[0]?.weight).toBe(
      expectedWeight
    );
  });

  it("finds bounds from the first report in the selected window through now", () => {
    const prepared = prepareReplayReports([
      makeReport({ id: "outside", createdAt: hoursAgo(8) }),
      makeReport({ id: "inside-first", createdAt: hoursAgo(5) }),
      makeReport({ id: "inside-latest", createdAt: hoursAgo(1) })
    ]);

    expect(findReplayTimeBounds(prepared, REPLAY_WINDOW_MS["6h"], nowMs)).toEqual({
      startMs: Date.parse(hoursAgo(5)),
      endMs: nowMs
    });
  });

  it.each<[ReplayWindowKey, string[]]>([
    ["1h", ["report-0.5"]],
    ["3h", ["report-2", "report-0.5"]],
    ["6h", ["report-5", "report-2", "report-0.5"]],
    ["12h", ["report-10", "report-5", "report-2", "report-0.5"]],
    ["24h", ["report-20", "report-10", "report-5", "report-2", "report-0.5"]],
    [
      "all",
      ["report-30", "report-20", "report-10", "report-5", "report-2", "report-0.5"]
    ]
  ])("applies the %s replay window", (windowKey, expectedIds) => {
    const prepared = prepareReplayReports(
      [30, 20, 10, 5, 2, 0.5].map((hours) =>
        makeReport({ id: `report-${hours}`, createdAt: hoursAgo(hours) })
      )
    );
    const bounds = findReplayTimeBounds(
      prepared,
      REPLAY_WINDOW_MS[windowKey],
      nowMs
    );

    expect(bounds).not.toBeNull();
    expect(
      filterReportsAtCursor(prepared, bounds?.endMs ?? 0, bounds?.startMs).map(
        (report) => report.id
      )
    ).toEqual(expectedIds);
  });

  it("produces the same snapshot for the same input", () => {
    const prepared = prepareReplayReports([
      makeReport({ id: "a", severity: 3 }),
      makeReport({ id: "b", lat: 18.789, lng: 98.986 })
    ]);

    expect(buildReplaySnapshot(prepared, nowMs)).toEqual(
      buildReplaySnapshot(prepared, nowMs)
    );
  });

  it("produces equal snapshots when input order changes", () => {
    const first = makeReport({ id: "a", createdAt: hoursAgo(2) });
    const second = makeReport({ id: "b", createdAt: hoursAgo(1) });

    expect(buildReplaySnapshot(prepareReplayReports([first, second]), nowMs)).toEqual(
      buildReplaySnapshot(prepareReplayReports([second, first]), nowMs)
    );
  });

  it("falls back safely for an invalid deep-link timestamp", () => {
    expect(parseReplayTimestamp("not-a-time", nowMs)).toBe(nowMs);
    expect(parseReplayTimestamp(null, nowMs)).toBe(nowMs);
  });

  it("accepts ISO and epoch-second deep-link timestamps", () => {
    expect(parseReplayTimestamp(now.toISOString(), 0)).toBe(nowMs);
    expect(parseReplayTimestamp(String(nowMs / 1_000), 0)).toBe(nowMs);
  });

  it("excludes reports with invalid timestamps or coordinates", () => {
    const prepared = prepareReplayReports([
      makeReport({ id: "valid" }),
      makeReport({ id: "bad-time", createdAt: "invalid" }),
      makeReport({ id: "bad-lat", lat: 91 }),
      makeReport({ id: "bad-lng", lng: 181 })
    ]);

    expect(prepared.map(({ report }) => report.id)).toEqual(["valid"]);
  });

  it("aggregates 1,000 reports into no more than the configured bucket cap", () => {
    const reports = Array.from({ length: 1_000 }, (_, index) =>
      makeReport({
        id: `report-${String(index).padStart(4, "0")}`,
        createdAt: new Date(nowMs - (1_000 - index) * 60_000).toISOString(),
        severity: index % 3 === 0 ? 3 : 1,
        verificationStatus: index % 4 === 0 ? "ยืนยันแล้ว" : "รอการยืนยัน"
      })
    );
    const prepared = prepareReplayReports(reports);
    const bounds = findReplayTimeBounds(prepared, REPLAY_WINDOW_MS.all, nowMs);
    const buckets = buildReplayBuckets(prepared, bounds);

    expect(buckets.length).toBeLessThanOrEqual(MAX_REPLAY_BUCKETS);
    expect(buckets.reduce((sum, bucket) => sum + bucket.reportCount, 0)).toBe(1_000);
    expect(buckets.some((bucket) => bucket.severity3Count > 0)).toBe(true);
  });

  it("calculates replay metrics from the current snapshot", () => {
    const reports = [
      makeReport({ id: "high", severity: 3 }),
      makeReport({ id: "verified", verificationStatus: "ยืนยันแล้ว" })
    ];
    const zones = buildAlertZones(reports, now);

    expect(calculateReplayMetrics(reports, zones)).toEqual({
      reportCount: 2,
      alertZoneCount: 1,
      severity3Count: 1,
      verifiedCount: 1
    });
  });

  it("summarizes new reports, severity, confirmation, and risk escalation", () => {
    const first = makeReport({ id: "first", severity: 1 });
    const urgent = makeReport({
      id: "urgent",
      lat: 18.789,
      lng: 98.986,
      severity: 3,
      verificationStatus: "ยืนยันแล้ว"
    });
    const summary = buildReplayChangeSummary(
      makeSnapshot([first], nowMs - 1),
      makeSnapshot([first, urgent], nowMs)
    );

    expect(summary).toMatchObject({
      newReportCount: 1,
      newZoneCount: 0,
      riskEscalationCount: 1,
      severity3Delta: 1,
      confirmedDelta: 1
    });
  });

  it("detects a zone merge when a new report bridges two prior zones", () => {
    const west = makeReport({ id: "west", lng: 98.9853 });
    const east = makeReport({ id: "east", lng: 98.9943 });
    const bridge = makeReport({ id: "bridge", lng: 98.9898 });
    const summary = buildReplayChangeSummary(
      makeSnapshot([west, east], nowMs - 1),
      makeSnapshot([west, east, bridge], nowMs)
    );

    expect(summary.zoneMergeCount).toBe(1);
  });

  it("stops playback at the end of the selected bounds", () => {
    const bounds = { startMs: 1_000, endMs: 11_000 };

    expect(advanceReplayCursor(1_000, 30_000, bounds, 1)).toEqual({
      cursorMs: 11_000,
      ended: true
    });
  });

  it("does not jump to the end when the first animation frame is slightly negative", () => {
    const bounds = { startMs: 1_000, endMs: 11_000 };

    expect(advanceReplayCursor(1_000, -0.5, bounds, 1)).toEqual({
      cursorMs: 1_000,
      ended: false
    });
  });

  it("snaps playback updates to aggregate bucket boundaries", () => {
    const prepared = prepareReplayReports([
      makeReport({ id: "first", createdAt: hoursAgo(2) }),
      makeReport({ id: "second", createdAt: hoursAgo(1) })
    ]);
    const bounds = findReplayTimeBounds(prepared, REPLAY_WINDOW_MS["3h"], nowMs);
    const buckets = buildReplayBuckets(prepared, bounds, 4);

    expect(bounds).not.toBeNull();
    expect(
      bounds ? snapReplayCursorToBucket(bounds.endMs - 1, bounds, buckets) : 0
    ).toBe(buckets.at(-2)?.endMs ?? bounds?.startMs);
  });

  it("clears a selected zone only when it is absent from the snapshot", () => {
    const zones = buildAlertZones([makeReport()], now);

    expect(shouldClearSelectedReplayZone(zones[0]?.id ?? null, zones)).toBe(false);
    expect(shouldClearSelectedReplayZone("zone-missing", zones)).toBe(true);
    expect(shouldClearSelectedReplayZone(null, zones)).toBe(false);
  });

  it("preserves the exact live report and zone collections in live mode", () => {
    const reports = [makeReport()];
    const zones = buildAlertZones(reports, now);
    const replaySnapshot = buildReplaySnapshot(prepareReplayReports(reports), nowMs);
    const view = selectReplayViewData("live", reports, zones, replaySnapshot);

    expect(view.reports).toBe(reports);
    expect(view.alertZones).toBe(zones);
  });

  it("does not mutate the input report order", () => {
    const reports = [
      makeReport({ id: "newer", createdAt: hoursAgo(1) }),
      makeReport({ id: "older", createdAt: hoursAgo(2) })
    ];
    const originalIds = reports.map((report) => report.id);

    prepareReplayReports(reports);

    expect(reports.map((report) => report.id)).toEqual(originalIds);
  });
});
