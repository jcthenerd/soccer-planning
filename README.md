# Soccer Planner

Tracks playtime, positions, goals, and pairings for a youth soccer team, and
generates fair lineup plans for upcoming games.

This is a personal project for coaching an AYSO team - not a general product.
It was vibe coded with Claude: built and iterated on almost entirely through
conversation rather than hand-written, so expect the usual tradeoffs that
come with that (pragmatic scope, light on tests, tuned for one team's
workflow rather than configurability).

## Install

Download the latest release for your platform from the
[Releases page](https://github.com/jcthenerd/soccer-planning/releases/latest):

- **macOS (Apple Silicon)** - download the `.dmg`, open it, and drag Soccer
  Planner into Applications. The app isn't notarized yet, so on first launch
  macOS will warn that it's from an unidentified developer - right-click
  (Control-click) the app and choose **Open**, then **Open** again to
  confirm. After that it launches normally. Intel Macs aren't built yet -
  see [CONTRIBUTING.md](CONTRIBUTING.md) to build from source instead.
- **Windows** - download the `Setup *.exe` installer and run it.
- **Linux** - download the `.AppImage`, make it executable
  (`chmod +x Soccer*.AppImage`), and run it.

Data is stored in your OS's per-user app-data directory (e.g. `~/Library/Application
Support/Soccer Planner/soccer.db` on macOS) and persists across app updates.

Want to run it as a plain local server instead, or build it yourself? See
[CONTRIBUTING.md](CONTRIBUTING.md).

## How it works

1. **Roster** - add players, optionally restricting some to specific positions
   (e.g. only certain kids play goalkeeper).
2. **Settings** - positions and formations are fully configurable. First run
   walks you through a preset formation for your team's age group (or you
   can add positions/formations manually and skip presets entirely).
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
- macOS builds are Apple Silicon only, and unsigned/unnotarized (see Install
  above for the one-time Gatekeeper workaround).
