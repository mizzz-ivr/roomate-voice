# ローカル開発

## 必要環境

- Node.js 22.12以上
- npm 10以上
- FFmpeg
- Docker Desktop（Dockerで試す場合）
- Discord Bot Token / Application ID
- OpenAI API Key

## Node.jsで起動

```bash
npm install
cp .env.example .env
# .envへ必要な値を設定
npm run check
npm run dev
```

- Dashboard: `http://localhost:5173`
- Bot health: `http://localhost:3001/health`

## Dockerで起動

```bash
cp .env.example .env
docker compose up --build
```

- Dashboard: `http://localhost:8080`
- Bot health: `http://localhost:3001/health`

## Discord Developer Portal

Botに最低限必要な権限は以下です。

- View Channels
- Connect
- Speak
- Use Application Commands

Privileged Message Content Intentは不要です。Botは`Guilds`と`GuildVoiceStates`だけを利用します。

ローカル開発では`DISCORD_GUILD_ID`を設定してください。Guild commandは反映が速く、Global commandの反映待ちを避けられます。

## 音声テスト

1. Discordでテスト用VCへ入ります。
2. `/join`を実行します。
3. Botが参加したら短く話します。
4. OpenAIから返った音声がDiscordで再生されることを確認します。
5. AI再生中に話し、割り込みが動くことを確認します。
6. `/leave`で退出させます。

APIを利用する音声疎通テストは課金を伴うため、CIでは実行しません。
