'use strict';

const express = require('express');
const fs = require('node:fs');
const path = require('node:path');

require('./db'); // ensures schema + seed run on startup

const playersRouter = require('./routes/players');
const positionsRouter = require('./routes/positions');
const formationsRouter = require('./routes/formations');
const seasonsRouter = require('./routes/seasons');
const gamesRouter = require('./routes/games');
const journalEntriesRouter = require('./routes/journalEntries');
const statsRouter = require('./routes/stats');
const setupRouter = require('./routes/setup');
const dataRouter = require('./routes/data');
const settingsRouter = require('./routes/settings');

const app = express();
// Mounted before the global JSON parser: the import route needs a larger body
// limit than the 100kb default.
app.use('/api/data', dataRouter);
app.use(express.json());

app.use('/api/players', playersRouter);
app.use('/api/positions', positionsRouter);
app.use('/api/formations', formationsRouter);
app.use('/api/seasons', seasonsRouter);
app.use('/api/games', gamesRouter);
app.use('/api/journal-entries', journalEntriesRouter);
app.use('/api/stats', statsRouter);
app.use('/api/setup', setupRouter);
app.use('/api/settings', settingsRouter);

// React app build. Run `npm run build` (root or react-client/) to
// (re)generate dist/ after changing react-client/src.
const clientDist = path.join(__dirname, '..', 'react-client', 'dist');
const clientIndex = path.join(clientDist, 'index.html');
app.use(express.static(clientDist));
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api/')) return next();
  if (!fs.existsSync(clientIndex)) {
    return res
      .status(503)
      .send('React client is not built yet. Run "npm run build" in react-client/, then restart the server.');
  }
  res.sendFile(clientIndex);
});

app.use((err, req, res, next) => {
  const message = err && err.message ? err.message : '';
  if (message.includes('FOREIGN KEY constraint failed')) {
    return res.status(409).json({ error: 'This item is referenced by other records and cannot be modified.' });
  }
  if (message.includes('UNIQUE constraint failed')) {
    return res.status(409).json({ error: 'Conflicts with an existing record.' });
  }
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

module.exports = app;

if (require.main === module) {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`Soccer planner running at http://localhost:${PORT}`);
  });
}
