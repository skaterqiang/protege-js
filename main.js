'use strict';

// ---------------------------------------------------------------------------
// Electron desktop shell for protege-js.
// Starts the local web server, then opens a BrowserWindow pointing at it.
// Run: node main.js  (or: npx electron . )
// ---------------------------------------------------------------------------

const path = require('path');
const { start, PORT } = require('./src/server/webServer');

function startElectron() {
  const { app, BrowserWindow } = require('electron');

  app.whenReady().then(() => {
    const server = start(PORT);
    const win = new BrowserWindow({
      width: 1280,
      height: 840,
      title: 'Protégé JS',
      backgroundColor: '#1e1e1e',
      webPreferences: {
        contextIsolation: true
      }
    });
    win.loadURL(`http://localhost:${PORT}/`);
    app.on('window-all-closed', () => {
      server.close();
      if (process.platform !== 'darwin') app.quit();
      else app.quit();
    });
  });
}

function startHeadless() {
  // No Electron available (e.g. running with plain node) — just run the server.
  start(PORT);
  console.log('Open http://localhost:' + PORT + '/ in a browser.');
}

try {
  require.resolve('electron');
  startElectron();
} catch {
  startHeadless();
}
