# Voice Production Readiness E2E

PR #4 のWake word文字起こしゲートを、Windows + Discord実VC + OpenAI Realtime APIで確認するための短縮手順です。

## 1. 対象ブランチを取得

```powershell
cd $HOME\src\roomate-voice
git fetch origin
git switch feature/voice-production-readiness
git pull --ff-only origin feature/voice-production-readiness
git status --short
```

`.env`はGit管理対象へ入れないでください。

## 2. `.env`を確認

保存済みの秘密情報はそのまま使い、次の設定だけ確認します。

```env
OPENAI_REALTIME_MODEL=gpt-realtime-2.1-mini
OPENAI_TRANSCRIPTION_MODEL=gpt-transcribe
OPENAI_VOICE=marin
BOT_WAKE_WORD=ルーメイト
BOT_WAKE_WORD_ALIASES=ルームメイト
BOT_SILENCE_MS=900
LOG_LEVEL=debug
```

`BOT_WAKE_WORD_ALIASES`はカンマ区切りで複数指定できます。

## 3. Build確認

```powershell
npm install
npm run check
```

期待値:

- Typecheck成功
- Unit Test成功
- Production build成功

PR #4 のGitHub Actionsでは、これらに加えてDocker Compose validation、Bot container build、Dashboard container buildまで成功していることを確認します。

## 4. 起動

```powershell
npm run dev
```

別PowerShell:

```powershell
Invoke-RestMethod http://localhost:3001/health | ConvertTo-Json
```

期待値:

- `status=ok`
- `discordReady=true`
- VC参加前は`activeVoiceSessions=0`

## 5. Discord VCへ参加

1. テスト用DiscordサーバーのVCへ自分が参加する
2. `/status`を実行する
3. `/join`を実行する
4. Botが同じVCへ参加することを確認する
5. Healthの`activeVoiceSessions=1`を確認する

## 6. Wake word gate

### Case A: Wake wordなし

```text
今日マイクラやる？
```

期待値:

- Botは音声応答しない
- `LOG_LEVEL=debug`ではWake word判定が`matched=false`
- 文字起こし本文そのものはログへ出ない

### Case B: 正式Wake word

```text
ルーメイト、聞こえる？
```

期待値:

- `matched=true`
- Botが音声応答する

### Case C: Alias

`BOT_WAKE_WORD_ALIASES=ルームメイト`を設定した状態で:

```text
ルームメイト、ネザーについて教えて
```

期待値:

- `matched=true`
- Botが音声応答する

### Case D: 句読点・空白を含む呼びかけ

```text
ねえ、ルーメイト！聞こえる？
```

期待値:

- 正規化後にWake wordとして一致する
- Botが音声応答する

## 7. 非Wake発話の後にWake発話

次を順番に話します。

```text
今日は何時からやる？
```

Botが応答しないことを確認した後:

```text
ルーメイト、ダイヤはどの高さで掘る？
```

期待値:

- 1つ目は無応答
- 2つ目だけ応答
- 非Wake発話はRealtime会話履歴から削除される

## 8. Barge-in / 割り込み

まず:

```text
ルーメイト、マインクラフトで工業MODを始める手順を五つ教えて
```

AIが話している途中で:

```text
ごめん、三つだけにして
```

期待値:

- AIの再生が停止する
- 進行中Responseがキャンセルされる
- AI発話中の割り込みはBot宛てとみなし、Wake wordなしでも新しい発話へ応答する
- debug logでは`bypassedForBargeIn=true`

5回試し、4回以上成功を目標にします。

## 9. 終了

```text
/leave
```

期待値:

- BotがVCから退出
- Healthの`activeVoiceSessions=0`
- `Voice session stopped`が記録される

最後に`Ctrl + C`でBotを終了します。

## 10. 合格条件

- [ ] `npm run check`成功
- [ ] `/join`成功
- [ ] Wake wordなしで応答しない
- [ ] `BOT_WAKE_WORD`で応答する
- [ ] Aliasで応答する
- [ ] 非Wake発話後も次のWake発話へ正常応答する
- [ ] 割り込み5回中4回以上成功する
- [ ] `/leave`成功
- [ ] Token / API Key / `.env` / 文字起こし本文がGitHubへ露出していない

実VCの確認が完了するまではPR #4とIssue #2を閉じません。
