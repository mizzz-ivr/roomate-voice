# ローカル開発

このページは日常開発向けの短縮版です。

Discord Application作成、OpenAI API準備、Windows環境構築、VC音声往復、割り込み、Docker、トラブルシューティングまで含む初回手順は、次を使用してください。

- [WindowsローカルE2E音声テスト手順書](windows-local-e2e-runbook.md)
- [E2Eテスト結果テンプレート](e2e-test-record-template.md)

## 必要環境

- Node.js 22.12以上
- npm 10以上
- FFmpeg
- Docker Desktop（Dockerで試す場合）
- Discord Bot Token / Application ID / Test Guild ID
- OpenAI Project API Key

## Node.jsで起動

PowerShell:

```powershell
git switch main
git pull --ff-only origin main
Copy-Item .env.example .env
notepad .env
npm install
npm run check
npm run dev
```

- Dashboard: `http://localhost:5173`
- Bot health: `http://localhost:3001/health`

Health確認:

```powershell
Invoke-RestMethod http://localhost:3001/health | ConvertTo-Json
```

## Dockerで起動

```powershell
Copy-Item .env.example .env
docker compose config
docker compose up --build
```

- Dashboard: `http://localhost:8080`
- Bot health: `http://localhost:3001/health`

停止:

```powershell
docker compose down
```

## Discord Developer Portal

Botに最低限必要な権限は以下です。

- View Channels
- Connect
- Speak
- Use Application Commands

Installation scopes:

- `bot`
- `applications.commands`

Privileged Message Content Intentは不要です。Botは`Guilds`と`GuildVoiceStates`だけを利用します。

ローカル開発では`DISCORD_GUILD_ID`を設定してください。Guild commandは反映が速く、Global commandの反映待ちを避けられます。

## 音声テスト

1. Discordでテスト用VCへ入る
2. `/status`を実行する
3. `/join`を実行する
4. Botが参加したら2〜5秒程度話す
5. 約1秒無言になり、OpenAIの音声応答を待つ
6. AI再生中に話し、割り込みを確認する
7. `/leave`で退出させる
8. `docs/e2e-test-record-template.md`へ結果を記録する

## 現在の制約

- `BOT_WAKE_WORD`はまだ入力音声の前段判定ではありません
- VC内で最初に話した1人をActive Speakerとして処理します
- 同時発話の完全対応は未実装です
- Guild設定、会話履歴、利用量はまだ永続化しません
- APIを利用する音声疎通テストは課金を伴うためCIでは実行しません
