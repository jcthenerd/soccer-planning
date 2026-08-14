# Contributing / running from source

Prerequisites: Node.js >= 25.7.0 (see `engines` in `package.json`).

## Run as a plain server (local dev, or browser access)

```
npm install
npm run build
npm start
```

Then open http://localhost:3000. Data is stored locally in `data/soccer.db`
(SQLite, created automatically on first run). Re-run `npm run build` after
changing anything under `react-client/src`.

## Run as a desktop app (dev)

```
npm install
npm run build     # builds the React frontend into react-client/dist
npm run electron  # opens the app in its own window
```

The first launch copies any existing `data/soccer.db` into the OS's
per-user app-data directory (e.g. `~/Library/Application Support/Soccer
Planner/soccer.db` on macOS) and uses that from then on - the app is no
longer tied to this repo checkout once that one-time migration happens.

## Build an installable app

```
npm run dist
```

Output lands in `release/` (`.dmg`/`.zip` on macOS, `.exe` on Windows via
NSIS, `.AppImage` on Linux). Windows builds from macOS/Linux require Wine to
be installed locally. Builds are ad-hoc signed but not notarized, so on
macOS the first launch needs a right-click -> Open to get past Gatekeeper
(see the Apple Developer Program note below if you want to change that).

The app icon is generated from `build/icon-source.svg` - regenerate
`build/icon.icns`/`.ico`/`.png` from it with `sips` if you edit the source
(see git history for the exact commands used).

To get a fully trusted (notarized) macOS build instead of ad-hoc signing,
you'd need an Apple Developer Program membership and to wire a Developer ID
certificate + notarization credentials into `package.json`'s `build.mac`
config and into CI secrets - not currently set up.

## Test

```
npm test
```

Runs the plan generator's unit tests (`server/lib/planGenerator.test.js`).
Run a single file directly with `node --test server/lib/planGenerator.test.js`.
There is no frontend test suite. No lint command is configured.

## Frontend dev loop

The UI (Dashboard, Roster, Settings, Games, Stats) is a React app in
`react-client/`, built with Vite and `react-router-dom`. Express serves the
built `react-client/dist/` at `/` and everything under `/api` as JSON. For
active development, `npm run dev` inside `react-client/` runs a Vite dev
server on :5173 that proxies `/api` to :3000, giving hot reload instead of a
rebuild-per-change loop - the Express server must still be running
separately (`npm start`) for the API.

## Architecture and conventions

See [CLAUDE.md](CLAUDE.md) for a fuller architecture writeup (route/module
layout, database/migration conventions, the plan generator's design, styling
conventions) and CI workflow notes.
