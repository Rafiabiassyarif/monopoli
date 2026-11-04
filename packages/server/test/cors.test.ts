// Aplikasi HP (Capacitor) memanggil API dari origin https://localhost → CORS harus mengizinkan, origin lain tidak.
import { afterAll, beforeAll, expect, it } from 'vitest';
import { spawn, type ChildProcess } from 'node:child_process';

const PORT = 3994;
let srv: ChildProcess;
beforeAll(async () => {
  srv = spawn(process.execPath, ['--import', 'tsx', 'src/index.ts'], { cwd: new URL('..', import.meta.url), env: { ...process.env, PORT: String(PORT), PERSIST: '0' } });
  await new Promise<void>((ok, bad) => {
    const t = setTimeout(() => bad(new Error('server tidak start')), 15000);
    srv.stdout!.on('data', (d) => String(d).includes(`:${PORT}`) && (clearTimeout(t), ok()));
  });
});
afterAll(() => srv?.kill());

it('preflight dari aplikasi HP diizinkan', async () => {
  const r = await fetch(`http://localhost:${PORT}/api/config`, { method: 'OPTIONS', headers: { origin: 'https://localhost', 'access-control-request-method': 'POST', 'access-control-request-headers': 'authorization' } });
  expect(r.status).toBe(204);
  expect(r.headers.get('access-control-allow-origin')).toBe('https://localhost');
  expect(r.headers.get('access-control-allow-headers')).toMatch(/authorization/);
  const g = await fetch(`http://localhost:${PORT}/api/config`, { headers: { origin: 'capacitor://localhost' } });
  expect(g.headers.get('access-control-allow-origin')).toBe('capacitor://localhost');
});

it('origin asing tidak diberi izin CORS', async () => {
  const r = await fetch(`http://localhost:${PORT}/api/config`, { headers: { origin: 'https://jahat.example' } });
  expect(r.headers.get('access-control-allow-origin')).toBeNull();
});
