import { EventEmitter } from 'node:events';
import WebSocket, { type RawData } from 'ws';
import {
  createAppendAudio,
  createCancelResponse,
  createCommitAudio,
  createDeleteConversationItem,
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

export interface InputAudioTranscript {
  itemId: string;
  transcript: string;
}

export class InputAudioTranscriptionError extends Error {
  public constructor(
    message: string,
    public readonly itemId?: string,
    public readonly correlationLost = false,
  ) {
    super(message);
    this.name = 'InputAudioTranscriptionError';
  }
}

interface PendingInputTranscription {
  commitEventId: string;
  itemId?: string;
  resolve: (value: InputAudioTranscript) => void;
  reject: (reason: Error) => void;
  timeout?: ReturnType<typeof setTimeout>;
}

export interface RealtimeClientEvents {
  connected: [];
  disconnected: [code: number, reason: string];
  audioDelta: [chunk: Buffer];
  audioDone: [];
  transcriptDelta: [delta: string];
  inputAudioCommitted: [itemId: string];
  inputTranscriptCompleted: [itemId: string, transcript: string];
  inputTranscriptFailed: [itemId: string | undefined, error: Error];
  responseDone: [usage?: RealtimeUsage];
  realtimeError: [error: Error];
  rawEvent: [event: RealtimeEvent];
}

export class OpenAIRealtimeClient extends EventEmitter<RealtimeClientEvents> {
  private socket: WebSocket | undefined;
  private readonly options: OpenAIRealtimeClientOptions;
  private readonly pendingInputTranscriptions: PendingInputTranscription[] = [];
  private inputCorrelationHealthy = true;
  private clientEventSequence = 0;

  public constructor(options: OpenAIRealtimeClientOptions) {
    super();
    this.options = options;
  }

  public async connect(): Promise<void> {
    if (this.socket?.readyState === WebSocket.OPEN) {
      return;
    }

    this.inputCorrelationHealthy = true;
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
        if (this.socket === socket) {
          this.socket = undefined;
        }
        this.rejectPendingInputTranscriptions(`Realtime socket closed (${code})`);
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

  public commitAudio(eventId?: string): void {
    this.send(createCommitAudio(eventId));
  }

  public async commitAudioAndWaitForTranscript(timeoutMs = 15_000): Promise<InputAudioTranscript> {
    if (!this.inputCorrelationHealthy) {
      throw new InputAudioTranscriptionError(
        'Realtime input correlation is unavailable; reconnect the voice session before committing more audio',
        undefined,
        true,
      );
    }

    return new Promise<InputAudioTranscript>((resolve, reject) => {
      const pending: PendingInputTranscription = {
        commitEventId: this.createClientEventId('commit'),
        resolve,
        reject,
      };

      pending.timeout = setTimeout(() => {
        const committedItemId = pending.itemId;

        if (committedItemId) {
          this.removePendingInputTranscription(pending);
          reject(
            new InputAudioTranscriptionError(
              `Realtime input transcription timed out after ${timeoutMs}ms`,
              committedItemId,
            ),
          );
          return;
        }

        this.invalidateInputCorrelation(
          pending,
          `Realtime input commit acknowledgement timed out after ${timeoutMs}ms`,
        );
      }, timeoutMs);
      pending.timeout.unref();

      this.pendingInputTranscriptions.push(pending);

      try {
        this.commitAudio(pending.commitEventId);
      } catch (error) {
        this.removePendingInputTranscription(pending);
        reject(error instanceof Error ? error : new Error(String(error)));
      }
    });
  }

  public requestResponse(): void {
    this.send(createResponseRequest());
  }

  public cancelResponse(): void {
    this.send(createCancelResponse());
  }

  public deleteConversationItem(itemId: string): void {
    this.send(createDeleteConversationItem(itemId));
  }

  public async close(): Promise<void> {
    const socket = this.socket;
    this.socket = undefined;

    if (!socket || socket.readyState === WebSocket.CLOSED) {
      this.rejectPendingInputTranscriptions('Realtime client closed');
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

  private createClientEventId(kind: string): string {
    this.clientEventSequence += 1;
    return `roomate_${kind}_${Date.now().toString(36)}_${this.clientEventSequence.toString(36)}`;
  }

  private send(event: RealtimeEvent): void {
    if (this.socket?.readyState !== WebSocket.OPEN) {
      throw new Error(`Realtime socket is not open; cannot send ${event.type}`);
    }
    this.socket.send(JSON.stringify(event));
  }

  private clearPendingInputTranscriptionTimeout(pending: PendingInputTranscription): void {
    if (pending.timeout) {
      clearTimeout(pending.timeout);
      delete pending.timeout;
    }
  }

  private removePendingInputTranscription(pending: PendingInputTranscription): void {
    this.clearPendingInputTranscriptionTimeout(pending);

    const index = this.pendingInputTranscriptions.indexOf(pending);
    if (index >= 0) {
      this.pendingInputTranscriptions.splice(index, 1);
    }
  }

  private invalidateInputCorrelation(
    timedOutRequest: PendingInputTranscription,
    timeoutMessage: string,
  ): void {
    if (!this.inputCorrelationHealthy) return;

    this.inputCorrelationHealthy = false;
    const pendingRequests = [...this.pendingInputTranscriptions];
    this.pendingInputTranscriptions.length = 0;

    for (const pending of pendingRequests) {
      this.clearPendingInputTranscriptionTimeout(pending);
      const message =
        pending === timedOutRequest
          ? timeoutMessage
          : 'Realtime input correlation was invalidated by an unacknowledged commit timeout';
      pending.reject(new InputAudioTranscriptionError(message, pending.itemId, true));
    }

    this.emit(
      'realtimeError',
      new InputAudioTranscriptionError(
        'Realtime input correlation lost; closing the socket to prevent later commit acknowledgements from being assigned to newer utterances',
        undefined,
        true,
      ),
    );

    const socket = this.socket;
    if (socket && socket.readyState !== WebSocket.CLOSED && socket.readyState !== WebSocket.CLOSING) {
      if (this.socket === socket) {
        this.socket = undefined;
      }
      socket.close(1011, 'input correlation lost');
    }
  }

  private assignCommittedItem(itemId: string): void {
    const pending = this.pendingInputTranscriptions.find((request) => !request.itemId);
    if (pending) {
      pending.itemId = itemId;
    }
  }

  private rejectCommitEvent(clientEventId: string, error: Error): boolean {
    const pending = this.pendingInputTranscriptions.find(
      (request) => request.commitEventId === clientEventId && !request.itemId,
    );
    if (!pending) return false;

    this.removePendingInputTranscription(pending);
    pending.reject(new InputAudioTranscriptionError(error.message));
    return true;
  }

  private resolveInputTranscription(itemId: string, transcript: string): void {
    const pending = this.pendingInputTranscriptions.find((request) => request.itemId === itemId);
    if (!pending) return;

    this.removePendingInputTranscription(pending);
    pending.resolve({ itemId, transcript });
  }

  private rejectInputTranscription(itemId: string | undefined, error: Error): void {
    const pending = itemId
      ? this.pendingInputTranscriptions.find((request) => request.itemId === itemId)
      : this.pendingInputTranscriptions.find((request) => request.itemId);
    if (!pending) return;

    const committedItemId = pending.itemId ?? itemId;
    this.removePendingInputTranscription(pending);
    pending.reject(new InputAudioTranscriptionError(error.message, committedItemId));
  }

  private rejectPendingInputTranscriptions(message: string): void {
    const pendingRequests = [...this.pendingInputTranscriptions];
    this.pendingInputTranscriptions.length = 0;

    for (const pending of pendingRequests) {
      this.clearPendingInputTranscriptionTimeout(pending);
      pending.reject(new InputAudioTranscriptionError(message, pending.itemId));
    }
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

      if (event.type === 'input_audio_buffer.committed') {
        const itemId = event.item_id;
        if (typeof itemId === 'string') {
          this.assignCommittedItem(itemId);
          this.emit('inputAudioCommitted', itemId);
        }
        return;
      }

      if (event.type === 'conversation.item.input_audio_transcription.completed') {
        const itemId = event.item_id;
        const transcript = event.transcript;
        if (typeof itemId === 'string' && typeof transcript === 'string') {
          this.emit('inputTranscriptCompleted', itemId, transcript);
          this.resolveInputTranscription(itemId, transcript);
        }
        return;
      }

      if (event.type === 'conversation.item.input_audio_transcription.failed') {
        const itemId = typeof event.item_id === 'string' ? event.item_id : undefined;
        const details = event.error as { message?: unknown } | undefined;
        const message =
          typeof details?.message === 'string' ? details.message : 'Realtime input transcription failed';
        const error = new InputAudioTranscriptionError(message, itemId);
        this.emit('inputTranscriptFailed', itemId, error);
        this.rejectInputTranscription(itemId, error);
        return;
      }

      if (event.type === 'response.done') {
        const response = event.response as { usage?: unknown } | undefined;
        this.emit('responseDone', response?.usage ? { raw: response.usage } : undefined);
        return;
      }

      if (event.type === 'error') {
        const details = event.error as { message?: unknown; event_id?: unknown } | undefined;
        const message = typeof details?.message === 'string' ? details.message : 'Unknown realtime error';
        const error = new Error(message);
        const clientEventId = typeof details?.event_id === 'string' ? details.event_id : undefined;
        if (clientEventId) {
          this.rejectCommitEvent(clientEventId, error);
        }
        this.emit('realtimeError', error);
      }
    } catch (error) {
      this.emit(
        'realtimeError',
        error instanceof Error ? error : new Error('Failed to parse realtime event'),
      );
    }
  }
}
