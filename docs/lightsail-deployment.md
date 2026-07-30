# AWS Lightsailへの配置

## 推奨サイズ

初期の1Bot・数Guild検証ではLinux 2GB以上から開始します。FFmpeg変換とDiscord音声処理があるため、最小メモリ構成より余裕を持たせます。負荷は同時接続VC数を基準に計測して調整してください。

## 初期セットアップ

Ubuntu系Lightsailインスタンスを作成し、Docker EngineとCompose Pluginを導入します。

```bash
sudo mkdir -p /opt/roomate-voice
sudo chown "$USER":"$USER" /opt/roomate-voice
cd /opt/roomate-voice
curl -O https://raw.githubusercontent.com/mizzz-ivr/roomate-voice/main/infra/lightsail/docker-compose.yml
cp /path/to/secure/.env .env
docker compose pull
docker compose up -d
```

`.env`はGitへ登録しません。ファイル権限は`chmod 600 .env`を推奨します。

## 自動起動

```bash
sudo cp roomate-voice.service /etc/systemd/system/roomate-voice.service
sudo systemctl daemon-reload
sudo systemctl enable --now roomate-voice
```

## 更新

```bash
cd /opt/roomate-voice
docker compose pull
docker compose up -d
```

## ネットワーク

Discord VoiceはWebSocketに加えてUDPを利用します。Lightsail側から外向き通信できることが必要です。BotのHealth APIはComposeで`127.0.0.1:3001`に限定しており、直接インターネット公開しません。

Vercelの管理画面から状態取得する場合は、後続フェーズで認証付きAPIまたはSupabase経由のHeartbeatを実装します。Health APIをそのまま公開しないでください。
