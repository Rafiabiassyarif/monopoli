// Tempat game berjalan: browser biasa, atau aplikasi Android/iPhone (Capacitor) yang memuat file game
// dari dalam APK. Di aplikasi, alamat server online diambil dari VITE_SERVER_URL saat build
// (mis. https://monopoli.contoh.com); tanpa itu aplikasi jalan offline (main lokal lawan bot/teman).

/** true kalau berjalan di dalam aplikasi Android/iPhone (bukan browser). */
export const IS_APP = import.meta.env.VITE_APP === '1' || !!(globalThis as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor?.isNativePlatform?.();

/** Alamat server game. Kosong = server yang sama dengan halaman (web biasa). */
export const SERVER = String(import.meta.env.VITE_SERVER_URL ?? '').replace(/\/+$/, '');

/** URL lengkap untuk path server (/api/..., /avatars/...). */
export const serverUrl = (path: string) => (SERVER && path.startsWith('/') ? SERVER + path : path);

/** Alamat publik game untuk link undangan room (di aplikasi: alamat server, bukan https://localhost). */
export const publicUrl = () => (IS_APP && SERVER ? SERVER : `${location.origin}${location.pathname}`.replace(/\/+$/, ''));

/** Link unduh APK Android (bisa diganti lewat VITE_ANDROID_APK_URL). Default: rilis terbaru di GitHub. */
export const ANDROID_APK_URL = String(import.meta.env.VITE_ANDROID_APK_URL ?? '') || 'https://github.com/Rafiabiassyarif/monopoli/releases/latest/download/monopoli.apk';
