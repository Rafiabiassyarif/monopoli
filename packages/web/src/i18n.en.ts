// Kamus bahasa Inggris. Kunci = teks Indonesia persis seperti di kode (termasuk {placeholder}).
// Teks yang belum ada tampil dalam bahasa Indonesia (dan diperingatkan di konsol saat dev).
//   lang/en-ui.ts   → layar & dialog aplikasi (menu, lobby, HUD, akun, teman, …)
//   lang/en-game.ts → isi permainan: kartu, celetukan bot, pesan engine & server, tema, aturan

import { EN_UI } from './lang/en-ui';
import { EN_GAME, EN_GAME_PATTERNS } from './lang/en-game';

export const EN: Record<string, string> = { ...EN_GAME, ...EN_UI };

/** Pesan server/engine yang berisi nama/angka: [pola Indonesia, terjemahan dengan $1, $2 …]. */
export const EN_PATTERNS: [RegExp, string][] = EN_GAME_PATTERNS;
