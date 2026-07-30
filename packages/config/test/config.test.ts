import { describe, expect, it } from 'vitest';
import { loadConfig } from '../src/index.js';

const minimumEnv = {
  DISCORD_BOT_TOKEN: 'discord-token',
  DISCORD_CLIENT_ID: '123456789012345678',
  OPENAI_API_KEY: 'openai-key',
};

describe('loadConfig', () => {
  it('applies safe defaults', () => {
    const config = loadConfig(minimumEnv);

    expect(config.OPENAI_REALTIME_MODEL).toBe('gpt-realtime-2.1-mini');
    expect(config.OPENAI_VOICE).toBe('marin');
    expect(config.BOT_HTTP_PORT).toBe(3001);
  });

  it('rejects a missing secret', () => {
    expect(() =>
      loadConfig({
        DISCORD_CLIENT_ID: minimumEnv.DISCORD_CLIENT_ID,
        OPENAI_API_KEY: minimumEnv.OPENAI_API_KEY,
      }),
    ).toThrow(/DISCORD_BOT_TOKEN/);
  });
});
