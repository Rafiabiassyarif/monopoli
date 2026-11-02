// Dekorasi 3D di sekitar meja sesuai gaya tema. Semua dari primitive (tanpa aset eksternal) → ringan & offline.

import { useMemo } from 'react';
import type { Theme } from '@monopoli/engine';

type Style = Theme['visual']['buildings'];

function rng(seed: number) {
  return () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };
}

const M = ({ c, m = 0.1, r = 0.7, e }: { c: string; m?: number; r?: number; e?: string }) => (
  <meshStandardMaterial color={c} metalness={m} roughness={r} emissive={e ?? '#000'} emissiveIntensity={e ? 0.6 : 0} />
);

function Palm({ h }: { h: number }) {
  return (
    <group>
      <mesh position={[0, h / 2, 0]} castShadow rotation={[0, 0, 0.08]}>
        <cylinderGeometry args={[0.06, 0.1, h, 6]} />
        <M c="#7a5230" />
      </mesh>
      {[0, 1, 2, 3, 4].map((k) => (
        <mesh key={k} position={[Math.cos(k * 1.26) * 0.35, h, Math.sin(k * 1.26) * 0.35]} rotation={[Math.sin(k * 1.26) * 0.9, 0, -Math.cos(k * 1.26) * 0.9]} castShadow>
          <coneGeometry args={[0.12, 0.8, 4]} />
          <M c="#2f9e44" />
        </mesh>
      ))}
    </group>
  );
}

function Tree({ h }: { h: number }) {
  return (
    <group>
      <mesh position={[0, h * 0.25, 0]} castShadow>
        <cylinderGeometry args={[0.07, 0.09, h * 0.5, 6]} />
        <M c="#6b4426" />
      </mesh>
      <mesh position={[0, h * 0.7, 0]} castShadow>
        <coneGeometry args={[0.4, h * 0.8, 7]} />
        <M c="#2e7d4f" />
      </mesh>
    </group>
  );
}

function Building({ style, r, accent }: { style: Style; r: () => number; accent: string }) {
  const h = 0.8 + r() * 2.6;
  const w = 0.6 + r() * 0.6;
  const pick = <T,>(a: T[]) => a[Math.floor(r() * a.length)];
  switch (style) {
    case 'modern': {
      const c = pick(['#8fa3bf', '#5d7896', '#c9d6e3', '#38506b']);
      return (
        <group>
          <mesh position={[0, h * 1.4, 0]} castShadow receiveShadow>
            <boxGeometry args={[w, h * 2.8, w]} />
            <meshStandardMaterial color={c} metalness={0.7} roughness={0.2} />
          </mesh>
          <mesh position={[0, h * 2.8 + 0.25, 0]}>
            <cylinderGeometry args={[0.02, 0.02, 0.5]} />
            <M c="#ddd" e="#ff4040" />
          </mesh>
        </group>
      );
    }
    case 'classic': {
      const c = pick(['#a0522d', '#c8a27a', '#8b3a2b', '#e0d6c3']);
      return (
        <group>
          <mesh position={[0, h / 2, 0]} castShadow receiveShadow>
            <boxGeometry args={[w, h, w * 1.2]} />
            <M c={c} />
          </mesh>
          <mesh position={[0, h + 0.3, 0]} rotation={[0, Math.PI / 4, 0]} castShadow>
            <coneGeometry args={[w * 0.85, 0.6, 4]} />
            <M c="#3b3b46" />
          </mesh>
        </group>
      );
    }
    case 'onion': {
      const dome = pick(['#e53935', '#43a047', '#1e88e5', '#fdd835', '#d4af37']);
      return (
        <group>
          <mesh position={[0, h / 2, 0]} castShadow>
            <cylinderGeometry args={[w * 0.45, w * 0.5, h, 10]} />
            <M c="#f2e8dc" />
          </mesh>
          <mesh position={[0, h + 0.3, 0]} scale={[1, 1.25, 1]} castShadow>
            <sphereGeometry args={[w * 0.55, 16, 12]} />
            <meshStandardMaterial color={dome} metalness={0.5} roughness={0.3} />
          </mesh>
          <mesh position={[0, h + 0.95, 0]}>
            <coneGeometry args={[w * 0.18, 0.5, 8]} />
            <meshStandardMaterial color="#d4af37" metalness={0.9} roughness={0.2} />
          </mesh>
        </group>
      );
    }
    case 'pagoda': {
      const levels = 2 + Math.floor(r() * 3);
      return (
        <group>
          {Array.from({ length: levels }, (_, k) => {
            const s = 1 - k * 0.18;
            return (
              <group key={k} position={[0, k * 0.6, 0]}>
                <mesh position={[0, 0.25, 0]} castShadow>
                  <boxGeometry args={[w * s, 0.5, w * s]} />
                  <M c="#f5efe6" />
                </mesh>
                <mesh position={[0, 0.58, 0]} rotation={[0, Math.PI / 4, 0]} castShadow>
                  <coneGeometry args={[w * s * 1.1, 0.25, 4]} />
                  <M c="#b3202a" />
                </mesh>
              </group>
            );
          })}
        </group>
      );
    }
    case 'ninja': {
      return (
        <group>
          <mesh position={[0, h * 0.3, 0]} castShadow receiveShadow>
            <cylinderGeometry args={[w * 0.6, w * 0.6, h * 0.6, 12]} />
            <M c="#e9dcc0" />
          </mesh>
          <mesh position={[0, h * 0.6 + 0.12, 0]} castShadow>
            <cylinderGeometry args={[w * 0.75, w * 0.75, 0.24, 12]} />
            <M c={pick(['#d9481e', '#c0392b', accent])} />
          </mesh>
          <mesh position={[0, h * 0.6 + 0.3, 0]}>
            <boxGeometry args={[0.12, 0.12, 0.12]} />
            <M c="#222" />
          </mesh>
        </group>
      );
    }
    case 'tropical':
    default: {
      return (
        <group>
          <mesh position={[0, 0.35, 0]} castShadow receiveShadow>
            <boxGeometry args={[w, 0.7, w]} />
            <M c={pick(['#e8d3a8', '#c79a62', '#f4e1c1'])} />
          </mesh>
          {/* atap joglo/gadang */}
          <mesh position={[0, 1.0, 0]} rotation={[0, Math.PI / 4, 0]} castShadow>
            <coneGeometry args={[w * 0.95, 0.75, 4]} />
            <M c={pick(['#6b3a1e', '#8a2e1a', '#4a2c17'])} />
          </mesh>
        </group>
      );
    }
  }
}

/** Monumen khas tiap gaya, ditaruh di belakang papan. */
function Landmark({ style, accent }: { style: Style; accent: string }) {
  switch (style) {
    case 'tropical': // Monas
      return (
        <group>
          <mesh position={[0, 0.3, 0]} castShadow>
            <boxGeometry args={[2.2, 0.6, 2.2]} />
            <M c="#f0ece2" />
          </mesh>
          <mesh position={[0, 3, 0]} castShadow>
            <cylinderGeometry args={[0.25, 0.5, 5, 4]} />
            <M c="#f7f3ea" />
          </mesh>
          <mesh position={[0, 5.8, 0]}>
            <sphereGeometry args={[0.45, 12, 10]} />
            <meshStandardMaterial color="#ffd54a" emissive="#ffb300" emissiveIntensity={0.8} metalness={0.9} roughness={0.2} />
          </mesh>
        </group>
      );
    case 'modern': // menara
      return (
        <mesh position={[0, 4.5, 0]} castShadow>
          <cylinderGeometry args={[0.2, 1.2, 9, 4]} />
          <meshStandardMaterial color="#9fb3c8" metalness={0.8} roughness={0.15} />
        </mesh>
      );
    case 'onion': // katedral
      return (
        <group>
          {[[-1.6, 0], [1.6, 0], [0, -1.6], [0, 1.6], [0, 0]].map(([x, z], k) => (
            <group key={k} position={[x, 0, z]} scale={k === 4 ? 2 : 1.3}>
              <Building style="onion" r={rng(k + 11)} accent={accent} />
            </group>
          ))}
        </group>
      );
    case 'ninja': // gunung + benteng bertingkat di puncak
      return (
        <group>
          <mesh position={[0, 2.5, 0]} castShadow>
            <coneGeometry args={[6, 5, 7]} />
            <M c="#9c7a52" r={0.95} />
          </mesh>
          {[0, 1, 2].map((k) => (
            <group key={k} position={[0, 4.6 + k * 0.7, 0]}>
              <mesh castShadow>
                <boxGeometry args={[1.6 - k * 0.4, 0.5, 1.6 - k * 0.4]} />
                <M c="#efe6d2" />
              </mesh>
              <mesh position={[0, 0.35, 0]} castShadow>
                <coneGeometry args={[1.4 - k * 0.35, 0.35, 4]} />
                <M c="#3f3f46" />
              </mesh>
            </group>
          ))}
        </group>
      );
    case 'pagoda': // fuji
      return (
        <group>
          <mesh position={[0, 3, 0]}>
            <coneGeometry args={[7, 6, 24]} />
            <M c="#5b6b8a" r={0.9} />
          </mesh>
          <mesh position={[0, 5.2, 0]}>
            <coneGeometry args={[2.1, 1.6, 24]} />
            <M c="#ffffff" r={0.6} />
          </mesh>
        </group>
      );
    case 'classic': // big ben
      return (
        <group>
          <mesh position={[0, 3, 0]} castShadow>
            <boxGeometry args={[1.2, 6, 1.2]} />
            <M c="#c8a86b" />
          </mesh>
          <mesh position={[0, 5, 0.61]}>
            <circleGeometry args={[0.45, 24]} />
            <meshStandardMaterial color="#fffbe8" emissive="#fff3c0" emissiveIntensity={0.7} />
          </mesh>
          <mesh position={[0, 6.8, 0]} rotation={[0, Math.PI / 4, 0]}>
            <coneGeometry args={[0.9, 1.6, 4]} />
            <M c="#2f3b33" />
          </mesh>
        </group>
      );
  }
}

export function Decor({ theme }: { theme: Theme }) {
  const style = theme.visual.buildings;
  const items = useMemo(() => {
    const r = rng(theme.id.length * 97 + 13);
    const out: { pos: [number, number, number]; rotY: number; kind: 'b' | 't'; seed: number }[] = [];
    for (let k = 0; k < 46; k++) {
      const a = (k / 46) * Math.PI * 2 + r() * 0.1;
      const rad = 10.5 + r() * 6;
      // sisakan celah di depan kamera
      if (Math.sin(a) > 0.82) continue;
      out.push({ pos: [Math.cos(a) * rad, 0, Math.sin(a) * rad], rotY: r() * Math.PI, kind: r() < 0.35 ? 't' : 'b', seed: Math.floor(r() * 1e6) + 1 });
    }
    return out;
  }, [theme.id]);

  return (
    <group position={[0, -0.6, 0]}>
      {/* tanah di bawah dekorasi */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
        <circleGeometry args={[60, 64]} />
        <meshStandardMaterial color={theme.visual.fog} roughness={1} />
      </mesh>
      {items.map((it, k) => (
        <group key={k} position={it.pos} rotation={[0, it.rotY, 0]}>
          {it.kind === 't' ? (
            style === 'tropical' ? <Palm h={1.6 + (it.seed % 10) / 10} /> : <Tree h={1.4 + (it.seed % 10) / 8} />
          ) : (
            <Building style={style} r={rng(it.seed)} accent={theme.visual.accent} />
          )}
        </group>
      ))}
      <group position={[0, 0, -16]}>
        <Landmark style={style} accent={theme.visual.accent} />
      </group>
    </group>
  );
}
