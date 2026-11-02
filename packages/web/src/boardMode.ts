// Pilihan tampilan papan: 3D (bawaan) atau 2D ringan. Tanpa WebGL otomatis 2D.

import { useSyncExternalStore } from 'react';
import { getRaw, setRaw } from './storage';
import { hasWebGL } from './Board2D';

const KEY = 'monopoli.board2d';
let crashed = false;
let pref = getRaw(KEY) === '1';
const subs = new Set<() => void>();
const emit = () => subs.forEach((f) => f());

/** true = pakai papan 2D */
export const board2d = () => pref || crashed || !hasWebGL();
/** 3D tersedia di perangkat ini (bisa dipilih) */
export const can3d = () => !crashed && hasWebGL();
export function setBoard2d(v: boolean) {
  pref = v;
  setRaw(KEY, v ? '1' : '0');
  emit();
}
/** scene 3D gagal dibuat (mis. driver GPU) → pindah ke 2D untuk sesi ini */
export function markSceneCrashed() {
  crashed = true;
  emit();
}
const subscribe = (f: () => void) => (subs.add(f), () => subs.delete(f));
export const useBoard2d = () => useSyncExternalStore(subscribe, board2d, board2d);
