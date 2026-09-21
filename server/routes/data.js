'use strict';

const express = require('express');
const { exportData, importData, ImportError } = require('../lib/dataTransfer');

const router = express.Router();

router.get('/export', (req, res) => {
  const date = new Date().toISOString().slice(0, 10);
  res.set('Content-Disposition', `attachment; filename="soccer-planner-${date}.json"`);
  res.json(exportData());
});

// Exports include every game and assignment, so they can dwarf express.json()'s
// 100kb default; this route parses its own body (and is mounted before the
// global parser in server/index.js).
router.post('/import', express.json({ limit: '50mb' }), (req, res) => {
  try {
    res.json({ imported: importData(req.body) });
  } catch (err) {
    if (err instanceof ImportError) return res.status(400).json({ error: err.message });
    throw err;
  }
});

module.exports = router;
