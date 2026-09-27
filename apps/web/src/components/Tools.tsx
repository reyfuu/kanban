import { useEffect, useState } from 'react';
import type { UserCard } from '../types/kanban';
import { CATALOG_META, DAY_NAMES, farmingForDay, serverDay } from '../lib/farming';
import { Avatar, Icon } from './ui';

export function FarmingCalendar({ cards, boardName }: { cards: UserCard[]; boardName: string }) {
  const [day, setDay] = useState(0);
  const [server, setServer] = useState(8);
  const [game, setGame] = useState('ALL');
  const [scope, setScope] = useState('all');
  const [category, setCategory] = useState('talent');
  const [search, setSearch] = useState('');
  useEffect(() => setDay(serverDay(Date.now(), server)), [server]);
  const results = farmingForDay(day, game, category, search, scope === 'board' ? cards : undefined);
  const characterCount = new Set(results.flatMap(target => target.characters.map(character => character.id))).size;
  return <div className="tool-content farming-content">
    <div className="farming-controls"><label>Game<select value={game} onChange={event => setGame(event.target.value)}><option value="ALL">Semua game</option><option value="GENSHIN_IMPACT">Genshin Impact</option><option value="ZENLESS_ZONE_ZERO">Zenless Zone Zero</option></select></label><label>Karakter<select value={scope} onChange={event => setScope(event.target.value)}><option value="all">Seluruh katalog</option><option value="board">{boardName}</option></select></label><label>Server<select value={server} onChange={event => setServer(+event.target.value)}><option value={8}>Asia / TW-HK-MO (UTC+8)</option><option value={1}>Europe (UTC+1)</option><option value={-5}>America (UTC−5)</option></select></label></div>
    <div className="day-tabs" aria-label="Pilih hari">{DAY_NAMES.map((label, index) => <button key={label} aria-pressed={day === index} className={day === index ? 'active' : ''} onClick={() => setDay(index)}>{label.slice(0, 3)}</button>)}</div>
    <div className="farming-heading"><div><h2>Farming {DAY_NAMES[day]}</h2><p className="muted">{results.length} material untuk {characterCount} karakter. Reset hari pukul 04.00 waktu server.</p></div><button className="text-button" onClick={() => setDay(serverDay(Date.now(), server))}>Hari ini</button></div>
    <div className="farming-controls"><label>Jenis material<select value={category} onChange={event => setCategory(event.target.value)}><option value="talent">Talenta / chip</option><option value="ascension">Promosi agen</option><option value="specialty">Local specialty</option><option value="weapon">Material senjata</option><option value="boss">Boss / Expert Challenge</option><option value="weekly">Boss mingguan / Notorious Hunt</option><option value="all">Semua material</option></select></label><label className="search-field"><Icon name="search" /><span className="sr-only">Cari material atau karakter</span><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Cari material atau karakter..." /></label></div>
    <details className="farming-help"><summary>Tentang jadwal farming</summary><p className="help-text">Domain talenta Genshin mengikuti rotasi hari. Farming ZZZ tersedia setiap hari; hadiah mingguan tetap memiliki batas. Filter papan memakai karakter dan nama senjata yang kamu catat. Local specialty memiliki waktu respawn. Daftar menunjukkan kecocokan material, bukan inventori atau sisa kuota akun.</p></details>
    {!results.length && <div className="empty-inline">{scope === 'board' && !cards.length ? 'Papan ini belum memiliki karakter. Tambahkan karakter di papan atau pilih Seluruh katalog.' : 'Tidak ada material yang cocok untuk hari dan filter ini.'}</div>}
    <div className="farming-targets">{results.map(target => <article className="farming-target" key={target.id}><div className="material-heading"><Avatar name={target.name} src={target.iconUrl} /><div><small>{target.game === 'GENSHIN_IMPACT' ? 'Genshin Impact' : 'Zenless Zone Zero'}</small><h3>{target.name}</h3><p>{target.location}</p></div></div><p className="farming-days"><Icon name="calendar" size={14} />{target.days.length === 7 ? 'Setiap hari' : target.days.map(day => DAY_NAMES[day]).join(' · ')}</p><details open={results.length <= 3}><summary>{target.category === 'weapon' ? `Untuk ${target.weapons.length} senjata` : `Untuk ${target.characters.length} karakter`}</summary><div className="farming-characters">{target.characters.map(character => <span key={character.id}><Avatar name={character.name} src={character.avatarUrl} />{character.name}</span>)}{target.weapons.map(name => <span key={name}>{name}</span>)}</div></details></article>)}</div>
    <p className="catalog-credit">Snapshot {new Date(CATALOG_META.fetchedAt).toLocaleDateString('id-ID', { timeZone: 'UTC' })} · <a href="https://github.com/theBowja/genshin-db" target="_blank" rel="noreferrer">genshin-db</a> dan <a href="https://zzz.nanoka.cc/" target="_blank" rel="noreferrer">Nanoka</a> / <a href="https://github.com/EnkaNetwork/API-docs" target="_blank" rel="noreferrer">Enka</a>. Pembaruan katalog mengikuti sumber komunitas.</p>
  </div>;
}

const INITIAL_GACHA = { primogems: 0, fates: 0, polychrome: 0, tapes: 0, pity: 0, guaranteed: false };
export function GachaPlanner() {
  const [value, setValue] = useState(INITIAL_GACHA);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    try {
      const raw = localStorage.getItem('hoyokanban_gacha_v1');
      if (raw) {
        const data = JSON.parse(raw);
        if (!data || typeof data.guaranteed !== 'boolean' || !['primogems', 'fates', 'polychrome', 'tapes', 'pity'].every(key => Number.isSafeInteger(data[key]) && data[key] >= 0 && data[key] <= (key === 'pity' ? 89 : 1000000000))) throw new Error('invalid');
        setValue(data);
      }
      setReady(true);
    } catch { setError('Data gacha tidak dapat dimuat. Periksa penyimpanan browser.'); }
  }, []);
  function update(next: typeof value) {
    setValue(next);
    try { localStorage.setItem('hoyokanban_gacha_v1', JSON.stringify(next)); setError(''); } catch { setError('Perubahan belum tersimpan. Penyimpanan browser mungkin penuh atau diblokir.'); }
  }
  const pulls = Math.floor(value.primogems / 160) + value.fates;
  const zzz = Math.floor(value.polychrome / 160) + value.tapes;
  const toPity = 90 - value.pity;
  return <div className="tool-content">{error && <p className="message error" role="alert">{error}</p>}<p className="notice">Masukkan saldo dan pity secara manual. Data ini belum membaca riwayat wish akun.</p>
    <div className="planner-grid"><section><h2>Genshin Impact</h2><div className="form-grid">{([['primogems', 'Primogem'], ['fates', 'Intertwined Fate'], ['pity', 'Pity saat ini']] as const).map(([key, label]) => <label key={key}>{label}<input disabled={!ready} type="number" min={0} max={key === 'pity' ? 89 : 1000000000} value={value[key]} onChange={event => update({ ...value, [key]: Math.max(0, Math.min(key === 'pity' ? 89 : 1000000000, Math.floor(+event.target.value))) })} /></label>)}<label>Status banner<select disabled={!ready} value={value.guaranteed ? 'yes' : 'no'} onChange={event => update({ ...value, guaranteed: event.target.value === 'yes' })}><option value="no">Belum guarantee</option><option value="yes">Guarantee aktif</option></select></label></div><dl className="data-list"><div><dt>Pull tersedia</dt><dd>{pulls.toLocaleString('id-ID')}</dd></div><div><dt>Menuju hard pity</dt><dd>{toPity} pull</dd></div><div><dt>Target pasti karakter banner</dt><dd>{(value.guaranteed ? 90 : 180) - value.pity} pull</dd></div></dl><p className="help-text">Perkiraan konservatif banner karakter: hingga 90 pull per bintang lima.</p></section>
    <section><h2>Zenless Zone Zero</h2><div className="form-grid">{([['polychrome', 'Polychrome'], ['tapes', 'Encrypted Master Tape']] as const).map(([key, label]) => <label key={key}>{label}<input disabled={!ready} type="number" min={0} max={1000000000} value={value[key]} onChange={event => update({ ...value, [key]: Math.max(0, Math.min(1000000000, Math.floor(+event.target.value))) })} /></label>)}</div><dl className="data-list"><div><dt>Search tersedia</dt><dd>{zzz.toLocaleString('id-ID')}</dd></div><div><dt>Setara polychrome</dt><dd>{(zzz * 160).toLocaleString('id-ID')}</dd></div></dl><p className="help-text">160 polychrome untuk satu search.</p></section></div>
  </div>;
}
