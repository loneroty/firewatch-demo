# PROJECT_STATE.md

## Verified State

- Project root contains the FireWatch Phase 1 MVP scaffold.
- The app can run in Local demo mode without Firebase credentials.
- Firebase public config is read only from `NEXT_PUBLIC_FIREBASE_*` environment variables.
- Build uses Next.js 16 with webpack because `@ducanh2912/next-pwa` injects webpack configuration.
- Full dependency audit with `npm audit` reports 0 vulnerabilities.

## Current Scope

- Phase 1 core MVP only.
- Full Line Login, Firestore Security Rules, Cloud Functions, Push Notification, Admin Dashboard, and observability are planned for later phases.
