export interface RealtimeSessionOptions {
  model: string;
  voice: string;
  instructions: string;
  inputSampleRate?: number;
  outputSampleRate?: number;
}

export interface RealtimeEvent {
  type: string;
  [key: string]: unknown;
}

export function createSessionUpdate(options: RealtimeSessionOptions): RealtimeEvent {
  return {
    type: 'session.update',
    session: {
      type: 'realtime',
      model: options.model,
      output_modalities: ['audio'],
      instructions: options.instructions,
      audio: {
        input: {
          format: {
            type: 'audio/pcm',
            rate: options.inputSampleRate ?? 24_000,
          },
          turn_detection: null,
        },
        output: {
          format: {
            type: 'audio/pcm',
            rate: options.outputSampleRate ?? 24_000,
          },
          voice: options.voice,
        },
      },
    },
  };
}

export function createAppendAudio(chunk: Buffer): RealtimeEvent {
  return {
    type: 'input_audio_buffer.append',
    audio: chunk.toString('base64'),
  };
}

export function createCommitAudio(): RealtimeEvent {
  return { type: 'input_audio_buffer.commit' };
}

export function createResponseRequest(): RealtimeEvent {
  return { type: 'response.create' };
}

export function createCancelResponse(): RealtimeEvent {
  return { type: 'response.cancel' };
}
