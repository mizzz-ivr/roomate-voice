# Windows ローカルE2E音声テスト手順書

この手順書は、Windows PC上でRooMate Voiceを起動し、DiscordのボイスチャンネルからOpenAI Realtime APIまでの音声往復を実機確認するためのRunbookです。

対象リポジトリ: `mizzz-ivr/roomate-voice`

対象ブランチ: `feature/local-realtime-foundation`

## 1. このテストの目的

次の経路を実際の資格情報と音声で確認します。

```text
自分のマイク
  ↓ Discord Opus 48kHz stereo
RooMate Voice Bot
  ↓ PCM16 24kHz mono
OpenAI Realtime API
  ↓ PCM16 24kHz mono
RooMate Voice Bot
  ↓ PCM16 48kHz stereo / Discord再生
Discord VC
```

完了条件は次のとおりです。

- BotがDiscordへログインできる
- `/status`、`/join`、`/leave`が表示・実行できる
- Botが実行者のVCへ参加できる
- ユーザー音声がOpenAI Realtime APIへ入力される
- OpenAIの音声応答がDiscord VCで再生される
- AI発話中にユーザーが話すと再生を中断できる
- Node.js直接起動とDocker Composeの両方で起動できる
- エラー、体感遅延、API利用量を記録できる

## 2. 現在の実装上の注意点

### 2.1 Wake wordはまだ入力フィルターではない

`BOT_WAKE_WORD`はキャラクターのInstructionsに含まれますが、現時点では「呼びかけ語を検出したときだけ音声を送信する」実装ではありません。

VC内でBot以外のユーザーが話し始めると、その音声がRealtime APIへ送信されます。テスト中は、Botへ送信したくない会話を同じVCで行わないでください。

### 2.2 同時に処理する話者は1人

最初に発話を開始したユーザーがActive Speakerになります。そのユーザーの処理が終了するまで、別ユーザーの新しい発話開始は無視されます。

### 2.3 会話履歴・Guild設定の永続化は未実装

Botを再起動するとセッション状態は消えます。現在のキャラクター設定は`.env`から読み込みます。

### 2.4 APIを使うテストは有料

`gpt-realtime-2.1-mini`はOpenAI APIのFree Tierでは利用できません。OpenAI Platform側で利用可能な課金設定とAPI Keyが必要です。

## 3. 資格情報の安全ルール

テスト前に必ず確認してください。

- `.env`をGitへコミットしない
- Discord Bot Tokenを画面共有・スクリーンショット・Issueへ載せない
- OpenAI API KeyをIssue、PR、Discord、ログ共有へ載せない
- TokenやKeyが露出した場合は、直ちに失効・再発行する
- テスト用Discordサーバーを使用する
- OpenAIではRooMate Voice専用ProjectとProject API Keyを使う
- 初回は短時間テストに限定する
- ログ共有時はToken、Key、Guild ID、User IDをマスクする

`.gitignore`には`.env`が登録されていますが、コミット前には必ず次を実行してください。

```powershell
git status --short
```

`.env`が表示された場合は作業を止め、`.gitignore`とファイル名を確認してください。

## 4. 準備するもの

### 必須

- Windows 10またはWindows 11
- Discordデスクトップアプリ
- 自分が管理できるテスト用Discordサーバー
- テスト用ボイスチャンネル
- Git
- Node.js 22.12以上
- npm 10以上
- FFmpeg
- Discord Application / Bot
- OpenAI API Project / API Key
- マイクと音声出力デバイス

### Dockerテストで追加

- WSL 2
- Docker Desktop

## 5. Windows開発環境を確認する

PowerShellを開きます。管理者権限は通常不要です。

```powershell
git --version
node --version
npm --version
ffmpeg -version
docker --version
docker compose version
```

最低条件:

| 項目 | 条件 |
|---|---|
| Node.js | `v22.12.0`以上 |
| npm | `10`以上 |
| FFmpeg | コマンドが成功すること |
| Docker | Dockerテスト時のみ必要 |

### 5.1 Gitがない場合

Git for Windowsをインストールし、PowerShellを開き直してください。

WinGetを使う例:

```powershell
winget install --id Git.Git -e
```

### 5.2 Node.jsがない、または古い場合

Node.js 22系LTSのWindows x64 Installerを使用してください。

インストール後、PowerShellを開き直して確認します。

```powershell
node --version
npm --version
```

### 5.3 FFmpegがない場合

FFmpeg公式ダウンロードページから案内されているWindows Buildを導入し、`ffmpeg.exe`を含む`bin`ディレクトリへPATHを通します。

WinGetを使える環境では、次の方法も利用できます。

```powershell
winget search ffmpeg
```

表示された提供元とPackage IDを確認してからインストールしてください。インストール後はPowerShellを開き直します。

```powershell
ffmpeg -version
where.exe ffmpeg
```

複数のFFmpegが表示される場合は、先頭の実行ファイルが意図したものか確認してください。

### 5.4 Docker Desktopがない場合

Docker Desktop for Windowsをインストールし、WSL 2 backendを有効にします。Docker Desktopを起動してEngineがReadyになった後、次を確認します。

```powershell
docker version
docker compose version
```

`docker version`でClientだけ表示され、Server接続エラーになる場合はDocker Desktopが起動していません。

## 6. テスト用Discordサーバーを準備する

本番コミュニティではなく、テスト専用サーバーで開始してください。

1. Discordを開く
2. 左側の`+`からサーバーを作成する
3. サーバー名を例として`RooMate Voice Test`にする
4. テキストチャンネルを1つ用意する
5. ボイスチャンネルを1つ用意する
6. テスト中は知らないユーザーが参加できない状態にする

## 7. Discord ApplicationとBotを作成する

Discord Developer Portalの画面名は更新される場合があります。基本的には`Application`、`Bot`、`Installation`の3か所を設定します。

### 7.1 Applicationを作成する

1. Discord Developer Portalを開く
2. `New Application`を選択する
3. 名前を`RooMate Voice Local`などにする
4. 利用規約を確認して作成する
5. `General Information`を開く
6. `Application ID`を控える

この値を後で次へ設定します。

```env
DISCORD_CLIENT_ID=Application ID
```

### 7.2 Bot Tokenを発行する

1. 左メニューの`Bot`を開く
2. Botユーザーが未作成なら作成する
3. `Reset Token`またはToken発行操作を行う
4. 表示されたTokenを安全な場所へ一時保存する

この値を後で次へ設定します。

```env
DISCORD_BOT_TOKEN=Bot Token
```

Tokenは再表示できない場合があります。紛失時は再発行してください。

### 7.3 Gateway Intentsを確認する

現行実装が使用するIntentは次の2つです。

- `Guilds`
- `GuildVoiceStates`

Privileged Gateway Intentsの`Message Content`、`Server Members`、`Presence`は初期実装では不要です。

不要なIntentは有効にしないでください。

### 7.4 Installation設定

`Installation`またはOAuth2関連画面でGuild Installを設定します。

Scopes:

- `bot`
- `applications.commands`

Bot Permissions:

- View Channels
- Connect
- Speak
- Use Application Commands

音声チャンネルまたはカテゴリ側で権限上書きをしている場合は、Botロールに同じ権限が許可されているか確認してください。

### 7.5 テストサーバーへインストールする

1. `Installation`画面のInstall Linkをコピーする
2. ブラウザで開く
3. `Add to server`を選択する
4. `RooMate Voice Test`を選ぶ
5. 権限を確認して承認する
6. Discordのメンバー一覧にBotが追加されたことを確認する

この時点ではローカルプログラムが起動していないため、Botがオフラインでも正常です。

## 8. Discord Guild IDを取得する

### 8.1 Developer Modeを有効にする

1. Discordのユーザー設定を開く
2. `Advanced`を開く
3. `Developer Mode`を有効にする

### 8.2 Server IDをコピーする

1. テストサーバーのアイコンまたはサーバー名を右クリックする
2. `Copy Server ID`を選択する

この値を後で次へ設定します。

```env
DISCORD_GUILD_ID=コピーしたServer ID
```

ローカル開発ではGuild Commandとして登録するため、Global Commandより早く反映できます。

## 9. OpenAI APIを準備する

### 9.1 専用Projectを作る

OpenAI Platformで、RooMate Voice用のProjectを分けることを推奨します。

例:

```text
Project name: roomate-voice-local
```

Projectを分けることで、API Key、利用量、予算管理を他の開発から分離しやすくなります。

### 9.2 API Keyを作る

1. RooMate Voice用Projectを選択する
2. API Keys画面を開く
3. Project API Keyを作成する
4. Keyを安全な場所へ一時保存する

この値を後で次へ設定します。

```env
OPENAI_API_KEY=作成したAPI Key
```

### 9.3 API利用可能状態を確認する

`gpt-realtime-2.1-mini`はFree Tierでは利用できません。ProjectでAPI課金を利用できる状態にし、初回は少額・短時間で試してください。

モデルの初期値:

```env
OPENAI_REALTIME_MODEL=gpt-realtime-2.1-mini
```

音声の初期値:

```env
OPENAI_VOICE=marin
```

モデルまたは音声がアカウントで利用できないというエラーが出た場合は、OpenAI公式のModelページとRealtime APIドキュメントで現在利用可能な値を確認してください。

## 10. リポジトリを取得する

作業用ディレクトリへ移動します。

```powershell
cd $HOME
mkdir src -ErrorAction SilentlyContinue
cd src
```

初回のみクローンします。

```powershell
git clone https://github.com/mizzz-ivr/roomate-voice.git
cd roomate-voice
git switch feature/local-realtime-foundation
```

既にクローン済みの場合:

```powershell
cd $HOME\src\roomate-voice
git fetch origin
git switch feature/local-realtime-foundation
git pull --ff-only origin feature/local-realtime-foundation
```

現在のブランチを確認します。

```powershell
git branch --show-current
git status
```

期待値:

```text
feature/local-realtime-foundation
```

## 11. `.env`を作成する

PowerShellでは次を実行します。

```powershell
Copy-Item .env.example .env
notepad .env
```

VS Codeを使用する場合:

```powershell
code .env
```

設定例:

```env
# Discord
DISCORD_BOT_TOKEN=ここにBot Token
DISCORD_CLIENT_ID=ここにApplication ID
DISCORD_GUILD_ID=ここにServer ID

# OpenAI
OPENAI_API_KEY=ここにProject API Key
OPENAI_REALTIME_MODEL=gpt-realtime-2.1-mini
OPENAI_VOICE=marin

# Bot
BOT_HTTP_PORT=3001
BOT_PERSONA_NAME=RooMate
BOT_PERSONA_STYLE=明るく親しみやすいゲーム仲間。返答は短く、プレイ中の邪魔にならないように話す。
BOT_WAKE_WORD=ルーメイト
BOT_SILENCE_MS=900
LOG_LEVEL=debug

# Dashboard
VITE_BOT_HEALTH_URL=http://localhost:3001/health
```

### 設定時の注意

- `=`の前後へ不要な空白を入れない
- TokenやKeyを`< >`で囲まない
- 行末へコメントを付けない
- `DISCORD_GUILD_ID`はサーバーIDであり、チャンネルIDではない
- 初回テスト中は`LOG_LEVEL=debug`を推奨する
- `BOT_SILENCE_MS=900`は、約0.9秒の無音を発話終了として扱う設定
- 値に`#`が含まれる場合はdotenvの解釈に注意する

保存後、Git管理対象になっていないことを確認します。

```powershell
git status --short
```

`.env`が表示されないことを確認してください。

## 12. Node.js依存関係をインストールする

```powershell
npm install
```

PowerShellで`npm.ps1 cannot be loaded`と表示される場合は、まず次を試してください。

```powershell
npm.cmd install
```

恒久的なExecution Policy変更は、内容を理解している場合にだけ行ってください。

インストール後:

```powershell
npm run check
```

このコマンドは次を順番に実行します。

1. 共通packagesのbuild
2. TypeScript typecheck
3. Unit Test
4. Production build

期待値:

- TypeScript Errorがない
- Vitestが成功する
- BotとDashboardのbuildが成功する
- コマンドがexit code 0で終了する

失敗した場合は、音声テストへ進まずエラー全文を保存してください。

## 13. BotとDashboardを起動する

```powershell
npm run dev
```

このターミナルは閉じないでください。

起動対象:

- Bot
- Dashboard
- Bot Health API

期待する主なログ:

```text
Discord client ready
```

ログにはBotのユーザー名と参加Guild数が表示されます。

### 13.1 Health APIを確認する

別のPowerShellを開きます。

```powershell
Invoke-RestMethod http://localhost:3001/health | ConvertTo-Json
```

期待例:

```json
{
  "status": "ok",
  "discordReady": true,
  "activeVoiceSessions": 0,
  "model": "gpt-realtime-2.1-mini",
  "uptimeSeconds": 30,
  "version": "0.1.0"
}
```

確認ポイント:

- `status`が`ok`
- `discordReady`が`true`
- VC参加前は`activeVoiceSessions`が`0`
- `model`が`.env`の値と一致する

### 13.2 Dashboardを確認する

ブラウザで開きます。

```text
http://localhost:5173
```

最低確認:

- ページが表示される
- Bot Health取得エラーが出ていない
- 画面幅を狭くしても横にはみ出さない
- PC表示で文字が見切れない

## 14. Slash Commandを確認する

Discordのテストサーバーを開きます。

1. テキストチャンネルの入力欄で`/`を入力する
2. RooMate Voiceのコマンドを探す
3. 次が表示されることを確認する

```text
/join
/leave
/status
```

表示されない場合:

1. Botを一度停止する
2. `DISCORD_CLIENT_ID`と`DISCORD_GUILD_ID`を確認する
3. Applicationが正しいテストサーバーへインストールされているか確認する
4. Botを再起動する
5. ログに`Failed to register slash commands`がないか確認する
6. Discordを再読み込みする

## 15. `/status`を確認する

テキストチャンネルで実行します。

```text
/status
```

VC参加前の期待値:

```text
状態: 待機中
モデル: gpt-realtime-2.1-mini
音声: marin
```

この応答は実行者だけに表示されるEphemeral Responseです。

## 16. VC参加テスト

### 16.1 自分が先にVCへ入る

1. Discordでテスト用VCへ参加する
2. Discordの入力デバイスが正しいか確認する
3. マイクミュートを解除する
4. 入力感度メーターが反応することを確認する

### 16.2 `/join`を実行する

テキストチャンネルで実行します。

```text
/join
```

期待するDiscord応答:

```text
✅ <VC名> に参加しました。モデル: gpt-realtime-2.1-mini
```

期待するBotログ:

```text
Voice session started
```

確認ポイント:

- Botが自分と同じVCへ参加する
- BotがServer Muteになっていない
- BotがServer Deafenになっていない
- Health APIの`activeVoiceSessions`が`1`になる

```powershell
Invoke-RestMethod http://localhost:3001/health | ConvertTo-Json
```

## 17. 音声往復テスト

最初は1人だけで行います。

### テスト1: 短い発話

次のように、2〜5秒程度で明確に話します。

```text
こんにちは。今日一緒にゲームするなら何がおすすめ？
```

話し終わった後、約1秒は無言にしてください。

確認:

- 発話終了後にAIが応答を開始する
- Discord VCからBot音声が聞こえる
- 音声が極端に速い・遅い・低い・高い状態でない
- 音声が途中で途切れない
- 同じ返答が重複再生されない

### テスト2: 日本語の固有名詞

```text
マインクラフトで最初に作る設備を三つだけ教えて。
```

確認:

- 日本語として理解できる
- 返答が1〜3文程度に収まる
- Personaの口調が反映される

### テスト3: 短い英数字

```text
RTX 3070 Tiって今でもWQHDで使える？
```

確認:

- 英数字を極端に誤認しない
- 不明な場合に断定しすぎない

### テスト4: 無音と生活音

10秒ほど話さず、キーボードやマウスを通常操作します。

確認:

- 不要な応答が大量に発生しない
- 発生した場合はDiscord入力感度または今後のVAD・Wake word実装課題として記録する

## 18. 割り込みテスト

1. AIに少し長めの回答を促す
2. AIが話している途中で自分が明確に話し始める
3. AI音声が停止するか確認する
4. 新しいユーザー発話に対する応答が始まるか確認する

テスト発話例:

```text
マインクラフトで工業MODを始める手順を五つ教えて。
```

AI発話中に次を言います。

```text
ごめん、三つだけにして。
```

期待値:

- AIの現在再生が停止する
- 未再生の音声バッファが破棄される
- OpenAI側の進行中Responseがキャンセルされる
- 新しい発話へ応答する

記録:

- 5回試行する
- 成功回数を記録する
- 割り込み開始から停止までの体感秒数を記録する

## 19. 複数人の簡易テスト

初期実装は1 Active Speakerです。最初の1人テストに成功した後だけ実施します。

1. 2人目をVCへ参加させる
2. 1人ずつ順番に発話する
3. 話者交代後も応答できるか確認する
4. 同時発話を1回だけ試す

期待値:

- 順番に話せば各発話へ応答できる
- 同時発話では後から開始したユーザーが処理されない場合がある

同時発話の完全対応は、このフェーズの合格条件ではありません。

## 20. `/leave`と終了処理を確認する

```text
/leave
```

期待値:

- BotがVCから退出する
- Discordに退出完了メッセージが表示される
- Botログに`Voice session stopped`が表示される
- Health APIの`activeVoiceSessions`が`0`になる

Botプロセスを終了します。

```text
Ctrl + C
```

期待ログ:

```text
Shutdown requested
```

## 21. Docker Composeで再テストする

Node.js直接起動のテストが成功してから行います。

### 21.1 直接起動を停止する

`npm run dev`を実行しているターミナルで`Ctrl + C`を押します。

ポートが解放されたか確認します。

```powershell
Get-NetTCPConnection -LocalPort 3001,5173,8080 -ErrorAction SilentlyContinue
```

### 21.2 Docker Desktopを起動する

```powershell
docker version
docker compose version
```

### 21.3 Compose構成を検証する

```powershell
docker compose config
```

この出力を共有する場合、展開済み環境変数に秘密情報が含まれないか必ず確認してください。安全上、原則として出力全体を公開しないでください。

### 21.4 ビルドして起動する

```powershell
docker compose up --build
```

別ターミナルで確認します。

```powershell
docker compose ps
docker compose logs --tail=200 bot
docker compose logs --tail=200 dashboard
Invoke-RestMethod http://localhost:3001/health | ConvertTo-Json
```

Docker時のURL:

| 用途 | URL |
|---|---|
| Dashboard | `http://localhost:8080` |
| Bot Health | `http://localhost:3001/health` |

Node.js直接起動と同じく、`/join`、音声往復、割り込み、`/leave`を確認します。

### 21.5 Dockerを停止する

```powershell
docker compose down
```

コンテナとログを確認します。

```powershell
docker compose ps -a
```

## 22. テスト結果を記録する

`docs/e2e-test-record-template.md`をコピーして使用します。

```powershell
Copy-Item docs/e2e-test-record-template.md e2e-test-result.local.md
```

`e2e-test-result.local.md`には環境情報が含まれるため、内容を確認せずコミットしないでください。

最低記録項目:

- テスト日時
- Windows version
- Node.js / npm / FFmpeg version
- 起動方式
- Discord入力・出力デバイス
- 使用モデルと音声名
- `/join`成功可否
- 音声入力成功可否
- 音声出力成功可否
- 応答開始までの体感時間
- 割り込み5回中の成功回数
- 音声の途切れ
- CPU / Memory
- 10分間のOpenAI利用量
- エラーログ

## 23. トラブルシューティング

### 23.1 `Discord login failed`

主な原因:

- `DISCORD_BOT_TOKEN`が違う
- Token前後に空白がある
- Tokenを再発行した後、古い値を使っている

対応:

1. Discord Developer PortalでTokenを再発行する
2. `.env`を更新する
3. Botを再起動する
4. 古いTokenは使用しない

### 23.2 Slash Commandが表示されない

確認順:

1. `DISCORD_CLIENT_ID`がApplication IDか
2. `DISCORD_GUILD_ID`がテストサーバーIDか
3. Applicationをそのサーバーへインストール済みか
4. `applications.commands` scopeがあるか
5. Bot起動ログにコマンド登録失敗がないか
6. Discordを再起動または再読み込みしたか

### 23.3 `/join`で「先にボイスチャンネルへ参加してください」

コマンド実行者自身がVCへ入ってから実行してください。Botはコマンド実行者の現在VCを取得します。

### 23.4 BotがVCへ入らない

確認:

- View Channels
- Connect
- カテゴリ権限上書き
- VCの人数上限
- BotがServer Mute/Banされていないか
- `Voice session started`の前にエラーがないか

### 23.5 BotはVCへ入るが音声を聞かない

確認:

- BotがDeafenされていないか
- 自分のマイク入力がDiscordで反応しているか
- Push to Talkが正しく押されているか
- Discordの入力感度が高すぎないか
- FFmpegがPATHから実行できるか
- `Discord input audio pipeline ended with an error`がないか

```powershell
ffmpeg -version
where.exe ffmpeg
```

### 23.6 OpenAIから返答がない

確認:

- `OPENAI_API_KEY`が有効か
- ProjectでAPI利用が可能か
- `gpt-realtime-2.1-mini`へアクセスできるか
- 401、403、429、model not foundがログにないか
- 発話後に約1秒無言になったか

ログに`OpenAI Realtime error`がある場合は、秘密情報を除いてエラーメッセージを記録してください。

### 23.7 AI音声が聞こえない

確認:

- BotにSpeak権限があるか
- DiscordでBot個別音量が0になっていないか
- Discordの出力デバイスが正しいか
- `Discord audio player error`がないか
- FFmpegが実行できるか

### 23.8 返答が途中で切れる

考えられる原因:

- ユーザーまたは他ユーザーの発話開始で割り込みが発生した
- キーボード音などをDiscordが発話として判定した
- ネットワーク不安定
- OpenAI Realtime WebSocketエラー
- Discord Voice接続の再接続

初回はVCを1人にして再現確認してください。

### 23.9 `EADDRINUSE` / Port already in use

```powershell
Get-NetTCPConnection -LocalPort 3001,5173,8080 -ErrorAction SilentlyContinue |
  Select-Object LocalPort,State,OwningProcess
```

プロセスを確認します。

```powershell
Get-Process -Id <OwningProcess>
```

不要な旧プロセスだけを停止してください。

### 23.10 Dockerで環境変数エラー

確認:

- ルートに`.env`があるか
- 必須値が空でないか
- `.env.example`ではなく`.env`を編集したか
- Docker Desktopを再起動したか

### 23.11 DashboardだけHealth取得に失敗する

確認:

- `http://localhost:3001/health`がブラウザで開けるか
- `VITE_BOT_HEALTH_URL`が正しいか
- Botが起動しているか
- ポート3001がFirewallや別プロセスに占有されていないか

## 24. 合格判定

### 必須合格

- [ ] `npm run check`成功
- [ ] Botログイン成功
- [ ] Slash Command 3件表示
- [ ] `/join`成功
- [ ] HealthのVoice Sessionが0から1へ変化
- [ ] ユーザー音声入力成功
- [ ] AI音声出力成功
- [ ] `/leave`成功
- [ ] HealthのVoice Sessionが1から0へ変化
- [ ] Docker Compose build・起動成功

### 初期品質目標

- [ ] 5回中4回以上、正常に音声応答する
- [ ] 割り込み5回中4回以上成功する
- [ ] 通常発話で同じ音声が重複再生されない
- [ ] 10分間でBotプロセスが異常終了しない
- [ ] Token・KeyがログやGitへ露出していない

## 25. 合格後の作業

1. GitHub Issue #2へ結果を記録する
2. 機密情報を除いたエラーログを添付する
3. 必要な修正をPR #1へ追加する
4. CI成功を確認する
5. PR #1をマージする
6. GHCRコンテナを確認する
7. Lightsailへステージング配置する
8. Guild設定永続化、Discord OAuth、利用量記録へ進む

## 26. 公式参考資料

- Discord Getting Started: https://docs.discord.com/developers/quick-start/getting-started
- Discord Application Commands: https://docs.discord.com/developers/interactions/application-commands
- OpenAI API Quickstart: https://platform.openai.com/docs/quickstart
- OpenAI Realtime API Reference: https://platform.openai.com/docs/api-reference/realtime
- GPT-Realtime-2.1 mini: https://developers.openai.com/api/docs/models/gpt-realtime-2.1-mini
- Docker Desktop for Windows: https://docs.docker.com/desktop/setup/install/windows-install/
- FFmpeg Downloads: https://ffmpeg.org/download.html
