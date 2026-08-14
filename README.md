# Soccer Planner

Tracks playtime, positions, goals, and pairings for a youth soccer team, and
generates fair lineup plans for upcoming games.

This is a personal project for coaching an AYSO team - not a general product.
It was vibe coded with Claude: built and iterated on almost entirely through
conversation rather than hand-written, so expect the usual tradeoffs that
come with that (pragmatic scope, light on tests, tuned for one team's
workflow rather than configurability).

## Run it

As a desktop app (recommended day-to-day):

```
npm install
npm run build     # builds the React frontend into react-client/dist
npm run electron  # opens the app in its own window
```

The first launch copies any existing `data/soccer.db` into the OS's
per-user app-data directory (e.g. `~/Library/Application Support/Soccer
Planner/soccer.db` on macOS) and uses that from then on - the app is no
longer tied to this repo checkout once that one-time migration happens.

To build an installable app (`.dmg`/`.zip` on macOS, `.exe` on Windows via
NSIS, `.AppImage` on Linux):

```
npm run dist
```

Output lands in `release/`. Builds are unsigned, so on macOS the first
launch needs a right-click -> Open to get past Gatekeeper. Windows builds
from macOS require Wine to be installed locally.

As a plain server (for local dev, or browser access):

```
npm install
npm run build
npm start
```

Then open http://localhost:3000. Data is stored locally in `data/soccer.db`
(SQLite, created automatically on first run). Re-run `npm run build` after
changing anything under `react-client/src`.

## Test

```
npm test
```

Runs the plan generator's unit tests (`server/lib/planGenerator.test.js`).

## Frontend

The UI (Dashboard, Roster, Settings, Games, Stats) is a React app in
`react-client/`, built with Vite and `react-router-dom`. Express serves the
built `react-client/dist/` at `/` and everything under `/api` as JSON. For
active development, `npm run dev` inside `react-client/` runs a Vite dev
server on :5173 that proxies `/api` to :3000, giving hot reload instead of a
rebuild-per-change loop.

## How it works

1. **Roster** - add players, optionally restricting some to specific positions
   (e.g. only certain kids play goalkeeper).
2. **Settings** - positions and formations are fully configurable, seeded with
   a default 5v5 formation (1 Goalkeeper, 2 Defenders, 2 Forwards). Add more
   positions/formations to grow into 11v11 later.
3. **Games** - schedule a game, mark who's available, then **Generate Plan**
   to get a fair per-quarter lineup. Edit any cell (it swaps players to keep
   every quarter valid) and **Save Plan** when happy. Under **Goals**, record
   each player's goals plus the opponent's final goal count.
4. **Stats** - season playtime %, win/loss/tie record, goals scored, position
   variety, and a pairing-rate matrix showing who's played together most/least.

The plan generator balances playtime deficits, pairing variety, and bench
streaks using season-to-date history; it only "knows about" games whose plan
has actually been saved, so scheduled-but-unplanned games don't skew stats.
Goals and results are independent of this and count for every game in the
season, saved plan or not - a game only counts toward the win/loss/tie record
once the opponent's goals have been entered.

## Known limitations (v1)

- Attendance is per-game, not per-quarter (no modeling of late arrivals).
- Quarters are treated as equal-length units for playtime %.
