import { useEffect, useMemo, useState } from 'react';
import type {
  BotRuntimeSnapshot,
  DesktopBootstrap,
  DesktopPublicSettings,
  DesktopSecretPresence,
} from '../shared/types.js';

type View = 'home' | 'setup' | 'settings' | 'diagnostics';
type SaveState = 'idle' | 'saving' | 'saved' | 'error';

const FALLBACK_SETTINGS: DesktopPublicSettings = {
  discordClientId: '',
  discordGuildId: '',
  realtimeModel: 'gpt-realtime-2.1-mini',
  transcriptionModel: 'gpt-transcribe',
  voice: 'marin',
  personaName: 'RooMate',
  personaStyle: '明るく親しみやすいゲーム仲間。返答は短く、プレイ中の邪魔にならないように話す。',
  wakeWord: 'ルーメイト',
  wakeWordAliases: 'ルームメイト',
  silenceMs: 900,
  logLevel: 'info',
  launchAtLogin: false,
  startBotOnLaunch: false,
};

const EMPTY_SECRETS: DesktopSecretPresence = {
  discordBotToken: false,
  openaiApiKey: false,
};

const INITIAL_RUNTIME: BotRuntimeSnapshot = {
  state: 'stopped',
  workerAvailable: false,
};

const NAV_ITEMS: Array<{ id: View; label: string; description: string }> = [
  { id: 'home', label: 'ホーム', description: 'Botの状態と開始・停止' },
  { id: 'setup', label: '初期設定', description: 'DiscordとOpenAIをかんたん設定' },
  { id: 'settings', label: 'RooMate設定', description: '呼びかけ・声・性格' },
  { id: 'diagnostics', label: '診断', description: '困ったときの状態確認' },
];

function runtimeLabel(state: BotRuntimeSnapshot['state']): string {
  switch (state) {
    case 'starting':
      return '起動しています';
    case 'running':
      return '起動中';
    case 'stopping':
      return '停止しています';
    case 'error':
      return '確認が必要です';
    default:
      return '停止中';
  }
}

function formatUptime(totalSeconds: number | undefined): string {
  if (!totalSeconds) return '—';
  if (totalSeconds < 60) return `${totalSeconds}秒`;
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  return hours > 0 ? `${hours}時間 ${minutes}分` : `${minutes}分`;
}

function StatusPill({ ok, children }: { ok: boolean; children: string }) {
  return <span className={ok ? 'status-pill ok' : 'status-pill'}>{children}</span>;
}

function Toggle({
  checked,
  onChange,
  label,
  description,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  description: string;
}) {
  return (
    <label className="toggle-row">
      <span>
        <strong>{label}</strong>
        <small>{description}</small>
      </span>
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
      />
      <span className="toggle" aria-hidden="true" />
    </label>
  );
}

export function App() {
  const [view, setView] = useState<View>('home');
  const [bootstrap, setBootstrap] = useState<DesktopBootstrap | null>(null);
  const [settings, setSettings] = useState<DesktopPublicSettings>(FALLBACK_SETTINGS);
  const [secrets, setSecrets] = useState<DesktopSecretPresence>(EMPTY_SECRETS);
  const [runtime, setRuntime] = useState<BotRuntimeSnapshot>(INITIAL_RUNTIME);
  const [discordBotToken, setDiscordBotToken] = useState('');
  const [openaiApiKey, setOpenaiApiKey] = useState('');
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [message, setMessage] = useState<string>('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const unsubscribe = window.roomate.onRuntimeStatus((snapshot) => {
      if (!cancelled) setRuntime(snapshot);
    });

    void window.roomate
      .getBootstrap()
      .then((snapshot) => {
        if (cancelled) return;
        setBootstrap(snapshot);
        setSettings(snapshot.settings);
        setSecrets(snapshot.secrets);
        setRuntime(snapshot.runtime);
      })
      .catch((error: unknown) => {
        if (!cancelled) setMessage(error instanceof Error ? error.message : String(error));
      });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);

  const setupChecks = useMemo(
    () => ({
      discordIds: /^\d+$/.test(settings.discordClientId) && /^\d+$/.test(settings.discordGuildId),
      discordToken: secrets.discordBotToken || discordBotToken.trim().length > 0,
      openaiKey: secrets.openaiApiKey || openaiApiKey.trim().length > 0,
      secureStorage: Boolean(bootstrap?.secureStorageAvailable),
    }),
    [
      bootstrap?.secureStorageAvailable,
      discordBotToken,
      openaiApiKey,
      secrets.discordBotToken,
      secrets.openaiApiKey,
      settings.discordClientId,
      settings.discordGuildId,
    ],
  );

  const setupComplete = Object.values(setupChecks).every(Boolean);
  const running = runtime.state === 'running';
  const transitioning = runtime.state === 'starting' || runtime.state === 'stopping';

  const save = async (successMessage = '設定を保存しました。') => {
    setSaveState('saving');
    setMessage('');
    try {
      const snapshot = await window.roomate.saveSettings({
        settings,
        secrets: {
          ...(discordBotToken.trim() ? { discordBotToken: discordBotToken } : {}),
          ...(openaiApiKey.trim() ? { openaiApiKey } : {}),
        },
      });
      setBootstrap(snapshot);
      setSettings(snapshot.settings);
      setSecrets(snapshot.secrets);
      setRuntime(snapshot.runtime);
      setDiscordBotToken('');
      setOpenaiApiKey('');
      setSaveState('saved');
      setMessage(successMessage);
      window.setTimeout(() => setSaveState('idle'), 2_000);
      return true;
    } catch (error) {
      setSaveState('error');
      setMessage(error instanceof Error ? error.message : String(error));
      return false;
    }
  };

  const startBot = async () => {
    setBusy(true);
    setMessage('');
    try {
      if (discordBotToken.trim() || openaiApiKey.trim()) {
        const saved = await save('設定を保存しました。Botを起動します。');
        if (!saved) return;
      }
      const snapshot = await window.roomate.startBot();
      setRuntime(snapshot);
      if (snapshot.state === 'error') {
        setMessage(snapshot.lastError ?? 'Botを開始できませんでした。設定を確認してください。');
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  };

  const stopBot = async () => {
    setBusy(true);
    setMessage('');
    try {
      setRuntime(await window.roomate.stopBot());
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  };

  const restartBot = async () => {
    setBusy(true);
    setMessage('');
    try {
      setRuntime(await window.roomate.restartBot());
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  };

  if (!bootstrap) {
    return (
      <main className="loading-screen">
        <div className="brand-orb" aria-hidden="true">R</div>
        <strong>RooMate Voiceを準備しています</strong>
        <small>{message || 'Windowsの設定を確認しています…'}</small>
      </main>
    );
  }

  return (
    <div className="desktop-shell">
      <aside className="sidebar">
        <div className="brand-block">
          <div className="brand-orb" aria-hidden="true">R</div>
          <div>
            <strong>RooMate Voice</strong>
            <small>Desktop</small>
          </div>
        </div>

        <nav aria-label="RooMate Voiceメニュー">
          {NAV_ITEMS.map((item) => (
            <button
              key={item.id}
              type="button"
              className={view === item.id ? 'nav-button active' : 'nav-button'}
              onClick={() => setView(item.id)}
            >
              <span className="nav-symbol" aria-hidden="true">
                {item.id === 'home' ? '●' : item.id === 'setup' ? '✓' : item.id === 'settings' ? '◇' : '＋'}
              </span>
              <span>
                <strong>{item.label}</strong>
                <small>{item.description}</small>
              </span>
            </button>
          ))}
        </nav>

        <div className="sidebar-bottom">
          <div className="sidebar-status">
            <span className={running ? 'dot online' : runtime.state === 'error' ? 'dot error' : 'dot'} />
            <div>
              <strong>{runtimeLabel(runtime.state)}</strong>
              <small>v{bootstrap.appVersion}</small>
            </div>
          </div>
          <button
            className="text-button"
            type="button"
            onClick={() => void window.roomate.openExternal('https://github.com/mizzz-ivr/roomate-voice')}
          >
            GitHub / OSS
          </button>
        </div>
      </aside>

      <main className="content">
        <header className="topbar">
          <div>
            <span className="eyebrow">WINDOWS DESKTOP</span>
            <h1>{NAV_ITEMS.find((item) => item.id === view)?.label}</h1>
          </div>
          <div className="top-actions">
            <StatusPill ok={setupComplete}>{setupComplete ? '初期設定 完了' : '初期設定 未完了'}</StatusPill>
            <StatusPill ok={running}>{runtimeLabel(runtime.state)}</StatusPill>
          </div>
        </header>

        {message ? (
          <div className={runtime.state === 'error' || saveState === 'error' ? 'notice error' : 'notice'}>
            {message}
          </div>
        ) : null}

        {view === 'home' ? (
          <section className="page-stack">
            <article className="hero-card">
              <div>
                <span className="eyebrow">YOUR VOICE COMPANION</span>
                <h2>{running ? 'RooMateは起動しています。' : 'ゲーム仲間を、ワンクリックで。'}</h2>
                <p>
                  Discordのボイスチャンネルで「{settings.wakeWord}」と呼びかけると、RooMateが音声で応答します。
                  開発ツールやコマンド操作は必要ありません。
                </p>
                <div className="hero-actions">
                  {running ? (
                    <button className="primary danger" type="button" disabled={busy || transitioning} onClick={() => void stopBot()}>
                      Botを停止
                    </button>
                  ) : (
                    <button className="primary" type="button" disabled={busy || transitioning || !setupComplete} onClick={() => void startBot()}>
                      Botを開始
                    </button>
                  )}
                  <button className="secondary" type="button" disabled={busy || transitioning || !setupComplete} onClick={() => void restartBot()}>
                    再起動
                  </button>
                </div>
                {!setupComplete ? (
                  <button className="setup-link" type="button" onClick={() => setView('setup')}>
                    初期設定を完了する →
                  </button>
                ) : null}
              </div>
              <div className={running ? 'voice-visual active' : 'voice-visual'} aria-label={runtimeLabel(runtime.state)}>
                <i /><i /><i /><i /><i /><i /><i />
              </div>
            </article>

            <section className="metric-grid" aria-label="Botの状態">
              <article className="metric-card">
                <span>Discord</span>
                <strong>{runtime.health?.discordReady ? '接続済み' : '未接続'}</strong>
                <small>Botアカウントの状態</small>
              </article>
              <article className="metric-card">
                <span>ボイス接続</span>
                <strong>{runtime.health?.activeVoiceSessions ?? 0}</strong>
                <small>参加中のVC</small>
              </article>
              <article className="metric-card">
                <span>AIモデル</span>
                <strong className="compact-value">{runtime.health?.model ?? settings.realtimeModel}</strong>
                <small>OpenAI Realtime</small>
              </article>
              <article className="metric-card">
                <span>稼働時間</span>
                <strong>{formatUptime(runtime.health?.uptimeSeconds)}</strong>
                <small>直近の起動から</small>
              </article>
            </section>

            <article className="guide-card">
              <div className="guide-icon">1</div>
              <div>
                <strong>Discordでボイスチャンネルに入る</strong>
                <p>RooMateを使いたいサーバーのVCへ参加してください。</p>
              </div>
              <div className="guide-icon">2</div>
              <div>
                <strong>Discordで /join</strong>
                <p>RooMateが同じVCへ参加します。その後は「{settings.wakeWord}」と話しかけるだけです。</p>
              </div>
            </article>
          </section>
        ) : null}

        {view === 'setup' ? (
          <section className="page-stack">
            <article className="intro-card">
              <div>
                <span className="eyebrow">FIRST SETUP</span>
                <h2>最初だけ、3つの設定をします。</h2>
                <p>TokenやAPI KeyはWindowsの保護機能で暗号化して保存します。保存済みの値を画面へ再表示することはありません。</p>
              </div>
              <div className="completion-ring">
                <strong>{Object.values(setupChecks).filter(Boolean).length}/4</strong>
                <small>準備完了</small>
              </div>
            </article>

            <article className="form-card">
              <div className="section-heading">
                <span>01</span>
                <div>
                  <h3>Discord Bot</h3>
                  <p>Discord Developer Portalで作成したRooMate用Botの情報です。</p>
                </div>
                <button type="button" className="link-button" onClick={() => void window.roomate.openExternal('https://discord.com/developers/applications')}>
                  Discord設定を開く
                </button>
              </div>
              <div className="form-grid">
                <label>
                  Application ID
                  <input
                    inputMode="numeric"
                    autoComplete="off"
                    placeholder="数字のApplication ID"
                    value={settings.discordClientId}
                    onChange={(event) => setSettings((current) => ({ ...current, discordClientId: event.target.value }))}
                  />
                </label>
                <label>
                  Server ID（Guild ID）
                  <input
                    inputMode="numeric"
                    autoComplete="off"
                    placeholder="Botを使うDiscordサーバーのID"
                    value={settings.discordGuildId}
                    onChange={(event) => setSettings((current) => ({ ...current, discordGuildId: event.target.value }))}
                  />
                </label>
                <label className="wide">
                  <span className="label-row">
                    Bot Token
                    <em>{secrets.discordBotToken ? '保存済み' : '未設定'}</em>
                  </span>
                  <input
                    type="password"
                    autoComplete="new-password"
                    placeholder={secrets.discordBotToken ? '変更するときだけ新しいTokenを入力' : 'Discord Bot Token'}
                    value={discordBotToken}
                    onChange={(event) => setDiscordBotToken(event.target.value)}
                  />
                  <small>保存済みTokenは安全のため画面へ表示しません。</small>
                </label>
              </div>
            </article>

            <article className="form-card">
              <div className="section-heading">
                <span>02</span>
                <div>
                  <h3>OpenAI</h3>
                  <p>RooMateが音声を理解して話すためのAPI Keyです。</p>
                </div>
                <button type="button" className="link-button" onClick={() => void window.roomate.openExternal('https://platform.openai.com/api-keys')}>
                  OpenAI設定を開く
                </button>
              </div>
              <div className="form-grid single">
                <label>
                  <span className="label-row">
                    OpenAI API Key
                    <em>{secrets.openaiApiKey ? '保存済み' : '未設定'}</em>
                  </span>
                  <input
                    type="password"
                    autoComplete="new-password"
                    placeholder={secrets.openaiApiKey ? '変更するときだけ新しいAPI Keyを入力' : 'OpenAI API Key'}
                    value={openaiApiKey}
                    onChange={(event) => setOpenaiApiKey(event.target.value)}
                  />
                  <small>API KeyはWindowsの暗号化ストレージに保存します。</small>
                </label>
              </div>
            </article>

            <article className="form-card secure-card">
              <div>
                <span className={bootstrap.secureStorageAvailable ? 'secure-icon ready' : 'secure-icon'}>✓</span>
                <div>
                  <strong>Windowsの安全な保存領域</strong>
                  <p>{bootstrap.secureStorageAvailable ? '利用できます。Token / API Keyを暗号化して保存します。' : '利用できません。Secretは保存されません。'}</p>
                </div>
              </div>
              <button className="primary" type="button" disabled={saveState === 'saving' || !bootstrap.secureStorageAvailable} onClick={() => void save()}>
                {saveState === 'saving' ? '保存しています…' : saveState === 'saved' ? '保存しました' : '設定を保存'}
              </button>
            </article>
          </section>
        ) : null}

        {view === 'settings' ? (
          <section className="page-stack">
            <article className="form-card">
              <div className="section-heading">
                <span>AI</span>
                <div>
                  <h3>RooMateのキャラクター</h3>
                  <p>普段の呼び方、声、話し方を変更できます。</p>
                </div>
              </div>
              <div className="form-grid">
                <label>
                  名前
                  <input value={settings.personaName} onChange={(event) => setSettings((current) => ({ ...current, personaName: event.target.value }))} />
                </label>
                <label>
                  声
                  <select value={settings.voice} onChange={(event) => setSettings((current) => ({ ...current, voice: event.target.value }))}>
                    <option value="marin">marin</option>
                    <option value="cedar">cedar</option>
                    <option value="coral">coral</option>
                    <option value="verse">verse</option>
                  </select>
                </label>
                <label>
                  呼びかけ語
                  <input value={settings.wakeWord} onChange={(event) => setSettings((current) => ({ ...current, wakeWord: event.target.value }))} />
                </label>
                <label>
                  別の呼び方
                  <input value={settings.wakeWordAliases} onChange={(event) => setSettings((current) => ({ ...current, wakeWordAliases: event.target.value }))} placeholder="カンマ区切り" />
                </label>
                <label className="wide">
                  性格・話し方
                  <textarea rows={5} value={settings.personaStyle} onChange={(event) => setSettings((current) => ({ ...current, personaStyle: event.target.value }))} />
                </label>
              </div>
            </article>

            <article className="form-card">
              <div className="section-heading">
                <span>SYS</span>
                <div>
                  <h3>動作設定</h3>
                  <p>通常は初期値のままで使えます。</p>
                </div>
              </div>
              <div className="form-grid">
                <label>
                  無音判定
                  <select value={String(settings.silenceMs)} onChange={(event) => setSettings((current) => ({ ...current, silenceMs: Number(event.target.value) }))}>
                    <option value="700">短め（0.7秒）</option>
                    <option value="900">標準（0.9秒）</option>
                    <option value="1200">ゆっくり（1.2秒）</option>
                  </select>
                </label>
                <label>
                  ログレベル
                  <select value={settings.logLevel} onChange={(event) => setSettings((current) => ({ ...current, logLevel: event.target.value as DesktopPublicSettings['logLevel'] }))}>
                    <option value="info">標準</option>
                    <option value="debug">詳細</option>
                    <option value="warn">警告のみ</option>
                    <option value="error">エラーのみ</option>
                  </select>
                </label>
              </div>
              <div className="toggle-list">
                <Toggle
                  checked={settings.launchAtLogin}
                  onChange={(checked) => setSettings((current) => ({ ...current, launchAtLogin: checked }))}
                  label="Windowsログイン時にRooMate Voiceを開く"
                  description="アプリだけを自動で開きます。"
                />
                <Toggle
                  checked={settings.startBotOnLaunch}
                  onChange={(checked) => setSettings((current) => ({ ...current, startBotOnLaunch: checked }))}
                  label="アプリ起動時にBotも開始する"
                  description="設定が完了している場合だけおすすめします。"
                />
              </div>
              <div className="form-actions">
                <button className="primary" type="button" disabled={saveState === 'saving'} onClick={() => void save()}>
                  {saveState === 'saving' ? '保存しています…' : '変更を保存'}
                </button>
              </div>
            </article>
          </section>
        ) : null}

        {view === 'diagnostics' ? (
          <section className="page-stack">
            <article className="diagnostic-card">
              <div className="section-heading">
                <span>✓</span>
                <div>
                  <h3>かんたん診断</h3>
                  <p>Secretや会話内容を表示せず、RooMateが使える状態かだけ確認します。</p>
                </div>
              </div>
              <div className="diagnostic-list">
                <div>
                  <span className={bootstrap.secureStorageAvailable ? 'dot online' : 'dot error'} />
                  <div><strong>安全な資格情報ストレージ</strong><small>Token / API Keyの暗号化保存</small></div>
                  <em>{bootstrap.secureStorageAvailable ? 'OK' : '確認必要'}</em>
                </div>
                <div>
                  <span className={runtime.workerAvailable ? 'dot online' : 'dot'} />
                  <div><strong>Voice Worker</strong><small>Discord音声Bot本体</small></div>
                  <em>{runtime.workerAvailable ? '利用可能' : '未同梱'}</em>
                </div>
                <div>
                  <span className={secrets.discordBotToken ? 'dot online' : 'dot'} />
                  <div><strong>Discord資格情報</strong><small>値そのものは表示しません</small></div>
                  <em>{secrets.discordBotToken ? '保存済み' : '未設定'}</em>
                </div>
                <div>
                  <span className={secrets.openaiApiKey ? 'dot online' : 'dot'} />
                  <div><strong>OpenAI資格情報</strong><small>値そのものは表示しません</small></div>
                  <em>{secrets.openaiApiKey ? '保存済み' : '未設定'}</em>
                </div>
                <div>
                  <span className={runtime.health?.discordReady ? 'dot online' : 'dot'} />
                  <div><strong>Discord接続</strong><small>Bot起動後の接続状態</small></div>
                  <em>{runtime.health?.discordReady ? '接続済み' : '未接続'}</em>
                </div>
              </div>
              {runtime.lastError ? (
                <div className="diagnostic-error">
                  <strong>直近のエラー</strong>
                  <pre>{runtime.lastError}</pre>
                </div>
              ) : null}
            </article>

            <article className="about-card">
              <div>
                <strong>RooMate Voice {bootstrap.appVersion}</strong>
                <small>{bootstrap.isPackaged ? 'インストール版' : '開発版'} / Windows x64 first target</small>
              </div>
              <button className="secondary" type="button" onClick={() => void restartBot()} disabled={busy || !setupComplete}>
                Botを再起動
              </button>
            </article>
          </section>
        ) : null}
      </main>
    </div>
  );
}
