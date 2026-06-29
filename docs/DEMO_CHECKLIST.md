# Demo Checklist

## Before Going On Stage

- Confirm branch/build is the intended demo package.
- Close unrelated browser tabs and terminals.
- Keep one terminal ready at the project root.
- Decide primary demo path: Local demo mode first, Firebase backend mode only if Firebase env/App Check/backend are ready.
- Keep this fallback sentence ready: "If backend connectivity is unstable, I will show the same user flow in Local demo mode, which is designed to run offline from Firebase."

## Commands

Install dependencies:

```powershell
npm.cmd install
```

Run local dev server:

```powershell
npm.cmd run dev
```

Open:

```text
http://localhost:3000
```

Verify before demo:

```powershell
npm.cmd run lint
npm.cmd run typecheck
npm.cmd run test
npm.cmd run build
npm.cmd audit
```

## Local Demo Mode Test Cases

- Start without Firebase env values.
- Confirm header shows `Local demo`.
- Confirm map and seeded reports render.
- Click a seeded report and confirm map/list selection works.
- Use GPS if browser permission is available.
- If GPS is blocked, manually enter lat/lng.
- Attach an image and submit a report.
- Confirm the submitted report appears at the top of the list and on the map.
- Refresh and confirm localStorage preserves the report.
- Submit reports until rate limit triggers, if time allows.

## Firebase Backend Mode Test Cases

- Confirm `.env.local` has only public `NEXT_PUBLIC_FIREBASE_*` values and no secrets.
- Confirm Anonymous Auth is enabled.
- Confirm App Check site key is valid for the demo origin.
- Confirm Storage Rules and Cloud Function are deployed only from tested code.
- Confirm header shows `Firebase ready`.
- Submit a report with a real image.
- Confirm image upload goes to `reportImages/{auth.uid}/{imageId}`.
- Confirm callable payload uses `gs://...`, not data URL.
- Confirm new report appears in map/list after `createReport` succeeds.

## Reset Local Demo Data

Use browser DevTools Console on `http://localhost:3000`:

```js
localStorage.removeItem("firewatch.reports.v1");
localStorage.removeItem("firewatch.localUserId.v1");
location.reload();
```

If you need a full reset for the origin:

```js
localStorage.clear();
location.reload();
```

## Fallbacks

### Map Issues

- Refresh the page once.
- Check internet connectivity because OpenStreetMap tiles are loaded from the network.
- Continue demo using the report list and explain that map tiles depend on external tile availability.

### GPS Issues

- If browser permission is denied, manually type lat/lng.
- Use the default Chiang Mai coordinates already in the form for a stable demo.
- Explain that GPS depends on browser/device permission and is optional for the form.

### Firebase Backend Or Emulator Issues

- Switch to Local demo mode by removing/incompleting Firebase public env and restarting `npm.cmd run dev`.
- Do not deploy during the presentation.
- For emulator tests, use the scripted commands in `package.json`; do not manually change rules live.
- If App Check fails, use Local demo mode and explain the backend security design from `docs/DEMO_SCRIPT.md`.

### Image Upload Issues

- Try a smaller image.
- Confirm file type is an image.
- In backend mode, confirm compressed image size is under 500KB and Storage Rules allow the user-owned path.

