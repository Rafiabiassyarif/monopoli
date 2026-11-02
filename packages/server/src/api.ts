// HTTP API akun: daftar/masuk (password & Google), keamanan akun, profil, pertemanan, blokir, laporan,
// chat pribadi, peringkat.
// Semua respons JSON. Token sesi dikirim lewat header "Authorization: Bearer <token>".

import type { IncomingMessage, ServerResponse } from 'node:http';
import {
  AVATAR_ICONS,
  EMAIL_RE,
  PASSWORD_MIN,
  REPORT_REASONS,
  USERNAME_RE,
  cleanText,
  levelOf,
  xpOf,
  type AccountPrivate,
  type AuthResult,
  type FriendInfo,
  type FriendsData,
  type Friendship,
  type Profile,
  type ServerMsg,
} from '@monopoli/engine';
import { checkPassword, isBanned, publicUser, type Db, type UserRec } from './db';
import { codeMail, gameMail, mailEnabled, sendMail } from './mailer';
import { createHash, randomInt } from 'node:crypto';
import { logError } from './ops';
import { AVATAR_MAX, dropAvatar, saveAvatar } from './avatars';

export interface Social {
  online(userId: string): boolean;
  roomOf(userId: string): FriendInfo['room'];
  /** kirim pesan ke semua koneksi milik user */
  push(userId: string, msg: ServerMsg): void;
  /** putuskan semua koneksi WS milik user (mis. akun ditangguhkan) */
  kick(userId: string): void;
}

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID ?? '';
/** username admin (pisahkan dengan koma) — bisa melihat & menutup laporan */
const ADMINS = (process.env.ADMIN_USERNAMES ?? '').split(',').map((x) => x.trim().toLowerCase()).filter(Boolean);
const AUTH_PER_MIN = Number(process.env.AUTH_RATE ?? 20);

class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

const authHits = new Map<string, number[]>();
/** kode masuk lewat email yang sedang menunggu: email → hash kode, kedaluwarsa, sisa percobaan */
const otps = new Map<string, { hash: string; exp: number; tries: number; sent: number }>();
const OTP_MS = 10 * 60_000;
const sha = (s: string) => createHash('sha256').update(s).digest('hex');
setInterval(() => {
  const now = Date.now();
  for (const [k, v] of otps) if (v.exp < now) otps.delete(k);
}, 60_000).unref();
const dmLast = new Map<string, number>();
function limitAuth(ip: string) {
  const now = Date.now();
  const list = (authHits.get(ip) ?? []).filter((t) => now - t < 60_000);
  if (list.length >= AUTH_PER_MIN) throw new HttpError(429, 'Terlalu banyak percobaan. Tunggu sebentar.');
  list.push(now);
  authHits.set(ip, list);
}

async function body(req: IncomingMessage, max = 16 * 1024): Promise<Record<string, unknown>> {
  let size = 0;
  const chunks: Buffer[] = [];
  for await (const c of req) {
    size += (c as Buffer).length;
    if (size > max) throw new HttpError(413, 'Data terlalu besar');
    chunks.push(c as Buffer);
  }
  if (!chunks.length) return {};
  try {
    const v = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    return v && typeof v === 'object' ? v : {};
  } catch {
    throw new HttpError(400, 'JSON tidak valid');
  }
}

const cleanName = (v: unknown) => String(v ?? '').replace(/[<>\p{C}]/gu, '').trim().slice(0, 16);
const isColor = (v: unknown): v is string => typeof v === 'string' && /^#[0-9a-f]{6}$/i.test(v);

function json(res: ServerResponse, status: number, data: unknown) {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
  res.end(JSON.stringify(data));
}

/** Verifikasi ID token Google lewat endpoint resmi tokeninfo (tanpa library tambahan). */
async function verifyGoogle(credential: string) {
  if (!GOOGLE_CLIENT_ID) throw new HttpError(400, 'Login Google belum diaktifkan di server (GOOGLE_CLIENT_ID kosong)');
  let r: Response;
  try {
    r = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(credential)}`, { signal: AbortSignal.timeout(10_000) });
  } catch {
    throw new HttpError(502, 'Server tidak bisa menghubungi Google untuk memverifikasi login. Cek koneksi internet server.');
  }
  if (!r.ok) throw new HttpError(401, 'Token Google tidak valid');
  const t = (await r.json()) as Record<string, string>;
  if (t.aud !== GOOGLE_CLIENT_ID) throw new HttpError(401, 'Token Google bukan untuk aplikasi ini');
  if (!['accounts.google.com', 'https://accounts.google.com'].includes(t.iss)) throw new HttpError(401, 'Penerbit token tidak dikenal');
  if (Number(t.exp) * 1000 < Date.now()) throw new HttpError(401, 'Token Google kedaluwarsa');
  return { sub: t.sub, email: t.email, name: t.name || t.given_name || '', picture: t.picture, verified: t.email_verified === 'true' };
}

export function createApi(db: Db, social: Social) {
  const friendInfo = (u: UserRec): FriendInfo => ({ ...publicUser(u), online: social.online(u.id), room: social.roomOf(u.id) });
  const friendsData = (me: UserRec): FriendsData => {
    const list = (ids: string[]) => ids.map((id) => db.get(id)).filter((x): x is UserRec => !!x);
    return {
      friends: list(me.friends)
        .map(friendInfo)
        .sort((a, b) => Number(b.online) - Number(a.online) || a.displayName.localeCompare(b.displayName)),
      incoming: list(me.incoming).map(publicUser),
      outgoing: list(me.outgoing).map(publicUser),
    };
  };
  const relation = (me: UserRec | undefined, u: UserRec): Friendship =>
    !me ? 'none' : me.id === u.id ? 'self' : me.friends.includes(u.id) ? 'friend' : me.incoming.includes(u.id) ? 'incoming' : me.outgoing.includes(u.id) ? 'outgoing' : 'none';

  const banMessage = (u: UserRec) => {
    const until = u.banned!.until ? new Date(u.banned!.until).toISOString().slice(0, 10) : '';
    return until ? `Akun ditangguhkan sampai ${until}: ${u.banned!.reason}` : `Akun ditangguhkan: ${u.banned!.reason}`;
  };
  const signIn = (u: UserRec, created = false): AuthResult => {
    if (isBanned(u)) throw new HttpError(403, banMessage(u));
    return { token: db.newSession(u.id), user: publicUser(u), created };
  };
  const account = (u: UserRec): AccountPrivate => ({
    email: u.email,
    emailVerified: !!u.emailVerified,
    hasPassword: !!u.pass,
    googleLinked: !!u.googleSub,
    mailEnabled: mailEnabled(),
    isAdmin: ADMINS.includes(u.username),
    blocked: u.blocked.map((id) => db.get(id)).filter((x): x is UserRec => !!x).map(publicUser),
  });
  /** alamat game untuk link di email (dari header Origin browser, atau APP_URL di .env) */
  const appUrl = (req: IncomingMessage) => {
    if (process.env.APP_URL) return process.env.APP_URL.replace(/\/$/, '');
    const o = String(req.headers.origin ?? '');
    if (/^https?:\/\/[^/]+$/.test(o)) return o;
    return `http://${req.headers.host ?? 'localhost:3020'}`;
  };
  const mailVerify = (req: IncomingMessage, u: UserRec, email: string) => {
    const t = db.newMailToken(u.id, 'verify', 24 * 60, email);
    return sendMail(gameMail(email, 'Konfirmasi email akun Monopoli 3D', `Halo ${u.displayName}, tekan tombol di bawah untuk mengonfirmasi email ini untuk akun @${u.username}.`, 'Konfirmasi email', `${appUrl(req)}/?verify=${t}`, 'Link berlaku 24 jam. Abaikan email ini kalau kamu tidak merasa mendaftar.'));
  };
  const cleanEmail = (v: unknown) => {
    const e = String(v ?? '').trim().toLowerCase();
    if (!EMAIL_RE.test(e)) throw new HttpError(400, 'Format email tidak valid');
    return e;
  };
  const requireCurrentPassword = (u: UserRec, pw: unknown) => {
    if (u.pass && !checkPassword(String(pw ?? ''), u.pass)) throw new HttpError(401, 'Password sekarang salah');
  };

  /** Tangani /api/*. Mengembalikan false kalau bukan rute API. */
  return async function handleApi(req: IncomingMessage, res: ServerResponse, ip: string): Promise<boolean> {
    const url = new URL(req.url ?? '/', 'http://x');
    if (!url.pathname.startsWith('/api/')) return false;
    const path = url.pathname.slice(4);
    const method = req.method ?? 'GET';
    const token = String(req.headers.authorization ?? '').replace(/^Bearer\s+/i, '');
    const me = db.userForToken(token);
    const need = () => {
      if (!me) {
        const b = db.bannedForToken(token);
        if (b) throw new HttpError(403, banMessage(b));
        throw new HttpError(401, 'Masuk dulu untuk memakai fitur ini');
      }
      return me;
    };
    const other = (name: unknown) => {
      const u = db.byUsername(String(name ?? ''));
      if (!u) throw new HttpError(404, 'Pemain tidak ditemukan');
      return u;
    };

    try {
      // ---------- umum ----------
      if (path === '/config' && method === 'GET') return json(res, 200, { googleClientId: GOOGLE_CLIENT_ID || null }), true;

      // ---------- akun ----------
      if (path === '/register' && method === 'POST') {
        limitAuth(ip);
        const b = await body(req);
        const username = String(b.username ?? '').toLowerCase().trim();
        const password = String(b.password ?? '');
        if (!USERNAME_RE.test(username)) throw new HttpError(400, 'Username 3–16 huruf kecil, angka, atau _');
        if (password.length < PASSWORD_MIN || password.length > 200) throw new HttpError(400, `Password minimal ${PASSWORD_MIN} karakter`);
        if (db.byUsername(username)) throw new HttpError(409, 'Username sudah dipakai');
        const email = b.email ? cleanEmail(b.email) : undefined;
        if (email && db.byEmailAddr(email)) throw new HttpError(409, 'Email sudah dipakai akun lain');
        const u = db.create({ username, displayName: cleanName(b.displayName) || username, password });
        if (email) {
          db.setEmail(u, email, false);
          mailVerify(req, u, email).catch((e) => console.error('gagal kirim email verifikasi', e));
        }
        return json(res, 201, signIn(u, true)), true;
      }
      // ---------- masuk dengan email (kode 6 angka) — akun dibuat otomatis untuk email baru ----------
      if (path === '/email/start' && method === 'POST') {
        limitAuth(ip);
        const email = cleanEmail((await body(req)).email);
        const now = Date.now();
        const prev = otps.get(email);
        if (prev && now - prev.sent < 30_000) throw new HttpError(429, 'Tunggu 30 detik sebelum meminta kode baru');
        const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
        otps.set(email, { hash: sha(`${email}:${code}`), exp: now + OTP_MS, tries: 5, sent: now });
        try {
          await sendMail(codeMail(email, code));
        } catch (e) {
          otps.delete(email);
          logError('gagal kirim kode masuk', e);
          throw new HttpError(502, 'Email gagal dikirim. Cek pengaturan SMTP di server.');
        }
        return json(res, 200, { ok: true, mailEnabled: mailEnabled(), exists: !!db.byEmailAddr(email) }), true;
      }
      if (path === '/email/verify' && method === 'POST') {
        limitAuth(ip);
        const b = await body(req);
        const email = cleanEmail(b.email);
        const code = String(b.code ?? '').replace(/\D/g, '');
        const o = otps.get(email);
        if (!o || o.exp < Date.now()) throw new HttpError(400, 'Kode sudah kedaluwarsa. Minta kode baru.');
        if (sha(`${email}:${code}`) !== o.hash) {
          if (--o.tries <= 0) otps.delete(email);
          throw new HttpError(400, o.tries > 0 ? 'Kode salah' : 'Terlalu banyak kode salah. Minta kode baru.');
        }
        otps.delete(email);
        let u = db.byEmailAddr(email);
        let created = false;
        if (!u) {
          const local = email.split('@')[0];
          u = db.create({ username: db.freeUsername(local), displayName: cleanName(local.replace(/[._-]+/g, ' ').replace(/\b\p{L}/gu, (c) => c.toUpperCase())) || 'Pemain' });
          created = true;
        }
        db.setEmail(u, email, true); // menerima kode = email terbukti miliknya
        return json(res, 200, signIn(u, created)), true;
      }
      if (path === '/login' && method === 'POST') {
        limitAuth(ip);
        const b = await body(req);
        const u = db.byUsername(String(b.username ?? '').toLowerCase().trim());
        // pesan sama untuk username salah & password salah (tidak membocorkan akun mana yang ada)
        if (!u || !checkPassword(String(b.password ?? ''), u.pass)) throw new HttpError(401, u && !u.pass ? 'Akun ini dibuat dengan Google — masuk dengan Google' : 'Username atau password salah');
        return json(res, 200, signIn(u)), true;
      }
      if (path === '/google' && method === 'POST') {
        limitAuth(ip);
        const b = await body(req);
        const g = await verifyGoogle(String(b.credential ?? ''));
        let u = db.byGoogleSub(g.sub);
        let created = false;
        // email Google sama dengan akun email yang sudah ada → akun yang sama
        const same = !u && g.verified && g.email ? db.byEmailAddr(g.email.toLowerCase()) : undefined;
        if (same) {
          db.linkGoogle(same, g.sub, g.picture);
          u = same;
        }
        if (!u) {
          u = db.create({ username: db.freeUsername(g.email?.split('@')[0] || g.name || 'pemain'), displayName: cleanName(g.name) || 'Pemain', googleSub: g.sub, email: g.verified ? g.email : undefined, avatar: g.picture });
          created = true;
        }
        return json(res, 200, signIn(u, created)), true;
      }
      if (path === '/logout' && method === 'POST') {
        if (me) db.endSession(token);
        return json(res, 200, { ok: true }), true;
      }
      if (path === '/me' && method === 'GET') {
        const u = need();
        return json(res, 200, { user: publicUser(u), account: account(u) }), true;
      }

      // ---------- keamanan akun ----------
      if (path === '/me/email' && method === 'POST') {
        limitAuth(ip);
        const u = need();
        const b = await body(req);
        const email = cleanEmail(b.email);
        const other = db.byEmailAddr(email);
        if (other && other.id !== u.id) throw new HttpError(409, 'Email sudah dipakai akun lain');
        if (email !== u.email || !u.emailVerified) db.setEmail(u, email, false);
        await mailVerify(req, u, email).catch((e) => {
          console.error('gagal kirim email', e);
          throw new HttpError(502, 'Email gagal dikirim. Cek pengaturan SMTP di server.');
        });
        return json(res, 200, { account: account(u), sent: mailEnabled() }), true;
      }
      if (path === '/verify-email' && method === 'POST') {
        limitAuth(ip);
        const t = db.takeMailToken((await body(req)).token, 'verify');
        const u = db.get(t?.userId);
        if (!t || !u || u.email !== t.email) throw new HttpError(400, 'Link konfirmasi tidak berlaku atau sudah kedaluwarsa');
        db.setEmail(u, t.email, true);
        return json(res, 200, { ok: true, username: u.username }), true;
      }
      if (path === '/forgot' && method === 'POST') {
        limitAuth(ip);
        const q = String((await body(req)).login ?? '').trim().toLowerCase();
        const u = q.includes('@') ? db.byEmailAddr(q) : db.byUsername(q);
        if (u?.email) {
          const t = db.newMailToken(u.id, 'reset', 30);
          sendMail(gameMail(u.email, 'Atur ulang password Monopoli 3D', `Halo ${u.displayName}, ada permintaan atur ulang password untuk akun @${u.username}.`, 'Buat password baru', `${appUrl(req)}/?reset=${t}`, 'Link berlaku 30 menit dan hanya bisa dipakai sekali. Abaikan email ini kalau bukan kamu yang meminta.')).catch((e) => console.error('gagal kirim email reset', e));
        }
        // jawaban selalu sama → tidak membocorkan username/email mana yang terdaftar
        return json(res, 200, { ok: true, mailEnabled: mailEnabled() }), true;
      }
      if (path === '/reset' && method === 'POST') {
        limitAuth(ip);
        const b = await body(req);
        const password = String(b.password ?? '');
        if (password.length < PASSWORD_MIN || password.length > 200) throw new HttpError(400, `Password minimal ${PASSWORD_MIN} karakter`);
        const t = db.takeMailToken(b.token, 'reset');
        const u = db.get(t?.userId);
        if (!t || !u) throw new HttpError(400, 'Link reset tidak berlaku atau sudah kedaluwarsa. Minta link baru.');
        db.setPassword(u, password);
        db.endAllSessions(u.id); // keluarkan semua perangkat lama
        if (u.email && !u.emailVerified) db.setEmail(u, u.email, true); // menerima email = email terbukti miliknya
        return json(res, 200, signIn(u)), true;
      }
      if (path === '/me/password' && method === 'POST') {
        limitAuth(ip);
        const u = need();
        const b = await body(req);
        requireCurrentPassword(u, b.current);
        const password = String(b.password ?? '');
        if (password.length < PASSWORD_MIN || password.length > 200) throw new HttpError(400, `Password minimal ${PASSWORD_MIN} karakter`);
        db.setPassword(u, password);
        db.endAllSessions(u.id, token); // perangkat lain keluar, perangkat ini tetap masuk
        return json(res, 200, { account: account(u) }), true;
      }
      if (path === '/me/google' && method === 'POST') {
        limitAuth(ip);
        const u = need();
        const g = await verifyGoogle(String((await body(req)).credential ?? ''));
        const other = db.byGoogleSub(g.sub);
        if (other && other.id !== u.id) throw new HttpError(409, 'Akun Google ini sudah dipakai akun lain');
        db.linkGoogle(u, g.sub, g.picture);
        if (!u.email && g.verified && g.email && !db.byEmailAddr(g.email)) db.setEmail(u, g.email, true);
        return json(res, 200, { user: publicUser(u), account: account(u) }), true;
      }
      if (path === '/me/google' && method === 'DELETE') {
        const u = need();
        if (!u.pass && !(u.email && u.emailVerified)) throw new HttpError(400, 'Tambahkan & konfirmasi email dulu sebelum melepas Google, supaya kamu tetap bisa masuk');
        db.linkGoogle(u, undefined);
        return json(res, 200, { account: account(u) }), true;
      }
      if (path === '/me' && method === 'DELETE') {
        limitAuth(ip);
        const u = need();
        const b = await body(req);
        if (String(b.confirm ?? '').toLowerCase() !== u.username) throw new HttpError(400, 'Ketik username kamu untuk konfirmasi');
        requireCurrentPassword(u, b.password);
        const friends = [...u.friends];
        dropAvatar(u.avatar);
        db.remove(u);
        friends.forEach((id) => social.push(id, { t: 'social' }));
        return json(res, 200, { ok: true }), true;
      }

      // ---------- blokir & laporan ----------
      if (path === '/blocks' && method === 'POST') {
        const u = need();
        const o = other((await body(req)).username);
        if (o.id === u.id) throw new HttpError(400, 'Tidak bisa memblokir diri sendiri');
        db.block(u, o);
        social.push(o.id, { t: 'social' });
        return json(res, 200, { account: account(u), ...friendsData(u) }), true;
      }
      const unb = /^\/blocks\/([a-z0-9_]{1,32})$/.exec(path);
      if (unb && method === 'DELETE') {
        const u = need();
        db.unblock(u, other(unb[1]));
        return json(res, 200, { account: account(u) }), true;
      }
      if (path === '/reports' && method === 'POST') {
        limitAuth(ip);
        const u = need();
        const b = await body(req);
        const o = other(b.username);
        const reason = String(b.reason ?? '');
        if (!(REPORT_REASONS as readonly string[]).includes(reason)) throw new HttpError(400, 'Pilih alasan laporan');
        const r = db.addReport({ reporter: u.username, target: o.username, reason, detail: String(b.detail ?? '').replace(/\p{C}/gu, ' ').slice(0, 500) });
        console.log(`[laporan] @${r.reporter} melaporkan @${r.target}: ${r.reason} — ${r.detail}`);
        const adminMail = process.env.ADMIN_EMAIL;
        if (adminMail) sendMail(gameMail(adminMail, `Laporan pemain: @${r.target}`, `@${r.reporter} melaporkan @${r.target} (${r.reason}). ${r.detail}`, 'Buka game', appUrl(req), 'Lihat semua laporan di menu Teman → Laporan (akun admin).')).catch(() => {});
        return json(res, 200, { ok: true }), true;
      }
      if (path === '/admin/reports' && method === 'GET') {
        const u = need();
        if (!ADMINS.includes(u.username)) throw new HttpError(403, 'Khusus admin');
        return json(res, 200, { reports: db.reports() }), true;
      }
      const closeRep = /^\/admin\/reports\/([A-Za-z0-9_-]{1,20})$/.exec(path);
      if (closeRep && method === 'POST') {
        const u = need();
        if (!ADMINS.includes(u.username)) throw new HttpError(403, 'Khusus admin');
        db.closeReport(closeRep[1]);
        return json(res, 200, { reports: db.reports() }), true;
      }

      const banM = /^\/admin\/ban\/([a-z0-9_]{1,32})$/.exec(path);
      if (banM && (method === 'POST' || method === 'DELETE')) {
        const u = need();
        if (!ADMINS.includes(u.username)) throw new HttpError(403, 'Khusus admin');
        const o = other(banM[1]);
        if (ADMINS.includes(o.username)) throw new HttpError(400, 'Tidak bisa menangguhkan admin');
        if (method === 'DELETE') {
          db.unban(o);
          return json(res, 200, { ok: true, banned: null }), true;
        }
        const b = await body(req);
        const days = Number(b.days ?? 0);
        if (!Number.isFinite(days) || days < 0 || days > 3650) throw new HttpError(400, 'Lama penangguhan tidak valid');
        const reason = String(b.reason ?? '').replace(/\p{C}/gu, ' ').trim().slice(0, 200) || 'Melanggar ketentuan';
        db.ban(o, days ? Date.now() + days * 86_400_000 : 0, reason, u.username);
        social.kick(o.id);
        o.friends.forEach((id) => social.push(id, { t: 'social' }));
        return json(res, 200, { ok: true, banned: o.banned }), true;
      }

      // ---------- chat pribadi ----------
      const dm = /^\/dm\/([a-z0-9_]{1,32})$/.exec(path);
      if (dm && method === 'GET') {
        const u = need();
        const o = other(dm[1]);
        if (!u.friends.includes(o.id)) throw new HttpError(403, 'Chat pribadi hanya dengan teman');
        return json(res, 200, { messages: db.dmList(u, o).slice(-50) }), true;
      }
      if (dm && method === 'POST') {
        const u = need();
        const o = other(dm[1]);
        if (!u.friends.includes(o.id) || db.isBlocked(u, o)) throw new HttpError(403, 'Chat pribadi hanya dengan teman');
        const now = Date.now();
        if ((dmLast.get(u.id) ?? 0) > now - 600) throw new HttpError(429, 'Pelan-pelan, tunggu sebentar');
        dmLast.set(u.id, now);
        const text = cleanText(String((await body(req)).text ?? '').replace(/\p{C}/gu, ' ').trim().slice(0, 500));
        if (!text) throw new HttpError(400, 'Pesan kosong');
        const m = db.dmAdd(u, o, text);
        social.push(o.id, { t: 'dm', message: m });
        social.push(u.id, { t: 'dm', message: m });
        return json(res, 200, { message: m }), true;
      }

      // ---------- peringkat ----------
      if (path === '/leaderboard' && method === 'GET') {
        const by = url.searchParams.get('by') === 'wins' ? 'wins' : url.searchParams.get('by') === 'rate' ? 'rate' : 'xp';
        const score = (x: UserRec) => (by === 'wins' ? x.stats.wins : by === 'rate' ? (x.stats.games >= 5 ? x.stats.wins / x.stats.games : -1) : xpOf(x.stats));
        const list = db
          .all()
          .filter((x) => x.stats.games > 0 && score(x) >= 0)
          .sort((a, b) => score(b) - score(a) || b.stats.wins - a.stats.wins || a.username.localeCompare(b.username));
        const row = (x: UserRec, rank: number) => ({ rank, user: publicUser(x), games: x.stats.games, wins: x.stats.wins, xp: xpOf(x.stats), level: levelOf(xpOf(x.stats)).level });
        const meRank = me ? list.findIndex((x) => x.id === me.id) : -1;
        return json(res, 200, { by, top: list.slice(0, 50).map((x, i) => row(x, i + 1)), me: meRank >= 0 ? row(list[meRank], meRank + 1) : null }), true;
      }
      if (path === '/me' && method === 'PATCH') {
        const u = need();
        const b = await body(req);
        const patch: Partial<Pick<UserRec, 'displayName' | 'color' | 'token' | 'avatar'>> = {};
        // avatar: "icon:<id>" (ikon bawaan) atau "" (kembali ke bidak)
        if (b.avatar !== undefined) {
          const a = String(b.avatar ?? '');
          if (a && !(a.startsWith('icon:') && AVATAR_ICONS[a.slice(5)])) throw new HttpError(400, 'Ikon tidak dikenal');
          if (a !== u.avatar) dropAvatar(u.avatar);
          patch.avatar = a || undefined;
        }
        if (b.displayName !== undefined) {
          const n = cleanName(b.displayName);
          if (n.length < 2) throw new HttpError(400, 'Nama tampilan minimal 2 huruf');
          patch.displayName = n;
        }
        if (b.color !== undefined && isColor(b.color)) patch.color = b.color.toLowerCase();
        if (b.token !== undefined) patch.token = Math.min(5, Math.max(0, Number(b.token) | 0));
        db.update(u, patch);
        u.friends.forEach((id) => social.push(id, { t: 'social' }));
        return json(res, 200, { user: publicUser(u) }), true;
      }

      if (path === '/me/avatar' && method === 'POST') {
        const u = need();
        const now = Date.now();
        if ((dmLast.get(`av:${u.id}`) ?? 0) > now - 3000) throw new HttpError(429, 'Pelan-pelan, tunggu sebentar');
        const b = await body(req, Math.ceil(AVATAR_MAX * 1.4) + 1024);
        const r = saveAvatar(u.id, String(b.image ?? ''));
        if ('error' in r) throw new HttpError(400, r.error);
        dmLast.set(`av:${u.id}`, now);
        dropAvatar(u.avatar);
        db.update(u, { avatar: r.url });
        u.friends.forEach((id) => social.push(id, { t: 'social' }));
        return json(res, 200, { user: publicUser(u) }), true;
      }

      // ---------- pemain & profil ----------
      if (path === '/users' && method === 'GET') {
        const q = url.searchParams.get('q') ?? '';
        return json(res, 200, { users: db.search(q).filter((u) => !me || !u.blocked.includes(me.id)).map((u) => ({ ...publicUser(u), friendship: relation(me, u) })) }), true;
      }
      const prof = /^\/users\/([a-z0-9_]{1,32})$/.exec(path);
      if (prof && method === 'GET') {
        const u = other(prof[1]);
        const p: Profile = { user: publicUser(u), stats: u.stats, history: u.history, friendship: relation(me, u), blockedByMe: !!me?.blocked.includes(u.id) };
        // admin melihat status penangguhan
        if (me && ADMINS.includes(me.username)) p.banned = isBanned(u) ? { until: u.banned!.until, reason: u.banned!.reason } : null;
        return json(res, 200, p), true;
      }

      // ---------- teman ----------
      if (path === '/friends' && method === 'GET') return json(res, 200, friendsData(need())), true;
      if (path === '/friends' && method === 'POST') {
        const u = need();
        const b = await body(req);
        const o = other(b.username);
        if (o.id === u.id) throw new HttpError(400, 'Tidak bisa berteman dengan diri sendiri');
        if (u.blocked.includes(o.id)) throw new HttpError(400, 'Kamu memblokir pemain ini. Buka blokir dulu di profilnya.');
        // diblokir oleh dia: pura-pura terkirim (tidak memberi tahu bahwa ia memblokir)
        if (o.blocked.includes(u.id)) return json(res, 200, { result: 'sent', ...friendsData(u) }), true;
        if (u.friends.length >= 200) throw new HttpError(400, 'Daftar teman penuh (maks 200)');
        const r = db.request(u, o);
        social.push(o.id, { t: 'social' });
        social.push(o.id, { t: 'notice', text: r === 'friends' ? `${u.displayName} sekarang temanmu` : `${u.displayName} ingin berteman denganmu` });
        social.push(u.id, { t: 'social' });
        return json(res, 200, { result: r, ...friendsData(u) }), true;
      }
      if (path === '/friends/accept' && method === 'POST') {
        const u = need();
        const o = other((await body(req)).username);
        if (!db.accept(u, o)) throw new HttpError(404, 'Tidak ada permintaan dari pemain ini');
        social.push(o.id, { t: 'social' });
        social.push(o.id, { t: 'notice', text: `${u.displayName} menerima pertemananmu` });
        social.push(u.id, { t: 'social' });
        return json(res, 200, friendsData(u)), true;
      }
      const del = /^\/friends\/([a-z0-9_]{1,32})$/.exec(path);
      if (del && method === 'DELETE') {
        const u = need();
        const o = other(del[1]);
        db.unlink(u, o);
        social.push(o.id, { t: 'social' });
        social.push(u.id, { t: 'social' });
        return json(res, 200, friendsData(u)), true;
      }

      if (path === '/client-error' && method === 'POST') {
        // galat dari browser pemain → dicatat ke log server (dibatasi supaya tidak bisa membanjiri disk)
        limitAuth(ip);
        const b = await body(req);
        logError('klien', `${String(b.message ?? '').slice(0, 500)}\n${String(b.stack ?? '').slice(0, 2000)}\n@ ${String(b.url ?? '').slice(0, 200)}`);
        return json(res, 200, { ok: true }), true;
      }

      throw new HttpError(404, 'Rute API tidak ada');
    } catch (e) {
      if (e instanceof HttpError) json(res, e.status, { error: e.message });
      else {
        logError('api error', e);
        json(res, 500, { error: 'Terjadi kesalahan di server' });
      }
      return true;
    }
  };
}
