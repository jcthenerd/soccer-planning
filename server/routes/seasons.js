'use strict';

const express = require('express');
const { db, transaction } = require('../db');

const router = express.Router();

router.get('/', (req, res) => {
  res.json(db.prepare('SELECT * FROM seasons ORDER BY year DESC, name').all());
});

router.post('/', (req, res) => {
  const { name, year = null, is_active = false } = req.body || {};
  if (!name || !name.trim()) return res.status(400).json({ error: 'name is required' });

  const id = transaction(() => {
    if (is_active) {
      db.prepare('UPDATE seasons SET is_active = 0 WHERE is_active = 1').run();
    }
    const result = db.prepare('INSERT INTO seasons (name, year, is_active) VALUES (?, ?, ?)')
      .run(name.trim(), year, is_active ? 1 : 0);
    return Number(result.lastInsertRowid);
  });

  res.status(201).json(db.prepare('SELECT * FROM seasons WHERE id = ?').get(id));
});

router.put('/:id', (req, res) => {
  const existing = db.prepare('SELECT * FROM seasons WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Season not found' });
  const { name = existing.name, year = existing.year, is_active } = req.body || {};
  if (!name || !name.trim()) return res.status(400).json({ error: 'name is required' });

  transaction(() => {
    if (is_active === true) {
      db.prepare('UPDATE seasons SET is_active = 0 WHERE is_active = 1 AND id != ?').run(existing.id);
    }
    const nextActive = is_active === undefined ? existing.is_active : (is_active ? 1 : 0);
    db.prepare('UPDATE seasons SET name = ?, year = ?, is_active = ? WHERE id = ?')
      .run(name.trim(), year, nextActive, existing.id);
  });

  res.json(db.prepare('SELECT * FROM seasons WHERE id = ?').get(existing.id));
});

router.delete('/:id', (req, res) => {
  const existing = db.prepare('SELECT * FROM seasons WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Season not found' });
  db.prepare('DELETE FROM seasons WHERE id = ?').run(existing.id);
  res.status(204).end();
});

module.exports = router;
