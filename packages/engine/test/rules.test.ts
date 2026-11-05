// Aturan Monopoli resmi yang ditambahkan/diperbaiki: utang, bangkrut ke bank (lelang), kartu bebas penjara, dll.
import { describe, expect, it } from 'vitest';
import {
  BOARD,
  applyAction,
  bankruptBlock,
  botAction,
  createGame,
  sanitizeOptions,
  changedOptions,
  DEFAULT_OPTIONS,
  taxFor,
  canBuild,
  bankStock,
  formatMoney,
  moneyUnit,
  THEMES,
  migrateState,
  publicState,
  safeAction,
  type GameState,
  type NewPlayer,
  buildBlock,
} from '../src';

const P = (n: number, bot = false): NewPlayer[] =>
  Array.from({ length: n }, (_, i) => ({ id: `p${i}`, name: `P${i}`, color: '#fff', token: i, bot }));
const own = (s: GameState, pid: string, tiles: number[]) => tiles.forEach((i) => (s.tiles[i].owner = pid));

/** Cari seed RNG yang membuat lemparan berikutnya menghasilkan kondisi tertentu. */
function rollUntil(s: GameState, pid: string, ok: (n: GameState) => boolean): GameState {
  for (let seed = 1; seed < 20000; seed++) {
    const n = applyAction({ ...structuredClone(s), rng: seed }, pid, { type: 'roll' });
    if (ok(n)) return n;
  }
  throw new Error('tidak ketemu seed');
}

const bankStockOf = (s: GameState) => bankStock(s).houses;

describe('utang', () => {
  it('pajak yang dibayar lewat utang tetap masuk pot parkir', () => {
    const s = createGame(P(2), 1, { freeParkingPot: true });
    s.players[0].cash = 100;
    own(s, 'p0', [39]);
    let n = rollUntil(s, 'p0', (x) => x.players[0].pos === 4 && x.phase === 'debt');
    expect(n.debt).toMatchObject({ amount: 200, creditor: null, reason: 'tax' });
    n = applyAction(n, 'p0', { type: 'mortgage', tile: 39 });
    n = applyAction(n, 'p0', { type: 'payDebt' });
    expect(n.pot).toBe(200);
    expect(n.phase).toBe('end');
  });

  it('sewa yang dibayar lewat utang tercatat di statistik', () => {
    const s = createGame(P(2), 1);
    s.players[0].cash = 1;
    own(s, 'p0', [39]);
    own(s, 'p1', [1, 3]);
    let n = rollUntil(s, 'p0', (x) => x.players[0].pos === 3 && x.phase === 'debt');
    n = applyAction(n, 'p0', { type: 'mortgage', tile: 39 });
    n = applyAction(n, 'p0', { type: 'payDebt' });
    expect(n.players[1].stats.rentIn).toBe(8);
    expect(n.players[0].stats.rentOut).toBe(8);
  });

  it('tidak boleh bangkrut kalau aset masih cukup; boleh tukar saat berutang', () => {
    const s = createGame(P(2), 1);
    s.players[0].cash = 10;
    own(s, 'p0', [39]);
    own(s, 'p1', [1]);
    s.phase = 'debt';
    s.debt = { amount: 100, creditor: 'p1', reason: 'rent' };
    expect(bankruptBlock(s, 'p0')).toMatch(/gadai/);
    expect(() => applyAction(s, 'p0', { type: 'bankrupt' })).toThrow();
    const t = applyAction(s, 'p0', { type: 'proposeTrade', trade: { to: 'p1', giveTiles: [39], getTiles: [], giveCash: 0, getCash: 300 } });
    const u = applyAction(t, 'p1', { type: 'acceptTrade' });
    expect(u.players[0].cash).toBe(310);
    expect(u.phase).toBe('debt');
    expect(() => applyAction(u, 'p0', { type: 'build', tile: 1 })).toThrow();
  });

  it('kartu "bayar ke tiap pemain" saat uang kurang → utang dibagi rata ke tiap pemain', () => {
    const s = createGame(P(3), 1);
    s.players[0].cash = 20;
    own(s, 'p0', [39]);
    s.decks.chance = ['c14', ...s.decks.chance.filter((c) => c !== 'c14')];
    s.players[0].pos = 7 - 7; // dari START, cari lemparan 7 (Kesempatan)
    let n = rollUntil(s, 'p0', (x) => x.players[0].pos === 7);
    expect(n.debt).toMatchObject({ amount: 100, split: ['p1', 'p2'] });
    n = applyAction(n, 'p0', { type: 'mortgage', tile: 39 });
    n = applyAction(n, 'p0', { type: 'payDebt' });
    expect(n.players[1].cash).toBe(1550);
    expect(n.players[2].cash).toBe(1550);
  });
});

describe('bangkrut', () => {
  it('bangkrut ke bank → semua properti dilelang, lalu giliran lanjut', () => {
    const s = createGame(P(3), 1);
    s.players[0].cash = 0;
    own(s, 'p0', [1, 3]);
    s.tiles[1].mortgaged = true;
    s.tiles[3].mortgaged = true;
    s.phase = 'debt';
    s.debt = { amount: 500, creditor: null, reason: 'tax' };
    let n = applyAction(s, 'p0', { type: 'bankrupt' });
    expect(n.players[0].bankrupt).toBe(true);
    expect(n.phase).toBe('auction');
    expect(n.auction!.tile).toBe(1);
    expect(n.tiles[1]).toMatchObject({ owner: null, mortgaged: false });
    n = applyAction(n, 'p1', { type: 'bid', amount: 30 });
    n = applyAction(n, 'p2', { type: 'pass' });
    expect(n.tiles[1].owner).toBe('p1');
    expect(n.auction!.tile).toBe(3); // lelang berikutnya
    n = applyAction(n, 'p1', { type: 'pass' });
    n = applyAction(n, 'p2', { type: 'pass' });
    expect(n.tiles[3].owner).toBe(null);
    expect(n.phase).toBe('roll');
    expect(n.players[n.current].id).toBe('p1');
  });

  it('bangkrut ke pemain: kreditor bayar bunga 10% properti tergadai, kartu bebas penjara ikut pindah', () => {
    const s = createGame(P(3), 1);
    s.players[0].cash = 5;
    s.players[0].jailCards = ['chance'];
    s.players[0].jailFree = 1;
    own(s, 'p0', [39]);
    s.tiles[39].mortgaged = true;
    s.phase = 'debt';
    s.debt = { amount: 900, creditor: 'p1', reason: 'rent' };
    const n = applyAction(s, 'p0', { type: 'bankrupt' });
    expect(n.tiles[39].owner).toBe('p1');
    expect(n.players[1].cash).toBe(1500 + 5 - 20); // +sisa uang − bunga 10% dari 200
    expect(n.players[1].jailFree).toBe(1);
    expect(n.phase).toBe('roll');
  });
});

describe('penjara & kartu', () => {
  it('kartu bebas penjara keluar dari dek saat dipegang & kembali saat dipakai', () => {
    const s = createGame(P(2), 1);
    s.decks.community = ['d5', ...s.decks.community.filter((c) => c !== 'd5')];
    let n = rollUntil(s, 'p0', (x) => x.players[0].pos === 2);
    expect(n.players[0].jailFree).toBe(1);
    expect(n.decks.community).not.toContain('d5');
    n.players[0].inJail = true;
    n.phase = 'roll';
    n.rolled = false;
    n = applyAction(n, 'p0', { type: 'useJailCard' });
    expect(n.players[0].jailFree).toBe(0);
    expect(n.decks.community.at(-1)).toBe('d5');
  });

  it('kartu bebas penjara bisa ditukar', () => {
    let s = createGame(P(2), 1);
    s.players[0].jailCards = ['chance'];
    s.players[0].jailFree = 1;
    s = applyAction(s, 'p0', { type: 'proposeTrade', trade: { to: 'p1', giveTiles: [], getTiles: [], giveCash: 0, getCash: 50, giveJail: 1 } });
    s = applyAction(s, 'p1', { type: 'acceptTrade' });
    expect(s.players[1].jailCards).toEqual(['chance']);
    expect(s.players[0].cash).toBe(1550);
  });

  it('gagal double 3x di penjara tanpa uang: setelah denda dilunasi, bidak tetap jalan', () => {
    const s = createGame(P(2), 1);
    const p = s.players[0];
    Object.assign(p, { pos: 10, inJail: true, jailTurns: 2, cash: 10 });
    own(s, 'p0', [39]);
    let n = rollUntil(s, 'p0', (x) => x.phase === 'debt');
    expect(n.players[0].pos).toBe(10);
    const total = n.dice[0] + n.dice[1];
    n = applyAction(n, 'p0', { type: 'mortgage', tile: 39 });
    n = applyAction(n, 'p0', { type: 'payDebt' });
    expect(n.players[0].pos).toBe(10 + total);
    expect(n.players[0].inJail).toBe(false);
  });

  it('kartu utilitas terdekat: lempar dadu lagi, bayar 10x', () => {
    const s = createGame(P(2), 1);
    own(s, 'p1', [12]);
    s.decks.chance = ['c5', ...s.decks.chance.filter((c) => c !== 'c5')];
    const n = rollUntil(s, 'p0', (x) => x.players[0].pos === 12 && x.events.filter((e) => e.type === 'dice').length >= 2);
    const dice = n.events.filter((e) => e.type === 'dice');
    const last = dice.at(-1)!;
    const paid = n.events.find((e) => e.type === 'pay' && e.reason === 'rent');
    expect(last.type === 'dice' && paid?.type === 'pay' && paid.amount).toBe(last.type === 'dice' ? (last.dice[0] + last.dice[1]) * 10 : -1);
  });

  it('dek Kesempatan punya 16 kartu (2 kartu stasiun terdekat)', () => {
    const s = createGame(P(2), 1);
    expect(s.decks.chance).toHaveLength(16);
    expect(s.decks.community).toHaveLength(16);
  });
});

describe('online & AFK', () => {
  it('publicState menyembunyikan seed & urutan dek', () => {
    const s = createGame(P(2), 1234);
    const p = publicState(s);
    expect(p.rng).toBe(0);
    expect(p.decks.chance).toEqual([]);
    expect(s.rng).not.toBe(0);
  });

  it('safeAction tidak pernah membeli, menawar, atau menerima tukar', () => {
    let s = createGame(P(2), 1);
    own(s, 'p0', [1]);
    s.current = 1;
    s = applyAction(s, 'p1', { type: 'proposeTrade', trade: { to: 'p0', giveTiles: [], getTiles: [1], giveCash: 1000, getCash: 0 } });
    expect(safeAction(s)!.action.type).toBe('rejectTrade');
    const b = createGame(P(2), 1);
    b.phase = 'buy';
    b.players[0].pos = 1;
    expect(safeAction(b)!.action.type).toBe('decline');
  });

  it('migrateState melengkapi save lama', () => {
    const s = createGame(P(2), 1) as unknown as Record<string, unknown>;
    delete s.schema;
    delete s.auctionQueue;
    delete s.afterAuction;
    const players = s.players as Record<string, unknown>[];
    delete players[0].jailCards;
    players[0].jailFree = 1;
    (s.decks as { chance: string[] }).chance = (s.decks as { chance: string[] }).chance.filter((c) => c !== 'c16');
    const m = migrateState(s);
    expect(m.auctionQueue).toEqual([]);
    expect(m.players[0].jailCards).toHaveLength(1);
    expect(m.decks.chance).toContain('c16');
    expect(m.decks.chance.filter((c) => c === 'c7')).toHaveLength(0);
    expect(() => migrateState({ foo: 1 })).toThrow();
  });
});

describe('bot', () => {
  it('bot tidak murah-murah melengkapi set lawan', () => {
    let s = createGame([{ id: 'h', name: 'H', color: '#f00', token: 0 }, { id: 'b', name: 'B', color: '#0f0', token: 1, bot: true }], 1);
    own(s, 'h', [37]);
    own(s, 'b', [39]);
    s = applyAction(s, 'h', { type: 'proposeTrade', trade: { to: 'b', giveTiles: [], getTiles: [39], giveCash: 800, getCash: 0 } });
    expect(botAction(s, 'hard')!.action.type).toBe('rejectTrade');
  });

  it('150 game bot penuh: kartu & uang konsisten, tidak macet, semua aksi valid', () => {
    let finished = 0;
    for (let g = 0; g < 150; g++) {
      let s = createGame(P(2 + (g % 5), true), g * 104729 + 7, { freeParkingPot: g % 2 === 0, doubleGo: g % 3 === 0 });
      let steps = 0;
      while (s.phase !== 'gameover' && steps++ < 8000) {
        const b = botAction(s, (['easy', 'normal', 'hard'] as const)[g % 3])!;
        s = applyAction(s, b.pid, b.action);
        for (const p of s.players) if (!p.bankrupt && p.cash < 0) throw new Error(`cash negatif game ${g}`);
        const held = s.players.reduce((a, p) => a + p.jailCards.length, 0);
        if (s.decks.chance.length + s.decks.community.length + held !== 32) throw new Error(`jumlah kartu salah game ${g}`);
        for (let i = 0; i < 40; i++) if (s.tiles[i].houses && BOARD[i].kind !== 'property') throw new Error('rumah di non-properti');
      }
      if (s.phase === 'gameover') finished++;
    }
    // seperti Monopoli sungguhan, kadang terjadi buntu (dua pemain kaya raya & stok rumah habis) — itu gunanya mode N ronde
    expect(finished).toBeGreaterThanOrEqual(148);
  }, 120000);
});

describe('uang realistis per negara', () => {
  const th = (id: string) => THEMES.find((t) => t.id === id)!;
  // Intl memakai spasi tak-putus (NBSP) supaya angka & satuan tidak terpisah baris
  const fm = (t: Parameters<typeof formatMoney>[0], u: number) => formatMoney(t, u).replace(/\u00a0/g, ' ');
  it('nominal sesuai mata uang asli & ditulis ringkas', () => {
    expect(fm(th('indonesia'), 1500)).toBe('Rp1,5 M');
    expect(fm(th('indonesia'), 400)).toBe('Rp400 jt');
    expect(fm(th('indonesia'), 1537)).toBe('Rp1,537 M'); // tetap tepat, tidak dibulatkan
    expect(fm(th('indonesia'), -50)).toBe('−Rp50 jt');
    expect(fm(th('usa'), 2000)).toBe('$111K');
    expect(fm(th('uk'), 2000)).toBe('£83K');
  });
  it('nilai uang setara Rupiah di semua negara (Rp2 M di Indonesia = nilai yang sama di UK)', () => {
    // kurs ±: $1 = Rp18.032, £1 = Rp24.110, ¥1 = Rp114,35, ₽1 = Rp216
    const rupiah = { usa: 18_032, uk: 24_110, japan: 114.35, russia: 216 } as const;
    for (const [id, rate] of Object.entries(rupiah)) {
      const c = th(id).currency;
      const inRupiah = 2000 * c.multiplier * rate; // 2000 satuan = Rp2 M
      expect(Math.abs(inRupiah / 2e9 - 1), id).toBeLessThan(0.01);
    }
  });
  it('tema kustom versi lama (tanpa compact) tetap tampil seperti dulu', () => {
    const old = { ...th('indonesia'), currency: { symbol: 'Rp', suffix: 'rb', multiplier: 10, locale: 'id-ID' } };
    expect(fm(old, 1500)).toBe('Rp15.000rb');
    expect(moneyUnit(old)).toEqual({ before: 'Rp', after: 'rb', step: 10 });
  });
  it('kolom isian uang memakai satuan tampilan', () => {
    expect(moneyUnit(th('indonesia'))).toEqual({ before: 'Rp', after: 'jt', step: 1 });
    expect(moneyUnit(th('usa'))).toEqual({ before: '$', after: 'K', step: 0.0555 });
    expect(moneyUnit(th('ninja'))).toEqual({ before: '', after: 'K 両', step: 1 });
  });
});

describe('pengaturan aturan main', () => {
  it('bawaan = aturan resmi', () => {
    expect(DEFAULT_OPTIONS).toMatchObject({ startCash: 1500, goSalary: 200, jailFine: 50, auctions: true, evenBuild: true, limitedBuildings: true, rentInJail: true, freeParkingPot: false, doubleGo: false });
    expect(changedOptions(createGame(P(2), 1).options)).toEqual([]);
  });
  it('nilai aneh dari luar dipotong ke batas aman', () => {
    const o = sanitizeOptions({ startCash: 999999, goSalary: -5, jailFine: 'x', incomeTax: 'bebas', auctions: 0 });
    expect(o.startCash).toBe(5000);
    expect(o.goSalary).toBe(0);
    expect(o.jailFine).toBe(50);
    expect(o.incomeTax).toBe('flat');
    expect(o.auctions).toBe(false);
  });
  it('modal & gaji START mengikuti pengaturan', () => {
    let s = createGame(P(2), 1, { startCash: 2500, goSalary: 300 });
    expect(s.players[0].cash).toBe(2500);
    s.players[0].pos = 39;
    s = applyAction(s, 'p0', { type: 'roll' });
    expect(s.players[0].cash).toBe(2800);
  });
  it('tanpa lelang: tolak beli → petak tetap milik bank', () => {
    let s = createGame(P(2), 1, { auctions: false });
    s.phase = 'buy';
    s.players[0].pos = 39;
    s = applyAction(s, 'p0', { type: 'decline' });
    expect(s.phase).toBe('end');
    expect(s.tiles[39].owner).toBeNull();
  });
  it('denda penjara sesuai pengaturan', () => {
    let s = createGame(P(2), 1, { jailFine: 100 });
    Object.assign(s.players[0], { inJail: true, pos: 10 });
    s = applyAction(s, 'p0', { type: 'payBail' });
    expect(s.players[0].cash).toBe(1400);
  });
  it('pemilik di penjara tidak menagih sewa kalau aturannya dimatikan', () => {
    const s = createGame(P(2), 1, { rentInJail: false });
    own(s, 'p1', [1, 3]);
    s.players[1].inJail = true;
    const n = rollUntil(s, 'p0', (x) => x.players[0].pos === 3);
    expect(n.events.some((e) => e.type === 'pay' && e.reason === 'rent')).toBe(false);
  });
  it('bangun merata selalu wajib (opsi lama evenBuild: false diabaikan) & stok tak terbatas', () => {
    const s = createGame(P(2), 1, { evenBuild: false, limitedBuildings: false });
    expect(s.options.evenBuild).toBe(true);
    own(s, 'p0', [1, 3]);
    s.tiles[1].houses = 1;
    expect(canBuild(s, 'p0', 1)).toBe(false); // harus bangun di 3 dulu
    expect(canBuild(s, 'p0', 3)).toBe(true);
    s.tiles.forEach((t, i) => i > 5 && (t.houses = 4));
    expect(canBuild(s, 'p0', 3)).toBe(true); // stok resmi sudah habis, tapi stok tak terbatas
  });
  it('aturan bangun resmi: set lengkap, satu per satu, merata, hotel setelah 4 rumah di semua petak set', () => {
    const s = createGame(P(2), 1);
    own(s, 'p0', [21, 23]); // merah belum lengkap (24 milik bank)
    expect(buildBlock(s, 'p0', 21)).toBe('Harus punya satu set warna lengkap');
    own(s, 'p0', [24]);
    expect(canBuild(s, 'p0', 21)).toBe(true); // tidak perlu mendarat di sana
    s.tiles[21].houses = 4;
    s.tiles[23].houses = 4;
    s.tiles[24].houses = 3;
    expect(buildBlock(s, 'p0', 21)).toBe('Bangun merata dulu di petak lain'); // 24 belum 4 rumah
    s.tiles[24].houses = 4;
    expect(canBuild(s, 'p0', 21)).toBe(true); // semua 4 rumah → boleh hotel
  });
  it('pajak penghasilan klasik: 10% kekayaan atau 200, mana yang lebih kecil', () => {
    const s = createGame(P(2), 1, { incomeTax: 'classic' });
    expect(taxFor(s, 'p0', 4)).toBe(150);
    s.players[0].cash = 5000;
    expect(taxFor(s, 'p0', 4)).toBe(200);
    expect(taxFor(s, 'p0', 38)).toBe(100); // pajak barang mewah tetap
  });
  it('jackpot parkir bebas terisi di awal & diisi ulang', () => {
    const s = createGame(P(2), 1, { freeParkingPot: true, freeParkingStart: 500 });
    expect(s.pot).toBe(500);
    s.players[0].pos = 15;
    const n = rollUntil(s, 'p0', (x) => x.players[0].pos === 20);
    expect(n.players[0].cash).toBe(2000);
    expect(n.pot).toBe(500);
  });
  it('permainan singkat: 2 properti dibagi & dibayar di awal, selesai saat pemain kedua bangkrut', () => {
    let s = createGame(P(4), 3, { shortGame: true });
    for (const p of s.players) {
      const mine = s.tiles.map((t, i) => (t.owner === p.id ? i : -1)).filter((i) => i >= 0);
      expect(mine).toHaveLength(2);
      expect(p.cash).toBe(1500 - mine.reduce((a, i) => a + BOARD[i].price!, 0));
    }
    s.players[1].bankrupt = true;
    s.players[0].cash = 0;
    s.phase = 'debt';
    s.debt = { amount: 99999, creditor: 'p2', reason: 'rent' };
    s.tiles.forEach((t) => t.owner === 'p0' && (t.mortgaged = true));
    s = applyAction(s, 'p0', { type: 'bankrupt' });
    expect(s.phase).toBe('gameover');
    expect(s.endReason).toBe('short');
  });
  it('bot tetap bisa menyelesaikan game dengan aturan rumah apa pun', () => {
    for (let g = 0; g < 24; g++) {
      const opts = sanitizeOptions({
        auctions: g % 2 === 0, evenBuild: g % 3 !== 0, limitedBuildings: g % 4 !== 0, rentInJail: g % 5 !== 0,
        incomeTax: g % 2 ? 'classic' : 'flat', freeParkingPot: g % 3 === 0, freeParkingStart: (g % 3) * 250,
        shortGame: g % 6 === 0, startCash: 1000 + (g % 4) * 500, goSalary: 100 + (g % 4) * 100, maxRounds: 60,
      });
      let s = createGame(P(2 + (g % 4), true), g * 31 + 5, opts);
      let n = 0;
      while (s.phase !== 'gameover' && n++ < 8000) {
        const b = botAction(s, 'normal')!;
        s = applyAction(s, b.pid, b.action);
      }
      expect(s.phase, `game ${g}`).toBe('gameover');
    }
  }, 120000);
});

describe('aturan resmi tambahan', () => {
  it('bangun & tukar di luar giliran (di antara giliran pemain lain)', () => {
    let s = createGame(P(2), 1);
    own(s, 'p1', [1, 3]);
    s = applyAction(s, 'p1', { type: 'build', tile: 1 }); // giliran p0, p1 membangun
    expect(s.tiles[1].houses).toBe(1);
    own(s, 'p0', [39]);
    s = applyAction(s, 'p1', { type: 'proposeTrade', trade: { to: 'p0', giveTiles: [], getTiles: [39], giveCash: 500, getCash: 0 } });
    expect(s.trade?.from).toBe('p1');
    s.trade = null;
    s.phase = 'buy';
    expect(() => applyAction(s, 'p1', { type: 'build', tile: 3 })).toThrow(); // tidak saat pemain lain sedang membeli
  });

  it('tawar balik: penerima mengajukan syarat baru, arah dibalik', () => {
    let s = createGame(P(2), 1);
    own(s, 'p0', [1]);
    own(s, 'p1', [3]);
    s = applyAction(s, 'p0', { type: 'proposeTrade', trade: { to: 'p1', giveTiles: [], getTiles: [3], giveCash: 50, getCash: 0 } });
    s = applyAction(s, 'p1', { type: 'counterTrade', trade: { giveTiles: [3], getTiles: [], giveCash: 0, getCash: 200 } });
    expect(s.trade).toMatchObject({ from: 'p1', to: 'p0', giveTiles: [3], getCash: 200 });
    expect(s.events.at(-1)).toMatchObject({ type: 'trade', counter: true });
    s = applyAction(s, 'p0', { type: 'acceptTrade' });
    expect(s.tiles[3].owner).toBe('p0');
    expect(s.players[0].cash).toBe(1300);
  });

  it('kekurangan rumah: stok lebih sedikit dari peminat → dilelang, pemenang bayar biaya + tawaran', () => {
    let s = createGame(P(2), 1);
    own(s, 'p0', [1, 3]);
    own(s, 'p1', [6, 8, 9]);
    // habiskan stok rumah bank sampai tersisa 1 (grup lain milik "bank" — tidak dihitung pemain)
    let left = 32;
    for (const i of [11, 13, 14, 16, 18, 19, 21, 23, 24, 26, 27, 29]) {
      const n = Math.min(4, left - 1);
      s.tiles[i].houses = n;
      left -= n;
      if (left <= 1) break;
    }
    expect(bankStockOf(s)).toBe(1);
    s = applyAction(s, 'p0', { type: 'build', tile: 1 });
    expect(s.phase).toBe('auction');
    expect(s.auction).toMatchObject({ kind: 'house', bidder: 'p0', bid: 0 });
    s = applyAction(s, 'p1', { type: 'bid', amount: 20 });
    s = applyAction(s, 'p0', { type: 'pass' });
    expect(s.phase).toBe('roll');
    const built = [6, 8, 9].find((i) => s.tiles[i].houses === 1)!;
    expect(built).toBeDefined();
    expect(s.players[1].cash).toBe(1500 - BOARD[built].houseCost! - 20);
  });
});
