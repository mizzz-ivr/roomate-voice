# RooMate Voice

Discordのボイスチャンネルへ参加し、OpenAI Realtime APIを使って自然に音声会話するOSS Discord Botです。

現在は`gpt-realtime-2.1-mini`を標準モデルとし、会話Providerを分離しています。将来GPT-Live APIが利用可能になった場合も、性能・遅延・料金を比較してProvider単位で切り替えられる設計を目指します。

## 現在の実装範囲

- Discord slash commands: `/join`、`/leave`、`/status`
- Discord Voice Receiverからユーザー音声を取得
- Opus 48kHz stereoからPCM16 24kHz monoへ変換
- OpenAI Realtime APIへWebSocket接続
- Realtime音声出力をDiscord用48kHz stereoへ変換して再生
- ユーザー発話によるAI音声の割り込み停止
- キャラクター名・性格・口調・呼びかけ語のInstructions生成
- Bot health endpoint
- React/Vite管理ダッシュボード
- ローカルNode.js実行・Docker Compose
- AWS Lightsail向け常駐Compose/Systemd
- GitHub Actionsによるテスト・ビルド・GHCR公開

> [!IMPORTANT]
> 初回実装は基盤フェーズです。Discord/OpenAIの実資格情報を用いたEnd-to-End音声疎通は、利用者のローカル環境で実施してください。API課金が発生するためCIでは実行しません。

## 構成

```text
roomate-voice/
├─ apps/
│  ├─ bot/                 # Discord常駐Bot・音声処理・Health API
│  └─ dashboard/           # Vite/React管理画面（Vercel対応）
├─ packages/
│  ├─ config/              # 環境変数検証
│  ├─ core/                # Persona・Provider境界
│  └─ openai-realtime/     # OpenAI Realtime WebSocket adapter
├─ infra/lightsail/        # Lightsail常駐用Compose/Systemd
├─ docs/                   # 設計・ローカル開発・配置手順
└─ .github/workflows/      # CI・Botコンテナ公開
```

## ローカル起動

### 必要環境

- Node.js 22.12以上
- npm 10以上
- FFmpeg
- Discord Bot Token / Application ID
- OpenAI API Key

### Node.js

```bash
npm install
cp .env.example .env
# .envを設定
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

```env
DISCORD_BOT_TOKEN=
DISCORD_CLIENT_ID=
DISCORD_GUILD_ID=
OPENAI_API_KEY=
OPENAI_REALTIME_MODEL=gpt-realtime-2.1-mini
OPENAI_VOICE=marin
BOT_HTTP_PORT=3001
BOT_PERSONA_NAME=RooMate
BOT_PERSONA_STYLE=明るく親しみやすいゲーム仲間。返答は短くする。
BOT_WAKE_WORD=ルーメイト
BOT_SILENCE_MS=900
VITE_BOT_HEALTH_URL=http://localhost:3001/health
```

## Discordでの使い方

1. BotをDiscordサーバーへ招待します。
2. ユーザーがボイスチャンネルへ参加します。
3. `/join`を実行します。
4. Botへ話しかけます。
5. `/leave`で退出させます。

Botに必要な権限は、View Channels、Connect、Speak、Use Application Commandsです。

## デプロイ方針

### Vercel

`apps/dashboard`のビルド成果物だけを配置します。ルートの`vercel.json`からそのままデプロイできます。

### AWS Lightsail

Discord Gateway・Voice Gateway・UDP・OpenAI Realtime WebSocketを維持する常駐Botを配置します。`infra/lightsail`のComposeとSystemd Unitを使用します。

```text
Vercel       → Dashboard
Lightsail    → Bot Worker + FFmpeg
OpenAI       → Realtime API
Discord      → Voice Gateway / UDP
```

## 開発コマンド

```bash
npm run dev            # BotとDashboardを並列起動
npm run dev:bot        # Botのみ
npm run dev:dashboard  # Dashboardのみ
npm run typecheck
npm run test
npm run build
npm run check          # typecheck + test + build
```

## ロードマップ

- [x] ローカルビルド基盤
- [x] Discord VC参加・退出
- [x] Realtime Provider基盤
- [x] 音声入出力パイプライン
- [x] Vercel向けDashboard
- [x] Lightsail常駐構成
- [ ] Wake word判定
- [ ] Guildごとの設定保存
- [ ] Discord OAuth / Supabase
- [ ] 利用量・費用集計
- [ ] 音声Provider追加
- [ ] 許諾済みカスタム音声管理
- [ ] GPT-Live Provider
- [ ] 複数同時VC・水平スケール

## 音声と権利

RooMate Voiceは、実在人物や既存キャラクターの無許諾な音声クローンを提供しません。独自音声Providerを追加する場合は、話者本人の同意、音声素材の利用権、表示上のAI音声明示を確認してください。

## ドキュメント

- [アーキテクチャ](docs/architecture.md)
- [ローカル開発](docs/local-development.md)
- [AWS Lightsailへの配置](docs/lightsail-deployment.md)
- [コントリビューション](CONTRIBUTING.md)
- [セキュリティ](SECURITY.md)

## License

Apache License 2.0
