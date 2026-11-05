import { describe, expect, it } from 'vitest';
import { THEMES, validateTheme } from '@monopoli/engine';
import { SAMPLE_DECKS, SAMPLE_TILE_FX } from '../src/themeSample';
import { tileAnimFor } from '../src/tileAnims';

describe('isi awal editor kartu & efek', () => {
  it('lolos validasi & efek petak kustom dipakai', () => {
    const th = { ...structuredClone(THEMES[0]), id: 'uji', decks: SAMPLE_DECKS, tileFx: SAMPLE_TILE_FX };
    expect(validateTheme(JSON.parse(JSON.stringify(th)))).toEqual([]);
    expect(tileAnimFor(th, 24)).toMatchObject({ id: 'fireworks', own: true });
    expect(tileAnimFor(th, 20)).toMatchObject({ emoji: '☕', own: true }); // emoji saja
    expect(tileAnimFor(th, 0)?.custom).toBeTruthy(); // animasi buatan sendiri
  });
});
