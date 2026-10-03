import { useState } from 'react';
import type { UserCard } from '../types/kanban';
import type { BoardColumnView } from '../lib/board';
import { KanbanCard } from './KanbanCard';
import { Icon } from './ui';

// Tipe tersendiri supaya jatuhan kolom tidak tertukar dengan jatuhan kartu yang memakai text/plain.
const COLUMN_TYPE = 'application/x-hoyokanban-column';

export function KanbanBoard({ columns, stages, cards, todayIds, onOpenDetail, onMoveCardStage, onAdd, onRenameColumn, onDeleteColumn, onReorderColumn }: {
  columns: BoardColumnView[];
  stages: { id: string; label: string }[];
  cards: UserCard[];
  todayIds: Set<string>;
  onOpenDetail: (card: UserCard) => void;
  onMoveCardStage: (id: string, stage: string) => void;
  onAdd: () => void;
  onRenameColumn: (id: string) => void;
  onDeleteColumn: (id: string) => void;
  onReorderColumn: (fromStage: string, toStage: string) => void;
}) {
  const [dragOver, setDragOver] = useState<string | null>(null);
  const [dragColumn, setDragColumn] = useState<string | null>(null);
  // Kartu dengan tahap tak dikenal (mis. kolomnya sudah dihapus di perangkat lain) ikut kolom pertama, bukan hilang.
  const known = new Set(columns.flatMap(column => column.stages));
  return <div className="kanban-board">{columns.map((column, index) => {
    const items = cards.filter(card => column.stages.includes(card.stage) || (index === 0 && !known.has(card.stage)));
    return <section key={column.stage} className={`kanban-column ${dragOver === column.stage ? 'drop-active' : ''} ${dragColumn === column.stage ? 'dragging' : ''}`} aria-label={column.title}
      onDragOver={event => { event.preventDefault(); event.dataTransfer.dropEffect = 'move'; setDragOver(dragColumn === column.stage ? null : column.stage); }}
      onDragLeave={event => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDragOver(null); }}
      onDrop={event => {
        event.preventDefault(); setDragOver(null);
        const movedColumn = event.dataTransfer.getData(COLUMN_TYPE);
        if (movedColumn) { onReorderColumn(movedColumn, column.stage); return; }
        const id = event.dataTransfer.getData('text/plain');
        if (cards.some(card => card.id === id)) onMoveCardStage(id, column.stage);
      }}>
      <div className="column-heading" draggable
        onDragStart={event => { event.dataTransfer.setData(COLUMN_TYPE, column.stage); event.dataTransfer.effectAllowed = 'move'; setDragColumn(column.stage); }}
        onDragEnd={() => { setDragColumn(null); setDragOver(null); }}>
        <h2><span className={`stage-dot stage-${column.stage.toLowerCase()}`} /><span className="column-title" title={column.title}>{column.title}</span></h2>
        <div className="column-actions" draggable={false}><span className="column-count">{items.length}</span>
          {column.custom && <>
            <button type="button" className="icon-button" aria-label={`Ganti nama kolom ${column.title}`} onClick={() => onRenameColumn(column.stage)}><Icon name="edit" size={16} /></button>
            <button type="button" className="icon-button" aria-label={`Hapus kolom ${column.title}`} onClick={() => onDeleteColumn(column.stage)}><Icon name="trash" size={16} /></button>
          </>}
        </div>
      </div>
      <p className="column-description">{column.description}</p>
      <div className="column-cards">{items.map(card => <KanbanCard key={card.id} card={card} stages={stages} openToday={todayIds.has(card.characterId)} onOpenDetail={onOpenDetail} onMoveStage={onMoveCardStage} />)}
        {!items.length && <div className="column-empty">{column.custom ? 'Tarik kartu ke sini.' : column.stage === 'BACKLOG' ? 'Ruang untuk rencana barumu.' : column.stage === 'READY' ? 'Build yang selesai akan ada di sini.' : 'Pindahkan karakter saat mulai dikerjakan.'}</div>}
      </div>
      {index === 0 && <button className="add-to-column" onClick={onAdd}><Icon name="plus" size={16} />Tambah karakter</button>}
    </section>;
  })}</div>;
}
