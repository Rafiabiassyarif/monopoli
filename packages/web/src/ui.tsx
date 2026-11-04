// Primitive UI bersama supaya tampilan konsisten di semua layar.

import { useEffect, useState, type ReactNode } from 'react';
import { moneyUnit, type Theme } from '@monopoli/engine';
import { t, useLang } from './i18n';
import { ChessPawn, Crown, Gem, HatGlasses, Rocket, Sailboat, TriangleAlert, X, type LucideIcon } from 'lucide-react';

/** Ikon bidak — urutan sama dengan bentuk 3D di Scene.tsx (TokenShape). */
export const TOKEN_ICONS: LucideIcon[] = [ChessPawn, Sailboat, Crown, Rocket, HatGlasses, Gem];
export const TOKEN_NAMES = ['Pion', 'Perahu', 'Mahkota', 'Roket', 'Topi', 'Permata'];
export const COLORS = ['#ef4444', '#3b82f6', '#22c55e', '#eab308', '#a855f7', '#f97316'];

export function TokenBadge({ token, color, size = 36, dim = false }: { token: number; color: string; size?: number; dim?: boolean }) {
  const I = TOKEN_ICONS[token % 6];
  return (
    <span className={`token-badge ${dim ? 'dim' : ''}`} style={{ ['--c' as string]: color, width: size, height: size }}>
      <I size={size * 0.52} strokeWidth={2.2} />
    </span>
  );
}

export function Modal({ title, icon, onClose, children, wide }: { title: string; icon?: ReactNode; onClose?: () => void; children: ReactNode; wide?: boolean }) {
  useLang();
  useEffect(() => {
    if (!onClose) return;
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    addEventListener('keydown', k);
    return () => removeEventListener('keydown', k);
  }, [onClose]);
  return (
    <div className="modal" onClick={onClose}>
      <div className={`panel modal-card ${wide ? 'wide' : ''}`} role="dialog" aria-label={title} onClick={(e) => e.stopPropagation()}>
        <header className="panel-head">
          {icon}
          <h2>{title}</h2>
          {onClose && (
            <button className="icon-btn" onClick={onClose} aria-label={t('Tutup')}>
              <X size={18} />
            </button>
          )}
        </header>
        {children}
      </div>
    </div>
  );
}

export function Seg<T extends string | number>({ value, options, onChange }: { value: T; options: { v: T; label: ReactNode }[]; onChange: (v: T) => void }) {
  return (
    <div className="seg" role="radiogroup">
      {options.map((o) => (
        <button key={String(o.v)} role="radio" aria-checked={o.v === value} className={o.v === value ? 'on' : ''} onClick={() => onChange(o.v)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="field">
      <span className="field-label">{label}</span>
      {children}
    </div>
  );
}

// Windows tidak punya emoji bendera (tampil "ID"/"US"). Bendera bawaan digambar SVG; emoji lain tetap emoji.
const FLAG_SVG: Record<string, ReactNode> = {
  '🇮🇩': (
    <>
      <rect width="30" height="10" fill="#e11d2a" />
      <rect y="10" width="30" height="10" fill="#fff" />
    </>
  ),
  '🇷🇺': (
    <>
      <rect width="30" height="7" fill="#fff" />
      <rect y="7" width="30" height="6" fill="#1c3faa" />
      <rect y="13" width="30" height="7" fill="#d52b1e" />
    </>
  ),
  '🇯🇵': (
    <>
      <rect width="30" height="20" fill="#fff" />
      <circle cx="15" cy="10" r="5.5" fill="#bc002d" />
    </>
  ),
  '🇺🇸': (
    <>
      {Array.from({ length: 7 }, (_, k) => (
        <rect key={k} y={(k * 20) / 7} width="30" height={10 / 7} fill="#b22234" />
      ))}
      <rect width="13" height="10.8" fill="#3c3b6e" />
    </>
  ),
  '🇬🇧': (
    <>
      <rect width="30" height="20" fill="#012169" />
      <path d="M0 0L30 20M30 0L0 20" stroke="#fff" strokeWidth="4" />
      <path d="M0 0L30 20M30 0L0 20" stroke="#c8102e" strokeWidth="1.6" />
      <path d="M15 0V20M0 10H30" stroke="#fff" strokeWidth="6" />
      <path d="M15 0V20M0 10H30" stroke="#c8102e" strokeWidth="3.4" />
    </>
  ),
};

export function Flag({ theme, size = 22 }: { theme: Pick<Theme, 'flag' | 'name'>; size?: number }) {
  const svg = FLAG_SVG[theme.flag];
  if (!svg) return <span className="flag-emoji" style={{ fontSize: size }}>{theme.flag}</span>;
  return (
    <svg className="flag" width={size * 1.4} height={size} viewBox="0 0 30 20" role="img" aria-label={theme.name}>
      {theme.flag === '🇺🇸' && <rect width="30" height="20" fill="#fff" />}
      {svg}
    </svg>
  );
}

/** Input nominal dalam satuan tampilan tema (mis. Rp…rb ×10), disimpan sebagai satuan engine. */
export function MoneyInput({ theme, value, onChange, max, label }: { theme: Theme; value: number; onChange: (units: number) => void; max?: number; label: string }) {
  // tema ringkas: angka yang diketik dalam satuan tampilan (mis. "Rp [200] jt"); tema lama: nominal penuh
  const u = moneyUnit(theme);
  const m = u.step;
  return (
    <span className="money-input">
      {u.before && <span className="money-sym">{u.before}</span>}
      <input
        className="input num"
        type="number"
        min={0}
        step={m}
        max={max !== undefined ? max * m : undefined}
        value={+(value * m).toFixed(4)}
        aria-label={label}
        onChange={(e) => onChange(Math.max(0, Math.floor(+e.target.value / m + 1e-6)))}
      />
      {u.after && <span className="muted">{u.after}</span>}
    </span>
  );
}

/** Saklar on/off untuk aturan rumah dsb. */
export function Toggle({ on, onChange, label, hint }: { on: boolean; onChange: (v: boolean) => void; label: ReactNode; hint?: string }) {
  return (
    <button type="button" role="switch" aria-checked={on} className={`toggle ${on ? 'on' : ''}`} onClick={() => onChange(!on)} title={hint}>
      <span className="toggle-track">
        <span className="toggle-knob" />
      </span>
      <span className="toggle-label">
        {label}
        {hint && <span className="muted small">{hint}</span>}
      </span>
    </button>
  );
}

// ---------- dialog konfirmasi (pengganti window.confirm yang tidak sesuai design system) ----------
interface ConfirmReq {
  text: string;
  ok: string;
  danger?: boolean;
  resolve: (v: boolean) => void;
}
let pushConfirm: ((r: ConfirmReq) => void) | null = null;

/** `if (await askConfirm('Yakin?')) ...` — tampil sebagai modal di dalam game. */
export function askConfirm(text: string, opts: { ok?: string; danger?: boolean } = {}): Promise<boolean> {
  return new Promise((resolve) => {
    if (!pushConfirm) return resolve(true);
    pushConfirm({ text, ok: opts.ok ?? t('Ya'), danger: opts.danger, resolve });
  });
}

/** Pasang sekali di root aplikasi. */
export function ConfirmHost() {
  const [req, setReq] = useState<ConfirmReq | null>(null);
  useEffect(() => {
    pushConfirm = (r) => setReq(r);
    return () => {
      pushConfirm = null;
    };
  }, []);
  if (!req) return null;
  const done = (v: boolean) => {
    req.resolve(v);
    setReq(null);
  };
  return (
    <Modal title={t('Konfirmasi')} icon={<TriangleAlert size={20} />} onClose={() => done(false)}>
      <p className="confirm-text">{req.text}</p>
      <div className="row end">
        <button className="btn ghost" onClick={() => done(false)}>
          {t('Batal')}
        </button>
        <button className={`btn ${req.danger ? 'danger' : 'primary'}`} autoFocus onClick={() => done(true)}>
          {req.ok}
        </button>
      </div>
    </Modal>
  );
}
