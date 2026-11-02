const { contextBridge } = require('electron');

// Expose safe desktop flags to the web application
contextBridge.exposeInMainWorld('isElectron', true);
contextBridge.exposeInMainWorld('electronAPI', {
  isDesktop: true,
  platform: process.platform,
  version: '1.0.0',
  appName: 'Sterling Distillers — Payslip Dispatch Portal',
});

