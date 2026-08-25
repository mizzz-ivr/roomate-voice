import { describe, expect, it, vi } from 'vitest';
import {
  InputAudioTranscriptionError,
  OpenAIRealtimeClient,
} from '../src/client.js';

function createClient(): OpenAIRealtimeClient {
  return new OpenAIRealtimeClient({
    apiKey: 'test-key',
    model: 'test-realtime-model',
    voice: 'test-voice',
    instructions: 'test instructions',
  });
}

function emitServerEvent(client: OpenAIRealtimeClient, event: Record<string, unknown>): void {
  const internalClient = client as unknown as {
    handleMessage(data: Buffer): void;
  };
  internalClient.handleMessage(Buffer.from(JSON.stringify(event)));
}

function spyOnSend(client: OpenAIRealtimeClient) {
  const internalClient = client as unknown as {
    send(event: Record<string, unknown>): void;
  };
  return vi.spyOn(internalClient, 'send').mockImplementation(() => undefined);
}

describe('OpenAIRealtimeClient input transcription correlation', () => {
  it('keeps concurrent commits correlated to their own committed item ids', async () => {
    const client = createClient();
    const commitSpy = vi.spyOn(client, 'commitAudio').mockImplementation(() => undefined);

    const first = client.commitAudioAndWaitForTranscript();
    const second = client.commitAudioAndWaitForTranscript();

    expect(commitSpy).toHaveBeenCalledTimes(2);
    expect(commitSpy.mock.calls[0]?.[0]).toMatch(/^roomate_commit_/);
    expect(commitSpy.mock.calls[1]?.[0]).toMatch(/^roomate_commit_/);

    emitServerEvent(client, { type: 'input_audio_buffer.committed', item_id: 'item-a' });
    emitServerEvent(client, { type: 'input_audio_buffer.committed', item_id: 'item-b' });

    // Completion can arrive independently; each Promise must stay tied to its original commit.
    emitServerEvent(client, {
      type: 'conversation.item.input_audio_transcription.completed',
      item_id: 'item-b',
      transcript: 'second transcript',
    });
    emitServerEvent(client, {
      type: 'conversation.item.input_audio_transcription.completed',
      item_id: 'item-a',
      transcript: 'first transcript',
    });

    await expect(first).resolves.toEqual({ itemId: 'item-a', transcript: 'first transcript' });
    await expect(second).resolves.toEqual({ itemId: 'item-b', transcript: 'second transcript' });
  });

  it('retains the committed item id when transcription fails', async () => {
    const client = createClient();
    vi.spyOn(client, 'commitAudio').mockImplementation(() => undefined);

    const transcription = client.commitAudioAndWaitForTranscript();

    emitServerEvent(client, { type: 'input_audio_buffer.committed', item_id: 'failed-item' });
    emitServerEvent(client, {
      type: 'conversation.item.input_audio_transcription.failed',
      item_id: 'failed-item',
      error: { message: 'transcription failed' },
    });

    await expect(transcription).rejects.toEqual(
      expect.objectContaining<InputAudioTranscriptionError>({
        name: 'InputAudioTranscriptionError',
        message: 'transcription failed',
        itemId: 'failed-item',
        correlationLost: false,
      }),
    );
  });

  it('correlates a rejected commit by client event id without poisoning the next request', async () => {
    const client = createClient();
    const commitSpy = vi.spyOn(client, 'commitAudio').mockImplementation(() => undefined);

    const first = client.commitAudioAndWaitForTranscript();
    const firstCommitEventId = commitSpy.mock.calls[0]?.[0];
    expect(firstCommitEventId).toMatch(/^roomate_commit_/);

    emitServerEvent(client, {
      type: 'error',
      error: {
        message: 'Error committing input audio buffer: buffer too small',
        event_id: firstCommitEventId,
      },
    });

    await expect(first).rejects.toEqual(
      expect.objectContaining<InputAudioTranscriptionError>({
        name: 'InputAudioTranscriptionError',
        message: 'Error committing input audio buffer: buffer too small',
        correlationLost: false,
      }),
    );

    const second = client.commitAudioAndWaitForTranscript();
    expect(commitSpy).toHaveBeenCalledTimes(2);

    emitServerEvent(client, { type: 'input_audio_buffer.committed', item_id: 'item-b' });
    emitServerEvent(client, {
      type: 'conversation.item.input_audio_transcription.completed',
      item_id: 'item-b',
      transcript: 'second transcript',
    });

    await expect(second).resolves.toEqual({ itemId: 'item-b', transcript: 'second transcript' });
  });

  it('fails closed when a commit acknowledgement never arrives', async () => {
    vi.useFakeTimers();

    try {
      const client = createClient();
      const commitSpy = vi.spyOn(client, 'commitAudio').mockImplementation(() => undefined);

      const first = client.commitAudioAndWaitForTranscript(50);
      const second = client.commitAudioAndWaitForTranscript(500);
      const firstRejection = expect(first).rejects.toEqual(
        expect.objectContaining<InputAudioTranscriptionError>({
          name: 'InputAudioTranscriptionError',
          message: 'Realtime input commit acknowledgement timed out after 50ms',
          correlationLost: true,
        }),
      );
      const secondRejection = expect(second).rejects.toEqual(
        expect.objectContaining<InputAudioTranscriptionError>({
          name: 'InputAudioTranscriptionError',
          message: 'Realtime input correlation was invalidated by an unacknowledged commit timeout',
          correlationLost: true,
        }),
      );

      await vi.advanceTimersByTimeAsync(50);
      await firstRejection;
      await secondRejection;

      await expect(client.commitAudioAndWaitForTranscript()).rejects.toEqual(
        expect.objectContaining<InputAudioTranscriptionError>({
          name: 'InputAudioTranscriptionError',
          correlationLost: true,
        }),
      );
      expect(commitSpy).toHaveBeenCalledTimes(2);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('OpenAIRealtimeClient input buffer clear acknowledgement', () => {
  it('does not resolve a clear until input_audio_buffer.cleared arrives', async () => {
    const client = createClient();
    const sendSpy = spyOnSend(client);

    const clearing = client.clearAudioBuffer(1_000);
    const sentEvent = sendSpy.mock.calls[0]?.[0];
    expect(sentEvent).toEqual(
      expect.objectContaining({
        type: 'input_audio_buffer.clear',
        event_id: expect.stringMatching(/^roomate_clear_/),
      }),
    );

    let resolved = false;
    void clearing.then(() => {
      resolved = true;
    });
    await Promise.resolve();
    expect(resolved).toBe(false);

    emitServerEvent(client, { type: 'input_audio_buffer.cleared', event_id: 'server-clear-ack' });

    await expect(clearing).resolves.toBeUndefined();
    expect(resolved).toBe(true);
  });

  it('rejects the matching clear when the server reports its client event id', async () => {
    const client = createClient();
    const sendSpy = spyOnSend(client);

    const clearing = client.clearAudioBuffer(1_000);
    const clearEventId = sendSpy.mock.calls[0]?.[0]?.event_id;
    expect(clearEventId).toMatch(/^roomate_clear_/);

    emitServerEvent(client, {
      type: 'error',
      error: {
        message: 'Error clearing input audio buffer',
        event_id: clearEventId,
      },
    });

    await expect(clearing).rejects.toThrow('Error clearing input audio buffer');
  });

  it('rejects when a clear acknowledgement never arrives', async () => {
    vi.useFakeTimers();

    try {
      const client = createClient();
      spyOnSend(client);

      const clearing = client.clearAudioBuffer(50);
      const rejection = expect(clearing).rejects.toThrow(
        'Realtime input audio buffer clear acknowledgement timed out after 50ms',
      );

      await vi.advanceTimersByTimeAsync(50);
      await rejection;
    } finally {
      vi.useRealTimers();
    }
  });
});
