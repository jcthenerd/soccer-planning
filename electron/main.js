'use strict';

const { app, BrowserWindow } = require('electron');
const fs = require('node:fs');
const path = require('node:path');

// Machine-specific fallback for the one-time data migration below - this
// repo only ever lived on this Mac, so there's no portable way to discover
// the pre-Electron data/ folder once running from a packaged asar.
const LEGACY_DATA_DIRS = [
  path.join(__dirname, '..', 'data'),
  '/Users/john/Documents/git-repos/soccer-planning/data',
];

function migrateLegacyDatabase(targetDbPath) {
  if (fs.existsSync(targetDbPath)) return;

  const legacyDir = LEGACY_DATA_DIRS.find((dir) => fs.existsSync(path.join(dir, 'soccer.db')));
  if (!legacyDir) return;

  for (const suffix of ['', '-wal', '-shm']) {
    const src = path.join(legacyDir, `soccer.db${suffix}`);
    if (fs.existsSync(src)) {
      fs.copyFileSync(src, `${targetDbPath}${suffix}`);
    }
  }
}

app.setName('Soccer Planner');

const dbPath = path.join(app.getPath('userData'), 'soccer.db');
migrateLegacyDatabase(dbPath);
process.env.SOCCER_DB_PATH = dbPath;

const serverApp = require('../server');

function startServer() {
  return new Promise((resolve) => {
    const server = serverApp.listen(3000);
    server.on('listening', () => resolve(server.address().port));
    server.on('error', (err) => {
      if (err.code !== 'EADDRINUSE') throw err;
      const fallback = serverApp.listen(0);
      fallback.on('listening', () => resolve(fallback.address().port));
    });
  });
}

async function createWindow() {
  const port = await startServer();
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    title: 'Soccer Planner',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  win.loadURL(`http://localhost:${port}`);
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
