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

## 初期実装の音声フロー

1. `/join` でBotをユーザーのVCへ接続します。
2. `@discordjs/voice` のReceiverからユーザー別Opusストリームを取得します。
3. OpusをPCM16 48kHz stereoへデコードします。
4. FFmpegでPCM16 24kHz monoへ変換します。
5. OpenAI Realtime APIへ音声チャンクを送ります。
6. 発話終了後に入力をcommitし、応答生成を要求します。
7. APIのPCM16 24kHz monoを48kHz stereoへ戻してDiscordへ再生します。
8. AI再生中にユーザーが話し始めた場合は、再生停止と`response.cancel`を行います。

## Provider境界

`@roomate-voice/openai-realtime`をDiscord処理から分離しています。将来GPT-Live APIが提供された際は、新しいProviderを追加し、音声Transportやダッシュボードを維持したまま比較できます。

## MVPの制約

- 同時に処理する発話者は1人です。
- Wake wordの音声認識判定は未実装で、現在は全発話へ反応します。
- ダッシュボードのキャラクター保存はローカルUIのみで、Bot設定への永続反映は未実装です。
- 実在人物や既存キャラクターの無許諾クローン音声は対象外です。
