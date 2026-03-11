import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
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
    width: 960,
    height: 760,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(ROOT, 'preload.js'),
    },
  });
  mainWindow.loadFile('index.html');
}

app.whenReady().then(async () => {
  ensureWorkspace();
  const { initAgent } = await import('./agent.js');
  initAgent().then(() => {
    createWindow();
  }).catch((err) => {
    console.error('Agent init failed:', err);
    createWindow();
  });
});

app.on('window-all-closed', () => app.quit());

ipcMain.handle('agent:workspaceDir', () => WORKSPACE);
ipcMain.handle('agent:send', async (_, { text, workspaceDir, editorContent }) => {
  const { sendToAgent } = await import('./agent.js');
  return sendToAgent(text || '', workspaceDir || WORKSPACE, editorContent);
});
