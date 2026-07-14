'use strict';

const express = require('express');
const { db, transaction } = require('../db');

const router = express.Router();

function getEligibility(playerId) {
  return db.prepare(
    'SELECT position_id FROM player_position_eligibility WHERE player_id = ? ORDER BY position_id'
  ).all(playerId).map((row) => row.position_id);
}

function setEligibility(playerId, positionIds) {
  db.prepare('DELETE FROM player_position_eligibility WHERE player_id = ?').run(playerId);
  const insert = db.prepare(
    'INSERT INTO player_position_eligibility (player_id, position_id) VALUES (?, ?)'
  );
  for (const positionId of positionIds) {
    insert.run(playerId, positionId);
  }
}

function serializePlayer(row) {
  return {
    id: row.id,
    name: row.name,
    jersey_number: row.jersey_number,
    active: !!row.active,
    restrict_positions: !!row.restrict_positions,
    notes: row.notes,
    created_at: row.created_at,
    eligible_position_ids: getEligibility(row.id),
  };
}

router.get('/', (req, res) => {
  let sql = 'SELECT * FROM players';
  if (req.query.active === '1' || req.query.active === 'true') {
    sql += ' WHERE active = 1';
  } else if (req.query.active === '0' || req.query.active === 'false') {
    sql += ' WHERE active = 0';
  }
  sql += ' ORDER BY name';
  res.json(db.prepare(sql).all().map(serializePlayer));
});

router.post('/', (req, res) => {
  const {
    name,
    jersey_number = null,
    notes = null,
    restrict_positions = false,
    eligible_position_ids = [],
  } = req.body || {};

  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'name is required' });
  }

  const id = transaction(() => {
    const result = db.prepare(
      'INSERT INTO players (name, jersey_number, restrict_positions, notes) VALUES (?, ?, ?, ?)'
    ).run(name.trim(), jersey_number, restrict_positions ? 1 : 0, notes);
    const playerId = Number(result.lastInsertRowid);
    setEligibility(playerId, eligible_position_ids);
    return playerId;
  });

  res.status(201).json(serializePlayer(db.prepare('SELECT * FROM players WHERE id = ?').get(id)));
});

router.get('/:id', (req, res) => {
  const row = db.prepare('SELECT * FROM players WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Player not found' });
  res.json(serializePlayer(row));
});

router.put('/:id', (req, res) => {
  const existing = db.prepare('SELECT * FROM players WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Player not found' });

  const {
    name = existing.name,
    jersey_number = existing.jersey_number,
    notes = existing.notes,
    restrict_positions = !!existing.restrict_positions,
    eligible_position_ids,
  } = req.body || {};

  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'name is required' });
  }

  transaction(() => {
    db.prepare(
      'UPDATE players SET name = ?, jersey_number = ?, notes = ?, restrict_positions = ? WHERE id = ?'
    ).run(name.trim(), jersey_number, notes, restrict_positions ? 1 : 0, existing.id);
    if (eligible_position_ids !== undefined) {
      setEligibility(existing.id, eligible_position_ids);
    }
  });

  res.json(serializePlayer(db.prepare('SELECT * FROM players WHERE id = ?').get(existing.id)));
});

router.patch('/:id/active', (req, res) => {
  const existing = db.prepare('SELECT * FROM players WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Player not found' });

  const { active } = req.body || {};
  if (typeof active !== 'boolean') {
    return res.status(400).json({ error: 'active (boolean) is required' });
  }

  db.prepare('UPDATE players SET active = ? WHERE id = ?').run(active ? 1 : 0, existing.id);
  res.json(serializePlayer(db.prepare('SELECT * FROM players WHERE id = ?').get(existing.id)));
});

module.exports = router;
