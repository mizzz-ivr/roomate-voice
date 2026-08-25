# Windows ローカルE2E音声テスト手順書

Windows PC上でRooMate Voiceを起動し、Discord VC + OpenAI Realtime APIの実音声E2Eを確認するための正本Runbookです。

対象リポジトリ: `mizzz-ivr/roomate-voice`

対象ブランチ: 原則 `main`。未マージfixを検証する場合だけ対象PRのhead branchを使用します。

## 1. 現行仕様

- OpenAI Realtime input transcription (`gpt-transcribe`) を使用する
- `BOT_WAKE_WORD` / `BOT_WAKE_WORD_ALIASES` に一致した発話だけ `response.create` する
- Wake word不一致のcommitted itemは `conversation.item.delete` で会話履歴から削除する
- AI発話中のbarge-inはWake wordなしでも応答対象とする
- 文字起こし本文は通常ログへ保存しない
- 音声capture lockはTranscription待ちとは分離し、Transcription latency中の次発話を取りこぼさない
- speaker capture lockは取得ごとのlease identityで管理する
- pending Transcriptionのitem ID相関とWake/delete/response判定はcommit順で処理する
- 新しいaudio captureが進行中は先行batchの`response.create`を保留する
- 同一decision batchの複数Wake発話はbatch drain後に1回のResponseへまとめ、重複Responseを避ける
- `input_audio_buffer.commit`へclient event IDを付与し、commit errorを該当requestへ相関する
- ACK前timeoutで相関安全性を失った場合はfail closedし、Realtime socketとDiscord voice sessionを終了する
- 同時発話の完全処理は未対応。1つの音声capture中は別speakerの開始を受け付けない
- Wake word判定前のActive Speaker音声はOpenAI APIへ送信される。ローカル音響Wake word filterではない

## 2. Secret安全ルール

- `.env` / Discord Bot Token / OpenAI API KeyをGitHub、Notion、Discord、Chatへ貼らない
- Transcription本文をログ共有しない
- SecretはまずRepository直下の`.env`で管理し、Windows global環境変数へむやみに保存しない
- `.env`作成後は必ず `git status --short` でGit管理対象外を確認する

## 3. Windows環境棚卸し

PowerShellで実行します。

```powershell
$PSVersionTable.PSVersion
winget --version
git --version
node --version
npm --version
ffmpeg -version
docker --version
docker compose version
wsl --status
```

Repository要件:

- Node.js `>=22.12.0`
- npm 10以上を目安
- Git
- FFmpegがPATHから実行可能
- Docker phaseではWSL 2 + Docker Desktop

存在しないものだけ導入します。Package IDを決め打ちせず必要に応じて確認します。

```powershell
winget search Git
winget search NodeJS
winget search FFmpeg
winget search Docker
```

管理者権限、Windows Feature有効化、再起動が必要な場合は、その処理が必要なソフトだけ実施してください。恒久的なExecutionPolicy変更は不要です。

## 4. Repository準備

既にclone済み:

```powershell
cd $HOME\src\roomate-voice
git fetch origin
git switch main
git pull --ff-only origin main
git status
```

初回:

```powershell
cd $HOME
New-Item -ItemType Directory -Force src | Out-Null
cd src
git clone https://github.com/mizzz-ivr/roomate-voice.git
cd roomate-voice
git switch main
```

PR #5をmainへマージする前の実VC確認では:

```powershell
git fetch origin
git switch fix/voice-production-readiness-follow-up
git pull --ff-only origin fix/voice-production-readiness-follow-up
git status
```

## 5. `.env`作成

Repository直下で:

```powershell
Copy-Item .env.example .env
notepad .env
```

VS Code利用時:

```powershell
code .env
```

現在の設定項目:

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
BOT_PERSONA_STYLE=明るく親しみやすいゲーム仲間。返答は短く、プレイ中の邪魔にならないように話す。
BOT_WAKE_WORD=ルーメイト
BOT_WAKE_WORD_ALIASES=ルームメイト
BOT_SILENCE_MS=900
LOG_LEVEL=debug
VITE_BOT_HEALTH_URL=http://localhost:3001/health
```

Secret値はPC上でのみ入力します。OpenAI API Keyが既に保存済みなら、その値をChatへ再掲せずPC上の`.env`へ設定してください。

```powershell
git status --short
```

`.env`が表示されないことを確認してください。

## 6. Discord設定

必要値:

- Discord Application ID
- Bot Token
- Test Guild ID

Scopes:

- `bot`
- `applications.commands`

Permissions:

- View Channels
- Connect
- Speak
- Use Application Commands

Intents:

- Guilds
- GuildVoiceStates

## 7. Local Check

```powershell
npm install
npm run check
```

成功後:

```powershell
npm run dev
```

別PowerShell:

```powershell
Invoke-RestMethod http://localhost:3001/health | ConvertTo-Json
```

期待値:

- `status = ok`
- `discordReady = true`
- VC参加前 `activeVoiceSessions = 0`

## 8. Discord実VC E2E

Issue #2と `docs/voice-production-readiness-e2e.md` も併せて記録に使用します。

### Commands

1. `/status`
2. `/join`
3. Healthで `activeVoiceSessions = 1`

### Wake wordなし

```text
今日マイクラやる？
```

期待: Botは応答しない。

### Primary Wake word

```text
ルーメイト、聞こえる？
```

期待: Botが応答する。

### Alias

```text
ルームメイト、ネザーについて教えて
```

期待: Botが応答する。

### 履歴汚染

```text
今日は何時からやる？
```

無応答を確認後:

```text
ルーメイト、ダイヤはどの高さで掘る？
```

期待: 後者だけへ正常応答し、前者の内容を会話履歴へ残さない。

### Barge-in

```text
ルーメイト、工業MODを始める手順を五つ教えて
```

AI発話中:

```text
ごめん、三つだけにして
```

期待:

- AI再生停止
- 進行中Responseをcancel
- Wake wordなしでも新しい発話へ応答
- 5回中4回以上成功を目標

### Transcription latency / commit-order race

最初の発話を終えた直後、Transcription結果を待たずに次の発話を開始します。Wake wordなし→Wake word、Wake word→Wake wordを複数回試します。

期待:

- 次の `speaking.start` がTranscription待ちだけを理由に無視されない
- 同一ユーザーが続けて話しても古いcleanupで新しいcapture leaseが外れない
- committed itemとTranscription結果が別発話へ誤相関しない
- Transcription結果が逆順に完了してもWake/delete/response判定はcommit順になる
- 後続capture中に先行Responseを開始してユーザー音声へ被せない
- back-to-back Wake発話で重複Responseを生成しない

### Commit / Transcription failure

通常E2E中に故意にSecretや音声本文をログへ出力しないでください。

期待:

- commit errorが発生した場合、client event IDで該当pending requestだけを失敗扱いにする
- Transcription失敗時、committed item IDを保持して`conversation.item.delete`を試行する
- ACK前timeoutが発生した場合は相関queueを使い続けずfail closedする
- fail closed時はRealtime切断後にDiscord voice sessionも終了する
- 再開時は`/join`で新しいRealtime sessionを作成する

## 9. 終了

```text
/leave
```

期待:

- Bot退出
- `activeVoiceSessions = 0`
- `Voice session stopped`

最後に `Ctrl + C` で終了します。

## 10. Docker E2E

Node.js直接起動のE2E成功後に実施します。

```powershell
docker compose config
docker compose up --build
```

Node.js版と同じ `/join` / Wake word / Alias / 履歴汚染 / barge-in / Transcription latency race / `/leave` を確認します。

終了:

```powershell
docker compose down
```

## 11. 合格条件

- [ ] Typecheck成功
- [ ] Unit Test成功
- [ ] Production build成功
- [ ] Docker Compose validation成功
- [ ] Bot container build成功
- [ ] Dashboard container build成功
- [ ] Wake wordなしで無応答
- [ ] Primary Wake wordで応答
- [ ] Aliasで応答
- [ ] 非Wake発話が履歴へ残らない
- [ ] Transcription latency中の次発話を取りこぼさない
- [ ] commit順でWake/delete/response判定する
- [ ] back-to-back Wake発話で重複Responseを作らない
- [ ] commit errorをclient event IDで相関できる
- [ ] ACK前timeout時にfail closedする
- [ ] Transcription failure時にcommitted itemをcleanupできる
- [ ] barge-in 5回中4回以上成功
- [ ] `/leave`後 `activeVoiceSessions=0`
- [ ] Token / API Key / `.env` / Transcription本文を共有ログへ残していない
