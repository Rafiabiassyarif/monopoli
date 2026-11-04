// Studio tema → tab "Kartu & efek": kartu Kesempatan/Dana Umum buatan sendiri (teks + efek) dan
// efek khusus saat mendarat di petak. Semua tersimpan di JSON tema (decks, tileFx), jadi ikut saat
// tema diekspor/impor dan dipakai juga oleh pemain lain di room online milik host.

import { BOARD, MAX_CUSTOM_CARDS, formatMoney, type CardEffect, type CustomCard, type Theme, type TileFx } from '@monopoli/engine';
import { Plus, Sparkles, Trash } from 'lucide-react';
import { Component, useState, type ErrorInfo, type ReactNode } from 'react';
import { getLang, t, useLang } from './i18n';
import { tileName } from './names';
import { ALL_ANIMS, ANIM_LABELS } from './tileAnims';
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

function EffectFields({ e, theme, onChange }: { e: CardEffect; theme: Theme; onChange: (e: CardEffect) => void }) {
  const tiles = (value: number, set: (n: number) => void) => (
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
            <select
              className="input sm effect-kind-select"
              value={effect.kind}
              aria-label={t('Efek kartu')}
              onChange={(x) => onChange({ ...card, effect: defaultEffect(x.target.value as Kind) })}
            >
              {KINDS.map((o) => (
                <option key={o.v} value={o.v}>
                  {t(o.label)}
                </option>
              ))}
            </select>
            <EffectFields e={effect} theme={theme} onChange={(nextEffect) => onChange({ ...card, effect: nextEffect })} />
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
  const name = (deck === 'chance' ? draft?.deckNames?.chance : draft?.deckNames?.community) || defaultDeckName;
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

function TileFxEditor({ draft, up }: { draft: Theme; up: (p: Partial<Theme>) => void }) {
  const fx = draft?.tileFx ?? {};
  const rows = Object.entries(fx).sort((a, b) => +a[0] - +b[0]);
  const set = (next: Record<string, TileFx>) => up({ tileFx: Object.keys(next).length ? next : undefined });
  const free = BOARD.map((_, i) => i).find((i) => !(String(i) in fx));

  return (
    <section className="card-deck-panel">
      <div className="card-deck-header-bar">
        <div className="card-deck-title-group">
          <h3 className="card-deck-heading">✨ {t('Efek saat mendarat di petak')}</h3>
          <span className="card-deck-badge">
            {rows.length} {t('petak aktif')}
          </span>
        </div>
        {!rows.length && (
          <button type="button" className="btn sm primary" onClick={() => set(structuredClone(SAMPLE_TILE_FX))}>
            <Sparkles size={14} /> {t('Isi contoh rekomendasi')}
          </button>
        )}
      </div>

      <p className="card-panel-desc">
        {t('Tampilkan animasi 3D, emoji, dan pesan ucapan seru saat bidak pemain singgah di petak tertentu.')}
      </p>

      {!rows.length ? (
        <div className="card-default-state-box">
          <div className="card-default-state-icon">✨</div>
          <div className="card-default-state-content">
            <h4>{t('Belum Ada Efek Khusus')}</h4>
            <p>{t('Semua petak berjalan dengan animasi standar. Kamu bisa mengisi contoh rekomendasi atau menambahkan efek sendiri.')}</p>
            <button type="button" className="btn sm primary" onClick={() => set(structuredClone(SAMPLE_TILE_FX))}>
              <Sparkles size={14} /> {t('Isi contoh rekomendasi')}
            </button>
          </div>
        </div>
      ) : (
        <div className="tile-fx-stack">
          {rows.map(([k, f]) => {
            const tileIdx = +k;
            const name = tileName(draft, tileIdx);
            return (
              <div key={k} className="tile-fx-item-box">
                <div className="tile-fx-item-header">
                  <div className="tile-fx-title-pill">
                    <span className="tile-fx-idx">#{tileIdx}</span>
                    <span className="tile-fx-name">{name}</span>
                  </div>
                  <button
                    type="button"
                    className="icon-btn delete-card-btn"
                    title={t('Hapus efek')}
                    aria-label={t('Hapus efek')}
                    onClick={() => {
                      const next = { ...fx };
                      delete next[k];
                      set(next);
                    }}
                  >
                    <Trash size={15} />
                  </button>
                </div>

                <div className="tile-fx-form-grid">
                  <div className="tile-fx-field">
                    <label className="card-field-label">{t('Petak tujuan:')}</label>
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
                  </div>

                  <div className="tile-fx-field">
                    <label className="card-field-label">{t('Animasi 3D:')}</label>
                    <select
                      className="input sm"
                      value={f?.anim ?? ''}
                      aria-label={t('Animasi')}
                      onChange={(x) => set({ ...fx, [k]: { ...f, anim: x.target.value || undefined } })}
                    >
                      <option value="">{t('— emoji saja —')}</option>
                      {ALL_ANIMS.map((a) => {
                        const info = ANIM_LABELS[a];
                        const label = info ? `${info[0]} ${info[1]}` : a;
                        return (
                          <option key={a} value={a}>
                            {label}
                          </option>
                        );
                      })}
                    </select>
                  </div>

                  <div className="tile-fx-field tile-fx-field-emoji">
                    <label className="card-field-label">Emoji:</label>
                    <input
                      className="input sm emoji-in"
                      value={f?.emoji ?? ''}
                      maxLength={16}
                      placeholder="🎉"
                      aria-label="Emoji"
                      onChange={(x) => set({ ...fx, [k]: { ...f, emoji: x.target.value || undefined } })}
                    />
                  </div>
                </div>

                <div className="tile-fx-caption-row">
                  <label className="card-field-label">{t('Pesan ucapan:')}</label>
                  <input
                    className="input"
                    value={f?.caption ?? ''}
                    maxLength={80}
                    placeholder={t('Contoh: Pesta kembang api meriah!')}
                    aria-label={t('Keterangan')}
                    onChange={(x) => set({ ...fx, [k]: { ...f, caption: x.target.value || undefined } })}
                  />
                </div>
              </div>
            );
          })}

          {free !== undefined && (
            <div className="tile-fx-bottom-actions">
              <button
                type="button"
                className="btn sm"
                onClick={() => set({ ...fx, [String(free)]: { emoji: '✨', caption: '' } })}
              >
                <Plus size={14} /> {t('Tambah efek petak')}
              </button>
            </div>
          )}
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

  const chanceName = draft?.deckNames?.chance || t('Kesempatan');
  const communityName = draft?.deckNames?.community || t('Dana Umum');

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
