import { useEffect, useMemo, useState } from 'react';

type HealthSnapshot = {
  status: 'ok' | 'degraded';
  discordReady: boolean;
  activeVoiceSessions: number;
  model: string;
  uptimeSeconds: number;
  version: string;
};

type PersonaForm = {
  name: string;
  voice: string;
  style: string;
  wakeWord: string;
};

const fallbackHealth: HealthSnapshot = {
  status: 'degraded',
  discordReady: false,
  activeVoiceSessions: 0,
  model: 'gpt-realtime-2.1-mini',
  uptimeSeconds: 0,
  version: '0.1.0',
};

const navItems = ['概要', 'サーバー設定', 'キャラクター', '音声設定', '利用状況', 'ログ'];

function formatUptime(totalSeconds: number): string {
  if (totalSeconds < 60) return `${totalSeconds}秒`;
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  return hours > 0 ? `${hours}時間 ${minutes}分` : `${minutes}分`;
}

export function App() {
  const healthUrl = import.meta.env.VITE_BOT_HEALTH_URL as string | undefined;
  const [health, setHealth] = useState<HealthSnapshot>(fallbackHealth);
  const [lastChecked, setLastChecked] = useState<Date | null>(null);
  const [activeNav, setActiveNav] = useState('概要');
  const [persona, setPersona] = useState<PersonaForm>({
    name: 'RooMate',
    voice: 'marin',
    style: '明るく親しみやすいゲーム仲間。返答は短くする。',
    wakeWord: 'ルーメイト',
  });
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!healthUrl) return;

    let cancelled = false;
    const refresh = async () => {
      try {
        const response = await fetch(healthUrl, { cache: 'no-store' });
        const snapshot = (await response.json()) as HealthSnapshot;
        if (!cancelled) setHealth(snapshot);
      } catch {
        if (!cancelled) setHealth(fallbackHealth);
      } finally {
        if (!cancelled) setLastChecked(new Date());
      }
    };

    void refresh();
    const timer = window.setInterval(() => void refresh(), 5_000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [healthUrl]);

  const setupProgress = useMemo(() => {
    const completed = [Boolean(healthUrl), health.discordReady, health.activeVoiceSessions > 0].filter(Boolean)
      .length;
    return Math.round((completed / 3) * 100);
  }, [health.activeVoiceSessions, health.discordReady, healthUrl]);

  const savePersona = () => {
    setSaved(true);
    window.setTimeout(() => setSaved(false), 2_000);
  };

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true">
            <i />
            <i />
            <i />
            <i />
          </span>
          <div>
            <strong>RooMate Voice</strong>
            <small>Console</small>
          </div>
        </div>

        <nav aria-label="メインナビゲーション">
          {navItems.map((item) => (
            <button
              key={item}
              className={activeNav === item ? 'nav-item active' : 'nav-item'}
              type="button"
              onClick={() => setActiveNav(item)}
            >
              <span className="nav-dot" aria-hidden="true" />
              {item}
            </button>
          ))}
        </nav>

        <div className="sidebar-footer">
          <div className="runtime-indicator">
            <span className={health.discordReady ? 'status-dot online' : 'status-dot'} />
            <div>
              <strong>{health.discordReady ? 'Bot稼働中' : 'Bot未接続'}</strong>
              <small>v{health.version}</small>
            </div>
          </div>
          <a href="https://github.com/mizzz-ivr/roomate-voice" target="_blank" rel="noreferrer">
            GitHubで見る
          </a>
        </div>
      </aside>

      <main>
        <header className="topbar">
          <div>
            <h1>{activeNav}</h1>
            <p>Discord VCで動くRealtime音声AIの状態と設定を管理します。</p>
          </div>
          <div className="topbar-actions">
            <span className="environment">Local</span>
            <div className="avatar">MI</div>
          </div>
        </header>

        <section className="metrics" aria-label="稼働状況">
          <article className="metric">
            <span>Bot状態</span>
            <strong>{health.discordReady ? 'オンライン' : 'オフライン'}</strong>
            <small>{lastChecked ? `${lastChecked.toLocaleTimeString()} 更新` : '接続待ち'}</small>
          </article>
          <article className="metric">
            <span>接続中のVC</span>
            <strong>{health.activeVoiceSessions}</strong>
            <small>現在のセッション</small>
          </article>
          <article className="metric">
            <span>Realtimeモデル</span>
            <strong className="model-name">{health.model}</strong>
            <small>環境変数から設定</small>
          </article>
          <article className="metric">
            <span>稼働時間</span>
            <strong>{formatUptime(health.uptimeSeconds)}</strong>
            <small>直近の起動から</small>
          </article>
        </section>

        <section className="dashboard-grid">
          <article className="panel setup-panel">
            <div className="panel-heading">
              <div>
                <h2>ローカルセットアップ</h2>
                <p>音声疎通までに必要な3ステップ</p>
              </div>
              <span>{setupProgress}%</span>
            </div>
            <div className="progress-track" aria-label={`セットアップ進捗 ${setupProgress}%`}>
              <span style={{ width: `${setupProgress}%` }} />
            </div>
            <ol className="setup-list">
              <li className={healthUrl ? 'done' : ''}>
                <span>1</span>
                <div>
                  <strong>ダッシュボード接続</strong>
                  <small>VITE_BOT_HEALTH_URLを設定</small>
                </div>
              </li>
              <li className={health.discordReady ? 'done' : ''}>
                <span>2</span>
                <div>
                  <strong>Discord Bot起動</strong>
                  <small>Bot TokenとClient IDを設定</small>
                </div>
              </li>
              <li className={health.activeVoiceSessions > 0 ? 'done' : ''}>
                <span>3</span>
                <div>
                  <strong>VCへ接続</strong>
                  <small>Discordで /join を実行</small>
                </div>
              </li>
            </ol>
          </article>

          <article className="panel connection-panel">
            <div className="panel-heading">
              <div>
                <h2>音声パイプライン</h2>
                <p>ローカルとLightsailで共通の構成</p>
              </div>
            </div>
            <div className="pipeline">
              <div>
                <span>01</span>
                <strong>Discord VC</strong>
                <small>Opus 48kHz</small>
              </div>
              <b>→</b>
              <div>
                <span>02</span>
                <strong>Bot Worker</strong>
                <small>PCM 24kHzへ変換</small>
              </div>
              <b>→</b>
              <div>
                <span>03</span>
                <strong>OpenAI</strong>
                <small>Realtime API</small>
              </div>
            </div>
            <div className="runtime-row">
              <span className={health.status === 'ok' ? 'status-dot online' : 'status-dot'} />
              <div>
                <strong>{health.status === 'ok' ? 'パイプライン準備完了' : 'Botの起動を待っています'}</strong>
                <small>Health endpoint: {healthUrl ?? '未設定'}</small>
              </div>
            </div>
          </article>

          <article className="panel persona-panel">
            <div className="panel-heading">
              <div>
                <h2>キャラクター設定</h2>
                <p>MVPでは環境変数へ反映する設定を確認できます。</p>
              </div>
              <button type="button" onClick={savePersona}>
                {saved ? '保存しました' : '設定を保存'}
              </button>
            </div>
            <div className="form-grid">
              <label>
                キャラクター名
                <input
                  value={persona.name}
                  onChange={(event) => setPersona({ ...persona, name: event.target.value })}
                />
              </label>
              <label>
                音声
                <select
                  value={persona.voice}
                  onChange={(event) => setPersona({ ...persona, voice: event.target.value })}
                >
                  <option value="marin">marin</option>
                  <option value="cedar">cedar</option>
                  <option value="coral">coral</option>
                  <option value="verse">verse</option>
                </select>
              </label>
              <label>
                呼びかけ語
                <input
                  value={persona.wakeWord}
                  onChange={(event) => setPersona({ ...persona, wakeWord: event.target.value })}
                />
              </label>
              <label className="wide">
                性格・口調
                <textarea
                  rows={3}
                  value={persona.style}
                  onChange={(event) => setPersona({ ...persona, style: event.target.value })}
                />
              </label>
            </div>
          </article>

          <article className="panel deployment-panel">
            <div className="panel-heading">
              <div>
                <h2>デプロイ先</h2>
                <p>管理画面と常駐Botを分離します。</p>
              </div>
            </div>
            <div className="deployment-list">
              <div>
                <span className="deployment-icon">V</span>
                <div>
                  <strong>Vercel</strong>
                  <small>Dashboard / Preview</small>
                </div>
                <em>Web</em>
              </div>
              <div>
                <span className="deployment-icon">L</span>
                <div>
                  <strong>AWS Lightsail</strong>
                  <small>Bot Worker / Docker</small>
                </div>
                <em>常駐</em>
              </div>
              <div>
                <span className="deployment-icon">D</span>
                <div>
                  <strong>Local Docker</strong>
                  <small>開発・音声テスト</small>
                </div>
                <em>推奨</em>
              </div>
            </div>
          </article>
        </section>
      </main>
    </div>
  );
}
