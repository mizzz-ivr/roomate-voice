import { describe, expect, it } from 'vitest';
import { buildPersonaInstructions } from '../src/index.js';

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
