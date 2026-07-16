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
- Phase 19 Incident Replay work is on branch `feature/phase-19-incident-replay-command-center`.
- Cloud Functions source now lives under `functions/`.
- `createReport` is the intended production path for new report creation. It uses `auth.uid` as the source of truth, requires App Check on the callable function, assigns `createdAt` server-side, rejects server-controlled fields, validates `gs://` report image paths against `reportImages/{auth.uid}/...`, and enforces the hourly report rate limit with a Firestore transaction.
- Server-side hourly buckets are stored at `rateLimits/{uid}/hours/{yyyyMMddHH}`.
- Storage Rules exist in `storage.rules`. Users can create report images only under `reportImages/{auth.uid}/{imageId}` with `image/*` content type and a 500KB limit; unauthenticated uploads, other-user paths, updates, and deletes are blocked.
- Firebase backend client flow uploads compressed report images to Storage first, sends only the resulting `gs://` path to callable `createReport`, and loads shared reports through Firestore realtime subscription.
- Callable `confirmReport` confirms a target report by requiring `targetReportId` plus a user-owned `confirmingReportId` within 500m/60 minutes. It rejects self-confirmation, duplicate confirmation, hidden/rejected targets, and confirming reports not owned by `auth.uid`, then updates `confirmedByReportIds` and `verificationStatus` in a Firestore transaction.
- The main app UI includes an Incident Replay command panel above the existing live map. Replay derives timestamped snapshots, Alert Zones, risk aging, metrics, change summaries, and heat points entirely from the reports already loaded by the client.
- Replay supports 1/3/6/12/24-hour and all-history windows, aggregate timeline buckets capped at 60, play/pause/reset, 1x/2x/4x speeds, and validated `mode=replay`, `at`, and `window` query parameters.
- The map heat layer uses Leaflet Canvas circle markers in an independent non-interactive layer. It does not replace report marker clustering, Alert Zone circles, plume polygons, popups, or zoom controls.

## Current Scope

- Phase 19 current slice: client-side Incident Replay and heatmap visualization. No Cloud Functions, Firestore/Storage Rules, collections, report schema, callable flows, deployment, or server-zone merge work is in scope.
- Full Line Login, Push Notification, Admin Dashboard UI, Remote Config, Sentry, and Firebase Performance Monitoring are still pending.

## Data Ownership Notes

- Firestore Security Rules protect direct client access, block direct client report creation, and prevent clients from setting verification, moderation, and admin-controlled fields.
- Storage Rules protect report image upload paths and file metadata before the callable Function accepts a `gs://` path.
- Cloud Functions use the Admin SDK, so functions must enforce report creation validation explicitly.
- Local demo mode stores reports in localStorage with compressed data URLs and ISO string `createdAt`. It is single-browser/local-only and does not share data across machines.
- Firebase backend mode stores reports through Cloud Functions with Firestore `Timestamp` `createdAt`; the client subscribes to Firestore `reports` with `onSnapshot`, maps `Timestamp` to ISO strings for the UI, and resolves `gs://` image paths through Storage download URLs. Backend mode does not write `reports` directly.
- Firebase backend confirmation uses callable `confirmReport` only. Clients do not write `confirmedByReportIds` or `verificationStatus` directly; Firestore Rules continue to block direct client edits to these fields.
- The callable validator still allows `https://` photo URLs for future/special ingest paths, but the current browser backend mode uses `gs://` Storage paths only.
- Both runtime modes feed the same pure replay pipeline after reports reach the client. Local demo timestamps and mapped Firestore timestamps are ISO strings; malformed timestamps and invalid coordinates are excluded from Replay without changing stored data.
- Replay deep links are read safely from `?mode=replay&at=<ISO-or-epoch>&window=<window>`. Invalid values fall back to the default window/end cursor, and existing `?zone=`/`?report=` parameters remain untouched.
- Replay is decision-support visualization of community reports, not an official emergency simulation or forecast. Some periods may be incomplete because coverage depends on reports received by the system.

## Demo Readiness Notes

- Local demo mode is the safest fallback for a live demo because it needs no Firebase env, Auth, App Check, Storage, Functions, or emulator.
- Firebase backend mode requires public Firebase env values, Anonymous Auth enabled, App Check configured for the demo domain, Firestore/Storage Rules deployed after tests, and callable `createReport`/`confirmReport` deployed in `asia-southeast1`.
- Generated files and logs observed locally are ignored by Git: `.next/`, `public/sw.js`, `public/workbox-*.js`, `functions/lib/`, `firestore-debug.log`, `.next-dev*.log`, and `tsconfig.tsbuildinfo`.
- Manual smoke test coverage for demo day lives in `docs/TESTING.md`.
- Presentation package lives in `docs/DEMO_SCRIPT.md`, `docs/JUDGING_NOTES.md`, and `docs/DEMO_CHECKLIST.md`.
