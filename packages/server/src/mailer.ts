// Pengirim email SMTP minimal (tanpa dependensi): TLS langsung (port 465) atau STARTTLS (port 587).
// Diatur lewat .env: SMTP_USER, SMTP_PASS, opsional SMTP_HOST (bawaan smtp.gmail.com), SMTP_PORT, SMTP_FROM.
// Tanpa SMTP_USER/SMTP_PASS: email tidak dikirim, isinya dicetak di jendela server (cukup untuk main lokal).

import { connect as tlsConnect, type TLSSocket } from 'node:tls';
import { connect as netConnect, type Socket } from 'node:net';
import { randomBytes } from 'node:crypto';

export interface Mail {
  to: string;
  subject: string;
  text: string;
  html: string;
}

export const mailEnabled = () => !!(process.env.SMTP_USER && process.env.SMTP_PASS);

function reader(sock: Socket | TLSSocket) {
  let buf = '';
  const waiters: Array<(line: string) => void> = [];
  const lines: string[] = [];
  const onData = (d: Buffer) => {
    buf += d.toString('utf8');
    let i: number;
    while ((i = buf.indexOf('\r\n')) >= 0) {
      lines.push(buf.slice(0, i));
      buf = buf.slice(i + 2);
    }
    // balasan lengkap = baris dengan "kode spasi" (bukan "kode-")
    while (lines.length) {
      const end = lines.findIndex((l) => /^\d{3} /.test(l) || /^\d{3}$/.test(l));
      if (end < 0) break;
      const reply = lines.splice(0, end + 1).join('\n');
      waiters.shift()?.(reply);
    }
  };
  sock.on('data', onData);
  return {
    next: () => new Promise<string>((ok, bad) => {
      const t = setTimeout(() => bad(new Error('SMTP timeout')), 15_000);
      waiters.push((r) => (clearTimeout(t), ok(r)));
    }),
    detach: () => sock.off('data', onData),
  };
}

async function talk(sock: Socket | TLSSocket, r: ReturnType<typeof reader>, cmd: string | null, expect: number) {
  if (cmd !== null) sock.write(cmd + '\r\n');
  const reply = await r.next();
  if (!reply.startsWith(String(expect))) throw new Error(`SMTP: ${cmd?.split(' ')[0] ?? 'salam'} → ${reply.split('\n').pop()}`);
  return reply;
}

const b64 = (s: string) => Buffer.from(s, 'utf8').toString('base64');
const encodeHeader = (s: string) => (/^[\x20-\x7e]*$/.test(s) ? s : `=?UTF-8?B?${b64(s)}?=`);

export async function sendMail(m: Mail): Promise<void> {
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  if (!user || !pass) {
    console.log(`\n[email tidak dikirim — SMTP belum diatur]\nKepada: ${m.to}\nJudul : ${m.subject}\n${m.text}\n`);
    return;
  }
  const host = process.env.SMTP_HOST || 'smtp.gmail.com';
  const port = Number(process.env.SMTP_PORT || 465);
  const from = process.env.SMTP_FROM || `Monopoli 3D <${user}>`;
  const fromAddr = /<([^>]+)>/.exec(from)?.[1] ?? from;

  let sock: Socket | TLSSocket =
    port === 465
      ? tlsConnect({ host, port, servername: host })
      : netConnect({ host, port });
  await new Promise<void>((ok, bad) => {
    sock.once(port === 465 ? 'secureConnect' : 'connect', () => ok());
    sock.once('error', bad);
  });
  let r = reader(sock);
  try {
    await talk(sock, r, null, 220);
    await talk(sock, r, `EHLO monopoli.local`, 250);
    if (port !== 465) {
      await talk(sock, r, 'STARTTLS', 220);
      r.detach();
      sock = tlsConnect({ socket: sock, servername: host });
      await new Promise<void>((ok, bad) => (sock.once('secureConnect', () => ok()), sock.once('error', bad)));
      r = reader(sock);
      await talk(sock, r, `EHLO monopoli.local`, 250);
    }
    await talk(sock, r, 'AUTH LOGIN', 334);
    await talk(sock, r, b64(user), 334);
    await talk(sock, r, b64(pass), 235);
    await talk(sock, r, `MAIL FROM:<${fromAddr}>`, 250);
    await talk(sock, r, `RCPT TO:<${m.to}>`, 250);
    await talk(sock, r, 'DATA', 354);
    const boundary = 'b' + randomBytes(8).toString('hex');
    const body = [
      `From: ${encodeHeader(from)}`,
      `To: <${m.to}>`,
      `Subject: ${encodeHeader(m.subject)}`,
      `Date: ${new Date().toUTCString()}`,
      `Message-ID: <${randomBytes(12).toString('hex')}@monopoli.local>`,
      'MIME-Version: 1.0',
      `Content-Type: multipart/alternative; boundary="${boundary}"`,
      '',
      `--${boundary}`,
      'Content-Type: text/plain; charset=UTF-8',
      'Content-Transfer-Encoding: base64',
      '',
      b64(m.text).replace(/.{76}/g, '$&\r\n'),
      `--${boundary}`,
      'Content-Type: text/html; charset=UTF-8',
      'Content-Transfer-Encoding: base64',
      '',
      b64(m.html).replace(/.{76}/g, '$&\r\n'),
      `--${boundary}--`,
      '',
    ].join('\r\n');
    sock.write(body + '\r\n.\r\n');
    await talk(sock, r, null, 250);
    sock.write('QUIT\r\n');
  } finally {
    setTimeout(() => sock.destroy(), 500);
  }
}

/** Email berisi kode masuk 6 angka. */
export function codeMail(to: string, code: string): Mail {
  return {
    to,
    subject: `Kode masuk Monopoli 3D: ${code}`,
    text: `Kode masuk Monopoli 3D kamu: ${code}\n\nBerlaku 10 menit. Abaikan email ini kalau kamu tidak sedang masuk.\n\n— Monopoli 3D`,
    html: `<div style="font-family:system-ui,sans-serif;max-width:480px;margin:auto;padding:24px;background:#0b0d14;color:#f4f4f6;border-radius:16px">
<h2 style="margin:0 0 12px;color:#fbbf24">Monopoli 3D</h2>
<p style="line-height:1.6">Kode masuk kamu:</p>
<p style="font-size:34px;font-weight:800;letter-spacing:8px;margin:16px 0;color:#fbbf24">${code}</p>
<p style="font-size:13px;color:#bfc3d1;line-height:1.5">Berlaku 10 menit. Abaikan email ini kalau kamu tidak sedang masuk ke Monopoli 3D.</p>
</div>`,
  };
}

/** Email bertema game (teks + HTML sederhana). */
export function gameMail(to: string, subject: string, intro: string, button: string, link: string, note: string): Mail {
  const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
  return {
    to,
    subject,
    text: `${intro}\n\n${button}: ${link}\n\n${note}\n\n— Monopoli 3D`,
    html: `<div style="font-family:system-ui,sans-serif;max-width:480px;margin:auto;padding:24px;background:#0b0d14;color:#f4f4f6;border-radius:16px">
<h2 style="margin:0 0 12px;color:#fbbf24">Monopoli 3D</h2>
<p style="line-height:1.6">${esc(intro)}</p>
<p style="margin:24px 0"><a href="${esc(link)}" style="background:#fbbf24;color:#1c1203;padding:12px 20px;border-radius:999px;text-decoration:none;font-weight:700">${esc(button)}</a></p>
<p style="font-size:13px;color:#bfc3d1;line-height:1.5">${esc(note)}</p>
<p style="font-size:12px;color:#8d92a3;word-break:break-all">Kalau tombol tidak bisa diklik, salin link ini: ${esc(link)}</p>
</div>`,
  };
}
