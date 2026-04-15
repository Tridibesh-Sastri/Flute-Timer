const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  minimize: () => ipcRenderer.send('window-minimize'),
  expand: () => ipcRenderer.send('window-expand'),
  close: () => ipcRenderer.send('window-close'),
  openDashboard: () => ipcRenderer.send('open-dashboard'),
  notifyDashboard: () => ipcRenderer.send('dashboard-refresh'),
  sendVisualizerFrame: (frame) => ipcRenderer.send('visualizer-frame', frame)
});
