# Windows Desktop App / Installer Plan

RooMate Voiceの一般利用者向けWindows配布は、PowerShell / Git / Node.js / npm / FFmpeg PATH / Docker / WSL / `.env`編集を前提にしません。

開発者向けのローカルRunbookは、開発・デバッグ・E2E再現用途として引き続き利用します。

## Target user flow

1. `RooMate Voice Setup.exe`をダウンロードする
2. ダブルクリックしてインストールする
3. GUI onboardingでDiscord / OpenAI / RooMate設定を入力する
4. 接続テストを実行する
5. `Botを開始`を押す
6. 以後はDesktop UI / task trayからStart / Stop / Settingsを操作する

## First implementation choice

- Electron + React
- 既存TypeScript / Node.js Voice Workerを再利用
- FFmpeg Windows binaryをアプリ側へ同梱
- 初版installerはSetup.exe
- MSIは企業配布など明確な需要が出た段階で追加

## User must not need

- PowerShell / CMD
- Git
- Node.js / npmの手動導入
- FFmpegの手動導入 / PATH設定
- Docker Desktop / WSL 2
- `.env`直接編集
- `npm run dev`

## Secure settings

開発版は`.env`を利用できますが、配布版では利用者へSecret fileを直接編集させません。

- Discord Bot Token / OpenAI API KeyはWindows保護ストレージへ保存する
- Electron採用時は`safeStorage`等を候補とする
- RendererへSecret平文を不要に露出しない
- logs / diagnostics / crash reportsへToken / API Keyを含めない
- transcription本文を通常ログへ含めない

## Desktop UI

最低限の状態表示:

- Bot: Running / Stopped
- Discord: Connected / Disconnected
- OpenAI: Connected / Disconnected
- Voice session: Joined / Idle

操作:

- Start
- Stop
- Restart
- Settings
- Diagnostics

## First-run onboarding

### Discord

- Application ID
- Guild ID
- Bot Token
- 入力検証
- 接続確認

### OpenAI

- API Key
- 接続確認
- 利用モデル表示

### RooMate

- Persona name
- Persona style
- Voice
- Wake word
- Wake word aliases
- Silence duration

## Diagnostics

非エンジニアでも問題切り分けできるようにします。

- Discord connection
- OpenAI connection
- Voice Worker status
- FFmpeg availability
- Health
- app version
- sanitized logs
- 診断情報export

診断exportへToken / API Key / transcription本文を含めません。

## Installer phases

### Phase 1

- Setup.exe
- per-user install優先
- Start Menu shortcut
- uninstall
- task tray

### Phase 2

- code signing
- Windows SmartScreen対策
- auto update

### Phase 3

- MSI（必要な場合）

FFmpeg同梱時は採用buildとライセンス条件を配布前に確認します。

## Clean Windows acceptance criteria

- [ ] Setup.exeだけでインストールできる
- [ ] PowerShell / CMDなしで初期設定できる
- [ ] `.env`を編集しない
- [ ] Git / Node.js / npmの手動導入が不要
- [ ] FFmpeg PATH設定が不要
- [ ] Discord設定をGUIから入力できる
- [ ] OpenAI API KeyをGUIから安全に登録できる
- [ ] 接続テストができる
- [ ] Start / StopがGUIでできる
- [ ] Discord VCでWake word会話できる
- [ ] barge-inできる
- [ ] 再起動後も設定を安全に復元できる
- [ ] Token / API Keyが通常ログへ出ない
- [ ] アンインストールできる

## Delivery order

1. PR #5 production-readiness fixをmainへマージ
2. Windows実VC E2EでVoice Workerを確定
3. Desktop workspace/package追加
4. Electron Main + Renderer shell
5. Voice Worker lifecycle bridge
6. secure settings
7. first-run onboarding
8. status / diagnostics
9. bundled FFmpeg
10. Setup.exe build
11. clean Windows E2E
12. code signing / auto update

Tracking: GitHub Issue #6.
