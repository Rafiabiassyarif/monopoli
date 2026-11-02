// Papan 2D ringan (tanpa WebGL): dipakai saat browser/PC tidak mendukung 3D, atau dipilih di Pengaturan
// supaya hemat baterai & lancar di perangkat lemah. Fungsinya sama: klik petak = lihat akta.

import { BOARD, formatMoney, tileName, type GameState, type Theme } from '@monopoli/engine';
import { Flag, TokenBadge } from './ui';
import { t, tr } from './i18n';

/** posisi grid 11×11 (baris, kolom) untuk petak i; START di pojok kanan bawah seperti papan asli */
function cell(i: number): [number, number] {
  if (i <= 10) return [11, 11 - i];
  if (i <= 20) return [11 - (i - 10), 1];
  if (i <= 30) return [1, 1 + (i - 20)];
  return [1 + (i - 30), 11];
}
const side = (i: number) => (i % 10 === 0 ? 'corner' : i < 10 ? 'bottom' : i < 20 ? 'left' : i < 30 ? 'top' : 'right');
const ICON: Partial<Record<string, string>> = { chance: '❓', community: '🎁', tax: '💰', station: '🚉', utility: '💡', go: '➜', jail: '⛓️', parking: '☕', gotojail: '👮' };

export function Board2D({
  state,
  theme,
  selected,
  hovered,
  onTile,
  onHover,
  bottomInset = 0,
}: {
  state: GameState | null;
  theme: Theme;
  selected: number | null;
  hovered: number | null;
  onTile: (i: number | null) => void;
  onHover: (i: number | null) => void;
  bottomInset?: number;
}) {
  const v = theme.visual;
  return (
    <div className="board2d-wrap" style={{ background: `linear-gradient(${v.sky[0]}, ${v.sky[1]})`, paddingBottom: bottomInset + 8 }} onClick={() => onTile(null)}>
      <div className="board2d" style={{ ['--board' as string]: v.board, ['--center' as string]: v.boardCenter }}>
        {BOARD.map((tile, i) => {
          const [r, c] = cell(i);
          const st = state?.tiles[i];
          const owner = st?.owner ? state!.players.find((p) => p.id === st.owner) : null;
          const here = state?.players.filter((p) => !p.bankrupt && p.pos === i) ?? [];
          const group = tile.kind === 'property' ? theme.groupColors[tile.group!] : null;
          return (
            <button
              key={i}
              className={`b2-tile ${side(i)} ${selected === i ? 'sel' : ''} ${hovered === i ? 'hov' : ''} ${st?.mortgaged ? 'mort' : ''}`}
              style={{ gridRow: r, gridColumn: c, ['--g' as string]: group ?? 'transparent', ['--o' as string]: owner?.color ?? 'transparent' }}
              onClick={(e) => (e.stopPropagation(), onTile(i))}
              onMouseEnter={() => onHover(i)}
              onMouseLeave={() => onHover(null)}
              title={tileName(theme, i)}
            >
              {group && <span className="b2-band" />}
              {!group && ICON[tile.kind] && <span className="b2-icon">{ICON[tile.kind]}</span>}
              <span className="b2-name">{tr(tileName(theme, i))}</span>
              {st && st.houses > 0 && <span className="b2-houses">{st.houses === 5 ? '🏨' : '🏠'.repeat(st.houses)}</span>}
              {tile.price && !owner && <span className="b2-price">{formatMoney(theme, tile.price)}</span>}
              {owner && <span className="b2-owner" />}
              {here.length > 0 && (
                <span className="b2-tokens">
                  {here.map((p) => (
                    <TokenBadge key={p.id} token={p.token} color={p.color} size={18} />
                  ))}
                </span>
              )}
            </button>
          );
        })}
        <div className="b2-center">
          <b className="b2-logo">MONOPOLI</b>
          <span className="b2-edition">
            <Flag theme={theme} size={12} /> {t('Edisi {name}', { name: tr(theme.name) })}
          </span>
          {state && (
            <span className="b2-dice" aria-label={t('Dadu terakhir: {a} + {b}', { a: state.dice[0], b: state.dice[1] })}>
              🎲 {state.dice[0]} + {state.dice[1]}
            </span>
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
