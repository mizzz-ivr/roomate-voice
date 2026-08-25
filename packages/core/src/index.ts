export interface PersonaDefinition {
  name: string;
  style: string;
  wakeWord: string;
}

export interface ConversationProvider {
  connect(): Promise<void>;
  appendAudio(chunk: Buffer): void;
  commitAudio(): void;
  requestResponse(): void;
  cancelResponse(): void;
  close(): Promise<void>;
}

export function buildPersonaInstructions(persona: PersonaDefinition): string {
  return [
    `あなたの名前は「${persona.name}」です。`,
    persona.style,
    'Discordのゲームコミュニティで、複数人と音声会話しています。',
    '返答は通常1〜3文に収め、ゲームプレイを妨げる長い説明は避けてください。',
    '参加者の発言が不明瞭な場合は、推測で断定せず短く聞き返してください。',
    'AI音声であることを偽らず、実在人物や既存キャラクター本人を名乗らないでください。',
    `呼びかけ語は「${persona.wakeWord}」です。`,
  ].join('\n');
}

export function normalizeWakeWordText(value: string): string {
  return value
    .normalize('NFKC')
    .toLocaleLowerCase('ja-JP')
    .replace(/[\s\p{P}\p{S}]/gu, '');
}

export function containsWakeWord(transcript: string, wakeWords: readonly string[]): boolean {
  const normalizedTranscript = normalizeWakeWordText(transcript);
  if (!normalizedTranscript) return false;

  return wakeWords.some((wakeWord) => {
    const normalizedWakeWord = normalizeWakeWordText(wakeWord);
    return normalizedWakeWord.length > 0 && normalizedTranscript.includes(normalizedWakeWord);
  });
}

export function buildWakeWordTranscriptionPrompt(wakeWords: readonly string[]): string {
  const candidates = wakeWords.map((wakeWord) => wakeWord.trim()).filter(Boolean);
  return `Discord音声の日本語文字起こしです。固有の呼びかけ語候補: ${candidates.join('、')}`;
}
