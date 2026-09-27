import { useState } from 'react';
import type { KanbanStage, UserCard } from '../types/kanban';
import { BOARD_GROUPS } from '../lib/board';
import { KanbanCard } from './KanbanCard';
import { Icon } from './ui';

export function KanbanBoard({ cards, todayIds, onOpenDetail, onMoveCardStage, onAdd }: {
  cards: UserCard[];
  todayIds: Set<string>;
  onOpenDetail: (card: UserCard) => void;
  onMoveCardStage: (id: string, stage: KanbanStage) => void;
  onAdd: () => void;
}) {
  const [dragOver, setDragOver] = useState<KanbanStage | null>(null);
  return <div className="kanban-board">{BOARD_GROUPS.map(group => {
    const items = cards.filter(card => group.stages.includes(card.stage));
    return <section key={group.stage} className={`kanban-column ${dragOver === group.stage ? 'drop-active' : ''}`} aria-label={group.title}
      onDragOver={event => { event.preventDefault(); event.dataTransfer.dropEffect = 'move'; setDragOver(group.stage); }}
      onDragLeave={event => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDragOver(null); }}
      onDrop={event => { event.preventDefault(); setDragOver(null); const id = event.dataTransfer.getData('text/plain'); if (cards.some(card => card.id === id)) onMoveCardStage(id, group.stage); }}>
      <div className="column-heading"><h2><span className={`stage-dot stage-${group.stage.toLowerCase()}`} />{group.title}</h2><span className="column-count">{items.length}</span></div>
      <p className="column-description">{group.description}</p>
      <div className="column-cards">{items.map(card => <KanbanCard key={card.id} card={card} openToday={todayIds.has(card.characterId)} onOpenDetail={onOpenDetail} onMoveStage={onMoveCardStage} />)}
        {!items.length && <div className="column-empty">{group.stage === 'BACKLOG' ? 'Ruang untuk rencana barumu.' : group.stage === 'READY' ? 'Build yang selesai akan ada di sini.' : 'Pindahkan karakter saat mulai dikerjakan.'}</div>}
      </div>
      {group.stage === 'BACKLOG' && <button className="add-to-column" onClick={onAdd}><Icon name="plus" size={16} />Tambah karakter</button>}
    </section>;
  })}</div>;
}
