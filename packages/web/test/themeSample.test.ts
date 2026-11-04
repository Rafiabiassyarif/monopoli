import { describe, expect, it } from 'vitest';
import { validateTheme } from '@monopoli/engine';
import { sampleTheme } from '../src/themeSample';
import { tileAnimFor } from '../src/tileAnims';

describe('contoh tema JSON', () => {
  it('lolos validasi & efek petak kustom dipakai', () => {
    const th = sampleTheme();
    expect(validateTheme(JSON.parse(JSON.stringify(th)))).toEqual([]);
    expect(tileAnimFor(th, 24)).toMatchObject({ id: 'fireworks', emoji: '🎆', own: true });
    expect(tileAnimFor(th, 20)).toMatchObject({ emoji: '☕', own: true }); // emoji saja
  });
});
