import type { DocumentData } from "firebase-admin/firestore";
import {
  isRecord,
  toEpochMilliseconds,
  toFirestoreTimestamp
} from "./firestoreAdapter";
import type {
  DirtyIncidentZoneCenter,
  IncidentZoneRuntimeJob,
  IncidentZoneRuntimeJobStatus
} from "./runtimeTypes";
import {
  MAX_DIRTY_CENTERS_PER_JOB,
  MAX_DIRTY_GEOHASHES_PER_JOB,
  MAX_DIRTY_REPORT_IDS_PER_JOB
} from "./runtimeTypes";

const JOB_STATUSES: IncidentZoneRuntimeJobStatus[] = [
  "pending",
  "leased",
  "completed",
  "failed"
];

function readStringArray(value: unknown): string[] | null {
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) {
    return null;
  }

  return [...new Set(value)].sort();
}

function readDirtyCenters(value: unknown): DirtyIncidentZoneCenter[] | null {
  if (!Array.isArray(value)) {
    return null;
  }

  const centers: DirtyIncidentZoneCenter[] = [];
  for (const item of value) {
    if (
      !isRecord(item) ||
      typeof item.reportId !== "string" ||
      item.reportId.trim().length === 0 ||
      typeof item.lat !== "number" ||
      !Number.isFinite(item.lat) ||
      item.lat < -90 ||
      item.lat > 90 ||
      typeof item.lng !== "number" ||
      !Number.isFinite(item.lng) ||
      item.lng < -180 ||
      item.lng > 180 ||
      typeof item.geohash !== "string" ||
      !/^[0123456789bcdefghjkmnpqrstuvwxyz]{5,12}$/.test(item.geohash)
    ) {
      return null;
    }

    centers.push({
      reportId: item.reportId,
      lat: item.lat,
      lng: item.lng,
      geohash: item.geohash
    });
  }

  return centers;
}

export function incidentZoneJobFromFirestore(
  partitionKey: string,
  value: unknown
): IncidentZoneRuntimeJob | null {
  if (!isRecord(value)) {
    return null;
  }

  const dirtyCenters = readDirtyCenters(value.dirtyCenters);
  const dirtyGeohashes = readStringArray(value.dirtyGeohashes);
  const dirtyReportIds = readStringArray(value.dirtyReportIds);
  const earliestRelevantAt = toEpochMilliseconds(value.earliestRelevantAt);
  const leaseExpiresAt =
    value.leaseExpiresAt === null || value.leaseExpiresAt === undefined
      ? null
      : toEpochMilliseconds(value.leaseExpiresAt);
  const nextAttemptAt =
    value.nextAttemptAt === null || value.nextAttemptAt === undefined
      ? null
      : toEpochMilliseconds(value.nextAttemptAt);
  const createdAt = toEpochMilliseconds(value.createdAt);
  const updatedAt = toEpochMilliseconds(value.updatedAt);

  if (
    !/^[0123456789bcdefghjkmnpqrstuvwxyz]{5}$/.test(partitionKey) ||
    dirtyCenters === null ||
    dirtyCenters.length === 0 ||
    dirtyCenters.length > MAX_DIRTY_CENTERS_PER_JOB ||
    dirtyGeohashes === null ||
    dirtyGeohashes.length === 0 ||
    dirtyGeohashes.length > MAX_DIRTY_GEOHASHES_PER_JOB ||
    dirtyGeohashes.some(
      (geohash) =>
        !/^[0123456789bcdefghjkmnpqrstuvwxyz]{5,12}$/.test(geohash)
    ) ||
    dirtyReportIds === null ||
    dirtyReportIds.length === 0 ||
    dirtyReportIds.length > MAX_DIRTY_REPORT_IDS_PER_JOB ||
    dirtyReportIds.some((reportId) => reportId.trim().length === 0) ||
    earliestRelevantAt === null ||
    createdAt === null ||
    updatedAt === null ||
    typeof value.generation !== "number" ||
    !Number.isInteger(value.generation) ||
    value.generation < 1 ||
    typeof value.status !== "string" ||
    !JOB_STATUSES.includes(value.status as IncidentZoneRuntimeJobStatus) ||
    typeof value.attempts !== "number" ||
    !Number.isInteger(value.attempts) ||
    value.attempts < 0 ||
    (value.leaseOwner !== null && typeof value.leaseOwner !== "string") ||
    (value.lastErrorCode !== null && typeof value.lastErrorCode !== "string") ||
    (value.leaseExpiresAt !== null &&
      value.leaseExpiresAt !== undefined &&
      leaseExpiresAt === null) ||
    (value.nextAttemptAt !== null &&
      value.nextAttemptAt !== undefined &&
      nextAttemptAt === null)
  ) {
    return null;
  }

  return {
    partitionKey,
    generation: value.generation,
    dirtyCenters,
    dirtyGeohashes,
    dirtyReportIds,
    earliestRelevantAt,
    status: value.status as IncidentZoneRuntimeJobStatus,
    leaseOwner: value.leaseOwner,
    leaseExpiresAt,
    attempts: value.attempts,
    nextAttemptAt,
    lastErrorCode: value.lastErrorCode,
    createdAt,
    updatedAt
  };
}

export function incidentZoneJobToFirestore(
  job: IncidentZoneRuntimeJob
): DocumentData {
  return {
    partitionKey: job.partitionKey,
    generation: job.generation,
    dirtyCenters: job.dirtyCenters,
    dirtyGeohashes: job.dirtyGeohashes,
    dirtyReportIds: job.dirtyReportIds,
    earliestRelevantAt: toFirestoreTimestamp(job.earliestRelevantAt),
    status: job.status,
    leaseOwner: job.leaseOwner,
    leaseExpiresAt:
      job.leaseExpiresAt === null
        ? null
        : toFirestoreTimestamp(job.leaseExpiresAt),
    attempts: job.attempts,
    nextAttemptAt:
      job.nextAttemptAt === null
        ? null
        : toFirestoreTimestamp(job.nextAttemptAt),
    lastErrorCode: job.lastErrorCode,
    createdAt: toFirestoreTimestamp(job.createdAt),
    updatedAt: toFirestoreTimestamp(job.updatedAt)
  };
}
