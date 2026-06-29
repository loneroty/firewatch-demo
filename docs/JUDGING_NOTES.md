# Judging Notes

## Technical Strengths

- Next.js App Router, TypeScript strict mode, Tailwind CSS, PWA-ready setup
- Leaflet + OpenStreetMap map view with report list and status filtering
- Mobile-oriented report form with GPS capture and browser image compression
- Local demo mode works without Firebase credentials, using localStorage and compressed data URLs
- Firebase backend mode separates client and server responsibility clearly
- Client uploads report images to Firebase Storage before calling `createReport`
- Cloud Function `createReport` owns report creation, uses `auth.uid`, sets `createdAt` server-side, validates payload, and applies transaction-backed rate limiting
- Firestore Rules block direct client report creation and protect admin-controlled fields
- Storage Rules bind uploads to `reportImages/{auth.uid}/{imageId}`, require `image/*`, limit size to 500KB, and block update/delete
- Jest and Firebase emulator tests cover domain logic, Firestore Rules, Storage Rules, and Cloud Function behavior

## Social Impact

- Reduces friction for people who see smoke, burning, or wildfire signs before official channels receive reports
- Adds location, photo, and severity context so reports are more actionable
- Creates a shared map view that can help communities and local responders understand emerging hotspots
- Verification-by-proximity helps avoid treating every single report as equally reliable
- Rate limiting and reputation-aware logic address misuse early, which matters for public-interest reporting tools

## Completed

- Local demo app with map, report form, GPS, image compression, local persistence, and report list
- Verification logic for nearby reports within 500m and 60 minutes
- Reputation score updates in local demo flow
- Client-side demo rate limit for local mode
- Firebase client bootstrap using public environment variables only
- Callable Cloud Function `createReport`
- Server-side payload validation and server-owned report fields
- Server-side 10 reports/hour rate limit using Firestore transaction buckets
- Firestore Security Rules and emulator tests
- Firebase Storage Rules and emulator tests
- Documentation for testing, runbook, smoke tests, and demo readiness

## After The Competition

- Add full Line Login or production auth provider flow
- Add real push notifications for nearby users and responders
- Build a full moderation/admin dashboard
- Add Remote Config runtime controls for feature flags and emergency rate-limit adjustments
- Add Sentry, Firebase Performance Monitoring, and Firebase Analytics in production
- Add realtime Firestore subscriptions for backend-created reports across clients
- Add richer analytics for pitch metrics, such as report response time and verification rate
- Add Lighthouse CI and accessibility/performance budgets before production demo day

## Professional Limitations To Explain

- Line Login is not implemented yet; the current backend-ready path uses anonymous auth
- Push Notification is not connected to real Firebase Cloud Messaging yet
- Admin Dashboard is not a complete production UI yet
- Remote Config runtime controls are planned but not wired into the current app
- Sentry and Firebase Performance Monitoring are documented as target observability but not production-configured in this MVP
- Firebase backend mode creates reports through the secure callable flow, but full realtime backend subscription for all clients is still future work
- Local demo mode is intentionally localStorage-based for reliability during judging and should not be represented as production persistence

