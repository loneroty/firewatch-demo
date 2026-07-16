# PROJECT_STATE.md

## Verified State

- Project root contains the FireWatch Phase 1 MVP scaffold.
- The app can run in Local demo mode without Firebase credentials.
- Firebase public config is read only from `NEXT_PUBLIC_FIREBASE_*` environment variables. App Check uses optional public `NEXT_PUBLIC_FIREBASE_APPCHECK_SITE_KEY`.
- Build uses Next.js 16 with webpack because `@ducanh2912/next-pwa` injects webpack configuration.
- Full dependency audit with `npm audit` reports 0 vulnerabilities.
- Phase 2 security baseline has been merged into `main`.
- Firestore Security Rules exist in `firestore.rules` and are covered by emulator-backed tests in `firestore.rules.test.ts`.
- Firebase emulator config exists in `firebase.json`; Firestore runs on `127.0.0.1:8080`, Functions on `127.0.0.1:5001`, Storage on `127.0.0.1:9199`, and Auth on `127.0.0.1:9099`.
- Phase 6 polished web UI work is on branch `feature/phase-6-polished-web-ui`.
- Cloud Functions source now lives under `functions/`.
- `createReport` is the intended production path for new report creation. It uses `auth.uid` as the source of truth, requires App Check on the callable function, assigns `createdAt` server-side, rejects server-controlled fields, validates `gs://` report image paths against `reportImages/{auth.uid}/...`, and enforces the hourly report rate limit with a Firestore transaction.
- Server-side hourly buckets are stored at `rateLimits/{uid}/hours/{yyyyMMddHH}`.
- Storage Rules exist in `storage.rules`. Users can create report images only under `reportImages/{auth.uid}/{imageId}` with `image/*` content type and a 500KB limit; unauthenticated uploads, other-user paths, updates, and deletes are blocked.
- Firebase backend client flow uploads compressed report images to Storage first, sends only the resulting `gs://` path to callable `createReport`, and loads shared reports through Firestore realtime subscription.
- Callable `confirmReport` confirms a target report by requiring `targetReportId` plus a user-owned `confirmingReportId` within 500m/60 minutes. It rejects self-confirmation, duplicate confirmation, hidden/rejected targets, and confirming reports not owned by `auth.uid`, then updates `confirmedByReportIds` and `verificationStatus` in a Firestore transaction.
- The main app UI is now organized as a polished multi-section civic-tech web app: hero, situation summary, live map, report form, latest reports, how-it-works, trust/security, and demo mode notes. This is a presentation/layout change; backend data flow remains unchanged.

## Current Scope

- Phase 18A.2 adds the server incident-zone runtime in source only: Firestore adapters, relevant-change detection, coalesced dirty jobs, bounded candidate loading, lease worker, transactional canonical writer, risk-aging scheduler, guarded backfill CLI, and dual-mode client migration.
- The Phase 18A.2 runtime has not been deployed and no production backfill has been run. Deployment remains blocked on dry-run/parity review and explicit authorization.
- Local demo always uses client-derived `buildAlertZones`. Firebase backend uses canonical realtime zones only after `incidentZoneSystem/state.status == "ready"`; loading/backfill/error states retain the client fallback. Ready with zero zones is an authoritative empty server result.
- Existing report creation, confirmation, flagging, and moderation behavior is unchanged.
- Full Line Login, Push Notification, Admin Dashboard UI, Remote Config, Sentry, and Firebase Performance Monitoring are still pending.

## Phase 18A Incident Zones

- Pure modules under `functions/src/incidentZones/` accept reports, previous zones, and an explicit epoch-millisecond `now`; they do not import the Firestore SDK.
- Canonical clustering uses a 500m radius, a 60-minute watch window, a 180-minute active-membership window, and a 360-minute stale classification window.
- Recomputations are bounded to 1,000 candidates and 64 BFS expansion rounds per component. Limit failures return explicitly without a partial write plan.
- Stable IDs preserve the oldest zone through merges, preserve the greatest-overlap component through splits, and never rename a zone merely because its anchor report is hidden or rejected.
- Canonical SHA-256 state hashes exclude lifecycle write metadata. `version` and `updatedAt` move only when semantic state changes.
- Dry-run backfill planning returns aggregate counts only and has no apply mode or database side effects.
- Firestore Rules expose only `active`/`resolved` zones and aliases to clients. Zone/alias writes and all membership/job access remain server-only.
- Runtime report writes enqueue deterministic geohash-5 neighborhoods from both old and new coordinates. Jobs coalesce through transaction-backed generation counters and bounded dirty arrays.
- Workers query only the 180-minute geohash window, apply Haversine filtering, cap candidates at 1,000 and connected partitions/BFS at 64, then write no more than 450 canonical mutations in one transaction.
- Writer safety includes deterministic owner partitions, lease/generation checks, stateHash compare-and-set, one membership document per report, and bounded alias-loop checks. Zones are resolved/hidden rather than deleted.
- Scheduled maintenance queries `nextEvaluationAt` in batches and resets bounded expired/failed jobs; canonical aging never depends on a client clock.
- `functions/scripts/backfillIncidentZones.ts` is dry-run by default. Apply requires explicit enablement, project allowlist, exact typed confirmation, bounded batches, and a server-only resume checkpoint.
- Detailed schema, query/index mapping, rollout gate, and operational risks are recorded in `docs/INCIDENT_ZONES.md` and `docs/INCIDENT_ZONES_RUNBOOK.md`.

## Data Ownership Notes

- Firestore Security Rules protect direct client access, block direct client report creation, and prevent clients from setting verification, moderation, and admin-controlled fields.
- Storage Rules protect report image upload paths and file metadata before the callable Function accepts a `gs://` path.
- Cloud Functions use the Admin SDK, so functions must enforce report creation validation explicitly.
- Local demo mode stores reports in localStorage with compressed data URLs and ISO string `createdAt`. It is single-browser/local-only and does not share data across machines.
- Firebase backend mode stores reports through Cloud Functions with Firestore `Timestamp` `createdAt`; the client subscribes to Firestore `reports` with `onSnapshot`, maps `Timestamp` to ISO strings for the UI, and resolves `gs://` image paths through Storage download URLs. Backend mode does not write `reports` directly.
- Firebase backend incident-zone reads are subscription-only. Clients can read visible canonical zones, aliases, and readiness state but cannot write zones, memberships, aliases, jobs, or system metadata.
- Firebase backend confirmation uses callable `confirmReport` only. Clients do not write `confirmedByReportIds` or `verificationStatus` directly; Firestore Rules continue to block direct client edits to these fields.
- The callable validator still allows `https://` photo URLs for future/special ingest paths, but the current browser backend mode uses `gs://` Storage paths only.

## Demo Readiness Notes

- Local demo mode is the safest fallback for a live demo because it needs no Firebase env, Auth, App Check, Storage, Functions, or emulator.
- Firebase backend mode requires public Firebase env values, Anonymous Auth enabled, App Check configured for the demo domain, Firestore/Storage Rules deployed after tests, and callable `createReport`/`confirmReport` deployed in `asia-southeast1`.
- Generated files and logs observed locally are ignored by Git: `.next/`, `public/sw.js`, `public/workbox-*.js`, `functions/lib/`, `functions/lib-scripts/`, `firestore-debug.log`, `.next-dev*.log`, and `tsconfig.tsbuildinfo`.
- Manual smoke test coverage for demo day lives in `docs/TESTING.md`.
- Presentation package lives in `docs/DEMO_SCRIPT.md`, `docs/JUDGING_NOTES.md`, and `docs/DEMO_CHECKLIST.md`.
