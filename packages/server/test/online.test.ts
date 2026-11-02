// Uji integrasi server online: 2 klien WS nyata + 1 bot, main sampai beberapa giliran.
import { afterAll, beforeAll, expect, it } from 'vitest';
import { spawn, type ChildProcess } from 'node:child_process';
import WebSocket from 'ws';
import type { GameState, ServerMsg } from '@monopoli/engine';

const PORT = 3999;
let srv: ChildProcess;

beforeAll(async () => {
  srv = spawn(process.execPath, ['--import', 'tsx', 'src/index.ts'], { cwd: new URL('..', import.meta.url), env: { ...process.env, PORT: String(PORT), PERSIST: '0' } });
  await new Promise<void>((ok, bad) => {
    const t = setTimeout(() => bad(new Error('server tidak start')), 15000);
    srv.stdout!.on('data', (d) => String(d).includes(`:${PORT}`) && (clearTimeout(t), ok()));
  });
});
afterAll(() => srv?.kill());

function client() {
  const ws = new WebSocket(`ws://localhost:${PORT}/ws`);
  const msgs: ServerMsg[] = [];
  const waiters: Array<() => void> = [];
  ws.on('message', (d) => {
    msgs.push(JSON.parse(String(d)));
    waiters.splice(0).forEach((w) => w());
  });
  const until = async <T>(f: () => T | undefined, ms = 8000): Promise<T> => {
    const end = Date.now() + ms;
    for (;;) {
      const v = f();
      if (v) return v;
      if (Date.now() > end) throw new Error('timeout menunggu pesan');
      await new Promise<void>((r) => (waiters.push(r), setTimeout(r, 100)));
    }
  };
  const open = new Promise((r) => ws.on('open', r));
  const send = (m: object) => ws.send(JSON.stringify(m));
  const last = <K extends ServerMsg['t']>(t: K) => [...msgs].reverse().find((m) => m.t === t) as Extract<ServerMsg, { t: K }> | undefined;
  return { ws, msgs, until, open, send, last };
}

it('buat room, gabung, tambah bot, main online', async () => {
  const a = client();
  const b = client();
  await Promise.all([a.open, b.open]);

  a.send({ t: 'create', name: 'Ana', color: '#e53935', token: 0 });
  const ja = await a.until(() => a.last('joined'));
  const code = ja.room.code;
  expect(code).toMatch(/^[A-Z0-9]{5}$/);

  b.send({ t: 'join', code, name: 'Beni', color: '#1e88e5', token: 1 });
  const jb = await b.until(() => b.last('joined'));
  a.send({ t: 'addBot' });
  await a.until(() => (a.last('room')?.room.seats.length === 3 ? true : undefined));

  // non-host tidak boleh start
  b.send({ t: 'start' });
  await b.until(() => b.last('error'));

  a.send({ t: 'start' });
  let s = await a.until(() => a.last('state')?.state);
  expect(s.players.map((p) => p.name)).toEqual(['Ana', 'Beni', 'Bot Budi']);

  // pemain lain tidak bisa aksi di giliran Ana
  b.send({ t: 'action', action: { type: 'roll' } });
  await b.until(() => (b.msgs.filter((m) => m.t === 'error').length >= 2 ? true : undefined));

  // mainkan 2 putaran penuh: manusia lempar/beli/selesai, bot jalan sendiri di server
  const players = { [ja.you]: a, [jb.you]: b };
  let rounds = 0;
  const startTurns = s.turnCount;
  while (rounds++ < 400 && s.turnCount < startTurns + 6) {
    const st: GameState = (a.last('state')!.state);
    const cur = st.players[st.current];
    const c = players[cur.id];
    if (c && !st.trade && st.phase !== 'auction') {
      const act =
        st.phase === 'buy' ? { type: 'buy' } :
        st.phase === 'debt' ? { type: 'bankrupt' } :
        !st.rolled ? { type: 'roll' } : { type: 'endTurn' };
      const v = st.version;
      c.send({ t: 'action', action: act });
      await a.until(() => (a.last('state')!.state.version > v ? true : undefined));
    } else if (st.phase === 'auction' && st.auction && players[st.auction.active[st.auction.turn]]) {
      const v = st.version;
      players[st.auction.active[st.auction.turn]].send({ t: 'action', action: { type: 'pass' } });
      await a.until(() => (a.last('state')!.state.version > v ? true : undefined));
    } else if (st.trade && players[st.trade.to]) {
      const v = st.version;
      players[st.trade.to].send({ t: 'action', action: { type: 'rejectTrade' } });
      await a.until(() => (a.last('state')!.state.version > v ? true : undefined));
    } else {
      const v = st.version;
      await a.until(() => (a.last('state')!.state.version > v ? true : undefined)); // tunggu bot
    }
    s = a.last('state')!.state;
    if (s.phase === 'gameover') break;
  }
  expect(s.turnCount).toBeGreaterThanOrEqual(startTurns + 6);
  // kedua klien sinkron
  await b.until(() => (b.last('state')!.state.version === a.last('state')!.state.version ? true : undefined));

  // reconnect pakai secret
  b.ws.close();
  const b2 = client();
  await b2.open;
  b2.send({ t: 'join', code, resume: jb.secret, name: '', color: '', token: 0 });
  const back = await b2.until(() => b2.last('joined'));
  expect(back.you).toBe(jb.you);
  await b2.until(() => b2.last('state'));
  a.ws.close();
  b2.ws.close();
}, 60000);

it('timer AFK: aksi manusia dijalankan otomatis saat waktu habis + emote', async () => {
  const a = client();
  const b = client();
  await Promise.all([a.open, b.open]);
  a.send({ t: 'create', name: 'Ana', color: '#e53935', token: 0 });
  const ja = await a.until(() => a.last('joined'));
  b.send({ t: 'join', code: ja.room.code, name: 'Beni', color: '#1e88e5', token: 1 });
  await b.until(() => b.last('joined'));
  // turnSeconds hanya menerima 0/30/60/90 → server menolak 1 dan jatuh ke 60; uji validasi
  a.send({ t: 'settings', themeId: 'ninja', customTheme: null, botLevel: 'easy', turnSeconds: 1, rules: { maxRounds: 10 } });
  const r = await a.until(() => (a.last('room')?.room.themeId === 'ninja' ? a.last('room') : undefined));
  expect(r!.room.turnSeconds).toBe(60);
  expect(r!.room.rules.maxRounds).toBe(10);
  a.send({ t: 'start' });
  const tm = await a.until(() => a.last('timer'));
  expect(tm.actor).toBe(ja.you);
  expect(tm.deadline - Date.now()).toBeGreaterThan(50_000);
  const s = await a.until(() => a.last('state')?.state);
  expect(s.options.maxRounds).toBe(10);

  b.send({ t: 'emote', e: '🔥' });
  b.send({ t: 'emote', e: '<script>' }); // ditolak
  const em = await a.until(() => a.last('emote'));
  expect(em.e).toBe('🔥');
  a.ws.close();
  b.ws.close();
}, 30000);
