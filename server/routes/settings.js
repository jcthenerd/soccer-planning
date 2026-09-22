'use strict';

const express = require('express');
const { db } = require('../db');

const router = express.Router();

const FIELDS = ['region', 'division', 'team_name', 'team_colors', 'coach_name', 'assistant_coach_name'];

router.get('/team', (req, res) => {
  res.json(db.prepare('SELECT * FROM team_settings WHERE id = 1').get());
});

router.put('/team', (req, res) => {
  const existing = db.prepare('SELECT * FROM team_settings WHERE id = 1').get();
  const body = req.body || {};
  const next = Object.fromEntries(FIELDS.map((f) => [f, Object.hasOwn(body, f) ? (body[f] || null) : existing[f]]));

  db.prepare(`
    UPDATE team_settings SET ${FIELDS.map((f) => `${f} = ?`).join(', ')} WHERE id = 1
  `).run(...FIELDS.map((f) => next[f]));

  res.json(db.prepare('SELECT * FROM team_settings WHERE id = 1').get());
});

module.exports = router;
