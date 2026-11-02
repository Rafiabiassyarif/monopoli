// Ikon besar di tengah pulau, khas tiap negara: Monas, Patung Liberty, Katedral St. Basil, pagoda + torii,
// Big Ben, kastil ninja, Menara Eiffel, piramida, gedung pencakar langit, atau koin emas (bawaan tema kustom).
// Semua low-poly prosedural (tanpa file model), muat di plaza berjari-jari ±1,3.

import { useMemo, useRef, type ReactNode } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { LandmarkKind } from '@monopoli/engine';
import { FONT } from './layout';

const M = ({ c, r = 0.55, m = 0.05, e, ei = 0.6, flat }: { c: string; r?: number; m?: number; e?: string; ei?: number; flat?: boolean }) => (
  <meshStandardMaterial color={c} roughness={r} metalness={m} emissive={e ?? '#000000'} emissiveIntensity={e ? ei : 0} flatShading={flat} />
);

function Box({ p, s, c, rot, ...rest }: { p: [number, number, number]; s: [number, number, number]; c: string; rot?: [number, number, number]; r?: number; m?: number }) {
  return (
    <mesh position={p} rotation={rot} castShadow receiveShadow>
      <boxGeometry args={s} />
      <M c={c} r={rest.r} m={rest.m} />
    </mesh>
  );
}

function Cyl({ p, rt, rb, h, c, seg = 16, rot, ...rest }: { p: [number, number, number]; rt: number; rb: number; h: number; c: string; seg?: number; rot?: [number, number, number]; r?: number; m?: number; e?: string }) {
  return (
    <mesh position={p} rotation={rot} castShadow receiveShadow>
      <cylinderGeometry args={[rt, rb, h, seg]} />
      <M c={c} r={rest.r} m={rest.m} e={rest.e} />
    </mesh>
  );
}

/** api emas berkedip (puncak Monas, obor Liberty) */
function Flame({ y, s = 1 }: { y: number; s?: number }) {
  const ref = useRef<THREE.Mesh>(null!);
  useFrame(({ clock }) => {
    const k = 1 + Math.sin(clock.elapsedTime * 7) * 0.08;
    ref.current.scale.set(s * k, s * (1.1 - (k - 1)), s * k);
  });
  return (
    <mesh ref={ref} position={[0, y, 0]}>
      <coneGeometry args={[0.09, 0.26, 8]} />
      <meshStandardMaterial color="#ffd54a" emissive="#ffb300" emissiveIntensity={1.4} metalness={0.6} roughness={0.25} />
    </mesh>
  );
}

// ---------- Indonesia: Monas ----------
function Monas() {
  return (
    <group>
      {/* pelataran & cawan */}
      <Box p={[0, 0.06, 0]} s={[1.3, 0.12, 1.3]} c="#e7e1d3" />
      <Box p={[0, 0.2, 0]} s={[0.95, 0.16, 0.95]} c="#f3efe6" />
      <Cyl p={[0, 0.36, 0]} rt={0.55} rb={0.3} h={0.16} c="#f3efe6" seg={4} rot={[0, Math.PI / 4, 0]} />
      {/* tugu meruncing */}
      <Cyl p={[0, 1.15, 0]} rt={0.06} rb={0.14} h={1.45} c="#f8f5ee" seg={4} rot={[0, Math.PI / 4, 0]} />
      <Cyl p={[0, 1.93, 0]} rt={0.09} rb={0.06} h={0.1} c="#d4a017" m={0.7} seg={8} />
      <Flame y={2.1} />
    </group>
  );
}

// ---------- USA: Patung Liberty ----------
function Liberty() {
  const green = '#7fbfa8';
  return (
    <group>
      <Cyl p={[0, 0.12, 0]} rt={0.62} rb={0.7} h={0.24} c="#c9b99a" seg={11} />
      <Box p={[0, 0.48, 0]} s={[0.55, 0.48, 0.55]} c="#d8cdb4" />
      <Box p={[0, 0.76, 0]} s={[0.42, 0.08, 0.42]} c="#cbbd9e" />
      {/* jubah */}
      <Cyl p={[0, 1.12, 0]} rt={0.12} rb={0.22} h={0.64} c={green} seg={10} r={0.7} />
      <mesh position={[0, 1.52, 0]} castShadow>
        <sphereGeometry args={[0.1, 14, 12]} />
        <M c={green} r={0.7} />
      </mesh>
      {/* mahkota */}
      {Array.from({ length: 7 }, (_, k) => {
        const a = (k / 7) * Math.PI - Math.PI / 2;
        return <Cyl key={k} p={[Math.sin(a) * 0.1, 1.62, Math.cos(a) * 0.1 - 0.02]} rt={0} rb={0.02} h={0.12} c={green} seg={4} rot={[Math.cos(a) * 0.7, 0, -Math.sin(a) * 0.7]} />;
      })}
      {/* lengan terangkat + obor */}
      <Cyl p={[0.14, 1.62, 0]} rt={0.03} rb={0.04} h={0.42} c={green} seg={6} rot={[0, 0, -0.25]} />
      <Cyl p={[0.2, 1.86, 0]} rt={0.05} rb={0.03} h={0.07} c="#d4a017" m={0.6} seg={8} />
      <group position={[0.2, 0, 0]}>
        <Flame y={1.96} s={0.6} />
      </group>
      {/* buku */}
      <Box p={[-0.17, 1.2, 0.06]} s={[0.07, 0.16, 0.12]} c={green} rot={[0, 0, 0.3]} />
    </group>
  );
}

// ---------- Rusia: Katedral St. Basil ----------
function Onion({ x, z, h, r, c, stripe }: { x: number; z: number; h: number; r: number; c: string; stripe: string }) {
  return (
    <group position={[x, 0, z]}>
      <Cyl p={[0, h / 2, 0]} rt={r * 0.75} rb={r * 0.8} h={h} c="#c2410c" seg={8} />
      <Cyl p={[0, h + 0.02, 0]} rt={r * 0.85} rb={r * 0.85} h={0.04} c="#f5f5f4" seg={8} />
      <mesh position={[0, h + r * 0.75, 0]} scale={[1, 1.15, 1]} castShadow>
        <sphereGeometry args={[r, 12, 10]} />
        <M c={c} r={0.4} m={0.2} />
      </mesh>
      <mesh position={[0, h + r * 0.75, 0]} scale={[1.01, 1.16, 1.01]}>
        <sphereGeometry args={[r, 6, 10]} />
        <meshStandardMaterial color={stripe} wireframe />
      </mesh>
      <Cyl p={[0, h + r * 1.95, 0]} rt={0} rb={r * 0.32} h={r * 0.8} c="#d4a017" m={0.7} seg={8} />
    </group>
  );
}
function Basil() {
  return (
    <group>
      <Box p={[0, 0.12, 0]} s={[1.3, 0.24, 1.0]} c="#b91c1c" />
      <Box p={[0, 0.3, 0]} s={[1.1, 0.12, 0.85]} c="#f5f5f4" />
      {/* menara tengah tinggi beratap tenda */}
      <Cyl p={[0, 0.75, 0]} rt={0.16} rb={0.2} h={0.9} c="#c2410c" seg={8} />
      <Cyl p={[0, 1.42, 0]} rt={0} rb={0.2} h={0.5} c="#15803d" seg={8} />
      <Cyl p={[0, 1.75, 0]} rt={0.02} rb={0.06} h={0.18} c="#d4a017" m={0.7} seg={8} />
      <Onion x={-0.42} z={0.2} h={0.55} r={0.16} c="#16a34a" stripe="#fde047" />
      <Onion x={0.42} z={0.2} h={0.6} r={0.17} c="#2563eb" stripe="#f8fafc" />
      <Onion x={-0.34} z={-0.24} h={0.66} r={0.15} c="#dc2626" stripe="#fef08a" />
      <Onion x={0.34} z={-0.24} h={0.5} r={0.15} c="#eab308" stripe="#16a34a" />
      <Onion x={0} z={0.36} h={0.42} r={0.14} c="#7c3aed" stripe="#f8fafc" />
    </group>
  );
}

// ---------- Jepang: pagoda lima tingkat + torii ----------
function Pagoda({ white }: { white?: boolean }) {
  const wall = white ? '#f8fafc' : '#b91c1c';
  const roof = white ? '#334155' : '#1f2937';
  return (
    <group>
      <Box p={[0, 0.08, 0]} s={[0.9, 0.16, 0.9]} c={white ? '#78716c' : '#a8a29e'} />
      {Array.from({ length: 5 }, (_, k) => {
        const w = 0.62 - k * 0.08;
        const y = 0.16 + k * 0.33;
        return (
          <group key={k} position={[0, y, 0]}>
            <Box p={[0, 0.12, 0]} s={[w, 0.24, w]} c={wall} />
            <Cyl p={[0, 0.28, 0]} rt={w * 0.35} rb={w * 0.95} h={0.1} c={roof} seg={4} rot={[0, Math.PI / 4, 0]} />
          </group>
        );
      })}
      <Cyl p={[0, 2.0, 0]} rt={0.01} rb={0.03} h={0.42} c="#d4a017" m={0.7} seg={6} />
    </group>
  );
}
function Torii({ z }: { z: number }) {
  const red = '#dc2626';
  return (
    <group position={[0, 0, z]}>
      <Cyl p={[-0.3, 0.3, 0]} rt={0.035} rb={0.045} h={0.6} c={red} seg={8} />
      <Cyl p={[0.3, 0.3, 0]} rt={0.035} rb={0.045} h={0.6} c={red} seg={8} />
      <Box p={[0, 0.52, 0]} s={[0.72, 0.05, 0.06]} c={red} />
      <Box p={[0, 0.62, 0]} s={[0.86, 0.06, 0.08]} c="#111827" />
    </group>
  );
}
function JapanSet() {
  return (
    <group>
      <Pagoda />
      <group position={[-0.78, 0, 0.3]} rotation={[0, Math.PI / 2, 0]}>
        <Torii z={0} />
      </group>
    </group>
  );
}

// ---------- Inggris: Big Ben ----------
function clockTex() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d')!;
  g.fillStyle = '#fefce8';
  g.beginPath();
  g.arc(64, 64, 60, 0, Math.PI * 2);
  g.fill();
  g.strokeStyle = '#1f2937';
  g.lineWidth = 6;
  g.stroke();
  for (let k = 0; k < 12; k++) {
    const a = (k / 12) * Math.PI * 2;
    g.fillStyle = '#1f2937';
    g.fillRect(64 + Math.sin(a) * 48 - 3, 64 - Math.cos(a) * 48 - 3, 6, 6);
  }
  g.lineWidth = 6;
  g.beginPath();
  g.moveTo(64, 64);
  g.lineTo(64, 26);
  g.moveTo(64, 64);
  g.lineTo(92, 70);
  g.stroke();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
function BigBen() {
  const tex = useMemo(clockTex, []);
  const stone = '#c8a96a';
  return (
    <group>
      <Box p={[0, 0.08, 0]} s={[0.8, 0.16, 0.8]} c="#a8916a" />
      <Box p={[0, 0.85, 0]} s={[0.42, 1.4, 0.42]} c={stone} r={0.7} />
      {/* garis-garis jendela vertikal */}
      {[-0.12, 0, 0.12].map((x) => (
        <Box key={x} p={[x, 0.85, 0.212]} s={[0.03, 1.2, 0.01]} c="#8b6f3e" />
      ))}
      <Box p={[0, 1.72, 0]} s={[0.5, 0.36, 0.5]} c="#d6bb7e" r={0.6} />
      {[0, 1, 2, 3].map((k) => (
        <mesh key={k} position={[Math.sin((k * Math.PI) / 2) * 0.252, 1.72, Math.cos((k * Math.PI) / 2) * 0.252]} rotation={[0, (k * Math.PI) / 2, 0]}>
          <circleGeometry args={[0.15, 24]} />
          <meshStandardMaterial map={tex} emissive="#fef3c7" emissiveIntensity={0.25} />
        </mesh>
      ))}
      <Box p={[0, 1.98, 0]} s={[0.4, 0.16, 0.4]} c={stone} />
      <Cyl p={[0, 2.3, 0]} rt={0.01} rb={0.3} h={0.5} c="#3f4a3c" seg={4} rot={[0, Math.PI / 4, 0]} />
      <Cyl p={[0, 2.6, 0]} rt={0.005} rb={0.02} h={0.16} c="#d4a017" m={0.7} seg={6} />
    </group>
  );
}

// ---------- Negeri Ninja: kastil (orisinal) ----------
function Castle() {
  return (
    <group>
      {/* dinding batu miring */}
      <Cyl p={[0, 0.25, 0]} rt={0.55} rb={0.75} h={0.5} c="#9ca3af" seg={4} rot={[0, Math.PI / 4, 0]} r={0.9} />
      {[0, 1, 2].map((k) => {
        const w = 0.66 - k * 0.15;
        const y = 0.5 + k * 0.38;
        return (
          <group key={k} position={[0, y, 0]}>
            <Box p={[0, 0.14, 0]} s={[w, 0.28, w * 0.85]} c="#f8fafc" />
            <Cyl p={[0, 0.33, 0]} rt={w * 0.3} rb={w * 0.92} h={0.14} c="#1e293b" seg={4} rot={[0, Math.PI / 4, 0]} />
          </group>
        );
      })}
      {/* hiasan emas di puncak */}
      <Box p={[-0.13, 1.72, 0]} s={[0.08, 0.1, 0.05]} c="#eab308" m={0.7} />
      <Box p={[0.13, 1.72, 0]} s={[0.08, 0.1, 0.05]} c="#eab308" m={0.7} />
      <Cyl p={[0, 1.78, 0]} rt={0} rb={0.08} h={0.16} c="#ea580c" seg={4} />
    </group>
  );
}

// ---------- Prancis: Menara Eiffel ----------
function Eiffel() {
  const iron = '#8b5e3c';
  const legs = [
    [1, 1],
    [1, -1],
    [-1, 1],
    [-1, -1],
  ] as const;
  return (
    <group>
      {legs.map(([sx, sz], k) => (
        <mesh key={k} position={[sx * 0.33, 0.42, sz * 0.33]} rotation={[sz * 0.42, 0, -sx * 0.42]} castShadow>
          <boxGeometry args={[0.09, 0.95, 0.09]} />
          <M c={iron} r={0.6} m={0.4} />
        </mesh>
      ))}
      <Box p={[0, 0.82, 0]} s={[0.62, 0.06, 0.62]} c={iron} m={0.4} />
      <Cyl p={[0, 1.2, 0]} rt={0.12} rb={0.24} h={0.72} c={iron} seg={4} rot={[0, Math.PI / 4, 0]} m={0.4} />
      <Box p={[0, 1.58, 0]} s={[0.24, 0.05, 0.24]} c={iron} m={0.4} />
      <Cyl p={[0, 2.0, 0]} rt={0.015} rb={0.1} h={0.82} c={iron} seg={4} rot={[0, Math.PI / 4, 0]} m={0.4} />
      <Cyl p={[0, 2.48, 0]} rt={0.005} rb={0.012} h={0.16} c="#e5e7eb" seg={4} />
    </group>
  );
}

// ---------- Mesir: piramida ----------
function Pyramid() {
  return (
    <group>
      <Cyl p={[0, 0.65, 0]} rt={0} rb={1.0} h={1.3} c="#e0b765" seg={4} rot={[0, Math.PI / 4, 0]} r={0.95} />
      <Cyl p={[0, 1.24, 0]} rt={0} rb={0.1} h={0.13} c="#f5d77a" seg={4} rot={[0, Math.PI / 4, 0]} m={0.6} />
      <group position={[0.9, 0, 0.75]} scale={0.45}>
        <Cyl p={[0, 0.65, 0]} rt={0} rb={1.0} h={1.3} c="#d9ad59" seg={4} rot={[0, Math.PI / 4, 0]} r={0.95} />
      </group>
    </group>
  );
}

// ---------- kota modern: gedung pencakar langit ----------
function Skyscraper() {
  const glass = '#60a5fa';
  return (
    <group>
      <Box p={[0, 0.9, 0]} s={[0.5, 1.8, 0.5]} c={glass} r={0.15} m={0.6} />
      <Box p={[0, 2.0, 0]} s={[0.36, 0.4, 0.36]} c="#93c5fd" r={0.15} m={0.6} />
      <Cyl p={[0, 2.45, 0]} rt={0.01} rb={0.04} h={0.5} c="#e5e7eb" seg={6} />
      <Box p={[0.5, 0.55, 0.15]} s={[0.36, 1.1, 0.36]} c="#38bdf8" r={0.2} m={0.5} />
      <Box p={[-0.48, 0.42, -0.1]} s={[0.32, 0.84, 0.32]} c="#7dd3fc" r={0.2} m={0.5} />
    </group>
  );
}

// ---------- bawaan: Tugu Koin ----------
function coinTexture(symbol: string) {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d')!;
  const grad = g.createRadialGradient(100, 90, 10, 128, 128, 128);
  grad.addColorStop(0, '#fff3b0');
  grad.addColorStop(0.55, '#fbbf24');
  grad.addColorStop(1, '#b45309');
  g.fillStyle = grad;
  g.fillRect(0, 0, 256, 256);
  g.strokeStyle = 'rgba(120,53,15,.55)';
  g.lineWidth = 10;
  g.beginPath();
  g.arc(128, 128, 104, 0, Math.PI * 2);
  g.stroke();
  g.fillStyle = '#7c2d12';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.font = `800 ${symbol.length > 2 ? 70 : 120}px ${FONT}`;
  g.fillText(symbol, 128, 136);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
function Coin({ symbol, accent }: { symbol: string; accent: string }) {
  const coin = useRef<THREE.Group>(null!);
  const tex = useMemo(() => coinTexture(symbol), [symbol]);
  useFrame(({ clock }) => {
    coin.current.rotation.y = clock.elapsedTime * 0.8;
    coin.current.position.y = 1.35 + Math.sin(clock.elapsedTime * 1.6) * 0.05;
  });
  return (
    <group>
      <Cyl p={[0, 0.06, 0]} rt={0.72} rb={0.78} h={0.12} c="#f1ead8" seg={8} />
      <Cyl p={[0, 0.17, 0]} rt={0.52} rb={0.58} h={0.12} c={accent} seg={8} r={0.45} />
      <Cyl p={[0, 0.5, 0]} rt={0.09} rb={0.16} h={0.56} c="#f1ead8" seg={8} />
      <group ref={coin}>
        <mesh rotation={[Math.PI / 2, 0, 0]} castShadow>
          <cylinderGeometry args={[0.56, 0.56, 0.11, 40]} />
          <meshStandardMaterial color="#f5b82e" metalness={0.85} roughness={0.25} emissive="#7c4a03" emissiveIntensity={0.25} />
        </mesh>
        {[1, -1].map((s) => (
          <mesh key={s} position={[0, 0, s * 0.057]} rotation={[0, s > 0 ? 0 : Math.PI, 0]}>
            <circleGeometry args={[0.51, 40]} />
            <meshStandardMaterial map={tex} metalness={0.6} roughness={0.3} />
          </mesh>
        ))}
      </group>
    </group>
  );
}

/** Ikon tengah papan. Semua ikon berdiri di atas alas bundar dengan kolam air mancur kecil. */
export function CenterLandmark({ kind, symbol, accent }: { kind: LandmarkKind; symbol: string; accent: string }) {
  const body: Record<LandmarkKind, ReactNode> = {
    coin: <Coin symbol={symbol} accent={accent} />,
    monas: <Monas />,
    liberty: <Liberty />,
    basil: <Basil />,
    pagoda: <JapanSet />,
    bigben: <BigBen />,
    castle: <Castle />,
    eiffel: <Eiffel />,
    pyramid: <Pyramid />,
    skyscraper: <Skyscraper />,
  };
  return (
    <group>
      {kind !== 'coin' && (
        <mesh position={[0, 0.008, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[1.0, 1.1, 40]} />
          <meshStandardMaterial color="#7dd3fc" emissive="#38bdf8" emissiveIntensity={0.35} />
        </mesh>
      )}
      {/* ikon negara diperbesar supaya menonjol; Tugu Koin sudah pas */}
      <group scale={kind === 'coin' ? 1 : 1.35}>{body[kind] ?? body.coin}</group>
      <pointLight position={[0, 1.4, 0]} intensity={0.5} distance={3} color="#fde68a" />
    </group>
  );
}
