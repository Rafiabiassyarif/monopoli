// Operasional: log galat ke file + cadangan otomatis data (akun & room) dengan rotasi.

import { appendFileSync, copyFileSync, existsSync, mkdirSync, readdirSync, statSync, unlinkSync, renameSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const DATA_DIR = process.env.DATA_DIR ?? fileURLToPath(new URL('../data/', import.meta.url));
const LOG_FILE = process.env.ERROR_LOG ?? join(DATA_DIR, 'logs', 'error.log');
const BACKUP_DIR = process.env.BACKUP_DIR ?? join(DATA_DIR, 'backups');
/** jam antar cadangan */
const BACKUP_HOURS = Number(process.env.BACKUP_HOURS ?? 6);
/** banyak cadangan yang disimpan per file */
const BACKUP_KEEP = Number(process.env.BACKUP_KEEP ?? 28);
const LOG_MAX = 5 * 1024 * 1024;
const LOG_TO_FILE = process.env.PERSIST !== '0';

/** Catat galat ke konsol + data/logs/error.log (dirotasi saat > 5 MB). */
export function logError(label: string, e: unknown) {
  const text = e instanceof Error ? `${e.message}\n${e.stack ?? ''}` : String(e);
  console.error(`[${label}]`, e);
  if (!LOG_TO_FILE) return;
  try {
    mkdirSync(dirname(LOG_FILE), { recursive: true });
    if (existsSync(LOG_FILE) && statSync(LOG_FILE).size > LOG_MAX) renameSync(LOG_FILE, LOG_FILE + '.1');
    appendFileSync(LOG_FILE, `${new Date().toISOString()} [${label}] ${text}\n`);
  } catch {}
}

/** Salin tiap file data ke data/backups/<nama>-<waktu>.json; simpan BACKUP_KEEP terbaru. */
export function backupNow(files: string[]) {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  mkdirSync(BACKUP_DIR, { recursive: true });
  for (const f of files) {
    if (!existsSync(f)) continue;
    const name = basename(f).replace(/\.json$/, '');
    try {
      copyFileSync(f, join(BACKUP_DIR, `${name}-${stamp}.json`));
      const old = readdirSync(BACKUP_DIR)
        .filter((x) => x.startsWith(name + '-') && x.endsWith('.json'))
        .sort()
        .reverse()
        .slice(BACKUP_KEEP);
      old.forEach((x) => unlinkSync(join(BACKUP_DIR, x)));
    } catch (e) {
      logError('backup', e);
    }
  }
}

export function startBackups(files: string[]) {
  if (!BACKUP_HOURS) return;
  // cadangan pertama sesaat setelah server menyala (data sudah termuat), lalu berkala
  setTimeout(() => backupNow(files), 60_000).unref();
  setInterval(() => backupNow(files), BACKUP_HOURS * 3600_000).unref();
}
