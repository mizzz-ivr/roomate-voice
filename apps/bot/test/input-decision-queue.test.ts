import { describe, expect, it } from 'vitest';
import { InputDecisionQueue } from '../src/input-decision-queue.js';

function deferred<T>(): {
  promise: Promise<T>;
  resolve: (value: T) => void;
} {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolver) => {
    resolve = resolver;
  });
  return { promise, resolve };
}

describe('InputDecisionQueue', () => {
  it('processes decisions in enqueue order even when later transcription settles first', async () => {
    const events: string[] = [];
    const first = deferred<void>();
    const second = deferred<void>();
    const queue = new InputDecisionQueue({
      onResponseReady: () => events.push('response'),
    });

    queue.enqueue(async () => {
      await first.promise;
      events.push('first');
      return 'respond';
    });
    queue.enqueue(async () => {
      await second.promise;
      events.push('second');
      return 'respond';
    });

    second.resolve();
    await Promise.resolve();
    await Promise.resolve();
    expect(events).toEqual([]);

    first.resolve();
    await queue.waitForIdle();

    expect(events).toEqual(['first', 'second', 'response']);
  });

  it('holds response creation while a newer audio capture is still uncommitted', async () => {
    const events: string[] = [];
    const queue = new InputDecisionQueue({
      onResponseReady: () => events.push('response'),
    });

    queue.beginCapture();
    queue.enqueue(async () => {
      events.push('wake');
      return 'respond';
    });

    await queue.waitForIdle();
    expect(events).toEqual(['wake']);

    queue.enqueue(async () => {
      events.push('non-wake');
      return 'ignore';
    });
    queue.endCapture();
    await queue.waitForIdle();

    expect(events).toEqual(['wake', 'non-wake', 'response']);
  });

  it('suppresses an earlier wake response when the newer capture pipeline fails', async () => {
    const events: string[] = [];
    const queue = new InputDecisionQueue({
      onResponseReady: () => events.push('response'),
    });

    queue.beginCapture();
    queue.enqueue(async () => {
      events.push('wake');
      return 'respond';
    });

    await queue.waitForIdle();
    expect(events).toEqual(['wake']);

    // A failed capture still occupies its position in the ordered batch and must suppress the
    // earlier response before the capture hold is released.
    queue.enqueue(async () => {
      events.push('pipeline-failed');
      return 'suppress-response';
    });
    queue.endCapture();
    await queue.waitForIdle();

    expect(events).toEqual(['wake', 'pipeline-failed']);
  });

  it('suppresses a pending response when correlation safety is lost', async () => {
    const events: string[] = [];
    const queue = new InputDecisionQueue({
      onResponseReady: () => events.push('response'),
    });

    queue.enqueue(async () => {
      events.push('wake');
      return 'respond';
    });
    queue.enqueue(async () => {
      events.push('correlation-lost');
      return 'suppress-response';
    });

    await queue.waitForIdle();

    expect(events).toEqual(['wake', 'correlation-lost']);
  });
});
