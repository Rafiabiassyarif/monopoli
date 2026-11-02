// Akses localStorage/sessionStorage yang aman: di mode privat / storage diblok, aksesnya bisa melempar error.
// Semua baca/tulis lewat sini supaya aplikasi tidak pernah crash karena storage.

function area(kind: 'local' | 'session'): Storage | null {
  try {
    return kind === 'local' ? window.localStorage : window.sessionStorage;
  } catch {
    return null;
  }
}

export function getRaw(k: string, kind: 'local' | 'session' = 'local'): string | null {
  try {
    return area(kind)?.getItem(k) ?? null;
  } catch {
    return null;
  }
}

export function setRaw(k: string, v: string, kind: 'local' | 'session' = 'local') {
  try {
    area(kind)?.setItem(k, v);
  } catch {
    /* penuh / diblok — abaikan */
  }
}

export function del(k: string, kind: 'local' | 'session' = 'local') {
  try {
    area(kind)?.removeItem(k);
  } catch {
    /* abaikan */
  }
}

export function getJSON<T>(k: string, d: T, kind: 'local' | 'session' = 'local'): T {
  const v = getRaw(k, kind);
  if (v === null) return d;
  try {
    return JSON.parse(v) as T;
  } catch {
    return d;
  }
}

export const setJSON = (k: string, v: unknown, kind: 'local' | 'session' = 'local') => setRaw(k, JSON.stringify(v), kind);

// ---------- data sambung ulang room online ----------
// Disimpan di sessionStorage (refresh di tab yang sama) DAN localStorage (tab/browser ditutup lalu dibuka lagi).
const RESUME = 'monopoli.resume';
const RESUME_TTL = 6 * 3600_000;

export interface Resume {
  code: string;
  secret: string;
  at?: number;
}

export function getResume(): Resume | null {
  const r = getJSON<Resume | null>(RESUME, null, 'session') ?? getJSON<Resume | null>(RESUME, null, 'local');
  if (!r || typeof r.code !== 'string' || typeof r.secret !== 'string') return null;
  if (r.at && Date.now() - r.at > RESUME_TTL) return clearResume(), null;
  return r;
}

export function saveResume(code: string, secret: string) {
  const v = { code, secret, at: Date.now() };
  setJSON(RESUME, v, 'session');
  setJSON(RESUME, v, 'local');
}

export function clearResume() {
  del(RESUME, 'session');
  del(RESUME, 'local');
}
