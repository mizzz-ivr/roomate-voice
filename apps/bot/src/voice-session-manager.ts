import { PassThrough, pipeline as pipelineCallback } from 'node:stream';
import { promisify } from 'node:util';
import {
  AudioPlayerStatus,
  EndBehaviorType,
  NoSubscriberBehavior,
  StreamType,
  VoiceConnectionStatus,
  createAudioPlayer,
  createAudioResource,
  entersState,
  getVoiceConnection,
  joinVoiceChannel,
  type VoiceConnection,
} from '@discordjs/voice';
import { OpenAIRealtimeClient } from '@roomate-voice/openai-realtime';
import {
  buildPersonaInstructions,
  buildWakeWordTranscriptionPrompt,
  containsWakeWord,
} from '@roomate-voice/core';
import prism from 'prism-media';
import type { ChatInputCommandInteraction, GuildMember, VoiceBasedChannel } from 'discord.js';
import type { AppConfig } from '@roomate-voice/config';
import type { Logger } from './logger.js';

const pipeline = promisify(pipelineCallback);

interface GuildVoiceSession {
  guildId: string;
  channelId: string;
  connection: VoiceConnection;
  realtime: OpenAIRealtimeClient;
  wakeWords: string[];
  activeSpeakerId: string | undefined;
  outputPcm: PassThrough | undefined;
  responseInProgress: boolean;
  startedAt: number;
}

function resolveWakeWords(config: AppConfig): string[] {
  const aliases = config.BOT_WAKE_WORD_ALIASES.split(',')
    .map((value) => value.trim())
    .filter(Boolean);

  return [...new Set([config.BOT_WAKE_WORD, ...aliases])];
}

export class VoiceSessionManager {
  private readonly sessions = new Map<string, GuildVoiceSession>();

  public constructor(
    private readonly config: AppConfig,
    private readonly logger: Logger,
  ) {}

  public get activeSessionCount(): number {
    return this.sessions.size;
  }

  public hasSession(guildId: string): boolean {
    return this.sessions.has(guildId);
  }

  public getSessionChannelId(guildId: string): string | undefined {
    return this.sessions.get(guildId)?.channelId;
  }

  public async joinFromInteraction(interaction: ChatInputCommandInteraction): Promise<VoiceBasedChannel> {
    if (!interaction.guild || !interaction.guildId) {
      throw new Error('このコマンドはDiscordサーバー内で実行してください。');
    }

    const member = interaction.member as GuildMember | null;
    const channel = member?.voice.channel;
    if (!channel) {
      throw new Error('先にボイスチャンネルへ参加してください。');
    }

    await this.leave(interaction.guildId);

    const connection = joinVoiceChannel({
      guildId: interaction.guildId,
      channelId: channel.id,
      adapterCreator: interaction.guild.voiceAdapterCreator,
      selfDeaf: false,
      selfMute: false,
    });

    await entersState(connection, VoiceConnectionStatus.Ready, 20_000);

    const player = createAudioPlayer({
      behaviors: { noSubscriber: NoSubscriberBehavior.Pause },
    });
    connection.subscribe(player);

    const wakeWords = resolveWakeWords(this.config);
    const realtime = new OpenAIRealtimeClient({
      apiKey: this.config.OPENAI_API_KEY,
      model: this.config.OPENAI_REALTIME_MODEL,
      voice: this.config.OPENAI_VOICE,
      instructions: buildPersonaInstructions({
        name: this.config.BOT_PERSONA_NAME,
        style: this.config.BOT_PERSONA_STYLE,
        wakeWord: this.config.BOT_WAKE_WORD,
      }),
      inputTranscription: {
        model: this.config.OPENAI_TRANSCRIPTION_MODEL,
        prompt: buildWakeWordTranscriptionPrompt(wakeWords),
      },
    });

    const session: GuildVoiceSession = {
      guildId: interaction.guildId,
      channelId: channel.id,
      connection,
      realtime,
      wakeWords,
      activeSpeakerId: undefined,
      outputPcm: undefined,
      responseInProgress: false,
      startedAt: Date.now(),
    };

    realtime.on('audioDelta', (chunk) => {
      if (!session.outputPcm) {
        const input = new PassThrough();
        const transcoder = new prism.FFmpeg({
          args: [
            '-loglevel',
            'error',
            '-f',
            's16le',
            '-ar',
            '24000',
            '-ac',
            '1',
            '-i',
            'pipe:0',
            '-f',
            's16le',
            '-ar',
            '48000',
            '-ac',
            '2',
            'pipe:1',
          ],
        });
        input.pipe(transcoder);
        const resource = createAudioResource(transcoder, { inputType: StreamType.Raw });
        player.play(resource);
        session.outputPcm = input;
      }
      session.outputPcm.write(chunk);
    });

    const finishOutput = () => {
      session.outputPcm?.end();
      session.outputPcm = undefined;
    };
    realtime.on('audioDone', finishOutput);
    realtime.on('responseDone', () => {
      session.responseInProgress = false;
      finishOutput();
    });
    realtime.on('realtimeError', (error) => {
      this.logger.error('OpenAI Realtime error', {
        guildId: session.guildId,
        error: error.message,
      });
    });

    player.on('error', (error) => {
      this.logger.error('Discord audio player error', {
        guildId: session.guildId,
        error: error.message,
      });
    });
    player.on(AudioPlayerStatus.Idle, finishOutput);

    connection.on(VoiceConnectionStatus.Disconnected, async () => {
      try {
        await Promise.race([
          entersState(connection, VoiceConnectionStatus.Signalling, 5_000),
          entersState(connection, VoiceConnectionStatus.Connecting, 5_000),
        ]);
      } catch {
        await this.leave(session.guildId);
      }
    });

    await realtime.connect();
    this.attachReceiver(session, interaction.client.user.id, player.stop.bind(player));
    this.sessions.set(interaction.guildId, session);

    this.logger.info('Voice session started', {
      guildId: interaction.guildId,
      channelId: channel.id,
      model: this.config.OPENAI_REALTIME_MODEL,
      transcriptionModel: this.config.OPENAI_TRANSCRIPTION_MODEL,
      wakeWordGate: true,
    });

    return channel;
  }

  public async leave(guildId: string): Promise<void> {
    const session = this.sessions.get(guildId);
    this.sessions.delete(guildId);

    if (!session) {
      getVoiceConnection(guildId)?.destroy();
      return;
    }

    session.outputPcm?.destroy();
    await session.realtime.close();
    session.connection.destroy();

    this.logger.info('Voice session stopped', {
      guildId,
      durationSeconds: Math.round((Date.now() - session.startedAt) / 1_000),
    });
  }

  public async closeAll(): Promise<void> {
    await Promise.all([...this.sessions.keys()].map((guildId) => this.leave(guildId)));
  }

  private attachReceiver(
    session: GuildVoiceSession,
    botUserId: string,
    stopPlayer: (force?: boolean) => boolean,
  ): void {
    session.connection.receiver.speaking.on('start', (userId) => {
      if (userId === botUserId || session.activeSpeakerId) return;

      const isBargeIn = session.responseInProgress || Boolean(session.outputPcm);
      if (isBargeIn) {
        stopPlayer(true);
        session.outputPcm?.destroy();
        session.outputPcm = undefined;
        try {
          session.realtime.cancelResponse();
        } catch (error) {
          this.logger.debug('Response cancellation skipped', {
            guildId: session.guildId,
            error: error instanceof Error ? error.message : String(error),
          });
        } finally {
          session.responseInProgress = false;
        }
      }

      session.activeSpeakerId = userId;
      const opus = session.connection.receiver.subscribe(userId, {
        end: {
          behavior: EndBehaviorType.AfterSilence,
          duration: this.config.BOT_SILENCE_MS,
        },
      });
      const decoder = new prism.opus.Decoder({
        rate: 48_000,
        channels: 2,
        frameSize: 960,
      });
      const transcoder = new prism.FFmpeg({
        args: [
          '-loglevel',
          'error',
          '-f',
          's16le',
          '-ar',
          '48000',
          '-ac',
          '2',
          '-i',
          'pipe:0',
          '-f',
          's16le',
          '-ar',
          '24000',
          '-ac',
          '1',
          'pipe:1',
        ],
      });

      transcoder.on('data', (chunk: Buffer) => {
        try {
          session.realtime.appendAudio(chunk);
        } catch (error) {
          this.logger.warn('Failed to append realtime audio', {
            guildId: session.guildId,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      });

      void pipeline(opus, decoder, transcoder)
        .then(async () => {
          const { itemId, transcript } = await session.realtime.commitAudioAndWaitForTranscript();
          const wakeWordMatched = containsWakeWord(transcript, session.wakeWords);
          const shouldRespond = isBargeIn || wakeWordMatched;

          this.logger.debug('Wake word transcription evaluated', {
            guildId: session.guildId,
            userId,
            matched: wakeWordMatched,
            bypassedForBargeIn: isBargeIn,
            transcriptLength: transcript.length,
          });

          if (!shouldRespond) {
            try {
              session.realtime.deleteConversationItem(itemId);
            } catch (error) {
              this.logger.warn('Failed to delete ignored realtime conversation item', {
                guildId: session.guildId,
                error: error instanceof Error ? error.message : String(error),
              });
            }
            return;
          }

          session.realtime.requestResponse();
          session.responseInProgress = true;
        })
        .catch((error: unknown) => {
          this.logger.warn('Discord input audio pipeline or transcription ended with an error', {
            guildId: session.guildId,
            userId,
            error: error instanceof Error ? error.message : String(error),
          });
        })
        .finally(() => {
          session.activeSpeakerId = undefined;
        });
    });
  }
}
