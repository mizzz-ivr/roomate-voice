export type InputDecision = 'ignore' | 'respond' | 'suppress-response';

export interface InputDecisionQueueOptions {
  onResponseReady: () => void;
  onError?: (error: unknown) => void;
}

export class InputDecisionQueue {
  private tail: Promise<void> = Promise.resolve();
  private queuedTasks = 0;
  private captureHolds = 0;
  private responseRequested = false;
  private responseSuppressed = false;

  public constructor(private readonly options: InputDecisionQueueOptions) {}

  public beginCapture(): void {
    this.captureHolds += 1;
  }

  public endCapture(): void {
    if (this.captureHolds > 0) {
      this.captureHolds -= 1;
    }
    this.flushIfIdle();
  }

  public enqueue(task: () => Promise<InputDecision>): void {
    this.queuedTasks += 1;

    this.tail = this.tail.then(async () => {
      try {
        const decision = await task();
        if (decision === 'respond') {
          this.responseRequested = true;
        } else if (decision === 'suppress-response') {
          this.responseSuppressed = true;
        }
      } catch (error) {
        this.responseSuppressed = true;
        this.options.onError?.(error);
      } finally {
        this.queuedTasks -= 1;
        this.flushIfIdle();
      }
    });
  }

  public async waitForIdle(): Promise<void> {
    await this.tail;
  }

  private flushIfIdle(): void {
    if (this.queuedTasks !== 0 || this.captureHolds !== 0) return;

    const shouldRequestResponse = this.responseRequested && !this.responseSuppressed;
    this.responseRequested = false;
    this.responseSuppressed = false;

    if (!shouldRequestResponse) return;

    try {
      this.options.onResponseReady();
    } catch (error) {
      this.options.onError?.(error);
    }
  }
}
