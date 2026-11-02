// Uji fitur online tambahan: anti-curang, putus koneksi, keluar → bot, pindah host, main lagi, persistensi.
import { afterAll, expect, it } from 'vitest';
import { spawn, type ChildProcess } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import WebSocket from 'ws';
import { actorId, safeAction, type GameState, type ServerMsg } from '@monopoli/engine';

const procs: ChildProcess[] = [];
afterAll(() => procs.forEach((p) => p.kill('SIGKILL')));

async function server(port: number, env: Record<string, string> = {}) {
  const srv = spawn(process.execPath, ['--import', 'tsx', 'src/index.ts'], {
    cwd: new URL('..', import.meta.url),
    env: { ...process.env, PORT: String(port), PERSIST: '0', BOT_DELAY: '30', DISCONNECT_GRACE: '300', LOBBY_GRACE: '400', RATE_LIMIT: '100000', ...env },
  });
  procs.push(srv);
  await new Promise<void>((ok, bad) => {
    const t = setTimeout(() => bad(new Error('server tidak start')), 15000);
    srv.stdout!.on('data', (d) => String(d).includes(`:${port}`) && (clearTimeout(t), ok()));
  });
  return srv;
}

function client(port: number) {
  const ws = new WebSocket(`ws://localhost:${port}/ws`);
  const msgs: ServerMsg[] = [];
  const waiters: Array<() => void> = [];
  ws.on('message', (d) => {
    msgs.push(JSON.parse(String(d)));
    waiters.splice(0).forEach((w) => w());
  });
  const until = async <T>(f: () => T | undefined | false, ms = 10000): Promise<T> => {
    const end = Date.now() + ms;
    for (;;) {
      const v = f();
      if (v) return v;
      if (Date.now() > end) throw new Error('timeout menunggu pesan');
      await new Promise<void>((r) => (waiters.push(r), setTimeout(r, 50)));
    }
  };
  const open = new Promise((r) => ws.on('open', r));
  const send = (m: object) => ws.send(JSON.stringify(m));
  const last = <K extends ServerMsg['t']>(t: K) => [...msgs].reverse().find((m) => m.t === t) as Extract<ServerMsg, { t: K }> | undefined;
  const state = () => last('state')?.state as GameState | undefined;
  return { ws, msgs, until, open, send, last, state };
}

it('state tanpa seed/dek, pemain putus dimainkan otomatis, keluar → bot, pindah host', async () => {
  const port = 3991;
  await server(port);
  const a = client(port);
  const b = client(port);
  await Promise.all([a.open, b.open]);
  a.send({ t: 'create', name: 'Ana', color: '#e53935', token: 0 });
  const ja = await a.until(() => a.last('joined'));
  b.send({ t: 'join', code: ja.room.code, name: 'Beni', color: '#e53935', token: 1 }); // warna sama → server ganti
  const jb = await b.until(() => b.last('joined'));
  expect(jb.room.seats[1].color).not.toBe('#e53935');

  a.send({ t: 'settings', themeId: 'indonesia', customTheme: null, botLevel: 'easy', turnSeconds: 0, rules: { maxRounds: 0, startCash: 2500, doubleGo: true, goSalary: 99999 } });
  await a.until(() => a.last('room')?.room.rules.startCash === 2500);
  // nilai di luar batas dipotong server
  expect(a.last('room')!.room.rules.goSalary).toBe(500);
  a.send({ t: 'start' });
  const s0 = await a.until(() => a.state());
  expect(s0.rng).toBe(0);
  expect(s0.decks.chance).toEqual([]);
  expect(s0.options).toMatchObject({ startCash: 2500, doubleGo: true });
  expect(s0.players[0].cash).toBe(2500);

  // Ana putus tanpa timer → tetap dimainkan otomatis (aksi aman) supaya game tidak macet
  a.ws.close();
  let seenB = -1;
  await b.until(() => {
    const st = b.state();
    // Beni ikut lelang dsb. dengan aksi aman saat gilirannya
    if (st && actorId(st) === jb.you && st.version !== seenB) {
      seenB = st.version;
      const f = safeAction({ ...st, rng: 1 });
      if (f) b.send({ t: 'action', action: f.action });
    }
    return (st?.turnCount ?? 0) >= 1 && true;
  }, 10000);
  const sNow = b.state()!;
  // aksi aman tidak pernah membeli properti untuk pemain yang putus
  expect(sNow.events.some((e) => e.type === 'buy' && e.player === ja.you)).toBe(false);

  // Beni keluar di tengah game → room terhapus karena tidak ada manusia tersisa (kursi Ana kosong) — jadi uji dengan Ana kembali dulu
  const a2 = client(port);
  await a2.open;
  a2.send({ t: 'join', code: ja.room.code, resume: ja.secret, name: '', color: '', token: 0 });
  await a2.until(() => a2.last('joined'));
  b.send({ t: 'leave' });
  await b.until(() => b.last('left'));
  const r = await a2.until(() => a2.last('room')?.room.seats.find((s) => s.id === jb.you)?.bot && a2.last('room'));
  expect(r.room.seats.find((s) => s.id === jb.you)!.name).toContain('(bot)');
  await a2.until(() => a2.state()?.players.find((p) => p.id === jb.you)?.bot);
  a2.ws.close();
  b.ws.close();
}, 40000);

it('lobby: host keluar → host pindah; kursi putus dilepas', async () => {
  const port = 3992;
  await server(port);
  const a = client(port);
  const b = client(port);
  const c = client(port);
  await Promise.all([a.open, b.open, c.open]);
  a.send({ t: 'create', name: 'Ana', color: '#e53935', token: 0 });
  const ja = await a.until(() => a.last('joined'));
  b.send({ t: 'join', code: ja.room.code, name: 'Beni', color: '#1e88e5', token: 1 });
  const jb = await b.until(() => b.last('joined'));
  c.send({ t: 'join', code: ja.room.code, name: 'Cici', color: '#43a047', token: 2 });
  await c.until(() => c.last('joined'));
  await b.until(() => b.last('room')?.room.seats.length === 3);
  a.send({ t: 'leave' });
  const r = await b.until(() => (b.last('room')?.room.seats.length === 2 ? b.last('room') : undefined));
  expect(r.room.seats.find((s) => s.id === jb.you)!.host).toBe(true);
  c.ws.close(); // putus di lobby → dilepas setelah LOBBY_GRACE
  await b.until(() => b.last('room')?.room.seats.length === 1);
  b.ws.close();
  a.ws.close();
}, 20000);

it('main sampai selesai (batas ronde) lalu host memulai ulang → kembali ke lobby', async () => {
  const port = 3993;
  await server(port);
  const a = client(port);
  await a.open;
  a.send({ t: 'create', name: 'Ana', color: '#e53935', token: 0 });
  const ja = await a.until(() => a.last('joined'));
  a.send({ t: 'addBot' });
  a.send({ t: 'settings', themeId: 'indonesia', customTheme: null, botLevel: 'normal', turnSeconds: 30, rules: { maxRounds: 10 } });
  await a.until(() => a.last('room')?.room.rules.maxRounds === 10 && a.last('room')!.room.seats.length === 2);
  a.send({ t: 'start' });
  // klien menjawab dengan aksi aman setiap kali giliran Ana
  let seen = -1;
  const s = await a.until(() => {
    const st = a.state();
    if (!st) return undefined;
    if (st.phase === 'gameover') return st;
    if (actorId(st) === ja.you && st.version !== seen) {
      seen = st.version;
      const f = safeAction({ ...st, rng: 1 });
      if (f) a.send({ t: 'action', action: f.action });
    }
    return undefined;
  }, 30000);
  expect(s.phase).toBe('gameover');
  a.send({ t: 'rematch' });
  const r = await a.until(() => (a.last('room')?.room.started === false ? a.last('room') : undefined));
  expect(r.room.seats).toHaveLength(2);
  a.send({ t: 'start' });
  await a.until(() => a.state()?.version === 0 && a.state()!.phase !== 'gameover');
  a.ws.close();
}, 40000);

it('room & game dipulihkan setelah server restart', async () => {
  const port = 3994;
  const file = join(mkdtempSync(join(tmpdir(), 'mono-')), 'rooms.json');
  const env = { PERSIST: '1', DATA_FILE: file };
  let srv = await server(port, env);
  const a = client(port);
  await a.open;
  a.send({ t: 'create', name: 'Ana', color: '#e53935', token: 0 });
  const ja = await a.until(() => a.last('joined'));
  a.send({ t: 'addBot' });
  await a.until(() => a.last('room')?.room.seats.length === 2);
  a.send({ t: 'start' });
  const s1 = await a.until(() => a.state());
  a.ws.close();
  await new Promise<void>((r) => (srv.once('exit', () => r()), srv.kill('SIGTERM')));
  srv = await server(port, env);
  const a2 = client(port);
  await a2.open;
  a2.send({ t: 'join', code: ja.room.code, resume: ja.secret, name: '', color: '', token: 0 });
  const back = await a2.until(() => a2.last('joined'));
  expect(back.you).toBe(ja.you);
  const s2 = await a2.until(() => a2.state());
  expect(s2.players.map((p) => p.id)).toEqual(s1.players.map((p) => p.id));
  a2.ws.close();
}, 40000);

it('daftar room publik, room privat tersembunyi, batas kursi & aturan main', async () => {
  const port = 3995;
  await server(port);
  const a = client(port);
  const p = client(port);
  const b = client(port);
  const c = client(port);
  await Promise.all([a.open, p.open, b.open, c.open]);
  a.send({ t: 'create', name: 'Ana', color: '#ef4444', token: 0, roomName: 'Meja Ana', isPublic: true });
  const ja = await a.until(() => a.last('joined'));
  p.send({ t: 'create', name: 'Pri', color: '#3b82f6', token: 1, isPublic: false });
  await p.until(() => p.last('joined'));
  b.send({ t: 'list' });
  const list = await b.until(() => b.last('rooms'));
  expect(list.rooms.map((r) => r.code)).toEqual([ja.room.code]);
  expect(list.rooms[0]).toMatchObject({ name: 'Meja Ana', host: 'Ana', players: 1, startCash: 1500, houseRules: 0 });

  // host: batas 2 kursi + aturan rumah
  a.send({ t: 'settings', themeId: 'indonesia', customTheme: null, botLevel: 'normal', turnSeconds: 60, maxPlayers: 2, rules: { auctions: false, jailFine: 100 } });
  await a.until(() => a.last('room')?.room.maxPlayers === 2);
  expect(a.last('room')!.room.rules).toMatchObject({ auctions: false, jailFine: 100, goSalary: 200 });
  b.send({ t: 'join', code: ja.room.code, name: 'Beni', color: '#22c55e', token: 2 });
  await b.until(() => b.last('joined'));
  c.send({ t: 'join', code: ja.room.code, name: 'Cici', color: '#eab308', token: 3 });
  const e = await c.until(() => c.last('error'));
  expect(e.message).toBe('Room penuh');
  c.send({ t: 'list' });
  const l2 = await c.until(() => c.last('rooms'));
  expect(l2.rooms.find((r) => r.code === ja.room.code)).toBeUndefined(); // penuh → tidak tampil
  a.send({ t: 'start' });
  const st = await a.until(() => a.last('state')?.state);
  expect(st.options).toMatchObject({ auctions: false, jailFine: 100 });
  [a, p, b, c].forEach((x) => x.ws.close());
}, 30000);
