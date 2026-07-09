import { initializeTestEnvironment, type RulesTestEnvironment } from "@firebase/rules-unit-testing";
import { deleteApp, getApps, initializeApp, type App } from "firebase-admin/app";
import { getFirestore, Timestamp, type Firestore } from "firebase-admin/firestore";
import { moderateReportForRequest } from "../moderateReport";
import { ReportFunctionError } from "../reportValidation";

const PROJECT_ID = "firewatch-functions-test";
const NOW = Timestamp.fromDate(new Date("2026-06-29T12:15:00.000Z"));
const NORMAL_MODERATION_STATUS = "ปกติ";
const REVIEW_MODERATION_STATUS = "รอตรวจสอบ";
const HIDDEN_MODERATION_STATUS = "ถูกซ่อน";
const CONFIRMED_STATUS = "ยืนยันแล้ว";

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
    moderationStatus: NORMAL_MODERATION_STATUS,
    addressLabel: "เชียงใหม่",
    notes: "ควันหนาแน่น",
    ...overrides
  };
}

async function seedAdmin(uid: string, role: string): Promise<void> {
  await db.doc(`admins/${uid}`).set({
    uid,
    role
  });
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

  app = initializeApp({ projectId: PROJECT_ID }, "moderate-functions-test");
  db = getFirestore(app);
});

afterEach(async () => {
  await testEnv.clearFirestore();
});

afterAll(async () => {
  await testEnv.cleanup();
  await Promise.all(getApps().map((firebaseApp) => deleteApp(firebaseApp)));
});

describe("moderateReportForRequest", () => {
  it("rejects unauthenticated requests", async () => {
    await expectReportError(
      () =>
        moderateReportForRequest(
          {
            authUid: null,
            payload: {
              reportId: "report-a",
              action: "hide"
            }
          },
          { db }
        ),
      "unauthenticated"
    );
  });

  it("rejects users without an admin document", async () => {
    await seedReport({ id: "report-a" });

    await expectReportError(
      () =>
        moderateReportForRequest(
          {
            authUid: "user-b",
            payload: {
              reportId: "report-a",
              action: "hide"
            }
          },
          { db }
        ),
      "permission-denied"
    );
  });

  it("rejects admin documents with unsupported roles", async () => {
    await seedAdmin("operator-a", "viewer");
    await seedReport({ id: "report-a" });

    await expectReportError(
      () =>
        moderateReportForRequest(
          {
            authUid: "operator-a",
            payload: {
              reportId: "report-a",
              action: "hide"
            }
          },
          { db }
        ),
      "permission-denied"
    );
  });

  it("rejects invalid report ids and actions", async () => {
    await seedAdmin("operator-a", "moderator");

    await expectReportError(
      () =>
        moderateReportForRequest(
          {
            authUid: "operator-a",
            payload: {
              reportId: "bad/report",
              action: "hide"
            }
          },
          { db }
        ),
      "invalid-argument"
    );

    await expectReportError(
      () =>
        moderateReportForRequest(
          {
            authUid: "operator-a",
            payload: {
              reportId: "report-a",
              action: "delete"
            }
          },
          { db }
        ),
      "invalid-argument"
    );
  });

  it("rejects missing reports for admins", async () => {
    await seedAdmin("operator-a", "moderator");

    await expectReportError(
      () =>
        moderateReportForRequest(
          {
            authUid: "operator-a",
            payload: {
              reportId: "missing-report",
              action: "hide"
            }
          },
          { db }
        ),
      "not-found"
    );
  });

  it("lets moderators hide reports without deleting them", async () => {
    await seedAdmin("operator-a", "moderator");
    await seedReport({
      id: "report-a",
      flaggedCount: 3,
      moderationStatus: REVIEW_MODERATION_STATUS
    });

    const result = await moderateReportForRequest(
      {
        authUid: "operator-a",
        payload: {
          reportId: "report-a",
          action: "hide"
        }
      },
      { db }
    );
    const reportSnapshot = await db.doc("reports/report-a").get();

    expect(result).toEqual({
      reportId: "report-a",
      action: "hide",
      moderationStatus: HIDDEN_MODERATION_STATUS
    });
    expect(reportSnapshot.exists).toBe(true);
    expect(reportSnapshot.get("moderationStatus")).toBe(HIDDEN_MODERATION_STATUS);
  });

  it("lets superadmins restore reports to normal", async () => {
    await seedAdmin("operator-a", "superadmin");
    await seedReport({
      id: "report-a",
      moderationStatus: HIDDEN_MODERATION_STATUS
    });

    const result = await moderateReportForRequest(
      {
        authUid: "operator-a",
        payload: {
          reportId: "report-a",
          action: "restore"
        }
      },
      { db }
    );
    const reportSnapshot = await db.doc("reports/report-a").get();

    expect(result).toEqual({
      reportId: "report-a",
      action: "restore",
      moderationStatus: NORMAL_MODERATION_STATUS
    });
    expect(reportSnapshot.get("moderationStatus")).toBe(NORMAL_MODERATION_STATUS);
  });

  it("does not reset evidence fields when restoring reports", async () => {
    await seedAdmin("operator-a", "moderator");
    await seedReport({
      id: "report-a",
      moderationStatus: HIDDEN_MODERATION_STATUS,
      flaggedCount: 5,
      verificationStatus: CONFIRMED_STATUS,
      confirmedByReportIds: ["confirming-report"],
      photoURL: "https://example.test/evidence.jpg"
    });

    await moderateReportForRequest(
      {
        authUid: "operator-a",
        payload: {
          reportId: "report-a",
          action: "restore"
        }
      },
      { db }
    );
    const reportSnapshot = await db.doc("reports/report-a").get();

    expect(reportSnapshot.get("moderationStatus")).toBe(NORMAL_MODERATION_STATUS);
    expect(reportSnapshot.get("flaggedCount")).toBe(5);
    expect(reportSnapshot.get("verificationStatus")).toBe(CONFIRMED_STATUS);
    expect(reportSnapshot.get("confirmedByReportIds")).toEqual(["confirming-report"]);
    expect(reportSnapshot.get("photoURL")).toBe("https://example.test/evidence.jpg");
  });
});
