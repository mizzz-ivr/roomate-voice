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

Discord Developer PortalでRooMate Voice用Applicationを作成し、利用するDiscordサーバーへBotを追加します。

Discord公式参考:

- [Building your first Discord Bot](https://docs.discord.com/developers/quick-start/getting-started)
- [Server IDの確認方法](https://support.discord.com/hc/ja/articles/206346498-%E3%83%A6%E3%83%BC%E3%82%B6%E3%83%BC-%E3%82%B5%E3%83%BC%E3%83%90%E3%83%BC-%E3%83%A1%E3%83%83%E3%82%BB%E3%83%BC%E3%82%B8ID%E3%81%AF%E3%81%A9%E3%81%93%E3%81%A7%E8%A6%8B%E3%81%A4%E3%81%91%E3%82%89%E3%82%8C%E3%82%8B)

### 4.1 Applicationを作成する

1. [Discord Developer Portal](https://discord.com/developers/applications) を開きます。
2. `New Application` を選び、RooMate Voice用のApplicationを作成します。
3. `General Information` を開きます。
4. `Application ID` をコピーし、PC上だけで保管します。

Application IDはSecretではありませんが、RooMate Voiceの設定以外へ不要に公開する必要はありません。

### 4.2 Bot Tokenを取得する

1. Developer Portal左側の `Bot` を開きます。
2. Token欄からBot Tokenを発行します。表示されない場合はDiscordの案内に従ってTokenをReset / regenerateします。
3. Tokenを安全な場所へ保存します。

> [!CAUTION]
> Bot TokenはSecretです。このガイド、GitHub、Notion、Chat、Discordメッセージへ貼らないでください。漏えいした場合はDeveloper PortalでTokenを再発行してください。

### 4.3 Guild Installを設定する

Developer Portalの `Installation` を開きます。

1. `Installation Contexts` で **Guild Install** を利用できる状態にします。
2. Install LinkはDiscord標準の `Discord Provided Link` を利用します。
3. `Default Install Settings` のGuild Installへ次のscopeを設定します。
   - `applications.commands`
   - `bot`
4. Bot permissionsへ少なくとも次を設定します。
   - View Channels
   - Connect
   - Speak
   - Use Application Commands
5. 変更を保存します。

RooMate Voiceが利用するGateway Intentは `Guilds` / `GuildVoiceStates` です。初期構成で特権Intentの有効化は前提にしていません。

### 4.4 BotをDiscordサーバーへ追加する

1. `Installation` ページのInstall Linkをコピーします。
2. ブラウザでInstall Linkを開きます。
3. `Add to server` を選びます。
4. RooMate Voiceを使うDiscordサーバーを選択します。
5. 表示される権限を確認して追加を完了します。
6. Discordのメンバー一覧にBotが表示されることを確認します。

Botを追加するには、そのDiscordサーバーでアプリ追加に必要な権限を持つアカウントを使用してください。

### 4.5 Guild IDを取得する

Discord Desktopで:

1. 左下の歯車から `ユーザー設定` を開きます。
2. `詳細設定` → `開発者モード` をONにします。
3. RooMate Voiceを使うサーバーのアイコンを右クリックします。
4. `サーバーIDをコピー` を選びます。

この値がRooMate Voiceで入力するGuild IDです。

ここまでで、Initial Setupに必要な次の3項目が揃います。

- Application ID
- Guild ID
- Bot Token

## 5. OpenAI API Keyを準備する

RooMate VoiceはChatGPTのログイン情報ではなく、**OpenAI API PlatformのAPI Key**を使用します。APIを利用できるOpenAI PlatformのProjectを用意してください。

OpenAI公式参考:

- [OpenAI API キーはどこで確認できますか？](https://help.openai.com/ja-jp/articles/4936850-where-do-i-find-my-openai-api-key)
- [API プラットフォームでのプロジェクト管理](https://help.openai.com/ja-jp/articles/9186755)

### 5.1 ProjectとAPI利用状態を確認する

1. [OpenAI Platform](https://platform.openai.com/) にサインインします。
2. RooMate Voiceで使用するProjectを選択します。専用Projectを分けても構いません。
3. APIを利用できる支払い・利用設定になっていることを確認します。
4. ProjectにModel Usage制限を設定している場合は、RooMate Voiceが使用するRealtime modelを利用できる設定か確認します。

RooMate Voice `v0.1.0` の標準Realtime modelは `gpt-realtime-2.1-mini`、入力文字起こしは `gpt-transcribe` です。

### 5.2 Secret keyを作成する

1. OpenAI Platformで対象Projectの `API Keys` を開きます。
2. `Create new secret key` を選びます。
3. RooMate Voice用と分かる名前でSecret keyを作成します。
4. 作成時に表示されたSecret keyを、RooMate Voiceを実行するPC上で安全に保管します。

OpenAIではSecret key全文を確認できるのは作成時だけです。紛失した場合は古いkeyを使い回そうとせず、新しいkeyを作成してください。

> [!CAUTION]
> OpenAI API KeyはSecretです。GitHub、Notion、Chat、Discord、Issue、PR、スクリーンショットへ貼らないでください。RooMate Voice DesktopのInitial Setupへローカルで入力してください。

API Key権限をRestrictedにしている場合は、RooMate Voiceが使用するAPIリクエストを許可できる設定が必要です。接続できない場合はProjectのAPI Key権限とModel Usageを確認してください。

## 6. Initial Setup

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

## 7. Botを起動する

設定保存後、Home画面から `Bot Start` を実行します。

現在のDesktop Appでは以下を操作できます。

- Bot Start
- Bot Stop
- Bot Restart
- Settings
- Diagnostics foundation

Health pollingにより、Bot / Discord / Voice sessionの状態を画面へ反映します。

> [!WARNING]
> `v0.1.0` Previewには既知のIssue #10があります。Bot Stop / Restartと`/health`取得が重なった場合、停止前の古いDiscord / Voice session状態が画面へ戻る可能性があります。Stop / Restart直後の表示が実際の状態と食い違う場合は、その表示だけを最終判定に使わず、RooMate Voiceを一度完全終了して起動し直して状態を確認してください。Stable化前に修正対象です。

> [!NOTE]
> GUI connection test、diagnostics export、task trayは後続実装です。現在のPreviewでは「実装済み」とは扱いません。

## 8. Discord VCで使う

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

## 9. VCから退出する

Discordで次を実行します。

```text
/leave
```

BotがVoice Channelから退出します。

## 10. Secretとプライバシー

RooMate Voiceでは以下を通常ログへ出さない方針です。

- Discord Bot Token
- OpenAI API Key
- Transcription本文

Wake word判定はローカル音響モデルではありません。Active Speakerの音声はWake word判定前にOpenAI Realtime APIへ送信されます。Wake word不一致時はAI応答を生成せず、その入力アイテムをRealtime会話履歴から削除します。

## 11. アプリを終了する

通常のアプリ終了時にはVoice Workerも終了する設計です。

RooMate Voiceはsingle-instance lockを持ち、2重起動時は既存ウィンドウを利用します。

## 12. アンインストール

Windowsの「インストールされているアプリ」から `RooMate Voice` をアンインストールできます。

現在のinstaller設定では、アンインストール時にapp dataを自動削除しません。保存済み設定・Secretの完全削除挙動はClean Windows acceptanceで確認対象です。

## 13. Previewで未完了の確認

`v0.1.0` は以下が未完了のためStableではありません。

- Windows実機でのDiscord + OpenAI Realtime実VC E2E
- Clean WindowsでSetup.exeだけを使ったinstall E2E
- GUIだけでの初期設定から実VCまでの通し確認
- barge-inの実機再現性確認
- Issue #10 stale health response race修正
- uninstall後のデータ確認
- code signing / SmartScreen対策
- auto update
- GUI connection test
- diagnostics export
- task tray

## 14. 不具合報告

不具合を報告する場合はGitHub Issuesを利用してください。

- [GitHub Issues](https://github.com/mizzz-ivr/roomate-voice/issues)

Secret、API Key、Bot Token、Transcription本文、未マスクのGuild ID / User ID / ローカルパス等はIssueへ貼らないでください。

## 関連ドキュメント

- [README](../README.md)
- [Windows開発者向けE2E Runbook](windows-local-e2e-runbook.md)
- [Voice Production Readiness E2E](voice-production-readiness-e2e.md)
- [Windows Desktop App設計](windows-desktop-app-plan.md)
- [Security](../SECURITY.md)
