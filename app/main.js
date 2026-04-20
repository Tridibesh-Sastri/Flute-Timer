const { app, BrowserWindow, ipcMain, screen } = require('electron');
const fs = require('fs');
const path = require('path');

let floatingWidget = null;
let dashboardWindow = null;
let appSettings = { floatingOpacity: 1 };

function getSettingsPath() {
  return path.join(app.getPath('userData'), 'flute-timer-settings.json');
}

function clampOpacity(value) {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) return 1;
  return Math.min(1, Math.max(0.35, numericValue));
}

function loadSettings() {
  try {
    const raw = fs.readFileSync(getSettingsPath(), 'utf8');
    const parsed = JSON.parse(raw);
    return {
      floatingOpacity: clampOpacity(parsed.floatingOpacity)
    };
  } catch (err) {
    return { floatingOpacity: 1 };
  }
}

function saveSettings() {
  try {
    fs.writeFileSync(getSettingsPath(), JSON.stringify(appSettings, null, 2));
  } catch (err) {
    console.error('Unable to save settings:', err);
  }
}

function focusWindow(win) {
  if (!win || win.isDestroyed()) return;
  if (win.isMinimized()) win.restore();
  win.show();
  win.focus();
}

function setFloatingOpacity(value) {
  const nextOpacity = clampOpacity(value);
  appSettings.floatingOpacity = nextOpacity;
  saveSettings();
  if (floatingWidget && !floatingWidget.isDestroyed()) {
    floatingWidget.setOpacity(nextOpacity);
  }
  return nextOpacity;
}

function createFloatingWidget() {
  if (floatingWidget && !floatingWidget.isDestroyed()) {
    focusWindow(floatingWidget);
    return floatingWidget;
  }

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
    opacity: appSettings.floatingOpacity,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      backgroundThrottling: false
    }
  });
  floatingWidget.loadFile(path.join(__dirname, 'renderer', 'index.html'));
  floatingWidget.setOpacity(appSettings.floatingOpacity);
  floatingWidget.on('closed', () => { floatingWidget = null; });
  return floatingWidget;
}

function createDashboard() {
  if (dashboardWindow && !dashboardWindow.isDestroyed()) {
    focusWindow(dashboardWindow);
    return dashboardWindow;
  }

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
      contextIsolation: true,
      backgroundThrottling: false
    }
  });
  dashboardWindow.loadFile(path.join(__dirname, 'dashboard', 'dashboard.html'));
  dashboardWindow.on('closed', () => { dashboardWindow = null; });
  return dashboardWindow;
}

app.whenReady().then(() => {
  appSettings = loadSettings();
  createFloatingWidget();

  // Dashboard window management
  ipcMain.on('open-dashboard', () => {
    if (dashboardWindow) focusWindow(dashboardWindow);
    else createDashboard();
  });

  ipcMain.on('open-floating', () => {
    if (floatingWidget) focusWindow(floatingWidget);
    else createFloatingWidget();
  });

  ipcMain.on('set-floating-opacity', (_event, value) => {
    setFloatingOpacity(value);
  });

  // Forward refresh signal to dashboard when session ends
  ipcMain.on('dashboard-refresh', () => {
    if (dashboardWindow) {
      dashboardWindow.webContents.send('dashboard-refresh');
    }
  });

  ipcMain.on('visualizer-frame', (_event, frame) => {
    if (dashboardWindow && !dashboardWindow.isDestroyed()) {
      dashboardWindow.webContents.send('visualizer-frame', frame);
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
