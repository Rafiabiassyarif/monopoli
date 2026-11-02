// HUD dalam game. Semua panel memakai primitive yang sama (panel, btn, chip, seg) supaya konsisten.

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowRightLeft,
  Banknote,
  BookOpen,
  Building,
  Camera,
  ChartNoAxesColumn,
  Check,
  Dices,
  Eye,
  Gavel,
  GraduationCap,
  Hotel,
  House,
  KeyRound,
  Landmark,
  Languages,
  LockOpen,
  LogOut,
  MessageCircle,
  Music,
  Play,
  ScrollText,
  Send,
  Settings,
  Skull,
  Sparkles,
  Trophy,
  Volume2,
  VolumeX,
  Wallet,
  X,
} from 'lucide-react';
import { getCityInfo } from './cityLandmarks';
import {
  BOARD,
  CHANCE,
  COMMUNITY,
  EMOTES,
  GROUP_COUNT,
  actorId,
  bankruptBlock,
  canBuild,
  canMortgage,
  canSell,
  canUnmortgage,
  cardText,
  formatMoney,
  groupTiles,
  isOwnable,
  mortgageValue,
  netWorth,
  ownsGroup,
  quipsFor,
  ranking,
  bankStock,
  DEFAULT_OPTIONS,
  type Options,
  buildBlock,
  tradeInterest,
  maxBid,
  rentFor,
  tileName,
  unmortgageCost,
  type Action,
  type GameEvent,
  type GameState,
  type Theme,
} from '@monopoli/engine';
import { isMuted, setMuted, sfx } from './sfx';
import { musicOn, musicVolume, setMusicOn, setMusicVolume } from './music';
import { playTileAnim, setTileAnimOn, tileAnimAt, tileAnimOn } from './tileAnims';
import { markTip, pickTip, setTipsOn, tipsOn } from './tips';
import { can3d, setBoard2d, useBoard2d } from './boardMode';
import { useFxIdle } from './scene/busy';
import { t, tj, tr, useLang } from './i18n';
import { LangSwitch } from './Social';
import { Flag, Modal, MoneyInput, Seg, TokenBadge, askConfirm } from './ui';
import type { CamMode } from './scene/Scene';

interface Props {
  state: GameState;
  theme: Theme;
  /** id pemain di perangkat ini. null = hot-seat (semua manusia bergantian) */
  me: string | null;
  /** menonton game online orang lain: hanya melihat, tidak bisa beraksi */
  spectator?: boolean;
  send: (pid: string, a: Action) => void;
  selected: number | null;
  setSelected: (i: number | null) => void;
  hovered: number | null;
  onQuit: () => void;
  onRematch?: () => void;
  /** teks saat tidak bisa memulai ulang sendiri (online, bukan host) */
  rematchNote?: string;
  camMode: CamMode;
  setCamMode: (m: CamMode) => void;
  speed: number;
  setSpeed: (n: number) => void;
  online?: {
    chat: { from: string; text: string; seat?: string }[];
    sendChat: (t: string) => void;
    emotes: { id: number; from: string; e: string }[];
    sendEmote: (e: string) => void;
    timer: { actor: string | null; deadline: number };
    connected: boolean;
    spectators: number;
  };
}

type PanelId = null | 'trade' | 'log' | 'assets' | 'settings' | 'help' | 'stats';

export function Hud(props: Props) {
  const lang = useLang();
  const { state, theme, me, send, selected, setSelected, hovered, onQuit, online, spectator } = props;
  const money = (n: number) => formatMoney(theme, n);
  const cur = state.players[state.current];
  const actor = actorId(state);
  const actorP = state.players.find((p) => p.id === actor);
  const controlling = spectator ? null : me ?? (actorP && !actorP.bot ? actorP.id : null);
  const myTurn = !!controlling && actor === controlling;
  // hot-seat: saat giliran bot, tampilkan aset manusia terakhir yang main
  const lastHuman = useRef(state.players.find((p) => !p.bot)?.id ?? cur.id);
  if (controlling) lastHuman.current = controlling;
  const viewer = me ?? (spectator ? cur.id : lastHuman.current);
  const act = (a: Action) => controlling && send(controlling, a);
  // aturan resmi: bangun/gadai/tukar boleh di antara giliran → "manager" = pemain di perangkat ini walau bukan gilirannya
  const manager = spectator ? null : me ?? viewer;
  const managerP = state.players.find((p) => p.id === manager);
  const canManageNow =
    !!managerP && !managerP.bankrupt && !state.trade && (manager === cur.id ? ['roll', 'end', 'debt'].includes(state.phase) : ['roll', 'end'].includes(state.phase));
  const actAs = (a: Action) => manager && send(manager, a);
  const [counter, setCounter] = useState(false);
  const name = (id: string | null) => (id ? state.players.find((p) => p.id === id)?.name ?? '?' : t('Bank'));
  const [panel, setPanel] = useState<PanelId>(null);
  // tombol aksi baru muncul setelah dadu berhenti, bidak sampai, dan kartu terbaca
  const idle = useFxIdle(state.seq);
  const isCurTurn = myTurn && !state.trade && state.phase !== 'auction' && idle;

  // ---------- event baru: suara, delta uang, banner giliran ----------
  const seen = useRef(state.seq);
  const [deltas, setDeltas] = useState<{ id: number; pid: string; amount: number }[]>([]);
  const [banner, setBanner] = useState<{ key: number; text: string; color: string } | null>(null);
  const [quips, setQuips] = useState<{ seq: number; player: string; text: string }[]>([]);
  useEffect(() => {
    const fresh = state.events.filter((e) => e.seq > seen.current);
    seen.current = state.seq;
    const add: { id: number; pid: string; amount: number }[] = [];
    for (const e of fresh) {
      if (e.type === 'dice') sfx('dice');
      else if (e.type === 'buy' || e.type === 'build') sfx('buy');
      else if (e.type === 'pay' && e.reason === 'rent') sfx('pay');
      else if (e.type === 'jail') sfx('jail');
      else if (e.type === 'card') sfx('card');
      else if (e.type === 'win') sfx('win');
      if (e.type === 'pay') {
        if (e.from) add.push({ id: e.seq * 2, pid: e.from, amount: -e.amount });
        if (e.to) add.push({ id: e.seq * 2 + 1, pid: e.to, amount: e.amount });
      }
      if (e.type === 'buy') add.push({ id: e.seq * 2, pid: e.player, amount: -e.price });
      if (e.type === 'turn') {
        const p = state.players.find((x) => x.id === e.player)!;
        if (me ? e.player === me : !p.bot && !spectator) sfx('turn');
        setBanner({ key: e.seq, text: me && e.player === me ? t('Giliranmu!') : t('Giliran {name}', { name: p.name }), color: p.color });
      }
    }
    if (add.length) {
      setDeltas((d) => [...d, ...add]);
      setTimeout(() => setDeltas((d) => d.filter((x) => !add.includes(x))), 1800);
    }
    const q = quipsFor(state, fresh);
    if (q.length) {
      setQuips((l) => [...l.filter((x) => !q.some((y) => y.player === x.player)), ...q]);
      setTimeout(() => setQuips((l) => l.filter((x) => !q.includes(x))), 3200);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.seq]);
  useEffect(() => {
    if (!banner) return;
    const tm = setTimeout(() => setBanner(null), 1500);
    return () => clearTimeout(tm);
  }, [banner?.key]);

  // ---------- shortcut keyboard ----------
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).closest('input,textarea,select') || panel || !isCurTurn) return;
      if (e.code === 'Space') {
        e.preventDefault();
        if (state.phase === 'roll' || state.phase === 'end') act(state.rolled ? { type: 'endTurn' } : { type: 'roll' });
      } else if (e.key.toLowerCase() === 'b' && state.phase === 'buy') act({ type: 'buy' });
      else if (e.key.toLowerCase() === 'l' && state.phase === 'buy') act({ type: 'decline' });
    };
    addEventListener('keydown', k);
    return () => removeEventListener('keydown', k);
  });

  const describe = (e: GameEvent): { icon: string; text: string } | null => {
    switch (e.type) {
      case 'dice':
        return { icon: '🎲', text: t('{name} melempar {a} + {b}', { name: name(e.player), a: e.dice[0], b: e.dice[1] }) + (e.dice[0] === e.dice[1] ? t(' — double!') : '') };
      case 'buy':
        return { icon: '🏠', text: t('{name} membeli {tile} ({price})', { name: name(e.player), tile: tileName(theme, e.tile), price: money(e.price) }) };
      case 'pay': {
        if (e.reason === 'go') return { icon: '💵', text: t('{name} menerima gaji {amount}', { name: name(e.to), amount: money(e.amount) }) };
        if (e.reason === 'pot') return { icon: '☕', text: t('{name} mengambil pot {amount}', { name: name(e.to), amount: money(e.amount) }) };
        const why = e.reason === 'rent' ? t(' (sewa)') : e.reason === 'tax' ? t(' (pajak/denda)') : e.reason === 'interest' ? t(' (bunga gadai 10%)') : '';
        return { icon: '💸', text: `${name(e.from)} → ${name(e.to)} ${money(e.amount)}${why}` };
      }
      case 'build':
        return { icon: '🏗️', text: t('{name} membangun di {tile}', { name: name(e.player), tile: tileName(theme, e.tile) }) };
      case 'sell':
        return { icon: '🔨', text: t('{name} menjual bangunan di {tile}', { name: name(e.player), tile: tileName(theme, e.tile) }) };
      case 'mortgage':
        return { icon: '📜', text: t('{name} menggadai {tile}', { name: name(e.player), tile: tileName(theme, e.tile) }) };
      case 'unmortgage':
        return { icon: '📜', text: t('{name} menebus {tile}', { name: name(e.player), tile: tileName(theme, e.tile) }) };
      case 'jail':
        return { icon: '⛓️', text: t('{name} masuk penjara', { name: name(e.player) }) };
      case 'free':
        return { icon: '🔓', text: t('{name} bebas dari penjara', { name: name(e.player) }) };
      case 'card': {
        const c = (e.deck === 'chance' ? CHANCE : COMMUNITY).find((x) => x.id === e.card)!;
        return { icon: e.deck === 'chance' ? '❓' : '🎁', text: `${name(e.player)}: ${cardText(theme, c.id, t(c.text))}` };
      }
      case 'auction':
        return {
          icon: '🔨',
          text: e.winner
            ? t('Lelang {tile} dimenangkan {name} ({price})', { tile: tileName(theme, e.tile), name: name(e.winner), price: money(e.price) })
            : t('Lelang {tile} tanpa penawar', { tile: tileName(theme, e.tile) }),
        };
      case 'trade':
        if (e.counter) return { icon: '🤝', text: t('{a} mengajukan tawaran balik ke {b}', { a: name(e.to), b: name(e.from) }) };
        return { icon: '🤝', text: e.accepted ? t('Tukar {a} ↔ {b} diterima', { a: name(e.from), b: name(e.to) }) : t('Tukar {a} ↔ {b} ditolak', { a: name(e.from), b: name(e.to) }) };
      case 'bankrupt':
        return { icon: '💀', text: t('{name} bangkrut', { name: name(e.player) }) };
      case 'win':
        return { icon: '🏆', text: t('{name} menang!', { name: name(e.player) }) };
      default:
        return null;
    }
  };
  const log = useMemo(() => state.events.map(describe).filter(Boolean).reverse() as { icon: string; text: string }[], [state.seq, theme, lang]);
  const myCount = state.tiles.filter((x) => x.owner === viewer).length;

  // timer online
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!online?.timer.deadline) return;
    const tm = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(tm);
  }, [online?.timer.deadline]);
  const secsLeft = online?.timer.deadline ? Math.max(0, Math.ceil((online.timer.deadline - now) / 1000)) : 0;

  // ---------- tips tutorial ----------
  // tip yang sudah muncul tetap tampil sampai ditutup (tidak hilang saat keadaan berubah)
  const [tip, setTip] = useState<ReturnType<typeof pickTip>>(null);
  const [tipNonce, setTipNonce] = useState(0);
  useEffect(() => {
    if (tip || !idle || panel) return;
    const next = pickTip(state, spectator ? null : me ?? controlling);
    if (next) setTip(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.seq, idle, panel, tipNonce, me, controlling, spectator]);

  return (
    <div className="hud">
      {/* ===== pemain ===== */}
      <aside className="players panel">
        <div className="players-head">
          <span className="eyebrow flag-row">
            <Flag theme={theme} size={11} /> {t(theme.name)}
          </span>
          <span className="eyebrow">
            {t('Ronde {n}', { n: state.round + 1 })}
            {state.options.maxRounds ? ` / ${state.options.maxRounds}` : ''}
          </span>
        </div>
        {state.players.map((p) => {
          const owned = state.tiles.filter((x) => x.owner === p.id).length;
          return (
            <div key={p.id} className={`pl ${p.id === cur.id ? 'cur' : ''} ${p.bankrupt ? 'out' : ''}`} style={{ ['--c' as string]: p.color }}>
              <TokenBadge token={p.token} color={p.color} dim={p.bankrupt} />
              <div className="pl-info">
                <div className="pl-name">
                  <span className="truncate">{p.name}</span>
                  {p.bot && <span className="chip">BOT</span>}
                  {me === p.id && <span className="chip accent">{t('KAMU')}</span>}
                  {p.inJail && <span className="chip warn">{t('PENJARA')}</span>}
                  {p.jailFree > 0 && (
                    <span className="chip" title={t('Kartu bebas penjara')}>
                      <KeyRound size={11} /> {p.jailFree}
                    </span>
                  )}
                </div>
                <div className="pl-cash">{p.bankrupt ? t('Bangkrut') : money(p.cash)}</div>
                <div className="pl-meta">{t('{n} properti · aset {worth}', { n: owned, worth: money(netWorth(state, p.id)) })}</div>
              </div>
              {online?.timer.actor === p.id && secsLeft > 0 && <span className={`timer ${secsLeft <= 10 ? 'low' : ''}`}>{secsLeft}</span>}
              {deltas
                .filter((d) => d.pid === p.id)
                .map((d) => (
                  <span key={d.id} className={`delta ${d.amount > 0 ? 'up' : 'down'}`}>
                    {d.amount > 0 ? '+' : '−'}
                    {money(Math.abs(d.amount))}
                  </span>
                ))}
              {quips
                .filter((qq) => qq.player === p.id)
                .slice(-1)
                .map((qq) => (
                  <span key={qq.seq} className="quip">
                    {tr(qq.text)}
                  </span>
                ))}
              {online?.emotes
                .filter((e) => e.from === p.id)
                .slice(-1)
                .map((e) => (
                  <span key={e.id} className="emote-pop">
                    {e.e}
                  </span>
                ))}
            </div>
          );
        })}
        <BankStock state={state} />
        {state.pot > 0 && (
          <div className="pot">
            <Banknote size={14} /> {t('Pot parkir {amount}', { amount: money(state.pot) })}
          </div>
        )}
      </aside>

      {/* ===== toolbar ===== */}
      <nav className="toolbar panel" aria-label={t('Menu permainan')}>
        <button className="icon-btn" title={spectator ? t('Aset pemain') : t('Asetku')} onClick={() => setPanel('assets')}>
          <Wallet size={18} />
          {myCount > 0 && !spectator && <span className="badge">{myCount}</span>}
        </button>
        {!myTurn && canManageNow && (
          <button className="icon-btn" title={t('Tukar (boleh di antara giliran)')} onClick={() => setPanel('trade')}>
            <ArrowRightLeft size={18} />
          </button>
        )}
        <button className="icon-btn" title={t('Riwayat')} onClick={() => setPanel('log')}>
          <ScrollText size={18} />
        </button>
        <button className="icon-btn" title={t('Statistik')} onClick={() => setPanel('stats')}>
          <ChartNoAxesColumn size={18} />
        </button>
        <button
          className="icon-btn"
          title={t('Kamera: {mode}', { mode: props.camMode === 'free' ? t('bebas') : props.camMode === 'follow' ? t('ikuti bidak') : t('dari atas') })}
          onClick={() => props.setCamMode(props.camMode === 'free' ? 'follow' : props.camMode === 'follow' ? 'top' : 'free')}
        >
          <Camera size={18} />
        </button>
        <button className="icon-btn" title={t('Pengaturan')} onClick={() => setPanel('settings')}>
          <Settings size={18} />
        </button>
        <button className="icon-btn" title={t('Cara bermain')} onClick={() => setPanel('help')}>
          <BookOpen size={18} />
        </button>
      </nav>

      {/* ===== ticker ===== */}
      <div className="ticker" aria-live="polite">
        {log.slice(0, 3).map((l, k) => (
          <div key={state.seq - k} className="ticker-item" style={{ opacity: 1 - k * 0.28 }}>
            <span>{l.icon}</span> {l.text}
          </div>
        ))}
      </div>

      {banner && state.phase !== 'gameover' && (
        <div className="turn-banner" key={banner.key} style={{ ['--c' as string]: banner.color }}>
          {banner.text}
        </div>
      )}

      {spectator && (
        <div className="spectate-badge panel">
          <Eye size={16} /> {t('Menonton')}
          {online && online.spectators > 1 && <span className="muted small">· {t('{n} penonton', { n: online.spectators })}</span>}
        </div>
      )}

      {hovered !== null && hovered !== selected && <HoverTip i={hovered} state={state} theme={theme} />}

      {selected !== null && <TileCard i={selected} state={state} theme={theme} me={manager} canManage={canManageNow} act={actAs} onClose={() => setSelected(null)} />}

      {tip && (
        <div className="coach panel" role="status">
          <GraduationCap size={20} className="coach-icon" />
          <div className="grow">
            <b>{t(tip.title)}</b>
            <p>{t(tip.text)}</p>
          </div>
          <div className="coach-actions">
            <button className="btn sm primary" onClick={() => (markTip(tip.id), setTip(null), setTipNonce((n) => n + 1))}>
              {t('Mengerti')}
            </button>
            <button className="btn sm ghost" onClick={() => (setTipsOn(false), setTip(null))}>
              {t('Matikan tips')}
            </button>
          </div>
        </div>
      )}

      {/* ===== dock aksi ===== */}
      <section className="dock panel" style={{ ['--c' as string]: actorP?.color ?? cur.color }}>
        <div className="dock-head">
          {actorP && <TokenBadge token={actorP.token} color={actorP.color} size={28} />}
          <div className="dock-title">
            {state.phase === 'gameover'
              ? t('Permainan selesai')
              : state.phase === 'auction'
                ? t('Lelang')
                : state.trade
                  ? t('Tawaran tukar')
                  : myTurn
                    ? t('Giliranmu')
                    : t('Giliran {name}', { name: actorP?.name ?? '' })}
            {state.phase !== 'gameover' && !myTurn && actorP?.bot && <span className="dots muted"> {t('berpikir')}</span>}
            {state.phase !== 'gameover' && !myTurn && !actorP?.bot && (me || spectator) && <span className="dots muted"> {t('menunggu')}</span>}
          </div>
          <DiceMini d={state.dice} />
        </div>

        {myTurn && !idle && !state.trade && state.phase !== 'auction' && state.phase !== 'gameover' && (
          <div className="dock-wait muted">
            <span className="dots">{t('Menunggu')}</span>
          </div>
        )}
        {isCurTurn && state.phase !== 'gameover' && (
          <div className="dock-actions">
            {state.phase === 'buy' && <BuyPreview state={state} theme={theme} />}
            {(state.phase === 'roll' || state.phase === 'end') && !state.rolled && (
              <button className="btn primary lg" onClick={() => act({ type: 'roll' })}>
                <Dices size={20} /> {state.phase === 'end' ? t('Lempar lagi') : t('Lempar dadu')}
                <kbd>{t('Spasi')}</kbd>
              </button>
            )}
            {state.phase === 'roll' && cur.inJail && !state.rolled && (
              <>
                <button className="btn" disabled={cur.cash < state.options.jailFine} onClick={() => act({ type: 'payBail' })}>
                  <LockOpen size={16} /> {t('Bayar {amount}', { amount: money(state.options.jailFine) })}
                </button>
                {cur.jailFree > 0 && (
                  <button className="btn" onClick={() => act({ type: 'useJailCard' })}>
                    <KeyRound size={16} /> {t('Kartu bebas')}
                  </button>
                )}
              </>
            )}
            {state.phase === 'buy' && (
              <>
                <button className="btn primary lg" disabled={cur.cash < BOARD[cur.pos].price!} onClick={() => act({ type: 'buy' })}>
                  <Check size={18} /> {t('Beli {price}', { price: money(BOARD[cur.pos].price!) })} <kbd>B</kbd>
                </button>
                <button className="btn" onClick={() => act({ type: 'decline' })}>
                  <Gavel size={16} /> {state.options.auctions ? t('Lelang') : t('Tidak beli')} <kbd>L</kbd>
                </button>
              </>
            )}
            {state.phase === 'debt' && state.debt && (
              <>
                <div className="notice danger">
                  {tj('Harus bayar {amount} ke {to}. Uangmu {cash} — jual bangunan, gadai di Asetku, atau tukar dengan pemain lain.', {
                    amount: <b>{money(state.debt.amount)}</b>,
                    to: state.debt.split ? t('tiap pemain ({each}/orang)', { each: money(Math.floor(state.debt.amount / state.debt.split.length)) }) : name(state.debt.creditor),
                    cash: money(cur.cash),
                  })}
                </div>
                <button className="btn" onClick={() => setPanel('assets')}>
                  <Wallet size={16} /> {t('Asetku')}
                </button>
                <button className="btn" onClick={() => setPanel('trade')}>
                  <ArrowRightLeft size={16} /> {t('Tukar')}
                </button>
                <button className="btn primary" disabled={cur.cash < state.debt.amount} onClick={() => act({ type: 'payDebt' })}>
                  <Banknote size={16} /> {t('Bayar')}
                </button>
                {(() => {
                  const why = bankruptBlock(state, cur.id);
                  return (
                    <button
                      className="btn danger"
                      disabled={!!why}
                      title={why ? tr(why) : t('Serahkan semua aset')}
                      onClick={async () =>
                        (await askConfirm(t('Yakin menyatakan bangkrut? Semua asetmu diserahkan ke {to}.', { to: state.debt?.creditor ? name(state.debt.creditor) : t('bank (dilelang)') }), { ok: t('Bangkrut'), danger: true })) &&
                        act({ type: 'bankrupt' })
                      }
                    >
                      <Skull size={16} /> {t('Bangkrut')}
                    </button>
                  );
                })()}
              </>
            )}
            {(state.phase === 'end' || state.phase === 'roll') && state.rolled && (
              <button className="btn primary lg" onClick={() => act({ type: 'endTurn' })}>
                {t('Selesai giliran')} <kbd>{t('Spasi')}</kbd>
              </button>
            )}
            {(state.phase === 'roll' || state.phase === 'end') && (
              <>
                {state.tiles.some((_, i) => canBuild(state, cur.id, i)) && (
                  <button className="btn" onClick={() => setPanel('assets')}>
                    <Building size={16} /> {t('Bangun')}
                  </button>
                )}
                <button className="btn" onClick={() => setPanel('trade')}>
                  <ArrowRightLeft size={16} /> {t('Tukar')}
                </button>
              </>
            )}
          </div>
        )}

        {state.phase === 'auction' && state.auction && <AuctionBox state={state} theme={theme} myTurn={myTurn} act={act} name={name} />}

        {state.trade && (
          <div className="dock-body">
            <div className="trade-sum">
              <div>
                <span className="eyebrow">{t('{name} memberi', { name: name(state.trade.from) })}</span>
                <div>{state.trade.giveTiles.map((i) => tileName(theme, i)).join(', ') || '—'}</div>
                {state.trade.giveCash > 0 && <b>{money(state.trade.giveCash)}</b>}
                {(state.trade.giveJail ?? 0) > 0 && <div>{t('{n}× kartu bebas penjara', { n: state.trade.giveJail ?? 0 })}</div>}
              </div>
              <ArrowRightLeft size={18} />
              <div>
                <span className="eyebrow">{t('dan meminta')}</span>
                <div>{state.trade.getTiles.map((i) => tileName(theme, i)).join(', ') || '—'}</div>
                {state.trade.getCash > 0 && <b>{money(state.trade.getCash)}</b>}
                {(state.trade.getJail ?? 0) > 0 && <div>{t('{n}× kartu bebas penjara', { n: state.trade.getJail ?? 0 })}</div>}
              </div>
            </div>
            {tradeInterest(state, state.trade.giveTiles) > 0 && (
              <div className="muted small">{t('{name} membayar bunga 10% properti tergadai: {amount}', { name: name(state.trade.to), amount: money(tradeInterest(state, state.trade.giveTiles)) })}</div>
            )}
            {tradeInterest(state, state.trade.getTiles) > 0 && (
              <div className="muted small">{t('{name} membayar bunga 10% properti tergadai: {amount}', { name: name(state.trade.from), amount: money(tradeInterest(state, state.trade.getTiles)) })}</div>
            )}
            {!spectator && (
              <div className="dock-actions">
                {(me ? me === state.trade.to : !state.players.find((p) => p.id === state.trade!.to)!.bot) && (
                  <>
                    <button className="btn primary" onClick={() => send(state.trade!.to, { type: 'acceptTrade' })}>
                      <Check size={16} /> {t('Terima')}
                    </button>
                    <button className="btn" onClick={() => setCounter(true)}>
                      <ArrowRightLeft size={16} /> {t('Tawar balik')}
                    </button>
                    <button className="btn" onClick={() => send(state.trade!.to, { type: 'rejectTrade' })}>
                      <X size={16} /> {t('Tolak')}
                    </button>
                  </>
                )}
                {(me ? me === state.trade.from : true) && (
                  <button className="btn ghost" onClick={() => send(state.trade!.from, { type: 'rejectTrade' })}>
                    {t('Batalkan')}
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </section>

      {online && <OnlineBar online={online} state={state} me={me} spectator={!!spectator} />}
      {online && !online.connected && <div className="conn-banner">{t('Koneksi terputus — menyambung ulang…')}</div>}

      {panel === 'trade' && manager && <TradeDialog state={state} theme={theme} from={manager} onClose={() => setPanel(null)} onSend={(x) => (actAs({ type: 'proposeTrade', trade: x }), setPanel(null))} />}
      {counter && state.trade && (
        <TradeDialog
          state={state}
          theme={theme}
          from={state.trade.to}
          lockTo={state.trade.from}
          // tawaran balik dimulai dari syarat lama yang dibalik
          initial={{ give: state.trade.getTiles, get: state.trade.giveTiles, giveCash: state.trade.getCash, getCash: state.trade.giveCash, giveJail: state.trade.getJail ?? 0, getJail: state.trade.giveJail ?? 0 }}
          onClose={() => setCounter(false)}
          onSend={({ to: _to, ...x }) => (send(state.trade!.to, { type: 'counterTrade', trade: x }), setCounter(false))}
        />
      )}
      {panel === 'assets' && (
        <AssetsDialog
          state={state}
          theme={theme}
          viewer={viewer}
          canManage={canManageNow && viewer === manager}
          spectator={!!spectator}
          act={actAs}
          onClose={() => setPanel(null)}
          onOpenTile={(i) => (setSelected(i), setPanel(null))}
        />
      )}
      {panel === 'log' && (
        <Modal title={t('Riwayat permainan')} icon={<ScrollText size={20} />} onClose={() => setPanel(null)}>
          <div className="log-list">
            {log.map((l, k) => (
              <div key={k} className="log-row">
                <span>{l.icon}</span>
                <span>{l.text}</span>
              </div>
            ))}
          </div>
        </Modal>
      )}
      {panel === 'stats' && (
        <Modal title={t('Statistik')} icon={<ChartNoAxesColumn size={20} />} onClose={() => setPanel(null)} wide>
          <StatsTable state={state} theme={theme} me={viewer} />
        </Modal>
      )}
      {panel === 'settings' && (
        <Modal title={t('Pengaturan')} icon={<Settings size={20} />} onClose={() => setPanel(null)}>
          <SettingsBody camMode={props.camMode} setCamMode={props.setCamMode} speed={props.speed} setSpeed={props.setSpeed} />
          <button
            className="btn danger block"
            onClick={async () =>
              (await askConfirm(
                spectator ? t('Berhenti menonton?') : online ? t('Keluar dari room? Kursimu akan dimainkan bot sampai game selesai.') : t('Keluar ke menu? Game lokal tersimpan otomatis.'),
                { ok: t('Keluar'), danger: !!online && !spectator },
              )) && onQuit()
            }
          >
            <LogOut size={16} /> {spectator ? t('Berhenti menonton') : t('Keluar ke menu')}
          </button>
        </Modal>
      )}
      {panel === 'help' && <HelpDialog theme={theme} rules={state.options} onClose={() => setPanel(null)} />}

      {state.phase === 'gameover' && <GameOver state={state} theme={theme} onQuit={onQuit} onRematch={spectator ? undefined : props.onRematch} note={props.rematchNote} />}
    </div>
  );
}

// ================= komponen =================

function BankStock({ state }: { state: GameState }) {
  const b = bankStock(state);
  const lim = state.options.limitedBuildings;
  return (
    <div className="bank-stock" title={lim ? t('Stok bangunan di bank (aturan resmi: 32 rumah, 12 hotel)') : t('Aturan rumah: rumah & hotel tidak terbatas')}>
      <span>
        <House size={13} /> {lim ? b.houses : '∞'}
      </span>
      <span>
        <Hotel size={13} /> {lim ? b.hotels : '∞'}
      </span>
      <span className="muted">{t('stok bank')}</span>
    </div>
  );
}

const PIPS: Record<number, number[]> = { 1: [4], 2: [0, 8], 3: [0, 4, 8], 4: [0, 2, 6, 8], 5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8] };
function DiceMini({ d }: { d: [number, number] }) {
  return (
    <div className="dice-mini" title={t('Dadu terakhir: {a} + {b}', { a: d[0], b: d[1] })}>
      {d.map((v, k) => (
        <span key={k} className="die">
          {Array.from({ length: 9 }, (_, i) => (
            <i key={i} className={PIPS[v].includes(i) ? 'on' : ''} />
          ))}
        </span>
      ))}
    </div>
  );
}

const swatchColor = (theme: Theme, i: number) => (BOARD[i].kind === 'property' ? theme.groupColors[BOARD[i].group!] : '#64748b');

function CityBanner({ name, theme, groupColor }: { name: string; theme: Theme; groupColor?: string }) {
  const info = getCityInfo(name, theme);
  return (
    <div
      className="city-banner"
      style={{
        ['--city-c' as string]: groupColor ?? info.accent,
        ['--sky-0' as string]: info.skyGradient[0],
        ['--sky-1' as string]: info.skyGradient[1],
      }}
    >
      <div className="city-banner-bg" />
      <div className="city-banner-stars" />
      <div className="city-banner-content">
        <div className="city-banner-icon-box">
          <span className="city-banner-icon">{info.icon}</span>
        </div>
        <div className="city-banner-details">
          <div className="city-banner-tag">{tr(info.tagline)}</div>
          <div className="city-banner-landmark">
            <Sparkles size={13} className="city-sparkle" /> {tr(info.landmark)}
          </div>
        </div>
      </div>
      <div className="city-banner-shimmer" />
    </div>
  );
}

function BuyPreview({ state, theme }: { state: GameState; theme: Theme }) {
  const p = state.players[state.current];
  const tl = BOARD[p.pos];
  const name = tileName(theme, p.pos);
  const info = getCityInfo(name, theme);
  const g = tl.kind === 'property' ? groupTiles(tl.group!) : [];
  const have = g.filter((i) => state.tiles[i].owner === p.id).length;
  const color = tl.kind === 'property' ? theme.groupColors[tl.group!] : '#0284c7';
  return (
    <div className="buy-preview">
      <div className="buy-preview-icon" style={{ background: color }}>
        <span>{info.icon}</span>
      </div>
      <div>
        <div className="buy-preview-title">
          <b>{name}</b>
          <span className="buy-preview-tag">{tr(info.landmark)}</span>
        </div>
        <div className="muted">
          {tl.kind === 'property'
            ? t('Sewa {rent} · set {have}/{all}', { rent: formatMoney(theme, tl.rent![0]), have: have + 1, all: g.length }) + (have + 1 === g.length ? t(' — lengkap, sewa 2×') : '')
            : tl.kind === 'station'
              ? t('Transportasi · sewa naik tiap unit')
              : t('Utilitas · sewa × angka dadu')}
        </div>
      </div>
    </div>
  );
}

function AuctionBox({ state, theme, myTurn, act, name }: { state: GameState; theme: Theme; myTurn: boolean; act: (a: Action) => void; name: (id: string | null) => string }) {
  const a = state.auction!;
  const bidder = state.players.find((p) => p.id === a.active[a.turn]);
  const building = a.kind === 'house' || a.kind === 'hotel';
  const limit = bidder ? maxBid(state, bidder.id) : 0;
  const [bid, setBid] = useState(a.bid + 10);
  useEffect(() => setBid(a.bid + 10), [a.bid, a.turn]);
  const money = (n: number) => formatMoney(theme, n);
  return (
    <div className="dock-body">
      <div className="auction-head">
        <span className="swatch" style={{ background: swatchColor(theme, a.tile) }} />
        <div>
          <b>{building ? (a.kind === 'hotel' ? t('Lelang hotel terakhir di bank') : t('Lelang rumah terakhir di bank')) : tileName(theme, a.tile)}</b>
          <div className="muted">
            {building
              ? t('Stok bank tidak cukup untuk semua peminat. Tawaran = harga tambahan di atas biaya bangun ({cost}). Diminta {name}.', { cost: money(BOARD[a.tile].houseCost!), name: name(state.tiles[a.tile].owner) })
              : t('Harga normal {price}', { price: money(BOARD[a.tile].price!) })}
          </div>
        </div>
        <div className="auction-bid">
          <span className="eyebrow">{t('Tertinggi')}</span>
          <b>{money(a.bid)}</b>
          <span className="muted">{a.bidder ? name(a.bidder) : t('belum ada')}</span>
        </div>
      </div>
      <div className="chips">
        {a.active.map((id, k) => (
          <span key={id} className={`chip ${k === a.turn ? 'accent' : ''}`}>
            {name(id)}
          </span>
        ))}
      </div>
      {myTurn && (
        <div className="dock-actions">
          {[10, 50, 100].map((inc) => (
            <button key={inc} className="btn sm" onClick={() => setBid(a.bid + inc)}>
              +{money(inc)}
            </button>
          ))}
          <MoneyInput theme={theme} value={bid} onChange={setBid} max={limit} label={t('Nilai tawaran')} />
          <button className="btn primary" disabled={bid <= a.bid || bid > limit} onClick={() => act({ type: 'bid', amount: Math.floor(bid) })}>
            <Gavel size={16} /> {t('Tawar {amount}', { amount: money(bid) })}
          </button>
          <button className="btn" onClick={() => act({ type: 'pass' })}>
            {t('Lewat')}
          </button>
        </div>
      )}
    </div>
  );
}

function HoverTip({ i, state, theme }: { i: number; state: GameState; theme: Theme }) {
  const tl = BOARD[i];
  const st = state.tiles[i];
  const owner = st.owner ? state.players.find((p) => p.id === st.owner) : null;
  const name = tileName(theme, i);
  const info = getCityInfo(name, theme);
  const color = swatchColor(theme, i);
  return (
    <div className="hover-tip panel">
      <div className="hover-tip-icon" style={{ background: color }}>
        <span>{info.icon}</span>
      </div>
      <div>
        <div className="hover-tip-head">
          <b>{name}</b>
          <span className="hover-tip-sub">{tr(info.landmark)}</span>
        </div>
        <div className="muted">
          {isOwnable(i)
            ? owner
              ? t('Milik {name}', { name: owner.name }) + (st.mortgaged ? t(' (digadai)') : '') + ' · ' + t('sewa {rent}', { rent: formatMoney(theme, rentFor(state, i, 7)) })
              : t('Dijual {price}', { price: formatMoney(theme, tl.price!) })
            : t('Klik untuk detail')}
        </div>
      </div>
    </div>
  );
}

function TileCard({ i, state, theme, me, canManage, act, onClose }: { i: number; state: GameState; theme: Theme; me: string | null; canManage: boolean; act: (a: Action) => void; onClose: () => void }) {
  const tl = BOARD[i];
  const st = state.tiles[i];
  const money = (n: number) => formatMoney(theme, n);
  const owner = st.owner ? state.players.find((p) => p.id === st.owner) : null;
  const mine = !!me && st.owner === me;
  const name = tileName(theme, i);
  const gColor = tl.kind === 'property' ? theme.groupColors[tl.group!] : '#334155';
  return (
    <div className="deed panel" onClick={(e) => e.stopPropagation()}>
      <button className="icon-btn deed-x" onClick={onClose} aria-label={t('Tutup')}>
        <X size={16} />
      </button>
      <div className="deed-head" style={{ background: gColor }}>
        <span className="eyebrow">{tl.kind === 'property' ? t('Akta kepemilikan') : tl.kind === 'station' ? t('Transportasi') : tl.kind === 'utility' ? t('Utilitas') : t('Petak')}</span>
        <div className="deed-name">{name}</div>
      </div>
      <CityBanner name={name} theme={theme} groupColor={tl.kind === 'property' ? gColor : undefined} />
      {(() => {
        const a = tileAnimAt(theme, i);
        return (
          a && (
            <button className="anim-play" onClick={() => playTileAnim(i)} title={t('Putar animasi khas petak ini')}>
              <span aria-hidden>{a.emoji}</span>
              <span className="truncate grow">{tr(a.caption)}</span>
              <Play size={14} />
            </button>
          )
        );
      })()}
      <div className="deed-body">
        {tl.kind === 'property' && (
          <table className="rent-table">
            <tbody>
              {[t('Sewa'), t('1 rumah'), t('2 rumah'), t('3 rumah'), t('4 rumah'), t('Hotel')].map((l, k) => (
                <tr key={k} className={st.owner && st.houses === k ? 'hl' : ''}>
                  <td>{l}</td>
                  <td>{money(tl.rent![k])}</td>
                </tr>
              ))}
              <tr className="sep">
                <td>{t('Biaya bangun')}</td>
                <td>{money(tl.houseCost!)}</td>
              </tr>
            </tbody>
          </table>
        )}
        {tl.kind === 'station' && (
          <table className="rent-table">
            <tbody>
              {[25, 50, 100, 200].map((r, k) => (
                <tr key={k}>
                  <td>{t('Punya {n} unit', { n: k + 1 })}</td>
                  <td>{money(r)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {tl.kind === 'utility' && <p className="muted">{t('Sewa 4× angka dadu (1 utilitas) atau 10× (2 utilitas).')}</p>}
        {tl.kind === 'tax' && <p>{t('Bayar {amount} ke bank.', { amount: money(tl.tax!) })}</p>}
        {!isOwnable(i) && tl.kind !== 'tax' && <p className="muted">{t('Petak khusus.')}</p>}
        {isOwnable(i) && (
          <>
            <div className="deed-foot">
              <span>{t('Harga {price}', { price: money(tl.price!) })}</span>
              <span>{t('Gadai {amount}', { amount: money(mortgageValue(i)) })}</span>
            </div>
            <div className="deed-owner">
              {owner ? (
                <>
                  <TokenBadge token={owner.token} color={owner.color} size={22} /> {owner.name} {st.mortgaged && <span className="chip warn">{t('DIGADAI')}</span>}
                </>
              ) : (
                <span className="muted">{t('Belum dimiliki')}</span>
              )}
            </div>
          </>
        )}
        {mine && canManage && <ManageButtons i={i} state={state} theme={theme} me={me!} act={act} />}
      </div>
    </div>
  );
}

function ManageButtons({ i, state, theme, me, act }: { i: number; state: GameState; theme: Theme; me: string; act: (a: Action) => void }) {
  const tl = BOARD[i];
  const st = state.tiles[i];
  const money = (n: number) => formatMoney(theme, n);
  const why = tl.kind === 'property' && st.houses < 5 ? buildBlock(state, me, i) : null;
  return (
    <div className="manage">
      {why && why !== 'Bukan propertimu' && <span className="muted small">{tr(why)}</span>}
      {canBuild(state, me, i) && (
        <button className="btn primary sm" onClick={() => act({ type: 'build', tile: i })}>
          {st.houses === 4 ? <Hotel size={14} /> : <House size={14} />} {st.houses === 4 ? t('Hotel') : t('Rumah')} {money(tl.houseCost!)}
        </button>
      )}
      {canSell(state, me, i) && (
        <button className="btn sm" onClick={() => act({ type: 'sell', tile: i })}>
          {st.houses === 5 ? t('Jual hotel → 4 rumah') : t('Jual rumah')} +{money(tl.houseCost! / 2)}
        </button>
      )}
      {canMortgage(state, me, i) && (
        <button className="btn sm" onClick={() => act({ type: 'mortgage', tile: i })}>
          {t('Gadai')} +{money(mortgageValue(i))}
        </button>
      )}
      {canUnmortgage(state, me, i) && (
        <button className="btn sm" onClick={() => act({ type: 'unmortgage', tile: i })}>
          {t('Tebus {amount}', { amount: money(unmortgageCost(i)) })}
        </button>
      )}
    </div>
  );
}

function AssetsDialog({
  state,
  theme,
  viewer: initialViewer,
  canManage,
  spectator,
  act,
  onClose,
  onOpenTile,
}: {
  state: GameState;
  theme: Theme;
  viewer: string;
  canManage: boolean;
  spectator: boolean;
  act: (a: Action) => void;
  onClose: () => void;
  onOpenTile: (i: number) => void;
}) {
  // penonton bisa melihat aset siapa saja
  const [viewer, setViewer] = useState(initialViewer);
  const p = state.players.find((x) => x.id === viewer)!;
  const money = (n: number) => formatMoney(theme, n);
  const groups: { key: string; color: string; label: string; tiles: number[]; full: boolean }[] = [];
  for (let g = 0; g < GROUP_COUNT; g++) {
    const tiles = groupTiles(g);
    if (tiles.some((i) => state.tiles[i].owner === viewer))
      groups.push({ key: `g${g}`, color: theme.groupColors[g], label: t('Kompleks {g} · {have}/{all}', { g: g + 1, have: tiles.filter((i) => state.tiles[i].owner === viewer).length, all: tiles.length }), tiles, full: ownsGroup(state, viewer, g) });
  }
  const st = BOARD.filter((b) => b.kind === 'station').map((b) => b.index);
  const ut = BOARD.filter((b) => b.kind === 'utility').map((b) => b.index);
  if (st.some((i) => state.tiles[i].owner === viewer)) groups.push({ key: 'st', color: '#475569', label: t('Transportasi'), tiles: st, full: false });
  if (ut.some((i) => state.tiles[i].owner === viewer)) groups.push({ key: 'ut', color: '#64748b', label: t('Utilitas'), tiles: ut, full: false });

  return (
    <Modal title={t('Aset {name}', { name: p.name })} icon={<Wallet size={20} />} onClose={onClose} wide>
      {spectator && (
        <div className="people">
          {state.players.map((x) => (
            <button key={x.id} className={`person ${x.id === viewer ? 'on' : ''}`} onClick={() => setViewer(x.id)} style={{ ['--c' as string]: x.color }}>
              <TokenBadge token={x.token} color={x.color} size={24} /> {x.name}
            </button>
          ))}
        </div>
      )}
      <div className="kpis">
        <div className="kpi">
          <span className="eyebrow">{t('Uang tunai')}</span>
          <b>{money(p.cash)}</b>
        </div>
        <div className="kpi">
          <span className="eyebrow">{t('Kekayaan bersih')}</span>
          <b>{money(netWorth(state, p.id))}</b>
        </div>
        <div className="kpi">
          <span className="eyebrow">{t('Sewa diterima')}</span>
          <b>{money(p.stats.rentIn)}</b>
        </div>
      </div>
      {!canManage && !spectator && groups.length > 0 && <p className="muted">{t('Bangun, jual, dan gadai bisa saat giliranmu atau di antara giliran (bukan saat lelang / tawaran tukar berjalan).')}</p>}
      {canManage && groups.some((g) => g.full) && <p className="muted">{t('Set lengkap: bangun rumah merata di setiap petak grup untuk menaikkan sewa.')}</p>}
      {groups.length === 0 && <p className="muted">{spectator ? t('Pemain ini belum punya properti.') : t('Belum punya properti. Beli petak saat mendarat di sana.')}</p>}
      <div className="asset-groups">
        {groups.map((g) => (
          <div key={g.key} className="asset-group" style={{ ['--c' as string]: g.color }}>
            <div className="asset-group-head">
              <span className="swatch" style={{ background: g.color }} />
              {g.label}
              {g.full && <span className="chip accent">{t('SET LENGKAP')}</span>}
            </div>
            {g.tiles.map((i) => {
              const own = state.tiles[i].owner === viewer;
              const s = state.tiles[i];
              return (
                <div key={i} className={`asset-row ${own ? '' : 'other'}`}>
                  <button className="link" onClick={() => onOpenTile(i)}>
                    {tileName(theme, i)}
                  </button>
                  <span className="houses">
                    {s.houses === 5 ? <Hotel size={14} /> : Array.from({ length: s.houses }, (_, k) => <House key={k} size={12} />)}
                    {s.mortgaged && <span className="chip warn">{t('GADAI')}</span>}
                    {own ? (
                      <span className="chip ok">{spectator ? t('MILIKNYA') : t('MILIKMU')}</span>
                    ) : (
                      <span className="muted">{s.owner ? t('milik {name}', { name: state.players.find((x) => x.id === s.owner)!.name }) : t('belum dimiliki')}</span>
                    )}
                  </span>
                  {own && canManage && <ManageButtons i={i} state={state} theme={theme} me={viewer} act={act} />}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </Modal>
  );
}

interface TradeInit {
  give: number[];
  get: number[];
  giveCash: number;
  getCash: number;
  giveJail: number;
  getJail: number;
}

function TradeDialog({
  state,
  theme,
  from,
  lockTo,
  initial,
  onClose,
  onSend,
}: {
  state: GameState;
  theme: Theme;
  from: string;
  /** tawar balik: tujuan dikunci ke pengirim tawaran awal */
  lockTo?: string;
  initial?: TradeInit;
  onClose: () => void;
  onSend: (x: { to: string; giveTiles: number[]; getTiles: number[]; giveCash: number; getCash: number; giveJail: number; getJail: number }) => void;
}) {
  const others = state.players.filter((p) => p.id !== from && !p.bankrupt && (!lockTo || p.id === lockTo));
  const [to, setTo] = useState(lockTo ?? others[0]?.id ?? '');
  const [give, setGive] = useState<number[]>(initial?.give ?? []);
  const [get, setGet] = useState<number[]>(initial?.get ?? []);
  const [giveCash, setGiveCash] = useState(initial?.giveCash ?? 0);
  const [getCash, setGetCash] = useState(initial?.getCash ?? 0);
  const [giveJail, setGiveJail] = useState(initial?.giveJail ?? 0);
  const [getJail, setGetJail] = useState(initial?.getJail ?? 0);
  const money = (n: number) => formatMoney(theme, n);
  const jailPick = (have: number, v: number, set: (n: number) => void) =>
    have > 0 && (
      <label className="money-in">
        <KeyRound size={14} /> {t('Kartu bebas penjara')}
        <Seg value={v} onChange={set} options={Array.from({ length: have + 1 }, (_, k) => ({ v: k, label: String(k) }))} />
      </label>
    );
  const tradable = (pid: string) =>
    state.tiles.map((_, i) => i).filter((i) => state.tiles[i].owner === pid && !(BOARD[i].kind === 'property' && groupTiles(BOARD[i].group!).some((g) => state.tiles[g].houses > 0)));
  const toggle = (arr: number[], set: (a: number[]) => void, i: number) => set(arr.includes(i) ? arr.filter((x) => x !== i) : [...arr, i]);
  const list = (pid: string, sel: number[], set: (a: number[]) => void) => (
    <div className="pick-list">
      {tradable(pid).map((i) => (
        <label key={i} className={sel.includes(i) ? 'on' : ''}>
          <input type="checkbox" checked={sel.includes(i)} onChange={() => toggle(sel, set, i)} />
          <span className="swatch sm" style={{ background: swatchColor(theme, i) }} />
          <span className="truncate grow">{tileName(theme, i)}</span>
          <span className="muted">{money(BOARD[i].price!)}</span>
        </label>
      ))}
      {!tradable(pid).length && <div className="muted">{t('Tidak ada properti yang bisa ditukar')}</div>}
    </div>
  );
  const fromP = state.players.find((p) => p.id === from)!;
  const toP = state.players.find((p) => p.id === to);
  return (
    <Modal title={lockTo ? t('Tawaran balik') : t('Tawaran tukar')} icon={<ArrowRightLeft size={20} />} onClose={onClose} wide>
      <div className="people">
        {others.map((p) => (
          <button key={p.id} className={`person ${p.id === to ? 'on' : ''}`} onClick={() => (setTo(p.id), setGet([]), setGetJail(0), setGetCash(0))} style={{ ['--c' as string]: p.color }}>
            <TokenBadge token={p.token} color={p.color} size={26} /> {p.name}
          </button>
        ))}
      </div>
      <div className="cols">
        <div className="col">
          <span className="eyebrow">{t('Kamu beri')}</span>
          {list(from, give, setGive)}
          <label className="money-in">
            {t('Uang')}
            <MoneyInput theme={theme} value={giveCash} onChange={(v) => setGiveCash(Math.min(v, fromP.cash))} max={fromP.cash} label={t('Uang yang diberikan')} />
          </label>
          {jailPick(fromP.jailFree, giveJail, setGiveJail)}
        </div>
        <div className="col">
          <span className="eyebrow">{t('Kamu minta dari {name}', { name: toP?.name ?? '' })}</span>
          {to && list(to, get, setGet)}
          <label className="money-in">
            {t('Uang')}
            <MoneyInput theme={theme} value={getCash} onChange={(v) => setGetCash(Math.min(v, toP?.cash ?? 0))} max={toP?.cash} label={t('Uang yang diminta')} />
          </label>
          {toP && jailPick(toP.jailFree, getJail, setGetJail)}
        </div>
      </div>
      {tradeInterest(state, get) > 0 && <div className="notice">{t('Ada properti tergadai: kamu wajib bayar bunga 10% ke bank ({amount}) saat tukar diterima.', { amount: money(tradeInterest(state, get)) })}</div>}
      {tradeInterest(state, give) > 0 && <div className="notice">{t('{name} wajib bayar bunga 10% ke bank ({amount}) untuk properti tergadai yang kamu berikan.', { name: toP?.name ?? '', amount: money(tradeInterest(state, give)) })}</div>}
      <div className="row end">
        <button className="btn ghost" onClick={onClose}>
          {t('Batal')}
        </button>
        <button
          className="btn primary"
          disabled={!to || give.length + get.length + giveCash + getCash + giveJail + getJail === 0}
          onClick={() => onSend({ to, giveTiles: give, getTiles: get, giveCash, getCash, giveJail, getJail })}
        >
          <Send size={16} /> {lockTo ? t('Kirim tawaran balik') : t('Kirim tawaran')}
        </button>
      </div>
    </Modal>
  );
}

function StatsTable({ state, theme, me }: { state: GameState; theme: Theme; me?: string | null }) {
  const money = (n: number) => formatMoney(theme, n);
  return (
    <div className="table-wrap">
      <table className="stats">
        <thead>
          <tr>
            <th>#</th>
            <th>{t('Pemain')}</th>
            <th>{t('Kekayaan')}</th>
            <th>{t('Properti')}</th>
            <th>{t('Bangunan')}</th>
            <th>{t('Sewa masuk')}</th>
            <th>{t('Sewa keluar')}</th>
            <th title={t('Berapa kali lewat START')}>{t('Lewat START')}</th>
            <th>{t('Penjara')}</th>
          </tr>
        </thead>
        <tbody>
          {ranking(state).map((p, k) => (
            <tr key={p.id} className={`${p.bankrupt ? 'out' : ''} ${p.id === me ? 'me' : ''}`}>
              <td>{k + 1}</td>
              <td>
                <span className="cell-player">
                  <TokenBadge token={p.token} color={p.color} size={22} /> {p.name}
                </span>
              </td>
              <td>{p.bankrupt ? t('Bangkrut') : money(netWorth(state, p.id))}</td>
              <td>{state.tiles.filter((x) => x.owner === p.id).length}</td>
              <td>{p.stats.built}</td>
              <td>{money(p.stats.rentIn)}</td>
              <td>{money(p.stats.rentOut)}</td>
              <td>{p.stats.laps}</td>
              <td>{p.stats.jailed}×</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function GameOver({ state, theme, onQuit, onRematch, note }: { state: GameState; theme: Theme; onQuit: () => void; onRematch?: () => void; note?: string }) {
  const w = state.players.find((p) => p.id === state.winner)!;
  const rank = ranking(state);
  const bits = useMemo(() => Array.from({ length: 90 }, (_, k) => ({ left: Math.random() * 100, delay: Math.random() * 2.5, hue: (k * 37) % 360, dur: 2.5 + Math.random() * 2 })), []);
  const podium = [rank[1], rank[0], rank[2]].filter(Boolean);
  return (
    <div className="modal">
      <div className="confetti" aria-hidden>
        {bits.map((b, k) => (
          <i key={k} style={{ left: `${b.left}%`, animationDelay: `${b.delay}s`, animationDuration: `${b.dur}s`, background: `hsl(${b.hue} 90% 60%)` }} />
        ))}
      </div>
      <div className="panel modal-card wide gameover">
        <Trophy size={44} className="trophy" />
        <span className="eyebrow">
          {state.endReason === 'rounds'
            ? t('Batas {n} ronde tercapai', { n: state.options.maxRounds })
            : state.endReason === 'short'
              ? t('Permainan singkat selesai — pemain kedua bangkrut')
              : t('Semua lawan bangkrut')}
        </span>
        <h1>{t('{name} menang!', { name: w.name })}</h1>
        <div className="podium">
          {podium.map((p) => {
            const place = rank.indexOf(p) + 1;
            return (
              <div key={p.id} className={`podium-step p${place}`} style={{ ['--c' as string]: p.color }}>
                <TokenBadge token={p.token} color={p.color} size={place === 1 ? 54 : 40} />
                <b className="truncate">{p.name}</b>
                <span className="muted">{p.bankrupt ? t('Bangkrut') : formatMoney(theme, netWorth(state, p.id))}</span>
                <div className="podium-block">{place}</div>
              </div>
            );
          })}
        </div>
        <StatsTable state={state} theme={theme} />
        <div className="row center">
          {onRematch ? (
            <button className="btn primary lg" onClick={onRematch}>
              <Dices size={18} /> {t('Main lagi')}
            </button>
          ) : (
            note && <span className="muted">{tr(note)}</span>
          )}
          <button className="btn lg" onClick={onQuit}>
            <LogOut size={18} /> {t('Menu utama')}
          </button>
        </div>
      </div>
    </div>
  );
}

export function SettingsBody({ camMode, setCamMode, speed, setSpeed }: { camMode: CamMode; setCamMode: (m: CamMode) => void; speed: number; setSpeed: (n: number) => void }) {
  useLang();
  const [mute, setMute] = useState(isMuted());
  const [anim, setAnim] = useState(tileAnimOn());
  const [music, setMusic] = useState(musicOn());
  const [vol, setVol] = useState(musicVolume());
  const [tips, setTips] = useState(tipsOn());
  const flat = useBoard2d();
  const onOff = (v: boolean, set: (v: boolean) => void) => (
    <Seg
      value={v ? 'on' : 'off'}
      onChange={(x) => set(x === 'on')}
      options={[
        { v: 'on', label: t('Nyala') },
        { v: 'off', label: t('Mati') },
      ]}
    />
  );
  return (
    <div className="form">
      <div className="field">
        <span className="field-label">
          <Languages size={14} /> {t('Bahasa')}
        </span>
        <LangSwitch />
      </div>
      <div className="field">
        <span className="field-label">{t('Tampilan papan')}</span>
        <Seg
          value={flat ? '2d' : '3d'}
          onChange={(v) => setBoard2d(v === '2d')}
          options={[
            { v: '3d', label: t('3D (animasi penuh)') },
            { v: '2d', label: t('2D ringan') },
          ]}
        />
        {!can3d() && <span className="muted small">{t('Browser/kartu grafis ini tidak mendukung 3D (WebGL), jadi memakai papan 2D.')}</span>}
      </div>
      <div className="field">
        <span className="field-label">{t('Animasi khas petak (kuda di Kupang, kapal di Makassar, …)')}</span>
        {onOff(anim, (v) => (setTileAnimOn(v), setAnim(v)))}
      </div>
      <div className="field">
        <span className="field-label">{t('Kamera')}</span>
        <Seg
          value={camMode}
          onChange={setCamMode}
          options={[
            { v: 'free', label: t('Bebas') },
            { v: 'follow', label: t('Ikuti bidak') },
            { v: 'top', label: t('Dari atas') },
          ]}
        />
      </div>
      <div className="field">
        <span className="field-label">{t('Kecepatan animasi')}</span>
        <Seg
          value={speed}
          onChange={setSpeed}
          options={[
            { v: 0.6, label: t('Santai') },
            { v: 1, label: t('Normal') },
            { v: 2, label: t('Cepat') },
          ]}
        />
      </div>
      <div className="field">
        <span className="field-label">{t('Efek suara')}</span>
        <Seg
          value={mute ? 'off' : 'on'}
          onChange={(v) => {
            setMuted(v === 'off');
            setMute(v === 'off');
          }}
          options={[
            {
              v: 'on',
              label: (
                <>
                  <Volume2 size={14} /> {t('Nyala')}
                </>
              ),
            },
            {
              v: 'off',
              label: (
                <>
                  <VolumeX size={14} /> {t('Mati')}
                </>
              ),
            },
          ]}
        />
      </div>
      <div className="field">
        <span className="field-label">
          <Music size={14} /> {t('Musik latar')}
        </span>
        <div className="row">
          {onOff(music, (v) => (setMusicOn(v), setMusic(v)))}
          {music && (
            <input
              type="range"
              className="grow"
              min={0.05}
              max={1}
              step={0.05}
              value={vol}
              aria-label={t('Volume musik')}
              onChange={(e) => (setMusicVolume(+e.target.value), setVol(+e.target.value))}
            />
          )}
        </div>
      </div>
      <div className="field">
        <span className="field-label">
          <GraduationCap size={14} /> {t('Tips tutorial saat bermain')}
        </span>
        {onOff(tips, (v) => (setTipsOn(v), setTips(v)))}
      </div>
    </div>
  );
}

export function HelpDialog({ theme, onClose, rules = DEFAULT_OPTIONS, onPractice }: { theme: Theme; onClose: () => void; rules?: Options; onPractice?: () => void }) {
  useLang();
  const m = (n: number) => formatMoney(theme, n);
  const BAIL = rules.jailFine;
  const items: [JSX.Element, string, string][] = [
    [
      <Dices size={16} />,
      t('Giliran'),
      t('Lempar dua dadu dan jalankan bidak. Double = lempar lagi; tiga kali double berturut-turut masuk penjara. Lewat {go} dapat gaji {salary}.', { go: tr(theme.corners.go), salary: m(rules.goSalary) }) +
        (rules.doubleGo ? t(' (2× kalau berhenti tepat di sana)') : ''),
    ],
    [<Landmark size={16} />, t('Properti'), t('Mendarat di petak kosong: beli, atau lelang ke semua pemain. Set warna lengkap = sewa 2× dan boleh membangun rumah merata sampai hotel.')],
    [<Banknote size={16} />, t('Uang habis'), t('Jual bangunan (setengah harga), gadai properti di Asetku, atau tukar dengan pemain lain. Bangkrut hanya kalau semua aset tetap tidak cukup: aset pindah ke penagih (kalau ke bank, propertinya dilelang).')],
    [
      <LockOpen size={16} />,
      t('Penjara'),
      t('Keluar dengan bayar {bail} sebelum lempar, kartu bebas penjara, atau lempar double. Gagal 3 kali: wajib bayar {bail} lalu jalan sesuai dadu. Di penjara tetap bisa menagih sewa, membangun & tukar.', { bail: m(BAIL) }),
    ],
    [<ArrowRightLeft size={16} />, t('Tukar'), t('Tawarkan properti, uang, dan/atau kartu bebas penjara — juga di antara giliran. Penerima bisa menerima, menolak, atau mengajukan tawaran balik. Properti tergadai yang diterima kena bunga 10%.')],
    [<Building size={16} />, t('Membangun'), t('Bangun, jual bangunan, dan gadai boleh di giliranmu maupun di antara giliran. Kalau stok rumah/hotel bank kurang untuk semua yang ingin membangun, sisa bangunan dilelang.')],
    [<MessageCircle size={16} />, t('Shortcut'), t('Spasi = lempar / selesai · B = beli · L = lelang · Esc = tutup. Klik petak papan untuk melihat akta.')],
  ];
  return (
    <Modal title={t('Cara bermain')} icon={<BookOpen size={20} />} onClose={onClose} wide>
      {onPractice && (
        <div className="practice">
          <GraduationCap size={22} />
          <div className="grow">
            <b>{t('Main latihan')}</b>
            <span className="muted small">{t('Kamu lawan 1 bot level mudah dengan tips tutorial di setiap langkah penting.')}</span>
          </div>
          <button className="btn primary" onClick={onPractice}>
            <Play size={16} /> {t('Mulai latihan')}
          </button>
        </div>
      )}
      <div className="help">
        {items.map(([icon, title, text]) => (
          <section key={title}>
            <h3>
              {icon} {title}
            </h3>
            <p>{text}</p>
          </section>
        ))}
      </div>
    </Modal>
  );
}

function OnlineBar({ online, state, me, spectator }: { online: NonNullable<Props['online']>; state: GameState; me: string | null; spectator: boolean }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [seen, setSeen] = useState(0);
  const [muted, setMutedSeats] = useState<string[]>([]);
  const chat = online.chat.filter((c) => !c.seat || !muted.includes(c.seat));
  const unread = open ? 0 : Math.max(0, chat.length - seen);
  useEffect(() => {
    if (open) setSeen(chat.length);
  }, [open, chat.length]);
  const others = state.players.filter((p) => !p.bot && p.id !== me);
  return (
    <div className="online-bar">
      {open && (
        <div className="chat panel">
          {others.length > 0 && (
            <div className="chat-mute">
              <span className="muted small">{t('Bisukan:')}</span>
              {others.map((p) => (
                <button key={p.id} className={`chip-btn ${muted.includes(p.id) ? 'on' : ''}`} onClick={() => setMutedSeats((m) => (m.includes(p.id) ? m.filter((x) => x !== p.id) : [...m, p.id]))} title={muted.includes(p.id) ? t('Tampilkan lagi pesannya') : t('Sembunyikan pesannya')}>
                  {muted.includes(p.id) ? <VolumeX size={12} /> : null} {p.name}
                </button>
              ))}
            </div>
          )}
          <div className="chat-msgs">
            {chat.length === 0 && <div className="muted">{t('Belum ada pesan')}</div>}
            {chat.map((c, k) => (
              <div key={k}>
                <b>{c.from}</b> {c.text}
              </div>
            ))}
          </div>
          {spectator ? (
            <div className="muted small">{t('Penonton hanya bisa membaca chat.')}</div>
          ) : (
            <form
              className="row"
              onSubmit={(e) => {
                e.preventDefault();
                if (text.trim()) online.sendChat(text);
                setText('');
              }}
            >
              <input className="input grow" value={text} onChange={(e) => setText(e.target.value)} placeholder={t('Ketik pesan…')} maxLength={200} />
              <button className="icon-btn" type="submit" aria-label={t('Kirim')}>
                <Send size={16} />
              </button>
            </form>
          )}
        </div>
      )}
      <div className="emote-bar panel">
        {!spectator &&
          EMOTES.map((e) => (
            <button key={e} className="emote-btn" onClick={() => online.sendEmote(e)} aria-label={t('Kirim {e}', { e })}>
              {e}
            </button>
          ))}
        <button className="icon-btn" onClick={() => setOpen((o) => !o)} title={t('Chat')}>
          <MessageCircle size={18} />
          {unread > 0 && <span className="badge">{unread}</span>}
        </button>
      </div>
    </div>
  );
}
