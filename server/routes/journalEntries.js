'use strict';

const express = require('express');
const { db } = require('../db');

const router = express.Router();

function serializeEntry(row) {
  return {
    id: row.id,
    player_id: row.player_id,
    player_name: row.player_name,
    game_id: row.game_id,
    game_date: row.game_date,
    game_opponent: row.game_opponent,
    entry_date: row.entry_date,
    strengths: row.strengths,
    improvements: row.improvements,
    notes: row.notes,
    created_at: row.created_at,
  };
}

const SELECT_ENTRY = `
  SELECT je.*, p.name AS player_name, g.date AS game_date, g.opponent AS game_opponent
  FROM journal_entries je
  LEFT JOIN players p ON p.id = je.player_id
  LEFT JOIN games g ON g.id = je.game_id
`;

function getEntry(id) {
  return db.prepare(`${SELECT_ENTRY} WHERE je.id = ?`).get(id);
}

// player_id is nullable: a null entry applies to the whole team rather than
// one player. `?player_id=team` (a sentinel the frontend's "Whole team"
// option sends) filters to those; a numeric value filters to that player;
// omitting the param returns everything.
router.get('/', (req, res) => {
  let sql = SELECT_ENTRY;
  const params = [];
  if (req.query.player_id === 'team') {
    sql += ' WHERE je.player_id IS NULL';
  } else if (req.query.player_id) {
    sql += ' WHERE je.player_id = ?';
    params.push(req.query.player_id);
  }
  sql += ' ORDER BY COALESCE(je.entry_date, g.date) DESC, je.id DESC';
  res.json(db.prepare(sql).all(...params).map(serializeEntry));
});

router.post('/', (req, res) => {
  const {
    player_id = null,
    game_id = null,
    entry_date = null,
    strengths = null,
    improvements = null,
    notes = null,
  } = req.body || {};

  if (player_id && !db.prepare('SELECT id FROM players WHERE id = ?').get(player_id)) {
    return res.status(400).json({ error: 'player_id does not reference an existing player' });
  }
  if (game_id && !db.prepare('SELECT id FROM games WHERE id = ?').get(game_id)) {
    return res.status(400).json({ error: 'game_id does not reference an existing game' });
  }
  if ((game_id ? 1 : 0) + (entry_date ? 1 : 0) !== 1) {
    return res.status(400).json({ error: 'exactly one of game_id or entry_date is required' });
  }

  const result = db.prepare(
    'INSERT INTO journal_entries (player_id, game_id, entry_date, strengths, improvements, notes) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(player_id, game_id, entry_date, strengths, improvements, notes);

  res.status(201).json(serializeEntry(getEntry(Number(result.lastInsertRowid))));
});

router.put('/:id', (req, res) => {
  const existing = db.prepare('SELECT * FROM journal_entries WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Journal entry not found' });

  const {
    player_id = existing.player_id,
    game_id = existing.game_id,
    entry_date = existing.entry_date,
    strengths = existing.strengths,
    improvements = existing.improvements,
    notes = existing.notes,
  } = req.body || {};

  if (player_id && !db.prepare('SELECT id FROM players WHERE id = ?').get(player_id)) {
    return res.status(400).json({ error: 'player_id does not reference an existing player' });
  }
  if (game_id && !db.prepare('SELECT id FROM games WHERE id = ?').get(game_id)) {
    return res.status(400).json({ error: 'game_id does not reference an existing game' });
  }
  if ((game_id ? 1 : 0) + (entry_date ? 1 : 0) !== 1) {
    return res.status(400).json({ error: 'exactly one of game_id or entry_date is required' });
  }

  db.prepare(
    'UPDATE journal_entries SET player_id = ?, game_id = ?, entry_date = ?, strengths = ?, improvements = ?, notes = ? WHERE id = ?'
  ).run(player_id, game_id, entry_date, strengths, improvements, notes, existing.id);

  res.json(serializeEntry(getEntry(existing.id)));
});

router.delete('/:id', (req, res) => {
  const existing = db.prepare('SELECT id FROM journal_entries WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Journal entry not found' });
  db.prepare('DELETE FROM journal_entries WHERE id = ?').run(existing.id);
  res.status(204).end();
});

module.exports = router;
