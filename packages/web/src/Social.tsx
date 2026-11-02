// Halaman & dialog akun: landing page, masuk/daftar (password + Google), lupa password, akun & keamanan,
// chip pengguna, teman, chat pribadi, profil (level & pencapaian), blokir/laporan, peringkat, laporan admin.

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  ArrowLeft,
  Ban,
  Bot,
  Building2,
  Camera,
  Check,
  Coins,
  Crown,
  Eye,
  Flag as FlagIcon,
  Gamepad2,
  KeyRound,
  Languages,
  LogIn,
  LogOut,
  Mail,
  Medal,
  MessageCircle,
  Palette,
  ScrollText,
  Search,
  Send,
  ShieldAlert,
  ShieldCheck,
  Trash,
  Upload,
  Trophy,
  User,
  UserMinus,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import {
  AVATAR_ICONS,
  EMAIL_RE,
  REPORT_REASONS,
  achievementsOf,
  formatMoney,
  levelOf,
  xpOf,
  type FriendInfo,
  type Profile,
  type Report,
  type Theme,
  type UserPublic,
} from '@monopoli/engine';
import { OFFLINE, adminBan, adminUnban, closeReport, fetchLeaderboard, fetchProfile, fetchReports, loadGoogle, searchUsers, sendReport, type Auth, type Invite, type LeaderRow, type Social } from './auth';
import { dateLocale, getLang, setLang, t, tj, tr, useLang, type Lang } from './i18n';
import { COLORS, Field, Flag, Modal, Seg, TOKEN_ICONS, TokenBadge, askConfirm } from './ui';

const errMsg = (e: unknown) => tr(e instanceof Error ? e.message : String(e));

// ======================= avatar =======================

export function Avatar({ user, size = 32 }: { user: Pick<UserPublic, 'avatar' | 'token' | 'color' | 'displayName'>; size?: number }) {
  const [broken, setBroken] = useState(false);
  useEffect(() => setBroken(false), [user.avatar]);
  const icon = user.avatar?.startsWith('icon:') ? AVATAR_ICONS[user.avatar.slice(5)] : undefined;
  if (icon)
    return (
      <span className="avatar avatar-icon" style={{ width: size, height: size, fontSize: size * 0.56, ['--c' as string]: user.color }} aria-hidden>
        {icon}
      </span>
    );
  if (user.avatar && !broken)
    return <img className="avatar" src={user.avatar} width={size} height={size} alt="" referrerPolicy="no-referrer" onError={() => setBroken(true)} />;
  return <TokenBadge token={user.token} color={user.color} size={size} />;
}

/** Perkecil & potong persegi foto di browser (maks 256px) supaya unggahan kecil & cepat. */
async function shrinkImage(file: File): Promise<string> {
  if (file.size > 15 * 1024 * 1024) throw new Error(t('File terlalu besar (maks 15 MB)'));
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((ok, bad) => {
      const i = new Image();
      i.onload = () => ok(i);
      i.onerror = () => bad(new Error(t('File bukan gambar yang valid')));
      i.src = url;
    });
    const side = Math.min(img.naturalWidth, img.naturalHeight);
    const out = Math.min(256, side);
    const c = document.createElement('canvas');
    c.width = c.height = out;
    c.getContext('2d')!.drawImage(img, (img.naturalWidth - side) / 2, (img.naturalHeight - side) / 2, side, side, 0, 0, out, out);
    let data = c.toDataURL('image/webp', 0.86);
    if (!data.startsWith('data:image/webp')) data = c.toDataURL('image/jpeg', 0.86);
    return data;
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Pilihan bahasa (dipakai di landing page & pengaturan). */
export function LangSwitch() {
  const lang = useLang();
  return (
    <Seg<Lang>
      value={lang}
      onChange={setLang}
      options={[
        { v: 'id', label: 'Indonesia' },
        { v: 'en', label: 'English' },
      ]}
    />
  );
}

/** Tautan Kebijakan Privasi & Ketentuan (halaman statis dari server). */
export function LegalLinks() {
  useLang();
  if (OFFLINE) return null;
  const q = getLang() === 'en' ? '?lang=en' : '';
  return (
    <span className="legal-links">
      <a href={`/privacy${q}`} target="_blank" rel="noreferrer">
        {t('Kebijakan Privasi')}
      </a>
      <a href={`/terms${q}`} target="_blank" rel="noreferrer">
        {t('Ketentuan Layanan')}
      </a>
    </span>
  );
}

// ======================= landing page =======================

export function Landing({ theme, auth, invitedCode, onLogin, onGuest }: { theme: Theme; auth: Auth; invitedCode: string | null; onLogin: () => void; onGuest: () => void }) {
  useLang();
  const features: { icon: ReactNode; title: string; text: string }[] = [
    { icon: <Building2 size={22} />, title: t('Papan 3D yang hidup'), text: t('Dadu berfisika, bidak melompat per petak, rumah & hotel 3D, dan animasi khas tiap kota — kuda Sandelwood di Kupang, Pinisi di Makassar, kembang api di atas Monas.') },
    { icon: <ScrollText size={22} />, title: t('Aturan Monopoli resmi'), text: t('Lelang, gadai & tebus, bangun merata, stok 32 rumah / 12 hotel, penjara, kartu, bangkrut. Atur modal, gaji START, dan aturan rumah sesukamu.') },
    { icon: <Users size={22} />, title: t('Main bareng teman'), text: t('Buat room publik atau privat, undang teman, chat pribadi, tonton game teman, dan lihat siapa yang sedang online.') },
    { icon: <Bot size={22} />, title: t('Lawan bot pintar'), text: t('Tiga level bot dengan gaya main berbeda — agresif, hemat, seimbang. Bisa main sendiri kapan saja, bahkan offline.') },
    { icon: <Medal size={22} />, title: t('Level, pencapaian & peringkat'), text: t('Kumpulkan XP dari tiap game online, buka pencapaian, dan bersaing di papan peringkat.') },
    { icon: <Palette size={22} />, title: t('6 tema + studio tema'), text: t('Indonesia, Amerika, Rusia, Jepang, Inggris, Negeri Ninja. Atau buat tema sendiri: nama kota, warna, mata uang.') },
  ];
  return (
    <div className="landing">
      <div className="landing-lang">
        <Languages size={16} aria-hidden />
        <LangSwitch />
      </div>
      <section className="hero">
        <span className="eyebrow">{t('Permainan papan 3D · gratis di browser')}</span>
        <h1 className="logo">MONOPOLI</h1>
        <p className="hero-sub">{t('Beli kota-kota favoritmu, bangun hotel, tagih sewa, dan jadi yang terkaya. Main sendiri melawan bot, bergantian di satu perangkat, atau online bersama teman.')}</p>
        {invitedCode && <div className="notice">{tj('Kamu diundang ke room {code}. Masuk atau main sebagai tamu untuk bergabung.', { code: <b>{invitedCode}</b> })}</div>}
        <div className="hero-cta">
          {OFFLINE ? (
            <button className="btn primary lg" onClick={onGuest}>
              <Gamepad2 size={18} /> {t('Mulai main')}
            </button>
          ) : (
            <>
              <button className="btn primary lg" onClick={onLogin}>
                <Mail size={18} /> {t('Masuk dengan email')}
              </button>
              <button className="btn lg" onClick={onGuest}>
                <Gamepad2 size={18} /> {t('Main sebagai tamu')}
              </button>
            </>
          )}
        </div>
        {auth.config.googleClientId && <GoogleButton clientId={auth.config.googleClientId} onCredential={(c) => auth.google(c)} />}
        <div className="muted small">
          {OFFLINE
            ? t('Versi demo: main lokal lawan bot atau teman di satu perangkat. Main online, akun & teman tersedia saat game dijalankan dengan servernya.')
            : t('Tamu tetap bisa main lokal & online. Akun dibutuhkan untuk teman, undangan, chat pribadi, dan statistik.')}
        </div>
      </section>

      <section className="features">
        {features.map((f) => (
          <div key={f.title} className="feature panel">
            <span className="feature-icon">{f.icon}</span>
            <b>{f.title}</b>
            <p>{f.text}</p>
          </div>
        ))}
      </section>

      <section className="steps panel">
        <h2>{t('Mulai dalam 3 langkah')}</h2>
        <div className="steps-grid">
          <div className="step-card">
            <span className="step-num">1</span>
            <div className="step-text">{tj('{b} Cukup ketik email lalu masukkan kode yang dikirim — tanpa daftar, tanpa password. Atau pakai akun Google.', { b: <b>{t('Masuk atau jadi tamu.')}</b> })}</div>
          </div>
          <div className="step-card">
            <span className="step-num">2</span>
            <div className="step-text">{tj('{b} Pilih room terbuka, masukkan kode dari teman, atau terima undangan.', { b: <b>{t('Buat room atau gabung.')}</b> })}</div>
          </div>
          <div className="step-card">
            <span className="step-num">3</span>
            <div className="step-text">{tj('{b} Pilih tema, modal awal, dan aturan — lalu lempar dadu!', { b: <b>{t('Atur & mainkan.')}</b> })}</div>
          </div>
        </div>
      </section>

      <footer className="landing-foot muted small">
        <span>
          <Flag theme={theme} size={12} /> {t('Edisi {name}', { name: t(theme.name) })} · {t('Monopoli adalah merek dagang Hasbro; proyek ini tiruan penggemar untuk bermain bersama.')}
        </span>
        <LegalLinks />
      </footer>
    </div>
  );
}

// ======================= masuk / daftar =======================

/** Tombol resmi "Sign in with Google". onCredential menerima token ID dari Google. */
export function GoogleButton({ clientId, onCredential, onDone, text = 'continue_with' }: { clientId: string; onCredential: (credential: string) => Promise<unknown>; onDone?: () => void; text?: 'continue_with' | 'signin_with' }) {
  const ref = useRef<HTMLDivElement>(null);
  const [err, setErr] = useState<string | null>(null);
  const cb = useRef({ onCredential, onDone });
  cb.current = { onCredential, onDone };
  const lang = useLang();
  useEffect(() => {
    let alive = true;
    loadGoogle().then(
      (g) => {
        if (!alive || !ref.current) return;
        g.accounts.id.initialize({
          client_id: clientId,
          callback: (r: { credential: string }) =>
            cb.current.onCredential(r.credential).then(
              () => cb.current.onDone?.(),
              (e: unknown) => setErr(errMsg(e)),
            ),
        });
        ref.current.innerHTML = '';
        g.accounts.id.renderButton(ref.current, { theme: 'filled_black', size: 'large', shape: 'pill', text, locale: lang, width: 280 });
      },
      (e: unknown) => alive && setErr(errMsg(e)),
    );
    return () => {
      alive = false;
    };
  }, [clientId, lang, text]);
  return (
    <div className="google-btn">
      <div ref={ref} />
      {err && <div className="muted small">{err}</div>}
    </div>
  );
}

function ErrorNote({ err }: { err: string | null }) {
  return err ? (
    <div className="notice danger" role="alert">
      {err}
    </div>
  ) : null;
}

/** Masuk dengan email: ketik email → kode 6 angka dikirim → masukkan kode. Email baru otomatis jadi akun baru. */
export function AuthDialog({ auth, reason, onClose, onDone }: { auth: Auth; reason?: string; onClose: () => void; onDone: (created: boolean) => void }) {
  useLang();
  const [email, setEmail] = useState('');
  const [step, setStep] = useState<'email' | 'code' | 'legacy'>('email');
  const [uname, setUname] = useState('');
  const [pass, setPass] = useState('');
  const [code, setCode] = useState('');
  const [info, setInfo] = useState<{ mailEnabled: boolean; exists: boolean } | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [wait, setWait] = useState(0);
  const mail = email.trim().toLowerCase();
  useEffect(() => {
    if (wait <= 0) return;
    const tm = setTimeout(() => setWait((w) => w - 1), 1000);
    return () => clearTimeout(tm);
  }, [wait]);

  const send = async () => {
    if (!EMAIL_RE.test(mail)) return setErr(t('Format email tidak valid'));
    setBusy(true);
    setErr(null);
    try {
      setInfo(await auth.emailStart(mail));
      setStep('code');
      setCode('');
      setWait(30);
    } catch (e) {
      setErr(errMsg(e));
    } finally {
      setBusy(false);
    }
  };
  const verify = async (c = code) => {
    if (c.length !== 6) return setErr(t('Masukkan 6 angka kode dari email'));
    setBusy(true);
    setErr(null);
    try {
      const r = await auth.emailVerify(mail, c);
      onDone(!!r.created);
    } catch (e) {
      setErr(errMsg(e));
      setBusy(false);
    }
  };

  const legacy = async () => {
    if (!uname.trim() || !pass) return setErr(t('Isi username & password'));
    setBusy(true);
    setErr(null);
    try {
      await auth.login(uname.trim().toLowerCase(), pass);
      onDone(false);
    } catch (e) {
      setErr(errMsg(e));
      setBusy(false);
    }
  };

  return (
    <Modal title={step === 'legacy' ? t('Masuk akun lama') : t('Masuk dengan email')} icon={step === 'legacy' ? <KeyRound size={20} /> : <Mail size={20} />} onClose={onClose}>
      <form
        className="form auth-form"
        onSubmit={(e) => {
          e.preventDefault();
          void (step === 'email' ? send() : step === 'code' ? verify() : legacy());
        }}
      >
        {reason && <div className="notice">{tr(reason)}</div>}
        {step === 'legacy' ? (
          <>
            <p className="muted small">{t('Untuk akun yang dibuat sebelum ada login email. Setelah masuk, tambahkan email di Akun & keamanan supaya berikutnya bisa masuk dengan kode.')}</p>
            <Field label={t('Username')}>
              <input className="input" autoComplete="username" value={uname} maxLength={16} onChange={(e) => setUname(e.target.value)} autoFocus />
            </Field>
            <Field label={t('Password')}>
              <input className="input" type="password" autoComplete="current-password" value={pass} maxLength={200} onChange={(e) => setPass(e.target.value)} />
            </Field>
          </>
        ) : step === 'email' ? (
          <>
            <p className="muted small">{t('Tidak perlu daftar atau password. Kami kirim kode masuk ke emailmu — email baru otomatis dibuatkan akun.')}</p>
            <Field label={t('Email')}>
              <input className="input" type="email" autoComplete="email" inputMode="email" value={email} maxLength={200} onChange={(e) => setEmail(e.target.value)} placeholder="nama@email.com" autoFocus />
            </Field>
          </>
        ) : (
          <>
            <p className="small">
              {tj('Kode 6 angka sudah dikirim ke {email}. Cek kotak masuk & folder spam.', { email: <b>{mail}</b> })}
              {info && !info.exists && <span className="muted"> {t('Email ini belum punya akun — akun baru dibuat setelah kode benar.')}</span>}
            </p>
            {info && !info.mailEnabled && <div className="notice">{t('Server belum bisa mengirim email (SMTP belum diatur). Kodenya tercetak di jendela server.')}</div>}
            <Field label={t('Kode masuk')}>
              <input
                className="input code-input otp-input"
                inputMode="numeric"
                autoComplete="one-time-code"
                value={code}
                maxLength={6}
                onChange={(e) => {
                  const v = e.target.value.replace(/\D/g, '').slice(0, 6);
                  setCode(v);
                  if (v.length === 6 && !busy) void verify(v);
                }}
                placeholder="••••••"
                autoFocus
              />
            </Field>
          </>
        )}
        <ErrorNote err={err} />
        <button className="btn primary lg block" type="submit" disabled={busy}>
          {busy ? t('Memproses…') : step === 'email' ? t('Kirim kode') : t('Masuk')}
        </button>
        {step === 'legacy' && (
          <button type="button" className="link-btn small" onClick={() => (setStep('email'), setErr(null))}>
            <ArrowLeft size={14} /> {t('Masuk dengan email')}
          </button>
        )}
        {step === 'code' && (
          <div className="row between">
            <button type="button" className="link-btn small" onClick={() => (setStep('email'), setErr(null))}>
              <ArrowLeft size={14} /> {t('Ganti email')}
            </button>
            <button type="button" className="link-btn small" disabled={wait > 0 || busy} onClick={() => void send()}>
              {wait > 0 ? t('Kirim ulang ({n} dtk)', { n: wait }) : t('Kirim ulang kode')}
            </button>
          </div>
        )}
        {step === 'email' && auth.config.googleClientId && (
          <>
            <div className="or">{t('atau')}</div>
            <GoogleButton clientId={auth.config.googleClientId} onCredential={(c) => auth.google(c)} onDone={() => onDone(false)} />
          </>
        )}
        {step === 'email' && (
          <button type="button" className="link-btn small" onClick={() => (setStep('legacy'), setErr(null))}>
            {t('Punya akun lama dengan password?')}
          </button>
        )}
        <p className="muted small center">
          {t('Dengan masuk, kamu setuju dengan Ketentuan Layanan & Kebijakan Privasi.')} <LegalLinks />
        </p>
      </form>
    </Modal>
  );
}

// ======================= akun & keamanan =======================

export function AccountDialog({ auth, onClose, onNotice }: { auth: Auth; onClose: () => void; onNotice: (m: string) => void }) {
  useLang();
  const a = auth.account;
  const u = auth.user;
  const [email, setEmail] = useState(a?.email ?? '');
  const [cur, setCur] = useState('');
  const [pw, setPw] = useState('');
  const [delName, setDelName] = useState('');
  const [delPw, setDelPw] = useState('');
  const [err, setErr] = useState<{ part: string; msg: string } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  useEffect(() => setEmail(a?.email ?? ''), [a?.email]);
  if (!u || !a)
    return (
      <Modal title={t('Akun & keamanan')} icon={<ShieldCheck size={20} />} onClose={onClose}>
        <div className="muted">{t('Memuat…')}</div>
      </Modal>
    );
  const run = async (part: string, f: () => Promise<unknown>, ok?: string) => {
    setBusy(part);
    setErr(null);
    try {
      await f();
      if (ok) onNotice(ok);
    } catch (e) {
      setErr({ part, msg: errMsg(e) });
    } finally {
      setBusy(null);
    }
  };
  const errFor = (part: string) => (err?.part === part ? <ErrorNote err={err.msg} /> : null);
  const mail = email.trim().toLowerCase();

  return (
    <Modal title={t('Akun & keamanan')} icon={<ShieldCheck size={20} />} onClose={onClose} wide>
      <div className="account">
        <section className="form">
          <span className="eyebrow">{t('Email')}</span>
          {a.email ? (
            <div className="row wrap">
              <Mail size={16} />
              <b>{a.email}</b>
              {a.emailVerified ? <span className="chip ok">{t('Terverifikasi')}</span> : <span className="chip warn">{t('Belum dikonfirmasi')}</span>}
            </div>
          ) : (
            <div className="muted small">{t('Belum ada email. Tambahkan supaya bisa atur ulang password kalau lupa.')}</div>
          )}
          <div className="row">
            <input className="input grow" type="email" value={email} maxLength={200} onChange={(e) => setEmail(e.target.value)} placeholder="arif@email.com" aria-label={t('Email')} />
            <button
              className="btn"
              disabled={!EMAIL_RE.test(mail) || busy === 'email' || (mail === a.email && a.emailVerified)}
              onClick={() =>
                run(
                  'email',
                  () => auth.setEmail(mail),
                  a.mailEnabled ? t('Link konfirmasi dikirim ke {email}', { email: mail }) : t('Email disimpan. Server belum bisa mengirim email, link konfirmasi dicetak di jendela server.'),
                )
              }
            >
              {mail === a.email && !a.emailVerified ? t('Kirim ulang konfirmasi') : a.email ? t('Ganti email') : t('Tambah email')}
            </button>
          </div>
          {errFor('email')}
        </section>

        {auth.config.googleClientId && (
          <section className="form">
            <span className="eyebrow">{t('Akun Google')}</span>
            {a.googleLinked ? (
              <div className="row wrap">
                <span className="chip ok">{t('Tertaut')}</span>
                <span className="muted small grow">{t('Kamu bisa masuk dengan tombol Google.')}</span>
                <button
                  className="btn sm"
                  disabled={!(a.hasPassword || (a.email && a.emailVerified)) || busy === 'google'}
                  title={a.hasPassword || (a.email && a.emailVerified) ? undefined : t('Tambahkan & konfirmasi email dulu sebelum melepas Google')}
                  onClick={() => run('google', () => auth.unlinkGoogle(), t('Akun Google dilepas'))}
                >
                  {t('Lepas tautan')}
                </button>
              </div>
            ) : (
              <>
                <div className="muted small">{t('Tautkan akun Google supaya bisa masuk dengan satu klik.')}</div>
                <GoogleButton clientId={auth.config.googleClientId} text="signin_with" onCredential={(c) => run('google', () => auth.linkGoogle(c), t('Akun Google tertaut'))} />
              </>
            )}
            {errFor('google')}
          </section>
        )}

        <section className="form">
          <span className="eyebrow">{t('Pemain yang diblokir')}</span>
          {a.blocked.length === 0 && <div className="muted small">{t('Tidak ada. Blokir pemain dari profilnya: ia tidak bisa mengirim permintaan teman, pesan, atau undangan.')}</div>}
          <div className="people-list">
            {a.blocked.map((b) => (
              <div key={b.username} className="person-row">
                <span className="person-main">
                  <Avatar user={b} size={28} />
                  <span className="grow">
                    <b className="truncate">{b.displayName}</b>
                    <span className="muted small">@{b.username}</span>
                  </span>
                </span>
                <button className="btn sm ghost" onClick={() => run('block', () => auth.unblock(b.username))}>
                  {t('Buka blokir')}
                </button>
              </div>
            ))}
          </div>
          {errFor('block')}
        </section>

        <section className="form danger-zone">
          <span className="eyebrow">{t('Hapus akun')}</span>
          <div className="muted small">{t('Menghapus akun, teman, statistik, dan pesan pribadimu secara permanen. Tidak bisa dibatalkan.')}</div>
          <div className="row wrap">
            <input className="input grow" value={delName} onChange={(e) => setDelName(e.target.value.toLowerCase())} placeholder={t('Ketik username: {u}', { u: u.username })} aria-label={t('Ketik username untuk konfirmasi')} />
            {a.hasPassword && <input className="input grow" type="password" autoComplete="current-password" value={delPw} onChange={(e) => setDelPw(e.target.value)} placeholder={t('Password')} aria-label={t('Password')} />}
            <button
              className="btn danger"
              disabled={delName !== u.username || (a.hasPassword && !delPw) || busy === 'del'}
              onClick={async () => {
                if (!(await askConfirm(t('Hapus akun @{u} selamanya?', { u: u.username }), { ok: t('Hapus akun'), danger: true }))) return;
                await run(
                  'del',
                  () => auth.deleteAccount(delName, delPw).then(onClose),
                  t('Akun dihapus. Sampai jumpa!'),
                );
              }}
            >
              <Trash size={16} /> {t('Hapus akun')}
            </button>
          </div>
          {errFor('del')}
        </section>
        <div className="muted small">
          <LegalLinks />
        </div>
      </div>
    </Modal>
  );
}

// ======================= chip pengguna di menu =======================

export function UserChip({
  auth,
  social,
  onLogin,
  onProfile,
  onFriends,
  onAccount,
  onLeaderboard,
  onReports,
  onHome,
}: {
  auth: Auth;
  social: Social;
  onLogin: () => void;
  onProfile: () => void;
  onFriends: () => void;
  onAccount: () => void;
  onLeaderboard: () => void;
  onReports: () => void;
  onHome: () => void;
}) {
  useLang();
  const [open, setOpen] = useState(false);
  if (!auth.user)
    return (
      <div className="user-chip">
        <span className="chip">{t('Tamu')}</span>
        <button className="btn sm primary" onClick={onLogin}>
          <LogIn size={14} /> {t('Masuk')}
        </button>
        <button className="icon-btn" title={t('Beranda')} onClick={onHome} aria-label={t('Beranda')}>
          <ArrowLeft size={16} />
        </button>
      </div>
    );
  const u = auth.user;
  const req = social.incoming.length + social.unreadTotal;
  const item = (f: () => void) => () => (setOpen(false), f());
  return (
    <div className="user-chip">
      <button className="user-btn" onClick={() => setOpen(!open)} aria-expanded={open}>
        <Avatar user={u} size={28} />
        <span className="truncate">{u.displayName}</span>
        {req > 0 && <span className="badge">{req}</span>}
      </button>
      {open && (
        <div className="user-menu panel" onMouseLeave={() => setOpen(false)}>
          <div className="muted small">@{u.username}</div>
          <button onClick={item(onProfile)}>
            <User size={16} /> {t('Profil & statistik')}
          </button>
          <button onClick={item(onFriends)}>
            <Users size={16} /> {t('Teman & pesan')} {req > 0 && <span className="badge inline">{req}</span>}
          </button>
          <button onClick={item(onLeaderboard)}>
            <Medal size={16} /> {t('Peringkat')}
          </button>
          <button onClick={item(onAccount)}>
            <ShieldCheck size={16} /> {t('Akun & keamanan')}
            {auth.account?.email && !auth.account.emailVerified && <span className="badge inline" title={t('Email belum dikonfirmasi')}>!</span>}
          </button>
          {auth.account?.isAdmin && (
            <button onClick={item(onReports)}>
              <ShieldAlert size={16} /> {t('Laporan pemain')}
            </button>
          )}
          <button
            onClick={async () => {
              setOpen(false);
              if (await askConfirm(t('Keluar dari akun?'), { ok: t('Keluar') })) await auth.logout();
            }}
          >
            <LogOut size={16} /> {t('Keluar akun')}
          </button>
        </div>
      )}
    </div>
  );
}

// ======================= teman =======================

const roomLabel = (f: FriendInfo) =>
  f.room
    ? f.room.started
      ? t('Sedang main di {room}', { room: f.room.name })
      : t('Di lobby {room} ({n}/{max})', { room: f.room.name, n: f.room.players, max: f.room.maxPlayers })
    : f.online
      ? t('Online')
      : t('Offline');

export function FriendsPage({
  social,
  onBack,
  onJoin,
  onWatch,
  onProfile,
  onChat,
  onError,
}: {
  social: Social;
  onBack: () => void;
  onJoin: (code: string) => void;
  onWatch: (code: string) => void;
  onProfile: (username: string) => void;
  onChat: (username: string) => void;
  onError: (m: string) => void;
}) {
  useLang();
  const [q, setQ] = useState('');
  const [results, setResults] = useState<Awaited<ReturnType<typeof searchUsers>>>([]);
  const [searching, setSearching] = useState(false);
  useEffect(() => {
    const s = q.trim();
    if (s.length < 2) return setResults([]);
    setSearching(true);
    const tm = setTimeout(() => {
      searchUsers(s).then(
        (r) => (setResults(r), setSearching(false)),
        (e: unknown) => (onError(errMsg(e)), setSearching(false)),
      );
    }, 300);
    return () => clearTimeout(tm);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, social.friends.length, social.outgoing.length]);
  const act = (p: Promise<unknown>) => p.catch((e: unknown) => onError(errMsg(e)));
  const online = social.friends.filter((f) => f.online).length;

  return (
    <div className="panel page">
      <header className="panel-head">
        <button className="icon-btn" onClick={onBack} aria-label={t('Kembali')}>
          <ArrowLeft size={18} />
        </button>
        <Users size={22} />
        <div>
          <h2>{t('Teman')}</h2>
          <div className="muted">{t('{n} teman · {on} online', { n: social.friends.length, on: online })}</div>
        </div>
      </header>

      <Field label={t('Cari pemain (username atau nama)')}>
        <div className="search">
          <Search size={16} />
          <input className="input grow" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('mis. sari')} />
        </div>
      </Field>
      {q.trim().length >= 2 && (
        <div className="people-list">
          {searching && <div className="muted small">{t('Mencari…')}</div>}
          {!searching && results.length === 0 && <div className="muted small">{t('Tidak ada pemain dengan nama itu.')}</div>}
          {results.map((u) => (
            <div key={u.username} className="person-row">
              <button className="person-main" onClick={() => onProfile(u.username)}>
                <Avatar user={u} size={34} />
                <span className="grow">
                  <b className="truncate">{u.displayName}</b>
                  <span className="muted small">@{u.username}</span>
                </span>
              </button>
              {u.friendship === 'none' && (
                <button className="btn sm primary" onClick={() => act(social.request(u.username).then(() => setQ('')))}>
                  <UserPlus size={14} /> {t('Tambah')}
                </button>
              )}
              {u.friendship === 'incoming' && (
                <button className="btn sm primary" onClick={() => act(social.accept(u.username))}>
                  <Check size={14} /> {t('Terima')}
                </button>
              )}
              {u.friendship === 'outgoing' && <span className="chip">{t('Menunggu')}</span>}
              {u.friendship === 'friend' && <span className="chip ok">{t('Teman')}</span>}
              {u.friendship === 'self' && <span className="chip">{t('Kamu')}</span>}
            </div>
          ))}
        </div>
      )}

      {social.incoming.length > 0 && (
        <section className="people-list">
          <span className="eyebrow">{t('Permintaan masuk')}</span>
          {social.incoming.map((u) => (
            <div key={u.username} className="person-row">
              <button className="person-main" onClick={() => onProfile(u.username)}>
                <Avatar user={u} size={34} />
                <span className="grow">
                  <b className="truncate">{u.displayName}</b>
                  <span className="muted small">{t('@{u} ingin berteman', { u: u.username })}</span>
                </span>
              </button>
              <button className="btn sm primary" onClick={() => act(social.accept(u.username))}>
                <Check size={14} /> {t('Terima')}
              </button>
              <button className="icon-btn" title={t('Tolak')} aria-label={t('Tolak')} onClick={() => act(social.remove(u.username))}>
                <X size={16} />
              </button>
            </div>
          ))}
        </section>
      )}

      <section className="people-list">
        <span className="eyebrow">{t('Daftar teman')}</span>
        {social.friends.length === 0 && <div className="muted small">{t('Belum ada teman. Cari username temanmu di atas lalu tekan Tambah.')}</div>}
        {social.friends.map((f) => {
          const unread = social.unread[f.username] ?? 0;
          return (
            <div key={f.username} className="person-row">
              <button className="person-main" onClick={() => onProfile(f.username)}>
                <span className="avatar-wrap">
                  <Avatar user={f} size={34} />
                  <span className={`dot ${f.online ? 'on' : ''}`} aria-label={f.online ? t('Online') : t('Offline')} />
                </span>
                <span className="grow">
                  <b className="truncate">{f.displayName}</b>
                  <span className="muted small">{roomLabel(f)}</span>
                </span>
              </button>
              {f.room && !f.room.started && f.room.players < f.room.maxPlayers && (
                <button className="btn sm primary" onClick={() => onJoin(f.room!.code)}>
                  {t('Gabung')}
                </button>
              )}
              {f.room?.started && (
                <button className="btn sm" onClick={() => onWatch(f.room!.code)} title={t('Tonton tanpa ikut main')}>
                  <Eye size={14} /> {t('Tonton')}
                </button>
              )}
              <button className="icon-btn" title={t('Chat pribadi')} aria-label={t('Chat pribadi')} onClick={() => onChat(f.username)}>
                <MessageCircle size={16} />
                {unread > 0 && <span className="badge">{unread}</span>}
              </button>
              <button
                className="icon-btn"
                title={t('Hapus teman')}
                aria-label={t('Hapus teman')}
                onClick={async () => (await askConfirm(t('Hapus {name} dari daftar teman?', { name: f.displayName }), { ok: t('Hapus'), danger: true })) && act(social.remove(f.username))}
              >
                <UserMinus size={16} />
              </button>
            </div>
          );
        })}
      </section>

      {social.outgoing.length > 0 && (
        <section className="people-list">
          <span className="eyebrow">{t('Permintaan terkirim')}</span>
          {social.outgoing.map((u) => (
            <div key={u.username} className="person-row">
              <span className="person-main">
                <Avatar user={u} size={30} />
                <span className="grow">
                  <b className="truncate">{u.displayName}</b>
                  <span className="muted small">{t('menunggu jawaban')}</span>
                </span>
              </span>
              <button className="btn sm ghost" onClick={() => act(social.remove(u.username))}>
                {t('Batalkan')}
              </button>
            </div>
          ))}
        </section>
      )}
    </div>
  );
}

// ======================= chat pribadi =======================

export function DmDialog({ social, me, username, onClose, onError }: { social: Social; me: UserPublic; username: string; onClose: () => void; onError: (m: string) => void }) {
  useLang();
  const friend = social.friends.find((f) => f.username === username);
  const [text, setText] = useState('');
  const [loaded, setLoaded] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const msgs = social.dms[username] ?? [];
  useEffect(() => {
    social.openDm(username).then(
      () => setLoaded(true),
      (e: unknown) => (onError(errMsg(e)), onClose()),
    );
    return () => void social.openDm(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [username]);
  useEffect(() => {
    box.current?.scrollTo({ top: box.current.scrollHeight });
  }, [msgs.length]);
  const send = () => {
    const v = text.trim();
    if (!v) return;
    setText('');
    social.sendDm(username, v).catch((e: unknown) => (onError(errMsg(e)), setText(v)));
  };
  return (
    <Modal title={friend ? friend.displayName : `@${username}`} icon={<MessageCircle size={20} />} onClose={onClose}>
      <div className="dm">
        <div className="muted small">{friend ? roomLabel(friend) : ''}</div>
        <div className="dm-msgs" ref={box}>
          {!loaded && <div className="muted small">{t('Memuat…')}</div>}
          {loaded && msgs.length === 0 && <div className="muted small">{t('Belum ada pesan. Sapa temanmu!')}</div>}
          {msgs.map((m, k) => (
            <div key={`${m.at}-${k}`} className={`dm-msg ${m.from === me.username ? 'mine' : ''}`}>
              <span>{m.text}</span>
              <time className="muted">{new Date(m.at).toLocaleTimeString(dateLocale(), { hour: '2-digit', minute: '2-digit' })}</time>
            </div>
          ))}
        </div>
        <form
          className="row"
          onSubmit={(e) => {
            e.preventDefault();
            send();
          }}
        >
          <input className="input grow" value={text} onChange={(e) => setText(e.target.value)} placeholder={t('Ketik pesan…')} maxLength={500} autoFocus />
          <button className="icon-btn" type="submit" aria-label={t('Kirim')}>
            <Send size={16} />
          </button>
        </form>
      </div>
    </Modal>
  );
}

/** Dialog "Undang teman" di lobby room online. */
export function InviteDialog({ social, inRoom, onInvite, onClose }: { social: Social; inRoom: string[]; onInvite: (username: string) => void; onClose: () => void }) {
  useLang();
  const [sent, setSent] = useState<string[]>([]);
  const list = social.friends.filter((f) => !inRoom.includes(f.username));
  return (
    <Modal title={t('Undang teman')} icon={<Send size={20} />} onClose={onClose}>
      <div className="people-list">
        {list.length === 0 && <div className="muted small">{t('Belum ada teman yang bisa diundang. Tambah teman di menu Teman.')}</div>}
        {list.map((f) => (
          <div key={f.username} className="person-row">
            <span className="person-main">
              <span className="avatar-wrap">
                <Avatar user={f} size={32} />
                <span className={`dot ${f.online ? 'on' : ''}`} />
              </span>
              <span className="grow">
                <b className="truncate">{f.displayName}</b>
                <span className="muted small">{roomLabel(f)}</span>
              </span>
            </span>
            <button className="btn sm primary" disabled={!f.online || sent.includes(f.username)} onClick={() => (onInvite(f.username), setSent((s) => [...s, f.username]))}>
              <Mail size={14} /> {sent.includes(f.username) ? t('Terkirim') : f.online ? t('Undang') : t('Offline')}
            </button>
          </div>
        ))}
      </div>
    </Modal>
  );
}

/** Kartu undangan yang muncul di mana pun pemain berada. */
export function InviteToasts({ social, onJoin }: { social: Social; onJoin: (code: string) => void }) {
  useLang();
  if (!social.invites.length) return null;
  return (
    <div className="invites">
      {social.invites.map((i: Invite) => (
        <div key={i.id} className="invite panel" role="alert">
          <Avatar user={i.from} size={34} />
          <div className="grow">{tj('{name} mengundangmu ke {room}', { name: <b>{i.from.displayName}</b>, room: <b>{i.roomName}</b> })}</div>
          <button className="btn sm primary" onClick={() => (social.dismissInvite(i.id), onJoin(i.code))}>
            {t('Gabung')}
          </button>
          <button className="icon-btn" aria-label={t('Abaikan')} onClick={() => social.dismissInvite(i.id)}>
            <X size={16} />
          </button>
        </div>
      ))}
    </div>
  );
}

// ======================= profil =======================

export function LevelBar({ xp }: { xp: number }) {
  const l = levelOf(xp);
  const pct = Math.round(((xp - l.current) / (l.next - l.current)) * 100);
  return (
    <div className="level" title={t('{xp} XP — {need} XP lagi ke level {next}', { xp, need: l.next - xp, next: l.level + 1 })}>
      <span className="level-badge">{t('Lv {n}', { n: l.level })}</span>
      <span className="level-track">
        <span style={{ width: `${pct}%` }} />
      </span>
      <span className="muted small">{xp} XP</span>
    </div>
  );
}

export function ProfileDialog({
  username,
  auth,
  social,
  theme,
  onClose,
  onError,
  onChat,
}: {
  username: string;
  auth: Auth;
  social: Social;
  theme: Theme;
  onClose: () => void;
  onError: (m: string) => void;
  onChat: (username: string) => void;
}) {
  useLang();
  const [p, setP] = useState<Profile | null>(null);
  const [name, setName] = useState('');
  const [reporting, setReporting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const load = () =>
    fetchProfile(username).then(
      (r) => (setP(r), setName(r.user.displayName)),
      (e: unknown) => (onError(errMsg(e)), onClose()),
    );
  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [username, social.friends.length, social.outgoing.length, social.incoming.length, auth.account?.blocked.length]);
  const money = (n: number) => formatMoney(theme, n);
  const self = p?.friendship === 'self';
  const winRate = useMemo(() => (p && p.stats.games ? Math.round((p.stats.wins / p.stats.games) * 100) : 0), [p]);
  const act = (x: Promise<unknown>) => x.then(load, (e: unknown) => onError(errMsg(e)));
  const achievements = useMemo(() => (p ? achievementsOf(p.stats, p.history) : []), [p]);
  const loggedIn = !!auth.user;

  return (
    <Modal title={t('Profil')} icon={<User size={20} />} onClose={onClose} wide>
      {!p ? (
        <div className="muted">{t('Memuat…')}</div>
      ) : (
        <div className="profile">
          <div className="profile-head">
            {self ? (
              <button className="avatar-big sm" onClick={() => fileRef.current?.click()} title={t('Ganti foto profil')}>
                <Avatar user={p.user} size={64} />
              </button>
            ) : (
              <Avatar user={p.user} size={64} />
            )}
            <div className="grow">
              <h3>{p.user.displayName}</h3>
              <div className="muted small">
                @{p.user.username} · {t('bergabung {date}', { date: new Date(p.user.createdAt).toLocaleDateString(dateLocale(), { month: 'long', year: 'numeric' }) })}
              </div>
              <LevelBar xp={xpOf(p.stats)} />
            </div>
            <div className="profile-actions">
              {loggedIn && !p.blockedByMe && p.friendship === 'none' && (
                <button className="btn primary" onClick={() => act(social.request(p.user.username))}>
                  <UserPlus size={16} /> {t('Tambah teman')}
                </button>
              )}
              {p.friendship === 'incoming' && (
                <button className="btn primary" onClick={() => act(social.accept(p.user.username))}>
                  <Check size={16} /> {t('Terima pertemanan')}
                </button>
              )}
              {p.friendship === 'outgoing' && <span className="chip">{t('Permintaan terkirim')}</span>}
              {p.friendship === 'friend' && (
                <>
                  <span className="chip ok">{t('Teman')}</span>
                  <button className="btn sm" onClick={() => (onClose(), onChat(p.user.username))}>
                    <MessageCircle size={14} /> {t('Pesan')}
                  </button>
                </>
              )}
              {loggedIn && !self && (
                <div className="row">
                  {p.blockedByMe ? (
                    <button className="btn sm ghost" onClick={() => act(auth.unblock(p.user.username))}>
                      {t('Buka blokir')}
                    </button>
                  ) : (
                    <button
                      className="btn sm ghost"
                      onClick={async () =>
                        (await askConfirm(t('Blokir {name}? Pertemanan diputus dan ia tidak bisa mengirim permintaan teman, pesan, atau undangan.', { name: p.user.displayName }), { ok: t('Blokir'), danger: true })) &&
                        act(auth.block(p.user.username).then(() => social.refresh()))
                      }
                    >
                      <Ban size={14} /> {t('Blokir')}
                    </button>
                  )}
                  <button className="btn sm ghost" onClick={() => setReporting(true)}>
                    <FlagIcon size={14} /> {t('Laporkan')}
                  </button>
                </div>
              )}
            </div>
          </div>
          {p.blockedByMe && <div className="notice">{t('Kamu memblokir pemain ini.')}</div>}
          {auth.account?.isAdmin && !self && p.banned !== undefined && <AdminBan username={p.user.username} banned={p.banned} onDone={load} onError={onError} />}
          {self && (
            <section className="form profile-edit">
              <span className="eyebrow">{t('Foto profil')}</span>
              <div className="avatar-edit">
                <button className="avatar-big" onClick={() => fileRef.current?.click()} title={t('Unggah foto')} disabled={uploading}>
                  <Avatar user={p.user} size={84} />
                  <span className="avatar-cam">
                    <Camera size={16} />
                  </span>
                </button>
                <div className="avatar-actions">
                  <button className="btn sm primary" disabled={uploading} onClick={() => fileRef.current?.click()}>
                    <Upload size={14} /> {uploading ? t('Mengunggah…') : t('Unggah foto')}
                  </button>
                  {p.user.avatar && (
                    <button className="btn sm ghost" disabled={uploading} onClick={() => act(auth.updateMe({ avatar: '' }))}>
                      <Trash size={14} /> {t('Hapus foto / ikon')}
                    </button>
                  )}
                  <span className="muted small">{t('JPG, PNG, atau WEBP. Dipotong persegi otomatis.')}</span>
                </div>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  hidden
                  onChange={async (e) => {
                    const f = e.target.files?.[0];
                    e.target.value = '';
                    if (!f) return;
                    setUploading(true);
                    try {
                      await auth.uploadAvatar(await shrinkImage(f));
                      await load();
                    } catch (err) {
                      onError(errMsg(err));
                    } finally {
                      setUploading(false);
                    }
                  }}
                />
              </div>
              <span className="field-label">{t('Atau pilih ikon')}</span>
              <div className="icon-picker">
                {Object.entries(AVATAR_ICONS).map(([id, emoji]) => (
                  <button
                    key={id}
                    className={p.user.avatar === `icon:${id}` ? 'on' : ''}
                    style={{ ['--c' as string]: p.user.color }}
                    onClick={() => act(auth.updateMe({ avatar: `icon:${id}` }))}
                    aria-label={t('Ikon {id}', { id })}
                  >
                    {emoji}
                  </button>
                ))}
              </div>

              <span className="eyebrow">{t('Ubah profil')}</span>
              <span className="field-label">{t('Nama tampilan')}</span>
              <div className="row">
                <input className="input grow" value={name} maxLength={16} onChange={(e) => setName(e.target.value)} aria-label={t('Nama tampilan')} />
                <button className="btn" disabled={name.trim().length < 2 || name.trim() === p.user.displayName} onClick={() => act(auth.updateMe({ displayName: name.trim() }))}>
                  {t('Simpan nama')}
                </button>
              </div>
              <span className="field-label">{t('Bidak di papan')}</span>
              <div className="token-picker">
                {TOKEN_ICONS.map((_, k) => (
                  <button key={k} className={p.user.token === k ? 'on' : ''} onClick={() => act(auth.updateMe({ token: k }))} aria-label={t('Bidak {n}', { n: k + 1 })}>
                    <TokenBadge token={k} color={p.user.token === k ? p.user.color : '#64748b'} size={30} />
                  </button>
                ))}
              </div>
              <span className="field-label">{t('Warna')}</span>
              <div className="color-picker">
                {COLORS.map((c) => (
                  <button key={c} className={p.user.color === c ? 'on' : ''} style={{ background: c }} onClick={() => act(auth.updateMe({ color: c }))} aria-label={t('Warna {c}', { c })} />
                ))}
              </div>
            </section>
          )}

          <div className="stat-grid">
            <Stat icon={<Gamepad2 size={18} />} label={t('Main online')} value={String(p.stats.games)} />
            <Stat icon={<Trophy size={18} />} label={t('Menang')} value={`${p.stats.wins} (${winRate}%)`} />
            <Stat icon={<Crown size={18} />} label={t('Kekayaan tertinggi')} value={money(p.stats.bestNetWorth)} />
            <Stat icon={<Building2 size={18} />} label={t('Properti dibeli')} value={String(p.stats.propertiesBought)} />
            <Stat icon={<Coins size={18} />} label={t('Sewa diterima')} value={money(p.stats.rentCollected)} />
            <Stat icon={<X size={18} />} label={t('Bangkrut')} value={String(p.stats.bankrupt)} />
          </div>

          <section>
            <span className="eyebrow">
              {t('Pencapaian')} · {achievements.filter((a) => a.done).length}/{achievements.length}
            </span>
            <div className="achievements">
              {achievements.map((a) => (
                <div key={a.id} className={`achievement ${a.done ? 'done' : ''}`} title={t(a.desc)}>
                  <span className="achievement-icon" aria-hidden>
                    {a.icon}
                  </span>
                  <span className="grow">
                    <b>{t(a.title)}</b>
                    <span className="muted small">{t(a.desc)}</span>
                    {!a.done && (
                      <span className="level-track sm">
                        <span style={{ width: `${Math.round(a.progress * 100)}%` }} />
                      </span>
                    )}
                  </span>
                  {a.done && <Check size={16} />}
                </div>
              ))}
            </div>
          </section>

          <section>
            <span className="eyebrow">{t('Riwayat game online')}</span>
            {p.history.length === 0 ? (
              <div className="muted small">{t('Belum ada game online yang selesai.')}</div>
            ) : (
              <div className="history">
                {p.history.map((h, k) => (
                  <div key={k} className={`history-row ${h.place === 1 ? 'win' : ''}`}>
                    <span className="place">{h.place === 1 ? <Trophy size={14} /> : `#${h.place}`}</span>
                    <span className="grow truncate">{h.roomName}</span>
                    <span className="muted small">{t('{n} pemain', { n: h.players })}</span>
                    <span className="muted small">{h.bankrupt ? t('bangkrut') : money(h.netWorth)}</span>
                    <span className="muted small">{new Date(h.at).toLocaleDateString(dateLocale(), { day: 'numeric', month: 'short' })}</span>
                  </div>
                ))}
              </div>
            )}
          </section>

        </div>
      )}
      {reporting && p && <ReportDialog user={p.user} onClose={() => setReporting(false)} onDone={() => (setReporting(false), onError(t('Laporan terkirim. Terima kasih sudah menjaga permainan tetap nyaman.')))} />}
    </Modal>
  );
}

/** Kontrol admin di profil pemain: tangguhkan akun sementara/permanen atau cabut penangguhan. */
function AdminBan({ username, banned, onDone, onError }: { username: string; banned: Profile['banned']; onDone: () => void; onError: (m: string) => void }) {
  const [days, setDays] = useState(7);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const run = (f: () => Promise<unknown>, ok: string) => {
    setBusy(true);
    f().then(
      () => (onError(ok), onDone()),
      (e: unknown) => onError(errMsg(e)),
    ).finally(() => setBusy(false));
  };
  return (
    <section className="form admin-ban">
      <span className="eyebrow">
        <ShieldAlert size={13} /> {t('Admin')}
      </span>
      {banned ? (
        <div className="row wrap">
          <span className="chip warn">
            {banned.until ? t('Ditangguhkan sampai {date}', { date: new Date(banned.until).toLocaleDateString(dateLocale()) }) : t('Ditangguhkan permanen')}
          </span>
          <span className="muted small grow">{banned.reason}</span>
          <button className="btn sm" disabled={busy} onClick={() => run(() => adminUnban(username), t('Penangguhan dicabut'))}>
            {t('Cabut penangguhan')}
          </button>
        </div>
      ) : (
        <div className="row wrap">
          <Seg
            value={days}
            onChange={setDays}
            options={[
              { v: 1, label: t('1 hari') },
              { v: 7, label: t('7 hari') },
              { v: 30, label: t('30 hari') },
              { v: 0, label: t('Permanen') },
            ]}
          />
          <input className="input grow" value={reason} maxLength={200} onChange={(e) => setReason(e.target.value)} placeholder={t('Alasan (terlihat oleh pemain)')} />
          <button
            className="btn sm danger"
            disabled={busy}
            onClick={async () =>
              (await askConfirm(t('Tangguhkan @{u}? Pemain langsung keluar dan tidak bisa masuk sampai penangguhan berakhir.', { u: username }), { ok: t('Tangguhkan'), danger: true })) &&
              run(() => adminBan(username, days, reason.trim()), t('Akun ditangguhkan'))
            }
          >
            <Ban size={14} /> {t('Tangguhkan')}
          </button>
        </div>
      )}
    </section>
  );
}

function ReportDialog({ user, onClose, onDone }: { user: UserPublic; onClose: () => void; onDone: () => void }) {
  useLang();
  const [reason, setReason] = useState<string>(REPORT_REASONS[0]);
  const [detail, setDetail] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  return (
    <Modal title={t('Laporkan {name}', { name: user.displayName })} icon={<FlagIcon size={20} />} onClose={onClose}>
      <div className="form">
        <div className="chips">
          {REPORT_REASONS.map((r) => (
            <button key={r} className={`chip-btn ${r === reason ? 'on' : ''}`} onClick={() => setReason(r)}>
              {t(r)}
            </button>
          ))}
        </div>
        <textarea className="input" rows={3} maxLength={500} value={detail} onChange={(e) => setDetail(e.target.value)} placeholder={t('Ceritakan singkat apa yang terjadi (opsional)')} />
        <ErrorNote err={err} />
        <div className="row end">
          <button className="btn ghost" onClick={onClose}>
            {t('Batal')}
          </button>
          <button
            className="btn danger"
            disabled={busy}
            onClick={() => {
              setBusy(true);
              sendReport(user.username, reason, detail.trim()).then(onDone, (e: unknown) => (setErr(errMsg(e)), setBusy(false)));
            }}
          >
            <FlagIcon size={16} /> {t('Kirim laporan')}
          </button>
        </div>
      </div>
    </Modal>
  );
}

function Stat({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="stat">
      <span className="stat-icon">{icon}</span>
      <span className="muted small">{label}</span>
      <b>{value}</b>
    </div>
  );
}

// ======================= peringkat =======================

export function LeaderboardPage({ me, onBack, onProfile, onError }: { me: UserPublic | null; onBack: () => void; onProfile: (u: string) => void; onError: (m: string) => void }) {
  useLang();
  const [by, setBy] = useState<'xp' | 'wins' | 'rate'>('xp');
  const [data, setData] = useState<{ top: LeaderRow[]; me: LeaderRow | null } | null>(null);
  useEffect(() => {
    setData(null);
    fetchLeaderboard(by).then(setData, (e: unknown) => onError(errMsg(e)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [by]);
  const row = (r: LeaderRow) => (
    <button key={r.user.username} className={`leader-row ${r.user.username === me?.username ? 'me' : ''}`} onClick={() => onProfile(r.user.username)}>
      <span className="place">{r.rank <= 3 ? ['🥇', '🥈', '🥉'][r.rank - 1] : `#${r.rank}`}</span>
      <Avatar user={r.user} size={30} />
      <span className="grow">
        <b className="truncate">{r.user.displayName}</b>
        <span className="muted small">
          @{r.user.username} · {t('Lv {n}', { n: r.level })}
        </span>
      </span>
      <span className="leader-val">
        {by === 'xp' ? `${r.xp} XP` : by === 'wins' ? t('{n} menang', { n: r.wins }) : `${Math.round((r.wins / r.games) * 100)}%`}
        <span className="muted small">{t('{n} game', { n: r.games })}</span>
      </span>
    </button>
  );
  return (
    <div className="panel page">
      <header className="panel-head">
        <button className="icon-btn" onClick={onBack} aria-label={t('Kembali')}>
          <ArrowLeft size={18} />
        </button>
        <Medal size={22} />
        <div>
          <h2>{t('Peringkat')}</h2>
          <div className="muted">{t('Dari game online yang selesai dengan akun.')}</div>
        </div>
      </header>
      <Seg
        value={by}
        onChange={setBy}
        options={[
          { v: 'xp', label: t('Level (XP)') },
          { v: 'wins', label: t('Paling banyak menang') },
          { v: 'rate', label: t('Persentase menang') },
        ]}
      />
      {by === 'rate' && <div className="muted small">{t('Minimal 5 game supaya masuk daftar ini.')}</div>}
      <div className="leader-list">
        {!data && <div className="muted small">{t('Memuat…')}</div>}
        {data?.top.length === 0 && <div className="muted small">{t('Belum ada data. Selesaikan game online dengan akun untuk masuk peringkat.')}</div>}
        {data?.top.map(row)}
      </div>
      {data?.me && !data.top.some((r) => r.user.username === data.me!.user.username) && (
        <>
          <span className="eyebrow">{t('Posisimu')}</span>
          {row(data.me)}
        </>
      )}
    </div>
  );
}

// ======================= laporan (admin) =======================

export function ReportsDialog({ onClose, onProfile, onError }: { onClose: () => void; onProfile: (u: string) => void; onError: (m: string) => void }) {
  useLang();
  const [list, setList] = useState<Report[] | null>(null);
  const [all, setAll] = useState(false);
  useEffect(() => {
    fetchReports().then(setList, (e: unknown) => (onError(errMsg(e)), onClose()));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const shown = (list ?? []).filter((r) => all || r.status === 'baru');
  return (
    <Modal title={t('Laporan pemain')} icon={<ShieldAlert size={20} />} onClose={onClose} wide>
      <div className="form">
        <Seg
          value={all ? 'all' : 'new'}
          onChange={(v) => setAll(v === 'all')}
          options={[
            { v: 'new', label: t('Baru') },
            { v: 'all', label: t('Semua') },
          ]}
        />
        {!list && <div className="muted small">{t('Memuat…')}</div>}
        {list && shown.length === 0 && <div className="muted small">{t('Tidak ada laporan.')}</div>}
        {shown.map((r) => (
          <div key={r.id} className={`report-row ${r.status === 'selesai' ? 'done' : ''}`}>
            <div className="grow">
              <div>
                <button className="link-btn" onClick={() => onProfile(r.target)}>
                  <b>@{r.target}</b>
                </button>{' '}
                · {t(r.reason)}
              </div>
              {r.detail && <div className="small">{r.detail}</div>}
              <div className="muted small">
                {t('dilaporkan @{u} · {date}', { u: r.reporter, date: new Date(r.at).toLocaleString(dateLocale(), { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) })}
              </div>
            </div>
            {r.status === 'baru' ? (
              <button className="btn sm" onClick={() => closeReport(r.id).then(setList, (e: unknown) => onError(errMsg(e)))}>
                <Check size={14} /> {t('Selesai')}
              </button>
            ) : (
              <span className="chip ok">{t('Selesai')}</span>
            )}
          </div>
        ))}
        <p className="muted small">{t('Untuk menindak: klik nama pemain untuk membuka profilnya, lalu tangguhkan akunnya.')}</p>
      </div>
    </Modal>
  );
}
