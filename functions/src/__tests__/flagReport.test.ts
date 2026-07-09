import { initializeTestEnvironment, type RulesTestEnvironment } from "@firebase/rules-unit-testing";
import { deleteApp, getApps, initializeApp, type App } from "firebase-admin/app";
import { getFirestore, Timestamp, type Firestore } from "firebase-admin/firestore";
import {
  FLAG_REVIEW_THRESHOLD,
  flagReportForRequest
} from "../flagReport";
import { ReportFunctionError } from "../reportValidation";

const PROJECT_ID = "firewatch-functions-test";
const NOW = Timestamp.fromDate(new Date("2026-06-29T12:15:00.000Z"));
const DEFAULT_MODERATION_STATUS = "ปกติ";
const REVIEW_MODERATION_STATUS = "รอตรวจสอบ";
const HIDDEN_MODERATION_STATUS = "ถูกซ่อน";

let testEnv: RulesTestEnvironment;
let app: App;
let db: Firestore;

interface SeedReport {
  id: string;
  lat: number;
  lng: number;
  geohash: string;
  photoURL: string;
  category: "open_burning";
  severity: 1 | 2 | 3;
  createdAt: Timestamp;
  userId: string;
  verificationStatus: "รอการยืนยัน" | "ยืนยันแล้ว" | "ถูกปฏิเสธ";
  confirmedByReportIds: string[];
  isThrottled: boolean;
  flaggedCount: number;
  moderationStatus: "ปกติ" | "ถูกซ่อน" | "รอตรวจสอบ";
  addressLabel: string;
  notes: string;
}

function reportData(overrides: Partial<SeedReport> = {}): SeedReport {
  const id = overrides.id ?? "report-a";

  return {
    id,
    lat: 18.7883,
    lng: 98.9853,
    geohash: "w5q6ukqc",
    photoURL: `https://example.test/${id}.jpg`,
    category: "open_burning",
    severity: 2,
    createdAt: NOW,
    userId: "user-a",
    verificationStatus: "รอการยืนยัน",
    confirmedByReportIds: [],
    isThrottled: false,
    flaggedCount: 0,
    moderationStatus: "ปกติ",
    addressLabel: "เชียงใหม่",
    notes: "ควันหนาแน่น",
    ...overrides
  };
}

async function seedReport(overrides: Partial<SeedReport> = {}): Promise<SeedReport> {
  const report = reportData(overrides);
  await db.doc(`reports/${report.id}`).set(report);
  return report;
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

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: {
      host: "127.0.0.1",
      port: 8080
    }
  });

  app = initializeApp({ projectId: PROJECT_ID }, "flag-functions-test");
  db = getFirestore(app);
});

afterEach(async () => {
  await testEnv.clearFirestore();
});

afterAll(async () => {
  await testEnv.cleanup();
  await Promise.all(getApps().map((firebaseApp) => deleteApp(firebaseApp)));
});

describe("flagReportForRequest", () => {
  it("rejects unauthenticated requests", async () => {
    await expectReportError(
      () =>
        flagReportForRequest(
          {
            authUid: null,
            payload: {
              reportId: "report-a"
            }
          },
          { db, now: NOW }
        ),
      "unauthenticated"
    );
  });

  it("rejects invalid report ids", async () => {
    await expectReportError(
      () =>
        flagReportForRequest(
          {
            authUid: "user-a",
            payload: {
              reportId: "bad/report"
            }
          },
          { db, now: NOW }
        ),
      "invalid-argument"
    );
  });

  it("rejects missing reports", async () => {
    await expectReportError(
      () =>
        flagReportForRequest(
          {
            authUid: "user-a",
            payload: {
              reportId: "missing-report"
            }
          },
          { db, now: NOW }
        ),
      "not-found"
    );
  });

  it("increments flaggedCount and records the flag document on the first flag", async () => {
    await seedReport({ id: "report-a" });

    const result = await flagReportForRequest(
      {
        authUid: "user-b",
        payload: {
          reportId: "report-a"
        }
      },
      { db, now: NOW }
    );
    const reportSnapshot = await db.doc("reports/report-a").get();
    const flagSnapshot = await db.doc("reports/report-a/flags/user-b").get();

    expect(result).toEqual({
      reportId: "report-a",
      flaggedCount: 1,
      moderationStatus: "ปกติ"
    });
    expect(reportSnapshot.get("flaggedCount")).toBe(1);
    expect(reportSnapshot.get("moderationStatus")).toBe("ปกติ");
    expect(flagSnapshot.exists).toBe(true);
    expect(flagSnapshot.get("uid")).toBe("user-b");
    expect(flagSnapshot.get("reportId")).toBe("report-a");
    expect(flagSnapshot.get("createdAt").toMillis()).toBe(NOW.toMillis());
  });

  it("flags legacy reports that do not have moderation fields yet", async () => {
    const legacyReport: Record<string, unknown> = {
      ...reportData({ id: "legacy-report" })
    };
    delete legacyReport.flaggedCount;
    delete legacyReport.moderationStatus;
    await db.doc("reports/legacy-report").set(legacyReport);

    const result = await flagReportForRequest(
      {
        authUid: "user-b",
        payload: {
          reportId: "legacy-report"
        }
      },
      { db, now: NOW }
    );
    const reportSnapshot = await db.doc("reports/legacy-report").get();

    expect(result).toEqual({
      reportId: "legacy-report",
      flaggedCount: 1,
      moderationStatus: DEFAULT_MODERATION_STATUS
    });
    expect(reportSnapshot.get("flaggedCount")).toBe(1);
    expect(reportSnapshot.get("moderationStatus")).toBe(DEFAULT_MODERATION_STATUS);
  });

  it("rejects duplicate flags from the same user", async () => {
    await seedReport({ id: "report-a" });
    await flagReportForRequest(
      {
        authUid: "user-b",
        payload: {
          reportId: "report-a"
        }
      },
      { db, now: NOW }
    );

    await expectReportError(
      () =>
        flagReportForRequest(
          {
            authUid: "user-b",
            payload: {
              reportId: "report-a"
            }
          },
          { db, now: NOW }
        ),
      "already-exists"
    );

    const reportSnapshot = await db.doc("reports/report-a").get();
    expect(reportSnapshot.get("flaggedCount")).toBe(1);
  });

  it("sets moderationStatus to review when the flag threshold is reached", async () => {
    await seedReport({ id: "report-a" });

    for (let index = 1; index <= FLAG_REVIEW_THRESHOLD; index += 1) {
      await flagReportForRequest(
        {
          authUid: `user-${index}`,
          payload: {
            reportId: "report-a"
          }
        },
        { db, now: NOW }
      );
    }

    const reportSnapshot = await db.doc("reports/report-a").get();
    expect(reportSnapshot.get("flaggedCount")).toBe(FLAG_REVIEW_THRESHOLD);
    expect(reportSnapshot.get("moderationStatus")).toBe(REVIEW_MODERATION_STATUS);
  });

  it("never sets moderationStatus to hidden from user flags", async () => {
    await seedReport({
      id: "report-a",
      flaggedCount: FLAG_REVIEW_THRESHOLD - 1
    });

    const result = await flagReportForRequest(
      {
        authUid: "user-c",
        payload: {
          reportId: "report-a"
        }
      },
      { db, now: NOW }
    );
    const reportSnapshot = await db.doc("reports/report-a").get();

    expect(result.moderationStatus).toBe(REVIEW_MODERATION_STATUS);
    expect(reportSnapshot.get("moderationStatus")).toBe(REVIEW_MODERATION_STATUS);
    expect(reportSnapshot.get("moderationStatus")).not.toBe(HIDDEN_MODERATION_STATUS);
  });
});
