import type { Firestore } from "firebase-admin/firestore";
import { encodeGeohash } from "../geohash";
import { toEpochMilliseconds } from "./firestoreAdapter";
import {
  incidentZoneJobFromFirestore,
  incidentZoneJobToFirestore
} from "./jobAdapter";
import { hasRelevantIncidentZoneReportChange } from "./reportChange";
import {
  MAX_DIRTY_CENTERS_PER_JOB,
  MAX_DIRTY_GEOHASHES_PER_JOB,
  MAX_DIRTY_REPORT_IDS_PER_JOB,
  type DirtyIncidentZoneCenter,
  type IncidentZoneRuntimeJob
} from "./runtimeTypes";
import { IncidentZoneRuntimeError } from "./runtimeError";
import {
  getIncidentZonePartitionKey,
  getNeighboringPartitionKeys
} from "./spatialPartition";

const GEOHASH_PATTERN = /^[0123456789bcdefghjkmnpqrstuvwxyz]{5,12}$/;

// Coordinates remain authoritative when a legacy geohash is malformed.
function normalizeReportGeohash(
  lat: number,
  lng: number,
  value: unknown
): string {
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (GEOHASH_PATTERN.test(normalized)) {
      return normalized;
    }
  }

  return encodeGeohash(lat, lng, 8);
}

export interface DirtyRegionTargets {
  centers: DirtyIncidentZoneCenter[];
  partitionKeys: string[];
  reportId: string;
  earliestRelevantAt: number;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readDirtyCenter(
  reportId: string,
  value: Record<string, unknown> | null
): DirtyIncidentZoneCenter | null {
  if (
    value === null ||
    typeof value.lat !== "number" ||
    !Number.isFinite(value.lat) ||
    value.lat < -90 ||
    value.lat > 90 ||
    typeof value.lng !== "number" ||
    !Number.isFinite(value.lng) ||
    value.lng < -180 ||
    value.lng > 180
  ) {
    return null;
  }

  return {
    reportId,
    lat: value.lat,
    lng: value.lng,
    geohash: normalizeReportGeohash(value.lat, value.lng, value.geohash)
  };
}

function centerKey(center: DirtyIncidentZoneCenter): string {
  return `${center.reportId}:${center.lat.toFixed(6)}:${center.lng.toFixed(6)}`;
}

function boundedUniqueStrings(
  current: readonly string[],
  incoming: readonly string[],
  maximum: number
): string[] {
  return [...new Set([...current, ...incoming])].sort().slice(-maximum);
}

function boundedUniqueCenters(
  current: readonly DirtyIncidentZoneCenter[],
  incoming: readonly DirtyIncidentZoneCenter[]
): DirtyIncidentZoneCenter[] {
  const byKey = new Map<string, DirtyIncidentZoneCenter>();
  [...current, ...incoming].forEach((center) => {
    byKey.set(centerKey(center), center);
  });

  return [...byKey.values()]
    .sort((a, b) => centerKey(a).localeCompare(centerKey(b)))
    .slice(-MAX_DIRTY_CENTERS_PER_JOB);
}

export function buildDirtyRegionTargets(
  reportId: string,
  beforeValue: unknown,
  afterValue: unknown,
  now: number
): DirtyRegionTargets | null {
  const before = isRecord(beforeValue) ? beforeValue : null;
  const after = isRecord(afterValue) ? afterValue : null;
  if (!hasRelevantIncidentZoneReportChange(before, after)) {
    return null;
  }

  const centers = [
    readDirtyCenter(reportId, before),
    readDirtyCenter(reportId, after)
  ].filter((center): center is DirtyIncidentZoneCenter => center !== null);
  const uniqueCenters = boundedUniqueCenters([], centers);
  if (uniqueCenters.length === 0) {
    return null;
  }

  const partitionKeys = new Set<string>();
  uniqueCenters.forEach((center) => {
    const partitionKey = getIncidentZonePartitionKey(center, center.geohash);
    getNeighboringPartitionKeys(partitionKey).forEach((key) =>
      partitionKeys.add(key)
    );
  });

  const createdTimes = [before?.createdAt, after?.createdAt]
    .map(toEpochMilliseconds)
    .filter((value): value is number => value !== null);

  return {
    centers: uniqueCenters,
    partitionKeys: [...partitionKeys].sort(),
    reportId,
    earliestRelevantAt:
      createdTimes.length === 0 ? Math.trunc(now) : Math.min(...createdTimes)
  };
}

function createPendingJob(
  partitionKey: string,
  targets: DirtyRegionTargets,
  now: number
): IncidentZoneRuntimeJob {
  return {
    partitionKey,
    generation: 1,
    dirtyCenters: targets.centers,
    dirtyGeohashes: boundedUniqueStrings(
      [],
      targets.centers.map((center) => center.geohash),
      MAX_DIRTY_GEOHASHES_PER_JOB
    ),
    dirtyReportIds: [targets.reportId],
    earliestRelevantAt: targets.earliestRelevantAt,
    status: "pending",
    leaseOwner: null,
    leaseExpiresAt: null,
    attempts: 0,
    nextAttemptAt: null,
    lastErrorCode: null,
    createdAt: Math.trunc(now),
    updatedAt: Math.trunc(now)
  };
}

export async function enqueueDirtyRegionTargets(
  db: Firestore,
  targets: DirtyRegionTargets,
  now: number
): Promise<void> {
  for (const partitionKey of targets.partitionKeys) {
    const jobRef = db.collection("incidentZoneJobs").doc(partitionKey);
    await db.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(jobRef);
      const existing = snapshot.exists
        ? incidentZoneJobFromFirestore(partitionKey, snapshot.data())
        : null;
      if (snapshot.exists && existing === null) {
        throw new IncidentZoneRuntimeError(
          "invalid-job",
          "The existing incident-zone job document is malformed."
        );
      }
      const leaseIsCurrent =
        existing?.status === "leased" &&
        existing.leaseExpiresAt !== null &&
        existing.leaseExpiresAt > now;
      const next = existing
        ? {
            ...existing,
            generation: existing.generation + 1,
            dirtyCenters: boundedUniqueCenters(
              existing.dirtyCenters,
              targets.centers
            ),
            dirtyGeohashes: boundedUniqueStrings(
              existing.dirtyGeohashes,
              targets.centers.map((center) => center.geohash),
              MAX_DIRTY_GEOHASHES_PER_JOB
            ),
            dirtyReportIds: boundedUniqueStrings(
              existing.dirtyReportIds,
              [targets.reportId],
              MAX_DIRTY_REPORT_IDS_PER_JOB
            ),
            earliestRelevantAt: Math.min(
              existing.earliestRelevantAt,
              targets.earliestRelevantAt
            ),
            status: leaseIsCurrent ? ("leased" as const) : ("pending" as const),
            leaseOwner: leaseIsCurrent ? existing.leaseOwner : null,
            leaseExpiresAt: leaseIsCurrent ? existing.leaseExpiresAt : null,
            attempts: 0,
            nextAttemptAt: null,
            lastErrorCode: null,
            updatedAt: Math.trunc(now)
          }
        : createPendingJob(partitionKey, targets, now);

      transaction.set(jobRef, incidentZoneJobToFirestore(next));
    });
  }
}

export async function enqueueIncidentZoneDirtyRegion(
  db: Firestore,
  reportId: string,
  beforeValue: unknown,
  afterValue: unknown,
  now = Date.now()
): Promise<boolean> {
  const targets = buildDirtyRegionTargets(
    reportId,
    beforeValue,
    afterValue,
    now
  );
  if (targets === null) {
    return false;
  }

  await enqueueDirtyRegionTargets(db, targets, now);
  return true;
}
