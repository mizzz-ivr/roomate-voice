export interface SpeakerCaptureLease {
  readonly userId: string;
}

export class SpeakerCaptureLock {
  private activeLease: SpeakerCaptureLease | undefined;

  public get activeSpeakerId(): string | undefined {
    return this.activeLease?.userId;
  }

  public tryAcquire(userId: string): SpeakerCaptureLease | undefined {
    if (this.activeLease) return undefined;

    const lease: SpeakerCaptureLease = { userId };
    this.activeLease = lease;
    return lease;
  }

  public release(lease: SpeakerCaptureLease): void {
    if (this.activeLease === lease) {
      this.activeLease = undefined;
    }
  }
}
