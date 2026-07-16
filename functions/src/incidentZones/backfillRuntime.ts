import {
  FieldPath,
  Timestamp,
  type DocumentData,
  type Firestore,
  type Query
} from "firebase-admin/firestore";
import { buildCanonicalIncidentZones, INCIDENT_ZONE_ALGORITHM_VERSION } from "./domain";
import { buildDirtyRegionTargets, enqueueDirtyRegionTargets } from "./dirtyRegion";
import { incidentZoneStateFromFirestore, toFirestoreTimestamp } from "./firestoreAdapter";
import { adaptReportDocument } from "./reportAdapter";
import type { IncidentZoneReport } from "./types";
import { workIncidentZoneJob } from "./worker";

export const INCIDENT_ZONE_BACKFILL_CONFIRMATION = "APPLY_INCIDENT_ZONES";
export const DEFAULT_INCIDENT_ZONE_BACKFILL_BATCH_SIZE = 25;
export const MAX_INCIDENT_ZONE_BACKFILL_BATCH_SIZE = 50;
export const DEFAULT_INCIDENT_ZONE_BACKFILL_JOB_LIMIT = 64;

export interface IncidentZoneBackfillGuards {
  applyEnabled: boolean;
  projectId: string;
  allowedProjectIds: readonly string[];
  confirmation: string;
}

export interface IncidentZoneBackfillRuntimeOptions {
  apply: boolean;
  guards: IncidentZoneBackfillGuards;
  batchSize?: number;
  maxJobs?: number;
  resumeCursor?: string | null;
  now?: number;
}

export interface IncidentZoneBackfillRuntimeSummary {
  mode: "dry-run" | "apply";
  projectId: string;
  resumeCursor: string | null;
  nextCursor: string | null;
  scanComplete: boolean;
  reportsScanned: number;
  reportsEligible: number;
  reportsExcluded: number;
  malformedReports: number;
  zonesPlanned: number;
  zonesCreated: number;
  zonesUpdated: number;
  zonesResolved: number;
  membershipsPlanned: number;
  aliasesPlanned: number;
  unchangedZones: number;
  limitErrors: number;
  jobsEnqueued: number;
  jobsProcessed: number;
  outstandingJobs: boolean;
  readinessStatus: "unchanged" | "backfilling" | "ready";
}

function normalizeBoundedInteger(
  value: number | undefined,
  fallback: number,
  maximum: number,
  label: string
): number {
  const normalized = value ?? fallback;
  if (!Number.isInteger(normalized) || normalized < 1 || normalized > maximum) {
    throw new RangeError(`${label} must be an integer between 1 and ${maximum}.`);
  }
  return normalized;
}

export function assertIncidentZoneBackfillApplyGuards(
  guards: IncidentZoneBackfillGuards
): void {
  if (!guards.applyEnabled) {
    throw new Error("Backfill apply requires FIREWATCH_ZONE_BACKFILL_APPLY=true.");
  }
  if (guards.projectId.trim().length === 0) {
    throw new Error("Backfill apply requires an explicit Firebase project ID.");
  }
  if (!guards.allowedProjectIds.includes(guards.projectId)) {
    throw new Error("The Firebase project is not in the backfill allowlist.");
  }
  if (guards.confirmation !== INCIDENT_ZONE_BACKFILL_CONFIRMATION) {
    throw new Error("Backfill apply requires the exact typed confirmation.");
  }
}

async function resolveResumeCursor(
  db: Firestore,
  options: IncidentZoneBackfillRuntimeOptions
): Promise<string | null> {
  if (options.resumeCursor !== undefined) {
    return options.resumeCursor;
  }
  if (!options.apply) {
    return null;
  }

  const snapshot = await db
    .collection("incidentZoneSystem")
    .doc("backfillCheckpoint")
    .get();
  const cursor = snapshot.data()?.cursor;
  return typeof cursor === "string" && cursor.length > 0 ? cursor : null;
}

async function buildDryRunSummary(
  db: Firestore,
  reportDocuments: readonly Readonly<{ id: string; data: DocumentData }>[],
  now: number
): Promise<
  Pick<
    IncidentZoneBackfillRuntimeSummary,
    | "reportsEligible"
    | "reportsExcluded"
    | "malformedReports"
    | "zonesPlanned"
    | "zonesCreated"
    | "zonesUpdated"
    | "zonesResolved"
    | "membershipsPlanned"
    | "aliasesPlanned"
    | "unchangedZones"
    | "limitErrors"
  >
> {
  const reports: IncidentZoneReport[] = [];
  let malformedReports = 0;
  reportDocuments.forEach((document) => {
    const adapted = adaptReportDocument(document.id, document.data);
    if (adapted.status === "ok") {
      reports.push(adapted.value.report);
    } else {
      malformedReports += 1;
    }
  });

  const initialPlan = buildCanonicalIncidentZones(reports, [], now);
  if (initialPlan.status === "limit-exceeded") {
    return {
      reportsEligible: 0,
      reportsExcluded: reports.length,
      malformedReports,
      zonesPlanned: 0,
      zonesCreated: 0,
      zonesUpdated: 0,
      zonesResolved: 0,
      membershipsPlanned: 0,
      aliasesPlanned: 0,
      unchangedZones: 0,
      limitErrors: 1
    };
  }

  const plannedZoneIds = initialPlan.plan.zones.map((zone) => zone.id);
  const existingSnapshots =
    plannedZoneIds.length === 0
      ? []
      : await db.getAll(
          ...plannedZoneIds.map((zoneId) =>
            db.collection("incidentZones").doc(zoneId)
          )
        );
  const previousZones = existingSnapshots
    .filter((snapshot) => snapshot.exists)
    .map((snapshot) =>
      incidentZoneStateFromFirestore(snapshot.id, snapshot.data())
    )
    .filter((zone): zone is NonNullable<typeof zone> => zone !== null);
  const comparedPlan = buildCanonicalIncidentZones(reports, previousZones, now);
  if (comparedPlan.status === "limit-exceeded") {
    return {
      reportsEligible: 0,
      reportsExcluded: reports.length,
      malformedReports,
      zonesPlanned: 0,
      zonesCreated: 0,
      zonesUpdated: 0,
      zonesResolved: 0,
      membershipsPlanned: 0,
      aliasesPlanned: 0,
      unchangedZones: 0,
      limitErrors: 1
    };
  }

  return {
    reportsEligible: comparedPlan.plan.stats.reportsEligible,
    reportsExcluded: comparedPlan.plan.stats.reportsExcluded,
    malformedReports,
    zonesPlanned: comparedPlan.plan.zones.length,
    zonesCreated: comparedPlan.plan.stats.zonesCreated,
    zonesUpdated: comparedPlan.plan.zoneUpserts.filter(
      (zone) => previousZones.some((previous) => previous.id === zone.id)
    ).length,
    zonesResolved: comparedPlan.plan.zoneUpserts.filter(
      (zone) => zone.status !== "active"
    ).length,
    membershipsPlanned: comparedPlan.plan.stats.membershipsPlanned,
    aliasesPlanned: comparedPlan.plan.stats.aliasesPlanned,
    unchangedZones: comparedPlan.plan.unchangedZoneIds.length,
    limitErrors: 0
  };
}

async function processPendingBackfillJobs(
  db: Firestore,
  maximumJobs: number,
  now: number
): Promise<number> {
  const snapshot = await db
    .collection("incidentZoneJobs")
    .where("status", "==", "pending")
    .orderBy("updatedAt", "asc")
    .limit(maximumJobs)
    .get();
  let processed = 0;
  for (const document of snapshot.docs) {
    const result = await workIncidentZoneJob(
      db,
      document.id,
      `backfill-${now}-${processed}`,
      now
    );
    if (result.status !== "ignored") {
      processed += 1;
    }
  }
  return processed;
}

async function hasOutstandingJobs(db: Firestore): Promise<boolean> {
  for (const status of ["pending", "leased", "failed"] as const) {
    const snapshot = await db
      .collection("incidentZoneJobs")
      .where("status", "==", status)
      .limit(1)
      .get();
    if (!snapshot.empty) {
      return true;
    }
  }
  return false;
}

export async function runIncidentZoneBackfillBatch(
  db: Firestore,
  options: IncidentZoneBackfillRuntimeOptions
): Promise<IncidentZoneBackfillRuntimeSummary> {
  if (options.apply) {
    assertIncidentZoneBackfillApplyGuards(options.guards);
  }

  const now = Math.trunc(options.now ?? Date.now());
  const batchSize = normalizeBoundedInteger(
    options.batchSize,
    DEFAULT_INCIDENT_ZONE_BACKFILL_BATCH_SIZE,
    MAX_INCIDENT_ZONE_BACKFILL_BATCH_SIZE,
    "Backfill batch size"
  );
  const maxJobs = normalizeBoundedInteger(
    options.maxJobs,
    DEFAULT_INCIDENT_ZONE_BACKFILL_JOB_LIMIT,
    DEFAULT_INCIDENT_ZONE_BACKFILL_JOB_LIMIT,
    "Backfill job limit"
  );
  const resumeCursor = await resolveResumeCursor(db, options);
  let reportQuery: Query<DocumentData> = db
    .collection("reports")
    .orderBy(FieldPath.documentId())
    .limit(batchSize);
  if (resumeCursor !== null) {
    reportQuery = reportQuery.startAfter(resumeCursor);
  }
  const reportSnapshot = await reportQuery.get();
  const reportDocuments = reportSnapshot.docs.map((document) => ({
    id: document.id,
    data: document.data()
  }));
  const preview = await buildDryRunSummary(db, reportDocuments, now);
  const nextCursor = reportSnapshot.docs.at(-1)?.id ?? resumeCursor;
  const scanComplete = reportSnapshot.size < batchSize;

  if (!options.apply) {
    return {
      mode: "dry-run",
      projectId: options.guards.projectId,
      resumeCursor,
      nextCursor,
      scanComplete,
      reportsScanned: reportSnapshot.size,
      ...preview,
      jobsEnqueued: 0,
      jobsProcessed: 0,
      outstandingJobs: false,
      readinessStatus: "unchanged"
    };
  }

  let jobsEnqueued = 0;
  for (const document of reportDocuments) {
    const targets = buildDirtyRegionTargets(document.id, null, document.data, now);
    if (targets === null) {
      continue;
    }
    await enqueueDirtyRegionTargets(db, targets, now);
    jobsEnqueued += targets.partitionKeys.length;
  }
  const jobsProcessed = await processPendingBackfillJobs(db, maxJobs, now);
  const outstandingJobs = await hasOutstandingJobs(db);
  const readinessStatus =
    scanComplete && !outstandingJobs ? ("ready" as const) : ("backfilling" as const);
  const batch = db.batch();
  batch.set(
    db.collection("incidentZoneSystem").doc("backfillCheckpoint"),
    {
      cursor: nextCursor,
      scanComplete,
      reportsScannedInLastBatch: reportSnapshot.size,
      updatedAt: toFirestoreTimestamp(now)
    },
    { merge: true }
  );
  batch.set(
    db.collection("incidentZoneSystem").doc("state"),
    {
      status: readinessStatus,
      algorithmVersion: INCIDENT_ZONE_ALGORITHM_VERSION,
      backfillCursor: nextCursor,
      lastErrorCode: null,
      updatedAt: Timestamp.fromMillis(now)
    },
    { merge: true }
  );
  await batch.commit();

  return {
    mode: "apply",
    projectId: options.guards.projectId,
    resumeCursor,
    nextCursor,
    scanComplete,
    reportsScanned: reportSnapshot.size,
    ...preview,
    jobsEnqueued,
    jobsProcessed,
    outstandingJobs,
    readinessStatus
  };
}
