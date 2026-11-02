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
  { id: 'c1', text: 'Maju ke START. Terima {m:200}.', effect: { kind: 'advance', to: 0 } },
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
  { id: 'd1', text: 'Maju ke START. Terima {m:200}.', effect: { kind: 'advance', to: 0 } },
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
  { id: 'd15', text: 'Juara kontes kecantikan. Terima {m:10}.', effect: { kind: 'money', amount: 10 } },
  { id: 'd16', text: 'Dapat warisan. Terima {m:100}.', effect: { kind: 'money', amount: 100 } },
];
