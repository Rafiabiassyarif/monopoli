// Menu utama, setup lokal, lobby online, studio tema + rangkai scene & HUD.

import { Component, Suspense, lazy, useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  ArrowLeft,
  BookOpen,
  ChevronRight,
  Bot,
  Copy,
  Download,
  Eye,
  Gamepad2,
  Medal,
  Globe,
  Palette,
  Pencil,
  Play,
  Plus,
  RotateCcw,
  Settings,
  Trash,
  Upload,
  UserPlus,
  Send,
  Users,
  Wifi,
  Zap,
  WifiOff,
  X,
} from 'lucide-react';
import { LANDMARKS, THEMES, TURN_SECONDS, formatMoney, getTheme, sanitizeOptions, validateTheme, type BotLevel, type NewPlayer, type Options, type RoomSettings, type Theme } from '@monopoli/engine';
import { RulesForm, RulesSummary } from './RulesForm';
import { OFFLINE, reportClientError, useAuth, useSocial, type Auth, type Social } from './auth';
import { AccountDialog, AuthDialog, Avatar, DmDialog, FriendsPage, InviteDialog, InviteToasts, Landing, LeaderboardPage, LegalLinks, ProfileDialog, ReportsDialog, UserChip } from './Social';
import { t, tj, tr, useLang } from './i18n';
import { armMusic, setMusicMood } from './music';
import { Board2D } from './Board2D';
import { ThemeCards } from './ThemeCards';
import { sampleTheme } from './themeSample';
import { setTipsOn } from './tips';
import { markSceneCrashed, setBoard2d, useBoard2d } from './boardMode';
import { getRaw as getStore, setRaw as setStore } from './storage';

const lowFpsSeen = () => getStore('monopoli.lowFpsAsked') === '1';
const markLowFpsSeen = () => setStore('monopoli.lowFpsAsked', '1');
import type { CamMode } from './scene/Scene';
import { resetBusy, trackBusy } from './scene/busy';
import { getJSON, getResume, clearResume, setJSON } from './storage';

// scene 3D (three.js, ~1 MB) dimuat terpisah supaya menu tampil lebih cepat
const GameScene = lazy(() => import('./scene/Scene').then((m) => ({ default: m.GameScene })));
import { HelpDialog, Hud, SettingsBody } from './Hud';
import { hasSave, useBotDriver, useLocalGame, useOnline, type LocalSetup as LocalSetupT } from './net';
import { COLORS, ConfirmHost, Field, Flag, Modal, Seg, TOKEN_ICONS, TOKEN_NAMES, Toggle, TokenBadge, askConfirm } from './ui';

const CUSTOM_KEY = 'monopoli.customThemes';
const BOT_NAMES = ['Budi', 'Sari', 'Joko', 'Ayu', 'Rudi', 'Mega'];

type Screen = 'landing' | 'menu' | 'local' | 'online' | 'themes' | 'friends' | 'leaderboard' | 'game';

const loadCustom = (): Theme[] => {
  const l = getJSON<unknown>(CUSTOM_KEY, []);
  return Array.isArray(l) ? l.filter((t) => validateTheme(t).length === 0) : [];
};
const pref = <T,>(k: string, d: T): T => getJSON<T>(k, d);

const roomParam = () => new URLSearchParams(location.search).get('room')?.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 5) || null;
/** token dari link email (?verify=…) — dibaca sekali lalu dihapus dari alamat */
function takeParam(k: string): string | null {
  const q = new URLSearchParams(location.search);
  const v = q.get(k);
  if (!v) return null;
  q.delete(k);
  history.replaceState(null, '', location.pathname + (q.toString() ? `?${q}` : '') + location.hash);
  return /^[A-Za-z0-9_-]{8,100}$/.test(v) ? v : null;
}
armMusic();

export function App() {
  useLang();
  const flat = useBoard2d();
  const [lowFps, setLowFps] = useState(false);
  const auth = useAuth();
  // belum memilih login / tamu → landing page dulu (kecuali sedang menyambung ulang ke room)
  const [screen, setScreen] = useState<Screen>(() => (auth.entered || getResume() ? (roomParam() ? 'online' : 'menu') : 'landing'));
  const [toast, setToast] = useState<string | null>(null);
  const onError = useCallback((m: string) => setToast(m), []);
  const social = useSocial(auth.user, onError, () => void auth.reloadMe());
  useEffect(() => {
    if (!auth.kicked) return;
    onError(auth.kicked);
    auth.clearKicked();
    if (online.room) online.leave();
    setScreen('landing');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auth.kicked]);
  const [authDialog, setAuthDialog] = useState<{ reason?: string } | null>(null);
  const [profile, setProfile] = useState<string | null>(null);
  const [dialog, setDialog] = useState<null | 'account' | 'reports'>(null);
  const [dmWith, setDmWith] = useState<string | null>(null);
  // link konfirmasi email
  useEffect(() => {
    const v = OFFLINE ? null : takeParam('verify');
    if (v)
      auth.verifyEmail(v).then(
        (r) => onError(t('Email untuk @{u} terkonfirmasi. Terima kasih!', { u: r.username })),
        (e: Error) => onError(e.message),
      );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const afterEnter = () => setScreen(roomParam() ? 'online' : 'menu');
  // keluar akun → kembali ke landing page
  useEffect(() => {
    if (!auth.entered && (screen === 'menu' || screen === 'friends' || screen === 'leaderboard')) setScreen('landing');
    // halaman khusus akun tanpa akun (mis. baru keluar) → kembali ke menu
    else if (!auth.user && screen === 'friends') setScreen('menu');
    // masuk dengan Google langsung dari landing page → lanjut ke menu
    if (auth.user && screen === 'landing') afterEnter();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auth.entered, auth.user, screen]);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(t);
  }, [toast]);

  const [custom, setCustom] = useState<Theme[]>(loadCustom);
  const [themeId, setThemeId] = useState<string>(() => { const t = pref<string>('monopoli.themeId', 'indonesia'); return t === 'konoha' ? 'ninja' : t; });
  const [speed, setSpeed] = useState<number>(() => pref('monopoli.speed', 1));
  const [camMode, setCamMode] = useState<CamMode>(() => pref('monopoli.cam', 'free'));
  useEffect(() => setJSON('monopoli.themeId', themeId), [themeId]);
  useEffect(() => setMusicMood(themeId), [themeId]);
  useEffect(() => setJSON('monopoli.speed', speed), [speed]);
  useEffect(() => setJSON('monopoli.cam', camMode), [camMode]);

  const local = useLocalGame(onError, themeId, auth.user?.username);
  const online = useOnline(onError);
  const [mode, setMode] = useState<'local' | 'online'>('local');
  const [selected, setSelected] = useState<number | null>(null);
  const [hovered, setHovered] = useState<number | null>(null);
  const [lastSetup, setLastSetup] = useState<LocalSetupT | null>(null);
  const [modal, setModal] = useState<null | 'settings' | 'help'>(null);

  const state = mode === 'local' ? local.state : online.state;
  const theme = useMemo(() => {
    if (mode === 'online' && online.room) return online.room.customTheme ?? getTheme(online.room.themeId, custom);
    return getTheme(themeId, custom);
  }, [mode, online.room, themeId, custom]);
  useEffect(() => setMusicMood(theme.id), [theme.id]);

  useEffect(() => {
    if (mode !== 'online') return;
    if (online.state && screen !== 'game') setScreen('game');
    // host memulai ulang → kembali ke lobby; dikeluarkan / room hilang → kembali ke menu online
    if (!online.state && screen === 'game') setScreen('online');
  }, [mode, online.state, screen]);
  // refresh / buka ulang halaman di tengah game online → sambung ulang otomatis ke kursi yang sama
  useEffect(() => {
    const r = getResume();
    if (!r) return;
    if (new URLSearchParams(location.search).get('room')?.toUpperCase() && new URLSearchParams(location.search).get('room')!.toUpperCase() !== r.code) return clearResume();
    setMode('online');
    setScreen('online');
    online.connect({ t: 'join', code: r.code, resume: r.secret, name: '', color: '', token: 0 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ukur tinggi dock HUD → kanvas 3D digeser ke atas
  const [dockH, setDockH] = useState(0);
  useEffect(() => {
    if (screen !== 'game') return setDockH(0);
    const el = document.querySelector('.dock');
    if (!el) return;
    const ro = new ResizeObserver(() => setDockH(Math.round(el.getBoundingClientRect().height) + 12));
    ro.observe(el);
    return () => ro.disconnect();
  }, [screen, !!state]);

  trackBusy(screen === 'game' ? state : null, 220 / speed);
  useBotDriver(mode === 'local' ? local.state : null, local.level, local.send, 700 / speed, screen !== 'game');

  const rollKey = useMemo(() => state?.events.filter((e) => e.type === 'dice').at(-1)?.seq ?? 0, [state?.seq]);

  const quit = () => {
    const watched = mode === 'online' && !!online.watching;
    if (mode === 'online') online.leave();
    else local.quit();
    setSelected(null);
    setScreen(watched ? 'online' : 'menu');
  };
  /** gabung room dari undangan / daftar teman, dari layar mana pun */
  const joinRoom = async (code: string) => {
    if (screen === 'game' && mode === 'local' && local.state && local.state.phase !== 'gameover' && !(await askConfirm(t('Tinggalkan game lokal? Progres tersimpan otomatis.'), { ok: t('Gabung room') }))) return;
    if (online.room?.code === code) return setScreen(online.state ? 'game' : 'online');
    if (online.room) online.leave();
    local.quit();
    setMode('online');
    setScreen('online');
    const u = auth.user;
    online.connect({ t: 'join', code, name: u?.displayName ?? (pref('monopoli.name', '') || t('Tamu')), color: u?.color ?? pref('monopoli.color', COLORS[0]), token: u?.token ?? pref('monopoli.token', 0) });
  };
  /** tonton game yang sedang berjalan (dari daftar teman / room terbuka) */
  const watchRoom = async (code: string) => {
    if (screen === 'game' && mode === 'local' && local.state && local.state.phase !== 'gameover' && !(await askConfirm(t('Tinggalkan game lokal? Progres tersimpan otomatis.'), { ok: t('Tonton') }))) return;
    if (online.room) online.leave();
    local.quit();
    resetBusy();
    setMode('online');
    setScreen('online');
    online.watch(code);
  };
  const needLogin = (reason: string) => setAuthDialog({ reason });
  const startLocal = (s: LocalSetupT) => {
    resetBusy();
    setMode('local');
    setLastSetup(s);
    setSelected(null);
    local.start(s, theme.decks); // kartu kustom tema JSON (kalau ada)
    setScreen('game');
  };

  const allThemes = [...custom, ...THEMES];

  return (
    <div className="app" style={{ ['--dock-h' as string]: `${dockH || 200}px` }}>
      <div className="scene">
        {flat ? (
          screen === 'game' ? (
            <Board2D state={state} theme={theme} selected={selected} hovered={hovered} onTile={setSelected} onHover={setHovered} bottomInset={dockH} stepMs={220 / speed} />
          ) : (
            <div className="scene-loading" style={{ background: `linear-gradient(${theme.visual.sky[0]}, ${theme.visual.sky[1]})` }} aria-hidden />
          )
        ) : (
        <SceneGuard>
        <Suspense fallback={<div className="scene-loading" aria-hidden />}>
          <GameScene
            state={screen === 'game' ? state : null}
            theme={theme}
            selected={selected}
            hovered={hovered}
            onTile={setSelected}
            onHover={setHovered}
            rollKey={rollKey}
            stepMs={220 / speed}
            camMode={screen === 'game' ? camMode : 'free'}
            bottomInset={dockH}
            idle={screen !== 'game'}
            onLowFps={() => !lowFpsSeen() && setLowFps(true)}
          />
        </Suspense>
        </SceneGuard>
        )}
      </div>

      {screen === 'game' && state && (
        <Hud
          state={state}
          theme={theme}
          me={mode === 'online' ? online.me : null}
          spectator={mode === 'online' && !!online.watching}
          send={mode === 'online' ? online.send : local.send}
          selected={selected}
          setSelected={setSelected}
          hovered={hovered}
          onQuit={quit}
          onRematch={
            mode === 'online'
              ? online.room?.seats.find((s) => s.id === online.me)?.host
                ? () => online.raw({ t: 'rematch' })
                : undefined
              : state
              ? () =>
                  startLocal(
                    lastSetup ?? {
                      // game hasil "Lanjutkan" tidak punya setup → susun ulang dari state
                      players: state.players.map((p) => ({ id: p.id, name: p.name, color: p.color, token: p.token, bot: p.bot })),
                      botLevel: local.level,
                      rules: state.options,
                    },
                  )
              : undefined
          }
          rematchNote={mode === 'online' ? t('Menunggu host memulai ulang…') : undefined}
          camMode={camMode}
          setCamMode={setCamMode}
          speed={speed}
          setSpeed={setSpeed}
          online={
            mode === 'online'
              ? {
                  chat: online.chat,
                  sendChat: (t) => online.raw({ t: 'chat', text: t }),
                  emotes: online.emotes,
                  sendEmote: (e) => online.raw({ t: 'emote', e }),
                  timer: online.timer,
                  connected: online.status === 'open',
                  spectators: online.room?.spectators ?? 0,
                }
              : undefined
          }
        />
      )}

      {screen !== 'game' && (
        <div className="overlay">
          {screen === 'landing' && (
            <Landing
              theme={theme}
              auth={auth}
              invitedCode={roomParam()}
              onLogin={() => setAuthDialog({})}
              onGuest={() => (auth.playAsGuest(), afterEnter())}
            />
          )}

          {screen === 'menu' && (
            <div className="menu">
              {!OFFLINE && (
                <UserChip
                  auth={auth}
                  social={social}
                  onLogin={() => setAuthDialog({})}
                  onProfile={() => auth.user && setProfile(auth.user.username)}
                  onFriends={() => setScreen('friends')}
                  onAccount={() => (void auth.reloadMe(), setDialog('account'))}
                  onLeaderboard={() => setScreen('leaderboard')}
                  onReports={() => setDialog('reports')}
                  onHome={() => setScreen('landing')}
                />
              )}
              <div className="brand">
                <span className="eyebrow">{t('Permainan papan 3D')}</span>
                <h1 className="logo">MONOPOLI</h1>
                <div className="brand-sub">
                  <Flag theme={theme} size={14} /> {t('Edisi {name}', { name: t(theme.name) })}
                </div>
              </div>

              {hasSave(auth.user?.username) && (
                <button
                  className="resume-strip"
                  onClick={() => {
                    setMode('local');
                    resetBusy();
                    const t = local.resume();
                    if (t === null) return onError(tr('Save rusak atau dari versi lain — tidak bisa dilanjutkan'));
                    if (allThemes.some((x) => x.id === t)) setThemeId(t);
                    setScreen('game');
                  }}
                >
                  <span className="resume-icon">
                    <RotateCcw size={18} />
                  </span>
                  <span className="resume-text">
                    <b>{t('Game lokal terakhir')}</b>
                    <span>{t('Tersimpan otomatis — main lagi dari giliran terakhir')}</span>
                  </span>
                  <span className="resume-go">
                    <Play size={16} /> {t('Lanjutkan')}
                  </span>
                </button>
              )}

              <div className="menu-main">
                <button className="mode-card mode-local" onClick={() => setScreen('local')}>
                  <span className="mode-icon">
                    <Gamepad2 size={28} />
                  </span>
                  <span className="mode-text">
                    <b>{t('Main lokal')}</b>
                    <span>{t('Lawan bot atau teman di satu perangkat')}</span>
                  </span>
                  <ChevronRight className="mode-arrow" size={22} />
                </button>
                <button className="mode-card mode-online" disabled={OFFLINE} title={OFFLINE ? t('Butuh server game — tersedia saat dijalankan dengan npm run dev') : undefined} onClick={() => setScreen('online')}>
                  <span className="mode-icon">
                    <Globe size={28} />
                  </span>
                  <span className="mode-text">
                    <b>{t('Main online')}</b>
                    <span>{OFFLINE ? t('Butuh server — jalankan game di komputermu') : t('Buat, gabung, atau tonton room')}</span>
                  </span>
                  <ChevronRight className="mode-arrow" size={22} />
                </button>
              </div>

              <div className="menu-sub">
                {!OFFLINE && (
                  <button className="sub-card sub-friends" onClick={() => (auth.user ? setScreen('friends') : needLogin('Masuk dengan akun untuk menambah teman, melihat siapa yang online, dan mengundang ke room.'))}>
                    <span className="sub-icon">
                      <Users size={20} />
                      {social.incoming.length + social.unreadTotal > 0 && <span className="badge">{social.incoming.length + social.unreadTotal}</span>}
                    </span>
                    <span className="sub-text">
                      <b>{t('Teman')}</b>
                      <span>{auth.user ? t('{n} online', { n: social.friends.filter((f) => f.online).length }) : t('Masuk dulu')}</span>
                    </span>
                  </button>
                )}
                {!OFFLINE && (
                  <button className="sub-card sub-rank" onClick={() => setScreen('leaderboard')}>
                    <span className="sub-icon">
                      <Medal size={20} />
                    </span>
                    <span className="sub-text">
                      <b>{t('Peringkat')}</b>
                      <span>{t('Level & juara')}</span>
                    </span>
                  </button>
                )}
                <button className="sub-card sub-themes" onClick={() => setScreen('themes')}>
                  <span className="sub-icon">
                    <Palette size={20} />
                  </span>
                  <span className="sub-text">
                    <b>{t('Studio tema')}</b>
                    <span>{t('Buat tema sendiri')}</span>
                  </span>
                </button>
              </div>

              <div className="panel theme-strip">
                <span className="eyebrow">{t('Pilih tema')}</span>
                <ThemePicker themes={allThemes} value={themeId} onChange={setThemeId} />
              </div>

              <div className="menu-foot">
                <button className="btn ghost" onClick={() => setModal('settings')}>
                  <Settings size={16} /> {t('Pengaturan')}
                </button>
                <button className="btn ghost" onClick={() => setModal('help')}>
                  <BookOpen size={16} /> {t('Cara bermain')}
                </button>
              </div>

              <div className="menu-legal muted small">
                <LegalLinks />
              </div>
            </div>
          )}

          {screen === 'local' && <LocalSetup theme={theme} onBack={() => setScreen('menu')} onStart={startLocal} />}

          {screen === 'online' && (
            <OnlineLobby
              online={online}
              themes={allThemes}
              themeId={themeId}
              custom={custom}
              auth={auth}
              social={social}
              onLogin={needLogin}
              onProfile={setProfile}
              onWatch={watchRoom}
              onBack={() => (online.leave(), setScreen('menu'))}
              onEnter={() => setMode('online')}
            />
          )}

          {screen === 'friends' && auth.user && <FriendsPage social={social} onBack={() => setScreen('menu')} onJoin={joinRoom} onWatch={watchRoom} onProfile={setProfile} onChat={setDmWith} onError={onError} />}
          {screen === 'leaderboard' && <LeaderboardPage me={auth.user} onBack={() => setScreen('menu')} onProfile={setProfile} onError={onError} />}

          {screen === 'themes' && (
            <ThemeStudio
              custom={custom}
              onSave={(list) => {
                setCustom(list);
                setJSON(CUSTOM_KEY, list);
              }}
              onUse={(id) => {
                setThemeId(id);
                setScreen('menu');
              }}
              onBack={() => setScreen('menu')}
              onError={onError}
            />
          )}
        </div>
      )}

      {modal === 'settings' && (
        <Modal title={t('Pengaturan')} icon={<Settings size={20} />} onClose={() => setModal(null)}>
          <SettingsBody camMode={camMode} setCamMode={setCamMode} speed={speed} setSpeed={setSpeed} />
        </Modal>
      )}
      {modal === 'help' && (
        <HelpDialog
          theme={theme}
          onClose={() => setModal(null)}
          onPractice={() => {
            setModal(null);
            setTipsOn(true); // tampilkan ulang semua tips dari awal
            startLocal({
              players: [
                { id: 'p0', name: auth.user?.displayName ?? t('Kamu'), color: auth.user?.color ?? COLORS[0], token: auth.user?.token ?? 0, bot: false },
                { id: 'p1', name: 'Bot Budi', color: COLORS.find((c) => c !== (auth.user?.color ?? COLORS[0]))!, token: 1, bot: true },
              ],
              botLevel: 'easy',
              rules: sanitizeOptions({}),
            });
          }}
        />
      )}

      {authDialog && (
        <AuthDialog
          auth={auth}
          reason={authDialog.reason}
          onClose={() => setAuthDialog(null)}
          onDone={(created) => {
            setAuthDialog(null);
            if (created) setTimeout(() => onError(t('Akun baru dibuat. Ganti nama tampilan & bidakmu di menu Profil.')), 300);
            if (screen === 'landing') afterEnter();
          }}
        />
      )}
      {profile && <ProfileDialog username={profile} auth={auth} social={social} theme={theme} onClose={() => setProfile(null)} onError={onError} onChat={setDmWith} />}
      {dialog === 'account' && <AccountDialog auth={auth} onClose={() => setDialog(null)} onNotice={onError} />}
      {dialog === 'reports' && <ReportsDialog onClose={() => setDialog(null)} onProfile={setProfile} onError={onError} />}
      {dmWith && auth.user && <DmDialog social={social} me={auth.user} username={dmWith} onClose={() => setDmWith(null)} onError={onError} />}
      <InviteToasts social={social} onJoin={joinRoom} />

      {lowFps && !flat && screen === 'game' && (
        <div className="lowfps panel" role="alert">
          <span className="grow">{t('Papan 3D terasa tersendat di perangkat ini. Pakai papan 2D yang lebih ringan?')}</span>
          <button className="btn sm primary" onClick={() => (setBoard2d(true), setLowFps(false), markLowFpsSeen())}>
            {t('Pakai 2D')}
          </button>
          <button className="btn sm ghost" onClick={() => (setLowFps(false), markLowFpsSeen())}>
            {t('Tetap 3D')}
          </button>
        </div>
      )}

      <ConfirmHost />

      {toast && (
        <div className="toast" role="alert">
          {tr(toast)}
        </div>
      )}
    </div>
  );
}

/** Scene 3D gagal (WebGL rusak / kehabisan memori GPU) → aplikasi tetap jalan dengan papan 2D. */
class SceneGuard extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(e: Error) {
    reportClientError(`scene 3D: ${e.message}`, e.stack);
    markSceneCrashed();
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}

function ThemePicker({ themes, value, onChange }: { themes: Theme[]; value: string; onChange: (id: string) => void }) {
  return (
    <div className="theme-grid">
      {themes.map((t) => (
        <button
          key={t.id}
          className={`theme-tile ${t.id === value ? 'on' : ''}`}
          aria-pressed={t.id === value}
          onClick={() => onChange(t.id)}
          title={tr(t.description)}
          style={{ ['--a' as string]: t.visual.accent, ['--s1' as string]: t.visual.sky[0], ['--s2' as string]: t.visual.sky[1] }}
        >
          <div className="theme-tile-header">
            <span className="theme-flag"><Flag theme={t} /></span>
            <span className="theme-name">{tr(t.name)}</span>
          </div>
          <span className="theme-dots">
            {t.groupColors.slice(0, 8).map((c) => (
              <i key={c} style={{ background: c }} />
            ))}
          </span>
        </button>
      ))}
    </div>
  );
}

function PageHead({ title, icon, onBack, sub }: { title: string; icon: JSX.Element; onBack: () => void; sub?: string }) {
  return (
    <header className="panel-head">
      <button className="icon-btn back-btn" onClick={onBack} aria-label={t('Kembali')}>
        <ArrowLeft size={18} />
      </button>
      <div className="page-head-icon">{icon}</div>
      <div className="page-head-text">
        <h2>{title}</h2>
        {sub && <div className="muted">{sub}</div>}
      </div>
    </header>
  );
}

function TokenPicker({ value, color, onChange }: { value: number; color: string; onChange: (t: number) => void }) {
  return (
    <div className="token-picker">
      {TOKEN_ICONS.map((_, k) => (
        <button key={k} className={k === value ? 'on' : ''} onClick={() => onChange(k)} title={t(TOKEN_NAMES[k])} aria-label={t(TOKEN_NAMES[k])}>
          <TokenBadge token={k} color={k === value ? color : '#64748b'} size={30} />
        </button>
      ))}
    </div>
  );
}

function ColorPicker({ value, onChange, taken = [] }: { value: string; onChange: (c: string) => void; taken?: string[] }) {
  return (
    <div className="color-picker">
      {COLORS.map((c) => (
        <button key={c} className={c === value ? 'on' : ''} disabled={taken.includes(c) && c !== value} style={{ background: c }} onClick={() => onChange(c)} aria-label={t('Warna {c}', { c })} />
      ))}
    </div>
  );
}

interface Seat {
  name: string;
  bot: boolean;
  color: string;
  token: number;
}

function LocalSetup({ theme, onBack, onStart }: { theme: Theme; onBack: () => void; onStart: (s: LocalSetupT) => void }) {
  useLang();
  const [seats, setSeats] = useState<Seat[]>(() =>
    pref('monopoli.localSeats', [
      { name: t('Kamu'), bot: false, color: COLORS[0], token: 0 },
      { name: 'Bot Budi', bot: true, color: COLORS[1], token: 1 },
      { name: 'Bot Sari', bot: true, color: COLORS[2], token: 2 },
    ]),
  );
  const [level, setLevel] = useState<BotLevel>(() => pref('monopoli.botLevel', 'normal'));
  // aturan terakhir yang dipakai diingat; versi lama (modal/pot/ronde terpisah) ikut dibaca
  const [rules, setRules] = useState<Options>(() =>
    sanitizeOptions(
      pref<Partial<Options> | null>('monopoli.rules', null) ?? {
        startCash: pref('monopoli.startCash', 1500),
        freeParkingPot: pref('monopoli.pot', false),
        doubleGo: pref('monopoli.doubleGo', false),
        maxRounds: pref('monopoli.rounds', 0),
      },
    ),
  );
  useEffect(() => setJSON('monopoli.localSeats', seats), [seats]);
  useEffect(() => setJSON('monopoli.botLevel', level), [level]);
  useEffect(() => setJSON('monopoli.rules', rules), [rules]);
  const upd = (k: number, p: Partial<Seat>) => setSeats((s) => s.map((x, i) => (i === k ? { ...x, ...p } : x)));
  const free = <T,>(all: T[], used: T[]) => all.find((x) => !used.includes(x)) ?? all[0];
  const add = (bot: boolean) =>
    setSeats((s) => [
      ...s,
      {
        name: bot ? `Bot ${free(BOT_NAMES, s.map((x) => x.name.replace('Bot ', '')))}` : t('Teman {n}', { n: s.filter((x) => !x.bot).length }),
        bot,
        color: free(COLORS, s.map((x) => x.color)),
        token: free([0, 1, 2, 3, 4, 5], s.map((x) => x.token)),
      },
    ]);
  const [editing, setEditing] = useState<number | null>(null);

  return (
    <div className="panel page">
      <PageHead title={t('Main lokal')} icon={<Gamepad2 size={22} />} onBack={onBack} sub={t('Main bergantian di perangkat ini. 2–6 pemain, campur teman dan bot.')} />

      <div className="seat-list">
        {seats.map((s, k) => (
          <div key={k} className="seat" style={{ ['--c' as string]: s.color }}>
            <button className="seat-token" onClick={() => setEditing(editing === k ? null : k)} title={t('Ganti bidak & warna')}>
              <TokenBadge token={s.token} color={s.color} size={40} />
            </button>
            <input className="input grow" value={s.name} maxLength={16} onChange={(e) => upd(k, { name: e.target.value })} aria-label={t('Nama pemain {n}', { n: k + 1 })} />
            <Seg
              value={s.bot ? 'bot' : 'human'}
              onChange={(v) => upd(k, { bot: v === 'bot', name: v === 'bot' ? `Bot ${BOT_NAMES[k % 6]}` : t('Teman {n}', { n: k }) })}
              options={[
                { v: 'human', label: <><Users size={14} /> {t('Orang')}</> },
                { v: 'bot', label: <><Bot size={14} /> Bot</> },
              ]}
            />
            <button className="icon-btn" disabled={seats.length <= 2} onClick={() => setSeats((x) => x.filter((_, i) => i !== k))} aria-label={t('Hapus pemain')}>
              <X size={16} />
            </button>
            {editing === k && (
              <div className="seat-edit">
                <div className="seat-edit-group">
                  <span className="eyebrow">{t('Pilih bidak')}</span>
                  <TokenPicker value={s.token} color={s.color} onChange={(t) => upd(k, { token: t })} />
                </div>
                <div className="seat-edit-group">
                  <span className="eyebrow">{t('Pilih warna')}</span>
                  <ColorPicker value={s.color} onChange={(c) => upd(k, { color: c })} taken={seats.map((x) => x.color)} />
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
      {seats.length < 6 && (
        <div className="row">
          <button className="btn" onClick={() => add(false)}>
            <UserPlus size={16} /> {t('Tambah teman')}
          </button>
          <button className="btn" onClick={() => add(true)}>
            <Bot size={16} /> {t('Tambah bot')}
          </button>
        </div>
      )}

      <div className="form grid2">
        <Field label={t('Level bot')}>
          <Seg
            value={level}
            onChange={setLevel}
            options={[
              { v: 'easy', label: t('Mudah') },
              { v: 'normal', label: t('Normal') },
              { v: 'hard', label: t('Sulit') },
            ]}
          />
        </Field>
      </div>
      <RulesForm rules={rules} theme={theme} onChange={(p) => setRules((r) => sanitizeOptions({ ...r, ...p }))} />

      <button
        className="btn primary lg block"
        disabled={!seats.some((s) => !s.bot)}
        onClick={() =>
          onStart({
            players: seats.map((s, k): NewPlayer => ({ id: `p${k}`, name: s.name.trim() || t('Pemain {n}', { n: k + 1 }), color: s.color, token: s.token, bot: s.bot })),
            botLevel: level,
            rules,
          })
        }
      >
        <Play size={18} /> {t('Mulai permainan')}
      </button>
    </div>
  );
}

function OnlineLobby({
  online,
  themes,
  themeId,
  custom,
  auth,
  social,
  onLogin,
  onProfile,
  onWatch,
  onBack,
  onEnter,
}: {
  online: ReturnType<typeof useOnline>;
  themes: Theme[];
  themeId: string;
  custom: Theme[];
  auth: Auth;
  social: Social;
  onLogin: (reason: string) => void;
  onProfile: (username: string) => void;
  onWatch: (code: string) => void;
  onBack: () => void;
  onEnter: () => void;
}) {
  useLang();
  const me = auth.user;
  const [guestName, setName] = useState<string>(() => pref('monopoli.name', ''));
  // pemain berakun memakai nama tampilan akunnya; tamu mengetik nama
  const name = me?.displayName ?? guestName;
  const [token, setToken] = useState<number>(() => me?.token ?? pref('monopoli.token', 0));
  const [color, setColor] = useState<string>(() => me?.color ?? pref('monopoli.color', COLORS[0]));
  const [inviting, setInviting] = useState(false);
  const [roomName, setRoomName] = useState<string>(() => pref('monopoli.roomName', ''));
  const [isPublic, setIsPublic] = useState<boolean>(() => pref('monopoli.roomPublic', true));
  const [code, setCode] = useState(() => new URLSearchParams(location.search).get('room')?.toUpperCase() ?? '');
  useEffect(() => {
    setJSON('monopoli.name', guestName);
    setJSON('monopoli.token', token);
    setJSON('monopoli.color', color);
    setJSON('monopoli.roomName', roomName);
    setJSON('monopoli.roomPublic', isPublic);
  }, [guestName, token, color, roomName, isPublic]);
  const room = online.room;
  const meSeat = room?.seats.find((s) => s.id === online.me);
  const isHost = !!meSeat?.host;

  // daftar room publik: muat saat halaman dibuka & tiap 5 detik selama belum masuk room
  const { listRooms } = online;
  useEffect(() => {
    if (room) return;
    listRooms();
    const t = setInterval(listRooms, 5000);
    return () => clearInterval(t);
  }, [room, listRooms]);

  const settings = (p: Partial<RoomSettings>) =>
    room &&
    online.raw({
      t: 'settings',
      themeId: room.themeId,
      customTheme: room.customTheme,
      botLevel: room.botLevel,
      turnSeconds: room.turnSeconds,
      ...p,
    });
  const pickTheme = (id: string) => settings({ themeId: id, customTheme: custom.find((t) => t.id === id) ?? null });
  useEffect(() => {
    if (isHost && room && !room.started && room.themeId !== themeId) pickTheme(themeId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isHost, room?.code]);
  const [copied, setCopied] = useState(false);
  const lobbyTheme = room ? room.customTheme ?? themes.find((t) => t.id === room.themeId) ?? THEMES[0] : THEMES[0];
  const join = (c: string) => {
    onEnter();
    online.connect({ t: 'join', code: c, name, color, token });
  };

  if (!room)
    return (
      <div className="panel page">
        <PageHead title={t('Main online')} icon={<Globe size={22} />} onBack={onBack} sub={t('Buat room sendiri, gabung room terbuka, tonton game yang berjalan, atau masukkan kode dari teman.')} />
        <div className="form grid2">
          {me ? (
            <Field label={t('Main sebagai')}>
              <div className="row">
                <Avatar user={me} size={36} />
                <b>{me.displayName}</b>
                <span className="muted small">@{me.username}</span>
              </div>
            </Field>
          ) : (
            <Field label={t('Nama kamu (tamu)')}>
              <input className="input" placeholder={t('Nama')} value={guestName} maxLength={16} onChange={(e) => setName(e.target.value)} />
              <button className="btn ghost sm" onClick={() => onLogin('Masuk supaya bisa mengundang teman dan hasil game tercatat di profilmu.')}>
                {t('Masuk dengan email')}
              </button>
            </Field>
          )}
          <Field label={t('Bidak & warna')}>
            <div className="row">
              <TokenPicker value={token} color={color} onChange={setToken} />
            </div>
            <ColorPicker value={color} onChange={setColor} />
          </Field>
        </div>
        {!name.trim() && <div className="notice">{t('Isi nama dulu untuk membuat atau bergabung ke room.')}</div>}
        <button
          className="btn primary lg block quick-btn"
          disabled={!name.trim()}
          onClick={() => {
            onEnter();
            online.connect({ t: 'quick', name, color, token });
          }}
        >
          <Zap size={18} /> {t('Main cepat')}
          <span className="muted small">{t('gabung room terbuka yang menunggu pemain, atau buat baru')}</span>
        </button>

        <div className="split">
          <div className="split-col">
            <span className="eyebrow">{t('Buat room baru')}</span>
            <input className="input" placeholder={name.trim() ? `Room ${name.trim()}` : t('Nama room (opsional)')} value={roomName} maxLength={32} onChange={(e) => setRoomName(e.target.value)} aria-label={t('Nama room')} />
            <Toggle on={isPublic} onChange={setIsPublic} label={isPublic ? t('Room publik') : t('Room privat')} hint={isPublic ? t('Muncul di daftar room terbuka, siapa saja bisa gabung') : t('Hanya bisa gabung lewat kode / link')} />
            <button
              className="btn primary lg block"
              disabled={!name.trim()}
              onClick={() => {
                onEnter();
                online.connect({ t: 'create', name, color, token, roomName: roomName.trim(), isPublic });
              }}
            >
              <Plus size={18} /> {t('Buat room')}
            </button>
          </div>
          <div className="split-col">
            <span className="eyebrow">{t('Punya kode?')}</span>
            <div className="row">
              <input className="input code-input grow" placeholder={t('KODE')} value={code} maxLength={5} onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))} aria-label={t('Kode room')} />
              <button className="btn primary" disabled={!name.trim() || code.length !== 5} onClick={() => join(code)}>
                {t('Gabung')}
              </button>
              <button className="btn" disabled={code.length !== 5} onClick={() => onWatch(code)} title={t('Tonton tanpa ikut main')}>
                <Eye size={16} />
              </button>
            </div>
          </div>
        </div>

        <div className="room-browser">
          <div className="row between">
            <span className="eyebrow">{t('Room terbuka')}</span>
            <button className="btn ghost sm" onClick={listRooms}>
              <RotateCcw size={14} /> {t('Muat ulang')}
            </button>
          </div>
          {online.publicRooms === null && <div className="muted small">{t('Memuat daftar room…')}</div>}
          {online.publicRooms?.length === 0 && <div className="muted small">{t('Belum ada room terbuka. Buat room baru, teman bisa langsung gabung dari daftar ini.')}</div>}
          {online.publicRooms?.map((r) => {
            const th = themes.find((x) => x.id === r.themeId) ?? getTheme(r.themeId);
            return (
              <div key={r.code} className={`room-row ${r.started ? 'live' : ''}`}>
                <Flag theme={th} size={16} />
                <div className="grow">
                  <b className="truncate">{r.name}</b>
                  <div className="muted small">
                    {t('Host {name}', { name: r.host })} · {tr(r.themeName)} · {t('modal {m}', { m: formatMoney(th, r.startCash) })} · {r.maxRounds ? t('{n} ronde', { n: r.maxRounds }) : t('sampai bangkrut')} ·{' '}
                    {r.houseRules ? t('{n} aturan rumah', { n: r.houseRules }) : t('aturan resmi')}
                  </div>
                </div>
                {r.started ? (
                  <>
                    <span className="chip warn">{t('Sedang main')}</span>
                    {(r.spectators ?? 0) > 0 && (
                      <span className="chip">
                        <Eye size={12} /> {r.spectators}
                      </span>
                    )}
                    <button className="btn sm" onClick={() => onWatch(r.code)}>
                      <Eye size={14} /> {t('Tonton')}
                    </button>
                  </>
                ) : (
                  <>
                    <span className="chip">
                      <Users size={12} /> {r.players}/{r.maxPlayers}
                    </span>
                    <button className="btn primary sm" disabled={!name.trim()} onClick={() => join(r.code)}>
                      {t('Gabung')}
                    </button>
                  </>
                )}
              </div>
            );
          })}
        </div>
        {online.status === 'connecting' && <div className="muted">{t('Menghubungkan…')}</div>}
      </div>
    );

  const link = `${location.origin}${location.pathname}?room=${room.code}`;
  const roomTheme = room.customTheme ?? themes.find((t) => t.id === room.themeId);
  return (
    <div className="panel page">
      <PageHead title={room.name || 'Lobby'} icon={<Users size={22} />} onBack={onBack} sub={isHost ? t('Kamu host. Atur room & aturan main lalu mulai.') : t('Menunggu host memulai permainan…')} />
      <div className="room-code">
        <span className="eyebrow">{t('Kode room')}</span>
        <b>{room.code}</b>
        <span className={`chip ${room.isPublic ? 'ok' : ''}`}>{room.isPublic ? t('Publik') : t('Privat')}</span>
        <button
          className="btn sm"
          onClick={() => {
            navigator.clipboard?.writeText(link);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          }}
        >
          <Copy size={14} /> {copied ? t('Tersalin!') : t('Salin link')}
        </button>
      </div>

      <div className="seat-list">
        {room.seats.map((s) => (
          <div key={s.id} className="seat" style={{ ['--c' as string]: s.color }}>
            <TokenBadge token={s.token} color={s.color} size={40} />
            <div className="grow">
              {s.username ? (
                <button className="link-btn" onClick={() => onProfile(s.username!)} title={t('Profil @{u}', { u: s.username! })}>
                  <b>{s.name}</b>
                </button>
              ) : (
                <b>{s.name}</b>
              )}
              {!s.bot && !s.username && <span className="chip">{t('TAMU')}</span>}
              {s.id === online.me && <span className="chip accent">{t('KAMU')}</span>}
              {s.host && <span className="chip">HOST</span>}
              {s.bot && <span className="chip">BOT</span>}
            </div>
            {!s.bot && (
              <span className={`status ${s.connected ? 'ok' : 'off'}`} title={s.connected ? t('Terhubung') : t('Terputus')}>
                {s.connected ? <Wifi size={14} /> : <WifiOff size={14} />}
              </span>
            )}
            {isHost && (
              <button className="icon-btn" disabled={s.host} style={{ visibility: s.host ? 'hidden' : undefined }} onClick={() => online.raw({ t: 'kick', seat: s.id })} aria-label={t('Keluarkan')}>
                <X size={16} />
              </button>
            )}
          </div>
        ))}
        {Array.from({ length: Math.max(0, room.maxPlayers - room.seats.length) }, (_, k) => (
          <div key={`e${k}`} className="seat empty">
            {t('Kursi kosong — menunggu pemain…')}
          </div>
        ))}
      </div>

      <div className="row wrap">
        {me ? (
          <button className="btn" disabled={room.seats.length >= room.maxPlayers} onClick={() => (social.refresh(), setInviting(true))}>
            <Send size={16} /> {t('Undang teman')}
          </button>
        ) : (
          <button className="btn ghost" onClick={() => onLogin('Masuk dengan akun untuk mengundang teman ke room ini.')}>
            <Send size={16} /> {t('Masuk untuk undang teman')}
          </button>
        )}
        {isHost && (
          <button className="btn" disabled={room.seats.length >= room.maxPlayers} onClick={() => online.raw({ t: 'addBot' })}>
            <Bot size={16} /> {t('Tambah bot')}
          </button>
        )}
      </div>
      {inviting && <InviteDialog social={social} inRoom={room.seats.map((s) => s.username ?? '')} onInvite={(u) => online.raw({ t: 'invite', username: u })} onClose={() => setInviting(false)} />}

      {isHost ? (
        <>
          <div className="form grid2">
            <Field label={t('Nama room')}>
              <input className="input" defaultValue={room.name} maxLength={32} onBlur={(e) => e.target.value.trim() && e.target.value.trim() !== room.name && settings({ name: e.target.value.trim() })} />
            </Field>
            <Field label={t('Siapa yang bisa gabung')}>
              <Seg
                value={room.isPublic ? 'pub' : 'priv'}
                onChange={(v) => settings({ isPublic: v === 'pub' })}
                options={[
                  { v: 'pub', label: t('Publik') },
                  { v: 'priv', label: t('Privat (kode)') },
                ]}
              />
            </Field>
            <Field label={t('Jumlah kursi')}>
              <Seg value={room.maxPlayers} onChange={(v) => settings({ maxPlayers: v })} options={[2, 3, 4, 5, 6].map((n) => ({ v: n, label: String(n) }))} />
            </Field>
            <Field label={t('Level bot')}>
              <Seg
                value={room.botLevel}
                onChange={(v) => settings({ botLevel: v })}
                options={[
                  { v: 'easy', label: t('Mudah') },
                  { v: 'normal', label: t('Normal') },
                  { v: 'hard', label: t('Sulit') },
                ]}
              />
            </Field>
            <Field label={t('Batas waktu per aksi')}>
              <Seg value={room.turnSeconds} onChange={(v) => settings({ turnSeconds: v })} options={TURN_SECONDS.map((n) => ({ v: n as number, label: n ? t('{n} dtk', { n }) : t('Mati') }))} />
            </Field>
          </div>
          {room.turnSeconds === 0 && <div className="muted small">{t('Tanpa timer: pemain yang koneksinya putus tetap dimainkan otomatis (aksi aman) setelah 15 detik.')}</div>}
          <RulesForm rules={room.rules} theme={lobbyTheme} onChange={(p) => settings({ rules: p })} />
          <Field label={t('Tema')}>
            <ThemePicker themes={themes} value={room.customTheme?.id ?? room.themeId} onChange={pickTheme} />
          </Field>
          <button className="btn primary lg block" disabled={room.seats.length < 2} onClick={() => online.raw({ t: 'start' })}>
            <Play size={18} /> {t('Mulai permainan')}
          </button>
        </>
      ) : (
        <>
          <div className="notice">
            {tj('Tema: {theme}', { theme: <b>{roomTheme ? tr(roomTheme.name) : room.themeId}</b> })} · Bot {t(room.botLevel === 'easy' ? 'Mudah' : room.botLevel === 'hard' ? 'Sulit' : 'Normal')} ·{' '}
            {room.turnSeconds ? t('{n} dtk/aksi', { n: room.turnSeconds }) : t('tanpa timer')} · {t('{n}/{max} pemain', { n: room.seats.length, max: room.maxPlayers })}
          </div>
          <RulesSummary rules={room.rules} theme={lobbyTheme} />
        </>
      )}
    </div>
  );
}

// ================= Studio tema =================

type Tab = 'info' | 'tiles' | 'look' | 'cards' | 'json';
const STYLES: Theme['visual']['buildings'][] = ['tropical', 'modern', 'classic', 'onion', 'pagoda', 'ninja'];
const STYLE_LABEL: Record<string, string> = { tropical: 'Tropis', modern: 'Modern', classic: 'Klasik Eropa', onion: 'Kubah bawang', pagoda: 'Pagoda', ninja: 'Desa ninja' };
const LANDMARK_LABEL: Record<string, string> = {
  coin: '🪙 Tugu Koin',
  monas: '🗼 Monas',
  liberty: '🗽 Patung Liberty',
  basil: '⛪ Katedral St. Basil',
  pagoda: '⛩️ Pagoda & Torii',
  bigben: '🕰️ Big Ben',
  castle: '🏯 Kastil ninja',
  eiffel: '🗼 Menara Eiffel',
  pyramid: '🔺 Piramida',
  skyscraper: '🏙️ Gedung pencakar langit',
};

function ThemeStudio({ custom, onSave, onUse, onBack, onError }: { custom: Theme[]; onSave: (l: Theme[]) => void; onUse: (id: string) => void; onBack: () => void; onError: (m: string) => void }) {
  useLang();
  const [draft, setDraft] = useState<Theme | null>(null);
  const [tab, setTab] = useState<Tab>('info');
  const [json, setJson] = useState('');

  const startFrom = (base: Theme) => {
    const n = custom.filter((th) => th.id.startsWith(base.id)).length + 1;
    setDraft(structuredClone({ ...base, id: `${base.id.replace(/-kustom-?\d*$/, '')}-kustom-${n}`, name: t('{name} Kustom', { name: tr(base.name) }), flag: '⭐' }));
    setTab('info');
  };
  const save = (th: Theme) => {
    const errs = validateTheme(th);
    if (errs.length) return onError(errs.join(' · '));
    if (THEMES.some((x) => x.id === th.id || (th.id === 'konoha' && x.id === 'ninja'))) return onError(t('ID sudah dipakai tema bawaan — ganti ID'));
    onSave([th, ...custom.filter((x) => x.id !== th.id)]);
    onUse(th.id);
  };
  const download = (th: Theme) => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([JSON.stringify(th, null, 2)], { type: 'application/json' }));
    a.download = `tema-${th.id}.json`;
    a.click();
  };
  const up = (p: Partial<Theme>) => setDraft((d) => (d ? { ...d, ...p } : d));
  const upList = (key: 'properties' | 'stations' | 'utilities' | 'taxes', k: number, v: string) =>
    setDraft((d) => (d ? { ...d, [key]: d[key].map((x, i) => (i === k ? v : x)) } : d));

  if (!draft)
    return (
      <div className="panel page wide">
        <PageHead title={t('Studio tema')} icon={<Palette size={22} />} onBack={onBack} sub={t('Bikin versi negaramu, kota kamu, atau dunia anime/kartun favorit.')} />
        <span className="eyebrow">{t('Mulai dari tema')}</span>
        <div className="theme-grid">
          {THEMES.map((th) => (
            <button key={th.id} className="theme-tile" onClick={() => startFrom(th)} style={{ ['--a' as string]: th.visual.accent, ['--s1' as string]: th.visual.sky[0], ['--s2' as string]: th.visual.sky[1] }}>
              <span className="theme-flag"><Flag theme={th} /></span>
              <span className="theme-name">{tr(th.name)}</span>
              <span className="theme-dots">
                {th.groupColors.map((c) => (
                  <i key={c} style={{ background: c }} />
                ))}
              </span>
            </button>
          ))}
        </div>
        <div className="row">
        <label className="btn grow">
          <Upload size={16} /> {t('Impor file tema (.json)')}
          <input
            type="file"
            accept=".json,application/json"
            hidden
            onChange={async (e) => {
              const f = e.target.files?.[0];
              if (!f || f.size > 100_000) return onError(t('File terlalu besar / tidak ada'));
              try {
                const th = JSON.parse(await f.text());
                const errs = validateTheme(th);
                if (errs.length) return onError(errs.join(' · '));
                setDraft(th);
              } catch {
                onError(t('File bukan JSON yang valid'));
              }
            }}
          />
        </label>
        <button className="btn" onClick={() => download(sampleTheme())} title={t('Contoh tema lengkap dengan kartu & efek buatan sendiri')}>
          <Download size={16} /> {t('Unduh contoh JSON')}
        </button>
        </div>
        {custom.length > 0 && (
          <>
            <span className="eyebrow">{t('Tema kustom kamu')}</span>
            <div className="seat-list">
              {custom.map((th) => (
                <div key={th.id} className="seat" style={{ ['--c' as string]: th.visual.accent }}>
                  <span className="theme-flag"><Flag theme={th} /></span>
                  <b className="grow">{th.name}</b>
                  <button className="btn sm primary" onClick={() => onUse(th.id)}>
                    <Play size={14} /> {t('Pakai')}
                  </button>
                  <button className="icon-btn" onClick={() => (setDraft(structuredClone(th)), setTab('info'))} aria-label={t('Ubah')}>
                    <Pencil size={16} />
                  </button>
                  <button className="icon-btn" onClick={() => download(th)} aria-label={t('Ekspor')}>
                    <Download size={16} />
                  </button>
                  <button className="icon-btn" onClick={async () => (await askConfirm(t('Hapus tema {name}?', { name: th.name }), { ok: t('Hapus'), danger: true })) && onSave(custom.filter((x) => x.id !== th.id))} aria-label={t('Hapus')}>
                    <Trash size={16} />
                  </button>
                </div>
              ))}
            </div>
          </>
        )}
        <p className="muted small">{t('Tema anime/kartun sebaiknya pakai nama parodi atau fan-made, tanpa logo atau gambar resmi, kalau game mau dipublikasikan.')}</p>
      </div>
    );

  return (
    <div className="panel page wide">
      <PageHead title={draft.name} icon={<Palette size={22} />} onBack={() => setDraft(null)} sub={t('Ubah lalu simpan. Papan di belakang langsung memakai tema ini setelah disimpan.')} />
      <Seg
        value={tab}
        onChange={(th) => {
          if (th === 'json') setJson(JSON.stringify(draft, null, 2));
          setTab(th);
        }}
        options={[
          { v: 'info', label: t('Identitas') },
          { v: 'tiles', label: t('Nama petak') },
          { v: 'look', label: t('Tampilan') },
          { v: 'cards', label: t('Kartu & efek') },
          { v: 'json', label: 'JSON' },
        ]}
      />

      {tab === 'info' && (
        <div className="form grid2">
          <Field label={t('Nama tema')}>
            <input className="input" value={draft.name} maxLength={40} onChange={(e) => up({ name: e.target.value })} />
          </Field>
          <Field label={t('Ikon / emoji')}>
            <input className="input" value={draft.flag} maxLength={4} onChange={(e) => up({ flag: e.target.value })} />
          </Field>
          <Field label={t('ID (huruf kecil, angka, -)')}>
            <input className="input" value={draft.id} maxLength={40} onChange={(e) => up({ id: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') })} />
          </Field>
          <Field label={t('Deskripsi')}>
            <input className="input" value={draft.description} maxLength={120} onChange={(e) => up({ description: e.target.value })} />
          </Field>
          <Field label={t('Simbol uang')}>
            <input className="input" value={draft.currency.symbol} maxLength={4} onChange={(e) => up({ currency: { ...draft.currency, symbol: e.target.value } })} />
          </Field>
          <Field label={t('Nilai 1 satuan permainan (modal awal = 1.500 satuan)')}>
            <Seg
              value={draft.currency.multiplier}
              onChange={(v) => up({ currency: { ...draft.currency, multiplier: v } })}
              options={[1, 10, 100, 1_000, 10_000, 100_000, 1_000_000].map((v) => ({ v, label: new Intl.NumberFormat('id-ID', { notation: 'compact' }).format(v) }))}
            />
          </Field>
          <Field label={t('Cara menulis uang')}>
            <div className="toggles">
              <Toggle
                on={!!draft.currency.compact}
                onChange={(v) => up({ currency: { ...draft.currency, compact: v || undefined, suffix: v ? undefined : draft.currency.suffix } })}
                label={t('Ringkas (jt / M / K)')}
                hint={t('Rp400 jt, bukan Rp400.000.000')}
              />
              <Toggle on={!!draft.currency.symbolAfter} onChange={(v) => up({ currency: { ...draft.currency, symbolAfter: v || undefined } })} label={t('Simbol di belakang angka')} hint={t('Contoh: 40 млн ₽')} />
            </div>
          </Field>
          {!draft.currency.compact && (
            <Field label={t('Akhiran uang (opsional)')}>
              <input className="input" value={draft.currency.suffix ?? ''} maxLength={6} onChange={(e) => up({ currency: { ...draft.currency, suffix: e.target.value || undefined } })} />
            </Field>
          )}
          <Field label={t('Kode bahasa angka (locale)')}>
            <input className="input" value={draft.currency.locale} maxLength={12} onChange={(e) => up({ currency: { ...draft.currency, locale: e.target.value.replace(/[^A-Za-z-]/g, '') || 'id-ID' } })} />
          </Field>
          <div className="notice">
            {t('Contoh: modal {a} · petak termurah {b} · termahal {c} · gaji START {d} · sewa hotel termahal {e}', { a: formatMoney(draft, 1500), b: formatMoney(draft, 60), c: formatMoney(draft, 400), d: formatMoney(draft, 200), e: formatMoney(draft, 2000) })}
          </div>
          {(['go', 'jail', 'parking', 'gotojail'] as const).map((k) => (
            <Field key={k} label={t({ go: 'Petak START', jail: 'Penjara', parking: 'Parkir bebas', gotojail: 'Masuk penjara' }[k])}>
              <input className="input" value={draft.corners[k]} maxLength={40} onChange={(e) => up({ corners: { ...draft.corners, [k]: e.target.value } })} />
            </Field>
          ))}
          <Field label={t('Nama kartu Kesempatan')}>
            <input className="input" value={draft.deckNames.chance} maxLength={30} onChange={(e) => up({ deckNames: { ...draft.deckNames, chance: e.target.value } })} />
          </Field>
          <Field label={t('Nama kartu Dana Umum')}>
            <input className="input" value={draft.deckNames.community} maxLength={30} onChange={(e) => up({ deckNames: { ...draft.deckNames, community: e.target.value } })} />
          </Field>
        </div>
      )}

      {tab === 'tiles' && (
        <div className="tile-editor">
          {Array.from({ length: 8 }, (_, g) => {
            const idx = g === 0 || g === 7 ? 2 : 3;
            const start = [0, 2, 5, 8, 11, 14, 17, 20][g];
            return (
              <div key={g} className="tile-group" style={{ ['--c' as string]: draft.groupColors[g] }}>
                <label className="tile-group-head">
                  <span className="eyebrow">{t('Kompleks {g}', { g: g + 1 })}</span>
                  <input type="color" value={draft.groupColors[g]} onChange={(e) => up({ groupColors: draft.groupColors.map((c, i) => (i === g ? e.target.value : c)) })} aria-label={t('Warna kompleks {g}', { g: g + 1 })} title={t('Ganti warna')} />
                </label>
                {Array.from({ length: idx }, (_, k) => (
                  <input key={k} className="input" value={draft.properties[start + k]} maxLength={24} aria-label={t('Kompleks {g} petak {k}', { g: g + 1, k: k + 1 })} onChange={(e) => upList('properties', start + k, e.target.value)} />
                ))}
              </div>
            );
          })}
          <div className="tile-group" style={{ ['--c' as string]: '#475569' }}>
            <span className="eyebrow">{t('Transportasi')}</span>
            {draft.stations.map((s, k) => (
              <input key={k} className="input" value={s} maxLength={40} onChange={(e) => upList('stations', k, e.target.value)} />
            ))}
          </div>
          <div className="tile-group" style={{ ['--c' as string]: '#64748b' }}>
            <span className="eyebrow">{t('Utilitas & pajak')}</span>
            {draft.utilities.map((s, k) => (
              <input key={k} className="input" value={s} maxLength={40} onChange={(e) => upList('utilities', k, e.target.value)} />
            ))}
            {draft.taxes.map((s, k) => (
              <input key={`t${k}`} className="input" value={s} maxLength={40} onChange={(e) => upList('taxes', k, e.target.value)} />
            ))}
          </div>
        </div>
      )}

      {tab === 'look' && (
        <div className="form grid2">
          <Field label={t('Gaya bangunan sekitar')}>
            <div className="chips">
              {STYLES.map((s) => (
                <button key={s} className={`chip-btn ${draft.visual.buildings === s ? 'on' : ''}`} onClick={() => up({ visual: { ...draft.visual, buildings: s } })}>
                  {t(STYLE_LABEL[s])}
                </button>
              ))}
            </div>
          </Field>
          <Field label={t('Ikon tengah papan')}>
            <div className="chips">
              {LANDMARKS.map((k) => (
                <button key={k} className={`chip-btn ${(draft.visual.landmark ?? 'coin') === k ? 'on' : ''}`} onClick={() => up({ visual: { ...draft.visual, landmark: k } })}>
                  {t(LANDMARK_LABEL[k])}
                </button>
              ))}
            </div>
          </Field>
          {(
            [
              ['accent', 'Warna aksen'],
              ['boardCenter', 'Logo tengah & tepi papan'],
              ['board', 'Warna papan'],
              ['table', 'Warna meja'],
              ['fog', 'Tanah & kabut'],
              ['lightColor', 'Warna cahaya'],
            ] as const
          ).map(([k, label]) => (
            <Field key={k} label={t(label)}>
              <input type="color" className="color-input" value={draft.visual[k]} onChange={(e) => up({ visual: { ...draft.visual, [k]: e.target.value } })} />
            </Field>
          ))}
          <Field label={t('Langit atas')}>
            <input type="color" className="color-input" value={draft.visual.sky[0]} onChange={(e) => up({ visual: { ...draft.visual, sky: [e.target.value, draft.visual.sky[1]] } })} />
          </Field>
          <Field label={t('Langit bawah')}>
            <input type="color" className="color-input" value={draft.visual.sky[1]} onChange={(e) => up({ visual: { ...draft.visual, sky: [draft.visual.sky[0], e.target.value] } })} />
          </Field>
          <Field label={t('Nama bidak (6)')}>
            <div className="chips">
              {draft.tokens.map((th, k) => (
                <input key={k} className="input sm" value={th} maxLength={20} onChange={(e) => up({ tokens: draft.tokens.map((x, i) => (i === k ? e.target.value : x)) })} />
              ))}
            </div>
          </Field>
        </div>
      )}

      {tab === 'cards' && <ThemeCards draft={draft} up={up} />}

      {tab === 'json' && (
        <>
          <textarea className="input code" value={json} onChange={(e) => setJson(e.target.value)} spellCheck={false} />
          <button
            className="btn"
            onClick={() => {
              try {
                setDraft(JSON.parse(json));
              } catch (e) {
                onError(t('JSON tidak valid: {err}', { err: (e as Error).message }));
              }
            }}
          >
            {t('Terapkan JSON')}
          </button>
        </>
      )}

      <div className="row end">
        <button className="btn ghost" onClick={() => download(draft)}>
          <Download size={16} /> {t('Ekspor')}
        </button>
        <button className="btn ghost" onClick={() => setDraft(null)}>
          {t('Batal')}
        </button>
        <button className="btn primary" onClick={() => save(draft)}>
          {t('Simpan & pakai')}
        </button>
      </div>
    </div>
  );
}
