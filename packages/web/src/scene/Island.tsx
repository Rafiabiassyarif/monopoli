// Pulau kota di tengah papan: pulau persegi-membulat dikelilingi kanal air, plaza dengan ikon khas tema di tengah
// (Monas, Liberty, St. Basil, pagoda, Big Ben, kastil ninja… atau Tugu Koin untuk tema kustom), jalan melingkar
// dengan mobil kecil, perahu di kanal, rumah beratap warna kompleks, pohon & lampu taman.

import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { Theme } from '@monopoli/engine';
import { FONT } from './layout';
import { CenterLandmark } from './Landmarks';

/** tinggi permukaan (dunia). Petak papan ada di TOP (lebih tinggi) supaya terlihat timbul. */
export const BASE_Y = 0.15;
export const WATER_Y = 0.21;
export const ISLAND_Y = 0.29;
/** tinggi atas alas kartu Kesempatan / Dana Umum */
export const DECK_Y = ISLAND_Y + 0.12;
/** ukuran pulau (setengah sisi) */
export const ISLAND_HALF = 3.65;

type Style = Theme['visual']['buildings'];
const PALETTE: Record<Style, { grass: string; grass2: string; water: string; sand: string; pave: string }> = {
  tropical: { grass: '#5fbf5a', grass2: '#4aa64b', water: '#38bdf8', sand: '#f2dca5', pave: '#efe3c7' },
  modern: { grass: '#7cc46a', grass2: '#62ab55', water: '#3aa8e8', sand: '#e7d6ae', pave: '#e5e7eb' },
  classic: { grass: '#6faf63', grass2: '#5a9852', water: '#4f9bd1', sand: '#ddcfa8', pave: '#d9d4c7' },
  onion: { grass: '#eef3f8', grass2: '#dbe5ef', water: '#8cc4e8', sand: '#cfd8e3', pave: '#f8fafc' },
  pagoda: { grass: '#8fcf7a', grass2: '#76b964', water: '#5eb4e6', sand: '#ead9b0', pave: '#efe6d2' },
  ninja: { grass: '#98c96a', grass2: '#7fb254', water: '#4fb0c6', sand: '#e3cd98', pave: '#e8dcbf' },
};

/** bentuk persegi dengan sudut membulat */
function roundedSquare(half: number, r: number) {
  const s = new THREE.Shape();
  s.moveTo(-half + r, -half);
  s.lineTo(half - r, -half);
  s.quadraticCurveTo(half, -half, half, -half + r);
  s.lineTo(half, half - r);
  s.quadraticCurveTo(half, half, half - r, half);
  s.lineTo(-half + r, half);
  s.quadraticCurveTo(-half, half, -half, half - r);
  s.lineTo(-half, -half + r);
  s.quadraticCurveTo(-half, -half, -half + r, -half);
  return s;
}

function slab(half: number, r: number, depth: number, bevel = 0.04) {
  const g = new THREE.ExtrudeGeometry(roundedSquare(half, r), { depth, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 2, curveSegments: 10 });
  g.rotateX(-Math.PI / 2); // bentuk XY → lantai XZ, ketebalan ke atas
  return g;
}

/** jendela gedung (satu tekstur dipakai bersama) */
let windowTex: THREE.CanvasTexture | null = null;
function windows() {
  if (windowTex) return windowTex;
  const c = document.createElement('canvas');
  c.width = 64;
  c.height = 128;
  const g = c.getContext('2d')!;
  g.fillStyle = '#ffffff';
  g.fillRect(0, 0, 64, 128);
  for (let y = 10; y < 120; y += 22)
    for (let x = 8; x < 60; x += 18) {
      g.fillStyle = (x + y) % 3 ? '#93c5fd' : '#fde68a';
      g.fillRect(x, y, 11, 13);
    }
  windowTex = new THREE.CanvasTexture(c);
  windowTex.colorSpace = THREE.SRGBColorSpace;
  return windowTex;
}

const rand = (seed: number) => () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;

function House({ color, h, w, roof }: { color: string; h: number; w: number; roof: 'gable' | 'flat' | 'pyramid' }) {
  return (
    <group>
      <mesh position={[0, h / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[w, h, w * 0.8]} />
        <meshStandardMaterial map={windows()} color={color} roughness={0.7} />
      </mesh>
      {roof === 'flat' ? (
        <mesh position={[0, h + 0.03, 0]} castShadow>
          <boxGeometry args={[w * 1.05, 0.06, w * 0.85]} />
          <meshStandardMaterial color="#94a3b8" roughness={0.6} />
        </mesh>
      ) : roof === 'pyramid' ? (
        <mesh position={[0, h + w * 0.25, 0]} rotation={[0, Math.PI / 4, 0]} castShadow>
          <coneGeometry args={[w * 0.75, w * 0.5, 4]} />
          <meshStandardMaterial color={color} roughness={0.55} />
        </mesh>
      ) : (
        <mesh position={[0, h + w * 0.2, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
          <cylinderGeometry args={[w * 0.32, w * 0.32, w * 1.06, 3]} />
          <meshStandardMaterial color={color} roughness={0.55} />
        </mesh>
      )}
    </group>
  );
}

function Tree({ s, color }: { s: number; color: string }) {
  return (
    <group scale={s}>
      <mesh position={[0, 0.1, 0]} castShadow>
        <cylinderGeometry args={[0.035, 0.05, 0.2, 6]} />
        <meshStandardMaterial color="#7c4a26" />
      </mesh>
      <mesh position={[0, 0.32, 0]} castShadow>
        <coneGeometry args={[0.17, 0.34, 7]} />
        <meshStandardMaterial color={color} roughness={0.8} flatShading />
      </mesh>
      <mesh position={[0, 0.48, 0]} castShadow>
        <coneGeometry args={[0.12, 0.24, 7]} />
        <meshStandardMaterial color={color} roughness={0.8} flatShading />
      </mesh>
    </group>
  );
}

function Lamp() {
  return (
    <group>
      <mesh position={[0, 0.16, 0]}>
        <cylinderGeometry args={[0.012, 0.016, 0.32, 6]} />
        <meshStandardMaterial color="#334155" />
      </mesh>
      <mesh position={[0, 0.33, 0]}>
        <sphereGeometry args={[0.035, 10, 8]} />
        <meshStandardMaterial color="#fff7cc" emissive="#fde68a" emissiveIntensity={1.6} />
      </mesh>
    </group>
  );
}

/** mobil kecil yang berkeliling jalan melingkar */
function Cars({ colors, radius }: { colors: string[]; radius: number }) {
  const refs = useRef<(THREE.Group | null)[]>([]);
  useFrame(({ clock }) => {
    refs.current.forEach((g, k) => {
      if (!g) return;
      const a = clock.elapsedTime * 0.35 + (k * Math.PI * 2) / colors.length;
      g.position.set(Math.cos(a) * radius, ISLAND_Y + 0.05, Math.sin(a) * radius);
      g.rotation.y = -a;
    });
  });
  return (
    <>
      {colors.map((c, k) => (
        <group key={k} ref={(el) => (refs.current[k] = el)}>
          <mesh position={[0, 0.045, 0]} castShadow>
            <boxGeometry args={[0.12, 0.07, 0.24]} />
            <meshStandardMaterial color={c} roughness={0.35} metalness={0.2} />
          </mesh>
          <mesh position={[0, 0.1, -0.01]}>
            <boxGeometry args={[0.1, 0.05, 0.12]} />
            <meshStandardMaterial color="#bfdbfe" roughness={0.1} metalness={0.4} />
          </mesh>
        </group>
      ))}
    </>
  );
}

/** perahu kecil yang berlayar mengelilingi pulau di kanal */
function Boats({ colors }: { colors: string[] }) {
  const refs = useRef<(THREE.Group | null)[]>([]);
  const R = ISLAND_HALF + 0.55; // tengah kanal
  useFrame(({ clock }) => {
    refs.current.forEach((g, k) => {
      if (!g) return;
      // jalur persegi-membulat: keliling dipetakan dari parameter u
      const u = (clock.elapsedTime * 0.025 + k / colors.length) % 1;
      const side = Math.floor(u * 4);
      const f = (u * 4) % 1;
      const along = -R + f * 2 * R;
      const pts: [number, number][] = [
        [along, R],
        [R, -along],
        [-along, -R],
        [-R, along],
      ];
      const [x, z] = pts[side];
      g.position.set(x, WATER_Y + 0.02 + Math.sin(clock.elapsedTime * 2 + k) * 0.01, z);
      g.rotation.y = -side * (Math.PI / 2) + Math.PI / 2;
      g.rotation.z = Math.sin(clock.elapsedTime * 1.7 + k) * 0.05;
    });
  });
  return (
    <>
      {colors.map((c, k) => (
        <group key={k} ref={(el) => (refs.current[k] = el)}>
          <mesh position={[0, 0.03, 0]} castShadow>
            <boxGeometry args={[0.32, 0.07, 0.13]} />
            <meshStandardMaterial color={c} roughness={0.5} />
          </mesh>
          <mesh position={[0, 0.17, 0]}>
            <cylinderGeometry args={[0.008, 0.008, 0.26, 4]} />
            <meshStandardMaterial color="#78350f" />
          </mesh>
          <mesh position={[0.05, 0.18, 0]} rotation={[0, Math.PI / 2, 0]} castShadow>
            <coneGeometry args={[0.08, 0.2, 3]} />
            <meshStandardMaterial color="#fefce8" roughness={0.7} />
          </mesh>
        </group>
      ))}
    </>
  );
}

/** air kanal bergelombang pelan (titik digeser tiap frame, murah) */
function Water({ color }: { color: string }) {
  const geo = useMemo(() => {
    const g = new THREE.PlaneGeometry(8.96, 8.96, 28, 28);
    g.rotateX(-Math.PI / 2);
    return g;
  }, []);
  const base = useMemo(() => Float32Array.from(geo.attributes.position.array), [geo]);
  useFrame(({ clock }) => {
    const p = geo.attributes.position as THREE.BufferAttribute;
    const t = clock.elapsedTime;
    for (let i = 0; i < p.count; i++) {
      const x = base[i * 3];
      const z = base[i * 3 + 2];
      p.setY(i, Math.sin(x * 2.2 + t * 1.3) * 0.012 + Math.cos(z * 2.6 + t) * 0.012);
    }
    p.needsUpdate = true;
  });
  return (
    <mesh geometry={geo} position={[0, WATER_Y, 0]} receiveShadow>
      <meshStandardMaterial color={color} roughness={0.15} metalness={0.1} transparent opacity={0.92} />
    </mesh>
  );
}

/** label tempel di sisi depan alas kartu */
function labelTexture(text: string, bg: string) {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 64;
  const g = c.getContext('2d')!;
  g.fillStyle = bg;
  g.fillRect(0, 0, 512, 64);
  g.fillStyle = '#ffffff';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.font = `800 36px ${FONT}`;
  g.fillText(text.toUpperCase(), 256, 34);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** alas kartu Kesempatan / Dana Umum (kartu 3D diletakkan di atasnya oleh CardDecks) */
export function DeckPedestal({ x, z, color, label }: { x: number; z: number; color: string; label: string }) {
  const tex = useMemo(() => labelTexture(label, color), [label, color]);
  return (
    <group position={[x, ISLAND_Y, z]}>
      <mesh position={[0, 0.06, 0]} castShadow receiveShadow>
        <boxGeometry args={[2.15, 0.12, 1.45]} />
        <meshStandardMaterial color={color} roughness={0.5} />
      </mesh>
      <mesh position={[0, 0.06, 0.726]}>
        <planeGeometry args={[2.15, 0.12]} />
        <meshStandardMaterial map={tex} roughness={0.5} />
      </mesh>
    </group>
  );
}

export function Island({ theme, deckLabels }: { theme: Theme; deckLabels: { chance: string; community: string } }) {
  const style = theme.visual.buildings;
  const pal = PALETTE[style] ?? PALETTE.modern;
  const geos = useMemo(
    () => ({
      sand: slab(ISLAND_HALF + 0.22, 1.5, ISLAND_Y - 0.1 - BASE_Y, 0.05),
      grass: slab(ISLAND_HALF, 1.35, 0.06, 0.03),
    }),
    [],
  );
  // rumah & pohon: posisi tetap per tema (acak berbenih), menghindari plaza, jalan & alas kartu
  const props = useMemo(() => {
    const r = rand(theme.id.length * 131 + 7);
    const houses: { x: number; z: number; rot: number; color: string; h: number; w: number; roof: 'gable' | 'flat' | 'pyramid' }[] = [];
    const trees: { x: number; z: number; s: number }[] = [];
    const roofs = style === 'modern' ? (['flat', 'flat', 'pyramid'] as const) : style === 'pagoda' || style === 'ninja' ? (['pyramid', 'gable'] as const) : (['gable', 'pyramid', 'flat'] as const);
    const free = (x: number, z: number, pad: number) => {
      const d = Math.hypot(x, z);
      if (d < 2.25 + pad) return false; // plaza + jalan melingkar
      if (z > 1.55 - pad && Math.abs(x) > 0.75 - pad && Math.abs(x) < 3.05 + pad && z < 3.3 + pad) return false; // alas kartu
      if (Math.abs(x) > ISLAND_HALF - 0.35 || Math.abs(z) > ISLAND_HALF - 0.35) return false;
      return ![...houses, ...trees].some((o) => Math.hypot(o.x - x, o.z - z) < 0.42 + pad);
    };
    for (let k = 0; k < 400 && houses.length < 12; k++) {
      const x = (r() * 2 - 1) * 3.2;
      const z = (r() * 2 - 1) * 3.2;
      if (!free(x, z, 0.12)) continue;
      houses.push({ x, z, rot: Math.round(r() * 4) * (Math.PI / 2), color: theme.groupColors[Math.floor(r() * 8)], h: 0.38 + r() * 0.6, w: 0.36 + r() * 0.14, roof: roofs[Math.floor(r() * roofs.length)] });
    }
    for (let k = 0; k < 600 && trees.length < 22; k++) {
      const x = (r() * 2 - 1) * 3.35;
      const z = (r() * 2 - 1) * 3.35;
      if (!free(x, z, 0)) continue;
      trees.push({ x, z, s: 0.75 + r() * 0.5 });
    }
    return { houses, trees };
  }, [theme.id, theme.groupColors, style]);
  const lamps = useMemo(() => Array.from({ length: 8 }, (_, k) => [Math.cos((k / 8) * Math.PI * 2 + 0.39) * 1.25, Math.sin((k / 8) * Math.PI * 2 + 0.39) * 1.25] as const), []);
  const road = 1.78;
  const sym = (theme.currency.symbol || '$').slice(0, 3);
  const treeColor = style === 'onion' ? '#2f6f4f' : style === 'tropical' ? '#2f9e44' : '#3f9b46';

  return (
    <group>
      <Water color={pal.water} />
      <Boats colors={[theme.groupColors[2], theme.groupColors[6]]} />
      <mesh geometry={geos.sand} position={[0, BASE_Y + 0.01, 0]} receiveShadow castShadow>
        <meshStandardMaterial color={pal.sand} roughness={0.95} />
      </mesh>
      <mesh geometry={geos.grass} position={[0, ISLAND_Y - 0.09, 0]} receiveShadow>
        <meshStandardMaterial color={pal.grass} roughness={0.95} />
      </mesh>
      {/* jalan melingkar + garis putus-putus */}
      <mesh position={[0, ISLAND_Y + 0.004, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <ringGeometry args={[road - 0.2, road + 0.2, 64]} />
        <meshStandardMaterial color="#475569" roughness={0.9} />
      </mesh>
      {Array.from({ length: 24 }, (_, k) => {
        const a = (k / 24) * Math.PI * 2;
        return (
          <mesh key={k} position={[Math.cos(a) * road, ISLAND_Y + 0.008, Math.sin(a) * road]} rotation={[-Math.PI / 2, 0, -a]}>
            <planeGeometry args={[0.03, 0.18]} />
            <meshBasicMaterial color="#f8fafc" />
          </mesh>
        );
      })}
      {/* plaza */}
      <mesh position={[0, ISLAND_Y + 0.006, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <circleGeometry args={[1.42, 48]} />
        <meshStandardMaterial color={pal.pave} roughness={0.85} />
      </mesh>
      {/* empat jalan setapak dari plaza ke tepi pulau */}
      {[0, 1, 2, 3].map((k) => (
        <mesh key={k} position={[0, ISLAND_Y + 0.003, 0]} rotation={[-Math.PI / 2, 0, (k * Math.PI) / 2 + Math.PI / 4]}>
          <planeGeometry args={[0.28, 6.6]} />
          <meshStandardMaterial color={pal.grass2} roughness={1} />
        </mesh>
      ))}
      <group position={[0, ISLAND_Y, 0]}>
        <CenterLandmark kind={theme.visual.landmark ?? 'coin'} symbol={sym} accent={theme.visual.accent} />
      </group>
      {lamps.map(([x, z], k) => (
        <group key={k} position={[x, ISLAND_Y, z]}>
          <Lamp />
        </group>
      ))}
      <Cars colors={[theme.groupColors[4], theme.groupColors[7], theme.groupColors[5]]} radius={road} />
      {props.houses.map((h, k) => (
        <group key={k} position={[h.x, ISLAND_Y, h.z]} rotation={[0, h.rot, 0]}>
          <House color={h.color} h={h.h} w={h.w} roof={h.roof} />
        </group>
      ))}
      {props.trees.map((tr, k) => (
        <group key={k} position={[tr.x, ISLAND_Y, tr.z]}>
          <Tree s={tr.s} color={treeColor} />
        </group>
      ))}
      <DeckPedestal x={-1.9} z={2.45} color="#ea580c" label={deckLabels.chance} />
      <DeckPedestal x={1.9} z={2.45} color="#2563eb" label={deckLabels.community} />
    </group>
  );
}
