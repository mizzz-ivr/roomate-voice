import { Client, Events, GatewayIntentBits } from 'discord.js';
import { loadConfig } from '@roomate-voice/config';
import { registerCommands } from './commands.js';
import { startHealthServer } from './health-server.js';
import { createLogger } from './logger.js';
import { VoiceSessionManager } from './voice-session-manager.js';

const config = loadConfig();
const logger = createLogger(config.LOG_LEVEL);
const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildVoiceStates],
});
const sessions = new VoiceSessionManager(config, logger);
const startedAt = Date.now();

const healthServer = startHealthServer({
  port: config.BOT_HTTP_PORT,
  getSnapshot: () => ({
    status: client.isReady() ? 'ok' : 'degraded',
    discordReady: client.isReady(),
    activeVoiceSessions: sessions.activeSessionCount,
    model: config.OPENAI_REALTIME_MODEL,
    uptimeSeconds: Math.round((Date.now() - startedAt) / 1_000),
    version: '0.1.0',
  }),
});

client.once(Events.ClientReady, async (readyClient) => {
  logger.info('Discord client ready', {
    user: readyClient.user.tag,
    guilds: readyClient.guilds.cache.size,
  });

  try {
    await registerCommands(config, logger);
  } catch (error) {
    logger.error('Failed to register slash commands', {
      error: error instanceof Error ? error.message : String(error),
    });
  }
});

client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  try {
    if (interaction.commandName === 'join') {
      await interaction.deferReply({ ephemeral: true });
      const channel = await sessions.joinFromInteraction(interaction);
      await interaction.editReply(
        `✅ **${channel.name}** に参加しました。モデル: \`${config.OPENAI_REALTIME_MODEL}\``,
      );
      return;
    }

    if (interaction.commandName === 'leave') {
      if (!interaction.guildId) throw new Error('Discordサーバー内で実行してください。');
      await sessions.leave(interaction.guildId);
      await interaction.reply({ content: '👋 ボイスチャンネルから退出しました。', ephemeral: true });
      return;
    }

    if (interaction.commandName === 'status') {
      const connected = interaction.guildId ? sessions.hasSession(interaction.guildId) : false;
      const channelId = interaction.guildId
        ? sessions.getSessionChannelId(interaction.guildId)
        : undefined;
      await interaction.reply({
        content: [
          `状態: **${connected ? '接続中' : '待機中'}**`,
          `モデル: \`${config.OPENAI_REALTIME_MODEL}\``,
          `音声: \`${config.OPENAI_VOICE}\``,
          channelId ? `チャンネル: <#${channelId}>` : undefined,
        ]
          .filter(Boolean)
          .join('\n'),
        ephemeral: true,
      });
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : '予期しないエラーが発生しました。';
    logger.error('Command failed', {
      command: interaction.commandName,
      guildId: interaction.guildId,
      error: message,
    });

    if (interaction.deferred || interaction.replied) {
      await interaction.editReply(`❌ ${message}`);
    } else {
      await interaction.reply({ content: `❌ ${message}`, ephemeral: true });
    }
  }
});

async function shutdown(signal: string): Promise<void> {
  logger.info('Shutdown requested', { signal });
  healthServer.close();
  await sessions.closeAll();
  client.destroy();
  process.exit(0);
}

process.once('SIGINT', () => void shutdown('SIGINT'));
process.once('SIGTERM', () => void shutdown('SIGTERM'));

client.login(config.DISCORD_BOT_TOKEN).catch((error: unknown) => {
  logger.error('Discord login failed', {
    error: error instanceof Error ? error.message : String(error),
  });
  process.exit(1);
});
