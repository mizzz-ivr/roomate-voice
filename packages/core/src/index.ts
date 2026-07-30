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
