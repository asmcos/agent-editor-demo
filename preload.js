const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('agentDemo', {
  sendMessage: (text, workspaceDir) => ipcRenderer.invoke('agent:send', { text, workspaceDir }),
  getWorkspaceDir: () => ipcRenderer.invoke('agent:workspaceDir'),
});
