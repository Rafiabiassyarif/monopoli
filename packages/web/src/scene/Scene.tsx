// Scene 3D: meja, papan, bidak bertema, dadu, rumah/hotel, penanda pemilik.

import { useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, type ThreeEvent } from '@react-three/fiber';
import { ContactShadows, Environment, Lightformer, OrbitControls, Sparkles } from '@react-three/drei';
import * as THREE from 'three';
import { BOARD, JAIL_INDEX, type GameState, type Theme } from '@monopoli/engine';
import { HALF, fontReady, makeBoardTexture, pointToTile, tilePos, tileRotY } from './layout';
import { BASE_Y, Island } from './Island';
import { useThree } from '@react-three/fiber';
import { Decor } from './Decor';
import { CameraShake, CardDecks, DicePair, DrawnCard, LandingFx, MoneyFlights, TOP, fx, useEventFx, woodTexture } from './Fx';
import { CityBeacon } from './City3DLandmark';
import { TileAnim } from './TileAnims';
import { tr, useLang } from '../i18n';

// ---------- papan ----------
/** kotak tiap petak (posisi tengah & ukuran di bidang XZ) */
function tileRect(i: number) {
  const [x, z] = tilePos(i);
  const corner = i % 10 === 0;
  const odd = Math.floor(i / 10) % 2 === 1;
  const sx = corner ? 1.5 : odd ? 1.5 : 1;
  const sz = corner ? 1.5 : odd ? 1 : 1.5;
  return { x, z, sx, sz };
}
const GAP = 0.05;

function Board({ theme, onTile, onHover }: { theme: Theme; onTile: (i: number) => void; onHover: (i: number | null) => void }) {
  const [fontOk, setFontOk] = useState(false);
  const lang = useLang();
  useEffect(() => void fontReady().then(setFontOk), []);
  const tex = useMemo(() => makeBoardTexture(theme, !/Mobi|Android/i.test(navigator.userAgent)), [theme, fontOk, lang]);
  useEffect(() => () => tex.dispose(), [tex]);
  const wood = useMemo(() => woodTexture(theme.visual.table), [theme.visual.table]);
  useEffect(() => () => wood.dispose(), [wood]);

  // permukaan semua petak digabung jadi satu geometri (1 draw call), UV mengambil bagian tekstur papan
  const tops = useMemo(() => {
    const pos: number[] = [];
    const uv: number[] = [];
    const idx: number[] = [];
    for (let i = 0; i < 40; i++) {
      const r = tileRect(i);
      const x0 = r.x - r.sx / 2 + GAP;
      const x1 = r.x + r.sx / 2 - GAP;
      const z0 = r.z - r.sz / 2 + GAP;
      const z1 = r.z + r.sz / 2 - GAP;
      const b = pos.length / 3;
      for (const [x, z] of [
        [x0, z0],
        [x1, z0],
        [x1, z1],
        [x0, z1],
      ]) {
        pos.push(x, 0, z);
        uv.push((x + HALF) / (HALF * 2), (HALF - z) / (HALF * 2));
      }
      idx.push(b, b + 2, b + 1, b, b + 3, b + 2);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setIndex(idx);
    g.computeVertexNormals();
    return g;
  }, []);
  useEffect(() => () => tops.dispose(), [tops]);

  // badan petak (timbul): properti berwarna kompleksnya, petak lain warna papan
  const bodies = useRef<THREE.InstancedMesh>(null!);
  useEffect(() => {
    const m = new THREE.Matrix4();
    const c = new THREE.Color();
    const h = TOP - BASE_Y;
    for (let i = 0; i < 40; i++) {
      const r = tileRect(i);
      m.compose(new THREE.Vector3(r.x, BASE_Y + h / 2, r.z), new THREE.Quaternion(), new THREE.Vector3(r.sx - GAP * 2, h, r.sz - GAP * 2));
      bodies.current.setMatrixAt(i, m);
      const t = BOARD[i];
      c.set(t.kind === 'property' ? theme.groupColors[t.group!] : theme.visual.board).multiplyScalar(t.kind === 'property' ? 0.85 : 0.82);
      bodies.current.setColorAt(i, c);
    }
    bodies.current.instanceMatrix.needsUpdate = true;
    if (bodies.current.instanceColor) bodies.current.instanceColor.needsUpdate = true;
  }, [theme]);

  const click = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    const i = pointToTile(e.point.x, e.point.z);
    if (i >= 0) onTile(i);
  };
  return (
    <group>
      <mesh
        geometry={tops}
        position={[0, TOP + 0.001, 0]}
        receiveShadow
        onClick={click}
        onPointerMove={(e) => {
          const i = pointToTile(e.point.x, e.point.z);
          onHover(i >= 0 ? i : null);
          document.body.style.cursor = i >= 0 ? 'pointer' : '';
        }}
        onPointerOut={() => {
          onHover(null);
          document.body.style.cursor = '';
        }}
      >
        <meshStandardMaterial map={tex} roughness={0.55} metalness={0.05} />
      </mesh>
      <instancedMesh ref={bodies} args={[undefined, undefined, 40]} castShadow receiveShadow>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial roughness={0.5} metalness={0.05} />
      </instancedMesh>
      {/* alas papan (terlihat di sela-sela petak) */}
      <mesh position={[0, 0, 0]} receiveShadow castShadow>
        <boxGeometry args={[12, 0.3, 12]} />
        <meshStandardMaterial color={theme.visual.boardCenter} roughness={0.5} />
      </mesh>
      {/* meja kayu */}
      <mesh position={[0, -0.45, 0]} receiveShadow>
        <cylinderGeometry args={[11, 11.4, 0.6, 64]} />
        <meshStandardMaterial map={wood} color="#ffffff" roughness={0.55} metalness={0.05} />
      </mesh>
      {/* bingkai papan */}
      <mesh position={[0, -0.02, 0]} receiveShadow castShadow>
        <boxGeometry args={[12.5, 0.26, 12.5]} />
        <meshStandardMaterial color={theme.visual.boardCenter} roughness={0.4} metalness={0.15} />
      </mesh>
      <mesh position={[0, -0.14, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[10.2, 10.9, 64]} />
        <meshStandardMaterial color={theme.visual.accent} metalness={0.6} roughness={0.3} />
      </mesh>
      <Island theme={theme} deckLabels={{ chance: tr(theme.deckNames.chance), community: tr(theme.deckNames.community) }} />
    </group>
  );
}

// ---------- bidak ----------
function TokenShape({ kind, color }: { kind: number; color: string }) {
  // metal rendah supaya warna pemain tetap cerah walau lingkungan gelap
  const mat = <meshStandardMaterial color={color} metalness={0.35} roughness={0.28} emissive={color} emissiveIntensity={0.18} />;
  switch (kind % 6) {
    case 0: // pion
      return (
        <group>
          <mesh position={[0, 0.08, 0]} castShadow>
            <cylinderGeometry args={[0.2, 0.24, 0.16, 24]} />
            {mat}
          </mesh>
          <mesh position={[0, 0.32, 0]} castShadow>
            <cylinderGeometry args={[0.07, 0.16, 0.34, 24]} />
            {mat}
          </mesh>
          <mesh position={[0, 0.56, 0]} castShadow>
            <sphereGeometry args={[0.13, 24, 16]} />
            {mat}
          </mesh>
        </group>
      );
    case 1: // perahu
      return (
        <group>
          <mesh position={[0, 0.1, 0]} scale={[1, 0.5, 0.45]} castShadow>
            <sphereGeometry args={[0.28, 24, 12, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2]} />
            {mat}
          </mesh>
          <mesh position={[0, 0.35, 0]} castShadow>
            <cylinderGeometry args={[0.02, 0.02, 0.5]} />
            {mat}
          </mesh>
          <mesh position={[0.08, 0.38, 0]} rotation={[0, 0, -0.1]} castShadow>
            <coneGeometry args={[0.14, 0.38, 3]} />
            <meshStandardMaterial color="#fafafa" roughness={0.6} />
          </mesh>
        </group>
      );
    case 2: // mahkota
      return (
        <group position={[0, 0.05, 0]}>
          <mesh position={[0, 0.12, 0]} castShadow>
            <cylinderGeometry args={[0.2, 0.18, 0.2, 24, 1, true]} />
            <meshStandardMaterial color={color} metalness={0.9} roughness={0.2} side={THREE.DoubleSide} />
          </mesh>
          {[0, 1, 2, 3, 4].map((k) => (
            <mesh key={k} position={[Math.cos((k * Math.PI * 2) / 5) * 0.18, 0.3, Math.sin((k * Math.PI * 2) / 5) * 0.18]} castShadow>
              <coneGeometry args={[0.05, 0.16, 6]} />
              {mat}
            </mesh>
          ))}
          <mesh position={[0, 0.05, 0]}>
            <cylinderGeometry args={[0.19, 0.19, 0.1, 24]} />
            {mat}
          </mesh>
        </group>
      );
    case 3: // roket
      return (
        <group>
          <mesh position={[0, 0.32, 0]} castShadow>
            <capsuleGeometry args={[0.11, 0.3, 8, 16]} />
            {mat}
          </mesh>
          {[0, 1, 2].map((k) => (
            <mesh key={k} position={[Math.cos((k * Math.PI * 2) / 3) * 0.12, 0.1, Math.sin((k * Math.PI * 2) / 3) * 0.12]} rotation={[0, -(k * Math.PI * 2) / 3, 0]} castShadow>
              <boxGeometry args={[0.12, 0.18, 0.02]} />
              <meshStandardMaterial color="#eeeeee" metalness={0.5} roughness={0.3} />
            </mesh>
          ))}
        </group>
      );
    case 4: // topi
      return (
        <group>
          <mesh position={[0, 0.03, 0]} castShadow>
            <cylinderGeometry args={[0.28, 0.28, 0.04, 32]} />
            {mat}
          </mesh>
          <mesh position={[0, 0.24, 0]} castShadow>
            <cylinderGeometry args={[0.16, 0.17, 0.4, 32]} />
            {mat}
          </mesh>
          <mesh position={[0, 0.1, 0]}>
            <cylinderGeometry args={[0.175, 0.175, 0.06, 32]} />
            <meshStandardMaterial color="#111" />
          </mesh>
        </group>
      );
    default: // permata
      return (
        <group>
          <mesh position={[0, 0.34, 0]} castShadow>
            <octahedronGeometry args={[0.24, 0]} />
            <meshPhysicalMaterial color={color} metalness={0.2} roughness={0.05} transmission={0.4} thickness={0.5} clearcoat={1} />
          </mesh>
          <mesh position={[0, 0.04, 0]}>
            <cylinderGeometry args={[0.16, 0.2, 0.08, 6]} />
            <meshStandardMaterial color="#d4af37" metalness={0.9} roughness={0.25} />
          </mesh>
        </group>
      );
  }
}

const spot = (tile: number, inJail: boolean, slot: number, count: number): THREE.Vector3 => {
  // pemain di penjara berdiri di dalam sel, yang "hanya mampir" di tepi luar
  // beberapa bidak di satu petak disebar melingkar di sekitar titik tengah
  const [cx, cz] = tile === JAIL_INDEX ? (inJail ? tilePos(tile, 0.35) : tilePos(tile, -0.4)) : tilePos(tile, 0.15);
  if (count < 2) return new THREE.Vector3(cx, TOP, cz);
  const a = (slot / count) * Math.PI * 2 + Math.PI / 4;
  const r = tile % 10 === 0 ? 0.36 : 0.26;
  return new THREE.Vector3(cx + Math.cos(a) * r, TOP, cz + Math.sin(a) * r);
};

function Token({ p, idx, total, active, stepMs }: { p: GameState['players'][0]; idx: number; total: number; active: boolean; stepMs: number }) {
  const ref = useRef<THREE.Group>(null!);
  const shown = useRef(p.pos);
  const anim = useRef({ from: new THREE.Vector3(), to: new THREE.Vector3(), t: 1, hop: true });

  useFrame((_, dt) => {
    const g = ref.current;
    if (!g) return;
    const a = anim.current;
    if (a.t >= 1) {
      if (shown.current !== p.pos) {
        // langkah berikutnya: maju 1 petak; mundur / ke penjara = langsung
        const fwd = (p.pos - shown.current + 40) % 40;
        const direct = fwd > 12 || (p.inJail && p.pos === JAIL_INDEX);
        // tunggu dadu berhenti menggelinding sebelum bidak melangkah
        if (!direct && performance.now() < fx.diceSettleAt) return;
        const next = direct ? p.pos : (shown.current + 1) % 40;
        a.from.copy(g.position);
        a.to.copy(spot(next, p.inJail, idx, total));
        a.t = 0;
        a.hop = !direct;
        shown.current = next;
      } else {
        g.position.lerp(spot(p.pos, p.inJail, idx, total), Math.min(1, dt * 6));
      }
    }
    if (a.t < 1) {
      a.t = Math.min(1, a.t + (dt * 1000) / (a.hop ? stepMs : stepMs * 3));
      const e = a.t < 0.5 ? 2 * a.t * a.t : 1 - (-2 * a.t + 2) ** 2 / 2;
      g.position.lerpVectors(a.from, a.to, e);
      g.position.y = TOP + (a.hop ? Math.sin(a.t * Math.PI) * 0.45 : Math.sin(a.t * Math.PI) * 1.2);
    }
    const target = tileRotY(shown.current) + Math.PI;
    g.rotation.y += (target - g.rotation.y) * Math.min(1, dt * 5);
    const bob = 1.35 * (active && a.t >= 1 ? 1 + Math.sin(performance.now() / 250) * 0.05 : 1);
    g.scale.setScalar(bob);
  });

  useEffect(() => {
    ref.current.position.copy(spot(p.pos, p.inJail, idx, total));
    shown.current = p.pos;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (p.bankrupt) return null;
  return (
    <group ref={ref}>
      <TokenShape kind={p.token} color={p.color} />
      {active && (
        <mesh position={[0, 0.01, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.3, 0.36, 32]} />
          <meshBasicMaterial color={p.color} toneMapped={false} />
        </mesh>
      )}
    </group>
  );
}

// ---------- bangunan & kepemilikan ----------
function Holdings({ state }: { state: GameState }) {
  const color = (id: string) => state.players.find((p) => p.id === id)?.color ?? '#fff';
  return (
    <group>
      {state.tiles.map((t, i) => {
        if (!t.owner) return null;
        const [ox, oz] = tilePos(i, -0.6);
        const r = tileRotY(i);
        const houses: JSX.Element[] = [];
        if (t.houses === 5) {
          const [x, z] = tilePos(i, 0.6);
          houses.push(
            <group key="h" position={[x, TOP, z]} rotation={[0, r, 0]}>
              <mesh position={[0, 0.14, 0]} castShadow>
                <boxGeometry args={[0.7, 0.28, 0.28]} />
                <meshStandardMaterial color="#d32f2f" roughness={0.4} />
              </mesh>
              <mesh position={[0, 0.34, 0]} rotation={[0, 0, 0]} castShadow>
                <boxGeometry args={[0.74, 0.1, 0.32]} />
                <meshStandardMaterial color="#8e1b1b" />
              </mesh>
            </group>,
          );
        } else {
          for (let h = 0; h < t.houses; h++) {
            const [x, z] = tilePos(i, 0.6, (h - 1.5) * 0.22);
            houses.push(
              <group key={h} position={[x, TOP, z]} rotation={[0, r, 0]}>
                <mesh position={[0, 0.08, 0]} castShadow>
                  <boxGeometry args={[0.17, 0.16, 0.17]} />
                  <meshStandardMaterial color="#2e9d4a" roughness={0.4} />
                </mesh>
                <mesh position={[0, 0.2, 0]} rotation={[0, Math.PI / 4, 0]} castShadow>
                  <coneGeometry args={[0.15, 0.12, 4]} />
                  <meshStandardMaterial color="#1b6b31" />
                </mesh>
              </group>,
            );
          }
        }
        return (
          <group key={i}>
            <mesh position={[ox, TOP + 0.05, oz]} rotation={[0, r, 0]} castShadow>
              <boxGeometry args={[0.9, 0.1, 0.26]} />
              <meshStandardMaterial
                color={t.mortgaged ? '#777' : color(t.owner)}
                emissive={t.mortgaged ? '#000' : color(t.owner)}
                emissiveIntensity={0.35}
                metalness={0.3}
                roughness={0.4}
              />
            </mesh>
            {houses}
          </group>
        );
      })}
    </group>
  );
}

function Highlight({ tile }: { tile: number | null }) {
  const ref = useRef<THREE.Mesh>(null!);
  useFrame(() => {
    if (ref.current) (ref.current.material as THREE.MeshBasicMaterial).opacity = 0.25 + Math.sin(performance.now() / 200) * 0.15;
  });
  if (tile === null) return null;
  const corner = tile % 10 === 0;
  const [x, z] = tilePos(tile);
  return (
    <mesh ref={ref} position={[x, TOP + 0.005, z]} rotation={[-Math.PI / 2, 0, tileRotY(tile)]}>
      <planeGeometry args={corner ? [1.5, 1.5] : [1, 1.5]} />
      <meshBasicMaterial color="#ffffff" transparent opacity={0.3} depthWrite={false} />
    </mesh>
  );
}

// ---------- scene utama ----------
function SceneFx({ state, theme, stepMs, me }: { state: GameState; theme: Theme; stepMs: number; me: string | null }) {
  const { cards, flights, landings, anims, doneCard, doneFlight } = useEventFx(state, stepMs, theme);
  return (
    <>
      {cards.slice(0, 1).map((c) => (
        <DrawnCard key={c.key} draw={c} theme={theme} state={state} me={me} onDone={() => doneCard(c.key)} />
      ))}
      <MoneyFlights flights={flights} symbol={theme.currency.symbol} onDone={doneFlight} />
      {anims.map((a) => (
        <TileAnim key={a.key} tile={a.tile} theme={theme} t0={a.t0} />
      ))}
      {landings.map((l) => (
        <LandingFx key={l.key} landing={l} state={state} theme={theme} />
      ))}
    </>
  );
}

export type CamMode = 'free' | 'follow' | 'top';

/** Geser pusat render ke atas sebesar setengah tinggi dock HUD, supaya papan tidak tertutup panel bawah. */
function ViewOffset({ bottom, top = 0 }: { bottom: number; top?: number }) {
  const { camera, size, controls } = useThree() as unknown as { camera: THREE.PerspectiveCamera; size: { width: number; height: number }; controls: { target: THREE.Vector3; update: () => void } | null };
  const wasPortrait = useRef<boolean | null>(null);
  useEffect(() => {
    const cam = camera;
    const aspect = size.width / Math.max(1, size.height);
    const portrait = aspect < 0.9;
    // layar potret (HP/tablet tegak): kamera lebih dari atas supaya papan tidak "mengecil" ke belakang
    if (wasPortrait.current !== portrait) {
      if (wasPortrait.current !== null || portrait) {
        cam.position.set(0, portrait ? 24 : 21, portrait ? 8 : 12.5);
        controls?.update();
      }
      wasPortrait.current = portrait;
    }
    const shift = (bottom - top) / 2;
    if (shift !== 0) cam.setViewOffset(size.width, size.height, 0, shift, size.width, size.height);
    else cam.clearViewOffset();
    // layar sempit: zoom pas supaya seluruh lebar papan (12 unit + sedikit tepi) terlihat
    if (aspect < 1.15) {
      const target = controls?.target ?? new THREE.Vector3(0, 0, 1.2);
      const d = cam.position.distanceTo(target);
      const tanH = Math.tan(THREE.MathUtils.degToRad(cam.fov / 2));
      const visW = 2 * d * tanH * aspect;
      // tinggi layar yang benar-benar kosong (tanpa dock & strip pemain) juga dibatasi
      const free = Math.max(0.3, (size.height - bottom - top - 70) / size.height);
      const visH = 2 * d * tanH * free;
      cam.zoom = Math.max(0.45, Math.min(1, visW / 13.2, visH / 12.5));
    } else cam.zoom = 1;
    cam.updateProjectionMatrix();
  }, [camera, controls, size.width, size.height, bottom, top]);
  return null;
}

/** Arahkan kamera mulus. follow = ikuti bidak aktif, top = pandangan atas penuh, free = bebas diputar. */
function CameraRig({ mode, focus }: { mode: CamMode; focus: [number, number] | null }) {
  const { camera, controls } = useThree() as unknown as { camera: THREE.PerspectiveCamera; controls: { target: THREE.Vector3; update: () => void } | null };
  const tgt = useRef(new THREE.Vector3());
  const pos = useRef(new THREE.Vector3());
  const settle = useRef(0);
  useEffect(() => {
    settle.current = 1.4; // detik transisi setelah ganti mode/fokus
  }, [mode, focus?.[0], focus?.[1]]);
  useFrame((_, dt) => {
    if (!controls || mode === 'free' || settle.current <= 0) return;
    if (mode === 'follow') settle.current = 1; // terus mengikuti
    else settle.current -= dt;
    if (mode === 'top') {
      tgt.current.set(0, 0, 0.3);
      pos.current.set(0, 23, 3.5);
    } else if (focus) {
      tgt.current.set(focus[0] * 0.75, 0, focus[1] * 0.75 + 0.6);
      // kamera berdiri di sisi luar petak, sedikit di atas
      const len = Math.hypot(focus[0], focus[1]) || 1;
      pos.current.set(focus[0] * 0.75 + (focus[0] / len) * 7, 9.5, focus[1] * 0.75 + (focus[1] / len) * 7 + 4);
    }
    const k = Math.min(1, dt * 2.2);
    controls.target.lerp(tgt.current, k);
    camera.position.lerp(pos.current, k);
    controls.update();
  });
  return null;
}

export interface SceneProps {
  state: GameState | null;
  theme: Theme;
  selected: number | null;
  hovered?: number | null;
  onTile: (i: number) => void;
  onHover: (i: number | null) => void;
  rollKey: number;
  stepMs: number;
  camMode: CamMode;
  /** tinggi panel bawah (px) yang menutupi kanvas */
  bottomInset?: number;
  /** tinggi strip pemain di atas (layar tegak) → papan digeser ke bawah */
  topInset?: number;
  /** true = di balik menu (render hemat) */
  idle?: boolean;
  /** dipanggil sekali kalau 3D terus-menerus di bawah ±20 fps saat bermain */
  onLowFps?: () => void;
  /** pemain di layar ini (online) — isi kartu orang lain disembunyikan */
  me?: string | null;
}

/** Ukur fps saat bermain; dua jendela 5 detik berturut-turut di bawah 20 fps → laporkan sekali. */
function FpsWatch({ active, onLow }: { active: boolean; onLow?: () => void }) {
  const w = useRef({ frames: 0, start: 0, bad: 0, done: false, warm: 0, last: 0 });
  useFrame(() => {
    const s = w.current;
    if (!active || s.done || !onLow) return;
    const now = performance.now();
    if (!s.warm) s.warm = now + 4000; // beri waktu kompilasi shader & muat tekstur
    if (now < s.warm) return;
    // tab disembunyikan / jeda panjang → mulai ulang jendela ukur (bukan tanda perangkat lambat)
    if (!s.start || now - s.last > 1000) {
      s.start = now;
      s.frames = 0;
    }
    s.last = now;
    s.frames++;
    if (now - s.start >= 5000) {
      const fps = (s.frames * 1000) / (now - s.start);
      s.bad = fps < 20 ? s.bad + 1 : 0;
      s.frames = 0;
      s.start = now;
      if (s.bad >= 2) {
        s.done = true;
        onLow();
      }
    }
  });
  return null;
}

export function GameScene({ state, theme, selected, hovered, onTile, onHover, rollKey, stepMs, camMode, bottomInset = 0, topInset = 0, idle = false, onLowFps, me = null }: SceneProps) {
  const [low] = useState(() => /Mobi|Android/i.test(navigator.userAgent) || (navigator.hardwareConcurrency ?? 8) <= 4);
  // di balik menu: resolusi rendah supaya hemat baterai/GPU; gerak dikurangi → render hanya saat perlu
  const [still] = useState(() => matchMedia('(prefers-reduced-motion: reduce)').matches);
  const v = theme.visual;
  const cur = state ? state.players[state.current] : null;
  return (
    <Canvas
      shadows={!low}
      dpr={idle ? [0.6, 1] : low ? [1, 1.5] : [1, 2]}
      frameloop={still && idle ? 'demand' : 'always'}
      performance={{ min: 0.5 }}
      camera={{ position: [0, 21, 12.5], fov: 44 }}
      gl={{ antialias: true, alpha: true, toneMapping: THREE.ACESFilmicToneMapping }}
      style={{ background: `linear-gradient(${v.sky[0]}, ${v.sky[1]})` }}
    >
      <fog attach="fog" args={[v.fog, 26, 60]} />
      <ViewOffset bottom={bottomInset} top={topInset} />
      <hemisphereLight args={[v.sky[0], v.table, 0.6]} />
      <directionalLight
        position={[8, 16, 6]}
        intensity={2.2}
        color={v.lightColor}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-14}
        shadow-camera-right={14}
        shadow-camera-top={14}
        shadow-camera-bottom={-14}
        shadow-bias={-0.0005}
      />
      <Environment resolution={128}>
        <Lightformer intensity={2} position={[0, 5, -5]} scale={[10, 3, 1]} color={v.lightColor} />
        <Lightformer intensity={1.2} position={[-6, 3, 4]} scale={[4, 4, 1]} color={v.sky[0]} />
        <Lightformer intensity={0.8} position={[6, 2, 4]} scale={[4, 4, 1]} color={v.accent} />
      </Environment>

      <Board theme={theme} onTile={onTile} onHover={onHover} />
      {state && <CameraRig mode={camMode} focus={cur && !cur.bankrupt ? tilePos(cur.pos) : null} />}
      <Decor theme={theme} />
      {hovered !== null && hovered !== undefined && hovered !== selected && <Highlight tile={hovered} />}
      {selected !== null && <CityBeacon tile={selected} theme={theme} state={state} onTileClick={onTile} />}
      {state && (
        <>
          <Holdings state={state} />
          {state.players.map((p) => {
            const same = state.players.filter((q) => !q.bankrupt && q.pos === p.pos && q.inJail === p.inJail);
            return <Token key={p.id} p={p} idx={same.indexOf(p)} total={same.length} active={cur?.id === p.id} stepMs={stepMs} />;
          })}
          <DicePair dice={state.dice} rollKey={rollKey} from={cur ? tilePos(cur.pos, -1.2) : [0, 4]} />
          <SceneFx state={state} theme={theme} stepMs={stepMs} me={me} />
        </>
      )}
      <CardDecks theme={theme} />
      <CameraShake />
      <FpsWatch active={!idle && !!state} onLow={onLowFps} />
      {!low && <Sparkles count={60} scale={[24, 6, 24]} position={[0, 3, 0]} size={2} speed={0.3} opacity={0.5} color={v.lightColor} />}
      <ContactShadows position={[0, -0.14, 0]} opacity={0.4} scale={30} blur={2.5} far={4} />
      <OrbitControls
        makeDefault
        target={[0, 0, 1.2]}
        minDistance={7}
        maxDistance={30}
        maxPolarAngle={Math.PI / 2.25}
        enablePan={false}
        autoRotate={!state}
        autoRotateSpeed={0.6}
      />
    </Canvas>
  );
}
