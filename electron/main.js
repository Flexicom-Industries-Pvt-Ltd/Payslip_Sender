const { app, BrowserWindow, Menu, shell } = require('electron');
const path = require('path');

let mainWindow = null;

function createWindow() {
  const isDev = process.env.NODE_ENV === 'development';
  // Target URL: Hosted Vercel app or local dev server
  const startUrl =
    process.env.ELECTRON_START_URL ||
    (isDev ? 'http://localhost:3000' : 'https://payslip-send.vercel.app');

  const iconPath = path.join(__dirname, 'assets', 'icon.ico');

  mainWindow = new BrowserWindow({
    width: 1366,
    height: 860,
    minWidth: 1024,
    minHeight: 700,
    title: 'Sterling Distillers — Payslip Dispatch Portal',
    icon: iconPath,
    autoHideMenuBar: true, // Completely strip default menu bar
    backgroundColor: '#221E1E', // Sterling Distillers theme background
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
    },
    show: false,
  });

  // Explicitly ensure the menu bar is invisible and removed
  mainWindow.setMenuBarVisibility(false);
  if (typeof mainWindow.removeMenu === 'function') {
    mainWindow.removeMenu();
  }

  // Set custom userAgent so web app can easily detect the Electron container
  const baseUserAgent = mainWindow.webContents.getUserAgent();
  mainWindow.webContents.setUserAgent(`${baseUserAgent} SterlingDesktopApp/1.0.0 Electron`);

  mainWindow.loadURL(startUrl);

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  // Open external links (mail clients, external documentation) in the user's default browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https:') || url.startsWith('http:') || url.startsWith('mailto:')) {
      shell.openExternal(url);
      return { action: 'deny' };
    }
    return { action: 'allow' };
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// Single instance lock (prevent opening multiple instances)
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  app.whenReady().then(() => {
    // Completely remove default application menu strip (File, Edit, View, Help)
    if (Menu && typeof Menu.setApplicationMenu === 'function') {
      Menu.setApplicationMenu(null);
    }

    createWindow();

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
      }
    });
  });
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
