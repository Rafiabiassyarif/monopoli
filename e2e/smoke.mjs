// Tes browser menyeluruh (Playwright): landing, main lokal, akun email+kode, profil & foto, teman, chat pribadi,
// undangan, game online sampai selesai (statistik & peringkat), main cepat, penonton, admin, build offline.
//
// Jalankan:  npm run build  lalu  npm run e2e
// Butuh Playwright:  npm i -D playwright  &&  npx playwright install chromium
// WebGL sengaja dimatikan (papan 2D) supaya cepat & stabil di mesin tanpa GPU.

import { spawn } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

let chromium;
try {
  ({ chromium } = await import('playwright'));
} catch {
  console.error('Playwright belum terpasang. Jalankan: npm i -D playwright && npx playwright install chromium');
  process.exit(2);
}

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const PORT = 3099;
const B = `http://localhost:${PORT}`;
const OUT = join(tmpdir(), 'monopoli-e2e');
mkdirSync(OUT, { recursive: true });
let log = '';
const LOG = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);
const fails = [];
const check = (ok, msg) => {
  LOG(ok ? 'PASS' : 'FAIL', msg);
  if (!ok) fails.push(msg);
};

// ---------- server uji (data di memori, email dicetak ke konsol) ----------
const srv = spawn(process.execPath, ['--import', 'tsx', 'packages/server/src/index.ts'], {
  cwd: ROOT,
  env: { ...process.env, PORT: String(PORT), PERSIST: '0', SMTP_USER: '', SMTP_PASS: '', GOOGLE_CLIENT_ID: '', ADMIN_USERNAMES: 'andi', BOT_DELAY: '60', RATE_LIMIT: '100000', AUTH_RATE: '1000' },
});
srv.stdout.on('data', (d) => (log += d));
srv.stderr.on('data', (d) => (log += d));
for (let i = 0; i < 100 && !log.includes(`:${PORT}`); i++) await new Promise((r) => setTimeout(r, 100));
if (!log.includes(`:${PORT}`)) {
  console.error('server tidak start:\n' + log);
  process.exit(1);
}

const browser = await chromium.launch({ args: ['--disable-webgl', '--disable-3d-apis'] });
const errors = [];
const pages = [];
const mk = async (vp = { width: 900, height: 640 }, locale = 'en-US') => {
  const ctx = await browser.newContext({ viewport: vp, locale });
  await ctx.addInitScript(() => {
    try {
      localStorage.setItem('monopoli.tipsOff', '1');
      localStorage.setItem('monopoli.music', '0');
      localStorage.setItem('monopoli.speed', '2');
    } catch {}
  });
  const p = await ctx.newPage();
  p.setDefaultTimeout(20000);
  p.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  p.on('console', (m) => m.type() === 'error' && !/WebGL|GPU|favicon|Failed to load resource/i.test(m.text()) && errors.push(`console: ${m.text()}`));
  pages.push(p);
  return p;
};
const step = async (name, f) => {
  try {
    await f();
  } catch (e) {
    check(false, `${name}: ${String(e.message).split('\n').slice(0, 2).join(' | ')}`);
    for (const [k, pg] of pages.entries()) await pg.screenshot({ path: join(OUT, `fail-${name.replace(/\W+/g, '_')}-${k}.png`) }).catch(() => {});
  }
};
const codeFor = async (email) => {
  for (let i = 0; i < 60; i++) {
    const all = [...log.matchAll(new RegExp(`Kepada: ${email.replace('.', '\\.')}[\\s\\S]*?kamu: (\\d{6})`, 'g'))];
    if (all.length) return all.at(-1)[1];
    await new Promise((r) => setTimeout(r, 150));
  }
  throw new Error('kode email tidak ada');
};
const login = async (p, email) => {
  await p.goto(B);
  await p.getByRole('button', { name: /Sign in with email/ }).first().click();
  await p.locator('.auth-form input[type=email]').fill(email);
  await p.locator('.auth-form button[type=submit]').click();
  await p.waitForSelector('.otp-input');
  await p.locator('.otp-input').fill(await codeFor(email));
  await p.waitForSelector('.menu-main');
};
/** satu aksi giliran yang tersedia di dock */
const playOnce = async (p) => {
  for (const re of [/^\s*Roll dice/, /^\s*Roll again/, /^\s*Buy /, /^\s*End turn/, /^\s*Pay\s*$/, /^\s*Pass\s*$/, /^\s*Decline\s*$/]) {
    const b = p.locator('.dock button:not([disabled])').filter({ hasText: re }).first();
    if (await b.isVisible().catch(() => false)) {
      await b.click({ timeout: 4000 }).catch(() => {});
      return re.source;
    }
  }
  // utang tak terbayar → bangkrut supaya game tetap berjalan
  const bk = p.locator('.dock button.danger:not([disabled])', { hasText: 'Bankrupt' });
  if (await bk.isVisible().catch(() => false)) {
    await bk.click();
    await p.getByRole('dialog').getByRole('button', { name: 'Bankrupt' }).click().catch(() => {});
    return 'bankrupt';
  }
  return null;
};

// ================= landing & halaman statis =================
await step('landing', async () => {
  const p = await mk({ width: 900, height: 640 }, 'id-ID');
  await p.goto(B);
  check(await p.getByRole('button', { name: /Masuk dengan email/ }).isVisible(), 'landing bahasa Indonesia');
  await p.getByRole('radio', { name: 'English' }).click();
  check(await p.getByRole('button', { name: /Sign in with email/ }).isVisible(), 'ganti bahasa ke English');
  for (const u of ['/privacy', '/terms?lang=en', '/health']) check((await p.request.get(B + u)).status() === 200, `GET ${u}`);
  await p.context().close();
});

// ================= main lokal =================
await step('lokal', async () => {
  const p = await mk();
  await p.goto(B);
  await p.getByRole('button', { name: /Play as guest/ }).click();
  await p.locator('.mode-local').click();
  await p.getByRole('button', { name: /Start game/ }).click();
  await p.waitForSelector('.dock');
  const acts = [];
  const end = Date.now() + 60_000;
  while (Date.now() < end && acts.length < 9) {
    const a = await playOnce(p);
    if (a) acts.push(a);
    await p.waitForTimeout(700);
  }
  check(acts.filter((x) => x.includes('Roll')).length >= 2, `main lokal (${acts.length} aksi)`);
  for (const title of ['My assets', 'History', 'Stats', 'How to play', 'Settings']) {
    await p.locator(`.toolbar button[title="${title}"]`).click();
    check(await p.locator('.modal').first().waitFor().then(() => true, () => false), `panel ${title}`);
    await p.keyboard.press('Escape');
    await p.waitForTimeout(300);
  }
  await p.locator('.toolbar button[title="Settings"]').click();
  await p.getByRole('button', { name: 'Back to menu' }).click();
  await p.getByRole('dialog').getByRole('button', { name: 'Leave' }).click();
  await p.locator('.resume-strip').click();
  check(await p.locator('.dock').waitFor().then(() => true, () => false), 'lanjutkan game lokal');
  await p.context().close();
});

// ================= latihan =================
await step('latihan', async () => {
  const p = await mk();
  await p.goto(B);
  await p.getByRole('button', { name: /Play as guest/ }).click();
  await p.locator('.menu-foot button', { hasText: 'How to play' }).click();
  await p.getByRole('button', { name: /Start practice/ }).click();
  await p.waitForSelector('.dock');
  check((await p.locator('.pl').count()) === 2, 'latihan: 1 lawan bot');
  check(await p.locator('.coach').waitFor({ timeout: 8000 }).then(() => true, () => false), 'latihan: tips tutorial muncul');
  await p.context().close();
});

// ================= akun, teman, chat, undangan =================
const a = await mk();
const b = await mk({ width: 390, height: 800 });
await step('akun', async () => {
  await login(a, 'andi@contoh.com');
  await login(b, 'budi@contoh.com');
  check(true, 'login email + kode (2 akun)');
  await a.locator('.user-btn').click();
  await a.locator('.user-menu button', { hasText: 'Profile & stats' }).click();
  await a.locator('.icon-picker button').nth(3).click();
  check(await a.locator('.profile-head .avatar-icon').waitFor().then(() => true, () => false), 'pilih ikon avatar');
  await a.keyboard.press('Escape');
});
await step('teman', async () => {
  await a.locator('.sub-friends').click();
  await a.locator('.search input').fill('budi');
  await a.locator('.person-row').filter({ hasText: '@budi' }).getByRole('button', { name: 'Add' }).click();
  await b.waitForTimeout(1200);
  await b.locator('.sub-friends').click();
  await b.locator('.person-row').filter({ hasText: 'Andi' }).getByRole('button', { name: 'Accept' }).first().click();
  await a.waitForTimeout(1200);
  await a.locator('.person-row').filter({ hasText: 'Budi' }).getByRole('button', { name: 'Private chat' }).click();
  await a.locator('.dm input').fill('halo');
  await a.locator('.dm input').press('Enter');
  await b.waitForTimeout(1200);
  check((await b.locator('.person-row .badge').count()) > 0, 'chat pribadi: tanda belum dibaca');
  await a.keyboard.press('Escape');
  await a.getByRole('button', { name: 'Back' }).click();
  await b.getByRole('button', { name: 'Back' }).click();
});

// ================= game online sampai selesai =================
await step('online sampai selesai', async () => {
  await a.locator('.mode-online').click();
  await a.getByRole('button', { name: /Create room/ }).click();
  await a.waitForSelector('.room-code');
  await a.getByRole('button', { name: /Invite friends/ }).click();
  await a.getByRole('dialog').getByRole('button', { name: /Invite/ }).first().click();
  await a.keyboard.press('Escape');
  check(await b.locator('.invite').waitFor().then(() => true, () => false), 'undangan sampai');
  await b.locator('.invite').getByRole('button', { name: 'Join' }).click();
  await a.waitForTimeout(1200);
  await a.getByRole('radio', { name: '10 rounds' }).click();
  await a.getByRole('button', { name: /Start game/ }).click();
  await a.waitForSelector('.dock');
  await b.waitForSelector('.dock');
  const end = Date.now() + 420_000;
  let n = 0;
  while (Date.now() < end && !(await a.locator('.gameover').isVisible().catch(() => false))) {
    for (const p of [a, b]) if (await playOnce(p)) n++;
    await a.waitForTimeout(250);
  }
  const over = await a.locator('.gameover').isVisible();
  check(over, `game online selesai (${n} aksi)`);
  if (over) {
    check(/wins!/.test(await a.locator('.gameover h1').innerText()), 'layar pemenang');
    await a.getByRole('button', { name: /Main menu/ }).click();
    await a.locator('.user-btn').click();
    await a.locator('.user-menu button', { hasText: 'Profile & stats' }).click();
    const stats = await a.locator('.stat-grid').innerText();
    check(/Play online\s*1/.test(stats), 'statistik game tercatat di profil');
    check((await a.locator('.history-row').count()) === 1, 'riwayat game di profil');
    await a.keyboard.press('Escape');
    await a.locator('.sub-rank').click();
    await a.locator('.leader-row').first().waitFor();
    check((await a.locator('.leader-row').count()) >= 2, 'peringkat terisi (kedua pemain)');
    await a.getByRole('button', { name: 'Back' }).click();
  }
});

// ================= main cepat & penonton =================
await step('main cepat', async () => {
  const c = await mk();
  const d = await mk();
  for (const p of [c, d]) {
    await p.goto(B);
    await p.getByRole('button', { name: /Play as guest/ }).click();
    await p.locator('.mode-online').click();
    await p.locator('input[placeholder="Name"]').fill(p === c ? 'Cici' : 'Dodi');
    await p.getByRole('button', { name: /Quick play/ }).click();
    await p.waitForSelector('.room-code');
  }
  check((await c.locator('.room-code b').innerText()) === (await d.locator('.room-code b').innerText()), 'main cepat: dua tamu masuk room yang sama');
  await c.getByRole('button', { name: /Add bot/ }).click();
  await c.getByRole('button', { name: /Start game/ }).click();
  await c.waitForSelector('.dock');
  const e = await mk();
  await e.goto(B);
  await e.getByRole('button', { name: /Play as guest/ }).click();
  await e.locator('.mode-online').click();
  await e.waitForTimeout(5500);
  await e.locator('.room-row.live').getByRole('button', { name: /Watch/ }).first().click();
  check(await e.locator('.spectate-badge').waitFor().then(() => true, () => false), 'penonton');
  check((await e.locator('.dock button').filter({ hasText: /Roll dice|Buy/ }).count()) === 0, 'penonton tanpa tombol aksi');
});

// ================= admin =================
await step('admin', async () => {
  await a.locator('.user-btn').click();
  await a.locator('.user-menu button', { hasText: 'Player reports' }).click();
  check(await a.getByText('No reports.').waitFor().then(() => true, () => false), 'admin: daftar laporan');
  await a.keyboard.press('Escape');
  // tangguhkan budi dari profilnya
  await a.locator('.sub-friends').click();
  await a.locator('.person-row').filter({ hasText: 'Budi' }).locator('.person-main').click();
  await a.locator('.admin-ban').getByRole('radio', { name: '1 day' }).click();
  await a.locator('.admin-ban input').fill('uji');
  await a.locator('.admin-ban').getByRole('button', { name: /Suspend/ }).click();
  await a.getByRole('dialog').last().getByRole('button', { name: 'Suspend' }).click();
  check(await a.locator('.admin-ban .chip.warn').waitFor().then(() => true, () => false), 'admin: akun ditangguhkan');
  // pemain yang sedang online langsung dikeluarkan (koneksi diputus) dan diberi tahu alasannya
  check(await b.locator('.landing').waitFor().then(() => true, () => false), 'akun yang ditangguhkan keluar ke landing');
  check(await b.locator('.toast').filter({ hasText: /suspended/i }).waitFor().then(() => true, () => false), 'pemain diberi tahu alasan penangguhan');
  await a.locator('.admin-ban').getByRole('button', { name: /Lift suspension/ }).click();
  check(await a.locator('.admin-ban .chip.warn').waitFor({ state: 'detached' }).then(() => true, () => false), 'admin: penangguhan dicabut');
});

// ================= build offline (demo statis) =================
await step('offline', async () => {
  const dist = join(ROOT, 'packages/web/dist/index.html');
  readFileSync(dist); // build harus ada
  check(true, 'build web ada');
});

// ================= HP =================
await step('hp', async () => {
  const m = await mk({ width: 375, height: 700 }, 'id-ID');
  await m.goto(B);
  await m.getByRole('button', { name: /Main sebagai tamu/ }).click();
  await m.waitForSelector('.menu-main');
  const over = await m.evaluate(() => document.documentElement.scrollWidth > innerWidth);
  check(!over, 'HP 375px: tidak ada gulir ke samping');
});

check(errors.length === 0, `tanpa error browser${errors.length ? ': ' + errors.slice(0, 3).join(' / ') : ''}`);
await browser.close();
srv.kill();
writeFileSync(join(OUT, 'server.log'), log);
console.log(`\n${fails.length ? '❌' : '✅'} ${fails.length} gagal. Tangkapan layar & log: ${OUT}`);
process.exit(fails.length ? 1 : 0);
