const { app, BrowserWindow, ipcMain, screen } = require('electron');
const path = require('path');

function createWindow() {
  const { width, height } = screen.getPrimaryDisplay().workAreaSize;
  const win = new BrowserWindow({
    width: 300,
    height: 350,
    x: width - 320,
    y: 20,
    transparent: true,
    frame: false,
    alwaysOnTop: true,
    resizable: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  win.loadFile(path.join(__dirname, 'renderer', 'index.html'));

  ipcMain.on('window-minimize', (event) => {
    const webContents = event.sender;
    const windowToMin = BrowserWindow.fromWebContents(webContents);
    windowToMin.minimize();
  });

  ipcMain.on('window-expand', (event) => {
    const webContents = event.sender;
    const windowToExpand = BrowserWindow.fromWebContents(webContents);
    if (windowToExpand.isMaximized()) {
      windowToExpand.restore();
    } else {
      windowToExpand.maximize();
    }
  });

  ipcMain.on('window-close', (event) => {
    const webContents = event.sender;
    const windowToClose = BrowserWindow.fromWebContents(webContents);
    windowToClose.close();
  });
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
