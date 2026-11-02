import { describe, expect, it } from 'vitest';
import {
  BOARD,
  THEMES,
  applyAction,
  actorId,
  botAction,
  canBuild,
  createGame,
  ranking,
  bankStock,
  buildBlock,
  quipsFor,
  rentFor,
  validateTheme,
  tileName,
  cardText,
  type GameState,
  type NewPlayer,
} from '../src';

const P = (n: number, bot = false): NewPlayer[] =>
  Array.from({ length: n }, (_, i) => ({ id: `p${i}`, name: `P${i}`, color: '#fff', token: i, bot }));

const own = (s: GameState, pid: string, tiles: number[]) => tiles.forEach((i) => (s.tiles[i].owner = pid));

describe('aturan', () => {
  it('lempar dadu, gerak, beli properti', () => {
    let s = createGame(P(2), 1);
    // paksa posisi supaya mendarat di properti 1 (Mediterranean slot)
    s.players[0].pos = 39;
    s = applyAction(s, 'p0', { type: 'roll' });
    const p = s.players[0];
    expect(p.pos).toBe((39 + s.dice[0] + s.dice[1]) % 40);
    expect(p.cash).toBe(1700); // lewat START
  });

  it('beli lalu lawan bayar sewa (set lengkap 2x)', () => {
    let s = createGame(P(2), 7);
    own(s, 'p1', [1, 3]);
    expect(rentFor(s, 1, 7)).toBe(4);
    s.tiles[1].houses = 2;
    expect(rentFor(s, 1, 7)).toBe(30);
  });

  it('bangun harus merata & punya set', () => {
    const s = createGame(P(2), 3);
    own(s, 'p0', [1]);
    expect(canBuild(s, 'p0', 1)).toBe(false);
    own(s, 'p0', [3]);
    expect(canBuild(s, 'p0', 1)).toBe(true);
    const s2 = applyAction(s, 'p0', { type: 'build', tile: 1 });
    expect(canBuild(s2, 'p0', 1)).toBe(false); // harus bangun di 3 dulu
    expect(canBuild(s2, 'p0', 3)).toBe(true);
  });

  it('tolak beli kalau bukan gilirannya', () => {
    const s = createGame(P(2), 1);
    expect(() => applyAction(s, 'p1', { type: 'roll' })).toThrow();
  });

  it('tolak beli → lelang, pemenang bayar tawaran', () => {
    let s = createGame(P(3), 1);
    s.phase = 'buy';
    s.players[0].pos = 39;
    s = applyAction(s, 'p0', { type: 'decline' });
    expect(s.phase).toBe('auction');
    s = applyAction(s, 'p0', { type: 'bid', amount: 50 });
    s = applyAction(s, 'p1', { type: 'bid', amount: 60 });
    s = applyAction(s, 'p2', { type: 'pass' });
    s = applyAction(s, 'p0', { type: 'pass' });
    expect(s.phase).toBe('end');
    expect(s.tiles[39].owner).toBe('p1');
    expect(s.players[1].cash).toBe(1440);
  });

  it('utang tak terbayar → bangkrut, aset ke kreditor, game selesai', () => {
    let s = createGame(P(2), 1);
    s.players[0].cash = 10;
    own(s, 'p0', [5]);
    s.phase = 'debt';
    s.debt = { amount: 500, creditor: 'p1', reason: 'rent' };
    s = applyAction(s, 'p0', { type: 'bankrupt' });
    expect(s.players[0].bankrupt).toBe(true);
    expect(s.tiles[5].owner).toBe('p1');
    expect(s.phase).toBe('gameover');
    expect(s.winner).toBe('p1');
  });

  it('tukar properti + uang', () => {
    let s = createGame(P(2), 1);
    own(s, 'p0', [1]);
    own(s, 'p1', [3]);
    s = applyAction(s, 'p0', { type: 'proposeTrade', trade: { to: 'p1', giveTiles: [1], getTiles: [3], giveCash: 100, getCash: 0 } });
    expect(actorId(s)).toBe('p1');
    s = applyAction(s, 'p1', { type: 'acceptTrade' });
    expect(s.tiles[1].owner).toBe('p1');
    expect(s.tiles[3].owner).toBe('p0');
    expect(s.players[0].cash).toBe(1400);
  });

  it('deterministik: seed sama = hasil sama', () => {
    const run = () => {
      let s = createGame(P(2), 42);
      s = applyAction(s, 'p0', { type: 'roll' });
      return s.dice;
    };
    expect(run()).toEqual(run());
  });
});

describe('aturan resmi', () => {
  it('stok rumah bank terbatas 32 — habis = tidak bisa bangun', () => {
    const s = createGame(P(2), 3);
    own(s, 'p0', [1, 3]);
    s.players[0].cash = 99999;
    // isi papan dengan 32 rumah di properti lawan (simulasi stok habis)
    let left = 32;
    for (let i = 0; i < 40 && left > 0; i++)
      if (BOARD[i].kind === 'property' && ![1, 3].includes(i)) {
        s.tiles[i].owner = 'p1';
        s.tiles[i].houses = Math.min(4, left);
        left -= s.tiles[i].houses;
      }
    expect(bankStock(s).houses).toBe(0);
    expect(buildBlock(s, 'p0', 1)).toBe('Rumah di bank habis');
  });
  it('jual hotel → kembali jadi 4 rumah, dapat setengah harga 1 bangunan', () => {
    let s = createGame(P(2), 3);
    own(s, 'p0', [1, 3]);
    s.tiles[1].houses = 5;
    s.tiles[3].houses = 4;
    const cash = s.players[0].cash;
    s = applyAction(s, 'p0', { type: 'sell', tile: 1 });
    expect(s.tiles[1].houses).toBe(4);
    expect(s.players[0].cash).toBe(cash + 25);
  });
  it('tukar properti tergadai: penerima bayar bunga 10%', () => {
    let s = createGame(P(2), 3);
    own(s, 'p0', [39]);
    s.tiles[39].mortgaged = true;
    s = applyAction(s, 'p0', { type: 'proposeTrade', trade: { to: 'p1', giveTiles: [39], getTiles: [], giveCash: 0, getCash: 100 } });
    s = applyAction(s, 'p1', { type: 'acceptTrade' });
    // gadai 200 → bunga 20
    expect(s.players[1].cash).toBe(1500 - 100 - 20);
    expect(s.tiles[39].owner).toBe('p1');
  });
  it('celetukan bot muncul dari event', () => {
    let s = createGame(P(2, true), 3);
    let quips = 0;
    for (let k = 0; k < 400 && s.phase !== 'gameover'; k++) {
      const b = botAction(s)!;
      const n = applyAction(s, b.pid, b.action);
      quips += quipsFor(n, n.events.filter((e) => e.seq > s.seq)).length;
      s = n;
    }
    expect(quips).toBeGreaterThan(3);
  });
});

describe('fitur ronde & statistik', () => {
  it('batas ronde: game selesai, pemenang = kekayaan terbesar', () => {
    let s = createGame(P(3, true), 5, { maxRounds: 3 });
    let n = 0;
    while (s.phase !== 'gameover' && n++ < 2000) {
      const b = botAction(s)!;
      s = applyAction(s, b.pid, b.action);
    }
    expect(s.phase).toBe('gameover');
    expect(s.round).toBeLessThanOrEqual(3);
    if (s.endReason === 'rounds') {
      expect(s.round).toBe(3);
      expect(s.winner).toBe(ranking(s)[0].id);
    }
  });
  it('statistik sewa tercatat di kedua pihak', () => {
    let s = createGame(P(2), 9);
    // p0 memiliki semua petak beli → p1 pasti bayar sewa (kecuali mendarat di petak khusus)
    for (let i = 0; i < 40; i++) if (BOARD[i].price) s.tiles[i].owner = 'p0';
    s.current = 1;
    for (let seed = 1; seed < 100; seed++) {
      const t = applyAction({ ...s, rng: seed }, 'p1', { type: 'roll' });
      if (t.events.some((e) => e.type === 'pay' && e.reason === 'rent')) {
        expect(t.players[0].stats.rentIn).toBeGreaterThan(0);
        expect(t.players[1].stats.rentOut).toBe(t.players[0].stats.rentIn);
        return;
      }
    }
    throw new Error('tidak pernah kena sewa');
  });
});

describe('tema', () => {
  it('semua tema bawaan valid & lengkap', () => {
    for (const t of THEMES) {
      expect(validateTheme(t), t.id).toEqual([]);
      for (let i = 0; i < 40; i++) expect(tileName(t, i)).toBeTruthy();
    }
  });
  it('teks kartu memakai mata uang & nama petak tema', () => {
    const id = THEMES.find((t) => t.id === 'indonesia')!;
    expect(cardText(id, 'c13', 'Maju ke {t:39}. {m:200}').replace(/\u00a0/g, ' ')).toBe('Maju ke Jakarta. Rp200 jt');
  });
  it('tema kustom rusak ditolak', () => {
    expect(validateTheme({ id: 'X X' }).length).toBeGreaterThan(0);
  });
});

describe('simulasi bot', () => {
  it('40 game penuh bot vs bot tanpa error & tanpa macet', () => {
    let finished = 0;
    for (let g = 0; g < 40; g++) {
      const n = 2 + (g % 5);
      let s = createGame(P(n, true), g * 7919 + 1);
      const totalStart = s.players.reduce((a, p) => a + p.cash, 0);
      let steps = 0;
      while (s.phase !== 'gameover' && steps < 5000) {
        const b = botAction(s, (['easy', 'normal', 'hard'] as const)[g % 3]);
        if (!b) throw new Error(`bot tidak punya aksi di fase ${s.phase} game ${g}`);
        s = applyAction(s, b.pid, b.action);
        for (const p of s.players) if (!p.bankrupt && p.cash < 0) throw new Error(`cash negatif ${p.id} game ${g}`);
        for (let i = 0; i < 40; i++) {
          const t = s.tiles[i];
          if (t.houses && BOARD[i].kind !== 'property') throw new Error('rumah di non-properti');
          if (t.owner && s.players.find((p) => p.id === t.owner)!.bankrupt) throw new Error('pemilik bangkrut');
        }
        steps++;
      }
      if (s.phase === 'gameover') finished++;
      expect(totalStart).toBeGreaterThan(0);
    }
    // sebagian game bisa sangat panjang; mayoritas harus selesai
    expect(finished).toBe(40);
  });
});
