# Incident Zones Runtime Runbook

## Hard Gate

Do not deploy the Phase 18A.2 worker before a dry-run and parity review. This
repository change does not authorize deployment or production backfill.

## Preflight

1. Confirm the target Firebase project explicitly. Never rely on an ambiguous
   CLI default project.
2. Run `npm.cmd run lint`, `npm.cmd run typecheck`, `npm.cmd run test`,
   `npm.cmd run build`, and `npm.cmd audit`.
3. Review `firestore.rules` and all six query/index mappings in
   `docs/INCIDENT_ZONES.md`.
4. Confirm `incidentZoneSystem/state` is absent or not `ready`, so clients keep
   using the client fallback during preparation.
5. Verify no secrets, credentials, or apply-enabled environment examples are
   present in Git.

## Dry-Run

Set an explicit project ID through the operator environment, then run:

```powershell
npm.cmd run zones:backfill
```

Without every apply guard this command remains read-only. Review:

- reports scanned, eligible, excluded, and malformed
- zones planned/created/updated/resolved
- memberships and aliases planned
- unchanged zones and limit errors
- the resume and next cursors

Dry-run is batch-local planning; use several representative cursors/datasets
and compare results with the current client-derived UI before approving apply.

## Apply Safety

Apply requires all three controls at execution time:

1. explicit apply enablement
2. target project present in an operator-supplied allowlist
3. exact typed confirmation `APPLY_INCIDENT_ZONES`

Keep the report batch at or below 50 and the job batch at or below 64. The
script writes only dirty jobs/readiness/checkpoint data directly; canonical
zones go through the same lease worker and transaction writer used at runtime.
Re-run after interruption to resume from
`incidentZoneSystem/backfillCheckpoint`.

## Rollout Order

1. Validate rules and indexes with emulators.
2. Dry-run against a non-production project and review parity.
3. Run guarded apply in the non-production project until readiness is `ready`
   and no pending/leased/failed jobs remain.
4. Smoke-test server ready with zones, server ready with zero zones, alias deep
   links, and stream-error fallback.
5. Only after review, plan a separate authorized deploy window for indexes,
   rules, triggers, worker, and scheduler.

## Monitoring

Monitor aggregate fields only; do not log report notes, photo URLs, or user IDs.

- `incidentZoneSystem/state.status`, `updatedAt`, `lastErrorCode`
- job `status`, `generation`, `attempts`, `leaseExpiresAt`, `nextAttemptAt`,
  `lastErrorCode`
- counts of malformed adapter records and cap failures
- worker outcomes: completed, forwarded, stale generation, lease lost, failed
- active/resolved/hidden zone counts and version churn

Investigate jobs repeatedly failing with `candidate-limit-exceeded`,
`connected-partition-limit-exceeded`, `write-limit-exceeded`,
`membership-conflict`, or `concurrent-state-change` before retrying broadly.

## Stuck Job Recovery

- The ten-minute scheduler resets at most 50 expired leases and 50 due failed
  jobs per run.
- One generation gets at most five worker attempts. A terminal failed job has
  no `nextAttemptAt`; investigate it instead of repeatedly forcing retries.
- Confirm the lease really expired before manual intervention.
- Do not edit canonical zones or memberships from the client.
- Do not mark a job completed manually if its generation changed.
- If a region repeatedly exceeds a cap, leave it failed and investigate data
  density; do not raise limits during an incident without review.

## Rollback

1. Set readiness to an operator-controlled non-ready/error state through an
   authorized Admin SDK procedure. Clients then use client-derived fallback.
2. Disable the runtime functions in an authorized deployment rollback. Do not
   delete zone or alias documents.
3. Preserve jobs, memberships, aliases, and checkpoints for investigation.
4. Revert code/functions to the previous known-good deployment.
5. Re-run dry-run/parity checks before resuming.

Existing `createReport`, `confirmReport`, `flagReport`, and `moderateReport`
callables are independent and must not be rolled back or modified as part of a
zone-only recovery unless a separate incident requires it.

## Known Limits

- Geohash precision 5 is correctness-first, not optimized for very dense urban
  hot partitions.
- Candidate reports cap at 1,000, connected partitions/BFS at 64, and
  transaction writes at 450; worker retries cap at five per generation.
- Backfill readiness becomes `ready` only after the scan is complete and no
  pending, leased, or failed job remains.
- Resolved deep links are reference-only and do not create active overlays.
- No Phase 18B notifications, FCM, push permission, VAPID, device collection,
  subscription collection, or outbox exists in this runtime.
