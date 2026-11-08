# Time Sculpture

Compose rhythmic phrases by building and sculpting groups of pulses inside cycles. The ending is
anchored, so every phrase lands exactly on beat 1 of the next cycle.

A static web app (Vite + React + TypeScript), installable on the iPhone home screen and usable
offline. Your compositions are stored locally in the browser; there is no account or server.

## Run it

```bash
npm install
```

```bash
npm run dev
```

Open the printed address (http://localhost:5173).

## Test it

```bash
npm test
```

```bash
npm run e2e
```

- `npm test` runs the Vitest suite: the musical engine (unit and fast-check property tests) and
  the file/share-link format. `npm run coverage` adds a coverage report.
- `npm run e2e` builds the app and runs Playwright on a desktop and an iPhone 14 viewport. The
  first time on a new machine, run `npx playwright install chromium`.
- `npm run typecheck` and `npm run lint` are the other CI checks.

## Deploy (Vercel)

1. In Vercel, choose **Add New → Project** and import `tomibar22/time-sculpture`.
2. Keep the detected settings (framework Vite, build `npm run build`, output `dist`).
   `vercel.json` already adds the single-page rewrites and keeps the service worker fresh.
3. Every push to `main` deploys to production.

## Add it to the iPhone home screen

1. Open the Vercel address in **Safari**.
2. Tap **Share** → **Add to Home Screen** → **Add**.
3. Launch it from the icon. It opens full screen and works offline. New versions install
   themselves the next time you open it while online.

Sound needs one tap first (iOS rule), and the ring/silent switch can mute Web Audio on some
iPhones; if you hear nothing, flip the switch.

## Using it

The “How to use it” section in the app lists every gesture and key. In short: tap a group to
select it, drag to move it (by Pulse, Beat, or Place), drag the line between two groups to
reshape them, drag a green edge into the open space to stretch, and paint the dotted lane above a
row to change the subdivision. The Library menu (top right) creates, duplicates, renames,
deletes, exports, imports, and shares compositions.

## Code map

See [CLAUDE.md](CLAUDE.md) for the domain model, invariants, folder structure, and design tokens.
`docs/prototype.html` is the original single-file prototype kept as a behavioural reference.
