import { Timestamp, type Firestore } from "firebase-admin/firestore";
import { enqueueDirtyRegionTargets } from "./dirtyRegion";
import { incidentZoneStateFromFirestore } from "./firestoreAdapter";
import {
  incidentZoneJobFromFirestore,
  incidentZoneJobToFirestore
} from "./jobAdapter";
import {
  getIncidentZonePartitionKey,
  getNeighboringPartitionKeys
} from "./spatialPartition";

export const INCIDENT_ZONE_DUE_ZONE_BATCH_SIZE = 20;
export const INCIDENT_ZONE_RETRY_JOB_BATCH_SIZE = 50;

export interface IncidentZoneMaintenanceResult {
  zonesEnqueued: number;
  expiredLeasesReset: number;
  failedJobsReset: number;
  malformedZonesSkipped: number;
}

async function enqueueDueZones(
  db: Firestore,
  now: number
): Promise<{ enqueued: number; malformed: number }> {
  const snapshot = await db
    .collection("incidentZones")
    .where("status", "==", "active")
    .where("nextEvaluationAt", "<=", Timestamp.fromMillis(now))
    .orderBy("nextEvaluationAt", "asc")
    .limit(INCIDENT_ZONE_DUE_ZONE_BATCH_SIZE)
    .get();
  let enqueued = 0;
  let malformed = 0;

  for (const document of snapshot.docs) {
    const zone = incidentZoneStateFromFirestore(document.id, document.data());
    const seedReportId = zone?.reportIds[0];
    if (zone === null || seedReportId === undefined) {
      malformed += 1;
      continue;
    }

    const partitionKey = getIncidentZonePartitionKey(
      { lat: zone.centerLat, lng: zone.centerLng },
      zone.geohash
    );
    await enqueueDirtyRegionTargets(
      db,
      {
        centers: [
          {
            reportId: seedReportId,
            lat: zone.centerLat,
            lng: zone.centerLng,
            geohash: zone.geohash
          }
        ],
        partitionKeys: getNeighboringPartitionKeys(partitionKey),
        reportId: seedReportId,
        earliestRelevantAt: zone.latestReportAt
      },
      now
    );
    enqueued += 1;
  }

  return { enqueued, malformed };
}

async function resetDueJobs(
  db: Firestore,
  status: "leased" | "failed",
  dueField: "leaseExpiresAt" | "nextAttemptAt",
  now: number
): Promise<number> {
  const snapshot = await db
    .collection("incidentZoneJobs")
    .where("status", "==", status)
    .where(dueField, "<=", Timestamp.fromMillis(now))
    .orderBy(dueField, "asc")
    .limit(INCIDENT_ZONE_RETRY_JOB_BATCH_SIZE)
    .get();
  let resetCount = 0;

  for (const document of snapshot.docs) {
    const changed = await db.runTransaction(async (transaction) => {
      const currentSnapshot = await transaction.get(document.ref);
      const current = currentSnapshot.exists
        ? incidentZoneJobFromFirestore(document.id, currentSnapshot.data())
        : null;
      const dueAt =
        dueField === "leaseExpiresAt"
          ? current?.leaseExpiresAt
          : current?.nextAttemptAt;
      if (
        current === null ||
        current.status !== status ||
        dueAt === null ||
        dueAt === undefined ||
        dueAt > now
      ) {
        return false;
      }

      transaction.set(
        document.ref,
        incidentZoneJobToFirestore({
          ...current,
          status: "pending",
          leaseOwner: null,
          leaseExpiresAt: null,
          nextAttemptAt: null,
          updatedAt: Math.trunc(now)
        })
      );
      return true;
    });
    if (changed) {
      resetCount += 1;
    }
  }

  return resetCount;
}

export async function runIncidentZoneMaintenance(
  db: Firestore,
  now = Date.now()
): Promise<IncidentZoneMaintenanceResult> {
  const dueZones = await enqueueDueZones(db, now);
  const expiredLeasesReset = await resetDueJobs(
    db,
    "leased",
    "leaseExpiresAt",
    now
  );
  const failedJobsReset = await resetDueJobs(
    db,
    "failed",
    "nextAttemptAt",
    now
  );

  return {
    zonesEnqueued: dueZones.enqueued,
    expiredLeasesReset,
    failedJobsReset,
    malformedZonesSkipped: dueZones.malformed
  };
}
