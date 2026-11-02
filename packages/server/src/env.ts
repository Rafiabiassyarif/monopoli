// Muat variabel dari file .env di akar proyek (mis. GOOGLE_CLIENT_ID) sebelum modul lain membaca process.env.
// Variabel yang sudah diset di terminal tidak ditimpa. File .env tidak boleh di-commit (ada di .gitignore).

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const file = process.env.ENV_FILE ?? fileURLToPath(new URL('../../../.env', import.meta.url));
try {
  for (const raw of readFileSync(file, 'utf8').split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const m = /^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/.exec(line);
    if (!m) continue;
    let v = m[2].trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    if (process.env[m[1]] === undefined) process.env[m[1]] = v;
  }
} catch (e) {
  if ((e as NodeJS.ErrnoException).code !== 'ENOENT') console.error('gagal membaca .env', e);
}

// Pengaturan publik (bukan rahasia) dari monopoli.config.json di akar proyek, mis. Client ID Google.
// Client ID memang dikirim ke browser setiap pemain, jadi aman disimpan di file biasa. Rahasia tetap di .env.
const cfgFile = process.env.CONFIG_FILE ?? fileURLToPath(new URL('../../../monopoli.config.json', import.meta.url));
try {
  const cfg = JSON.parse(readFileSync(cfgFile, 'utf8')) as { googleClientId?: string };
  if (process.env.GOOGLE_CLIENT_ID === undefined && typeof cfg.googleClientId === 'string') process.env.GOOGLE_CLIENT_ID = cfg.googleClientId.trim();
} catch (e) {
  if ((e as NodeJS.ErrnoException).code !== 'ENOENT') console.error('gagal membaca monopoli.config.json', e);
}
