// Animasi khas tiap petak saat bidak mendarat (mis. Kupang = kuda Sandelwood berlari).
// File ini hanya data & pemetaan (tanpa three.js); bentuk 3D-nya ada di scene/TileAnims.tsx.

import { BOARD, tileName, type Theme } from '@monopoli/engine';
import { getRaw, setRaw } from './storage';

/** Lama satu animasi (ms). */
export const TILE_ANIM_MS = 3800;

export type AnimId =
  | 'horse'
  | 'bird'
  | 'deer'
  | 'volcano'
  | 'dancer'
  | 'ship'
  | 'fish'
  | 'oilpump'
  | 'equator'
  | 'boats'
  | 'bridge'
  | 'clock'
  | 'boatrace'
  | 'durian'
  | 'doors'
  | 'wayang'
  | 'becak'
  | 'fruit'
  | 'sharkcroc'
  | 'notes'
  | 'monkeys'
  | 'fireworks'
  | 'train'
  | 'plane'
  | 'metro'
  | 'lightning'
  | 'water'
  | 'coins'
  | 'diamond'
  | 'money'
  | 'bars'
  | 'siren'
  | 'steam'
  | 'rocket'
  | 'snow'
  | 'aurora'
  | 'rain'
  | 'desert'
  | 'blossom'
  | 'car'
  | 'stars'
  | 'bear'
  | 'flag';

export interface TileAnimInfo {
  id: AnimId;
  emoji: string;
  caption: string;
  /** warna utama opsional (mis. warna bulu burung, bunga) */
  color?: string;
  /** true = dari tileFx tema JSON pemain (keterangan ditampilkan apa adanya, tidak diterjemahkan) */
  own?: boolean;
}

/** Keterangan bawaan per animasi (dipakai kalau nama petak tidak punya keterangan khusus). */
const BASE: Record<AnimId, [string, string]> = {
  horse: ['🐎', 'Kuda berlari kencang'],
  bird: ['🐦', 'Burung terbang melintas'],
  deer: ['🦌', 'Rusa melompat'],
  volcano: ['🌋', 'Gunung berapi meletus'],
  dancer: ['💃', 'Penari berputar'],
  ship: ['⛵', 'Kapal berlayar'],
  fish: ['🐠', 'Ikan melompat dari laut'],
  oilpump: ['🛢️', 'Pompa minyak bekerja'],
  equator: ['☀️', 'Matahari tepat di atas kepala'],
  boats: ['🛶', 'Perahu pasar terapung'],
  bridge: ['🌉', 'Jembatan terangkat, kapal lewat'],
  clock: ['🕰️', 'Menara jam berdentang'],
  boatrace: ['🚣', 'Lomba perahu panjang'],
  durian: ['🍈', 'Durian jatuh & terbelah'],
  doors: ['🚪', 'Pintu-pintu terbuka'],
  wayang: ['🎭', 'Pertunjukan wayang'],
  becak: ['🛺', 'Becak melaju'],
  fruit: ['🍎', 'Buah berjatuhan dari pohon'],
  sharkcroc: ['🦈', 'Hiu & buaya beradu'],
  notes: ['🎶', 'Musik mengalun'],
  monkeys: ['🐒', 'Monyet melompat-lompat'],
  fireworks: ['🎆', 'Kembang api meriah'],
  train: ['🚆', 'Kereta melaju'],
  plane: ['✈️', 'Pesawat lepas landas'],
  metro: ['🚇', 'Kereta bawah tanah keluar terowongan'],
  lightning: ['⚡', 'Listrik menyambar'],
  water: ['💧', 'Air memancar'],
  coins: ['🪙', 'Koin berjatuhan'],
  diamond: ['💎', 'Permata berkilau'],
  money: ['💵', 'Uang beterbangan'],
  bars: ['⛓️', 'Jeruji penjara'],
  siren: ['🚨', 'Sirene polisi!'],
  steam: ['☕', 'Minuman hangat mengepul'],
  rocket: ['🚀', 'Roket meluncur'],
  snow: ['❄️', 'Salju turun'],
  aurora: ['🌌', 'Aurora menari di langit'],
  rain: ['🌧️', 'Hujan turun'],
  desert: ['🌵', 'Angin gurun berhembus'],
  blossom: ['🌸', 'Kelopak bunga berguguran'],
  car: ['🚗', 'Mobil melaju'],
  stars: ['✨', 'Lampu sorot & bintang'],
  bear: ['🐻', 'Beruang muncul'],
  flag: ['🚩', 'Bendera berkibar'],
};

type Entry = AnimId | [AnimId, string, string?];

/** Pemetaan per nama petak di semua tema bawaan. [animasi, keterangan, warna?] */
const BY_NAME: Record<string, Entry> = {
  // ===== Indonesia =====
  Merauke: ['deer', 'Rusa Taman Nasional Wasur melompat'],
  Jayapura: ['bird', 'Burung cendrawasih terbang', '#facc15'],
  Kupang: ['horse', 'Kuda Sandelwood NTT berlari'],
  Mataram: ['volcano', 'Gunung Rinjani bergemuruh'],
  Denpasar: ['dancer', 'Penari Legong berputar'],
  Makassar: ['ship', 'Kapal Pinisi berlayar'],
  Manado: ['fish', 'Ikan Bunaken melompat'],
  Balikpapan: ['oilpump', 'Pompa minyak Balikpapan'],
  Pontianak: ['equator', 'Hari tanpa bayangan di Tugu Khatulistiwa'],
  Banjarmasin: ['boats', 'Pasar Terapung Lok Baintan'],
  Palembang: ['bridge', 'Jembatan Ampera terangkat'],
  Padang: ['clock', 'Jam Gadang berdentang'],
  Pekanbaru: ['boatrace', 'Pacu Jalur di Sungai Kuantan'],
  Medan: ['durian', 'Durian Medan jatuh & terbelah'],
  Semarang: ['doors', 'Seribu pintu Lawang Sewu terbuka'],
  Solo: ['wayang', 'Pertunjukan wayang kulit'],
  Yogyakarta: ['becak', 'Becak keliling Malioboro'],
  Malang: ['fruit', 'Apel Malang berjatuhan', '#dc2626'],
  Surabaya: ['sharkcroc', 'Suro (hiu) & Boyo (buaya) beradu'],
  Bandung: ['notes', 'Angklung berbunyi'],
  'Ubud Bali': ['monkeys', 'Monyet Monkey Forest Ubud'],
  Jakarta: ['fireworks', 'Kembang api di atas Monas'],
  'Stasiun Gambir': ['train', 'Kereta berangkat dari Gambir'],
  'Pelabuhan Tanjung Priok': ['ship', 'Kapal sandar di Tanjung Priok'],
  'Bandara Soekarno-Hatta': ['plane', 'Pesawat lepas landas dari Soetta'],
  'Stasiun MRT Bundaran HI': ['metro', 'MRT Jakarta melaju'],
  PLN: ['lightning', 'Listrik PLN menyala'],
  PDAM: ['water', 'Air bersih PDAM mengalir'],
  'Pajak Penghasilan': ['coins', 'Setor pajak penghasilan'],
  'Pajak Barang Mewah': ['diamond', 'Pajak barang mewah'],
  'Penjara Nusakambangan': ['bars', 'Jeruji Nusakambangan'],
  'Istirahat di Warung': ['steam', 'Ngopi santai di warung'],

  // ===== Amerika =====
  Detroit: ['car', 'Mobil Motor City melaju'],
  Cleveland: ['notes', 'Rock and roll Cleveland'],
  Phoenix: ['desert', 'Gurun Arizona'],
  Denver: ['snow', 'Salju Pegunungan Rocky'],
  'Salt Lake City': ['snow', 'Salju Utah'],
  Atlanta: ['fireworks', 'Pesta Atlanta'],
  Nashville: ['notes', 'Musik country Nashville'],
  'New Orleans': ['notes', 'Jazz New Orleans'],
  Dallas: ['horse', 'Koboi Texas berkuda'],
  Houston: ['rocket', 'Roket NASA Houston meluncur'],
  Austin: ['notes', 'Musik live Austin'],
  Seattle: ['rain', 'Hujan khas Seattle'],
  Portland: ['rain', 'Gerimis Portland'],
  'San Diego': ['fish', 'Lumba-lumba San Diego'],
  Miami: ['fish', 'Pantai Miami'],
  'Las Vegas': ['stars', 'Lampu gemerlap Las Vegas'],
  Chicago: ['metro', 'Kereta layang Chicago'],
  Boston: ['ship', 'Pelabuhan Boston'],
  'Washington DC': ['flag', 'Bendera berkibar di Washington'],
  'Los Angeles': ['stars', 'Bintang Hollywood'],
  'San Francisco': ['bridge', 'Jembatan San Francisco'],
  'New York': ['fireworks', 'Kembang api New York'],
  'Reading Railroad': 'train',
  'Pennsylvania Railroad': 'train',
  'B&O Railroad': 'train',
  'Short Line': 'train',
  'Electric Company': 'lightning',
  'Water Works': 'water',
  'Income Tax': 'coins',
  'Luxury Tax': 'diamond',
  'Super Tax': 'diamond',
  Jail: 'bars',
  'Free Parking': ['car', 'Parkir gratis'],
  'Perusahaan Listrik': 'lightning',
  'Perusahaan Air': 'water',
  'Pajak Super': 'diamond',
  'Parkir Gratis': ['car', 'Parkir gratis'],

  // ===== Rusia =====
  Murmansk: ['aurora', 'Aurora di langit Murmansk'],
  Arkhangelsk: ['snow', 'Salju Arkhangelsk'],
  Yakutsk: ['snow', 'Kota terdingin di dunia'],
  Irkutsk: ['fish', 'Ikan Danau Baikal'],
  Vladivostok: ['ship', 'Pelabuhan Vladivostok'],
  Omsk: ['train', 'Kereta Siberia'],
  Novosibirsk: ['train', 'Kereta Trans-Siberia'],
  Krasnoyarsk: ['snow', 'Salju Krasnoyarsk'],
  Samara: ['rocket', 'Roket dari Samara'],
  Ufa: ['horse', 'Kuda Bashkir'],
  Perm: ['bear', 'Beruang Perm'],
  Rostov: ['ship', 'Kapal di Sungai Don'],
  Volgograd: ['flag', 'Bendera berkibar di Volgograd'],
  Sochi: ['snow', 'Salju pegunungan Sochi'],
  Kazan: ['dancer', 'Tarian Tatar'],
  'Nizhny Novgorod': ['ship', 'Kapal di Sungai Volga'],
  Yekaterinburg: ['train', 'Kereta Ural'],
  Kaliningrad: ['ship', 'Pelabuhan Baltik'],
  Novgorod: ['clock', 'Lonceng Novgorod'],
  'Sankt Peterburg': ['bridge', 'Jembatan angkat Sankt Peterburg'],
  Arbat: ['notes', 'Musisi jalanan Arbat'],
  'Lapangan Merah': ['fireworks', 'Kembang api Lapangan Merah'],
  'Trans-Siberia': 'train',
  'Metro Moskwa': 'metro',
  'Gazprom Energi': ['lightning', 'Energi Gazprom'],
  'Air Volga': 'water',
  'Tahanan Siberia': ['snow', 'Tahanan bersalju Siberia'],
  'Rehat Teh Samovar': ['steam', 'Teh hangat samovar'],

  // ===== Jepang =====
  Naha: ['fish', 'Laut biru Okinawa'],
  Kagoshima: ['volcano', 'Sakurajima meletus'],
  Sendai: ['fireworks', 'Festival Tanabata Sendai'],
  Niigata: ['snow', 'Salju Niigata'],
  Kanazawa: ['coins', 'Daun emas Kanazawa'],
  Hiroshima: ['bird', 'Burung merpati perdamaian', '#f8fafc'],
  Okayama: ['fruit', 'Buah persik Okayama', '#fda4af'],
  Kobe: ['ship', 'Pelabuhan Kobe'],
  Fukuoka: ['fireworks', 'Festival Fukuoka'],
  Nagasaki: ['ship', 'Pelabuhan Nagasaki'],
  Kumamoto: ['bear', 'Beruang Kumamoto'],
  Sapporo: ['snow', 'Festival salju Sapporo'],
  Hakodate: ['fish', 'Pasar ikan Hakodate'],
  Nagoya: ['clock', 'Jam kota Nagoya'],
  Nara: ['deer', 'Rusa Taman Nara'],
  Kyoto: ['blossom', 'Sakura Kyoto berguguran'],
  Osaka: ['fireworks', 'Kembang api Osaka'],
  Yokohama: ['ship', 'Pelabuhan Yokohama'],
  Harajuku: ['notes', 'Musik jalanan Harajuku'],
  Akihabara: ['stars', 'Lampu neon Akihabara'],
  Ginza: ['coins', 'Belanja mewah Ginza'],
  Shibuya: ['car', 'Persimpangan Shibuya'],
  'Shinkansen Tokyo': ['train', 'Shinkansen melesat'],
  'Stasiun Shinjuku': 'metro',
  'JR Osaka': 'train',
  'Bandara Narita': 'plane',
  'TEPCO Listrik': 'lightning',
  'Air Gunung Fuji': 'water',
  'Pajak Mewah': 'diamond',
  'Onsen Gratis': ['steam', 'Berendam di onsen'],

  // ===== Negeri Ninja =====
  'Dusun Lumut': ['blossom', 'Lumut & bunga liar', '#86efac'],
  'Dusun Jerami': ['bird', 'Burung pipit di sawah', '#facc15'],
  'Kampung Bambu': ['blossom', 'Bambu bergoyang', '#4ade80'],
  'Kampung Kunang': ['stars', 'Kunang-kunang menyala'],
  'Kampung Lentera': ['fireworks', 'Festival lentera'],
  'Lembah Gema': 'notes',
  'Jembatan Gantung': ['bird', 'Elang melintas', '#a8a29e'],
  'Hutan Bayangan': ['bird', 'Burung hantu hutan', '#334155'],
  'Danau Cermin': ['fish', 'Ikan koi di danau'],
  'Air Terjun Naga': ['water', 'Air terjun mengalir'],
  'Kuil Angin': ['blossom', 'Sakura tertiup angin', '#f9a8d4'],
  'Pasar Gurun': 'desert',
  'Oasis Pasir': ['water', 'Air oasis'],
  'Benteng Pasir Merah': ['desert', 'Badai pasir'],
  'Akademi Shinobi': ['stars', 'Bintang shuriken berkilau'],
  'Lapangan Latihan': ['stars', 'Latihan ninja'],
  'Perpustakaan Gulungan': 'notes',
  'Klan Rubah': ['fireworks', 'Api rubah biru'],
  'Klan Elang': ['bird', 'Elang klan terbang', '#78350f'],
  'Klan Serigala': ['lightning', 'Lolongan di malam badai'],
  'Istana Awan': ['rain', 'Kabut di atas awan'],
  'Benteng Bulan Perak': ['fireworks', 'Pesta di Benteng Bulan Perak'],
  'Menara Petir': 'lightning',
  'Mata Air Suci': 'water',
  'Pajak Misi': 'coins',
  'Upeti Daimyo': 'diamond',
  'Penjara Hozuki': 'bars',
  'Kedai Teh Sakura': ['steam', 'Teh hangat di kedai'],
  'Gerbang Fajar': 'money',
  'Tertangkap Penjaga!': 'siren',

  // ===== Inggris =====
  'Old Kent Road': 'car',
  Whitechapel: ['clock', 'Lonceng Whitechapel'],
  'The Angel Islington': 'notes',
  'Euston Road': 'car',
  'Pentonville Road': 'car',
  'Pall Mall': ['horse', 'Kuda pengawal kerajaan'],
  Whitehall: ['flag', 'Bendera berkibar di Whitehall'],
  'Northumberland Ave': 'car',
  'Bow Street': ['clock', 'Lonceng Bow Street'],
  'Marlborough Street': ['horse', 'Kereta kuda London'],
  'Vine Street': 'blossom',
  Strand: ['rain', 'Gerimis London'],
  'Fleet Street': 'notes',
  'Trafalgar Square': ['bird', 'Merpati Trafalgar', '#94a3b8'],
  'Leicester Square': ['stars', 'Premier film Leicester Square'],
  'Coventry Street': 'car',
  Piccadilly: ['stars', 'Lampu Piccadilly Circus'],
  'Regent Street': 'coins',
  'Oxford Street': 'coins',
  'Bond Street': 'diamond',
  'Park Lane': 'blossom',
  Mayfair: ['fireworks', 'Pesta Mayfair'],
  "King's Cross": 'train',
  Marylebone: 'train',
  'Fenchurch St': 'train',
  'Liverpool St': 'metro',
};

/** Tebak dari kata kunci (untuk tema kustom buatan Studio Tema). */
const KEYWORDS: Array<[RegExp, AnimId]> = [
  [/bandara|airport|narita|udara/i, 'plane'],
  [/pelabuhan|harbou?r|port\b|dermaga/i, 'ship'],
  [/mrt|metro|subway|bawah tanah|underground|tube/i, 'metro'],
  [/stasiun|station|railroad|rail|kereta|shinkansen|gerbang/i, 'train'],
  [/listrik|electric|power|energi|pln/i, 'lightning'],
  [/air|water|pdam/i, 'water'],
  [/gunung|volcano|merapi|bromo|fuji/i, 'volcano'],
  [/pantai|beach|laut|sea|ocean|bahari/i, 'fish'],
  [/salju|snow|es\b|ice/i, 'snow'],
  [/pasir|desert|gurun/i, 'desert'],
  [/hujan|rain/i, 'rain'],
  [/bunga|flower|sakura|taman|garden|park/i, 'blossom'],
  [/musik|music|jazz|rock/i, 'notes'],
  [/kuda|horse|kandang/i, 'horse'],
  [/jembatan|bridge/i, 'bridge'],
  [/pura|candi|temple|kuil/i, 'dancer'],
  [/pajak mewah|luxury|mewah/i, 'diamond'],
  [/pajak|tax/i, 'coins'],
];

/** Petak properti tanpa data khusus: bergiliran dari daftar ini supaya tiap petak tetap punya animasi. */
const FALLBACK: AnimId[] = ['fireworks', 'bird', 'stars', 'blossom', 'notes', 'car', 'fish', 'ship', 'flag', 'deer', 'fruit', 'clock'];

const expand = (e: Entry): TileAnimInfo => {
  const [id, caption, color] = typeof e === 'string' ? [e] : e;
  return { id, emoji: BASE[id][0], caption: caption ?? BASE[id][1], color };
};

/** Animasi untuk petak `i` di tema ini. null = petak tanpa animasi khusus (Kesempatan/Dana Umum sudah punya animasi kartu). */
export function tileAnimFor(theme: Theme, i: number): TileAnimInfo | null {
  const t = BOARD[i];
  // efek kustom dari tema JSON pemain: { "12": { "anim": "fireworks", "emoji": "🎆", "caption": "Pesta!" } }
  const own = theme.tileFx?.[String(i)];
  if (own) {
    const id = own.anim && own.anim in BASE ? (own.anim as AnimId) : null;
    const base = id ? BASE[id] : null;
    if (id || own.emoji) return { id: id ?? 'stars', emoji: own.emoji ?? base![0], caption: own.caption ?? base?.[1] ?? '', color: own.color, own: true };
  }
  if (t.kind === 'chance' || t.kind === 'community') return null;
  const name = tileName(theme, i);
  const hit = BY_NAME[name];
  if (hit) return expand(hit);
  // sudut papan: selalu sama apa pun nama temanya
  if (t.kind === 'go') return expand(['money', `Gaji dari ${name}`]);
  if (t.kind === 'jail') return expand(['bars', name]);
  if (t.kind === 'parking') return expand(['steam', name]);
  if (t.kind === 'gotojail') return expand(['siren', name]);
  for (const [re, id] of KEYWORDS) if (re.test(name)) return expand([id, `${BASE[id][1]} — ${name}`]);
  if (t.kind === 'station') return expand('train');
  if (t.kind === 'utility') return expand(t.slot === 0 ? 'lightning' : 'water');
  if (t.kind === 'tax') return expand(t.slot === 0 ? 'coins' : 'diamond');
  return expand(FALLBACK[i % FALLBACK.length]);
}

/** Sama dengan tileAnimFor — nama pendek untuk UI. */
export const tileAnimAt = tileAnimFor;

/** Semua id animasi (untuk galeri/uji). */
export const ALL_ANIMS = Object.keys(BASE) as AnimId[];
export const ANIM_LABELS = BASE;

/** Putar ulang animasi petak dari mana saja (mis. tombol di kartu akta). Ditangkap scene 3D. */
export const PLAY_ANIM_EVENT = 'monopoli:tile-anim';
export function playTileAnim(tile: number) {
  dispatchEvent(new CustomEvent(PLAY_ANIM_EVENT, { detail: tile }));
}

// ---------- pengaturan nyala/mati (per perangkat) ----------
const KEY = 'monopoli.tileAnim';
let on = (() => {
  const v = getRaw(KEY);
  if (v !== null) return v === '1';
  try {
    return !matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return true;
  }
})();
export const tileAnimOn = () => on;
export function setTileAnimOn(v: boolean) {
  on = v;
  setRaw(KEY, v ? '1' : '0');
}
