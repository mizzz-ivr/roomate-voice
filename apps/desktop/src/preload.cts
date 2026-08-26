import { contextBridge, ipcRenderer } from 'electron';
import type {
  BotRuntimeSnapshot,
  DesktopBootstrap,
  DesktopBridge,
  SaveDesktopSettingsInput,
} from './shared/types.js';

const bridge: DesktopBridge = {
  getBootstrap: () => ipcRenderer.invoke('desktop:get-bootstrap') as Promise<DesktopBootstrap>,
  saveSettings: (input: SaveDesktopSettingsInput) =>
    ipcRenderer.invoke('desktop:save-settings', input) as Promise<DesktopBootstrap>,
  startBot: () => ipcRenderer.invoke('desktop:start-bot') as Promise<BotRuntimeSnapshot>,
  stopBot: () => ipcRenderer.invoke('desktop:stop-bot') as Promise<BotRuntimeSnapshot>,
  restartBot: () => ipcRenderer.invoke('desktop:restart-bot') as Promise<BotRuntimeSnapshot>,
  openExternal: (url: string) => ipcRenderer.invoke('desktop:open-external', url) as Promise<void>,
  onRuntimeStatus: (listener: (snapshot: BotRuntimeSnapshot) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, snapshot: BotRuntimeSnapshot) => listener(snapshot);
    ipcRenderer.on('desktop:runtime-status', handler);
    return () => ipcRenderer.removeListener('desktop:runtime-status', handler);
  },
};

contextBridge.exposeInMainWorld('roomate', bridge);
