// Studio tema: spesifikasi tema JSON (apa saja yang bisa diganti + batasnya) dan pengecek langsung,
// supaya pembuat tema tahu aturannya sebelum menyimpan / mengimpor.

import { useState } from 'react';
import { CUSTOM_MOTIONS, CUSTOM_SOUNDS, LANDMARKS, MAX_CUSTOM_CARDS, validateTheme, type Theme } from '@monopoli/engine';
import { BookOpen, CheckCircle2, ChevronDown, Download, TriangleAlert } from 'lucide-react';
import { t, tr, useLang } from './i18n';

interface Row {
  field: string;
  what: string;
  rule: string;
  need?: boolean;
}

const BUILDINGS = 'modern, classic, onion, pagoda, ninja, tropical';

function rows(): { title: string; items: Row[] }[] {
  return [
    {
      title: t('Identitas & uang'),
      items: [
        { field: 'id', what: t('Kode unik tema'), rule: t('huruf kecil, angka, tanda -; tidak boleh sama dengan tema bawaan'), need: true },
        { field: 'name', what: t('Nama tema'), rule: t('maks 60 huruf'), need: true },
        { field: 'flag', what: t('Ikon / emoji'), rule: t('1 emoji, mis. 🇰🇷 ⭐ 🥷') },
        { field: 'description', what: t('Deskripsi singkat'), rule: t('teks bebas') },
        { field: 'currency.symbol', what: t('Simbol uang'), rule: t('mis. Rp, $, ₩, 両'), need: true },
        { field: 'currency.multiplier', what: t('Nilai 1 satuan permainan'), rule: t('1..1.000.000.000 · modal awal = 1.500 satuan · contoh Rp = 1000000, ₩ = 74500'), need: true },
        { field: 'currency.locale / compact / symbolAfter', what: t('Cara menulis angka'), rule: t('compact: true → 1,5 M / 112M · symbolAfter: true → 2M ₽') },
      ],
    },
    {
      title: t('Nama petak (urut papan, mulai dari START searah jarum jam)'),
      items: [
        { field: 'properties', what: t('Kota / properti'), rule: t('tepat 22 nama, maks 60 huruf · 8 grup warna: 2-3-3-3-3-3-3-2'), need: true },
        { field: 'stations', what: t('Stasiun / pelabuhan / bandara'), rule: t('tepat 4 nama'), need: true },
        { field: 'utilities', what: t('Listrik & air'), rule: t('tepat 2 nama'), need: true },
        { field: 'taxes', what: t('Pajak'), rule: t('tepat 2 nama'), need: true },
        { field: 'corners', what: t('4 petak sudut'), rule: 'go, jail, parking, gotojail', need: true },
        { field: 'deckNames', what: t('Nama tumpukan kartu'), rule: 'chance, community', need: true },
        { field: 'tokens', what: t('Nama bidak'), rule: t('tepat 6 nama'), need: true },
      ],
    },
    {
      title: t('Tampilan'),
      items: [
        { field: 'groupColors', what: t('Warna 8 grup properti'), rule: t('8 warna #rrggbb'), need: true },
        { field: 'visual.sky / table / board / boardCenter / accent / fog / lightColor', what: t('Warna langit, meja, papan, aksen'), rule: t('warna #rrggbb') },
        { field: 'visual.buildings', what: t('Gaya bangunan di sekitar papan'), rule: BUILDINGS, need: true },
        { field: 'visual.landmark', what: t('Ikon besar di tengah papan'), rule: LANDMARKS.join(', ') },
      ],
    },
    {
      title: t('Kartu & efek (opsional)'),
      items: [
        { field: 'decks.chance / decks.community', what: t('Kartu buatan sendiri (mengganti kartu bawaan)'), rule: t('1..{n} kartu: { text maks 200 huruf, effect }', { n: MAX_CUSTOM_CARDS }) },
        { field: 'effect.kind', what: t('Aksi kartu'), rule: 'money(amount −1000..1000) · eachPlayer(amount −500..500) · advance(to 0..39) · nearest(station|utility) · back(steps 1..12) · jail · jailFree · repairs(house 0..500, hotel 0..1000)' },
        { field: '{m:100} {m:go} {t:39}', what: t('Token di teks kartu'), rule: t('uang (satuan permainan) · gaji START · nama petak nomor 39') },
        { field: 'cards', what: t('Ganti teks kartu bawaan saja'), rule: t('kunci c1..c16 / d1..d16, efek tetap') },
        { field: 'tileFx["0".."39"]', what: t('Efek saat mendarat di petak'), rule: t('anim (bawaan) atau emoji atau custom · caption maks 80 huruf') },
        { field: 'tileFx[n].custom', what: t('Animasi buatan sendiri'), rule: `motion: ${CUSTOM_MOTIONS.join(', ')} · emojis 1-4 · count 1..30 · size 0.5..2.5 · speed 0.5..2 · glow #rrggbb · sound: ${CUSTOM_SOUNDS.join(', ')}` },
      ],
    },
  ];
}

/** Panel lipat berisi spesifikasi lengkap tema JSON. */
export function ThemeSpec({ samples }: { samples?: { label: string; onClick: () => void }[] }) {
  useLang();
  const [open, setOpen] = useState(false);
  return (
    <section className={`spec panel ${open ? 'open' : ''}`}>
      <button type="button" className="spec-head" onClick={() => setOpen(!open)} aria-expanded={open}>
        <BookOpen size={18} />
        <span className="grow">
          <b>{t('Spesifikasi tema JSON')}</b>
          <span className="muted small">{t('Apa saja yang bisa diganti, jumlah wajib, dan batas nilainya')}</span>
        </span>
        <ChevronDown size={18} className="spec-caret" />
      </button>
      {open && (
        <div className="spec-body">
          <p className="muted small">
            {t('Semua yang ada di file JSON menggantikan tema bawaan: nama kota, mata uang, warna, kartu, dan efek. Yang tidak diisi (opsional) memakai bawaan. File diperiksa saat impor & simpan — kalau ada yang salah, tema tidak dipakai dan pesannya muncul di bawah.')}
          </p>
          {rows().map((g) => (
            <div key={g.title} className="spec-group">
              <h4>{g.title}</h4>
              <div className="spec-table">
                {g.items.map((r) => (
                  <div key={r.field} className="spec-row">
                    <code>{r.field}</code>
                    <span className="spec-what">
                      {r.what} {r.need && <span className="spec-need">{t('wajib')}</span>}
                    </span>
                    <span className="spec-rule">{r.rule}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
          {samples && (
            <div className="row">
              {samples.map((s) => (
                <button key={s.label} type="button" className="btn sm" onClick={s.onClick}>
                  <Download size={14} /> {s.label}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  );
}

/** Pengecek langsung: tampil hijau kalau tema siap disimpan, atau daftar yang perlu diperbaiki. */
export function ThemeCheck({ draft }: { draft: Theme }) {
  useLang();
  const errs = validateTheme(draft);
  if (!errs.length)
    return (
      <div className="theme-check ok" role="status">
        <CheckCircle2 size={16} /> {t('Tema lengkap & valid — siap disimpan.')}
      </div>
    );
  return (
    <div className="theme-check bad" role="alert">
      <b>
        <TriangleAlert size={16} /> {t('{n} hal perlu diperbaiki sebelum disimpan:', { n: errs.length })}
      </b>
      <ul>
        {errs.slice(0, 8).map((e) => (
          <li key={e}>{tr(e)}</li>
        ))}
        {errs.length > 8 && <li>…</li>}
      </ul>
    </div>
  );
}
