import {
  REST,
  Routes,
  SlashCommandBuilder,
  type RESTPostAPIApplicationCommandsJSONBody,
} from 'discord.js';
import type { AppConfig } from '@roomate-voice/config';
import type { Logger } from './logger.js';

export const commands: RESTPostAPIApplicationCommandsJSONBody[] = [
  new SlashCommandBuilder()
    .setName('join')
    .setDescription('あなたがいるボイスチャンネルへRooMateを参加させます')
    .toJSON(),
  new SlashCommandBuilder()
    .setName('leave')
    .setDescription('RooMateをボイスチャンネルから退出させます')
    .toJSON(),
  new SlashCommandBuilder()
    .setName('status')
    .setDescription('RooMateの接続状態と使用モデルを表示します')
    .toJSON(),
];

export async function registerCommands(config: AppConfig, logger: Logger): Promise<void> {
  const rest = new REST({ version: '10' }).setToken(config.DISCORD_BOT_TOKEN);

  if (config.DISCORD_GUILD_ID) {
    await rest.put(
      Routes.applicationGuildCommands(config.DISCORD_CLIENT_ID, config.DISCORD_GUILD_ID),
      { body: commands },
    );
    logger.info('Guild slash commands registered', { guildId: config.DISCORD_GUILD_ID });
    return;
  }

  await rest.put(Routes.applicationCommands(config.DISCORD_CLIENT_ID), { body: commands });
  logger.info('Global slash commands registered');
}
