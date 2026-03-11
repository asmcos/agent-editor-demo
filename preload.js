const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('agentDemo', {
  sendMessage: (text, workspaceDir, editorContent) =>
    ipcRenderer.invoke('agent:send', { text, workspaceDir, editorContent }),
  getWorkspaceDir: () => ipcRenderer.invoke('agent:workspaceDir'),
});
