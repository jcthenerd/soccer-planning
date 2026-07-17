'use strict';

const express = require('express');
const { db } = require('../db');
const { computeSeasonState, pairKey } = require('../lib/seasonStats');

const router = express.Router();

router.get('/playtime', (req, res) => {
  const seasonId = req.query.season_id;
  if (!seasonId) return res.status(400).json({ error: 'season_id is required' });

  const { stats } = computeSeasonState(Number(seasonId), {
    fromDate: req.query.from,
    toDate: req.query.to,
  });

  const players = db.prepare('SELECT id, name, jersey_number, active FROM players').all();
  const result = players
    .filter((p) => p.active || stats[p.id])
    .map((p) => {
      const s = stats[p.id] || { playedQuarters: 0, availableQuarters: 0 };
      return {
        player_id: p.id,
        name: p.name,
        jersey_number: p.jersey_number,
        played_quarters: s.playedQuarters,
        available_quarters: s.availableQuarters,
        playtime_pct: s.availableQuarters ? s.playedQuarters / s.availableQuarters : null,
      };
    })
    .sort((a, b) => (b.playtime_pct ?? -1) - (a.playtime_pct ?? -1));

  res.json(result);
});

router.get('/goals', (req, res) => {
  const seasonId = req.query.season_id;
  if (!seasonId) return res.status(400).json({ error: 'season_id is required' });

  const rows = db.prepare(`
    SELECT ga.player_id, SUM(ga.goals) AS goals
    FROM game_attendance ga
    JOIN games g ON g.id = ga.game_id
    WHERE g.season_id = ?
    GROUP BY ga.player_id
  `).all(Number(seasonId));
  const goalsByPlayer = new Map(rows.map((r) => [r.player_id, r.goals]));

  const players = db.prepare('SELECT id, name, jersey_number, active FROM players').all();
  const result = players
    .filter((p) => p.active || goalsByPlayer.has(p.id))
    .map((p) => ({
      player_id: p.id,
      name: p.name,
      jersey_number: p.jersey_number,
      goals: goalsByPlayer.get(p.id) || 0,
    }))
    .sort((a, b) => b.goals - a.goals || a.name.localeCompare(b.name));

  res.json(result);
});

router.get('/results', (req, res) => {
  const seasonId = req.query.season_id;
  if (!seasonId) return res.status(400).json({ error: 'season_id is required' });

  const rows = db.prepare(`
    SELECT g.id, g.date, g.opponent, g.opponent_goals, COALESCE(SUM(ga.goals), 0) AS our_goals
    FROM games g
    LEFT JOIN game_attendance ga ON ga.game_id = g.id
    WHERE g.season_id = ? AND g.opponent_goals IS NOT NULL
    GROUP BY g.id
    ORDER BY g.date, g.id
  `).all(Number(seasonId));

  let wins = 0, losses = 0, ties = 0;
  const games = rows.map((r) => {
    const result = r.our_goals > r.opponent_goals ? 'win' : r.our_goals < r.opponent_goals ? 'loss' : 'tie';
    if (result === 'win') wins++;
    else if (result === 'loss') losses++;
    else ties++;
    return {
      game_id: r.id,
      date: r.date,
      opponent: r.opponent,
      our_goals: r.our_goals,
      opponent_goals: r.opponent_goals,
      result,
    };
  });

  res.json({ wins, losses, ties, games });
});

router.get('/pairings', (req, res) => {
  const seasonId = req.query.season_id;
  if (!seasonId) return res.status(400).json({ error: 'season_id is required' });

  const { stats, pairCounts, coAvailableCounts } = computeSeasonState(Number(seasonId));

  const playerIds = Object.keys(stats).map(Number);
  const players = playerIds.length
    ? db.prepare(`SELECT id, name FROM players WHERE id IN (${playerIds.map(() => '?').join(',')})`)
        .all(...playerIds)
        .sort((a, b) => a.name.localeCompare(b.name))
    : [];

  const pairs = [];
  for (let i = 0; i < playerIds.length; i++) {
    for (let j = i + 1; j < playerIds.length; j++) {
      const a = playerIds[i];
      const b = playerIds[j];
      const key = pairKey(a, b);
      const co = coAvailableCounts[key] || 0;
      const paired = pairCounts[key] || 0;
      pairs.push({
        player_id_a: a,
        player_id_b: b,
        paired_quarters: paired,
        co_available_quarters: co,
        pairing_rate: co ? paired / co : null,
      });
    }
  }

  res.json({ players, pairs });
});

router.get('/positions', (req, res) => {
  const seasonId = req.query.season_id;
  if (!seasonId) return res.status(400).json({ error: 'season_id is required' });

  const { stats } = computeSeasonState(Number(seasonId));
  const positions = db.prepare('SELECT id, name FROM positions ORDER BY sort_order, name').all();

  let playerIds = Object.keys(stats).map(Number);
  if (req.query.player_id) playerIds = playerIds.filter((id) => id === Number(req.query.player_id));

  const players = playerIds.length
    ? db.prepare(`SELECT id, name FROM players WHERE id IN (${playerIds.map(() => '?').join(',')})`).all(...playerIds)
    : [];
  const nameById = new Map(players.map((p) => [p.id, p.name]));

  const result = playerIds
    .map((id) => ({
      player_id: id,
      name: nameById.get(id),
      played_quarters: stats[id].playedQuarters,
      position_counts: positions.map((pos) => ({
        position_id: pos.id,
        position_name: pos.name,
        count: stats[id].positionCounts[pos.id] || 0,
      })),
    }))
    .sort((a, b) => (a.name || '').localeCompare(b.name || ''));

  res.json(result);
});

module.exports = router;
