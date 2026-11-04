// Kartu Kesempatan & Dana Umum. Teks default memakai token: {m:N}=uang, {t:i}=nama petak.
// Tema boleh mengganti teks per id lewat theme.cards[id].

export type CardEffect =
  | { kind: 'advance'; to: number }
  | { kind: 'nearest'; target: 'station' | 'utility' }
  | { kind: 'money'; amount: number }
  | { kind: 'back'; steps: number }
  | { kind: 'jail' }
  | { kind: 'jailFree' }
  | { kind: 'repairs'; house: number; hotel: number }
  | { kind: 'eachPlayer'; amount: number }; // + = terima dari tiap pemain, - = bayar ke tiap pemain

export interface CardDef {
  id: string;
  text: string;
  effect: CardEffect;
}

export const CHANCE: CardDef[] = [
  { id: 'c1', text: 'Maju ke START. Terima gaji {m:go}.', effect: { kind: 'advance', to: 0 } },
  { id: 'c2', text: 'Maju ke {t:24}. Lewat START dapat gaji.', effect: { kind: 'advance', to: 24 } },
  { id: 'c3', text: 'Maju ke {t:11}. Lewat START dapat gaji.', effect: { kind: 'advance', to: 11 } },
  { id: 'c4', text: 'Maju ke stasiun terdekat. Jika dimiliki, bayar sewa 2x lipat.', effect: { kind: 'nearest', target: 'station' } },
  { id: 'c5', text: 'Maju ke utilitas terdekat. Jika dimiliki, lempar dadu dan bayar 10x hasilnya.', effect: { kind: 'nearest', target: 'utility' } },
  { id: 'c6', text: 'Bank membayar dividen {m:50}.', effect: { kind: 'money', amount: 50 } },
  { id: 'c7', text: 'Kartu BEBAS PENJARA. Simpan sampai dipakai.', effect: { kind: 'jailFree' } },
  { id: 'c8', text: 'Mundur 3 langkah.', effect: { kind: 'back', steps: 3 } },
  { id: 'c9', text: 'Masuk PENJARA! Tidak lewat START.', effect: { kind: 'jail' } },
  { id: 'c10', text: 'Renovasi: bayar {m:25} per rumah, {m:100} per hotel.', effect: { kind: 'repairs', house: 25, hotel: 100 } },
  { id: 'c11', text: 'Denda ngebut {m:15}.', effect: { kind: 'money', amount: -15 } },
  { id: 'c12', text: 'Jalan-jalan ke {t:5}. Lewat START dapat gaji.', effect: { kind: 'advance', to: 5 } },
  { id: 'c13', text: 'Maju ke {t:39}.', effect: { kind: 'advance', to: 39 } },
  { id: 'c14', text: 'Terpilih jadi ketua. Bayar {m:50} ke tiap pemain.', effect: { kind: 'eachPlayer', amount: -50 } },
  { id: 'c15', text: 'Pinjaman gedung jatuh tempo. Terima {m:150}.', effect: { kind: 'money', amount: 150 } },
  // aturan resmi: ada DUA kartu "maju ke stasiun terdekat"
  { id: 'c16', text: 'Maju ke stasiun terdekat. Jika dimiliki, bayar sewa 2x lipat.', effect: { kind: 'nearest', target: 'station' } },
];

export const COMMUNITY: CardDef[] = [
  { id: 'd1', text: 'Maju ke START. Terima gaji {m:go}.', effect: { kind: 'advance', to: 0 } },
  { id: 'd2', text: 'Bank salah hitung, untung buat kamu. Terima {m:200}.', effect: { kind: 'money', amount: 200 } },
  { id: 'd3', text: 'Biaya dokter. Bayar {m:50}.', effect: { kind: 'money', amount: -50 } },
  { id: 'd4', text: 'Jual saham. Terima {m:50}.', effect: { kind: 'money', amount: 50 } },
  { id: 'd5', text: 'Kartu BEBAS PENJARA. Simpan sampai dipakai.', effect: { kind: 'jailFree' } },
  { id: 'd6', text: 'Masuk PENJARA! Tidak lewat START.', effect: { kind: 'jail' } },
  { id: 'd7', text: 'Dana liburan cair. Terima {m:100}.', effect: { kind: 'money', amount: 100 } },
  { id: 'd8', text: 'Restitusi pajak. Terima {m:20}.', effect: { kind: 'money', amount: 20 } },
  { id: 'd9', text: 'Hari ulang tahunmu! Terima {m:10} dari tiap pemain.', effect: { kind: 'eachPlayer', amount: 10 } },
  { id: 'd10', text: 'Asuransi jiwa cair. Terima {m:100}.', effect: { kind: 'money', amount: 100 } },
  { id: 'd11', text: 'Biaya rumah sakit. Bayar {m:100}.', effect: { kind: 'money', amount: -100 } },
  { id: 'd12', text: 'Biaya sekolah. Bayar {m:50}.', effect: { kind: 'money', amount: -50 } },
  { id: 'd13', text: 'Honor konsultasi. Terima {m:25}.', effect: { kind: 'money', amount: 25 } },
  { id: 'd14', text: 'Perbaikan jalan: bayar {m:40} per rumah, {m:115} per hotel.', effect: { kind: 'repairs', house: 40, hotel: 115 } },
  { id: 'd15', text: 'Juara 2 kontes kecantikan. Terima {m:10}.', effect: { kind: 'money', amount: 10 } },
  { id: 'd16', text: 'Dapat warisan. Terima {m:100}.', effect: { kind: 'money', amount: 100 } },
];

// ---------- kartu kustom (dari tema JSON buatan pemain) ----------

/** Satu kartu kustom di tema JSON: teks bebas + efek dari daftar efek yang didukung engine. */
export interface CustomCard {
  text: string;
  effect: CardEffect;
}
export type CustomDecks = { chance?: CustomCard[]; community?: CustomCard[] };

export const MAX_CUSTOM_CARDS = 30;
const int = (v: unknown, lo: number, hi: number) => typeof v === 'number' && Number.isInteger(v) && v >= lo && v <= hi;

/** Cek satu efek kartu (trust boundary: JSON dari pemain). null = valid, string = alasan ditolak. */
export function cardEffectError(e: unknown): string | null {
  const x = e as Record<string, unknown> | null;
  if (!x || typeof x !== 'object') return 'effect wajib objek';
  switch (x.kind) {
    case 'advance':
      return int(x.to, 0, 39) ? null : 'advance.to harus 0..39 (nomor petak)';
    case 'nearest':
      return x.target === 'station' || x.target === 'utility' ? null : "nearest.target harus 'station' atau 'utility'";
    case 'money':
      return int(x.amount, -1000, 1000) && x.amount !== 0 ? null : 'money.amount harus -1000..1000 (bukan 0)';
    case 'back':
      return int(x.steps, 1, 12) ? null : 'back.steps harus 1..12';
    case 'jail':
    case 'jailFree':
      return null;
    case 'repairs':
      return int(x.house, 0, 500) && int(x.hotel, 0, 1000) ? null : 'repairs.house 0..500 & repairs.hotel 0..1000';
    case 'eachPlayer':
      return int(x.amount, -500, 500) && x.amount !== 0 ? null : 'eachPlayer.amount harus -500..500 (bukan 0)';
    default:
      return 'effect.kind tidak dikenal (advance, nearest, money, back, jail, jailFree, repairs, eachPlayer)';
  }
}

/** Daftar error untuk tumpukan kartu kustom; kosong = valid. */
export function customDecksErrors(d: unknown): string[] {
  if (d === undefined) return [];
  const e: string[] = [];
  if (!d || typeof d !== 'object') return ['decks harus objek { chance: [...], community: [...] }'];
  for (const deck of ['chance', 'community'] as const) {
    const list = (d as Record<string, unknown>)[deck];
    if (list === undefined) continue;
    if (!Array.isArray(list) || list.length < 1 || list.length > MAX_CUSTOM_CARDS) {
      e.push(`decks.${deck} harus berisi 1..${MAX_CUSTOM_CARDS} kartu`);
      continue;
    }
    list.forEach((c, i) => {
      const card = c as Partial<CustomCard> | null;
      if (!card || typeof card.text !== 'string' || !card.text.trim() || card.text.length > 200) e.push(`decks.${deck}[${i}].text wajib (maks 200 huruf)`);
      const err = cardEffectError(card?.effect);
      if (err) e.push(`decks.${deck}[${i}]: ${err}`);
    });
  }
  return e;
}

/** Ubah tumpukan kustom yang valid jadi CardDef ber-id (xc1.. / xd1..). Tumpukan tidak valid/kosong → null (pakai bawaan). */
export function buildCustomDecks(d: CustomDecks | undefined): { chance: CardDef[] | null; community: CardDef[] | null } {
  const make = (list: CustomCard[] | undefined, prefix: string): CardDef[] | null => {
    if (!Array.isArray(list) || !list.length) return null;
    const ok = list.slice(0, MAX_CUSTOM_CARDS).filter((c) => c && typeof c.text === 'string' && c.text.trim() && !cardEffectError(c.effect));
    return ok.length ? ok.map((c, i) => ({ id: `${prefix}${i + 1}`, text: c.text.trim().slice(0, 200), effect: { ...c.effect } })) : null;
  };
  return { chance: make(d?.chance, 'xc'), community: make(d?.community, 'xd') };
}
