// Papan standar 40 petak. Harga/sewa dalam "unit dasar" — tema yang menentukan mata uang & pengali.

export type TileKind = 'go' | 'property' | 'station' | 'utility' | 'tax' | 'chance' | 'community' | 'jail' | 'parking' | 'gotojail';

export interface TileDef {
  index: number;
  kind: TileKind;
  /** group 0..7 untuk properti warna */
  group?: number;
  price?: number;
  /** sewa [dasar, 1 rumah, 2, 3, 4, hotel] */
  rent?: number[];
  houseCost?: number;
  tax?: number;
  /** indeks urutan di dalam jenisnya (properti ke-n, stasiun ke-n, dst.) — dipakai tema untuk nama */
  slot: number;
}

const P = (group: number, price: number, rent: number[], houseCost: number) => ({ kind: 'property' as const, group, price, rent, houseCost });

const RAW: Array<Omit<TileDef, 'index' | 'slot'>> = [
  { kind: 'go' },
  P(0, 60, [2, 10, 30, 90, 160, 250], 50),
  { kind: 'community' },
  P(0, 60, [4, 20, 60, 180, 320, 450], 50),
  { kind: 'tax', tax: 200 },
  { kind: 'station', price: 200 },
  P(1, 100, [6, 30, 90, 270, 400, 550], 50),
  { kind: 'chance' },
  P(1, 100, [6, 30, 90, 270, 400, 550], 50),
  P(1, 120, [8, 40, 100, 300, 450, 600], 50),
  { kind: 'jail' },
  P(2, 140, [10, 50, 150, 450, 625, 750], 100),
  { kind: 'utility', price: 150 },
  P(2, 140, [10, 50, 150, 450, 625, 750], 100),
  P(2, 160, [12, 60, 180, 500, 700, 900], 100),
  { kind: 'station', price: 200 },
  P(3, 180, [14, 70, 200, 550, 750, 950], 100),
  { kind: 'community' },
  P(3, 180, [14, 70, 200, 550, 750, 950], 100),
  P(3, 200, [16, 80, 220, 600, 800, 1000], 100),
  { kind: 'parking' },
  P(4, 220, [18, 90, 250, 700, 875, 1050], 150),
  { kind: 'chance' },
  P(4, 220, [18, 90, 250, 700, 875, 1050], 150),
  P(4, 240, [20, 100, 300, 750, 925, 1100], 150),
  { kind: 'station', price: 200 },
  P(5, 260, [22, 110, 330, 800, 975, 1150], 150),
  P(5, 260, [22, 110, 330, 800, 975, 1150], 150),
  { kind: 'utility', price: 150 },
  P(5, 280, [24, 120, 360, 850, 1025, 1200], 150),
  { kind: 'gotojail' },
  P(6, 300, [26, 130, 390, 900, 1100, 1275], 200),
  P(6, 300, [26, 130, 390, 900, 1100, 1275], 200),
  { kind: 'community' },
  P(6, 320, [28, 150, 450, 1000, 1200, 1400], 200),
  { kind: 'station', price: 200 },
  { kind: 'chance' },
  P(7, 350, [35, 175, 500, 1100, 1300, 1500], 200),
  { kind: 'tax', tax: 100 },
  P(7, 400, [50, 200, 600, 1400, 1700, 2000], 200),
];

export const BOARD: TileDef[] = (() => {
  const counters: Record<string, number> = {};
  return RAW.map((t, index) => {
    const slot = counters[t.kind] ?? 0;
    counters[t.kind] = slot + 1;
    return { ...t, index, slot };
  });
})();

export const JAIL_INDEX = 10;
export const GROUP_COUNT = 8;
export const STATION_RENT = [25, 50, 100, 200];
export const BAIL = 50;
export const GO_SALARY = 200;

export const isOwnable = (i: number) => {
  const k = BOARD[i]?.kind;
  return k === 'property' || k === 'station' || k === 'utility';
};

export const groupTiles = (group: number) => BOARD.filter((t) => t.kind === 'property' && t.group === group).map((t) => t.index);
