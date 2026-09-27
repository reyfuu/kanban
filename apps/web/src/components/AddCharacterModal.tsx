import { useState } from 'react';
import type { GameType, KanbanStage, PriorityLevel, UserCard } from '../types/kanban';
import { CHARACTERS_DATABASE } from '../data/characters';
import { STAGES } from '../lib/board';
import { Avatar, Dialog, Icon } from './ui';

export function AddCharacterModal({ onClose, onAddCard }: { onClose: () => void; onAddCard: (card: UserCard) => boolean }) {
  const [error, setError] = useState('');
  const [game, setGame] = useState<GameType | 'ALL'>('ALL');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState('');
  const [stage, setStage] = useState<KanbanStage>('BACKLOG');
  const [priority, setPriority] = useState<PriorityLevel>('MEDIUM');
  const characters = CHARACTERS_DATABASE.filter(character => (game === 'ALL' || character.game === game) && character.name.toLowerCase().includes(search.toLowerCase()));
  const character = characters.find(item => item.id === selected);
  function add() {
    if (!character) return;
    const genshin = character.game === 'GENSHIN_IMPACT';
    const saved = onAddCard({
      id: crypto.randomUUID(), characterId: character.id, game: character.game, stage, priority,
      tags: [], currentLevel: 1, targetLevel: genshin ? 90 : 60, currentAscension: 0, targetAscension: genshin ? 6 : 5,
      talents: { skill1Current: 1, skill1Target: 1, skill2Current: 1, skill2Target: genshin ? 9 : 10, skill3Current: 1, skill3Target: genshin ? 10 : 12, ...(genshin ? {} : { coreSkillCurrent: 'A', coreSkillTarget: 'F' }) },
      equipment: { name: '', currentLevel: 1, targetLevel: genshin ? 90 : 60, refinement: 1 },
      gearTarget: { setName: '', subStatsGoal: '', completed: false }, notes: '', updatedAt: Date.now(),
    });
    if (saved) onClose();
    else setError('Kartu belum tersimpan. Periksa ruang dan izin penyimpanan browser.');
  }
  return <Dialog title="Tambah karakter" onClose={onClose}>
    <form onSubmit={event => { event.preventDefault(); add(); }}>
      <div className="dialog-body">{error && <p role="alert" className="message error">{error}</p>}<p className="muted">Pilih satu karakter untuk rencana berikutnya.</p>
        <div className="picker-toolbar"><label className="search-field"><Icon name="search" /><span className="sr-only">Cari karakter</span><input autoFocus value={search} onChange={event => setSearch(event.target.value)} placeholder="Cari karakter..." /></label><label><span className="sr-only">Filter game</span><select value={game} onChange={event => { setGame(event.target.value as GameType | 'ALL'); setSelected(''); }}><option value="ALL">Semua game</option><option value="GENSHIN_IMPACT">Genshin Impact</option><option value="ZENLESS_ZONE_ZERO">Zenless Zone Zero</option></select></label></div>
        <div className="character-picker" role="group" aria-label="Pilih karakter">{characters.map(item => <button type="button" key={item.id} className={`picker-item ${selected === item.id ? 'selected' : ''}`} aria-pressed={selected === item.id} onClick={() => setSelected(item.id)}><Avatar name={item.name} src={item.avatarUrl} /><span><strong>{item.name}</strong><small>{item.element} / {item.game === 'GENSHIN_IMPACT' ? 'Genshin' : 'ZZZ'}</small></span>{selected === item.id && <Icon name="check" size={16} />}</button>)}</div>
        {!characters.length && <p className="empty-inline">Karakter tidak ditemukan. Coba nama lain.</p>}
        <details className="optional-fields"><summary>Atur tahap dan prioritas</summary><div className="form-grid"><label>Tahap awal<select value={stage} onChange={event => setStage(event.target.value as KanbanStage)}>{STAGES.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label><label>Prioritas<select value={priority} onChange={event => setPriority(event.target.value as PriorityLevel)}><option value="HIGH">Tinggi</option><option value="MEDIUM">Sedang</option><option value="LOW">Rendah</option></select></label></div></details>
      </div><div className="dialog-footer"><button type="button" className="button secondary" onClick={onClose}>Batal</button><button className="button primary" disabled={!character}>Tambah ke papan</button></div>
    </form>
  </Dialog>;
}
