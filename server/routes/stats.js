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
