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

### Incident Replay and heatmap

- In Live mode, confirm the existing report markers, marker clusters, Alert Zones, plume overlay, selected report/zone, popup, and zoom controls still behave as before.
- Enter Replay, choose each 1/3/6/12/24-hour window and `ทั้งหมด`, then confirm the slider starts at the first eligible report in that period and ends at the current time.
- Test play, pause, reset, 1x/2x/4x, manual slider commit, and automatic stop at the end. Confirm the change summary updates at bucket boundaries rather than every animation frame.
- Toggle Heatmap in both Live and Replay. Confirm hidden/rejected reports are absent, verified/high-severity reports have stronger weight, and the non-interactive heat layer does not block marker, cluster, Alert Zone, popup, or zoom interaction.
- Open a valid replay deep link such as `?mode=replay&at=2026-06-29T12:00:00.000Z&window=6h`; confirm existing `?zone=` or `?report=` parameters still work when their target exists.
- Try invalid `at`/`window` values and malformed report timestamps; confirm the UI falls back safely without `Invalid Date`, `NaN`, or a crash.
- With no eligible reports, confirm the EmptyState is shown and the timeline slider is disabled.
- With at least 1,000 reports, confirm playback remains responsive and timeline markers are aggregated to at most 60 buckets.
- Check desktop at approximately 1728px: navbar remains above Leaflet, map height is stable, and controls do not cover map controls.
- Check mobile at 390x844: controls wrap into rows, targets are at least about 44px, the slider remains usable, bottom quick actions remain visible, and there is no horizontal overflow.
- Repeat the Replay checks in Local demo mode and Firebase backend mode; Replay must not write snapshots, heat points, or settings to Firestore.

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
- Incident Replay helper tests cover empty/single snapshots, cursor boundaries, all time windows, hidden/rejected filtering, heat weights, deterministic ordering, malformed timestamps/coordinates, bucket aggregation, metrics, snapshot changes, risk escalation, zone merge, playback completion, selected-zone cleanup, and unchanged Live collection references.

## Last Verified Run

- `npm.cmd run lint` passed.
- `npm.cmd run typecheck` passed.
- `npm.cmd run test` passed: unit 10 suites / 87 tests, Firestore Rules 1 suite / 9 tests, Storage Rules 1 suite / 5 tests, and Cloud Functions 4 suites / 37 tests.
- `npm.cmd run build` passed, compiled Cloud Functions, generated the production Next.js output, and generated the PWA service worker.
- `npm.cmd audit` passed: 0 vulnerabilities.
- `npm.cmd run test:rules` passed: 1 test suite, 9 tests.
- `npm.cmd run test:storage` passed: 1 test suite, 5 tests.
- `npm.cmd run test:functions` passed inside the full test run: 4 test suites, 37 tests. The Admin SDK emitted a non-fatal metadata lookup warning while using the Functions emulator.
- Manual smoke checks passed at desktop 1728px and mobile 390x844 for Replay controls, playback/pause, Heatmap, marker clusters, zoom controls, stable map height, navbar/map stacking, 44px mobile actions, and horizontal overflow. Local demo mode also returned HTTP 200 with Firebase public environment values unset.
