import { initializeTestEnvironment, type RulesTestEnvironment } from "@firebase/rules-unit-testing";
import { deleteApp, getApps, initializeApp, type App } from "firebase-admin/app";
import { getFirestore, Timestamp, type Firestore } from "firebase-admin/firestore";
import {
  REPORT_RATE_LIMIT_PER_HOUR,
  createReportForRequest,
  getHourlyBucketId
} from "../createReport";
import { ReportFunctionError } from "../reportValidation";

const PROJECT_ID = "firewatch-functions-test";
const NOW = Timestamp.fromDate(new Date("2026-06-29T12:15:00.000Z"));

let testEnv: RulesTestEnvironment;
let app: App;
let db: Firestore;

function validPayload(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    lat: 18.7883,
    lng: 98.9853,
    category: "open_burning",
    severity: 2,
    photoURL: "https://example.test/report.jpg",
    addressLabel: "เชียงใหม่",
    notes: "ควันหนาแน่น",
    imageMetadata: {
      contentType: "image/jpeg",
      sizeBytes: 320_000,
      width: 1280,
      height: 960
    },
    ...overrides
  };
}

async function createValidReport(uid = "user-a"): Promise<string> {
  const result = await createReportForRequest(
    {
      authUid: uid,
      payload: validPayload()
    },
    {
      db,
      now: NOW
    }
  );

  return result.reportId;
}

async function expectReportError(
  action: () => Promise<unknown>,
  code: ReportFunctionError["code"]
): Promise<void> {
  await expect(action()).rejects.toMatchObject({
    name: "ReportFunctionError",
    code
  });
}

async function countReports(): Promise<number> {
  const snapshot = await db.collection("reports").get();
  return snapshot.size;
}

async function seedUser(uid: string): Promise<void> {
  await db.doc(`users/${uid}`).set({
    id: uid,
    authProvider: "line",
    displayName: "FireWatch User",
    reputationScore: 35,
    reportsCount: 0,
    verifiedReportsCount: 0,
    rejectedReportsCount: 0,
    homeGeohash: "w5q6uk",
    isSuspended: false,
    createdAt: NOW
  });
}

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: {
      host: "127.0.0.1",
      port: 8080
    }
  });

  app = initializeApp({ projectId: PROJECT_ID }, "functions-test");
  db = getFirestore(app);
});

afterEach(async () => {
  await testEnv.clearFirestore();
});

afterAll(async () => {
  await testEnv.cleanup();
  await Promise.all(getApps().map((firebaseApp) => deleteApp(firebaseApp)));
});

describe("createReportForRequest", () => {
  it("creates a valid authenticated report with server-owned fields", async () => {
    await seedUser("user-a");

    const result = await createReportForRequest(
      {
        authUid: "user-a",
        payload: validPayload({ userId: "user-a" })
      },
      {
        db,
        now: NOW
      }
    );

    const reportSnapshot = await db.doc(`reports/${result.reportId}`).get();
    const bucketId = getHourlyBucketId(NOW.toDate());
    const bucketSnapshot = await db.doc(`rateLimits/user-a/hours/${bucketId}`).get();
    const userSnapshot = await db.doc("users/user-a").get();

    expect(reportSnapshot.exists).toBe(true);
    expect(reportSnapshot.get("userId")).toBe("user-a");
    expect(reportSnapshot.get("createdAt").toMillis()).toBe(NOW.toMillis());
    expect(reportSnapshot.get("verificationStatus")).toBe("รอการยืนยัน");
    expect(reportSnapshot.get("moderationStatus")).toBe("ปกติ");
    expect(reportSnapshot.get("confirmedByReportIds")).toEqual([]);
    expect(reportSnapshot.get("flaggedCount")).toBe(0);
    expect(reportSnapshot.get("isThrottled")).toBe(false);
    expect(bucketSnapshot.get("count")).toBe(1);
    expect(userSnapshot.get("reportsCount")).toBe(1);
    expect(result.rateLimit).toEqual({
      bucketId,
      count: 1,
      limit: REPORT_RATE_LIMIT_PER_HOUR
    });
  });

  it("rejects unauthenticated requests", async () => {
    await expectReportError(
      () =>
        createReportForRequest(
          {
            authUid: null,
            payload: validPayload()
          },
          { db, now: NOW }
        ),
      "unauthenticated"
    );
  });

  it("rejects invalid lat and lng values", async () => {
    await expectReportError(
      () =>
        createReportForRequest(
          {
            authUid: "user-a",
            payload: validPayload({ lat: 91 })
          },
          { db, now: NOW }
        ),
      "invalid-argument"
    );

    await expectReportError(
      () =>
        createReportForRequest(
          {
            authUid: "user-a",
            payload: validPayload({ lng: -181 })
          },
          { db, now: NOW }
        ),
      "invalid-argument"
    );
  });

  it("rejects invalid category and severity values", async () => {
    await expectReportError(
      () =>
        createReportForRequest(
          {
            authUid: "user-a",
            payload: validPayload({ category: "burning" })
          },
          { db, now: NOW }
        ),
      "invalid-argument"
    );

    await expectReportError(
      () =>
        createReportForRequest(
          {
            authUid: "user-a",
            payload: validPayload({ severity: 4 })
          },
          { db, now: NOW }
        ),
      "invalid-argument"
    );
  });

  it("rejects over-limit notes, address, photoURL, and image metadata", async () => {
    await expectReportError(
      () =>
        createReportForRequest(
          {
            authUid: "user-a",
            payload: validPayload({ notes: "น".repeat(501) })
          },
          { db, now: NOW }
        ),
      "invalid-argument"
    );

    await expectReportError(
      () =>
        createReportForRequest(
          {
            authUid: "user-a",
            payload: validPayload({ addressLabel: "ก".repeat(161) })
          },
          { db, now: NOW }
        ),
      "invalid-argument"
    );

    await expectReportError(
      () =>
        createReportForRequest(
          {
            authUid: "user-a",
            payload: validPayload({ photoURL: `https://example.test/${"x".repeat(2048)}` })
          },
          { db, now: NOW }
        ),
      "invalid-argument"
    );

    await expectReportError(
      () =>
        createReportForRequest(
          {
            authUid: "user-a",
            payload: validPayload({
              imageMetadata: {
                contentType: "image/jpeg",
                sizeBytes: 500 * 1024 + 1
              }
            })
          },
          { db, now: NOW }
        ),
      "invalid-argument"
    );
  });

  it("rejects userId mismatch", async () => {
    await expectReportError(
      () =>
        createReportForRequest(
          {
            authUid: "user-a",
            payload: validPayload({ userId: "user-b" })
          },
          { db, now: NOW }
        ),
      "failed-precondition"
    );
  });

  it("accepts report image gs URLs only when the path belongs to auth.uid", async () => {
    const result = await createReportForRequest(
      {
        authUid: "user-a",
        payload: validPayload({
          photoURL: "gs://firewatch-functions-test/reportImages/user-a/report-image.jpg"
        })
      },
      { db, now: NOW }
    );

    const reportSnapshot = await db.doc(`reports/${result.reportId}`).get();
    expect(reportSnapshot.get("photoURL")).toBe(
      "gs://firewatch-functions-test/reportImages/user-a/report-image.jpg"
    );
  });

  it("rejects report image gs URLs outside the expected path or owner uid", async () => {
    await expectReportError(
      () =>
        createReportForRequest(
          {
            authUid: "user-a",
            payload: validPayload({
              photoURL: "gs://firewatch-functions-test/reportImages/user-b/report-image.jpg"
            })
          },
          { db, now: NOW }
        ),
      "failed-precondition"
    );

    await expectReportError(
      () =>
        createReportForRequest(
          {
            authUid: "user-a",
            payload: validPayload({
              photoURL: "gs://firewatch-functions-test/user-a/report-image.jpg"
            })
          },
          { db, now: NOW }
        ),
      "invalid-argument"
    );
  });

  it("rejects forbidden server-controlled and admin-controlled fields", async () => {
    await expectReportError(
      () =>
        createReportForRequest(
          {
            authUid: "user-a",
            payload: validPayload({ verificationStatus: "ยืนยันแล้ว" })
          },
          { db, now: NOW }
        ),
      "invalid-argument"
    );

    await expectReportError(
      () =>
        createReportForRequest(
          {
            authUid: "user-a",
            payload: validPayload({ reportsCount: 999 })
          },
          { db, now: NOW }
        ),
      "invalid-argument"
    );

    await expectReportError(
      () =>
        createReportForRequest(
          {
            authUid: "user-a",
            payload: validPayload({ isSuspended: true })
          },
          { db, now: NOW }
        ),
      "invalid-argument"
    );

    await expectReportError(
      () =>
        createReportForRequest(
          {
            authUid: "user-a",
            payload: validPayload({ createdAt: NOW })
          },
          { db, now: NOW }
        ),
      "invalid-argument"
    );
  });

  it("rejects reports after ten successful reports in the same hourly bucket", async () => {
    for (let index = 0; index < REPORT_RATE_LIMIT_PER_HOUR; index += 1) {
      await createValidReport("user-a");
    }

    await expectReportError(
      () =>
        createReportForRequest(
          {
            authUid: "user-a",
            payload: validPayload()
          },
          { db, now: NOW }
        ),
      "resource-exhausted"
    );

    const bucketId = getHourlyBucketId(NOW.toDate());
    const bucketSnapshot = await db.doc(`rateLimits/user-a/hours/${bucketId}`).get();
    expect(bucketSnapshot.get("count")).toBe(REPORT_RATE_LIMIT_PER_HOUR);
    expect(await countReports()).toBe(REPORT_RATE_LIMIT_PER_HOUR);
  });

  it("uses the transaction counter under concurrent requests", async () => {
    const attempts = Array.from({ length: REPORT_RATE_LIMIT_PER_HOUR + 2 }, () =>
      createReportForRequest(
        {
          authUid: "user-a",
          payload: validPayload()
        },
        { db, now: NOW }
      )
    );

    const settled = await Promise.allSettled(attempts);
    const fulfilled = settled.filter((result) => result.status === "fulfilled");
    const rejected = settled.filter((result) => result.status === "rejected");
    const bucketId = getHourlyBucketId(NOW.toDate());
    const bucketSnapshot = await db.doc(`rateLimits/user-a/hours/${bucketId}`).get();

    expect(fulfilled).toHaveLength(REPORT_RATE_LIMIT_PER_HOUR);
    expect(rejected).toHaveLength(2);
    expect(bucketSnapshot.get("count")).toBe(REPORT_RATE_LIMIT_PER_HOUR);
    expect(await countReports()).toBe(REPORT_RATE_LIMIT_PER_HOUR);
  });
});
