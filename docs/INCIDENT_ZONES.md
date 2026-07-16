# Server-Side Incident Zones

## Phase 18A.1 Boundary

Phase 18A.1 defines and tests the canonical incident-zone domain model. It does
not run in production yet. There is no report trigger, task worker, Firestore
adapter, apply-mode backfill, or client subscription to `incidentZones` in this
checkpoint. The existing client-derived `buildAlertZones` flow remains the
runtime source used by `FireWatchApp`.

The pure engine lives under `functions/src/incidentZones/` and has no Firestore
SDK dependency. Domain timestamps are epoch milliseconds. A future Phase 18A.2
adapter must convert those values to and from Firestore `Timestamp` values at
the persistence boundary.

## Canonical Collections

### `incidentZones/{zoneId}`

The canonical zone document contains:

- Identity: `id`, `anchorReportId`, `algorithmVersion`, `stateHash`, `version`
- Membership: sorted `reportIds`, `reportCount`
- Location: rounded `centerLat`, `centerLng`, `geohash`
- Categories: sorted `categories` and normalized `categoryCounts`
- Risk: `riskLevel`, `riskRank`, `riskScore`, `riskFactors`
- Evidence aggregate: `maxSeverity`, `averageSeverity`, `verifiedReportCount`,
  `latestReportAt`, `primaryAddressLabel`
- Lifecycle: `status` (`active`, `resolved`, or `hidden`), `nextEvaluationAt`,
  `createdAt`, `updatedAt`

Existing zones retain `createdAt`. `updatedAt` and `version` change only when
the semantic `stateHash` changes. A zone with no active members remains as a
`resolved` or `hidden` document instead of being deleted.

### Supporting documents

- `incidentZoneMemberships/{reportId}` maps a report to its current or previous
  zone and records whether membership is active.
- `incidentZoneAliases/{oldZoneId}` resolves a merged zone ID to its canonical
  ID.
- `incidentZoneJobs/{partitionKey}` defines the future dirty-partition job
  envelope, lease fields, generation, attempts, and safe error code. No worker
  is implemented in Phase 18A.1.

## Deterministic Recompute

The engine uses a 500 metre connected-component radius with explicit time
windows:

- `WATCH_WINDOW_MS`: 60 minutes, matching verification freshness.
- `ACTIVE_MEMBERSHIP_WINDOW_MS`: 180 minutes, matching risk aging.
- `STALE_WINDOW_MS`: 360 minutes, used to distinguish inactive from stale
  exclusions. Neither inactive nor stale reports can bridge active zones.

Each recomputation accepts `reports`, `previousZones`, and `now`. It sorts all
outputs deterministically and enforces these bounds:

- At most 1,000 candidate reports.
- At most 64 BFS expansion rounds per connected component.

Exceeding either bound returns `limit-exceeded` without a partial mutation plan.
Phase 18A.2 must supply already bounded, partition-local candidates; it must not
read the entire reports collection silently.

## Stable Identity

- A new zone normally uses `zone_<anchorReportId>`, where the anchor is the
  earliest report with a lexical ID tie-break.
- Adding or removing members does not rename an existing zone.
- A merge keeps the oldest previous zone (`createdAt`, then lexical ID) and
  emits aliases for losing IDs.
- A split lets the component with greatest membership overlap retain the old
  ID. Ties use anchor time, anchor ID, then component key.
- The stored anchor is lineage metadata. Hiding, rejecting, or removing the
  anchor report does not rename the zone.
- A deterministic suffix is used only if a new split component's normal anchor
  ID collides with a retained or historical zone ID.

## State Hash and Version

`stateHash` is SHA-256 over canonical JSON containing semantic fields only.
Arrays and category maps are normalized, report IDs are sorted, coordinates
are rounded to six decimal places, and object keys are recursively sorted.
`createdAt`, `updatedAt`, `version`, and Firestore object identity are excluded.

A no-op recomputation preserves `stateHash`, `version`, and `updatedAt`. A real
membership, aggregate, risk, lifecycle, algorithm, or reevaluation-state change
produces a new hash, increments `version`, and sets `updatedAt` to the supplied
`now`.

## Rules and Index

- Public and authenticated clients may read `active` and `resolved`
  `incidentZones`; `hidden` zones are not public.
- Aliases are publicly readable for future deep-link resolution.
- No client can write zones or aliases.
- Memberships and jobs have no client read/write access.
- Admin clients also have no direct write exception; future persistence uses
  the Admin SDK after server-side authorization.

The one composite index supports the future public query:

```text
incidentZones where status == "active"
  order by riskRank desc
  order by updatedAt desc
```

Automatic indexing is disabled for `incidentZones.reportIds` because the
planned query surface does not filter by the full membership array.

## Dry-Run Backfill

`planIncidentZoneBackfillDryRun` invokes the pure engine and returns counts only:
reports considered/excluded, zones created/merged/split, aliases,
memberships, and state changes. It has no apply mode, Firestore write, public
callable, or detailed report output. It does not expose `photoURL`, `notes`, or
`userId`.

## Intentional Client Parity Differences

The server fixtures preserve current 500 metre connected components and risk
aggregates for fresh reports, but intentionally differ from the client engine:

- The server excludes reports after the 180 minute active window; client zones
  currently include all eligible historical reports.
- Server IDs are stable lineage IDs; client IDs are rebuilt from all member IDs.
- The server persists category counts, geohash, lifecycle, state hash, and
  version metadata.
- Empty server zones become `resolved` or `hidden`; the client returns no zone.
- Server risk aging is driven by `nextEvaluationAt` boundaries so a future
  worker can recompute without new report writes.

These differences are migration inputs, not a client behavior change in
Phase 18A.1.

## Before Phase 18A.2

The next checkpoint still needs a bounded geohash/partition query adapter,
dirty-region trigger, idempotent worker writes, existing-alias resolution,
lease/retry behavior, a guarded apply backfill, and dual-mode client migration.
Production scale and hot-partition behavior remain unverified until those
pieces exist and emulator integration tests cover them.
