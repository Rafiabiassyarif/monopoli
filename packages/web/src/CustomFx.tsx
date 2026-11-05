// Animasi petak buatan pemain (tema JSON → tileFx[n].custom): partikel emoji dengan pola gerak pilihan.
// Murni CSS (tanpa three.js) supaya sama persis di papan 2D, papan 3D (lewat <Html>), dan pratinjau editor.

import { useEffect, useMemo, type CSSProperties } from 'react';
import { sfx } from './sfx';
import type { CustomAnim, CustomMotion } from '@monopoli/engine';
import { graphemes } from './tileAnims';

/** Lama satu putaran animasi pada kecepatan 1 (ms). */
export const CUSTOM_FX_MS = 2600;

/** Label & ikon tiap pola gerak (untuk editor). */
export const MOTION_INFO: Record<CustomMotion, [string, string]> = {
  burst: ['💥', 'Meledak ke segala arah'],
  rain: ['🌧️', 'Hujan dari atas'],
  float: ['🎈', 'Melayang naik'],
  fountain: ['⛲', 'Air mancur'],
  confetti: ['🎊', 'Konfeti berputar jatuh'],
  spin: ['🌀', 'Berputar di tempat'],
  orbit: ['🪐', 'Mengorbit melingkar'],
  bounce: ['🏀', 'Memantul-mantul'],
  zoom: ['🔍', 'Membesar lalu hilang'],
  wave: ['🌊', 'Ombak berbaris'],
};

/** Pseudo-acak tetap per indeks (supaya tiap render sama, tanpa Math.random di render). */
const rnd = (i: number, k: number) => {
  const x = Math.sin(i * 12.9898 + k * 78.233) * 43758.5453;
  return x - Math.floor(x);
};

/**
 * @param px   ukuran dasar area (px) — partikel menyebar sejauh ± px
 * @param loop true = diulang terus (pratinjau editor)
 */
export function CustomFx({ anim, px = 80, loop = false, runKey = 0, sound = false }: { anim: CustomAnim; px?: number; loop?: boolean; runKey?: number; sound?: boolean }) {
  // suara pilihan pemain diputar sekali tiap animasi mulai (tidak saat pratinjau berulang)
  useEffect(() => {
    if (sound && anim.sound && anim.sound !== 'none') sfx(anim.sound);
  }, [runKey, sound, anim.sound]);
  const list = useMemo(() => {
    const em = graphemes(anim.emojis).slice(0, 4);
    const emojis = em.length ? em : ['✨'];
    const n = Math.max(1, Math.min(30, anim.count | 0));
    return Array.from({ length: n }, (_, i) => {
      const a = (i / n) * Math.PI * 2 + rnd(i, 1) * 0.6;
      const dist = 0.55 + rnd(i, 2) * 0.55;
      return {
        e: emojis[i % emojis.length],
        dx: Math.cos(a) * dist,
        dy: Math.sin(a) * dist,
        x: rnd(i, 3) * 2 - 1, // posisi mendatar acak −1..1
        r: (rnd(i, 4) - 0.5) * 720,
        d: rnd(i, 5) * 0.35, // jeda mulai (fraksi durasi)
        s: 0.75 + rnd(i, 6) * 0.5,
        a,
        i,
        n,
      };
    });
  }, [anim.emojis, anim.count]);

  const dur = CUSTOM_FX_MS / Math.max(0.5, Math.min(2, anim.speed || 1));
  const font = Math.round(px * 0.32 * Math.max(0.5, Math.min(2.5, anim.size || 1)));
  return (
    <span
      key={runKey}
      className={`cfx cfx-${anim.motion} ${loop ? 'loop' : ''}`}
      style={{ ['--px' as string]: `${px}px`, ['--dur' as string]: `${dur}ms`, ['--fs' as string]: `${font}px`, ['--glow' as string]: anim.glow ?? 'transparent' } as CSSProperties}
      aria-hidden
    >
      {anim.glow && <span className="cfx-glow" />}
      {list.map((p) => (
        <span
          key={p.i}
          className="cfx-p"
          style={
            {
              ['--dx' as string]: p.dx.toFixed(3),
              ['--dy' as string]: p.dy.toFixed(3),
              ['--x' as string]: p.x.toFixed(3),
              ['--r' as string]: `${p.r.toFixed(0)}deg`,
              ['--d' as string]: `${(p.d * dur).toFixed(0)}ms`,
              ['--s' as string]: p.s.toFixed(2),
              ['--a' as string]: `${((p.i / p.n) * 360).toFixed(0)}deg`,
              ['--i' as string]: p.i,
            } as CSSProperties
          }
        >
          {p.e}
        </span>
      ))}
    </span>
  );
}
