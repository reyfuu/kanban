import type { KanbanStage, UserCard } from '../types/kanban';

export interface BoardState { boards: { id: string; name: string }[]; activeId: string }
export const DEFAULT_BOARDS: BoardState = { boards: [{ id: 'main', name: 'Papan utama' }], activeId: 'main' };
export function isBoardState(value: unknown): value is BoardState {
  if (!value || typeof value !== 'object') return false;
  const state = value as BoardState;
  return Array.isArray(state.boards) && state.boards.length > 0 && state.boards.length <= 50
    && state.boards.every(board => board && typeof board.id === 'string' && !!board.id && board.id.length <= 200
      && typeof board.name === 'string' && !!board.name.trim() && board.name.length <= 60)
    && new Set(state.boards.map(board => board.id)).size === state.boards.length
    && state.boards.some(board => board.id === 'main') && state.boards.some(board => board.id === state.activeId);
}

export function cardsOnBoard(cards: UserCard[], boardId: string) {
  return cards.filter(card => (card.boardId ?? 'main') === boardId);
}

export const STAGES: { id: KanbanStage; label: string }[] = [
  { id: 'WISHLIST', label: 'Wishlist' },
  { id: 'BACKLOG', label: 'Antrean' },
  { id: 'LEVELING', label: 'Level & ascension' },
  { id: 'TALENTS', label: 'Talenta' },
  { id: 'GEAR', label: 'Gear' },
  { id: 'TUNING', label: 'Fine-tuning' },
  { id: 'READY', label: 'Siap dimainkan' },
];

export const BOARD_GROUPS: { title: string; description: string; stage: KanbanStage; stages: KanbanStage[] }[] = [
  { title: 'Rencana', description: 'Karakter berikutnya', stage: 'BACKLOG', stages: ['WISHLIST', 'BACKLOG'] },
  { title: 'Dalam proses', description: 'Sedikit progres setiap hari', stage: 'LEVELING', stages: ['LEVELING', 'TALENTS', 'GEAR', 'TUNING'] },
  { title: 'Selesai', description: 'Siap masuk tim', stage: 'READY', stages: ['READY'] },
];

export function moveCard(cards: UserCard[], id: string, stage: KanbanStage): UserCard[] {
  return cards.map(card => card.id === id ? { ...card, stage, updatedAt: Date.now() } : card);
}
