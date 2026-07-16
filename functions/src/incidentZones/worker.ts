import type { Firestore } from "firebase-admin/firestore";
import { buildCanonicalIncidentZones } from "./domain";
import { loadIncidentZoneCandidates } from "./candidateLoader";
import { enqueueDirtyRegionTargets } from "./dirtyRegion";
import {
  incidentZoneJobFromFirestore,
  incidentZoneJobToFirestore
} from "./jobAdapter";
import { IncidentZoneRuntimeError } from "./runtimeError";
import type { IncidentZoneLease, IncidentZoneRuntimeJob } from "./runtimeTypes";
import { getIncidentZonePartitionKey } from "./spatialPartition";
import { writeIncidentZonePlan } from "./zoneWriter";

export const INCIDENT_ZONE_LEASE_DURATION_MS = 2 * 60 * 1000;
export const INCIDENT_ZONE_MAX_ATTEMPTS = 5;
const MAX_RETRY_DELAY_MS = 15 * 60 * 1000;

export type IncidentZoneWorkerResult =
  | { status: "completed"; writes: number; malformedReports: number }
  | { status: "forwarded"; ownerPartitionKey: string }
  | { status: "ignored" }
  | { status: "stale-generation" }
  | { status: "lease-lost" }
  | { status: "failed"; errorCode: string };

function canAcquireJob(job: IncidentZoneRuntimeJob, now: number): boolean {
  if (job.attempts >= INCIDENT_ZONE_MAX_ATTEMPTS) {
    return false;
  }

  if (job.status === "pending") {
    return job.nextAttemptAt === null || job.nextAttemptAt <= now;
  }

  if (job.status === "leased") {
    return job.leaseExpiresAt === null || job.leaseExpiresAt <= now;
  }

  return (
    job.status === "failed" &&
    job.nextAttemptAt !== null &&
    job.nextAttemptAt <= now
  );
}

export async function acquireIncidentZoneLease(
  db: Firestore,
  partitionKey: string,
  leaseOwner: string,
  now: number
): Promise<IncidentZoneLease | null> {
  const jobRef = db.collection("incidentZoneJobs").doc(partitionKey);
  return db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(jobRef);
    if (!snapshot.exists) {
      return null;
    }

    const job = incidentZoneJobFromFirestore(partitionKey, snapshot.data());
    if (job === null) {
      throw new IncidentZoneRuntimeError(
        "invalid-job",
        "The incident-zone job document is malformed."
      );
    }
    if (!canAcquireJob(job, now)) {
      return null;
    }

    const leasedJob: IncidentZoneRuntimeJob = {
      ...job,
      status: "leased",
      leaseOwner,
      leaseExpiresAt: Math.trunc(now + INCIDENT_ZONE_LEASE_DURATION_MS),
      attempts: job.attempts + 1,
      nextAttemptAt: null,
      lastErrorCode: null,
      updatedAt: Math.trunc(now)
    };
    transaction.set(jobRef, incidentZoneJobToFirestore(leasedJob));

    return {
      partitionKey,
      generation: leasedJob.generation,
      leaseOwner,
      job: leasedJob
    };
  });
}

async function finishForwardedLease(
  db: Firestore,
  lease: IncidentZoneLease,
  now: number
): Promise<"completed" | "stale-generation" | "lease-lost"> {
  const jobRef = db.collection("incidentZoneJobs").doc(lease.partitionKey);
  return db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(jobRef);
    const job = snapshot.exists
      ? incidentZoneJobFromFirestore(lease.partitionKey, snapshot.data())
      : null;
    if (
      job === null ||
      job.status !== "leased" ||
      job.leaseOwner !== lease.leaseOwner
    ) {
      return "lease-lost" as const;
    }

    const stale = job.generation !== lease.generation;
    transaction.set(
      jobRef,
      incidentZoneJobToFirestore({
        ...job,
        status: stale ? "pending" : "completed",
        leaseOwner: null,
        leaseExpiresAt: null,
        nextAttemptAt: null,
        updatedAt: Math.trunc(now)
      })
    );
    return stale ? ("stale-generation" as const) : ("completed" as const);
  });
}

async function forwardToOwnerPartition(
  db: Firestore,
  lease: IncidentZoneLease,
  ownerPartitionKey: string,
  now: number
): Promise<void> {
  for (const reportId of lease.job.dirtyReportIds) {
    await enqueueDirtyRegionTargets(
      db,
      {
        centers: lease.job.dirtyCenters,
        partitionKeys: [ownerPartitionKey],
        reportId,
        earliestRelevantAt: lease.job.earliestRelevantAt
      },
      now
    );
  }
}

function chooseOwnerPartition(
  fallbackPartitionKey: string,
  reportCoordinates: readonly Readonly<{ lat: number; lng: number }>[],
  zoneGeohashes: readonly string[]
): string {
  const candidates = new Set<string>();
  reportCoordinates.forEach((coordinate) =>
    candidates.add(getIncidentZonePartitionKey(coordinate))
  );
  zoneGeohashes.forEach((geohash) => {
    if (geohash.length >= 5) {
      candidates.add(geohash.slice(0, 5));
    }
  });
  return [...candidates].sort()[0] ?? fallbackPartitionKey;
}

function errorCodeFor(error: unknown): string {
  if (error instanceof IncidentZoneRuntimeError) {
    return error.code;
  }
  return "internal";
}

export async function markIncidentZoneLeaseFailed(
  db: Firestore,
  lease: IncidentZoneLease,
  errorCode: string,
  now: number
): Promise<void> {
  const jobRef = db.collection("incidentZoneJobs").doc(lease.partitionKey);
  await db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(jobRef);
    const job = snapshot.exists
      ? incidentZoneJobFromFirestore(lease.partitionKey, snapshot.data())
      : null;
    if (
      job === null ||
      job.status !== "leased" ||
      job.leaseOwner !== lease.leaseOwner
    ) {
      return;
    }

    const stale = job.generation !== lease.generation;
    const retryDelay = Math.min(
      MAX_RETRY_DELAY_MS,
      30_000 * 2 ** Math.min(job.attempts, 5)
    );
    const retryAvailable = job.attempts < INCIDENT_ZONE_MAX_ATTEMPTS;
    transaction.set(
      jobRef,
      incidentZoneJobToFirestore({
        ...job,
        status: stale ? "pending" : "failed",
        leaseOwner: null,
        leaseExpiresAt: null,
        nextAttemptAt:
          stale || !retryAvailable ? null : Math.trunc(now + retryDelay),
        lastErrorCode: errorCode,
        updatedAt: Math.trunc(now)
      })
    );
  });
}

export async function workIncidentZoneJob(
  db: Firestore,
  partitionKey: string,
  leaseOwner: string,
  now = Date.now()
): Promise<IncidentZoneWorkerResult> {
  let lease: IncidentZoneLease | null = null;
  try {
    lease = await acquireIncidentZoneLease(db, partitionKey, leaseOwner, now);
    if (lease === null) {
      return { status: "ignored" };
    }

    const candidates = await loadIncidentZoneCandidates(db, lease.job, now);
    if (candidates.status === "limit-exceeded") {
      const code =
        candidates.limit === "candidate-reports"
          ? "candidate-limit-exceeded"
          : "connected-partition-limit-exceeded";
      throw new IncidentZoneRuntimeError(
        code,
        `Incident-zone candidate loading exceeded ${candidates.limit}.`
      );
    }

    const buildResult = buildCanonicalIncidentZones(
      candidates.value.reports,
      candidates.value.previousZones,
      now
    );
    if (buildResult.status === "limit-exceeded") {
      throw new IncidentZoneRuntimeError(
        "candidate-limit-exceeded",
        `Incident-zone recomputation exceeded ${buildResult.limit}.`
      );
    }

    const ownerPartitionKey = chooseOwnerPartition(
      partitionKey,
      candidates.value.reports,
      candidates.value.previousZones.map((zone) => zone.geohash)
    );
    if (ownerPartitionKey !== partitionKey) {
      await forwardToOwnerPartition(db, lease, ownerPartitionKey, now);
      const finishStatus = await finishForwardedLease(db, lease, now);
      if (finishStatus !== "completed") {
        return { status: finishStatus };
      }
      return { status: "forwarded", ownerPartitionKey };
    }

    const writeResult = await writeIncidentZonePlan(
      db,
      lease,
      buildResult.plan,
      candidates.value.previousZones,
      now
    );
    if (writeResult.status !== "written") {
      return { status: writeResult.status };
    }

    return {
      status: "completed",
      writes: writeResult.writes,
      malformedReports: candidates.value.malformedReportCount
    };
  } catch (error) {
    const errorCode = errorCodeFor(error);
    if (lease !== null) {
      await markIncidentZoneLeaseFailed(db, lease, errorCode, now);
    }
    return { status: "failed", errorCode };
  }
}
