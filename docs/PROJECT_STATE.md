# PROJECT_STATE.md

## Verified State

- Project root contains the FireWatch Phase 1 MVP scaffold.
- The app can run in Local demo mode without Firebase credentials.
- Firebase public config is read only from `NEXT_PUBLIC_FIREBASE_*` environment variables.
- Build uses Next.js 16 with webpack because `@ducanh2912/next-pwa` injects webpack configuration.
- Full dependency audit with `npm audit` reports 0 vulnerabilities.
- Phase 2 security baseline has been merged into `main`.
- Firestore Security Rules exist in `firestore.rules` and are covered by emulator-backed tests in `firestore.rules.test.ts`.
- Firebase emulator config exists in `firebase.json`; Firestore emulator runs on `127.0.0.1:8080`.
- Phase 2 report function work is on branch `feature/phase-2-report-functions`.
- Cloud Functions source now lives under `functions/`.
- `createReport` is the intended production path for new report creation. It uses `auth.uid` as the source of truth, requires App Check on the callable function, assigns `createdAt` server-side, rejects server-controlled fields, and enforces the hourly report rate limit with a Firestore transaction.
- Server-side hourly buckets are stored at `rateLimits/{uid}/hours/{yyyyMMddHH}`.

## Current Scope

- Phase 2 current slice: Cloud Functions report creation, server-side validation, transaction-backed rate limiting, and emulator tests.
- Full Line Login, Push Notification, Admin Dashboard UI, Remote Config, Sentry, and Firebase Performance Monitoring are still pending.

## Data Ownership Notes

- Firestore Security Rules protect direct client access, block direct client report creation, and prevent clients from setting verification, moderation, and admin-controlled fields.
- Cloud Functions use the Admin SDK, so functions must enforce report creation validation explicitly.
- Local demo UI still stores `createdAt` as an ISO string in localStorage. Firestore-backed reports created by Cloud Functions use Firestore `Timestamp`, matching `firestore.rules`.
