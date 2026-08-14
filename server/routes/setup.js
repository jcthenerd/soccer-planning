'use strict';

const express = require('express');
const { db, transaction } = require('../db');
const { AGE_GROUP_PRESETS, STANDARD_POSITIONS, getAgeGroup } = require('../lib/formationPresets');

const router = express.Router();

router.get('/status', (req, res) => {
  const { n } = db.prepare('SELECT COUNT(*) AS n FROM positions').get();
  res.json({ needsSetup: n === 0 });
});

router.get('/presets', (req, res) => {
  res.json(AGE_GROUP_PRESETS);
});

function ensureStandardPositions() {
  const byName = new Map(
    db.prepare('SELECT * FROM positions').all().map((p) => [p.name.toLowerCase(), p])
  );
  const insert = db.prepare('INSERT INTO positions (name, sort_order) VALUES (?, ?)');
  let created = 0;
  for (const pos of STANDARD_POSITIONS) {
    if (!byName.has(pos.name.toLowerCase())) {
      const id = Number(insert.run(pos.name, pos.sort_order).lastInsertRowid);
      byName.set(pos.name.toLowerCase(), { id, name: pos.name, sort_order: pos.sort_order });
      created += 1;
    }
  }
  return { byName, created };
}

router.post('/apply', (req, res) => {
  const { ageGroup = null } = req.body || {};
  const group = ageGroup ? getAgeGroup(ageGroup) : null;
  if (ageGroup && !group) {
    return res.status(400).json({ error: `Unknown age group "${ageGroup}"` });
  }

  const result = transaction(() => {
    const { byName: positionsByName, created: positionsCreated } = ensureStandardPositions();
    let formationsCreated = 0;

    if (group) {
      const existingNames = new Set(
        db.prepare('SELECT name FROM formations').all().map((f) => f.name)
      );
      const insertFormation = db.prepare('INSERT INTO formations (name, description) VALUES (?, ?)');
      const insertSlot = db.prepare(
        'INSERT INTO formation_slots (formation_id, position_id, count, drop_priority) VALUES (?, ?, ?, ?)'
      );

      for (const formation of group.formations) {
        if (existingNames.has(formation.name)) continue;
        const formationId = Number(insertFormation.run(formation.name, formation.description).lastInsertRowid);
        for (const slot of formation.slots) {
          const position = positionsByName.get(slot.position.toLowerCase());
          insertSlot.run(formationId, position.id, slot.count, slot.drop_priority ?? null);
        }
        formationsCreated += 1;
      }
    }

    return { positionsCreated, formationsCreated };
  });

  res.status(201).json(result);
});

module.exports = router;
