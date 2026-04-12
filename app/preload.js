const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  minimize: () => ipcRenderer.send('window-minimize'),
  expand: () => ipcRenderer.send('window-expand'),
  close: () => ipcRenderer.send('window-close')
});
