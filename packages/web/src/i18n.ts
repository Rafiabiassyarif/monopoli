// Bahasa antarmuka (Indonesia / Inggris). Teks sumber ditulis dalam bahasa Indonesia langsung di kode:
//   t('Lempar dadu')                → "Roll dice" saat bahasa Inggris
//   t('Giliran {name}', { name })   → "{name}'s turn"
// Kamus Inggris ada di i18n.en.ts (kunci = teks Indonesia persis). Pesan dari server/engine
// diterjemahkan dengan tr() yang juga mengenali pola berisi angka/nama.

import { Fragment, createElement, useSyncExternalStore, type ReactNode } from 'react';
import { EN, EN_PATTERNS } from './i18n.en';
import { getRaw, setRaw } from './storage';

export type Lang = 'id' | 'en';
const KEY = 'monopoli.lang';

function initial(): Lang {
  const saved = getRaw(KEY);
  if (saved === 'id' || saved === 'en') return saved;
  const nav = typeof navigator !== 'undefined' ? navigator.language?.toLowerCase() ?? 'id' : 'id';
  return nav.startsWith('id') || nav.startsWith('ms') ? 'id' : 'en';
}

let lang: Lang = initial();
const subs = new Set<() => void>();
if (typeof document !== 'undefined') document.documentElement.lang = lang;

export const getLang = () => lang;
export function setLang(l: Lang) {
  if (l === lang) return;
  lang = l;
  setRaw(KEY, l);
  if (typeof document !== 'undefined') document.documentElement.lang = l;
  subs.forEach((f) => f());
}
const subscribe = (f: () => void) => (subs.add(f), () => subs.delete(f));
/** Komponen yang memanggil ini ikut digambar ulang saat bahasa diganti. */
export const useLang = () => useSyncExternalStore(subscribe, getLang, getLang);

/** Locale untuk tanggal & angka. */
export const dateLocale = () => (lang === 'en' ? 'en-GB' : 'id-ID');

const missing = new Set<string>();
function look(s: string): string {
  if (lang === 'id') return s;
  const v = EN[s];
  if (v !== undefined) return v;
  if (import.meta.env?.DEV && !missing.has(s)) {
    missing.add(s);
    console.warn('[i18n] belum diterjemahkan:', JSON.stringify(s));
  }
  return s;
}

const fill = (s: string, vars?: Record<string, string | number>) => (vars ? s.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? String(vars[k]) : m)) : s);

/** Terjemahkan teks antarmuka. */
export function t(s: string, vars?: Record<string, string | number>): string {
  return fill(look(s), vars);
}

/** Seperti t(), tapi nilai boleh berupa elemen React (mis. <b>nama</b>). */
export function tj(s: string, vars: Record<string, ReactNode>): ReactNode {
  const parts = look(s).split(/\{(\w+)\}/g);
  return createElement(
    Fragment,
    null,
    ...parts.map((p, k) => (k % 2 ? createElement(Fragment, { key: k }, vars[p] ?? `{${p}}`) : p)),
  );
}

/** Terjemahkan pesan dari server/engine (teks Indonesia yang mungkin berisi nama/angka). */
export function tr(msg: string): string {
  if (lang === 'id' || !msg) return msg;
  const v = EN[msg];
  if (v !== undefined) return v;
  for (const [re, out] of EN_PATTERNS) {
    const m = re.exec(msg);
    if (m) return out.replace(/\$(\d)/g, (_, i) => EN[m[+i] ?? ''] ?? m[+i] ?? '');
  }
  // gabungan "a · b" (mis. daftar galat validasi tema)
  if (msg.includes(' · ')) return msg.split(' · ').map(tr).join(' · ');
  return look(msg);
}
