'use strict';

const { db } = require('../db');

function pairKey(a, b) {
  return a < b ? `${a}:${b}` : `${b}:${a}`;
}

// A game only "counts" toward season stats once its plan has actually been
// saved (assignments exist) - scheduled-but-unplanned games shouldn't dilute
// playtime percentages.
function getPlayedGames(seasonId, { beforeGame, fromDate, toDate } = {}) {
  let sql = `
    SELECT g.id, g.date, g.num_quarters
    FROM games g
    WHERE g.season_id = ?
      AND EXISTS (
        SELECT 1 FROM assignments a JOIN quarters q ON q.id = a.quarter_id WHERE q.game_id = g.id
      )
  `;
  const params = [seasonId];
  if (beforeGame) {
    sql += ' AND (g.date < ? OR (g.date = ? AND g.id < ?))';
    params.push(beforeGame.date, beforeGame.date, beforeGame.id);
  }
  if (fromDate) {
    sql += ' AND g.date >= ?';
    params.push(fromDate);
  }
  if (toDate) {
    sql += ' AND g.date <= ?';
    params.push(toDate);
  }
  sql += ' ORDER BY g.date, g.id';
  return db.prepare(sql).all(...params);
}

/**
 * Aggregates season-to-date state used both to seed the plan generator and to
 * power the stats dashboard.
 *
 * @param {number} seasonId
 * @param {{beforeGame?: {id:number, date:string}}} [options] - if given, only
 *   games strictly before this one (by date, then id) are included.
 * @returns {{
 *   stats: Object<number, {playedQuarters:number, availableQuarters:number, positionCounts:Object<number,number>}>,
 *   pairCounts: Object<string, number>,
 *   coAvailableCounts: Object<string, number>,
 *   benchStreaks: Object<number, number>,
 *   playedGameIds: number[],
 * }}
 */
function computeSeasonState(seasonId, options = {}) {
  const games = getPlayedGames(seasonId, options);
  const gameIds = games.map((g) => g.id);

  const stats = {};
  const pairCounts = {};
  const coAvailableCounts = {};
  const benchStreaks = {};

  if (gameIds.length === 0) {
    return { stats, pairCounts, coAvailableCounts, benchStreaks, playedGameIds: [] };
  }

  const placeholders = gameIds.map(() => '?').join(',');

  const attendanceRows = db.prepare(`
    SELECT ga.player_id, ga.game_id, ga.available, g.num_quarters
    FROM game_attendance ga
    JOIN games g ON g.id = ga.game_id
    WHERE ga.game_id IN (${placeholders})
  `).all(...gameIds);

  const ensure = (playerId) => {
    if (!stats[playerId]) stats[playerId] = { playedQuarters: 0, availableQuarters: 0, positionCounts: {} };
    return stats[playerId];
  };

  for (const row of attendanceRows) {
    if (!row.available) continue;
    ensure(row.player_id).availableQuarters += row.num_quarters;
  }

  const assignmentRows = db.prepare(`
    SELECT a.player_id, a.position_id, a.quarter_id, q.quarter_number, q.game_id
    FROM assignments a
    JOIN quarters q ON q.id = a.quarter_id
    WHERE q.game_id IN (${placeholders})
  `).all(...gameIds);

  for (const row of assignmentRows) {
    const playerStats = ensure(row.player_id);
    if (row.position_id != null) {
      playerStats.playedQuarters += 1;
      playerStats.positionCounts[row.position_id] = (playerStats.positionCounts[row.position_id] || 0) + 1;
    }
  }

  const byQuarterFielded = new Map();
  const assignmentsByQuarterId = new Map();
  for (const row of assignmentRows) {
    if (!assignmentsByQuarterId.has(row.quarter_id)) assignmentsByQuarterId.set(row.quarter_id, new Map());
    assignmentsByQuarterId.get(row.quarter_id).set(row.player_id, row.position_id);

    if (row.position_id == null) continue;
    if (!byQuarterFielded.has(row.quarter_id)) byQuarterFielded.set(row.quarter_id, []);
    byQuarterFielded.get(row.quarter_id).push(row.player_id);
  }
  for (const players of byQuarterFielded.values()) {
    for (let i = 0; i < players.length; i++) {
      for (let j = i + 1; j < players.length; j++) {
        const key = pairKey(players[i], players[j]);
        pairCounts[key] = (pairCounts[key] || 0) + 1;
      }
    }
  }

  const byGameAvailable = new Map();
  for (const row of attendanceRows) {
    if (!row.available) continue;
    if (!byGameAvailable.has(row.game_id)) byGameAvailable.set(row.game_id, []);
    byGameAvailable.get(row.game_id).push(row.player_id);
  }
  const numQuartersByGame = new Map(games.map((g) => [g.id, g.num_quarters]));
  for (const [gameId, playerIds] of byGameAvailable) {
    const nq = numQuartersByGame.get(gameId) || 0;
    for (let i = 0; i < playerIds.length; i++) {
      for (let j = i + 1; j < playerIds.length; j++) {
        const key = pairKey(playerIds[i], playerIds[j]);
        coAvailableCounts[key] = (coAvailableCounts[key] || 0) + nq;
      }
    }
  }

  const orderedQuarters = [];
  for (const g of games) {
    const quarterRows = db.prepare('SELECT id FROM quarters WHERE game_id = ? ORDER BY quarter_number').all(g.id);
    for (const q of quarterRows) orderedQuarters.push(q.id);
  }
  for (const quarterId of orderedQuarters) {
    const quarterAssignments = assignmentsByQuarterId.get(quarterId);
    if (!quarterAssignments) continue;
    for (const [playerId, positionId] of quarterAssignments) {
      if (!(playerId in benchStreaks)) benchStreaks[playerId] = 0;
      benchStreaks[playerId] = positionId == null ? benchStreaks[playerId] + 1 : 0;
    }
  }

  return { stats, pairCounts, coAvailableCounts, benchStreaks, playedGameIds: gameIds };
}

module.exports = { computeSeasonState, pairKey };
