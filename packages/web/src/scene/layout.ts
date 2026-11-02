// Tata letak papan (koordinat dunia) + gambar permukaan papan ke CanvasTexture.
// Papan 12x12 unit, sudut 1.5, petak biasa 1 unit. Petak 0 (START) di pojok kanan-bawah (x+, z+).

import * as THREE from 'three';
import { BOARD, formatMoney, tileName, type Theme } from '@monopoli/engine';
import { getCityInfo, drawLandmarkToCanvas } from '../cityLandmarks';
import { t as tt, tr } from '../i18n';

export const HALF = 6;
const CORNER = 1.5;

const rot = (x: number, z: number, side: number): [number, number] => {
  for (let i = 0; i < side; i++) [x, z] = [-z, x];
  return [x, z];
};

/** Posisi dunia petak i. inward>0 = ke arah dalam papan, along = geser sepanjang sisi. */
export function tilePos(i: number, inward = 0, along = 0): [number, number] {
  const side = Math.floor(i / 10);
  const k = i % 10;
  if (k === 0) {
    const c = HALF - CORNER / 2 - inward * 0.7;
    return rot(c - along, c, side);
  }
  return rot(5 - k - along, HALF - CORNER / 2 - inward, side);
}

export const tileRotY = (i: number) => (-Math.floor(i / 10) * Math.PI) / 2;

export function pointToTile(x: number, z: number): number {
  if (Math.abs(x) > HALF || Math.abs(z) > HALF) return -1;
  for (let side = 0; side < 4; side++) {
    let [lx, lz] = [x, z];
    for (let j = 0; j < side; j++) [lx, lz] = [lz, -lx];
    if (lz >= HALF - CORNER && lx > -(HALF - CORNER)) {
      if (lx >= HALF - CORNER) return side * 10;
      return side * 10 + Math.min(9, Math.max(1, Math.round(5 - lx)));
    }
  }
  return -1;
}

// ---------- tekstur ----------
function wrap(g: CanvasRenderingContext2D, text: string, maxW: number): string[] {
  const words = text.split(' ');
  const lines: string[] = [];
  let line = '';
  for (const w of words) {
    const t = line ? line + ' ' + w : w;
    if (g.measureText(t).width > maxW && line) {
      lines.push(line);
      line = w;
    } else line = t;
  }
  if (line) lines.push(line);
  return lines.slice(0, 3);
}

const ICON: Record<string, string> = { station: '🚆', tax: '💰', chance: '❓', community: '🎁' };
const UTIL_ICON = ['💡', '🚰'];
export const FONT = '"Plus Jakarta Sans Variable", "Plus Jakarta Sans", system-ui, sans-serif';
/** Canvas tidak menunggu webfont — panggil ini sebelum menggambar papan. */
export const fontReady = () => Promise.all([200, 600, 800].map((w) => document.fonts.load(`${w} 32px "Plus Jakarta Sans Variable"`))).then(() => true, () => true);

export function makeBoardTexture(theme: Theme, hi = true): THREE.CanvasTexture {
  // 4096px di desktop supaya nama petak tajam saat di-zoom; 2048px di HP (hemat memori)
  const N = 2048; // koordinat gambar tetap 2048; resolusi kanvas diskalakan
  const S = N / 12;
  const c = document.createElement('canvas');
  c.width = c.height = hi ? 4096 : 2048;
  const g = c.getContext('2d')!;
  g.scale(c.width / N, c.height / N);
  const v = theme.visual;

  // dasar
  g.fillStyle = v.board;
  g.fillRect(0, 0, N, N);

  // tengah papan
  g.save();
  g.translate(N / 2, N / 2);
  const grad = g.createRadialGradient(0, 0, S, 0, 0, S * 6.5);
  grad.addColorStop(0, '#ffffff');
  grad.addColorStop(1, v.board);
  g.fillStyle = grad;
  g.fillRect(-4.5 * S, -4.5 * S, 9 * S, 9 * S);
  // pola halus
  g.globalAlpha = 0.06;
  g.strokeStyle = v.boardCenter;
  g.lineWidth = 3;
  for (let r = S * 0.6; r < S * 6.4; r += S * 0.45) {
    g.beginPath();
    g.arc(0, 0, r, 0, Math.PI * 2);
    g.stroke();
  }
  g.globalAlpha = 1;
  // spanduk logo
  g.rotate(-Math.PI / 4);
  g.fillStyle = v.boardCenter;
  g.shadowColor = 'rgba(0,0,0,.35)';
  g.shadowBlur = 30;
  g.beginPath();
  g.roundRect(-4.2 * S, -0.85 * S, 8.4 * S, 1.7 * S, 30);
  g.fill();
  g.shadowBlur = 0;
  g.strokeStyle = '#fff';
  g.lineWidth = 10;
  g.stroke();
  g.fillStyle = '#fff';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.font = `800 ${S * 0.95}px ${FONT}`;
  g.fillText('MONOPOLI', 0, -0.05 * S);
  g.font = `700 ${S * 0.32}px ${FONT}`;
  g.fillText(tt('Edisi {name}', { name: tr(theme.name) }).toUpperCase(), 0, S * 1.25);
  g.fillStyle = v.boardCenter;
  // kartu dek
  const deck = (x: number, y: number, label: string, color: string, icon: string) => {
    g.save();
    g.translate(x, y);
    g.fillStyle = color;
    g.globalAlpha = 0.9;
    g.beginPath();
    g.roundRect(-1.1 * S, -0.7 * S, 2.2 * S, 1.4 * S, 22);
    g.fill();
    g.globalAlpha = 1;
    g.strokeStyle = 'rgba(255,255,255,.8)';
    g.setLineDash([16, 10]);
    g.lineWidth = 6;
    g.stroke();
    g.setLineDash([]);
    g.fillStyle = '#fff';
    g.font = `${S * 0.5}px ${FONT}`;
    g.fillText(icon, 0, -0.18 * S);
    g.font = `800 ${S * 0.2}px ${FONT}`;
    g.fillText(label.toUpperCase(), 0, 0.42 * S);
    g.restore();
  };
  // posisi tumpukan kartu 3D (Fx.tsx CardDecks) — gambar bayangan slot saja
  void deck;
  for (const [x, y] of [
    [-1.9 * S, -2.6 * S],
    [1.9 * S, 2.6 * S],
  ]) {
    g.save();
    g.translate(x, y);
    g.strokeStyle = 'rgba(0,0,0,.25)';
    g.setLineDash([14, 10]);
    g.lineWidth = 5;
    g.beginPath();
    g.roundRect(-1.08 * S, -0.68 * S, 2.16 * S, 1.36 * S, 18);
    g.stroke();
    g.restore();
  }
  g.restore();

  // petak
  for (let i = 0; i < 40; i++) {
    const t = BOARD[i];
    const side = Math.floor(i / 10);
    const k = i % 10;
    g.save();
    g.translate(N / 2, N / 2);
    g.rotate((side * Math.PI) / 2);
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.strokeStyle = '#1b1b1b';
    g.lineWidth = 3;
    const name = tileName(theme, i);

    if (k === 0) {
      const x0 = 4.5 * S;
      const s = 1.5 * S;
      g.fillStyle = v.board;
      g.fillRect(x0, x0, s, s);
      g.strokeRect(x0, x0, s, s);
      g.translate(x0 + s / 2, x0 + s / 2);
      g.rotate(-Math.PI / 4);

      if (t.kind === 'go') {
        const rad = g.createRadialGradient(0, 0, 0, 0, 0, s * 0.48);
        rad.addColorStop(0, '#10b981');
        rad.addColorStop(0.8, '#059669');
        rad.addColorStop(1, '#047857');
        g.fillStyle = rad;
        g.beginPath();
        g.arc(0, 0, s * 0.46, 0, Math.PI * 2);
        g.fill();
        g.strokeStyle = '#fef08a';
        g.lineWidth = 4;
        g.stroke();

        g.fillStyle = '#ffffff';
        g.font = `800 ${S * 0.32}px ${FONT}`;
        g.fillText(tt('MULAI'), 0, -0.15 * S);
        g.font = `800 ${S * 0.35}px ${FONT}`;
        g.fillText('➔', 0, 0.12 * S);
        g.fillStyle = '#fef08a';
        g.font = `700 ${S * 0.14}px ${FONT}`;
        g.fillText(tt('Gaji {amount}', { amount: formatMoney(theme, 200) }), 0, 0.34 * S);
      } else if (t.kind === 'jail') {
        g.fillStyle = '#1e293b';
        g.fillRect(-s * 0.42, -s * 0.42, s * 0.84, s * 0.84);
        g.strokeStyle = '#94a3b8';
        g.lineWidth = 4;
        for (let x = -s * 0.35; x <= s * 0.35; x += s * 0.14) {
          g.beginPath();
          g.moveTo(x, -s * 0.42);
          g.lineTo(x, s * 0.42);
          g.stroke();
        }
        g.fillStyle = '#f8fafc';
        g.font = `800 ${S * 0.17}px ${FONT}`;
        g.fillText(tt('PENJARA'), 0, 0);
        g.fillStyle = '#cbd5e1';
        g.font = `700 ${S * 0.11}px ${FONT}`;
        g.fillText(tt('Hanya Mampir'), 0, 0.28 * S);
      } else if (t.kind === 'parking') {
        const rad = g.createRadialGradient(0, 0, 0, 0, 0, s * 0.45);
        rad.addColorStop(0, '#f97316');
        rad.addColorStop(1, '#9a3412');
        g.fillStyle = rad;
        g.beginPath();
        g.arc(0, 0, s * 0.44, 0, Math.PI * 2);
        g.fill();
        g.font = `${S * 0.42}px ${FONT}`;
        g.fillText('☕', 0, -0.12 * S);
        g.fillStyle = '#fff';
        g.font = `800 ${S * 0.16}px ${FONT}`;
        wrap(g, name.toUpperCase(), s * 0.85).forEach((l, n) => g.fillText(l, 0, 0.18 * S + n * S * 0.16));
      } else if (t.kind === 'gotojail') {
        const rad = g.createRadialGradient(0, 0, 0, 0, 0, s * 0.45);
        rad.addColorStop(0, '#ef4444');
        rad.addColorStop(1, '#7f1d1d');
        g.fillStyle = rad;
        g.beginPath();
        g.arc(0, 0, s * 0.44, 0, Math.PI * 2);
        g.fill();
        g.font = `${S * 0.42}px ${FONT}`;
        g.fillText('👮', 0, -0.12 * S);
        g.fillStyle = '#fff';
        g.font = `800 ${S * 0.17}px ${FONT}`;
        g.fillText(tt('DITANGKAP!'), 0, 0.18 * S);
        g.font = `700 ${S * 0.11}px ${FONT}`;
        g.fillText(tt('Masuk Sel'), 0, 0.34 * S);
      }
      g.restore();
      continue;
    }

    const x0 = (5 - k - 0.5) * S;
    const y0 = 4.5 * S;
    const w = S;
    const h = 1.5 * S;
    g.fillStyle = v.board;
    g.fillRect(x0, y0, w, h);

    if (t.kind === 'property') {
      const gColor = theme.groupColors[t.group!];
      g.fillStyle = gColor;
      g.fillRect(x0, y0, w, 0.28 * S);
      g.fillStyle = 'rgba(255, 215, 0, 0.9)';
      g.fillRect(x0, y0 + 0.28 * S, w, 2.5);

      g.fillStyle = '#0f172a';
      g.font = `800 ${S * 0.125}px ${FONT}`;
      wrap(g, name.toUpperCase(), w - 8).forEach((l, n) => g.fillText(l, x0 + w / 2, y0 + 0.38 * S + n * S * 0.13));

      const cityInfo = getCityInfo(name, theme);
      drawLandmarkToCanvas(g, cityInfo, x0 + w / 2, y0 + 0.88 * S, w, 0.58 * S, gColor);

      if (t.price) {
        g.fillStyle = 'rgba(15, 23, 42, 0.08)';
        g.beginPath();
        g.roundRect(x0 + 6, y0 + h - 0.24 * S, w - 12, 0.19 * S, 6);
        g.fill();
        g.fillStyle = '#0f172a';
        g.font = `800 ${S * 0.12}px ${FONT}`;
        g.fillText(formatMoney(theme, t.price), x0 + w / 2, y0 + h - 0.14 * S);
      }
    } else {
      const cityInfo = getCityInfo(name, theme);
      g.fillStyle = '#0f172a';
      g.font = `800 ${S * 0.12}px ${FONT}`;
      wrap(g, name.toUpperCase(), w - 8).forEach((l, n) => g.fillText(l, x0 + w / 2, y0 + 0.24 * S + n * S * 0.13));

      if (t.kind === 'station' || t.kind === 'utility') {
        drawLandmarkToCanvas(g, cityInfo, x0 + w / 2, y0 + 0.84 * S, w, 0.62 * S, '#0284c7');
      } else {
        const icon = t.kind === 'tax' ? '💰' : t.kind === 'chance' ? '❓' : '🎁';
        g.font = `${S * 0.48}px ${FONT}`;
        g.fillText(icon, x0 + w / 2, y0 + 0.82 * S);
      }

      const price = t.price ?? t.tax;
      if (price) {
        g.fillStyle = t.kind === 'tax' ? '#b91c1c' : '#0f172a';
        g.font = `800 ${S * 0.12}px ${FONT}`;
        g.fillText(formatMoney(theme, price), x0 + w / 2, y0 + h - 0.14 * S);
      }
    }

    g.strokeRect(x0, y0, w, h);
    g.restore();
  }

  // bingkai luar
  g.strokeStyle = '#111';
  g.lineWidth = 10;
  g.strokeRect(5, 5, N - 10, N - 10);
  g.strokeRect(1.5 * S, 1.5 * S, 9 * S, 9 * S);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 16;
  return tex;
}
