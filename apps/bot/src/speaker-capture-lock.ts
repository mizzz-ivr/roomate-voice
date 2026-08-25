export class SpeakerCaptureLock {
  private activeSpeakerIdValue: string | undefined;

  public get activeSpeakerId(): string | undefined {
    return this.activeSpeakerIdValue;
  }

  public tryAcquire(userId: string): boolean {
    if (this.activeSpeakerIdValue) return false;
    this.activeSpeakerIdValue = userId;
    return true;
  }

  public release(userId: string): void {
    if (this.activeSpeakerIdValue === userId) {
      this.activeSpeakerIdValue = undefined;
    }
  }
}
