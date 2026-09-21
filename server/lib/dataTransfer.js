'use strict';

const { db, transaction } = require('../db');

const FORMAT = 'soccer-planner-export';
const VERSION = 1;

// Parents before children: inserts run in this order, deletes in reverse, so
// foreign keys stay satisfied without having to toggle PRAGMA foreign_keys
// (which can't be changed inside a transaction).
const TABLES = [
  'players',
  'positions',
  'player_position_eligibility',
  'formations',
  'formation_slots',
  'seasons',
  'games',
  'game_attendance',
  'quarters',
  'assignments',
];

class ImportError extends Error {}

function exportData() {
  const tables = {};
  for (const table of TABLES) {
    tables[table] = db.prepare(`SELECT * FROM ${table}`).all();
  }
  return { format: FORMAT, version: VERSION, exportedAt: new Date().toISOString(), tables };
}

function validate(payload) {
  if (!payload || payload.format !== FORMAT) {
    throw new ImportError('This file is not a Soccer Planner export.');
  }
  if (!Number.isInteger(payload.version) || payload.version < 1) {
    throw new ImportError('This export file has an invalid version.');
  }
  if (payload.version > VERSION) {
    throw new ImportError('This export was made by a newer version of Soccer Planner. Update the app and try again.');
  }
  if (!payload.tables || typeof payload.tables !== 'object') {
    throw new ImportError('This export file is missing its data.');
  }
  for (const table of TABLES) {
    const rows = payload.tables[table];
    if (!Array.isArray(rows)) {
      throw new ImportError(`This export file is missing the "${table}" table.`);
    }
    for (const row of rows) {
      if (!row || typeof row !== 'object' || Array.isArray(row)) {
        throw new ImportError(`The "${table}" table contains a malformed row.`);
      }
      for (const value of Object.values(row)) {
        if (value !== null && typeof value !== 'string' && typeof value !== 'number') {
          throw new ImportError(`The "${table}" table contains an unsupported value.`);
        }
      }
    }
  }
}

// Replaces every row in the database with the export's contents (ids
// preserved so relationships carry over). All-or-nothing: any failure rolls
// back and leaves the existing data untouched.
function importData(payload) {
  validate(payload);

  try {
    return transaction(() => {
      for (const table of [...TABLES].reverse()) {
        db.exec(`DELETE FROM ${table}`);
      }
      db.exec(`DELETE FROM sqlite_sequence WHERE name IN (${TABLES.map((t) => `'${t}'`).join(', ')})`);

      const counts = {};
      for (const table of TABLES) {
        // Only insert columns this database knows about, so an export from a
        // build with extra/missing columns still loads (missing ones fall
        // back to their column defaults).
        const known = db.prepare(`PRAGMA table_info(${table})`).all().map((c) => c.name);
        const rows = payload.tables[table];
        for (const row of rows) {
          const columns = known.filter((c) => Object.hasOwn(row, c));
          const placeholders = columns.map(() => '?').join(', ');
          db.prepare(`INSERT INTO ${table} (${columns.join(', ')}) VALUES (${placeholders})`)
            .run(...columns.map((c) => row[c]));
        }
        counts[table] = rows.length;
      }
      return counts;
    });
  } catch (err) {
    throw new ImportError(`The file's data is inconsistent and could not be imported (${err.message}).`);
  }
}

module.exports = { exportData, importData, ImportError, TABLES, FORMAT, VERSION };
