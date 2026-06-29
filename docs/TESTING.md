# TESTING.md

## Local Verification Commands

```bash
npm run lint
npm run typecheck
npm run test
npm run build
```

## Current Test Coverage

- Geohash encoding validation.
- Cross-report verification within 500m and 60 minutes.
- Same-user reports do not corroborate each other.
- Low reputation reports are throttled.
- Reputation score changes.
- Hourly report rate limit.

## Last Verified Run

- `npm.cmd run lint` passed.
- `npm.cmd run typecheck` passed.
- `npm.cmd run test` passed: 3 test suites, 10 tests.
- `npm.cmd audit` passed: 0 vulnerabilities.
- `npm.cmd run build` passed and generated the PWA service worker.
- Browser smoke test on `http://127.0.0.1:3000` returned HTTP 200 and rendered FireWatch, Local demo mode, report form, 3 report cards, Leaflet map tiles, and marker clustering.
