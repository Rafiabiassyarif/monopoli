// Studio tema → tab "Kartu & efek": kartu Kesempatan/Dana Umum buatan sendiri (teks + efek) dan
// efek khusus saat mendarat di petak. Semua tersimpan di JSON tema (decks, tileFx), jadi ikut saat
// tema diekspor/impor dan dipakai juga oleh pemain lain di room online milik host.

import { BOARD, CUSTOM_MOTIONS, CUSTOM_SOUNDS, MAX_CUSTOM_CARDS, formatMoney, type CardEffect, type CustomAnim, type CustomCard, type CustomSound, type Theme, type TileFx } from '@monopoli/engine';
import { ChevronDown, Pause, Play, Plus, RotateCcw, Sparkles, Trash } from 'lucide-react';
import { Component, useEffect, useRef, useState, type ErrorInfo, type ReactNode } from 'react';
import { getLang, t, tName, useLang } from './i18n';
import { tileName } from './names';
import { ALL_ANIMS, ANIM_LABELS, graphemes, tileAnimFor } from './tileAnims';
import { CustomFx, MOTION_INFO } from './CustomFx';
import { sfx } from './sfx';
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

function cardEffectSummary(e: CardEffect, theme: Theme): { icon: string; text: string; badgeClass: string } {
  switch (e.kind) {
    case 'money':
      return e.amount >= 0
        ? { icon: '💰', text: `+${formatMoney(theme, e.amount)}`, badgeClass: 'pill-pos' }
        : { icon: '💸', text: `-${formatMoney(theme, Math.abs(e.amount))}`, badgeClass: 'pill-neg' };
    case 'eachPlayer':
      return e.amount >= 0
        ? { icon: '👥', text: `+${formatMoney(theme, e.amount)} / ${t('pemain')}`, badgeClass: 'pill-pos' }
        : { icon: '👥', text: `-${formatMoney(theme, Math.abs(e.amount))} / ${t('pemain')}`, badgeClass: 'pill-neg' };
    case 'advance':
      return { icon: '🏃', text: `${tileName(theme, e.to)} (#${e.to})`, badgeClass: 'pill-info' };
    case 'nearest':
      return {
        icon: e.target === 'station' ? '🚆' : '⚡',
        text: e.target === 'station' ? t('Stasiun terdekat') : t('Utilitas terdekat'),
        badgeClass: 'pill-info',
      };
    case 'back':
      return { icon: '↩️', text: `${t('Mundur')} ${e.steps} ${t('langkah')}`, badgeClass: 'pill-warn' };
    case 'jail':
      return { icon: '⛓️', text: t('Masuk penjara'), badgeClass: 'pill-alert' };
    case 'jailFree':
      return { icon: '🎫', text: t('Bebas penjara'), badgeClass: 'pill-special' };
    case 'repairs':
      return { icon: '🛠️', text: `${formatMoney(theme, e.house)} / ${formatMoney(theme, e.hotel)}`, badgeClass: 'pill-warn' };
  }
}

function autoGenerateCardText(e: CardEffect): string {
  const isEn = getLang() === 'en';
  switch (e.kind) {
    case 'money':
      return e.amount >= 0
        ? (isEn ? `Lucky surprise! Collect {m:${e.amount}}.` : `Menang hadiah kejutan! Terima {m:${e.amount}}.`)
        : (isEn ? `Unexpected expense! Pay {m:${Math.abs(e.amount)}}.` : `Kena denda tak terduga. Bayar {m:${Math.abs(e.amount)}}.`);
    case 'eachPlayer':
      return e.amount >= 0
        ? (isEn ? `It's your birthday! Collect {m:${e.amount}} from each player.` : `Hari ulang tahunmu! Terima {m:${e.amount}} dari tiap pemain.`)
        : (isEn ? `Treat everyone to snacks! Pay {m:${Math.abs(e.amount)}} to each player.` : `Traktir teman sekampung: bayar {m:${Math.abs(e.amount)}} ke tiap pemain.`);
    case 'advance':
      return e.to === 0
        ? (isEn ? `Return home to GO. Collect salary {m:go}.` : `Pulang kampung ke START. Terima gaji {m:go}.`)
        : (isEn ? `Holiday trip to {t:${e.to}}. Collect salary if passing GO.` : `Pergi berlibur ke {t:${e.to}}. Lewat START dapat gaji.`);
    case 'nearest':
      return e.target === 'station'
        ? (isEn ? `Ride train to nearest station. If owned, pay 2x rent.` : `Naik kereta ke stasiun terdekat. Kalau dimiliki, bayar sewa 2x lipat.`)
        : (isEn ? `Advance to nearest utility. If owned, roll dice and pay 10x.` : `Maju ke utilitas terdekat. Kalau dimiliki, lempar dadu dan bayar sewa 10x lipat.`);
    case 'back':
      return isEn
        ? `Forgot your wallet, go back ${e.steps} spaces.`
        : `Lupa bawa dompet, putar balik ${e.steps} langkah.`;
    case 'jail':
      return isEn
        ? `Caught breaking the rules! Go to JAIL.`
        : `Ketahuan melanggar aturan! Masuk PENJARA sekarang juga.`;
    case 'jailFree':
      return isEn
        ? `Magic pass: GET OUT OF JAIL FREE. Keep until used.`
        : `Kartu sakti: BEBAS PENJARA. Simpan sampai dipakai.`;
    case 'repairs':
      return isEn
        ? `Property renovation: pay {m:${e.house}} per house and {m:${e.hotel}} per hotel.`
        : `Renovasi bangunan: bayar {m:${e.house}} per rumah dan {m:${e.hotel}} per hotel.`;
  }
}

/** Popover sederhana bergaya gelap (pengganti <select> bawaan yang sulit dibaca). */
function Popover({ label, children, wide }: { label: ReactNode; children: (close: () => void) => ReactNode; wide?: boolean }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const down = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    const key = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    addEventListener('mousedown', down);
    addEventListener('keydown', key);
    return () => (removeEventListener('mousedown', down), removeEventListener('keydown', key));
  }, [open]);
  return (
    <div className="pk" ref={ref}>
      <button type="button" className={`pk-btn ${open ? 'open' : ''}`} onClick={() => setOpen(!open)} aria-expanded={open}>
        {label}
        <ChevronDown size={15} className="pk-caret" />
      </button>
      {open && <div className={`pk-pop ${wide ? 'wide' : ''}`}>{children(() => setOpen(false))}</div>}
    </div>
  );
}

const KIND_ICON: Record<string, string> = { property: '', station: '🚆', utility: '💡', tax: '💰', chance: '❓', community: '🎁', go: '🏁', jail: '⛓️', parking: '☕', gotojail: '👮' };
const tileColor = (theme: Theme, i: number) => (BOARD[i].kind === 'property' ? theme.groupColors[BOARD[i].group!] : '#64748b');

/** Pilih petak: kotak pencarian + daftar 40 petak berwarna sesuai grupnya. */
function TilePicker({ theme, value, onChange, taken }: { theme: Theme; value: number; onChange: (i: number) => void; taken?: Set<number> }) {
  const [q, setQ] = useState('');
  return (
    <Popover
      wide
      label={
        <span className="pk-tile">
          <i style={{ background: tileColor(theme, value) }} />
          <span className="pk-num">#{value}</span>
          <span className="truncate">{tileName(theme, value)}</span>
        </span>
      }
    >
      {(close) => (
        <>
          <input className="input sm pk-search" autoFocus placeholder={t('Cari petak…')} value={q} onChange={(e) => setQ(e.target.value)} />
          <div className="pk-tiles">
            {BOARD.map((b, i) => {
              const name = tileName(theme, i);
              if (q && !`${i} ${name}`.toLowerCase().includes(q.toLowerCase())) return null;
              const busy = taken?.has(i) && i !== value;
              return (
                <button
                  key={i}
                  type="button"
                  disabled={busy}
                  className={`pk-tile-opt ${i === value ? 'on' : ''}`}
                  style={{ ['--c' as string]: tileColor(theme, i) }}
                  onClick={() => (onChange(i), close())}
                  title={busy ? t('Petak ini sudah punya efek') : undefined}
                >
                  <span className="pk-num">#{i}</span>
                  <span className="truncate">{KIND_ICON[b.kind]} {name}</span>
                </button>
              );
            })}
          </div>
        </>
      )}
    </Popover>
  );
}

const KIND_ICONS: Record<Kind, string> = { money: '💰', eachPlayer: '👥', advance: '🏃', nearest: '🚆', back: '↩️', jail: '⛓️', jailFree: '🎫', repairs: '🛠️' };

/** Pilih aksi kartu: kotak-kotak ber-ikon (bukan dropdown). */
function KindPicker({ value, onChange }: { value: Kind; onChange: (k: Kind) => void }) {
  return (
    <div className="kind-grid" role="radiogroup" aria-label={t('Efek kartu')}>
      {KINDS.map((o) => (
        <button key={o.v} type="button" role="radio" aria-checked={o.v === value} className={`kind-opt ${o.v === value ? 'on' : ''}`} onClick={() => o.v !== value && onChange(o.v)}>
          <span className="kind-ico">{KIND_ICONS[o.v]}</span>
          <span>{t(o.label)}</span>
        </button>
      ))}
    </div>
  );
}

function EffectFields({ e, theme, onChange }: { e: CardEffect; theme: Theme; onChange: (e: CardEffect) => void }) {
  const tiles = (value: number, set: (n: number) => void) => <TilePicker theme={theme} value={value} onChange={set} />;
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

function CardItem({
  index,
  card,
  total,
  theme,
  onChange,
  onDelete,
}: {
  index: number;
  card: CustomCard;
  total: number;
  theme: Theme;
  onChange: (next: CustomCard) => void;
  onDelete: () => void;
}) {
  const effect = card?.effect ?? defaultEffect('money');
  const summary = cardEffectSummary(effect, theme);

  const insertToken = (token: string) => {
    const cur = (card?.text ?? '').trim();
    onChange({ ...card, text: cur ? `${cur} ${token}` : token });
  };

  return (
    <div className="card-item-box">
      <div className="card-item-header">
        <div className="card-item-badge-wrap">
          <span className="card-item-number">#{index + 1}</span>
          <span className={`card-effect-pill ${summary.badgeClass}`}>
            <span className="pill-icon">{summary.icon}</span>
            <span className="pill-text">{summary.text}</span>
          </span>
        </div>
        <button
          type="button"
          className="icon-btn delete-card-btn"
          title={t('Hapus kartu')}
          aria-label={t('Hapus kartu')}
          disabled={total <= 1}
          onClick={onDelete}
        >
          <Trash size={15} />
        </button>
      </div>

      <div className="card-item-body">
        {/* Row 1: Aksi kartu */}
        <div className="card-item-row effect-row">
          <label className="card-field-label">{t('Aksi kartu:')}</label>
          <div className="card-controls-wrap">
            <KindPicker value={effect.kind} onChange={(k) => onChange({ ...card, effect: defaultEffect(k) })} />
            {!['jail', 'jailFree'].includes(effect.kind) && (
              <div className="effect-fields">
                <EffectFields e={effect} theme={theme} onChange={(nextEffect) => onChange({ ...card, effect: nextEffect })} />
              </div>
            )}
          </div>
        </div>

        {/* Row 2: Teks cerita kartu */}
        <div className="card-item-row text-row">
          <div className="card-text-header">
            <label className="card-field-label">{t('Teks cerita kartu:')}</label>
            <button
              type="button"
              className="btn-magic-generate"
              title={t('Otomatis isi kalimat yang cocok dengan aksi ini')}
              onClick={() => onChange({ ...card, text: autoGenerateCardText(effect) })}
            >
              <Sparkles size={13} />
              <span>{t('✨ Buatkan kalimat')}</span>
            </button>
          </div>
          <input
            className="input card-text-input"
            value={card?.text ?? ''}
            maxLength={200}
            placeholder={t('Contoh: Hadiah ulang tahun! Terima uang...')}
            aria-label={t('Teks kartu')}
            onChange={(x) => onChange({ ...card, text: x.target.value })}
          />
        </div>

        {/* Row 3: Helper insert tags */}
        <div className="card-helper-bar">
          <span className="helper-label">{t('Bantuan sisip cepat:')}</span>
          <div className="helper-chips">
            {effect.kind === 'money' && (
              <button
                type="button"
                className="chip-tag"
                onClick={() => insertToken(`{m:${Math.abs(effect.amount)}}`)}
              >
                + 💰 {formatMoney(theme, Math.abs(effect.amount))}
              </button>
            )}
            {effect.kind === 'eachPlayer' && (
              <button
                type="button"
                className="chip-tag"
                onClick={() => insertToken(`{m:${Math.abs(effect.amount)}}`)}
              >
                + 💰 {formatMoney(theme, Math.abs(effect.amount))}
              </button>
            )}
            {effect.kind === 'advance' && (
              <>
                <button
                  type="button"
                  className="chip-tag"
                  onClick={() => insertToken(`{t:${effect.to}}`)}
                >
                  + 📍 {tileName(theme, effect.to)}
                </button>
                <button
                  type="button"
                  className="chip-tag"
                  onClick={() => insertToken('{m:go}')}
                >
                  + 🏁 {t('Gaji START')}
                </button>
              </>
            )}
            {effect.kind === 'repairs' && (
              <>
                <button
                  type="button"
                  className="chip-tag"
                  onClick={() => insertToken(`{m:${effect.house}}`)}
                >
                  + 🏠 {formatMoney(theme, effect.house)}
                </button>
                <button
                  type="button"
                  className="chip-tag"
                  onClick={() => insertToken(`{m:${effect.hotel}}`)}
                >
                  + 🏨 {formatMoney(theme, effect.hotel)}
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function DeckEditor({ deck, draft, up }: { deck: Deck; draft: Theme; up: (p: Partial<Theme>) => void }) {
  const list = draft?.decks?.[deck];
  const setList = (l: CustomCard[] | undefined) => {
    const decks = { ...draft.decks, [deck]: l };
    if (!l) delete decks[deck];
    up({ decks: Object.keys(decks).length ? decks : undefined });
  };

  const defaultDeckName = deck === 'chance' ? t('Kesempatan') : t('Dana Umum');
  const name = tName((deck === 'chance' ? draft?.deckNames?.chance : draft?.deckNames?.community) || '') || defaultDeckName;
  const isCustom = !!list;

  return (
    <section className="card-deck-panel">
      <div className="card-deck-header-bar">
        <div className="card-deck-title-group">
          <h3 className="card-deck-heading">
            {deck === 'chance' ? '🎴' : '🎁'} {name}
          </h3>
          <span className="card-deck-badge">
            {isCustom ? `${list.length} / ${MAX_CUSTOM_CARDS} ${t('kartu')}` : t('16 kartu bawaan')}
          </span>
        </div>
        <Seg
          value={isCustom ? 'own' : 'base'}
          onChange={(v) => setList(v === 'own' ? structuredClone(SAMPLE_DECKS[deck]) : undefined)}
          options={[
            { v: 'base', label: t('Kartu bawaan') },
            { v: 'own', label: t('Buatan sendiri') },
          ]}
        />
      </div>

      {!list ? (
        <div className="card-default-state-box">
          <div className="card-default-state-icon">📦</div>
          <div className="card-default-state-content">
            <h4>{t('Menggunakan Kartu Bawaan Monopoli')}</h4>
            <p>
              {t('Dek ini menggunakan 16 kartu klasik yang seimbang (denda, hadiah uang, jalan ke petak khusus, dan penjara).')}
            </p>
            <button
              type="button"
              className="btn sm primary"
              onClick={() => setList(structuredClone(SAMPLE_DECKS[deck]))}
            >
              <Sparkles size={14} /> {t('Mulai Buat Kartu Kustom')}
            </button>
          </div>
        </div>
      ) : (
        <div className="card-items-stack">
          {list.map((c, k) => (
            <CardItem
              key={k}
              index={k}
              card={c}
              total={list.length}
              theme={draft}
              onChange={(next) => setList(list.map((y, i) => (i === k ? next : y)))}
              onDelete={() => setList(list.filter((_, i) => i !== k))}
            />
          ))}

          <div className="card-deck-bottom-actions">
            <button
              type="button"
              className="btn sm"
              disabled={list.length >= MAX_CUSTOM_CARDS}
              onClick={() => setList([...list, { text: '', effect: defaultEffect('money') }])}
            >
              <Plus size={14} /> {t('Tambah kartu')} ({list.length}/{MAX_CUSTOM_CARDS})
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

const QUICK_EMOJI = ['🎉', '🎆', '✨', '💰', '💸', '🪙', '⭐', '❤️', '🔥', '❄️', '🌸', '🍀', '🎈', '🎊', '⚡', '🌈', '🍜', '🚀', '👑', '💎', '🐉', '🦋', '🎵', '🏆'];
const SOUND_INFO: Record<CustomSound, [string, string]> = {
  none: ['🔇', 'Tanpa suara'],
  buy: ['🔔', 'Ting ceria'],
  win: ['🎺', 'Fanfare'],
  pay: ['🪙', 'Koin'],
  card: ['🃏', 'Kartu'],
  jail: ['🚨', 'Sirene'],
};
const defaultCustom = (emoji?: string): CustomAnim => ({ motion: 'burst', emojis: emoji || '🎉✨', count: 12, size: 1, speed: 1, sound: 'none' });
type FxMode = 'builtin' | 'custom' | 'emoji';
const modeOf = (f: TileFx): FxMode => (f.custom ? 'custom' : f.anim ? 'builtin' : 'emoji');

function Slider({ label, value, min, max, step, fmt, onChange }: { label: string; value: number; min: number; max: number; step: number; fmt: (v: number) => string; onChange: (v: number) => void }) {
  return (
    <label className="fx-slider">
      <span className="fx-slider-top">
        <span>{label}</span>
        <b>{fmt(value)}</b>
      </span>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(+e.target.value)} />
    </label>
  );
}

/** Pratinjau petak + animasinya (buatan sendiri: diputar langsung; bawaan: ikon + keterangan). */
function FxPreview({ theme, tile, f }: { theme: Theme; tile: number; f: TileFx }) {
  const [run, setRun] = useState(0);
  const [loop, setLoop] = useState(true);
  const info = tileAnimFor({ ...theme, tileFx: { [String(tile)]: f } }, tile);
  return (
    <div className="fx-preview">
      <div className="fx-stage" style={{ ['--c' as string]: tileColor(theme, tile) }}>
        <div className="fx-tile">
          <span className="fx-tile-band" />
          <span className="fx-tile-name">{tileName(theme, tile)}</span>
        </div>
        <div className="fx-stage-anim">
          {f.custom ? (
            <CustomFx anim={f.custom} px={150} loop={loop} runKey={run} sound={!loop && run > 0} />
          ) : (
            <span key={run} className="fx-emoji-pop">{info?.emoji ?? f.emoji ?? '✨'}</span>
          )}
        </div>
        {(f.caption || info?.caption) && (
          <div className="fx-cap" key={`c${run}`}>
            {info?.emoji} {f.caption || info?.caption}
          </div>
        )}
      </div>
      <div className="fx-preview-actions">
        <button type="button" className="btn sm" onClick={() => (setLoop(false), setRun((n) => n + 1))}>
          <RotateCcw size={14} /> {t('Putar sekali')}
        </button>
        {f.custom && (
          <button type="button" className="btn sm ghost" onClick={() => setLoop(!loop)}>
            {loop ? <Pause size={14} /> : <Play size={14} />} {loop ? t('Henti ulang') : t('Ulang terus')}
          </button>
        )}
      </div>
      {!f.custom && f.anim && <p className="muted small fx-note">{t('Animasi 3D bawaan tampil lengkap saat bermain di papan 3D.')}</p>}
    </div>
  );
}

function TileFxRow({ k, f, draft, taken, set, remove }: { k: string; f: TileFx; draft: Theme; taken: Set<number>; set: (key: string, next: TileFx, oldKey?: string) => void; remove: () => void }) {
  const tileIdx = +k;
  const mode = modeOf(f);
  const upd = (p: Partial<TileFx>) => set(k, { ...f, ...p });
  const updC = (p: Partial<CustomAnim>) => upd({ custom: { ...(f.custom ?? defaultCustom(f.emoji)), ...p } });
  const setMode = (m: FxMode) => {
    if (m === 'custom') set(k, { caption: f.caption, custom: f.custom ?? defaultCustom(f.emoji) });
    else if (m === 'builtin') set(k, { caption: f.caption, emoji: f.emoji, anim: f.anim ?? 'fireworks' });
    else set(k, { caption: f.caption, emoji: f.emoji ?? (f.custom ? graphemes(f.custom.emojis)[0] : undefined) ?? '✨' });
  };
  const c = f.custom;
  return (
    <div className="fx-row">
      <div className="fx-row-head">
        <TilePicker
          theme={draft}
          value={tileIdx}
          taken={taken}
          onChange={(to) => {
            if (to === tileIdx) return;
            set(String(to), f, k);
          }}
        />
        <button type="button" className="icon-btn delete-card-btn" title={t('Hapus efek')} aria-label={t('Hapus efek')} onClick={remove}>
          <Trash size={15} />
        </button>
      </div>

      <div className="fx-row-body">
        <div className="fx-settings">
          <Seg
            value={mode}
            onChange={setMode}
            options={[
              { v: 'custom', label: <>🎨 {t('Buat sendiri')}</> },
              { v: 'builtin', label: <>🎬 {t('Animasi bawaan')}</> },
              { v: 'emoji', label: <>😀 {t('Emoji saja')}</> },
            ]}
          />

          {mode === 'custom' && c && (
            <>
              <div className="fx-field">
                <span className="card-field-label">{t('Gerakan')}</span>
                <div className="motion-grid">
                  {CUSTOM_MOTIONS.map((m) => (
                    <button key={m} type="button" className={`motion-opt ${c.motion === m ? 'on' : ''}`} onClick={() => updC({ motion: m })}>
                      <span className="kind-ico">{MOTION_INFO[m][0]}</span>
                      <span>{t(MOTION_INFO[m][1])}</span>
                    </button>
                  ))}
                </div>
              </div>
              <div className="fx-field">
                <span className="card-field-label">{t('Emoji yang beterbangan (maks 4)')}</span>
                <div className="emoji-row">
                  <input className="input emoji-big" value={c.emojis} maxLength={24} onChange={(e) => updC({ emojis: e.target.value })} aria-label={t('Emoji')} />
                  <button type="button" className="btn sm ghost" onClick={() => updC({ emojis: '' })}>
                    {t('Kosongkan')}
                  </button>
                </div>
                <div className="emoji-palette">
                  {QUICK_EMOJI.map((em) => (
                    <button
                      key={em}
                      type="button"
                      className="emoji-chip"
                      onClick={() => {
                        const cur = graphemes(c.emojis);
                        updC({ emojis: (cur.length >= 4 ? [...cur.slice(1), em] : [...cur, em]).join('') });
                      }}
                    >
                      {em}
                    </button>
                  ))}
                </div>
              </div>
              <div className="fx-sliders">
                <Slider label={t('Jumlah')} value={c.count} min={1} max={30} step={1} fmt={(v) => String(v)} onChange={(v) => updC({ count: v })} />
                <Slider label={t('Ukuran')} value={c.size} min={0.5} max={2.5} step={0.1} fmt={(v) => `${v.toFixed(1)}×`} onChange={(v) => updC({ size: v })} />
                <Slider label={t('Kecepatan')} value={c.speed} min={0.5} max={2} step={0.1} fmt={(v) => `${v.toFixed(1)}×`} onChange={(v) => updC({ speed: v })} />
              </div>
              <div className="fx-field fx-inline">
                <label className="fx-glow-toggle">
                  <input type="checkbox" checked={!!c.glow} onChange={(e) => updC({ glow: e.target.checked ? '#fbbf24' : undefined })} />
                  <span>{t('Cahaya di belakang')}</span>
                </label>
                {c.glow && <input type="color" className="color-input" value={c.glow} onChange={(e) => updC({ glow: e.target.value })} aria-label={t('Warna cahaya')} />}
              </div>
              <div className="fx-field">
                <span className="card-field-label">{t('Suara')}</span>
                <div className="sound-row">
                  {CUSTOM_SOUNDS.map((snd) => (
                    <button key={snd} type="button" className={`sound-opt ${(c.sound ?? 'none') === snd ? 'on' : ''}`} onClick={() => (updC({ sound: snd }), snd !== 'none' && sfx(snd))}>
                      {SOUND_INFO[snd][0]} {t(SOUND_INFO[snd][1])}
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}

          {mode === 'builtin' && (
            <div className="fx-field">
              <span className="card-field-label">{t('Pilih animasi 3D')}</span>
              <div className="anim-grid">
                {ALL_ANIMS.map((a) => (
                  <button key={a} type="button" className={`anim-opt ${f.anim === a ? 'on' : ''}`} onClick={() => upd({ anim: a })} title={t(ANIM_LABELS[a]?.[1] ?? a)}>
                    <span className="kind-ico">{ANIM_LABELS[a]?.[0] ?? '✨'}</span>
                    <span className="truncate">{t(ANIM_LABELS[a]?.[1] ?? a)}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {mode === 'emoji' && (
            <div className="fx-field">
              <span className="card-field-label">{t('Emoji')}</span>
              <div className="emoji-row">
                <input className="input emoji-big" value={f.emoji ?? ''} maxLength={16} onChange={(e) => upd({ emoji: e.target.value || undefined })} aria-label="Emoji" />
              </div>
              <div className="emoji-palette">
                {QUICK_EMOJI.map((em) => (
                  <button key={em} type="button" className="emoji-chip" onClick={() => upd({ emoji: em })}>
                    {em}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="fx-field">
            <span className="card-field-label">{t('Pesan ucapan:')}</span>
            <input className="input" value={f.caption ?? ''} maxLength={80} placeholder={t('Contoh: Pesta kembang api meriah!')} aria-label={t('Keterangan')} onChange={(x) => upd({ caption: x.target.value || undefined })} />
          </div>
        </div>

        <FxPreview theme={draft} tile={tileIdx} f={f} />
      </div>
    </div>
  );
}

function TileFxEditor({ draft, up }: { draft: Theme; up: (p: Partial<Theme>) => void }) {
  const fx = draft?.tileFx ?? {};
  const rows = Object.entries(fx).sort((a, b) => +a[0] - +b[0]);
  const save = (next: Record<string, TileFx>) => up({ tileFx: Object.keys(next).length ? next : undefined });
  const taken = new Set(Object.keys(fx).map(Number));
  const free = BOARD.map((_, i) => i).find((i) => !taken.has(i));
  const set = (key: string, next: TileFx, oldKey?: string) => {
    const copy = { ...fx };
    if (oldKey !== undefined) delete copy[oldKey];
    copy[key] = next;
    save(copy);
  };

  return (
    <section className="card-deck-panel">
      <div className="card-deck-header-bar">
        <div className="card-deck-title-group">
          <h3 className="card-deck-heading">✨ {t('Efek saat mendarat di petak')}</h3>
          <span className="card-deck-badge">
            {rows.length} {t('petak aktif')}
          </span>
        </div>
        {free !== undefined && rows.length > 0 && (
          <button type="button" className="btn sm primary" onClick={() => set(String(free), { custom: defaultCustom(), caption: '' })}>
            <Plus size={14} /> {t('Tambah efek petak')}
          </button>
        )}
      </div>

      <p className="card-panel-desc">{t('Buat animasimu sendiri: pilih gerakan, emoji, jumlah, ukuran, kecepatan, cahaya, dan suara — lihat hasilnya langsung di pratinjau. Atau pakai animasi 3D bawaan.')}</p>

      {!rows.length ? (
        <div className="card-default-state-box">
          <div className="card-default-state-icon">✨</div>
          <div className="card-default-state-content">
            <h4>{t('Belum Ada Efek Khusus')}</h4>
            <p>{t('Semua petak berjalan dengan animasi standar. Kamu bisa mengisi contoh rekomendasi atau menambahkan efek sendiri.')}</p>
            <div className="row">
              <button type="button" className="btn sm primary" onClick={() => set('0', { custom: defaultCustom('💰🪙'), caption: t('Gajian!') })}>
                <Plus size={14} /> {t('Buat efek pertama')}
              </button>
              <button type="button" className="btn sm" onClick={() => save(structuredClone(SAMPLE_TILE_FX))}>
                <Sparkles size={14} /> {t('Isi contoh rekomendasi')}
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="tile-fx-stack">
          {rows.map(([k, f]) => (
            <TileFxRow
              key={k}
              k={k}
              f={f ?? {}}
              draft={draft}
              taken={taken}
              set={set}
              remove={() => {
                const next = { ...fx };
                delete next[k];
                save(next);
              }}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function ThemeCardsInner({ draft, up }: { draft: Theme; up: (p: Partial<Theme>) => void }) {
  useLang();
  const [tab, setTab] = useState<'chance' | 'community' | 'tileFx'>('chance');

  const chanceDeck = draft?.decks?.chance;
  const communityDeck = draft?.decks?.community;
  const tileFxCount = draft?.tileFx ? Object.keys(draft.tileFx).length : 0;

  const chanceName = tName(draft?.deckNames?.chance || '') || t('Kesempatan');
  const communityName = tName(draft?.deckNames?.community || '') || t('Dana Umum');

  return (
    <div className="theme-cards-wrapper">
      {/* Friendly Guide Callout */}
      <div className="theme-cards-guide-banner">
        <div className="guide-icon">💡</div>
        <div className="guide-text">
          <h4 className="guide-title">{t('Kustomisasi Kartu & Efek Petak')}</h4>
          <p className="guide-desc">
            {t('Pilih tab di bawah untuk mengatur kartu atau efek petak. Klik tombol ✨ untuk membuatkan kalimat otomatis tanpa perlu mengetik manual!')}
          </p>
        </div>
      </div>

      {/* Subtabs Navigation */}
      <div className="card-subtabs-nav" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'chance'}
          className={`card-subtab-pill ${tab === 'chance' ? 'active' : ''}`}
          onClick={() => setTab('chance')}
        >
          <span className="pill-ico">🎴</span>
          <span className="pill-name">{chanceName}</span>
          <span className="pill-badge">
            {chanceDeck ? `${chanceDeck.length} ${t('kartu')}` : t('Bawaan')}
          </span>
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={tab === 'community'}
          className={`card-subtab-pill ${tab === 'community' ? 'active' : ''}`}
          onClick={() => setTab('community')}
        >
          <span className="pill-ico">🎁</span>
          <span className="pill-name">{communityName}</span>
          <span className="pill-badge">
            {communityDeck ? `${communityDeck.length} ${t('kartu')}` : t('Bawaan')}
          </span>
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={tab === 'tileFx'}
          className={`card-subtab-pill ${tab === 'tileFx' ? 'active' : ''}`}
          onClick={() => setTab('tileFx')}
        >
          <span className="pill-ico">✨</span>
          <span className="pill-name">{t('Efek Animasi Petak')}</span>
          <span className="pill-badge">
            {tileFxCount ? `${tileFxCount} ${t('efek')}` : t('Standar')}
          </span>
        </button>
      </div>

      {/* Tab Panels */}
      {tab === 'chance' && <DeckEditor deck="chance" draft={draft} up={up} />}
      {tab === 'community' && <DeckEditor deck="community" draft={draft} up={up} />}
      {tab === 'tileFx' && <TileFxEditor draft={draft} up={up} />}
    </div>
  );
}

class SafeBoundary extends Component<{ children: ReactNode }, { hasError: boolean; error?: Error }> {
  override state = { hasError: false, error: undefined as Error | undefined };
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }
  override componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ThemeCards Error]', error, info);
  }
  override render() {
    if (this.state.hasError) {
      return (
        <div className="card-default-state-box" style={{ border: '1px solid var(--danger)' }}>
          <div className="card-default-state-icon">⚠️</div>
          <div className="card-default-state-content">
            <h4>{t('Gagal memuat kartu')}</h4>
            <p className="muted small">{this.state.error?.message}</p>
            <button type="button" className="btn sm primary" onClick={() => this.setState({ hasError: false })}>
              {t('Coba lagi')}
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export function ThemeCards({ draft, up }: { draft: Theme; up: (p: Partial<Theme>) => void }) {
  return (
    <SafeBoundary>
      <ThemeCardsInner draft={draft} up={up} />
    </SafeBoundary>
  );
}
