# Changelog

All notable changes to this project will be documented in this file.

The format is based on Keep a Changelog.

## [Unreleased]

### Added

- Initial Phase 1 FireWatch MVP scaffold with Next.js App Router, strict TypeScript, Tailwind CSS, and PWA manifest.
- Local demo report flow with image compression, GPS capture, responsive map layout, status filtering, and report list.
- Verification, reputation, and hourly rate-limit domain logic with Jest coverage.
- Optional Firebase client bootstrap driven only by public environment variables.
- Basic GitHub Actions CI for lint, typecheck, test, and build.
- Next.js 16 webpack build setup for compatibility with `@ducanh2912/next-pwa`.
- Dependency overrides for vulnerable transitive PostCSS, serialize-javascript, and js-yaml versions.
- Phase 2 Firestore Security Rules with emulator-backed rules tests.
- Firebase emulator configuration and CI Java setup for rules testing.
- Incident runbook for spam, outage, and rules deployment incidents.
- Cloud Function `createReport` with server-side payload validation, server-owned report fields, and transaction-backed hourly rate limiting.
- Emulator-backed Cloud Function tests for valid reports, unauthenticated requests, invalid payloads, forbidden fields, userId mismatch, and rate-limit behavior.
- Firebase backend client report flow that signs in anonymously, checks App Check, uploads photos to Storage, and calls callable `createReport` instead of writing reports directly.
- Firebase Storage Rules and emulator-backed tests for authenticated user-owned report image uploads, image content type, file size, and blocked deletes.
- Client report payload helper tests for Storage path construction, `gs://` payload shaping, callable response parsing, and readable backend error mapping.
- Phase 4 demo package docs: demo script, judging notes, and competition checklist.
- Phase 5 Firebase backend shared reports with Firestore realtime subscription.
- Callable `confirmReport` for confirmation-by-nearby-report using `targetReportId` and `confirmingReportId` within 500m/60 minutes.
- UI action for "ยืนยันจุดนี้" with Thai success/error messages and local demo fallback behavior.
- Emulator-backed tests for `confirmReport` and Security Rules coverage blocking direct client edits to `confirmedByReportIds`.
- Phase 6 polished multi-section web UI with navbar, hero, situation summary, live map, report form, latest reports, workflow explanation, security notes, and demo mode notes.
- Phase 19 client-side Incident Replay controls with 1/3/6/12/24-hour and all-history windows, play/pause/reset, 1x/2x/4x playback, aggregate timeline markers, deterministic change summaries, and safe replay deep links.
- Lightweight Leaflet Canvas heat overlay weighted by report severity and verification status, with hidden and rejected reports excluded.
- Deterministic replay snapshot helpers and 33 unit tests covering time filtering, windows, buckets, metrics, heat weights, zone changes, malformed timestamps, playback timing, and Live-mode preservation.

### Changed

- Updated Phase 3 demo-readiness documentation for runtime modes, Firebase setup, generated files, and competition-day smoke testing.
- Improved Firebase backend report error messages in Thai for App Check, config, anonymous auth, Storage upload, callable Function rejection, rate limit, and invalid payload cases.
- Updated README with Competition Demo Quick Start for local judging setup.
- Updated README, project state, testing guide, demo checklist, and demo script for Firebase shared backend mode.
- Improved ReportForm, ReportList, and map container presentation while keeping local demo and Firebase backend flows unchanged.
- Made client-derived Alert Zones, risk aging, selected-zone cleanup, and incident detail time-aware while Replay mode is active; Live mode continues to use the existing realtime/local report flows.
