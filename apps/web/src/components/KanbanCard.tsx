import type { UserCard } from '../types/kanban';
import { CHARACTERS_DATABASE } from '../data/characters';
import { Avatar } from './ui';

export function KanbanCard({ card, stages, openToday, onOpenDetail, onMoveStage }: {
  card: UserCard;
  stages: { id: string; label: string }[];
  openToday: boolean;
  onOpenDetail: (card: UserCard) => void;
  onMoveStage: (id: string, stage: string) => void;
}) {
  const meta = CHARACTERS_DATABASE.find(character => character.id === card.characterId);
  const name = meta?.name ?? card.characterId;
  return <article className="character-card" draggable onDragStart={event => { event.dataTransfer.setData('text/plain', card.id); event.dataTransfer.effectAllowed = 'move'; }}>
    <button className="character-summary" onClick={() => onOpenDetail(card)} aria-label={`Buka detail ${name}`}>
      <Avatar name={name} src={meta?.avatarUrl} />
      <span><strong>{name}</strong><span className="character-meta">{card.game === 'GENSHIN_IMPACT' ? 'Genshin' : 'ZZZ'}{meta ? ` / ${meta.element}` : ''}</span></span>
    </button>
    {openToday && <span className="today-badge">Domain buka hari ini</span>}
    <div className="card-level"><span>Level <strong>{card.currentLevel}</strong><span className="muted"> / {card.targetLevel}</span></span><span className={`priority priority-${card.priority.toLowerCase()}`}><span />{card.priority === 'HIGH' ? 'Prioritas tinggi' : card.priority === 'MEDIUM' ? 'Prioritas sedang' : 'Prioritas rendah'}</span></div>
    <div className="card-bottom"><label className="sr-only" htmlFor={`stage-${card.id}`}>Tahap {name}</label><select id={`stage-${card.id}`} value={card.stage} onChange={event => onMoveStage(card.id, event.target.value)}>{stages.map(stage => <option key={stage.id} value={stage.id}>{stage.label}</option>)}</select><button className="text-button" onClick={() => onOpenDetail(card)}>Detail</button></div>
  </article>;
}
