// Papan 2D ringan (tanpa WebGL): dipakai saat browser/PC tidak mendukung 3D, atau dipilih di Pengaturan
// supaya hemat baterai & lancar di perangkat lemah. Isinya setara versi 3D: dadu yang dikocok, bidak
// melangkah per petak, label petak tempat mendarat, kartu Kesempatan/Dana Umum, uang melayang, dan
// animasi khas petak (emoji). Klik petak = lihat akta.

import { useEffect, useRef, useState } from 'react';
import { BOARD, formatMoney, isOwnable, rentFor, taxFor, type GameEvent, type GameState, type Theme } from '@monopoli/engine';
import { Flag, TokenBadge } from './ui';
import { t, tr, useLang } from './i18n';
import { cardLine, tileName } from './names';
import { DICE_MS, fx } from './scene/busy';
import { tileAnimFor, tileAnimOn, type TileAnimInfo } from './tileAnims';

/** posisi grid 11×11 (baris, kolom) untuk petak i; START di pojok kanan bawah seperti papan asli */
function cell(i: number): [number, number] {
  if (i <= 10) return [11, 11 - i];
  if (i <= 20) return [11 - (i - 10), 1];
  if (i <= 30) return [1, 1 + (i - 20)];
  return [1 + (i - 30), 11];
}
const side = (i: number) => (i % 10 === 0 ? 'corner' : i < 10 ? 'bottom' : i < 20 ? 'left' : i < 30 ? 'top' : 'right');
const ICON: Partial<Record<string, string>> = { chance: '❓', community: '🎁', tax: '💰', station: '🚉', utility: '💡', go: '➜', jail: '⛓️', parking: '☕', gotojail: '👮' };

const CARD_MS = 2600;
const LAND_MS = 1700;

interface Floater {
  key: number;
  tile: number;
  text: string;
  plus: boolean;
}
interface Landing {
  key: number;
  tile: number;
  pid: string;
}
interface CardShow {
  key: number;
  deck: 'chance' | 'community';
  id: string;
}
interface TileFx {
  key: number;
  tile: number;
  info: TileAnimInfo;
}

/** Jalankan event baru seperti versi 3D: dadu → langkah per petak → kartu/uang/label mendarat. */
function useBoardFx(state: GameState | null, theme: Theme, stepMs: number) {
  const [shown, setShown] = useState<Record<string, number>>(() => Object.fromEntries(state?.players.map((p) => [p.id, p.pos]) ?? []));
  const [rolling, setRolling] = useState(false);
  const [dice, setDice] = useState<[number, number]>(state?.dice ?? [1, 1]);
  const [card, setCard] = useState<CardShow | null>(null);
  const [landing, setLanding] = useState<Landing | null>(null);
  const [floats, setFloats] = useState<Floater[]>([]);
  const [tileFx, setTileFx] = useState<TileFx | null>(null);
  const seen = useRef<number>(state?.seq ?? -1);
  const timers = useRef<number[]>([]);
  const themeRef = useRef(theme);
  themeRef.current = theme;

  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  useEffect(() => {
    if (!state) return;
    const at = (ms: number, f: () => void) => timers.current.push(window.setTimeout(f, Math.max(0, ms)));
    const actual = Object.fromEntries(state.players.map((p) => [p.id, p.pos]));
    // game baru / dimuat / masuk room: tanpa animasi riwayat
    if (seen.current < 0 || state.seq < seen.current) {
      seen.current = state.seq;
      setShown(actual);
      setDice(state.dice);
      return;
    }
    const fresh: GameEvent[] = state.events.filter((e) => e.seq > seen.current);
    seen.current = state.seq;
    if (!fresh.length) {
      setShown(actual);
      return;
    }
    const money = (n: number) => formatMoney(themeRef.current, n);
    const posOf = (id: string | null) => (id ? state.players.find((p) => p.id === id)?.pos ?? null : null);

    let tl = 0;
    let landed = false;
    for (const e of fresh) {
      if (e.type === 'dice') {
        // dadu dikocok lalu berhenti di angka event ini (kartu "utilitas terdekat" melempar dadu kedua kalinya)
        const d = e.dice;
        at(tl, () => setRolling(true));
        if (tl === 0) fx.diceSettleAt = performance.now() + DICE_MS;
        at(tl + DICE_MS, () => (setDice(d), setRolling(false)));
        tl += DICE_MS;
      } else if (e.type === 'move') {
        const pid = e.player;
        if (e.direct) {
          at(tl, () => setShown((s) => ({ ...s, [pid]: e.to })));
          tl += 300;
          continue;
        }
        const steps = (e.to - e.from + 40) % 40;
        for (let k = 1; k <= steps; k++) {
          const pos = (e.from + k) % 40;
          at(tl + k * stepMs, () => setShown((s) => ({ ...s, [pid]: pos })));
        }
        tl += steps * stepMs + 120;
        if (!landed) {
          landed = true;
          const l: Landing = { key: e.seq, tile: e.to, pid };
          at(tl - 120, () => setLanding(l));
          at(tl - 120 + LAND_MS, () => setLanding((x) => (x?.key === l.key ? null : x)));
          const info = tileAnimOn() ? tileAnimFor(themeRef.current, e.to) : null;
          if (info) {
            const f: TileFx = { key: e.seq, tile: e.to, info };
            at(tl - 60, () => setTileFx(f));
            at(tl - 60 + 2400, () => setTileFx((x) => (x?.key === f.key ? null : x)));
          }
        }
      } else if (e.type === 'card') {
        const c: CardShow = { key: e.seq, deck: e.deck, id: e.card };
        at(tl, () => setCard(c));
        at(tl + CARD_MS, () => setCard((x) => (x?.key === c.key ? null : x)));
        tl += CARD_MS;
      } else if (e.type === 'pay' && e.amount > 0) {
        const items: Floater[] = [];
        const from = posOf(e.from);
        const to = posOf(e.to);
        if (from !== null) items.push({ key: e.seq * 2, tile: from, text: `−${money(e.amount)}`, plus: false });
        if (to !== null) items.push({ key: e.seq * 2 + 1, tile: to, text: `+${money(e.amount)}`, plus: true });
        const when = tl;
        at(when, () => setFloats((f) => [...f, ...items].slice(-8)));
        at(when + 1600, () => setFloats((f) => f.filter((x) => !items.includes(x))));
      } else if (e.type === 'buy') {
        const it: Floater = { key: e.seq * 2, tile: e.tile, text: `−${money(e.price)}`, plus: false };
        at(tl, () => setFloats((f) => [...f, it].slice(-8)));
        at(tl + 1600, () => setFloats((f) => f.filter((x) => x !== it)));
      }
    }
    // pastikan posisi akhir selalu sama dengan state (mis. bangkrut, keluar penjara)
    at(tl + 20, () => setShown(actual));
  }, [state?.seq]);

  return { shown, rolling, dice, card, landing, floats, tileFx };
}

const PIPS: Record<number, number[]> = { 1: [4], 2: [0, 8], 3: [0, 4, 8], 4: [0, 2, 6, 8], 5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8] };

function Die({ value, rolling, delay }: { value: number; rolling: boolean; delay: number }) {
  const [face, setFace] = useState(value);
  useEffect(() => {
    if (!rolling) return setFace(value);
    const id = setInterval(() => setFace(1 + Math.floor(Math.random() * 6)), 90);
    return () => clearInterval(id);
  }, [rolling, value]);
  return (
    <span className={`die2d ${rolling ? 'rolling' : 'landed'}`} style={{ animationDelay: `${delay}ms` }} aria-hidden>
      {Array.from({ length: 9 }, (_, k) => (
        <i key={k} className={PIPS[face]?.includes(k) ? 'on' : ''} />
      ))}
    </span>
  );
}

function landingText(state: GameState, theme: Theme, l: Landing): string {
  const tile = BOARD[l.tile];
  const st = state.tiles[l.tile];
  const p = state.players.find((q) => q.id === l.pid);
  const owner = st.owner ? state.players.find((q) => q.id === st.owner) : null;
  const money = (n: number) => formatMoney(theme, n);
  if (isOwnable(l.tile)) {
    if (!owner) return t('Dijual {price}', { price: money(tile.price!) });
    if (owner.id === l.pid) return t('Properti sendiri');
    return st.mortgaged
      ? t('Milik {name} · digadai', { name: owner.name })
      : t('Milik {name} · sewa {rent}', { name: owner.name, rent: money(rentFor(state, l.tile, state.dice[0] + state.dice[1])) });
  }
  if (tile.kind === 'tax') return t('Bayar {amount}', { amount: money(taxFor(state, l.pid, l.tile)) });
  if (tile.kind === 'chance' || tile.kind === 'community') return t('Ambil kartu');
  if (tile.kind === 'gotojail') return t('Masuk penjara!');
  if (tile.kind === 'go') return t('Terima gaji');
  if (tile.kind === 'jail') return p?.inJail ? t('Dipenjara') : t('Hanya mampir');
  if (tile.kind === 'parking') return t('Istirahat sejenak');
  return '';
}

export function Board2D({
  state,
  theme,
  selected,
  hovered,
  onTile,
  onHover,
  bottomInset = 0,
  stepMs = 220,
}: {
  state: GameState | null;
  theme: Theme;
  selected: number | null;
  hovered: number | null;
  onTile: (i: number | null) => void;
  onHover: (i: number | null) => void;
  bottomInset?: number;
  stepMs?: number;
}) {
  useLang();
  const v = theme.visual;
  const { shown, rolling, dice, card, landing, floats, tileFx } = useBoardFx(state, theme, stepMs);
  const cur = state ? state.players[state.current] : null;
  const deckName = (d: 'chance' | 'community') => tr(d === 'chance' ? theme.deckNames.chance : theme.deckNames.community);
  const cardTextNow = card && state ? cardLine(state, theme, card.deck, card.id) : '';
  const landTile = landing ? BOARD[landing.tile] : null;

  return (
    <div className="board2d-wrap" style={{ background: `linear-gradient(${v.sky[0]}, ${v.sky[1]})`, paddingBottom: bottomInset + 8 }} onClick={() => onTile(null)}>
      <div className="board2d" style={{ ['--board' as string]: v.board, ['--center' as string]: v.boardCenter }}>
        {BOARD.map((tile, i) => {
          const [r, c] = cell(i);
          const st = state?.tiles[i];
          const owner = st?.owner ? state!.players.find((p) => p.id === st.owner) : null;
          const here = state?.players.filter((p) => !p.bankrupt && (shown[p.id] ?? p.pos) === i) ?? [];
          const group = tile.kind === 'property' ? theme.groupColors[tile.group!] : null;
          const name = tileName(theme, i);
          return (
            <button
              key={i}
              className={`b2-tile ${side(i)} ${selected === i ? 'sel' : ''} ${hovered === i ? 'hov' : ''} ${st?.mortgaged ? 'mort' : ''} ${landing?.tile === i ? 'landed' : ''}`}
              style={{ gridRow: r, gridColumn: c, ['--g' as string]: group ?? 'transparent', ['--o' as string]: owner?.color ?? 'transparent' }}
              onClick={(e) => (e.stopPropagation(), onTile(i))}
              onMouseEnter={() => onHover(i)}
              onMouseLeave={() => onHover(null)}
              title={name}
            >
              {group && <span className="b2-band" />}
              {!group && ICON[tile.kind] && <span className="b2-icon">{ICON[tile.kind]}</span>}
              <span className="b2-name">{name}</span>
              {st && st.houses > 0 && <span className="b2-houses">{st.houses === 5 ? '🏨' : '🏠'.repeat(st.houses)}</span>}
              {tile.price && !owner && <span className="b2-price">{formatMoney(theme, tile.price)}</span>}
              {owner && <span className="b2-owner" />}
              {here.length > 0 && (
                <span className="b2-tokens">
                  {here.map((p) => (
                    <span key={p.id} className={`b2-token ${cur?.id === p.id ? 'active' : ''}`}>
                      <TokenBadge token={p.token} color={p.color} size={18} />
                    </span>
                  ))}
                </span>
              )}
              {tileFx?.tile === i && (
                <span key={tileFx.key} className="b2-anim" aria-hidden>
                  {tileFx.info.emoji}
                </span>
              )}
              {floats
                .filter((f) => f.tile === i)
                .map((f) => (
                  <span key={f.key} className={`b2-float ${f.plus ? 'plus' : 'minus'}`}>
                    {f.text}
                  </span>
                ))}
            </button>
          );
        })}

        <div className="b2-center">
          <div className="b2-head">
            <b className="b2-logo">MONOPOLI</b>
            <span className="b2-edition">
              <Flag theme={theme} size={12} /> {t('Edisi {name}', { name: tr(theme.name) })}
            </span>
          </div>

          <div className="b2-decks">
            <span className="b2-deck chance">
              <b>?</b>
              <span>{deckName('chance')}</span>
            </span>
            {state && (
              <span className="b2-dicebox" aria-label={t('Dadu terakhir: {a} + {b}', { a: dice[0], b: dice[1] })}>
                <span className="b2-dice">
                  <Die value={dice[0]} rolling={rolling} delay={0} />
                  <Die value={dice[1]} rolling={rolling} delay={80} />
                </span>
                <span className="b2-sum">{rolling ? '…' : `= ${dice[0] + dice[1]}`}</span>
              </span>
            )}
            <span className="b2-deck community">
              <b>★</b>
              <span>{deckName('community')}</span>
            </span>
          </div>

          <div className="b2-status">
            {landing && state && landTile ? (
              <div key={landing.key} className="land-label b2-land" style={{ ['--c' as string]: landTile.kind === 'property' ? theme.groupColors[landTile.group!] : '#64748b' }}>
                <b>{tileName(theme, landing.tile)}</b>
                <span>{landingText(state, theme, landing)}</span>
              </div>
            ) : tileFx ? (
              <div key={tileFx.key} className="b2-anim-cap">
                {tileFx.info.emoji} {tileFx.info.own ? tileFx.info.caption : tr(tileFx.info.caption)}
              </div>
            ) : cur && !cur.bankrupt ? (
              <div className="b2-turn">
                <TokenBadge token={cur.token} color={cur.color} size={16} /> {t('Giliran {name}', { name: cur.name })}
              </div>
            ) : null}
          </div>

          {card && cardTextNow && (
            <div key={card.key} className={`b2-card ${card.deck}`} role="status">
              <div className="b2-card-head">{deckName(card.deck)}</div>
              <p>{cardTextNow}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/** Apakah browser bisa membuat konteks WebGL (dicek sekali). */
let glOk: boolean | null = null;
export function hasWebGL(): boolean {
  if (glOk !== null) return glOk;
  try {
    const c = document.createElement('canvas');
    glOk = !!(c.getContext('webgl2') || c.getContext('webgl'));
  } catch {
    glOk = false;
  }
  return glOk;
}
