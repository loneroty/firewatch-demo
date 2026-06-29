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

## Current Test Coverage

- Geohash encoding validation.
- Cross-report verification within 500m and 60 minutes.
- Same-user reports do not corroborate each other.
- Low reputation reports are throttled.
- Reputation score changes.
- Hourly report rate limit.
- Firestore reports are publicly readable but unauthenticated writes are blocked.
- Authenticated users can create only reports whose `userId` matches `auth.uid`.
- Client writes cannot change verification/moderation fields on reports.
- Users cannot read or write other users' profile documents.
- Profile owners can update only public profile fields.
- Admin users can read/update admin-controlled user data.
- `users/{userId}/adminOnly/**` is readable/writable only by admins.
- Client writes to `admins` are blocked.

## Last Verified Run

- `npm.cmd run lint` passed.
- `npm.cmd run typecheck` passed.
- `npm.cmd run test` passed: 3 test suites, 10 tests.
- `npm.cmd audit` passed: 0 vulnerabilities.
- `npm.cmd run build` passed and generated the PWA service worker.
- Browser smoke test on `http://127.0.0.1:3000` returned HTTP 200 and rendered FireWatch, Local demo mode, report form, 3 report cards, Leaflet map tiles, and marker clustering.
- `npm.cmd run test:rules` passed: 1 test suite, 8 tests. Firebase CLI warned that the user was not authenticated, but the local emulator test completed successfully.
