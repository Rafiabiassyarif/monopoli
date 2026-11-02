// Celetukan bot: reaksi singkat terhadap event, sesuai persona. Murni dari event → deterministik per seq.

import type { GameEvent, GameState, Persona } from './game';

type Kind = 'buy' | 'payRent' | 'getRent' | 'jail' | 'win' | 'bankrupt' | 'double' | 'build' | 'tradeOk' | 'tradeNo' | 'auctionWin';

const LINES: Record<Persona, Record<Kind, string[]>> = {
  agresif: {
    buy: ['Punyaku sekarang!', 'Borong semua!', 'Satu lagi masuk kantong.'],
    payRent: ['Cih… nanti kubalas.', 'Cuma recehan.', 'Ingat ini ya!'],
    getRent: ['Bayar, bayar!', 'Terima kasih atas sumbangannya 😏', 'Kasirku buka 24 jam.'],
    jail: ['Sel ini terlalu kecil buatku.', 'Tunggu aku keluar!'],
    win: ['Sudah kubilang kan!', 'Raja properti di sini.'],
    bankrupt: ['Ini belum berakhir…', 'Curang! Dadunya curang!'],
    double: ['Double! Gas terus!', 'Hoki pemenang.'],
    build: ['Bangun terus sampai langit!', 'Hotel segera hadir.'],
    tradeOk: ['Deal. Kamu nggak akan menyesal… mungkin.'],
    tradeNo: ['Tawaran apa itu? Nggak!', 'Naikkan dulu harganya.'],
    auctionWin: ['Lelang? Gampang.'],
  },
  hemat: {
    buy: ['Investasi jangka panjang.', 'Harga wajar, ambil.', 'Pelan-pelan asal selamat.'],
    payRent: ['Aduh, dompetku…', 'Mahal sekali sewanya.', 'Hitung ulang anggaran…'],
    getRent: ['Lumayan buat tabungan.', 'Terima kasih, pas sekali.'],
    jail: ['Hemat ongkos jalan.', 'Istirahat dulu di sini.'],
    win: ['Kesabaran membuahkan hasil.', 'Menabung pangkal kaya.'],
    bankrupt: ['Seharusnya aku lebih hemat…'],
    double: ['Wah, dapat bonus jalan.'],
    build: ['Satu rumah dulu, cukup.'],
    tradeOk: ['Angkanya masuk. Setuju.'],
    tradeNo: ['Maaf, kurang menguntungkan.', 'Aku pikir-pikir dulu… tidak.'],
    auctionWin: ['Dapat harga miring!'],
  },
  seimbang: {
    buy: ['Oke, aku ambil.', 'Pilihan bagus nih.', 'Masuk portofolio.'],
    payRent: ['Yah, kena juga.', 'Nggak apa-apa, giliran berputar.'],
    getRent: ['Makasih ya!', 'Rezeki nggak ke mana.'],
    jail: ['Waduh, ketahuan.', 'Sebentar saja kok.'],
    win: ['GG semuanya!', 'Seru banget, main lagi?'],
    bankrupt: ['GG, aku keluar dulu.'],
    double: ['Double!', 'Lanjut lagi~'],
    build: ['Renovasi dimulai.', 'Rumah baru!'],
    tradeOk: ['Setuju, adil.'],
    tradeNo: ['Belum cocok, coba lagi nanti.'],
    auctionWin: ['Yes, menang lelang!'],
  },
};

export interface Quip {
  seq: number;
  player: string;
  text: string;
}

/** Ubah event menjadi celetukan bot (maks 1 per event). Manusia tidak diberi celetukan. */
export function quipsFor(s: GameState, events: GameEvent[]): Quip[] {
  const out: Quip[] = [];
  const bot = (id: string | null) => (id ? s.players.find((p) => p.id === id && p.bot) : undefined);
  const say = (seq: number, id: string | null, kind: Kind) => {
    const p = bot(id);
    if (!p) return;
    const list = LINES[p.persona ?? 'seimbang'][kind];
    out.push({ seq, player: p.id, text: list[seq % list.length] });
  };
  for (const e of events) {
    switch (e.type) {
      case 'buy':
        if (e.seq % 2 === 0) say(e.seq, e.player, 'buy');
        break;
      case 'pay':
        if (e.reason === 'rent' && e.amount >= 50) {
          say(e.seq, e.to, 'getRent');
          if (!bot(e.to)) say(e.seq, e.from, 'payRent');
        }
        break;
      case 'jail':
        say(e.seq, e.player, 'jail');
        break;
      case 'win':
        say(e.seq, e.player, 'win');
        break;
      case 'bankrupt':
        say(e.seq, e.player, 'bankrupt');
        break;
      case 'dice':
        if (e.dice[0] === e.dice[1] && e.seq % 2 === 0) say(e.seq, e.player, 'double');
        break;
      case 'build':
        if (e.seq % 3 === 0) say(e.seq, e.player, 'build');
        break;
      case 'trade':
        say(e.seq, e.to, e.accepted ? 'tradeOk' : 'tradeNo');
        break;
      case 'auction':
        if (e.winner) say(e.seq, e.winner, 'auctionWin');
        break;
    }
  }
  return out;
}
