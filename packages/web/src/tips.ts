// Tips tutorial kontekstual: muncul sekali saat situasinya pertama kali terjadi. Bisa dimatikan di Pengaturan.

import { BOARD, actorId, ownsGroup, GROUP_COUNT, type GameState } from '@monopoli/engine';
import { getJSON, getRaw, setJSON, setRaw } from './storage';

const SEEN = 'monopoli.tipsSeen';
const OFF = 'monopoli.tipsOff';

export interface Tip {
  id: string;
  title: string;
  text: string;
}

export const TIPS: Record<string, Tip> = {
  start: { id: 'start', title: 'Selamat datang!', text: 'Tujuanmu: jadi pemain terakhir yang tidak bangkrut (atau terkaya saat batas ronde). Klik petak mana saja di papan untuk melihat harga & sewanya.' },
  roll: { id: 'roll', title: 'Giliranmu', text: 'Tekan "Lempar dadu" atau Spasi. Dapat angka kembar (double) = lempar lagi, tapi 3× double berturut-turut masuk penjara.' },
  buy: { id: 'buy', title: 'Beli atau lelang', text: 'Petak ini belum ada pemiliknya. Beli supaya pemain lain bayar sewa padamu — atau tolak dan petak dilelang ke semua pemain.' },
  set: { id: 'set', title: 'Set warna lengkap!', text: 'Kamu punya semua petak satu warna: sewanya 2×, dan sekarang bisa membangun rumah. Buka Asetku (ikon dompet) lalu bangun merata.' },
  jail: { id: 'jail', title: 'Di penjara', text: 'Keluar dengan membayar denda, memakai kartu bebas penjara, atau mencoba lempar double. Kamu tetap bisa menagih sewa, membangun, dan tukar.' },
  debt: { id: 'debt', title: 'Uang tidak cukup', text: 'Jual bangunan (setengah harga) atau gadai properti di Asetku, atau tawarkan tukar. Bangkrut hanya kalau semuanya tetap tidak cukup.' },
  auction: { id: 'auction', title: 'Lelang', text: 'Semua pemain bergiliran menawar. Tawar lebih tinggi atau tekan Lewat. Penawar tertinggi terakhir membayar dan mendapatkan petaknya.' },
  trade: { id: 'trade', title: 'Tawaran tukar', text: 'Ada yang mengajakmu bertukar properti/uang. Terima, tolak, atau ajukan tawaran balik dengan syaratmu sendiri.' },
  build: { id: 'build', title: 'Bangun di antara giliran', text: 'Sesuai aturan resmi, kamu boleh membangun, menggadai, dan menawar tukar kapan saja di antara giliran — tidak harus menunggu giliranmu.' },
};

export const tipsOn = () => getRaw(OFF) !== '1';
export function setTipsOn(v: boolean) {
  setRaw(OFF, v ? '0' : '1');
  if (v) setJSON(SEEN, []); // nyalakan lagi = tampilkan ulang dari awal
}
const seen = () => new Set(getJSON<string[]>(SEEN, []));
export function markTip(id: string) {
  const s = seen();
  s.add(id);
  setJSON(SEEN, [...s]);
}

/** Tip yang cocok untuk keadaan sekarang dan belum pernah dilihat (null = tidak ada). */
export function pickTip(state: GameState, me: string | null): Tip | null {
  if (!tipsOn() || !me || state.phase === 'gameover') return null;
  const s = seen();
  const p = state.players.find((x) => x.id === me);
  if (!p || p.bankrupt) return null;
  const mine = actorId(state) === me;
  const cand: string[] = [];
  if (state.trade?.to === me) cand.push('trade');
  if (state.phase === 'auction' && mine) cand.push('auction');
  if (state.phase === 'debt' && mine) cand.push('debt');
  if (state.phase === 'buy' && mine && BOARD[p.pos].price) cand.push('buy');
  if (p.inJail && mine) cand.push('jail');
  for (let g = 0; g < GROUP_COUNT; g++) if (ownsGroup(state, me, g)) cand.push('set');
  if (s.has('set') && !mine && state.phase !== 'auction') cand.push('build');
  if (mine && state.phase === 'roll' && !state.rolled) cand.push('start', 'roll');
  const id = cand.find((c) => !s.has(c));
  return id ? TIPS[id] : null;
}
