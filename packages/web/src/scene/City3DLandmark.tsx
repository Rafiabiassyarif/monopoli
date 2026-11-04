// Komponen 3D Landmark Vektor & Hologram Kota untuk Papan Monopoli 3D.
// Ditampilkan di atas petak yang dipilih (selected) atau disorot (hovered) dengan animasi halus.

import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as THREE from 'three';
import { BOARD, formatMoney, tileName, type GameState, type Theme } from '@monopoli/engine';
import { getCityInfo, type CityInfo } from '../cityLandmarks';
import { TOP } from './Fx';
import { tilePos, tileRotY } from './layout';
import { tj, tName, tr } from '../i18n';

interface Landmark3DProps {
  info: CityInfo;
  color: string;
}

export function ProceduralLandmark3D({ info, color }: Landmark3DProps) {
  const groupRef = useRef<THREE.Group>(null!);

  useFrame((_, dt) => {
    if (groupRef.current) {
      // Rotasi pelan & melayang naik-turun halus
      groupRef.current.rotation.y += dt * 0.75;
      groupRef.current.position.y = 0.55 + Math.sin(performance.now() / 380) * 0.06;
    }
  });

  const goldMat = <meshStandardMaterial color="#fbbf24" metalness={0.9} roughness={0.2} emissive="#f59e0b" emissiveIntensity={0.6} />;
  const stoneMat = <meshStandardMaterial color="#475569" metalness={0.1} roughness={0.8} />;
  const whiteMat = <meshStandardMaterial color="#f8fafc" metalness={0.2} roughness={0.3} />;
  const glassMat = <meshPhysicalMaterial color="#38bdf8" metalness={0.2} roughness={0.1} transmission={0.7} thickness={0.4} />;
  const redMat = <meshStandardMaterial color="#dc2626" metalness={0.4} roughness={0.4} />;

  switch (info.visualType) {
    case 'monas':
      return (
        <group ref={groupRef} scale={[0.85, 0.85, 0.85]}>
          {/* Cawan bawah Monas */}
          <mesh position={[0, 0.08, 0]} castShadow>
            <boxGeometry args={[0.5, 0.12, 0.5]} />
            {stoneMat}
          </mesh>
          <mesh position={[0, 0.16, 0]} castShadow>
            <cylinderGeometry args={[0.3, 0.22, 0.08, 4]} />
            {stoneMat}
          </mesh>
          {/* Tugu obelisk utama */}
          <mesh position={[0, 0.55, 0]} castShadow>
            <cylinderGeometry args={[0.07, 0.12, 0.75, 4]} />
            {whiteMat}
          </mesh>
          {/* Pelat cawan atas */}
          <mesh position={[0, 0.94, 0]} castShadow>
            <boxGeometry args={[0.18, 0.04, 0.18]} />
            {stoneMat}
          </mesh>
          {/* Api Kemerdekaan Emas bercahaya */}
          <mesh position={[0, 1.05, 0]} castShadow>
            <octahedronGeometry args={[0.09, 0]} />
            {goldMat}
          </mesh>
          <pointLight position={[0, 1.05, 0]} color="#f59e0b" intensity={2} distance={2.5} />
        </group>
      );

    case 'temple':
      return (
        <group ref={groupRef} scale={[0.85, 0.85, 0.85]}>
          {/* Tangga dasar */}
          <mesh position={[0, 0.05, 0]} castShadow>
            <boxGeometry args={[0.6, 0.08, 0.35]} />
            {stoneMat}
          </mesh>
          {/* Candi Bentar (Gerbang belah Bali kiri & kanan) */}
          {[-0.14, 0.14].map((x, idx) => (
            <group key={idx} position={[x, 0, 0]}>
              <mesh position={[0, 0.22, 0]} castShadow>
                <boxGeometry args={[0.16, 0.28, 0.22]} />
                <meshStandardMaterial color="#b45309" roughness={0.7} />
              </mesh>
              <mesh position={[0, 0.44, 0]} castShadow>
                <boxGeometry args={[0.12, 0.2, 0.18]} />
                <meshStandardMaterial color="#92400e" roughness={0.7} />
              </mesh>
              <mesh position={[0, 0.62, 0]} castShadow>
                <coneGeometry args={[0.08, 0.2, 4]} />
                {goldMat}
              </mesh>
            </group>
          ))}
          <pointLight position={[0, 0.5, 0]} color="#fbbf24" intensity={1.5} distance={2} />
        </group>
      );

    case 'gadang':
      return (
        <group ref={groupRef} scale={[0.85, 0.85, 0.85]}>
          {/* Tiang panggung */}
          <mesh position={[0, 0.08, 0]} castShadow>
            <boxGeometry args={[0.5, 0.12, 0.28]} />
            <meshStandardMaterial color="#451a03" roughness={0.8} />
          </mesh>
          {/* Rumah utama kayu */}
          <mesh position={[0, 0.26, 0]} castShadow>
            <boxGeometry args={[0.55, 0.24, 0.3]} />
            <meshStandardMaterial color="#78350f" roughness={0.6} />
          </mesh>
          {/* Atap Gonjong melengkung */}
          <mesh position={[0, 0.45, 0]} rotation={[0, 0, 0]} castShadow>
            <cylinderGeometry args={[0.08, 0.38, 0.24, 4, 1, false, 0, Math.PI]} />
            <meshStandardMaterial color="#b45309" roughness={0.5} />
          </mesh>
          {/* Tanduk Gonjong khas Minangkabau */}
          {[-0.32, 0.32].map((x, idx) => (
            <mesh key={idx} position={[x, 0.56, 0]} rotation={[0, 0, (idx === 0 ? 1 : -1) * 0.4]} castShadow>
              <coneGeometry args={[0.06, 0.26, 4]} />
              {goldMat}
            </mesh>
          ))}
        </group>
      );

    case 'sate':
      return (
        <group ref={groupRef} scale={[0.85, 0.85, 0.85]}>
          {/* Gedung Art Deco sayap kiri-kanan */}
          <mesh position={[0, 0.16, 0]} castShadow>
            <boxGeometry args={[0.65, 0.28, 0.32]} />
            {whiteMat}
          </mesh>
          {/* Menara tengah */}
          <mesh position={[0, 0.42, 0]} castShadow>
            <boxGeometry args={[0.22, 0.28, 0.22]} />
            {stoneMat}
          </mesh>
          {/* Atap menara limas */}
          <mesh position={[0, 0.62, 0]} rotation={[0, Math.PI / 4, 0]} castShadow>
            <coneGeometry args={[0.18, 0.16, 4]} />
            <meshStandardMaterial color="#334155" roughness={0.5} />
          </mesh>
          {/* Tiang ornamen tusuk sate legendaris */}
          <mesh position={[0, 0.82, 0]}>
            <cylinderGeometry args={[0.015, 0.015, 0.28]} />
            <meshStandardMaterial color="#0f172a" metalness={0.8} />
          </mesh>
          {[0, 1, 2, 3, 4, 5].map((k) => (
            <mesh key={k} position={[0, 0.72 + k * 0.038, 0]}>
              <sphereGeometry args={[0.026, 8, 8]} />
              {goldMat}
            </mesh>
          ))}
        </group>
      );

    case 'tugu':
      return (
        <group ref={groupRef} scale={[0.85, 0.85, 0.85]}>
          <mesh position={[0, 0.08, 0]} castShadow>
            <boxGeometry args={[0.42, 0.14, 0.42]} />
            {whiteMat}
          </mesh>
          <mesh position={[0, 0.42, 0]} castShadow>
            <cylinderGeometry args={[0.08, 0.14, 0.58, 8]} />
            {whiteMat}
          </mesh>
          <mesh position={[0, 0.78, 0]} castShadow>
            <coneGeometry args={[0.1, 0.22, 8]} />
            {goldMat}
          </mesh>
          <pointLight position={[0, 0.8, 0]} color="#fbbf24" intensity={1.5} distance={2} />
        </group>
      );

    case 'bridge':
      return (
        <group ref={groupRef} scale={[0.85, 0.85, 0.85]}>
          {/* Air biru */}
          <mesh position={[0, 0.04, 0]} receiveShadow>
            <cylinderGeometry args={[0.34, 0.34, 0.06, 24]} />
            <meshStandardMaterial color="#0284c7" roughness={0.2} metalness={0.5} />
          </mesh>
          {/* Gelagar jembatan */}
          <mesh position={[0, 0.22, 0]} castShadow>
            <boxGeometry args={[0.65, 0.06, 0.16]} />
            <meshStandardMaterial color="#1e293b" roughness={0.5} />
          </mesh>
          {/* Menara pilon merah ganda */}
          {[-0.18, 0.18].map((x, idx) => (
            <mesh key={idx} position={[x, 0.48, 0]} castShadow>
              <boxGeometry args={[0.08, 0.55, 0.1]} />
              {redMat}
            </mesh>
          ))}
          {/* Balok atas penghubung pilon */}
          <mesh position={[0, 0.7, 0]} castShadow>
            <boxGeometry args={[0.44, 0.06, 0.08]} />
            {redMat}
          </mesh>
        </group>
      );

    case 'skyscraper':
      return (
        <group ref={groupRef} scale={[0.85, 0.85, 0.85]}>
          <mesh position={[-0.14, 0.35, -0.06]} castShadow>
            <boxGeometry args={[0.22, 0.65, 0.2]} />
            <meshStandardMaterial color="#64748b" metalness={0.4} roughness={0.3} />
          </mesh>
          <mesh position={[0.1, 0.5, 0]} castShadow>
            <boxGeometry args={[0.26, 0.95, 0.24]} />
            {glassMat}
          </mesh>
          <mesh position={[0.1, 1.05, 0]}>
            <cylinderGeometry args={[0.015, 0.015, 0.25]} />
            <meshStandardMaterial color="#ef4444" emissive="#ef4444" emissiveIntensity={0.8} />
          </mesh>
          <pointLight position={[0.1, 1.1, 0]} color="#ef4444" intensity={1} distance={2} />
        </group>
      );

    case 'station':
      return (
        <group ref={groupRef} scale={[0.85, 0.85, 0.85]}>
          {/* Landasan rel */}
          <mesh position={[0, 0.04, 0]}>
            <boxGeometry args={[0.6, 0.06, 0.24]} />
            {stoneMat}
          </mesh>
          {/* Kereta Cepat aerodinamis */}
          <mesh position={[0, 0.18, 0]} castShadow>
            <boxGeometry args={[0.5, 0.18, 0.18]} />
            <meshStandardMaterial color="#0284c7" metalness={0.5} roughness={0.2} />
          </mesh>
          <mesh position={[0.27, 0.14, 0]} rotation={[0, 0, -Math.PI / 4]} castShadow>
            <boxGeometry args={[0.14, 0.14, 0.16]} />
            <meshStandardMaterial color="#0369a1" />
          </mesh>
          {/* Kubah atap kaca stasiun */}
          <mesh position={[0, 0.42, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
            <cylinderGeometry args={[0.3, 0.3, 0.55, 16, 1, true, 0, Math.PI]} />
            {glassMat}
          </mesh>
        </group>
      );

    case 'ship':
      return (
        <group ref={groupRef} scale={[0.85, 0.85, 0.85]}>
          {/* Air laut */}
          <mesh position={[0, 0.04, 0]} receiveShadow>
            <cylinderGeometry args={[0.35, 0.35, 0.06, 24]} />
            <meshStandardMaterial color="#0369a1" roughness={0.1} metalness={0.5} />
          </mesh>
          {/* Lambung Pinisi kayu */}
          <mesh position={[0, 0.18, 0]} scale={[1.4, 0.7, 0.5]} castShadow>
            <sphereGeometry args={[0.26, 16, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2]} />
            <meshStandardMaterial color="#78350f" roughness={0.7} />
          </mesh>
          {/* Tiang & Layar Pinisi */}
          {[-0.1, 0.12].map((x, idx) => (
            <group key={idx} position={[x, 0.2, 0]}>
              <mesh position={[0, 0.25, 0]}>
                <cylinderGeometry args={[0.015, 0.015, 0.45]} />
                <meshStandardMaterial color="#451a03" />
              </mesh>
              <mesh position={[0.08, 0.28, 0]} rotation={[0, 0, -0.15]} castShadow>
                <coneGeometry args={[0.12, 0.35, 3]} />
                <meshStandardMaterial color="#fef08a" roughness={0.6} />
              </mesh>
            </group>
          ))}
        </group>
      );

    default:
      // Monumen Pilar Klasik
      return (
        <group ref={groupRef} scale={[0.85, 0.85, 0.85]}>
          <mesh position={[0, 0.08, 0]} castShadow>
            <boxGeometry args={[0.48, 0.12, 0.48]} />
            {stoneMat}
          </mesh>
          {[-0.14, 0.14].map((x) =>
            [-0.14, 0.14].map((z, k) => (
              <mesh key={`${x}-${k}`} position={[x, 0.35, z]} castShadow>
                <cylinderGeometry args={[0.04, 0.05, 0.45, 12]} />
                {whiteMat}
              </mesh>
            )),
          )}
          <mesh position={[0, 0.62, 0]} rotation={[0, Math.PI / 4, 0]} castShadow>
            <coneGeometry args={[0.3, 0.2, 4]} />
            {stoneMat}
          </mesh>
          <mesh position={[0, 0.74, 0]}>
            <sphereGeometry args={[0.06, 12, 12]} />
            {goldMat}
          </mesh>
        </group>
      );
  }
}

interface CityBeaconProps {
  tile: number;
  theme: Theme;
  state: GameState | null;
  onTileClick?: (i: number) => void;
}

/** Menara sinar vertikal hologram, ring berputar, miniatur 3D landmark, dan billboard kota melayang. */
export function CityBeacon({ tile, theme, state, onTileClick }: CityBeaconProps) {
  const [x, z] = tilePos(tile);
  const t = BOARD[tile];
  const name = tileName(theme, tile);
  const cityInfo = getCityInfo(name, theme);
  const color = t.kind === 'property' ? theme.groupColors[t.group!] : theme.visual.accent;

  const ring1 = useRef<THREE.Mesh>(null!);
  const ring2 = useRef<THREE.Mesh>(null!);
  const beam = useRef<THREE.Mesh>(null!);

  useFrame((_, dt) => {
    if (ring1.current) ring1.current.rotation.z += dt * 1.5;
    if (ring2.current) ring2.current.rotation.z -= dt * 1.1;
    if (beam.current) {
      const mat = beam.current.material as THREE.MeshBasicMaterial;
      mat.opacity = 0.22 + Math.sin(performance.now() / 250) * 0.08;
    }
  });

  const st = state ? state.tiles[tile] : null;
  const owner = st?.owner && state ? state.players.find((p) => p.id === st.owner) : null;

  return (
    <group position={[x, TOP, z]}>
      {/* Kolom sinar vertikal tembus pandang (Light Beacon) */}
      <mesh ref={beam} position={[0, 1.4, 0]}>
        <cylinderGeometry args={[0.38, 0.48, 2.7, 32, 1, true]} />
        <meshBasicMaterial color={color} transparent opacity={0.25} side={THREE.DoubleSide} depthWrite={false} toneMapped={false} />
      </mesh>

      {/* Ring hologram berputar di atas permukaan papan */}
      <mesh ref={ring1} position={[0, 0.015, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.42, 0.48, 36]} />
        <meshBasicMaterial color={color} transparent opacity={0.75} toneMapped={false} />
      </mesh>
      <mesh ref={ring2} position={[0, 0.025, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.54, 0.58, 36]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={0.5} toneMapped={false} />
      </mesh>

      {/* Miniatur 3D Landmark Vektor melayang dan berputar */}
      <group position={[0, 0.2, 0]}>
        <ProceduralLandmark3D info={cityInfo} color={color} />
      </group>

      {/* Billboard Hologram Mengambang 3D */}
      <Html position={[0, 1.9, 0]} center zIndexRange={[30, 0]} style={{ pointerEvents: 'auto' }}>
        <div
          className="city-3d-billboard"
          onClick={(e) => {
            e.stopPropagation();
            onTileClick?.(tile);
          }}
          style={{ ['--city-color' as string]: color }}
        >
          <div className="city-3d-badge">
            <span className="city-3d-icon">{cityInfo.icon}</span>
            <div className="city-3d-text">
              <span className="city-3d-title">{tName(name)}</span>
              <span className="city-3d-landmark">{tr(cityInfo.landmark)}</span>
            </div>
          </div>
          {owner ? (
            <div className="city-3d-status owned">
              {tj('Milik {name}', { name: <b style={{ color: owner.color }}>{owner.name}</b> })}
            </div>
          ) : t.price ? (
            <div className="city-3d-status for-sale">
              {tj('Harga {price}', { price: <b>{formatMoney(theme, t.price)}</b> })}
            </div>
          ) : null}
        </div>
      </Html>
    </group>
  );
}
