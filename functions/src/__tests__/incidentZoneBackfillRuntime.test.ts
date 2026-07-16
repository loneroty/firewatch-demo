import {
  initializeTestEnvironment,
  type RulesTestEnvironment
} from "@firebase/rules-unit-testing";
import { deleteApp, getApps, initializeApp, type App } from "firebase-admin/app";
import { getFirestore, Timestamp, type Firestore } from "firebase-admin/firestore";
import { encodeGeohash } from "../geohash";
import {
  assertIncidentZoneBackfillApplyGuards,
  runIncidentZoneBackfillBatch,
  type IncidentZoneBackfillGuards
} from "../incidentZones/backfillRuntime";

const PROJECT_ID = "firewatch-functions-test";
const NOW_MS = Date.parse("2026-07-16T12:00:00.000Z");

let testEnv: RulesTestEnvironment;
let app: App;
let db: Firestore;

const validGuards: IncidentZoneBackfillGuards = {
  applyEnabled: true,
  projectId: PROJECT_ID,
  allowedProjectIds: [PROJECT_ID],
  confirmation: "APPLY_INCIDENT_ZONES"
};

async function seedReport(id: string, lng = 98.9853): Promise<void> {
  const lat = 18.7883;
  await db.collection("reports").doc(id).set({
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
    notes: "ควัน"
  });
}

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: { host: "127.0.0.1", port: 8080 }
  });
  app = initializeApp({ projectId: PROJECT_ID }, "incident-zone-backfill-test");
  db = getFirestore(app);
});

afterEach(async () => {
  await testEnv.clearFirestore();
});

afterAll(async () => {
  await testEnv.cleanup();
  await Promise.all(getApps().map((firebaseApp) => deleteApp(firebaseApp)));
});

describe("incident-zone backfill runtime", () => {
  it("requires every apply guard", () => {
    expect(() =>
      assertIncidentZoneBackfillApplyGuards({
        ...validGuards,
        applyEnabled: false
      })
    ).toThrow("FIREWATCH_ZONE_BACKFILL_APPLY=true");
    expect(() =>
      assertIncidentZoneBackfillApplyGuards({
        ...validGuards,
        allowedProjectIds: []
      })
    ).toThrow("allowlist");
    expect(() =>
      assertIncidentZoneBackfillApplyGuards({
        ...validGuards,
        confirmation: "wrong"
      })
    ).toThrow("typed confirmation");
  });

  it("defaults to a read-only dry-run with a bounded summary", async () => {
    await seedReport("report-a");

    const summary = await runIncidentZoneBackfillBatch(db, {
      apply: false,
      guards: { ...validGuards, applyEnabled: false },
      now: NOW_MS
    });

    expect(summary).toMatchObject({
      mode: "dry-run",
      reportsScanned: 1,
      reportsEligible: 1,
      jobsEnqueued: 0,
      jobsProcessed: 0,
      readinessStatus: "unchanged"
    });
    expect((await db.collection("incidentZoneJobs").get()).size).toBe(0);
    expect((await db.collection("incidentZones").get()).size).toBe(0);
    expect((await db.collection("incidentZoneSystem").get()).size).toBe(0);
  });

  it("resumes bounded apply batches and reruns without duplicating canonical zones", async () => {
    await seedReport("report-a");
    await seedReport("report-b", 98.9855);

    const first = await runIncidentZoneBackfillBatch(db, {
      apply: true,
      guards: validGuards,
      batchSize: 1,
      maxJobs: 64,
      now: NOW_MS
    });
    expect(first).toMatchObject({
      mode: "apply",
      reportsScanned: 1,
      resumeCursor: null,
      nextCursor: "report-a",
      scanComplete: false,
      readinessStatus: "backfilling"
    });

    const second = await runIncidentZoneBackfillBatch(db, {
      apply: true,
      guards: validGuards,
      batchSize: 1,
      maxJobs: 64,
      now: NOW_MS + 1_000
    });
    expect(second.resumeCursor).toBe("report-a");
    expect(second.nextCursor).toBe("report-b");

    for (let attempt = 0; attempt < 4; attempt += 1) {
      const result = await runIncidentZoneBackfillBatch(db, {
        apply: true,
        guards: validGuards,
        batchSize: 1,
        maxJobs: 64,
        now: NOW_MS + 2_000 + attempt * 1_000
      });
      if (result.readinessStatus === "ready") {
        break;
      }
    }

    const zonesBeforeRerun = await db.collection("incidentZones").get();
    expect(zonesBeforeRerun.size).toBe(1);
    const zoneId = zonesBeforeRerun.docs[0]?.id;
    const versionBeforeRerun = zonesBeforeRerun.docs[0]?.data().version;
    const finalRun = await runIncidentZoneBackfillBatch(db, {
      apply: true,
      guards: validGuards,
      batchSize: 1,
      maxJobs: 64,
      now: NOW_MS + 10_000
    });
    const zonesAfterRerun = await db.collection("incidentZones").get();

    expect(finalRun.readinessStatus).toBe("ready");
    expect(zonesAfterRerun.size).toBe(1);
    expect(zonesAfterRerun.docs[0]?.id).toBe(zoneId);
    expect(zonesAfterRerun.docs[0]?.data().version).toBe(versionBeforeRerun);
    expect(
      (await db.collection("incidentZoneSystem").doc("state").get()).data()?.status
    ).toBe("ready");
  });
});

