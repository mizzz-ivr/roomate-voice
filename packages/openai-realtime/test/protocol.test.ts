import { describe, expect, it } from 'vitest';
import {
  createAppendAudio,
  createCommitAudio,
  createDeleteConversationItem,
  createSessionUpdate,
} from '../src/index.js';

describe('realtime protocol', () => {
  it('creates a current realtime session update with input transcription', () => {
    const event = createSessionUpdate({
      model: 'gpt-realtime-2.1-mini',
      voice: 'marin',
      instructions: '短く話す',
      inputTranscription: {
        model: 'gpt-transcribe',
        prompt: '呼びかけ語候補: ルーメイト、ルームメイト',
      },
    });

    expect(event.type).toBe('session.update');
    expect(event).toMatchObject({
      session: {
        model: 'gpt-realtime-2.1-mini',
        output_modalities: ['audio'],
        audio: {
          input: {
            format: { rate: 24_000 },
            transcription: {
              model: 'gpt-transcribe',
              prompt: '呼びかけ語候補: ルーメイト、ルームメイト',
            },
          },
          output: { voice: 'marin' },
        },
      },
    });
  });

  it('encodes PCM bytes as base64', () => {
    const event = createAppendAudio(Buffer.from([1, 2, 3]));
    expect(event.audio).toBe('AQID');
  });

  it('adds a client event id to input audio commits when supplied', () => {
    expect(createCommitAudio('roomate_commit_test')).toEqual({
      type: 'input_audio_buffer.commit',
      event_id: 'roomate_commit_test',
    });
  });

  it('creates a conversation item delete event', () => {
    expect(createDeleteConversationItem('item_123')).toEqual({
      type: 'conversation.item.delete',
      item_id: 'item_123',
    });
  });
});
