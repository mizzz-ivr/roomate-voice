import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { BotHealthSnapshot, BotRuntimeSnapshot } from '../shared/types.js';
import type { DesktopSettingsStore } from './settings-store.js';

const HEALTH_URL = 'http://127.0.0.1:3001/health';

export class BotRuntimeController {
  private child: ChildProcessWithoutNullStreams | undefined;
  private state: BotRuntimeSnapshot['state'] = 'stopped';
  private lastError: string | undefined;
  private health: BotHealthSnapshot | undefined;
  private healthTimer: ReturnType<typeof setInterval> | undefined;
  private redactionValues: string[] = [];

  public constructor(
    private readonly settingsStore: DesktopSettingsStore,
    private readonly onStatus: (snapshot: BotRuntimeSnapshot) => void,
  ) {}

  public snapshot(): BotRuntimeSnapshot {
    const workerEntry = this.resolveWorkerEntry();
    return {
      state: this.state,
      workerAvailable: Boolean(workerEntry),
      pid: this.child?.pid,
      ...(this.lastError ? { lastError: this.lastError } : {}),
      ...(this.health ? { health: this.health } : {}),
    };
  }

  public async start(): Promise<BotRuntimeSnapshot> {
    if (this.child) return this.snapshot();

    const workerEntry = this.resolveWorkerEntry();
    if (!workerEntry) {
      this.fail(
        'Voice Workerが見つかりません。開発時はBotをbuildし、配布版ではWorker bundleを含めてください。',
      );
      return this.snapshot();
    }

    this.state = 'starting';
    this.lastError = undefined;
    this.health = undefined;
    this.emit();

    try {
      const botEnvironment = await this.settingsStore.buildBotEnvironment();
      this.redactionValues = [
        botEnvironment.DISCORD_BOT_TOKEN,
        botEnvironment.OPENAI_API_KEY,
      ].filter((value): value is string => Boolean(value));

      const child = spawn(process.execPath, [workerEntry], {
        cwd: path.dirname(workerEntry),
        env: {
          ...process.env,
          ...botEnvironment,
          ELECTRON_RUN_AS_NODE: '1',
        },
        windowsHide: true,
        stdio: ['ignore', 'pipe', 'pipe'],
      });
      this.child = child;

      child.stdout.on('data', () => {
        // Bot stdout is intentionally not forwarded to the renderer. Diagnostics will expose only
        // sanitized metadata in a later phase.
      });
      child.stderr.on('data', (chunk: Buffer) => {
        const message = this.redact(chunk.toString()).trim();
        if (message) this.lastError = message.slice(-2_000);
      });
      child.once('exit', (code, signal) => {
        this.child = undefined;
        this.stopHealthPolling();
        this.health = undefined;

        if (this.state === 'stopping' || code === 0) {
          this.state = 'stopped';
          this.lastError = undefined;
        } else {
          this.state = 'error';
          this.lastError = this.redact(
            this.lastError || `Voice Worker exited unexpectedly (code=${code ?? 'none'}, signal=${signal ?? 'none'})`,
          );
        }

        this.redactionValues = [];
        this.emit();
      });

      await new Promise<void>((resolve, reject) => {
        child.once('spawn', resolve);
        child.once('error', reject);
      });

      this.state = 'running';
      this.emit();
      this.startHealthPolling();
      return this.snapshot();
    } catch (error) {
      this.child = undefined;
      this.stopHealthPolling();
      this.redactionValues = [];
      this.fail(error instanceof Error ? error.message : String(error));
      return this.snapshot();
    }
  }

  public async stop(): Promise<BotRuntimeSnapshot> {
    const child = this.child;
    if (!child) {
      this.state = 'stopped';
      this.health = undefined;
      this.emit();
      return this.snapshot();
    }

    this.state = 'stopping';
    this.emit();

    await new Promise<void>((resolve) => {
      let settled = false;
      const done = () => {
        if (settled) return;
        settled = true;
        resolve();
      };

      child.once('exit', done);
      child.kill();
      setTimeout(() => {
        if (this.child === child) child.kill('SIGKILL');
        done();
      }, 5_000).unref();
    });

    return this.snapshot();
  }

  public async restart(): Promise<BotRuntimeSnapshot> {
    await this.stop();
    return this.start();
  }

  public async close(): Promise<void> {
    await this.stop();
  }

  private resolveWorkerEntry(): string | undefined {
    const override = process.env.ROOMATE_VOICE_WORKER_ENTRY;
    if (override && existsSync(override)) return override;

    const currentDirectory = path.dirname(fileURLToPath(import.meta.url));
    const developmentEntry = path.resolve(currentDirectory, '../../../bot/dist/index.js');
    if (existsSync(developmentEntry)) return developmentEntry;

    const packagedEntry = path.join(process.resourcesPath, 'worker', 'index.js');
    if (existsSync(packagedEntry)) return packagedEntry;

    return undefined;
  }

  private startHealthPolling(): void {
    this.stopHealthPolling();
    void this.refreshHealth();
    this.healthTimer = setInterval(() => void this.refreshHealth(), 2_000);
    this.healthTimer.unref();
  }

  private stopHealthPolling(): void {
    if (this.healthTimer) clearInterval(this.healthTimer);
    this.healthTimer = undefined;
  }

  private async refreshHealth(): Promise<void> {
    if (!this.child) return;

    try {
      const response = await fetch(HEALTH_URL, {
        cache: 'no-store',
        signal: AbortSignal.timeout(1_500),
      });
      if (!response.ok) return;

      this.health = (await response.json()) as BotHealthSnapshot;
      this.emit();
    } catch {
      // Startup can take a moment; an unavailable health endpoint alone must not leak logs or kill
      // the worker. Process exit remains the lifecycle source of truth.
    }
  }

  private fail(message: string): void {
    this.state = 'error';
    this.lastError = this.redact(message);
    this.emit();
  }

  private redact(value: string): string {
    let result = value;
    for (const secret of this.redactionValues) {
      if (secret) result = result.split(secret).join('[REDACTED]');
    }
    return result;
  }

  private emit(): void {
    this.onStatus(this.snapshot());
  }
}
