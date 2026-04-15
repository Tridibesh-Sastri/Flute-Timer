const { app, BrowserWindow, ipcMain, screen } = require('electron');
const path = require('path');

let floatingWidget = null;
let dashboardWindow = null;

function createFloatingWidget() {
  const { width } = screen.getPrimaryDisplay().workAreaSize;
  floatingWidget = new BrowserWindow({
    width: 320,
    height: 460,
    x: width - 340,
    y: 20,
    transparent: true,
    frame: false,
    alwaysOnTop: true,
    resizable: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true
    }
  });
  floatingWidget.loadFile(path.join(__dirname, 'renderer', 'index.html'));
  floatingWidget.on('closed', () => { floatingWidget = null; });
}

function createDashboard() {
  dashboardWindow = new BrowserWindow({
    width: 920,
    height: 660,
    minWidth: 700,
    minHeight: 500,
    frame: false,
    transparent: false,
    backgroundColor: '#0d0d0d',
    resizable: true,
    webPreferences: {
      preload: path.join(__dirname, 'dashboard', 'dashboard_preload.js'),
      nodeIntegration: false,
      contextIsolation: true
    }
  });
  dashboardWindow.loadFile(path.join(__dirname, 'dashboard', 'dashboard.html'));
  dashboardWindow.on('closed', () => { dashboardWindow = null; });
}

app.whenReady().then(() => {
  createFloatingWidget();

  // Dashboard window management
  ipcMain.on('open-dashboard', () => {
    if (dashboardWindow) {
      dashboardWindow.focus();
    } else {
      createDashboard();
    }
  });

  // Forward refresh signal to dashboard when session ends
  ipcMain.on('dashboard-refresh', () => {
    if (dashboardWindow) {
      dashboardWindow.webContents.send('dashboard-refresh');
    }
  });

  // Window controls (shared by both windows)
  ipcMain.on('window-minimize', (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (win) win.minimize();
  });

  ipcMain.on('window-maximize', (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (win) win.isMaximized() ? win.restore() : win.maximize();
  });

  ipcMain.on('window-expand', (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (win) win.isMaximized() ? win.restore() : win.maximize();
  });

  ipcMain.on('window-close', (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (win) win.close();
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createFloatingWidget();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
