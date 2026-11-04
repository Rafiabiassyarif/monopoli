// Server multiplayer online. Server-authoritative: klien hanya kirim Action, server validasi pakai engine yang sama.
// Room disimpan di memori + snapshot ke file JSON (DATA_FILE) supaya game tidak hilang saat server restart.

import './env'; // harus pertama: isi process.env dari .env
import { createServer, type IncomingMessage } from 'node:http';
import { randomBytes } from 'node:crypto';
import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { dirname, extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';
import { WebSocketServer, type WebSocket } from 'ws';
import {
  EMOTES,
  TURN_SECONDS,
  changedOptions,
  getTheme,
  sanitizeOptions,
  actorId,
  applyAction,
  botAction,
  createGame,
  migrateState,
  publicState,
  safeAction,
  validateTheme,
  RuleError,
  type Action,
  type BotLevel,
  type ClientMsg,
  type GameState,
  type LobbySeat,
  type Options,
  type RoomSummary,
  type RoomInfo,
  type ServerMsg,
  type Theme,
  netWorth,
  ranking,
  type FriendInfo,
  cleanText,
} from '@monopoli/engine';
import { Db, publicUser, type UserRec } from './db';
import { createApi } from './api';
import { legalPage } from './legal';
import { readAvatar } from './avatars';
import { logError, startBackups } from './ops';

const PORT = Number(process.env.PORT ?? 3020);
const WEB_DIST = fileURLToPath(new URL('../../web/dist/', import.meta.url));
const DATA_FILE = process.env.DATA_FILE ?? fileURLToPath(new URL('../data/rooms.json', import.meta.url));
const PERSIST = process.env.PERSIST !== '0';
const BOT_DELAY = Number(process.env.BOT_DELAY ?? 700);
/** pemain yang putus koneksi dimainkan otomatis (aksi aman) setelah sekian ms per aksi */
const DISCONNECT_GRACE = Number(process.env.DISCONNECT_GRACE ?? 15_000);
/** kursi di lobby dilepas kalau pemiliknya putus lebih lama dari ini */
const LOBBY_GRACE = Number(process.env.LOBBY_GRACE ?? 30_000);
const MAX_SEATS = 6;
const MAX_CONN_PER_IP = 30;
const MAX_ROOMS_PER_IP_PER_MIN = 6;
/** maks pesan per koneksi per 10 detik (anti-banjir) */
const RATE = Number(process.env.RATE_LIMIT ?? 120);
const USERS_FILE = process.env.USERS_FILE ?? fileURLToPath(new URL('../data/users.json', import.meta.url));

// ---------- akun & status online ----------
const db = new Db(PERSIST ? USERS_FILE : null);
/** koneksi WS milik tiap user yang sedang online (bisa lebih dari satu tab) */
const presence = new Map<string, Set<WebSocket>>();
const pushTo = (userId: string, m: ServerMsg) => presence.get(userId)?.forEach((w) => send(w, m));
/** room (yang sedang ia masuki & terhubung) milik user */
function roomOf(userId: string): FriendInfo['room'] {
  for (const r of rooms.values())
    if (r.seats.some((s) => s.userId === userId && s.ws && !s.bot)) return { code: r.code, name: r.name, started: !!r.state, players: r.seats.length, maxPlayers: r.maxPlayers };
  return undefined;
}
/** beri tahu teman-teman user bahwa status online / room-nya berubah */
function friendsChanged(userId: string | undefined) {
  const u = db.get(userId);
  u?.friends.forEach((f) => pushTo(f, { t: 'social' }));
}
const roomChanged = (r: Room) => r.seats.forEach((s) => s.userId && friendsChanged(s.userId));
const handleApi = createApi(db, {
  online: (id) => !!presence.get(id)?.size,
  roomOf,
  push: pushTo,
  kick: (id) => {
    pushTo(id, { t: 'notice', text: 'Akunmu ditangguhkan admin' });
    presence.get(id)?.forEach((w) => w.close(4003, 'banned'));
  },
});
setInterval(() => db.pruneSessions(), 6 * 3600_000).unref();

interface Seat extends LobbySeat {
  secret: string;
  /** akun pemilik kursi (tamu: kosong) — tidak pernah dikirim ke klien, yang dikirim username */
  userId?: string;
  ws: WebSocket | null;
  leaveTimer?: NodeJS.Timeout | null;
  lastChat?: number;
  lastEmote?: number;
}

interface Room {
  code: string;
  seats: Seat[];
  themeId: string;
  customTheme: Theme | null;
  botLevel: BotLevel;
  turnSeconds: number;
  name: string;
  isPublic: boolean;
  maxPlayers: number;
  rules: Options;
  state: GameState | null;
  botTimer: NodeJS.Timeout | null;
  /** timer AFK/putus: aksi pemain manusia dijalankan otomatis (aksi aman) saat habis */
  afkTimer: NodeJS.Timeout | null;
  afkKey: string;
  touched: number;
  /** statistik game ini sudah dicatat ke akun pemain */
  recorded?: boolean;
  /** penonton (tidak ikut main, hanya menerima state/chat) */
  watchers?: Set<WebSocket>;
}

const rooms = new Map<string, Room>();
const id = (n = 6) => randomBytes(n).toString('base64url');
const newCode = () => {
  let c: string;
  do c = Array.from({ length: 5 }, () => 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[randomBytes(1)[0] % 32]).join('');
  while (rooms.has(c));
  return c;
};

const BOT_NAMES = ['Bot Budi', 'Bot Sari', 'Bot Joko', 'Bot Ayu', 'Bot Rudi', 'Bot Mega'];
/** sama dengan palet di web (ui.tsx) supaya warna bot tidak kembar dengan pilihan pemain */
const COLORS = ['#ef4444', '#3b82f6', '#22c55e', '#eab308', '#a855f7', '#f97316'];

const info = (r: Room): RoomInfo => ({
  code: r.code,
  seats: r.seats.map(({ secret, ws, leaveTimer, lastChat, lastEmote, userId, ...s }) => ({ ...s, username: db.get(userId)?.username, connected: s.bot || !!ws })),
  themeId: r.themeId,
  customTheme: r.customTheme,
  botLevel: r.botLevel,
  turnSeconds: r.turnSeconds,
  name: r.name,
  isPublic: r.isPublic,
  maxPlayers: r.maxPlayers,
  rules: r.rules,
  started: !!r.state,
  spectators: r.watchers?.size ?? 0,
});

const send = (ws: WebSocket | null, m: ServerMsg) => ws?.readyState === 1 && ws.send(JSON.stringify(m));
const broadcast = (r: Room, m: ServerMsg) => {
  r.seats.forEach((s) => send(s.ws, m));
  r.watchers?.forEach((w) => send(w, m));
};
function unwatch(ctx: Ctx, ws: WebSocket) {
  const r = ctx.watching;
  ctx.watching = undefined;
  if (!r?.watchers?.delete(ws)) return;
  if (rooms.has(r.code)) broadcast(r, { t: 'room', room: info(r) });
}
/** seed RNG & urutan dek tidak pernah dikirim ke klien (anti-curang) */
const sendState = (r: Room, ws?: WebSocket | null) => {
  if (!r.state) return;
  const m: ServerMsg = { t: 'state', state: publicState(r.state) };
  if (ws !== undefined) send(ws, m);
  else broadcast(r, m);
  if (r.state.phase === 'gameover' && !r.recorded) recordGame(r);
  markDirty();
};

/** Catat hasil game online ke statistik & riwayat tiap pemain yang punya akun. */
function recordGame(r: Room) {
  const s = r.state!;
  r.recorded = true;
  const order = ranking(s);
  for (const seat of r.seats) {
    const u = db.get(seat.userId);
    const p = s.players.find((x) => x.id === seat.id);
    if (!u || !p) continue;
    db.recordGame(
      u,
      { at: Date.now(), roomName: r.name, themeId: r.customTheme?.id ?? r.themeId, place: order.findIndex((x) => x.id === p.id) + 1, players: s.players.length, netWorth: p.bankrupt ? 0 : netWorth(s, p.id), bankrupt: p.bankrupt, reason: s.endReason },
      { propertiesBought: p.stats.bought, rentCollected: p.stats.rentIn },
    );
  }
}
const humansOnline = (r: Room) => r.seats.some((s) => !s.bot && s.ws);
const seatOf = (r: Room, pid: string | null) => r.seats.find((s) => s.id === pid);

function clearTimers(r: Room) {
  if (r.afkTimer) clearTimeout(r.afkTimer);
  if (r.botTimer) clearTimeout(r.botTimer);
  r.afkTimer = r.botTimer = null;
  r.seats.forEach((s) => s.leaveTimer && clearTimeout(s.leaveTimer));
}

function deleteRoom(r: Room) {
  clearTimers(r);
  rooms.delete(r.code);
  markDirty();
}

/** Jalankan aksi; kalau engine menolak, pakai aksi aman supaya game tidak pernah macet. */
function run(r: Room, pid: string, action: Action, label: string): boolean {
  if (!r.state) return false;
  try {
    r.state = applyAction(r.state, pid, action);
    return true;
  } catch (e) {
    console.error(`${label} ditolak (${r.code}):`, (e as Error).message, action);
    const f = safeAction(r.state);
    if (!f) return false;
    try {
      r.state = applyAction(r.state, f.pid, f.action);
      return true;
    } catch (e2) {
      console.error(`aksi aman gagal (${r.code}):`, (e2 as Error).message, f.action);
      return false;
    }
  }
}

function armAfk(r: Room) {
  const s = r.state;
  if (!s || s.phase === 'gameover') {
    if (r.afkTimer) clearTimeout(r.afkTimer);
    r.afkTimer = null;
    return;
  }
  const actor = actorId(s);
  const seat = seatOf(r, actor);
  const human = !!actor && !s.players.find((p) => p.id === actor)!.bot;
  const offline = human && !seat?.ws;
  // kunci = siapa + fase + status koneksi; timer hanya direset saat giliran/fase berpindah orang
  const key = `${actor}:${s.phase}:${s.trade ? 't' : ''}:${s.auction?.turn ?? ''}:${s.auction?.tile ?? ''}:${s.turnCount}:${offline}`;
  if (key === r.afkKey) return;
  r.afkKey = key;
  if (r.afkTimer) clearTimeout(r.afkTimer);
  r.afkTimer = null;
  let ms = human && r.turnSeconds ? r.turnSeconds * 1000 : Infinity;
  if (offline) ms = Math.min(ms, DISCONNECT_GRACE);
  if (!human || ms === Infinity || !humansOnline(r)) return broadcast(r, { t: 'timer', actor: null, deadline: 0, ms: 0 });
  broadcast(r, { t: 'timer', actor, deadline: Date.now() + ms, ms });
  r.afkTimer = setTimeout(() => {
    r.afkTimer = null;
    if (!r.state) return;
    // AFK / putus: hanya aksi aman — tolak beli → lelang, lewati lelang, tolak tukar, lempar/selesai giliran
    const b = safeAction(r.state);
    if (!b || !run(r, b.pid, b.action, 'afk')) return;
    r.afkKey = '';
    sendState(r);
    scheduleBots(r);
  }, ms);
}

function scheduleBots(r: Room) {
  armAfk(r);
  if (r.botTimer || !r.state || r.state.phase === 'gameover') return;
  // tidak ada manusia yang terhubung → jeda (hemat CPU); lanjut saat ada yang kembali
  if (!humansOnline(r)) return;
  const b = botAction(r.state, r.botLevel);
  if (!b) return;
  r.botTimer = setTimeout(() => {
    r.botTimer = null;
    if (!r.state) return;
    const now = botAction(r.state, r.botLevel);
    if (!now || !run(r, now.pid, now.action, 'bot')) return;
    sendState(r);
    scheduleBots(r);
  }, BOT_DELAY);
}

function sanitizeRoomName(n: unknown) {
  return String(n ?? '').replace(/[<>\p{C}]/gu, '').trim().slice(0, 32);
}

/** Room publik yang masih menunggu pemain (belum mulai & belum penuh), terbaru dulu. */
function publicRooms(): RoomSummary[] {
  const all = [...rooms.values()].filter((r) => r.isPublic && r.seats.some((s) => !s.bot && s.ws)).sort((a, b) => b.touched - a.touched);
  const open = all.filter((r) => !r.state && r.seats.length < r.maxPlayers).slice(0, 30);
  // room yang sedang bermain → bisa ditonton
  const live = all.filter((r) => r.state && r.state.phase !== 'gameover').slice(0, 10);
  return [...open, ...live].map((r) => ({
      started: !!r.state,
      spectators: r.watchers?.size ?? 0,
      code: r.code,
      name: r.name,
      host: r.seats.find((s) => s.host)?.name ?? '',
      players: r.seats.length,
      maxPlayers: r.maxPlayers,
      themeId: r.customTheme?.id ?? r.themeId,
      themeName: r.customTheme?.name ?? getTheme(r.themeId).name,
      startCash: r.rules.startCash,
      maxRounds: r.rules.maxRounds,
      houseRules: changedOptions(r.rules).filter((k) => k !== 'startCash' && k !== 'maxRounds' && k !== 'freeParkingStart').length,
    }));
}

function sanitizeName(n: unknown) {
  return String(n ?? '').replace(/[<>\p{C}]/gu, '').trim().slice(0, 16) || 'Pemain';
}
const sanitizeToken = (t: unknown) => Math.min(5, Math.max(0, Number(t) | 0));
function pickColor(r: Room, c: unknown, self?: Seat) {
  const taken = r.seats.filter((s) => s !== self).map((s) => s.color);
  const want = typeof c === 'string' && /^#[0-9a-f]{6}$/i.test(c) ? c.toLowerCase() : '';
  if (want && !taken.includes(want)) return want;
  return COLORS.find((x) => !taken.includes(x)) ?? COLORS[0];
}

/** Host pindah ke manusia pertama yang terhubung (atau manusia mana pun). */
function ensureHost(r: Room) {
  const humans = r.seats.filter((s) => !s.bot);
  if (humans.some((s) => s.host)) return;
  r.seats.forEach((s) => (s.host = false));
  const h = humans.find((s) => s.ws) ?? humans[0];
  if (h) h.host = true;
}

function removeSeat(r: Room, seat: Seat) {
  if (seat.leaveTimer) clearTimeout(seat.leaveTimer);
  r.seats = r.seats.filter((s) => s !== seat);
  setTimeout(() => friendsChanged(seat.userId), 0);
  if (!r.seats.some((s) => !s.bot)) return deleteRoom(r);
  ensureHost(r);
  broadcast(r, { t: 'room', room: info(r) });
  markDirty();
}

/** Pemain keluar di tengah game → kursinya diambil alih bot supaya game tetap jalan. */
function seatToBot(r: Room, seat: Seat) {
  seat.bot = true;
  seat.host = false;
  setTimeout(() => friendsChanged(seat.userId), 0);
  seat.ws = null;
  seat.name = seat.name.startsWith('Bot ') ? seat.name : `${seat.name} (bot)`.slice(0, 20);
  if (r.state) {
    r.state = structuredClone(r.state);
    const p = r.state.players.find((x) => x.id === seat.id);
    if (p) Object.assign(p, { bot: true, name: seat.name });
  }
  if (!r.seats.some((s) => !s.bot)) return deleteRoom(r);
  ensureHost(r);
  r.afkKey = '';
  broadcast(r, { t: 'room', room: info(r) });
  sendState(r);
  scheduleBots(r);
}

// ---------- rate limit ----------
const connPerIp = new Map<string, number>();
const roomsCreated = new Map<string, number[]>();
const invited = new Map<string, number>();
function allowCreate(ip: string) {
  const now = Date.now();
  const list = (roomsCreated.get(ip) ?? []).filter((t) => now - t < 60_000);
  if (list.length >= MAX_ROOMS_PER_IP_PER_MIN) return false;
  list.push(now);
  roomsCreated.set(ip, list);
  return true;
}

interface Ctx {
  room?: Room;
  seat?: Seat;
  /** akun yang login di koneksi ini (tamu: kosong) */
  user?: UserRec;
  /** room yang sedang ditonton */
  watching?: Room;
  ip: string;
  /** token bucket: maks RATE pesan per 10 detik */
  tokens: number;
  refill: number;
  warned: number;
}

function handle(ws: WebSocket, ctx: Ctx, raw: string) {
  const now = Date.now();
  ctx.tokens = Math.min(RATE, ctx.tokens + ((now - ctx.refill) / 10_000) * RATE);
  ctx.refill = now;
  if (ctx.tokens < 1) {
    if (now - ctx.warned > 2000) {
      ctx.warned = now;
      send(ws, { t: 'error', message: 'Terlalu cepat — tunggu sebentar' });
    }
    return;
  }
  ctx.tokens--;

  let m: ClientMsg;
  try {
    m = JSON.parse(raw);
  } catch {
    return;
  }
  if (!m || typeof m !== 'object') return;
  const err = (message: string) => send(ws, { t: 'error', message });
  const { room, seat } = ctx;

  switch (m.t) {
    case 'create': {
      if (!allowCreate(ctx.ip)) return err('Terlalu banyak room dibuat. Coba lagi sebentar lagi.');
      const r: Room = {
        code: newCode(),
        seats: [],
        themeId: 'indonesia',
        customTheme: null,
        botLevel: 'normal',
        turnSeconds: 60,
        name: '',
        isPublic: m.isPublic !== false,
        maxPlayers: MAX_SEATS,
        rules: sanitizeOptions({}),
        state: null,
        botTimer: null,
        afkTimer: null,
        afkKey: '',
        touched: now,
      };
      const s: Seat = { id: id(), secret: id(12), name: ctx.user?.displayName ?? sanitizeName(m.name), userId: ctx.user?.id, color: '', token: sanitizeToken(m.token), bot: false, connected: true, host: true, ws };
      s.color = pickColor(r, m.color, s);
      r.name = sanitizeRoomName(m.roomName) || `Room ${s.name}`;
      r.seats.push(s);
      rooms.set(r.code, r);
      Object.assign(ctx, { room: r, seat: s });
      send(ws, { t: 'joined', you: s.id, secret: s.secret, room: info(r) });
      friendsChanged(s.userId);
      markDirty();
      return;
    }
    case 'list': {
      return send(ws, { t: 'rooms', rooms: publicRooms() });
    }
    case 'quick': {
      // room publik menunggu pemain: paling ramai dulu (cepat penuh → cepat mulai), lalu yang terbaru
      const pick = [...rooms.values()]
        .filter((r) => r.isPublic && !r.state && r.seats.length < r.maxPlayers && r.seats.some((s) => !s.bot && s.ws) && !(ctx.user && r.seats.some((s) => s.userId === ctx.user!.id)))
        .sort((a, b) => b.seats.filter((s) => !s.bot).length - a.seats.filter((s) => !s.bot).length || b.touched - a.touched)[0];
      const base = { name: m.name, color: m.color, token: m.token };
      ctx.tokens++; // diteruskan sebagai satu pesan, jangan dihitung dua kali
      return handle(ws, ctx, JSON.stringify(pick ? { t: 'join', code: pick.code, ...base } : { t: 'create', ...base, isPublic: true }));
    }
    case 'watch': {
      const r = rooms.get(String(m.code ?? '').toUpperCase());
      if (!r) return err('Room tidak ditemukan');
      if (!r.state) return err('Permainan belum dimulai — gabung saja sebagai pemain');
      if (ctx.room) return err('Kamu sedang di room lain');
      if ((r.watchers?.size ?? 0) >= 50) return err('Penonton sudah penuh');
      unwatch(ctx, ws);
      (r.watchers ??= new Set()).add(ws);
      ctx.watching = r;
      send(ws, { t: 'watching', room: info(r), spectators: r.watchers.size });
      sendState(r, ws);
      broadcast(r, { t: 'room', room: info(r) });
      return;
    }
    case 'join': {
      const r = rooms.get(String(m.code ?? '').toUpperCase());
      if (!r) return err('Room tidak ditemukan');
      unwatch(ctx, ws);
      const back = m.resume ? r.seats.find((s) => s.secret === m.resume) : undefined;
      if (back) {
        if (back.bot) return err('Kursimu sudah diambil alih bot');
        if (back.leaveTimer) clearTimeout(back.leaveTimer);
        back.leaveTimer = null;
        if (back.ws && back.ws !== ws) back.ws.close();
        back.ws = ws;
        r.touched = now;
        Object.assign(ctx, { room: r, seat: back });
        ensureHost(r);
        send(ws, { t: 'joined', you: back.id, secret: back.secret, room: info(r) });
        if (r.state) {
          sendState(r, ws);
          r.afkKey = '';
          scheduleBots(r);
        }
        broadcast(r, { t: 'room', room: info(r) });
        friendsChanged(back.userId);
        return;
      }
      if (r.state) return err('Permainan sudah dimulai');
      if (r.seats.length >= r.maxPlayers) return err('Room penuh');
      if (ctx.user && r.seats.some((x) => x.userId === ctx.user!.id && !x.bot)) return err('Akunmu sudah duduk di room ini (tab lain?)');
      const s: Seat = { id: id(), secret: id(12), name: ctx.user?.displayName ?? sanitizeName(m.name), userId: ctx.user?.id, color: '', token: sanitizeToken(m.token), bot: false, connected: true, host: false, ws };
      s.color = pickColor(r, m.color, s);
      r.seats.push(s);
      Object.assign(ctx, { room: r, seat: s });
      send(ws, { t: 'joined', you: s.id, secret: s.secret, room: info(r) });
      broadcast(r, { t: 'room', room: info(r) });
      friendsChanged(s.userId);
      markDirty();
      return;
    }
    case 'hello': {
      const u = db.userForToken(m.token);
      send(ws, { t: 'hello', user: u ? publicUser(u) : null });
      if (!u || ctx.user?.id === u.id) return;
      ctx.user = u;
      const set = presence.get(u.id) ?? new Set<WebSocket>();
      const first = set.size === 0;
      set.add(ws);
      presence.set(u.id, set);
      if (first) friendsChanged(u.id);
      return;
    }
  }

  if (ctx.watching && !room) {
    if (m.t === 'leave') {
      unwatch(ctx, ws);
      return send(ws, { t: 'left' });
    }
    if (m.t === 'chat' || m.t === 'action' || m.t === 'emote') return err('Penonton tidak bisa ikut bermain atau chat');
  }
  if (!room || !seat || !rooms.has(room.code) || !room.seats.includes(seat)) return err('Belum masuk room');
  room.touched = now;

  switch (m.t) {
    case 'addBot': {
      if (!seat.host || room.state) return err('Hanya host sebelum mulai');
      if (room.seats.length >= room.maxPlayers) return err('Room penuh');
      const used = room.seats.map((s) => s.name);
      const name = BOT_NAMES.find((n) => !used.includes(n)) ?? `Bot ${room.seats.length + 1}`;
      const b: Seat = { id: id(), secret: id(12), name, color: '', token: room.seats.length % 6, bot: true, connected: true, host: false, ws: null };
      b.color = pickColor(room, null, b);
      room.seats.push(b);
      markDirty();
      return broadcast(room, { t: 'room', room: info(room) });
    }
    case 'kick': {
      if (!seat.host || room.state) return err('Hanya host sebelum mulai');
      const k = room.seats.find((s) => s.id === m.seat && !s.host);
      if (!k) return;
      send(k.ws, { t: 'error', message: 'Kamu dikeluarkan host' });
      k.ws?.close();
      return removeSeat(room, k);
    }
    case 'settings': {
      if (!seat.host || room.state) return err('Hanya host sebelum mulai');
      if (m.customTheme) {
        const e = validateTheme(m.customTheme);
        if (e.length) return err('Tema kustom tidak valid: ' + e[0]);
      }
      room.themeId = String(m.themeId).slice(0, 40);
      room.customTheme = m.customTheme ?? null;
      room.botLevel = (['easy', 'normal', 'hard'] as const).includes(m.botLevel) ? m.botLevel : 'normal';
      room.turnSeconds = (TURN_SECONDS as readonly number[]).includes(m.turnSeconds) ? m.turnSeconds : 60;
      // aturan: gabungkan dengan yang lama, lalu rapikan ke batas aman (nilai aneh dari klien tidak bisa lolos)
      if (m.rules && typeof m.rules === 'object') room.rules = sanitizeOptions({ ...room.rules, ...m.rules });
      if (m.name !== undefined) room.name = sanitizeRoomName(m.name) || room.name;
      if (m.isPublic !== undefined) room.isPublic = !!m.isPublic;
      if (m.maxPlayers !== undefined) room.maxPlayers = Math.min(MAX_SEATS, Math.max(2, room.seats.length, Number(m.maxPlayers) | 0));
      markDirty();
      return broadcast(room, { t: 'room', room: info(room) });
    }
    case 'start': {
      if (!seat.host || room.state) return err('Hanya host sebelum mulai');
      if (room.seats.length < 2) return err('Minimal 2 pemain');
      room.state = createGame(
        room.seats.map((s) => ({ id: s.id, name: s.name, color: s.color, token: s.token, bot: s.bot })),
        randomBytes(4).readInt32LE(0),
        room.rules,
        room.customTheme?.decks, // kartu kustom tema JSON host (sudah divalidasi saat dipilih)
      );
      room.afkKey = '';
      room.recorded = false;
      broadcast(room, { t: 'room', room: info(room) });
      sendState(room);
      roomChanged(room);
      return scheduleBots(room);
    }
    case 'invite': {
      if (!ctx.user) return err('Masuk dengan akun untuk mengundang teman');
      const f = db.byUsername(String(m.username ?? ''));
      if (!f || !ctx.user.friends.includes(f.id)) return err('Hanya bisa mengundang teman');
      if (db.isBlocked(ctx.user, f)) return err('Tidak bisa mengundang pengguna ini');
      if (!presence.get(f.id)?.size) return err(`${f.displayName} sedang offline`);
      const key = `${room.code}:${f.id}`;
      if ((invited.get(key) ?? 0) > now - 10_000) return err('Tunggu sebentar sebelum mengundang lagi');
      invited.set(key, now);
      pushTo(f.id, { t: 'invite', from: publicUser(ctx.user), code: room.code, roomName: room.name });
      return send(ws, { t: 'notice', text: `Undangan terkirim ke ${f.displayName}` });
    }
    case 'rematch': {
      if (!seat.host) return err('Hanya host yang bisa memulai ulang');
      if (!room.state || room.state.phase !== 'gameover') return err('Permainan belum selesai');
      clearTimers(room);
      room.state = null;
      room.afkKey = '';
      // kursi manusia yang sudah tidak terhubung dilepas supaya lobby bersih
      room.seats = room.seats.filter((s) => s.bot || s.ws);
      ensureHost(room);
      markDirty();
      roomChanged(room);
      return broadcast(room, { t: 'room', room: info(room) });
    }
    case 'leave': {
      send(ws, { t: 'left' });
      ctx.room = ctx.seat = undefined;
      if (room.state && room.state.phase !== 'gameover') seatToBot(room, seat);
      else removeSeat(room, seat);
      friendsChanged(seat.userId);
      return;
    }
    case 'action': {
      if (!room.state) return err('Belum mulai');
      if (!m.action || typeof m.action !== 'object') return err('Aksi tidak valid');
      try {
        room.state = applyAction(room.state, seat.id, m.action);
      } catch (e) {
        return err(e instanceof RuleError ? e.message : 'Aksi tidak valid');
      }
      sendState(room);
      return scheduleBots(room);
    }
    case 'chat': {
      if ((seat.lastChat ?? 0) > now - 700) return; // anti spam
      seat.lastChat = now;
      const text = cleanText(String(m.text ?? '').replace(/\p{C}/gu, '').slice(0, 200).trim());
      if (text) broadcast(room, { t: 'chat', from: seat.name, text, seat: seat.id });
      return;
    }
    case 'emote': {
      if (!(EMOTES as readonly string[]).includes(m.e)) return;
      if ((seat.lastEmote ?? 0) > now - 1500) return; // anti spam
      seat.lastEmote = now;
      broadcast(room, { t: 'emote', from: seat.id, e: m.e });
      return;
    }
  }
}

// ---------- persistensi (snapshot JSON) ----------
let dirty = false;
function markDirty() {
  dirty = true;
}
function saveRooms() {
  if (!PERSIST || !dirty) return;
  dirty = false;
  try {
    const data = [...rooms.values()].map((r) => ({
      ...r,
      botTimer: null,
      afkTimer: null,
      seats: r.seats.map(({ ws, leaveTimer, ...s }) => s),
    }));
    mkdirSync(dirname(DATA_FILE), { recursive: true });
    writeFileSync(DATA_FILE + '.tmp', JSON.stringify(data));
    renameSync(DATA_FILE + '.tmp', DATA_FILE);
  } catch (e) {
    logError('gagal menyimpan room', e);
  }
}
function loadRooms() {
  if (!PERSIST) return;
  try {
    const list = JSON.parse(readFileSync(DATA_FILE, 'utf8')) as Room[];
    for (const r of list) {
      const room: Room = { ...r, botTimer: null, afkTimer: null, afkKey: '', state: r.state ? migrateState(r.state) : null, seats: r.seats.map((s) => ({ ...s, ws: null, leaveTimer: null })) };
      // snapshot versi lama: pindahkan field aturan lama ke rules
      const legacy = r as unknown as Record<string, unknown>;
      room.rules = sanitizeOptions(Object.assign({ maxRounds: legacy.maxRounds, startCash: legacy.startCash, freeParkingPot: legacy.freeParkingPot, doubleGo: legacy.doubleGo }, legacy.rules ?? {}));
      room.name ??= `Room ${room.code}`;
      room.isPublic ??= false;
      room.maxPlayers ??= MAX_SEATS;
      rooms.set(room.code, room);
    }
    if (list.length) console.log(`memulihkan ${list.length} room dari ${DATA_FILE}`);
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code !== 'ENOENT') console.error('gagal memuat room', e);
  }
}
loadRooms();
setInterval(saveRooms, 5000).unref();
for (const sig of ['SIGINT', 'SIGTERM'] as const)
  process.on(sig, () => {
    dirty = true;
    saveRooms();
    db.flush();
    process.exit(0);
  });

// ---------- HTTP (sajikan build web jika ada) + WS ----------
const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.jpg': 'image/jpeg',
  '.json': 'application/json',
  '.webmanifest': 'application/manifest+json',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.txt': 'text/plain; charset=utf-8',
};
const COMPRESSIBLE = new Set(['.html', '.js', '.mjs', '.css', '.svg', '.json', '.webmanifest', '.txt']);
const gzCache = new Map<string, Buffer>();

const ipOf = (req: IncomingMessage) => (process.env.TRUST_PROXY ? String(req.headers['x-forwarded-for'] ?? '').split(',')[0].trim() : '') || req.socket.remoteAddress || '?';

const http = createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', 'http://x');
  if (await handleApi(req, res, ipOf(req))) return;
  const av = readAvatar(url.pathname);
  if (av) {
    res.writeHead(200, { 'content-type': av.type, 'cache-control': 'public, max-age=31536000, immutable', 'x-content-type-options': 'nosniff' });
    return res.end(av.body);
  }
  if (url.pathname.startsWith('/avatars/')) return res.writeHead(404).end();
  const legal = legalPage(url.pathname, url.searchParams.get('lang'));
  if (legal) {
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-cache' });
    return res.end(legal);
  }
  if (url.pathname === '/health') {
    res.writeHead(200, { 'content-type': 'application/json' });
    return res.end(JSON.stringify({ ok: true, rooms: rooms.size }));
  }
  let rel: string;
  try {
    rel = normalize(decodeURIComponent(url.pathname)).replace(/^([/\\])+/, '');
  } catch {
    return res.writeHead(400).end();
  }
  const file = join(WEB_DIST, rel);
  if (!file.startsWith(WEB_DIST.replace(/[/\\]$/, ''))) return res.writeHead(403).end();
  for (const f of [file, join(WEB_DIST, 'index.html')]) {
    try {
      let body: Buffer = await readFile(f);
      const ext = extname(f);
      const headers: Record<string, string> = {
        'content-type': MIME[ext] ?? 'application/octet-stream',
        'x-content-type-options': 'nosniff',
        // file di /assets/ ber-hash → boleh di-cache selamanya; sisanya selalu cek ulang
        'cache-control': rel.startsWith('assets/') ? 'public, max-age=31536000, immutable' : 'no-cache',
      };
      if (COMPRESSIBLE.has(ext) && /\bgzip\b/.test(String(req.headers['accept-encoding'] ?? ''))) {
        const cached = gzCache.get(f);
        body = cached ?? gzipSync(body);
        if (!cached && rel.startsWith('assets/')) gzCache.set(f, body);
        headers['content-encoding'] = 'gzip';
        headers.vary = 'accept-encoding';
      }
      res.writeHead(200, headers);
      return res.end(body);
    } catch {}
  }
  res.writeHead(404).end('Build web belum ada. Jalankan: npm run build');
});

const wss = new WebSocketServer({ server: http, path: '/ws', maxPayload: 64 * 1024 });
wss.on('connection', (ws, req) => {
  const ip = ipOf(req);
  const n = (connPerIp.get(ip) ?? 0) + 1;
  if (n > MAX_CONN_PER_IP) {
    ws.close(1013, 'Terlalu banyak koneksi');
    return;
  }
  connPerIp.set(ip, n);
  const ctx: Ctx = { ip, tokens: RATE, refill: Date.now(), warned: 0 };
  ws.on('message', (d) => handle(ws, ctx, d.toString()));
  ws.on('close', () => {
    unwatch(ctx, ws);
    const left = (connPerIp.get(ip) ?? 1) - 1;
    if (left <= 0) connPerIp.delete(ip);
    else connPerIp.set(ip, left);
    if (ctx.user) {
      const set = presence.get(ctx.user.id);
      set?.delete(ws);
      if (set && !set.size) {
        presence.delete(ctx.user.id);
        friendsChanged(ctx.user.id);
      }
    }
    const { room, seat } = ctx;
    if (!room || !seat || seat.ws !== ws) return;
    if (seat.userId) setTimeout(() => friendsChanged(seat.userId), 0);
    seat.ws = null;
    if (!rooms.has(room.code)) return;
    broadcast(room, { t: 'room', room: info(room) });
    if (!room.state) {
      // lobby: lepas kursi kalau tidak kembali (refresh halaman cukup cepat untuk sambung ulang)
      seat.leaveTimer = setTimeout(() => !seat.ws && rooms.has(room.code) && removeSeat(room, seat), LOBBY_GRACE);
    } else {
      // dalam game: pemain yang putus dimainkan otomatis dengan aksi aman setelah DISCONNECT_GRACE
      room.afkKey = '';
      armAfk(room);
    }
    markDirty();
  });
});

// bersihkan room tak aktif > 2 jam
setInterval(() => {
  const now = Date.now();
  for (const r of rooms.values()) if (now - r.touched > 2 * 3600_000 && r.seats.every((s) => !s.ws)) deleteRoom(r);
}, 600_000).unref();

if (PERSIST) startBackups([USERS_FILE, DATA_FILE]);
process.on('uncaughtException', (e) => logError('uncaughtException', e));
process.on('unhandledRejection', (e) => logError('unhandledRejection', e));

http.listen(PORT, () => {
  console.log(`Monopoli server :${PORT}  (ws /ws)`);
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS)
    console.warn('⚠  SMTP belum diatur (SMTP_USER / SMTP_PASS di .env): kode masuk email TIDAK terkirim, hanya dicetak di jendela ini.');
});
