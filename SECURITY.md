# Security Policy

## 報告方法

脆弱性をPublic Issueへ投稿しないでください。Repository ownerへ非公開で連絡してください。

## 秘密情報

以下をGit、Issue、PR、ログへ含めないでください。

- Discord Bot Token / Client Secret
- OpenAI API Key
- Supabase Service Role Key
- 暗号化キー
- 実運用Guild IDやユーザー音声
- Transcript、音声サンプル、録音

## 音声データ

初期実装では音声をファイル保存しません。将来録音やTranscript保存を追加する場合は、明示的な同意、保存期間、削除手段、アクセス制御を必須にします。
