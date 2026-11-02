// Uji fitur akun lanjutan: email & reset password, ganti password, hapus akun, blokir, laporan,
// chat pribadi, peringkat, halaman legal, penonton, filter kata kasar.
import { afterAll, beforeAll, expect, it } from 'vitest';
import { spawn, type ChildProcess } from 'node:child_process';
import WebSocket from 'ws';
import type { AccountPrivate, AuthResult, DirectMessage, FriendsData, Profile, ServerMsg } from '@monopoli/engine';

const PORT = 3994;
const BASE = `http://localhost:${PORT}`;
let srv: ChildProcess;
let out = '';

beforeAll(async () => {
  srv = spawn(process.execPath, ['--import', 'tsx', 'src/index.ts'], {
    cwd: new URL('..', import.meta.url),
    env: { ...process.env, PORT: String(PORT), PERSIST: '0', BOT_DELAY: '20', RATE_LIMIT: '100000', AUTH_RATE: '1000', GOOGLE_CLIENT_ID: '', SMTP_USER: '', SMTP_PASS: '', ADMIN_USERNAMES: 'admin', ADMIN_EMAIL: '', APP_URL: 'http://game.test' },
  });
  srv.stdout!.on('data', (d) => (out += String(d)));
  await new Promise<void>((ok, bad) => {
    const t = setTimeout(() => bad(new Error('server tidak start')), 15000);
    const check = () => (out.includes(`:${PORT}`) ? (clearTimeout(t), ok()) : setTimeout(check, 50));
    check();
  });
});
afterAll(() => srv?.kill());

async function api<T>(path: string, opts: { method?: string; body?: unknown; token?: string } = {}): Promise<{ status: number; data: T & { error?: string } }> {
  const r = await fetch(BASE + '/api' + path, {
    method: opts.method ?? (opts.body ? 'POST' : 'GET'),
    headers: { 'content-type': 'application/json', ...(opts.token ? { authorization: `Bearer ${opts.token}` } : {}) },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  return { status: r.status, data: await r.json() };
}
const reg = async (username: string, extra: object = {}) => (await api<AuthResult>('/register', { body: { username, password: 'rahasia1', displayName: username, ...extra } })).data;
/** token dari email terakhir yang "dikirim" (SMTP mati → dicetak ke konsol server) */
async function mailToken(kind: 'verify' | 'reset') {
  for (let i = 0; i < 100; i++) {
    const all = [...out.matchAll(new RegExp(`\\?${kind}=([A-Za-z0-9_-]+)`, 'g'))];
    if (all.length) return all[all.length - 1][1];
    await new Promise((r) => setTimeout(r, 50));
  }
  throw new Error('email tidak ada');
}

it('email: verifikasi, lupa & atur ulang password', async () => {
  const a = await reg('dewi', { email: 'Dewi@Contoh.com' });
  let me = await api<{ account: AccountPrivate }>('/me', { token: a.token });
  expect(me.data.account).toMatchObject({ email: 'dewi@contoh.com', emailVerified: false, hasPassword: true, mailEnabled: false });
  expect((await api('/register', { body: { username: 'dewi2', password: 'rahasia1', email: 'dewi@contoh.com' } })).status).toBe(409);
  const v = await mailToken('verify');
  expect(out).toContain('http://game.test/?verify=');
  expect((await api('/verify-email', { body: { token: 'salah' } })).status).toBe(400);
  expect((await api('/verify-email', { body: { token: v } })).status).toBe(200);
  expect((await api('/verify-email', { body: { token: v } })).status).toBe(400); // sekali pakai
  me = await api<{ account: AccountPrivate }>('/me', { token: a.token });
  expect(me.data.account.emailVerified).toBe(true);

  expect((await api('/forgot', { body: { login: 'tidakada' } })).status).toBe(200); // tidak membocorkan
  await api('/forgot', { body: { login: 'dewi@contoh.com' } });
  const r = await mailToken('reset');
  expect((await api('/reset', { body: { token: r, password: '123' } })).status).toBe(400);
  const done = await api<AuthResult>('/reset', { body: { token: r, password: 'baru12345' } });
  expect(done.status).toBe(200);
  expect((await api('/me', { token: a.token })).status).toBe(401); // sesi lama keluar
  expect((await api('/login', { body: { username: 'dewi', password: 'baru12345' } })).status).toBe(200);
});

it('ganti password, lepas Google butuh password, hapus akun', async () => {
  const a = await reg('eko');
  const other = (await api<AuthResult>('/login', { body: { username: 'eko', password: 'rahasia1' } })).data.token;
  expect((await api('/me/password', { token: a.token, body: { current: 'salah', password: 'barubaru' } })).status).toBe(401);
  expect((await api('/me/password', { token: a.token, body: { current: 'rahasia1', password: 'barubaru' } })).status).toBe(200);
  expect((await api('/me', { token: a.token })).status).toBe(200); // perangkat ini tetap masuk
  expect((await api('/me', { token: other })).status).toBe(401); // perangkat lain keluar
  expect((await api('/me/email', { token: a.token, body: { email: 'bukan-email' } })).status).toBe(400);

  const b = await reg('fajar');
  await api('/friends', { token: a.token, body: { username: 'fajar' } });
  await api('/friends/accept', { token: b.token, body: { username: 'eko' } });
  expect((await api('/me', { method: 'DELETE', token: a.token, body: { confirm: 'salah', password: 'barubaru' } })).status).toBe(400);
  expect((await api('/me', { method: 'DELETE', token: a.token, body: { confirm: 'eko', password: 'rahasia1' } })).status).toBe(401);
  expect((await api('/me', { method: 'DELETE', token: a.token, body: { confirm: 'eko', password: 'barubaru' } })).status).toBe(200);
  expect((await api('/me', { token: a.token })).status).toBe(401);
  expect((await api('/users/eko')).status).toBe(404);
  expect((await api<FriendsData>('/friends', { token: b.token })).data.friends).toEqual([]);
  expect((await api<AuthResult>('/register', { body: { username: 'eko', password: 'rahasia1' } })).status).toBe(201); // username bebas lagi
});

it('blokir, laporan, chat pribadi, peringkat', async () => {
  const a = await reg('gita');
  const b = await reg('hadi');
  const admin = await reg('admin');
  await api('/friends', { token: a.token, body: { username: 'hadi' } });
  await api('/friends/accept', { token: b.token, body: { username: 'gita' } });

  // chat pribadi (kata kasar disensor) + pesan real-time lewat WS
  const ws = new WebSocket(`ws://localhost:${PORT}/ws`);
  const msgs: ServerMsg[] = [];
  ws.on('message', (d) => msgs.push(JSON.parse(String(d))));
  await new Promise((r) => ws.on('open', r));
  ws.send(JSON.stringify({ t: 'hello', token: b.token }));
  await new Promise((r) => setTimeout(r, 200));
  const sent = await api<{ message: DirectMessage }>('/dm/hadi', { token: a.token, body: { text: 'halo anjing ayo main' } });
  expect(sent.status).toBe(200);
  expect(sent.data.message.text).not.toContain('anjing');
  await new Promise((r) => setTimeout(r, 200));
  expect(msgs.some((m) => m.t === 'dm' && m.message.from === 'gita')).toBe(true);
  ws.close();
  const hist = await api<{ messages: DirectMessage[] }>('/dm/gita', { token: b.token });
  expect(hist.data.messages).toHaveLength(1);
  expect((await api('/dm/admin', { token: a.token, body: { text: 'hai' } })).status).toBe(403); // bukan teman

  // blokir: pertemanan putus, profil tahu, tidak bisa minta berteman lagi, tidak muncul di pencarian
  const blk = await api<{ account: AccountPrivate } & FriendsData>('/blocks', { token: a.token, body: { username: 'hadi' } });
  expect(blk.data.account.blocked.map((u) => u.username)).toEqual(['hadi']);
  expect(blk.data.friends).toEqual([]);
  expect((await api<Profile>('/users/hadi', { token: a.token })).data.blockedByMe).toBe(true);
  expect((await api('/friends', { token: a.token, body: { username: 'hadi' } })).status).toBe(400);
  await api('/friends', { token: b.token, body: { username: 'gita' } });
  expect((await api<FriendsData>('/friends', { token: a.token })).data.incoming).toEqual([]);
  expect((await api<{ users: { username: string }[] }>('/users?q=git', { token: b.token })).data.users).toEqual([]);
  expect((await api('/dm/gita', { token: b.token, body: { text: 'hai' } })).status).toBe(403);
  await api('/blocks/hadi', { method: 'DELETE', token: a.token });
  expect((await api<{ account: AccountPrivate }>('/me', { token: a.token })).data.account.blocked).toEqual([]);

  // laporan → admin melihat & menutup
  expect((await api('/reports', { token: a.token, body: { username: 'hadi', reason: 'asal' } })).status).toBe(400);
  expect((await api('/reports', { token: a.token, body: { username: 'hadi', reason: 'Spam', detail: 'kirim link terus' } })).status).toBe(200);
  expect((await api('/admin/reports', { token: a.token })).status).toBe(403);
  const reps = await api<{ reports: { id: string; target: string; status: string }[] }>('/admin/reports', { token: admin.token });
  expect(reps.data.reports[0]).toMatchObject({ target: 'hadi', status: 'baru' });
  const closed = await api<{ reports: { status: string }[] }>(`/admin/reports/${reps.data.reports[0].id}`, { token: admin.token, body: {} });
  expect(closed.data.reports[0].status).toBe('selesai');

  const lb = await api<{ by: string; top: unknown[] }>('/leaderboard?by=wins');
  expect(lb.status).toBe(200);
  expect(lb.data.by).toBe('wins');
});

it('halaman privasi & ketentuan, log galat klien', async () => {
  const p = await fetch(BASE + '/privacy');
  expect(p.status).toBe(200);
  expect(await p.text()).toContain('Kebijakan Privasi');
  expect(await (await fetch(BASE + '/terms?lang=en')).text()).toContain('Terms of Service');
  expect((await api('/client-error', { body: { message: 'tes', stack: 'x' } })).status).toBe(200);
});

it('penonton menerima state tapi tidak bisa beraksi; chat disensor', async () => {
  const mk = () => {
    const ws = new WebSocket(`ws://localhost:${PORT}/ws`);
    const msgs: ServerMsg[] = [];
    ws.on('message', (d) => msgs.push(JSON.parse(String(d))));
    return { ws, msgs, open: new Promise((r) => ws.on('open', r)), send: (m: object) => ws.send(JSON.stringify(m)) };
  };
  const until = async (f: () => unknown) => {
    for (let i = 0; i < 200; i++) {
      if (f()) return;
      await new Promise((r) => setTimeout(r, 30));
    }
    throw new Error('timeout');
  };
  const host = mk();
  await host.open;
  host.send({ t: 'create', name: 'Host', color: '#ef4444', token: 0, isPublic: true });
  await until(() => host.msgs.find((m) => m.t === 'joined'));
  const code = (host.msgs.find((m) => m.t === 'joined') as Extract<ServerMsg, { t: 'joined' }>).room.code;
  const fan = mk();
  await fan.open;
  fan.send({ t: 'watch', code });
  await until(() => fan.msgs.find((m) => m.t === 'error'));
  host.send({ t: 'addBot' });
  host.send({ t: 'start' });
  await until(() => host.msgs.find((m) => m.t === 'state'));
  fan.send({ t: 'list' });
  await until(() => fan.msgs.find((m) => m.t === 'rooms'));
  const listed = (fan.msgs.find((m) => m.t === 'rooms') as Extract<ServerMsg, { t: 'rooms' }>).rooms.find((r) => r.code === code);
  expect(listed?.started).toBe(true);
  fan.send({ t: 'watch', code });
  await until(() => fan.msgs.find((m) => m.t === 'watching'));
  await until(() => fan.msgs.find((m) => m.t === 'state'));
  await until(() => host.msgs.some((m) => m.t === 'room' && m.room.spectators === 1));
  fan.send({ t: 'action', action: { type: 'roll' } });
  await until(() => fan.msgs.filter((m) => m.t === 'error').length >= 2);
  host.send({ t: 'chat', text: 'dasar bangsat' });
  await until(() => fan.msgs.find((m) => m.t === 'chat'));
  const c = fan.msgs.find((m) => m.t === 'chat') as Extract<ServerMsg, { t: 'chat' }>;
  expect(c.text).not.toContain('bangsat');
  fan.send({ t: 'leave' });
  await until(() => host.msgs.some((m) => m.t === 'room' && m.room.spectators === 0));
  host.ws.close();
  fan.ws.close();
});

it('masuk dengan email + kode: akun dibuat otomatis, kode sekali pakai & terbatas', async () => {
  const lastCode = async (email: string) => {
    for (let i = 0; i < 100; i++) {
      const all = [...out.matchAll(new RegExp(`Kepada: ${email.replace('.', '\\.')}[\\s\\S]*?kamu: (\\d{6})`, 'g'))];
      if (all.length) return all[all.length - 1][1];
      await new Promise((r) => setTimeout(r, 50));
    }
    throw new Error('kode tidak ada');
  };
  expect((await api('/email/start', { body: { email: 'bukan email' } })).status).toBe(400);
  const st = await api<{ exists: boolean; mailEnabled: boolean }>('/email/start', { body: { email: 'Rina.Putri@Contoh.com' } });
  expect(st.data).toMatchObject({ exists: false, mailEnabled: false });
  expect((await api('/email/start', { body: { email: 'rina.putri@contoh.com' } })).status).toBe(429); // tunggu 30 dtk
  const code = await lastCode('rina.putri@contoh.com');
  expect((await api('/email/verify', { body: { email: 'rina.putri@contoh.com', code: code === '000000' ? '111111' : '000000' } })).status).toBe(400);
  const ok = await api<AuthResult>('/email/verify', { body: { email: 'rina.putri@contoh.com', code } });
  expect(ok.status).toBe(200);
  expect(ok.data.created).toBe(true);
  expect(ok.data.user.username).toBe('rinaputri');
  expect((await api('/email/verify', { body: { email: 'rina.putri@contoh.com', code } })).status).toBe(400); // sekali pakai
  const me = await api<{ account: AccountPrivate }>('/me', { token: ok.data.token });
  expect(me.data.account).toMatchObject({ email: 'rina.putri@contoh.com', emailVerified: true, hasPassword: false });

  // email yang sudah terdaftar → masuk ke akun yang sama
  const reg2 = await api<AuthResult>('/register', { body: { username: 'sinta', password: 'rahasia1', email: 'sinta@contoh.com' } });
  expect(reg2.status).toBe(201);
  const s2 = await api<{ exists: boolean }>('/email/start', { body: { email: 'sinta@contoh.com' } });
  expect(s2.data.exists).toBe(true);
  const again = await api<AuthResult>('/email/verify', { body: { email: 'sinta@contoh.com', code: await lastCode('sinta@contoh.com') } });
  expect(again.data.user.username).toBe('sinta');
  expect(again.data.created).toBeFalsy();

  // 5 kode salah → kode hangus
  await api('/email/start', { body: { email: 'tono@contoh.com' } });
  const real = await lastCode('tono@contoh.com');
  const wrong = real === '123456' ? '654321' : '123456';
  for (let i = 0; i < 5; i++) await api('/email/verify', { body: { email: 'tono@contoh.com', code: wrong } });
  expect((await api('/email/verify', { body: { email: 'tono@contoh.com', code: real } })).status).toBe(400);
});

it('foto profil: unggah, ikon bawaan, hapus', async () => {
  const a = await reg('fotoku');
  // PNG 1×1 yang valid
  const png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';
  expect((await api('/me/avatar', { token: a.token, body: { image: 'data:image/png;base64,AAAA' } })).status).toBe(400); // bukan PNG asli
  expect((await api('/me/avatar', { token: a.token, body: { image: 'data:text/html;base64,PGI+' } })).status).toBe(400);
  const up = await api<{ user: { avatar: string } }>('/me/avatar', { token: a.token, body: { image: png } });
  expect(up.status).toBe(200);
  expect(up.data.user.avatar).toMatch(/^\/avatars\/[a-z0-9-]+\.png$/);
  const file = await fetch(BASE + up.data.user.avatar);
  expect(file.status).toBe(200);
  expect(file.headers.get('content-type')).toBe('image/png');
  expect((await fetch(BASE + '/avatars/..%2Fusers.json')).status).toBe(404);
  expect((await fetch(BASE + '/avatars/tidakada-123456.png')).status).toBe(404);

  expect((await api('/me', { method: 'PATCH', token: a.token, body: { avatar: 'icon:tidakada' } })).status).toBe(400);
  const ic = await api<{ user: { avatar?: string } }>('/me', { method: 'PATCH', token: a.token, body: { avatar: 'icon:lion' } });
  expect(ic.data.user.avatar).toBe('icon:lion');
  expect((await fetch(BASE + up.data.user.avatar)).status).toBe(404); // foto lama dihapus
  const cl = await api<{ user: { avatar?: string } }>('/me', { method: 'PATCH', token: a.token, body: { avatar: '' } });
  expect(cl.data.user.avatar).toBeUndefined();
});

it('admin menangguhkan & mencabut penangguhan akun', async () => {
  const admin = (await api<AuthResult>('/login', { body: { username: 'admin', password: 'rahasia1' } })).data;
  const x = await reg('nakal');
  const y = await reg('biasa');
  expect((await api('/admin/ban/nakal', { token: y.token, body: { days: 1 } })).status).toBe(403); // bukan admin
  expect((await api('/admin/ban/admin', { token: admin.token, body: { days: 1 } })).status).toBe(400); // admin tidak bisa
  const ban = await api<{ banned: { until: number; reason: string } }>('/admin/ban/nakal', { token: admin.token, body: { days: 7, reason: 'spam chat' } });
  expect(ban.status).toBe(200);
  expect(ban.data.banned.until).toBeGreaterThan(Date.now() + 6 * 86_400_000);
  const me = await api<{ error: string }>('/me', { token: x.token });
  expect(me.status).toBe(403); // sesi lama tidak berlaku, dengan alasan
  expect(me.data.error).toContain('spam chat');
  const login = await api<{ error: string }>('/login', { body: { username: 'nakal', password: 'rahasia1' } });
  expect(login.status).toBe(403);
  expect(login.data.error).toMatch(/^Akun ditangguhkan sampai \d{4}-\d{2}-\d{2}: spam chat$/);
  const prof = await api<Profile>('/users/nakal', { token: admin.token });
  expect(prof.data.banned?.reason).toBe('spam chat');
  expect((await api<Profile>('/users/nakal', { token: y.token })).data.banned).toBeUndefined(); // non-admin tidak melihat
  await api('/admin/ban/nakal', { method: 'DELETE', token: admin.token });
  expect((await api('/login', { body: { username: 'nakal', password: 'rahasia1' } })).status).toBe(200);
});

it('main cepat: gabung room publik yang menunggu, atau buat baru', async () => {
  const mk = () => {
    const ws = new WebSocket(`ws://localhost:${PORT}/ws`);
    const msgs: ServerMsg[] = [];
    ws.on('message', (d) => msgs.push(JSON.parse(String(d))));
    return { ws, msgs, open: new Promise((r) => ws.on('open', r)), send: (m: object) => ws.send(JSON.stringify(m)) };
  };
  const joined = async (c: ReturnType<typeof mk>) => {
    for (let i = 0; i < 100; i++) {
      const j = c.msgs.find((m) => m.t === 'joined') as Extract<ServerMsg, { t: 'joined' }> | undefined;
      if (j) return j;
      await new Promise((r) => setTimeout(r, 30));
    }
    throw new Error('timeout');
  };
  const a = mk();
  await a.open;
  a.send({ t: 'quick', name: 'Cepat A', color: '#ef4444', token: 0 });
  const ja = await joined(a);
  expect(ja.room.isPublic).toBe(true);
  expect(ja.room.seats).toHaveLength(1);
  const b = mk();
  await b.open;
  b.send({ t: 'quick', name: 'Cepat B', color: '#3b82f6', token: 1 });
  const jb = await joined(b);
  expect(jb.room.code).toBe(ja.room.code); // masuk room yang sama
  expect(jb.room.seats).toHaveLength(2);
  a.ws.close();
  b.ws.close();
});
