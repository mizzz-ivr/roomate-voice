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

describe('OpenAIRealtimeClient input transcription correlation', () => {
  it('keeps concurrent commits correlated to their own committed item ids', async () => {
    const client = createClient();
    const commitSpy = vi.spyOn(client, 'commitAudio').mockImplementation(() => undefined);

    const first = client.commitAudioAndWaitForTranscript();
    const second = client.commitAudioAndWaitForTranscript();

    expect(commitSpy).toHaveBeenCalledTimes(2);

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
      }),
    );
  });

  it('keeps a timed-out unacknowledged commit as a FIFO tombstone', async () => {
    vi.useFakeTimers();

    try {
      const client = createClient();
      const commitSpy = vi.spyOn(client, 'commitAudio').mockImplementation(() => undefined);
      const deleteSpy = vi.spyOn(client, 'deleteConversationItem').mockImplementation(() => undefined);

      const first = client.commitAudioAndWaitForTranscript(50);
      const firstRejection = expect(first).rejects.toEqual(
        expect.objectContaining<InputAudioTranscriptionError>({
          name: 'InputAudioTranscriptionError',
          message: 'Realtime input transcription timed out after 50ms',
        }),
      );

      await vi.advanceTimersByTimeAsync(50);
      await firstRejection;

      const second = client.commitAudioAndWaitForTranscript();
      expect(commitSpy).toHaveBeenCalledTimes(2);

      // The first ACK arrives late. It must consume the timed-out slot instead of being assigned
      // to the second request, and its conversation item is cleaned up immediately.
      emitServerEvent(client, { type: 'input_audio_buffer.committed', item_id: 'late-item-a' });
      expect(deleteSpy).toHaveBeenCalledWith('late-item-a');

      emitServerEvent(client, { type: 'input_audio_buffer.committed', item_id: 'item-b' });
      emitServerEvent(client, {
        type: 'conversation.item.input_audio_transcription.completed',
        item_id: 'item-b',
        transcript: 'second transcript',
      });

      await expect(second).resolves.toEqual({ itemId: 'item-b', transcript: 'second transcript' });
    } finally {
      vi.useRealTimers();
    }
  });
});
