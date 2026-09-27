'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { AddCharacterModal } from '../components/AddCharacterModal';
import { CharacterDetailModal } from '../components/CharacterDetailModal';
import { Header } from '../components/Header';
import { KanbanBoard } from '../components/KanbanBoard';
import { StaminaHub } from '../components/StaminaHub';
import { DOMAIN_SCHEDULE } from '../data/domains';
import { loadCards, loadRoutine, loadStamina, saveCards, saveRoutine, saveStamina } from '../lib/storage';
import { DailyRoutine, GameType, KanbanStage, StaminaState, UserCard } from '../types/kanban';

export default function HomePage() {
  const [cards, setCards] = useState<UserCard[]>([]);
  const [stamina, setStamina] = useState<StaminaState | null>(null);
  const [routine, setRoutine] = useState<DailyRoutine | null>(null);
  const [activeGame, setActiveGame] = useState<GameType | 'ALL'>('ALL');
  const [selectedCard, setSelectedCard] = useState<UserCard | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showCalendar, setShowCalendar] = useState(false);
  const [showGachaPanel, setShowGachaPanel] = useState(false);

  // Gacha state
  const [primoAmount, setPrimoAmount] = useState(0);
  const [fatesAmount, setFatesAmount] = useState(0);
  const [polychrome, setPolychrome] = useState(0);
  const [tapes, setTapes] = useState(0);
  const [pityCurrent, setPityCurrent] = useState(0);
  const [is5050, setIs5050] = useState(true);

  // Load from localStorage on client mount
  useEffect(() => {
    setCards(loadCards());
    setStamina(loadStamina());
    setRoutine(loadRoutine());
  }, []);

  // Persist stamina changes
  const handleUpdateStamina = useCallback((newStamina: StaminaState) => {
    setStamina(newStamina);
    saveStamina(newStamina);
  }, []);

  // Persist routine changes
  const handleUpdateRoutine = useCallback((newRoutine: DailyRoutine) => {
    setRoutine(newRoutine);
    saveRoutine(newRoutine);
  }, []);

  // Persist card changes
  const handleUpdateCards = useCallback((newCards: UserCard[]) => {
    setCards(newCards);
    saveCards(newCards);
  }, []);

  const handleMoveCardStage = useCallback((cardId: string, targetStage: KanbanStage) => {
    setCards((prev) => {
      const updated = prev.map((c) =>
        c.id === cardId ? { ...c, stage: targetStage, updatedAt: Date.now() } : c
      );
      saveCards(updated);
      return updated;
    });
  }, []);

  const handleQuickMove = useCallback((cardId: string, direction: 'prev' | 'next') => {
    const STAGES: KanbanStage[] = ['WISHLIST', 'BACKLOG', 'LEVELING', 'TALENTS', 'GEAR', 'TUNING', 'READY'];
    setCards((prev) => {
      const updated = prev.map((c) => {
        if (c.id !== cardId) return c;
        const idx = STAGES.indexOf(c.stage);
        const newIdx = direction === 'next' ? Math.min(idx + 1, STAGES.length - 1) : Math.max(idx - 1, 0);
        return { ...c, stage: STAGES[newIdx] as KanbanStage, updatedAt: Date.now() };
      });
      saveCards(updated);
      return updated;
    });
  }, []);

  const handleSaveCard = useCallback((updatedCard: UserCard) => {
    setCards((prev) => {
      const updated = prev.map((c) => (c.id === updatedCard.id ? updatedCard : c));
      saveCards(updated);
      return updated;
    });
  }, []);

  const handleDeleteCard = useCallback((cardId: string) => {
    setCards((prev) => {
      const updated = prev.filter((c) => c.id !== cardId);
      saveCards(updated);
      return updated;
    });
  }, []);

  const handleAddCard = useCallback((newCard: UserCard) => {
    setCards((prev) => {
      const updated = [...prev, newCard];
      saveCards(updated);
      return updated;
    });
  }, []);

  // JSON Backup / Restore
  const handleBackup = () => {
    const data = {
      version: '1.0',
      exportDate: new Date().toISOString(),
      cards,
      stamina,
      routine,
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `hoyokanban-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleRestore = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        try {
          const data = JSON.parse(ev.target?.result as string);
          if (data.cards) handleUpdateCards(data.cards);
          if (data.stamina) handleUpdateStamina(data.stamina);
          if (data.routine) handleUpdateRoutine(data.routine);
          alert('✅ Data berhasil dipulihkan!');
        } catch {
          alert('❌ File tidak valid atau corrupt.');
        }
      };
      reader.readAsText(file);
    };
    input.click();
  };

  const filteredCards = activeGame === 'ALL'
    ? cards
    : cards.filter((c) => c.game === activeGame);

  const todayDayIndex = new Date().getDay();
  const todaySchedule = DOMAIN_SCHEDULE[todayDayIndex];

  // Gacha calculations
  const genshinPulls = Math.floor(primoAmount / 160) + fatesAmount;
  const zzzPulls = Math.floor(polychrome / 160) + tapes;
  const genshinToHardPity = Math.max(0, 90 - pityCurrent);
  const genshinGuarantee = is5050 ? 'Hard pity (90)' : 'Guarantee aktif!';

  if (!stamina || !routine) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="text-center space-y-3">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-cyan-600 via-indigo-500 to-amber-400 mx-auto flex items-center justify-center text-xl font-black text-white animate-pulse">
            HK
          </div>
          <p className="text-slate-400 text-sm">Memuat HoyoKanban...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col">
      {/* App Header */}
      <Header
        activeGame={activeGame}
        onSelectGame={setActiveGame}
        onOpenAddModal={() => setShowAddModal(true)}
        onOpenCalendar={() => setShowCalendar((v) => !v)}
        onOpenGacha={() => setShowGachaPanel((v) => !v)}
        onOpenBackup={handleBackup}
        cardCount={cards.length}
      />

      <main className="flex-1 max-w-[1600px] mx-auto w-full px-4 py-5 space-y-5">
        {/* Stamina Hub */}
        <StaminaHub
          stamina={stamina}
          routine={routine}
          onUpdateStamina={handleUpdateStamina}
          onUpdateRoutine={handleUpdateRoutine}
        />

        {/* Today's Farming Calendar (collapsible) */}
        {showCalendar && (
          <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 shadow-xl animate-in slide-in-from-top-2 duration-200">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-bold text-slate-200 flex items-center gap-2">
                📅 Jadwal Domain Farming Hari Ini —{' '}
                <span className="text-cyan-400">{todaySchedule.dayName}</span>
              </h2>
              <button
                onClick={() => setShowCalendar(false)}
                className="text-slate-500 hover:text-slate-300 text-xs cursor-pointer"
              >
                Tutup ✕
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
              <div className="bg-slate-950 p-3 rounded-lg border border-amber-900/30">
                <div className="flex items-center gap-1.5 mb-2">
                  <span className="w-2 h-2 rounded-full bg-amber-400"></span>
                  <span className="font-semibold text-amber-300">Buku Talenta (Genshin)</span>
                </div>
                <ul className="space-y-1 text-slate-300">
                  {todaySchedule.genshinTalents.map((t, i) => (
                    <li key={i} className="flex items-center gap-1.5">
                      <span className="text-amber-500">•</span> {t}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
                <div className="flex items-center gap-1.5 mb-2">
                  <span className="w-2 h-2 rounded-full bg-purple-400"></span>
                  <span className="font-semibold text-purple-300">Domain Senjata (Genshin)</span>
                </div>
                <ul className="space-y-1 text-slate-300">
                  {todaySchedule.genshinWeapons.slice(0, 3).map((w, i) => (
                    <li key={i} className="flex items-center gap-1.5">
                      <span className="text-purple-500">•</span> {w}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="bg-slate-950 p-3 rounded-lg border border-cyan-900/30">
                <div className="flex items-center gap-1.5 mb-2">
                  <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse"></span>
                  <span className="font-semibold text-cyan-300">Fokus Hari Ini (ZZZ)</span>
                </div>
                <ul className="space-y-1 text-slate-300">
                  {todaySchedule.zzzFocus.map((z, i) => (
                    <li key={i} className="flex items-center gap-1.5">
                      <span className="text-cyan-500">•</span> {z}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        )}

        {/* Gacha / Pity Planner (collapsible) */}
        {showGachaPanel && (
          <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 shadow-xl animate-in slide-in-from-top-2 duration-200">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-bold text-slate-200 flex items-center gap-2">
                💎 Gacha & Pity Planner
              </h2>
              <button
                onClick={() => setShowGachaPanel(false)}
                className="text-slate-500 hover:text-slate-300 text-xs cursor-pointer"
              >
                Tutup ✕
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs">
              {/* Genshin */}
              <div className="bg-slate-950 p-4 rounded-xl border border-amber-900/30 space-y-3">
                <h3 className="font-bold text-amber-300 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-amber-400"></span>
                  Genshin Impact
                </h3>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-slate-400 block mb-1">Primogem</label>
                    <input type="number" min={0} value={primoAmount}
                      onChange={(e) => setPrimoAmount(+e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-slate-200 font-mono" />
                  </div>
                  <div>
                    <label className="text-slate-400 block mb-1">Intertwined Fates</label>
                    <input type="number" min={0} value={fatesAmount}
                      onChange={(e) => setFatesAmount(+e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-slate-200 font-mono" />
                  </div>
                  <div>
                    <label className="text-slate-400 block mb-1">Pity Saat Ini (0–90)</label>
                    <input type="number" min={0} max={90} value={pityCurrent}
                      onChange={(e) => setPityCurrent(+e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-slate-200 font-mono" />
                  </div>
                  <div>
                    <label className="text-slate-400 block mb-1">Status 50/50</label>
                    <select value={is5050 ? 'yes' : 'no'}
                      onChange={(e) => setIs5050(e.target.value === 'yes')}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-slate-200">
                      <option value="yes">50/50 Aktif</option>
                      <option value="no">Guarantee (Pasti Dapat)</option>
                    </select>
                  </div>
                </div>

                <div className="bg-amber-950/30 border border-amber-800/40 rounded-lg p-3 space-y-1">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Total Pulls Tersedia</span>
                    <span className="font-bold font-mono text-amber-300">{genshinPulls} pulls</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Menuju Hard Pity</span>
                    <span className="font-bold font-mono text-slate-200">{genshinToHardPity} pulls lagi</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Status Garansi</span>
                    <span className={`font-bold text-xs ${is5050 ? 'text-amber-400' : 'text-emerald-400'}`}>
                      {genshinGuarantee}
                    </span>
                  </div>
                  <div className="flex justify-between pt-1 border-t border-slate-800">
                    <span className="text-slate-400">Verdict</span>
                    <span className={`font-bold text-xs ${genshinPulls >= genshinToHardPity ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {genshinPulls >= genshinToHardPity
                        ? `✓ Cukup! Masih sisa ${genshinPulls - genshinToHardPity} pulls`
                        : `✗ Kurang ${genshinToHardPity - genshinPulls} pulls`}
                    </span>
                  </div>
                </div>
              </div>

              {/* ZZZ */}
              <div className="bg-slate-950 p-4 rounded-xl border border-cyan-900/30 space-y-3">
                <h3 className="font-bold text-cyan-300 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse"></span>
                  Zenless Zone Zero
                </h3>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-slate-400 block mb-1">Polychrome</label>
                    <input type="number" min={0} value={polychrome}
                      onChange={(e) => setPolychrome(+e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-slate-200 font-mono" />
                  </div>
                  <div>
                    <label className="text-slate-400 block mb-1">Encrypted Master Tapes</label>
                    <input type="number" min={0} value={tapes}
                      onChange={(e) => setTapes(+e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-slate-200 font-mono" />
                  </div>
                </div>

                <div className="bg-cyan-950/30 border border-cyan-800/40 rounded-lg p-3 space-y-1">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Total Searches (Pulls)</span>
                    <span className="font-bold font-mono text-cyan-300">{zzzPulls} searches</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Setara Polychrome</span>
                    <span className="font-mono text-slate-200">{(zzzPulls * 160).toLocaleString('id-ID')}</span>
                  </div>
                </div>

                <div className="text-[11px] text-slate-500 bg-slate-950/60 p-2 rounded-lg border border-slate-800">
                  <p>Hard Pity ZZZ: <strong className="text-slate-300">90 searches</strong> (karakter S-Rank)</p>
                  <p>W-Engine Pity: <strong className="text-slate-300">80 searches</strong></p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Main Kanban Board */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-slate-300">
              Papan Kanban Build Karakter
              {activeGame !== 'ALL' && (
                <span className={`ml-2 text-xs px-2 py-0.5 rounded border font-mono ${
                  activeGame === 'GENSHIN_IMPACT'
                    ? 'bg-amber-950 text-amber-300 border-amber-800'
                    : 'bg-cyan-950 text-cyan-300 border-cyan-800'
                }`}>
                  {activeGame === 'GENSHIN_IMPACT' ? 'Genshin Impact' : 'Zenless Zone Zero'}
                </span>
              )}
            </h2>
            <div className="flex items-center gap-2 text-xs">
              <span className="text-slate-500">
                {filteredCards.length} karakter ditampilkan
              </span>
              <button
                onClick={handleRestore}
                className="px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-400 hover:text-slate-200 text-xs transition-colors cursor-pointer"
              >
                📤 Impor JSON
              </button>
            </div>
          </div>

          <KanbanBoard
            cards={filteredCards}
            onOpenDetail={setSelectedCard}
            onMoveCardStage={handleMoveCardStage}
            onQuickMove={handleQuickMove}
            onDeleteCard={handleDeleteCard}
          />
        </div>

        {/* Footer */}
        <footer className="text-center py-6 text-xs text-slate-600 border-t border-slate-900">
          <p>
            HoyoKanban v1.0 · Local-First · Data tersimpan di browser Anda ·{' '}
            <button
              onClick={handleBackup}
              className="text-cyan-700 hover:text-cyan-500 cursor-pointer underline"
            >
              Backup JSON
            </button>
          </p>
          <p className="mt-1 text-slate-700">
            Bukan afiliasi atau produk resmi HoYoverse. Dibuat untuk pemain, oleh pemain.
          </p>
        </footer>
      </main>

      {/* Modals */}
      <AddCharacterModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        onAddCard={handleAddCard}
      />

      <CharacterDetailModal
        card={selectedCard}
        onClose={() => setSelectedCard(null)}
        onSave={handleSaveCard}
        onDelete={handleDeleteCard}
      />
    </div>
  );
}
