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
- Phase 18A.1 pure server-side incident-zone engine with deterministic 500m clustering, bounded active windows, stable merge/split identity, canonical state hashing, and dry-run backfill planning.
- Canonical `incidentZones`, membership, alias, and future job schemas with Firestore read boundaries, a minimal public-zone query index, and emulator-backed Rules coverage.
- Unit and parity fixtures for incident-zone clustering, risk/category aggregation, stable IDs, lifecycle transitions, idempotent versions, hard limits, and intentional client/server differences.
- Phase 18A.2 Firestore adapters, relevant report-change detector, geohash dirty-region queue, lease/generation worker, transactional canonical writer, and bounded risk-aging maintenance.
- Dry-run-first incident-zone backfill CLI with project allowlist, typed confirmation, bounded batches, resume checkpoint, and idempotent worker reuse.
- Realtime server incident-zone/readiness subscription, client fallback source selection, and alias-aware canonical/resolved deep links.
- Emulator and unit coverage for dirty-job coalescing, overlapping owner partitions, stale generations, merge aliases, lifecycle/aging, write caps, backfill safety, readiness Rules, and client migration states.
- Incident-zone runtime architecture and rollout/rollback runbook.

### Changed

- Updated Phase 3 demo-readiness documentation for runtime modes, Firebase setup, generated files, and competition-day smoke testing.
- Improved Firebase backend report error messages in Thai for App Check, config, anonymous auth, Storage upload, callable Function rejection, rate limit, and invalid payload cases.
- Updated README with Competition Demo Quick Start for local judging setup.
- Updated README, project state, testing guide, demo checklist, and demo script for Firebase shared backend mode.
- Improved ReportForm, ReportList, and map container presentation while keeping local demo and Firebase backend flows unchanged.
- Documented the Phase 18A.1 server-zone contract while keeping client-derived Alert Zones as the current runtime source of truth.
- Firebase backend intelligence now prefers canonical server zones only after explicit readiness; Local demo and backend-not-ready/error states retain the existing client-derived fallback, including authoritative ready-empty handling.
- Expanded Firestore indexes only for the report candidate, active-zone, due-aging, retry, and backfill queries used by the Phase 18A.2 runtime.
