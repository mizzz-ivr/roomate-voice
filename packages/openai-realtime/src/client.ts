import { EventEmitter } from 'node:events';
import WebSocket, { type RawData } from 'ws';
import {
  createAppendAudio,
  createCancelResponse,
  createCommitAudio,
  createResponseRequest,
  createSessionUpdate,
  type RealtimeEvent,
  type RealtimeSessionOptions,
} from './protocol.js';

export interface OpenAIRealtimeClientOptions extends RealtimeSessionOptions {
  apiKey: string;
  endpoint?: string;
}

export interface RealtimeUsage {
  inputTokens?: number;
  outputTokens?: number;
  raw: unknown;
}

export interface RealtimeClientEvents {
  connected: [];
  disconnected: [code: number, reason: string];
  audioDelta: [chunk: Buffer];
  audioDone: [];
  transcriptDelta: [delta: string];
  responseDone: [usage?: RealtimeUsage];
  realtimeError: [error: Error];
  rawEvent: [event: RealtimeEvent];
}

export class OpenAIRealtimeClient extends EventEmitter<RealtimeClientEvents> {
  private socket: WebSocket | undefined;
  private readonly options: OpenAIRealtimeClientOptions;

  public constructor(options: OpenAIRealtimeClientOptions) {
    super();
    this.options = options;
  }

  public async connect(): Promise<void> {
    if (this.socket?.readyState === WebSocket.OPEN) {
      return;
    }

    const endpoint = this.options.endpoint ?? 'wss://api.openai.com/v1/realtime';
    const url = new URL(endpoint);
    url.searchParams.set('model', this.options.model);

    await new Promise<void>((resolve, reject) => {
      const socket = new WebSocket(url, {
        headers: {
          Authorization: `Bearer ${this.options.apiKey}`,
        },
      });
      this.socket = socket;

      const onError = (error: Error) => {
        socket.removeListener('open', onOpen);
        reject(error);
      };

      const onOpen = () => {
        socket.removeListener('error', onError);
        this.send(createSessionUpdate(this.options));
        this.emit('connected');
        resolve();
      };

      socket.once('error', onError);
      socket.once('open', onOpen);
      socket.on('message', (data) => this.handleMessage(data));
      socket.on('close', (code, reason) => {
        this.emit('disconnected', code, reason.toString());
      });
      socket.on('error', (error) => {
        this.emit('realtimeError', error);
      });
    });
  }

  public appendAudio(chunk: Buffer): void {
    if (chunk.length === 0) return;
    this.send(createAppendAudio(chunk));
  }

  public commitAudio(): void {
    this.send(createCommitAudio());
  }

  public requestResponse(): void {
    this.send(createResponseRequest());
  }

  public cancelResponse(): void {
    this.send(createCancelResponse());
  }

  public async close(): Promise<void> {
    const socket = this.socket;
    this.socket = undefined;

    if (!socket || socket.readyState === WebSocket.CLOSED) {
      return;
    }

    await new Promise<void>((resolve) => {
      socket.once('close', () => resolve());
      socket.close(1000, 'client shutdown');
      setTimeout(() => {
        if (socket.readyState !== WebSocket.CLOSED) socket.terminate();
        resolve();
      }, 2_000).unref();
    });
  }

  private send(event: RealtimeEvent): void {
    if (this.socket?.readyState !== WebSocket.OPEN) {
      throw new Error(`Realtime socket is not open; cannot send ${event.type}`);
    }
    this.socket.send(JSON.stringify(event));
  }

  private handleMessage(data: RawData): void {
    try {
      const event = JSON.parse(data.toString()) as RealtimeEvent;
      this.emit('rawEvent', event);

      if (event.type === 'response.output_audio.delta' || event.type === 'response.audio.delta') {
        const delta = event.delta;
        if (typeof delta === 'string') this.emit('audioDelta', Buffer.from(delta, 'base64'));
        return;
      }

      if (event.type === 'response.output_audio.done' || event.type === 'response.audio.done') {
        this.emit('audioDone');
        return;
      }

      if (
        event.type === 'response.output_audio_transcript.delta' ||
        event.type === 'response.audio_transcript.delta'
      ) {
        const delta = event.delta;
        if (typeof delta === 'string') this.emit('transcriptDelta', delta);
        return;
      }

      if (event.type === 'response.done') {
        const response = event.response as { usage?: unknown } | undefined;
        this.emit('responseDone', response?.usage ? { raw: response.usage } : undefined);
        return;
      }

      if (event.type === 'error') {
        const details = event.error as { message?: unknown } | undefined;
        const message = typeof details?.message === 'string' ? details.message : 'Unknown realtime error';
        this.emit('realtimeError', new Error(message));
      }
    } catch (error) {
      this.emit(
        'realtimeError',
        error instanceof Error ? error : new Error('Failed to parse realtime event'),
      );
    }
  }
}
