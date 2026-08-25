import { app, BrowserWindow, ipcMain, shell } from 'electron';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { BotRuntimeController } from './bot-runtime.js';
import { DesktopSettingsStore } from './settings-store.js';
import type { DesktopBootstrap, SaveDesktopSettingsInput } from '../shared/types.js';

const currentDirectory = path.dirname(fileURLToPath(import.meta.url));
const developmentRendererUrl = process.env.ROOMATE_DESKTOP_DEV_SERVER_URL;

let mainWindow: BrowserWindow | undefined;
let settingsStore: DesktopSettingsStore | undefined;
let botRuntime: BotRuntimeController | undefined;

async function buildBootstrap(): Promise<DesktopBootstrap> {
  if (!settingsStore || !botRuntime) throw new Error('Desktop services are not initialized.');

  const [settings, secrets, secureStorageAvailable] = await Promise.all([
    settingsStore.getPublicSettings(),
    settingsStore.getSecretPresence(),
    settingsStore.isSecureStorageAvailable(),
  ]);

  return {
    appVersion: app.getVersion(),
    isPackaged: app.isPackaged,
    secureStorageAvailable,
    settings,
    secrets,
    runtime: botRuntime.snapshot(),
  };
}

function applyLoginSettings(launchAtLogin: boolean): void {
  if (process.platform !== 'win32') return;
  app.setLoginItemSettings({
    openAtLogin: launchAtLogin,
    path: process.execPath,
  });
}

function registerIpcHandlers(): void {
  ipcMain.handle('desktop:get-bootstrap', async () => buildBootstrap());

  ipcMain.handle('desktop:save-settings', async (_event, input: SaveDesktopSettingsInput) => {
    if (!settingsStore) throw new Error('Settings service is not initialized.');
    await settingsStore.save(input);
    applyLoginSettings(input.settings.launchAtLogin);
    return buildBootstrap();
  });

  ipcMain.handle('desktop:start-bot', async () => {
    if (!botRuntime) throw new Error('Bot runtime is not initialized.');
    return botRuntime.start();
  });

  ipcMain.handle('desktop:stop-bot', async () => {
    if (!botRuntime) throw new Error('Bot runtime is not initialized.');
    return botRuntime.stop();
  });

  ipcMain.handle('desktop:restart-bot', async () => {
    if (!botRuntime) throw new Error('Bot runtime is not initialized.');
    return botRuntime.restart();
  });

  ipcMain.handle('desktop:open-external', async (_event, rawUrl: string) => {
    const url = new URL(rawUrl);
    if (url.protocol !== 'https:') throw new Error('Only HTTPS links can be opened.');
    await shell.openExternal(url.toString());
  });
}

async function createMainWindow(): Promise<void> {
  const window = new BrowserWindow({
    width: 1180,
    height: 780,
    minWidth: 980,
    minHeight: 680,
    show: false,
    backgroundColor: '#101218',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(currentDirectory, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  window.once('ready-to-show', () => window.show());
  window.on('closed', () => {
    if (mainWindow === window) mainWindow = undefined;
  });

  if (developmentRendererUrl) {
    await window.loadURL(developmentRendererUrl);
  } else {
    await window.loadFile(path.join(currentDirectory, '..', 'renderer', 'index.html'));
  }

  mainWindow = window;
}

await app.whenReady();

settingsStore = new DesktopSettingsStore(app.getPath('userData'));
botRuntime = new BotRuntimeController(settingsStore, (snapshot) => {
  mainWindow?.webContents.send('desktop:runtime-status', snapshot);
});
registerIpcHandlers();

const initialSettings = await settingsStore.getPublicSettings();
applyLoginSettings(initialSettings.launchAtLogin);
await createMainWindow();

if (initialSettings.startBotOnLaunch) {
  void botRuntime.start();
}

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) void createMainWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', () => {
  void botRuntime?.close();
});
