// Kamus bahasa Inggris lengkap: semua teks t('…') di kode, kartu, celetukan bot, keterangan animasi petak,
// dan placeholder {…} tetap sama di terjemahan.
import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { BOARD, CHANCE, COMMUNITY, THEMES, tileName } from '@monopoli/engine';
import { EN } from '../src/i18n.en';
import { setLang, tr } from '../src/i18n';
import { tileAnimFor } from '../src/tileAnims';

const SRC = fileURLToPath(new URL('../src/', import.meta.url));
const ROOT = fileURLToPath(new URL('../../../', import.meta.url));

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? files(p) : /\.(tsx?)$/.test(f) ? [p] : [];
  });
}

/** argumen pertama t('…') / tj('…') / t("…") / t(`…`) yang berupa string literal */
function keysIn(code: string): string[] {
  const out: string[] = [];
  const re = /\b(?:t|tj|tt)\(\s*(?:'((?:[^'\\]|\\.)*)'|"((?:[^"\\]|\\.)*)"|`([^`$]*)`)/g;
  for (const m of code.matchAll(re)) {
    const raw = m[1] ?? m[2] ?? m[3];
    out.push(raw.replace(/\\(['"\\])/g, '$1'));
  }
  return out;
}

const holders = (s: string) => [...s.matchAll(/\{([a-z]+(?::\d+)?)\}/gi)].map((m) => m[1]).sort();

describe('i18n bahasa Inggris', () => {
  it('semua t(…) di kode web punya terjemahan', () => {
    const missing: Record<string, string[]> = {};
    for (const f of files(SRC)) {
      if (f.includes(`${'lang'}/en-`) || f.endsWith('i18n.en.ts') || f.endsWith('i18n.ts')) continue;
      const miss = [...new Set(keysIn(readFileSync(f, 'utf8')))].filter((k) => EN[k] === undefined);
      if (miss.length) missing[relative(SRC, f)] = miss;
    }
    const report = Object.entries(missing)
      .map(([f, l]) => `${f} (${l.length}):\n  ${l.map((k) => JSON.stringify(k)).join('\n  ')}`)
      .join('\n');
    expect(Object.keys(missing).length, `Belum diterjemahkan:\n${report}`).toBe(0);
  });

  it('kartu, celetukan bot & keterangan animasi petak punya terjemahan', () => {
    for (const c of [...CHANCE, ...COMMUNITY]) expect(EN[c.text], c.text).toBeDefined();
    const chatter = readFileSync(join(ROOT, 'packages/engine/src/chatter.ts'), 'utf8');
    const block = chatter.slice(chatter.indexOf('const LINES'), chatter.indexOf('export interface Quip'));
    const lines = [...block.matchAll(/'((?:[^'\\]|\\.)*)'/g)].map((m) => m[1]).filter((x) => !/^[a-z]+$/.test(x));
    expect(lines.length).toBeGreaterThan(40);
    for (const l of lines) expect(EN[l], l).toBeDefined();
    setLang('en');
    try {
      for (const theme of THEMES)
        for (let i = 0; i < BOARD.length; i++) {
          const a = tileAnimFor(theme, i);
          // nama petak sudut berbahasa Inggris (tema USA/UK) atau nama diri dipakai apa adanya
          if (a) expect(EN[a.caption] !== undefined || tr(a.caption) !== a.caption || a.caption === tileName(theme, i), `${theme.id}: ${a.caption}`).toBe(true);
        }
    } finally {
      setLang('id');
    }
  });

  it('placeholder {…} dan token kartu {m:N}/{t:N} sama di terjemahan', () => {
    const bad = Object.entries(EN).filter(([k, v]) => holders(k).join() !== holders(v).join());
    expect(bad, bad.map(([k, v]) => `${k} → ${v}`).join('\n')).toEqual([]);
  });

  it('pesan server/engine diterjemahkan (termasuk pola berisi nama/angka)', () => {
    setLang('en');
    try {
      expect(tr('Room tidak ditemukan')).toBe('Room not found');
      expect(tr('Password minimal 6 karakter')).toBe('Password must be at least 6 characters');
      expect(tr('Undangan terkirim ke Sari')).toBe('Invite sent to Sari');
      expect(tr('Budi menerima pertemananmu')).toBe('Budi accepted your friend request');
      expect(tr('Budi sedang offline')).toBe('Budi is offline');
      expect(tr('Destinasi Terkenal Amerika')).toBe('Famous USA Destination');
      expect(tr('Tema kustom tidak valid: name wajib')).toBe('Invalid custom theme: name is required');
      expect(tr('name wajib · deckNames wajib')).toBe('name is required · deckNames is required');
    } finally {
      setLang('id');
    }
    expect(tr('Room tidak ditemukan')).toBe('Room tidak ditemukan');
  });
});
