// Protokol WebSocket antara web & server online. Dipakai dua sisi supaya tipe selalu sinkron.

import type { Action, GameState, Options } from './game';
import type { BotLevel } from './bot';
import type { Theme } from './themes';
import type { DirectMessage, UserPublic } from './account';

export interface LobbySeat {
  id: string;
  name: string;
  color: string;
  token: number;
  bot: boolean;
  connected: boolean;
  host: boolean;
  /** username kalau pemain masuk dengan akun (tamu: tidak ada) */
  username?: string;
}

export interface RoomInfo {
  code: string;
  /** nama room yang tampil di daftar room publik */
  name: string;
  /** publik = muncul di daftar "Room terbuka"; privat = hanya lewat kode/link */
  isPublic: boolean;
  /** batas kursi (2–6) */
  maxPlayers: number;
  seats: LobbySeat[];
  themeId: string;
  customTheme: Theme | null;
  botLevel: BotLevel;
  /** detik per aksi sebelum auto-main (0 = mati) */
  turnSeconds: number;
  /** aturan main (modal, gaji START, lelang, dst.) — bawaan = aturan resmi */
  rules: Options;
  started: boolean;
  /** jumlah penonton */
  spectators?: number;
}

export interface RoomSettings {
  themeId: string;
  customTheme: Theme | null;
  botLevel: BotLevel;
  turnSeconds: number;
  /** sebagian aturan; yang tidak dikirim tetap seperti sebelumnya */
  rules?: Partial<Options>;
  name?: string;
  isPublic?: boolean;
  maxPlayers?: number;
}

/** Ringkasan room untuk daftar room publik. */
export interface RoomSummary {
  code: string;
  name: string;
  host: string;
  players: number;
  maxPlayers: number;
  themeId: string;
  themeName: string;
  startCash: number;
  maxRounds: number;
  /** jumlah aturan yang beda dari aturan resmi (0 = aturan resmi) */
  houseRules: number;
  /** sedang bermain (hanya bisa ditonton) */
  started?: boolean;
  spectators?: number;
}

/** Pilihan yang diterima server (lokal memakai pilihan yang sama). */
export const TURN_SECONDS = [0, 30, 60, 90] as const;
export const MAX_ROUNDS = [0, 10, 20, 30] as const;
/** pilihan cepat modal awal; nilai lain 500–5000 juga boleh */
export const START_CASH = [1000, 1500, 2000, 2500] as const;

export const EMOTES = ['👍', '😂', '😮', '😡', '🔥', '💸', '🙏', '🎉'] as const;

export type ClientMsg =
  /** kenalkan diri dengan token login (tamu: tidak perlu). Dipakai untuk status online & menautkan kursi ke akun */
  | { t: 'hello'; token: string }
  /** undang teman ke room yang sedang kamu masuki */
  | { t: 'invite'; username: string }
  /** tonton room yang sedang bermain (tanpa ikut main) */
  | { t: 'watch'; code: string }
  | { t: 'create'; name: string; color: string; token: number; roomName?: string; isPublic?: boolean }
  /** main cepat: gabung room publik yang masih menunggu pemain, atau buat room publik baru */
  | { t: 'quick'; name: string; color: string; token: number }
  /** minta daftar room publik yang masih menunggu pemain */
  | { t: 'list' }
  | { t: 'join'; code: string; name: string; color: string; token: number; resume?: string }
  | { t: 'addBot' }
  | { t: 'kick'; seat: string }
  | ({ t: 'settings' } & RoomSettings)
  | { t: 'start' }
  /** keluar dari room: di lobby kursi dilepas; di tengah game kursi diambil alih bot */
  | { t: 'leave' }
  /** host: setelah game selesai, kembali ke lobby dengan pemain yang sama */
  | { t: 'rematch' }
  | { t: 'action'; action: Action }
  | { t: 'chat'; text: string }
  | { t: 'emote'; e: string };

export type ServerMsg =
  | { t: 'joined'; you: string; secret: string; room: RoomInfo }
  | { t: 'room'; room: RoomInfo }
  | { t: 'state'; state: GameState }
  | { t: 'error'; message: string }
  | { t: 'chat'; from: string; text: string; seat?: string }
  | { t: 'emote'; from: string; e: string }
  /** deadline = jam server; ms = sisa waktu (klien pakai ini supaya tidak terpengaruh selisih jam) */
  | { t: 'timer'; actor: string | null; deadline: number; ms: number }
  | { t: 'left' }
  | { t: 'rooms'; rooms: RoomSummary[] }
  /** balasan hello: akun yang dikenali (null = token tidak valid → dianggap tamu) */
  | { t: 'hello'; user: UserPublic | null }
  /** daftar teman / permintaan berubah → ambil ulang lewat API */
  | { t: 'social' }
  /** pemberitahuan singkat (mis. "Budi menerima pertemananmu") */
  | { t: 'notice'; text: string }
  | { t: 'invite'; from: UserPublic; code: string; roomName: string }
  /** pesan pribadi dari / ke teman */
  | { t: 'dm'; message: DirectMessage }
  /** mulai menonton room */
  | { t: 'watching'; room: RoomInfo; spectators: number };
