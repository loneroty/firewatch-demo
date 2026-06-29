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
- Phase 2 client report flow work is on branch `feature/phase-2-client-create-report`.
- Cloud Functions source now lives under `functions/`.
- `createReport` is the intended production path for new report creation. It uses `auth.uid` as the source of truth, requires App Check on the callable function, assigns `createdAt` server-side, rejects server-controlled fields, validates `gs://` report image paths against `reportImages/{auth.uid}/...`, and enforces the hourly report rate limit with a Firestore transaction.
- Server-side hourly buckets are stored at `rateLimits/{uid}/hours/{yyyyMMddHH}`.
- Storage Rules exist in `storage.rules`. Users can create report images only under `reportImages/{auth.uid}/{imageId}` with `image/*` content type and a 500KB limit; unauthenticated uploads, other-user paths, updates, and deletes are blocked.
- Firebase backend client flow uploads compressed report images to Storage first, sends only the resulting `gs://` path to callable `createReport`, and keeps the returned report visible in the current map/list state.

## Current Scope

- Phase 2 current slice: client report creation through Firebase Auth/App Check/Storage/callable Function, server-side validation, transaction-backed rate limiting, and emulator-backed rules/function tests.
- Full Line Login, Push Notification, Admin Dashboard UI, Remote Config, Sentry, and Firebase Performance Monitoring are still pending.

## Data Ownership Notes

- Firestore Security Rules protect direct client access, block direct client report creation, and prevent clients from setting verification, moderation, and admin-controlled fields.
- Storage Rules protect report image upload paths and file metadata before the callable Function accepts a `gs://` path.
- Cloud Functions use the Admin SDK, so functions must enforce report creation validation explicitly.
- Local demo mode stores reports in localStorage with compressed data URLs and ISO string `createdAt`.
- Firebase backend mode stores reports through Cloud Functions with Firestore `Timestamp` `createdAt`; the client uses a local data URL only as an in-session preview after the backend returns the report id. Backend mode does not write `reports` directly.
- The callable validator still allows `https://` photo URLs for future/special ingest paths, but the current browser backend mode uses `gs://` Storage paths only.
