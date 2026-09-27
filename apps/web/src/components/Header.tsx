import React from 'react';
import { GameType } from '../types/kanban';

interface HeaderProps {
  activeGame: GameType | 'ALL';
  onSelectGame: (game: GameType | 'ALL') => void;
  onOpenAddModal: () => void;
  onOpenCalendar: () => void;
  onOpenGacha: () => void;
  onOpenBackup: () => void;
  cardCount: number;
}

export function Header({
  activeGame,
  onSelectGame,
  onOpenAddModal,
  onOpenCalendar,
  onOpenGacha,
  onOpenBackup,
  cardCount,
}: HeaderProps) {
  return (
    <header className="sticky top-0 z-30 border-b border-slate-800 bg-slate-950/80 backdrop-blur-md px-4 py-3">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-3">
        {/* Logo & Subtitle */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-600 via-indigo-500 to-amber-400 p-[2px] shadow-lg shadow-cyan-950/40">
            <div className="w-full h-full bg-slate-950 rounded-[10px] flex items-center justify-center text-lg font-black tracking-wider text-cyan-400">
              HK
            </div>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold tracking-tight bg-gradient-to-r from-slate-100 via-cyan-200 to-indigo-300 bg-clip-text text-transparent">
                HoyoKanban
              </h1>
              <span className="text-xs px-2 py-0.5 rounded-full bg-cyan-950 text-cyan-400 border border-cyan-800 font-mono">
                v1.0 Vercel
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Genshin Impact & Zenless Zone Zero Progress Tracker ({cardCount} karakter aktif)
            </p>
          </div>
        </div>

        {/* Filter Game Selector */}
        <div className="flex items-center bg-slate-900 border border-slate-800 rounded-lg p-1 self-start md:self-auto">
          <button
            onClick={() => onSelectGame('ALL')}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
              activeGame === 'ALL'
                ? 'bg-slate-800 text-cyan-400 shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Semua Game
          </button>
          <button
            onClick={() => onSelectGame('GENSHIN_IMPACT')}
            className={`px-3 py-1.5 rounded-md text-xs font-medium flex items-center gap-1.5 transition-all ${
              activeGame === 'GENSHIN_IMPACT'
                ? 'bg-amber-950/60 text-amber-300 border border-amber-800/60 shadow-sm'
                : 'text-slate-400 hover:text-amber-200'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-amber-400"></span>
            Genshin Impact
          </button>
          <button
            onClick={() => onSelectGame('ZENLESS_ZONE_ZERO')}
            className={`px-3 py-1.5 rounded-md text-xs font-medium flex items-center gap-1.5 transition-all ${
              activeGame === 'ZENLESS_ZONE_ZERO'
                ? 'bg-cyan-950/60 text-cyan-300 border border-cyan-800/60 shadow-sm'
                : 'text-slate-400 hover:text-cyan-200'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse"></span>
            Zenless Zone Zero
          </button>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={onOpenAddModal}
            className="px-3.5 py-1.5 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-semibold text-xs transition-colors flex items-center gap-1.5 shadow-md shadow-cyan-900/30 cursor-pointer"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
            </svg>
            Tambah Karakter
          </button>

          <button
            onClick={onOpenCalendar}
            className="px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 text-xs font-medium transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            📅 Jadwal Farming
          </button>

          <button
            onClick={onOpenGacha}
            className="px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 text-xs font-medium transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            💎 Gacha Planner
          </button>

          <button
            onClick={onOpenBackup}
            className="px-2.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 text-xs transition-colors cursor-pointer"
            title="Backup & Restore Data"
          >
            💾 Backup
          </button>
        </div>
      </div>
    </header>
  );
}
