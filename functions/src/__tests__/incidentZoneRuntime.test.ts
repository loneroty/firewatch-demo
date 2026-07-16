import {
  initializeTestEnvironment,
  type RulesTestEnvironment
} from "@firebase/rules-unit-testing";
import { deleteApp, getApps, initializeApp, type App } from "firebase-admin/app";
import { getFirestore, Timestamp, type Firestore } from "firebase-admin/firestore";
import { encodeGeohash } from "../geohash";
import { adaptReportDocument } from "../incidentZones/reportAdapter";
import {
  toEpochMilliseconds,
  toFirestoreTimestamp
} from "../incidentZones/firestoreAdapter";
import {
  buildDirtyRegionTargets,
  enqueueDirtyRegionTargets,
  enqueueIncidentZoneDirtyRegion
} from "../incidentZones/dirtyRegion";
import {
  acquireIncidentZoneLease,
  INCIDENT_ZONE_MAX_ATTEMPTS,
  markIncidentZoneLeaseFailed,
  workIncidentZoneJob
} from "../incidentZones/worker";
import { getIncidentZonePartitionKey } from "../incidentZones/spatialPartition";
import { writeIncidentZonePlan } from "../incidentZones/zoneWriter";
import { runIncidentZoneMaintenance } from "../incidentZones/maintenance";
import {
  ACTIVE_MEMBERSHIP_WINDOW_MS,
  buildCanonicalIncidentZones,
  WATCH_WINDOW_MS
} from "../incidentZones/domain";
import type {
  IncidentZoneMembership,
  IncidentZoneRecomputationPlan
} from "../incidentZones/types";

const PROJECT_ID = "firewatch-functions-test";
const NOW_MS = Date.parse("2026-07-16T12:00:00.000Z");

let testEnv: RulesTestEnvironment;
let app: App;
let db: Firestore;

function reportData(
  id: string,
  overrides: Record<string, unknown> = {}
): Record<string, unknown> {
  const lat = typeof overrides.lat === "number" ? overrides.lat : 18.7883;
  const lng = typeof overrides.lng === "number" ? overrides.lng : 98.9853;
  return {
    id,
    lat,
    lng,
    geohash: encodeGeohash(lat, lng, 8),
    photoURL: "https://example.test/report.jpg",
    category: "open_burning",
    severity: 2,
    createdAt: Timestamp.fromMillis(NOW_MS - 10 * 60_000),
    userId: `user-${id}`,
    verificationStatus: "รอการยืนยัน",
    confirmedByReportIds: [],
    isThrottled: false,
    flaggedCount: 0,
    moderationStatus: "ปกติ",
    addressLabel: "เชียงใหม่",
    notes: "ควัน",
    ...overrides
  };
}

async function seedReport(
  id: string,
  overrides: Record<string, unknown> = {}
): Promise<Record<string, unknown>> {
  const data = reportData(id, overrides);
  await db.collection("reports").doc(id).set(data);
  return data;
}

async function enqueueCreatedReport(
  id: string,
  data: Record<string, unknown>
): Promise<ReturnType<typeof buildDirtyRegionTargets>> {
  const targets = buildDirtyRegionTargets(id, null, data, NOW_MS);
  if (targets === null) {
    throw new Error("Expected a dirty-region target for a created report.");
  }
  await enqueueDirtyRegionTargets(db, targets, NOW_MS);
  return targets;
}

function ownerPartitionFor(data: Record<string, unknown>): string {
  return getIncidentZonePartitionKey({
    lat: data.lat as number,
    lng: data.lng as number
  });
}

async function processOwner(
  data: Record<string, unknown>,
  suffix: string,
  now = NOW_MS
) {
  return workIncidentZoneJob(
    db,
    ownerPartitionFor(data),
    `runtime-test-${suffix}`,
    now
  );
}

function emptyPlan(
  memberships: IncidentZoneMembership[] = []
): IncidentZoneRecomputationPlan {
  return {
    zones: [],
    zoneUpserts: [],
    unchangedZoneIds: [],
    aliases: [],
    memberships,
    excludedReports: [],
    stats: {
      reportsConsidered: 0,
      reportsEligible: 0,
      reportsExcluded: 0,
      activeZones: 0,
      zonesCreated: 0,
      zonesMerged: 0,
      zonesSplit: 0,
      aliasesPlanned: 0,
      membershipsPlanned: memberships.length,
      stateChangesPlanned: 0
    }
  };
}

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: { host: "127.0.0.1", port: 8080 }
  });
  app = initializeApp({ projectId: PROJECT_ID }, "incident-zone-runtime-test");
  db = getFirestore(app);
});

afterEach(async () => {
  await testEnv.clearFirestore();
});

afterAll(async () => {
  await testEnv.cleanup();
  await Promise.all(getApps().map((firebaseApp) => deleteApp(firebaseApp)));
});

describe("incident-zone Firestore adapters and dirty jobs", () => {
  it("converts Timestamp reports and supplies graceful legacy optional defaults", () => {
    expect(
      toEpochMilliseconds(toFirestoreTimestamp(NOW_MS))
    ).toBe(NOW_MS);
    const adapted = adaptReportDocument("report-a", {
      lat: 18.7883,
      lng: 98.9853,
      category: "open_burning",
      severity: 2,
      createdAt: Timestamp.fromMillis(NOW_MS)
    });

    expect(adapted).toMatchObject({
      status: "ok",
      value: {
        report: {
          createdAt: NOW_MS,
          verificationStatus: "รอการยืนยัน",
          moderationStatus: "ปกติ"
        }
      }
    });
    expect(
      adaptReportDocument("report-b", {
        lat: 999,
        lng: 98.9853,
        category: "open_burning",
        severity: 2,
        createdAt: Timestamp.fromMillis(NOW_MS)
      })
    ).toMatchObject({ status: "malformed" });
  });

  it("does not enqueue an unrelated flaggedCount-only update", async () => {
    const before = reportData("report-a");
    const after = { ...before, flaggedCount: 1 };

    await expect(
      enqueueIncidentZoneDirtyRegion(db, "report-a", before, after, NOW_MS)
    ).resolves.toBe(false);
    await expect(db.collection("incidentZoneJobs").get()).resolves.toMatchObject({
      size: 0
    });
  });

  it("coalesces rapid changes by partition and increments generation", async () => {
    const before = await seedReport("report-a");
    const firstTargets = await enqueueCreatedReport("report-a", before);
    const after = { ...before, severity: 3 };
    await db.collection("reports").doc("report-a").set(after);
    const secondTargets = buildDirtyRegionTargets(
      "report-a",
      before,
      after,
      NOW_MS + 1_000
    );
    if (secondTargets === null) {
      throw new Error("Expected relevant update targets.");
    }
    await enqueueDirtyRegionTargets(db, secondTargets, NOW_MS + 1_000);

    const jobs = await db.collection("incidentZoneJobs").get();
    expect(jobs.size).toBe(firstTargets?.partitionKeys.length);
    jobs.docs.forEach((document) => {
      expect(document.data()).toMatchObject({ generation: 2, status: "pending" });
    });
  });

  it("marks both old and new neighborhoods when a report moves", () => {
    const before = reportData("report-a");
    const after = reportData("report-a", { lat: 13.7563, lng: 100.5018 });
    const targets = buildDirtyRegionTargets(
      "report-a",
      before,
      after,
      NOW_MS
    );

    expect(targets?.centers).toHaveLength(2);
    expect(targets?.partitionKeys.length).toBeGreaterThan(9);
  });
});

describe("incident-zone worker and transactional writer", () => {
  it("creates canonical state once and makes retry idempotent", async () => {
    const report = await seedReport("report-a");
    await enqueueCreatedReport("report-a", report);

    await expect(processOwner(report, "first")).resolves.toMatchObject({
      status: "completed"
    });
    const zonesAfterFirstRun = await db.collection("incidentZones").get();
    expect(zonesAfterFirstRun.size).toBe(1);
    const firstZone = zonesAfterFirstRun.docs[0];
    expect(firstZone).toBeDefined();
    const firstVersion = firstZone?.data().version;
    const firstUpdatedAt = firstZone?.data().updatedAt.toMillis();

    const directTargets = buildDirtyRegionTargets(
      "report-a",
      null,
      report,
      NOW_MS
    );
    if (directTargets === null) {
      throw new Error("Expected repeat dirty targets.");
    }
    await enqueueDirtyRegionTargets(db, directTargets, NOW_MS);
    await expect(processOwner(report, "repeat")).resolves.toMatchObject({
      status: "completed"
    });

    const zonesAfterRetry = await db.collection("incidentZones").get();
    expect(zonesAfterRetry.size).toBe(1);
    expect(zonesAfterRetry.docs[0]?.data()).toMatchObject({ version: firstVersion });
    expect(zonesAfterRetry.docs[0]?.data().updatedAt.toMillis()).toBe(firstUpdatedAt);
  });

  it("forwards overlapping neighbor jobs to one deterministic owner", async () => {
    const report = await seedReport("report-a");
    const targets = await enqueueCreatedReport("report-a", report);
    if (targets === null) {
      throw new Error("Expected dirty targets.");
    }
    const owner = ownerPartitionFor(report);
    const neighbor = targets.partitionKeys.find((key) => key !== owner);
    if (!neighbor) {
      throw new Error("Expected a neighboring partition.");
    }

    await expect(
      workIncidentZoneJob(db, neighbor, "neighbor-worker", NOW_MS)
    ).resolves.toMatchObject({ status: "forwarded", ownerPartitionKey: owner });
    await expect(processOwner(report, "owner")).resolves.toMatchObject({
      status: "completed"
    });
    expect((await db.collection("incidentZones").get()).size).toBe(1);
  });

  it("preserves metadata when overlapping jobs create the same canonical zone", async () => {
    const rawReport = await seedReport("report-a");
    const targets = await enqueueCreatedReport("report-a", rawReport);
    if (targets === null) {
      throw new Error("Expected dirty targets.");
    }
    const owner = ownerPartitionFor(rawReport);
    const neighbor = targets.partitionKeys.find((key) => key !== owner);
    if (!neighbor) {
      throw new Error("Expected a neighboring partition.");
    }
    const ownerLease = await acquireIncidentZoneLease(
      db,
      owner,
      "concurrent-owner",
      NOW_MS
    );
    const neighborLease = await acquireIncidentZoneLease(
      db,
      neighbor,
      "concurrent-neighbor",
      NOW_MS
    );
    const adapted = adaptReportDocument("report-a", rawReport);
    if (
      ownerLease === null ||
      neighborLease === null ||
      adapted.status !== "ok"
    ) {
      throw new Error("Expected two leases and a valid report.");
    }

    const firstBuild = buildCanonicalIncidentZones(
      [adapted.value.report],
      [],
      NOW_MS
    );
    const retryBuild = buildCanonicalIncidentZones(
      [adapted.value.report],
      [],
      NOW_MS + 1_000
    );
    if (firstBuild.status !== "ok" || retryBuild.status !== "ok") {
      throw new Error("Expected bounded canonical plans.");
    }

    await expect(
      writeIncidentZonePlan(
        db,
        ownerLease,
        firstBuild.plan,
        [],
        NOW_MS
      )
    ).resolves.toMatchObject({ status: "written" });
    const zoneId = firstBuild.plan.zones[0]?.id;
    if (!zoneId) {
      throw new Error("Expected a canonical zone ID.");
    }
    const firstSnapshot = await db.collection("incidentZones").doc(zoneId).get();
    const firstCreatedAt = firstSnapshot.data()?.createdAt.toMillis();
    const firstUpdatedAt = firstSnapshot.data()?.updatedAt.toMillis();
    const firstVersion = firstSnapshot.data()?.version;

    await expect(
      writeIncidentZonePlan(
        db,
        neighborLease,
        retryBuild.plan,
        [],
        NOW_MS + 1_000
      )
    ).resolves.toMatchObject({ status: "written" });
    const afterRetry = await db.collection("incidentZones").doc(zoneId).get();
    expect(afterRetry.data()?.createdAt.toMillis()).toBe(firstCreatedAt);
    expect(afterRetry.data()?.updatedAt.toMillis()).toBe(firstUpdatedAt);
    expect(afterRetry.data()?.version).toBe(firstVersion);
  });

  it("keeps newer generation pending and writes no stale canonical state", async () => {
    const report = await seedReport("report-a");
    const targets = await enqueueCreatedReport("report-a", report);
    if (targets === null) {
      throw new Error("Expected dirty targets.");
    }
    const owner = ownerPartitionFor(report);
    const lease = await acquireIncidentZoneLease(
      db,
      owner,
      "generation-worker",
      NOW_MS
    );
    if (lease === null) {
      throw new Error("Expected a lease.");
    }
    await enqueueDirtyRegionTargets(db, targets, NOW_MS + 1_000);

    await expect(
      writeIncidentZonePlan(db, lease, emptyPlan(), [], NOW_MS + 2_000)
    ).resolves.toEqual({ status: "stale-generation" });
    expect((await db.collection("incidentZones").get()).size).toBe(0);
    await expect(
      db.collection("incidentZoneJobs").doc(owner).get()
    ).resolves.toMatchObject({ exists: true });
    expect(
      (await db.collection("incidentZoneJobs").doc(owner).get()).data()?.status
    ).toBe("pending");
  });

  it("stops retrying a failed generation after the bounded attempt budget", async () => {
    const report = await seedReport("report-a");
    await enqueueCreatedReport("report-a", report);
    const owner = ownerPartitionFor(report);
    let attemptTime = NOW_MS;

    for (let attempt = 1; attempt <= INCIDENT_ZONE_MAX_ATTEMPTS; attempt += 1) {
      const lease = await acquireIncidentZoneLease(
        db,
        owner,
        `bounded-retry-${attempt}`,
        attemptTime
      );
      if (lease === null) {
        throw new Error(`Expected retry lease ${attempt}.`);
      }
      await markIncidentZoneLeaseFailed(
        db,
        lease,
        "test-failure",
        attemptTime
      );
      attemptTime += 16 * 60_000;
    }

    const terminalJob = await db.collection("incidentZoneJobs").doc(owner).get();
    expect(terminalJob.data()).toMatchObject({
      status: "failed",
      attempts: INCIDENT_ZONE_MAX_ATTEMPTS,
      nextAttemptAt: null
    });
    await expect(
      acquireIncidentZoneLease(
        db,
        owner,
        "retry-after-budget",
        attemptTime
      )
    ).resolves.toBeNull();
    expect((await db.collection("incidentZones").get()).size).toBe(0);
  });

  it("merges bridged zones and persists a bounded canonical alias", async () => {
    const first = await seedReport("report-a", { lng: 98.981 });
    const second = await seedReport("report-b", { lng: 98.9895 });
    await enqueueCreatedReport("report-a", first);
    await enqueueCreatedReport("report-b", second);
    await processOwner(first, "two-zones");
    expect((await db.collection("incidentZones").get()).size).toBe(2);

    const bridge = await seedReport("report-c", { lng: 98.98525 });
    await enqueueCreatedReport("report-c", bridge);
    await expect(processOwner(bridge, "merge")).resolves.toMatchObject({
      status: "completed"
    });

    const activeZones = await db
      .collection("incidentZones")
      .where("status", "==", "active")
      .get();
    const aliases = await db.collection("incidentZoneAliases").get();
    expect(activeZones.size).toBe(1);
    expect(aliases.size).toBe(1);
    expect(aliases.docs[0]?.data()).toMatchObject({ reason: "merge" });
  });

  it("removes a hidden report from membership and preserves its zone as hidden", async () => {
    const before = await seedReport("report-a");
    await enqueueCreatedReport("report-a", before);
    await processOwner(before, "visible");
    const zoneId = (await db.collection("incidentZones").get()).docs[0]?.id;
    expect(zoneId).toBeDefined();

    const after = { ...before, moderationStatus: "ถูกซ่อน" };
    await db.collection("reports").doc("report-a").set(after);
    const targets = buildDirtyRegionTargets(
      "report-a",
      before,
      after,
      NOW_MS + 1_000
    );
    if (targets === null) {
      throw new Error("Expected hidden-report dirty targets.");
    }
    await enqueueDirtyRegionTargets(db, targets, NOW_MS + 1_000);
    await processOwner(after, "hidden", NOW_MS + 1_000);

    expect((await db.collection("incidentZones").doc(zoneId).get()).data()?.status).toBe(
      "hidden"
    );
    expect(
      (await db.collection("incidentZoneMemberships").doc("report-a").get()).data()
    ).toMatchObject({ status: "inactive" });
  });

  it("resolves an empty zone after its only report is deleted", async () => {
    const before = await seedReport("report-a");
    await enqueueCreatedReport("report-a", before);
    await processOwner(before, "before-delete");
    const zoneId = (await db.collection("incidentZones").get()).docs[0]?.id;
    if (!zoneId) {
      throw new Error("Expected an initial canonical zone.");
    }

    await db.collection("reports").doc("report-a").delete();
    const targets = buildDirtyRegionTargets(
      "report-a",
      before,
      null,
      NOW_MS + 1_000
    );
    if (targets === null) {
      throw new Error("Expected delete dirty targets.");
    }
    await enqueueDirtyRegionTargets(db, targets, NOW_MS + 1_000);
    await processOwner(before, "after-delete", NOW_MS + 1_000);

    const zone = await db.collection("incidentZones").doc(zoneId).get();
    expect(zone.exists).toBe(true);
    expect(zone.data()?.status).toBe("resolved");
  });

  it("reevaluates 60/180-minute aging without any report write", async () => {
    const report = await seedReport("report-a");
    await enqueueCreatedReport("report-a", report);
    await processOwner(report, "aging-initial");
    const reportReference = db.collection("reports").doc("report-a");
    const reportUpdateTime = (await reportReference.get()).updateTime?.toMillis();
    const jobsAfterInitial = await db.collection("incidentZoneJobs").get();
    await Promise.all(jobsAfterInitial.docs.map((document) => document.ref.delete()));

    const createdAt = (report.createdAt as Timestamp).toMillis();
    const watchBoundary = createdAt + WATCH_WINDOW_MS;
    await expect(
      runIncidentZoneMaintenance(db, watchBoundary)
    ).resolves.toMatchObject({ zonesEnqueued: 1 });
    await processOwner(report, "aging-watch", watchBoundary);
    const activeZone = (await db.collection("incidentZones").get()).docs[0];
    expect(activeZone?.data().status).toBe("active");
    expect(activeZone?.data().nextEvaluationAt.toMillis()).toBe(
      createdAt + ACTIVE_MEMBERSHIP_WINDOW_MS
    );

    const watchJobs = await db.collection("incidentZoneJobs").get();
    await Promise.all(watchJobs.docs.map((document) => document.ref.delete()));
    const activeBoundary = createdAt + ACTIVE_MEMBERSHIP_WINDOW_MS;
    await expect(
      runIncidentZoneMaintenance(db, activeBoundary)
    ).resolves.toMatchObject({ zonesEnqueued: 1 });
    await processOwner(report, "aging-resolved", activeBoundary);

    expect((await db.collection("incidentZones").get()).docs[0]?.data().status).toBe(
      "resolved"
    );
    expect((await reportReference.get()).updateTime?.toMillis()).toBe(
      reportUpdateTime
    );
  });

  it("rejects oversized write plans before any canonical partial write", async () => {
    const report = await seedReport("report-a");
    await enqueueCreatedReport("report-a", report);
    const owner = ownerPartitionFor(report);
    const lease = await acquireIncidentZoneLease(
      db,
      owner,
      "write-limit-worker",
      NOW_MS
    );
    if (lease === null) {
      throw new Error("Expected a lease.");
    }
    const memberships = Array.from({ length: 451 }, (_, index) => ({
      reportId: `report-${index}`,
      zoneId: "zone-a",
      status: "active" as const,
      algorithmVersion: "incident-zone-v1",
      updatedAt: NOW_MS
    }));

    await expect(
      writeIncidentZonePlan(db, lease, emptyPlan(memberships), [], NOW_MS)
    ).rejects.toMatchObject({ code: "write-limit-exceeded" });
    expect((await db.collection("incidentZoneMemberships").get()).size).toBe(0);
    expect((await db.collection("incidentZones").get()).size).toBe(0);
  });
});
