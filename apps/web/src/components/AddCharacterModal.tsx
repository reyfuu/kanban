import React, { useState } from 'react';
import { Character, GameType, KanbanStage, PriorityLevel, UserCard } from '../types/kanban';
import { CHARACTERS_DATABASE } from '../data/characters';

interface AddCharacterModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddCard: (card: UserCard) => void;
}

export function AddCharacterModal({ isOpen, onClose, onAddCard }: AddCharacterModalProps) {
  if (!isOpen) return null;

  const [selectedGame, setSelectedGame] = useState<GameType | 'ALL'>('ALL');
  const [search, setSearch] = useState('');
  const [selectedCharId, setSelectedCharId] = useState<string>('raiden-shogun');
  const [stage, setStage] = useState<KanbanStage>('BACKLOG');
  const [priority, setPriority] = useState<PriorityLevel>('HIGH');

  const filteredCharacters = CHARACTERS_DATABASE.filter((c) => {
    if (selectedGame !== 'ALL' && c.game !== selectedGame) return false;
    if (search && !c.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const selectedChar = CHARACTERS_DATABASE.find((c) => c.id === selectedCharId);

  const handleAdd = () => {
    if (!selectedChar) return;

    const isGenshin = selectedChar.game === 'GENSHIN_IMPACT';
    const newCard: UserCard = {
      id: 'card-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6),
      characterId: selectedChar.id,
      game: selectedChar.game,
      stage,
      priority,
      tags: [selectedChar.element, selectedChar.weaponOrSpecialty],
      currentLevel: 1,
      targetLevel: isGenshin ? 90 : 60,
      currentAscension: 0,
      targetAscension: isGenshin ? 6 : 5,
      talents: {
        skill1Current: 1,
        skill1Target: isGenshin ? 9 : 10,
        skill2Current: 1,
        skill2Target: isGenshin ? 9 : 10,
        skill3Current: 1,
        skill3Target: isGenshin ? 10 : 12,
        coreSkillCurrent: 'A',
        coreSkillTarget: 'F',
      },
      equipment: {
        name: isGenshin ? 'Signature / Favonius' : 'Signature / W-Engine',
        currentLevel: 1,
        targetLevel: isGenshin ? 90 : 60,
        refinement: 1,
      },
      gearTarget: {
        setName: 'Target Set',
        subStatsGoal: 'Crit Rate / DMG priority',
        completed: false,
      },
      notes: `Ditambahkan pada ${new Date().toLocaleDateString('id-ID')}`,
      updatedAt: Date.now(),
    };

    onAddCard(newCard);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-800 bg-slate-950">
          <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
            <span>+</span> Tambah Karakter ke Papan Kanban
          </h3>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="p-4 overflow-y-auto flex-1 space-y-4">
          {/* Game filter & Search */}
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="flex bg-slate-950 border border-slate-800 rounded-lg p-1">
              <button
                onClick={() => setSelectedGame('ALL')}
                className={`px-3 py-1 rounded text-xs font-medium cursor-pointer ${
                  selectedGame === 'ALL' ? 'bg-slate-800 text-cyan-400' : 'text-slate-400'
                }`}
              >
                Semua
              </button>
              <button
                onClick={() => setSelectedGame('GENSHIN_IMPACT')}
                className={`px-3 py-1 rounded text-xs font-medium cursor-pointer ${
                  selectedGame === 'GENSHIN_IMPACT'
                    ? 'bg-amber-950 text-amber-300 border border-amber-800'
                    : 'text-slate-400'
                }`}
              >
                Genshin
              </button>
              <button
                onClick={() => setSelectedGame('ZENLESS_ZONE_ZERO')}
                className={`px-3 py-1 rounded text-xs font-medium cursor-pointer ${
                  selectedGame === 'ZENLESS_ZONE_ZERO'
                    ? 'bg-cyan-950 text-cyan-300 border border-cyan-800'
                    : 'text-slate-400'
                }`}
              >
                ZZZ
              </button>
            </div>

            <input
              type="text"
              placeholder="Cari nama karakter..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="flex-1 bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-200 placeholder:text-slate-500"
            />
          </div>

          {/* Character Grid Picker */}
          <div>
            <label className="text-xs font-medium text-slate-400 block mb-2">
              Pilih Karakter ({filteredCharacters.length} tersedia):
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 max-h-56 overflow-y-auto p-1 bg-slate-950 rounded-xl border border-slate-800">
              {filteredCharacters.map((c) => {
                const isSelected = c.id === selectedCharId;
                return (
                  <button
                    key={c.id}
                    onClick={() => setSelectedCharId(c.id)}
                    className={`flex flex-col items-center p-2 rounded-lg border text-center transition-all cursor-pointer ${
                      isSelected
                        ? 'border-cyan-500 bg-cyan-950/40 ring-1 ring-cyan-500 shadow-md'
                        : 'border-slate-800 hover:border-slate-700 bg-slate-900/60'
                    }`}
                  >
                    <div className="w-12 h-12 rounded-lg overflow-hidden bg-slate-950 border border-slate-800 mb-1.5 relative">
                      <img
                        src={c.avatarUrl}
                        alt={c.name}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          (e.target as HTMLElement).style.display = 'none';
                        }}
                      />
                      <span className="absolute bottom-0 right-0 text-[8px] font-mono px-0.5 bg-slate-950/90 text-amber-400">
                        {c.rarity}★
                      </span>
                    </div>
                    <span className="text-[11px] font-bold text-slate-200 truncate w-full">
                      {c.name}
                    </span>
                    <span className="text-[9px] text-slate-400">
                      {c.element} • {c.game === 'GENSHIN_IMPACT' ? 'GI' : 'ZZZ'}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Stage & Priority Setting */}
          <div className="grid grid-cols-2 gap-3 text-xs bg-slate-950 p-3 rounded-xl border border-slate-800">
            <div>
              <label className="text-slate-400 block mb-1 font-medium">Tempatkan di Kolom</label>
              <select
                value={stage}
                onChange={(e) => setStage(e.target.value as KanbanStage)}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-slate-200"
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
              <label className="text-slate-400 block mb-1 font-medium">Prioritas Awal</label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as PriorityLevel)}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-slate-200"
              >
                <option value="HIGH">Tinggi (High Priority)</option>
                <option value="MEDIUM">Sedang (Medium)</option>
                <option value="LOW">Rendah (Low)</option>
              </select>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-950 flex items-center justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium cursor-pointer"
          >
            Batal
          </button>
          <button
            onClick={handleAdd}
            className="px-5 py-2 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-xs font-bold cursor-pointer transition-colors shadow-lg shadow-cyan-950/40"
          >
            Tambahkan ke Kanban
          </button>
        </div>
      </div>
    </div>
  );
}
