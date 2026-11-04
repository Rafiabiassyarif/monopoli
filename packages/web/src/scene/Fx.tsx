// Efek "main fisik": dadu berfisika, kartu diambil & dibalik dari tumpukan 3D, uang kertas terbang,
// guncangan kamera, gelombang & label saat bidak mendarat. Semua visual saja — aturan tetap di engine.

import { useEffect, useMemo, useRef, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as THREE from 'three';
import {
  BOARD,
  formatMoney,
  isOwnable,
  rentFor,
  taxFor,
  type GameEvent,
  type GameState,
  type Theme,
} from '@monopoli/engine';
import { cardFace, tileName } from '../names';
import { FONT, tilePos } from './layout';
import { DECK_Y, ISLAND_Y } from './Island';
import { t, tr, useLang } from '../i18n';
import { DICE_MS, fx, landingDelay } from './busy';
import { PLAY_ANIM_EVENT, TILE_ANIM_MS, tileAnimFor, tileAnimOn } from '../tileAnims';

export { DICE_MS, fx, landingDelay, resetBusy, trackBusy, useFxIdle } from './busy';

/** tinggi permukaan petak (petak timbul di atas pulau tengah) */
export const TOP = 0.4;
// ======================= Dadu berfisika =======================

function pipTexture(n: number) {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d')!;
  const grad = g.createRadialGradient(64, 64, 20, 64, 64, 90);
  grad.addColorStop(0, '#ffffff');
  grad.addColorStop(1, '#ecebe4');
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  g.fillStyle = n === 1 ? '#c62828' : '#18181b';
  const P: Record<number, number[][]> = {
    1: [[64, 64]],
    2: [[36, 36], [92, 92]],
    3: [[32, 32], [64, 64], [96, 96]],
    4: [[36, 36], [92, 36], [36, 92], [92, 92]],
    5: [[32, 32], [96, 32], [64, 64], [32, 96], [96, 96]],
    6: [[36, 30], [92, 30], [36, 64], [92, 64], [36, 98], [92, 98]],
  };
  for (const [x, y] of P[n]) {
    g.beginPath();
    g.arc(x, y, n === 1 ? 17 : 11.5, 0, Math.PI * 2);
    g.fill();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
// sisi BoxGeometry: +x,-x,+y,-y,+z,-z
const FACES = [3, 4, 1, 6, 2, 5];
const FACE_EULER: Record<number, [number, number, number]> = {
  1: [0, 0, 0],
  6: [Math.PI, 0, 0],
  2: [-Math.PI / 2, 0, 0],
  5: [Math.PI / 2, 0, 0],
  3: [0, 0, Math.PI / 2],
  4: [0, 0, -Math.PI / 2],
};
const DIE = 0.46;
const REST_Y = ISLAND_Y + DIE / 2;
const LIM = 3.3; // dadu tetap di atas pulau tengah
const DECK_FRONT = 1.5;

// posisi kedua dadu untuk tumbukan sederhana dadu-vs-dadu
const dicePos: THREE.Vector3[] = [new THREE.Vector3(-0.45, REST_Y, 1.2), new THREE.Vector3(0.45, REST_Y, 1.2)];

function faceQuat(value: number, yaw: number) {
  return new THREE.Quaternion().setFromEuler(new THREE.Euler(0, yaw, 0)).multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(...(FACE_EULER[value] ?? [0, 0, 0]))));
}

function Die({ value, rollKey, from, idx }: { value: number; rollKey: number; from: [number, number]; idx: number }) {
  const mats = useMemo(() => FACES.map((n) => new THREE.MeshStandardMaterial({ map: pipTexture(n), roughness: 0.3, metalness: 0.02 })), []);
  const ref = useRef<THREE.Mesh>(null!);
  const sim = useRef({
    t: 1e9,
    p: new THREE.Vector3(idx ? 0.45 : -0.45, REST_Y, 1.2),
    v: new THREE.Vector3(),
    w: new THREE.Vector3(),
    q: faceQuat(value, idx * 0.5),
    target: faceQuat(value, idx * 0.5),
    hit: false,
  });

  useEffect(() => {
    if (!rollKey) return;
    const s = sim.current;
    const side = idx ? 1 : -1;
    s.t = 0;
    s.hit = false;
    s.p.set(from[0] + side * 0.35, 2.4, from[1] + side * 0.35);
    // lempar ke arah tengah papan, sedikit acak — tiap dadu ke sisi berbeda supaya jarang bertabrakan
    // mendarat di depan Tugu Koin (tidak menabrak monumen di tengah)
    const aim = new THREE.Vector3(side * (0.35 + Math.random() * 0.7), 0, 1.05 + Math.random() * 0.5);
    s.v.set((aim.x - s.p.x) * 1.5, 2.5 + Math.random(), (aim.z - s.p.z) * 1.5);
    s.w.set((Math.random() - 0.5) * 26, (Math.random() - 0.5) * 14, (Math.random() - 0.5) * 26);
    s.q.random();
    s.target = faceQuat(value, Math.random() * Math.PI * 2);
    fx.diceSettleAt = performance.now() + DICE_MS;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rollKey]);

  // dadu berubah tanpa lemparan (muat game) → langsung pakai nilai baru
  useEffect(() => {
    const s = sim.current;
    if (s.t >= DICE_MS) s.target = faceQuat(value, idx * 0.5);
  }, [value, idx]);

  const dq = useMemo(() => new THREE.Quaternion(), []);
  const axis = useMemo(() => new THREE.Vector3(), []);
  useFrame((_, rawDt) => {
    const s = sim.current;
    const dt = Math.min(rawDt, 1 / 30);
    s.t += dt * 1000;
    const wall = () => {
      for (const k of ['x', 'z'] as const)
        if (Math.abs(s.p[k]) > LIM) {
          s.p[k] = Math.sign(s.p[k]) * LIM;
          s.v[k] *= -0.5;
        }
      // jangan mendarat di atas alas kartu (depan kiri & kanan pulau)
      if (s.p.z > DECK_FRONT && Math.abs(s.p.x) > 0.62) {
        s.p.z = DECK_FRONT;
        s.v.z *= -0.4;
      }
    };
    if (s.t < 760) {
      s.v.y -= 30 * dt;
      s.p.addScaledVector(s.v, dt);
      if (s.p.y < REST_Y) {
        s.p.y = REST_Y;
        if (s.v.y < 0) {
          if (!s.hit) {
            fx.shake = Math.max(fx.shake, 0.09);
            s.hit = true;
          }
          s.v.y *= -0.42;
          s.v.x *= 0.72;
          s.v.z *= 0.72;
          s.w.multiplyScalar(0.62);
        }
      }
      wall();
      const ang = s.w.length() * dt;
      if (ang > 0) s.q.premultiply(dq.setFromAxisAngle(axis.copy(s.w).normalize(), ang));
    } else {
      // fase tenang: menggelinding pelan lalu berhenti tepat di wajah hasil engine
      const k = Math.min(1, (s.t - 760) / 380);
      s.v.multiplyScalar(0.86);
      s.p.addScaledVector(s.v, dt);
      s.p.y += (REST_Y - s.p.y) * Math.min(1, dt * 14);
      wall();
      if (k >= 1) s.q.copy(s.target);
      else s.q.slerp(s.target, Math.min(1, dt * (6 + k * 18)));
    }
    // dorong menjauh bila menumpuk dengan dadu lain (cukup di bidang xz)
    const o = dicePos[1 - idx];
    const dx = s.p.x - o.x;
    const dz = s.p.z - o.z;
    const d = Math.hypot(dx, dz);
    const min = DIE * 1.15;
    if (d < min) {
      const nx = d > 1e-4 ? dx / d : idx ? 1 : -1;
      const nz = d > 1e-4 ? dz / d : 0;
      s.p.x += nx * (min - d) * 0.6;
      s.p.z += nz * (min - d) * 0.6;
    }
    dicePos[idx].copy(s.p);
    ref.current.position.copy(s.p);
    ref.current.quaternion.copy(s.q);
  });

  return (
    <mesh ref={ref} material={mats} castShadow>
      <boxGeometry args={[DIE, DIE, DIE]} />
    </mesh>
  );
}

export function DicePair({ dice, rollKey, from }: { dice: [number, number]; rollKey: number; from: [number, number] }) {
  return (
    <>
      <Die value={dice[0]} rollKey={rollKey} from={from} idx={0} />
      <Die value={dice[1]} rollKey={rollKey} from={from} idx={1} />
    </>
  );
}

// ======================= Guncangan kamera =======================

export function CameraShake() {
  const { camera } = useThree();
  const last = useRef(new THREE.Vector3());
  useFrame((_, dt) => {
    camera.position.sub(last.current);
    if (fx.shake > 0.001) {
      last.current.set(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).multiplyScalar(fx.shake);
      fx.shake = Math.max(0, fx.shake - dt * 0.5);
    } else last.current.set(0, 0, 0);
    camera.position.add(last.current);
  });
  return null;
}

// ======================= Kartu =======================

// posisi tumpukan kartu sesuai gambar di tekstur papan (lihat layout.ts: deck(-1.9S,-2.6S) diputar -45°)
const DECK_POS: Record<'chance' | 'community', [number, number]> = { chance: [-1.9, 2.45], community: [1.9, 2.45] };
const DECK_YAW = 0;
const CARD_W = 1.9;
const CARD_H = 1.2;
const DECK_COLOR = { chance: ['#fb923c', '#ea580c'], community: ['#60a5fa', '#2563eb'] } as const;

function cardCanvas(draw: (g: CanvasRenderingContext2D, w: number, h: number) => void) {
  const c = document.createElement('canvas');
  c.width = 760;
  c.height = 480;
  const g = c.getContext('2d')!;
  draw(g, c.width, c.height);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

function roundRect(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  g.beginPath();
  g.roundRect(x, y, w, h, r);
}

function backTexture(deck: 'chance' | 'community', label: string) {
  return cardCanvas((g, w, h) => {
    const [a, b] = DECK_COLOR[deck];
    const grad = g.createLinearGradient(0, 0, w, h);
    grad.addColorStop(0, a);
    grad.addColorStop(1, b);
    g.fillStyle = grad;
    roundRect(g, 0, 0, w, h, 36);
    g.fill();
    g.strokeStyle = 'rgba(255,255,255,.85)';
    g.lineWidth = 10;
    g.setLineDash([26, 16]);
    roundRect(g, 26, 26, w - 52, h - 52, 24);
    g.stroke();
    g.setLineDash([]);
    g.fillStyle = '#fff';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    // nama tumpukan sebesar mungkin tapi tetap muat (1–2 baris)
    const up = label.toUpperCase();
    g.font = `900 84px ${FONT}`;
    const words = up.split(' ');
    const twoLines = words.length > 1 && g.measureText(up).width > w - 110;
    let size = twoLines ? 64 : 84;
    g.font = `900 ${size}px ${FONT}`;
    g.save();
    g.font = `${twoLines ? 130 : 160}px ${FONT}`;
    g.fillText(deck === 'chance' ? '?' : '★', w / 2, twoLines ? 165 : h / 2 - 40);
    g.restore();
    const lines = twoLines ? [words.slice(0, Math.ceil(words.length / 2)).join(' '), words.slice(Math.ceil(words.length / 2)).join(' ')] : [up];
    const widest = () => Math.max(...lines.map((l) => g.measureText(l).width));
    while (size > 40 && widest() > w - 110) g.font = `900 ${(size -= 4)}px ${FONT}`;
    g.shadowColor = 'rgba(0,0,0,.25)';
    g.shadowOffsetY = 4;
    lines.forEach((l, k) => g.fillText(l, w / 2, h - 120 - (lines.length - 1 - k) * size * 1.05));
    g.shadowColor = 'transparent';
  });
}

function wrap(g: CanvasRenderingContext2D, text: string, maxW: number) {
  const out: string[] = [];
  let line = '';
  for (const w of text.split(' ')) {
    const t = line ? `${line} ${w}` : w;
    if (g.measureText(t).width > maxW && line) {
      out.push(line);
      line = w;
    } else line = t;
  }
  if (line) out.push(line);
  return out;
}

function frontTexture(deck: 'chance' | 'community', label: string, text: string) {
  return cardCanvas((g, w, h) => {
    g.fillStyle = '#fffaf0';
    roundRect(g, 0, 0, w, h, 36);
    g.fill();
    const [a] = DECK_COLOR[deck];
    g.fillStyle = a;
    roundRect(g, 0, 0, w, 96, 36);
    g.fill();
    g.fillRect(0, 60, w, 36);
    g.fillStyle = '#fff';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.font = `800 46px ${FONT}`;
    g.fillText(label.toUpperCase(), w / 2, 50);
    g.fillStyle = '#1c1917';
    g.font = `700 44px ${FONT}`;
    const lines = wrap(g, text, w - 100).slice(0, 5);
    const lh = 56;
    const y0 = 96 + (h - 96) / 2 - ((lines.length - 1) * lh) / 2;
    lines.forEach((l, k) => g.fillText(l, w / 2, y0 + k * lh));
    g.strokeStyle = 'rgba(0,0,0,.12)';
    g.lineWidth = 6;
    roundRect(g, 3, 3, w - 6, h - 6, 34);
    g.stroke();
  });
}

export function CardDecks({ theme }: { theme: Theme }) {
  const lang = useLang();
  const tex = useMemo(
    () => ({ chance: backTexture('chance', tr(theme.deckNames.chance)), community: backTexture('community', tr(theme.deckNames.community)) }),
    [theme.deckNames.chance, theme.deckNames.community, lang],
  );
  return (
    <>
      {(['chance', 'community'] as const).map((d) => (
        <group key={d} position={[DECK_POS[d][0], DECK_Y, DECK_POS[d][1]]} rotation={[0, DECK_YAW, 0]}>
          {/* tumpukan: lapisan kartu sedikit acak supaya terlihat seperti tumpukan nyata */}
          {Array.from({ length: 7 }, (_, k) => (
            <mesh key={k} position={[Math.sin(k * 2.1) * 0.03, 0.02 + k * 0.04, Math.cos(k * 1.7) * 0.03]} rotation={[0, Math.sin(k * 3.3) * 0.04, 0]} castShadow receiveShadow>
              <boxGeometry args={[CARD_W, 0.035, CARD_H]} />
              <meshStandardMaterial color={k % 2 ? '#f5f1e8' : '#e9e3d6'} roughness={0.85} />
            </mesh>
          ))}
          <mesh position={[0, 0.3, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <planeGeometry args={[CARD_W, CARD_H]} />
            <meshStandardMaterial map={tex[d]} roughness={0.5} />
          </mesh>
        </group>
      ))}
    </>
  );
}

export interface CardDraw {
  key: number;
  deck: 'chance' | 'community';
  id: string;
  player: string;
  delay: number;
}

/** Kartu terangkat dari tumpukan, terbang ke depan kamera sambil dibalik, ditahan, lalu kembali ke bawah tumpukan. */
export function DrawnCard({ draw, theme, state, me, onDone }: { draw: CardDraw; theme: Theme; state: Pick<GameState, 'cardDefs' | 'options' | 'players'>; me: string | null; onDone: () => void }) {
  const { camera } = useThree();
  const label = tr(draw.deck === 'chance' ? theme.deckNames.chance : theme.deckNames.community);
  const front = useMemo(() => frontTexture(draw.deck, label, cardFace(state, theme, { deck: draw.deck, card: draw.id, player: draw.player }, me).text), [draw.key]);
  const back = useMemo(() => backTexture(draw.deck, label), [draw.key]);
  useEffect(
    () => () => {
      front.dispose();
      back.dispose();
    },
    [front, back],
  );
  const ref = useRef<THREE.Group>(null!);
  const t0 = useRef(performance.now() + draw.delay);
  const tmp = useMemo(
    () => ({
      start: new THREE.Vector3(DECK_POS[draw.deck][0], DECK_Y + 0.33, DECK_POS[draw.deck][1]),
      startQ: new THREE.Quaternion().setFromEuler(new THREE.Euler(0, DECK_YAW, Math.PI)), // telungkup di atas tumpukan
      lift: new THREE.Vector3(),
      end: new THREE.Vector3(),
      endQ: new THREE.Quaternion(),
      fwd: new THREE.Vector3(),
      faceCam: new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.PI / 2, 0, 0)),
    }),
    [draw.key],
  );
  const LIFT = 350;
  const FLY = 650;
  const HOLD = 2000;
  const BACK = 450;
  useFrame(() => {
    const g = ref.current;
    if (!g) return;
    const t = performance.now() - t0.current;
    g.visible = t >= 0;
    if (t < 0) return;
    tmp.lift.copy(tmp.start).setY(DECK_Y + 1.2);
    camera.getWorldDirection(tmp.fwd);
    tmp.end.copy(camera.position).addScaledVector(tmp.fwd, 6.2);
    tmp.endQ.copy(camera.quaternion).multiply(tmp.faceCam);
    if (t < LIFT) {
      const k = t / LIFT;
      g.position.lerpVectors(tmp.start, tmp.lift, 1 - (1 - k) ** 2);
      g.quaternion.copy(tmp.startQ);
      g.scale.setScalar(1);
    } else if (t < LIFT + FLY) {
      const k = (t - LIFT) / FLY;
      const e = k < 0.5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2;
      g.position.lerpVectors(tmp.lift, tmp.end, e);
      g.quaternion.slerpQuaternions(tmp.startQ, tmp.endQ, e);
    } else if (t < LIFT + FLY + HOLD) {
      g.position.copy(tmp.end);
      g.quaternion.copy(tmp.endQ);
    } else if (t < LIFT + FLY + HOLD + BACK) {
      const k = (t - LIFT - FLY - HOLD) / BACK;
      g.position.lerpVectors(tmp.end, tmp.start, k * k);
      g.quaternion.slerpQuaternions(tmp.endQ, tmp.startQ, k);
      g.scale.setScalar(1 - k * 0.6);
    } else onDone();
  });
  return (
    <group ref={ref} visible={false}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.004, 0]}>
        <planeGeometry args={[CARD_W, CARD_H]} />
        <meshBasicMaterial map={front} toneMapped={false} transparent alphaTest={0.5} />
      </mesh>
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, -0.004, 0]}>
        <planeGeometry args={[CARD_W, CARD_H]} />
        <meshStandardMaterial map={back} transparent alphaTest={0.5} />
      </mesh>
    </group>
  );
}

// ======================= Uang kertas terbang =======================

let noteTex: THREE.CanvasTexture | null = null;
function banknote(symbol: string) {
  if (noteTex) return noteTex;
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 128;
  const g = c.getContext('2d')!;
  const grad = g.createLinearGradient(0, 0, 256, 128);
  grad.addColorStop(0, '#86efac');
  grad.addColorStop(1, '#16a34a');
  g.fillStyle = grad;
  g.fillRect(0, 0, 256, 128);
  g.strokeStyle = 'rgba(255,255,255,.7)';
  g.lineWidth = 6;
  g.strokeRect(10, 10, 236, 108);
  g.fillStyle = 'rgba(255,255,255,.9)';
  g.beginPath();
  g.ellipse(128, 64, 34, 34, 0, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = '#14532d';
  g.font = `800 40px ${FONT}`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(symbol, 128, 66);
  noteTex = new THREE.CanvasTexture(c);
  noteTex.colorSpace = THREE.SRGBColorSpace;
  return noteTex;
}

export interface Flight {
  key: number;
  from: [number, number];
  to: [number, number];
  count: number;
  delay: number;
}

function Note({ f, k, map, onDone }: { f: Flight; k: number; map: THREE.Texture; onDone?: () => void }) {
  const ref = useRef<THREE.Mesh>(null!);
  const t0 = useRef(performance.now() + f.delay + k * 90);
  const seed = useMemo(() => Math.random(), []);
  const DUR = 850;
  useFrame(() => {
    const m = ref.current;
    const t = (performance.now() - t0.current) / DUR;
    m.visible = t >= 0 && t <= 1;
    if (t < 0) return;
    if (t > 1) return onDone?.();
    const e = t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;
    const jx = (seed - 0.5) * 0.5;
    m.position.set(
      THREE.MathUtils.lerp(f.from[0], f.to[0], e) + jx * Math.sin(t * Math.PI),
      0.5 + Math.sin(t * Math.PI) * (2.2 + seed),
      THREE.MathUtils.lerp(f.from[1], f.to[1], e) + jx * Math.sin(t * Math.PI),
    );
    m.rotation.set(t * 9 + seed * 3, t * 5, t * 7 * (seed - 0.5));
  });
  return (
    <mesh ref={ref} visible={false}>
      <planeGeometry args={[0.55, 0.28]} />
      <meshBasicMaterial map={map} side={THREE.DoubleSide} toneMapped={false} />
    </mesh>
  );
}

export function MoneyFlights({ flights, symbol, onDone }: { flights: Flight[]; symbol: string; onDone: (key: number) => void }) {
  const map = useMemo(() => banknote(symbol), [symbol]);
  return (
    <>
      {flights.map((f) =>
        Array.from({ length: f.count }, (_, k) => <Note key={`${f.key}-${k}`} f={f} k={k} map={map} onDone={k === f.count - 1 ? () => onDone(f.key) : undefined} />),
      )}
    </>
  );
}

// ======================= Mendarat: gelombang + label =======================

export interface TileAnimRun {
  key: number;
  tile: number;
  t0: number;
}

export interface Landing {
  key: number;
  tile: number;
  pid: string;
}

function Ripple({ x, z, color }: { x: number; z: number; color: string }) {
  const ref = useRef<THREE.Mesh>(null!);
  const t0 = useRef(performance.now());
  useFrame(() => {
    const t = (performance.now() - t0.current) / 900;
    const m = ref.current;
    m.visible = t < 1;
    m.scale.setScalar(0.3 + t * 1.6);
    (m.material as THREE.MeshBasicMaterial).opacity = 0.8 * (1 - t);
  });
  return (
    <mesh ref={ref} position={[x, TOP + 0.02, z]} rotation={[-Math.PI / 2, 0, 0]}>
      <ringGeometry args={[0.42, 0.5, 48]} />
      <meshBasicMaterial color={color} transparent depthWrite={false} toneMapped={false} />
    </mesh>
  );
}

export function LandingFx({ landing, state, theme }: { landing: Landing; state: GameState; theme: Theme }) {
  const [x, z] = tilePos(landing.tile, 0.15);
  const p = state.players.find((q) => q.id === landing.pid);
  const tile = BOARD[landing.tile];
  const st = state.tiles[landing.tile];
  const owner = st.owner ? state.players.find((q) => q.id === st.owner) : null;
  const money = (n: number) => formatMoney(theme, n);
  let sub = '';
  if (isOwnable(landing.tile)) {
    if (!owner) sub = t('Dijual {price}', { price: money(tile.price!) });
    else if (owner.id === landing.pid) sub = t('Properti sendiri');
    else
      sub = st.mortgaged
        ? t('Milik {name} · digadai', { name: owner.name })
        : t('Milik {name} · sewa {rent}', { name: owner.name, rent: money(rentFor(state, landing.tile, state.dice[0] + state.dice[1])) });
  } else if (tile.kind === 'tax') sub = t('Bayar {amount}', { amount: money(taxFor(state, landing.pid, landing.tile)) });
  else if (tile.kind === 'chance' || tile.kind === 'community') sub = t('Ambil kartu');
  else if (tile.kind === 'gotojail') sub = t('Masuk penjara!');
  else if (tile.kind === 'go') sub = t('Terima gaji');
  else if (tile.kind === 'jail') sub = p?.inJail ? t('Dipenjara') : t('Hanya mampir');
  else if (tile.kind === 'parking') sub = t('Istirahat sejenak');
  const color = tile.kind === 'property' ? theme.groupColors[tile.group!] : '#64748b';
  return (
    <>
      <Ripple x={x} z={z} color={p?.color ?? '#fff'} />
      <Html position={[x, 1.25, z]} center zIndexRange={[20, 0]} pointerEvents="none">
        <div className="land-label" style={{ ['--c' as string]: color }}>
          <b>{tileName(theme, landing.tile)}</b>
          {sub && <span>{sub}</span>}
        </div>
      </Html>
    </>
  );
}

// ======================= Meja kayu =======================

export function woodTexture(base: string) {
  const c = document.createElement('canvas');
  c.width = c.height = 1024;
  const g = c.getContext('2d')!;
  g.fillStyle = base;
  g.fillRect(0, 0, 1024, 1024);
  // serat kayu: garis bergelombang dengan variasi gelap/terang
  for (let i = 0; i < 180; i++) {
    const y0 = (i / 180) * 1024;
    const amp = 6 + ((i * 37) % 13);
    const freq = 0.004 + ((i * 17) % 7) * 0.0012;
    g.beginPath();
    for (let x = 0; x <= 1024; x += 16) {
      const y = y0 + Math.sin(x * freq + i) * amp + Math.sin(x * 0.02 + i * 3) * 2;
      if (x === 0) g.moveTo(x, y);
      else g.lineTo(x, y);
    }
    g.strokeStyle = i % 3 === 0 ? 'rgba(0,0,0,.32)' : i % 3 === 1 ? 'rgba(255,255,255,.08)' : 'rgba(0,0,0,.12)';
    g.lineWidth = 1 + (i % 4);
    g.stroke();
  }
  // mata kayu
  for (let k = 0; k < 6; k++) {
    const x = (k * 389) % 1024;
    const y = (k * 613) % 1024;
    for (let r = 4; r < 40; r += 5) {
      g.beginPath();
      g.ellipse(x, y, r * 2.2, r, 0, 0, Math.PI * 2);
      g.strokeStyle = 'rgba(0,0,0,.12)';
      g.lineWidth = 2;
      g.stroke();
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 8;
  return t;
}

/** Hook: ubah event baru menjadi antrean efek (kartu, uang, mendarat ditangani Token). */
export function useEventFx(state: GameState | null, stepMs: number, theme: Theme) {
  const themeRef = useRef(theme);
  themeRef.current = theme;
  const seen = useRef(state?.seq ?? 0);
  const [cards, setCards] = useState<CardDraw[]>([]);
  const [flights, setFlights] = useState<Flight[]>([]);
  const [landings, setLandings] = useState<Landing[]>([]);
  const [anims, setAnims] = useState<TileAnimRun[]>([]);
  // tombol "Putar animasi" di kartu akta
  useEffect(() => {
    const on = (e: Event) => {
      const run: TileAnimRun = { key: performance.now(), tile: (e as CustomEvent<number>).detail, t0: performance.now() };
      setAnims([run]);
      setTimeout(() => setAnims((x) => x.filter((y) => y.key !== run.key)), TILE_ANIM_MS + 100);
    };
    addEventListener(PLAY_ANIM_EVENT, on);
    return () => removeEventListener(PLAY_ANIM_EVENT, on);
  }, []);
  useEffect(() => {
    if (!state) return;
    const fresh = state.events.filter((e) => e.seq > seen.current);
    if (seen.current === 0) {
      // pertama kali mount (muat game / masuk room): jangan putar ulang riwayat
      seen.current = state.seq;
      return;
    }
    seen.current = state.seq;
    if (!fresh.length) return;
    const delay = landingDelay(fresh, stepMs);
    const pos = (id: string | null): [number, number] => {
      const p = id ? state.players.find((q) => q.id === id) : null;
      return p ? tilePos(p.pos, 0.15) : [0, 0];
    };
    const newCards: CardDraw[] = [];
    const newFlights: Flight[] = [];
    for (const e of fresh) {
      if (e.type === 'card') newCards.push({ key: e.seq, deck: e.deck, id: e.card, player: e.player, delay });
      if (e.type === 'pay' && e.amount > 0) {
        newFlights.push({ key: e.seq, from: pos(e.from), to: pos(e.to), count: Math.min(6, 1 + Math.floor(e.amount / 80)), delay: e.reason === 'go' ? 0 : delay });
      }
      if (e.type === 'buy') newFlights.push({ key: e.seq, from: pos(e.player), to: [0, 0], count: Math.min(5, 1 + Math.floor(e.price / 100)), delay: 0 });
    }
    if (newCards.length) setCards((c) => [...c, ...newCards]);
    if (newFlights.length) setFlights((f) => [...f, ...newFlights].slice(-12));
    // label mendarat: gerakan maju terakhir di batch ini, setelah bidak sampai
    const lastMove = [...fresh].reverse().find((e) => e.type === 'move' && !e.direct);
    if (lastMove && lastMove.type === 'move') {
      const l: Landing = { key: lastMove.seq, tile: lastMove.to, pid: lastMove.player };
      setTimeout(() => setLandings((x) => [...x, l]), Math.max(0, delay - 120));
      // animasi khas petak (kuda di Kupang, dst.) — satu saja sekaligus, yang terbaru menggantikan
      if (tileAnimOn() && tileAnimFor(themeRef.current, l.tile)) {
        setTimeout(() => {
          const run: TileAnimRun = { key: l.key, tile: l.tile, t0: performance.now() };
          setAnims([run]);
          setTimeout(() => setAnims((x) => x.filter((y) => y.key !== run.key)), TILE_ANIM_MS + 100);
        }, Math.max(0, delay - 60));
      }
      setTimeout(() => setLandings((x) => x.filter((y) => y.key !== l.key)), delay + 1700);
    }
  }, [state?.seq]);
  return {
    cards,
    flights,
    landings,
    anims,
    doneCard: (key: number) => setCards((c) => c.filter((x) => x.key !== key)),
    doneFlight: (key: number) => setFlights((f) => f.filter((x) => x.key !== key)),
  };
}

