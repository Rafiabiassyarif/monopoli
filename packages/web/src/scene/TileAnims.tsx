// Animasi 3D khas tiap petak saat bidak mendarat — semuanya prosedural (bentuk dasar three.js), tanpa file model.
// Koordinat lokal: +x = sepanjang sisi papan, +z = ke arah luar papan (ke pemain), y = ke atas. Area ±1.3.

import { useMemo, useRef, type ReactNode } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as THREE from 'three';
import { BOARD, type Theme } from '@monopoli/engine';
import { TILE_ANIM_MS, tileAnimFor, type AnimId } from '../tileAnims';
import { TOP } from './Fx';
import { tilePos, tileRotY } from './layout';
import { tr } from '../i18n';

const DUR = TILE_ANIM_MS / 1000;

interface P {
  t0: number;
  color: string;
  accent: string;
}

const sec = (t0: number) => (performance.now() - t0) / 1000;
const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const easeOut = (v: number) => 1 - (1 - v) ** 3;
const easeIn = (v: number) => v * v * v;

/** Bilangan acak deterministik per partikel (supaya tidak berubah tiap render). */
function rng(seed: number) {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), s | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function Mat({ c, e = 0, m = 0.1, r = 0.6, o, flat }: { c: string; e?: number; m?: number; r?: number; o?: number; flat?: boolean }) {
  return (
    <meshStandardMaterial
      color={c}
      emissive={e ? c : '#000000'}
      emissiveIntensity={e}
      metalness={m}
      roughness={r}
      transparent={o !== undefined}
      opacity={o ?? 1}
      depthWrite={o === undefined}
      flatShading={flat}
    />
  );
}

/** Kotak, silinder, bola ringkas. */
const Box = ({ s, p = [0, 0, 0], r, c, e, children }: { s: [number, number, number]; p?: [number, number, number]; r?: [number, number, number]; c: string; e?: number; children?: ReactNode }) => (
  <mesh position={p} rotation={r} castShadow>
    <boxGeometry args={s} />
    <Mat c={c} e={e} />
    {children}
  </mesh>
);
const Cyl = ({ a, p = [0, 0, 0], r, c, e, m }: { a: [number, number, number, number?]; p?: [number, number, number]; r?: [number, number, number]; c: string; e?: number; m?: number }) => (
  <mesh position={p} rotation={r} castShadow>
    <cylinderGeometry args={[a[0], a[1], a[2], a[3] ?? 16]} />
    <Mat c={c} e={e} m={m} />
  </mesh>
);
const Ball = ({ rad, p = [0, 0, 0], s, c, e, o }: { rad: number; p?: [number, number, number]; s?: [number, number, number]; c: string; e?: number; o?: number }) => (
  <mesh position={p} scale={s} castShadow={o === undefined}>
    <sphereGeometry args={[rad, 16, 12]} />
    <Mat c={c} e={e} o={o} />
  </mesh>
);

// ======================= partikel (InstancedMesh) =======================

interface SprayProps {
  count: number;
  colors: string[];
  size: number;
  origin?: [number, number, number];
  /** kecepatan awal partikel ke-i */
  vel: (r: () => number, i: number) => [number, number, number];
  /** posisi awal tambahan (sebaran) */
  spread?: (r: () => number, i: number) => [number, number, number];
  gravity?: number;
  life: number;
  /** partikel dipancarkan bertahap selama sekian detik */
  emit?: number;
  /** mulai setelah sekian detik */
  delay?: number;
  loop?: boolean;
  shape?: 'ball' | 'box' | 'coin' | 'note' | 'flat';
  spin?: number;
  glow?: number;
  grow?: number;
  fade?: boolean;
  t0: number;
  seed?: number;
}

function Spray({ count, colors, size, origin = [0, 0, 0], vel, spread, gravity = -3, life, emit = 0, delay = 0, loop, shape = 'ball', spin = 0, glow = 0, grow = 0, fade, t0, seed = 1 }: SprayProps) {
  const ref = useRef<THREE.InstancedMesh>(null!);
  const data = useMemo(() => {
    const r = rng(seed);
    return Array.from({ length: count }, (_, i) => ({
      v: vel(r, i),
      o: spread ? spread(r, i) : ([0, 0, 0] as [number, number, number]),
      start: emit ? (i / count) * emit : 0,
      rot: [r() * 6, r() * 6, r() * 6],
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [count, seed]);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const geo = useMemo(() => {
    if (shape === 'box') return new THREE.BoxGeometry(1, 1, 1);
    if (shape === 'coin') return new THREE.CylinderGeometry(0.5, 0.5, 0.15, 14);
    if (shape === 'flat') return new THREE.BoxGeometry(1, 0.08, 0.6);
    if (shape === 'note') return new THREE.OctahedronGeometry(0.6, 0);
    return new THREE.SphereGeometry(0.5, 8, 6);
  }, [shape]);
  const colorArr = useMemo(() => {
    const c = new THREE.Color();
    const arr = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      c.set(colors[i % colors.length]);
      arr.set([c.r, c.g, c.b], i * 3);
    }
    return arr;
  }, [count, colors]);
  useFrame(() => {
    const m = ref.current;
    if (!m) return;
    const e = sec(t0) - delay;
    data.forEach((d, i) => {
      let a = e - d.start;
      if (loop && a > 0) a %= life;
      if (a < 0 || a > life) {
        dummy.scale.setScalar(0);
      } else {
        const k = a / life;
        dummy.position.set(origin[0] + d.o[0] + d.v[0] * a, origin[1] + d.o[1] + d.v[1] * a + 0.5 * gravity * a * a, origin[2] + d.o[2] + d.v[2] * a);
        dummy.rotation.set(d.rot[0] + a * spin, d.rot[1] + a * spin, d.rot[2]);
        // ukuran = diameter partikel (geometri satuan berdiameter 1)
        const sc = size * 2 * Math.max(0.05, 1 + grow * k) * (fade ? 1 - k * 0.85 : 1);
        dummy.scale.setScalar(sc);
      }
      dummy.updateMatrix();
      m.setMatrixAt(i, dummy.matrix);
    });
    m.instanceMatrix.needsUpdate = true;
  });
  return (
    <instancedMesh ref={ref} args={[geo, undefined, count]} frustumCulled={false}>
      <instancedBufferAttribute attach="instanceColor" args={[colorArr, 3]} />
      {/* partikel bercahaya pakai material tanpa cahaya supaya warnanya tetap terang */}
      {glow ? <meshBasicMaterial color="#ffffff" toneMapped={false} /> : <meshStandardMaterial color="#ffffff" roughness={0.5} />}
    </instancedMesh>
  );
}

/** Genangan air biru dengan riak. */
function Water({ t0, r = 1.15, c = '#0ea5e9' }: { t0: number; r?: number; c?: string }) {
  const ring = useRef<THREE.Mesh>(null!);
  useFrame(() => {
    const k = (sec(t0) % 1.4) / 1.4;
    ring.current.scale.setScalar(0.3 + k * 0.9);
    (ring.current.material as THREE.MeshBasicMaterial).opacity = 0.5 * (1 - k);
  });
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]} receiveShadow>
        <circleGeometry args={[r, 40]} />
        <meshStandardMaterial color={c} transparent opacity={0.75} roughness={0.15} metalness={0.2} />
      </mesh>
      <mesh ref={ring} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
        <ringGeometry args={[0.9, 1, 40]} />
        <meshBasicMaterial color="#e0f2fe" transparent depthWrite={false} />
      </mesh>
    </group>
  );
}

/** Kerangka hook kecil: jalankan fungsi tiap frame dengan (detik, progres 0..1). */
function useTick(t0: number, f: (e: number, p: number) => void) {
  useFrame(() => {
    const e = sec(t0);
    f(e, clamp01(e / DUR));
  });
}

// ======================= hewan =======================

function Horse({ t0 }: P) {
  const color = '#8b5a2b';
  const g = useRef<THREE.Group>(null!);
  const legs = useRef<THREE.Group[]>([]);
  const tail = useRef<THREE.Mesh>(null!);
  useTick(t0, (e, p) => {
    g.current.position.set(-1.5 + p * 3, Math.abs(Math.sin(e * 11)) * 0.07, 0);
    legs.current.forEach((l, i) => l && (l.rotation.z = Math.sin(e * 11 + (i % 2 ? Math.PI : 0) + (i > 1 ? 0.6 : 0)) * 0.7));
    tail.current.rotation.z = 0.9 + Math.sin(e * 11) * 0.25;
  });
  const dark = '#3b2412';
  return (
    <group>
      <group ref={g}>
        <Box s={[0.56, 0.2, 0.18]} p={[0, 0.42, 0]} c={color} />
        <Box s={[0.12, 0.3, 0.12]} p={[0.28, 0.58, 0]} r={[0, 0, -0.5]} c={color} />
        <Box s={[0.22, 0.11, 0.11]} p={[0.42, 0.72, 0]} r={[0, 0, -0.25]} c={color} />
        <Box s={[0.04, 0.26, 0.13]} p={[0.24, 0.66, 0]} r={[0, 0, -0.5]} c={dark} />
        <Ball rad={0.018} p={[0.46, 0.76, 0.06]} c="#111" />
        <mesh ref={tail} position={[-0.28, 0.48, 0]}>
          <coneGeometry args={[0.05, 0.3, 6]} />
          <Mat c={dark} />
        </mesh>
        {[
          [0.2, 0.07],
          [0.2, -0.07],
          [-0.2, 0.07],
          [-0.2, -0.07],
        ].map(([x, z], i) => (
          <group key={i} ref={(el) => el && (legs.current[i] = el)} position={[x, 0.34, z]}>
            <Box s={[0.06, 0.32, 0.06]} p={[0, -0.16, 0]} c={color} />
            <Box s={[0.07, 0.05, 0.07]} p={[0, -0.31, 0]} c={dark} />
          </group>
        ))}
      </group>
      <Spray t0={t0} count={24} colors={['#d6b98c', '#b08d5c']} size={0.06} life={0.8} emit={DUR} loop={false} gravity={0.4} grow={2} fade vel={(r) => [-0.3 - r() * 0.3, 0.2 + r() * 0.2, (r() - 0.5) * 0.3]} spread={(_, i) => [-1.7 + (i / 24) * 3, 0.03, 0]} />
    </group>
  );
}

function Bird({ t0, color }: P) {
  const g = useRef<THREE.Group>(null!);
  const wl = useRef<THREE.Mesh>(null!);
  const wr = useRef<THREE.Mesh>(null!);
  useTick(t0, (e, p) => {
    g.current.position.set(-1.4 + p * 2.8, 0.5 + Math.sin(p * Math.PI) * 0.7, Math.sin(p * Math.PI * 2) * 0.3);
    g.current.rotation.z = Math.cos(p * Math.PI) * 0.35;
    const f = Math.sin(e * 16) * 0.8;
    wl.current.rotation.x = f;
    wr.current.rotation.x = -f;
  });
  return (
    <group ref={g}>
      <Ball rad={0.12} s={[1.5, 0.9, 0.9]} c={color} />
      <Ball rad={0.08} p={[0.17, 0.05, 0]} c="#7c2d12" />
      <mesh position={[0.27, 0.04, 0]} rotation={[0, 0, -Math.PI / 2]}>
        <coneGeometry args={[0.025, 0.08, 6]} />
        <Mat c="#fde047" />
      </mesh>
      <mesh ref={wl} position={[0, 0.05, 0.1]}>
        <boxGeometry args={[0.22, 0.02, 0.32]} />
        <Mat c="#92400e" />
      </mesh>
      <mesh ref={wr} position={[0, 0.05, -0.1]}>
        <boxGeometry args={[0.22, 0.02, 0.32]} />
        <Mat c="#92400e" />
      </mesh>
      {/* bulu ekor panjang (cendrawasih) */}
      {[-0.06, 0, 0.06].map((z, i) => (
        <mesh key={i} position={[-0.32, -0.04 - i * 0.02, z]} rotation={[0, 0, Math.PI / 2 + 0.25]}>
          <coneGeometry args={[0.035, 0.45, 6]} />
          <Mat c={i === 1 ? '#f97316' : color} e={0.2} />
        </mesh>
      ))}
    </group>
  );
}

function Deer({ t0 }: P) {
  const color = '#a16207';
  const g = useRef<THREE.Group>(null!);
  useTick(t0, (_, p) => {
    const hop = Math.abs(Math.sin(p * Math.PI * 3));
    g.current.position.set(-1.3 + p * 2.6, hop * 0.5, 0);
    g.current.rotation.z = Math.cos(p * Math.PI * 6) * 0.25;
  });
  return (
    <group ref={g}>
      <Box s={[0.45, 0.17, 0.15]} p={[0, 0.4, 0]} c={color} />
      <Box s={[0.09, 0.25, 0.09]} p={[0.23, 0.56, 0]} r={[0, 0, -0.35]} c={color} />
      <Box s={[0.16, 0.09, 0.09]} p={[0.33, 0.68, 0]} c={color} />
      {[0.05, -0.05].map((z) => (
        <group key={z} position={[0.28, 0.75, z]}>
          <Cyl a={[0.01, 0.012, 0.2, 5]} p={[0, 0.1, 0]} r={[z * 4, 0, -0.3]} c="#e7e5e4" />
          <Cyl a={[0.008, 0.01, 0.1, 5]} p={[0.05, 0.12, 0]} r={[0, 0, -1]} c="#e7e5e4" />
        </group>
      ))}
      {[
        [0.17, 0.05],
        [0.17, -0.05],
        [-0.17, 0.05],
        [-0.17, -0.05],
      ].map(([x, z], i) => (
        <Box key={i} s={[0.05, 0.32, 0.05]} p={[x, 0.17, z]} r={[0, 0, i < 2 ? -0.3 : 0.3]} c={color} />
      ))}
      <Ball rad={0.045} p={[-0.24, 0.45, 0]} c="#fafaf9" />
    </group>
  );
}

function Monkeys({ t0 }: P) {
  const ms = useRef<THREE.Group[]>([]);
  useTick(t0, (e) => {
    ms.current.forEach((m, i) => {
      if (!m) return;
      const ph = (e * 1.3 + i * 0.33) % 1;
      const from = -0.9 + i * 0.6;
      m.position.set(from + Math.sin(ph * Math.PI * 2) * 0.35, Math.abs(Math.sin(ph * Math.PI)) * 0.55, (i - 1) * 0.35);
      m.rotation.z = Math.sin(ph * Math.PI * 2) * 0.4;
    });
  });
  return (
    <group>
      <Cyl a={[0.05, 0.07, 1.1]} p={[0, 0.55, -0.7]} c="#78350f" />
      <Ball rad={0.42} p={[0, 1.15, -0.7]} c="#15803d" />
      {[0, 1, 2].map((i) => (
        <group key={i} ref={(el) => el && (ms.current[i] = el)}>
          <Ball rad={0.11} p={[0, 0.16, 0]} s={[1, 1.2, 0.9]} c="#7c4a24" />
          <Ball rad={0.08} p={[0, 0.34, 0.02]} c="#7c4a24" />
          <Ball rad={0.05} p={[0, 0.32, 0.07]} c="#f5d0a9" />
          <Ball rad={0.03} p={[0.08, 0.38, 0]} c="#7c4a24" />
          <Ball rad={0.03} p={[-0.08, 0.38, 0]} c="#7c4a24" />
          <mesh position={[-0.12, 0.12, 0]} rotation={[0, 0, 0.6]}>
            <torusGeometry args={[0.09, 0.015, 6, 12, Math.PI]} />
            <Mat c="#7c4a24" />
          </mesh>
        </group>
      ))}
    </group>
  );
}

function Bear({ t0 }: P) {
  const g = useRef<THREE.Group>(null!);
  const arm = useRef<THREE.Group>(null!);
  useTick(t0, (e, p) => {
    const up = easeOut(clamp01(p * 3));
    g.current.position.y = -0.6 + up * 0.6 + Math.abs(Math.sin(e * 3)) * 0.03;
    arm.current.rotation.z = 2.3 + Math.sin(e * 8) * 0.5;
  });
  const c = '#7c4a24';
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.012, 0]}>
        <circleGeometry args={[0.55, 32]} />
        <Mat c="#3f2a14" />
      </mesh>
      <group ref={g}>
        <Ball rad={0.28} p={[0, 0.34, 0]} s={[1, 1.15, 0.9]} c={c} />
        <Ball rad={0.17} p={[0, 0.74, 0.02]} c={c} />
        <Ball rad={0.06} p={[0.12, 0.88, 0]} c={c} />
        <Ball rad={0.06} p={[-0.12, 0.88, 0]} c={c} />
        <Ball rad={0.07} p={[0, 0.7, 0.15]} c="#d6a77a" />
        <Ball rad={0.022} p={[0, 0.72, 0.21]} c="#111" />
        <Ball rad={0.018} p={[0.06, 0.79, 0.14]} c="#111" />
        <Ball rad={0.018} p={[-0.06, 0.79, 0.14]} c="#111" />
        <Ball rad={0.15} p={[0, 0.32, 0.17]} c="#a47148" />
        <group ref={arm} position={[0.24, 0.5, 0]}>
          <Ball rad={0.07} p={[0, 0.17, 0]} s={[1, 2.4, 1]} c={c} />
        </group>
        <Ball rad={0.07} p={[-0.27, 0.36, 0.05]} s={[1, 2, 1]} c={c} />
      </group>
    </group>
  );
}

function Fish({ t0 }: P) {
  const fs = useRef<THREE.Group[]>([]);
  const cols = ['#f97316', '#facc15', '#38bdf8', '#f472b6'];
  useTick(t0, (e) => {
    fs.current.forEach((f, i) => {
      if (!f) return;
      const ph = ((e + i * 0.45) % 1.6) / 1.6;
      const x0 = -0.8 + i * 0.5;
      f.position.set(x0 + ph * 0.5, Math.sin(ph * Math.PI) * 0.75 - 0.05, (i % 2 ? 0.25 : -0.25));
      f.rotation.z = Math.cos(ph * Math.PI) * 1.1;
      f.visible = ph > 0.03 && ph < 0.97;
    });
  });
  return (
    <group>
      <Water t0={t0} />
      {cols.map((c, i) => (
        <group key={i} ref={(el) => el && (fs.current[i] = el)}>
          <Ball rad={0.09} s={[1.6, 0.9, 0.6]} c={c} />
          <mesh position={[-0.17, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
            <coneGeometry args={[0.07, 0.1, 4]} />
            <Mat c={c} />
          </mesh>
          <Ball rad={0.016} p={[0.1, 0.03, 0.04]} c="#111" />
        </group>
      ))}
      <Spray t0={t0} count={30} colors={['#e0f2fe', '#7dd3fc']} size={0.04} life={0.7} emit={DUR} gravity={-4} vel={(r) => [(r() - 0.5) * 0.8, 1 + r() * 0.8, (r() - 0.5) * 0.8]} spread={(r) => [(r() - 0.5) * 1.6, 0, (r() - 0.5) * 0.6]} />
    </group>
  );
}

function SharkCroc({ t0 }: P) {
  const s = useRef<THREE.Group>(null!);
  const c = useRef<THREE.Group>(null!);
  useTick(t0, (e) => {
    const a = e * 1.8;
    s.current.position.set(Math.cos(a) * 0.6, 0.05 + Math.sin(e * 6) * 0.03, Math.sin(a) * 0.45);
    s.current.rotation.y = -a - Math.PI / 2;
    c.current.position.set(Math.cos(a + Math.PI) * 0.6, 0.05, Math.sin(a + Math.PI) * 0.45);
    c.current.rotation.y = -a + Math.PI / 2;
  });
  return (
    <group>
      <Water t0={t0} c="#0369a1" />
      <group ref={s}>
        <Ball rad={0.12} s={[2.4, 0.7, 0.8]} c="#64748b" />
        <mesh position={[0, 0.15, 0]}>
          <coneGeometry args={[0.07, 0.2, 4]} />
          <Mat c="#475569" />
        </mesh>
        <mesh position={[-0.32, 0.03, 0]} rotation={[0, 0, Math.PI / 2]}>
          <coneGeometry args={[0.08, 0.14, 4]} />
          <Mat c="#475569" />
        </mesh>
      </group>
      <group ref={c}>
        <Box s={[0.55, 0.08, 0.14]} c="#3f6212" />
        <Box s={[0.22, 0.06, 0.09]} p={[0.36, 0, 0]} c="#4d7c0f" />
        <Box s={[0.25, 0.04, 0.06]} p={[-0.36, 0, 0]} c="#3f6212" />
        <Ball rad={0.025} p={[0.25, 0.05, 0.05]} c="#fde047" e={0.5} />
        <Ball rad={0.025} p={[0.25, 0.05, -0.05]} c="#fde047" e={0.5} />
      </group>
      <Spray t0={t0} count={40} colors={['#e0f2fe', '#bae6fd']} size={0.045} life={0.6} emit={DUR} loop={false} gravity={-4} vel={(r) => [(r() - 0.5) * 1.2, 1.2 + r(), (r() - 0.5) * 1.2]} spread={(r) => [(r() - 0.5) * 1.2, 0, (r() - 0.5) * 0.8]} />
    </group>
  );
}

// ======================= alam =======================

function Volcano({ t0 }: P) {
  const glow = useRef<THREE.PointLight>(null!);
  useTick(t0, (e) => (glow.current.intensity = 1.5 + Math.sin(e * 20) * 0.7));
  return (
    <group>
      <Cyl a={[0.14, 0.75, 0.85, 20]} p={[0, 0.42, 0]} c="#57534e" />
      <Cyl a={[0.32, 0.75, 0.25, 20]} p={[0, 0.13, 0]} c="#3f6212" />
      <Cyl a={[0.13, 0.13, 0.02, 16]} p={[0, 0.86, 0]} c="#f97316" e={2} />
      <pointLight ref={glow} position={[0, 1, 0]} color="#f97316" distance={3} />
      <Spray t0={t0} count={70} colors={['#ef4444', '#f97316', '#facc15']} size={0.07} origin={[0, 0.86, 0]} life={1.2} emit={DUR - 1} gravity={-3.2} glow={3} vel={(r) => [(r() - 0.5) * 1.1, 2 + r() * 1.3, (r() - 0.5) * 1.1]} />
      <Spray t0={t0} count={24} colors={['#78716c', '#a8a29e']} size={0.16} origin={[0, 0.9, 0]} life={2} emit={DUR - 1.5} gravity={0} grow={2.5} fade vel={(r) => [(r() - 0.5) * 0.3, 0.6 + r() * 0.3, (r() - 0.5) * 0.3]} />
    </group>
  );
}

function Equator({ t0 }: P) {
  const sun = useRef<THREE.Mesh>(null!);
  const shadow = useRef<THREE.Mesh>(null!);
  const globe = useRef<THREE.Group>(null!);
  useTick(t0, (e, p) => {
    const a = Math.PI * (0.1 + p * 0.8);
    sun.current.position.set(Math.cos(a) * 1.3, 0.3 + Math.sin(a) * 1.4, 0);
    const len = Math.abs(Math.cos(a)) * 1.1;
    shadow.current.scale.set(Math.max(0.02, len), 1, 1);
    shadow.current.position.x = -Math.sign(Math.cos(a)) * (0.05 + len / 2);
    globe.current.rotation.y = e * 1.5;
  });
  return (
    <group>
      <Box s={[0.4, 0.08, 0.4]} p={[0, 0.04, 0]} c="#e7e5e4" />
      <Cyl a={[0.04, 0.06, 0.6, 8]} p={[0, 0.38, 0]} c="#e7e5e4" />
      <group ref={globe} position={[0, 0.78, 0]}>
        <Ball rad={0.14} c="#16a34a" />
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.19, 0.012, 6, 32]} />
          <Mat c="#fbbf24" m={0.8} r={0.2} />
        </mesh>
      </group>
      <mesh ref={sun}>
        <sphereGeometry args={[0.13, 16, 12]} />
        <meshBasicMaterial color="#fde047" toneMapped={false} />
      </mesh>
      <mesh ref={shadow} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.015, 0]}>
        <planeGeometry args={[1, 0.12]} />
        <meshBasicMaterial color="#000" transparent opacity={0.35} depthWrite={false} />
      </mesh>
    </group>
  );
}

function Fruit({ t0, color }: P) {
  const fs = useRef<THREE.Mesh[]>([]);
  const pos = useMemo(() => {
    const r = rng(7);
    return Array.from({ length: 7 }, () => [(r() - 0.5) * 0.7, (r() - 0.5) * 0.5, r() * 2.6] as const);
  }, []);
  useTick(t0, (e) => {
    fs.current.forEach((f, i) => {
      if (!f) return;
      const [x, z, d] = pos[i];
      const a = Math.max(0, e - d);
      const fall = 1.05 - 4.9 * a * a;
      let y = Math.max(0.07, fall);
      if (fall < 0.07) {
        const b = a - Math.sqrt(0.98 / 4.9);
        y = 0.07 + Math.max(0, Math.sin(Math.min(b * 6, Math.PI)) * 0.12);
      }
      f.position.set(x + (fall < 0.07 ? Math.min(0.2, a * 0.1) : 0), y, z + 0.1);
    });
  });
  return (
    <group>
      <Cyl a={[0.06, 0.09, 0.75, 8]} p={[0, 0.37, -0.15]} c="#78350f" />
      <Ball rad={0.48} p={[0, 1.05, -0.15]} s={[1.2, 0.8, 1]} c="#16a34a" />
      {pos.map((_, i) => (
        <mesh key={i} ref={(el) => el && (fs.current[i] = el)} castShadow>
          <sphereGeometry args={[0.07, 12, 10]} />
          <Mat c={color} r={0.35} />
        </mesh>
      ))}
    </group>
  );
}

function Durian({ t0 }: P) {
  const a = useRef<THREE.Group>(null!);
  const b = useRef<THREE.Group>(null!);
  const flesh = useRef<THREE.Group>(null!);
  useTick(t0, (e) => {
    const fallT = 0.55;
    if (e < fallT) {
      const y = 1.5 - 4.9 * e * e;
      a.current.position.set(0, Math.max(0.22, y), 0);
      b.current.position.copy(a.current.position);
      flesh.current.visible = false;
    } else {
      const k = easeOut(clamp01((e - fallT - 0.25) / 0.6));
      const bounce = Math.max(0, Math.sin(clamp01((e - fallT) / 0.25) * Math.PI)) * 0.15;
      a.current.position.set(-k * 0.25, 0.22 + bounce, 0);
      b.current.position.set(k * 0.25, 0.22 + bounce, 0);
      a.current.rotation.z = k * 0.9;
      b.current.rotation.z = -k * 0.9;
      flesh.current.visible = k > 0.05;
      flesh.current.scale.setScalar(k);
    }
  });
  const half = (
    <mesh castShadow>
      <icosahedronGeometry args={[0.24, 1]} />
      <Mat c="#65a30d" flat r={0.9} />
    </mesh>
  );
  return (
    <group>
      <group ref={a} scale={[0.5, 1, 1]}>
        <group position={[-0.12, 0, 0]}>{half}</group>
      </group>
      <group ref={b} scale={[0.5, 1, 1]}>
        <group position={[0.12, 0, 0]}>{half}</group>
      </group>
      <group ref={flesh} position={[0, 0.16, 0]}>
        {[-0.08, 0.08].map((z) => (
          <Ball key={z} rad={0.08} p={[0, 0, z]} s={[1, 0.8, 1]} c="#fde047" />
        ))}
      </group>
    </group>
  );
}

function Snow({ t0 }: P) {
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.012, 0]}>
        <circleGeometry args={[1, 32]} />
        <Mat c="#f1f5f9" r={0.9} />
      </mesh>
      <Ball rad={0.22} p={[0, 0.22, 0]} c="#f8fafc" />
      <Ball rad={0.16} p={[0, 0.55, 0]} c="#f8fafc" />
      <Ball rad={0.11} p={[0, 0.8, 0]} c="#f8fafc" />
      <mesh position={[0, 0.8, 0.12]} rotation={[Math.PI / 2, 0, 0]}>
        <coneGeometry args={[0.025, 0.12, 8]} />
        <Mat c="#f97316" />
      </mesh>
      <Ball rad={0.015} p={[0.04, 0.84, 0.1]} c="#111" />
      <Ball rad={0.015} p={[-0.04, 0.84, 0.1]} c="#111" />
      <Cyl a={[0.1, 0.1, 0.09, 12]} p={[0, 0.93, 0]} c="#1e293b" />
      <Spray t0={t0} count={90} colors={['#ffffff']} size={0.035} life={1.8} emit={DUR - 1.5} gravity={0} glow={1} vel={(r) => [(r() - 0.5) * 0.2, -0.8 - r() * 0.3, (r() - 0.5) * 0.2]} spread={(r) => [(r() - 0.5) * 2.4, 1.6, (r() - 0.5) * 1.6]} />
    </group>
  );
}

function Rain({ t0 }: P) {
  const cloud = useRef<THREE.Group>(null!);
  useTick(t0, (e) => (cloud.current.position.x = Math.sin(e * 0.8) * 0.15));
  return (
    <group>
      <group ref={cloud} position={[0, 1.45, 0]}>
        {[
          [-0.35, 0, 0.2],
          [0, 0.08, 0.28],
          [0.35, 0, 0.22],
          [0.15, -0.05, 0.2],
          [-0.15, -0.04, 0.2],
        ].map(([x, y, r], i) => (
          <Ball key={i} rad={r} p={[x, y, 0]} c="#94a3b8" />
        ))}
      </group>
      <Spray t0={t0} count={80} colors={['#93c5fd']} size={0.03} shape="box" life={0.6} emit={DUR - 0.6} gravity={-2} vel={() => [0, -1.6, 0]} spread={(r) => [(r() - 0.5) * 1, 1.3, (r() - 0.5) * 0.5]} />
      <Water t0={t0} r={0.8} c="#334155" />
    </group>
  );
}

function Desert({ t0 }: P) {
  const weed = useRef<THREE.Mesh>(null!);
  useTick(t0, (e, p) => {
    weed.current.position.set(-1.3 + p * 2.6, 0.12 + Math.abs(Math.sin(e * 6)) * 0.12, 0.25);
    weed.current.rotation.z = -e * 6;
  });
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.012, 0]}>
        <circleGeometry args={[1.1, 32]} />
        <Mat c="#e9c46a" r={1} />
      </mesh>
      <Cyl a={[0.08, 0.09, 0.8, 10]} p={[-0.2, 0.4, -0.3]} c="#15803d" />
      <Cyl a={[0.05, 0.05, 0.3, 8]} p={[-0.35, 0.5, -0.3]} r={[0, 0, Math.PI / 2]} c="#15803d" />
      <Cyl a={[0.05, 0.05, 0.25, 8]} p={[-0.48, 0.62, -0.3]} c="#15803d" />
      <Cyl a={[0.045, 0.045, 0.2, 8]} p={[-0.02, 0.6, -0.3]} r={[0, 0, Math.PI / 2]} c="#15803d" />
      <Cyl a={[0.045, 0.045, 0.2, 8]} p={[0.07, 0.7, -0.3]} c="#15803d" />
      <mesh position={[0.7, 1.3, -0.5]}>
        <sphereGeometry args={[0.18, 16, 12]} />
        <meshBasicMaterial color="#fb923c" toneMapped={false} />
      </mesh>
      <mesh ref={weed}>
        <icosahedronGeometry args={[0.13, 1]} />
        <meshStandardMaterial color="#92400e" wireframe />
      </mesh>
      <Spray t0={t0} count={50} colors={['#d4a373', '#e9c46a']} size={0.03} life={1.2} emit={DUR - 1} gravity={0} vel={(r) => [1.2 + r() * 0.6, (r() - 0.3) * 0.2, (r() - 0.5) * 0.2]} spread={(r) => [-1.2, 0.05 + r() * 0.4, (r() - 0.5) * 1.2]} />
    </group>
  );
}

function Blossom({ t0, color }: P) {
  return (
    <group>
      <Cyl a={[0.06, 0.1, 0.7, 8]} p={[0, 0.35, 0]} c="#57340f" />
      <Cyl a={[0.03, 0.04, 0.35, 6]} p={[0.15, 0.75, 0]} r={[0, 0, -0.7]} c="#57340f" />
      <Ball rad={0.42} p={[0, 1.0, 0]} s={[1.3, 0.85, 1.1]} c={color} />
      <Ball rad={0.25} p={[0.35, 0.9, 0.1]} c={color} />
      <Spray t0={t0} count={60} colors={[color, '#fff1f2']} size={0.05} shape="flat" spin={4} life={2.2} emit={DUR - 1.8} gravity={-0.25} vel={(r) => [0.25 + r() * 0.35, -0.25, (r() - 0.5) * 0.4]} spread={(r) => [(r() - 0.5) * 1, 0.9 + r() * 0.3, (r() - 0.5) * 0.8]} />
    </group>
  );
}

function Aurora({ t0 }: P) {
  const rib = useRef<THREE.Mesh[]>([]);
  useTick(t0, (e) => {
    rib.current.forEach((m, i) => {
      if (!m) return;
      m.position.x = Math.sin(e * 1.2 + i) * 0.3;
      m.scale.y = 1 + Math.sin(e * 2 + i * 1.7) * 0.3;
      m.rotation.y = Math.sin(e * 0.7 + i) * 0.4;
      (m.material as THREE.MeshBasicMaterial).opacity = 0.35 + Math.sin(e * 3 + i) * 0.15;
    });
  });
  return (
    <group>
      {/* langit malam sebagai latar supaya aurora terlihat di atas papan yang terang */}
      <mesh position={[0, 0.95, -0.55]}>
        <planeGeometry args={[2.3, 1.6]} />
        <meshBasicMaterial color="#0b1026" side={THREE.DoubleSide} />
      </mesh>
      {['#4ade80', '#22d3ee', '#a78bfa', '#34d399'].map((c, i) => (
        <mesh key={i} ref={(el) => el && (rib.current[i] = el)} position={[0, 1.0 + i * 0.1, -0.5 + i * 0.03]}>
          <planeGeometry args={[1.7, 0.28, 1, 1]} />
          <meshBasicMaterial color={c} transparent side={THREE.DoubleSide} depthWrite={false} toneMapped={false} />
        </mesh>
      ))}
      <Spray t0={t0} count={30} colors={['#ffffff']} size={0.015} glow={3} life={DUR} gravity={0} vel={() => [0, 0, 0]} spread={(r) => [(r() - 0.5) * 2.1, 0.3 + r() * 1.3, -0.52]} />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.012, 0]}>
        <circleGeometry args={[0.9, 32]} />
        <Mat c="#e2e8f0" r={0.9} />
      </mesh>
    </group>
  );
}

// ======================= budaya =======================

function Dancer({ t0 }: P) {
  const g = useRef<THREE.Group>(null!);
  const al = useRef<THREE.Group>(null!);
  const ar = useRef<THREE.Group>(null!);
  useTick(t0, (e) => {
    g.current.rotation.y = e * 3;
    g.current.position.y = Math.abs(Math.sin(e * 4)) * 0.05;
    al.current.rotation.z = 1.2 + Math.sin(e * 6) * 0.5;
    ar.current.rotation.z = -1.2 - Math.sin(e * 6 + 1) * 0.5;
  });
  return (
    <group>
      <group ref={g}>
        <mesh position={[0, 0.3, 0]} castShadow>
          <coneGeometry args={[0.24, 0.6, 16]} />
          <Mat c="#b91c1c" />
        </mesh>
        <Cyl a={[0.08, 0.1, 0.25, 10]} p={[0, 0.7, 0]} c="#fbbf24" m={0.6} />
        <Ball rad={0.09} p={[0, 0.93, 0]} c="#c08457" />
        <mesh position={[0, 1.06, 0]}>
          <coneGeometry args={[0.09, 0.16, 8]} />
          <Mat c="#fbbf24" m={0.8} r={0.2} e={0.3} />
        </mesh>
        <group ref={al} position={[0.08, 0.78, 0]}>
          <Box s={[0.03, 0.26, 0.03]} p={[0, 0.13, 0]} c="#c08457" />
          <mesh position={[0, 0.3, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <circleGeometry args={[0.12, 12, 0, Math.PI]} />
            <meshStandardMaterial color="#fbbf24" side={THREE.DoubleSide} metalness={0.6} />
          </mesh>
        </group>
        <group ref={ar} position={[-0.08, 0.78, 0]}>
          <Box s={[0.03, 0.26, 0.03]} p={[0, 0.13, 0]} c="#c08457" />
          <mesh position={[0, 0.3, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <circleGeometry args={[0.12, 12, 0, Math.PI]} />
            <meshStandardMaterial color="#fbbf24" side={THREE.DoubleSide} metalness={0.6} />
          </mesh>
        </group>
      </group>
      <Spray t0={t0} count={40} colors={['#f472b6', '#fde047', '#ffffff']} size={0.04} shape="flat" spin={5} life={1.6} emit={DUR - 1.2} gravity={-0.4} vel={(r, i) => [Math.cos(i) * 0.5, 0.5 + r() * 0.3, Math.sin(i) * 0.5]} origin={[0, 0.8, 0]} />
    </group>
  );
}

function Wayang({ t0 }: P) {
  const pup = useRef<THREE.Group>(null!);
  const arm = useRef<THREE.Group>(null!);
  useTick(t0, (e) => {
    pup.current.position.x = Math.sin(e * 1.5) * 0.35;
    pup.current.rotation.z = Math.sin(e * 3) * 0.12;
    arm.current.rotation.z = -0.6 + Math.sin(e * 5) * 0.6;
  });
  return (
    <group>
      {/* kelir (layar) */}
      <Box s={[1.5, 0.05, 0.05]} p={[0, 1.15, 0]} c="#78350f" />
      <Box s={[0.05, 1.15, 0.05]} p={[-0.75, 0.58, 0]} c="#78350f" />
      <Box s={[0.05, 1.15, 0.05]} p={[0.75, 0.58, 0]} c="#78350f" />
      <mesh position={[0, 0.65, 0]}>
        <planeGeometry args={[1.45, 1]} />
        <meshStandardMaterial color="#fef3c7" emissive="#fbbf24" emissiveIntensity={0.6} side={THREE.DoubleSide} />
      </mesh>
      <Box s={[1.6, 0.12, 0.25]} p={[0, 0.06, 0.05]} c="#92400e" />
      <pointLight position={[0, 0.8, -0.6]} color="#fbbf24" intensity={2} distance={2} />
      {/* wayang (bayangan gelap di depan layar) */}
      <group ref={pup} position={[0, 0.25, 0.04]}>
        <Box s={[0.012, 0.35, 0.01]} p={[0, -0.05, 0]} c="#1c1917" />
        <mesh position={[0, 0.38, 0]}>
          <circleGeometry args={[0.09, 12]} />
          <meshBasicMaterial color="#1c1917" side={THREE.DoubleSide} />
        </mesh>
        <mesh position={[0, 0.48, 0]}>
          <coneGeometry args={[0.06, 0.12, 3]} />
          <meshBasicMaterial color="#1c1917" />
        </mesh>
        <mesh position={[0, 0.2, 0]}>
          <planeGeometry args={[0.18, 0.3]} />
          <meshBasicMaterial color="#1c1917" side={THREE.DoubleSide} />
        </mesh>
        <mesh position={[0, 0.0, 0]}>
          <planeGeometry args={[0.22, 0.12]} />
          <meshBasicMaterial color="#292524" side={THREE.DoubleSide} />
        </mesh>
        <group ref={arm} position={[0.08, 0.3, 0]}>
          <Box s={[0.02, 0.3, 0.005]} p={[0, -0.15, 0]} c="#1c1917" />
        </group>
      </group>
    </group>
  );
}

function Notes({ t0 }: P) {
  const ang = useRef<THREE.Group>(null!);
  useTick(t0, (e) => {
    ang.current.rotation.z = Math.sin(e * 28) * 0.12;
    ang.current.position.x = Math.sin(e * 28) * 0.03;
  });
  return (
    <group>
      <group ref={ang} position={[0, 0.05, 0]}>
        <Box s={[0.7, 0.05, 0.08]} p={[0, 0.02, 0]} c="#a16207" />
        <Box s={[0.7, 0.04, 0.06]} p={[0, 0.72, 0]} c="#a16207" />
        {[-0.24, -0.08, 0.08, 0.24].map((x, i) => (
          <Cyl key={x} a={[0.04, 0.045, 0.45 + i * 0.07, 10]} p={[x, 0.27 + i * 0.035, 0]} c="#eab308" />
        ))}
        <Box s={[0.04, 0.74, 0.04]} p={[-0.35, 0.37, 0]} c="#a16207" />
        <Box s={[0.04, 0.74, 0.04]} p={[0.35, 0.37, 0]} c="#a16207" />
      </group>
      <Spray t0={t0} count={18} colors={['#f472b6', '#38bdf8', '#facc15', '#a78bfa']} size={0.07} shape="note" glow={2} spin={2} life={1.8} emit={DUR - 1.4} gravity={0} vel={(r, i) => [(i % 2 ? 1 : -1) * (0.15 + r() * 0.2), 0.6 + r() * 0.2, (r() - 0.5) * 0.2]} origin={[0, 0.8, 0]} />
    </group>
  );
}

function Doors({ t0 }: P) {
  const ds = useRef<THREE.Group[]>([]);
  useTick(t0, (e) => {
    ds.current.forEach((d, i) => d && (d.rotation.y = -easeOut(clamp01((e - 0.3 - i * 0.25) / 0.5)) * 1.6));
  });
  return (
    <group>
      <Box s={[1.9, 0.75, 0.25]} p={[0, 0.375, -0.12]} c="#f5f5f4" />
      <Box s={[2, 0.08, 0.32]} p={[0, 0.78, -0.12]} c="#b45309" />
      {[-0.7, -0.42, -0.14, 0.14, 0.42, 0.7].map((x, i) => (
        <group key={i}>
          <Box s={[0.18, 0.46, 0.02]} p={[x, 0.26, 0.01]} c="#fde68a" e={0.9} />
          <group ref={(el) => el && (ds.current[i] = el)} position={[x - 0.09, 0.26, 0.03]}>
            <Box s={[0.18, 0.46, 0.03]} p={[0.09, 0, 0]} c="#7c2d12" />
          </group>
        </group>
      ))}
    </group>
  );
}

function Clock({ t0 }: P) {
  const hm = useRef<THREE.Group>(null!);
  const hh = useRef<THREE.Group>(null!);
  const rings = useRef<THREE.Mesh[]>([]);
  useTick(t0, (e) => {
    hm.current.rotation.z = -e * 6;
    hh.current.rotation.z = -e * 0.5;
    rings.current.forEach((r, i) => {
      if (!r) return;
      const k = ((e + i * 0.4) % 1.2) / 1.2;
      r.scale.setScalar(0.4 + k * 1.6);
      (r.material as THREE.MeshBasicMaterial).opacity = 0.6 * (1 - k);
    });
  });
  return (
    <group>
      <Box s={[0.42, 1.0, 0.42]} p={[0, 0.5, 0]} c="#f5f5f4" />
      <Box s={[0.5, 0.06, 0.5]} p={[0, 1.02, 0]} c="#7c2d12" />
      <mesh position={[0, 1.22, 0]} rotation={[0, Math.PI / 4, 0]} castShadow>
        <coneGeometry args={[0.36, 0.4, 4]} />
        <Mat c="#991b1b" />
      </mesh>
      <Cyl a={[0.16, 0.16, 0.02, 24]} p={[0, 0.78, 0.215]} r={[Math.PI / 2, 0, 0]} c="#fefce8" e={0.5} />
      <group ref={hm} position={[0, 0.78, 0.23]}>
        <Box s={[0.015, 0.13, 0.01]} p={[0, 0.06, 0]} c="#111" />
      </group>
      <group ref={hh} position={[0, 0.78, 0.235]}>
        <Box s={[0.02, 0.08, 0.01]} p={[0, 0.035, 0]} c="#111" />
      </group>
      {[0, 1, 2].map((i) => (
        <mesh key={i} ref={(el) => el && (rings.current[i] = el)} position={[0, 0.78, 0.25]}>
          <ringGeometry args={[0.2, 0.23, 32]} />
          <meshBasicMaterial color="#fde047" transparent depthWrite={false} toneMapped={false} />
        </mesh>
      ))}
    </group>
  );
}

function Flag({ t0, color, accent }: P) {
  const segs = useRef<THREE.Mesh[]>([]);
  useTick(t0, (e) => segs.current.forEach((s, i) => s && (s.position.z = Math.sin(e * 6 - i * 0.7) * 0.05 * (i / 8))));
  return (
    <group>
      <Cyl a={[0.02, 0.025, 1.4, 8]} p={[-0.4, 0.7, 0]} c="#cbd5e1" m={0.8} />
      <Ball rad={0.04} p={[-0.4, 1.42, 0]} c="#fbbf24" />
      {Array.from({ length: 9 }, (_, i) => (
        <group key={i}>
          <mesh ref={(el) => el && (segs.current[i] = el)} position={[-0.36 + i * 0.075 + 0.0375, 1.17, 0]}>
            <boxGeometry args={[0.076, 0.42, 0.01]} />
            <meshStandardMaterial color={color} side={THREE.DoubleSide} />
            <mesh position={[0, -0.105, 0]}>
              <boxGeometry args={[0.076, 0.21, 0.012]} />
              <meshStandardMaterial color={accent} side={THREE.DoubleSide} />
            </mesh>
          </mesh>
        </group>
      ))}
    </group>
  );
}

// ======================= kendaraan & air =======================

function Ship({ t0 }: P) {
  const g = useRef<THREE.Group>(null!);
  const sails = useRef<THREE.Mesh[]>([]);
  useTick(t0, (e, p) => {
    g.current.position.set(-1 + p * 2, Math.sin(e * 3) * 0.03, 0);
    g.current.rotation.z = Math.sin(e * 2.5) * 0.08;
    sails.current.forEach((s, i) => s && (s.scale.z = 1 + Math.sin(e * 4 + i) * 0.25));
  });
  return (
    <group>
      <Water t0={t0} r={1.25} />
      <group ref={g}>
        <Box s={[0.8, 0.14, 0.24]} p={[0, 0.08, 0]} c="#7c2d12" />
        <mesh position={[0.5, 0.12, 0]} rotation={[0, 0, -Math.PI / 2]}>
          <coneGeometry args={[0.12, 0.25, 4]} />
          <Mat c="#7c2d12" />
        </mesh>
        <Box s={[0.82, 0.03, 0.26]} p={[0, 0.16, 0]} c="#a16207" />
        {[-0.15, 0.18].map((x, i) => (
          <group key={x}>
            <Cyl a={[0.012, 0.015, 0.75, 6]} p={[x, 0.53, 0]} c="#57340f" />
            <mesh ref={(el) => el && (sails.current[i] = el)} position={[x + 0.1, 0.55, 0.01]}>
              <boxGeometry args={[0.2, 0.5, 0.02]} />
              <Mat c="#fef3c7" />
            </mesh>
          </group>
        ))}
        <mesh position={[0.48, 0.42, 0]} rotation={[0, 0, -0.5]}>
          <coneGeometry args={[0.12, 0.35, 3]} />
          <Mat c="#fef3c7" />
        </mesh>
      </group>
    </group>
  );
}

function Boats({ t0 }: P) {
  const bs = useRef<THREE.Group[]>([]);
  const paddles = useRef<THREE.Group[]>([]);
  useTick(t0, (e) => {
    bs.current.forEach((b, i) => {
      if (!b) return;
      b.position.y = Math.sin(e * 2.5 + i * 2) * 0.03;
      b.position.x = (i - 1) * 0.65 + Math.sin(e * 0.8 + i) * 0.12;
      b.rotation.z = Math.sin(e * 2 + i) * 0.06;
    });
    paddles.current.forEach((p, i) => p && (p.rotation.x = Math.sin(e * 4 + i) * 0.6));
  });
  const fruits = ['#f97316', '#facc15', '#16a34a', '#dc2626', '#a855f7'];
  return (
    <group>
      <Water t0={t0} r={1.25} c="#a16207" />
      {[0, 1, 2].map((i) => (
        <group key={i} ref={(el) => el && (bs.current[i] = el)} position={[0, 0, (i - 1) * 0.3]}>
          <Box s={[0.5, 0.07, 0.15]} p={[0, 0.05, 0]} c="#57340f" />
          {fruits.map((c, k) => (
            <Ball key={k} rad={0.035} p={[-0.18 + k * 0.07, 0.11, (k % 2) * 0.03]} c={c} />
          ))}
          <Cyl a={[0.04, 0.06, 0.16, 8]} p={[0.17, 0.17, 0]} c="#2563eb" />
          <Ball rad={0.04} p={[0.17, 0.28, 0]} c="#c08457" />
          <mesh position={[0.17, 0.33, 0]}>
            <coneGeometry args={[0.1, 0.06, 12]} />
            <Mat c="#eab308" />
          </mesh>
          <group ref={(el) => el && (paddles.current[i] = el)} position={[0.17, 0.2, 0.06]}>
            <Box s={[0.015, 0.3, 0.015]} p={[0, -0.1, 0.05]} r={[0.4, 0, 0]} c="#78350f" />
          </group>
        </group>
      ))}
    </group>
  );
}

function BoatRace({ t0 }: P) {
  const g = useRef<THREE.Group>(null!);
  const pads = useRef<THREE.Group[]>([]);
  useTick(t0, (e, p) => {
    g.current.position.set(-1.1 + p * 2.2, Math.sin(e * 8) * 0.015, 0);
    pads.current.forEach((pd, i) => pd && (pd.rotation.z = Math.sin(e * 12 + i * 0.3) * 0.7));
  });
  return (
    <group>
      <Water t0={t0} r={1.3} c="#0e7490" />
      <group ref={g}>
        <Box s={[1.4, 0.06, 0.12]} p={[0, 0.04, 0]} c="#b45309" />
        <mesh position={[0.78, 0.09, 0]} rotation={[0, 0, -1.2]}>
          <coneGeometry args={[0.05, 0.2, 6]} />
          <Mat c="#dc2626" />
        </mesh>
        {Array.from({ length: 8 }, (_, i) => (
          <group key={i} position={[-0.55 + i * 0.15, 0.13, 0]}>
            <Cyl a={[0.025, 0.03, 0.12, 6]} c={i % 2 ? '#dc2626' : '#facc15'} />
            <Ball rad={0.025} p={[0, 0.08, 0]} c="#c08457" />
            <group ref={(el) => el && (pads.current[i] = el)} position={[0, 0.02, 0.07]}>
              <Box s={[0.012, 0.22, 0.012]} p={[0, -0.09, 0]} c="#57340f" />
            </group>
          </group>
        ))}
      </group>
      <Spray t0={t0} count={40} colors={['#cffafe']} size={0.035} life={0.4} emit={DUR - 0.4} gravity={-4} vel={(r) => [-0.5, 0.8 + r() * 0.5, (r() - 0.5) * 1.2]} spread={(_, i) => [-1.1 + (i / 40) * 2.2, 0.03, 0.08]} />
    </group>
  );
}

function Bridge({ t0 }: P) {
  const l = useRef<THREE.Group>(null!);
  const r = useRef<THREE.Group>(null!);
  const boat = useRef<THREE.Group>(null!);
  useTick(t0, (_, p) => {
    const lift = Math.sin(clamp01((p - 0.1) / 0.8) * Math.PI);
    l.current.rotation.z = lift * 0.75;
    r.current.rotation.z = -lift * 0.75;
    boat.current.position.set(0, 0.05, 0.9 - p * 1.8);
  });
  const red = '#dc2626';
  return (
    <group>
      <Water t0={t0} r={1.2} />
      {[-0.55, 0.55].map((x) => (
        <group key={x}>
          <Box s={[0.14, 0.9, 0.2]} p={[x, 0.45, 0]} c={red} />
          <Box s={[0.18, 0.08, 0.24]} p={[x, 0.92, 0]} c="#991b1b" />
        </group>
      ))}
      <Box s={[0.08, 0.08, 0.2]} p={[0, 0.82, 0]} c={red}>
        <mesh position={[0, 0, 0]}>
          <boxGeometry args={[1.1, 0.04, 0.04]} />
          <Mat c={red} />
        </mesh>
      </Box>
      <Box s={[0.5, 0.05, 0.22]} p={[-0.85, 0.3, 0]} c="#57534e" />
      <Box s={[0.5, 0.05, 0.22]} p={[0.85, 0.3, 0]} c="#57534e" />
      <group ref={l} position={[-0.48, 0.3, 0]}>
        <Box s={[0.48, 0.05, 0.22]} p={[0.24, 0, 0]} c="#57534e" />
      </group>
      <group ref={r} position={[0.48, 0.3, 0]}>
        <Box s={[0.48, 0.05, 0.22]} p={[-0.24, 0, 0]} c="#57534e" />
      </group>
      <group ref={boat} rotation={[0, Math.PI / 2, 0]}>
        <Box s={[0.35, 0.08, 0.12]} c="#f8fafc" />
        <Box s={[0.12, 0.1, 0.09]} p={[-0.05, 0.08, 0]} c="#0ea5e9" />
        <Cyl a={[0.02, 0.02, 0.12, 6]} p={[-0.05, 0.18, 0]} c="#111" />
      </group>
    </group>
  );
}

function Train({ t0, accent, metro }: P & { metro?: boolean }) {
  const g = useRef<THREE.Group>(null!);
  const wheels = useRef<THREE.Mesh[]>([]);
  useTick(t0, (e, p) => {
    const k = metro ? easeOut(p) : p;
    g.current.position.x = -1.9 + k * 3.6;
    wheels.current.forEach((w) => w && (w.rotation.z = -e * 14));
  });
  const body = metro ? '#e2e8f0' : '#1e3a8a';
  return (
    <group>
      {[-0.07, 0.07].map((z) => (
        <Box key={z} s={[2.8, 0.02, 0.025]} p={[0, 0.02, z]} c="#94a3b8" />
      ))}
      {Array.from({ length: 12 }, (_, i) => (
        <Box key={i} s={[0.05, 0.015, 0.22]} p={[-1.35 + i * 0.245, 0.008, 0]} c="#57340f" />
      ))}
      {metro && (
        <group position={[-1.25, 0, 0]}>
          <Box s={[0.3, 0.45, 0.45]} p={[0, 0.225, 0]} c="#475569" />
          <Box s={[0.32, 0.28, 0.28]} p={[0.01, 0.15, 0]} c="#0f172a" />
        </group>
      )}
      <group ref={g}>
        {[0, -0.5, -1.0].map((x, i) => (
          <group key={i} position={[x, 0, 0]}>
            <Box s={[0.46, 0.2, 0.2]} p={[0, 0.16, 0]} c={i === 0 && !metro ? '#111827' : body} />
            <Box s={[0.42, 0.06, 0.205]} p={[0, 0.2, 0]} c={metro ? accent : '#fbbf24'} e={metro ? 0.6 : 0} />
            {[-0.14, 0.14].map((wx) => (
              <mesh key={wx} ref={(el) => el && !wheels.current.includes(el) && wheels.current.push(el)} position={[wx, 0.05, 0.1]} rotation={[Math.PI / 2, 0, 0]}>
                <cylinderGeometry args={[0.045, 0.045, 0.02, 10]} />
                <Mat c="#111" />
              </mesh>
            ))}
            {i === 0 && !metro && (
              <>
                <Cyl a={[0.075, 0.075, 0.3, 12]} p={[0.08, 0.28, 0]} r={[0, 0, Math.PI / 2]} c="#111827" />
                <Cyl a={[0.035, 0.05, 0.12, 8]} p={[0.16, 0.4, 0]} c="#111" />
                <Ball rad={0.03} p={[0.24, 0.28, 0]} c="#fde047" e={2} />
              </>
            )}
            {i === 0 && metro && <Ball rad={0.03} p={[0.24, 0.16, 0]} c="#fde047" e={2} />}
          </group>
        ))}
        {!metro && <Spray t0={t0} count={30} colors={['#e5e7eb', '#9ca3af']} size={0.07} origin={[0.16, 0.48, 0]} life={1.1} emit={DUR} gravity={0.2} grow={2.5} fade vel={(r) => [-0.9 + r() * 0.2, 0.35 + r() * 0.2, (r() - 0.5) * 0.15]} />}
      </group>
    </group>
  );
}

function Plane({ t0 }: P) {
  const g = useRef<THREE.Group>(null!);
  useTick(t0, (_, p) => {
    const run = clamp01(p / 0.45);
    const climb = clamp01((p - 0.45) / 0.55);
    g.current.position.set(-1.3 + easeIn(run) * 1.3 + climb * 1.5, 0.1 + easeIn(climb) * 1.4, 0);
    g.current.rotation.z = climb > 0 ? Math.min(0.45, climb * 1.5) : 0;
  });
  return (
    <group>
      <Box s={[2.6, 0.01, 0.35]} p={[0, 0.006, 0]} c="#334155" />
      {Array.from({ length: 8 }, (_, i) => (
        <Box key={i} s={[0.14, 0.012, 0.03]} p={[-1.15 + i * 0.32, 0.01, 0]} c="#f8fafc" />
      ))}
      <group ref={g}>
        <Cyl a={[0.06, 0.06, 0.6, 12]} r={[0, 0, Math.PI / 2]} c="#f8fafc" />
        <mesh position={[0.34, 0, 0]} rotation={[0, 0, -Math.PI / 2]}>
          <coneGeometry args={[0.06, 0.1, 12]} />
          <Mat c="#f8fafc" />
        </mesh>
        <Box s={[0.18, 0.015, 0.7]} p={[0, 0, 0]} c="#cbd5e1" />
        <Box s={[0.1, 0.15, 0.015]} p={[-0.27, 0.09, 0]} c="#dc2626" />
        <Box s={[0.08, 0.012, 0.22]} p={[-0.27, 0.02, 0]} c="#cbd5e1" />
        <Box s={[0.3, 0.02, 0.122]} p={[0.05, 0.02, 0]} c="#38bdf8" e={0.3} />
      </group>
    </group>
  );
}

function Becak({ t0, car, color }: P & { car?: boolean }) {
  const g = useRef<THREE.Group>(null!);
  const ws = useRef<THREE.Mesh[]>([]);
  const legs = useRef<THREE.Group>(null!);
  useTick(t0, (e, p) => {
    g.current.position.set(car ? -1.6 + easeIn(p) * 3.2 : -1.2 + p * 2.4, car ? 0 : Math.abs(Math.sin(e * 8)) * 0.01, 0);
    ws.current.forEach((w) => w && (w.rotation.z = -e * (car ? 20 : 8)));
    if (legs.current) legs.current.rotation.z = e * 8;
  });
  const wheel = (x: number, z: number, r: number) => (
    <mesh key={`${x}${z}`} ref={(el) => el && !ws.current.includes(el) && ws.current.push(el)} position={[x, r, z]} rotation={[Math.PI / 2, 0, 0]}>
      <torusGeometry args={[r, r * 0.25, 6, 14]} />
      <Mat c="#111" />
    </mesh>
  );
  if (car)
    return (
      <group>
        <Box s={[2.8, 0.01, 0.4]} p={[0, 0.006, 0]} c="#334155" />
        <group ref={g}>
          <Box s={[0.5, 0.13, 0.24]} p={[0, 0.12, 0]} c={color} />
          <Box s={[0.28, 0.11, 0.22]} p={[-0.04, 0.24, 0]} c="#bae6fd" />
          <Ball rad={0.025} p={[0.25, 0.13, 0.08]} c="#fde047" e={2} />
          <Ball rad={0.025} p={[0.25, 0.13, -0.08]} c="#fde047" e={2} />
          {wheel(0.16, 0.12, 0.06)}
          {wheel(0.16, -0.12, 0.06)}
          {wheel(-0.16, 0.12, 0.06)}
          {wheel(-0.16, -0.12, 0.06)}
          <Spray t0={t0} count={16} colors={['#cbd5e1']} size={0.05} origin={[-0.28, 0.08, 0.05]} life={0.7} emit={DUR} gravity={0.2} grow={2} fade vel={(r) => [-0.4, 0.15 + r() * 0.1, (r() - 0.5) * 0.1]} />
        </group>
      </group>
    );
  return (
    <group ref={g}>
      {/* kursi penumpang di depan (becak Jawa) */}
      <Box s={[0.26, 0.06, 0.3]} p={[0.18, 0.2, 0]} c="#dc2626" />
      <Box s={[0.05, 0.18, 0.3]} p={[0.06, 0.3, 0]} c="#dc2626" />
      <mesh position={[0.16, 0.42, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.17, 0.17, 0.32, 12, 1, true, 0, Math.PI]} />
        <meshStandardMaterial color="#1d4ed8" side={THREE.DoubleSide} />
      </mesh>
      {wheel(0.2, 0.17, 0.09)}
      {wheel(0.2, -0.17, 0.09)}
      {wheel(-0.25, 0, 0.09)}
      <Box s={[0.45, 0.025, 0.025]} p={[-0.05, 0.15, 0]} c="#78716c" />
      <Box s={[0.12, 0.03, 0.08]} p={[-0.22, 0.33, 0]} c="#111" />
      <Cyl a={[0.04, 0.05, 0.18, 8]} p={[-0.22, 0.44, 0]} c="#16a34a" />
      <Ball rad={0.045} p={[-0.22, 0.58, 0]} c="#c08457" />
      <mesh position={[-0.22, 0.63, 0]}>
        <coneGeometry args={[0.1, 0.05, 12]} />
        <Mat c="#eab308" />
      </mesh>
      <group ref={legs} position={[-0.2, 0.18, 0]}>
        <Box s={[0.02, 0.12, 0.02]} p={[0, 0.05, 0.04]} c="#c08457" />
        <Box s={[0.02, 0.12, 0.02]} p={[0, -0.05, -0.04]} c="#c08457" />
      </group>
    </group>
  );
}

function Rocket({ t0 }: P) {
  const g = useRef<THREE.Group>(null!);
  const flame = useRef<THREE.Mesh>(null!);
  useTick(t0, (e, p) => {
    const k = clamp01((p - 0.15) / 0.85);
    g.current.position.y = easeIn(k) * 2.6;
    flame.current.scale.set(1, 0.8 + Math.sin(e * 40) * 0.3, 1);
    flame.current.visible = p > 0.08;
  });
  return (
    <group>
      <Box s={[0.6, 0.06, 0.6]} p={[0, 0.03, 0]} c="#475569" />
      <Box s={[0.05, 0.9, 0.05]} p={[0.25, 0.45, 0]} c="#ef4444" />
      <group ref={g}>
        <Cyl a={[0.08, 0.08, 0.6, 14]} p={[0, 0.42, 0]} c="#f8fafc" />
        <mesh position={[0, 0.81, 0]} castShadow>
          <coneGeometry args={[0.08, 0.18, 14]} />
          <Mat c="#dc2626" />
        </mesh>
        {[0, 1, 2, 3].map((i) => (
          <Box key={i} s={[0.02, 0.14, 0.1]} p={[Math.cos((i * Math.PI) / 2) * 0.09, 0.17, Math.sin((i * Math.PI) / 2) * 0.09]} r={[0, (i * Math.PI) / 2, 0]} c="#1e40af" />
        ))}
        <Ball rad={0.03} p={[0, 0.55, 0.075]} c="#38bdf8" e={0.5} />
        <mesh ref={flame} position={[0, 0.02, 0]} rotation={[Math.PI, 0, 0]}>
          <coneGeometry args={[0.07, 0.3, 10]} />
          <meshBasicMaterial color="#f97316" toneMapped={false} />
        </mesh>
      </group>
      <Spray t0={t0} count={40} colors={['#e5e7eb', '#cbd5e1']} size={0.1} origin={[0, 0.05, 0]} life={1.4} emit={DUR - 1} delay={0.3} gravity={0} grow={2} fade vel={(r, i) => [Math.cos(i * 2.4) * (0.5 + r() * 0.3), 0.1, Math.sin(i * 2.4) * (0.5 + r() * 0.3)]} />
    </group>
  );
}

function OilPump({ t0 }: P) {
  const beam = useRef<THREE.Group>(null!);
  const rod = useRef<THREE.Mesh>(null!);
  useTick(t0, (e) => {
    const a = Math.sin(e * 3) * 0.35;
    beam.current.rotation.z = a;
    rod.current.position.y = 0.35 + Math.sin(e * 3) * 0.12;
  });
  return (
    <group>
      <Box s={[1.1, 0.06, 0.35]} p={[0, 0.03, 0]} c="#57534e" />
      <mesh position={[0, 0.35, 0]}>
        <coneGeometry args={[0.22, 0.6, 4]} />
        <Mat c="#ca8a04" />
      </mesh>
      <group ref={beam} position={[0, 0.66, 0]}>
        <Box s={[0.9, 0.06, 0.08]} c="#111827" />
        <Box s={[0.1, 0.26, 0.1]} p={[0.46, -0.08, 0]} c="#ca8a04" />
        <Box s={[0.16, 0.16, 0.12]} p={[-0.46, -0.06, 0]} c="#ca8a04" />
      </group>
      <mesh ref={rod} position={[0.5, 0.35, 0]}>
        <cylinderGeometry args={[0.012, 0.012, 0.5, 6]} />
        <Mat c="#94a3b8" m={0.8} />
      </mesh>
      <Cyl a={[0.06, 0.06, 0.1, 10]} p={[0.5, 0.08, 0]} c="#334155" />
      <Box s={[0.5, 0.04, 0.04]} p={[0.8, 0.08, 0]} c="#334155" />
      <Spray t0={t0} count={14} colors={['#111827']} size={0.05} origin={[1.05, 0.08, 0]} life={0.5} emit={DUR - 0.5} gravity={-3} vel={(r) => [0.2, 0.1 + r() * 0.1, (r() - 0.5) * 0.1]} />
    </group>
  );
}

// ======================= utilitas, uang, sudut =======================

function Lightning({ t0 }: P) {
  const bolts = useRef<THREE.Group[]>([]);
  const light = useRef<THREE.PointLight>(null!);
  useTick(t0, (e) => {
    const flash = Math.floor(e * 7) % 3 === 0 && Math.sin(e * 50) > 0;
    bolts.current.forEach((b, i) => b && (b.visible = flash && (Math.floor(e * 7) + i) % 2 === 0));
    light.current.intensity = flash ? 4 : 0;
  });
  const bolt = (x: number, i: number) => (
    <group key={i} ref={(el) => el && (bolts.current[i] = el)} position={[x, 0, 0]}>
      {[
        [0, 1.25, 0.35],
        [0.07, 1.0, -0.5],
        [0, 0.78, 0.4],
        [0.06, 0.58, -0.4],
      ].map(([bx, by, rz], k) => (
        <mesh key={k} position={[bx, by, 0]} rotation={[0, 0, rz]}>
          <boxGeometry args={[0.035, 0.28, 0.035]} />
          <meshBasicMaterial color="#fef08a" toneMapped={false} />
        </mesh>
      ))}
    </group>
  );
  return (
    <group>
      {/* menara listrik */}
      {[-1, 1].map((s) => (
        <Box key={s} s={[0.03, 0.85, 0.03]} p={[s * 0.1, 0.42, 0]} r={[0, 0, -s * 0.1]} c="#94a3b8" />
      ))}
      {[0.25, 0.5, 0.7].map((y) => (
        <Box key={y} s={[0.4 - y * 0.25, 0.025, 0.03]} p={[0, y, 0]} c="#94a3b8" />
      ))}
      <Box s={[0.6, 0.03, 0.03]} p={[0, 0.82, 0]} c="#94a3b8" />
      {[-1, 1].map((s) => (
        <Box key={s} s={[0.9, 0.008, 0.008]} p={[s * 0.75, 0.78, 0]} r={[0, 0, s * 0.08]} c="#1f2937" />
      ))}
      <group position={[0, 1.5, 0]}>
        {[-0.3, 0, 0.3].map((x, i) => (
          <Ball key={i} rad={0.22} p={[x, i === 1 ? 0.06 : 0, 0]} c="#475569" />
        ))}
      </group>
      {bolt(-0.25, 0)}
      {bolt(0.3, 1)}
      <pointLight ref={light} position={[0, 1, 0.3]} color="#fef08a" distance={3} />
      <Spray t0={t0} count={30} colors={['#fde047', '#ffffff']} size={0.03} glow={3} origin={[0, 0.85, 0]} life={0.5} emit={DUR - 0.5} gravity={-2} vel={(r) => [(r() - 0.5) * 1.5, r() * 1, (r() - 0.5) * 1.5]} />
    </group>
  );
}

function WaterFountain({ t0 }: P) {
  return (
    <group>
      <Cyl a={[0.55, 0.6, 0.14, 24]} p={[0, 0.07, 0]} c="#cbd5e1" />
      <Cyl a={[0.5, 0.5, 0.02, 24]} p={[0, 0.14, 0]} c="#38bdf8" />
      <Cyl a={[0.05, 0.07, 0.4, 10]} p={[0, 0.34, 0]} c="#e2e8f0" />
      <Cyl a={[0.2, 0.12, 0.05, 16]} p={[0, 0.55, 0]} c="#e2e8f0" />
      <Spray t0={t0} count={90} colors={['#7dd3fc', '#e0f2fe', '#38bdf8']} size={0.04} origin={[0, 0.6, 0]} life={0.9} emit={DUR - 0.8} gravity={-4} glow={0.5} vel={(r, i) => [Math.cos(i * 1.7) * (0.3 + r() * 0.25), 1.6 + r() * 0.4, Math.sin(i * 1.7) * (0.3 + r() * 0.25)]} />
    </group>
  );
}

function Coins({ t0 }: P) {
  const bag = useRef<THREE.Group>(null!);
  useTick(t0, (e) => (bag.current.scale.setScalar(1 + Math.sin(e * 10) * 0.02)));
  return (
    <group>
      <group ref={bag} position={[0.45, 0, 0]}>
        <Ball rad={0.24} p={[0, 0.22, 0]} s={[1, 1.1, 1]} c="#a16207" />
        <Cyl a={[0.07, 0.12, 0.1, 10]} p={[0, 0.48, 0]} c="#a16207" />
        <mesh position={[0, 0.25, 0.23]}>
          <torusGeometry args={[0.06, 0.012, 6, 16]} />
          <Mat c="#fde047" m={0.8} r={0.2} />
        </mesh>
      </group>
      <Spray t0={t0} count={40} colors={['#fbbf24', '#facc15']} size={0.12} shape="coin" spin={6} life={0.9} emit={DUR - 0.9} gravity={-3} vel={(r) => [0.2 + r() * 0.3, 0.6 + r() * 0.5, (r() - 0.5) * 0.3]} spread={(r) => [-0.5 + (r() - 0.5) * 0.4, 0.9, (r() - 0.5) * 0.3]} />
      {Array.from({ length: 6 }, (_, i) => (
        <Cyl key={i} a={[0.06, 0.06, 0.02, 14]} p={[-0.2 + (i % 3) * 0.1, 0.01 + Math.floor(i / 3) * 0.02, (i % 2) * 0.08]} c="#fbbf24" m={0.8} />
      ))}
    </group>
  );
}

function Diamond({ t0 }: P) {
  const g = useRef<THREE.Group>(null!);
  useTick(t0, (e, p) => {
    g.current.rotation.y = e * 2.2;
    g.current.position.y = 0.55 + Math.sin(e * 2) * 0.06 + easeOut(clamp01(p * 4)) * 0.1;
  });
  return (
    <group>
      <Cyl a={[0.32, 0.38, 0.12, 24]} p={[0, 0.06, 0]} c="#1e293b" />
      <Cyl a={[0.3, 0.3, 0.02, 24]} p={[0, 0.13, 0]} c="#7f1d1d" />
      <group ref={g}>
        <mesh castShadow>
          <cylinderGeometry args={[0.18, 0.26, 0.1, 8]} />
          <meshPhysicalMaterial color="#a5f3fc" metalness={0.1} roughness={0} transmission={0.6} thickness={0.5} emissive="#22d3ee" emissiveIntensity={0.4} flatShading />
        </mesh>
        <mesh position={[0, -0.25, 0]} rotation={[Math.PI, 0, 0]} castShadow>
          <coneGeometry args={[0.26, 0.4, 8]} />
          <meshPhysicalMaterial color="#a5f3fc" metalness={0.1} roughness={0} transmission={0.6} thickness={0.5} emissive="#22d3ee" emissiveIntensity={0.4} flatShading />
        </mesh>
      </group>
      <pointLight position={[0, 0.6, 0.3]} color="#67e8f9" intensity={2} distance={2} />
      <Spray t0={t0} count={24} colors={['#ffffff', '#a5f3fc']} size={0.04} shape="note" glow={3} spin={3} life={0.8} emit={DUR - 0.8} gravity={0} vel={(r) => [(r() - 0.5) * 0.4, (r() - 0.5) * 0.4, (r() - 0.5) * 0.4]} spread={(r) => [(r() - 0.5) * 0.7, 0.35 + r() * 0.5, (r() - 0.5) * 0.7]} />
    </group>
  );
}

function Money({ t0 }: P) {
  const ring = useRef<THREE.Mesh>(null!);
  useTick(t0, (e) => {
    const k = (e % 0.9) / 0.9;
    ring.current.scale.setScalar(0.3 + k * 1.2);
    (ring.current.material as THREE.MeshBasicMaterial).opacity = 0.8 * (1 - k);
  });
  return (
    <group>
      <mesh ref={ring} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.03, 0]}>
        <ringGeometry args={[0.5, 0.58, 40]} />
        <meshBasicMaterial color="#4ade80" transparent depthWrite={false} toneMapped={false} />
      </mesh>
      <Spray t0={t0} count={40} colors={['#16a34a', '#22c55e', '#86efac']} size={0.16} shape="flat" spin={5} life={2} emit={1.2} gravity={-1.2} vel={(r, i) => [Math.cos(i * 2.4) * (0.4 + r() * 0.4), 1.8 + r() * 0.6, Math.sin(i * 2.4) * (0.4 + r() * 0.4)]} />
      <Spray t0={t0} count={20} colors={['#fbbf24']} size={0.09} shape="coin" spin={8} life={1.6} emit={1.5} delay={0.3} gravity={-2.5} vel={(r, i) => [Math.cos(i * 1.9) * 0.5, 1.8 + r() * 0.4, Math.sin(i * 1.9) * 0.5]} />
    </group>
  );
}

function Bars({ t0 }: P) {
  const g = useRef<THREE.Group>(null!);
  useTick(t0, (e, p) => {
    const k = easeOut(clamp01(p * 3));
    g.current.position.y = (1 - k) * 1.2;
    g.current.position.x = k >= 1 ? Math.sin(e * 30) * 0.015 * Math.max(0, 1 - (p - 0.33) * 3) : 0;
  });
  return (
    <group>
      <Box s={[1.1, 0.08, 0.12]} p={[0, 0.04, 0]} c="#334155" />
      <group ref={g}>
        <Box s={[1.1, 0.07, 0.12]} p={[0, 0.95, 0]} c="#475569" />
        <Box s={[1.1, 0.05, 0.1]} p={[0, 0.5, 0]} c="#475569" />
        {Array.from({ length: 7 }, (_, i) => (
          <Cyl key={i} a={[0.025, 0.025, 0.9, 8]} p={[-0.45 + i * 0.15, 0.5, 0]} c="#94a3b8" m={0.9} />
        ))}
        <mesh position={[0.2, 0.5, 0.08]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.06, 0.015, 6, 16]} />
          <Mat c="#cbd5e1" m={0.9} r={0.2} />
        </mesh>
        <mesh position={[0.3, 0.5, 0.08]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.06, 0.015, 6, 16]} />
          <Mat c="#cbd5e1" m={0.9} r={0.2} />
        </mesh>
      </group>
    </group>
  );
}

function Siren({ t0 }: P) {
  const beam = useRef<THREE.Group>(null!);
  const red = useRef<THREE.PointLight>(null!);
  const blue = useRef<THREE.PointLight>(null!);
  const lr = useRef<THREE.Mesh>(null!);
  const lb = useRef<THREE.Mesh>(null!);
  useTick(t0, (e) => {
    beam.current.rotation.y = e * 9;
    const on = Math.floor(e * 6) % 2 === 0;
    red.current.intensity = on ? 4 : 0;
    blue.current.intensity = on ? 0 : 4;
    (lr.current.material as THREE.MeshBasicMaterial).color.set(on ? '#ef4444' : '#450a0a');
    (lb.current.material as THREE.MeshBasicMaterial).color.set(on ? '#172554' : '#3b82f6');
  });
  return (
    <group>
      <Box s={[0.7, 0.16, 0.34]} p={[0, 0.14, 0]} c="#f8fafc" />
      <Box s={[0.36, 0.14, 0.32]} p={[-0.03, 0.28, 0]} c="#1e293b" />
      <Box s={[0.7, 0.05, 0.345]} p={[0, 0.14, 0]} c="#1d4ed8" />
      {[
        [0.22, 0.17],
        [0.22, -0.17],
        [-0.22, 0.17],
        [-0.22, -0.17],
      ].map(([x, z], i) => (
        <Cyl key={i} a={[0.06, 0.06, 0.04, 12]} p={[x, 0.06, z]} r={[Math.PI / 2, 0, 0]} c="#111" />
      ))}
      <mesh ref={lr} position={[-0.03, 0.38, 0.07]}>
        <boxGeometry args={[0.1, 0.05, 0.1]} />
        <meshBasicMaterial color="#ef4444" toneMapped={false} />
      </mesh>
      <mesh ref={lb} position={[-0.03, 0.38, -0.07]}>
        <boxGeometry args={[0.1, 0.05, 0.1]} />
        <meshBasicMaterial color="#3b82f6" toneMapped={false} />
      </mesh>
      <group ref={beam} position={[-0.03, 0.4, 0]}>
        <mesh position={[0.35, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
          <coneGeometry args={[0.12, 0.7, 16, 1, true]} />
          <meshBasicMaterial color="#ef4444" transparent opacity={0.35} depthWrite={false} side={THREE.DoubleSide} />
        </mesh>
        <mesh position={[-0.35, 0, 0]} rotation={[0, 0, -Math.PI / 2]}>
          <coneGeometry args={[0.12, 0.7, 16, 1, true]} />
          <meshBasicMaterial color="#3b82f6" transparent opacity={0.35} depthWrite={false} side={THREE.DoubleSide} />
        </mesh>
      </group>
      <pointLight ref={red} position={[0, 0.6, 0.3]} color="#ef4444" distance={2.5} />
      <pointLight ref={blue} position={[0, 0.6, -0.3]} color="#3b82f6" distance={2.5} />
    </group>
  );
}

function Steam({ t0 }: P) {
  return (
    <group>
      <Cyl a={[0.32, 0.32, 0.03, 24]} p={[0, 0.015, 0]} c="#f8fafc" />
      <Cyl a={[0.2, 0.15, 0.3, 20]} p={[0, 0.18, 0]} c="#f8fafc" />
      <Cyl a={[0.185, 0.185, 0.01, 20]} p={[0, 0.33, 0]} c="#57340f" />
      <mesh position={[0.22, 0.2, 0]}>
        <torusGeometry args={[0.07, 0.02, 8, 16]} />
        <Mat c="#f8fafc" />
      </mesh>
      <Spray t0={t0} count={30} colors={['#f8fafc', '#e2e8f0']} size={0.08} origin={[0, 0.36, 0]} life={1.6} emit={DUR - 1.2} gravity={0} grow={2.5} fade vel={(r, i) => [Math.sin(i * 2) * 0.08, 0.45 + r() * 0.15, (r() - 0.5) * 0.08]} spread={(r) => [(r() - 0.5) * 0.2, 0, (r() - 0.5) * 0.2]} />
    </group>
  );
}

function Fireworks({ t0 }: P) {
  const shots = [
    { x: -0.6, z: -0.2, d: 0, c: ['#f43f5e', '#fda4af'] },
    { x: 0.5, z: 0.1, d: 0.5, c: ['#38bdf8', '#e0f2fe'] },
    { x: 0, z: -0.4, d: 1.0, c: ['#facc15', '#fef08a'] },
    { x: -0.3, z: 0.3, d: 1.6, c: ['#a78bfa', '#ddd6fe'] },
    { x: 0.6, z: -0.3, d: 2.1, c: ['#4ade80', '#bbf7d0'] },
  ];
  const trails = useRef<THREE.Mesh[]>([]);
  useTick(t0, (e) => {
    trails.current.forEach((m, i) => {
      if (!m) return;
      const a = e - shots[i].d;
      m.visible = a > 0 && a < 0.5;
      m.position.y = 0.2 + a * 2.6;
    });
  });
  return (
    <group>
      {/* Monas kecil sebagai pusat pesta */}
      <Box s={[0.3, 0.06, 0.3]} p={[0, 0.03, 0]} c="#e7e5e4" />
      <Cyl a={[0.035, 0.06, 0.6, 4]} p={[0, 0.36, 0]} c="#f8fafc" />
      <mesh position={[0, 0.72, 0]}>
        <octahedronGeometry args={[0.05, 0]} />
        <Mat c="#fbbf24" e={1.2} m={0.8} r={0.2} />
      </mesh>
      {shots.map((s, i) => (
        <group key={i}>
          <mesh ref={(el) => el && (trails.current[i] = el)} position={[s.x, 0.2, s.z]}>
            <sphereGeometry args={[0.03, 6, 6]} />
            <meshBasicMaterial color={s.c[1]} toneMapped={false} />
          </mesh>
          <Spray t0={t0} seed={i + 3} count={46} colors={s.c} size={0.045} glow={3} origin={[s.x, 1.5, s.z]} delay={s.d + 0.5} life={1.1} gravity={-0.8} fade vel={(r, k) => {
            const th = k * 2.399;
            const ph = Math.acos(1 - (2 * (k + 0.5)) / 46);
            const sp = 0.8 + r() * 0.2;
            return [Math.cos(th) * Math.sin(ph) * sp, Math.cos(ph) * sp, Math.sin(th) * Math.sin(ph) * sp];
          }} />
        </group>
      ))}
    </group>
  );
}

function Stars({ t0 }: P) {
  const beams = useRef<THREE.Group[]>([]);
  useTick(t0, (e) => beams.current.forEach((b, i) => b && (b.rotation.z = Math.sin(e * 1.6 + i * 2) * 0.6)));
  return (
    <group>
      {[-0.6, 0.6].map((x, i) => (
        <group key={x} ref={(el) => el && (beams.current[i] = el)} position={[x, 0.05, -0.2]}>
          <mesh position={[0, 0.9, 0]}>
            <coneGeometry args={[0.28, 1.8, 20, 1, true]} />
            <meshBasicMaterial color={i ? '#fbbf24' : '#a78bfa'} transparent opacity={0.3} depthWrite={false} side={THREE.DoubleSide} />
          </mesh>
          <Cyl a={[0.07, 0.09, 0.1, 12]} c="#1e293b" />
        </group>
      ))}
      <Spray t0={t0} count={36} colors={['#fde047', '#ffffff', '#f9a8d4']} size={0.08} shape="note" glow={3} spin={4} life={1.2} emit={DUR - 1} gravity={0} grow={-0.5} vel={(r) => [(r() - 0.5) * 0.3, 0.3 + r() * 0.3, (r() - 0.5) * 0.3]} spread={(r) => [(r() - 0.5) * 1.8, 0.2 + r() * 0.8, (r() - 0.5) * 0.8]} />
    </group>
  );
}

// ======================= pemilih =======================

export function AnimBody({ id, ...p }: P & { id: AnimId }) {
  switch (id) {
    case 'horse': return <Horse {...p} />;
    case 'bird': return <Bird {...p} />;
    case 'deer': return <Deer {...p} />;
    case 'volcano': return <Volcano {...p} />;
    case 'dancer': return <Dancer {...p} />;
    case 'ship': return <Ship {...p} />;
    case 'fish': return <Fish {...p} />;
    case 'oilpump': return <OilPump {...p} />;
    case 'equator': return <Equator {...p} />;
    case 'boats': return <Boats {...p} />;
    case 'bridge': return <Bridge {...p} />;
    case 'clock': return <Clock {...p} />;
    case 'boatrace': return <BoatRace {...p} />;
    case 'durian': return <Durian {...p} />;
    case 'doors': return <Doors {...p} />;
    case 'wayang': return <Wayang {...p} />;
    case 'becak': return <Becak {...p} />;
    case 'car': return <Becak {...p} car />;
    case 'fruit': return <Fruit {...p} />;
    case 'sharkcroc': return <SharkCroc {...p} />;
    case 'notes': return <Notes {...p} />;
    case 'monkeys': return <Monkeys {...p} />;
    case 'fireworks': return <Fireworks {...p} />;
    case 'train': return <Train {...p} />;
    case 'metro': return <Train {...p} metro />;
    case 'plane': return <Plane {...p} />;
    case 'lightning': return <Lightning {...p} />;
    case 'water': return <WaterFountain {...p} />;
    case 'coins': return <Coins {...p} />;
    case 'diamond': return <Diamond {...p} />;
    case 'money': return <Money {...p} />;
    case 'bars': return <Bars {...p} />;
    case 'siren': return <Siren {...p} />;
    case 'steam': return <Steam {...p} />;
    case 'rocket': return <Rocket {...p} />;
    case 'snow': return <Snow {...p} />;
    case 'aurora': return <Aurora {...p} />;
    case 'rain': return <Rain {...p} />;
    case 'desert': return <Desert {...p} />;
    case 'blossom': return <Blossom {...p} />;
    case 'stars': return <Stars {...p} />;
    case 'bear': return <Bear {...p} />;
    case 'flag': return <Flag {...p} />;
  }
}

/** Satu animasi di dalam papan, di depan petak tempat bidak mendarat. */
export function TileAnim({ tile, theme, t0, anim }: { tile: number; theme: Theme; t0: number; anim?: AnimId }) {
  const info = tileAnimFor(theme, tile);
  const g = useRef<THREE.Group>(null!);
  useFrame(() => {
    if (!g.current) return; // petak tanpa animasi (Kesempatan/Dana Umum) tidak merender grup
    const p = clamp01(sec(t0) / DUR);
    // muncul memantul, lalu mengecil saat selesai
    const s = p < 0.1 ? 1 + 1.7 * (p / 0.1 - 1) ** 3 + 0.7 * (p / 0.1 - 1) ** 2 : p > 0.9 ? (1 - p) / 0.1 : 1;
    g.current.scale.setScalar(Math.max(0.001, s) * 1.7);
    g.current.visible = p < 1;
  });
  if (!info) return null;
  const id = anim ?? info.id;
  const [x, z] = tilePos(tile, tile % 10 === 0 ? 3.1 : 2.7);
  const color = info.color ?? (BOARD_COLOR(theme, tile) || theme.visual.accent);
  return (
    <group position={[x, TOP, z]} rotation={[0, tileRotY(tile), 0]}>
      <group ref={g}>
        <AnimBody id={id} t0={t0} color={color} accent={theme.visual.accent} />
      </group>
      <Html position={[0, 2.9, 0]} center zIndexRange={[19, 0]} pointerEvents="none">
        <div className="anim-cap">
          <span aria-hidden>{info.emoji}</span> {info.own ? info.caption : tr(info.caption)}
        </div>
      </Html>
    </group>
  );
}

const BOARD_COLOR = (theme: Theme, i: number) => (BOARD[i].kind === 'property' ? theme.groupColors[BOARD[i].group!] : '');
