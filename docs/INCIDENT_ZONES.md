# Server-Side Incident Zones

## Phase 18A.2 Boundary

Phase 18A.2 adds a server runtime around the Phase 18A.1 pure canonical engine.
The pure modules (`domain.ts`, `stableIdentity.ts`, and `stateHash.ts`) still do
not import Firebase or Firestore. Runtime adapters convert Firestore values at
the boundary and call `buildCanonicalIncidentZones` with plain epoch
milliseconds and domain objects.

This code has not been deployed. Existing report callables are unchanged, and
Local demo mode still uses client-derived `buildAlertZones`.

## Runtime Flow

1. `onIncidentZoneReportWritten` receives `reports/{reportId}` create, update,
   or delete events.
2. A pure change detector compares only intelligence fields. A
   `flaggedCount`-only update does not enqueue work.
3. The trigger marks old and new 5-character geohash neighborhoods dirty. A
   transaction coalesces rapid changes into one job per partition by
   incrementing `generation`.
4. `onIncidentZoneJobWritten` acquires a two-minute transaction lease and
   loads a bounded connected region.
5. Candidate queries use geohash prefix bounds plus the 180-minute active
   cutoff. Haversine distance is the final 500m membership check.
6. The worker invokes the pure canonical engine, chooses one deterministic
   owner partition, and commits zones, memberships, aliases, and job completion
   in one transaction.
7. `maintainIncidentZones` runs every ten minutes. It enqueues zones whose
   `nextEvaluationAt` is due and resets bounded expired/failed jobs. It does not
   scan an entire collection.

## Bounds and Failure Behavior

- Coarse partition: geohash precision 5, with a deterministic 3x3 initial
  neighborhood.
- Active report query window: 180 minutes.
- Candidate reports: at most 1,000.
- Connected partitions: at most 64.
- Pure BFS rounds: at most 64.
- Worker attempts: at most 5 per generation, with bounded exponential delay.
- Canonical transaction: at most 450 planned writes, leaving headroom below
  Firestore's transaction write limit.

Any cap failure marks the job failed with a bounded retry schedule. After five
attempts in one generation it remains failed with no automatic next attempt;
a newer report change creates a new generation and retry budget. The writer is
not called, so no partial canonical state is written.

## Collections

### `incidentZones/{zoneId}`

Stores stable identity, sorted report membership, aggregate location/category/
risk evidence, lifecycle status, `stateHash`, `version`, and
`nextEvaluationAt`. Empty zones become `resolved` or `hidden`; documents are
never deleted by this runtime.

### `incidentZoneMemberships/{reportId}`

Server-only ownership record:

- `reportId`
- `canonicalZoneId`
- `status` (`active` or `inactive`)
- `algorithmVersion`
- `assignedAt`
- `updatedAt`

One document per report prevents two simultaneous active canonical memberships.

### `incidentZoneAliases/{oldZoneId}`

Publicly readable deep-link redirect with `canonicalZoneId`, reason (`merge`
or future `migration`), algorithm version, and timestamps. Writes reject
self-links, retargeting, excessive chains, and loops.

### `incidentZoneJobs/{partitionKey}`

Server-only work envelope containing bounded dirty centers/report IDs,
`generation`, lease owner/expiry, attempts, retry time, and a non-sensitive
error code. Rapid writes update this document instead of creating unbounded
tasks.

### `incidentZoneSystem/state`

Client-readable readiness metadata. Supported status values are `not-ready`
(including a missing document), `backfilling`, `ready`, and `error`. The client
uses server zones only when status is `ready`; a ready collection with zero
zones is treated as a valid empty result.

`incidentZoneSystem/backfillCheckpoint` is server-only.

## Idempotency and Concurrency

- A lease is acquired in a transaction and records the current generation.
- A newer report event can increment generation while the lease is active.
- The writer checks generation again before any canonical write. A stale worker
  returns the job to `pending` without zone changes.
- The lexical owner of report/previous-zone partitions performs the write;
  overlapping jobs forward to that owner.
- Existing zone hashes are read and compared in the write transaction.
- Membership records are read before update. An active membership owned by an
  unrelated zone produces a conflict instead of being overwritten.
- An unchanged state hash means no zone upsert, version bump, or `updatedAt`
  change.
- Existing aliases may be written again only with the same canonical target.

## Risk Aging

The pure engine sets `nextEvaluationAt` at the 60-minute and 180-minute
boundaries. The scheduled maintenance query enqueues due active zones in
batches of 20. The worker recomputes from server timestamps, so client clocks
cannot change canonical risk. At 180 minutes, reports leave active membership
and an empty zone is preserved as resolved/hidden.

## Safe Backfill

`functions/scripts/backfillIncidentZones.ts` compiles through
`functions/tsconfig.scripts.json` and runs with:

```powershell
npm.cmd run zones:backfill
```

The default is always dry-run and performs no writes. Dry-run scans a bounded
batch, validates adapters, builds a comparison preview, and reports aggregate
counts without logging photo URLs, notes, or user IDs.

Apply mode is rejected unless all of these are explicitly supplied at runtime:

- `FIREWATCH_ZONE_BACKFILL_APPLY` enabled
- current project included in `FIREWATCH_ZONE_BACKFILL_ALLOWED_PROJECTS`
- `FIREWATCH_ZONE_BACKFILL_CONFIRMATION` exactly
  `APPLY_INCIDENT_ZONES`

Batch size is capped at 50; worker processing is capped at 64 jobs per run. A
server-only checkpoint stores the report cursor. Interrupted runs resume from
that cursor, and repeated runs use the same idempotent worker path. No apply
value is committed to an environment example.

## Client Migration

- Local demo: always client-derived zones from local reports.
- Firebase backend with readiness `ready`: realtime canonical server zones.
- Firebase backend while loading/backfilling or on stream error: client-derived
  fallback with an explicit source label.
- Firebase backend with readiness `ready` and zero zones: server source with an
  empty result, not fallback.

Active server zones feed the existing map and intelligence panel. A resolved
zone opened through a deep link can populate the selected incident workspace,
but is not reintroduced as an active map overlay.

Deep links first read `incidentZones/{id}`, then follow public aliases for at
most eight hops. Missing, hidden/unreadable, malformed, looping, and excessive
chains return a graceful unavailable state.

## Query to Index Mapping

| Runtime query | Composite index |
| --- | --- |
| Active client zones ordered by risk/update | `incidentZones: status ASC, riskRank DESC, updatedAt DESC` |
| Due risk reevaluation | `incidentZones: status ASC, nextEvaluationAt ASC` |
| Candidate reports by geohash and active cutoff | `reports: geohash ASC, createdAt ASC` |
| Expired leases | `incidentZoneJobs: status ASC, leaseExpiresAt ASC` |
| Due failed jobs | `incidentZoneJobs: status ASC, nextAttemptAt ASC` |
| Bounded backfill pending jobs | `incidentZoneJobs: status ASC, updatedAt ASC` |

Automatic indexing remains disabled for `incidentZones.reportIds` because no
runtime query filters by the full array.

## Rollout Gate

Do not deploy the report trigger, worker, or scheduler before completing a
backfill dry-run and reviewing parity against client-derived zones. Follow
`docs/INCIDENT_ZONES_RUNBOOK.md`. Phase 18A.2 does not include FCM, Web Push,
VAPID, subscriptions, push devices, or a notification outbox.
