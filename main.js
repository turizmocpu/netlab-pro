'use strict';
const { app, BrowserWindow, Menu, dialog, ipcMain, session } = require('electron');
const path = require('path');
const fs = require('fs');
const MAX_BYTES = 10 * 1024 * 1024;
let win = null;

function validProject(text) {
  if (typeof text !== 'string' || text.length > MAX_BYTES) return false;
  try { const j = JSON.parse(text); return Array.isArray(j.devs) && Array.isArray(j.links); } catch (e) { return false; }
}

function createWindow() {
  win = new BrowserWindow({
    width: 1440, height: 900, minWidth: 1024, minHeight: 660,
    backgroundColor: '#14171c', title: 'NetLab Pro', show: false,
    icon: path.join(__dirname, 'assets', 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true, nodeIntegration: false, sandbox: true,
      webSecurity: true, allowRunningInsecureContent: false, devTools: !app.isPackaged
    }
  });
  win.once('ready-to-show', () => win.show());
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  win.webContents.on('will-navigate', (e) => e.preventDefault());
  win.on('closed', () => { win = null; });
  win.loadFile(path.join(__dirname, 'src', 'index.html'));
}

async function openProject() {
  if (!win) return;
  const r = await dialog.showOpenDialog(win, { title: 'Open project', properties: ['openFile'], filters: [{ name: 'NetLab project (JSON)', extensions: ['json'] }] });
  if (r.canceled || !r.filePaths[0]) return;
  try {
    if (fs.statSync(r.filePaths[0]).size > MAX_BYTES) throw new Error('File is larger than 10 MB.');
    const text = fs.readFileSync(r.filePaths[0], 'utf8');
    if (!validProject(text)) throw new Error('This is not a NetLab Pro project file (missing devices or cables).');
    win.webContents.send('project:open', text);
  } catch (e) { dialog.showErrorBox('Cannot open project', String(e.message || e)); }
}

function buildMenu() {
  Menu.setApplicationMenu(Menu.buildFromTemplate([
    { label: 'File', submenu: [
      { label: 'Open project…', accelerator: 'CmdOrCtrl+O', click: openProject },
      { label: 'Save project…', accelerator: 'CmdOrCtrl+S', click: () => win && win.webContents.send('project:save-request') },
      { type: 'separator' }, { role: 'quit', label: 'Exit' } ] },
    { label: 'View', submenu: [ { role: 'zoomIn' }, { role: 'zoomOut' }, { role: 'resetZoom' }, { type: 'separator' }, { role: 'togglefullscreen' } ] },
    { label: 'Help', submenu: [ { label: 'About NetLab Pro', click: () => dialog.showMessageBox(win, { type: 'info', title: 'NetLab Pro', message: 'NetLab Pro ' + app.getVersion(), detail: 'Offline network simulator. All attack scenarios run only on simulated devices; no network traffic is sent.' }) } ] }
  ]));
}

ipcMain.handle('project:save', async (e, text) => {
  if (!win || e.sender !== win.webContents || !validProject(text)) return { ok: false };
  const r = await dialog.showSaveDialog(win, { title: 'Save project', defaultPath: 'netlab-project.json', filters: [{ name: 'NetLab project (JSON)', extensions: ['json'] }] });
  if (r.canceled || !r.filePath) return { ok: false };
  try { fs.writeFileSync(r.filePath, text, 'utf8'); return { ok: true }; }
  catch (err) { dialog.showErrorBox('Cannot save project', String(err.message || err)); return { ok: false }; }
});

if (!app.requestSingleInstanceLock()) { app.quit(); }
else {
  app.setName('NetLab Pro');
  app.on('second-instance', () => { if (win) { if (win.isMinimized()) win.restore(); win.focus(); } });
  app.whenReady().then(() => {
    session.defaultSession.setPermissionRequestHandler((_w, _p, cb) => cb(false));
    session.defaultSession.webRequest.onBeforeRequest({ urls: ['http://*/*', 'https://*/*', 'ws://*/*', 'wss://*/*'] }, (_d, cb) => cb({ cancel: true }));
    buildMenu(); createWindow();
  });
  app.on('window-all-closed', () => app.quit());
}
