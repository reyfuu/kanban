import React from 'react';
import { Character, KanbanStage, UserCard } from '../types/kanban';
import { CHARACTERS_DATABASE } from '../data/characters';

interface KanbanCardProps {
  card: UserCard;
  onOpenDetail: (card: UserCard) => void;
  onMoveStage: (cardId: string, direction: 'prev' | 'next') => void;
  onDeleteCard: (cardId: string) => void;
}

const STAGE_ORDER: KanbanStage[] = [
  'WISHLIST',
  'BACKLOG',
  'LEVELING',
  'TALENTS',
  'GEAR',
  'TUNING',
  'READY',
];

export function KanbanCard({
  card,
  onOpenDetail,
  onMoveStage,
  onDeleteCard,
}: KanbanCardProps) {
  const meta: Character | undefined = CHARACTERS_DATABASE.find(
    (c) => c.id === card.characterId
  );

  const isGenshin = card.game === 'GENSHIN_IMPACT';
  const maxLevel = isGenshin ? 90 : 60;
  const levelProgress = Math.min(100, Math.round((card.currentLevel / card.targetLevel) * 100));

  const currentStageIndex = STAGE_ORDER.indexOf(card.stage);
  const canMovePrev = currentStageIndex > 0;
  const canMoveNext = currentStageIndex < STAGE_ORDER.length - 1;

  // Element color accents
  const getElementBadgeColor = (elem?: string) => {
    switch (elem?.toLowerCase()) {
      case 'pyro':
      case 'fire':
        return 'bg-red-950 text-red-400 border-red-800';
      case 'hydro':
        return 'bg-blue-950 text-blue-400 border-blue-800';
      case 'cryo':
      case 'ice':
        return 'bg-cyan-950 text-cyan-300 border-cyan-800';
      case 'electro':
      case 'shock':
        return 'bg-purple-950 text-purple-300 border-purple-800';
      case 'dendro':
        return 'bg-emerald-950 text-emerald-400 border-emerald-800';
      case 'anemo':
        return 'bg-teal-950 text-teal-300 border-teal-800';
      case 'geo':
        return 'bg-amber-950 text-amber-400 border-amber-800';
      case 'ether':
        return 'bg-pink-950 text-pink-400 border-pink-800';
      case 'physical':
        return 'bg-slate-800 text-slate-300 border-slate-700';
      default:
        return 'bg-slate-800 text-slate-300 border-slate-700';
    }
  };

  const getPriorityStyle = (priority: string) => {
    switch (priority) {
      case 'HIGH':
        return 'bg-rose-950/80 text-rose-300 border-rose-800';
      case 'MEDIUM':
        return 'bg-amber-950/80 text-amber-300 border-amber-800';
      case 'LOW':
        return 'bg-slate-900 text-slate-400 border-slate-800';
      default:
        return 'bg-slate-900 text-slate-400 border-slate-800';
    }
  };

  const handleDragStart = (e: React.DragEvent) => {
    e.dataTransfer.setData('text/plain', card.id);
    e.dataTransfer.effectAllowed = 'move';
  };

  return (
    <div
      draggable
      onDragStart={handleDragStart}
      className="bg-slate-900/90 hover:bg-slate-850 border border-slate-800 hover:border-slate-700 rounded-xl p-3 shadow-md hover:shadow-xl transition-all cursor-grab active:cursor-grabbing select-none relative group"
    >
      {/* Card Header: Avatar, Name, Game Badge */}
      <div className="flex items-start gap-2.5 mb-2.5">
        <div className="relative w-12 h-12 rounded-lg overflow-hidden bg-slate-950 border border-slate-800 shrink-0">
          {meta?.avatarUrl ? (
            <img
              src={meta.avatarUrl}
              alt={meta?.name || 'Character'}
              className="w-full h-full object-cover"
              onError={(e) => {
                // fallback to placeholder if image fails
                (e.target as HTMLElement).style.display = 'none';
              }}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-xs font-bold text-slate-500">
              {meta?.name?.slice(0, 2) || 'CH'}
            </div>
          )}
          <span className="absolute bottom-0 right-0 text-[9px] font-mono px-1 rounded-tl bg-slate-950/90 text-amber-400 font-bold">
            {meta?.rarity}★
          </span>
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-1 mb-0.5">
            <h4
              onClick={() => onOpenDetail(card)}
              className="text-xs font-bold text-slate-100 hover:text-cyan-400 truncate cursor-pointer transition-colors"
              title={meta?.name || card.characterId}
            >
              {meta?.name || card.characterId}
            </h4>
            <span
              className={`text-[9px] font-medium px-1.5 py-0.2 rounded border ${getElementBadgeColor(
                meta?.element
              )}`}
            >
              {meta?.element || 'Element'}
            </span>
          </div>

          <p className="text-[10px] text-slate-400 truncate">
            {card.equipment.name || meta?.weaponOrSpecialty || 'Gear'}
          </p>

          <div className="flex items-center gap-1 mt-1">
            <span
              className={`text-[9px] px-1.5 py-0.2 rounded border font-mono ${getPriorityStyle(
                card.priority
              )}`}
            >
              {card.priority === 'HIGH' ? 'Tinggi' : card.priority === 'MEDIUM' ? 'Sedang' : 'Rendah'}
            </span>
            <span className="text-[9px] text-slate-500 font-mono">
              {isGenshin ? 'GI' : 'ZZZ'}
            </span>
          </div>
        </div>
      </div>

      {/* Progress Section */}
      <div className="space-y-1 mb-2.5">
        <div className="flex items-center justify-between text-[10px]">
          <span className="text-slate-400">
            Level: <strong className="text-slate-200">{card.currentLevel}</strong> →{' '}
            <span className="text-cyan-400 font-mono">{card.targetLevel}</span>
          </span>
          <span className="text-slate-400 font-mono text-[9px]">{levelProgress}%</span>
        </div>
        <div className="w-full bg-slate-950 rounded-full h-1.5 overflow-hidden border border-slate-800">
          <div
            className={`h-1.5 rounded-full transition-all ${
              isGenshin ? 'bg-amber-500' : 'bg-cyan-500'
            }`}
            style={{ width: `${levelProgress}%` }}
          ></div>
        </div>
      </div>

      {/* Talents / Skills mini overview */}
      <div className="flex items-center justify-between text-[10px] bg-slate-950/60 rounded px-2 py-1 mb-2 border border-slate-800/60">
        <span className="text-slate-400">Skill/Talenta:</span>
        <span className="font-mono text-cyan-300 font-medium">
          {card.talents.skill1Current} / {card.talents.skill2Current} / {card.talents.skill3Current}
        </span>
      </div>

      {/* Tags */}
      {card.tags && card.tags.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-2">
          {card.tags.slice(0, 2).map((t, idx) => (
            <span
              key={idx}
              className="text-[9px] px-1.5 py-0.2 rounded bg-slate-950 text-slate-400 border border-slate-800 truncate max-w-[120px]"
            >
              #{t}
            </span>
          ))}
        </div>
      )}

      {/* Card Actions: Quick Move / Detail / Delete */}
      <div className="flex items-center justify-between pt-2 border-t border-slate-800/80 text-xs">
        <button
          disabled={!canMovePrev}
          onClick={() => onMoveStage(card.id, 'prev')}
          className={`p-1 rounded transition-colors ${
            canMovePrev
              ? 'text-slate-400 hover:text-cyan-400 hover:bg-slate-800 cursor-pointer'
              : 'text-slate-700 cursor-not-allowed'
          }`}
          title="Geser ke tahap sebelumnya"
        >
          ←
        </button>

        <button
          onClick={() => onOpenDetail(card)}
          className="text-[11px] font-medium text-cyan-400 hover:text-cyan-300 px-2 py-0.5 rounded hover:bg-slate-800 cursor-pointer transition-colors"
        >
          Detail & Defisit
        </button>

        <button
          disabled={!canMoveNext}
          onClick={() => onMoveStage(card.id, 'next')}
          className={`p-1 rounded transition-colors ${
            canMoveNext
              ? 'text-slate-400 hover:text-cyan-400 hover:bg-slate-800 cursor-pointer'
              : 'text-slate-700 cursor-not-allowed'
          }`}
          title="Geser ke tahap berikutnya"
        >
          →
        </button>
      </div>
    </div>
  );
}
