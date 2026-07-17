'use strict';

const express = require('express');
const { db, transaction } = require('../db');
const { generatePlan } = require('../lib/planGenerator');
const { computeSeasonState } = require('../lib/seasonStats');

const router = express.Router();

function serializeGame(row) {
  return {
    id: row.id,
    season_id: row.season_id,
    date: row.date,
    opponent: row.opponent,
    formation_id: row.formation_id,
    num_quarters: row.num_quarters,
    notes: row.notes,
    opponent_goals: row.opponent_goals,
  };
}

function getGameDetail(gameId) {
  const game = db.prepare(`
    SELECT g.*, f.name AS formation_name
    FROM games g JOIN formations f ON f.id = g.formation_id
    WHERE g.id = ?
  `).get(gameId);
  if (!game) return null;

  const attendance = db.prepare(`
    SELECT ga.player_id, p.name, p.jersey_number, ga.available, ga.goals
    FROM game_attendance ga JOIN players p ON p.id = ga.player_id
    WHERE ga.game_id = ?
    ORDER BY p.name
  `).all(gameId);

  const quarters = db.prepare('SELECT * FROM quarters WHERE game_id = ? ORDER BY quarter_number').all(gameId);

  const assignments = db.prepare(`
    SELECT a.quarter_id, a.player_id, a.position_id, pos.name AS position_name
    FROM assignments a
    JOIN quarters q ON q.id = a.quarter_id
    LEFT JOIN positions pos ON pos.id = a.position_id
    WHERE q.game_id = ?
  `).all(gameId);

  return {
    ...serializeGame(game),
    formation_name: game.formation_name,
    attendance: attendance.map((a) => ({
      player_id: a.player_id,
      name: a.name,
      jersey_number: a.jersey_number,
      available: !!a.available,
      goals: a.goals,
    })),
    quarters: quarters.map((q) => ({ id: q.id, quarter_number: q.quarter_number })),
    assignments: assignments.map((a) => ({
      quarter_id: a.quarter_id,
      player_id: a.player_id,
      position_id: a.position_id,
      position_name: a.position_name,
    })),
  };
}

router.get('/', (req, res) => {
  let sql = `
    SELECT g.*, f.name AS formation_name
    FROM games g
    JOIN formations f ON f.id = g.formation_id
  `;
  const params = [];
  if (req.query.season_id) {
    sql += ' WHERE g.season_id = ?';
    params.push(req.query.season_id);
  }
  sql += ' ORDER BY g.date DESC, g.id DESC';
  const rows = db.prepare(sql).all(...params);
  res.json(rows.map((row) => ({ ...serializeGame(row), formation_name: row.formation_name })));
});

router.post('/', (req, res) => {
  const { season_id, date, opponent = null, formation_id, num_quarters = 4, notes = null } = req.body || {};
  if (!season_id) return res.status(400).json({ error: 'season_id is required' });
  if (!date) return res.status(400).json({ error: 'date is required' });
  if (!formation_id) return res.status(400).json({ error: 'formation_id is required' });
  if (!Number.isInteger(num_quarters) || num_quarters < 1) {
    return res.status(400).json({ error: 'num_quarters must be a positive integer' });
  }

  const id = transaction(() => {
    const result = db.prepare(
      'INSERT INTO games (season_id, date, opponent, formation_id, num_quarters, notes) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(season_id, date, opponent, formation_id, num_quarters, notes);
    const gameId = Number(result.lastInsertRowid);

    const insertQuarter = db.prepare('INSERT INTO quarters (game_id, quarter_number) VALUES (?, ?)');
    for (let q = 1; q <= num_quarters; q++) {
      insertQuarter.run(gameId, q);
    }

    const activePlayers = db.prepare('SELECT id FROM players WHERE active = 1').all();
    const insertAttendance = db.prepare(
      'INSERT INTO game_attendance (game_id, player_id, available) VALUES (?, ?, 1)'
    );
    for (const player of activePlayers) {
      insertAttendance.run(gameId, player.id);
    }

    return gameId;
  });

  res.status(201).json(getGameDetail(id));
});

router.get('/:id', (req, res) => {
  const detail = getGameDetail(req.params.id);
  if (!detail) return res.status(404).json({ error: 'Game not found' });
  res.json(detail);
});

router.put('/:id', (req, res) => {
  const existing = db.prepare('SELECT * FROM games WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Game not found' });

  const {
    date = existing.date,
    opponent = existing.opponent,
    formation_id = existing.formation_id,
    num_quarters = existing.num_quarters,
    notes = existing.notes,
  } = req.body || {};

  if (!date) return res.status(400).json({ error: 'date is required' });
  if (!Number.isInteger(num_quarters) || num_quarters < 1) {
    return res.status(400).json({ error: 'num_quarters must be a positive integer' });
  }

  transaction(() => {
    db.prepare(
      'UPDATE games SET date = ?, opponent = ?, formation_id = ?, num_quarters = ?, notes = ? WHERE id = ?'
    ).run(date, opponent, formation_id, num_quarters, notes, existing.id);

    if (num_quarters !== existing.num_quarters) {
      if (num_quarters > existing.num_quarters) {
        const insertQuarter = db.prepare('INSERT INTO quarters (game_id, quarter_number) VALUES (?, ?)');
        for (let q = existing.num_quarters + 1; q <= num_quarters; q++) {
          insertQuarter.run(existing.id, q);
        }
      } else {
        db.prepare('DELETE FROM quarters WHERE game_id = ? AND quarter_number > ?')
          .run(existing.id, num_quarters);
      }
    }
  });

  res.json(getGameDetail(existing.id));
});

router.delete('/:id', (req, res) => {
  const existing = db.prepare('SELECT * FROM games WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Game not found' });
  db.prepare('DELETE FROM games WHERE id = ?').run(existing.id);
  res.status(204).end();
});

router.get('/:id/attendance', (req, res) => {
  const existing = db.prepare('SELECT id FROM games WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Game not found' });
  const attendance = db.prepare(`
    SELECT ga.player_id, p.name, p.jersey_number, ga.available, ga.goals
    FROM game_attendance ga JOIN players p ON p.id = ga.player_id
    WHERE ga.game_id = ?
    ORDER BY p.name
  `).all(existing.id);
  res.json(attendance.map((a) => ({ ...a, available: !!a.available })));
});

router.put('/:id/attendance', (req, res) => {
  const existing = db.prepare('SELECT id FROM games WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Game not found' });
  const { attendance } = req.body || {};
  if (!Array.isArray(attendance)) {
    return res.status(400).json({ error: 'attendance array is required' });
  }

  transaction(() => {
    const upsert = db.prepare(`
      INSERT INTO game_attendance (game_id, player_id, available)
      VALUES (?, ?, ?)
      ON CONFLICT(game_id, player_id) DO UPDATE SET available = excluded.available
    `);
    for (const entry of attendance) {
      upsert.run(existing.id, entry.player_id, entry.available ? 1 : 0);
    }
  });

  res.json(getGameDetail(existing.id).attendance);
});

router.put('/:id/goals', (req, res) => {
  const existing = db.prepare('SELECT id FROM games WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Game not found' });
  const { goals, opponent_goals } = req.body || {};
  if (!Array.isArray(goals)) {
    return res.status(400).json({ error: 'goals array is required' });
  }
  for (const entry of goals) {
    if (!Number.isInteger(entry.goals) || entry.goals < 0) {
      return res.status(400).json({ error: 'each entry needs a non-negative integer goals count' });
    }
  }
  if (opponent_goals !== null && opponent_goals !== undefined) {
    if (!Number.isInteger(opponent_goals) || opponent_goals < 0) {
      return res.status(400).json({ error: 'opponent_goals must be a non-negative integer or null' });
    }
  }

  transaction(() => {
    const update = db.prepare('UPDATE game_attendance SET goals = ? WHERE game_id = ? AND player_id = ?');
    for (const entry of goals) {
      update.run(entry.goals, existing.id, entry.player_id);
    }
    if (opponent_goals !== undefined) {
      db.prepare('UPDATE games SET opponent_goals = ? WHERE id = ?').run(opponent_goals, existing.id);
    }
  });

  res.json(getGameDetail(existing.id));
});

function getFormationSlots(formationId) {
  return db.prepare(
    'SELECT position_id, count, drop_priority FROM formation_slots WHERE formation_id = ?'
  ).all(formationId);
}

function getEligibilityMap(playerIds) {
  if (playerIds.length === 0) return {};
  const placeholders = playerIds.map(() => '?').join(',');
  const restricted = db.prepare(
    `SELECT id FROM players WHERE id IN (${placeholders}) AND restrict_positions = 1`
  ).all(...playerIds);
  const restrictedIds = new Set(restricted.map((r) => r.id));
  if (restrictedIds.size === 0) return {};

  const rows = db.prepare(
    `SELECT player_id, position_id FROM player_position_eligibility WHERE player_id IN (${placeholders})`
  ).all(...playerIds);

  const eligibility = {};
  for (const id of restrictedIds) eligibility[id] = [];
  for (const row of rows) {
    if (restrictedIds.has(row.player_id)) eligibility[row.player_id].push(row.position_id);
  }
  return eligibility;
}

router.post('/:id/generate-plan', (req, res) => {
  const game = db.prepare('SELECT * FROM games WHERE id = ?').get(req.params.id);
  if (!game) return res.status(404).json({ error: 'Game not found' });

  const attendance = db.prepare('SELECT player_id, available FROM game_attendance WHERE game_id = ?').all(game.id);
  const availablePlayerIds = attendance.filter((a) => a.available).map((a) => a.player_id);
  if (availablePlayerIds.length === 0) {
    return res.status(400).json({ error: 'No players are marked available for this game' });
  }

  const formationSlots = getFormationSlots(game.formation_id);
  const eligibility = getEligibilityMap(availablePlayerIds);
  const prior = computeSeasonState(game.season_id, { beforeGame: { id: game.id, date: game.date } });

  const plan = generatePlan({
    availablePlayerIds,
    formationSlots,
    numQuarters: game.num_quarters,
    eligibility,
    priorStats: prior.stats,
    priorPairCounts: prior.pairCounts,
    priorBenchStreaks: prior.benchStreaks,
  });

  const quarterRows = db.prepare(
    'SELECT id, quarter_number FROM quarters WHERE game_id = ? ORDER BY quarter_number'
  ).all(game.id);
  const quarterIdByNumber = new Map(quarterRows.map((q) => [q.quarter_number, q.id]));

  const positionNameById = new Map(db.prepare('SELECT id, name FROM positions').all().map((p) => [p.id, p.name]));
  const playerNameById = new Map(db.prepare('SELECT id, name FROM players').all().map((p) => [p.id, p.name]));

  const quarters = plan.quarters.map((q) => ({
    quarter_id: quarterIdByNumber.get(q.quarter_number),
    quarter_number: q.quarter_number,
    assignments: q.assignments.map((a) => ({
      player_id: a.player_id,
      player_name: playerNameById.get(a.player_id),
      position_id: a.position_id,
      position_name: positionNameById.get(a.position_id),
    })),
    bench: q.bench.map((playerId) => ({ player_id: playerId, player_name: playerNameById.get(playerId) })),
  }));

  res.json({ quarters });
});

router.put('/:id/plan', (req, res) => {
  const game = db.prepare('SELECT * FROM games WHERE id = ?').get(req.params.id);
  if (!game) return res.status(404).json({ error: 'Game not found' });

  const { quarters } = req.body || {};
  if (!Array.isArray(quarters)) {
    return res.status(400).json({ error: 'quarters array is required' });
  }

  const quarterRows = db.prepare('SELECT id, quarter_number FROM quarters WHERE game_id = ?').all(game.id);
  const quarterIdByNumber = new Map(quarterRows.map((q) => [q.quarter_number, q.id]));

  const availableIds = new Set(
    db.prepare('SELECT player_id FROM game_attendance WHERE game_id = ? AND available = 1')
      .all(game.id).map((r) => r.player_id)
  );

  for (const q of quarters) {
    if (!quarterIdByNumber.has(q.quarter_number)) {
      return res.status(400).json({ error: `Unknown quarter_number ${q.quarter_number}` });
    }
    const covered = new Set([...(q.assignments || []).map((a) => a.player_id), ...(q.bench || [])]);
    if (covered.size !== availableIds.size || [...availableIds].some((id) => !covered.has(id))) {
      return res.status(400).json({
        error: `Quarter ${q.quarter_number} must include every currently available player exactly once`,
      });
    }
  }

  transaction(() => {
    for (const q of quarters) {
      const quarterId = quarterIdByNumber.get(q.quarter_number);
      db.prepare('DELETE FROM assignments WHERE quarter_id = ?').run(quarterId);
      const insert = db.prepare('INSERT INTO assignments (quarter_id, player_id, position_id) VALUES (?, ?, ?)');
      for (const a of q.assignments || []) {
        insert.run(quarterId, a.player_id, a.position_id);
      }
      for (const playerId of q.bench || []) {
        insert.run(quarterId, playerId, null);
      }
    }
  });

  res.json(getGameDetail(game.id));
});

module.exports = router;
