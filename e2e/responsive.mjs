// Audit tampilan responsif: buka semua layar utama di beberapa ukuran layar (HP, tablet, laptop, monitor),
// cek tidak ada yang meluber ke samping, dan simpan tangkapan layar untuk dicek mata.
//   node e2e/responsive.mjs  [folder-output]
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
const { chromium } = await import('playwright');

const OUT = process.argv[2] ?? '/tmp/monopoli-responsive';
mkdirSync(OUT, { recursive: true });
const PORT = 3098;
const srv = spawn(process.execPath, ['--import', 'tsx', 'packages/server/src/index.ts'], {
  env: { ...process.env, PORT: String(PORT), PERSIST: '0', SMTP_USER: '', SMTP_PASS: '', BOT_DELAY: '60' },
});
let log = '';
srv.stdout.on('data', (d) => (log += d));
for (let i = 0; i < 100 && !log.includes(`:${PORT}`); i++) await new Promise((r) => setTimeout(r, 100));

const VIEWS = {
  hp: { width: 375, height: 760, isMobile: true, hasTouch: true, deviceScaleFactor: 1 },
  'hp-landscape': { width: 760, height: 375, isMobile: true, hasTouch: true, deviceScaleFactor: 1 },
  tablet: { width: 768, height: 1024, isMobile: true, hasTouch: true, deviceScaleFactor: 1 },
  laptop: { width: 1366, height: 768 },
  monitor: { width: 1920, height: 1080 },
};
const only = process.env.VIEWS?.split(',');
const b = await chromium.launch({ args: ['--disable-webgl', '--disable-3d-apis'] });
const problems = [];

const overflow = (p, where) =>
  p.evaluate((where) => {
    const W = innerWidth;
    const out = [];
    if (document.documentElement.scrollWidth > W + 1) out.push(`halaman lebih lebar (${document.documentElement.scrollWidth}px > ${W}px)`);
    for (const el of document.querySelectorAll('body *')) {
      const r = el.getBoundingClientRect();
      if (!r.width || !r.height) continue;
      const cs = getComputedStyle(el);
      if (cs.visibility === 'hidden' || cs.display === 'none' || cs.position === 'fixed' && r.right <= 0) continue;
      if (el.closest('.board2d, canvas, .cfx, .b2-float, .dice-mini, [aria-hidden="true"]')) continue;
      // teks/tombol yang terpotong di luar layar
      if ((r.right > W + 2 || r.left < -2) && /BUTTON|A|INPUT|H1|H2|B|SPAN|P/.test(el.tagName) && el.textContent.trim()) {
        let s = el; let clipped = false;
        while ((s = s.parentElement)) { const o = getComputedStyle(s).overflowX; if (o === 'auto' || o === 'scroll' || o === 'hidden') { clipped = true; break; } }
        if (!clipped) out.push(`${el.tagName}.${String(el.className).slice(0, 40)} "${el.textContent.trim().slice(0, 30)}" x=${Math.round(r.left)}..${Math.round(r.right)}`);
      }
    }
    return [...new Set(out)].slice(0, 6).map((x) => `${where}: ${x}`);
  }, where);

for (const [name, vp] of Object.entries(VIEWS)) {
  if (only && !only.includes(name)) continue;
  const ctx = await b.newContext({ viewport: { width: vp.width, height: vp.height }, isMobile: vp.isMobile, hasTouch: vp.hasTouch, deviceScaleFactor: vp.deviceScaleFactor ?? 1, locale: 'en-US' });
  await ctx.addInitScript(() => {
    localStorage.setItem('monopoli.lang', 'en');
    localStorage.setItem('monopoli.tipsOff', '1');
    localStorage.setItem('monopoli.music', '0');
    localStorage.setItem('monopoli.speed', '2');
  });
  const p = await ctx.newPage();
  p.setDefaultTimeout(12000);
  const shot = async (id, full = false) => {
    await p.waitForTimeout(350);
    problems.push(...(await overflow(p, `${name}/${id}`)));
    await p.screenshot({ path: `${OUT}/${name}-${id}.png`, fullPage: full });
  };
  try {
    await p.goto(`http://localhost:${PORT}/`);
    await shot('01-landing', true);
    await p.getByRole('button', { name: /Play as guest/ }).click();
    await shot('02-menu');
    await p.locator('.sub-themes').click();
    await shot('03-themes');
    await p.locator('.theme-tile').first().click();
    await shot('04-theme-edit');
    await p.locator('.page > .seg button', { hasText: 'Cards & effects' }).click();
    await shot('05-theme-cards');
    await p.locator('.card-subtab-pill').nth(2).click();
    await p.locator('.card-default-state-box .btn.primary').first().click().catch(() => {});
    await shot('06-theme-fx');
    await p.goto(`http://localhost:${PORT}/`);
    await p.getByRole('button', { name: /Play as guest/ }).click().catch(() => {});
    await p.locator('.mode-local').click();
    await shot('07-local-setup');
    await p.getByRole('button', { name: /Start game/ }).click();
    await p.waitForSelector('.dock');
    // main beberapa giliran supaya ada properti, log, dll
    for (let i = 0; i < 40; i++) {
      for (const re of [/^\s*Roll dice/, /^\s*Roll again/, /^\s*Buy /, /^\s*End turn/, /^\s*Pass\s*$/]) {
        const bt = p.locator('.dock button:not([disabled])').filter({ hasText: re }).first();
        if (await bt.isVisible().catch(() => false)) {
          await bt.click({ timeout: 2000 }).catch(() => {});
          break;
        }
      }
      await p.waitForTimeout(250);
    }
    await shot('08-game');
    for (const [k, title] of [['09-assets', 'My assets'], ['10-history', 'History'], ['11-stats', 'Stats'], ['12-help', 'How to play'], ['13-settings', 'Settings']]) {
      await p.locator(`.toolbar button[title="${title}"]`).click();
      await shot(k);
      await p.keyboard.press('Escape');
      await p.waitForTimeout(200);
    }
    await p.locator('.b2-tile').nth(39).click();
    await shot('14-deed');
    await p.keyboard.press('Escape');
    const trade = p.locator('.dock button', { hasText: /Trade/ }).first();
    if (await trade.isVisible().catch(() => false)) {
      await trade.click();
      await shot('15-trade');
      await p.keyboard.press('Escape');
    }
    await p.goto(`http://localhost:${PORT}/`);
    await p.locator('.user-chip .signin-btn, .user-chip .btn').first().click().catch(() => {});
    await p.getByRole('button', { name: /Play as guest/ }).click().catch(() => {});
    await p.locator('.signin-btn').click().catch(() => {});
    await shot('16-signin');
    await p.keyboard.press('Escape');
    await p.locator('.mode-online').click().catch(() => {});
    await shot('17-online');
  } catch (e) {
    problems.push(`${name}: GAGAL ${String(e.message).split('\n')[0]}`);
    await p.screenshot({ path: `${OUT}/${name}-error.png` }).catch(() => {});
  }
  await ctx.close();
}
await b.close();
srv.kill();
console.log(problems.length ? problems.join('\n') : 'tidak ada elemen meluber');
console.log(`tangkapan layar: ${OUT}`);
process.exit(0);
