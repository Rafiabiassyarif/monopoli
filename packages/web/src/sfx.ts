// Efek suara sintetis (WebAudio) — tanpa file audio.
import { getRaw, setRaw } from './storage';

let ctx: AudioContext | null = null;
let muted = getRaw('monopoli.mute') === '1';

export const isMuted = () => muted;
export const setMuted = (m: boolean) => {
  muted = m;
  setRaw('monopoli.mute', m ? '1' : '0');
};

function tone(freq: number, dur: number, type: OscillatorType = 'sine', delay = 0, vol = 0.15) {
  ctx ??= new AudioContext();
  if (ctx.state === 'suspended') void ctx.resume();
  const t = ctx.currentTime + delay;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.connect(g).connect(ctx.destination);
  o.start(t);
  o.stop(t + dur);
}

export function sfx(kind: 'dice' | 'buy' | 'pay' | 'jail' | 'card' | 'win' | 'turn') {
  if (muted) return;
  try {
    switch (kind) {
      case 'dice':
        for (let k = 0; k < 6; k++) tone(200 + Math.random() * 300, 0.05, 'square', k * 0.07, 0.05);
        break;
      case 'buy':
        [523, 659, 784].forEach((f, k) => tone(f, 0.15, 'triangle', k * 0.08));
        break;
      case 'pay':
        [440, 330].forEach((f, k) => tone(f, 0.18, 'sawtooth', k * 0.1, 0.06));
        break;
      case 'jail':
        [300, 250, 200].forEach((f, k) => tone(f, 0.25, 'square', k * 0.15, 0.07));
        break;
      case 'card':
        tone(880, 0.12, 'sine');
        tone(1320, 0.18, 'sine', 0.08);
        break;
      case 'turn':
        tone(660, 0.1, 'sine', 0, 0.08);
        break;
      case 'win':
        [523, 659, 784, 1047, 784, 1047].forEach((f, k) => tone(f, 0.25, 'triangle', k * 0.13));
        break;
    }
  } catch {
    /* audio diblok browser sebelum interaksi — abaikan */
  }
}
