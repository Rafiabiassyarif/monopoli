// Pengaturan sumber musik latar: musik bawaan (otomatis ikut tema) atau link audio sendiri.

import { useState, useSyncExternalStore } from 'react';
import { Link2, Play, SkipForward } from 'lucide-react';
import { linkStatus, musicSource, musicUrls, nextTrack, onLinkStatus, setMusicSource, type MusicSource } from './music';
import { t, tr, useLang } from './i18n';
import { Seg } from './ui';

export function MusicLink() {
  useLang();
  const [src, setSrc] = useState<MusicSource>(musicSource());
  const [text, setText] = useState(musicUrls());
  const [err, setErr] = useState<string | null>(null);
  const status = useSyncExternalStore(onLinkStatus, linkStatus, linkStatus);
  const count = musicUrls() ? musicUrls().split('\n').length : 0;

  const pick = (v: MusicSource) => {
    setSrc(v);
    setErr(null);
    // pindah ke "link" tanpa link tersimpan: tunggu pengguna mengisi dulu
    if (v === 'auto' || musicUrls()) setMusicSource(v);
  };
  const save = () => {
    const e = setMusicSource('link', text);
    setErr(e);
    if (!e) setText(musicUrls());
  };

  return (
    <div className="music-src">
      <Seg
        value={src}
        onChange={pick}
        options={[
          { v: 'auto', label: t('Bawaan (ikut tema)') },
          {
            v: 'link',
            label: (
              <>
                <Link2 size={14} /> {t('Link sendiri')}
              </>
            ),
          },
        ]}
      />
      {src === 'link' && (
        <>
          <textarea
            className="input music-urls"
            rows={3}
            spellCheck={false}
            placeholder={'https://contoh.com/lagu.mp3\nhttps://stream.radio.com/live'}
            value={text}
            aria-label={t('Link musik (satu per baris)')}
            onChange={(e) => setText(e.target.value)}
          />
          <div className="row">
            <button type="button" className="btn sm primary" onClick={save} disabled={!text.trim()}>
              <Play size={14} /> {t('Simpan & putar')}
            </button>
            {count > 1 && (
              <button type="button" className="btn sm" onClick={nextTrack}>
                <SkipForward size={14} /> {t('Lagu berikutnya')}
              </button>
            )}
            <span className="muted small grow">
              {status.state === 'playing'
                ? count > 1
                  ? t('Memutar lagu {n} dari {total}', { n: status.index + 1, total: count })
                  : t('Sedang diputar')
                : status.state === 'loading'
                  ? t('Memuat…')
                  : ''}
            </span>
          </div>
          {(err || status.state === 'error') && (
            <div className="notice danger small" role="alert">
              {err ? tr(err) : `${count > 1 ? t('Lagu {n}', { n: status.index + 1 }) + ': ' : ''}${tr(status.error ?? '')}`}
            </div>
          )}
          <span className="muted small">{t('Satu link per baris: file audio (.mp3, .ogg, .m4a, .wav) atau radio streaming. Link berbagi Google Drive & Dropbox otomatis diubah. YouTube & Spotify tidak didukung.')}</span>
        </>
      )}
    </div>
  );
}
