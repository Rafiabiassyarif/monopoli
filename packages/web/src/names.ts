// Nama petak & teks kartu yang sudah diterjemahkan ke bahasa antarmuka.
// Engine menyimpan nama asli (Indonesia / nama tempat); untuk tampilan selalu pakai fungsi di sini,
// supaya papan, kartu, log, dan dialog memakai kata yang sama (mis. "Kesempatan" ↔ "Chance").
import { cardById, cardText as rawCardText, tileName as rawTileName, type GameState, type Options, type Theme } from '@monopoli/engine';
import { t, tName, tr } from './i18n';

/** Nama petak untuk ditampilkan (diterjemahkan bila ada di kamus; nama kota tetap). */
export const tileName = (theme: Theme, i: number): string => tName(rawTileName(theme, i));

/** Gaji yang benar-benar diterima kartu "Maju ke START" (aturan rumah gaji 2x berlaku karena berhenti tepat di START). */
export const cardSalary = (o?: Pick<Options, 'goSalary' | 'doubleGo'>) => (o ? (o.doubleGo ? o.goSalary * 2 : o.goSalary) : 200);

/** Teks kartu dengan {m:N} / {m:go} → uang tema dan {t:i} → nama petak yang sudah diterjemahkan. */
export function cardText(theme: Theme, id: string, fallback: string, options?: Pick<Options, 'goSalary' | 'doubleGo'>): string {
  const own = theme.cards?.[id];
  const raw = (own ? tr(own) : fallback).replace(/\{t:(\d+)\}/g, (_, i) => tileName(theme, +i));
  return rawCardText({ ...theme, cards: undefined }, id, raw, cardSalary(options));
}

/**
 * Teks kartu yang ditarik di game ini, siap tampil. Kartu bawaan diterjemahkan; kartu kustom (tema JSON)
 * ditampilkan apa adanya — token {m:N}, {m:go} dan {t:i} tetap diisi.
 */
export function cardLine(state: Pick<GameState, 'cardDefs' | 'options'>, theme: Theme, deck: 'chance' | 'community', id: string): string {
  const def = cardById(state, deck, id);
  if (!def) return '';
  const custom = !!state.cardDefs?.[deck];
  return cardText(custom ? { ...theme, cards: undefined } : theme, id, custom ? def.text : t(def.text), state.options);
}
