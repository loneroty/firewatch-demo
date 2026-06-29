# PROJECT_STATE.md

## Verified State

- Project root contains the FireWatch Phase 1 MVP scaffold.
- The app can run in Local demo mode without Firebase credentials.
- Firebase public config is read only from `NEXT_PUBLIC_FIREBASE_*` environment variables.
- Build uses Next.js 16 with webpack because `@ducanh2912/next-pwa` injects webpack configuration.
- Full dependency audit with `npm audit` reports 0 vulnerabilities.
- Phase 2 security baseline has started on branch `feature/phase-2-security-baseline`.
- Firestore Security Rules exist in `firestore.rules` and are covered by emulator-backed tests in `firestore.rules.test.ts`.
- Firebase emulator config exists in `firebase.json`; Firestore emulator runs on `127.0.0.1:8080`.

## Current Scope

- Phase 2 first slice: Firestore Security Rules, rules tests, emulator wiring, CI Java setup, and incident runbook.
- Full Line Login, Cloud Functions, Push Notification, Admin Dashboard UI, Remote Config, Sentry, and Firebase Performance Monitoring are still pending.
