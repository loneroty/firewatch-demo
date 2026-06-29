import { initializeTestEnvironment, type RulesTestEnvironment } from "@firebase/rules-unit-testing";
import { deleteApp, getApps, initializeApp, type App } from "firebase-admin/app";
import { getFirestore, Timestamp, type Firestore } from "firebase-admin/firestore";
import {
  CONFIRMATION_RADIUS_METERS,
  CONFIRMATION_WINDOW_MS,
  confirmReportForRequest
} from "../confirmReport";
import { ReportFunctionError } from "../reportValidation";

const PROJECT_ID = "firewatch-functions-test";
const NOW = Timestamp.fromDate(new Date("2026-06-29T12:15:00.000Z"));
const NEAR_LAT = 18.7885;
const NEAR_LNG = 98.9855;
const FAR_LAT = 18.82;
const FAR_LNG = 99.02;

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

async function seedValidTargetAndConfirmingReport(): Promise<void> {
  await seedReport({
    id: "target-report",
    userId: "user-a"
  });
  await seedReport({
    id: "confirming-report",
    userId: "user-b",
    lat: NEAR_LAT,
    lng: NEAR_LNG
  });
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

  app = initializeApp({ projectId: PROJECT_ID }, "confirm-functions-test");
  db = getFirestore(app);
});

afterEach(async () => {
  await testEnv.clearFirestore();
});

afterAll(async () => {
  await testEnv.cleanup();
  await Promise.all(getApps().map((firebaseApp) => deleteApp(firebaseApp)));
});

describe("confirmReportForRequest", () => {
  it("rejects unauthenticated requests", async () => {
    await expectReportError(
      () =>
        confirmReportForRequest(
          {
            authUid: null,
            payload: {
              targetReportId: "target-report",
              confirmingReportId: "confirming-report"
            }
          },
          { db }
        ),
      "unauthenticated"
    );
  });

  it("rejects owners confirming their own target report", async () => {
    await seedValidTargetAndConfirmingReport();

    await expectReportError(
      () =>
        confirmReportForRequest(
          {
            authUid: "user-a",
            payload: {
              targetReportId: "target-report",
              confirmingReportId: "confirming-report"
            }
          },
          { db }
        ),
      "failed-precondition"
    );
  });

  it("lets a user confirm another report with a nearby own report", async () => {
    await seedValidTargetAndConfirmingReport();

    const result = await confirmReportForRequest(
      {
        authUid: "user-b",
        payload: {
          targetReportId: "target-report",
          confirmingReportId: "confirming-report"
        }
      },
      { db }
    );
    const targetSnapshot = await db.doc("reports/target-report").get();

    expect(result).toEqual({
      targetReportId: "target-report",
      confirmingReportId: "confirming-report",
      confirmedByReportIds: ["confirming-report"],
      verificationStatus: "ยืนยันแล้ว"
    });
    expect(targetSnapshot.get("confirmedByReportIds")).toEqual(["confirming-report"]);
    expect(targetSnapshot.get("verificationStatus")).toBe("ยืนยันแล้ว");
  });

  it("rejects duplicate confirmations for the same target", async () => {
    await seedValidTargetAndConfirmingReport();
    await confirmReportForRequest(
      {
        authUid: "user-b",
        payload: {
          targetReportId: "target-report",
          confirmingReportId: "confirming-report"
        }
      },
      { db }
    );

    await expectReportError(
      () =>
        confirmReportForRequest(
          {
            authUid: "user-b",
            payload: {
              targetReportId: "target-report",
              confirmingReportId: "confirming-report"
            }
          },
          { db }
        ),
      "already-exists"
    );
  });

  it("rejects duplicate confirmations from the same user with another report", async () => {
    await seedReport({
      id: "existing-confirmation",
      userId: "user-b",
      lat: NEAR_LAT,
      lng: NEAR_LNG
    });
    await seedReport({
      id: "target-report",
      userId: "user-a",
      confirmedByReportIds: ["existing-confirmation"]
    });
    await seedReport({
      id: "second-confirming-report",
      userId: "user-b",
      lat: NEAR_LAT,
      lng: NEAR_LNG
    });

    await expectReportError(
      () =>
        confirmReportForRequest(
          {
            authUid: "user-b",
            payload: {
              targetReportId: "target-report",
              confirmingReportId: "second-confirming-report"
            }
          },
          { db }
        ),
      "already-exists"
    );
  });

  it("rejects hidden and rejected target reports", async () => {
    await seedReport({
      id: "confirming-report",
      userId: "user-b",
      lat: NEAR_LAT,
      lng: NEAR_LNG
    });
    await seedReport({
      id: "hidden-target",
      userId: "user-a",
      moderationStatus: "ถูกซ่อน"
    });
    await seedReport({
      id: "rejected-target",
      userId: "user-a",
      verificationStatus: "ถูกปฏิเสธ"
    });

    await expectReportError(
      () =>
        confirmReportForRequest(
          {
            authUid: "user-b",
            payload: {
              targetReportId: "hidden-target",
              confirmingReportId: "confirming-report"
            }
          },
          { db }
        ),
      "failed-precondition"
    );
    await expectReportError(
      () =>
        confirmReportForRequest(
          {
            authUid: "user-b",
            payload: {
              targetReportId: "rejected-target",
              confirmingReportId: "confirming-report"
            }
          },
          { db }
        ),
      "failed-precondition"
    );
  });

  it("rejects confirming reports that do not belong to auth.uid", async () => {
    await seedValidTargetAndConfirmingReport();

    await expectReportError(
      () =>
        confirmReportForRequest(
          {
            authUid: "user-c",
            payload: {
              targetReportId: "target-report",
              confirmingReportId: "confirming-report"
            }
          },
          { db }
        ),
      "failed-precondition"
    );
  });

  it("rejects confirming reports outside the distance or time window", async () => {
    await seedReport({
      id: "target-report",
      userId: "user-a"
    });
    await seedReport({
      id: "far-confirming-report",
      userId: "user-b",
      lat: FAR_LAT,
      lng: FAR_LNG
    });
    await seedReport({
      id: "late-confirming-report",
      userId: "user-b",
      lat: NEAR_LAT,
      lng: NEAR_LNG,
      createdAt: Timestamp.fromMillis(NOW.toMillis() + CONFIRMATION_WINDOW_MS + 1)
    });

    await expectReportError(
      () =>
        confirmReportForRequest(
          {
            authUid: "user-b",
            payload: {
              targetReportId: "target-report",
              confirmingReportId: "far-confirming-report"
            }
          },
          { db }
        ),
      "failed-precondition"
    );
    await expectReportError(
      () =>
        confirmReportForRequest(
          {
            authUid: "user-b",
            payload: {
              targetReportId: "target-report",
              confirmingReportId: "late-confirming-report"
            }
          },
          { db }
        ),
      "failed-precondition"
    );
  });

  it("keeps existing confirmations from other users when updating the target", async () => {
    await seedReport({
      id: "existing-confirmation",
      userId: "user-c",
      lat: NEAR_LAT,
      lng: NEAR_LNG
    });
    await seedReport({
      id: "target-report",
      userId: "user-a",
      confirmedByReportIds: ["existing-confirmation"]
    });
    await seedReport({
      id: "confirming-report",
      userId: "user-b",
      lat: NEAR_LAT,
      lng: NEAR_LNG
    });

    const result = await confirmReportForRequest(
      {
        authUid: "user-b",
        payload: {
          targetReportId: "target-report",
          confirmingReportId: "confirming-report"
        }
      },
      { db }
    );
    const targetSnapshot = await db.doc("reports/target-report").get();

    expect(result.confirmedByReportIds).toEqual([
      "existing-confirmation",
      "confirming-report"
    ]);
    expect(targetSnapshot.get("confirmedByReportIds")).toEqual([
      "existing-confirmation",
      "confirming-report"
    ]);
    expect(targetSnapshot.get("verificationStatus")).toBe("ยืนยันแล้ว");
  });

  it("exports the MVP confirmation thresholds expected by the client copy", () => {
    expect(CONFIRMATION_RADIUS_METERS).toBe(500);
    expect(CONFIRMATION_WINDOW_MS).toBe(60 * 60 * 1000);
  });
});
