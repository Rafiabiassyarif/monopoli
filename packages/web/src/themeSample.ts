// Isi awal editor Studio tema: kartu kustom (teks + efek) dan efek petak yang muncul saat pemain
// menekan "Mulai Buat Kartu Kustom" / "Isi contoh rekomendasi". Bukan tema siap pakai.

import type { CustomDecks, TileFx } from '@monopoli/engine';

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
  '0': { caption: 'Gajian! Saatnya belanja', custom: { motion: 'fountain', emojis: '💰🪙💵', count: 16, size: 1.1, speed: 1, glow: '#fbbf24', sound: 'pay' } },
  '24': { anim: 'fireworks', emoji: '🎆', caption: 'Pesta kembang api tahun baru' },
  '39': { caption: 'Malam takbiran di ibu kota', custom: { motion: 'confetti', emojis: '🎉🎊✨', count: 20, size: 1, speed: 1, sound: 'win' } },
  '20': { emoji: '☕', caption: 'Ngopi santai dulu di warung' },
};
