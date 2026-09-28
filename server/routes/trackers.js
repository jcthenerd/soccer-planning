'use strict';

const express = require('express');
const { db } = require('../db');

const router = express.Router();

router.get('/', (req, res) => {
  res.json(db.prepare('SELECT * FROM trackers ORDER BY sort_order, name').all());
});

router.post('/', (req, res) => {
  const { name, sort_order = 0 } = req.body || {};
  if (!name || !name.trim()) return res.status(400).json({ error: 'name is required' });
  const result = db.prepare('INSERT INTO trackers (name, sort_order) VALUES (?, ?)')
    .run(name.trim(), sort_order);
  res.status(201).json(db.prepare('SELECT * FROM trackers WHERE id = ?').get(result.lastInsertRowid));
});

router.put('/:id', (req, res) => {
  const existing = db.prepare('SELECT * FROM trackers WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Tracker not found' });
  const { name = existing.name, sort_order = existing.sort_order } = req.body || {};
  if (!name || !name.trim()) return res.status(400).json({ error: 'name is required' });
  db.prepare('UPDATE trackers SET name = ?, sort_order = ? WHERE id = ?')
    .run(name.trim(), sort_order, existing.id);
  res.json(db.prepare('SELECT * FROM trackers WHERE id = ?').get(existing.id));
});

router.delete('/:id', (req, res) => {
  const existing = db.prepare('SELECT * FROM trackers WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Tracker not found' });
  db.prepare('DELETE FROM trackers WHERE id = ?').run(existing.id);
  res.status(204).end();
});

module.exports = router;
