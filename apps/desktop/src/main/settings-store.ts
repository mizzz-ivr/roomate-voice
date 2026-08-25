import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { safeStorage } from 'electron';
import type {
  DesktopPublicSettings,
  DesktopSecretPresence,
  SaveDesktopSettingsInput,
} from '../shared/types.js';

interface StoredDesktopSettings {
  version: 1;
  settings: DesktopPublicSettings;
  secrets: {
    discordBotToken?: string;
    openaiApiKey?: string;
  };
}

const DEFAULT_SETTINGS: DesktopPublicSettings = {
  discordClientId: '',
  discordGuildId: '',
  realtimeModel: 'gpt-realtime-2.1-mini',
  transcriptionModel: 'gpt-transcribe',
  voice: 'marin',
  personaName: 'RooMate',
  personaStyle: '明るく親しみやすいゲーム仲間。返答は短く、プレイ中の邪魔にならないように話す。',
  wakeWord: 'ルーメイト',
  wakeWordAliases: 'ルームメイト',
  silenceMs: 900,
  logLevel: 'info',
  launchAtLogin: false,
  startBotOnLaunch: false,
};

const VALID_LOG_LEVELS = new Set(['debug', 'info', 'warn', 'error']);

function normalizeSettings(input: DesktopPublicSettings): DesktopPublicSettings {
  const silenceMs = Number.isFinite(input.silenceMs)
    ? Math.min(5_000, Math.max(300, Math.round(input.silenceMs)))
    : DEFAULT_SETTINGS.silenceMs;

  return {
    discordClientId: input.discordClientId.trim(),
    discordGuildId: input.discordGuildId.trim(),
    realtimeModel: input.realtimeModel.trim() || DEFAULT_SETTINGS.realtimeModel,
    transcriptionModel: input.transcriptionModel.trim() || DEFAULT_SETTINGS.transcriptionModel,
    voice: input.voice.trim() || DEFAULT_SETTINGS.voice,
    personaName: input.personaName.trim().slice(0, 64) || DEFAULT_SETTINGS.personaName,
    personaStyle: input.personaStyle.trim().slice(0, 2_000) || DEFAULT_SETTINGS.personaStyle,
    wakeWord: input.wakeWord.trim().slice(0, 32) || DEFAULT_SETTINGS.wakeWord,
    wakeWordAliases: input.wakeWordAliases.trim().slice(0, 256),
    silenceMs,
    logLevel: VALID_LOG_LEVELS.has(input.logLevel) ? input.logLevel : DEFAULT_SETTINGS.logLevel,
    launchAtLogin: Boolean(input.launchAtLogin),
    startBotOnLaunch: Boolean(input.startBotOnLaunch),
  };
}

export class DesktopSettingsStore {
  private readonly settingsFile: string;

  public constructor(userDataPath: string) {
    this.settingsFile = path.join(userDataPath, 'settings.json');
  }

  public async isSecureStorageAvailable(): Promise<boolean> {
    return safeStorage.isAsyncEncryptionAvailable();
  }

  public async getPublicSettings(): Promise<DesktopPublicSettings> {
    const stored = await this.readStored();
    return normalizeSettings(stored.settings);
  }

  public async getSecretPresence(): Promise<DesktopSecretPresence> {
    const stored = await this.readStored();
    return {
      discordBotToken: Boolean(stored.secrets.discordBotToken),
      openaiApiKey: Boolean(stored.secrets.openaiApiKey),
    };
  }

  public async save(input: SaveDesktopSettingsInput): Promise<void> {
    const stored = await this.readStored();
    stored.settings = normalizeSettings(input.settings);

    if (input.clearDiscordBotToken) delete stored.secrets.discordBotToken;
    if (input.clearOpenaiApiKey) delete stored.secrets.openaiApiKey;

    const nextDiscordToken = input.secrets?.discordBotToken?.trim();
    const nextOpenAiKey = input.secrets?.openaiApiKey?.trim();

    if (nextDiscordToken || nextOpenAiKey) {
      await this.assertSecureStorageAvailable();
    }

    if (nextDiscordToken) {
      stored.secrets.discordBotToken = await this.encrypt(nextDiscordToken);
    }
    if (nextOpenAiKey) {
      stored.secrets.openaiApiKey = await this.encrypt(nextOpenAiKey);
    }

    await this.writeStored(stored);
  }

  public async buildBotEnvironment(): Promise<NodeJS.ProcessEnv> {
    const stored = await this.readStored();
    const settings = normalizeSettings(stored.settings);
    const discordBotToken = await this.decryptRequired(
      stored.secrets.discordBotToken,
      'Discord Bot Token',
    );
    const openaiApiKey = await this.decryptRequired(stored.secrets.openaiApiKey, 'OpenAI API Key');

    if (!/^\d+$/.test(settings.discordClientId)) {
      throw new Error('Discord Application IDを設定してください。');
    }
    if (settings.discordGuildId && !/^\d+$/.test(settings.discordGuildId)) {
      throw new Error('Discord Guild IDは数字のみで入力してください。');
    }

    return {
      NODE_ENV: 'production',
      DISCORD_BOT_TOKEN: discordBotToken,
      DISCORD_CLIENT_ID: settings.discordClientId,
      DISCORD_GUILD_ID: settings.discordGuildId || undefined,
      OPENAI_API_KEY: openaiApiKey,
      OPENAI_REALTIME_MODEL: settings.realtimeModel,
      OPENAI_TRANSCRIPTION_MODEL: settings.transcriptionModel,
      OPENAI_VOICE: settings.voice,
      BOT_HTTP_PORT: '3001',
      BOT_PERSONA_NAME: settings.personaName,
      BOT_PERSONA_STYLE: settings.personaStyle,
      BOT_WAKE_WORD: settings.wakeWord,
      BOT_WAKE_WORD_ALIASES: settings.wakeWordAliases,
      BOT_SILENCE_MS: String(settings.silenceMs),
      LOG_LEVEL: settings.logLevel,
    };
  }

  private async assertSecureStorageAvailable(): Promise<void> {
    if (!(await this.isSecureStorageAvailable())) {
      throw new Error(
        'Windowsの安全な資格情報ストレージを利用できないため、Token / API Keyを保存できません。',
      );
    }
  }

  private async encrypt(value: string): Promise<string> {
    const encrypted = await safeStorage.encryptStringAsync(value);
    return encrypted.toString('base64');
  }

  private async decryptRequired(value: string | undefined, label: string): Promise<string> {
    if (!value) throw new Error(`${label}を設定してください。`);
    await this.assertSecureStorageAvailable();

    const decrypted = await safeStorage.decryptStringAsync(Buffer.from(value, 'base64'));
    return decrypted.result;
  }

  private async readStored(): Promise<StoredDesktopSettings> {
    try {
      const raw = await readFile(this.settingsFile, 'utf8');
      const parsed = JSON.parse(raw) as Partial<StoredDesktopSettings>;
      return {
        version: 1,
        settings: normalizeSettings({ ...DEFAULT_SETTINGS, ...(parsed.settings ?? {}) }),
        secrets: {
          ...(parsed.secrets ?? {}),
        },
      };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw error;
      }

      return {
        version: 1,
        settings: { ...DEFAULT_SETTINGS },
        secrets: {},
      };
    }
  }

  private async writeStored(value: StoredDesktopSettings): Promise<void> {
    const directory = path.dirname(this.settingsFile);
    await mkdir(directory, { recursive: true });

    const temporaryFile = `${this.settingsFile}.tmp`;
    await writeFile(temporaryFile, `${JSON.stringify(value, null, 2)}\n`, {
      encoding: 'utf8',
      mode: 0o600,
    });
    await rename(temporaryFile, this.settingsFile);
  }
}
