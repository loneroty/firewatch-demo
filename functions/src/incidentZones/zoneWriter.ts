import type {
  DocumentData,
  DocumentSnapshot,
  Firestore
} from "firebase-admin/firestore";
import { assertAliasWritesSafe } from "./aliasResolver";
import {
  incidentZoneStateFromFirestore,
  incidentZoneStateToFirestore,
  toEpochMilliseconds,
  toFirestoreTimestamp
} from "./firestoreAdapter";
import {
  incidentZoneJobFromFirestore,
  incidentZoneJobToFirestore
} from "./jobAdapter";
import { IncidentZoneRuntimeError } from "./runtimeError";
import type { IncidentZoneLease } from "./runtimeTypes";
import type {
  IncidentZoneMembership,
  IncidentZoneRecomputationPlan,
  IncidentZoneState
} from "./types";

export const MAX_INCIDENT_ZONE_TRANSACTION_WRITES = 450;

export type IncidentZoneWriteResult =
  | { status: "written"; writes: number }
  | { status: "stale-generation" }
  | { status: "lease-lost" };

interface ExistingMembership {
  canonicalZoneId: string | null;
  status: "active" | "inactive";
  assignedAt: number | null;
  algorithmVersion: string | null;
}

function readExistingMembership(value: unknown): ExistingMembership {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return {
      canonicalZoneId: null,
      status: "inactive",
      assignedAt: null,
      algorithmVersion: null
    };
  }

  const record = value as Record<string, unknown>;
  const canonicalZoneId =
    typeof record.canonicalZoneId === "string"
      ? record.canonicalZoneId
      : typeof record.zoneId === "string"
        ? record.zoneId
        : null;
  return {
    canonicalZoneId,
    status: record.status === "active" ? "active" : "inactive",
    assignedAt: toEpochMilliseconds(record.assignedAt),
    algorithmVersion:
      typeof record.algorithmVersion === "string"
        ? record.algorithmVersion
        : null
  };
}

function membershipNeedsWrite(
  existing: ExistingMembership,
  desired: IncidentZoneMembership
): boolean {
  return (
    existing.canonicalZoneId !== desired.zoneId ||
    existing.status !== desired.status ||
    existing.algorithmVersion !== desired.algorithmVersion
  );
}

function assertZoneCompareAndSet(
  snapshot: DocumentSnapshot<DocumentData>,
  expected: IncidentZoneState
): void {
  if (!snapshot.exists) {
    throw new IncidentZoneRuntimeError(
      "concurrent-state-change",
      "An affected incident zone disappeared before the write transaction."
    );
  }

  const current = incidentZoneStateFromFirestore(snapshot.id, snapshot.data());
  if (current === null) {
    throw new IncidentZoneRuntimeError(
      "malformed-zone-state",
      "An affected incident zone contains malformed canonical state."
    );
  }
  if (current.stateHash !== expected.stateHash) {
    throw new IncidentZoneRuntimeError(
      "concurrent-state-change",
      "An affected incident zone changed during recomputation."
    );
  }
}

export async function writeIncidentZonePlan(
  db: Firestore,
  lease: IncidentZoneLease,
  plan: IncidentZoneRecomputationPlan,
  previousZones: readonly IncidentZoneState[],
  now: number
): Promise<IncidentZoneWriteResult> {
  const maximumPossibleWrites =
    plan.zoneUpserts.length +
    plan.memberships.length +
    plan.aliases.length +
    1;
  if (maximumPossibleWrites > MAX_INCIDENT_ZONE_TRANSACTION_WRITES) {
    throw new IncidentZoneRuntimeError(
      "write-limit-exceeded",
      "The canonical write plan exceeds the bounded transaction limit."
    );
  }

  const jobRef = db.collection("incidentZoneJobs").doc(lease.partitionKey);
  const previousZoneIds = new Set(previousZones.map((zone) => zone.id));
  const zoneIdsToRead = [
    ...new Set([
      ...previousZones.map((zone) => zone.id),
      ...plan.zoneUpserts.map((zone) => zone.id)
    ])
  ].sort();

  return db.runTransaction(async (transaction) => {
    const jobSnapshot = await transaction.get(jobRef);
    const currentJob = jobSnapshot.exists
      ? incidentZoneJobFromFirestore(lease.partitionKey, jobSnapshot.data())
      : null;
    if (
      currentJob === null ||
      currentJob.status !== "leased" ||
      currentJob.leaseOwner !== lease.leaseOwner
    ) {
      return { status: "lease-lost" as const };
    }
    if (currentJob.generation !== lease.generation) {
      transaction.set(
        jobRef,
        incidentZoneJobToFirestore({
          ...currentJob,
          status: "pending",
          leaseOwner: null,
          leaseExpiresAt: null,
          nextAttemptAt: null,
          updatedAt: Math.trunc(now)
        })
      );
      return { status: "stale-generation" as const };
    }

    const zoneSnapshots = await Promise.all(
      zoneIdsToRead.map((zoneId) =>
        transaction.get(db.collection("incidentZones").doc(zoneId))
      )
    );
    const zoneSnapshotById = new Map(
      zoneSnapshots.map((snapshot) => [snapshot.id, snapshot] as const)
    );
    previousZones.forEach((expected) => {
      const snapshot = zoneSnapshotById.get(expected.id);
      if (snapshot === undefined) {
        throw new IncidentZoneRuntimeError(
          "concurrent-state-change",
          "An affected incident zone was not loaded for compare-and-set."
        );
      }
      assertZoneCompareAndSet(snapshot, expected);
    });

    const equivalentConcurrentZoneIds = new Set<string>();
    plan.zoneUpserts.forEach((desired) => {
      if (previousZoneIds.has(desired.id)) {
        return;
      }

      const snapshot = zoneSnapshotById.get(desired.id);
      if (snapshot === undefined || !snapshot.exists) {
        return;
      }
      const current = incidentZoneStateFromFirestore(
        snapshot.id,
        snapshot.data()
      );
      if (current === null) {
        throw new IncidentZoneRuntimeError(
          "malformed-zone-state",
          "A concurrently created incident zone contains malformed state."
        );
      }
      if (current.stateHash !== desired.stateHash) {
        throw new IncidentZoneRuntimeError(
          "concurrent-state-change",
          "A canonical incident zone was concurrently created with different state."
        );
      }
      equivalentConcurrentZoneIds.add(desired.id);
    });

    const membershipSnapshots = await Promise.all(
      plan.memberships.map((membership) =>
        transaction.get(
          db.collection("incidentZoneMemberships").doc(membership.reportId)
        )
      )
    );
    const existingMemberships = new Map<string, ExistingMembership>();
    membershipSnapshots.forEach((snapshot) => {
      existingMemberships.set(
        snapshot.id,
        readExistingMembership(snapshot.exists ? snapshot.data() : null)
      );
    });

    plan.memberships.forEach((membership) => {
      const existing = existingMemberships.get(membership.reportId);
      if (
        existing?.status === "active" &&
        existing.canonicalZoneId !== null &&
        existing.canonicalZoneId !== membership.zoneId &&
        !previousZoneIds.has(existing.canonicalZoneId)
      ) {
        throw new IncidentZoneRuntimeError(
          "membership-conflict",
          "A report already belongs to a different active canonical zone."
        );
      }
    });

    const existingAliasTargets = await assertAliasWritesSafe(
      db,
      transaction,
      plan.aliases
    );

    let writes = 0;
    plan.zoneUpserts.forEach((zone) => {
      if (equivalentConcurrentZoneIds.has(zone.id)) {
        return;
      }
      transaction.set(
        db.collection("incidentZones").doc(zone.id),
        incidentZoneStateToFirestore(zone)
      );
      writes += 1;
    });

    plan.memberships.forEach((membership) => {
      const existing = existingMemberships.get(membership.reportId) ??
        readExistingMembership(null);
      if (!membershipNeedsWrite(existing, membership)) {
        return;
      }

      transaction.set(
        db.collection("incidentZoneMemberships").doc(membership.reportId),
        {
          reportId: membership.reportId,
          canonicalZoneId: membership.zoneId,
          status: membership.status,
          algorithmVersion: membership.algorithmVersion,
          assignedAt:
            existing.canonicalZoneId === membership.zoneId &&
            existing.assignedAt !== null
              ? toFirestoreTimestamp(existing.assignedAt)
              : toFirestoreTimestamp(now),
          updatedAt: toFirestoreTimestamp(now)
        }
      );
      writes += 1;
    });

    plan.aliases.forEach((alias) => {
      if (existingAliasTargets.get(alias.oldZoneId) === alias.canonicalZoneId) {
        return;
      }

      transaction.set(
        db.collection("incidentZoneAliases").doc(alias.oldZoneId),
        {
          oldZoneId: alias.oldZoneId,
          canonicalZoneId: alias.canonicalZoneId,
          reason: "merge",
          algorithmVersion: alias.algorithmVersion,
          createdAt: toFirestoreTimestamp(alias.createdAt),
          updatedAt: toFirestoreTimestamp(now)
        }
      );
      writes += 1;
    });

    transaction.set(
      jobRef,
      incidentZoneJobToFirestore({
        ...currentJob,
        status: "completed",
        leaseOwner: null,
        leaseExpiresAt: null,
        nextAttemptAt: null,
        lastErrorCode: null,
        updatedAt: Math.trunc(now)
      })
    );
    writes += 1;

    return { status: "written" as const, writes };
  });
}
