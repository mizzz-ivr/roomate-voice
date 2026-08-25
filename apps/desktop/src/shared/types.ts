export type DesktopLogLevel = 'debug' | 'info' | 'warn' | 'error';
export type BotRuntimeState = 'stopped' | 'starting' | 'running' | 'stopping' | 'error';

export interface DesktopPublicSettings {
  discordClientId: string;
  discordGuildId: string;
  realtimeModel: string;
  transcriptionModel: string;
  voice: string;
  personaName: string;
  personaStyle: string;
  wakeWord: string;
  wakeWordAliases: string;
  silenceMs: number;
  logLevel: DesktopLogLevel;
  launchAtLogin: boolean;
  startBotOnLaunch: boolean;
}

export interface DesktopSecretPresence {
  discordBotToken: boolean;
  openaiApiKey: boolean;
}

export interface DesktopSecretInput {
  discordBotToken?: string;
  openaiApiKey?: string;
}

export interface SaveDesktopSettingsInput {
  settings: DesktopPublicSettings;
  secrets?: DesktopSecretInput;
  clearDiscordBotToken?: boolean;
  clearOpenaiApiKey?: boolean;
}

export interface BotHealthSnapshot {
  status: 'ok' | 'degraded';
  discordReady: boolean;
  activeVoiceSessions: number;
  model: string;
  uptimeSeconds: number;
  version: string;
}

export interface BotRuntimeSnapshot {
  state: BotRuntimeState;
  workerAvailable: boolean;
  pid?: number;
  lastError?: string;
  health?: BotHealthSnapshot;
}

export interface DesktopBootstrap {
  appVersion: string;
  isPackaged: boolean;
  secureStorageAvailable: boolean;
  settings: DesktopPublicSettings;
  secrets: DesktopSecretPresence;
  runtime: BotRuntimeSnapshot;
}

export interface DesktopBridge {
  getBootstrap(): Promise<DesktopBootstrap>;
  saveSettings(input: SaveDesktopSettingsInput): Promise<DesktopBootstrap>;
  startBot(): Promise<BotRuntimeSnapshot>;
  stopBot(): Promise<BotRuntimeSnapshot>;
  restartBot(): Promise<BotRuntimeSnapshot>;
  openExternal(url: string): Promise<void>;
  onRuntimeStatus(listener: (snapshot: BotRuntimeSnapshot) => void): () => void;
}
