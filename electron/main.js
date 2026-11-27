const { app, BrowserWindow, Menu, shell, nativeImage } = require('electron');
const path = require('path');

let mainWindow = null;

async function applyWindowFavicon(win, faviconUrl) {
  if (!win || win.isDestroyed() || !faviconUrl) return;
  try {
    if (faviconUrl.startsWith('data:image/svg+xml')) {
      // Windows nativeImage expects raster PNG/ICO; SVG icons are handled smoothly via /api/workspaces/icon
      return;
    }
    if (faviconUrl.startsWith('data:image/')) {
      const img = nativeImage.createFromDataURL(faviconUrl);
      if (!img.isEmpty()) win.setIcon(img);
      return;
    }
    if (faviconUrl.startsWith('http://') || faviconUrl.startsWith('https://')) {
      const res = await fetch(faviconUrl);
      if (!res.ok) return;
      const buf = Buffer.from(await res.arrayBuffer());
      const img = nativeImage.createFromBuffer(buf);
      if (!img.isEmpty()) win.setIcon(img);
    }
  } catch {
    // Keep existing icon gracefully if network conversion fails
  }
}

function createWindow() {
  const isDev = process.env.NODE_ENV === 'development';
  const startUrl =
    process.env.ELECTRON_START_URL ||
    (isDev ? 'http://localhost:3000' : 'https://payslip-send.vercel.app');

  const iconPath = path.join(__dirname, 'assets', 'icon.ico');

  mainWindow = new BrowserWindow({
    width: 1366,
    height: 860,
    minWidth: 1024,
    minHeight: 700,
    title: 'Payslip Dispatch Portal',
    icon: iconPath,
    autoHideMenuBar: true,
    backgroundColor: '#FFFFFF',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
    },
    show: false,
  });

  mainWindow.setMenuBarVisibility(false);
  if (typeof mainWindow.removeMenu === 'function') {
    mainWindow.removeMenu();
  }

  const baseUserAgent = mainWindow.webContents.getUserAgent();
  mainWindow.webContents.setUserAgent(`${baseUserAgent} PayslipDesktopApp/1.0.0 Electron`);

  // Dynamically sync window title & taskbar icon to the logged-in tenant company
  mainWindow.webContents.on('page-title-updated', (_event, title) => {
    if (mainWindow && !mainWindow.isDestroyed() && title) {
      mainWindow.setTitle(title);
    }
  });

  mainWindow.webContents.on('page-favicon-updated', (_event, favicons) => {
    if (Array.isArray(favicons) && favicons.length > 0) {
      applyWindowFavicon(mainWindow, favicons[0]);
    }
  });

  mainWindow.loadURL(startUrl);

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

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
