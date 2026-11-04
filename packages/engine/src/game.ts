// Mesin aturan Monopoli. Murni & deterministik: applyAction(state, playerId, action) -> state baru.
// Server online & mode lokal memakai fungsi yang sama, jadi aturan tidak bisa beda.

import { BOARD, GROUP_COUNT, JAIL_INDEX, STATION_RENT, groupTiles, isOwnable } from './board';
import { CHANCE, COMMUNITY, buildCustomDecks, type CardDef, type CustomDecks } from './cards';

export type Phase = 'roll' | 'buy' | 'auction' | 'debt' | 'end' | 'gameover';

export interface Player {
  id: string;
  name: string;
  color: string;
  token: number;
  cash: number;
  pos: number;
  inJail: boolean;
  jailTurns: number;
  /** jumlah kartu bebas penjara (= jailCards.length, disimpan untuk UI) */
  jailFree: number;
  /** asal dek tiap kartu bebas penjara yang dipegang — kartu dikembalikan ke dek ini saat dipakai */
  jailCards: Deck[];
  bankrupt: boolean;
  bot: boolean;
  /** gaya main bot (juga dipakai UI untuk celetukan) */
  persona: Persona;
  stats: PlayerStats;
}

export type Persona = 'agresif' | 'hemat' | 'seimbang';
export type Deck = 'chance' | 'community';

/** Stok bank resmi: 32 rumah, 12 hotel. */
export const HOUSE_STOCK = 32;
export const HOTEL_STOCK = 12;

export interface PlayerStats {
  rentIn: number;
  rentOut: number;
  bought: number;
  laps: number;
  jailed: number;
  built: number;
}

export interface TileState {
  owner: string | null;
  houses: number; // 0..4, 5 = hotel
  mortgaged: boolean;
}

export interface Trade {
  from: string;
  to: string;
  giveTiles: number[];
  getTiles: number[];
  giveCash: number;
  getCash: number;
  /** kartu bebas penjara yang ikut ditukar (aturan resmi: boleh dijual/ditukar) */
  giveJail?: number;
  getJail?: number;
}

export interface Auction {
  tile: number;
  bid: number;
  bidder: string | null;
  active: string[]; // pemain yang masih ikut, urut giliran
  turn: number; // indeks ke active
  /**
   * 'property' = lelang petak (bawaan). 'house' / 'hotel' = lelang bangunan saat stok bank menipis (aturan resmi):
   * tawaran = harga tambahan di atas biaya bangun normal; yang meminta bangun ikut dengan tawaran awal 0.
   */
  kind?: 'property' | 'house' | 'hotel';
  /** fase yang dilanjutkan setelah lelang bangunan selesai */
  resume?: Phase;
}

export interface Debt {
  amount: number;
  creditor: string | null; // null = bank
  /** alasan asli (rent/tax/card) — supaya statistik & pot parkir tetap benar walau dibayar lewat utang */
  reason: string;
  /** kartu "bayar ke tiap pemain": jumlah dibagi rata ke pemain-pemain ini */
  split?: string[];
  /** lanjutan setelah lunas: 'jailMove' = denda penjara ke-3, lalu bidak tetap jalan */
  then?: 'jailMove';
}

export type GameEvent =
  | { seq: number; type: 'dice'; player: string; dice: [number, number] }
  | { seq: number; type: 'move'; player: string; from: number; to: number; direct?: boolean }
  | { seq: number; type: 'card'; player: string; deck: 'chance' | 'community'; card: string }
  | { seq: number; type: 'pay'; from: string | null; to: string | null; amount: number; reason: string }
  | { seq: number; type: 'buy'; player: string; tile: number; price: number }
  | { seq: number; type: 'build' | 'sell' | 'mortgage' | 'unmortgage'; player: string; tile: number }
  | { seq: number; type: 'jail'; player: string }
  | { seq: number; type: 'free'; player: string }
  | { seq: number; type: 'auction'; tile: number; winner: string | null; price: number }
  | { seq: number; type: 'trade'; from: string; to: string; accepted: boolean; counter?: boolean }
  | { seq: number; type: 'bankrupt'; player: string; to: string | null }
  | { seq: number; type: 'turn'; player: string }
  | { seq: number; type: 'win'; player: string };

/**
 * Aturan main. Nilai bawaan = aturan resmi Monopoli (Hasbro). Semua nominal dalam satuan engine
 * (tampilan uang mengikuti tema, mis. 1 satuan = Rp1 juta).
 */
export interface Options {
  /** modal awal tiap pemain (resmi: 1500) */
  startCash: number;
  /** gaji tiap lewat START (resmi: 200) */
  goSalary: number;
  /** aturan rumah: gaji 2x jika berhenti tepat di START */
  doubleGo: boolean;
  /** denda keluar penjara (resmi: 50) */
  jailFine: number;
  /** pemilik tetap menagih sewa walau sedang di penjara (resmi: ya) */
  rentInJail: boolean;
  /** properti yang tidak dibeli dilelang (resmi: ya). Mati = petak tetap milik bank */
  auctions: boolean;
  /** rumah harus dibangun & dijual merata dalam satu set (resmi: ya) */
  evenBuild: boolean;
  /** stok bank terbatas 32 rumah / 12 hotel (resmi: ya) */
  limitedBuildings: boolean;
  /** pajak penghasilan: 'flat' = bayar 200 (aturan sekarang), 'classic' = 10% kekayaan atau 200, mana yang lebih kecil (aturan lama) */
  incomeTax: 'flat' | 'classic';
  /** aturan rumah: pajak & denda masuk pot Parkir Bebas, diambil yang berhenti di sana */
  freeParkingPot: boolean;
  /** aturan rumah: isi awal pot Parkir Bebas dari bank (diisi ulang setiap diambil) */
  freeParkingStart: number;
  /** "Permainan Singkat" resmi: tiap pemain dibagi 2 properti acak di awal (bayar ke bank); selesai saat pemain kedua bangkrut, pemenang terkaya */
  shortGame: boolean;
  /** 0 = tanpa batas. >0 = game selesai setelah N ronde, pemenang = kekayaan terbesar */
  maxRounds: number;
}

export const DEFAULT_OPTIONS: Options = {
  startCash: 1500,
  goSalary: 200,
  doubleGo: false,
  jailFine: 50,
  rentInJail: true,
  auctions: true,
  evenBuild: true,
  limitedBuildings: true,
  incomeTax: 'flat',
  freeParkingPot: false,
  freeParkingStart: 0,
  shortGame: false,
  maxRounds: 0,
};

/** Batas aman tiap opsi (dipakai server & UI). */
export const OPTION_LIMITS = {
  startCash: [500, 5000],
  goSalary: [0, 500],
  jailFine: [0, 200],
  freeParkingStart: [0, 1000],
  maxRounds: [0, 100],
} as const;

/** Rapikan opsi dari luar (input user / jaringan): isi yang kosong dengan aturan resmi, potong ke batas aman. */
export function sanitizeOptions(raw: unknown): Options {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const o: Options = { ...DEFAULT_OPTIONS };
  const num = (k: keyof typeof OPTION_LIMITS) => {
    const v = Number(r[k]);
    if (r[k] === undefined || !Number.isFinite(v)) return;
    const [lo, hi] = OPTION_LIMITS[k];
    (o as unknown as Record<string, number>)[k] = Math.min(hi, Math.max(lo, Math.round(v)));
  };
  (Object.keys(OPTION_LIMITS) as (keyof typeof OPTION_LIMITS)[]).forEach(num);
  for (const k of ['doubleGo', 'rentInJail', 'auctions', 'evenBuild', 'limitedBuildings', 'freeParkingPot', 'shortGame'] as const) if (r[k] !== undefined) o[k] = !!r[k];
  if (r.incomeTax === 'classic' || r.incomeTax === 'flat') o.incomeTax = r.incomeTax;
  return o;
}

/** Opsi mana saja yang beda dari aturan resmi (untuk label "Aturan resmi" / ringkasan). */
export function changedOptions(o: Options): (keyof Options)[] {
  return (Object.keys(DEFAULT_OPTIONS) as (keyof Options)[]).filter((k) => o[k] !== DEFAULT_OPTIONS[k]);
}

/** Versi skema GameState. Naikkan saat bentuk state berubah & tambahkan migrasi di migrateState. */
export const SCHEMA = 2;

export interface GameState {
  schema: number;
  version: number;
  players: Player[];
  tiles: TileState[];
  current: number;
  phase: Phase;
  dice: [number, number];
  doubles: number;
  /** sudah lempar dadu di giliran ini dan tidak boleh lempar lagi */
  rolled: boolean;
  auction: Auction | null;
  /** properti bank yang menunggu dilelang (dari pemain yang bangkrut ke bank) */
  auctionQueue: number[];
  /** setelah antrean lelang habis → lanjut ke giliran berikutnya */
  afterAuction: boolean;
  debt: Debt | null;
  trade: Trade | null;
  pot: number;
  decks: { chance: string[]; community: string[] };
  /** kartu kustom dari tema JSON (teks + efek). Tidak ada = kartu bawaan. */
  cardDefs?: { chance?: CardDef[]; community?: CardDef[] };
  lastCard: { deck: Deck; id: string } | null;
  events: GameEvent[];
  seq: number;
  rng: number;
  turnCount: number;
  /** ronde selesai (semua pemain hidup sudah jalan sekali) */
  round: number;
  winner: string | null;
  /** alasan selesai */
  endReason: 'bankrupt' | 'rounds' | 'short' | null;
  options: Options;
}

export type Action =
  | { type: 'roll' }
  | { type: 'buy' }
  | { type: 'decline' }
  | { type: 'bid'; amount: number }
  | { type: 'pass' }
  | { type: 'build'; tile: number }
  | { type: 'sell'; tile: number }
  | { type: 'mortgage'; tile: number }
  | { type: 'unmortgage'; tile: number }
  | { type: 'payBail' }
  | { type: 'useJailCard' }
  | { type: 'proposeTrade'; trade: Omit<Trade, 'from'> }
  /** penerima tawaran mengajukan tawaran balik (syarat baru, arah dibalik) */
  | { type: 'counterTrade'; trade: Omit<Trade, 'from' | 'to'> }
  | { type: 'acceptTrade' }
  | { type: 'rejectTrade' }
  | { type: 'payDebt' }
  | { type: 'bankrupt' }
  | { type: 'endTurn' };

export interface NewPlayer {
  id: string;
  name: string;
  color: string;
  token: number;
  bot?: boolean;
  persona?: Persona;
}

export class RuleError extends Error {}

// ---------- RNG (mulberry32, state disimpan di GameState) ----------
function rand(s: GameState): number {
  let t = (s.rng = (s.rng + 0x6d2b79f5) | 0);
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const die = (s: GameState) => 1 + Math.floor(rand(s) * 6);
function shuffle<T>(s: GameState, arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand(s) * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ---------- setup ----------
export function createGame(players: NewPlayer[], seed = Date.now(), options: Partial<Options> = {}, customDecks?: CustomDecks): GameState {
  if (players.length < 2 || players.length > 8) throw new RuleError('Pemain harus 2-8 orang');
  const opts = sanitizeOptions({ ...DEFAULT_OPTIONS, ...options });
  const s: GameState = {
    schema: SCHEMA,
    version: 0,
    players: players.map((p, i) => ({
      ...p,
      bot: !!p.bot,
      persona: p.persona ?? (['seimbang', 'agresif', 'hemat'] as const)[i % 3],
      cash: opts.startCash,
      pos: 0,
      inJail: false,
      jailTurns: 0,
      jailFree: 0,
      jailCards: [],
      bankrupt: false,
      stats: { rentIn: 0, rentOut: 0, bought: 0, laps: 0, jailed: 0, built: 0 },
    })),
    tiles: BOARD.map(() => ({ owner: null, houses: 0, mortgaged: false })),
    current: 0,
    phase: 'roll',
    dice: [1, 1],
    doubles: 0,
    rolled: false,
    auction: null,
    auctionQueue: [],
    afterAuction: false,
    debt: null,
    trade: null,
    pot: 0,
    decks: { chance: [], community: [] },
    lastCard: null,
    events: [],
    seq: 0,
    rng: seed | 0,
    turnCount: 0,
    round: 0,
    winner: null,
    endReason: null,
    options: opts,
  };
  const custom = buildCustomDecks(customDecks);
  if (custom.chance || custom.community) s.cardDefs = { ...(custom.chance && { chance: custom.chance }), ...(custom.community && { community: custom.community }) };
  s.decks.chance = shuffle(s, cardsOf(s, 'chance').map((c) => c.id));
  s.decks.community = shuffle(s, cardsOf(s, 'community').map((c) => c.id));
  if (opts.freeParkingPot) s.pot = opts.freeParkingStart;
  if (opts.shortGame) {
    // Permainan Singkat resmi: kocok akta, bagikan 2 ke tiap pemain, masing-masing bayar harga ke bank
    const deeds = shuffle(s, BOARD.filter((t) => isOwnable(t.index)).map((t) => t.index));
    for (const p of s.players)
      for (let k = 0; k < 2; k++) {
        const i = deeds.pop()!;
        s.tiles[i].owner = p.id;
        p.cash -= BOARD[i].price!;
        p.stats.bought++;
      }
  }
  emit(s, { type: 'turn', player: s.players[0].id });
  return s;
}

// ---------- helpers publik (dipakai UI & bot) ----------
export const currentPlayer = (s: GameState) => s.players[s.current];
export const playerById = (s: GameState, id: string) => {
  const p = s.players.find((x) => x.id === id);
  if (!p) throw new RuleError('Pemain tidak dikenal');
  return p;
};

export function ownsGroup(s: GameState, playerId: string, group: number): boolean {
  return groupTiles(group).every((i) => s.tiles[i].owner === playerId);
}

export function rentFor(s: GameState, tile: number, diceTotal: number, multiplier = 1): number {
  const t = BOARD[tile];
  const st = s.tiles[tile];
  if (!st.owner || st.mortgaged) return 0;
  if (t.kind === 'property') {
    if (st.houses > 0) return t.rent![st.houses];
    return t.rent![0] * (ownsGroup(s, st.owner, t.group!) ? 2 : 1);
  }
  if (t.kind === 'station') {
    const n = BOARD.filter((b) => b.kind === 'station' && s.tiles[b.index].owner === st.owner).length;
    return STATION_RENT[n - 1] * multiplier;
  }
  if (t.kind === 'utility') {
    const n = BOARD.filter((b) => b.kind === 'utility' && s.tiles[b.index].owner === st.owner).length;
    const factor = multiplier > 1 ? 10 : n === 2 ? 10 : 4;
    return diceTotal * factor;
  }
  return 0;
}

export const mortgageValue = (tile: number) => Math.floor(BOARD[tile].price! / 2);
export const unmortgageCost = (tile: number) => Math.ceil(mortgageValue(tile) * 1.1);

/** Sisa rumah & hotel di bank (dihitung dari papan, jadi tidak bisa tidak sinkron). */
export function bankStock(s: GameState): { houses: number; hotels: number } {
  let houses = HOUSE_STOCK;
  let hotels = HOTEL_STOCK;
  for (const t of s.tiles) {
    if (t.houses === 5) hotels--;
    else houses -= t.houses;
  }
  return { houses, hotels };
}

/** Alasan tidak bisa membangun (null = bisa). Dipakai UI untuk tooltip yang jelas. */
export function buildBlock(s: GameState, pid: string, tile: number): string | null {
  const t = BOARD[tile];
  const st = s.tiles[tile];
  if (t.kind !== 'property' || st.owner !== pid) return 'Bukan propertimu';
  if (st.houses >= 5) return 'Sudah hotel';
  if (s.phase === 'debt') return 'Lunasi utang dulu';
  if (!ownsGroup(s, pid, t.group!)) return 'Harus punya satu set warna lengkap';
  const g = groupTiles(t.group!);
  if (g.some((i) => s.tiles[i].mortgaged)) return 'Ada properti set ini yang digadai';
  if (s.options.evenBuild && g.some((i) => s.tiles[i].houses < st.houses)) return 'Bangun merata dulu di petak lain';
  const stock = bankStock(s);
  if (s.options.limitedBuildings && st.houses === 4 && stock.hotels < 1) return 'Hotel di bank habis';
  if (s.options.limitedBuildings && st.houses < 4 && stock.houses < 1) return 'Rumah di bank habis';
  if (playerById(s, pid).cash < t.houseCost!) return 'Uang tidak cukup';
  return null;
}

export const canBuild = (s: GameState, pid: string, tile: number) => buildBlock(s, pid, tile) === null;

export function canSell(s: GameState, pid: string, tile: number): boolean {
  const t = BOARD[tile];
  const st = s.tiles[tile];
  if (t.kind !== 'property' || st.owner !== pid || st.houses === 0) return false;
  if (!s.options.evenBuild) return true;
  return groupTiles(t.group!).every((i) => s.tiles[i].houses <= st.houses);
}

export function canMortgage(s: GameState, pid: string, tile: number): boolean {
  const t = BOARD[tile];
  const st = s.tiles[tile];
  if (!isOwnable(tile) || st.owner !== pid || st.mortgaged) return false;
  if (t.kind === 'property' && groupTiles(t.group!).some((i) => s.tiles[i].houses > 0)) return false;
  return true;
}

export function canUnmortgage(s: GameState, pid: string, tile: number): boolean {
  const st = s.tiles[tile];
  return s.phase !== 'debt' && st.owner === pid && st.mortgaged && playerById(s, pid).cash >= unmortgageCost(tile);
}

/** Total uang yang bisa dikumpulkan pemain (cash + jual rumah + gadai). */
export function liquidValue(s: GameState, pid: string): number {
  let v = playerById(s, pid).cash;
  s.tiles.forEach((st, i) => {
    if (st.owner !== pid) return;
    if (st.houses) v += (st.houses * BOARD[i].houseCost!) / 2;
    if (!st.mortgaged) v += mortgageValue(i);
  });
  return Math.floor(v);
}

export function netWorth(s: GameState, pid: string): number {
  let v = playerById(s, pid).cash;
  s.tiles.forEach((st, i) => {
    if (st.owner !== pid) return;
    v += st.mortgaged ? mortgageValue(i) : BOARD[i].price!;
    v += st.houses * (BOARD[i].houseCost ?? 0);
  });
  return v;
}

/** Siapa yang wajib bertindak sekarang (untuk UI/bot/server). */
export function actorId(s: GameState): string | null {
  if (s.phase === 'gameover') return null;
  if (s.trade) return s.trade.to;
  if (s.phase === 'auction' && s.auction) return s.auction.active[s.auction.turn];
  return currentPlayer(s).id;
}

// ---------- internal ----------
function emit(s: GameState, e: Record<string, unknown> & { type: GameEvent['type'] }) {
  s.events.push({ ...e, seq: ++s.seq } as GameEvent);
  if (s.events.length > 80) s.events.splice(0, s.events.length - 80);
}

const alive = (s: GameState) => s.players.filter((p) => !p.bankrupt);

function transfer(s: GameState, from: Player | null, to: Player | null, amount: number, reason: string) {
  if (amount <= 0) return;
  if (from) from.cash -= amount;
  if (to) to.cash += amount;
  if (reason === 'rent' && from && to) {
    from.stats.rentOut += amount;
    to.stats.rentIn += amount;
  }
  else if (from && s.options.freeParkingPot && (reason === 'tax' || reason === 'card')) s.pot += amount;
  emit(s, { type: 'pay', from: from?.id ?? null, to: to?.id ?? null, amount, reason });
}

/** Tagih pemain saat ini. Kalau cash kurang → fase debt (pemain harus jual/gadai atau bangkrut). */
function charge(s: GameState, payer: Player, amount: number, creditor: Player | null, reason: string, extra: Pick<Debt, 'split' | 'then'> = {}) {
  if (amount <= 0) return;
  if (payer.cash >= amount && !extra.split) return transfer(s, payer, creditor, amount, reason);
  if (payer.cash >= amount && extra.split) return paySplit(s, payer, extra.split, amount, reason);
  s.debt = { amount, creditor: creditor?.id ?? null, reason, ...extra };
  s.phase = 'debt';
}

/** Bayar total `amount` dibagi rata ke beberapa pemain (kartu "bayar ke tiap pemain"). */
function paySplit(s: GameState, payer: Player, to: string[], amount: number, reason: string) {
  const live = to.map((id) => playerById(s, id)).filter((o) => !o.bankrupt);
  if (!live.length) return;
  const each = Math.floor(amount / to.length);
  for (const o of live) transfer(s, payer, o, each, reason);
}

/** Sisa tindakan likuidasi yang masih mungkin (jual bangunan / gadai). */
export function canRaiseCash(s: GameState, pid: string): boolean {
  return s.tiles.some((_, i) => canSell(s, pid, i) || canMortgage(s, pid, i));
}

/** Aturan resmi: bangkrut hanya boleh kalau memang tidak sanggup bayar walau semua aset dicairkan. */
export function bankruptBlock(s: GameState, pid: string): string | null {
  if (s.phase !== 'debt' || !s.debt || currentPlayer(s).id !== pid) return 'Hanya saat berutang';
  const p = playerById(s, pid);
  if (p.cash >= s.debt.amount) return 'Uangmu cukup — bayar utangnya';
  if (liquidValue(s, pid) >= s.debt.amount && canRaiseCash(s, pid)) return 'Asetmu masih cukup — jual bangunan / gadai dulu (atau tukar dengan pemain lain)';
  return null;
}

/** Untuk pemain yang bukan giliran (mis. kartu ulang tahun): jual/gadai otomatis, kalau tetap kurang → bangkrut. */
function chargeOther(s: GameState, payer: Player, amount: number, creditor: Player | null, reason: string) {
  autoLiquidate(s, payer.id, amount);
  if (payer.cash >= amount) return transfer(s, payer, creditor, amount, reason);
  goBankrupt(s, payer, creditor);
}

/** Jual rumah lalu gadai properti sampai cash >= target. Dipakai bot & chargeOther. */
export function autoLiquidate(s: GameState, pid: string, target: number) {
  const p = playerById(s, pid);
  let guard = 200;
  while (p.cash < target && guard-- > 0) {
    const sell = s.tiles.findIndex((_, i) => canSell(s, pid, i));
    if (sell >= 0) {
      doSell(s, p, sell);
      continue;
    }
    // gadai yang paling murah dulu
    const m = s.tiles
      .map((_, i) => i)
      .filter((i) => canMortgage(s, pid, i))
      .sort((a, b) => mortgageValue(a) - mortgageValue(b))[0];
    if (m === undefined) break;
    doMortgage(s, p, m);
  }
}

function doSell(s: GameState, p: Player, tile: number) {
  const st = s.tiles[tile];
  const half = BOARD[tile].houseCost! / 2;
  if (st.houses === 5) {
    // aturan resmi: hotel ditukar kembali jadi 4 rumah; kalau rumah di bank kurang, sisanya ikut dijual
    const back = s.options.limitedBuildings ? Math.min(4, bankStock(s).houses) : 4;
    p.cash += half * (5 - back);
    st.houses = back;
  } else {
    st.houses--;
    p.cash += half;
  }
  emit(s, { type: 'sell', player: p.id, tile });
}

/** Bunga 10% yang wajib dibayar penerima properti tergadai saat tukar (aturan resmi). */
export function tradeInterest(s: GameState, tiles: number[]): number {
  return tiles.filter((i) => s.tiles[i].mortgaged).reduce((a, i) => a + Math.ceil(mortgageValue(i) * 0.1), 0);
}
function doMortgage(s: GameState, p: Player, tile: number) {
  s.tiles[tile].mortgaged = true;
  p.cash += mortgageValue(tile);
  emit(s, { type: 'mortgage', player: p.id, tile });
}

/** Isi tumpukan kartu yang dipakai game ini (kustom dari tema, atau bawaan). */
export function cardsOf(s: Pick<GameState, 'cardDefs'>, deck: Deck): CardDef[] {
  return s.cardDefs?.[deck] ?? (deck === 'chance' ? CHANCE : COMMUNITY);
}
/** Definisi kartu berdasarkan id (untuk tampilan teks kartu di klien). */
export function cardById(s: Pick<GameState, 'cardDefs'>, deck: Deck, id: string): CardDef | undefined {
  return cardsOf(s, deck).find((c) => c.id === id);
}
/** id kartu bebas penjara di tumpukan ini (tumpukan kustom bisa tidak punya). */
const jailCardId = (s: GameState, deck: Deck) => cardsOf(s, deck).find((c) => c.effect.kind === 'jailFree')?.id;

/** Kembalikan satu kartu bebas penjara pemain ke bawah deknya. */
function returnJailCard(s: GameState, p: Player) {
  const deck = p.jailCards.shift();
  p.jailFree = p.jailCards.length;
  const id = deck && jailCardId(s, deck);
  if (deck && id) s.decks[deck].push(id);
}

/**
 * Bangkrut (aturan resmi):
 * - bangunan dijual ke bank setengah harga;
 * - ke pemain: semua uang, properti & kartu bebas penjara pindah ke kreditor; kreditor bayar bunga 10% properti tergadai;
 * - ke bank: properti dilepas tanpa gadai lalu DILELANG ke pemain lain; kartu bebas penjara kembali ke dek.
 */
function goBankrupt(s: GameState, p: Player, creditor: Player | null, split?: string[]) {
  s.tiles.forEach((st, i) => {
    if (st.owner === p.id && st.houses) {
      p.cash += (st.houses * BOARD[i].houseCost!) / 2;
      st.houses = 0;
    }
  });
  const mine = s.tiles.map((_, i) => i).filter((i) => s.tiles[i].owner === p.id);
  if (creditor) {
    const fee = tradeInterest(s, mine);
    mine.forEach((i) => (s.tiles[i].owner = creditor.id));
    creditor.cash += Math.max(0, p.cash);
    creditor.jailCards.push(...p.jailCards);
    creditor.jailFree = creditor.jailCards.length;
    p.jailCards = [];
    const pay = Math.min(fee, creditor.cash);
    if (pay > 0) transfer(s, creditor, null, pay, 'interest');
  } else {
    mine.forEach((i) => Object.assign(s.tiles[i], { owner: null, mortgaged: false }));
    if (split?.length) {
      const live = split.map((id) => playerById(s, id)).filter((o) => !o.bankrupt);
      const each = Math.floor(Math.max(0, p.cash) / Math.max(1, live.length));
      live.forEach((o) => transfer(s, p, o, each, 'card'));
    }
    while (p.jailCards.length) returnJailCard(s, p);
    if (s.options.auctions) s.auctionQueue.push(...mine);
  }
  p.cash = 0;
  p.jailFree = 0;
  p.bankrupt = true;
  emit(s, { type: 'bankrupt', player: p.id, to: creditor?.id ?? null });
  if (s.trade && (s.trade.from === p.id || s.trade.to === p.id)) s.trade = null;
  const left = alive(s);
  if (left.length === 1) {
    s.auctionQueue = [];
    finish(s, left[0].id, 'bankrupt');
  } else if (s.options.shortGame && s.players.filter((x) => x.bankrupt).length >= 2) {
    // Permainan Singkat: berhenti saat pemain kedua bangkrut, pemenang = kekayaan terbesar
    s.auctionQueue = [];
    finish(s, ranking(s)[0].id, 'short');
  }
}

function finish(s: GameState, winner: string, reason: 'bankrupt' | 'rounds' | 'short') {
  s.phase = 'gameover';
  s.winner = winner;
  s.endReason = reason;
  s.trade = null;
  s.auction = null;
  s.auctionQueue = [];
  s.afterAuction = false;
  s.debt = null;
  emit(s, { type: 'win', player: winner });
}

/** Peringkat: yang masih hidup diurut kekayaan, yang bangkrut di belakang. */
export function ranking(s: GameState): Player[] {
  return [...s.players].sort((a, b) => Number(a.bankrupt) - Number(b.bankrupt) || netWorth(s, b.id) - netWorth(s, a.id));
}

function sendToJail(s: GameState, p: Player) {
  emit(s, { type: 'move', player: p.id, from: p.pos, to: JAIL_INDEX, direct: true });
  p.pos = JAIL_INDEX;
  p.inJail = true;
  p.jailTurns = 0;
  s.doubles = 0;
  s.rolled = true; // giliran selesai, tidak dapat lempar lagi walau double
  p.stats.jailed++;
  emit(s, { type: 'jail', player: p.id });
}

function moveTo(s: GameState, p: Player, to: number, collectGo = true) {
  const from = p.pos;
  if (collectGo && to < from) {
    const bonus = s.options.doubleGo && to === 0 ? s.options.goSalary * 2 : s.options.goSalary;
    transfer(s, null, p, bonus, 'go');
    p.stats.laps++;
  }
  p.pos = to;
  emit(s, { type: 'move', player: p.id, from, to });
}

function land(s: GameState, p: Player, rentMultiplier = 1): void {
  const t = BOARD[p.pos];
  const st = s.tiles[p.pos];
  const total = s.dice[0] + s.dice[1];
  s.phase = 'end';
  switch (t.kind) {
    case 'property':
    case 'station':
    case 'utility':
      if (!st.owner) {
        s.phase = 'buy';
      } else if (st.owner !== p.id) {
        const owner = playerById(s, st.owner);
        if (owner.bankrupt) return;
        if (owner.inJail && !s.options.rentInJail) return; // aturan rumah: pemilik di penjara tidak menagih sewa
        let dice = total;
        if (t.kind === 'utility' && rentMultiplier > 1) {
          // kartu "utilitas terdekat": lempar dadu lagi, bayar 10x hasilnya (aturan resmi)
          const d: [number, number] = [die(s), die(s)];
          s.dice = d;
          emit(s, { type: 'dice', player: p.id, dice: d });
          dice = d[0] + d[1];
        }
        charge(s, p, rentFor(s, p.pos, dice, rentMultiplier), owner, 'rent');
      }
      return;
    case 'tax':
      return charge(s, p, taxFor(s, p.id, p.pos), null, 'tax');
    case 'gotojail':
      return sendToJail(s, p);
    case 'parking':
      if (s.pot > 0) {
        const pot = s.pot;
        s.pot = s.options.freeParkingPot ? s.options.freeParkingStart : 0; // bank mengisi ulang jackpot
        transfer(s, null, p, pot, 'pot');
      }
      return;
    case 'chance':
    case 'community':
      return drawCard(s, p, t.kind);
    default:
      return;
  }
}

/** Pajak yang harus dibayar di petak pajak. Aturan klasik: pajak penghasilan = 10% kekayaan atau 200, mana yang lebih kecil. */
export function taxFor(s: GameState, pid: string, tile: number): number {
  const t = BOARD[tile];
  if (t.kind !== 'tax') return 0;
  if (s.options.incomeTax === 'classic' && t.slot === 0) return Math.min(t.tax!, Math.floor(netWorth(s, pid) * 0.1));
  return t.tax!;
}

function drawCard(s: GameState, p: Player, deck: Deck): void {
  const list = s.decks[deck];
  const id = list.shift();
  if (!id) return; // tumpukan kosong (semua kartu bebas penjara sedang dipegang)
  const card: CardDef = cardById(s, deck, id) ?? cardsOf(s, deck)[0];
  // kartu bebas penjara dipegang pemain (keluar dari dek) sampai dipakai; kartu lain kembali ke bawah dek
  if (card.effect.kind !== 'jailFree') list.push(id);
  s.lastCard = { deck, id };
  emit(s, { type: 'card', player: p.id, deck, card: id });
  const e = card.effect;
  switch (e.kind) {
    case 'advance':
      moveTo(s, p, e.to);
      return land(s, p);
    case 'nearest': {
      let i = p.pos;
      do i = (i + 1) % 40;
      while (BOARD[i].kind !== e.target);
      moveTo(s, p, i);
      return land(s, p, 2);
    }
    case 'back':
      p.pos = (p.pos + 40 - e.steps) % 40;
      emit(s, { type: 'move', player: p.id, from: (p.pos + e.steps) % 40, to: p.pos, direct: true });
      return land(s, p);
    case 'money':
      if (e.amount >= 0) transfer(s, null, p, e.amount, 'card');
      else charge(s, p, -e.amount, null, 'card');
      return;
    case 'jail':
      return sendToJail(s, p);
    case 'jailFree':
      p.jailCards.push(deck);
      p.jailFree = p.jailCards.length;
      return;
    case 'repairs': {
      let cost = 0;
      s.tiles.forEach((st) => {
        if (st.owner === p.id) cost += st.houses === 5 ? e.hotel : st.houses * e.house;
      });
      return charge(s, p, cost, null, 'card');
    }
    case 'eachPlayer': {
      const others = alive(s).filter((o) => o.id !== p.id);
      if (e.amount > 0) {
        for (const o of others) if (!o.bankrupt) chargeOther(s, o, e.amount, p, 'card');
      } else if (others.length) {
        // kalau uang kurang → utang ke tiap pemain (dibagi rata saat lunas)
        charge(s, p, -e.amount * others.length, null, 'card', { split: others.map((o) => o.id) });
      }
      return;
    }
  }
}

function startAuction(s: GameState, tile: number) {
  const order: string[] = [];
  for (let k = 0; k < s.players.length; k++) {
    const p = s.players[(s.current + k) % s.players.length];
    if (!p.bankrupt) order.push(p.id);
  }
  s.auction = { tile, bid: 0, bidder: null, active: order, turn: 0 };
  s.phase = 'auction';
}

function finishAuction(s: GameState) {
  const a = s.auction!;
  if (a.kind === 'house' || a.kind === 'hotel') return finishBuildingAuction(s, a);
  if (a.bidder) {
    const w = playerById(s, a.bidder);
    w.cash -= a.bid;
    w.stats.bought++;
    s.tiles[a.tile].owner = w.id;
  }
  emit(s, { type: 'auction', tile: a.tile, winner: a.bidder, price: a.bid });
  s.auction = null;
  s.phase = 'end';
  runAuctionQueue(s);
}

// ---------- lelang bangunan saat stok menipis ----------

/** Petak tempat pemain bisa menaruh bangunan jenis ini (abaikan uang & stok). */
function buildSpots(s: GameState, pid: string, kind: 'house' | 'hotel'): number[] {
  return s.tiles
    .map((_, i) => i)
    .filter((i) => {
      const t = BOARD[i];
      const st = s.tiles[i];
      if (t.kind !== 'property' || st.owner !== pid || st.houses >= 5) return false;
      if ((kind === 'hotel') !== (st.houses === 4)) return false;
      if (!ownsGroup(s, pid, t.group!)) return false;
      const g = groupTiles(t.group!);
      if (g.some((x) => s.tiles[x].mortgaged)) return false;
      return !s.options.evenBuild || !g.some((x) => s.tiles[x].houses < st.houses);
    });
}

/** Pemain lain yang juga sedang bisa membangun jenis ini (dan punya uang untuk itu). */
function buildCompetitors(s: GameState, kind: 'house' | 'hotel'): string[] {
  return s.players
    .filter((p) => !p.bankrupt && buildSpots(s, p.id, kind).some((i) => p.cash >= BOARD[i].houseCost!))
    .map((p) => p.id);
}

/** Aturan resmi "kekurangan bangunan": stok lebih sedikit dari peminat → lelang. Kembalikan true kalau lelang dimulai. */
function maybeBuildingAuction(s: GameState, pid: string, tile: number): boolean {
  if (!s.options.limitedBuildings) return false;
  const kind = s.tiles[tile].houses === 4 ? 'hotel' : 'house';
  const stock = bankStock(s);
  const left = kind === 'hotel' ? stock.hotels : stock.houses;
  const who = buildCompetitors(s, kind);
  if (who.length < 2 || left >= who.length) return false;
  // urutan giliran dimulai dari peminta; peminta sudah "menawar" harga normal (tambahan 0)
  const order: string[] = [];
  for (let k = 0; k < s.players.length; k++) {
    const id = s.players[(s.players.findIndex((x) => x.id === pid) + k) % s.players.length].id;
    if (who.includes(id)) order.push(id);
  }
  s.auction = { tile, bid: 0, bidder: pid, active: order, turn: 1 % order.length, kind, resume: s.phase };
  s.phase = 'auction';
  return true;
}

function finishBuildingAuction(s: GameState, a: Auction) {
  const kind = a.kind as 'house' | 'hotel';
  const w = a.bidder ? playerById(s, a.bidder) : null;
  let placed = -1;
  if (w) {
    const spots = buildSpots(s, w.id, kind);
    // peminta menaruh di petak yang ia pilih; pemenang lain di petak termahal yang bisa dibangun
    placed = spots.includes(a.tile) && s.tiles[a.tile].owner === w.id ? a.tile : spots.sort((x, y) => BOARD[y].houseCost! - BOARD[x].houseCost! || y - x)[0] ?? -1;
    const cost = placed >= 0 ? BOARD[placed].houseCost! + a.bid : 0;
    if (placed >= 0 && w.cash >= cost) {
      w.cash -= cost;
      s.tiles[placed].houses++;
      w.stats.built++;
      emit(s, { type: 'build', player: w.id, tile: placed });
    } else placed = -1;
  }
  emit(s, { type: 'auction', tile: placed >= 0 ? placed : a.tile, winner: placed >= 0 ? w!.id : null, price: a.bid });
  s.auction = null;
  s.phase = a.resume ?? 'end';
}

/** Lelang properti bank berikutnya (dari pemain bangkrut); kalau habis dan diminta → giliran berikutnya. */
function runAuctionQueue(s: GameState) {
  if (s.phase === 'gameover') return;
  const next = s.auctionQueue.shift();
  if (next !== undefined) return startAuction(s, next);
  if (s.afterAuction) {
    s.afterAuction = false;
    nextTurn(s);
  }
}

function advanceAuction(s: GameState) {
  const a = s.auction!;
  if (a.active.length === 0 || (a.active.length === 1 && a.bidder === a.active[0])) return finishAuction(s);
  a.turn = a.turn % a.active.length;
  // lewati penawar tertinggi saat ini (dia tidak perlu menawar dirinya sendiri)
  if (a.active[a.turn] === a.bidder) a.turn = (a.turn + 1) % a.active.length;
}

function nextTurn(s: GameState) {
  s.doubles = 0;
  s.rolled = false;
  s.lastCard = null;
  let n = s.current;
  do {
    n = (n + 1) % s.players.length;
    if (n === 0) s.round++; // kembali ke pemain pertama = ronde baru
  } while (s.players[n].bankrupt);
  if (s.options.maxRounds > 0 && s.round >= s.options.maxRounds) return finish(s, ranking(s)[0].id, 'rounds');
  s.current = n;
  s.phase = 'roll';
  s.turnCount++;
  emit(s, { type: 'turn', player: s.players[n].id });
}

function doRoll(s: GameState, p: Player) {
  const d: [number, number] = [die(s), die(s)];
  s.dice = d;
  emit(s, { type: 'dice', player: p.id, dice: d });
  const isDouble = d[0] === d[1];

  if (p.inJail) {
    s.rolled = true;
    if (isDouble) {
      p.inJail = false;
      p.jailTurns = 0;
      emit(s, { type: 'free', player: p.id });
    } else {
      p.jailTurns++;
      if (p.jailTurns < 3) {
        s.phase = 'end';
        return;
      }
      // percobaan ke-3 gagal → wajib bayar denda lalu jalan sesuai dadu
      p.inJail = false;
      p.jailTurns = 0;
      emit(s, { type: 'free', player: p.id });
      charge(s, p, s.options.jailFine, null, 'tax', { then: 'jailMove' });
      if (s.phase === 'debt') return; // bidak jalan setelah denda dilunasi (lihat payDebt)
    }
    moveTo(s, p, (p.pos + d[0] + d[1]) % 40);
    return land(s, p);
  }

  if (isDouble) {
    s.doubles++;
    if (s.doubles >= 3) return sendToJail(s, p);
  }
  s.rolled = !isDouble;
  moveTo(s, p, (p.pos + d[0] + d[1]) % 40);
  land(s, p);
}

/** Validasi tawaran tukar (dipakai untuk tawaran baru & tawaran balik). */
function checkTrade(s: GameState, p: Player, raw: Trade): Trade {
  const need = (cond: unknown, msg: string) => {
    if (!cond) throw new RuleError(msg);
  };
  const t: Trade = { ...raw, giveJail: raw.giveJail ?? 0, getJail: raw.getJail ?? 0 };
  const other = playerById(s, t.to);
  need(other.id !== p.id && !other.bankrupt, 'Pemain tujuan tidak valid');
  need(t.giveCash >= 0 && t.getCash >= 0 && Number.isInteger(t.giveCash) && Number.isInteger(t.getCash), 'Nominal tidak valid');
  need(t.giveCash <= p.cash && t.getCash <= other.cash, 'Uang tidak cukup');
  need(Array.isArray(t.giveTiles) && Array.isArray(t.getTiles) && new Set(t.giveTiles).size === t.giveTiles.length && new Set(t.getTiles).size === t.getTiles.length, 'Daftar properti tidak valid');
  need(Number.isInteger(t.giveJail) && Number.isInteger(t.getJail) && t.giveJail! >= 0 && t.getJail! >= 0, 'Jumlah kartu tidak valid');
  need(t.giveJail! <= p.jailCards.length && t.getJail! <= other.jailCards.length, 'Kartu bebas penjara tidak cukup');
  need(t.giveTiles.length + t.getTiles.length + t.giveCash + t.getCash + t.giveJail! + t.getJail! > 0, 'Tawaran kosong');
  const tradable = (owner: string) => (i: number) =>
    isOwnable(i) && s.tiles[i].owner === owner && !(BOARD[i].kind === 'property' && groupTiles(BOARD[i].group!).some((g) => s.tiles[g].houses > 0));
  need(t.giveTiles.every(tradable(p.id)) && t.getTiles.every(tradable(other.id)), 'Properti tidak bisa ditukar (punya bangunan / bukan milik)');
  return t;
}

/** Tawaran tertinggi yang mampu dibayar pemain di lelang yang sedang berjalan. */
export function maxBid(s: GameState, pid: string): number {
  const p = playerById(s, pid);
  const a = s.auction;
  if (!a || (a.kind !== 'house' && a.kind !== 'hotel')) return p.cash;
  const spots = buildSpots(s, pid, a.kind);
  if (!spots.length) return 0;
  const cheapest = Math.min(...spots.map((i) => BOARD[i].houseCost!));
  return Math.max(0, p.cash - cheapest);
}

// ---------- reducer ----------
export function applyAction(prev: GameState, pid: string, action: Action): GameState {
  const s: GameState = structuredClone(prev);
  const p = playerById(s, pid);
  const cur = currentPlayer(s);
  const isCur = p.id === cur.id;
  const need = (cond: unknown, msg: string) => {
    if (!cond) throw new RuleError(msg);
  };
  need(s.phase !== 'gameover', 'Permainan sudah selesai');
  need(!p.bankrupt, 'Kamu sudah bangkrut');

  // selama ada tawaran tukar, hanya respon tukar (atau pembatalan oleh pengusul) yang diizinkan
  if (s.trade && !['acceptTrade', 'rejectTrade', 'counterTrade'].includes(action.type)) throw new RuleError('Menunggu jawaban tawaran tukar');

  // aturan resmi: bangun, jual, gadai & tebus boleh juga di antara giliran pemain lain
  const manage = () => need(isCur ? ['roll', 'end', 'debt'].includes(s.phase) : ['roll', 'end'].includes(s.phase), 'Tidak bisa sekarang — tunggu pemain lain selesai membeli / lelang');

  switch (action.type) {
    case 'roll':
      // fase 'end' + !rolled = dapat double → lempar lagi
      need(isCur && (s.phase === 'roll' || s.phase === 'end') && !s.rolled, 'Belum giliranmu melempar');
      doRoll(s, p);
      break;

    case 'buy': {
      need(isCur && s.phase === 'buy', 'Tidak bisa membeli sekarang');
      const price = BOARD[p.pos].price!;
      need(p.cash >= price, 'Uang tidak cukup');
      p.cash -= price;
      s.tiles[p.pos].owner = p.id;
      p.stats.bought++;
      emit(s, { type: 'buy', player: p.id, tile: p.pos, price });
      s.phase = 'end';
      break;
    }

    case 'decline':
      need(isCur && s.phase === 'buy', 'Tidak bisa sekarang');
      if (s.options.auctions) startAuction(s, p.pos);
      else s.phase = 'end'; // tanpa lelang: petak tetap milik bank
      break;

    case 'bid': {
      const a = s.auction;
      need(s.phase === 'auction' && a && a.active[a.turn] === p.id, 'Bukan giliranmu menawar');
      need(Number.isInteger(action.amount) && action.amount > a!.bid, 'Tawaran harus lebih tinggi');
      need(action.amount <= maxBid(s, p.id), 'Uang tidak cukup');
      a!.bid = action.amount;
      a!.bidder = p.id;
      a!.turn = (a!.turn + 1) % a!.active.length;
      advanceAuction(s);
      break;
    }

    case 'pass': {
      const a = s.auction;
      need(s.phase === 'auction' && a && a.active[a.turn] === p.id, 'Bukan giliranmu menawar');
      a!.active.splice(a!.turn, 1);
      advanceAuction(s);
      break;
    }

    case 'build':
      manage();
      need(s.phase !== 'debt', 'Lunasi utang dulu');
      need(canBuild(s, p.id, action.tile), 'Tidak bisa membangun di sini');
      if (maybeBuildingAuction(s, p.id, action.tile)) break;
      p.cash -= BOARD[action.tile].houseCost!;
      s.tiles[action.tile].houses++;
      p.stats.built++;
      emit(s, { type: 'build', player: p.id, tile: action.tile });
      break;

    case 'sell':
      manage();
      need(canSell(s, p.id, action.tile), 'Tidak bisa menjual bangunan ini');
      doSell(s, p, action.tile);
      break;

    case 'mortgage':
      manage();
      need(canMortgage(s, p.id, action.tile), 'Tidak bisa digadai');
      doMortgage(s, p, action.tile);
      break;

    case 'unmortgage':
      manage();
      need(s.phase !== 'debt', 'Lunasi utang dulu');
      need(canUnmortgage(s, p.id, action.tile), 'Tidak bisa menebus');
      p.cash -= unmortgageCost(action.tile);
      s.tiles[action.tile].mortgaged = false;
      emit(s, { type: 'unmortgage', player: p.id, tile: action.tile });
      break;

    case 'payBail':
      need(isCur && s.phase === 'roll' && p.inJail && !s.rolled, 'Tidak di penjara');
      need(p.cash >= s.options.jailFine, 'Uang tidak cukup');
      transfer(s, p, null, s.options.jailFine, 'tax');
      p.inJail = false;
      p.jailTurns = 0;
      emit(s, { type: 'free', player: p.id });
      break;

    case 'useJailCard':
      need(isCur && s.phase === 'roll' && p.inJail && p.jailCards.length > 0 && !s.rolled, 'Tidak bisa');
      returnJailCard(s, p);
      p.inJail = false;
      p.jailTurns = 0;
      emit(s, { type: 'free', player: p.id });
      break;

    case 'proposeTrade': {
      // aturan resmi: tukar boleh kapan saja di antara giliran, juga saat berutang (cara umum mengumpulkan uang)
      need(isCur ? ['roll', 'end', 'debt'].includes(s.phase) : ['roll', 'end'].includes(s.phase), 'Tidak bisa menawar tukar sekarang');
      s.trade = checkTrade(s, p, { ...action.trade, from: p.id });
      break;
    }

    case 'counterTrade': {
      const old = s.trade;
      need(old && old.to === p.id, 'Tidak ada tawaran untuk dibalas');
      s.trade = checkTrade(s, p, { ...action.trade, from: p.id, to: old!.from });
      emit(s, { type: 'trade', from: old!.from, to: old!.to, accepted: false, counter: true });
      break;
    }

    case 'acceptTrade':
    case 'rejectTrade': {
      const t = s.trade;
      need(t && (t.to === p.id || (action.type === 'rejectTrade' && t.from === p.id)), 'Tidak ada tawaran untukmu');
      s.trade = null;
      const accepted = action.type === 'acceptTrade';
      if (accepted) {
        const a = playerById(s, t!.from);
        const b = playerById(s, t!.to);
        const feeA = tradeInterest(s, t!.getTiles);
        const feeB = tradeInterest(s, t!.giveTiles);
        need(a.cash >= t!.giveCash && b.cash >= t!.getCash, 'Uang tidak cukup');
        need(a.cash - t!.giveCash + t!.getCash >= feeA && b.cash - t!.getCash + t!.giveCash >= feeB, 'Uang tidak cukup untuk bunga 10% properti tergadai');
        t!.giveTiles.forEach((i) => (s.tiles[i].owner = b.id));
        t!.getTiles.forEach((i) => (s.tiles[i].owner = a.id));
        a.cash += t!.getCash - t!.giveCash;
        b.cash += t!.giveCash - t!.getCash;
        need(a.jailCards.length >= (t!.giveJail ?? 0) && b.jailCards.length >= (t!.getJail ?? 0), 'Kartu bebas penjara tidak cukup');
        b.jailCards.push(...a.jailCards.splice(0, t!.giveJail ?? 0));
        a.jailCards.push(...b.jailCards.splice(0, t!.getJail ?? 0));
        a.jailFree = a.jailCards.length;
        b.jailFree = b.jailCards.length;
        if (feeA) transfer(s, a, null, feeA, 'interest');
        if (feeB) transfer(s, b, null, feeB, 'interest');
      }
      emit(s, { type: 'trade', from: t!.from, to: t!.to, accepted });
      break;
    }

    case 'payDebt': {
      need(isCur && s.phase === 'debt' && s.debt, 'Tidak ada utang');
      need(p.cash >= s.debt!.amount, 'Uang belum cukup — jual bangunan / gadai dulu');
      const d = s.debt!;
      const cred = d.creditor ? playerById(s, d.creditor) : null;
      if (d.split) paySplit(s, p, d.split, d.amount, d.reason);
      else transfer(s, p, cred, d.amount, d.reason || 'debt');
      s.debt = null;
      s.phase = 'end';
      if (d.then === 'jailMove') {
        moveTo(s, p, (p.pos + s.dice[0] + s.dice[1]) % 40);
        land(s, p);
      }
      break;
    }

    case 'bankrupt': {
      const why = bankruptBlock(s, p.id);
      need(!why, why ?? '');
      const cred = s.debt?.creditor ? playerById(s, s.debt.creditor) : null;
      const split = s.debt?.split;
      s.debt = null;
      goBankrupt(s, p, cred, split);
      if (s.phase !== 'gameover') {
        // properti untuk bank dilelang dulu, baru giliran berikutnya
        s.afterAuction = true;
        runAuctionQueue(s);
      }
      break;
    }

    case 'endTurn':
      need(isCur && (s.phase === 'end' || s.phase === 'roll') && s.rolled, 'Selesaikan aksi dulu (double = lempar lagi)');
      nextTurn(s);
      break;

    default:
      throw new RuleError('Aksi tidak dikenal');
  }

  s.version++;
  return s;
}

/**
 * Lengkapi state lama (save lokal / snapshot server dari versi sebelumnya) supaya tidak crash.
 * Melempar RuleError kalau data bukan GameState sama sekali.
 */
export function migrateState(raw: unknown): GameState {
  const s = raw as GameState;
  if (!s || typeof s !== 'object' || !Array.isArray(s.players) || !Array.isArray(s.tiles) || s.tiles.length !== 40) throw new RuleError('Data permainan rusak');
  if ((s.schema ?? 1) > SCHEMA) throw new RuleError('Save dari versi game yang lebih baru');
  s.schema = SCHEMA;
  s.auctionQueue ??= [];
  s.afterAuction ??= false;
  s.options = sanitizeOptions({ ...DEFAULT_OPTIONS, ...s.options });
  s.decks ??= { chance: cardsOf(s, 'chance').map((c) => c.id), community: cardsOf(s, 'community').map((c) => c.id) };
  for (const p of s.players) {
    if (!Array.isArray(p.jailCards)) {
      p.jailCards = [];
      for (let k = 0; k < (p.jailFree ?? 0); k++) {
        // kartu yang dipegang dulu masih ada di dek → keluarkan supaya tidak dobel
        const cid = jailCardId(s, 'chance');
        const deck: Deck = cid && s.decks.chance.includes(cid) ? 'chance' : 'community';
        const jid = jailCardId(s, deck);
        s.decks[deck] = s.decks[deck].filter((id) => id !== jid);
        p.jailCards.push(deck);
      }
    }
    p.jailFree = p.jailCards.length;
    p.stats ??= { rentIn: 0, rentOut: 0, bought: 0, laps: 0, jailed: 0, built: 0 };
  }
  // kartu baru yang belum ada di save lama
  const held = (d: Deck) => s.players.some((p) => p.jailCards.includes(d));
  for (const deck of ['chance', 'community'] as const)
    for (const c of cardsOf(s, deck)) if (!s.decks[deck].includes(c.id) && !(c.effect.kind === 'jailFree' && held(deck))) s.decks[deck].push(c.id);
  if (s.debt) s.debt.reason ??= 'debt';
  return s;
}

/** State untuk dikirim ke klien online: tanpa seed RNG & urutan dek (supaya dadu/kartu tidak bisa diprediksi). */
export function publicState(s: GameState): GameState {
  return { ...s, rng: 0, decks: { chance: [], community: [] } };
}

/**
 * State online untuk satu penerima: isi kartu Kesempatan/Dana Umum hanya terlihat oleh pemain yang
 * mengambilnya. Pemain lain & penonton menerima event kartu tanpa id (card: '') — tahu ada yang
 * mengambil kartu, tapi tidak tahu isinya (akibatnya, mis. uang berpindah, tetap terlihat).
 */
export function stateFor(s: GameState, viewer: string | null): GameState {
  const p = publicState(s);
  return {
    ...p,
    events: p.events.map((e) => (e.type === 'card' && e.player !== viewer ? { ...e, card: '' } : e)),
    lastCard: null,
  };
}

/** true kalau isi kartu ini boleh ditampilkan ke penonton layar ini. */
export function cardVisible(s: Pick<GameState, 'players'>, e: { player: string; card: string }, me: string | null): boolean {
  if (!e.card) return false; // disembunyikan server
  if (me) return e.player === me; // online: hanya pengambil kartu
  return !s.players.find((p) => p.id === e.player)?.bot; // lokal: kartu bot tertutup, kartu manusia terbuka
}

export { GROUP_COUNT };
