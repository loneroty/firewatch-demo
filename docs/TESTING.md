# TESTING.md

## Local Verification Commands

```bash
npm run lint
npm run typecheck
npm run test
npm run build
npm audit
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

The guarded incident-zone backfill tool compiles during `npm run build`. Its
default read-only mode is:

```bash
npm run zones:backfill
```

Always use an explicit non-production project for manual backfill tests. Apply
mode requires the three guards documented in `docs/INCIDENT_ZONES_RUNBOOK.md`.

## Manual Smoke Test Checklist

### Local demo mode

- Start with no `.env.local` Firebase values or with incomplete Firebase public env.
- Run `npm.cmd run dev` and open `http://localhost:3000`.
- Confirm the header shows `Local demo`.
- Submit a report with valid lat/lng, category, severity, note, and photo.
- Confirm the report appears at the top of the list and on the map.
- Refresh the page and confirm the report is still present from localStorage.
- Confirm Local demo mode does not share reports across another browser/device unless localStorage is copied.
- Try "ยืนยันจุดนี้" without another nearby local report from the current local user and confirm the UI shows "ต้องสร้างรายงานใกล้จุดนี้ก่อน จึงจะใช้ยืนยันได้".
- Submit enough reports to hit the local demo hourly limit and confirm the UI shows a readable rate-limit message.

### Firebase backend mode

- Set public Firebase env values in `.env.local`; do not commit the file.
- Confirm Anonymous Auth is enabled in Firebase Auth.
- Confirm App Check has a valid web site key for the demo domain or local emulator setup.
- Confirm Storage Rules allow only `reportImages/{auth.uid}/{imageId}` uploads and Cloud Function `createReport` is available in `asia-southeast1`.
- Run `npm.cmd run dev` and confirm the header shows `Firebase ready`.
- Submit a valid report with a real image.
- Confirm the client uploads the compressed image to Storage before calling `createReport`.
- Confirm the callable payload uses `gs://<bucket>/reportImages/{auth.uid}/{imageId}` and does not send a data URL.
- Confirm the new report appears in the current map/list state from Firestore realtime subscription.
- Open the app on a second browser/device with the same Firebase backend config and confirm it sees the first report without refreshing the first device.
- On the second browser/device, create a nearby report within 500m/60 minutes.
- Select the first user's report and click "ยืนยันจุดนี้"; confirm the UI shows a success message and the report status/count updates through realtime subscription.
- Confirm no client code writes directly to `reports`; Security Rules still block direct report creates.
- Confirm client code does not write `confirmedByReportIds` or `verificationStatus` directly; callable `confirmReport` is the only backend confirmation path.
- Before incident-zone readiness is `ready`, confirm the intelligence panel says `client fallback` and remains usable.
- With readiness `ready`, confirm the panel says `server canonical · realtime` and zones update from the `incidentZones` subscription.
- With readiness `ready` and no active zone documents, confirm the panel shows an empty server result instead of client-derived zones.
- Open a canonical `?zone=<zoneId>` link, an old alias link, and a resolved-zone link. Confirm aliases select the latest ID and resolved zones appear only as reference detail, not active map overlays.

### Failure cases

- No Firebase env: app should stay in Local demo mode and continue working.
- Firebase env incomplete: report submission should show a readable config error instead of crashing.
- Missing App Check key: backend submission should show a readable App Check setup error.
- Anonymous Auth disabled or failing: backend submission should show an anonymous sign-in error.
- Storage upload rejected or interrupted: backend submission should show a photo upload error.
- Callable `createReport` rejects invalid payload: UI should show an invalid report data message.
- Callable `createReport` rate limit exceeded: UI should show the 10 reports/hour message.
- Callable `confirmReport` rejects a user confirming their own report: UI should show a self-confirmation error.
- Callable `confirmReport` rejects duplicate confirmation: UI should show a duplicate confirmation error.
- Callable `confirmReport` rejects when no nearby own report exists: UI should show "ต้องสร้างรายงานใกล้จุดนี้ก่อน จึงจะใช้ยืนยันได้".
- Callable `confirmReport` rejects hidden/rejected target reports: UI should show a not-confirmable message.
- Network or emulator unavailable: UI should show a retryable backend error; switch to Local demo mode for the live demo if backend recovery would take too long.

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
- Cloud Function `confirmReport` rejects unauthenticated requests, self-confirmation, duplicate confirmation, hidden/rejected targets, confirming reports not owned by `auth.uid`, and confirming reports outside 500m/60 minutes.
- Cloud Function `confirmReport` updates `confirmedByReportIds` in a transaction and sets `verificationStatus` to `ยืนยันแล้ว` when confirmation succeeds.
- Firestore Security Rules block direct client writes to `confirmedByReportIds` and `verificationStatus`.
- Client backend payload helpers build Storage paths, `gs://` report payloads, callable response parsing, and user-facing backend error messages without including local-only image blobs or server-owned fields.
- Phase 18A.1 incident-zone unit tests cover empty/single/near/distant/transitive clusters, hidden/rejected/stale exclusions, active windows, confirmation/severity/category/risk aggregates, stable add/remove IDs, merge/split tie-breaks, hidden anchors, deterministic ordering, state hashes, version changes, resolved/hidden lifecycle, and candidate/BFS limits.
- Incident-zone parity fixtures verify shared fresh-report behavior and document intentional server differences for active windows, stable IDs, category aggregates, and resolved zones.
- Incident-zone dry-run tests verify safe summary-only output and no partial plan after a limit failure.
- Firestore Rules tests verify public visibility for `active`/`resolved` incident zones, denial for hidden zones and all zone writes, public alias reads with denied writes, and complete client denial for memberships/jobs.
- Phase 18A.2 pure/client tests cover relevant-field comparison (including object-key order), geohash partition neighborhoods, defensive server payload mapping, local/server/fallback source selection, ready-empty behavior, and canonical/merged/chained/missing/resolved/looping aliases.
- Phase 18A.2 emulator tests cover Timestamp adapters, malformed/legacy reports, irrelevant write suppression, old/new dirty regions, generation coalescing, deterministic owner forwarding, idempotent retries, the five-attempt retry ceiling, overlapping same-zone writes that preserve metadata, stale generation rejection, merge aliases, hidden/deleted lifecycle, 60/180-minute risk aging without report writes, and write-cap no-partial behavior.
- Backfill runtime tests verify all apply guards, dry-run no-write behavior, bounded checkpoint resume, and idempotent reruns without duplicate zones.
- Firestore Rules expose only `incidentZoneSystem/state`; the backfill checkpoint remains server-only and all client system metadata writes are denied.

## Last Verified Run

- `npm.cmd run lint` passed.
- `npm.cmd run typecheck` passed for the Next.js app, Cloud Functions, and the guarded zone tool compiler.
- `npm.cmd run test` passed: unit 13 suites/101 tests, Firestore Rules 15 tests, Storage Rules 5 tests, and Cloud Functions 6 suites/54 tests.
- `npm.cmd run build` passed, compiled Cloud Functions and the backfill tool, built the Next.js app, prerendered static routes, and generated the PWA service worker.
- `npm.cmd audit` passed: 0 vulnerabilities.
- `npm.cmd run test:rules` passed inside the full run: 1 test suite, 15 tests, including readiness/checkpoint boundaries.
- `npm.cmd run test:storage` passed: 1 test suite, 5 tests. Firebase CLI warned that the user was not authenticated, but the local emulator test completed successfully.
- `npm.cmd run test:functions` passed inside the full run: 6 suites, 54 tests. The Admin SDK emitted a metadata lookup warning while using the emulator, but every process completed with exit code 0.
- Browser smoke checks passed at desktop 1728x1000 and mobile 390x844: no horizontal overflow, sticky header remained at z-index 3000, both Leaflet maps remained at z-index 0 with valid heights, and marker cluster/zoom controls rendered without browser console errors.
- The browser used the expected `client fallback` because the currently available backend did not expose the new readiness document; no report submission or production write was performed.
- Next.js production build emitted three non-fatal webpack cache snapshot warnings after compiling and prerendering successfully.
