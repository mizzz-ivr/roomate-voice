# RooMate Voice Windows実機E2Eテスト結果

> [!IMPORTANT]
> Token、API Key、`.env`、Transcription本文をこのファイルへ記載しないでください。GitHubへ共有する前にGuild ID、User ID、ローカルパス、IPアドレス等も必要に応じてマスクしてください。

## 1. 基本情報

| 項目 | 値 |
|---|---|
| テスト実施日 | YYYY-MM-DD |
| Repository | `mizzz-ivr/roomate-voice` |
| Branch | `main` |
| Commit SHA |  |
| Release | `v0.1.0 Preview` / N/A |
| 起動方式 | Node.js / Docker Compose / Windows Desktop |
| テスト時間 |  分 |

## 2. Windows環境

| 項目 | 値 |
|---|---|
| Windows version |  |
| PowerShell |  |
| CPU |  |
| Memory |  |
| Node.js |  |
| npm |  |
| FFmpeg |  |
| Docker Desktop |  |
| Docker Engine |  |
| Discord client |  |
| ネットワーク | 有線 / Wi-Fi |

開発者向け確認コマンド:

```powershell
$PSVersionTable.PSVersion
git --version
node --version
npm --version
ffmpeg -version
git rev-parse HEAD
```

Docker phaseのみ:

```powershell
docker version
docker compose version
wsl --status
```

## 3. 音声環境

| 項目 | 値 |
|---|---|
| 入力デバイス |  |
| 出力デバイス |  |
| Discord入力モード | 音声検出 / Push to Talk |
| Discordノイズ抑制 |  |
| Discord自動入力感度 | ON / OFF |
| オーディオインターフェース |  |
| マイク |  |

## 4. RooMate Voice設定

Secretは記載しません。

| 設定 | 値 |
|---|---|
| Realtime model | `gpt-realtime-2.1-mini` |
| Transcription model | `gpt-transcribe` |
| Voice |  |
| Persona name |  |
| Wake word | `ルーメイト` |
| Wake word aliases | `ルームメイト` |
| Silence duration |  |
| Log level |  |

## 5. 事前確認

### Node.js直接E2E

- [ ] 最新`main`へ同期
- [ ] `.env`がGit管理対象外
- [ ] `npm install`成功
- [ ] `npm run check`成功
- [ ] Discord BotがテストGuildへ追加済み
- [ ] View Channels / Connect / Speak / Use Application Commands権限あり
- [ ] OpenAI APIが利用可能

### Windows Desktop acceptance

- [ ] GitHub Releaseから対象Setup.exeを取得
- [ ] PowerShell / Git / Node.js / npm / FFmpeg PATH / Docker / WSL / `.env`を一般ユーザー操作として要求していない

## 6. Bot起動・Health

- [ ] Bot起動成功
- [ ] `Discord client ready`
- [ ] Health API応答成功
- [ ] `status=ok`
- [ ] `discordReady=true`
- [ ] VC参加前 `activeVoiceSessions=0`

## 7. Slash Commands / VC接続

- [ ] `/status`成功
- [ ] `/join`成功
- [ ] Botが同じVCへ参加
- [ ] `activeVoiceSessions=1`
- [ ] `Voice session started`

## 8. Wake word gate

| No. | 発話 | 期待 | 結果 | 備考 |
|---:|---|---|---|---|
| 1 | `今日マイクラやる？` | 応答しない |  |  |
| 2 | `ルーメイト、聞こえる？` | 応答する |  |  |
| 3 | `ルームメイト、ネザーについて教えて` | Aliasで応答する |  |  |
| 4 | `今日は何時からやる？` | 応答しない |  | 履歴汚染確認用 |
| 5 | `ルーメイト、ダイヤはどの高さで掘る？` | 直前の非Wake内容へ反応せず応答 |  |  |

- [ ] 非Wake committed itemがRealtime会話履歴へ残らない
- [ ] 通常ログへTranscription本文が出ない

## 9. Back-to-back / ordering race

Wakeなし→Wake、Wake→Wakeを複数回、先行Transcription結果を待たず連続して発話します。

- [ ] 次の発話を取りこぼさない
- [ ] 古いcleanupが新しいcapture leaseを外さない
- [ ] committed itemとTranscriptionが別発話へ誤相関しない
- [ ] Transcription完了順が逆でも判定はcommit順
- [ ] 後続capture中に先行Responseを開始しない
- [ ] back-to-back Wakeで重複Responseを生成しない
- [ ] Wake coalescingが成立する

## 10. Barge-in

最初に:

```text
ルーメイト、工業MODを始める手順を五つ教えて
```

AI発話中:

```text
ごめん、三つだけにして
```

| No. | AI停止成功 | Wakeなし再応答 | 音切れ/重複 | 備考 |
|---:|---|---|---|---|
| 1 |  |  |  |  |
| 2 |  |  |  |  |
| 3 |  |  |  |  |
| 4 |  |  |  |  |
| 5 |  |  |  |  |

割り込み成功数: ` / 5`

目標: **5回中4回以上**。

## 11. Failure safety

実際に発生した場合、SecretやTranscription本文を含まないメタデータだけで記録します。

- [ ] pipeline failure時にpartial input bufferをclearする
- [ ] clear ACK前にcapture holdを解放しない
- [ ] clear成功は`input_audio_buffer.cleared` ACK後だけ
- [ ] clear rejectをclient event IDで相関する
- [ ] clear ACK timeout時はvoice sessionをfail-closeする
- [ ] commit errorをclient event IDで相関する
- [ ] Commit ACK timeout時はRealtime sessionをfail-closeする
- [ ] Transcription failure時にcommitted item cleanupを試行する
- [ ] Realtime切断時にDiscord voice sessionも終了する

## 12. 終了

- [ ] `/leave`成功
- [ ] BotがVCから退出
- [ ] `activeVoiceSessions=0`
- [ ] `Voice session stopped`

## 13. Docker Compose

Node.js直接E2E成功後のみ実施します。

- [ ] Docker Desktop / WSL 2 ready
- [ ] `docker compose config`成功
- [ ] `docker compose up --build`成功
- [ ] Wake word / Alias / no-wake成功
- [ ] history cleanup成功
- [ ] ordering race成功
- [ ] barge-in成功
- [ ] `/leave`成功
- [ ] `docker compose down`成功

## 14. Windows Desktop / Setup.exe Acceptance

| 項目 | 結果 | 備考 |
|---|---|---|
| Setup.exeのみでinstall |  |  |
| Start Menu / Desktop shortcut |  |  |
| Initial Setup |  |  |
| Discord設定GUI入力 |  |  |
| OpenAI API Key GUI入力 |  |  |
| Secret保存 |  |  |
| 再起動後Secretを保存済みとして扱う |  |  |
| Secret平文をrendererへ再表示しない |  |  |
| Bot Start |  |  |
| Bot Stop |  |  |
| Bot Restart |  |  |
| bundled Worker |  |  |
| bundled FFmpeg |  |  |
| 外部FFmpeg PATH不要 |  |  |
| Discord実VC |  |  |
| Wake / Alias / no-wake |  |  |
| barge-in |  |  |
| 2重起動防止 |  |  |
| app終了時Worker終了 |  |  |
| settings復元 |  |  |
| uninstall |  |  |
| Secret / transcription漏えいなし |  |  |

## 15. 不具合一覧

| ID | 重要度 | 現象 | 再現手順 | 期待値 | 実際 | 再現率 |
|---|---|---|---|---|---|---:|
| E2E-01 | High / Medium / Low |  |  |  |  |  |

## 16. 合格判定

### 必須

- [ ] Botログイン
- [ ] `/status` / `/join` / `/leave`
- [ ] Wake wordなしで無応答
- [ ] Primary Wake wordで応答
- [ ] Aliasで応答
- [ ] 非Wake履歴汚染なし
- [ ] ordering raceで誤相関なし
- [ ] barge-in 5回中4回以上
- [ ] Realtime切断時fail-close
- [ ] Secret漏えいなし
- [ ] Transcription本文漏えいなし

最終判定: `Pass / Conditional Pass / Fail / Blocked`

## 17. 次アクション

- [ ] Issue #2へDeveloper Real VC E2E結果を反映
- [ ] Issue #6へDesktop acceptance結果を反映
- [ ] Failは重複Issueを確認後に不具合Issue化
- [ ] 必要なfixをbranch → test → PR → CI → reviewで対応
- [ ] Clean Windows acceptance完了後にStable化可否を判断

コメント:

```text

```
