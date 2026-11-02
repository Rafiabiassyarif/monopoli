// Tipe akun, teman & profil — dipakai server (API) dan web supaya selalu sinkron.

/** Username: 3–16 huruf kecil, angka, atau garis bawah. */
export const USERNAME_RE = /^[a-z0-9_]{3,16}$/;
export const PASSWORD_MIN = 6;

export interface UserPublic {
  username: string;
  displayName: string;
  color: string;
  token: number;
  /** foto profil dari Google (opsional) */
  avatar?: string;
  createdAt: number;
}

export interface UserStats {
  games: number;
  wins: number;
  bankrupt: number;
  /** kekayaan tertinggi di akhir game (satuan engine) */
  bestNetWorth: number;
  propertiesBought: number;
  rentCollected: number;
}

export interface GameRecord {
  at: number;
  roomName: string;
  themeId: string;
  /** peringkat akhir (1 = menang) */
  place: number;
  players: number;
  netWorth: number;
  bankrupt: boolean;
  reason: 'bankrupt' | 'rounds' | 'short' | null;
}

export interface FriendInfo extends UserPublic {
  online: boolean;
  /** room yang sedang dimasuki teman (kalau ada) */
  room?: { code: string; name: string; started: boolean; players: number; maxPlayers: number };
}

export interface FriendsData {
  friends: FriendInfo[];
  incoming: UserPublic[];
  outgoing: UserPublic[];
}

export type Friendship = 'self' | 'friend' | 'incoming' | 'outgoing' | 'none';

export interface Profile {
  user: UserPublic;
  stats: UserStats;
  history: GameRecord[];
  friendship: Friendship;
  /** kamu memblokir pemain ini */
  blockedByMe?: boolean;
  /** hanya untuk admin: status penangguhan akun (null = tidak ditangguhkan) */
  banned?: { until: number; reason: string } | null;
}

/** Data akun yang hanya dilihat pemiliknya. */
export interface AccountPrivate {
  email?: string;
  emailVerified: boolean;
  hasPassword: boolean;
  googleLinked: boolean;
  /** server bisa mengirim email (SMTP diatur) */
  mailEnabled: boolean;
  isAdmin: boolean;
  blocked: UserPublic[];
}

/** Ikon avatar bawaan (disimpan sebagai "icon:<id>"; latar = warna pemain). */
export const AVATAR_ICONS: Record<string, string> = {
  lion: '🦁', tiger: '🐯', panda: '🐼', fox: '🦊', frog: '🐸', monkey: '🐵', penguin: '🐧', unicorn: '🦄',
  dragon: '🐲', komodo: '🦎', robot: '🤖', ninja: '🥷', crown: '👑', tophat: '🎩', rocket: '🚀', moneybag: '💰',
  diamond: '💎', dice: '🎲', house: '🏠', star: '⭐', fire: '🔥', ball: '⚽', game: '🎮', cat: '🐱',
};

export const EMAIL_RE = /^[^\s@<>]{1,64}@[^\s@<>]{1,190}\.[a-z]{2,}$/i;

export interface DirectMessage {
  from: string;
  to: string;
  text: string;
  at: number;
}

export interface Report {
  id: string;
  at: number;
  reporter: string;
  target: string;
  reason: string;
  detail: string;
  status: 'baru' | 'selesai';
}

export const REPORT_REASONS = ['Kata-kata kasar', 'Curang / sengaja mengganggu permainan', 'Nama atau profil tidak pantas', 'Spam', 'Lainnya'] as const;

// ---------- level, XP & pencapaian (dihitung dari statistik, sama di server & web) ----------

export function xpOf(s: UserStats): number {
  return s.games * 20 + s.wins * 80 + s.propertiesBought * 2 + Math.floor(s.rentCollected / 50);
}

/** Level naik makin lambat: level n butuh 50·(n−1)² XP. */
export function levelOf(xp: number): { level: number; current: number; next: number } {
  const level = Math.floor(Math.sqrt(xp / 50)) + 1;
  return { level, current: 50 * (level - 1) ** 2, next: 50 * level ** 2 };
}

export interface Achievement {
  id: string;
  title: string;
  desc: string;
  icon: string;
  done: boolean;
  /** 0..1 */
  progress: number;
}

export function achievementsOf(s: UserStats, history: GameRecord[]): Achievement[] {
  const a = (id: string, icon: string, title: string, desc: string, value: number, target: number): Achievement => ({
    id,
    icon,
    title,
    desc,
    done: value >= target,
    progress: Math.min(1, value / target),
  });
  const bigWin = history.some((h) => h.place === 1 && h.players >= 4) ? 1 : 0;
  return [
    a('first-game', '🎲', 'Lemparan pertama', 'Selesaikan 1 game online', s.games, 1),
    a('first-win', '🏆', 'Juragan pemula', 'Menang 1 game online', s.wins, 1),
    a('ten-games', '🎯', 'Pemain setia', 'Selesaikan 10 game online', s.games, 10),
    a('five-wins', '👑', 'Raja properti', 'Menang 5 game online', s.wins, 5),
    a('big-table', '🎉', 'Meja ramai', 'Menang melawan 3 pemain atau lebih', bigWin, 1),
    a('collector', '🏘️', 'Kolektor', 'Beli total 50 properti', s.propertiesBought, 50),
    a('landlord', '💰', 'Tuan tanah', 'Terima total sewa 10.000 satuan', s.rentCollected, 10_000),
    a('tycoon', '💎', 'Konglomerat', 'Akhiri game dengan kekayaan 5.000 satuan', s.bestNetWorth, 5000),
  ];
}

/** Filter kata kasar sederhana (Indonesia + Inggris): huruf diganti bintang. */
const BAD = ['anjing', 'anjg', 'bangsat', 'bajingan', 'kontol', 'memek', 'ngentot', 'entot', 'goblok', 'tolol', 'jancok', 'jancuk', 'kampret', 'pepek', 'pantek', 'lonte', 'fuck', 'fck', 'shit', 'bitch', 'asshole', 'cunt', 'bastard', 'motherfucker'];
// awal kata saja, supaya kata biasa yang kebetulan memuatnya (mis. "Scunthorpe") tidak ikut tersensor
const BAD_RE = new RegExp(`\\b(${BAD.join('|')})`, 'gi');
export function cleanText(t: string): string {
  return t.replace(BAD_RE, (w) => w[0] + '*'.repeat(w.length - 1));
}

export interface AuthResult {
  token: string;
  user: UserPublic;
  /** akun baru dibuat (mis. pertama kali masuk dengan Google) */
  created?: boolean;
}

export const emptyStats = (): UserStats => ({ games: 0, wins: 0, bankrupt: 0, bestNetWorth: 0, propertiesBought: 0, rentCollected: 0 });
