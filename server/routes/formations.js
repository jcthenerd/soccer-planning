'use strict';

const express = require('express');
const { db, transaction } = require('../db');

const router = express.Router();

function getSlots(formationId) {
  return db.prepare(`
    SELECT fs.id, fs.position_id, p.name AS position_name, fs.count, fs.drop_priority
    FROM formation_slots fs
    JOIN positions p ON p.id = fs.position_id
    WHERE fs.formation_id = ?
    ORDER BY p.sort_order, p.name
  `).all(formationId);
}

function serializeFormation(row) {
  const slots = getSlots(row.id);
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    slots,
    total_field_slots: slots.reduce((sum, s) => sum + s.count, 0),
  };
}

function replaceSlots(formationId, slots) {
  db.prepare('DELETE FROM formation_slots WHERE formation_id = ?').run(formationId);
  const insert = db.prepare(
    'INSERT INTO formation_slots (formation_id, position_id, count, drop_priority) VALUES (?, ?, ?, ?)'
  );
  for (const slot of slots) {
    insert.run(formationId, slot.position_id, slot.count ?? 1, slot.drop_priority ?? null);
  }
}

router.get('/', (req, res) => {
  res.json(db.prepare('SELECT * FROM formations ORDER BY name').all().map(serializeFormation));
});

router.post('/', (req, res) => {
  const { name, description = null, slots = [] } = req.body || {};
  if (!name || !name.trim()) return res.status(400).json({ error: 'name is required' });
  if (!Array.isArray(slots) || slots.length === 0) {
    return res.status(400).json({ error: 'at least one slot is required' });
  }

  const id = transaction(() => {
    const result = db.prepare('INSERT INTO formations (name, description) VALUES (?, ?)')
      .run(name.trim(), description);
    const formationId = Number(result.lastInsertRowid);
    replaceSlots(formationId, slots);
    return formationId;
  });

  res.status(201).json(serializeFormation(db.prepare('SELECT * FROM formations WHERE id = ?').get(id)));
});

router.get('/:id', (req, res) => {
  const row = db.prepare('SELECT * FROM formations WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Formation not found' });
  res.json(serializeFormation(row));
});

router.put('/:id', (req, res) => {
  const existing = db.prepare('SELECT * FROM formations WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Formation not found' });
  const { name = existing.name, description = existing.description, slots } = req.body || {};
  if (!name || !name.trim()) return res.status(400).json({ error: 'name is required' });

  transaction(() => {
    db.prepare('UPDATE formations SET name = ?, description = ? WHERE id = ?')
      .run(name.trim(), description, existing.id);
    if (Array.isArray(slots)) {
      replaceSlots(existing.id, slots);
    }
  });

  res.json(serializeFormation(db.prepare('SELECT * FROM formations WHERE id = ?').get(existing.id)));
});

router.delete('/:id', (req, res) => {
  const existing = db.prepare('SELECT * FROM formations WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Formation not found' });
  db.prepare('DELETE FROM formations WHERE id = ?').run(existing.id);
  res.status(204).end();
});

module.exports = router;
