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

### Changed

- Updated Phase 3 demo-readiness documentation for runtime modes, Firebase setup, generated files, and competition-day smoke testing.
- Improved Firebase backend report error messages in Thai for App Check, config, anonymous auth, Storage upload, callable Function rejection, rate limit, and invalid payload cases.
- Updated README with Competition Demo Quick Start for local judging setup.
