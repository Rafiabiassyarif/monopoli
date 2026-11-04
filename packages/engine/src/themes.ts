// Sistem tema. Tema = data murni: nama petak, mata uang, warna, gaya visual 3D.
// Tambah tema baru cukup tambah objek di THEMES (atau impor JSON lewat editor di UI).

import { BOARD } from './board';
import { customDecksErrors, type CustomDecks } from './cards';

export interface Theme {
  id: string;
  name: string;
  flag: string; // emoji
  description: string;
  /**
   * multiplier = nilai 1 satuan engine dalam mata uang asli (modal awal = 1500 satuan).
   * compact = tulis ringkas sesuai bahasanya (Rp400 jt, Rp1,5 M, $400K, ¥4000万, 40 млн ₽).
   * symbolAfter = simbol di belakang angka (₽, 両). suffix = akhiran lama (tema kustom versi lama).
   */
  currency: { symbol: string; suffix?: string; multiplier: number; locale: string; compact?: boolean; symbolAfter?: boolean };
  corners: { go: string; jail: string; parking: string; gotojail: string };
  deckNames: { chance: string; community: string };
  /** 22 nama properti, urut posisi papan */
  properties: string[];
  stations: string[]; // 4
  utilities: string[]; // 2
  taxes: string[]; // 2
  /** 8 warna grup */
  groupColors: string[];
  tokens: string[]; // nama bidak (6)
  visual: {
    sky: [string, string]; // gradasi atas, bawah
    table: string;
    board: string;
    boardCenter: string;
    accent: string;
    /** gaya bangunan di sekitar papan */
    buildings: 'modern' | 'classic' | 'onion' | 'pagoda' | 'ninja' | 'tropical';
    /** ikon besar di tengah papan (bawaan: koin emas) */
    landmark?: LandmarkKind;
    fog: string;
    lightColor: string;
  };
  /** opsional: ganti teks kartu bawaan per id (c1..c16, d1..d16) */
  cards?: Record<string, string>;
  /**
   * opsional: tumpukan kartu kustom sepenuhnya — teks + efek buatan sendiri, mengganti kartu bawaan.
   * Efek: advance{to}, nearest{target}, money{amount}, back{steps}, jail, jailFree, repairs{house,hotel}, eachPlayer{amount}.
   */
  decks?: CustomDecks;
  /**
   * opsional: efek/animasi saat bidak mendarat di petak (kunci = nomor petak 0..39).
   * anim = id animasi bawaan (mis. 'fireworks', 'ship', 'snow'); emoji & caption bebas.
   */
  tileFx?: Record<string, TileFx>;
}

export interface TileFx {
  anim?: string;
  emoji?: string;
  caption?: string;
  color?: string;
}

/** Ikon tengah papan yang bisa dipilih (tema bawaan & kustom). */
export const LANDMARKS = ['coin', 'monas', 'liberty', 'basil', 'pagoda', 'bigben', 'castle', 'eiffel', 'pyramid', 'skyscraper'] as const;
export type LandmarkKind = (typeof LANDMARKS)[number];

export const THEMES: Theme[] = [
  {
    id: 'indonesia',
    name: 'Indonesia',
    flag: '🇮🇩',
    description: 'Keliling Nusantara dari Sabang sampai Merauke.',
    // 1 satuan = Rp1 juta → modal Rp1,5 M, Merauke Rp60 jt, Jakarta Rp400 jt, gaji START Rp200 jt
    currency: { symbol: 'Rp', multiplier: 1_000_000, locale: 'id-ID', compact: true },
    corners: { go: 'MULAI', jail: 'Penjara Nusakambangan', parking: 'Istirahat di Warung', gotojail: 'Ditangkap!' },
    deckNames: { chance: 'Kesempatan', community: 'Dana Umum' },
    properties: [
      'Merauke', 'Jayapura',
      'Kupang', 'Mataram', 'Denpasar',
      'Makassar', 'Manado', 'Balikpapan',
      'Pontianak', 'Banjarmasin', 'Palembang',
      'Padang', 'Pekanbaru', 'Medan',
      'Semarang', 'Solo', 'Yogyakarta',
      'Malang', 'Surabaya', 'Bandung',
      'Ubud Bali', 'Jakarta',
    ],
    stations: ['Stasiun Gambir', 'Pelabuhan Tanjung Priok', 'Bandara Soekarno-Hatta', 'Stasiun MRT Bundaran HI'],
    utilities: ['PLN', 'PDAM'],
    taxes: ['Pajak Penghasilan', 'Pajak Barang Mewah'],
    groupColors: ['#8d5a3b', '#7fd3f7', '#d94f9b', '#f39c3d', '#e53935', '#f9d71c', '#2eaa5c', '#1e4fd8'],
    tokens: ['Becak', 'Kapal Pinisi', 'Komodo', 'Bajaj', 'Wayang', 'Rumah Gadang'],
    visual: {
      sky: ['#ff9a5a', '#2b1e5a'],
      table: '#3b2416',
      board: '#f3ead2',
      boardCenter: '#c41e2a',
      accent: '#e53935',
      buildings: 'tropical',
      landmark: 'monas',
      fog: '#4a2a4a',
      lightColor: '#ffe2b8',
    },
  },
  {
    id: 'usa',
    name: 'Amerika',
    flag: '🇺🇸',
    description: 'Klasik Atlantic City sampai gedung pencakar langit New York.',
    // nilai setara Rupiah (kurs pajak Kemenkeu 28 Okt–3 Nov 2026: $1 = Rp18.032) → 1 satuan (Rp1 jt) ≈ $55,5
    currency: { symbol: '$', multiplier: 55.5, locale: 'en-US', compact: true },
    corners: { go: 'MULAI', jail: 'Penjara', parking: 'Parkir Gratis', gotojail: 'Masuk Penjara!' },
    deckNames: { chance: 'Kesempatan', community: 'Dana Umum' },
    properties: [
      'Detroit', 'Cleveland',
      'Phoenix', 'Denver', 'Salt Lake City',
      'Atlanta', 'Nashville', 'New Orleans',
      'Dallas', 'Houston', 'Austin',
      'Seattle', 'Portland', 'San Diego',
      'Miami', 'Las Vegas', 'Chicago',
      'Boston', 'Washington DC', 'Los Angeles',
      'San Francisco', 'New York',
    ],
    stations: ['Reading Railroad', 'Pennsylvania Railroad', 'B&O Railroad', 'Short Line'],
    utilities: ['Perusahaan Listrik', 'Perusahaan Air'],
    taxes: ['Pajak Penghasilan', 'Pajak Barang Mewah'],
    groupColors: ['#8b5a2b', '#9fd8f5', '#d63c94', '#f7941d', '#ed1b24', '#fef200', '#1fb25a', '#0072bb'],
    tokens: ['Mobil Klasik', 'Topi', 'Anjing', 'Kapal', 'Sepatu Bot', 'Sepeda'],
    visual: {
      sky: ['#9ed4ff', '#1b2a52'],
      table: '#1e3524',
      board: '#d8ecd6',
      boardCenter: '#c8102e',
      accent: '#0a3161',
      buildings: 'modern',
      landmark: 'liberty',
      fog: '#24345c',
      lightColor: '#ffffff',
    },
  },
  {
    id: 'russia',
    name: 'Rusia',
    flag: '🇷🇺',
    description: 'Dari Vladivostok ke Lapangan Merah, ditemani kubah bawang.',
    // nilai setara Rupiah (kurs pasar ±Rp216 per rubel) → 1 satuan (Rp1 jt) ≈ 4.630 ₽
    currency: { symbol: '₽', multiplier: 4_630, locale: 'en-US', compact: true, symbolAfter: true },
    corners: { go: 'MULAI', jail: 'Tahanan Siberia', parking: 'Rehat Teh Samovar', gotojail: 'Ke Siberia!' },
    deckNames: { chance: 'Nasib', community: 'Kas Rakyat' },
    properties: [
      'Murmansk', 'Arkhangelsk',
      'Yakutsk', 'Irkutsk', 'Vladivostok',
      'Omsk', 'Novosibirsk', 'Krasnoyarsk',
      'Samara', 'Ufa', 'Perm',
      'Rostov', 'Volgograd', 'Sochi',
      'Kazan', 'Nizhny Novgorod', 'Yekaterinburg',
      'Kaliningrad', 'Novgorod', 'Sankt Peterburg',
      'Arbat', 'Lapangan Merah',
    ],
    stations: ['Stasiun Leningradsky', 'Stasiun Kazansky', 'Trans-Siberia', 'Metro Moskwa'],
    utilities: ['Gazprom Energi', 'Air Volga'],
    taxes: ['Pajak Negara', 'Pajak Kemewahan'],
    groupColors: ['#7a4b2a', '#8fd0ea', '#b8338a', '#e07b28', '#c62828', '#e6c229', '#2a8a52', '#1a3b9c'],
    tokens: ['Matryoshka', 'Beruang', 'Balalaika', 'Ushanka', 'Samovar', 'Troika'],
    visual: {
      sky: ['#cfe3ff', '#2a3350'],
      table: '#2b1d1d',
      board: '#f2efe8',
      boardCenter: '#1c3faa',
      accent: '#d52b1e',
      buildings: 'onion',
      landmark: 'basil',
      fog: '#9aa6c0',
      lightColor: '#eaf2ff',
    },
  },
  {
    id: 'japan',
    name: 'Jepang',
    flag: '🇯🇵',
    description: 'Sakura, kuil, dan lampu neon Tokyo.',
    // nilai setara Rupiah (kurs pajak Kemenkeu 28 Okt–3 Nov 2026: ¥100 = Rp11.435) → 1 satuan (Rp1 jt) ≈ ¥8.750
    currency: { symbol: '¥', multiplier: 8_750, locale: 'en-US', compact: true },
    corners: { go: 'MULAI', jail: 'Penjara', parking: 'Onsen Gratis', gotojail: 'Ke Penjara!' },
    deckNames: { chance: 'Omikuji', community: 'Kas Desa' },
    properties: [
      'Naha', 'Kagoshima',
      'Sendai', 'Niigata', 'Kanazawa',
      'Hiroshima', 'Okayama', 'Kobe',
      'Fukuoka', 'Nagasaki', 'Kumamoto',
      'Sapporo', 'Hakodate', 'Nagoya',
      'Nara', 'Kyoto', 'Osaka',
      'Yokohama', 'Harajuku', 'Akihabara',
      'Ginza', 'Shibuya',
    ],
    stations: ['Shinkansen Tokyo', 'Stasiun Shinjuku', 'JR Osaka', 'Bandara Narita'],
    utilities: ['TEPCO Listrik', 'Air Gunung Fuji'],
    taxes: ['Pajak Penghasilan', 'Pajak Mewah'],
    groupColors: ['#8a5a44', '#9ad7ef', '#f06ea9', '#f39a3b', '#d7263d', '#f5d547', '#3fae6a', '#264bbf'],
    tokens: ['Maneki Neko', 'Shinkansen', 'Daruma', 'Torii', 'Koi', 'Katana'],
    visual: {
      sky: ['#ffc6d9', '#2a1f4a'],
      table: '#2a1a22',
      board: '#fbf3ea',
      boardCenter: '#bc002d',
      accent: '#bc002d',
      buildings: 'pagoda',
      landmark: 'pagoda',
      fog: '#5a3b5e',
      lightColor: '#ffe9f0',
    },
  },
  {
    id: 'ninja',
    name: 'Negeri Ninja',
    flag: '🥷',
    description: 'Dunia ninja orisinal: dari dusun kaki gunung sampai Benteng Bulan Perak.',
    // 1 satuan = 1.000 ryō → modal 1,5 jt 両
    currency: { symbol: '両', multiplier: 1_000, locale: 'en-US', compact: true, symbolAfter: true },
    corners: { go: 'Gerbang Fajar', jail: 'Sel Bambu', parking: 'Kedai Teh Sakura', gotojail: 'Tertangkap Penjaga!' },
    deckNames: { chance: 'Gulungan Misi', community: 'Kas Klan' },
    properties: [
      'Dusun Lumut', 'Dusun Jerami',
      'Kampung Bambu', 'Kampung Kunang', 'Kampung Lentera',
      'Lembah Gema', 'Jembatan Gantung', 'Hutan Bayangan',
      'Danau Cermin', 'Air Terjun Naga', 'Kuil Angin',
      'Pasar Gurun', 'Oasis Pasir', 'Benteng Pasir Merah',
      'Akademi Shinobi', 'Lapangan Latihan', 'Perpustakaan Gulungan',
      'Klan Rubah', 'Klan Elang', 'Klan Serigala',
      'Istana Awan', 'Benteng Bulan Perak',
    ],
    stations: ['Gerbang Utara', 'Gerbang Timur', 'Gerbang Selatan', 'Gerbang Barat'],
    utilities: ['Menara Petir', 'Mata Air Suci'],
    taxes: ['Pajak Misi', 'Upeti Shogun'],
    groupColors: ['#6b4a2b', '#62c3e6', '#9b4fd1', '#ff8a1c', '#d32f2f', '#f2c400', '#2e8b57', '#1e3f99'],
    tokens: ['Kunai', 'Shuriken', 'Katak Batu', 'Gulungan', 'Lentera', 'Topeng Rubah'],
    visual: {
      sky: ['#ffb36b', '#3b2a1a'],
      table: '#2c2215',
      board: '#efe2c0',
      boardCenter: '#e8661c',
      accent: '#ff7a1a',
      buildings: 'ninja',
      landmark: 'castle',
      fog: '#5a3a1e',
      lightColor: '#ffd9a8',
    },
  },
  {
    id: 'uk',
    name: 'Inggris',
    flag: '🇬🇧',
    description: 'Versi London klasik: Old Kent Road sampai Mayfair.',
    // nilai setara Rupiah (kurs pajak Kemenkeu 28 Okt–3 Nov 2026: £1 = Rp24.110) → 1 satuan (Rp1 jt) ≈ £41,5
    currency: { symbol: '£', multiplier: 41.5, locale: 'en-US', compact: true },
    corners: { go: 'MULAI', jail: 'Penjara', parking: 'Parkir Gratis', gotojail: 'Masuk Penjara!' },
    deckNames: { chance: 'Kesempatan', community: 'Dana Umum' },
    properties: [
      'Old Kent Road', 'Whitechapel',
      'The Angel Islington', 'Euston Road', 'Pentonville Road',
      'Pall Mall', 'Whitehall', 'Northumberland Ave',
      'Bow Street', 'Marlborough Street', 'Vine Street',
      'Strand', 'Fleet Street', 'Trafalgar Square',
      'Leicester Square', 'Coventry Street', 'Piccadilly',
      'Regent Street', 'Oxford Street', 'Bond Street',
      'Park Lane', 'Mayfair',
    ],
    stations: ["King's Cross", 'Marylebone', 'Fenchurch St', 'Liverpool St'],
    utilities: ['Perusahaan Listrik', 'Perusahaan Air'],
    taxes: ['Pajak Penghasilan', 'Pajak Super'],
    groupColors: ['#7b4b2a', '#a7dcf2', '#d0378f', '#f4902a', '#e3242b', '#ffe14d', '#16a34a', '#1d4ed8'],
    tokens: ['Bus Tingkat', 'Topi Bowler', 'Payung', 'Teko Teh', 'Corgi', 'Mahkota'],
    visual: {
      sky: ['#b8c6d6', '#28303f'],
      table: '#1c2b22',
      board: '#e6efe1',
      boardCenter: '#012169',
      accent: '#c8102e',
      buildings: 'classic',
      landmark: 'bigben',
      fog: '#6b7686',
      lightColor: '#f3f6ff',
    },
  },
];

/** id lama yang sudah diganti (simpanan/room lama tetap terbuka dengan tema penggantinya) */
const RENAMED: Record<string, string> = { konoha: 'ninja' };
export const getTheme = (id: string, custom: Theme[] = []) => {
  const want = RENAMED[id] ?? id;
  return [...custom, ...THEMES].find((t) => t.id === want) ?? THEMES[0];
};

/** Nama petak ke-i menurut tema. */
export function tileName(theme: Theme, i: number): string {
  const t = BOARD[i];
  switch (t.kind) {
    case 'property':
      return theme.properties[t.slot] ?? `Properti ${t.slot + 1}`;
    case 'station':
      return theme.stations[t.slot] ?? `Stasiun ${t.slot + 1}`;
    case 'utility':
      return theme.utilities[t.slot] ?? `Utilitas ${t.slot + 1}`;
    case 'tax':
      return theme.taxes[t.slot] ?? 'Pajak';
    case 'chance':
      return theme.deckNames.chance;
    case 'community':
      return theme.deckNames.community;
    case 'go':
      return theme.corners.go;
    case 'jail':
      return theme.corners.jail;
    case 'parking':
      return theme.corners.parking;
    case 'gotojail':
      return theme.corners.gotojail;
  }
}

const fmtCache = new Map<string, Intl.NumberFormat>();
/** true kalau multiplier berbentuk 10^n (Rp1 jt, $1K): nilai bisa ditampilkan tepat. */
const roundMult = (m: number) => Math.abs(Math.log10(m) - Math.round(Math.log10(m))) < 1e-9;

function compactFmt(locale: string, approx = false) {
  const key = `${locale}|${approx}`;
  let f = fmtCache.get(key);
  if (!f) {
    // tepat: 4 desimal cukup (satuan engine bilangan bulat), mis. Rp1,537 M
    // kurs (multiplier tidak bulat): 3 angka penting supaya rapi, mis. $83,2K bukan $83,2513K
    const o: Intl.NumberFormatOptions = approx ? { notation: 'compact', maximumSignificantDigits: 3 } : { notation: 'compact', maximumFractionDigits: 4 };
    try {
      f = new Intl.NumberFormat(locale, o);
    } catch {
      f = new Intl.NumberFormat('id-ID', o);
    }
    fmtCache.set(key, f);
  }
  return f;
}

export function formatMoney(theme: Theme, units: number): string {
  const c = theme.currency;
  if (c.compact) {
    const sign = units < 0 ? '−' : '';
    const n = compactFmt(c.locale, !roundMult(c.multiplier)).format(Math.abs(units) * c.multiplier);
    return c.symbolAfter ? `${sign}${n} ${c.symbol}` : `${sign}${c.symbol}${n}`;
  }
  let n: string;
  try {
    n = Math.round(units * c.multiplier).toLocaleString(c.locale);
  } catch {
    n = Math.round(units * c.multiplier).toLocaleString('id-ID'); // locale tema kustom tidak dikenal
  }
  return `${c.symbol}${n}${units === 0 ? '' : c.suffix ?? ''}`;
}

/**
 * Label satuan untuk kolom isian uang (nilai yang diketik = satuan engine).
 * Contoh: Indonesia → { before: 'Rp', after: 'jt' }, Jepang → { before: '¥', after: '×10万' }.
 */
export function moneyUnit(theme: Theme): { before: string; after: string; step: number } {
  const c = theme.currency;
  if (!c.compact) return { before: c.symbol, after: (c.suffix ?? '').trim(), step: c.multiplier };
  if (!roundMult(c.multiplier)) {
    // multiplier hasil kurs (mis. $55,5): isian dalam ribuan (K) dengan langkah pecahan
    const scale = 10 ** (3 * Math.max(1, Math.floor(Math.log10(c.multiplier * 100) / 3)));
    const unit = compactFmt(c.locale).format(scale).replace(/\u00a0/g, ' ').replace(/^1\s*/, '');
    const step = c.multiplier / scale;
    return c.symbolAfter ? { before: '', after: `${unit} ${c.symbol}`.trim(), step } : { before: c.symbol, after: unit, step };
  }
  const one = compactFmt(c.locale).format(c.multiplier).replace(/\u00a0/g, ' ');
  const m = /^1\s*([^\d].*)$/.exec(one);
  const unit = m ? m[1].trim() : `×${one}`;
  return c.symbolAfter ? { before: '', after: `${unit} ${c.symbol}`.trim(), step: 1 } : { before: c.symbol, after: unit, step: 1 };
}

/** Isi token {m:N}, {m:go} (gaji START sesuai aturan main) dan {t:i} di teks kartu. */
export function cardText(theme: Theme, id: string, fallback: string, goSalary = 200): string {
  const raw = theme.cards?.[id] ?? fallback;
  return raw
    .replace(/\{m:go\}/g, () => formatMoney(theme, goSalary))
    .replace(/\{m:(\d+)\}/g, (_, n) => formatMoney(theme, +n))
    .replace(/\{t:(\d+)\}/g, (_, i) => tileName(theme, +i));
}

/** Validasi tema kustom dari JSON (trust boundary: input user). Mengembalikan daftar error. */
export function validateTheme(x: unknown): string[] {
  const e: string[] = [];
  const t = x as Partial<Theme>;
  if (!t || typeof t !== 'object') return ['Bukan objek JSON'];
  const str = (v: unknown) => typeof v === 'string' && v.length > 0 && v.length <= 60;
  const list = (v: unknown, n: number, name: string) => {
    if (!Array.isArray(v) || v.length !== n || !v.every(str)) e.push(`${name} harus ${n} teks (maks 60 huruf)`);
  };
  if (!str(t.id) || !/^[a-z0-9-]+$/.test(t.id!)) e.push('id wajib huruf kecil/angka/-');
  if (!str(t.name)) e.push('name wajib');
  list(t.properties, 22, 'properties');
  list(t.stations, 4, 'stations');
  list(t.utilities, 2, 'utilities');
  list(t.taxes, 2, 'taxes');
  list(t.tokens, 6, 'tokens');
  if (!Array.isArray(t.groupColors) || t.groupColors.length !== 8 || !t.groupColors.every((c) => /^#[0-9a-f]{6}$/i.test(c)))
    e.push('groupColors harus 8 warna hex #rrggbb');
  if (!t.currency || !str(t.currency.symbol) || !(t.currency.multiplier > 0) || !(t.currency.multiplier <= 1e9)) e.push('currency.symbol & multiplier wajib (multiplier 1..1.000.000.000)');
  if (!t.corners || !['go', 'jail', 'parking', 'gotojail'].every((k) => str((t.corners as any)[k]))) e.push('corners go/jail/parking/gotojail wajib');
  if (!t.deckNames || !str(t.deckNames.chance) || !str(t.deckNames.community)) e.push('deckNames wajib');
  if (!t.visual || !['modern', 'classic', 'onion', 'pagoda', 'ninja', 'tropical'].includes(t.visual.buildings as string)) e.push('visual.buildings tidak valid');
  if (t.visual?.landmark !== undefined && !(LANDMARKS as readonly string[]).includes(t.visual.landmark)) e.push('visual.landmark tidak valid');
  if (t.cards !== undefined && (typeof t.cards !== 'object' || !t.cards || Object.entries(t.cards).some(([k, v]) => !/^[cd]\d{1,2}$/.test(k) || typeof v !== 'string' || v.length > 200)))
    e.push('cards: kunci c1..c16/d1..d16, isi teks maks 200 huruf');
  e.push(...customDecksErrors(t.decks));
  if (t.tileFx !== undefined) {
    if (!t.tileFx || typeof t.tileFx !== 'object') e.push('tileFx harus objek { "nomorPetak": {...} }');
    else
      for (const [k, f] of Object.entries(t.tileFx)) {
        const n = Number(k);
        if (!Number.isInteger(n) || n < 0 || n > 39) e.push(`tileFx["${k}"]: kunci harus nomor petak 0..39`);
        if (!f || typeof f !== 'object') {
          e.push(`tileFx["${k}"] harus objek`);
          continue;
        }
        if (f.anim !== undefined && (typeof f.anim !== 'string' || !/^[a-z]{2,20}$/.test(f.anim))) e.push(`tileFx["${k}"].anim tidak valid`);
        if (f.emoji !== undefined && (typeof f.emoji !== 'string' || !f.emoji || f.emoji.length > 16)) e.push(`tileFx["${k}"].emoji maks 16 karakter`);
        if (f.caption !== undefined && (typeof f.caption !== 'string' || f.caption.length > 80)) e.push(`tileFx["${k}"].caption maks 80 huruf`);
        if (f.color !== undefined && !/^#[0-9a-f]{6}$/i.test(String(f.color))) e.push(`tileFx["${k}"].color harus #rrggbb`);
        if (f.anim === undefined && f.emoji === undefined) e.push(`tileFx["${k}"] butuh anim atau emoji`);
      }
  }
  if (JSON.stringify(t).length > 100_000) e.push('tema terlalu besar (maks 100 KB)');
  return e;
}
