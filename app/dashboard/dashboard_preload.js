const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  minimize: () => ipcRenderer.send('window-minimize'),
  maximize: () => ipcRenderer.send('window-maximize'),
  close: () => ipcRenderer.send('window-close'),
  openFloating: () => ipcRenderer.send('open-floating'),
  openLearning: () => ipcRenderer.send('open-learning'),
  setFloatingOpacity: (value) => ipcRenderer.send('set-floating-opacity', value),
  onRefresh: (cb) => ipcRenderer.on('dashboard-refresh', () => cb()),
  onVisualizerFrame: (cb) => ipcRenderer.on('visualizer-frame', (_event, frame) => cb(frame))
});
