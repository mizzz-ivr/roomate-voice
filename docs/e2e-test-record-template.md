# RooMate Voice ローカルE2Eテスト結果

> このファイルへToken、API Key、秘密情報を記載しないでください。GitHubへ共有する前にGuild ID、User ID、ローカルパス、IPアドレスを確認・マスクしてください。

## 1. 基本情報

| 項目 | 値 |
|---|---|
| テスト実施日 | YYYY-MM-DD |
| 実施者 |  |
| Repository | `mizzz-ivr/roomate-voice` |
| Branch | `feature/local-realtime-foundation` |
| Commit SHA |  |
| 起動方式 | Node.js / Docker Compose |
| テスト時間 |  分 |

## 2. 環境

| 項目 | 値 |
|---|---|
| Windows version |  |
| CPU |  |
| Memory |  |
| Node.js |  |
| npm |  |
| FFmpeg |  |
| Docker Desktop |  |
| Docker Engine |  |
| Discord client |  |
| ネットワーク | 有線 / Wi-Fi |

確認コマンド:

```powershell
node --version
npm --version
ffmpeg -version
docker version
docker compose version
git rev-parse HEAD
```

## 3. 音声環境

| 項目 | 値 |
|---|---|
| 入力デバイス |  |
| 出力デバイス |  |
| Discord入力モード | 音声検出 / Push to Talk |
| Discordノイズ抑制 |  |
| Discord自動入力感度 | ON / OFF |
| GoXLR等の音声機器 |  |
| マイク |  |

## 4. RooMate Voice設定

秘密情報は記載しません。

| 環境変数 | 値 |
|---|---|
| `OPENAI_REALTIME_MODEL` |  |
| `OPENAI_VOICE` |  |
| `BOT_PERSONA_NAME` |  |
| `BOT_PERSONA_STYLE` |  |
| `BOT_WAKE_WORD` |  |
| `BOT_SILENCE_MS` |  |
| `LOG_LEVEL` |  |

## 5. 事前確認

- [ ] `.env`がGit管理対象外
- [ ] `npm install`成功
- [ ] `npm run check`成功
- [ ] Discord Botがテストサーバーへインストール済み
- [ ] BotにView Channels権限がある
- [ ] BotにConnect権限がある
- [ ] BotにSpeak権限がある
- [ ] OpenAI Project API Keyを使用
- [ ] OpenAI APIが利用可能

## 6. Node.js直接起動

### 起動

- [ ] `npm run dev`成功
- [ ] `Discord client ready`を確認
- [ ] Dashboard表示成功
- [ ] Health API応答成功

Health応答:

```json
{
  "status": "",
  "discordReady": false,
  "activeVoiceSessions": 0,
  "model": "",
  "uptimeSeconds": 0,
  "version": ""
}
```

### Slash Commands

- [ ] `/status`表示
- [ ] `/join`表示
- [ ] `/leave`表示
- [ ] `/status`実行成功

### VC接続

- [ ] `/join`成功
- [ ] Botが同じVCへ参加
- [ ] Healthの`activeVoiceSessions`が1
- [ ] `Voice session started`を確認

### 音声往復

| No. | 発話内容 | 入力成功 | 出力成功 | 応答開始秒 | 音切れ | 備考 |
|---:|---|---|---|---:|---|---|
| 1 | こんにちは。今日一緒にゲームするなら何がおすすめ？ |  |  |  |  |  |
| 2 | マインクラフトで最初に作る設備を三つだけ教えて。 |  |  |  |  |  |
| 3 | RTX 3070 Tiって今でもWQHDで使える？ |  |  |  |  |  |
| 4 | 任意 |  |  |  |  |  |
| 5 | 任意 |  |  |  |  |  |

成功数: ` / 5`

平均体感応答開始時間: ` 秒`

### 割り込み

| No. | AI停止成功 | 停止までの秒数 | 新しい発話へ応答 | 備考 |
|---:|---|---:|---|---|
| 1 |  |  |  |  |
| 2 |  |  |  |  |
| 3 |  |  |  |  |
| 4 |  |  |  |  |
| 5 |  |  |  |  |

割り込み成功数: ` / 5`

### 終了

- [ ] `/leave`成功
- [ ] BotがVCから退出
- [ ] Healthの`activeVoiceSessions`が0
- [ ] `Voice session stopped`を確認
- [ ] `Ctrl + C`で正常終了

## 7. Docker Compose

- [ ] Docker Desktop起動
- [ ] `docker compose config`成功
- [ ] `docker compose up --build`成功
- [ ] Bot container healthy/起動
- [ ] Dashboard container起動
- [ ] Dashboard `http://localhost:8080`表示
- [ ] Health `http://localhost:3001/health`応答
- [ ] `/join`成功
- [ ] 音声入力成功
- [ ] AI音声出力成功
- [ ] 割り込み成功
- [ ] `/leave`成功
- [ ] `docker compose down`成功

## 8. リソース使用量

測定タイミング: VC接続後、10分間会話した時点

| 項目 | アイドル | 会話中ピーク | 10分後 |
|---|---:|---:|---:|
| Bot CPU |  |  |  |
| Bot Memory |  |  |  |
| Dashboard CPU |  |  |  |
| Dashboard Memory |  |  |  |

Dockerの場合:

```powershell
docker stats --no-stream
```

## 9. OpenAI利用量

| 項目 | 値 |
|---|---:|
| テスト前Project利用量 |  |
| テスト後Project利用量 |  |
| 差分 |  |
| 会話時間 |  分 |
| 推定1時間換算 |  |

## 10. エラー・警告

### Botログ

```text
秘密情報を除いたログを貼る
```

### OpenAI Realtimeエラー

```text
なし / エラー内容
```

### Discord Voiceエラー

```text
なし / エラー内容
```

### FFmpegエラー

```text
なし / エラー内容
```

## 11. 不具合一覧

| ID | 重要度 | 現象 | 再現手順 | 期待値 | 実際 | 再現率 |
|---|---|---|---|---|---|---:|
| E2E-01 | High / Medium / Low |  |  |  |  |  |

## 12. 合格判定

### 必須

- [ ] Botログイン
- [ ] Slash Commands
- [ ] VC参加
- [ ] 音声入力
- [ ] 音声出力
- [ ] VC退出
- [ ] Docker起動
- [ ] 秘密情報漏えいなし

### 品質目標

- [ ] 音声往復5回中4回以上成功
- [ ] 割り込み5回中4回以上成功
- [ ] 10分間異常終了なし
- [ ] 重複再生なし
- [ ] 致命的な音切れなし

最終判定: `合格 / 条件付き合格 / 不合格`

## 13. 次アクション

- [ ] Issue #2へ結果をコメント
- [ ] 不具合Issueを作成
- [ ] PR #1へ修正
- [ ] CI再確認
- [ ] PR #1マージ
- [ ] Lightsailステージングへ進む

コメント:

```text

```
