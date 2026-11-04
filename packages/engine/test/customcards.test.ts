// Kartu kustom dari tema JSON pemain: validasi (trust boundary) & benar-benar dipakai engine.
import { describe, expect, it } from 'vitest';
import { THEMES, applyAction, buildCustomDecks, createGame, customDecksErrors, migrateState, validateTheme, type NewPlayer } from '../src';

const P = (n: number): NewPlayer[] => Array.from({ length: n }, (_, i) => ({ id: `p${i}`, name: `P${i}`, color: '#fff', token: i }));

describe('kartu kustom', () => {
  it('efek tidak valid ditolak dengan pesan jelas', () => {
    expect(customDecksErrors({ chance: [{ text: 'x', effect: { kind: 'money', amount: 999999 } }] })[0]).toMatch(/money.amount/);
    expect(customDecksErrors({ chance: [{ text: 'x', effect: { kind: 'teleport' } }] })[0]).toMatch(/kind tidak dikenal/);
    expect(customDecksErrors({ community: [] })[0]).toMatch(/1\.\.30/);
    expect(customDecksErrors({ chance: [{ text: '', effect: { kind: 'jail' } }] })[0]).toMatch(/text wajib/);
    expect(customDecksErrors({ chance: [{ text: 'ok', effect: { kind: 'advance', to: 5 } }] })).toEqual([]);
  });

  it('tema dengan decks & tileFx lolos validasi; tileFx salah ditolak', () => {
    const base = THEMES[0];
    expect(validateTheme({ ...base, id: 'x', decks: { chance: [{ text: 'Hadiah', effect: { kind: 'money', amount: 10 } }] }, tileFx: { '5': { anim: 'train', caption: 'Tut tut' } } })).toEqual([]);
    expect(validateTheme({ ...base, id: 'x', tileFx: { '77': { emoji: '🎉' } } }).join()).toMatch(/0\.\.39/);
    expect(validateTheme({ ...base, id: 'x', tileFx: { '3': { caption: 'tanpa emoji/anim' } } }).join()).toMatch(/anim atau emoji/);
  });

  it('kartu kustom dipakai saat mendarat di Kesempatan', () => {
    const decks = { chance: [{ text: 'Bonus {m:77}', effect: { kind: 'money' as const, amount: 77 } }] };
    let hit = 0;
    for (let seed = 1; seed < 400 && hit < 3; seed++) {
      let s = createGame(P(2), seed, {}, decks);
      expect(s.cardDefs?.chance?.[0]).toMatchObject({ id: 'xc1', text: 'Bonus {m:77}' });
      expect(s.cardDefs?.community).toBeUndefined(); // tumpukan lain tetap bawaan
      s = applyAction(s, 'p0', { type: 'roll' });
      if (s.players[0].pos !== 7 || s.dice[0] === s.dice[1]) continue;
      hit++;
      expect(s.players[0].cash).toBe(1500 + 77);
      expect(s.events.some((e) => e.type === 'card' && e.card === 'xc1')).toBe(true);
    }
    expect(hit).toBeGreaterThan(0);
  });

  it('kartu bebas penjara kustom dipegang lalu kembali ke tumpukan; save dimuat ulang tetap utuh', () => {
    const decks = buildCustomDecks({ chance: [{ text: 'Bebas!', effect: { kind: 'jailFree' } }, { text: 'Denda', effect: { kind: 'money', amount: -5 } }] });
    expect(decks.chance?.map((c) => c.id)).toEqual(['xc1', 'xc2']);
    const s = createGame(P(2), 3, {}, { chance: [{ text: 'Bebas!', effect: { kind: 'jailFree' } }] });
    const again = migrateState(JSON.parse(JSON.stringify(s)));
    expect(again.decks.chance).toEqual(['xc1']);
    expect(again.cardDefs?.chance?.[0].effect.kind).toBe('jailFree');
  });
});
