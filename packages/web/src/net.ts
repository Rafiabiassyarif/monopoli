// Controller game: lokal (hot-seat + bot, di browser) atau online (WebSocket ke server).
// UI cukup pakai { state, send, me } tanpa peduli mode.

import { useCallback, useEffect, useRef, useState } from 'react';
import { fx } from './scene/busy';
import { clearResume, del, getJSON, getResume, getRaw, saveResume, setJSON } from './storage';
import { getToken, wsUrl } from './auth';
import {
  applyAction,
  botAction,
  createGame,
  migrateState,
  safeAction,
  RuleError,
  type Action,
  type BotLevel,
  type ClientMsg,
  type GameState,
  type NewPlayer,
  type Options,
  type RoomSummary,
  type RoomInfo,
  type ServerMsg,
  type Theme,
  type CustomDecks,
} from '@monopoli/engine';

export interface LocalSetup {
  players: NewPlayer[];
  botLevel: BotLevel;
  /** aturan main (bawaan = aturan resmi) */
  rules: Options;
}

const SAVE_KEY = 'monopoli.save';
/** Save lokal dipisah per akun: tamu pakai kunci lama, akun login punya kunci sendiri. */
export const saveKey = (owner?: string | null) => (owner ? `${SAVE_KEY}.u.${owner}` : SAVE_KEY);

interface SaveFile {
  state: GameState;
  level: BotLevel;
  /** tema yang dipakai saat game dimulai — dipulihkan saat "Lanjutkan" */
  themeId?: string;
}

/** Baca save lokal; save rusak / versi tak cocok dibuang supaya tidak crash. */
export function readSave(key = SAVE_KEY): SaveFile | null {
  const raw = getJSON<SaveFile | null>(key, null);
  if (!raw) return null;
  try {
    return { ...raw, state: migrateState(raw.state), level: raw.level ?? 'normal' };
  } catch {
    del(key);
    return null;
  }
}

export function useLocalGame(onError: (m: string) => void, themeId: string, owner?: string | null) {
  const [state, setState] = useState<GameState | null>(null);
  const [level, setLevel] = useState<BotLevel>('normal');
  const [savedTheme, setSavedTheme] = useState(themeId);
  /** kunci save milik game yang sedang jalan (tetap walau user logout di tengah game) */
  const [key, setKey] = useState(() => saveKey(owner));
  const ref = useRef(state);
  ref.current = state;

  const start = useCallback(
    (s: LocalSetup, decks?: CustomDecks) => {
      setLevel(s.botLevel);
      setSavedTheme(themeId);
      setKey(saveKey(owner));
      const seed = crypto.getRandomValues(new Int32Array(1))[0];
      setState(createGame(s.players, seed, s.rules, decks));
    },
    [themeId, owner],
  );

  /** Lanjutkan save lokal. Mengembalikan id tema save (atau null kalau gagal). */
  const resume = useCallback((): string | null => {
    const k = saveKey(owner);
    const save = readSave(k);
    if (!save) return null;
    setKey(k);
    setLevel(save.level);
    setState(save.state);
    const t = save.themeId ?? themeId;
    setSavedTheme(t);
    return t;
  }, [themeId, owner]);

  const send = useCallback(
    (pid: string, a: Action) => {
      if (!ref.current) return;
      try {
        setState(applyAction(ref.current, pid, a));
      } catch (e) {
        onError(e instanceof RuleError ? e.message : String(e));
      }
    },
    [onError],
  );

  // simpan otomatis
  useEffect(() => {
    if (state) {
      if (state.phase === 'gameover') del(key);
      else setJSON(key, { state, level, themeId: savedTheme } satisfies SaveFile);
    }
  }, [state, level, savedTheme, key]);

  return { state, start, resume, send, level, quit: () => setState(null) };
}

export const hasSave = (owner?: string | null) => getRaw(saveKey(owner)) !== null;

/** Jalankan bot (lokal) dengan jeda agar animasi terlihat. */
export function useBotDriver(state: GameState | null, level: BotLevel, send: (pid: string, a: Action) => void, delay: number, paused: boolean) {
  useEffect(() => {
    if (!state || paused || state.phase === 'gameover') return;
    const b = botAction(state, level);
    if (!b) return;
    // tunggu animasi (dadu, langkah bidak, kartu) selesai supaya permainan bot bisa diikuti mata
    const wait = Math.max(0, fx.busyUntil - performance.now());
    const t = setTimeout(() => {
      // kalau engine menolak aksi bot, pakai aksi aman — game tidak boleh macet
      try {
        applyAction(state, b.pid, b.action);
        send(b.pid, b.action);
      } catch {
        const f = safeAction(state);
        if (f) send(f.pid, f.action);
      }
    }, wait + (b.action.type === 'roll' ? delay * 0.8 : delay));
    return () => clearTimeout(t);
  }, [state, level, send, delay, paused]);
}

// ---------- online ----------


export function useOnline(onError: (m: string) => void) {
  const [room, setRoom] = useState<RoomInfo | null>(null);
  const [state, setState] = useState<GameState | null>(null);
  const [me, setMe] = useState<string | null>(null);
  const [status, setStatus] = useState<'idle' | 'connecting' | 'open' | 'closed'>('idle');
  const [chat, setChat] = useState<{ from: string; text: string; seat?: string }[]>([]);
  /** kode room yang sedang ditonton (penonton tidak punya kursi) */
  const [watching, setWatching] = useState<string | null>(null);
  const watchRef = useRef<string | null>(null);
  const [emotes, setEmotes] = useState<{ id: number; from: string; e: string }[]>([]);
  const [timer, setTimer] = useState<{ actor: string | null; deadline: number }>({ actor: null, deadline: 0 });
  const [publicRooms, setPublicRooms] = useState<RoomSummary[] | null>(null);
  const ws = useRef<WebSocket | null>(null);

  const connect = useCallback(
    (first: ClientMsg) => {
      ws.current?.close();
      setStatus('connecting');
      const sock = new WebSocket(wsUrl());
      ws.current = sock;
      sock.onopen = () => {
        setStatus('open');
        // login dulu (kalau ada akun) supaya kursi tertaut ke akun & statistik tercatat
        const token = getToken();
        if (token) sock.send(JSON.stringify({ t: 'hello', token } satisfies ClientMsg));
        sock.send(JSON.stringify(first));
      };
      sock.onclose = () => {
        if (ws.current === sock) setStatus('closed');
      };
      sock.onerror = () => onError('Tidak bisa terhubung ke server online. Pastikan server jalan (npm run dev).');
      if (first.t !== 'watch') {
        watchRef.current = null;
        setWatching(null);
      }
      sock.onmessage = (ev) => {
        const m: ServerMsg = JSON.parse(ev.data);
        switch (m.t) {
          case 'watching':
            watchRef.current = m.room.code;
            setWatching(m.room.code);
            setMe(null);
            setRoom(m.room);
            setChat([]);
            break;
          case 'joined':
            setMe(m.you);
            setRoom(m.room);
            if (!m.room.started) setState(null);
            saveResume(m.room.code, m.secret);
            break;
          case 'room':
            setRoom(m.room);
            // host memulai ulang (rematch) → kembali ke lobby
            if (!m.room.started) setState(null);
            break;
          case 'left':
            break;
          case 'rooms':
            setPublicRooms(m.rooms);
            break;
          case 'notice':
            onError(m.text);
            break;
          case 'state':
            setState(m.state);
            break;
          case 'error':
            if (m.message === 'Room tidak ditemukan' || m.message === 'Kursimu sudah diambil alih bot' || m.message === 'Kamu dikeluarkan host' || (watchRef.current === null && first.t === 'watch')) {
              watchRef.current = null;
              setWatching(null);
              clearResume();
              setRoom(null);
              setState(null);
              setMe(null);
              ws.current = null;
              sock.close();
              setStatus('idle');
            }
            onError(m.message);
            break;
          case 'chat':
            setChat((c) => [...c.slice(-40), { from: m.from, text: m.text, seat: m.seat }]);
            break;
          case 'emote': {
            const id = Math.random();
            setEmotes((l) => [...l, { id, from: m.from, e: m.e }]);
            setTimeout(() => setEmotes((l) => l.filter((x) => x.id !== id)), 2600);
            break;
          }
          case 'timer':
            // pakai sisa waktu (ms) + jam klien sendiri → tidak terpengaruh selisih jam server/klien
            setTimer({ actor: m.actor, deadline: m.ms ? Date.now() + m.ms : 0 });
            break;
        }
      };
    },
    [onError],
  );

  const raw = useCallback((m: ClientMsg) => ws.current?.readyState === 1 && ws.current.send(JSON.stringify(m)), []);
  const send = useCallback((_pid: string, action: Action) => raw({ t: 'action', action }), [raw]);

  // reconnect otomatis jika putus (jeda makin lama: 1.5s, 3s, 6s … maks 15s)
  const tries = useRef(0);
  useEffect(() => {
    if (status === 'open') tries.current = 0;
    if (status !== 'closed' || !room) return;
    const wait = Math.min(15000, 1500 * 2 ** tries.current++);
    const t = setTimeout(() => {
      if (watchRef.current) return connect({ t: 'watch', code: watchRef.current });
      const r = getResume();
      if (r) connect({ t: 'join', code: r.code, resume: r.secret, name: '', color: '', token: 0 });
    }, wait);
    return () => clearTimeout(t);
  }, [status, room, connect]);

  const leave = () => {
    watchRef.current = null;
    setWatching(null);
    clearResume();
    // beri tahu server: di lobby kursi dilepas, di tengah game kursi diambil alih bot
    if (ws.current?.readyState === 1) ws.current.send(JSON.stringify({ t: 'leave' } satisfies ClientMsg));
    ws.current?.close();
    ws.current = null;
    setRoom(null);
    setState(null);
    setMe(null);
    setStatus('idle');
  };

  /** Ambil daftar room publik lewat koneksi sementara (tidak mengganggu koneksi room). */
  const listRooms = useCallback(() => {
    try {
      const sock = new WebSocket(wsUrl());
      const done = setTimeout(() => sock.close(), 8000);
      sock.onopen = () => sock.send(JSON.stringify({ t: 'list' } satisfies ClientMsg));
      sock.onmessage = (ev) => {
        const m: ServerMsg = JSON.parse(ev.data);
        if (m.t === 'rooms') {
          setPublicRooms(m.rooms);
          clearTimeout(done);
          sock.close();
        }
      };
      sock.onerror = () => setPublicRooms((r) => r ?? []);
    } catch {
      setPublicRooms([]);
    }
  }, []);

  /** tonton room yang sedang bermain tanpa ikut main */
  const watch = useCallback((code: string) => connect({ t: 'watch', code }), [connect]);

  return { room, state, me, status, chat, emotes, timer, publicRooms, listRooms, connect, raw, send, leave, watch, watching };
}

export type { Theme };
