// Akun & fitur sosial di sisi web: panggilan API, sesi login, mode tamu, koneksi status online + undangan.

import { useCallback, useEffect, useRef, useState } from 'react';
import type { AccountPrivate, AuthResult, ClientMsg, DirectMessage, FriendsData, Profile, Report, ServerMsg, UserPublic } from '@monopoli/engine';
import { del, getJSON, getRaw, setJSON, setRaw } from './storage';
import { IS_APP, SERVER, serverUrl } from './platform';

/**
 * Build tanpa server (mis. halaman demo statis, atau aplikasi HP tanpa VITE_SERVER_URL):
 * akun & online disembunyikan, main lokal tetap penuh.
 */
export const OFFLINE = import.meta.env.VITE_OFFLINE === '1' || (IS_APP && !SERVER);

const TOKEN_KEY = 'monopoli.session';
const GUEST_KEY = 'monopoli.guest';

/** Token sesi saat ini (dipakai juga oleh koneksi room supaya kursi tertaut ke akun). */
export const getToken = () => getRaw(TOKEN_KEY);

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export async function api<T>(path: string, opts: { method?: string; body?: unknown } = {}): Promise<T> {
  const token = getToken();
  let r: Response;
  try {
    r = await fetch(serverUrl(`/api${path}`), {
      method: opts.method ?? (opts.body !== undefined ? 'POST' : 'GET'),
      headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    });
  } catch {
    throw new ApiError(0, 'Tidak bisa terhubung ke server. Pastikan server jalan (npm run dev).');
  }
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new ApiError(r.status, (data as { error?: string }).error ?? `Gagal (${r.status})`);
  return data as T;
}

export const wsUrl = () => {
  const env = import.meta.env.VITE_WS_URL as string | undefined;
  if (env) return env;
  if (SERVER) return `${SERVER.replace(/^http/, 'ws')}/ws`;
  return `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/ws`;
};

/** Sesi login + mode tamu. */
export function useAuth() {
  const [user, setUser] = useState<UserPublic | null>(() => getJSON<UserPublic | null>('monopoli.user', null));
  const [guest, setGuestState] = useState<boolean>(() => getRaw(GUEST_KEY) === '1');
  const [config, setConfig] = useState<{ googleClientId: string | null }>({ googleClientId: null });
  /** data akun pribadi (email, password, Google, blokir) — hanya untuk pemilik akun */
  const [account, setAccount] = useState<AccountPrivate | null>(null);
  /** pesan saat sesi dihentikan (mis. akun ditangguhkan) */
  const [kicked, setKicked] = useState<string | null>(null);

  const reloadMe = useCallback(() => {
    if (!getToken()) return Promise.resolve();
    // pastikan sesi masih berlaku (bisa kedaluwarsa / di-logout dari perangkat lain)
    return api<{ user: UserPublic; account: AccountPrivate }>('/me').then(
      (r) => (setUserSaved(r.user), setAccount(r.account)),
      (e) => {
        if (e instanceof ApiError && (e.status === 401 || e.status === 403)) {
          clearSession();
          // 403 = akun ditangguhkan admin → beri tahu alasannya
          if (e.status === 403) setKicked(e.message);
        }
      },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (OFFLINE) return;
    // Login Google diblokir Google di dalam WebView aplikasi HP → di aplikasi cukup login email (kode OTP)
    api<{ googleClientId: string | null }>('/config').then((c) => setConfig(IS_APP ? { ...c, googleClientId: null } : c), () => {});
    void reloadMe();
  }, [reloadMe]);

  const setUserSaved = (u: UserPublic | null) => {
    setUser(u);
    if (u) setJSON('monopoli.user', u);
    else del('monopoli.user');
  };
  const clearSession = () => {
    del(TOKEN_KEY);
    setUserSaved(null);
    setAccount(null);
  };
  const accept = (r: AuthResult) => {
    setRaw(TOKEN_KEY, r.token);
    setUserSaved(r.user);
    setGuest(false);
    void reloadMe();
    return r;
  };
  const withAccount = (p: Promise<{ account: AccountPrivate; user?: UserPublic }>) =>
    p.then((r) => {
      setAccount(r.account);
      if (r.user) setUserSaved(r.user);
      return r;
    });
  const setGuest = (v: boolean) => {
    setGuestState(v);
    if (v) setRaw(GUEST_KEY, '1');
    else del(GUEST_KEY);
  };

  return {
    user,
    guest,
    config,
    /** sudah memilih: login atau tamu */
    entered: !!user || guest,
    /** akun lama (dibuat sebelum login email): username + password */
    login: (username: string, password: string) => api<AuthResult>('/login', { body: { username, password } }).then(accept),
    /** kirim kode masuk 6 angka ke email (akun baru dibuat otomatis saat kode benar) */
    emailStart: (email: string) => api<{ ok: true; mailEnabled: boolean; exists: boolean }>('/email/start', { body: { email } }),
    emailVerify: (email: string, code: string) => api<AuthResult>('/email/verify', { body: { email, code } }).then(accept),
    google: (credential: string) => api<AuthResult>('/google', { body: { credential } }).then(accept),
    logout: async () => {
      await api('/logout', { method: 'POST' }).catch(() => {});
      clearSession();
      setGuest(false);
    },
    updateMe: (p: Partial<Pick<UserPublic, 'displayName' | 'color' | 'token' | 'avatar'>>) => api<{ user: UserPublic }>('/me', { method: 'PATCH', body: p }).then((r) => setUserSaved(r.user)),
    /** unggah foto profil (data URL hasil diperkecil di browser) */
    uploadAvatar: (image: string) => api<{ user: UserPublic }>('/me/avatar', { body: { image } }).then((r) => setUserSaved(r.user)),
    playAsGuest: () => setGuest(true),
    account,
    reloadMe,
    kicked,
    clearKicked: () => setKicked(null),
    /** tambah / ganti email → link konfirmasi dikirim */
    setEmail: (email: string) => withAccount(api<{ account: AccountPrivate; sent: boolean }>('/me/email', { body: { email } })),
    verifyEmail: (token: string) => api<{ ok: true; username: string }>('/verify-email', { body: { token } }).then((r) => (void reloadMe(), r)),
    changePassword: (current: string, password: string) => withAccount(api<{ account: AccountPrivate }>('/me/password', { body: { current, password } })),
    linkGoogle: (credential: string) => withAccount(api<{ account: AccountPrivate; user: UserPublic }>('/me/google', { body: { credential } })),
    unlinkGoogle: () => withAccount(api<{ account: AccountPrivate }>('/me/google', { method: 'DELETE' })),
    deleteAccount: async (confirm: string, password: string) => {
      await api('/me', { method: 'DELETE', body: { confirm, password } });
      clearSession();
      setGuest(false);
    },
    block: (username: string) => withAccount(api<{ account: AccountPrivate }>('/blocks', { body: { username } })),
    unblock: (username: string) => withAccount(api<{ account: AccountPrivate }>(`/blocks/${encodeURIComponent(username)}`, { method: 'DELETE' })),
  };
}
export type Auth = ReturnType<typeof useAuth>;

export interface Invite {
  id: number;
  from: UserPublic;
  code: string;
  roomName: string;
}

/**
 * Koneksi "sosial" selama login: membuat kita terlihat online, menerima undangan & pemberitahuan,
 * dan menyegarkan daftar teman saat ada perubahan.
 */
export function useSocial(user: UserPublic | null, onNotice: (text: string) => void, onKicked?: () => void) {
  const [friends, setFriends] = useState<FriendsData>({ friends: [], incoming: [], outgoing: [] });
  const [invites, setInvites] = useState<Invite[]>([]);
  /** pesan pribadi per teman (username) yang sudah dimuat / diterima */
  const [dms, setDms] = useState<Record<string, DirectMessage[]>>({});
  const [unread, setUnread] = useState<Record<string, number>>(() => getJSON('monopoli.dmUnread', {}));
  /** chat pribadi yang sedang terbuka (pesan masuk ke sini tidak dihitung belum dibaca) */
  const openChat = useRef<string | null>(null);
  const meRef = useRef(user?.username);
  meRef.current = user?.username;
  useEffect(() => setJSON('monopoli.dmUnread', unread), [unread]);
  const noticeRef = useRef(onNotice);
  const kickedRef = useRef(onKicked);
  kickedRef.current = onKicked;
  noticeRef.current = onNotice;

  const refresh = useCallback(() => {
    if (!getToken()) return;
    api<FriendsData>('/friends').then(setFriends, () => {});
  }, []);

  useEffect(() => {
    if (!user) {
      setFriends({ friends: [], incoming: [], outgoing: [] });
      setInvites([]);
      return;
    }
    refresh();
    let ws: WebSocket | null = null;
    let stop = false;
    let tries = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const open = () => {
      const token = getToken();
      if (stop || !token) return;
      ws = new WebSocket(wsUrl());
      ws.onopen = () => {
        tries = 0;
        ws!.send(JSON.stringify({ t: 'hello', token } satisfies ClientMsg));
        refresh();
      };
      ws.onmessage = (ev) => {
        const m: ServerMsg = JSON.parse(ev.data);
        if (m.t === 'social') refresh();
        else if (m.t === 'notice') noticeRef.current(m.text);
        else if (m.t === 'dm') {
          const other = m.message.from === meRef.current ? m.message.to : m.message.from;
          setDms((d) => ({ ...d, [other]: [...(d[other] ?? []).filter((x) => x.at !== m.message.at || x.text !== m.message.text), m.message].slice(-100) }));
          if (m.message.from !== meRef.current && openChat.current !== other) setUnread((u) => ({ ...u, [other]: (u[other] ?? 0) + 1 }));
        } else if (m.t === 'invite') setInvites((l) => [...l.filter((x) => x.code !== m.code), { id: Date.now(), from: m.from, code: m.code, roomName: m.roomName }].slice(-3));
      };
      ws.onclose = (ev) => {
        // 4003 = akun ditangguhkan: cek ulang sesi (akan keluar & menampilkan alasannya)
        if (ev.code === 4003) return kickedRef.current?.();
        if (!stop) timer = setTimeout(open, Math.min(20000, 1500 * 2 ** tries++));
      };
    };
    open();
    // status online teman juga dicek berkala (cadangan kalau ada pesan yang terlewat)
    const poll = setInterval(refresh, 30000);
    return () => {
      stop = true;
      clearTimeout(timer);
      clearInterval(poll);
      ws?.close();
    };
  }, [user?.username, refresh]);

  return {
    ...friends,
    refresh,
    invites,
    dismissInvite: (id: number) => setInvites((l) => l.filter((x) => x.id !== id)),
    request: (username: string) => api<FriendsData & { result: string }>('/friends', { body: { username } }).then((d) => (setFriends(d), d.result)),
    accept: (username: string) => api<FriendsData>('/friends/accept', { body: { username } }).then(setFriends),
    remove: (username: string) => api<FriendsData>(`/friends/${encodeURIComponent(username)}`, { method: 'DELETE' }).then(setFriends),
    dms,
    unread,
    unreadTotal: Object.values(unread).reduce((a, b) => a + b, 0),
    /** buka chat pribadi: muat riwayat & tandai sudah dibaca */
    openDm: (username: string | null) => {
      openChat.current = username;
      if (!username) return Promise.resolve();
      setUnread((u) => ({ ...u, [username]: 0 }));
      return api<{ messages: DirectMessage[] }>(`/dm/${encodeURIComponent(username)}`).then((r) => setDms((d) => ({ ...d, [username]: r.messages })));
    },
    sendDm: (username: string, text: string) =>
      api<{ message: DirectMessage }>(`/dm/${encodeURIComponent(username)}`, { body: { text } }).then((r) =>
        setDms((d) => ({ ...d, [username]: [...(d[username] ?? []).filter((x) => x.at !== r.message.at || x.text !== r.message.text), r.message] })),
      ),
  };
}
export type Social = ReturnType<typeof useSocial>;

export const fetchProfile = (username: string) => api<Profile>(`/users/${encodeURIComponent(username)}`);
export const sendReport = (username: string, reason: string, detail: string) => api('/reports', { body: { username, reason, detail } });
export const adminBan = (username: string, days: number, reason: string) => api(`/admin/ban/${encodeURIComponent(username)}`, { body: { days, reason } });
export const adminUnban = (username: string) => api(`/admin/ban/${encodeURIComponent(username)}`, { method: 'DELETE' });
export const fetchReports = () => api<{ reports: Report[] }>('/admin/reports').then((r) => r.reports);
export const closeReport = (id: string) => api<{ reports: Report[] }>(`/admin/reports/${id}`, { body: {} }).then((r) => r.reports);
export interface LeaderRow {
  rank: number;
  user: UserPublic;
  games: number;
  wins: number;
  xp: number;
  level: number;
}
export const fetchLeaderboard = (by: 'xp' | 'wins' | 'rate') => api<{ by: string; top: LeaderRow[]; me: LeaderRow | null }>(`/leaderboard?by=${by}`);

/** Kirim galat tak terduga di browser ke log server (maks beberapa per sesi). */
let reported = 0;
export function reportClientError(message: string, stack?: string) {
  if (OFFLINE || reported++ > 5) return;
  void fetch(serverUrl('/api/client-error'), { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ message, stack, url: location.pathname }) }).catch(() => {});
}
export const searchUsers = (q: string) => api<{ users: (UserPublic & { friendship: Profile['friendship'] })[] }>(`/users?q=${encodeURIComponent(q)}`).then((r) => r.users);

// ---------- Google Identity Services ----------
interface GoogleId {
  accounts: { id: { initialize(o: object): void; renderButton(el: HTMLElement, o: object): void; disableAutoSelect(): void } };
}
let gsiLoading: Promise<GoogleId> | null = null;
/** Muat skrip resmi "Sign in with Google" sekali saja. */
export function loadGoogle(): Promise<GoogleId> {
  const w = window as unknown as { google?: GoogleId };
  if (w.google?.accounts?.id) return Promise.resolve(w.google);
  gsiLoading ??= new Promise((ok, bad) => {
    const s = document.createElement('script');
    s.src = 'https://accounts.google.com/gsi/client';
    s.async = true;
    s.onload = () => (w.google ? ok(w.google) : bad(new Error('Google tidak termuat')));
    s.onerror = () => {
      gsiLoading = null;
      bad(new Error('Tidak bisa memuat login Google'));
    };
    document.head.appendChild(s);
  });
  return gsiLoading;
}
