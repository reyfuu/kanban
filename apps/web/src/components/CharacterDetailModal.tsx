import { useState } from 'react';
import type { PriorityLevel, UserCard } from '../types/kanban';
import { CHARACTERS_DATABASE } from '../data/characters';
import { formatSubStatsSummary, getCharacterBuildGuide, getPrimaryF2PWeapon } from '../data/buildGuides';
import { calculateMaterialDeficit } from '../lib/calculator';
import { FARMING_TARGETS, DAY_NAMES } from '../lib/farming';
import { ArtifactSetIcon, SlotIcon, WeaponIcon } from './GearIcons';
import { Avatar, Dialog } from './ui';

export function CharacterDetailModal({ card, stages, onClose, onSave, onDelete }: { card: UserCard; stages: { id: string; label: string }[]; onClose: () => void; onSave: (card: UserCard) => boolean; onDelete: (id: string) => boolean }) {
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [form, setForm] = useState<UserCard>(() => structuredClone(card));
  const [tab, setTab] = useState<'build' | 'guide' | 'materials' | 'notes'>('build');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const meta = CHARACTERS_DATABASE.find(item => item.id === card.characterId);
  const guide = meta ? getCharacterBuildGuide(meta) : undefined;
  const f2pTeams = guide?.teams.filter(team => team.tier === 'F2P') ?? [];
  const metaTeams = guide?.teams.filter(team => team.tier === 'META') ?? [];
  const genshin = card.game === 'GENSHIN_IMPACT';
  const maxLevel = genshin ? 90 : 60;
  const maxAscension = genshin ? 6 : 5;
  const maxTalent = genshin ? 10 : 12;
  const deficit = calculateMaterialDeficit(form);

  function applyF2PBuild() {
    if (!guide) return;
    const f2pWeapon = getPrimaryF2PWeapon(guide);
    setForm(prev => ({
      ...prev,
      equipment: { ...prev.equipment, name: f2pWeapon.name },
      gearTarget: { ...prev.gearTarget, setName: guide.gearSet, subStatsGoal: formatSubStatsSummary(guide) },
    }));
    setNotice(`Build F2P diterapkan (${f2pWeapon.name} · ${guide.gearSet}). Klik "Simpan perubahan" untuk menyimpan.`);
  }

  function applyWeapon(weaponName: string) {
    setForm(prev => ({ ...prev, equipment: { ...prev.equipment, name: weaponName } }));
    setNotice(`${genshin ? 'Senjata' : 'W-Engine'} "${weaponName}" dipilih ke Target build. Klik "Simpan perubahan" untuk menyimpan.`);
  }

  return <Dialog title={meta?.name ?? card.characterId} onClose={onClose}>
    <div className="dialog-tabs" aria-label="Bagian detail">{([['build', 'Target build'], ['guide', 'Rekomendasi'], ['materials', 'Material'], ['notes', 'Catatan']] as const).map(([value, label]) => <button key={value} type="button" aria-pressed={tab === value} className={tab === value ? 'active' : ''} onClick={() => setTab(value)}>{label}</button>)}</div>
    <form onInvalidCapture={event => { setTab('build'); const input = event.target as HTMLInputElement; const details = input.closest('details'); if (details) details.open = true; requestAnimationFrame(() => input.focus()); }} onSubmit={event => { event.preventDefault(); if (onSave({ ...form, updatedAt: Date.now() })) onClose(); else setError('Perubahan belum tersimpan. Periksa penyimpanan browser.'); }}>
      <div className="dialog-body">{error && <p className="message error" role="alert">{error}</p>}{notice && <p className="message" role="status">{notice}</p>}
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
        {tab === 'guide' && guide && meta && <div className="guide-panel">
          <div className="guide-header">
            <div>
              <strong>{guide.role}</strong>
              <p className="muted">Prioritas {genshin ? 'talenta' : 'skill'}: {guide.talentPriority}</p>
            </div>
            <button type="button" className="button secondary guide-apply-btn" onClick={applyF2PBuild}>Terapkan build F2P</button>
          </div>
          {guide.isGenericFallback && <p className="guide-fallback-note">Panduan umum berdasarkan elemen &amp; role karakter. Sesuaikan dengan gaya mainmu.</p>}

          <section className="guide-section">
            <h3>{genshin ? 'Rekomendasi Senjata (F2P diprioritaskan)' : 'Rekomendasi W-Engine (F2P diprioritaskan)'}</h3>
            <ul className="guide-weapon-list">
              {guide.weapons.map(weapon => {
                const selected = form.equipment.name.trim().toLowerCase() === weapon.name.toLowerCase();
                return <li key={weapon.name} className={`guide-weapon-item ${weapon.tier === 'F2P' ? 'is-f2p' : ''}`}>
                  <WeaponIcon name={weapon.name} game={card.game} weaponType={meta.weaponOrSpecialty} rarity={weapon.rarity} />
                  <div className="guide-weapon-body">
                    <div className="guide-weapon-top">
                      <span className="guide-weapon-name">
                        <span className={`guide-badge tier-${weapon.tier.toLowerCase()}`}>{weapon.tier === 'F2P' ? 'F2P' : weapon.tier === 'BIS' ? 'BiS' : 'Alt'}</span>
                        <strong>{weapon.name}</strong>
                        <small className="muted">{weapon.rarity}</small>
                      </span>
                      <button type="button" className="text-button guide-use-btn" disabled={selected} onClick={() => applyWeapon(weapon.name)}>{selected ? 'Dipakai' : 'Pakai'}</button>
                    </div>
                    <p className="guide-source">{weapon.source}</p>
                    <p className="muted">{weapon.note}</p>
                  </div>
                </li>;
              })}
            </ul>
          </section>

          <section className="guide-section">
            <h3>{genshin ? 'Build Artifact' : 'Build Drive Disc'}</h3>
            <div className="guide-gear-box">
              <div className="guide-gear-head">
                <ArtifactSetIcon setName={guide.gearSet} game={card.game} />
                <div>
                  <p><strong>Set utama:</strong> {guide.gearSet}</p>
                  {guide.gearAlt && <div className="guide-gear-alt"><ArtifactSetIcon setName={guide.gearAlt} game={card.game} maxIcons={1} /><p className="muted"><strong>Alternatif:</strong> {guide.gearAlt}</p></div>}
                </div>
              </div>
              <div className="guide-stat-grid">
                <div><small className="slot-label"><SlotIcon label={guide.mainStats.slot1Label} />{guide.mainStats.slot1Label}</small><strong>{guide.mainStats.slot1}</strong></div>
                <div><small className="slot-label"><SlotIcon label={guide.mainStats.slot2Label} />{guide.mainStats.slot2Label}</small><strong>{guide.mainStats.slot2}</strong></div>
                <div><small className="slot-label"><SlotIcon label={guide.mainStats.slot3Label} />{guide.mainStats.slot3Label}</small><strong>{guide.mainStats.slot3}</strong></div>
              </div>
              <p className="guide-substats"><small className="muted">Substat:</small> {guide.subStats}</p>
            </div>
          </section>

          {f2pTeams.length > 0 && <section className="guide-section">
            <h3>Rekomendasi Tim F2P (Ramah Budget)</h3>
            <div className="guide-team-list">
              {f2pTeams.map(team => <div key={team.name} className="guide-team-card is-f2p">
                <div className="guide-team-head">
                  <span className="guide-badge tier-f2p">Tim F2P</span>
                  <strong>{team.name}</strong>
                </div>
                <div className="guide-team-members">
                  {team.members.map(memberName => {
                    const member = CHARACTERS_DATABASE.find(c => c.game === card.game && c.name.toLowerCase() === memberName.toLowerCase());
                    return <span key={memberName} className="guide-member-chip">
                      <Avatar name={memberName} src={member?.avatarUrl} />
                      <span>{memberName}</span>
                    </span>;
                  })}
                </div>
                <p className="muted">{team.note}</p>
              </div>)}
            </div>
          </section>}

          {metaTeams.length > 0 && <section className="guide-section">
            <h3>Rekomendasi Tim Meta (Referensi TC / Komunitas)</h3>
            <div className="guide-team-list">
              {metaTeams.map(team => <div key={team.name} className="guide-team-card is-meta">
                <div className="guide-team-head">
                  <span className="guide-badge tier-meta">Tim Meta</span>
                  <strong>{team.name}</strong>
                </div>
                <div className="guide-team-members">
                  {team.members.map(memberName => {
                    const member = CHARACTERS_DATABASE.find(c => c.game === card.game && c.name.toLowerCase() === memberName.toLowerCase());
                    return <span key={memberName} className="guide-member-chip">
                      <Avatar name={memberName} src={member?.avatarUrl} />
                      <span>{memberName}</span>
                    </span>;
                  })}
                </div>
                <p className="muted">{team.note}</p>
              </div>)}
            </div>
          </section>}
        </div>}
        {tab === 'materials' && <div><h3>Material karakter</h3><div className="detail-materials">{FARMING_TARGETS.filter(target => target.characterIds.includes(card.characterId)).map(target => <div className="material-heading" key={target.id}><Avatar name={target.name} src={target.iconUrl} /><div><strong>{target.name}</strong><p>{target.location}</p><p>{target.days.length === 7 ? 'Setiap hari' : target.days.map(day => DAY_NAMES[day]).join(' · ')}</p></div></div>)}</div><p className="muted">Estimasi kebutuhan dari level saat ini. Angka bersifat perkiraan dan belum dikurangi inventori akun.</p><dl className="data-list">{[
          [genshin ? 'Mora' : 'Denny', deficit.moraOrDenny], [genshin ? 'Buku EXP' : 'Investigator Log', deficit.expBooksOrLogs], ['Material boss', deficit.bossMaterials], [genshin ? 'Buku talenta' : 'Tactical Chip', deficit.talentBooksOrChips], ['Material boss mingguan', deficit.weeklyBossMaterials], [genshin ? 'Crown' : 'Hamster Cage Pass', deficit.crownsOrHamsterPass], [genshin ? 'Estimasi resin' : 'Estimasi battery', deficit.estimatedResinOrBattery],
        ].map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{Number(value).toLocaleString('id-ID')}</dd></div>)}</dl></div>}
        <div hidden={tab !== 'notes'} className="detail-fields"><label>Catatan build<textarea rows={6} value={form.notes} maxLength={10000} placeholder="Apa yang ingin kamu kerjakan berikutnya?" onChange={event => setForm({ ...form, notes: event.target.value })} /></label><label>Tag, pisahkan dengan koma<input value={form.tags.join(', ')} onChange={event => setForm({ ...form, tags: event.target.value.split(',').map(tag => tag.trim()) })} /></label></div>
        {confirmDelete && <div className="delete-confirm" role="alert"><p>Hapus kartu ini? Progres pada kartu akan hilang.</p><button type="button" className="button danger" onClick={() => { if (onDelete(card.id)) onClose(); else setError('Kartu belum dihapus. Periksa penyimpanan browser.'); }}>Ya, hapus kartu</button><button type="button" className="text-button" onClick={() => setConfirmDelete(false)}>Batal</button></div>}
      </div><div className="dialog-footer"><button type="button" className="text-button danger-text" onClick={() => setConfirmDelete(true)}>Hapus kartu</button><span className="spacer" /><button type="button" className="button secondary" onClick={onClose}>Batal</button><button className="button primary">Simpan perubahan</button></div>
    </form>
  </Dialog>;
}
