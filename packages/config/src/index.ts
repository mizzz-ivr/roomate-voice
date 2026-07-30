import 'dotenv/config';
import { z } from 'zod';

const optionalSnowflake = z.preprocess(
  (value) => (value === '' ? undefined : value),
  z.string().regex(/^\d+$/).optional(),
);

export const appConfigSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  DISCORD_BOT_TOKEN: z.string().min(1, 'DISCORD_BOT_TOKEN is required'),
  DISCORD_CLIENT_ID: z.string().regex(/^\d+$/, 'DISCORD_CLIENT_ID must be a Discord snowflake'),
  DISCORD_GUILD_ID: optionalSnowflake,
  OPENAI_API_KEY: z.string().min(1, 'OPENAI_API_KEY is required'),
  OPENAI_REALTIME_MODEL: z.string().min(1).default('gpt-realtime-2.1-mini'),
  OPENAI_VOICE: z.string().min(1).default('marin'),
  BOT_HTTP_PORT: z.coerce.number().int().positive().max(65_535).default(3001),
  BOT_PERSONA_NAME: z.string().min(1).max(64).default('RooMate'),
  BOT_PERSONA_STYLE: z
    .string()
    .min(1)
    .max(2_000)
    .default('明るく親しみやすいゲーム仲間。返答は短くする。'),
  BOT_WAKE_WORD: z.string().min(1).max(32).default('ルーメイト'),
  BOT_SILENCE_MS: z.coerce.number().int().min(300).max(5_000).default(900),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
});

export type AppConfig = z.infer<typeof appConfigSchema>;

export function loadConfig(source: NodeJS.ProcessEnv = process.env): AppConfig {
  const result = appConfigSchema.safeParse(source);

  if (!result.success) {
    const messages = result.error.issues
      .map((issue) => `${issue.path.join('.') || 'environment'}: ${issue.message}`)
      .join('\n');
    throw new Error(`Invalid environment configuration:\n${messages}`);
  }

  return result.data;
}
