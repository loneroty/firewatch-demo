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
