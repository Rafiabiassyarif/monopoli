// Data visual, landmark, ilustrasi kanvas, dan efek animasi kota untuk Papan Monopoli.

import type { Theme } from '@monopoli/engine';
import { BOARD } from '@monopoli/engine';

export interface CityInfo {
  name: string;
  landmark: string;
  tagline: string;
  icon: string;
  visualType:
    | 'monas'
    | 'temple'
    | 'gadang'
    | 'sate'
    | 'tugu'
    | 'bridge'
    | 'nature'
    | 'monument'
    | 'palace'
    | 'station'
    | 'ship'
    | 'plane'
    | 'mrt'
    | 'power'
    | 'water'
    | 'skyscraper'
    | 'generic';
  skyGradient: [string, string];
  accent: string;
}

// Data spesifik kota Indonesia
const ID_CITIES: Record<string, Partial<CityInfo>> = {
  Merauke: {
    landmark: 'Tugu 0 Km Merauke',
    tagline: 'Ujung Timur Nusantara Nan Megah',
    icon: '🧭',
    visualType: 'monument',
    skyGradient: ['#f97316', '#7c2d12'],
    accent: '#fb923c',
  },
  Jayapura: {
    landmark: 'Jembatan Youtefa Merah',
    tagline: 'Mutiara Teluk dari Timur Papua',
    icon: '🌉',
    visualType: 'bridge',
    skyGradient: ['#0284c7', '#082f49'],
    accent: '#38bdf8',
  },
  Kupang: {
    landmark: 'Pantai Lasiana & Alat Musik Sasando',
    tagline: 'Eksotisme Nusa Tenggara Timur',
    icon: '🏝️',
    visualType: 'nature',
    skyGradient: ['#0d9488', '#134e4a'],
    accent: '#2dd4bf',
  },
  Mataram: {
    landmark: 'Puncak Gunung Rinjani & Pantai Senggigi',
    tagline: 'Pesona Bumi Gora Pulau Lombok',
    icon: '🌋',
    visualType: 'nature',
    skyGradient: ['#ea580c', '#431407'],
    accent: '#f97316',
  },
  Denpasar: {
    landmark: 'Monumen Perjuangan Bajra Sandhi',
    tagline: 'Pusat Budaya & Seni Dewata',
    icon: '⛩️',
    visualType: 'temple',
    skyGradient: ['#b45309', '#451a03'],
    accent: '#fbbf24',
  },
  Makassar: {
    landmark: 'Pantai Losari & Benteng Rotterdam',
    tagline: 'Gerbang Megah Indonesia Timur',
    icon: '⚓',
    visualType: 'monument',
    skyGradient: ['#d97706', '#1e1b4b'],
    accent: '#f59e0b',
  },
  Manado: {
    landmark: 'Taman Laut Bunaken & Patung Memberkati',
    tagline: 'Surga Bahari Bawah Laut Dunia',
    icon: '🐠',
    visualType: 'nature',
    skyGradient: ['#0284c7', '#172554'],
    accent: '#60a5fa',
  },
  Balikpapan: {
    landmark: 'Jembatan Teluk Balikpapan & Kilang Mandiri',
    tagline: 'Kota Minyak Bersih & Modern',
    icon: '🛢️',
    visualType: 'skyscraper',
    skyGradient: ['#475569', '#0f172a'],
    accent: '#94a3b8',
  },
  Pontianak: {
    landmark: 'Tugu Khatulistiwa & Sungai Kapuas',
    tagline: 'Tepat di Garis Nol Lintang Dunia',
    icon: '🌐',
    visualType: 'monument',
    skyGradient: ['#16a34a', '#14532d'],
    accent: '#4ade80',
  },
  Banjarmasin: {
    landmark: 'Pasar Terapung Muara Kuin',
    tagline: 'Pesona Kota Seribu Sungai',
    icon: '🛶',
    visualType: 'ship',
    skyGradient: ['#0891b2', '#164e63'],
    accent: '#22d3ee',
  },
  Palembang: {
    landmark: 'Jembatan Megah Ampera & Sungai Musi',
    tagline: 'Kejayaan Bahari Bumi Sriwijaya',
    icon: '🌉',
    visualType: 'bridge',
    skyGradient: ['#dc2626', '#450a0a'],
    accent: '#f87171',
  },
  Padang: {
    landmark: 'Jam Gadang & Istana Rumah Gadang',
    tagline: 'Kemilau Ranah Minang Nan Elok',
    icon: '🏯',
    visualType: 'gadang',
    skyGradient: ['#ca8a04', '#422006'],
    accent: '#facc15',
  },
  Pekanbaru: {
    landmark: 'Masjid Agung An-Nur Lancang Kuning',
    tagline: 'Kota Madani Bertuah & Budaya Melayu',
    icon: '🕌',
    visualType: 'palace',
    skyGradient: ['#059669', '#064e3b'],
    accent: '#34d399',
  },
  Medan: {
    landmark: 'Istana Maimun & Masjid Raya Al-Mashun',
    tagline: 'Metropolitan Bersejarah Kesultanan Deli',
    icon: '👑',
    visualType: 'palace',
    skyGradient: ['#7c3aed', '#2e1065'],
    accent: '#c084fc',
  },
  Semarang: {
    landmark: 'Bangunan Lawang Sewu & Klenteng Sam Poo Kong',
    tagline: 'Pesona Harmoni Kota Pesisir Jawa',
    icon: '🏛️',
    visualType: 'palace',
    skyGradient: ['#e11d48', '#4c0519'],
    accent: '#fb7185',
  },
  Solo: {
    landmark: 'Keraton Kasunangan Surakarta Hadiningrat',
    tagline: 'The Spirit of Java & Batik Pusaka',
    icon: '🎭',
    visualType: 'tugu',
    skyGradient: ['#92400e', '#291804'],
    accent: '#f59e0b',
  },
  Yogyakarta: {
    landmark: 'Tugu Pal Putih & Keraton Ngayogyakarta',
    tagline: 'Istimewa Berhati Nyaman Penuh Kenangan',
    icon: '🌟',
    visualType: 'tugu',
    skyGradient: ['#4f46e5', '#1e1b4b'],
    accent: '#818cf8',
  },
  Malang: {
    landmark: 'Tugu Balai Kota & Panorama Bromo',
    tagline: 'Kota Apel Berhawa Sejuk Pegunungan',
    icon: '🍏',
    visualType: 'nature',
    skyGradient: ['#15803d', '#052e16'],
    accent: '#86efac',
  },
  Surabaya: {
    landmark: 'Patung Suro & Boyo, Jembatan Suramadu',
    tagline: 'Kota Pahlawan Penuh Jiwa Pejuang',
    icon: '🦈',
    visualType: 'monument',
    skyGradient: ['#2563eb', '#0f172a'],
    accent: '#60a5fa',
  },
  Bandung: {
    landmark: 'Gedung Sate & Kawah Tangkuban Perahu',
    tagline: 'Paris van Java Kota Kembang & Kreativitas',
    icon: '🌸',
    visualType: 'sate',
    skyGradient: ['#db2777', '#500724'],
    accent: '#f472b6',
  },
  'Ubud Bali': {
    landmark: 'Candi Bentar & Pura Desa Ubud',
    tagline: 'Pusat Spiritual, Seni & Budaya Dunia',
    icon: '⛩️',
    visualType: 'temple',
    skyGradient: ['#b45309', '#3f1a04'],
    accent: '#fde047',
  },
  Jakarta: {
    landmark: 'Monumen Nasional (Monas) & Bundaran HI',
    tagline: 'Ibukota Megapolitan Pusat Nusantara',
    icon: '🏙️',
    visualType: 'monas',
    skyGradient: ['#4338ca', '#0f172a'],
    accent: '#a5b4fc',
  },

  // Stasiun Indonesia
  'Stasiun Gambir': {
    landmark: 'Gedung Stasiun Gambir Klasik',
    tagline: 'Pintu Gerbang Jalur Kereta Eksekutif',
    icon: '🚆',
    visualType: 'station',
    skyGradient: ['#1e293b', '#0f172a'],
    accent: '#38bdf8',
  },
  'Pelabuhan Tanjung Priok': {
    landmark: 'Dermaga Kapal Kontainer Samudera',
    tagline: 'Pelabuhan Niaga Tersibuk di Indonesia',
    icon: '🚢',
    visualType: 'ship',
    skyGradient: ['#0369a1', '#082f49'],
    accent: '#38bdf8',
  },
  'Bandara Soekarno-Hatta': {
    landmark: 'Menara ATC & Terminal Internasional',
    tagline: 'Gerbang Penerbangan Udara Dunia',
    icon: '✈️',
    visualType: 'plane',
    skyGradient: ['#6366f1', '#1e1b4b'],
    accent: '#a5b4fc',
  },
  'Stasiun MRT Bundaran HI': {
    landmark: 'Stasiun Bawah Tanah Modern HI',
    tagline: 'Moda Transportasi Cepat Terintegrasi',
    icon: '🚇',
    visualType: 'mrt',
    skyGradient: ['#0284c7', '#0c4a6e'],
    accent: '#38bdf8',
  },

  // Utilitas
  PLN: {
    landmark: 'Pembangkit Tenaga Listrik Nusantara',
    tagline: 'Menerangi Seluruh Sudut Negeri',
    icon: '⚡',
    visualType: 'power',
    skyGradient: ['#ca8a04', '#422006'],
    accent: '#facc15',
  },
  PDAM: {
    landmark: 'Mata Air Alami Pegunungan Lestari',
    tagline: 'Air Bersih Sumber Kehidupan',
    icon: '💧',
    visualType: 'water',
    skyGradient: ['#0284c7', '#082f49'],
    accent: '#38bdf8',
  },
};

export function getCityInfo(name: string, theme: Theme): CityInfo {
  const specific = ID_CITIES[name];
  if (specific) {
    return {
      name,
      landmark: specific.landmark ?? name,
      tagline: specific.tagline ?? `Kawasan Elit ${name}`,
      icon: specific.icon ?? '🏛️',
      visualType: specific.visualType ?? 'generic',
      skyGradient: specific.skyGradient ?? [theme.visual.sky[0], theme.visual.sky[1]],
      accent: specific.accent ?? theme.visual.accent,
    };
  }

  // Generik untuk tema lain (Jepang, USA, Negeri Ninja, UK, dsb.)
  let visualType: CityInfo['visualType'] = 'generic';
  let icon = '🏛️';
  const lower = name.toLowerCase();

  if (lower.includes('tokyo') || lower.includes('york') || lower.includes('chicago') || lower.includes('ginza')) {
    visualType = 'skyscraper';
    icon = '🏙️';
  } else if (lower.includes('kyoto') || lower.includes('nara') || lower.includes('temple')) {
    visualType = 'temple';
    icon = '⛩️';
  } else if (lower.includes('gunung') || lower.includes('fuji') || lower.includes('benteng')) {
    visualType = 'nature';
    icon = '⛰️';
  } else if (lower.includes('stasiun') || lower.includes('shinkansen') || lower.includes('railroad')) {
    visualType = 'station';
    icon = '🚆';
  } else if (lower.includes('listrik') || lower.includes('electric') || lower.includes('tepco')) {
    visualType = 'power';
    icon = '⚡';
  } else if (lower.includes('air') || lower.includes('water')) {
    visualType = 'water';
    icon = '💧';
  }

  return {
    name,
    landmark: `Landmark ${name}`,
    tagline: `Destinasi Terkenal ${theme.name}`,
    icon,
    visualType,
    skyGradient: [theme.visual.sky[0], theme.visual.sky[1]],
    accent: theme.visual.accent,
  };
}

/** Gambar ilustrasi landmark vektor beresolusi tinggi langsung ke Canvas 2D texture papan! */
export function drawLandmarkToCanvas(
  g: CanvasRenderingContext2D,
  info: CityInfo,
  cx: number,
  cy: number,
  w: number,
  h: number,
  groupColor: string,
) {
  g.save();
  g.translate(cx, cy);

  // Background badge melingkar halus
  const rad = Math.min(w * 0.42, h * 0.44);
  const bgGrad = g.createRadialGradient(0, 0, rad * 0.1, 0, 0, rad);
  bgGrad.addColorStop(0, 'rgba(255, 255, 255, 0.95)');
  bgGrad.addColorStop(0.7, 'rgba(240, 244, 248, 0.85)');
  bgGrad.addColorStop(1, 'rgba(210, 220, 235, 0.4)');
  g.fillStyle = bgGrad;
  g.beginPath();
  g.arc(0, 0, rad, 0, Math.PI * 2);
  g.fill();

  // Ring aksen warna grup tipis
  g.strokeStyle = groupColor;
  g.lineWidth = 2.5;
  g.stroke();

  // Glow halus di belakang landmark
  g.shadowColor = groupColor;
  g.shadowBlur = 10;

  // Gambar siluet/vektor landmark berdasarkan tipe
  g.fillStyle = '#1e293b';
  g.strokeStyle = '#0f172a';
  g.lineWidth = 1.5;

  const s = rad * 0.65; // skala

  switch (info.visualType) {
    case 'monas': {
      // Monumen Nasional (Cawan + Obelisk + Api Emas)
      // Cawan bawah
      g.beginPath();
      g.moveTo(-s * 0.75, s * 0.7);
      g.lineTo(s * 0.75, s * 0.7);
      g.lineTo(s * 0.5, s * 0.4);
      g.lineTo(-s * 0.5, s * 0.4);
      g.closePath();
      g.fillStyle = '#334155';
      g.fill();
      // Tiang obelisk tinggi
      g.beginPath();
      g.moveTo(-s * 0.16, s * 0.4);
      g.lineTo(s * 0.16, s * 0.4);
      g.lineTo(s * 0.08, -s * 0.55);
      g.lineTo(-s * 0.08, -s * 0.55);
      g.closePath();
      g.fillStyle = '#475569';
      g.fill();
      // Pelat cawan atas
      g.fillStyle = '#1e293b';
      g.fillRect(-s * 0.18, -s * 0.58, s * 0.36, s * 0.06);
      // Api Kemerdekaan Emas bercahaya
      g.shadowColor = '#f59e0b';
      g.shadowBlur = 14;
      g.fillStyle = '#fbbf24';
      g.beginPath();
      g.moveTo(0, -s * 0.95);
      g.quadraticCurveTo(s * 0.18, -s * 0.75, 0, -s * 0.58);
      g.quadraticCurveTo(-s * 0.18, -s * 0.75, 0, -s * 0.95);
      g.fill();
      break;
    }

    case 'temple': {
      // Candi Bentar (Gerbang Terbelah Khas Bali)
      // Tangga dasar
      g.fillStyle = '#475569';
      g.fillRect(-s * 0.75, s * 0.6, s * 1.5, s * 0.15);
      // Pilar kiri berundak
      g.beginPath();
      g.moveTo(-s * 0.1, s * 0.6);
      g.lineTo(-s * 0.55, s * 0.6);
      g.lineTo(-s * 0.5, s * 0.2);
      g.lineTo(-s * 0.45, s * 0.2);
      g.lineTo(-s * 0.4, -s * 0.2);
      g.lineTo(-s * 0.35, -s * 0.2);
      g.lineTo(-s * 0.25, -s * 0.7);
      g.lineTo(-s * 0.1, -s * 0.75);
      g.closePath();
      g.fillStyle = '#b45309';
      g.fill();
      // Pilar kanan berundak
      g.beginPath();
      g.moveTo(s * 0.1, s * 0.6);
      g.lineTo(s * 0.55, s * 0.6);
      g.lineTo(s * 0.5, s * 0.2);
      g.lineTo(s * 0.45, s * 0.2);
      g.lineTo(s * 0.4, -s * 0.2);
      g.lineTo(s * 0.35, -s * 0.2);
      g.lineTo(s * 0.25, -s * 0.7);
      g.lineTo(s * 0.1, -s * 0.75);
      g.closePath();
      g.fill();
      // Ornamen puncak emas
      g.fillStyle = '#f59e0b';
      g.fillRect(-s * 0.2, -s * 0.8, s * 0.1, s * 0.08);
      g.fillRect(s * 0.1, -s * 0.8, s * 0.1, s * 0.08);
      break;
    }

    case 'gadang': {
      // Atap Lengkung Tanduk Kerbau Rumah Gadang (Padang)
      // Badan rumah panggung
      g.fillStyle = '#78350f';
      g.fillRect(-s * 0.5, s * 0.1, s * 1.0, s * 0.45);
      // Tiang panggung
      g.fillStyle = '#451a03';
      for (let x = -s * 0.45; x <= s * 0.45; x += s * 0.22) {
        g.fillRect(x, s * 0.55, s * 0.06, s * 0.2);
      }
      // Atap Gonjong melengkung dramatis
      g.fillStyle = '#b45309';
      g.beginPath();
      g.moveTo(-s * 0.8, -s * 0.55); // tanduk kiri
      g.quadraticCurveTo(-s * 0.4, s * 0.1, 0, -s * 0.1);
      g.quadraticCurveTo(s * 0.4, s * 0.1, s * 0.8, -s * 0.55); // tanduk kanan
      g.lineTo(s * 0.55, -s * 0.1);
      g.lineTo(-s * 0.55, -s * 0.1);
      g.closePath();
      g.fill();
      break;
    }

    case 'sate': {
      // Gedung Sate (Bandung)
      // Bangunan utama Art Deco
      g.fillStyle = '#cbd5e1';
      g.fillRect(-s * 0.7, s * 0.15, s * 1.4, s * 0.45);
      // Menara tengah
      g.fillStyle = '#94a3b8';
      g.fillRect(-s * 0.3, -s * 0.3, s * 0.6, s * 0.45);
      // Atap limasan
      g.beginPath();
      g.moveTo(-s * 0.35, -s * 0.3);
      g.lineTo(s * 0.35, -s * 0.3);
      g.lineTo(0, -s * 0.55);
      g.closePath();
      g.fillStyle = '#475569';
      g.fill();
      // Ornamen tusuk sate legendaris
      g.strokeStyle = '#0f172a';
      g.lineWidth = 2.5;
      g.beginPath();
      g.moveTo(0, -s * 0.55);
      g.lineTo(0, -s * 0.95);
      g.stroke();
      // 6 ornamen bola sate
      g.fillStyle = '#fbbf24';
      for (let k = 0; k < 6; k++) {
        g.beginPath();
        g.arc(0, -s * 0.62 - k * s * 0.05, s * 0.035, 0, Math.PI * 2);
        g.fill();
      }
      break;
    }

    case 'tugu': {
      // Tugu Yogyakarta / Solo
      // Alas persegi bertingkat
      g.fillStyle = '#e2e8f0';
      g.fillRect(-s * 0.5, s * 0.55, s * 1.0, s * 0.15);
      g.fillRect(-s * 0.35, s * 0.4, s * 0.7, s * 0.15);
      // Tiang putih silinder/obelisk
      g.fillStyle = '#f8fafc';
      g.strokeStyle = '#cbd5e1';
      g.lineWidth = 1.5;
      g.beginPath();
      g.moveTo(-s * 0.18, s * 0.4);
      g.lineTo(s * 0.18, s * 0.4);
      g.lineTo(s * 0.1, -s * 0.45);
      g.lineTo(-s * 0.1, -s * 0.45);
      g.closePath();
      g.fill();
      g.stroke();
      // Puncak emas mahkota tugu
      g.shadowColor = '#eab308';
      g.shadowBlur = 12;
      g.fillStyle = '#eab308';
      g.beginPath();
      g.moveTo(0, -s * 0.85);
      g.lineTo(s * 0.14, -s * 0.55);
      g.lineTo(-s * 0.14, -s * 0.55);
      g.closePath();
      g.fill();
      break;
    }

    case 'bridge': {
      // Jembatan Ampera / Suramadu / Youtefa
      // Gelombang air di bawah
      g.fillStyle = '#0284c7';
      g.beginPath();
      g.arc(0, s * 0.7, s * 0.75, Math.PI, 0, true);
      g.fill();
      // Dua menara pilon
      g.fillStyle = '#dc2626';
      g.fillRect(-s * 0.45, -s * 0.65, s * 0.16, s * 1.25);
      g.fillRect(s * 0.29, -s * 0.65, s * 0.16, s * 1.25);
      // Gelagar jembatan horisontal
      g.fillStyle = '#1e293b';
      g.fillRect(-s * 0.8, s * 0.15, s * 1.6, s * 0.12);
      // Kabel penopang suspensi
      g.strokeStyle = '#fca5a5';
      g.lineWidth = 1.5;
      g.beginPath();
      // dari puncak kiri
      g.moveTo(-s * 0.37, -s * 0.6);
      g.lineTo(-s * 0.75, s * 0.15);
      g.moveTo(-s * 0.37, -s * 0.6);
      g.lineTo(0, s * 0.15);
      // dari puncak kanan
      g.moveTo(s * 0.37, -s * 0.6);
      g.lineTo(0, s * 0.15);
      g.moveTo(s * 0.37, -s * 0.6);
      g.lineTo(s * 0.75, s * 0.15);
      g.stroke();
      break;
    }

    case 'skyscraper': {
      // Gedung Pencakar Langit Modern
      // Gedung latar belakang
      g.fillStyle = '#64748b';
      g.fillRect(-s * 0.65, -s * 0.35, s * 0.45, s * 1.0);
      g.fillRect(s * 0.2, -s * 0.55, s * 0.45, s * 1.2);
      // Gedung utama di tengah
      g.fillStyle = '#1e3a8a';
      g.fillRect(-s * 0.25, -s * 0.75, s * 0.5, s * 1.4);
      // Jendela kaca bercahaya
      g.fillStyle = '#93c5fd';
      for (let y = -s * 0.65; y < s * 0.5; y += s * 0.15) {
        g.fillRect(-s * 0.18, y, s * 0.12, s * 0.08);
        g.fillRect(s * 0.06, y, s * 0.12, s * 0.08);
      }
      // Jarum antena pemancar
      g.strokeStyle = '#ef4444';
      g.lineWidth = 2;
      g.beginPath();
      g.moveTo(0, -s * 0.75);
      g.lineTo(0, -s * 0.95);
      g.stroke();
      break;
    }

    case 'station': {
      // Kereta api cepat / lokomotif
      // Badan kereta aerodinamis
      g.fillStyle = '#0284c7';
      g.beginPath();
      g.moveTo(-s * 0.7, s * 0.5);
      g.lineTo(s * 0.4, s * 0.5);
      g.quadraticCurveTo(s * 0.75, s * 0.5, s * 0.65, s * 0.1);
      g.lineTo(s * 0.3, -s * 0.2);
      g.lineTo(-s * 0.7, -s * 0.2);
      g.closePath();
      g.fill();
      // Kaca depan condong
      g.fillStyle = '#0f172a';
      g.beginPath();
      g.moveTo(s * 0.1, -s * 0.15);
      g.lineTo(s * 0.4, -s * 0.15);
      g.lineTo(s * 0.55, s * 0.1);
      g.lineTo(s * 0.1, s * 0.1);
      g.closePath();
      g.fill();
      // Rel lintasan
      g.fillStyle = '#64748b';
      g.fillRect(-s * 0.8, s * 0.55, s * 1.6, s * 0.08);
      break;
    }

    case 'ship': {
      // Kapal Pinisi / Kapal Kontainer
      // Lambung kapal kayu
      g.fillStyle = '#78350f';
      g.beginPath();
      g.moveTo(-s * 0.75, s * 0.2);
      g.lineTo(s * 0.75, s * 0.2);
      g.quadraticCurveTo(s * 0.65, s * 0.6, 0, s * 0.65);
      g.quadraticCurveTo(-s * 0.65, s * 0.6, -s * 0.75, s * 0.2);
      g.fill();
      // Tiang layar ganda
      g.fillStyle = '#451a03';
      g.fillRect(-s * 0.25, -s * 0.7, s * 0.07, s * 0.9);
      g.fillRect(s * 0.2, -s * 0.6, s * 0.07, s * 0.8);
      // Layar Pinisi berkibar
      g.fillStyle = '#fef08a';
      g.beginPath();
      g.moveTo(-s * 0.22, -s * 0.65);
      g.lineTo(-s * 0.6, s * 0.1);
      g.lineTo(-s * 0.22, s * 0.1);
      g.closePath();
      g.fill();
      g.beginPath();
      g.moveTo(s * 0.23, -s * 0.55);
      g.lineTo(-s * 0.15, s * 0.1);
      g.lineTo(s * 0.23, s * 0.1);
      g.closePath();
      g.fill();
      break;
    }

    case 'nature': {
      // Gunung Bromo / Rinjani & Laut
      // Siluet gunung berundak
      g.fillStyle = '#15803d';
      g.beginPath();
      g.moveTo(-s * 0.8, s * 0.6);
      g.lineTo(-s * 0.2, -s * 0.35);
      g.lineTo(s * 0.1, -s * 0.1);
      g.lineTo(s * 0.45, -s * 0.65); // puncak tinggi
      g.lineTo(s * 0.8, s * 0.6);
      g.closePath();
      g.fill();
      // Salju / kabut putih puncak
      g.fillStyle = '#f8fafc';
      g.beginPath();
      g.moveTo(s * 0.45, -s * 0.65);
      g.lineTo(s * 0.55, -s * 0.45);
      g.lineTo(s * 0.35, -s * 0.45);
      g.closePath();
      g.fill();
      // Pohon kelapa / cemara kecil
      g.fillStyle = '#166534';
      g.beginPath();
      g.arc(-s * 0.4, s * 0.4, s * 0.15, 0, Math.PI * 2);
      g.fill();
      break;
    }

    default: {
      // Monumen / Gedung Klasik Megah
      g.fillStyle = '#334155';
      g.fillRect(-s * 0.6, s * 0.2, s * 1.2, s * 0.4);
      // Kolom tiang Romawi / Yunani klasik
      g.fillStyle = '#cbd5e1';
      for (let x = -s * 0.45; x <= s * 0.45; x += s * 0.3) {
        g.fillRect(x, -s * 0.2, s * 0.1, s * 0.4);
      }
      // Segitiga atap pedimen
      g.beginPath();
      g.moveTo(-s * 0.65, -s * 0.2);
      g.lineTo(s * 0.65, -s * 0.2);
      g.lineTo(0, -s * 0.65);
      g.closePath();
      g.fillStyle = '#1e293b';
      g.fill();
      break;
    }
  }

  g.shadowBlur = 0;
  g.restore();
}
