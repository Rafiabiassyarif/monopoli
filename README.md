# Monopoli 3D

Monopoli 3D di browser (React + Three.js). Main lokal (bot / teman 1 perangkat) atau online lewat room. Tema bisa diganti & dikustom lewat Studio Tema.

## Jalankan

    npm install
    npm run dev          # web http://localhost:5180 + server online :3020

Teman satu WiFi: buka http://<IP-PC>:5180. Internet: `npm run build && npm start` (server :3020 sajikan web + WebSocket /ws).

## Deploy

    docker build -t monopoli .
    docker run -p 3020:3020 -v monopoli-data:/app/packages/server/data monopoli

Pasang di belakang reverse proxy HTTPS (Caddy/Nginx/Cloudflare) supaya WebSocket jadi `wss://`. Variabel lingkungan:

| Variabel | Default | Fungsi |
|---|---|---|
| `PORT` | 3020 | port HTTP + WS |
| `DATA_FILE` | `packages/server/data/rooms.json` | snapshot room (game tidak hilang saat restart) |
| `PERSIST` | 1 | `0` = tanpa snapshot |
| `USERS_FILE` | `packages/server/data/users.json` | akun, teman & statistik (password di-hash scrypt) |
| `GOOGLE_CLIENT_ID` | – | aktifkan tombol "Masuk dengan Google" (lihat di bawah) |
| `SMTP_USER` / `SMTP_PASS` | – | akun pengirim email (verifikasi email & lupa password). Gmail: pakai *App Password* |
| `SMTP_HOST` / `SMTP_PORT` | `smtp.gmail.com` / `465` | server SMTP (465 = TLS, 587 = STARTTLS) |
| `SMTP_FROM` | `Monopoli 3D <SMTP_USER>` | nama & alamat pengirim |
| `APP_URL` | (alamat browser) | alamat game untuk link di email, mis. `https://monopoli.contoh.com` |
| `ADMIN_USERNAMES` | – | username admin (pisah koma) — bisa melihat & menutup laporan pemain |
| `ADMIN_EMAIL` | – | laporan pemain baru juga dikirim ke email ini |
| `CONTACT_EMAIL` | `ADMIN_EMAIL`/`SMTP_USER` | kontak di halaman Kebijakan Privasi & Ketentuan |
| `BACKUP_HOURS` / `BACKUP_KEEP` | 6 / 28 | cadangan otomatis `users.json` & `rooms.json` ke `data/backups/` (0 = mati) |
| `ERROR_LOG` | `packages/server/data/logs/error.log` | log galat server + galat dari browser pemain (dirotasi 5 MB) |
| `TRUST_PROXY` | – | isi `1` di belakang proxy supaya limit per-IP memakai `X-Forwarded-For` |
| `DISCONNECT_GRACE` | 15000 | ms sebelum pemain yang putus dimainkan otomatis (aksi aman) |
| `LOBBY_GRACE` | 30000 | ms sebelum kursi lobby yang putus dilepas |
| `RATE_LIMIT` | 120 | maks pesan per koneksi per 10 detik |
| `VITE_WS_URL` | – | (build web) alamat WS kalau server beda domain |

### Login Google

1. Buka Google Cloud Console → APIs & Services → Credentials → Create credentials → **OAuth client ID** → tipe **Web application**.
2. Di *Authorized JavaScript origins* isi alamat game, mis. `http://localhost:5180` (dev), `http://localhost:3020`, dan domain produksimu (`https://monopoli.contoh.com`).
3. Client ID (bukan rahasia) bisa ditaruh di `monopoli.config.json` → `{ "googleClientId": "..." }`, atau di file `.env` di akar proyek (contoh di `.env.example`): `GOOGLE_CLIENT_ID="xxxx.apps.googleusercontent.com"`, lalu jalankan ulang `npm run dev`. Server membaca `.env` otomatis; `.env` tidak ikut ter-commit. Client secret tidak dibutuhkan.

Tanpa `GOOGLE_CLIENT_ID`, login username + password dan mode tamu tetap jalan; tombol Google disembunyikan.

### Email (verifikasi & lupa password)

Isi `SMTP_USER` & `SMTP_PASS` di `.env` (Gmail: aktifkan 2-Step Verification lalu buat *App Password*). Tanpa SMTP, email tidak dikirim — isinya (termasuk link reset) dicetak di jendela server, berguna saat main di komputer sendiri.

### Data, cadangan & log

Semua data ada di `packages/server/data/`: `users.json` (akun, teman, chat pribadi, laporan), `rooms.json` (room berjalan), `backups/` (salinan berkala), `logs/error.log`. Untuk memulihkan: matikan server, salin file dari `backups/` ke `users.json`, nyalakan lagi. Halaman `/privacy` dan `/terms` disajikan server (tambahkan `?lang=en` untuk bahasa Inggris).

Build web juga PWA: bisa di-"Install" dan main lokal tetap jalan offline.

## Fitur

- Papan 3D, bidak melompat per petak, dadu, rumah/hotel, kota sekitar sesuai tema. Kamera: bebas / ikuti bidak / dari atas.
- Lokal: 2–6 pemain campur manusia & bot (3 level), pilih bidak & warna, auto-save + Lanjutkan, Main lagi.
- Online: room kode 5 huruf + link undangan, bot di server, timer per aksi (AFK/putus = aksi aman: tidak pernah membeli/menawar/menerima tukar), emote, chat, sambung ulang otomatis (refresh atau tab dibuka lagi), keluar di tengah game = kursi diambil bot, host pindah otomatis, Main lagi, room tersimpan saat server restart.
- Keamanan online: server-authoritative, seed dadu & urutan kartu tidak dikirim ke klien, limit pesan/koneksi/room per IP, validasi nama/warna/bidak.
- Aturan resmi: beli / lelang, sewa (set lengkap 2×), bangun & jual merata, stok bank 32 rumah / 12 hotel, gadai/tebus (+10%), 16+16 kartu (kartu bebas penjara dipegang di luar dek, bisa ditukar), penjara (bayar / kartu / double; gagal 3× bayar lalu jalan), utilitas via kartu = lempar ulang ×10, tukar (juga saat berutang, bunga 10% properti tergadai), bangkrut hanya bila aset tak cukup → ke pemain (+bunga 10%) atau ke bank (properti dilelang).
- Aturan rumah opsional: pot parkir bebas, gaji 2× di START. Mode durasi: sampai bangkrut atau 10/20/30 ronde (pemenang = kekayaan terbesar).
- Animasi khas tiap petak saat bidak mendarat (43 animasi 3D prosedural untuk semua petak di 6 tema): kuda Sandelwood di Kupang, cendrawasih di Jayapura, Pinisi di Makassar, Jembatan Ampera terangkat di Palembang, Pacu Jalur di Pekanbaru, kembang api di atas Monas, dst. Bisa diputar ulang dari kartu akta, bisa dimatikan di Pengaturan. Data pemetaan di `web/src/tileAnims.ts`, bentuk 3D di `web/src/scene/TileAnims.tsx`.
- Uang realistis per negara: 1 satuan = Rp1 juta / $1.000 / £1.000 / ¥100.000 / 100 ribu ₽ / 1.000 両, ditulis ringkas sesuai bahasanya (modal Rp1,5 M, Jakarta Rp400 jt, gaji START Rp200 jt; $400K; ¥4000万; 40 млн ₽). Atur di Studio Tema (nilai 1 satuan, ringkas, posisi simbol, locale).
- Akun & sosial: landing page, masuk/daftar (username + password atau Google), main sebagai tamu, email + verifikasi, lupa/ganti password, tautkan/lepas Google, hapus akun, cari & tambah teman, status online / sedang di room mana, undang teman ke room, chat pribadi dengan teman, profil dengan level/XP, pencapaian, statistik & riwayat, papan peringkat (XP / menang / persentase).
- Moderasi: blokir pemain, laporkan pemain (admin melihat & menutup laporan), filter kata kasar di chat, bisukan pemain di chat room.
- Penonton: tonton game online yang sedang berjalan (dari daftar room atau teman) tanpa ikut main.
- Aturan resmi tambahan: bangun/gadai/tukar di antara giliran, tawaran balik (counter-offer), lelang rumah/hotel saat stok bank kurang.
- Bahasa Indonesia & Inggris (pilih di landing page / Pengaturan), tips tutorial kontekstual, musik latar prosedural (tangga nada sesuai tema).
- HUD: banner giliran, +/− uang melayang, tooltip petak, akta, panel Asetku, statistik, riwayat, cara bermain, shortcut (Spasi/B/L/Esc), podium + statistik akhir.
- UI: satu design system (token warna/jarak/radius di `styles.css`), font Plus Jakarta Sans (di-bundle, jalan offline), ikon Lucide.

## Struktur

- `packages/engine` — aturan murni deterministik, bot, tema, protokol. Dipakai web & server.
- `packages/server` — WebSocket server-authoritative.
- `packages/web` — scene 3D (`scene/`), HUD (`Hud.tsx`), menu/lobby/studio (`App.tsx`), primitive UI (`ui.tsx`).

## Tema

Bawaan: Indonesia, Amerika, Rusia, Jepang, Inggris, Negeri Ninja (dunia ninja orisinal). Studio Tema: mulai dari tema bawaan → ubah identitas, nama petak, warna, gaya bangunan → Simpan. Ekspor/impor `.json`. Tema kustom ikut terkirim ke pemain di room online.
Tema anime/kartun: pakai nama parodi/fan-made, tanpa logo/gambar resmi bila dipublikasikan.

### Tema JSON dengan kartu & efek sendiri

Spesifikasi lengkap ada di **Studio tema → Spesifikasi tema JSON**. Impor lewat **Studio tema → Impor file tema (.json)**, atau edit di tab **Kartu & efek** / **JSON**. Batas file 100 KB; semua isi divalidasi di browser dan di server.

Field tambahan (semua opsional):

- `decks.chance` / `decks.community` — 1–30 kartu `{ "text": "...", "effect": {...} }`, mengganti kartu bawaan tumpukan itu. Di teks: `{m:100}` = uang (satuan engine, 1 = Rp1 jt), `{m:go}` = gaji START, `{t:39}` = nama petak.
- `cards` — ganti teks kartu bawaan saja (kunci `c1`..`c16`, `d1`..`d16`), efek tetap.
- `tileFx` — efek saat mendarat di petak, kunci nomor petak `"0"`..`"39"`: `{ "anim": "fireworks", "emoji": "🎆", "caption": "Pesta!" }`. `anim` opsional (tanpa `anim` = emoji saja).
  Animasi buatan sendiri: `"custom": { "motion": "confetti", "emojis": "🎉🎊", "count": 20, "size": 1, "speed": 1, "glow": "#fbbf24", "sound": "win" }` — `motion`: burst, rain, float, fountain, confetti, spin, orbit, bounce, zoom, wave · `count` 1–30 · `size` 0.5–2.5 · `speed` 0.5–2 · `sound`: none, buy, pay, win, jail, card.

| `effect.kind` | Isian | Arti |
|---|---|---|
| `money` | `amount` −1000..1000 | + terima dari bank, − bayar ke bank |
| `eachPlayer` | `amount` −500..500 | + terima dari tiap pemain, − bayar ke tiap pemain |
| `advance` | `to` 0..39 | maju ke petak (lewat START dapat gaji) |
| `nearest` | `target` `station`/`utility` | maju ke terdekat; kalau dimiliki: stasiun sewa 2x, utilitas 10x dadu |
| `back` | `steps` 1..12 | mundur |
| `jail` | — | masuk penjara |
| `jailFree` | — | kartu bebas penjara (disimpan) |
| `repairs` | `house` 0..500, `hotel` 0..1000 | bayar per rumah & hotel |

Id animasi `anim`: horse, bird, deer, volcano, dancer, ship, fish, oilpump, equator, boats, bridge, clock, boatrace, durian, doors, wayang, becak, fruit, sharkcroc, notes, monkeys, fireworks, train, plane, metro, lightning, water, coins, diamond, money, bars, siren, steam, rocket, snow, aurora, rain, desert, blossom, car, stars, bear, flag.

Main online: kartu & efek tema milik host dipakai semua pemain di room itu.

## Aplikasi Android & iPhone

**Android (APK siap pasang)** — dibuat otomatis oleh GitHub Actions (`.github/workflows/android.yml`) setiap push ke `main`, lalu terbit di **Releases** sebagai `monopoli.apk`. Tombol **Unduh APK Android** di halaman awal mengarah ke `https://github.com/Rafiabiassyarif/monopoli/releases/latest/download/monopoli.apk` (ganti lewat `VITE_ANDROID_APK_URL` saat build web).

Pengaturan sekali di GitHub → repo → **Settings → Secrets and variables → Actions**:

1. **Variables** → `SERVER_URL` = alamat server game setelah di-hosting (mis. `https://monopoli.contoh.com`). Kosong = APK hanya main lokal/offline (lawan bot & teman satu HP).
2. **Secrets** → `ANDROID_KEYSTORE_BASE64`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`, `ANDROID_KEY_PASSWORD` — isinya ada di `android-signing/RAHASIA-github-secrets.txt` (folder ini tidak ikut di-commit). Dengan kunci tetap, pemain bisa update aplikasi tanpa uninstall. Tanpa secrets, Actions membuat APK debug.
3. Jalankan ulang: tab **Actions → Android APK → Run workflow** (atau push apa saja ke `main`).

Di aplikasi: login pakai email + kode (login Google diblokir Google di dalam aplikasi WebView). Server mengizinkan panggilan dari aplikasi (CORS `https://localhost`, `capacitor://localhost`; tambah origin lain lewat `CORS_ORIGINS`).

Build APK di komputer sendiri (butuh Android Studio + JDK 21):

```bash
cd packages/mobile
npm install
VITE_APP=1 VITE_SERVER_URL=https://monopoli.contoh.com npm run web
npx cap add android && npm run assets && npx cap sync android
npx cap open android        # Build → Build APK(s)
```

**iPhone/iPad** — Apple tidak mengizinkan file aplikasi dipasang di luar App Store, jadi pemain memasang versi web: buka game di **Safari → Bagikan → Tambah ke Layar Utama** (layar penuh, ikon sendiri, main lokal tetap jalan offline). Aplikasi iOS asli butuh Mac + Xcode + akun Apple Developer ($99/tahun): `npx cap add ios && npx cap open ios` dari `packages/mobile`, lalu Archive & unggah ke App Store Connect.

## Test

    npm test          # aturan resmi + game bot penuh + server (akun, email, teman, chat, admin, penonton, main cepat)
    npm run typecheck
    npm run build && npm run e2e   # tes browser menyeluruh (butuh: npm i -D playwright && npx playwright install chromium)

`npm run e2e` menjalankan server uji sendiri (port 3099, data di memori) lalu mencoba: landing & bahasa, main lokal, latihan, login email + kode, profil, teman & chat pribadi, undangan, game online sampai selesai (statistik & peringkat), main cepat, penonton, penangguhan akun oleh admin, tampilan HP. Hasil & tangkapan layar gagal: folder sementara `monopoli-e2e`.

## Admin

Isi `ADMIN_USERNAMES` di `.env`. Admin melihat **Laporan pemain** di menu akun, dan di profil pemain lain ada panel **Admin** untuk menangguhkan akun (1/7/30 hari atau permanen, dengan alasan) atau mencabutnya. Pemain yang ditangguhkan langsung dikeluarkan dan melihat alasannya saat mencoba masuk.
