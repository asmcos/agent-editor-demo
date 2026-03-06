'use strict';

const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');

const ROOT = __dirname;
const WORKSPACE = path.join(ROOT, 'workspace');

let mainWindow = null;

function ensureWorkspace() {
  if (!fs.existsSync(WORKSPACE)) {
    fs.mkdirSync(WORKSPACE, { recursive: true });
  }
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 900,
    height: 700,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(ROOT, 'preload.js'),
    },
  });
  mainWindow.loadFile('index.html');
}

app.whenReady().then(() => {
  ensureWorkspace();
  const { initAgent } = require('./agent.js');
  initAgent().then(() => {
    createWindow();
  }).catch((err) => {
    console.error('Agent init failed:', err);
    createWindow();
  });
});

app.on('window-all-closed', () => app.quit());

ipcMain.handle('agent:workspaceDir', () => WORKSPACE);
ipcMain.handle('agent:send', async (_, { text, workspaceDir }) => {
  const { sendToAgent } = require('./agent.js');
  return sendToAgent(text || '', workspaceDir || WORKSPACE);
});
