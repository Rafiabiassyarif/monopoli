// Musik latar prosedural (WebAudio) — tanpa file audio. Tangga nada mengikuti suasana tema:
// slendro untuk Indonesia, "in" Jepang untuk Jepang & Negeri Ninja, minor untuk Rusia, mayor untuk lainnya.

import { getRaw, setRaw } from './storage';

const KEY = 'monopoli.music';
const VOL_KEY = 'monopoli.musicVol';
let on = getRaw(KEY) !== '0';
let volume = Number(getRaw(VOL_KEY) ?? 0.5) || 0.5;
let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let timer: ReturnType<typeof setInterval> | null = null;
let nextTime = 0;
let step = 0;
let last = 4;
let mood = 'indonesia';

/** interval semitone dari nada dasar */
const SCALES: Record<string, number[]> = {
  slendro: [0, 2, 5, 7, 9, 12, 14, 17],
  in: [0, 1, 5, 7, 8, 12, 13, 17],
  minor: [0, 2, 3, 7, 8, 12, 14, 15],
  major: [0, 2, 4, 7, 9, 12, 14, 16],
};
const scaleFor = (m: string) => (m.startsWith('indonesia') ? SCALES.slendro : m.startsWith('japan') || m.startsWith('ninja') ? SCALES.in : m.startsWith('russia') ? SCALES.minor : SCALES.major);
const ROOT = 220; // A3
const BEAT = 60 / 84 / 2; // seperdelapan pada 84 bpm
const hz = (semi: number) => ROOT * 2 ** (semi / 12);

export const musicOn = () => on;
export const musicVolume = () => volume;

function note(freq: number, at: number, dur: number, type: OscillatorType, vol: number, attack = 0.02) {
  if (!ctx || !master) return;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, at);
  g.gain.setValueAtTime(0.0001, at);
  g.gain.exponentialRampToValueAtTime(vol, at + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
  o.connect(g).connect(master);
  o.start(at);
  o.stop(at + dur + 0.05);
}

function schedule() {
  if (!ctx) return;
  const scale = scaleFor(mood);
  while (nextTime < ctx.currentTime + 0.4) {
    const bar = Math.floor(step / 8);
    const beat = step % 8;
    // bas: nada dasar / kelima bergantian tiap birama
    if (beat === 0) note(hz((bar % 4 === 2 ? 7 : 0) - 24), nextTime, BEAT * 7.5, 'triangle', 0.09, 0.08);
    // pad lembut tiap dua birama
    if (beat === 0 && bar % 2 === 0) [0, scale[2], scale[3]].forEach((s) => note(hz(s - 12), nextTime, BEAT * 15, 'sine', 0.025, 1.2));
    // melodi: jalan acak di tangga nada, kadang istirahat
    if (Math.random() < (beat % 2 ? 0.35 : 0.7)) {
      last = Math.max(0, Math.min(scale.length - 1, last + Math.round((Math.random() - 0.5) * 3)));
      note(hz(scale[last]), nextTime, BEAT * (beat % 2 ? 1.2 : 2.2), 'sine', 0.05);
      if (Math.random() < 0.2) note(hz(scale[last] + 12), nextTime + BEAT / 2, BEAT, 'sine', 0.018);
    }
    nextTime += BEAT;
    step++;
  }
}

function start() {
  if (!on || timer) return;
  try {
    ctx ??= new AudioContext();
    if (ctx.state === 'suspended') void ctx.resume();
    if (!master) {
      master = ctx.createGain();
      master.connect(ctx.destination);
    }
    master.gain.setValueAtTime(0.0001, ctx.currentTime);
    master.gain.exponentialRampToValueAtTime(Math.max(0.0001, volume), ctx.currentTime + 2);
    nextTime = ctx.currentTime + 0.1;
    timer = setInterval(schedule, 150);
  } catch {
    /* audio tidak tersedia */
  }
}

function stop() {
  if (timer) clearInterval(timer);
  timer = null;
  if (ctx && master) master.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.3);
}

export function setMusicOn(v: boolean) {
  on = v;
  setRaw(KEY, v ? '1' : '0');
  if (v) start();
  else stop();
}

export function setMusicVolume(v: number) {
  volume = Math.min(1, Math.max(0.05, v));
  setRaw(VOL_KEY, String(volume));
  if (ctx && master && timer) master.gain.setTargetAtTime(volume, ctx.currentTime, 0.2);
}

/** Ganti suasana (id tema). */
export function setMusicMood(themeId: string) {
  mood = themeId;
}

/** Browser hanya mengizinkan suara setelah interaksi pertama → mulai saat itu. */
export function armMusic() {
  if (typeof window === 'undefined') return;
  const go = () => {
    start();
    removeEventListener('pointerdown', go);
    removeEventListener('keydown', go);
  };
  addEventListener('pointerdown', go);
  addEventListener('keydown', go);
  // tab disembunyikan → diam
  document.addEventListener('visibilitychange', () => (document.hidden ? stop() : on && start()));
}
