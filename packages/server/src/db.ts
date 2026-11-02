// Penyimpanan akun, sesi, pertemanan & riwayat game. File JSON sederhana (cukup untuk ribuan akun).
// ponytail: ganti ke database sungguhan (Postgres/SQLite) kalau pemain sudah sangat banyak atau server lebih dari satu.

import { createHash, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { emptyStats, type DirectMessage, type GameRecord, type Report, type UserPublic, type UserStats } from '@monopoli/engine';

export interface UserRec {
  id: string;
  username: string;
  displayName: string;
  color: string;
  token: number;
  avatar?: string;
  createdAt: number;
  /** scrypt: salt:hash (hex). Kosong untuk akun yang hanya pakai Google */
  pass?: string;
  googleSub?: string;
  email?: string;
  /** email sudah dikonfirmasi lewat link */
  emailVerified?: boolean;
  friends: string[];
  /** pemain yang diblokir (tidak bisa mengirim permintaan, undangan, pesan) */
  blocked: string[];
  /** permintaan pertemanan masuk / keluar (id user) */
  incoming: string[];
  outgoing: string[];
  stats: UserStats;
  history: GameRecord[];
  /** akun ditangguhkan admin: until = jam berakhir (0 = permanen) */
  banned?: { until: number; reason: string; by: string };
}

/** masih ditangguhkan? (penangguhan yang sudah lewat waktunya otomatis tidak berlaku) */
export const isBanned = (u: UserRec | undefined) => !!u?.banned && (u.banned.until === 0 || u.banned.until > Date.now());

interface Session {
  userId: string;
  exp: number;
}

interface MailToken {
  userId: string;
  kind: 'verify' | 'reset';
  /** email yang dikonfirmasi (verify) */
  email?: string;
  exp: number;
}

interface Data {
  users: Record<string, UserRec>;
  /** kunci = sha256(token) — token asli tidak pernah disimpan */
  sessions: Record<string, Session>;
  /** token di link email (verifikasi / reset password), kunci = sha256(token) */
  mailTokens?: Record<string, MailToken>;
  /** chat pribadi, kunci = "idA:idB" (urut) */
  dms?: Record<string, DirectMessage[]>;
  reports?: Report[];
}

const SESSION_DAYS = 30;
const HISTORY_MAX = 20;
const COLORS = ['#ef4444', '#3b82f6', '#22c55e', '#eab308', '#a855f7', '#f97316'];

export class Db {
  private data: Data = { users: {}, sessions: {} };
  private dirty = false;
  private byName = new Map<string, string>();
  private byGoogle = new Map<string, string>();
  private byEmail = new Map<string, string>();

  constructor(private file: string | null) {
    if (file) {
      try {
        this.data = JSON.parse(readFileSync(file, 'utf8'));
      } catch (e) {
        if ((e as NodeJS.ErrnoException).code !== 'ENOENT') console.error('gagal memuat akun', e);
      }
      setInterval(() => this.flush(), 3000).unref();
    }
    this.data.mailTokens ??= {};
    this.data.dms ??= {};
    this.data.reports ??= [];
    for (const u of Object.values(this.data.users)) {
      u.stats = { ...emptyStats(), ...u.stats };
      u.history ??= [];
      u.blocked ??= [];
      if (u.email) this.byEmail.set(u.email, u.id);
      this.byName.set(u.username, u.id);
      if (u.googleSub) this.byGoogle.set(u.googleSub, u.id);
    }
  }

  flush() {
    if (!this.file || !this.dirty) return;
    this.dirty = false;
    try {
      mkdirSync(dirname(this.file), { recursive: true });
      writeFileSync(this.file + '.tmp', JSON.stringify(this.data));
      renameSync(this.file + '.tmp', this.file);
    } catch (e) {
      console.error('gagal menyimpan akun', e);
    }
  }

  private touch() {
    this.dirty = true;
  }

  // ---------- user ----------
  get(id: string | undefined | null): UserRec | undefined {
    return id ? this.data.users[id] : undefined;
  }
  byUsername(name: string): UserRec | undefined {
    return this.get(this.byName.get(String(name).toLowerCase()));
  }
  byGoogleSub(sub: string): UserRec | undefined {
    return this.get(this.byGoogle.get(sub));
  }
  byEmailAddr(email: string): UserRec | undefined {
    return this.get(this.byEmail.get(String(email).toLowerCase().trim()));
  }

  create(p: { username: string; displayName: string; password?: string; googleSub?: string; email?: string; avatar?: string }): UserRec {
    const u: UserRec = {
      id: randomBytes(9).toString('base64url'),
      username: p.username,
      displayName: p.displayName,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      token: Math.floor(Math.random() * 6),
      avatar: p.avatar,
      createdAt: Date.now(),
      pass: p.password ? hashPassword(p.password) : undefined,
      googleSub: p.googleSub,
      email: p.email,
      friends: [],
      blocked: [],
      incoming: [],
      outgoing: [],
      stats: emptyStats(),
      history: [],
    };
    this.data.users[u.id] = u;
    this.byName.set(u.username, u.id);
    if (u.googleSub) this.byGoogle.set(u.googleSub, u.id);
    if (u.email) this.byEmail.set(u.email, u.id);
    this.touch();
    return u;
  }

  // ---------- keamanan akun ----------
  setEmail(u: UserRec, email: string | undefined, verified: boolean) {
    if (u.email) this.byEmail.delete(u.email);
    u.email = email?.toLowerCase().trim() || undefined;
    u.emailVerified = !!u.email && verified;
    if (u.email) this.byEmail.set(u.email, u.id);
    this.touch();
  }
  setPassword(u: UserRec, pw: string) {
    u.pass = hashPassword(pw);
    this.touch();
  }
  linkGoogle(u: UserRec, sub: string | undefined, avatar?: string) {
    if (u.googleSub) this.byGoogle.delete(u.googleSub);
    u.googleSub = sub;
    if (sub) this.byGoogle.set(sub, u.id);
    if (avatar && !u.avatar) u.avatar = avatar;
    this.touch();
  }
  /** Hapus akun beserta sesi, token, dan semua hubungan pertemanan. */
  remove(u: UserRec) {
    for (const other of Object.values(this.data.users)) if (other.id !== u.id) this.unlink(other, u);
    for (const other of Object.values(this.data.users)) other.blocked = other.blocked.filter((x) => x !== u.id);
    for (const [k, s] of Object.entries(this.data.sessions)) if (s.userId === u.id) delete this.data.sessions[k];
    for (const [k, t] of Object.entries(this.data.mailTokens!)) if (t.userId === u.id) delete this.data.mailTokens![k];
    for (const k of Object.keys(this.data.dms!)) if (k.split(':').includes(u.id)) delete this.data.dms![k];
    this.byName.delete(u.username);
    if (u.googleSub) this.byGoogle.delete(u.googleSub);
    if (u.email) this.byEmail.delete(u.email);
    delete this.data.users[u.id];
    this.touch();
  }
  /** Keluarkan semua sesi user (mis. setelah reset password), kecuali satu token yang dipertahankan. */
  endAllSessions(userId: string, keepToken?: string) {
    const keep = keepToken ? sha(keepToken) : '';
    for (const [k, s] of Object.entries(this.data.sessions)) if (s.userId === userId && k !== keep) delete this.data.sessions[k];
    this.touch();
  }
  newMailToken(userId: string, kind: MailToken['kind'], minutes: number, email?: string): string {
    // satu token aktif per jenis per user
    for (const [k, t] of Object.entries(this.data.mailTokens!)) if (t.userId === userId && t.kind === kind) delete this.data.mailTokens![k];
    const token = randomBytes(24).toString('base64url');
    this.data.mailTokens![sha(token)] = { userId, kind, email, exp: Date.now() + minutes * 60_000 };
    this.touch();
    return token;
  }
  /** Ambil & hapus token email (sekali pakai). */
  takeMailToken(token: unknown, kind: MailToken['kind']): MailToken | undefined {
    if (typeof token !== 'string' || token.length > 100) return undefined;
    const k = sha(token);
    const t = this.data.mailTokens![k];
    if (!t || t.kind !== kind) return undefined;
    delete this.data.mailTokens![k];
    this.touch();
    return t.exp >= Date.now() ? t : undefined;
  }

  // ---------- chat pribadi ----------
  private dmKey = (a: string, b: string) => (a < b ? `${a}:${b}` : `${b}:${a}`);
  dmList(a: UserRec, b: UserRec): DirectMessage[] {
    return this.data.dms![this.dmKey(a.id, b.id)] ?? [];
  }
  dmAdd(a: UserRec, b: UserRec, text: string): DirectMessage {
    const k = this.dmKey(a.id, b.id);
    const m: DirectMessage = { from: a.username, to: b.username, text, at: Date.now() };
    this.data.dms![k] = [...(this.data.dms![k] ?? []), m].slice(-100);
    this.touch();
    return m;
  }

  // ---------- laporan ----------
  addReport(r: Omit<Report, 'id' | 'at' | 'status'>): Report {
    const rep: Report = { ...r, id: randomBytes(6).toString('base64url'), at: Date.now(), status: 'baru' };
    this.data.reports = [rep, ...this.data.reports!].slice(0, 1000);
    this.touch();
    return rep;
  }
  reports(): Report[] {
    return this.data.reports!;
  }
  closeReport(id: string) {
    const r = this.data.reports!.find((x) => x.id === id);
    if (r) r.status = 'selesai';
    this.touch();
  }

  // ---------- blokir ----------
  block(a: UserRec, b: UserRec) {
    this.unlink(a, b);
    if (!a.blocked.includes(b.id)) a.blocked.push(b.id);
    this.touch();
  }
  unblock(a: UserRec, b: UserRec) {
    a.blocked = a.blocked.filter((x) => x !== b.id);
    this.touch();
  }
  /** salah satu memblokir yang lain */
  isBlocked(a: UserRec, b: UserRec) {
    return a.blocked.includes(b.id) || b.blocked.includes(a.id);
  }
  all(): UserRec[] {
    return Object.values(this.data.users);
  }

  /** Username unik dari teks bebas (mis. bagian depan email Google). */
  freeUsername(base: string): string {
    let b = base.toLowerCase().replace(/[^a-z0-9_]/g, '').slice(0, 12);
    if (b.length < 3) b = (b + 'pemain').slice(0, 6);
    if (!this.byName.has(b)) return b;
    for (let i = 2; i < 10_000; i++) if (!this.byName.has(`${b}${i}`)) return `${b}${i}`;
    return `${b}${randomBytes(2).toString('hex')}`;
  }

  update(u: UserRec, p: Partial<Pick<UserRec, 'displayName' | 'color' | 'token' | 'avatar'>>) {
    Object.assign(u, p);
    this.touch();
  }

  search(q: string, limit = 10): UserRec[] {
    const s = q.toLowerCase().trim();
    if (s.length < 2) return [];
    return Object.values(this.data.users)
      .filter((u) => u.username.includes(s) || u.displayName.toLowerCase().includes(s))
      .sort((a, b) => Number(!a.username.startsWith(s)) - Number(!b.username.startsWith(s)) || a.username.localeCompare(b.username))
      .slice(0, limit);
  }

  // ---------- sesi ----------
  newSession(userId: string): string {
    const token = randomBytes(32).toString('base64url');
    this.data.sessions[sha(token)] = { userId, exp: Date.now() + SESSION_DAYS * 86400_000 };
    this.touch();
    return token;
  }
  userForToken(token: unknown): UserRec | undefined {
    if (typeof token !== 'string' || token.length < 20 || token.length > 100) return undefined;
    const s = this.data.sessions[sha(token)];
    if (!s) return undefined;
    if (s.exp < Date.now()) {
      delete this.data.sessions[sha(token)];
      this.touch();
      return undefined;
    }
    const u = this.get(s.userId);
    return isBanned(u) ? undefined : u;
  }

  /** tangguhkan akun. Sesi tidak dihapus supaya pemain bisa diberi tahu alasannya; selama ditangguhkan sesi tidak berlaku. */
  ban(u: UserRec, until: number, reason: string, by: string) {
    u.banned = { until, reason, by };
    this.touch();
  }
  /** pemilik token kalau akunnya sedang ditangguhkan (untuk pesan "akun ditangguhkan") */
  bannedForToken(token: unknown): UserRec | undefined {
    if (typeof token !== 'string' || token.length < 20 || token.length > 100) return undefined;
    const s = this.data.sessions[sha(token)];
    const u = s && s.exp >= Date.now() ? this.get(s.userId) : undefined;
    return isBanned(u) ? u : undefined;
  }
  unban(u: UserRec) {
    delete u.banned;
    this.touch();
  }
  endSession(token: string) {
    delete this.data.sessions[sha(token)];
    this.touch();
  }
  pruneSessions() {
    const now = Date.now();
    for (const [k, s] of Object.entries(this.data.sessions)) if (s.exp < now || !this.data.users[s.userId]) delete this.data.sessions[k];
    for (const [k, t] of Object.entries(this.data.mailTokens!)) if (t.exp < now) delete this.data.mailTokens![k];
    this.touch();
  }

  // ---------- pertemanan ----------
  /** Kirim permintaan. Kalau dia sudah lebih dulu meminta → langsung berteman. */
  request(a: UserRec, b: UserRec): 'sent' | 'friends' | 'already' {
    if (a.friends.includes(b.id)) return 'already';
    if (a.incoming.includes(b.id)) {
      this.accept(a, b);
      return 'friends';
    }
    if (!a.outgoing.includes(b.id)) a.outgoing.push(b.id);
    if (!b.incoming.includes(a.id)) b.incoming.push(a.id);
    this.touch();
    return 'sent';
  }
  /** a menerima permintaan dari b. */
  accept(a: UserRec, b: UserRec): boolean {
    if (!a.incoming.includes(b.id)) return false;
    a.incoming = a.incoming.filter((x) => x !== b.id);
    b.outgoing = b.outgoing.filter((x) => x !== a.id);
    if (!a.friends.includes(b.id)) a.friends.push(b.id);
    if (!b.friends.includes(a.id)) b.friends.push(a.id);
    this.touch();
    return true;
  }
  /** Hapus teman / tolak / batalkan permintaan — semua hubungan a↔b dilepas. */
  unlink(a: UserRec, b: UserRec) {
    a.friends = a.friends.filter((x) => x !== b.id);
    b.friends = b.friends.filter((x) => x !== a.id);
    a.incoming = a.incoming.filter((x) => x !== b.id);
    a.outgoing = a.outgoing.filter((x) => x !== b.id);
    b.incoming = b.incoming.filter((x) => x !== a.id);
    b.outgoing = b.outgoing.filter((x) => x !== a.id);
    this.touch();
  }

  // ---------- statistik ----------
  recordGame(u: UserRec, rec: GameRecord, extra: { propertiesBought: number; rentCollected: number }) {
    const s = u.stats;
    s.games++;
    if (rec.place === 1) s.wins++;
    if (rec.bankrupt) s.bankrupt++;
    s.bestNetWorth = Math.max(s.bestNetWorth, rec.netWorth);
    s.propertiesBought += extra.propertiesBought;
    s.rentCollected += extra.rentCollected;
    u.history = [rec, ...u.history].slice(0, HISTORY_MAX);
    this.touch();
  }
}

export const publicUser = (u: UserRec): UserPublic => ({ username: u.username, displayName: u.displayName, color: u.color, token: u.token, avatar: u.avatar, createdAt: u.createdAt });

const sha = (s: string) => createHash('sha256').update(s).digest('hex');

export function hashPassword(pw: string): string {
  const salt = randomBytes(16);
  return `${salt.toString('hex')}:${scryptSync(pw, salt, 64).toString('hex')}`;
}

export function checkPassword(pw: string, stored: string | undefined): boolean {
  if (!stored) return false;
  const [saltHex, hashHex] = stored.split(':');
  if (!saltHex || !hashHex) return false;
  const want = Buffer.from(hashHex, 'hex');
  const got = scryptSync(pw, Buffer.from(saltHex, 'hex'), want.length);
  return want.length === got.length && timingSafeEqual(want, got);
}
