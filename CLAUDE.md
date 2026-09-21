# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Soccer Planner: an Express + SQLite backend with a React (Vite) frontend for
tracking a youth soccer team's roster, playtime, goals, and results, and for
generating fair per-quarter lineup plans for games.

## Commands

```
npm install
npm run build     # builds react-client/ into react-client/dist (required before npm start/npm run electron serve anything)
npm start         # node server/index.js, serves the API and the built frontend on :3000
npm test          # node --test server/lib/*.test.js
npm run electron  # runs the built app in an Electron window instead of a browser tab
npm run dist      # npm run build, then electron-builder --publish never -> installers in release/
```

Run a single backend test file directly: `node --test server/lib/planGenerator.test.js`.
There is no frontend test suite. See [CONTRIBUTING.md](CONTRIBUTING.md) for
the fuller human-facing rundown of these same commands (install-from-release
instructions live in `README.md` instead).

For frontend-only iteration, `npm run dev` inside `react-client/` runs a Vite
dev server on :5173 that proxies `/api` to :3000 (the Express server must
still be running separately for the API). Otherwise, after any change under
`react-client/src`, re-run `npm run build` (or `npm --prefix react-client run
build`) - Express serves the static `react-client/dist/` output, not the
source directly.

No lint command is configured.

## Architecture

**Two-part app, one server.** `server/` is a small Express API (CommonJS,
`server/index.js`) backed directly by `node:sqlite` (no ORM) at
`data/soccer.db`. `react-client/` is a separate npm package (ESM, Vite +
`react-router-dom`) built to static assets. Express serves `/api/*` as JSON
and falls back to `react-client/dist/index.html` for every other GET path (an
SPA catch-all - see the bottom of `server/index.js`), so client-side routes
work on a hard refresh. The frontend calls the API with plain relative
`fetch` (`react-client/src/api.js`), so both pieces are always same-origin;
there's no separate API base URL to configure. `server/index.js` exports the
Express `app` and only calls `app.listen()` when run directly (`require.main
=== module`), so the same module can be `require()`-d by Electron's main
process without double-binding a port.

**Desktop packaging (Electron).** `package.json`'s `main` points at
`electron/main.js`, which requires `server/index.js` directly (no child
process/IPC - same-origin `fetch` calls work unmodified) and points a
`BrowserWindow` at `http://localhost:<port>` once the server is listening
(falls back to an OS-assigned port on `EADDRINUSE`, e.g. when a dev `npm
start` is already running on :3000). `server/db.js` resolves its SQLite path
from `SOCCER_DB_PATH` (falling back to the repo-relative `data/soccer.db`
default used by `npm start`/`npm test`), and `electron/main.js` sets that env
var to a path under `app.getPath('userData')` before requiring the server,
one-time-migrating any existing `data/soccer.db*` files there on first
launch. `npm run dist` (electron-builder, config under `package.json`'s
`build` key) produces installers in `release/` using icons generated from
`build/icon-source.svg` into `build/icon.{icns,ico,png}`. electron-builder's
own code signing is skipped in CI (`CSC_IDENTITY_AUTO_DISCOVERY=false`,
since there's no paid Developer ID certificate), which leaves the macOS app
bundle's original linker-signed state in place - invalid once resources
(asar, icon) are added afterward. `build/afterPack.js` (wired via the
`afterPack` build hook) re-signs the fully assembled `.app` ad hoc after
packaging so its resource seal is valid; without it, macOS reports the app
as "damaged" rather than merely unsigned. Getting to a fully trusted/notarized
build would need a real Developer ID certificate and notarization
credentials wired into both `package.json` and CI secrets - not set up.

**Database and migrations.** `server/db.js` opens the single SQLite
connection (WAL mode, foreign keys on), owns the full schema via
`CREATE TABLE IF NOT EXISTS`, and exports `db` and a `transaction(fn)` helper
used by every route that writes more than one row. There is no migration
framework: schema changes to *existing* tables are hand-rolled in the
`migrate()` function (checks `PRAGMA table_info` and runs `ALTER TABLE` if a
column is missing) - follow that pattern for new columns rather than editing
the `CREATE TABLE` statement alone, since that only affects fresh databases.
`seed()` creates the initial season the first time `seasons` is empty.
Positions and formations are *not* auto-seeded - a fresh install has none
until the user applies an age-group preset (or builds their own) via
`/api/setup`, which is what the frontend's first-run onboarding screen
(`react-client/src/pages/Onboarding.jsx`) drives. `GET /api/setup/status`
reports `needsSetup: true` whenever `positions` is empty, which is how the
frontend decides whether to show onboarding instead of the normal app.
`server/lib/formationPresets.js` holds the age-group catalog (U8/U10/U12
etc.) as plain data, shared by `/api/setup` (applying a preset) and the
`GET /api/setup/presets` response (listing them) - add new age groups or
formations there rather than inlining them in the route.

**Route modules mirror resources**, one file per table-ish concept under
`server/routes/` (`players`, `positions`, `formations`, `seasons`, `games`,
`stats`, `setup`, `data`), each a plain `express.Router()` mounted in
`server/index.js`. Write
routes generally: validate input, run the mutation(s) inside `transaction()`,
then re-fetch and return the canonical serialized shape (see `getGameDetail`
in `games.js`) rather than trusting the request body echoed back. The generic
error handler in `server/index.js` maps SQLite `FOREIGN KEY`/`UNIQUE`
constraint failures to 409s, so route handlers don't need their own
try/catch for those.

**Export/import** (`server/routes/data.js`, `server/lib/dataTransfer.js`).
`GET /api/data/export` dumps every table as one JSON file (`format`/`version`
header + `tables`), and `POST /api/data/import` *replaces* the whole database
with such a file inside one transaction (ids preserved; any failure rolls
back). This is how data moves between computers - there's no merge, by design,
since ids collide across installs. The route is mounted *before* the global
`express.json()` in `server/index.js` because it needs a larger body limit.
When adding a table, add it to `TABLES` in `dataTransfer.js` (parents before
children) or it will silently be left out of exports. Columns are matched by
name on import, so new columns don't require a version bump; bump `VERSION`
only for changes an older importer couldn't handle.

**Core domain model.** A `formation` has `formation_slots` (position +
count + optional `drop_priority`, used to gracefully shrink the lineup when
short-handed). A `game` belongs to a `season`, has one `game_attendance` row
per active player (tracks `available` and per-player `goals`; the game's own
`opponent_goals` lives on the `games` row itself, so a game's result is
derived, not stored), and `quarters`, each with `assignments` (player →
position, or position `NULL` for benched). Everything season-facing reads
through this graph rather than a denormalized stats table.

**The plan generator is pure and decoupled from the DB.**
`server/lib/planGenerator.js` (`generatePlan`) takes plain data in
(available player ids, formation slots, prior season stats/pairings/bench
streaks, eligibility map) and returns quarter assignments - no `db` import,
no I/O, which is what makes `planGenerator.test.js` fast unit tests instead
of integration tests. It balances three costs per quarter: bench-time
deficit, consecutive-bench streaks, and repeat pairings (see
`rankBenchCandidates`), then assigns benched-vs-playing players to position
slots via backtracking that prefers players who've played that position
least (`findPositionAssignment`), falling back to relaxed eligibility if a
strict assignment is infeasible (`findBestEffortAssignment`) rather than
leaving slots empty.

**`server/lib/seasonStats.js` (`computeSeasonState`) is the shared
aggregator** behind both the plan generator's "prior" inputs and the
`/api/stats/*` endpoints. It only counts a game once its plan has actually
been *saved* (i.e. `assignments` rows exist) - a scheduled-but-unplanned game
doesn't dilute playtime/pairing percentages. Goals and win/loss/tie results
are the exception: they're read straight off `game_attendance.goals` /
`games.opponent_goals` in `stats.js` and count for every game regardless of
whether a plan was ever generated, so don't route those through
`computeSeasonState`.

**Frontend structure.** One React component per top-level page under
`react-client/src/pages/` (`Dashboard`, `Roster`, `Settings`, `GamesList`,
`GameDetail`, `Stats`), routed in `App.jsx`. `Settings.jsx` and `Stats.jsx`
are each a handful of smaller components in the same file (one per card)
rather than split into separate files - follow that pattern for new
sub-sections instead of always creating a new file. Every page fetches its
own data with the shared `api` helper; there's no global state store.

**Styling is a single hand-written stylesheet**
(`react-client/public/css/styles.css`, copied verbatim into the Vite build
via the `public/` convention) built around CSS custom properties for
light/dark theming (`:root` + `@media (prefers-color-scheme: dark)`
overrides) - there's no CSS-in-JS or utility framework. Chart/status colors
(`--series-*` categorical palette, `--seq-*` sequential ramp used by the
pairing-rate heatmap) were chosen and validated (contrast, CVD-safety) using
the `dataviz` skill's palette methodology rather than picked by eye; keep
that in mind before changing them ad hoc. Buttons/links use semantic
variants via `data-action` attributes or classes (`data-action="delete"`,
`.secondary`, `.danger`, `.btn` for link-styled-as-button) rather than
one-off inline styles.
