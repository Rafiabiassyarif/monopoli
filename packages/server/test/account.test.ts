// Uji akun: daftar/masuk, sesi, pertemanan, status online, undangan, statistik game online.
import { afterAll, beforeAll, expect, it } from 'vitest';
import { spawn, type ChildProcess } from 'node:child_process';
import WebSocket from 'ws';
import { actorId, safeAction, type AuthResult, type FriendsData, type GameState, type Profile, type ServerMsg } from '@monopoli/engine';

const PORT = 3996;
const BASE = `http://localhost:${PORT}`;
let srv: ChildProcess;

beforeAll(async () => {
  srv = spawn(process.execPath, ['--import', 'tsx', 'src/index.ts'], {
    cwd: new URL('..', import.meta.url),
    env: { ...process.env, PORT: String(PORT), PERSIST: '0', BOT_DELAY: '20', RATE_LIMIT: '100000', AUTH_RATE: '1000', GOOGLE_CLIENT_ID: '' },
  });
  await new Promise<void>((ok, bad) => {
    const t = setTimeout(() => bad(new Error('server tidak start')), 15000);
    srv.stdout!.on('data', (d) => String(d).includes(`:${PORT}`) && (clearTimeout(t), ok()));
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

function client() {
  const ws = new WebSocket(`ws://localhost:${PORT}/ws`);
  const msgs: ServerMsg[] = [];
  ws.on('message', (d) => msgs.push(JSON.parse(String(d))));
  const until = async <T>(f: () => T | undefined | false, ms = 15000): Promise<T> => {
    const end = Date.now() + ms;
    for (;;) {
      const v = f();
      if (v) return v;
      if (Date.now() > end) throw new Error('timeout');
      await new Promise((r) => setTimeout(r, 40));
    }
  };
  const last = <K extends ServerMsg['t']>(t: K) => [...msgs].reverse().find((m) => m.t === t) as Extract<ServerMsg, { t: K }> | undefined;
  return { ws, msgs, until, last, open: new Promise((r) => ws.on('open', r)), send: (m: object) => ws.send(JSON.stringify(m)) };
}

it('daftar, masuk, sesi, ubah profil', async () => {
  const bad = await api('/register', { body: { username: 'A!', password: '123' } });
  expect(bad.status).toBe(400);
  const reg = await api<AuthResult>('/register', { body: { username: 'arif', password: 'rahasia1', displayName: 'Arif' } });
  expect(reg.status).toBe(201);
  expect(reg.data.user).toMatchObject({ username: 'arif', displayName: 'Arif' });
  expect((await api('/register', { body: { username: 'arif', password: 'rahasia1' } })).status).toBe(409);
  expect((await api('/login', { body: { username: 'arif', password: 'salah123' } })).status).toBe(401);
  const login = await api<AuthResult>('/login', { body: { username: 'ARIF', password: 'rahasia1' } });
  expect(login.status).toBe(200);
  const me = await api<{ user: { displayName: string } }>('/me', { token: login.data.token });
  expect(me.data.user.displayName).toBe('Arif');
  const upd = await api<{ user: { displayName: string; color: string } }>('/me', { method: 'PATCH', token: login.data.token, body: { displayName: 'Arif K', color: '#22c55e' } });
  expect(upd.data.user).toMatchObject({ displayName: 'Arif K', color: '#22c55e' });
  await api('/logout', { method: 'POST', token: login.data.token });
  expect((await api('/me', { token: login.data.token })).status).toBe(401);
  expect((await api<{ googleClientId: string | null }>('/config')).data.googleClientId).toBeNull();
});

it('pertemanan, status online, undangan, statistik game online', async () => {
  const a = (await api<AuthResult>('/register', { body: { username: 'budi', password: 'rahasia1', displayName: 'Budi' } })).data;
  const b = (await api<AuthResult>('/register', { body: { username: 'sari', password: 'rahasia1', displayName: 'Sari' } })).data;
  const found = await api<{ users: { username: string }[] }>('/users?q=sa', { token: a.token });
  expect(found.data.users.map((u) => u.username)).toContain('sari');

  const req = await api<FriendsData & { result: string }>('/friends', { token: a.token, body: { username: 'sari' } });
  expect(req.data.result).toBe('sent');
  expect(req.data.outgoing.map((u) => u.username)).toEqual(['sari']);
  const inc = await api<FriendsData>('/friends', { token: b.token });
  expect(inc.data.incoming.map((u) => u.username)).toEqual(['budi']);
  const acc = await api<FriendsData>('/friends/accept', { token: b.token, body: { username: 'budi' } });
  expect(acc.data.friends.map((u) => u.username)).toEqual(['budi']);

  // Sari online lewat WS → Budi melihatnya online
  const sb = client();
  await sb.open;
  sb.send({ t: 'hello', token: b.token });
  await sb.until(() => sb.last('hello')?.user);
  const fl = await api<FriendsData>('/friends', { token: a.token });
  expect(fl.data.friends[0]).toMatchObject({ username: 'sari', online: true });

  // Budi buat room, tambah bot, undang Sari
  const ca = client();
  await ca.open;
  ca.send({ t: 'hello', token: a.token });
  await ca.until(() => ca.last('hello'));
  ca.send({ t: 'create', name: 'diabaikan', color: '#ef4444', token: 0, roomName: 'Meja Budi' });
  const joined = await ca.until(() => ca.last('joined'));
  expect(joined.room.seats[0]).toMatchObject({ name: 'Budi', username: 'budi' });
  ca.send({ t: 'invite', username: 'sari' });
  const inv = await sb.until(() => sb.last('invite'));
  expect(inv).toMatchObject({ code: joined.room.code, roomName: 'Meja Budi', from: { username: 'budi' } });
  const fl2 = await api<FriendsData>('/friends', { token: b.token });
  expect(fl2.data.friends[0].room).toMatchObject({ code: joined.room.code, name: 'Meja Budi' });

  // main singkat sampai selesai (10 ronde) → statistik tercatat
  ca.send({ t: 'addBot' });
  ca.send({ t: 'settings', themeId: 'indonesia', customTheme: null, botLevel: 'normal', turnSeconds: 30, rules: { maxRounds: 10 } });
  await ca.until(() => ca.last('room')?.room.rules.maxRounds === 10 && ca.last('room')!.room.seats.length === 2);
  ca.send({ t: 'start' });
  let seen = -1;
  await ca.until(() => {
    const st = ca.last('state')?.state as GameState | undefined;
    if (!st) return undefined;
    if (st.phase === 'gameover') return true;
    if (actorId(st) === joined.you && st.version !== seen) {
      seen = st.version;
      const f = safeAction({ ...st, rng: 1 });
      if (f) ca.send({ t: 'action', action: f.action });
    }
    return undefined;
  }, 30000);
  await new Promise((r) => setTimeout(r, 100));
  const prof = await api<Profile>('/users/budi', { token: b.token });
  expect(prof.data.stats.games).toBe(1);
  expect(prof.data.history[0]).toMatchObject({ roomName: 'Meja Budi', players: 2 });
  expect(prof.data.friendship).toBe('friend');

  // hapus teman
  const del = await api<FriendsData>('/friends/budi', { method: 'DELETE', token: b.token });
  expect(del.data.friends).toEqual([]);
  ca.ws.close();
  sb.ws.close();
}, 60000);
