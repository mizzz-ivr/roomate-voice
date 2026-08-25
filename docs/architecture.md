# アーキテクチャ

## 配置

```text
Discord VC
  ⇅ Voice Gateway / UDP / Opus 48kHz
Bot Worker（ローカル / AWS Lightsail）
  ⇅ PCM16 24kHz / WebSocket
OpenAI Realtime API

Browser
  ⇅ HTTPS
Dashboard（ローカル Vite / Vercel）
  ⇅ Health API
Bot Worker
```

Vercelには管理画面だけを配置し、Discord Gateway・Voice Gateway・UDP・OpenAI Realtime WebSocketを保持するBot WorkerはLightsailまたはローカルDockerで常駐させます。

## 音声フロー

1. `/join` でBotをユーザーのVCへ接続します。
2. `@discordjs/voice` のReceiverからユーザー別Opusストリームを取得します。
3. OpusをPCM16 48kHz stereoへデコードします。
4. FFmpegでPCM16 24kHz monoへ変換します。
5. OpenAI Realtime APIへ音声チャンクを送ります。
6. 発話終了後に入力をcommitし、`gpt-transcribe`による入力文字起こし完了を待ちます。
7. 文字起こしを正規化し、`BOT_WAKE_WORD`または`BOT_WAKE_WORD_ALIASES`との一致を判定します。
8. Wake word一致時のみ`response.create`で応答生成を要求します。不一致時は、その入力アイテムをRealtime会話履歴から削除します。
9. APIのPCM16 24kHz monoを48kHz stereoへ戻してDiscordへ再生します。
10. AI再生中にユーザーが話し始めた場合は、再生停止と`response.cancel`を行います。

## Wake word gate

Wake word判定はローカル端末上の音響モデルではなく、Realtimeセッションの入力文字起こしを利用します。そのため、Active Speakerの音声はWake word判定前にOpenAI Realtime APIへ送信されます。

文字起こし本文は通常ログへ保存せず、判定結果・文字数・Guild/User識別子など運用に必要なメタデータだけを記録します。音声認識の表記揺れは`BOT_WAKE_WORD_ALIASES`で補完できます。

## Provider境界

`@roomate-voice/openai-realtime`をDiscord処理から分離しています。将来GPT-Live APIや別の音声Providerを追加する場合も、音声Transportやダッシュボードを維持したまま比較できる構成を目指します。

## 現在の制約

- 同時に処理する発話者は1人です。
- Wake word判定は入力文字起こしベースであり、ローカルの前段音響フィルターではありません。
- 入力文字起こしにもAPI利用量・料金が発生します。
- ダッシュボードのキャラクター保存はローカルUIのみで、Bot設定への永続反映は未実装です。
- Guild設定、会話履歴、利用量の永続化は未実装です。
- 実在人物や既存キャラクターの無許諾クローン音声は対象外です。
