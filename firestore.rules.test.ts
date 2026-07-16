import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestContext,
  type RulesTestEnvironment
} from "@firebase/rules-unit-testing";
import {
  Timestamp,
  deleteDoc,
  doc,
  getDoc,
  setLogLevel,
  setDoc,
  updateDoc
} from "firebase/firestore";
import { readFileSync } from "node:fs";

const PROJECT_ID = "firewatch-rules-test";
const CREATED_AT = Timestamp.fromDate(new Date("2026-06-29T00:00:00.000Z"));

let testEnv: RulesTestEnvironment;

setLogLevel("error");

interface BaseReportInput {
  id: string;
  userId: string;
}

interface BaseUserInput {
  id: string;
}

function reportData({ id, userId }: BaseReportInput) {
  return {
    id,
    lat: 18.7883,
    lng: 98.9853,
    geohash: "w5q6ukqc",
    photoURL: "https://example.test/report.jpg",
    category: "open_burning",
    severity: 2,
    createdAt: CREATED_AT,
    userId,
    verificationStatus: "รอการยืนยัน",
    confirmedByReportIds: [],
    isThrottled: false,
    flaggedCount: 0,
    moderationStatus: "ปกติ",
    addressLabel: "เชียงใหม่",
    notes: "ควันหนาแน่น"
  };
}

function ownerUserData({ id }: BaseUserInput) {
  return {
    id,
    authProvider: "line",
    displayName: "FireWatch User",
    homeGeohash: "w5q6uk",
    createdAt: CREATED_AT
  };
}

function adminUserData({ id }: BaseUserInput) {
  return {
    id,
    authProvider: "line",
    displayName: "FireWatch User",
    reputationScore: 35,
    reportsCount: 0,
    verifiedReportsCount: 0,
    rejectedReportsCount: 0,
    homeGeohash: "w5q6uk",
    isSuspended: false,
    createdAt: CREATED_AT
  };
}

function authedContext(uid: string): RulesTestContext {
  return testEnv.authenticatedContext(uid, {
    email: `${uid}@example.test`
  });
}

async function seedAdmin(uid: string): Promise<void> {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(context.firestore(), "admins", uid), {
      uid,
      role: "moderator"
    });
  });
}

async function seedReport(id: string, userId: string): Promise<void> {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(context.firestore(), "reports", id), reportData({ id, userId }));
  });
}

async function seedUser(userId: string): Promise<void> {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(context.firestore(), "users", userId), adminUserData({ id: userId }));
  });
}

function incidentZoneData(
  id: string,
  status: "active" | "resolved" | "hidden" = "active"
) {
  return {
    id,
    reportIds: ["report-a"],
    reportCount: 1,
    centerLat: 18.7883,
    centerLng: 98.9853,
    geohash: "w5q6ukqc",
    categories: ["open_burning"],
    categoryCounts: {
      industrial_smoke: 0,
      open_burning: 1,
      other: 0,
      wildfire_smoke: 0
    },
    riskLevel: "เฝ้าระวัง",
    riskRank: 1,
    riskScore: 4,
    maxSeverity: 2,
    averageSeverity: 2,
    verifiedReportCount: 0,
    latestReportAt: CREATED_AT,
    primaryAddressLabel: "เชียงใหม่",
    riskFactors: ["1 รายงานในรัศมี 500 เมตร"],
    status,
    anchorReportId: "report-a",
    algorithmVersion: "incident-zone-v1",
    stateHash: "state-hash",
    nextEvaluationAt: CREATED_AT,
    createdAt: CREATED_AT,
    updatedAt: CREATED_AT,
    version: 1
  };
}

async function seedIncidentZone(
  id: string,
  status: "active" | "resolved" | "hidden" = "active"
): Promise<void> {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    await setDoc(
      doc(context.firestore(), "incidentZones", id),
      incidentZoneData(id, status)
    );
  });
}

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: {
      rules: readFileSync("firestore.rules", "utf8"),
      host: "127.0.0.1",
      port: 8080
    }
  });
});

afterEach(async () => {
  await testEnv.clearFirestore();
});

afterAll(async () => {
  await testEnv.cleanup();
});

describe("firestore security rules", () => {
  it("allows public reads for reports but blocks unauthenticated report writes", async () => {
    await seedReport("report-public", "user-a");

    const unauthenticated = testEnv.unauthenticatedContext().firestore();

    await assertSucceeds(getDoc(doc(unauthenticated, "reports", "report-public")));
    await assertFails(
      setDoc(
        doc(unauthenticated, "reports", "report-new"),
        reportData({ id: "report-new", userId: "user-a" })
      )
    );
  });

  it("blocks direct authenticated report creates so clients must use Cloud Functions", async () => {
    const userDb = authedContext("user-a").firestore();

    await assertFails(
      setDoc(
        doc(userDb, "reports", "report-owned"),
        reportData({ id: "report-owned", userId: "user-a" })
      )
    );

    await assertFails(
      setDoc(
        doc(userDb, "reports", "report-spoofed"),
        reportData({ id: "report-spoofed", userId: "user-b" })
      )
    );
  });

  it("blocks client edits to report verification and moderation fields", async () => {
    await seedReport("report-owned", "user-a");
    const userDb = authedContext("user-a").firestore();

    await assertSucceeds(
      updateDoc(doc(userDb, "reports", "report-owned"), {
        notes: "อัปเดตรายละเอียดเพิ่มเติม"
      })
    );

    await assertFails(
      updateDoc(doc(userDb, "reports", "report-owned"), {
        verificationStatus: "ยืนยันแล้ว"
      })
    );

    await assertFails(
      updateDoc(doc(userDb, "reports", "report-owned"), {
        confirmedByReportIds: ["report-nearby"]
      })
    );

    await assertFails(
      updateDoc(doc(userDb, "reports", "report-owned"), {
        moderationStatus: "ถูกซ่อน"
      })
    );

    await assertFails(
      updateDoc(doc(userDb, "reports", "report-owned"), {
        flaggedCount: 1
      })
    );
  });

  it("blocks direct client writes to report flag subcollections", async () => {
    await seedReport("report-owned", "user-a");
    const userDb = authedContext("user-a").firestore();

    await assertFails(
      setDoc(doc(userDb, "reports", "report-owned", "flags", "user-a"), {
        uid: "user-a",
        reportId: "report-owned",
        createdAt: CREATED_AT
      })
    );
  });

  it("prevents a user from reading or writing another user's profile", async () => {
    await seedUser("user-b");
    const userDb = authedContext("user-a").firestore();

    await assertFails(getDoc(doc(userDb, "users", "user-b")));
    await assertFails(
      updateDoc(doc(userDb, "users", "user-b"), {
        displayName: "Wrong user"
      })
    );
  });

  it("allows profile owners to manage public profile fields only", async () => {
    const userDb = authedContext("user-a").firestore();

    await assertSucceeds(
      setDoc(doc(userDb, "users", "user-a"), ownerUserData({ id: "user-a" }))
    );

    await assertSucceeds(
      updateDoc(doc(userDb, "users", "user-a"), {
        displayName: "Updated User",
        homeGeohash: "w5q6ut"
      })
    );

    await assertFails(
      updateDoc(doc(userDb, "users", "user-a"), {
        isSuspended: true
      })
    );
  });

  it("allows admins to read and update admin-controlled user data", async () => {
    await seedAdmin("admin-a");
    await seedUser("user-a");
    const adminDb = authedContext("admin-a").firestore();

    await assertSucceeds(getDoc(doc(adminDb, "users", "user-a")));
    await assertSucceeds(
      updateDoc(doc(adminDb, "users", "user-a"), {
        ...adminUserData({ id: "user-a" }),
        isSuspended: true
      })
    );
  });

  it("keeps admin-only user documents inaccessible to non-admin users", async () => {
    await seedAdmin("admin-a");
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), "users", "user-a", "adminOnly", "review"), {
        note: "Needs moderation review"
      });
    });

    const userDb = authedContext("user-a").firestore();
    const adminDb = authedContext("admin-a").firestore();

    await assertFails(getDoc(doc(userDb, "users", "user-a", "adminOnly", "review")));
    await assertSucceeds(getDoc(doc(adminDb, "users", "user-a", "adminOnly", "review")));
    await assertSucceeds(
      setDoc(doc(adminDb, "users", "user-a", "adminOnly", "review-2"), {
        note: "Admin-only moderation note"
      })
    );
  });

  it("allows users to read only their own admin record and blocks all client writes", async () => {
    await seedAdmin("admin-a");
    const adminDb = authedContext("admin-a").firestore();
    const userDb = authedContext("user-a").firestore();

    await assertSucceeds(getDoc(doc(adminDb, "admins", "admin-a")));
    await assertFails(getDoc(doc(userDb, "admins", "admin-a")));
    await assertFails(
      setDoc(doc(adminDb, "admins", "user-a"), {
        uid: "user-a",
        role: "moderator"
      })
    );
  });

  it("allows public and authenticated reads of visible incident zones only", async () => {
    await seedIncidentZone("zone-active", "active");
    await seedIncidentZone("zone-resolved", "resolved");
    await seedIncidentZone("zone-hidden", "hidden");
    const publicDb = testEnv.unauthenticatedContext().firestore();
    const userDb = authedContext("user-a").firestore();

    await assertSucceeds(getDoc(doc(publicDb, "incidentZones", "zone-active")));
    await assertSucceeds(getDoc(doc(userDb, "incidentZones", "zone-resolved")));
    await assertFails(getDoc(doc(publicDb, "incidentZones", "zone-hidden")));
    await assertFails(getDoc(doc(userDb, "incidentZones", "zone-hidden")));
  });

  it("blocks all client creates, updates, and deletes for incident zones", async () => {
    await seedIncidentZone("zone-existing");
    await seedAdmin("admin-a");
    const userDb = authedContext("user-a").firestore();
    const adminDb = authedContext("admin-a").firestore();

    await assertFails(
      setDoc(
        doc(userDb, "incidentZones", "zone-new"),
        incidentZoneData("zone-new")
      )
    );
    await assertFails(
      updateDoc(doc(adminDb, "incidentZones", "zone-existing"), {
        riskRank: 3
      })
    );
    await assertFails(
      deleteDoc(doc(adminDb, "incidentZones", "zone-existing"))
    );
  });

  it("blocks all client access to incident-zone memberships", async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(
        doc(context.firestore(), "incidentZoneMemberships", "report-a"),
        {
          reportId: "report-a",
          zoneId: "zone-a",
          status: "active"
        }
      );
    });
    const userDb = authedContext("user-a").firestore();

    await assertFails(
      getDoc(doc(userDb, "incidentZoneMemberships", "report-a"))
    );
    await assertFails(
      setDoc(doc(userDb, "incidentZoneMemberships", "report-b"), {
        reportId: "report-b",
        zoneId: "zone-a",
        status: "active"
      })
    );
  });

  it("allows public alias reads but blocks all client alias writes", async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), "incidentZoneAliases", "zone-old"), {
        oldZoneId: "zone-old",
        canonicalZoneId: "zone-current",
        reason: "merged"
      });
    });
    const publicDb = testEnv.unauthenticatedContext().firestore();
    const userDb = authedContext("user-a").firestore();

    await assertSucceeds(
      getDoc(doc(publicDb, "incidentZoneAliases", "zone-old"))
    );
    await assertFails(
      setDoc(doc(userDb, "incidentZoneAliases", "zone-spoofed"), {
        oldZoneId: "zone-spoofed",
        canonicalZoneId: "zone-current",
        reason: "merged"
      })
    );
  });

  it("blocks all client access to incident-zone jobs", async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), "incidentZoneJobs", "w5q6"), {
        partitionKey: "w5q6",
        status: "pending"
      });
    });
    const userDb = authedContext("user-a").firestore();

    await assertFails(getDoc(doc(userDb, "incidentZoneJobs", "w5q6")));
    await assertFails(
      setDoc(doc(userDb, "incidentZoneJobs", "w5q7"), {
        partitionKey: "w5q7",
        status: "pending"
      })
    );
  });

  it("allows readiness reads only and blocks all client system metadata writes", async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), "incidentZoneSystem", "state"), {
        status: "ready",
        algorithmVersion: "incident-zone-v1",
        updatedAt: CREATED_AT
      });
      await setDoc(
        doc(context.firestore(), "incidentZoneSystem", "backfillCheckpoint"),
        {
          cursor: "report-a",
          updatedAt: CREATED_AT
        }
      );
    });
    const publicDb = testEnv.unauthenticatedContext().firestore();
    const userDb = authedContext("user-a").firestore();

    await assertSucceeds(
      getDoc(doc(publicDb, "incidentZoneSystem", "state"))
    );
    await assertFails(
      getDoc(doc(userDb, "incidentZoneSystem", "backfillCheckpoint"))
    );
    await assertFails(
      setDoc(doc(userDb, "incidentZoneSystem", "state"), {
        status: "ready"
      })
    );
  });
});
