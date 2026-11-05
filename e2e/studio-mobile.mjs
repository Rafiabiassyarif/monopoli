// Audit Studio tema di HP: buka semua tab & panel editor, cari teks terpotong / elemen keluar kotak,
// simpan tangkapan layar halaman penuh.   node e2e/studio-mobile.mjs [folder-output]
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
const { chromium } = await import('playwright');

const OUT = process.argv[2] ?? '/tmp/monopoli-studio';
mkdirSync(OUT, { recursive: true });
const PORT = 3095;
const srv = spawn(process.execPath, ['--import', 'tsx', 'packages/server/src/index.ts'], {
  env: { ...process.env, PORT: String(PORT), PERSIST: '0', SMTP_USER: '', SMTP_PASS: '' },
});
let log = '';
srv.stdout.on('data', (d) => (log += d));
for (let i = 0; i < 100 && !log.includes(`:${PORT}`); i++) await new Promise((r) => setTimeout(r, 100));

const b = await chromium.launch({ args: ['--disable-webgl', '--disable-3d-apis'] });
const problems = [];
const VIEWS = (process.env.VIEWS ?? '360x740,390x844,768x1024').split(',');

const check = (p, where) =>
  p.evaluate((where) => {
    const W = innerWidth;
    const out = [];
    if (document.documentElement.scrollWidth > W + 1) out.push(`halaman lebih lebar (${document.documentElement.scrollWidth}px)`);
    const page = document.querySelector('.page');
    if (!page) return out;
    const pr = page.getBoundingClientRect();
    for (const el of page.querySelectorAll('*')) {
      const r = el.getBoundingClientRect();
      if (!r.width || !r.height) continue;
      const cs = getComputedStyle(el);
      if (cs.display === 'none' || cs.visibility === 'hidden') continue;
      if (el.closest('.cfx, [aria-hidden="true"], .fx-stage')) continue;
      const txt = (el.textContent || el.value || '').trim().slice(0, 28);
      // keluar dari kotak halaman (dan tidak di dalam penggulung)
      if (r.right > pr.right + 1 || r.left < pr.left - 1) {
        let s = el, clipped = false;
        while ((s = s.parentElement) && s !== page) {
          const o = getComputedStyle(s).overflowX;
          if (o === 'auto' || o === 'scroll') { clipped = true; break; }
        }
        if (!clipped) out.push(`keluar: ${el.tagName}.${String(el.className).split(' ')[0]} "${txt}" ${Math.round(r.left)}..${Math.round(r.right)}`);
      }
      // teks terpotong (ellipsis / overflow hidden)
      if (el.children.length === 0 && txt && (cs.overflow === 'hidden' || cs.textOverflow === 'ellipsis') && el.scrollWidth > el.clientWidth + 2)
        out.push(`terpotong: ${el.tagName}.${String(el.className).split(' ')[0]} "${txt}" (${el.scrollWidth}>${el.clientWidth})`);
    }
    return [...new Set(out)].slice(0, 12).map((x) => `${where}: ${x}`);
  }, where);

for (const v of VIEWS) {
  const [w, h] = v.split('x').map(Number);
  const ctx = await b.newContext({ viewport: { width: w, height: h }, isMobile: true, hasTouch: true, locale: 'id-ID' });
  await ctx.addInitScript(() => {
    localStorage.setItem('monopoli.lang', 'id');
    localStorage.setItem('monopoli.tipsOff', '1');
  });
  const p = await ctx.newPage();
  p.setDefaultTimeout(8000);
  let n = 0;
  const shot = async (id) => {
    await p.waitForTimeout(300);
    problems.push(...(await check(p, `${v}/${id}`)));
    // gulir overlay per layar dan simpan potongannya (digabung terpisah)
    const id2 = `${OUT}/${v}-${String(++n).padStart(2, '0')}-${id}`;
    const total = await p.evaluate(() => { const o = document.querySelector('.overlay'); return o ? o.scrollHeight : innerHeight; });
    const keep = await p.evaluate(() => document.querySelector('.overlay')?.scrollTop ?? 0);
    let k = 0;
    for (let y = 0; y < total && k < 12; y += h - 120, k++) {
      await p.evaluate((y) => { const o = document.querySelector('.overlay'); if (o) o.scrollTop = y; }, y);
      await p.waitForTimeout(120);
      await p.screenshot({ path: `${id2}.part${k}.png` });
      if (y + h >= total) break;
    }
    await p.evaluate((y) => { const o = document.querySelector('.overlay'); if (o) o.scrollTop = y; }, keep);
  };
  const step = async (id, fn) => {
    try { await fn(); await shot(id); } catch (e) { problems.push(`${v}/${id}: GAGAL ${String(e.message).split('\n')[0]}`); }
  };
  try {
    await p.goto(`http://localhost:${PORT}/`);
    await p.getByRole('button', { name: /Main sebagai tamu/ }).click();
    await step('studio', () => p.locator('.sub-themes').click());
    await step('spec', () => p.locator('.spec-head').click());
    await step('info', () => p.locator('.theme-tile').first().click());
    const tab = (label) => p.locator('.page > .seg button', { hasText: label }).click();
    await step('tiles', () => tab('Nama petak'));
    await step('look', () => tab('Tampilan'));
    await step('json', () => tab('JSON'));
    await step('cards', () => tab('Kartu & efek'));
    await step('cards-custom', async () => {
      await p.locator('.card-default-state-box .btn.primary').first().click();
    });
    await step('cards-advance', async () => {
      const opts = p.locator('.card-item-box').first().locator('.kind-grid button');
      const c = await opts.count();
      for (let i = 0; i < c; i++) if (/Maju|Pindah/i.test(await opts.nth(i).innerText())) { await opts.nth(i).click(); break; }
    });
    await step('cards-tilepicker', () => p.locator('.card-item-box').first().locator('.pk-btn').first().click());
    await p.keyboard.press('Escape');
    await p.mouse.click(5, 5);
    await step('fx', async () => {
      await p.locator('.card-subtab-pill').nth(2).click();
      await p.locator('.card-default-state-box .btn.primary').first().click().catch(() => {});
    });
    await step('fx-builtin', () => p.locator('.fx-settings .seg button').nth(1).click());
    await step('fx-emoji', () => p.locator('.fx-settings .seg button').nth(2).click());
    await step('fx-custom', () => p.locator('.fx-settings .seg button').nth(0).click());
    await step('fx-tilepicker', () => p.locator('.fx-row-head .pk-btn').first().click());
  } catch (e) {
    problems.push(`${v}: GAGAL ${String(e.message).split('\n')[0]}`);
  }
  await ctx.close();
}
await b.close();
srv.kill();
console.log(problems.length ? problems.join('\n') : 'tidak ada masalah');
console.log('tangkapan layar:', OUT);
