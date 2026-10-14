'use strict';
const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('netlab', {
  isDesktop: true,
  onOpenProject: (cb) => ipcRenderer.on('project:open', (_e, text) => cb(text)),
  onSaveRequest: (cb) => ipcRenderer.on('project:save-request', () => cb()),
  saveProject: (text) => ipcRenderer.invoke('project:save', text)
});
