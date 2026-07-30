import { describe, expect, it } from 'vitest';
import { createAppendAudio, createSessionUpdate } from '../src/index.js';

describe('realtime protocol', () => {
  it('creates a current realtime session update', () => {
    const event = createSessionUpdate({
      model: 'gpt-realtime-2.1-mini',
      voice: 'marin',
      instructions: '短く話す',
    });

    expect(event.type).toBe('session.update');
    expect(event).toMatchObject({
      session: {
        model: 'gpt-realtime-2.1-mini',
        output_modalities: ['audio'],
        audio: {
          input: { format: { rate: 24_000 } },
          output: { voice: 'marin' },
        },
      },
    });
  });

  it('encodes PCM bytes as base64', () => {
    const event = createAppendAudio(Buffer.from([1, 2, 3]));
    expect(event.audio).toBe('AQID');
  });
});
