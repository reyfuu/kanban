import { useState } from 'react';
import type { PriorityLevel, UserCard } from '../types/kanban';
import { CHARACTERS_DATABASE } from '../data/characters';
import { calculateMaterialDeficit } from '../lib/calculator';
import { FARMING_TARGETS, DAY_NAMES } from '../lib/farming';
import { Avatar, Dialog } from './ui';

export function CharacterDetailModal({ card, stages, onClose, onSave, onDelete }: { card: UserCard; stages: { id: string; label: string }[]; onClose: () => void; onSave: (card: UserCard) => boolean; onDelete: (id: string) => boolean }) {
  const [error, setError] = useState('');
  const [form, setForm] = useState<UserCard>(() => structuredClone(card));
  const [tab, setTab] = useState<'build' | 'materials' | 'notes'>('build');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const meta = CHARACTERS_DATABASE.find(item => item.id === card.characterId);
  const genshin = card.game === 'GENSHIN_IMPACT';
  const maxLevel = genshin ? 90 : 60;
  const maxAscension = genshin ? 6 : 5;
  const maxTalent = genshin ? 10 : 12;
  const deficit = calculateMaterialDeficit(form);
  return <Dialog title={meta?.name ?? card.characterId} onClose={onClose}>
    <div className="dialog-tabs" aria-label="Bagian detail">{([['build', 'Target build'], ['materials', 'Material'], ['notes', 'Catatan']] as const).map(([value, label]) => <button key={value} type="button" aria-pressed={tab === value} className={tab === value ? 'active' : ''} onClick={() => setTab(value)}>{label}</button>)}</div>
    <form onInvalidCapture={event => { setTab('build'); const input = event.target as HTMLInputElement; const details = input.closest('details'); if (details) details.open = true; requestAnimationFrame(() => input.focus()); }} onSubmit={event => { event.preventDefault(); if (onSave({ ...form, updatedAt: Date.now() })) onClose(); else setError('Perubahan belum tersimpan. Periksa penyimpanan browser.'); }}>
      <div className="dialog-body">{error && <p className="message error" role="alert">{error}</p>}
        <div hidden={tab !== 'build'} className="detail-fields">
          <div className="form-grid"><label>Tahap<select value={form.stage} onChange={event => setForm({ ...form, stage: event.target.value })}>{stages.map(stage => <option key={stage.id} value={stage.id}>{stage.label}</option>)}</select></label><label>Prioritas<select value={form.priority} onChange={event => setForm({ ...form, priority: event.target.value as PriorityLevel })}><option value="HIGH">Tinggi</option><option value="MEDIUM">Sedang</option><option value="LOW">Rendah</option></select></label></div>
          <fieldset><legend>Level & ascension</legend><div className="form-grid">{([
            ['currentLevel', 'Level saat ini', 1, maxLevel], ['targetLevel', 'Target level', 1, maxLevel],
            ['currentAscension', 'Ascension saat ini', 0, maxAscension], ['targetAscension', 'Target ascension', 0, maxAscension],
          ] as const).map(([key, label, min, max]) => <label key={key}>{label}<input type="number" min={min} max={max} required value={form[key]} onChange={event => setForm({ ...form, [key]: +event.target.value })} /></label>)}</div></fieldset>
          <details className="optional-fields"><summary>Talenta dan skill</summary><div className="form-grid">{([1, 2, 3] as const).map(skill => <fieldset key={skill}><legend>Skill {skill}</legend><label>Saat ini<input type="number" min={1} max={maxTalent} required value={form.talents[`skill${skill}Current`]} onChange={event => setForm({ ...form, talents: { ...form.talents, [`skill${skill}Current`]: +event.target.value } })} /></label><label>Target<input type="number" min={1} max={maxTalent} required value={form.talents[`skill${skill}Target`]} onChange={event => setForm({ ...form, talents: { ...form.talents, [`skill${skill}Target`]: +event.target.value } })} /></label></fieldset>)}
          {!genshin && (['coreSkillCurrent', 'coreSkillTarget'] as const).map(key => <label key={key}>{key === 'coreSkillCurrent' ? 'Core skill saat ini' : 'Target core skill'}<select value={form.talents[key] ?? 'A'} onChange={event => setForm({ ...form, talents: { ...form.talents, [key]: event.target.value } })}>{['A', 'B', 'C', 'D', 'E', 'F'].map(value => <option key={value}>{value}</option>)}</select></label>)}</div></details>
          <details className="optional-fields"><summary>Senjata & gear</summary><div className="detail-fields"><label>{genshin ? 'Senjata' : 'W-Engine'}<input value={form.equipment.name} maxLength={200} onChange={event => setForm({ ...form, equipment: { ...form.equipment, name: event.target.value } })} /></label><div className="form-grid">{(['currentLevel', 'targetLevel', 'refinement'] as const).map(key => <label key={key}>{key === 'currentLevel' ? 'Level senjata' : key === 'targetLevel' ? 'Target level senjata' : 'Refinement / overclock'}<input type="number" min={1} max={key === 'refinement' ? 5 : maxLevel} required value={form.equipment[key]} onChange={event => setForm({ ...form, equipment: { ...form.equipment, [key]: +event.target.value } })} /></label>)}</div><label>Set gear<input value={form.gearTarget.setName} maxLength={200} onChange={event => setForm({ ...form, gearTarget: { ...form.gearTarget, setName: event.target.value } })} /></label><label>Target stat<input value={form.gearTarget.subStatsGoal} maxLength={500} onChange={event => setForm({ ...form, gearTarget: { ...form.gearTarget, subStatsGoal: event.target.value } })} /></label><label className="checkbox-row"><input type="checkbox" checked={form.gearTarget.completed} onChange={event => setForm({ ...form, gearTarget: { ...form.gearTarget, completed: event.target.checked } })} />Gear sudah sesuai target</label></div></details>
        </div>
        {tab === 'materials' && <div><h3>Material karakter</h3><div className="detail-materials">{FARMING_TARGETS.filter(target => target.characterIds.includes(card.characterId)).map(target => <div className="material-heading" key={target.id}><Avatar name={target.name} src={target.iconUrl} /><div><strong>{target.name}</strong><p>{target.location}</p><p>{target.days.length === 7 ? 'Setiap hari' : target.days.map(day => DAY_NAMES[day]).join(' · ')}</p></div></div>)}</div><p className="muted">Estimasi kebutuhan dari level saat ini. Angka bersifat perkiraan dan belum dikurangi inventori akun.</p><dl className="data-list">{[
          [genshin ? 'Mora' : 'Denny', deficit.moraOrDenny], [genshin ? 'Buku EXP' : 'Investigator Log', deficit.expBooksOrLogs], ['Material boss', deficit.bossMaterials], [genshin ? 'Buku talenta' : 'Tactical Chip', deficit.talentBooksOrChips], ['Material boss mingguan', deficit.weeklyBossMaterials], [genshin ? 'Crown' : 'Hamster Cage Pass', deficit.crownsOrHamsterPass], [genshin ? 'Estimasi resin' : 'Estimasi battery', deficit.estimatedResinOrBattery],
        ].map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{Number(value).toLocaleString('id-ID')}</dd></div>)}</dl></div>}
        <div hidden={tab !== 'notes'} className="detail-fields"><label>Catatan build<textarea rows={6} value={form.notes} maxLength={10000} placeholder="Apa yang ingin kamu kerjakan berikutnya?" onChange={event => setForm({ ...form, notes: event.target.value })} /></label><label>Tag, pisahkan dengan koma<input value={form.tags.join(', ')} onChange={event => setForm({ ...form, tags: event.target.value.split(',').map(tag => tag.trim()) })} /></label></div>
        {confirmDelete && <div className="delete-confirm" role="alert"><p>Hapus kartu ini? Progres pada kartu akan hilang.</p><button type="button" className="button danger" onClick={() => { if (onDelete(card.id)) onClose(); else setError('Kartu belum dihapus. Periksa penyimpanan browser.'); }}>Ya, hapus kartu</button><button type="button" className="text-button" onClick={() => setConfirmDelete(false)}>Batal</button></div>}
      </div><div className="dialog-footer"><button type="button" className="text-button danger-text" onClick={() => setConfirmDelete(true)}>Hapus kartu</button><span className="spacer" /><button type="button" className="button secondary" onClick={onClose}>Batal</button><button className="button primary">Simpan perubahan</button></div>
    </form>
  </Dialog>;
}
