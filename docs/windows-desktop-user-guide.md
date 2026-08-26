# RooMate Voice Windows Desktop 利用ガイド

RooMate VoiceをWindowsへインストールし、Discord VCで利用する一般ユーザー向けガイドです。

> [!IMPORTANT]
> 現在の `v0.1.0` は **Preview / Pre-release** です。Windows installer、GUI、Voice Worker、bundled FFmpegまでは実装・CI検証済みですが、実Windows Discord/OpenAI VC E2EとClean Windows受入は完了していません。Stable版としての利用保証はまだ行いません。

## 1. 必要なもの

一般ユーザーは次の開発ツールをインストールする必要はありません。

- PowerShell / CMD操作
- Git
- Node.js / npm
- FFmpegの手動インストール
- FFmpeg PATH設定
- Docker Desktop / WSL
- `.env`編集

利用時に必要なのは次の情報です。

- Discord Application ID
- Discord Guild ID（利用するDiscordサーバーID）
- Discord Bot Token
- OpenAI API Key

Discord Bot TokenとOpenAI API KeyはSecretです。Chat、GitHub Issue、Notion、Discordメッセージ、スクリーンショットへ貼らないでください。

## 2. ダウンロード

GitHub Releasesを開き、最新のPreview ReleaseからWindows installerを取得します。

- Release: [RooMate Voice v0.1.0 (Preview)](https://github.com/mizzz-ivr/roomate-voice/releases/tag/v0.1.0)
- Installer: `rmv_Setup_version0.1.0.exe`

`Releases 1` の `1` はRelease名ではなく、GitHubに公開されているReleaseの件数です。

## 3. インストール

1. `rmv_Setup_version0.1.0.exe` をダブルクリックします。
2. インストール完了後、`RooMate Voice` を起動します。
3. Desktop shortcutまたはStart Menuからも起動できます。

現在はコード署名前のPreviewです。Windows SmartScreen等の警告が表示される可能性があります。配布元が `mizzz-ivr/roomate-voice` のGitHub Releasesであることを確認してください。

## 4. Discord Botを準備する

Discord Developer PortalでRooMate Voice用Application / Botを準備します。

必要な情報:

- Application ID
- Bot Token
- 利用するGuild ID

Botに必要な主な権限:

- View Channels
- Connect
- Speak
- Use Application Commands

利用するscope:

- `bot`
- `applications.commands`

RooMate Voiceは `Guilds` と `GuildVoiceStates` を利用します。

Bot TokenそのものをGitHubやChatへ貼らないでください。

## 5. Initial Setup

RooMate Voiceを起動し、GUIのInitial Setupから設定します。

### Discord

- Application ID
- Guild ID
- Bot Token

### OpenAI

- OpenAI API Key

### RooMate

- Persona name
- Persona style
- Voice
- Wake word
- Wake word aliases
- Silence duration

標準設定では次を使用します。

- Wake word: `ルーメイト`
- Alias: `ルームメイト`
- Realtime model: `gpt-realtime-2.1-mini`
- Transcription model: `gpt-transcribe`

SecretはElectron main process側でWindows保護ストレージを利用して保存します。保存済みSecretの平文をrendererへ再表示しない設計です。

## 6. Botを起動する

設定保存後、Home画面から `Bot Start` を実行します。

現在のDesktop Appでは以下を操作できます。

- Bot Start
- Bot Stop
- Bot Restart
- Settings
- Diagnostics foundation

Health pollingにより、Bot / Discord / Voice sessionの状態を画面へ反映します。

> [!NOTE]
> GUI connection test、diagnostics export、task trayは後続実装です。現在のPreviewでは「実装済み」とは扱いません。

## 7. Discord VCで使う

1. RooMate Voice Botを起動します。
2. Discordで利用するVoice Channelへ参加します。
3. `/status` でBot状態を確認します。
4. `/join` を実行します。
5. Botが同じVCへ参加したことを確認します。

### 通常の呼びかけ

次のようにWake wordを含めて話します。

```text
ルーメイト、聞こえる？
```

Aliasも利用できます。

```text
ルームメイト、ネザーについて教えて
```

### Wake wordなし

```text
今日マイクラやる？
```

通常は応答しません。Wake word不一致の入力はRealtime会話履歴から削除する設計です。

### AI発話中の割り込み

AIが話している途中にユーザーが発話した場合はbarge-inとして扱い、再生中の応答を止めて新しい発話へ切り替えます。このときはWake wordを省略できます。

例:

```text
ルーメイト、工業MODを始める手順を五つ教えて
```

AI発話中:

```text
ごめん、三つだけにして
```

## 8. VCから退出する

Discordで次を実行します。

```text
/leave
```

BotがVoice Channelから退出します。

## 9. Secretとプライバシー

RooMate Voiceでは以下を通常ログへ出さない方針です。

- Discord Bot Token
- OpenAI API Key
- Transcription本文

Wake word判定はローカル音響モデルではありません。Active Speakerの音声はWake word判定前にOpenAI Realtime APIへ送信されます。Wake word不一致時はAI応答を生成せず、その入力アイテムをRealtime会話履歴から削除します。

## 10. アプリを終了する

通常のアプリ終了時にはVoice Workerも終了する設計です。

RooMate Voiceはsingle-instance lockを持ち、2重起動時は既存ウィンドウを利用します。

## 11. アンインストール

Windowsの「インストールされているアプリ」から `RooMate Voice` をアンインストールできます。

現在のinstaller設定では、アンインストール時にapp dataを自動削除しません。保存済み設定・Secretの完全削除挙動はClean Windows acceptanceで確認対象です。

## 12. Previewで未完了の確認

`v0.1.0` は以下が未完了のためStableではありません。

- Windows実機でのDiscord + OpenAI Realtime実VC E2E
- Clean WindowsでSetup.exeだけを使ったinstall E2E
- GUIだけでの初期設定から実VCまでの通し確認
- barge-inの実機再現性確認
- uninstall後のデータ確認
- code signing / SmartScreen対策
- auto update
- GUI connection test
- diagnostics export
- task tray

## 13. 不具合報告

不具合を報告する場合はGitHub Issuesを利用してください。

- [GitHub Issues](https://github.com/mizzz-ivr/roomate-voice/issues)

Secret、API Key、Bot Token、Transcription本文、未マスクのGuild ID / User ID / ローカルパス等はIssueへ貼らないでください。

## 関連ドキュメント

- [README](../README.md)
- [Windows開発者向けE2E Runbook](windows-local-e2e-runbook.md)
- [Voice Production Readiness E2E](voice-production-readiness-e2e.md)
- [Windows Desktop App設計](windows-desktop-app-plan.md)
- [Security](../SECURITY.md)
