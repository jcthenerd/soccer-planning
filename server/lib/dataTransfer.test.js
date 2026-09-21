'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

// Must be set before server/db.js is first required, so tests never touch
// the real data/soccer.db.
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'soccer-transfer-test-'));
process.env.SOCCER_DB_PATH = path.join(tmpDir, 'test.db');

const { db } = require('../db');
const app = require('../index');
const { exportData, importData, ImportError, TABLES } = require('./dataTransfer');

function insertSampleData() {
  db.exec(`
    INSERT INTO players (id, name, jersey_number, restrict_positions) VALUES (1, 'Ava', 7, 1), (2, 'Ben', 9, 0);
    INSERT INTO positions (id, name, sort_order) VALUES (1, 'Goalkeeper', 0), (2, 'Forward', 1);
    INSERT INTO player_position_eligibility (player_id, position_id) VALUES (1, 1);
    INSERT INTO formations (id, name) VALUES (1, '2v2');
    INSERT INTO formation_slots (formation_id, position_id, count, drop_priority) VALUES (1, 1, 1, NULL), (1, 2, 1, 1);
    INSERT INTO games (id, season_id, date, opponent, formation_id, opponent_goals)
      VALUES (1, (SELECT id FROM seasons LIMIT 1), '2026-09-01', 'Rivals', 1, 2);
    INSERT INTO game_attendance (game_id, player_id, available, goals) VALUES (1, 1, 1, 3), (1, 2, 1, 0);
    INSERT INTO quarters (id, game_id, quarter_number) VALUES (1, 1, 1);
    INSERT INTO assignments (quarter_id, player_id, position_id) VALUES (1, 1, 1), (1, 2, NULL);
  `);
}

function clearAll() {
  for (const table of [...TABLES].reverse()) db.exec(`DELETE FROM ${table}`);
}

function snapshot() {
  const { exportedAt, ...rest } = exportData();
  return rest;
}

test.before(insertSampleData);
test.after(() => {
  db.close();
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

test('export then import into an emptied database restores identical data', () => {
  const before = snapshot();
  const file = JSON.parse(JSON.stringify(exportData()));

  clearAll();
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM players').get().n, 0);

  importData(file);
  assert.deepEqual(snapshot(), before);
});

test('import replaces existing data rather than merging with it', () => {
  const file = JSON.parse(JSON.stringify(exportData()));
  db.prepare("INSERT INTO players (name) VALUES ('Extra')").run();

  importData(file);
  const names = db.prepare('SELECT name FROM players ORDER BY id').all().map((p) => p.name);
  assert.deepEqual(names, ['Ava', 'Ben']);
});

test('new rows after an import get ids above the imported ones', () => {
  importData(JSON.parse(JSON.stringify(exportData())));
  const { lastInsertRowid } = db.prepare("INSERT INTO players (name) VALUES ('New')").run();
  assert.equal(Number(lastInsertRowid), 3);
  db.prepare('DELETE FROM players WHERE id = 3').run();
});

test('import tolerates rows missing newer columns by using column defaults', () => {
  const file = JSON.parse(JSON.stringify(exportData()));
  for (const row of file.tables.game_attendance) delete row.goals;
  for (const row of file.tables.games) delete row.opponent_goals;

  importData(file);
  assert.equal(db.prepare('SELECT SUM(goals) AS n FROM game_attendance').get().n, 0);
  assert.equal(db.prepare('SELECT opponent_goals FROM games').get().opponent_goals, null);
});

test('invalid files are rejected and leave existing data untouched', () => {
  const before = snapshot();
  const good = JSON.parse(JSON.stringify(exportData()));

  const badFiles = [
    null,
    { format: 'something-else', version: 1, tables: {} },
    { ...good, version: 999 },
    { ...good, tables: { ...good.tables, players: 'nope' } },
    { ...good, tables: { ...good.tables, players: [{ name: { nested: true } }] } },
    // Passes shape validation but fails a foreign key mid-import (after the
    // wipe has already happened), so this checks the rollback.
    { ...good, tables: { ...good.tables, assignments: [{ quarter_id: 999, player_id: 1, position_id: null }] } },
  ];

  for (const file of badFiles) {
    assert.throws(() => importData(file), ImportError);
    assert.deepEqual(snapshot(), before);
  }
});

test('HTTP: export downloads as an attachment and import round-trips it', async (t) => {
  const server = app.listen(0);
  t.after(() => server.close());
  await new Promise((resolve) => server.on('listening', resolve));
  const base = `http://localhost:${server.address().port}`;

  const exportRes = await fetch(`${base}/api/data/export`);
  assert.equal(exportRes.status, 200);
  assert.match(exportRes.headers.get('content-disposition'), /^attachment; filename="soccer-planner-\d{4}-\d{2}-\d{2}\.json"$/);
  const file = await exportRes.json();

  // Larger than express.json()'s 100kb default to confirm the route's own limit applies.
  file.tables.players[0].notes = 'x'.repeat(200 * 1024);
  const importRes = await fetch(`${base}/api/data/import`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(file),
  });
  assert.equal(importRes.status, 200);
  assert.equal((await importRes.json()).imported.players, 2);

  const badRes = await fetch(`${base}/api/data/import`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ hello: 'world' }),
  });
  assert.equal(badRes.status, 400);
  assert.match((await badRes.json()).error, /not a Soccer Planner export/);
});
