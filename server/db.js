'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');

const DB_PATH = process.env.SOCCER_DB_PATH || path.join(__dirname, '..', 'data', 'soccer.db');

fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

const db = new DatabaseSync(DB_PATH);

db.exec('PRAGMA journal_mode = WAL');
db.exec('PRAGMA foreign_keys = ON');

db.exec(`
CREATE TABLE IF NOT EXISTS players (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  jersey_number INTEGER,
  active INTEGER NOT NULL DEFAULT 1,
  restrict_positions INTEGER NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS positions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS player_position_eligibility (
  player_id INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  position_id INTEGER NOT NULL REFERENCES positions(id) ON DELETE CASCADE,
  PRIMARY KEY (player_id, position_id)
);

CREATE TABLE IF NOT EXISTS formations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  description TEXT
);

CREATE TABLE IF NOT EXISTS formation_slots (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  formation_id INTEGER NOT NULL REFERENCES formations(id) ON DELETE CASCADE,
  position_id INTEGER NOT NULL REFERENCES positions(id) ON DELETE RESTRICT,
  count INTEGER NOT NULL DEFAULT 1,
  drop_priority INTEGER
);

CREATE TABLE IF NOT EXISTS seasons (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  year INTEGER,
  is_active INTEGER NOT NULL DEFAULT 0
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_seasons_one_active
  ON seasons(is_active) WHERE is_active = 1;

CREATE TABLE IF NOT EXISTS games (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  season_id INTEGER NOT NULL REFERENCES seasons(id) ON DELETE RESTRICT,
  date TEXT NOT NULL,
  opponent TEXT,
  formation_id INTEGER NOT NULL REFERENCES formations(id) ON DELETE RESTRICT,
  num_quarters INTEGER NOT NULL DEFAULT 4,
  notes TEXT
);

CREATE TABLE IF NOT EXISTS game_attendance (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  game_id INTEGER NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  player_id INTEGER NOT NULL REFERENCES players(id) ON DELETE RESTRICT,
  available INTEGER NOT NULL DEFAULT 1,
  UNIQUE(game_id, player_id)
);

CREATE TABLE IF NOT EXISTS quarters (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  game_id INTEGER NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  quarter_number INTEGER NOT NULL,
  UNIQUE(game_id, quarter_number)
);

CREATE TABLE IF NOT EXISTS assignments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  quarter_id INTEGER NOT NULL REFERENCES quarters(id) ON DELETE CASCADE,
  player_id INTEGER NOT NULL REFERENCES players(id) ON DELETE RESTRICT,
  position_id INTEGER REFERENCES positions(id) ON DELETE RESTRICT,
  UNIQUE(quarter_id, player_id)
);
`);

function seed() {
  const { n: posCount } = db.prepare('SELECT COUNT(*) AS n FROM positions').get();
  if (posCount > 0) return;

  const insertPosition = db.prepare('INSERT INTO positions (name, sort_order) VALUES (?, ?)');
  const gk = Number(insertPosition.run('Goalkeeper', 0).lastInsertRowid);
  const def = Number(insertPosition.run('Defender', 1).lastInsertRowid);
  const fwd = Number(insertPosition.run('Forward', 2).lastInsertRowid);

  const formationId = Number(
    db.prepare('INSERT INTO formations (name, description) VALUES (?, ?)')
      .run('5v5 Standard', '1 Goalkeeper, 2 Defenders, 2 Forwards').lastInsertRowid
  );

  const insertSlot = db.prepare(
    'INSERT INTO formation_slots (formation_id, position_id, count, drop_priority) VALUES (?, ?, ?, ?)'
  );
  insertSlot.run(formationId, gk, 1, null); // never drop the goalkeeper slot
  insertSlot.run(formationId, def, 2, 2);
  insertSlot.run(formationId, fwd, 2, 1); // drop a forward before a defender if short-handed

  const year = new Date().getFullYear();
  db.prepare('INSERT INTO seasons (name, year, is_active) VALUES (?, ?, 1)')
    .run(`${year} Season`, year);
}

function migrate() {
  const attendanceColumns = db.prepare("PRAGMA table_info(game_attendance)").all();
  if (!attendanceColumns.some((c) => c.name === 'goals')) {
    db.exec('ALTER TABLE game_attendance ADD COLUMN goals INTEGER NOT NULL DEFAULT 0');
  }

  const gameColumns = db.prepare("PRAGMA table_info(games)").all();
  if (!gameColumns.some((c) => c.name === 'opponent_goals')) {
    db.exec('ALTER TABLE games ADD COLUMN opponent_goals INTEGER');
  }
}

seed();
migrate();

function transaction(fn) {
  db.exec('BEGIN');
  try {
    const result = fn();
    db.exec('COMMIT');
    return result;
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
}

module.exports = { db, transaction };
