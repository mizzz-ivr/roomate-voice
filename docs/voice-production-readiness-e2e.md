# Voice Production Readiness E2E

Wake word文字起こしゲートとproduction-readiness修正を、Windows + Discord実VC + OpenAI Realtime APIで確認するための短縮手順です。

詳細なWindows環境構築は `docs/windows-local-e2e-runbook.md` を正本とします。

## 1. 対象branch

通常は最新`main`を使用します。PR #5をmainへマージする前のproduction-readiness確認ではPR headを使用します。

```powershell
cd $HOME\src\roomate-voice
git fetch origin
git switch fix/voice-production-readiness-follow-up
git pull --ff-only origin fix/voice-production-readiness-follow-up
git status --short
```

`.env`はGit管理対象へ入れないでください。

## 2. 必須設定

```env
OPENAI_REALTIME_MODEL=gpt-realtime-2.1-mini
OPENAI_TRANSCRIPTION_MODEL=gpt-transcribe
OPENAI_VOICE=marin
BOT_WAKE_WORD=ルーメイト
BOT_WAKE_WORD_ALIASES=ルームメイト
BOT_SILENCE_MS=900
LOG_LEVEL=debug
```

Secret値はPC上の`.env`へだけ入力し、GitHub / Notion / Chatへ貼らないでください。

## 3. Build確認

```powershell
npm install
npm run check
```

期待値:

- Typecheck成功
- Unit Test成功
- Production build成功
- PRのCIでDocker Compose validation / Bot container / Dashboard containerも成功

## 4. 起動・Health

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
- VC参加前 `activeVoiceSessions=0`

## 5. Discord VC

1. `/status`
2. `/join`
3. Healthの`activeVoiceSessions=1`を確認

## 6. Wake word gate

### Wake wordなし

```text
今日マイクラやる？
```

期待:

- Botは応答しない
- debug logは判定メタデータだけを記録し、Transcription本文を出さない

### Primary

```text
ルーメイト、聞こえる？
```

期待: Botが応答する。

### Alias

```text
ルームメイト、ネザーについて教えて
```

期待: Botが応答する。

## 7. 非Wake発話の履歴削除

```text
今日は何時からやる？
```

無応答を確認後:

```text
ルーメイト、ダイヤはどの高さで掘る？
```

期待:

- 1つ目は無応答
- 2つ目だけ応答
- 1つ目のcommitted itemはRealtime会話履歴から削除される

## 8. Transcription latency / commit-order race

最初の発話の音声captureが終わった直後、Transcription結果を待たずに次の発話を開始します。Wake wordなし→Wake word、Wake word→Wake wordの両方を複数回確認します。

期待:

- capture終了後はspeaker lockが解放されており、次の`receiver.speaking.start`を受け付ける
- 先行発話の遅延cleanupが後続発話のcapture lockを解除しない
- 複数のpending Transcriptionがあっても、`input_audio_buffer.committed`のitem IDと結果が正しい発話へ相関する
- Transcription結果の到着順にかかわらず、Wake/delete/response判定はcommit順に処理する
- 新しいaudio captureが継続中は`response.create`を開始しない
- 同じdecision batch内に複数のWake発話がある場合、未分類itemを含んだ重複Responseを生成せず、batch drain後に1回だけResponseを作成する
- 次の発話全体を取りこぼさない

## 9. Commit / Transcription failure cleanup

Commit failureまたはTranscription failureが発生した場合のログを確認します。故意にSecretや音声本文をログへ追加しないでください。

期待:

- `input_audio_buffer.commit`へclient-generated `event_id`を付与する
- server `error.error.event_id`がcommit event IDを返した場合、該当pending requestだけを失敗扱いにし後続requestを誤相関させない
- Transcription failed eventのcommitted `item_id`を保持する
- Bot側が当該itemへ`conversation.item.delete`を試行する
- ACK受信前にtimeoutし相関安全性を保証できなくなった場合はfail closedとし、queueを継続利用せずRealtime socketを閉じる
- Realtime切断時はDiscord voice sessionも終了し、後続発話を汚染済みsessionで処理し続けない
- 再開は`/join`で新しいRealtime sessionを作成して行う

## 10. Barge-in

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

## 11. 終了

```text
/leave
```

期待:

- Bot退出
- `activeVoiceSessions=0`
- `Voice session stopped`

## 12. 合格条件

- [ ] `npm run check`成功
- [ ] `/join`成功
- [ ] Wake wordなしで応答しない
- [ ] Primary Wake wordで応答する
- [ ] Aliasで応答する
- [ ] 非Wake発話がRealtime会話履歴へ残らない
- [ ] Transcription latency中の次発話を取りこぼさない
- [ ] Concurrent transcriptionのitem ID相関が崩れない
- [ ] Wake/delete/response判定がcommit順である
- [ ] capture中に先行Responseを開始しない
- [ ] back-to-back Wake発話で重複Responseを作らない
- [ ] commit errorをclient event IDで該当requestへ相関できる
- [ ] ACK前timeout時にfail closedし、後続requestを誤相関させない
- [ ] Transcription failure時にcommitted itemをcleanupできる
- [ ] barge-in 5回中4回以上成功
- [ ] `/leave`成功
- [ ] Token / API Key / `.env` / Transcription本文が共有ログやGitHubへ露出していない

Issue #2は実VC E2Eの追跡用として、実機確認が完了するまでopenのまま維持します。
