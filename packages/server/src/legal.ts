// Halaman Kebijakan Privasi & Ketentuan Layanan (statis, dua bahasa). /privacy dan /terms; ?lang=en untuk Inggris.

const CONTACT = () => process.env.CONTACT_EMAIL || process.env.ADMIN_EMAIL || process.env.SMTP_USER || '';
const UPDATED = '29 Oktober 2026';
const UPDATED_EN = 'October 29, 2026';

type Lang = 'id' | 'en';
interface Doc {
  title: string;
  intro: string;
  sections: [string, string[]][];
}

const privacy: Record<Lang, Doc> = {
  id: {
    title: 'Kebijakan Privasi',
    intro: 'Kebijakan ini menjelaskan data apa yang dikumpulkan Monopoli 3D, untuk apa, dan bagaimana kamu bisa mengendalikannya. Kamu bisa bermain sebagai tamu tanpa memberikan data pribadi apa pun.',
    sections: [
      ['Data yang kami simpan', [
        'Akun: username, nama tampilan, warna & bidak pilihan, dan password yang disimpan dalam bentuk hash (scrypt) — password aslinya tidak pernah disimpan.',
        'Email (opsional): hanya kalau kamu menambahkannya, dipakai untuk verifikasi dan atur ulang password.',
        'Login Google (opsional): ID akun Google, nama, dan email dari Google. Kami tidak menerima password Google-mu.',
        'Aktivitas game: statistik (jumlah main, menang, properti dibeli, sewa diterima), riwayat 20 game terakhir, daftar teman, daftar blokir, dan pesan pribadi dengan teman.',
        'Laporan yang kamu kirim tentang pemain lain, dan log galat teknis (tanpa password).',
      ]],
      ['Untuk apa data dipakai', [
        'Menjalankan akun, pertemanan, undangan, chat, peringkat, dan statistik.',
        'Menjaga keamanan: membatasi percobaan login, menangani laporan, dan memperbaiki galat.',
        'Kami tidak menjual data, tidak menampilkan iklan, dan tidak memakai pelacak pihak ketiga.',
      ]],
      ['Penyimpanan di browser', [
        'Token sesi, pengaturan (suara, bahasa, kamera), dan simpanan game lokal disimpan di localStorage browsermu. Tidak ada cookie iklan.',
      ]],
      ['Siapa yang bisa melihat', [
        'Username, nama tampilan, level, statistik, dan riwayat game terlihat di profilmu oleh pengguna lain.',
        'Status online dan room yang sedang kamu mainkan hanya terlihat oleh teman.',
        'Email, daftar blokir, dan pesan pribadi tidak ditampilkan ke orang lain. Admin dapat membaca laporan yang dikirim.',
      ]],
      ['Hak kamu', [
        'Ubah nama tampilan, email, dan password kapan saja dari menu Akun.',
        'Hapus akun secara permanen dari menu Akun → Hapus akun. Data akun, teman, dan pesan pribadimu dihapus seketika; cadangan server otomatis terhapus dalam beberapa hari.',
      ]],
      ['Penyimpanan & keamanan', [
        'Data disimpan di server yang menjalankan game ini, dicadangkan berkala, dan dikirim lewat HTTPS bila server memakainya.',
        'Anak di bawah 13 tahun sebaiknya bermain sebagai tamu atau dengan izin orang tua.',
      ]],
    ],
  },
  en: {
    title: 'Privacy Policy',
    intro: 'This policy explains what data Monopoli 3D collects, why, and how you can control it. You can play as a guest without giving any personal data.',
    sections: [
      ['Data we store', [
        'Account: username, display name, chosen color & token, and your password stored as a hash (scrypt) — the password itself is never stored.',
        'Email (optional): only if you add one, used for verification and password reset.',
        'Google sign-in (optional): your Google account ID, name and email from Google. We never receive your Google password.',
        'Game activity: stats (games, wins, properties bought, rent collected), your last 20 games, friends, block list, and private messages with friends.',
        'Reports you send about other players, and technical error logs (no passwords).',
      ]],
      ['How data is used', [
        'To run accounts, friends, invites, chat, leaderboards and stats.',
        'To keep things safe: rate-limiting logins, handling reports, and fixing errors.',
        'We do not sell data, show ads, or use third-party trackers.',
      ]],
      ['Browser storage', [
        'Your session token, settings (sound, language, camera) and local saved games live in your browser\'s localStorage. There are no advertising cookies.',
      ]],
      ['Who can see what', [
        'Your username, display name, level, stats and game history are visible on your profile.',
        'Online status and the room you are playing in are visible to friends only.',
        'Email, block list and private messages are never shown to others. Admins can read reports that are sent.',
      ]],
      ['Your rights', [
        'Change your display name, email and password at any time from the Account menu.',
        'Delete your account permanently from Account → Delete account. Your account, friends and private messages are removed immediately; automatic server backups roll off within a few days.',
      ]],
      ['Storage & security', [
        'Data is stored on the server running this game, backed up regularly, and sent over HTTPS when the server uses it.',
        'Children under 13 should play as guests or with a parent\'s permission.',
      ]],
    ],
  },
};

const terms: Record<Lang, Doc> = {
  id: {
    title: 'Ketentuan Layanan',
    intro: 'Dengan memakai Monopoli 3D kamu setuju dengan ketentuan berikut.',
    sections: [
      ['Permainan', [
        'Monopoli 3D adalah game papan gratis untuk hiburan. Semua uang di dalam game adalah uang mainan dan tidak bisa ditukar dengan uang atau barang sungguhan.',
        'Monopoli 3D adalah proyek penggemar yang tidak berafiliasi dengan, disponsori, atau disetujui oleh Hasbro. MONOPOLY adalah merek dagang Hasbro.',
      ]],
      ['Akun', [
        'Kamu bertanggung jawab menjaga kerahasiaan password dan perangkatmu.',
        'Satu orang boleh memiliki lebih dari satu akun, tetapi tidak untuk memanipulasi peringkat atau mengganggu pemain lain.',
      ]],
      ['Perilaku', [
        'Dilarang: kata-kata kasar, pelecehan, ujaran kebencian, spam, menyamar sebagai orang lain, curang, atau sengaja merusak permainan.',
        'Kata-kata kasar di chat disensor otomatis. Kamu bisa memblokir, membisukan, atau melaporkan pemain lain.',
        'Kami dapat menghapus konten, mereset statistik, atau menangguhkan akun yang melanggar ketentuan ini.',
      ]],
      ['Layanan', [
        'Layanan disediakan "apa adanya". Kami berusaha menjaga data tetap aman dan dicadangkan, tetapi tidak menjamin layanan selalu tersedia atau bebas galat.',
        'Ketentuan ini bisa diperbarui; tanggal pembaruan tertera di atas.',
      ]],
    ],
  },
  en: {
    title: 'Terms of Service',
    intro: 'By using Monopoli 3D you agree to the following terms.',
    sections: [
      ['The game', [
        'Monopoli 3D is a free board game for entertainment. All in-game money is play money and cannot be exchanged for real money or goods.',
        'Monopoli 3D is a fan project and is not affiliated with, sponsored or endorsed by Hasbro. MONOPOLY is a trademark of Hasbro.',
      ]],
      ['Accounts', [
        'You are responsible for keeping your password and device secure.',
        'You may own more than one account, but not to manipulate leaderboards or harass other players.',
      ]],
      ['Conduct', [
        'Not allowed: abusive language, harassment, hate speech, spam, impersonation, cheating, or deliberately ruining games.',
        'Profanity in chat is filtered automatically. You can block, mute or report other players.',
        'We may remove content, reset stats, or suspend accounts that break these terms.',
      ]],
      ['The service', [
        'The service is provided "as is". We try to keep data safe and backed up, but do not guarantee it is always available or error-free.',
        'These terms may be updated; the date of the latest update is shown above.',
      ]],
    ],
  },
};

const esc = (t: string) => t.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

function render(doc: Doc, lang: Lang, path: string) {
  const other = lang === 'id' ? 'en' : 'id';
  const contact = CONTACT();
  const back = lang === 'id' ? '← Kembali ke game' : '← Back to the game';
  const upd = lang === 'id' ? `Terakhir diperbarui: ${UPDATED}` : `Last updated: ${UPDATED_EN}`;
  const ask = lang === 'id' ? 'Pertanyaan atau permintaan data:' : 'Questions or data requests:';
  const links = lang === 'id' ? ['Kebijakan Privasi', 'Ketentuan Layanan'] : ['Privacy Policy', 'Terms of Service'];
  return `<!doctype html><html lang="${lang}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(doc.title)} — Monopoli 3D</title>
<style>
:root{color-scheme:dark;--bg:#0b1020;--card:#121a33;--fg:#e8ecf8;--mute:#9aa6c7;--acc:#facc15}
body{margin:0;background:var(--bg);color:var(--fg);font:16px/1.65 system-ui,-apple-system,Segoe UI,Roboto,sans-serif}
main{max-width:760px;margin:0 auto;padding:32px 18px 64px}
a{color:var(--acc)}nav{display:flex;gap:14px;flex-wrap:wrap;font-size:14px;margin-bottom:28px}
h1{font-size:30px;margin:0 0 6px}h2{font-size:19px;margin:28px 0 8px}.mute{color:var(--mute);font-size:14px}
section{background:var(--card);border-radius:14px;padding:4px 20px 12px;margin-top:14px}li{margin:6px 0}
</style></head><body><main>
<nav><a href="/">${back}</a><a href="/privacy?lang=${lang}">${links[0]}</a><a href="/terms?lang=${lang}">${links[1]}</a><a href="${path}?lang=${other}">${other === 'en' ? 'English' : 'Bahasa Indonesia'}</a></nav>
<h1>${esc(doc.title)}</h1><div class="mute">${upd}</div><p>${esc(doc.intro)}</p>
${doc.sections.map(([h, items]) => `<section><h2>${esc(h)}</h2><ul>${items.map((i) => `<li>${esc(i)}</li>`).join('')}</ul></section>`).join('\n')}
${contact ? `<p class="mute">${ask} <a href="mailto:${esc(contact)}">${esc(contact)}</a></p>` : ''}
</main></body></html>`;
}

/** HTML halaman legal untuk path ini, atau null kalau bukan halaman legal. */
export function legalPage(path: string, lang: string | null): string | null {
  const p = path.replace(/\/+$/, '');
  const l: Lang = lang === 'en' ? 'en' : 'id';
  if (p === '/privacy' || p === '/privasi') return render(privacy[l], l, '/privacy');
  if (p === '/terms' || p === '/ketentuan') return render(terms[l], l, '/terms');
  return null;
}
