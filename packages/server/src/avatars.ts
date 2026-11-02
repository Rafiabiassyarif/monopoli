// Foto profil yang diunggah pemain: disimpan sebagai file di data/avatars, disajikan di /avatars/<file>.

import { mkdirSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomBytes } from 'node:crypto';

const DIR =
  process.env.AVATAR_DIR ?? (process.env.PERSIST === '0' ? join(tmpdir(), 'monopoli-avatars') : fileURLToPath(new URL('../data/avatars/', import.meta.url)));
/** batas ukuran file gambar setelah diperkecil di browser */
export const AVATAR_MAX = 300 * 1024;
const FILE_RE = /^[a-z0-9-]{8,80}\.(png|jpg|webp)$/;
const MIME: Record<string, string> = { png: 'image/png', jpg: 'image/jpeg', webp: 'image/webp' };

/** Cek tanda tangan file (bukan hanya klaim tipe dari browser). */
function kind(b: Buffer): 'png' | 'jpg' | 'webp' | null {
  if (b.length > 8 && b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'png';
  if (b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'jpg';
  if (b.length > 12 && b.toString('ascii', 0, 4) === 'RIFF' && b.toString('ascii', 8, 12) === 'WEBP') return 'webp';
  return null;
}

/** Simpan gambar dari data URL; mengembalikan path publik (/avatars/…) atau pesan galat. */
export function saveAvatar(userId: string, dataUrl: string): { url: string } | { error: string } {
  const m = /^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl);
  if (!m) return { error: 'Format gambar harus PNG, JPG, atau WEBP' };
  const buf = Buffer.from(m[2], 'base64');
  if (buf.length > AVATAR_MAX) return { error: 'Gambar terlalu besar (maks 300 KB)' };
  const k = kind(buf);
  if (!k) return { error: 'File bukan gambar yang valid' };
  mkdirSync(DIR, { recursive: true });
  const name = `${userId.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 24) || 'u'}-${randomBytes(6).toString('hex')}.${k}`;
  writeFileSync(join(DIR, name), buf);
  return { url: `/avatars/${name}` };
}

/** Hapus file foto lama (kalau memang foto unggahan). */
export function dropAvatar(url: string | undefined) {
  const name = url?.startsWith('/avatars/') ? url.slice(9) : '';
  if (!FILE_RE.test(name)) return;
  try {
    unlinkSync(join(DIR, name));
  } catch {}
}

/** Isi file untuk /avatars/<file>, atau null. */
export function readAvatar(pathname: string): { body: Buffer; type: string } | null {
  if (!pathname.startsWith('/avatars/')) return null;
  const name = pathname.slice(9);
  if (!FILE_RE.test(name)) return null;
  try {
    return { body: readFileSync(join(DIR, name)), type: MIME[name.split('.').pop()!] };
  } catch {
    return null;
  }
}
