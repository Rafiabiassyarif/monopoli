// Jam animasi bersama (tanpa three.js) — dipakai App, HUD & bot driver, jadi bisa dimuat sebelum scene 3D.

import { useEffect, useState } from 'react';
import type { GameEvent, GameState } from '@monopoli/engine';

export const DICE_MS = 1150;

/** Jam bersama antar komponen (scene, HUD, bot driver). performance.now()-based. */
export const fx = {
  /** bidak baru boleh melangkah setelah dadu berhenti */
  diceSettleAt: 0,
  /** UI aksi & bot menunggu sampai animasi giliran selesai */
  busyUntil: 0,
  shake: 0,
};

let trackedSeq = -1;
/** Catat event baru (idempotent per seq) → hitung kapan animasi selesai. Dipanggil di render App sebelum scene & HUD. */
export function trackBusy(state: GameState | null, stepMs: number) {
  if (!state) return;
  if (trackedSeq < 0 || state.seq < trackedSeq) {
    trackedSeq = state.seq; // game baru / dimuat: tidak ada animasi tertunda
    return;
  }
  if (state.seq === trackedSeq) return;
  const fresh = state.events.filter((e) => e.seq > trackedSeq);
  trackedSeq = state.seq;
  let wait = landingDelay(fresh, stepMs);
  if (fresh.some((e) => e.type === 'card')) wait += 2600; // beri waktu membaca kartu
  fx.busyUntil = Math.max(fx.busyUntil, performance.now() + wait);
}
export const resetBusy = () => {
  trackedSeq = -1;
  fx.busyUntil = 0;
};

/** Lama animasi (ms) sebelum efek "setelah mendarat" boleh tampil, untuk satu batch event. */
export function landingDelay(fresh: GameEvent[], stepMs: number): number {
  const d = fresh.find((e) => e.type === 'dice');
  if (!d || d.type !== 'dice') return 0;
  const moves = fresh.filter((e) => e.type === 'move' && !e.direct).length;
  const steps = moves ? d.dice[0] + d.dice[1] : 0;
  return DICE_MS + steps * stepMs + 120;
}

/** true bila animasi giliran sudah selesai; komponen re-render otomatis saat waktunya tiba. */
export function useFxIdle(seq: number | undefined) {
  const [, force] = useState(0);
  const idle = performance.now() >= fx.busyUntil;
  useEffect(() => {
    const wait = fx.busyUntil - performance.now();
    if (wait <= 0) return;
    const t = setTimeout(() => force((n) => n + 1), wait + 20);
    return () => clearTimeout(t);
  }, [seq, idle]);
  return idle;
}
