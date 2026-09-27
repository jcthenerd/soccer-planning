'use strict';

const express = require('express');
const { db } = require('../db');

const router = express.Router();

const FIELDS = ['region', 'division', 'team_name', 'team_colors', 'coach_name', 'assistant_coach_name'];

// Where the lineup PDF puts per-player tracker columns: alongside the main
// roster grid, or on their own page (together with Coach Notes).
const TRACKER_LAYOUTS = ['inline', 'separate_page'];

router.get('/team', (req, res) => {
  res.json(db.prepare('SELECT * FROM team_settings WHERE id = 1').get());
});

router.put('/team', (req, res) => {
  const existing = db.prepare('SELECT * FROM team_settings WHERE id = 1').get();
  const body = req.body || {};

  if (Object.hasOwn(body, 'tracker_layout') && !TRACKER_LAYOUTS.includes(body.tracker_layout)) {
    return res.status(400).json({ error: `tracker_layout must be one of: ${TRACKER_LAYOUTS.join(', ')}` });
  }
  const trackerLayout = Object.hasOwn(body, 'tracker_layout') ? body.tracker_layout : existing.tracker_layout;

  const next = Object.fromEntries(FIELDS.map((f) => [f, Object.hasOwn(body, f) ? (body[f] || null) : existing[f]]));

  db.prepare(`
    UPDATE team_settings SET ${FIELDS.map((f) => `${f} = ?`).join(', ')}, tracker_layout = ? WHERE id = 1
  `).run(...FIELDS.map((f) => next[f]), trackerLayout);

  res.json(db.prepare('SELECT * FROM team_settings WHERE id = 1').get());
});

module.exports = router;
