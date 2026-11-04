// Studio tema → tab "Kartu & efek": kartu Kesempatan/Dana Umum buatan sendiri (teks + efek) dan
// efek khusus saat mendarat di petak. Semua tersimpan di JSON tema (decks, tileFx), jadi ikut saat
// tema diekspor/impor dan dipakai juga oleh pemain lain di room online milik host.

import { BOARD, MAX_CUSTOM_CARDS, type CardEffect, type CustomCard, type Theme, type TileFx } from '@monopoli/engine';
import { Plus, Sparkles, Trash } from 'lucide-react';
import { t, useLang } from './i18n';
import { tileName } from './names';
import { ALL_ANIMS } from './tileAnims';
import { MoneyInput, Seg } from './ui';
import { SAMPLE_DECKS, SAMPLE_TILE_FX } from './themeSample';

type Deck = 'chance' | 'community';
type Kind = CardEffect['kind'];

const KINDS: { v: Kind; label: string }[] = [
  { v: 'money', label: 'Terima / bayar uang' },
  { v: 'eachPlayer', label: 'Dari / ke tiap pemain' },
  { v: 'advance', label: 'Maju ke petak' },
  { v: 'nearest', label: 'Maju ke stasiun/utilitas terdekat' },
  { v: 'back', label: 'Mundur beberapa langkah' },
  { v: 'jail', label: 'Masuk penjara' },
  { v: 'jailFree', label: 'Kartu bebas penjara' },
  { v: 'repairs', label: 'Bayar per rumah & hotel' },
];

function defaultEffect(kind: Kind): CardEffect {
  switch (kind) {
    case 'money':
      return { kind, amount: 50 };
    case 'eachPlayer':
      return { kind, amount: 10 };
    case 'advance':
      return { kind, to: 0 };
    case 'nearest':
      return { kind, target: 'station' };
    case 'back':
      return { kind, steps: 3 };
    case 'repairs':
      return { kind, house: 25, hotel: 100 };
    default:
      return { kind } as CardEffect;
  }
}

function EffectFields({ e, theme, onChange }: { e: CardEffect; theme: Theme; onChange: (e: CardEffect) => void }) {
  const tiles = (
    value: number,
    set: (n: number) => void,
  ) => (
    <select className="input sm" value={value} onChange={(x) => set(+x.target.value)} aria-label={t('Petak tujuan')}>
      {BOARD.map((_, i) => (
        <option key={i} value={i}>
          {i}. {tileName(theme, i)}
        </option>
      ))}
    </select>
  );
  const signed = (amount: number, set: (n: number) => void, max: number, plus: string, minus: string) => (
    <>
      <Seg
        value={amount >= 0 ? 'in' : 'out'}
        onChange={(v) => set(v === 'in' ? Math.abs(amount) : -Math.abs(amount))}
        options={[
          { v: 'in', label: t(plus) },
          { v: 'out', label: t(minus) },
        ]}
      />
      <MoneyInput theme={theme} value={Math.abs(amount)} max={max} label={t('Jumlah')} onChange={(n) => set((amount >= 0 ? 1 : -1) * Math.min(max, Math.max(1, n)))} />
    </>
  );
  switch (e.kind) {
    case 'money':
      return signed(e.amount, (amount) => onChange({ ...e, amount }), 1000, 'Terima', 'Bayar');
    case 'eachPlayer':
      return signed(e.amount, (amount) => onChange({ ...e, amount }), 500, 'Terima dari tiap pemain', 'Bayar ke tiap pemain');
    case 'advance':
      return tiles(e.to, (to) => onChange({ ...e, to }));
    case 'nearest':
      return (
        <Seg
          value={e.target}
          onChange={(target) => onChange({ ...e, target })}
          options={[
            { v: 'station', label: t('Stasiun') },
            { v: 'utility', label: t('Utilitas') },
          ]}
        />
      );
    case 'back':
      return (
        <input className="input sm num" type="number" min={1} max={12} value={e.steps} aria-label={t('Langkah mundur')} onChange={(x) => onChange({ ...e, steps: Math.min(12, Math.max(1, +x.target.value | 0)) })} />
      );
    case 'repairs':
      return (
        <>
          <span className="muted small">{t('per rumah')}</span>
          <MoneyInput theme={theme} value={e.house} max={500} label={t('per rumah')} onChange={(house) => onChange({ ...e, house: Math.min(500, house) })} />
          <span className="muted small">{t('per hotel')}</span>
          <MoneyInput theme={theme} value={e.hotel} max={1000} label={t('per hotel')} onChange={(hotel) => onChange({ ...e, hotel: Math.min(1000, hotel) })} />
        </>
      );
    default:
      return null;
  }
}

function DeckEditor({ deck, draft, up }: { deck: Deck; draft: Theme; up: (p: Partial<Theme>) => void }) {
  const list = draft.decks?.[deck];
  const setList = (l: CustomCard[] | undefined) => {
    const decks = { ...draft.decks, [deck]: l };
    if (!l) delete decks[deck];
    up({ decks: Object.keys(decks).length ? decks : undefined });
  };
  const name = deck === 'chance' ? draft.deckNames.chance : draft.deckNames.community;
  return (
    <section className="card-deck-edit">
      <div className="row">
        <b className="grow">{name}</b>
        <Seg
          value={list ? 'own' : 'base'}
          onChange={(v) => setList(v === 'own' ? structuredClone(SAMPLE_DECKS[deck]) : undefined)}
          options={[
            { v: 'base', label: t('Kartu bawaan (16)') },
            { v: 'own', label: t('Buatan sendiri') },
          ]}
        />
      </div>
      {list && (
        <>
          {list.map((c, k) => (
            <div key={k} className="card-row">
              <span className="card-no">{k + 1}</span>
              <div className="grow card-fields">
                <input className="input" value={c.text} maxLength={200} placeholder={t('Teks kartu')} aria-label={t('Teks kartu')} onChange={(x) => setList(list.map((y, i) => (i === k ? { ...y, text: x.target.value } : y)))} />
                <div className="row">
                  <select className="input sm" value={c.effect.kind} aria-label={t('Efek kartu')} onChange={(x) => setList(list.map((y, i) => (i === k ? { ...y, effect: defaultEffect(x.target.value as Kind) } : y)))}>
                    {KINDS.map((o) => (
                      <option key={o.v} value={o.v}>
                        {t(o.label)}
                      </option>
                    ))}
                  </select>
                  <EffectFields e={c.effect} theme={draft} onChange={(effect) => setList(list.map((y, i) => (i === k ? { ...y, effect } : y)))} />
                </div>
              </div>
              <button className="icon-btn" aria-label={t('Hapus kartu')} disabled={list.length <= 1} onClick={() => setList(list.filter((_, i) => i !== k))}>
                <Trash size={16} />
              </button>
            </div>
          ))}
          <button className="btn sm" disabled={list.length >= MAX_CUSTOM_CARDS} onClick={() => setList([...list, { text: '', effect: defaultEffect('money') }])}>
            <Plus size={14} /> {t('Tambah kartu')} ({list.length}/{MAX_CUSTOM_CARDS})
          </button>
        </>
      )}
    </section>
  );
}

function TileFxEditor({ draft, up }: { draft: Theme; up: (p: Partial<Theme>) => void }) {
  const fx = draft.tileFx ?? {};
  const rows = Object.entries(fx).sort((a, b) => +a[0] - +b[0]);
  const set = (next: Record<string, TileFx>) => up({ tileFx: Object.keys(next).length ? next : undefined });
  const free = BOARD.map((_, i) => i).find((i) => !(String(i) in fx));
  return (
    <section className="card-deck-edit">
      <div className="row">
        <b className="grow">{t('Efek saat mendarat di petak')}</b>
        {!rows.length && (
          <button className="btn sm" onClick={() => set(structuredClone(SAMPLE_TILE_FX))}>
            <Sparkles size={14} /> {t('Isi contoh')}
          </button>
        )}
      </div>
      {rows.map(([k, f]) => (
        <div key={k} className="card-row">
          <div className="grow card-fields">
            <div className="row">
              <select
                className="input sm"
                value={k}
                aria-label={t('Petak')}
                onChange={(x) => {
                  const next = { ...fx };
                  delete next[k];
                  next[x.target.value] = f;
                  set(next);
                }}
              >
                {BOARD.map((_, i) => (
                  <option key={i} value={i} disabled={String(i) !== k && String(i) in fx}>
                    {i}. {tileName(draft, i)}
                  </option>
                ))}
              </select>
              <select className="input sm" value={f.anim ?? ''} aria-label={t('Animasi')} onChange={(x) => set({ ...fx, [k]: { ...f, anim: x.target.value || undefined } })}>
                <option value="">{t('— emoji saja —')}</option>
                {ALL_ANIMS.map((a) => (
                  <option key={a} value={a}>
                    {a}
                  </option>
                ))}
              </select>
              <input className="input sm emoji-in" value={f.emoji ?? ''} maxLength={16} placeholder="🎉" aria-label="Emoji" onChange={(x) => set({ ...fx, [k]: { ...f, emoji: x.target.value || undefined } })} />
            </div>
            <input className="input" value={f.caption ?? ''} maxLength={80} placeholder={t('Keterangan, mis. "Pesta kembang api!"')} aria-label={t('Keterangan')} onChange={(x) => set({ ...fx, [k]: { ...f, caption: x.target.value || undefined } })} />
          </div>
          <button
            className="icon-btn"
            aria-label={t('Hapus efek')}
            onClick={() => {
              const next = { ...fx };
              delete next[k];
              set(next);
            }}
          >
            <Trash size={16} />
          </button>
        </div>
      ))}
      {free !== undefined && (
        <button className="btn sm" onClick={() => set({ ...fx, [String(free)]: { emoji: '✨', caption: '' } })}>
          <Plus size={14} /> {t('Tambah efek petak')}
        </button>
      )}
    </section>
  );
}

export function ThemeCards({ draft, up }: { draft: Theme; up: (p: Partial<Theme>) => void }) {
  useLang();
  return (
    <div className="form">
      <p className="muted small">
        {t('Kartu & efek ini ikut tersimpan di file JSON tema. Di room online, semua pemain memakai kartu & efek tema milik host. Di teks kartu boleh pakai {m:100} untuk uang, {m:go} untuk gaji START, dan {t:39} untuk nama petak.')}
      </p>
      <DeckEditor deck="chance" draft={draft} up={up} />
      <DeckEditor deck="community" draft={draft} up={up} />
      <TileFxEditor draft={draft} up={up} />
    </div>
  );
}
