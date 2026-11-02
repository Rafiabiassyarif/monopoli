// Pengaturan aturan main — dipakai di Main lokal & lobby online (host bisa ubah, pemain lain melihat ringkasan).
// Bawaan = aturan resmi Monopoli; semua yang beda ditandai "aturan rumah".

import { ScrollText, Sparkles } from 'lucide-react';
import { DEFAULT_OPTIONS, MAX_ROUNDS, OPTION_LIMITS, START_CASH, changedOptions, formatMoney, type Options, type Theme } from '@monopoli/engine';
import { Field, MoneyInput, Seg, Toggle } from './ui';
import { t, useLang } from './i18n';

export const PRESETS: { id: string; label: string; hint: string; rules: Partial<Options> }[] = [
  { id: 'official', label: 'Resmi', hint: 'Aturan resmi Monopoli, main sampai semua lawan bangkrut', rules: {} },
  { id: 'short', label: 'Singkat resmi', hint: 'Aturan resmi "Permainan Singkat": tiap pemain dibagi 2 properti, selesai saat pemain kedua bangkrut', rules: { shortGame: true } },
  { id: 'rounds', label: '20 ronde', hint: 'Aturan resmi, tapi selesai setelah 20 ronde — pemenang yang paling kaya', rules: { maxRounds: 20 } },
  {
    id: 'family',
    label: 'Santai keluarga',
    hint: 'Aturan rumah populer: modal lebih besar, pot Parkir Bebas berisi jackpot, gaji 2× di START',
    rules: { startCash: 2000, freeParkingPot: true, freeParkingStart: 500, doubleGo: true },
  },
];

const presetOf = (r: Options) => PRESETS.find((p) => (Object.keys(DEFAULT_OPTIONS) as (keyof Options)[]).every((k) => r[k] === ({ ...DEFAULT_OPTIONS, ...p.rules } as Options)[k]))?.id;

/** Label ringkas tiap aturan yang beda dari resmi. */
export function ruleNotes(r: Options, theme: Theme): string[] {
  const m = (n: number) => formatMoney(theme, n);
  const notes: Partial<Record<keyof Options, string>> = {
    startCash: t('modal {m}', { m: m(r.startCash) }),
    goSalary: t('gaji START {m}', { m: m(r.goSalary) }),
    doubleGo: t('gaji 2× di START'),
    jailFine: t('denda penjara {m}', { m: m(r.jailFine) }),
    rentInJail: t('tidak menagih sewa saat di penjara'),
    auctions: t('tanpa lelang'),
    evenBuild: t('boleh bangun tidak merata'),
    limitedBuildings: t('rumah & hotel tak terbatas'),
    incomeTax: t('pajak penghasilan klasik (10%)'),
    freeParkingPot: r.freeParkingStart ? t('pot parkir (jackpot {m})', { m: m(r.freeParkingStart) }) : t('pot parkir bebas'),
    freeParkingStart: '',
    shortGame: t('permainan singkat'),
    maxRounds: t('{n} ronde', { n: r.maxRounds }),
  };
  return changedOptions(r)
    .map((k) => notes[k] ?? '')
    .filter(Boolean);
}

export function RulesBadge({ rules }: { rules: Options }) {
  useLang();
  // modal & durasi bukan 'aturan rumah'; isi jackpot dihitung satu dengan pot parkir
  const n = changedOptions(rules).filter((k) => k !== 'startCash' && k !== 'maxRounds' && k !== 'freeParkingStart').length;
  return n === 0 ? <span className="chip ok">{t('Aturan resmi')}</span> : <span className="chip warn">{t('{n} aturan rumah', { n })}</span>;
}

/** Ringkasan aturan untuk pemain yang bukan host. */
export function RulesSummary({ rules, theme }: { rules: Options; theme: Theme }) {
  useLang();
  // modal, gaji & durasi sudah di baris pertama
  const notes = ruleNotes({ ...rules, startCash: DEFAULT_OPTIONS.startCash, goSalary: DEFAULT_OPTIONS.goSalary, maxRounds: DEFAULT_OPTIONS.maxRounds }, theme);
  return (
    <div className="rules-summary">
      <div className="row">
        <ScrollText size={16} /> <b>{t('Aturan main')}</b> <RulesBadge rules={rules} />
      </div>
      <div className="muted small">
        {t('Modal {m}', { m: formatMoney(theme, rules.startCash) })} · {t('gaji START {m}', { m: formatMoney(theme, rules.goSalary) })} · {rules.maxRounds ? t('{n} ronde', { n: rules.maxRounds }) : rules.shortGame ? t('permainan singkat') : t('sampai bangkrut')}
      </div>
      {notes.length > 0 && <div className="small">{notes.join(' · ')}</div>}
    </div>
  );
}

const clampTo = (k: keyof typeof OPTION_LIMITS, v: number) => Math.min(OPTION_LIMITS[k][1], Math.max(OPTION_LIMITS[k][0], v));

export function RulesForm({ rules, theme, onChange }: { rules: Options; theme: Theme; onChange: (patch: Partial<Options>) => void }) {
  useLang();
  const m = (n: number) => formatMoney(theme, n);
  const preset = presetOf(rules);
  const set = <K extends keyof Options>(k: K, v: Options[K]) => onChange({ [k]: v } as Partial<Options>);
  return (
    <div className="rules">
      <div className="rules-head">
        <span className="field-label">{t('Aturan main')}</span>
        <RulesBadge rules={rules} />
      </div>
      <div className="preset-row" role="radiogroup" aria-label={t('Preset aturan')}>
        {PRESETS.map((p) => (
          <button key={p.id} role="radio" aria-checked={preset === p.id} className={`preset ${preset === p.id ? 'on' : ''}`} title={t(p.hint)} onClick={() => onChange({ ...DEFAULT_OPTIONS, ...p.rules })}>
            {p.id === 'official' ? <ScrollText size={14} /> : <Sparkles size={14} />} {t(p.label)}
          </button>
        ))}
      </div>

      <div className="form grid2">
        <Field label={t('Modal awal tiap pemain')}>
          <Seg value={rules.startCash} onChange={(v) => set('startCash', v)} options={START_CASH.map((c) => ({ v: c as number, label: m(c) }))} />
          <div className="row small muted">
            {t('atau ketik:')}
            <MoneyInput theme={theme} value={rules.startCash} onChange={(v) => set('startCash', clampTo('startCash', v))} label={t('Modal awal')} />
          </div>
        </Field>
        <Field label={t('Durasi')}>
          <Seg value={rules.maxRounds} onChange={(v) => set('maxRounds', v)} options={MAX_ROUNDS.map((n) => ({ v: n as number, label: n ? t('{n} ronde', { n }) : t('Bangkrut') }))} />
        </Field>
      </div>

      <details className="rules-more">
        <summary>{t('Aturan lanjutan (gaji START, penjara, lelang, bangunan, pajak, parkir)')}</summary>
        <div className="form grid2">
          <Field label={t('Gaji lewat START (resmi {m})', { m: m(DEFAULT_OPTIONS.goSalary) })}>
            <Seg value={rules.goSalary} onChange={(v) => set('goSalary', v)} options={[100, 200, 300, 400].map((v) => ({ v, label: m(v) }))} />
          </Field>
          <Field label={t('Denda keluar penjara (resmi {m})', { m: m(DEFAULT_OPTIONS.jailFine) })}>
            <Seg value={rules.jailFine} onChange={(v) => set('jailFine', v)} options={[25, 50, 100].map((v) => ({ v, label: m(v) }))} />
          </Field>
          <Field label={t('Pajak penghasilan')}>
            <Seg
              value={rules.incomeTax}
              onChange={(v) => set('incomeTax', v)}
              options={[
                { v: 'flat', label: t('Tetap {m}', { m: m(200) }) },
                { v: 'classic', label: t('Klasik: 10% / maks') },
              ]}
            />
          </Field>
          <Field label={t('Jackpot awal pot parkir')}>
            <Seg
              value={rules.freeParkingPot ? rules.freeParkingStart : -1}
              onChange={(v) => onChange(v < 0 ? { freeParkingPot: false, freeParkingStart: 0 } : { freeParkingPot: true, freeParkingStart: v })}
              options={[
                { v: -1, label: t('Mati') },
                { v: 0, label: t('Pot saja') },
                { v: 250, label: m(250) },
                { v: 500, label: m(500) },
              ]}
            />
          </Field>
        </div>
        <div className="toggles grid2">
          <Toggle on={rules.auctions} onChange={(v) => set('auctions', v)} label={t('Lelang properti')} hint={t('Resmi: nyala. Petak yang tidak dibeli dilelang ke semua pemain')} />
          <Toggle on={rules.evenBuild} onChange={(v) => set('evenBuild', v)} label={t('Bangun merata')} hint={t('Resmi: nyala. Rumah dibangun & dijual merata dalam satu set')} />
          <Toggle on={rules.limitedBuildings} onChange={(v) => set('limitedBuildings', v)} label={t('Stok bangunan terbatas')} hint={t('Resmi: nyala. Bank hanya punya 32 rumah & 12 hotel')} />
          <Toggle on={rules.rentInJail} onChange={(v) => set('rentInJail', v)} label={t('Tetap tagih sewa di penjara')} hint={t('Resmi: nyala')} />
          <Toggle on={rules.doubleGo} onChange={(v) => set('doubleGo', v)} label={t('Gaji 2× tepat di START')} hint={t('Aturan rumah (resmi: mati)')} />
          <Toggle on={rules.shortGame} onChange={(v) => set('shortGame', v)} label={t('Permainan singkat')} hint={t('Aturan resmi singkat: 2 properti acak di awal, selesai saat pemain kedua bangkrut')} />
        </div>
        <button className="btn ghost sm" onClick={() => onChange({ ...DEFAULT_OPTIONS })}>
          {t('Kembalikan ke aturan resmi')}
        </button>
      </details>
    </div>
  );
}
