import { describe, expect, it } from 'vitest';
import { SpeakerCaptureLock } from '../src/speaker-capture-lock.js';

describe('SpeakerCaptureLock', () => {
  it('allows the next utterance after audio capture ends while prior transcription is pending', () => {
    const lock = new SpeakerCaptureLock();

    const firstLease = lock.tryAcquire('speaker-a');
    expect(firstLease).toBeDefined();
    expect(lock.tryAcquire('speaker-b')).toBeUndefined();

    lock.release(firstLease!);
    const secondLease = lock.tryAcquire('speaker-b');

    expect(secondLease).toBeDefined();
    expect(lock.activeSpeakerId).toBe('speaker-b');
  });

  it('does not let a late release from the same user unlock a newer capture', () => {
    const lock = new SpeakerCaptureLock();

    const firstLease = lock.tryAcquire('speaker-a');
    expect(firstLease).toBeDefined();
    lock.release(firstLease!);

    const secondLease = lock.tryAcquire('speaker-a');
    expect(secondLease).toBeDefined();

    // The old transcription can finish after the same user has started a new capture.
    lock.release(firstLease!);
    expect(lock.activeSpeakerId).toBe('speaker-a');

    // A different speaker must still be blocked until the new acquisition itself releases.
    expect(lock.tryAcquire('speaker-b')).toBeUndefined();
    lock.release(secondLease!);
    expect(lock.tryAcquire('speaker-b')).toBeDefined();
  });
});
