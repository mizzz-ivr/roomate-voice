import { describe, expect, it } from 'vitest';
import {
  buildPersonaInstructions,
  buildWakeWordTranscriptionPrompt,
  containsWakeWord,
  normalizeWakeWordText,
} from '../src/index.js';

describe('buildPersonaInstructions', () => {
  it('includes persona and safety boundaries', () => {
    const prompt = buildPersonaInstructions({
      name: 'Luna',
      style: '元気に話す。',
      wakeWord: 'ルナ',
    });

    expect(prompt).toContain('Luna');
    expect(prompt).toContain('ルナ');
    expect(prompt).toContain('実在人物');
  });
});

describe('wake word matching', () => {
  it('normalizes width, whitespace and punctuation', () => {
    expect(normalizeWakeWordText(' Ｒｏｏ Mate！ ')).toBe('roomate');
  });

  it('matches the configured wake word in a transcript', () => {
    expect(containsWakeWord('ねえ、ルーメイト！聞こえる？', ['ルーメイト'])).toBe(true);
  });

  it('matches an ASR alias', () => {
    expect(containsWakeWord('ルームメイト、ネザーについて教えて', ['ルーメイト', 'ルームメイト'])).toBe(
      true,
    );
  });

  it('does not match unrelated conversation', () => {
    expect(containsWakeWord('今日マイクラやる？', ['ルーメイト', 'ルームメイト'])).toBe(false);
  });

  it('builds a transcription context without conversation content', () => {
    expect(buildWakeWordTranscriptionPrompt(['ルーメイト', 'ルームメイト'])).toContain(
      'ルーメイト、ルームメイト',
    );
  });
});
