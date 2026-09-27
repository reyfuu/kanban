import React, { useState } from 'react';
import { Character, KanbanStage, PriorityLevel, UserCard } from '../types/kanban';
import { CHARACTERS_DATABASE } from '../data/characters';
import { calculateMaterialDeficit } from '../lib/calculator';

interface CharacterDetailModalProps {
  card: UserCard | null;
  onClose: () => void;
  onSave: (updatedCard: UserCard) => void;
  onDelete: (cardId: string) => void;
}

export function CharacterDetailModal({
  card,
  onClose,
  onSave,
  onDelete,
}: CharacterDetailModalProps) {
  if (!card) return null;

  const meta: Character | undefined = CHARACTERS_DATABASE.find(
    (c) => c.id === card.characterId
  );

  const [activeTab, setActiveTab] = useState<'BUILD' | 'DEFICIT' | 'NOTES'>('BUILD');
  const [formData, setFormData] = useState<UserCard>({ ...card });

  const isGenshin = card.game === 'GENSHIN_IMPACT';
  const maxLevel = isGenshin ? 90 : 60;
  const maxAscension = isGenshin ? 6 : 5;
  const maxTalent = isGenshin ? 10 : 12;

  const deficit = calculateMaterialDeficit(formData);

  const handleSave = () => {
    onSave({ ...formData, updatedAt: Date.now() });
    onClose();
  };

  const handleDelete = () => {
    if (confirm(`Yakin ingin menghapus kartu ${meta?.name || card.characterId}?`)) {
      onDelete(card.id);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Modal Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-800 bg-slate-950">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-slate-900 border border-slate-700 overflow-hidden shrink-0">
              {meta?.avatarUrl ? (
                <img
                  src={meta.avatarUrl}
                  alt={meta?.name || ''}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-xs font-bold text-slate-400">
                  {meta?.name?.slice(0, 2)}
                </div>
              )}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-slate-100">{meta?.name || card.characterId}</h3>
                <span className="text-xs font-mono px-2 py-0.5 rounded bg-slate-800 text-amber-300 border border-slate-700">
                  {meta?.rarity}★
                </span>
                <span className="text-xs px-2 py-0.5 rounded bg-slate-800 text-cyan-300 border border-slate-700">
                  {meta?.element}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                {isGenshin ? 'Genshin Impact' : 'Zenless Zone Zero'} • {meta?.weaponOrSpecialty}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleDelete}
              className="p-2 text-rose-400 hover:text-rose-300 hover:bg-rose-950/40 rounded-lg transition-colors cursor-pointer text-xs"
              title="Hapus Kartu"
            >
              Hapus
            </button>
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Modal Navigation Tabs */}
        <div className="flex items-center border-b border-slate-800 bg-slate-950/60 px-4">
          <button
            onClick={() => setActiveTab('BUILD')}
            className={`px-4 py-2.5 text-xs font-medium border-b-2 transition-all cursor-pointer ${
              activeTab === 'BUILD'
                ? 'border-cyan-400 text-cyan-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            ⚙️ Target Level & Talenta
          </button>
          <button
            onClick={() => setActiveTab('DEFICIT')}
            className={`px-4 py-2.5 text-xs font-medium border-b-2 transition-all cursor-pointer ${
              activeTab === 'DEFICIT'
                ? 'border-cyan-400 text-cyan-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            🧮 Kalkulator Defisit ({deficit.estimatedDays} Hari Farming)
          </button>
          <button
            onClick={() => setActiveTab('NOTES')}
            className={`px-4 py-2.5 text-xs font-medium border-b-2 transition-all cursor-pointer ${
              activeTab === 'NOTES'
                ? 'border-cyan-400 text-cyan-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            📝 Catatan Build
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 overflow-y-auto flex-1 space-y-4">
          {activeTab === 'BUILD' && (
            <div className="space-y-4 text-xs">
              {/* Stage & Priority */}
              <div className="grid grid-cols-2 gap-3 bg-slate-950 p-3 rounded-xl border border-slate-800">
                <div>
                  <label className="block text-slate-400 mb-1 font-medium">Kolom Tahap Kanban</label>
                  <select
                    value={formData.stage}
                    onChange={(e) =>
                      setFormData({ ...formData, stage: e.target.value as KanbanStage })
                    }
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-slate-200 font-medium"
                  >
                    <option value="WISHLIST">1. Wishlist / Target Pull</option>
                    <option value="BACKLOG">2. In Queue (Acquired)</option>
                    <option value="LEVELING">3. Level & Ascension</option>
                    <option value="TALENTS">4. Skills & Talents</option>
                    <option value="GEAR">5. Gear & Relics</option>
                    <option value="TUNING">6. Fine-Tuning</option>
                    <option value="READY">7. Combat Ready</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-400 mb-1 font-medium">Prioritas Build</label>
                  <select
                    value={formData.priority}
                    onChange={(e) =>
                      setFormData({ ...formData, priority: e.target.value as PriorityLevel })
                    }
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-slate-200 font-medium"
                  >
                    <option value="HIGH">Tinggi (High Priority)</option>
                    <option value="MEDIUM">Sedang (Medium)</option>
                    <option value="LOW">Rendah (Low)</option>
                  </select>
                </div>
              </div>

              {/* Level & Ascension */}
              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 space-y-3">
                <h4 className="font-bold text-slate-200">Level & Ascension</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-slate-400">Level Saat Ini (1 - {maxLevel})</label>
                    <input
                      type="number"
                      min={1}
                      max={maxLevel}
                      value={formData.currentLevel}
                      onChange={(e) =>
                        setFormData({ ...formData, currentLevel: parseInt(e.target.value) || 1 })
                      }
                      className="w-full mt-1 bg-slate-900 border border-slate-700 rounded-lg p-2 text-slate-200 font-mono"
                    />
                  </div>
                  <div>
                    <label className="text-slate-400">Target Level</label>
                    <input
                      type="number"
                      min={formData.currentLevel}
                      max={maxLevel}
                      value={formData.targetLevel}
                      onChange={(e) =>
                        setFormData({ ...formData, targetLevel: parseInt(e.target.value) || maxLevel })
                      }
                      className="w-full mt-1 bg-slate-900 border border-slate-700 rounded-lg p-2 text-cyan-300 font-mono"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-slate-400">Ascension Phase (0 - {maxAscension})</label>
                    <input
                      type="number"
                      min={0}
                      max={maxAscension}
                      value={formData.currentAscension}
                      onChange={(e) =>
                        setFormData({ ...formData, currentAscension: parseInt(e.target.value) || 0 })
                      }
                      className="w-full mt-1 bg-slate-900 border border-slate-700 rounded-lg p-2 text-slate-200 font-mono"
                    />
                  </div>
                  <div>
                    <label className="text-slate-400">Target Ascension Phase</label>
                    <input
                      type="number"
                      min={formData.currentAscension}
                      max={maxAscension}
                      value={formData.targetAscension}
                      onChange={(e) =>
                        setFormData({ ...formData, targetAscension: parseInt(e.target.value) || maxAscension })
                      }
                      className="w-full mt-1 bg-slate-900 border border-slate-700 rounded-lg p-2 text-cyan-300 font-mono"
                    />
                  </div>
                </div>
              </div>

              {/* Talents / Skills */}
              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 space-y-3">
                <h4 className="font-bold text-slate-200">
                  {isGenshin ? 'Talenta (Normal / Skill / Burst)' : 'Skills (Basic / Special / Chain)'}
                </h4>

                <div className="grid grid-cols-3 gap-3">
                  {/* Skill 1 */}
                  <div>
                    <label className="text-slate-400 truncate block">
                      {isGenshin ? 'Normal Attack' : 'Basic Attack'}
                    </label>
                    <div className="flex items-center gap-1 mt-1 font-mono">
                      <input
                        type="number"
                        min={1}
                        max={maxTalent}
                        value={formData.talents.skill1Current}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            talents: {
                              ...formData.talents,
                              skill1Current: parseInt(e.target.value) || 1,
                            },
                          })
                        }
                        className="w-1/2 bg-slate-900 border border-slate-700 rounded p-1.5 text-center text-slate-200"
                      />
                      <span className="text-slate-500">→</span>
                      <input
                        type="number"
                        min={1}
                        max={maxTalent}
                        value={formData.talents.skill1Target}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            talents: {
                              ...formData.talents,
                              skill1Target: parseInt(e.target.value) || 1,
                            },
                          })
                        }
                        className="w-1/2 bg-slate-900 border border-slate-700 rounded p-1.5 text-center text-cyan-300"
                      />
                    </div>
                  </div>

                  {/* Skill 2 */}
                  <div>
                    <label className="text-slate-400 truncate block">
                      {isGenshin ? 'Elemental Skill' : 'Special Attack'}
                    </label>
                    <div className="flex items-center gap-1 mt-1 font-mono">
                      <input
                        type="number"
                        min={1}
                        max={maxTalent}
                        value={formData.talents.skill2Current}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            talents: {
                              ...formData.talents,
                              skill2Current: parseInt(e.target.value) || 1,
                            },
                          })
                        }
                        className="w-1/2 bg-slate-900 border border-slate-700 rounded p-1.5 text-center text-slate-200"
                      />
                      <span className="text-slate-500">→</span>
                      <input
                        type="number"
                        min={1}
                        max={maxTalent}
                        value={formData.talents.skill2Target}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            talents: {
                              ...formData.talents,
                              skill2Target: parseInt(e.target.value) || 1,
                            },
                          })
                        }
                        className="w-1/2 bg-slate-900 border border-slate-700 rounded p-1.5 text-center text-cyan-300"
                      />
                    </div>
                  </div>

                  {/* Skill 3 */}
                  <div>
                    <label className="text-slate-400 truncate block">
                      {isGenshin ? 'Elemental Burst' : 'Chain / Ultimate'}
                    </label>
                    <div className="flex items-center gap-1 mt-1 font-mono">
                      <input
                        type="number"
                        min={1}
                        max={maxTalent}
                        value={formData.talents.skill3Current}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            talents: {
                              ...formData.talents,
                              skill3Current: parseInt(e.target.value) || 1,
                            },
                          })
                        }
                        className="w-1/2 bg-slate-900 border border-slate-700 rounded p-1.5 text-center text-slate-200"
                      />
                      <span className="text-slate-500">→</span>
                      <input
                        type="number"
                        min={1}
                        max={maxTalent}
                        value={formData.talents.skill3Target}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            talents: {
                              ...formData.talents,
                              skill3Target: parseInt(e.target.value) || 1,
                            },
                          })
                        }
                        className="w-1/2 bg-slate-900 border border-slate-700 rounded p-1.5 text-center text-cyan-300"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Weapon & Relics */}
              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 space-y-3">
                <h4 className="font-bold text-slate-200">
                  {isGenshin ? 'Senjata & Artifact Target' : 'W-Engine & Drive Discs'}
                </h4>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-slate-400">Nama Senjata / W-Engine</label>
                    <input
                      type="text"
                      value={formData.equipment.name}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          equipment: { ...formData.equipment, name: e.target.value },
                        })
                      }
                      className="w-full mt-1 bg-slate-900 border border-slate-700 rounded-lg p-2 text-slate-200"
                    />
                  </div>

                  <div>
                    <label className="text-slate-400">Target Set Artifact / Drive Disc</label>
                    <input
                      type="text"
                      value={formData.gearTarget.setName}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          gearTarget: { ...formData.gearTarget, setName: e.target.value },
                        })
                      }
                      className="w-full mt-1 bg-slate-900 border border-slate-700 rounded-lg p-2 text-slate-200"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'DEFICIT' && (
            <div className="space-y-4">
              <div className="bg-gradient-to-r from-cyan-950/40 to-indigo-950/40 border border-cyan-800/40 rounded-xl p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-xs text-cyan-400 font-semibold uppercase tracking-wider">
                      Estimasi Energi yang Dibutuhkan
                    </span>
                    <h3 className="text-2xl font-black text-slate-100 font-mono mt-1">
                      {deficit.estimatedResinOrBattery}{' '}
                      <span className="text-sm font-normal text-slate-400">
                        {isGenshin ? 'Original Resin' : 'Battery Charge'}
                      </span>
                    </h3>
                  </div>
                  <div className="text-right">
                    <span className="text-xs text-slate-400">Waktu Farming Diperlukan</span>
                    <div className="text-xl font-bold text-amber-400 font-mono mt-1">
                      ~ {deficit.estimatedDays} Hari
                    </div>
                  </div>
                </div>
              </div>

              {/* Material Breakdown Grid */}
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-xs">
                <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
                  <span className="text-slate-400 block mb-1">
                    {isGenshin ? 'Mora' : 'Denny'}
                  </span>
                  <span className="text-sm font-bold font-mono text-amber-300">
                    {deficit.moraOrDenny.toLocaleString('id-ID')}
                  </span>
                </div>

                <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
                  <span className="text-slate-400 block mb-1">
                    {isGenshin ? "Hero's Wit (EXP)" : 'Investigator Logs'}
                  </span>
                  <span className="text-sm font-bold font-mono text-cyan-300">
                    {deficit.expBooksOrLogs} buah
                  </span>
                </div>

                <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
                  <span className="text-slate-400 block mb-1">
                    {isGenshin ? 'Boss Drops (Ascension)' : 'Higher-Dim Data'}
                  </span>
                  <span className="text-sm font-bold font-mono text-purple-300">
                    {deficit.bossMaterials} buah
                  </span>
                </div>

                <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
                  <span className="text-slate-400 block mb-1">
                    {isGenshin ? 'Buku Talenta (Domain)' : 'Tactical Chips'}
                  </span>
                  <span className="text-sm font-bold font-mono text-blue-300">
                    {deficit.talentBooksOrChips} buah
                  </span>
                </div>

                <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
                  <span className="text-slate-400 block mb-1">Weekly Boss Material</span>
                  <span className="text-sm font-bold font-mono text-rose-300">
                    {deficit.weeklyBossMaterials} buah
                  </span>
                </div>

                <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
                  <span className="text-slate-400 block mb-1">
                    {isGenshin ? 'Crown of Insight' : 'Hamster Cage Pass'}
                  </span>
                  <span className="text-sm font-bold font-mono text-yellow-300">
                    {deficit.crownsOrHamsterPass} buah
                  </span>
                </div>
              </div>

              <div className="text-xs bg-slate-950 p-3 rounded-lg border border-slate-800/80 text-slate-400 space-y-1">
                <p>
                  <strong>Domain Harian:</strong>{' '}
                  <span className="text-slate-200">{meta?.talentBookOrChip}</span>
                </p>
                <p>
                  <strong>Weekly Boss:</strong>{' '}
                  <span className="text-slate-200">{meta?.weeklyBossDrop}</span>
                </p>
              </div>
            </div>
          )}

          {activeTab === 'NOTES' && (
            <div className="space-y-3 text-xs">
              <div>
                <label className="text-slate-400 font-medium block mb-1">
                  Target Substat & Catatan Pribadi
                </label>
                <textarea
                  rows={6}
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="Contoh: Butuh Energy Recharge minimal 220%, cari sands ATK% dan goblet Hydro DMG..."
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-slate-200 leading-relaxed font-mono"
                />
              </div>

              <div>
                <label className="text-slate-400 font-medium block mb-1">
                  Tag Khusus (Pisahkan dengan koma)
                </label>
                <input
                  type="text"
                  value={formData.tags.join(', ')}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      tags: e.target.value.split(',').map((t) => t.trim()).filter(Boolean),
                    })
                  }
                  placeholder="Abyss Team 1, Main DPS, Hypercarry"
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-slate-200"
                />
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-950 flex items-center justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium cursor-pointer transition-colors"
          >
            Batal
          </button>
          <button
            onClick={handleSave}
            className="px-5 py-2 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-xs font-bold cursor-pointer transition-colors shadow-lg shadow-cyan-950/40"
          >
            Simpan Perubahan
          </button>
        </div>
      </div>
    </div>
  );
}
