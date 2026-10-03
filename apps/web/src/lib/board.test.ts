import { afterEach, describe, expect, it, vi } from 'vitest';
import { BOARD_GROUPS, MAX_COLUMNS, STAGES, columnsFor, isBoardState, moveCard, patchBoard, removeColumn, reorderColumns, stageOptions } from './board';
import { parseBackup } from './backup';
import { INITIAL_DEMO_CARDS, INITIAL_ROUTINE, INITIAL_STAMINA, loadCards, restoreBackup } from './storage';

const backup = { version: '1.0', cards: INITIAL_DEMO_CARDS, stamina: INITIAL_STAMINA, routine: INITIAL_ROUTINE };
afterEach(() => vi.unstubAllGlobals());

describe('Papan sederhana dan kompatibilitas data', () => {
  it('memetakan setiap tahap lama tepat ke satu kelompok', () => {
    const stages = BOARD_GROUPS.flatMap(group => group.stages);
    expect(stages.sort()).toEqual(STAGES.map(stage => stage.id).sort());
    expect(new Set(stages).size).toBe(7);
  });

  it('pindah tahap tidak mengubah target atau catatan', () => {
    const first = INITIAL_DEMO_CARDS[0]!;
    const moved = moveCard(INITIAL_DEMO_CARDS, first.id, 'READY');
    expect(moved[0]).toEqual({ ...first, stage: 'READY', updatedAt: expect.any(Number) });
    expect(INITIAL_DEMO_CARDS[0]?.stage).toBe('LEVELING');
    expect(moved[1]).toBe(INITIAL_DEMO_CARDS[1]);
  });

  it('menerima backup lama, menolak data rusak dan ID ganda', () => {
    expect(parseBackup(JSON.stringify(backup)).cards).toEqual(INITIAL_DEMO_CARDS);
    expect(() => parseBackup(JSON.stringify({ ...backup, cards: [{ id: 'bad' }] }))).toThrow();
    expect(() => parseBackup(JSON.stringify({ ...backup, cards: [INITIAL_DEMO_CARDS[0], INITIAL_DEMO_CARDS[0]] }))).toThrow();
    expect(() => parseBackup(JSON.stringify({ ...backup, stamina: { ...INITIAL_STAMINA, genshinResin: -1 } }))).toThrow();
    expect(() => parseBackup(JSON.stringify({ ...backup, version: '2.0' }))).toThrow();
  });

  it('papan baru kosong; kartu tersimpan tetap dibaca', () => {
    vi.stubGlobal('window', {});
    vi.stubGlobal('localStorage', { getItem: () => null });
    expect(loadCards()).toEqual([]);
    vi.stubGlobal('localStorage', { getItem: () => JSON.stringify(INITIAL_DEMO_CARDS) });
    expect(loadCards()).toEqual(INITIAL_DEMO_CARDS);
  });

  it('mengembalikan data lama jika penulisan impor gagal di tengah', () => {
    const stored = new Map([['hoyokanban_cards_v1', 'old-cards'], ['hoyokanban_stamina_v1', 'old-stamina']]);
    let calls = 0;
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => stored.get(key) ?? null,
      setItem: (key: string, value: string) => { if (++calls === 2) throw new Error('QuotaExceeded'); stored.set(key, value); },
      removeItem: (key: string) => stored.delete(key),
    });
    expect(() => restoreBackup(parseBackup(JSON.stringify(backup)))).toThrow('QuotaExceeded');
    expect([...stored]).toEqual([['hoyokanban_cards_v1', 'old-cards'], ['hoyokanban_stamina_v1', 'old-stamina']]);
  });
});

describe('Kolom buatan pemain', () => {
  const column = { id: 'col-abyss', title: 'Abyss' };
  const withColumn = { boards: [{ id: 'main', name: 'Papan utama', columns: [column] }], activeId: 'main' };

  it('menempatkan kolom buatan di belakang tiga kolom bawaan', () => {
    expect(columnsFor(undefined).map(item => item.title)).toEqual(['Rencana', 'Dalam proses', 'Selesai']);
    const columns = columnsFor(withColumn.boards[0]);
    expect(columns).toHaveLength(4);
    expect(columns[3]).toMatchObject({ title: 'Abyss', stage: 'col-abyss', stages: ['col-abyss'], custom: true });
    expect(columns.slice(0, 3).some(item => item.custom)).toBe(false);
  });

  it('menawarkan kolom buatan di pilihan tahap kartu', () => {
    expect(stageOptions(undefined)).toEqual(STAGES);
    expect(stageOptions(withColumn.boards[0]).at(-1)).toEqual({ id: 'col-abyss', label: 'Abyss' });
  });

  it('menerima papan lama tanpa kolom dan menolak kolom yang tidak masuk akal', () => {
    expect(isBoardState(withColumn)).toBe(true);
    expect(isBoardState({ boards: [{ id: 'main', name: 'Papan utama' }], activeId: 'main' })).toBe(true);
    const reject = (columns: unknown) => isBoardState({ boards: [{ id: 'main', name: 'Papan utama', columns }], activeId: 'main' });
    expect(reject([{ id: 'col-1', title: '  ' }])).toBe(false);
    expect(reject([{ id: 'READY', title: 'Selesai lagi' }])).toBe(false);
    expect(reject([column, { id: column.id, title: 'Kembar' }])).toBe(false);
    expect(reject([{ id: 'col-1', title: 'x'.repeat(41) }])).toBe(false);
    expect(reject(Array.from({ length: MAX_COLUMNS + 1 }, (_, index) => ({ id: `col-${index}`, title: `Kolom ${index}` })))).toBe(false);
  });

  it('kolom yang dihapus mengembalikan kartunya ke antrean', () => {
    const cards = [{ ...INITIAL_DEMO_CARDS[0]!, stage: 'col-abyss' }, INITIAL_DEMO_CARDS[1]!];
    const next = removeColumn(withColumn, cards, 'main', 'col-abyss');
    expect(next.boards.boards[0]?.columns).toEqual([]);
    expect(next.cards[0]).toEqual({ ...cards[0], stage: 'BACKLOG', updatedAt: expect.any(Number) });
    expect(next.cards[1]).toBe(cards[1]);
    expect(cards[0]?.stage).toBe('col-abyss');
    expect(withColumn.boards[0]?.columns).toEqual([column]);
  });

  it('backup menerima tahap kolom buatan, tetap menolak tahap kosong', () => {
    const cards = [{ ...INITIAL_DEMO_CARDS[0]!, stage: 'col-abyss' }];
    expect(parseBackup(JSON.stringify({ ...backup, cards, boards: withColumn })).cards[0]?.stage).toBe('col-abyss');
    expect(() => parseBackup(JSON.stringify({ ...backup, cards: [{ ...INITIAL_DEMO_CARDS[0]!, stage: '' }] }))).toThrow();
  });
});

describe('Urutan kolom', () => {
  const column = { id: 'col-abyss', title: 'Abyss' };
  const board = { id: 'main', name: 'Papan utama', columns: [column] };

  it('mengikuti urutan pilihan pemain, termasuk kolom bawaan', () => {
    const ordered = { ...board, columnOrder: ['col-abyss', 'READY', 'BACKLOG', 'LEVELING'] };
    expect(columnsFor(ordered).map(item => item.title)).toEqual(['Abyss', 'Selesai', 'Rencana', 'Dalam proses']);
  });

  it('mengabaikan id asing dan menaruh kolom yang belum diurutkan di belakang', () => {
    const ordered = { ...board, columnOrder: ['col-abyss', 'kolom-hilang'] };
    expect(columnsFor(ordered).map(item => item.title)).toEqual(['Abyss', 'Rencana', 'Dalam proses', 'Selesai']);
  });

  it('menyimpan urutan tanpa mengubah papan lama', () => {
    const boards = { boards: [board], activeId: 'main' };
    const next = patchBoard(boards, 'main', { columnOrder: ['READY', 'BACKLOG'] });
    expect(next.boards[0]?.columnOrder).toEqual(['READY', 'BACKLOG']);
    expect(boards.boards[0]).not.toHaveProperty('columnOrder');
  });

  it('menolak urutan yang ganda atau terlalu panjang', () => {
    const reject = (columnOrder: unknown) => isBoardState({ boards: [{ ...board, columnOrder }], activeId: 'main' });
    expect(reject(['READY', 'BACKLOG'])).toBe(true);
    expect(reject(undefined)).toBe(true);
    expect(reject(['READY', 'READY'])).toBe(false);
    expect(reject([''])).toBe(false);
    expect(reject(Array.from({ length: BOARD_GROUPS.length + MAX_COLUMNS + 1 }, (_, index) => `stage-${index}`))).toBe(false);
  });

  it('kolom yang dihapus juga lepas dari urutan', () => {
    const boards = { boards: [{ ...board, columnOrder: ['col-abyss', 'READY'] }], activeId: 'main' };
    expect(removeColumn(boards, [], 'main', 'col-abyss').boards.boards[0]?.columnOrder).toEqual(['READY']);
  });

  it('kolom yang diseret menempati posisi kolom tujuan', () => {
    const order = ['BACKLOG', 'LEVELING', 'READY', 'col-abyss'];
    expect(reorderColumns(order, 'col-abyss', 'BACKLOG')).toEqual(['col-abyss', 'BACKLOG', 'LEVELING', 'READY']);
    expect(reorderColumns(order, 'BACKLOG', 'READY')).toEqual(['LEVELING', 'READY', 'BACKLOG', 'col-abyss']);
    expect(order).toEqual(['BACKLOG', 'LEVELING', 'READY', 'col-abyss']);
  });

  it('mengabaikan seretan ke dirinya sendiri atau ke kolom asing', () => {
    const order = ['BACKLOG', 'LEVELING', 'READY'];
    expect(reorderColumns(order, 'READY', 'READY')).toBe(order);
    expect(reorderColumns(order, 'kolom-hilang', 'READY')).toBe(order);
    expect(reorderColumns(order, 'READY', 'kolom-hilang')).toBe(order);
  });
});

describe('Nama kolom bawaan', () => {
  const board = { id: 'main', name: 'Papan utama', columnTitles: { BACKLOG: 'Antre dulu' } };

  it('memakai nama pengganti pemain untuk kolom bawaan', () => {
    expect(columnsFor(board).map(item => item.title)).toEqual(['Antre dulu', 'Dalam proses', 'Selesai']);
    expect(columnsFor(board)[0]).toMatchObject({ stage: 'BACKLOG', stages: ['WISHLIST', 'BACKLOG'], custom: false });
  });

  it('tidak mengubah label tahap di pilihan kartu', () => {
    expect(stageOptions(board)).toEqual(STAGES);
  });

  it('menolak nama kosong, terlalu panjang, atau bukan objek', () => {
    const reject = (columnTitles: unknown) => isBoardState({ boards: [{ ...board, columnTitles }], activeId: 'main' });
    expect(reject({ BACKLOG: 'Antre dulu' })).toBe(true);
    expect(reject(undefined)).toBe(true);
    expect(reject({ BACKLOG: '  ' })).toBe(false);
    expect(reject({ BACKLOG: 'x'.repeat(41) })).toBe(false);
    expect(reject({ BACKLOG: 5 })).toBe(false);
    expect(reject(['BACKLOG'])).toBe(false);
    expect(reject(Object.fromEntries(Array.from({ length: BOARD_GROUPS.length + 1 }, (_, index) => [`stage-${index}`, 'Nama'])))).toBe(false);
  });

  it('nama pengganti ikut tersimpan dan terbaca ulang dari backup', () => {
    const boards = { boards: [board], activeId: 'main' };
    expect(parseBackup(JSON.stringify({ ...backup, cards: [], boards })).boards?.boards[0]?.columnTitles).toEqual({ BACKLOG: 'Antre dulu' });
  });
});

describe('Menghapus kolom bawaan', () => {
  const boards = { boards: [{ id: 'main', name: 'Papan utama' }], activeId: 'main' };
  const card = (stage: string) => ({ ...INITIAL_DEMO_CARDS[0]!, id: `kartu-${stage}`, stage });

  it('menyembunyikan kolom bawaan dan memindahkan semua tahapnya ke kolom pertama yang tersisa', () => {
    const cards = [card('WISHLIST'), card('BACKLOG'), card('READY')];
    const next = removeColumn(boards, cards, 'main', 'BACKLOG');
    expect(next.boards.boards[0]?.hiddenColumns).toEqual(['BACKLOG']);
    expect(columnsFor(next.boards.boards[0]).map(item => item.title)).toEqual(['Dalam proses', 'Selesai']);
    expect(next.cards.map(item => item.stage)).toEqual(['LEVELING', 'LEVELING', 'READY']);
    expect(cards.map(item => item.stage)).toEqual(['WISHLIST', 'BACKLOG', 'READY']);
  });

  it('menolak menghapus kolom terakhir', () => {
    const only = { boards: [{ id: 'main', name: 'Papan utama', hiddenColumns: ['BACKLOG', 'LEVELING'] }], activeId: 'main' };
    expect(removeColumn(only, [], 'main', 'READY')).toEqual({ boards: only, cards: [] });
  });

  it('memulihkan kolom bawaan saat daftar sembunyi dikosongkan', () => {
    const hidden = { id: 'main', name: 'Papan utama', hiddenColumns: ['READY'] };
    expect(columnsFor(hidden)).toHaveLength(2);
    expect(columnsFor(patchBoard({ boards: [hidden], activeId: 'main' }, 'main', { hiddenColumns: [] }).boards[0])).toHaveLength(3);
  });

  it('menolak daftar sembunyi yang ganda atau terlalu panjang', () => {
    const reject = (hiddenColumns: unknown) => isBoardState({ boards: [{ id: 'main', name: 'Papan utama', hiddenColumns }], activeId: 'main' });
    expect(reject(['READY'])).toBe(true);
    expect(reject(undefined)).toBe(true);
    expect(reject(['READY', 'READY'])).toBe(false);
    expect(reject(Array.from({ length: BOARD_GROUPS.length + 1 }, (_, index) => `stage-${index}`))).toBe(false);
  });
});
