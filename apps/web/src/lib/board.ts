import type { KanbanStage, UserCard } from '../types/kanban';

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

export const MAX_COLUMNS = 12;

export interface BoardColumn { id: string; title: string }
export interface Board { id: string; name: string; columns?: BoardColumn[]; columnOrder?: string[] }
export interface BoardState { boards: Board[]; activeId: string }
export const DEFAULT_BOARDS: BoardState = { boards: [{ id: 'main', name: 'Papan utama' }], activeId: 'main' };

// Kolom buatan pemain opsional: papan dari versi sebelumnya tetap valid tanpa field ini.
function validColumns(value: unknown) {
  if (value === undefined) return true;
  if (!Array.isArray(value) || value.length > MAX_COLUMNS) return false;
  const columns = value as BoardColumn[];
  return columns.every(column => column && typeof column.id === 'string' && !!column.id && column.id.length <= 200
    && !STAGES.some(stage => stage.id === column.id)
    && typeof column.title === 'string' && !!column.title.trim() && column.title.length <= 40)
    && new Set(columns.map(column => column.id)).size === columns.length;
}

// Urutan kolom pilihan pemain: id yang tidak dikenal diabaikan, yang belum terdaftar tetap di urutan aslinya.
function validColumnOrder(value: unknown) {
  if (value === undefined) return true;
  if (!Array.isArray(value) || value.length > BOARD_GROUPS.length + MAX_COLUMNS) return false;
  return value.every(stage => typeof stage === 'string' && !!stage && stage.length <= 200)
    && new Set(value).size === value.length;
}

export function isBoardState(value: unknown): value is BoardState {
  if (!value || typeof value !== 'object') return false;
  const state = value as BoardState;
  return Array.isArray(state.boards) && state.boards.length > 0 && state.boards.length <= 50
    && state.boards.every(board => board && typeof board.id === 'string' && !!board.id && board.id.length <= 200
      && typeof board.name === 'string' && !!board.name.trim() && board.name.length <= 60
      && validColumns(board.columns) && validColumnOrder(board.columnOrder))
    && new Set(state.boards.map(board => board.id)).size === state.boards.length
    && state.boards.some(board => board.id === 'main') && state.boards.some(board => board.id === state.activeId);
}

export function cardsOnBoard(cards: UserCard[], boardId: string) {
  return cards.filter(card => (card.boardId ?? 'main') === boardId);
}

export interface BoardColumnView { title: string; description: string; stage: string; stages: string[]; custom: boolean }

export function columnsFor(board: Board | undefined): BoardColumnView[] {
  const all: BoardColumnView[] = [
    ...BOARD_GROUPS.map(group => ({ ...group, custom: false })),
    ...(board?.columns ?? []).map(column => ({ title: column.title, description: 'Kolom buatanmu', stage: column.id, stages: [column.id], custom: true })),
  ];
  const order = board?.columnOrder ?? [];
  const sorted = order.map(stage => all.find(column => column.stage === stage)).filter((column): column is BoardColumnView => !!column);
  return [...sorted, ...all.filter(column => !order.includes(column.stage))];
}

export function stageOptions(board: Board | undefined): { id: string; label: string }[] {
  return [...STAGES, ...(board?.columns ?? []).map(column => ({ id: column.id, label: column.title }))];
}

export function setColumns(boards: BoardState, boardId: string, columns: BoardColumn[]): BoardState {
  return { ...boards, boards: boards.boards.map(board => board.id === boardId ? { ...board, columns } : board) };
}

// Kolom yang diseret menempati posisi kolom tujuan; sisanya bergeser, bukan ditukar.
export function reorderColumns(order: string[], fromStage: string, toStage: string): string[] {
  const from = order.indexOf(fromStage);
  const to = order.indexOf(toStage);
  if (from < 0 || to < 0 || from === to) return order;
  const next = [...order];
  next.splice(to, 0, ...next.splice(from, 1));
  return next;
}

export function setColumnOrder(boards: BoardState, boardId: string, columnOrder: string[]): BoardState {
  return { ...boards, boards: boards.boards.map(board => board.id === boardId ? { ...board, columnOrder } : board) };
}

// Kolom yang dihapus mengembalikan kartunya ke antrean, supaya tidak ada kartu yang hilang dari papan.
export function removeColumn(boards: BoardState, cards: UserCard[], boardId: string, columnId: string): { boards: BoardState; cards: UserCard[] } {
  const board = boards.boards.find(item => item.id === boardId);
  const kept = (board?.columns ?? []).filter(column => column.id !== columnId);
  const pruned = setColumns(boards, boardId, kept);
  return {
    boards: board?.columnOrder ? setColumnOrder(pruned, boardId, board.columnOrder.filter(stage => stage !== columnId)) : pruned,
    cards: cards.map(card => card.stage === columnId ? { ...card, stage: 'BACKLOG', updatedAt: Date.now() } : card),
  };
}

export function moveCard(cards: UserCard[], id: string, stage: string): UserCard[] {
  return cards.map(card => card.id === id ? { ...card, stage, updatedAt: Date.now() } : card);
}
