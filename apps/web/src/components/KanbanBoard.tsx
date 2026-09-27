import React, { useState } from 'react';
import { KanbanStage, UserCard } from '../types/kanban';
import { KanbanCard } from './KanbanCard';

interface KanbanBoardProps {
  cards: UserCard[];
  onOpenDetail: (card: UserCard) => void;
  onMoveCardStage: (cardId: string, targetStage: KanbanStage) => void;
  onQuickMove: (cardId: string, direction: 'prev' | 'next') => void;
  onDeleteCard: (cardId: string) => void;
}

interface ColumnConfig {
  id: KanbanStage;
  title: string;
  subtitle: string;
  badgeColor: string;
  accentBorder: string;
}

const COLUMNS: ColumnConfig[] = [
  {
    id: 'WISHLIST',
    title: 'Wishlist / Target',
    subtitle: 'Pre-farming banner mendatang',
    badgeColor: 'bg-indigo-950 text-indigo-300 border-indigo-800',
    accentBorder: 'border-t-indigo-500',
  },
  {
    id: 'BACKLOG',
    title: 'In Queue',
    subtitle: 'Sudah dapat, antrean build',
    badgeColor: 'bg-slate-900 text-slate-300 border-slate-700',
    accentBorder: 'border-t-slate-500',
  },
  {
    id: 'LEVELING',
    title: 'Level & Ascension',
    subtitle: 'Farming EXP & World Boss',
    badgeColor: 'bg-amber-950 text-amber-300 border-amber-800',
    accentBorder: 'border-t-amber-500',
  },
  {
    id: 'TALENTS',
    title: 'Skills & Talents',
    subtitle: 'Farming buku & chips domain',
    badgeColor: 'bg-blue-950 text-blue-300 border-blue-800',
    accentBorder: 'border-t-blue-500',
  },
  {
    id: 'GEAR',
    title: 'Gear & Relics',
    subtitle: 'Artifact & Drive Disc tuning',
    badgeColor: 'bg-purple-950 text-purple-300 border-purple-800',
    accentBorder: 'border-t-purple-500',
  },
  {
    id: 'TUNING',
    title: 'Fine-Tuning',
    subtitle: 'Min-max substat & Crown',
    badgeColor: 'bg-pink-950 text-pink-300 border-pink-800',
    accentBorder: 'border-t-pink-500',
  },
  {
    id: 'READY',
    title: 'Combat Ready',
    subtitle: 'Siap tempur di Abyss & Shiyu',
    badgeColor: 'bg-emerald-950 text-emerald-300 border-emerald-800',
    accentBorder: 'border-t-emerald-500',
  },
];

export function KanbanBoard({
  cards,
  onOpenDetail,
  onMoveCardStage,
  onQuickMove,
  onDeleteCard,
}: KanbanBoardProps) {
  const [dragOverCol, setDragOverCol] = useState<KanbanStage | null>(null);

  const handleDragOver = (e: React.DragEvent, colId: KanbanStage) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverCol !== colId) {
      setDragOverCol(colId);
    }
  };

  const handleDragLeave = () => {
    setDragOverCol(null);
  };

  const handleDrop = (e: React.DragEvent, targetStage: KanbanStage) => {
    e.preventDefault();
    setDragOverCol(null);
    const cardId = e.dataTransfer.getData('text/plain');
    if (cardId) {
      onMoveCardStage(cardId, targetStage);
    }
  };

  return (
    <div className="w-full overflow-x-auto pb-6">
      <div className="flex gap-4 min-w-[1400px]">
        {COLUMNS.map((col) => {
          const colCards = cards.filter((c) => c.stage === col.id);
          const isDragTarget = dragOverCol === col.id;

          return (
            <div
              key={col.id}
              onDragOver={(e) => handleDragOver(e, col.id)}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, col.id)}
              className={`flex-1 min-w-[240px] max-w-[280px] bg-slate-950/70 border border-slate-800/80 rounded-xl p-3 flex flex-col transition-all border-t-2 ${
                col.accentBorder
              } ${isDragTarget ? 'bg-cyan-950/20 border-cyan-500/60 ring-2 ring-cyan-500/30' : ''}`}
            >
              {/* Column Header */}
              <div className="flex items-center justify-between mb-1">
                <h3 className="text-xs font-bold text-slate-200 tracking-wide uppercase">
                  {col.title}
                </h3>
                <span
                  className={`text-[10px] font-mono px-2 py-0.5 rounded-full border ${col.badgeColor}`}
                >
                  {colCards.length}
                </span>
              </div>
              <p className="text-[10px] text-slate-500 mb-3 truncate">{col.subtitle}</p>

              {/* Cards Container */}
              <div className="space-y-3 flex-1 min-h-[300px]">
                {colCards.length === 0 ? (
                  <div className="h-32 border-2 border-dashed border-slate-850 rounded-lg flex items-center justify-center p-3 text-center">
                    <span className="text-[11px] text-slate-600">Tarik kartu ke sini</span>
                  </div>
                ) : (
                  colCards.map((card) => (
                    <KanbanCard
                      key={card.id}
                      card={card}
                      onOpenDetail={onOpenDetail}
                      onMoveStage={onQuickMove}
                      onDeleteCard={onDeleteCard}
                    />
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
