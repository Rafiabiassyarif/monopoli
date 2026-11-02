// Bot sederhana tapi masuk akal: beli kalau ada sisa kas aman, bangun rumah merata, tawar lelang sampai nilai wajar.

import { BOARD, groupTiles, isOwnable } from './board';
import {
  type Action,
  type GameState,
  actorId,
  autoLiquidate,
  canBuild,
  canUnmortgage,
  currentPlayer,
  bankruptBlock,
  liquidValue,
  maxBid,
  ownsGroup,
  playerById,
  tradeInterest,
} from './game';

export type BotLevel = 'easy' | 'normal' | 'hard';

const RESERVE: Record<BotLevel, number> = { easy: 50, normal: 150, hard: 250 };

/** Nilai properti menurut bot (lebih tinggi kalau melengkapi grup). */
function valueOf(s: GameState, pid: string, tile: number): number {
  const t = BOARD[tile];
  let v = t.price!;
  if (t.kind === 'property') {
    const g = groupTiles(t.group!);
    const mine = g.filter((i) => s.tiles[i].owner === pid).length;
    if (mine === g.length - 1) v *= 1.6; // melengkapi set
    else if (mine > 0) v *= 1.2;
    // menghalangi lawan melengkapi set
    const others = g.filter((i) => s.tiles[i].owner && s.tiles[i].owner !== pid);
    if (others.length === g.length - 1 && new Set(others.map((i) => s.tiles[i].owner)).size === 1) v *= 1.3;
  }
  return Math.floor(v);
}

/** Satu aksi berikutnya untuk bot yang sedang harus bertindak. null = bukan giliran bot. */
/** force=true: jalankan juga untuk manusia (dipakai server saat pemain AFK / timer habis). */
export function botAction(s: GameState, level: BotLevel = 'normal', force = false): { pid: string; action: Action } | null {
  const pid = actorId(s);
  if (!pid) return null;
  const me = playerById(s, pid);
  if (!me.bot && !force) return null;
  // persona: agresif = cadangan kas kecil & nilai properti tinggi; hemat = kebalikannya
  const pers = me.persona ?? 'seimbang';
  const reserve = RESERVE[level] * (pers === 'agresif' ? 0.5 : pers === 'hemat' ? 1.8 : 1);
  const greed = pers === 'agresif' ? 1.25 : pers === 'hemat' ? 0.85 : 1;

  // jawab tawaran tukar: terima kalau nilai yang didapat > yang diberikan
  if (s.trade && s.trade.to === pid) return { pid, action: { type: wantsTrade(s, pid, level) ? 'acceptTrade' : 'rejectTrade' } };

  if (s.phase === 'auction' && s.auction) {
    const a = s.auction;
    const building = a.kind === 'house' || a.kind === 'hotel';
    // lelang bangunan: tawaran = harga tambahan; bot mau membayar sampai ~setengah biaya bangun
    const max = building
      ? Math.min(BOARD[a.tile].houseCost! * (level === 'hard' ? 0.7 : level === 'normal' ? 0.45 : 0.2) * greed, maxBid(s, pid) - reserve / 2)
      : Math.min(valueOf(s, pid, a.tile) * (level === 'easy' ? 0.7 : 1) * greed, me.cash - reserve / 2);
    const next = a.bid + (a.bid < 100 ? 10 : 20);
    if (next <= max) return { pid, action: { type: 'bid', amount: Math.floor(next) } };
    return { pid, action: { type: 'pass' } };
  }

  if (currentPlayer(s).id !== pid) return null;

  switch (s.phase) {
    case 'debt':
      return { pid, action: debtStep(s, pid) };
    case 'buy': {
      const price = BOARD[me.pos].price!;
      const want = valueOf(s, pid, me.pos) * greed >= price * (level === 'easy' ? 1.1 : 1);
      if (me.cash - price >= reserve && want) return { pid, action: { type: 'buy' } };
      if (me.cash - price >= 0 && valueOf(s, pid, me.pos) > price * 1.4) return { pid, action: { type: 'buy' } };
      return { pid, action: { type: 'decline' } };
    }
    case 'roll':
    case 'end': {
      // tawarkan beli petak terakhir yang melengkapi set (maks 1x per giliran, tiap 3 giliran)
      // bot Mudah tetap menawar (lebih jarang) — tanpa tukar, set warna tak pernah lengkap & game tak berujung
      if (s.phase === 'roll' && !s.rolled && s.turnCount % (level === 'easy' ? 7 : 3) === 0) {
        const lastTurn = [...s.events].reverse().find((e) => e.type === 'turn');
        const tradedThisTurn = s.events.some((e) => e.type === 'trade' && e.from === pid && lastTurn && e.seq > lastTurn.seq);
        if (!tradedThisTurn) {
          for (let g = 0; g < 8; g++) {
            const tiles = groupTiles(g);
            const missing = tiles.filter((i) => s.tiles[i].owner !== pid);
            if (missing.length === 0 || missing.length === tiles.length) continue;
            // beli dari satu pemilik dulu (set yang terpecah ke 3 orang dikumpulkan bertahap)
            const owner = s.tiles[missing[0]].owner;
            if (!owner || missing.some((i) => !s.tiles[i].owner) || tiles.some((t) => s.tiles[t].houses)) continue;
            const take = missing.filter((i) => s.tiles[i].owner === owner);
            // ke manusia: maksimal sekali tiap ~6 giliran supaya tidak spam
            if (!playerById(s, owner).bot && s.turnCount % 6 !== 0) continue;
            // makin lama game, makin berani bayar (mencegah papan buntu)
            const mult = ((level === 'hard' ? 2.2 : 2) + s.turnCount / 150) * (pers === 'hemat' ? 0.85 : pers === 'agresif' ? 1.1 : 1);
            const offer = Math.floor(take.reduce((a, i) => a + BOARD[i].price!, 0) * mult);
            if (me.cash - offer - tradeInterest(s, take) < reserve) continue;
            return { pid, action: { type: 'proposeTrade', trade: { to: owner, giveTiles: [], getTiles: take, giveCash: offer, getCash: 0 } } };
          }
        }
      }
      if (s.phase === 'roll' && me.inJail && !s.rolled) {
        if (me.jailFree > 0) return { pid, action: { type: 'useJailCard' } };
        // awal game keluar cepat (properti masih banyak), akhir game betah di penjara
        const free = s.tiles.filter((t, i) => isOwnable(i) && !t.owner).length;
        if (free > 8 && me.cash > 300) return { pid, action: { type: 'payBail' } };
      }
      // tebus gadai
      for (let i = 0; i < 40; i++)
        if (canUnmortgage(s, pid, i) && me.cash - reserve * 2 > BOARD[i].price!) return { pid, action: { type: 'unmortgage', tile: i } };
      // bangun rumah merata (yang paling sedikit rumahnya dulu)
      if (level !== 'easy') {
        const buildable = s.tiles
          .map((_, i) => i)
          .filter((i) => canBuild(s, pid, i) && me.cash - BOARD[i].houseCost! >= reserve)
          .sort((a, b) => s.tiles[a].houses - s.tiles[b].houses || BOARD[b].price! - BOARD[a].price!);
        if (buildable.length) return { pid, action: { type: 'build', tile: buildable[0] } };
      } else {
        const b = s.tiles.findIndex((_, i) => canBuild(s, pid, i) && me.cash - BOARD[i].houseCost! >= reserve * 3);
        if (b >= 0) return { pid, action: { type: 'build', tile: b } };
      }
      if (!s.rolled) return { pid, action: { type: 'roll' } };
      return { pid, action: { type: 'endTurn' } };
    }
    default:
      return null;
  }
}

/** Apakah bot mau menerima tawaran tukar yang sedang menunggu. */
function wantsTrade(s: GameState, pid: string, level: BotLevel): boolean {
  const t = s.trade!;
  const me = playerById(s, pid);
  // harus mampu bayar bunga 10% properti tergadai yang diterima
  if (me.cash - t.getCash + t.giveCash < tradeInterest(s, t.giveTiles)) return false;
  let gain = t.giveTiles.reduce((a, i) => a + valueOf(s, pid, i), 0) + t.giveCash + (t.giveJail ?? 0) * 50;
  let loss = t.getTiles.reduce((a, i) => a + valueOf(s, pid, i) * 1.1, 0) + t.getCash + (t.getJail ?? 0) * 50;
  gain -= tradeInterest(s, t.giveTiles);
  // jangan murah-murah melengkapi set warna lawan (itu yang bikin lawan bisa bangun rumah)
  if (level !== 'easy') {
    const after = (i: number) => (t.getTiles.includes(i) ? t.from : t.giveTiles.includes(i) ? pid : s.tiles[i].owner);
    const groups = new Set(t.getTiles.filter((i) => BOARD[i].kind === 'property').map((i) => BOARD[i].group!));
    for (const g of groups) {
      const tiles = groupTiles(g);
      if (tiles.every((i) => after(i) === t.from) && !ownsGroup(s, t.from, g)) {
        loss += tiles.reduce((a, i) => a + BOARD[i].price!, 0) * (level === 'hard' ? 1.6 : 1.1);
      }
    }
  }
  return gain > loss;
}

/** Satu langkah saat berutang: bayar, cairkan satu aset, atau bangkrut kalau memang tak sanggup. */
function debtStep(s: GameState, pid: string): Action {
  const me = playerById(s, pid);
  if (me.cash >= s.debt!.amount) return { type: 'payDebt' };
  if (!bankruptBlock(s, pid)) return { type: 'bankrupt' };
  const probe = structuredClone(s);
  autoLiquidate(probe, pid, s.debt!.amount);
  const ev = probe.events.find((e) => e.seq > s.seq && (e.type === 'sell' || e.type === 'mortgage'));
  if (ev && (ev.type === 'sell' || ev.type === 'mortgage')) return { type: ev.type, tile: ev.tile };
  return { type: 'bankrupt' };
}

/**
 * Aksi paling aman untuk siapa pun yang harus bertindak — dipakai saat pemain AFK/putus,
 * atau sebagai cadangan kalau aksi bot ditolak engine. Tidak pernah membeli, membangun, menawar, atau menerima tukar.
 */
export function safeAction(s: GameState): { pid: string; action: Action } | null {
  const pid = actorId(s);
  if (!pid) return null;
  if (s.trade) return { pid: s.trade.to, action: { type: 'rejectTrade' } };
  if (s.phase === 'auction') return { pid, action: { type: 'pass' } };
  switch (s.phase) {
    case 'buy':
      return { pid, action: { type: 'decline' } };
    case 'debt':
      return { pid, action: debtStep(s, pid) };
    case 'roll':
    case 'end':
      return { pid, action: { type: s.rolled ? 'endTurn' : 'roll' } };
    default:
      return null;
  }
}

export { ownsGroup };
