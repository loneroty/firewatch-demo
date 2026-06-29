# TESTING.md

## Local Verification Commands

```bash
npm run lint
npm run typecheck
npm run test
npm run build
```

Rules tests can be run directly with:

```bash
npm run test:rules
```

Storage Rules tests can be run directly with:

```bash
npm run test:storage
```

Cloud Function report tests can be run directly with:

```bash
npm run test:functions
```

## Current Test Coverage

- Geohash encoding validation.
- Cross-report verification within 500m and 60 minutes.
- Same-user reports do not corroborate each other.
- Low reputation reports are throttled.
- Reputation score changes.
- Hourly report rate limit.
- Firestore reports are publicly readable but unauthenticated writes are blocked.
- Direct client report creates are blocked; real report creation must go through Cloud Function `createReport`.
- Storage Rules allow authenticated report image uploads only to `reportImages/{auth.uid}/{imageId}`.
- Storage Rules block unauthenticated uploads, uploads to another user's path, non-image uploads, over-limit files, and client deletes.
- Client writes cannot change verification/moderation fields on reports.
- Users cannot read or write other users' profile documents.
- Profile owners can update only public profile fields.
- Admin users can read/update admin-controlled user data.
- `users/{userId}/adminOnly/**` is readable/writable only by admins.
- Client writes to `admins` are blocked.
- Cloud Function report creation accepts valid authenticated payloads.
- Cloud Function rejects unauthenticated requests.
- Cloud Function rejects invalid lat/lng, category, severity, over-limit text/photo metadata, userId mismatch, and server-controlled fields.
- Cloud Function validates `gs://` report image URLs so the path must be `reportImages/{auth.uid}/{imageId}`.
- Cloud Function enforces 10 reports/hour per `auth.uid` using transaction-backed `rateLimits/{uid}/hours/{yyyyMMddHH}` buckets.
- Client backend payload helpers build Storage paths, `gs://` report payloads, callable response parsing, and user-facing backend error messages without including local-only image blobs or server-owned fields.

## Last Verified Run

- `npm.cmd run lint` passed.
- `npm.cmd run typecheck` passed.
- `npm.cmd run test` passed: 5 test suites, 27 tests.
- `npm.cmd audit` passed: 0 vulnerabilities.
- `npm.cmd run build` passed, compiled Cloud Functions, and generated the PWA service worker.
- Browser smoke test on `http://127.0.0.1:3000` returned HTTP 200 and rendered FireWatch, Local demo mode, report form, 3 report cards, Leaflet map tiles, and marker clustering.
- `npm.cmd run test:rules` passed: 1 test suite, 8 tests. Firebase CLI warned that the user was not authenticated, but the local emulator test completed successfully.
- `npm.cmd run test:functions` passed: 1 test suite, 9 tests. Firebase CLI warned that the user was not authenticated, and the Admin SDK emitted a metadata lookup warning while using the emulator, but the local emulator test completed successfully.
