// Contoh tema JSON lengkap dengan kartu kustom (teks + efek) dan efek petak — untuk tombol
// "Unduh contoh JSON" di Studio tema dan file contoh-tema-kustom.json di folder project.

import { THEMES, type CustomDecks, type Theme, type TileFx } from '@monopoli/engine';

export const SAMPLE_DECKS: CustomDecks = {
  chance: [
    { text: 'Menang lomba makan kerupuk! Terima {m:100}.', effect: { kind: 'money', amount: 100 } },
    { text: 'Mudik lebaran ke {t:39}. Lewat START dapat gaji.', effect: { kind: 'advance', to: 39 } },
    { text: 'Kena tilang di jalan tol. Bayar {m:30}.', effect: { kind: 'money', amount: -30 } },
    { text: 'Naik kereta ke stasiun terdekat. Kalau dimiliki, bayar sewa 2x lipat.', effect: { kind: 'nearest', target: 'station' } },
    { text: 'Lupa bawa dompet, putar balik 2 langkah.', effect: { kind: 'back', steps: 2 } },
    { text: 'Ketahuan main petasan. Masuk PENJARA!', effect: { kind: 'jail' } },
    { text: 'Kartu sakti: BEBAS PENJARA. Simpan sampai dipakai.', effect: { kind: 'jailFree' } },
    { text: 'Traktir teman sekampung: bayar {m:20} ke tiap pemain.', effect: { kind: 'eachPlayer', amount: -20 } },
  ],
  community: [
    { text: 'Arisan RT cair! Terima {m:150}.', effect: { kind: 'money', amount: 150 } },
    { text: 'Hari ulang tahunmu! Terima {m:15} dari tiap pemain.', effect: { kind: 'eachPlayer', amount: 15 } },
    { text: 'Atap bocor musim hujan: bayar {m:30} per rumah, {m:100} per hotel.', effect: { kind: 'repairs', house: 30, hotel: 100 } },
    { text: 'Pulang kampung ke START. Terima gaji {m:go}.', effect: { kind: 'advance', to: 0 } },
    { text: 'Bayar iuran kebersihan {m:10}.', effect: { kind: 'money', amount: -10 } },
    { text: 'Kartu sakti: BEBAS PENJARA. Simpan sampai dipakai.', effect: { kind: 'jailFree' } },
  ],
};

export const SAMPLE_TILE_FX: Record<string, TileFx> = {
  '0': { anim: 'money', emoji: '💰', caption: 'Gajian! Saatnya belanja' },
  '24': { anim: 'fireworks', emoji: '🎆', caption: 'Pesta kembang api tahun baru' },
  '39': { anim: 'fireworks', emoji: '🎉', caption: 'Malam takbiran di ibu kota' },
  '20': { emoji: '☕', caption: 'Ngopi santai dulu di warung' },
};

/** Tema contoh: salinan Indonesia + kartu & efek kustom. */
export function sampleTheme(): Theme {
  const base = structuredClone(THEMES.find((t) => t.id === 'indonesia')!);
  return {
    ...base,
    id: 'contoh-kustom',
    name: 'Indonesia Pesta',
    flag: '⭐',
    description: 'Contoh tema JSON: kartu Kesempatan & Dana Umum buatan sendiri, plus efek khusus di beberapa petak.',
    deckNames: { chance: 'Kejutan', community: 'Kas Kampung' },
    decks: SAMPLE_DECKS,
    tileFx: SAMPLE_TILE_FX,
  };
}
