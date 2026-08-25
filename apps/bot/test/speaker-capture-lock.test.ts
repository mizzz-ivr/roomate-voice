import { describe, expect, it } from 'vitest';
import { SpeakerCaptureLock } from '../src/speaker-capture-lock.js';

describe('SpeakerCaptureLock', () => {
  it('allows the next utterance once audio capture ends even while prior transcription is pending', () => {
    const lock = new SpeakerCaptureLock();

    expect(lock.tryAcquire('speaker-a')).toBe(true);
    expect(lock.tryAcquire('speaker-b')).toBe(false);

    // Audio capture for A has ended. Transcription may still be pending, but the capture lock must be free.
    lock.release('speaker-a');
    expect(lock.tryAcquire('speaker-b')).toBe(true);

    // Late cleanup for A must never release B's active capture.
    lock.release('speaker-a');
    expect(lock.activeSpeakerId).toBe('speaker-b');
  });
});
