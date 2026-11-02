// Setiap petak (kecuali Kesempatan/Dana Umum yang sudah punya animasi kartu) di semua tema punya animasi khas.
import { describe, expect, it } from 'vitest';
import { BOARD, THEMES, tileName } from '@monopoli/engine';
import { ALL_ANIMS, tileAnimFor } from '../src/tileAnims';

describe('animasi petak', () => {
  it('semua petak di semua tema bawaan punya animasi & keterangan', () => {
    for (const theme of THEMES)
      for (let i = 0; i < 40; i++) {
        const a = tileAnimFor(theme, i);
        if (BOARD[i].kind === 'chance' || BOARD[i].kind === 'community') {
          expect(a).toBeNull();
          continue;
        }
        expect(a, `${theme.id} ${tileName(theme, i)}`).not.toBeNull();
        expect(ALL_ANIMS).toContain(a!.id);
        expect(a!.caption.length).toBeGreaterThan(3);
      }
  });
  it('contoh: Kupang = kuda, Jayapura = cendrawasih, Jakarta = kembang api', () => {
    const id = THEMES.find((t) => t.id === 'indonesia')!;
    expect(tileAnimFor(id, 6)!.id).toBe('horse');
    expect(tileAnimFor(id, 3)!.caption).toMatch(/cendrawasih/i);
    expect(tileAnimFor(id, 39)!.id).toBe('fireworks');
  });
  it('petak Indonesia punya animasi yang beragam (bukan cadangan bergiliran)', () => {
    const id = THEMES.find((t) => t.id === 'indonesia')!;
    const props = BOARD.filter((t) => t.kind === 'property').map((t) => tileAnimFor(id, t.index)!.id);
    expect(new Set(props).size).toBe(22);
  });
});
