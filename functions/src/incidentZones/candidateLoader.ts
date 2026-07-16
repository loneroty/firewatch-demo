import {
  Timestamp,
  type DocumentData,
  type DocumentReference,
  type DocumentSnapshot,
  type Firestore
} from "firebase-admin/firestore";
import {
  ACTIVE_MEMBERSHIP_WINDOW_MS,
  INCIDENT_ZONE_RADIUS_METERS,
  MAX_CANDIDATE_REPORTS
} from "./domain";
import { incidentZoneStateFromFirestore } from "./firestoreAdapter";
import { adaptReportDocument } from "./reportAdapter";
import { IncidentZoneRuntimeError } from "./runtimeError";
import type {
  IncidentZoneCandidateLoadResult,
  IncidentZoneRuntimeJob
} from "./runtimeTypes";
import {
  distanceMeters,
  getGeohashPrefixRange,
  getIncidentZonePartitionKey,
  getNeighboringPartitionKeys,
  MAX_CONNECTED_PARTITIONS
} from "./spatialPartition";
import type { IncidentZoneReport, IncidentZoneState } from "./types";

const FIRESTORE_GET_ALL_BATCH_SIZE = 200;

async function getDocumentsInBatches(
  db: Firestore,
  references: readonly DocumentReference<DocumentData>[]
): Promise<DocumentSnapshot<DocumentData>[]> {
  const snapshots: DocumentSnapshot<DocumentData>[] = [];
  for (
    let startIndex = 0;
    startIndex < references.length;
    startIndex += FIRESTORE_GET_ALL_BATCH_SIZE
  ) {
    const batch = references.slice(
      startIndex,
      startIndex + FIRESTORE_GET_ALL_BATCH_SIZE
    );
    if (batch.length > 0) {
      snapshots.push(...(await db.getAll(...batch)));
    }
  }

  return snapshots;
}

function isBridgeEligible(report: IncidentZoneReport, now: number): boolean {
  const age = now - report.createdAt;
  return (
    age >= 0 &&
    age < ACTIVE_MEMBERSHIP_WINDOW_MS &&
    report.moderationStatus !== "ถูกซ่อน" &&
    report.verificationStatus !== "ถูกปฏิเสธ"
  );
}

function findConnectedReports(
  reports: readonly IncidentZoneReport[],
  job: IncidentZoneRuntimeJob,
  now: number
): IncidentZoneReport[] {
  const eligible = reports.filter((report) => isBridgeEligible(report, now));
  const connectedIds = new Set<string>();
  const frontier = eligible.filter((report) =>
    job.dirtyCenters.some(
      (center) => distanceMeters(center, report) <= INCIDENT_ZONE_RADIUS_METERS
    )
  );
  const queuedIds = new Set(frontier.map((report) => report.id));

  job.dirtyReportIds.forEach((reportId) => {
    const directReport = eligible.find((report) => report.id === reportId);
    if (directReport && !queuedIds.has(directReport.id)) {
      frontier.push(directReport);
      queuedIds.add(directReport.id);
    }
  });

  while (frontier.length > 0) {
    const current = frontier.shift();
    if (!current || connectedIds.has(current.id)) {
      continue;
    }

    connectedIds.add(current.id);
    eligible.forEach((candidate) => {
      if (
        !connectedIds.has(candidate.id) &&
        !queuedIds.has(candidate.id) &&
        distanceMeters(current, candidate) <= INCIDENT_ZONE_RADIUS_METERS
      ) {
        frontier.push(candidate);
        queuedIds.add(candidate.id);
      }
    });
  }

  return eligible
    .filter((report) => connectedIds.has(report.id))
    .sort((a, b) => a.id.localeCompare(b.id));
}

function addPartitionAndNeighbors(
  partitionKeys: Set<string>,
  partitionKey: string
): void {
  getNeighboringPartitionKeys(partitionKey).forEach((key) =>
    partitionKeys.add(key)
  );
}

function extractMembershipZoneId(value: unknown): string | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return null;
  }

  const record = value as Record<string, unknown>;
  if (
    typeof record.canonicalZoneId === "string" &&
    record.canonicalZoneId.trim().length > 0
  ) {
    return record.canonicalZoneId;
  }

  return typeof record.zoneId === "string" && record.zoneId.trim().length > 0
    ? record.zoneId
    : null;
}

function candidateLimitResult(observed: number): IncidentZoneCandidateLoadResult {
  return {
    status: "limit-exceeded",
    limit: "candidate-reports",
    maximum: MAX_CANDIDATE_REPORTS,
    observed
  };
}

export async function loadIncidentZoneCandidates(
  db: Firestore,
  job: IncidentZoneRuntimeJob,
  now: number
): Promise<IncidentZoneCandidateLoadResult> {
  const reportsById = new Map<string, IncidentZoneReport>();
  let malformedReportCount = 0;
  const directReferences = job.dirtyReportIds.map((reportId) =>
    db.collection("reports").doc(reportId)
  );
  const directSnapshots = await getDocumentsInBatches(db, directReferences);
  directSnapshots.forEach((snapshot) => {
    if (!snapshot.exists) {
      return;
    }

    const adapted = adaptReportDocument(snapshot.id, snapshot.data());
    if (adapted.status === "ok") {
      reportsById.set(snapshot.id, adapted.value.report);
    } else {
      malformedReportCount += 1;
    }
  });

  const queuedPartitionKeys = new Set<string>();
  addPartitionAndNeighbors(queuedPartitionKeys, job.partitionKey);
  job.dirtyCenters.forEach((center) => {
    addPartitionAndNeighbors(
      queuedPartitionKeys,
      getIncidentZonePartitionKey(center, center.geohash)
    );
  });
  const queriedPartitionKeys = new Set<string>();
  const cutoff = now - ACTIVE_MEMBERSHIP_WINDOW_MS;

  while (queuedPartitionKeys.size > 0) {
    const nextPartitionKey = [...queuedPartitionKeys].sort()[0];
    if (nextPartitionKey === undefined) {
      break;
    }
    queuedPartitionKeys.delete(nextPartitionKey);
    if (queriedPartitionKeys.has(nextPartitionKey)) {
      continue;
    }
    if (queriedPartitionKeys.size >= MAX_CONNECTED_PARTITIONS) {
      return {
        status: "limit-exceeded",
        limit: "connected-partitions",
        maximum: MAX_CONNECTED_PARTITIONS,
        observed: queriedPartitionKeys.size + queuedPartitionKeys.size + 1
      };
    }

    const range = getGeohashPrefixRange(nextPartitionKey);
    const snapshot = await db
      .collection("reports")
      .where("geohash", ">=", range.startAt)
      .where("geohash", "<=", range.endAt)
      .where("createdAt", ">=", Timestamp.fromMillis(cutoff))
      .orderBy("geohash", "asc")
      .orderBy("createdAt", "asc")
      .limit(MAX_CANDIDATE_REPORTS + 1)
      .get();
    queriedPartitionKeys.add(nextPartitionKey);

    if (snapshot.size > MAX_CANDIDATE_REPORTS) {
      return candidateLimitResult(snapshot.size);
    }

    for (const document of snapshot.docs) {
      const adapted = adaptReportDocument(document.id, document.data());
      if (adapted.status !== "ok") {
        malformedReportCount += 1;
        continue;
      }
      reportsById.set(document.id, adapted.value.report);
      if (reportsById.size > MAX_CANDIDATE_REPORTS) {
        return candidateLimitResult(reportsById.size);
      }
    }

    const connectedReports = findConnectedReports(
      [...reportsById.values()],
      job,
      now
    );
    connectedReports.forEach((report) => {
      addPartitionAndNeighbors(
        queuedPartitionKeys,
        getIncidentZonePartitionKey(report)
      );
    });
    [...queriedPartitionKeys].forEach((key) => queuedPartitionKeys.delete(key));
  }

  const connectedReports = findConnectedReports(
    [...reportsById.values()],
    job,
    now
  );
  const affectedReportIds = new Set([
    ...job.dirtyReportIds,
    ...connectedReports.map((report) => report.id)
  ]);
  const membershipSnapshots = await getDocumentsInBatches(
    db,
    [...affectedReportIds]
      .sort()
      .map((reportId) =>
        db.collection("incidentZoneMemberships").doc(reportId)
      )
  );
  const affectedZoneIds = new Set<string>();
  membershipSnapshots.forEach((snapshot) => {
    if (!snapshot.exists) {
      return;
    }
    const zoneId = extractMembershipZoneId(snapshot.data());
    if (zoneId !== null) {
      affectedZoneIds.add(zoneId);
    }
  });

  const zoneSnapshots = await getDocumentsInBatches(
    db,
    [...affectedZoneIds]
      .sort()
      .map((zoneId) => db.collection("incidentZones").doc(zoneId))
  );
  const previousZones: IncidentZoneState[] = [];
  const previousZoneReportIds = new Set<string>();
  for (const snapshot of zoneSnapshots) {
    if (!snapshot.exists) {
      continue;
    }
    const zone = incidentZoneStateFromFirestore(snapshot.id, snapshot.data());
    if (zone === null) {
      throw new IncidentZoneRuntimeError(
        "malformed-zone-state",
        "An affected incident zone contains malformed canonical state."
      );
    }
    previousZones.push(zone);
    zone.reportIds.forEach((reportId) => previousZoneReportIds.add(reportId));
  }

  if (previousZoneReportIds.size > MAX_CANDIDATE_REPORTS) {
    return candidateLimitResult(previousZoneReportIds.size);
  }

  const previousReportSnapshots = await getDocumentsInBatches(
    db,
    [...previousZoneReportIds]
      .sort()
      .map((reportId) => db.collection("reports").doc(reportId))
  );
  previousReportSnapshots.forEach((snapshot) => {
    if (!snapshot.exists) {
      return;
    }
    const adapted = adaptReportDocument(snapshot.id, snapshot.data());
    if (adapted.status === "ok") {
      reportsById.set(snapshot.id, adapted.value.report);
    } else {
      malformedReportCount += 1;
    }
  });

  if (reportsById.size > MAX_CANDIDATE_REPORTS) {
    return candidateLimitResult(reportsById.size);
  }

  const includedReportIds = new Set([
    ...job.dirtyReportIds,
    ...connectedReports.map((report) => report.id),
    ...previousZoneReportIds
  ]);
  const scopedReports = [...reportsById.values()].filter((report) =>
    includedReportIds.has(report.id)
  );

  return {
    status: "ok",
    value: {
      reports: scopedReports.sort((a, b) => a.id.localeCompare(b.id)),
      previousZones: previousZones.sort((a, b) => a.id.localeCompare(b.id)),
      queriedPartitionKeys: [...queriedPartitionKeys].sort(),
      malformedReportCount
    }
  };
}
