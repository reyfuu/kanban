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
export interface Board { id: string; name: string; columns?: BoardColumn[]; columnOrder?: string[]; columnTitles?: Record<string, string>; hiddenColumns?: string[] }
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
// Dipakai juga untuk daftar kolom bawaan yang disembunyikan pemain.
function validStageList(value: unknown, max: number) {
  if (value === undefined) return true;
  if (!Array.isArray(value) || value.length > max) return false;
  return value.every(stage => typeof stage === 'string' && !!stage && stage.length <= 200)
    && new Set(value).size === value.length;
}

// Nama kolom bawaan yang diganti pemain; kolom buatan menyimpan namanya sendiri di columns.
function validColumnTitles(value: unknown) {
  if (value === undefined) return true;
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const titles = Object.entries(value as Record<string, unknown>);
  return titles.length <= BOARD_GROUPS.length
    && titles.every(([stage, title]) => !!stage && stage.length <= 200
      && typeof title === 'string' && !!title.trim() && title.length <= 40);
}

export function isBoardState(value: unknown): value is BoardState {
  if (!value || typeof value !== 'object') return false;
  const state = value as BoardState;
  return Array.isArray(state.boards) && state.boards.length > 0 && state.boards.length <= 50
    && state.boards.every(board => board && typeof board.id === 'string' && !!board.id && board.id.length <= 200
      && typeof board.name === 'string' && !!board.name.trim() && board.name.length <= 60
      && validColumns(board.columns) && validColumnTitles(board.columnTitles)
      && validStageList(board.columnOrder, BOARD_GROUPS.length + MAX_COLUMNS)
      && validStageList(board.hiddenColumns, BOARD_GROUPS.length))
    && new Set(state.boards.map(board => board.id)).size === state.boards.length
    && state.boards.some(board => board.id === 'main') && state.boards.some(board => board.id === state.activeId);
}

export function cardsOnBoard(cards: UserCard[], boardId: string) {
  return cards.filter(card => (card.boardId ?? 'main') === boardId);
}

export interface BoardColumnView { title: string; description: string; stage: string; stages: string[]; custom: boolean }

export function columnsFor(board: Board | undefined): BoardColumnView[] {
  const hidden = board?.hiddenColumns ?? [];
  const all: BoardColumnView[] = [
    ...BOARD_GROUPS.filter(group => !hidden.includes(group.stage))
      .map(group => ({ ...group, title: board?.columnTitles?.[group.stage] ?? group.title, custom: false })),
    ...(board?.columns ?? []).map(column => ({ title: column.title, description: 'Kolom buatanmu', stage: column.id, stages: [column.id], custom: true })),
  ];
  const order = board?.columnOrder ?? [];
  const sorted = order.map(stage => all.find(column => column.stage === stage)).filter((column): column is BoardColumnView => !!column);
  return [...sorted, ...all.filter(column => !order.includes(column.stage))];
}

export function stageOptions(board: Board | undefined): { id: string; label: string }[] {
  return [...STAGES, ...(board?.columns ?? []).map(column => ({ id: column.id, label: column.title }))];
}

export function patchBoard(boards: BoardState, boardId: string, patch: Partial<Board>): BoardState {
  return { ...boards, boards: boards.boards.map(board => board.id === boardId ? { ...board, ...patch } : board) };
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

// Kolom yang dihapus memindahkan kartunya ke kolom pertama yang tersisa, supaya tidak ada kartu yang hilang.
// Kolom buatan dibuang dari daftar; kolom bawaan hanya disembunyikan supaya masih bisa dipulihkan.
// Kolom terakhir tidak boleh dihapus: papan tanpa kolom tidak bisa menampung kartu.
export function removeColumn(boards: BoardState, cards: UserCard[], boardId: string, columnId: string): { boards: BoardState; cards: UserCard[] } {
  const board = boards.boards.find(item => item.id === boardId);
  const columns = columnsFor(board);
  const gone = columns.find(column => column.stage === columnId);
  const target = columns.find(column => column.stage !== columnId);
  if (!gone || !target) return { boards, cards };
  return {
    boards: patchBoard(boards, boardId, {
      ...(gone.custom
        ? { columns: (board?.columns ?? []).filter(column => column.id !== columnId) }
        : { hiddenColumns: [...(board?.hiddenColumns ?? []), columnId] }),
      ...(board?.columnOrder ? { columnOrder: board.columnOrder.filter(stage => stage !== columnId) } : {}),
    }),
    cards: cards.map(card => gone.stages.includes(card.stage) ? { ...card, stage: target.stage, updatedAt: Date.now() } : card),
  };
}

export function moveCard(cards: UserCard[], id: string, stage: string): UserCard[] {
  return cards.map(card => card.id === id ? { ...card, stage, updatedAt: Date.now() } : card);
}
