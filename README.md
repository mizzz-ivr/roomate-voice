# RooMate Voice

Discordのボイスチャンネルへ参加し、OpenAI Realtime APIを使って自然に音声会話するOSS音声AI Botです。

## Windows Desktop Preview

非エンジニア向けWindows Desktop Appを **v0.1.0 Preview** として公開しています。

- Release: [RooMate Voice v0.1.0 (Preview)](https://github.com/mizzz-ivr/roomate-voice/releases/tag/v0.1.0)
- Installer: `rmv_Setup_version0.1.0.exe`
- 対象: Windows x64
- 導入・使い方: [Windows Desktop 利用ガイド](docs/windows-desktop-user-guide.md)
- ドキュメント一覧: [docs/README.md](docs/README.md)

一般ユーザーは次を手動導入する必要はありません。

- PowerShell / CMD操作
- Git
- Node.js / npm
- FFmpeg / PATH設定
- Docker Desktop / WSL
- `.env`編集

> [!WARNING]
> `v0.1.0` は **Preview / Pre-release** です。Setup.exe、GUI、packaged Voice Worker、bundled FFmpegは実装・CI検証済みですが、Windows実機Discord/OpenAI VC E2EとClean Windows installer acceptanceはまだ完了していません。Stable版としての利用保証はまだ行いません。

> [!IMPORTANT]
> Discord Bot Token / OpenAI API KeyなどのSecretをGitHub Issue、PR、Notion、Chatへ貼らないでください。Desktop版ではSecretをWindows保護ストレージへ保存し、保存済みSecretの平文をrendererへ再表示しない設計です。

## 主な機能

### Voice Worker

- Discord slash commands: `/join`、`/leave`、`/status`
- Discord Voice Receiverからユーザー音声を取得
- Opus 48kHz stereo → PCM16 24kHz mono変換
- OpenAI Realtime API WebSocket接続
- `gpt-transcribe`による入力文字起こし
- Wake word / Alias一致時だけAI応答を生成
- Wake word不一致の入力アイテムをRealtime会話履歴から削除
- Realtime音声 → Discord 48kHz stereo再生
- AI発話中のbarge-in
- Persona / Voice / Wake word設定
- ordered input decisions / capture lease / Wake coalescing
- commit / clear ACK相関とfail-close
- Realtime切断時のDiscord voice session終了
- Transcription本文を通常ログへ保存しない

標準設定:

- Realtime model: `gpt-realtime-2.1-mini`
- Transcription model: `gpt-transcribe`
- Wake word: `ルーメイト`
- Alias: `ルームメイト`

### Windows Desktop App

- Electron 44 + React + Vite
- NSIS Windows x64 installer
- Initial Setup / Home / RooMate Settings / Diagnostics foundation
- Bot Start / Stop / Restart
- Voice Worker lifecycle管理
- single-instance lock
- Electron `safeStorage`によるSecret保存
- Secret redaction
- Health polling / HTTP 503 degraded health反映
- packaged Voice Worker
- bundled FFmpeg
- Start Menu / Desktop shortcut

後続予定:

- GUI connection test
- diagnostics export
- task tray
- Windows login auto-start
- Bot auto-start
- code signing / SmartScreen対策
- auto update
- Stable Release

## Discordでの基本的な使い方

1. RooMate Voice BotをDiscordサーバーへ追加します。
2. RooMate Voice DesktopでDiscord / OpenAI / RooMate設定を保存します。
3. `Bot Start`を実行します。
4. DiscordでVoice Channelへ参加します。
5. `/status`で状態を確認します。
6. `/join`でBotをVCへ参加させます。
7. `ルーメイト、聞こえる？` のようにWake wordを含めて話します。
8. `/leave`で退出させます。

Alias `ルームメイト` でも呼びかけできます。Wake wordなしの通常発話には原則応答しません。AI発話中のbarge-inではWake wordなしでも割り込み後の発話へ応答します。

詳細は [Windows Desktop 利用ガイド](docs/windows-desktop-user-guide.md) を参照してください。

## プライバシー上の注意

> [!WARNING]
> Wake word判定はローカル音響モデルではなく、OpenAI Realtimeの入力文字起こしを利用します。Active Speakerの音声はWake word判定前にOpenAI APIへ送信されます。Wake word不一致時はAI応答を生成せず、その入力アイテムをRealtime会話履歴から削除します。

## Repository構成

```text
roomate-voice/
├─ apps/
│  ├─ bot/                 # Discord常駐Bot・音声処理・Health API
│  ├─ dashboard/           # Vite/React管理Dashboard
│  └─ desktop/             # Electron Windows Desktop App
├─ packages/
│  ├─ config/              # 設定検証
│  ├─ core/                # Persona・Wake word・Provider境界
│  └─ openai-realtime/     # OpenAI Realtime adapter
├─ infra/lightsail/        # Lightsail常駐用Compose/Systemd
├─ docs/                   # User Guide / E2E / 設計 / 運用
└─ .github/workflows/      # CI / Release / GHCR
```

## 開発者向けローカル起動

Windows利用者向けSetup.exeとは別に、開発・E2EではNode.js直接起動とDocker Composeを利用できます。

### 必要環境

- Node.js `>=22.12.0`
- npm 10以上を目安
- Git
- FFmpeg
- Discord Bot Token / Application ID / Guild ID
- OpenAI API Key

### Node.js

```bash
npm install
cp .env.example .env
# .envをローカルで設定
npm run check
npm run dev
```

| URL | 用途 |
|---|---|
| `http://localhost:5173` | Dashboard |
| `http://localhost:3001/health` | Bot health |

### Docker Compose

```bash
cp .env.example .env
docker compose up --build
```

| URL | 用途 |
|---|---|
| `http://localhost:8080` | Dashboard |
| `http://localhost:3001/health` | Bot health |

## 環境変数

開発版ではRepository直下の`.env`を使用できます。

```env
DISCORD_BOT_TOKEN=
DISCORD_CLIENT_ID=
DISCORD_GUILD_ID=
OPENAI_API_KEY=
OPENAI_REALTIME_MODEL=gpt-realtime-2.1-mini
OPENAI_TRANSCRIPTION_MODEL=gpt-transcribe
OPENAI_VOICE=marin
BOT_HTTP_PORT=3001
BOT_PERSONA_NAME=RooMate
BOT_PERSONA_STYLE=明るく親しみやすいゲーム仲間。返答は短くする。
BOT_WAKE_WORD=ルーメイト
BOT_WAKE_WORD_ALIASES=ルームメイト
BOT_SILENCE_MS=900
VITE_BOT_HEALTH_URL=http://localhost:3001/health
```

`BOT_WAKE_WORD_ALIASES`はカンマ区切りで複数指定できます。

## デプロイ方針

### Windows Desktop

一般ユーザー向け正式経路です。GitHub ReleasesからSetup.exeを配布します。

### Vercel

`apps/dashboard`のビルド成果物を配置します。

### AWS Lightsail

Discord Gateway・Voice Gateway・UDP・OpenAI Realtime WebSocketを維持する常駐Botを配置します。

```text
Windows Desktop → Local Voice Worker + bundled FFmpeg
Vercel          → Dashboard
Lightsail       → Optional always-on Bot Worker
OpenAI          → Realtime API
Discord         → Voice Gateway / UDP
```

## 開発コマンド

```bash
npm run dev
npm run dev:bot
npm run dev:dashboard
npm run dev:desktop
npm run typecheck
npm run test
npm run build
npm run check
npm run desktop:make:win
```

`npm run check` は typecheck + unit test + production build を実行します。

## 現在のリリース判定

| 項目 | 状態 |
|---|---|
| Windows installer build | ✅ |
| packaged Voice Worker | ✅ |
| bundled FFmpeg | ✅ |
| Windows CI | ✅ |
| GitHub Preview Release | ✅ |
| Windows実VC E2E | ⏳ |
| Clean Windows installer E2E | ⏳ |
| Stable Release | ⏳ |

## ロードマップ

- [x] ローカルビルド基盤
- [x] Discord VC参加・退出
- [x] OpenAI Realtime Provider
- [x] 音声入出力パイプライン
- [x] Wake word / Alias transcription gate
- [x] production-readiness race / cleanup safety
- [x] Windows Desktop foundation
- [x] Voice Worker / FFmpeg bundle
- [x] Setup.exe / Preview Release
- [ ] Windows実VC E2E
- [ ] Clean Windows acceptance
- [ ] GUI connection test
- [ ] diagnostics export
- [ ] task tray
- [ ] code signing / auto update
- [ ] Stable Release
- [ ] Guildごとの設定保存
- [ ] Discord OAuth / Supabase
- [ ] 利用量・費用集計
- [ ] 音声Provider追加
- [ ] 複数VC・水平スケール

## 音声と権利

RooMate Voiceは、実在人物や既存キャラクターの無許諾な音声クローンを提供しません。独自音声Providerを追加する場合は、話者本人の同意、音声素材の利用権、表示上のAI音声明示を確認してください。

## ドキュメント

### 利用ユーザー向け

- [Windows Desktop 利用ガイド](docs/windows-desktop-user-guide.md)
- [ドキュメント一覧](docs/README.md)

### 開発・E2E

- [WindowsローカルE2E音声テスト手順書](docs/windows-local-e2e-runbook.md)
- [Voice Production Readiness E2E](docs/voice-production-readiness-e2e.md)
- [E2Eテスト結果テンプレート](docs/e2e-test-record-template.md)
- [ローカル開発](docs/local-development.md)

### 設計・運用

- [アーキテクチャ](docs/architecture.md)
- [Windows Desktop App計画](docs/windows-desktop-app-plan.md)
- [AWS Lightsailへの配置](docs/lightsail-deployment.md)
- [コントリビューション](CONTRIBUTING.md)
- [セキュリティ](SECURITY.md)

## License

Apache License 2.0
