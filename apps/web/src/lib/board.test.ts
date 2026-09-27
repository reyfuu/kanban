import { afterEach, describe, expect, it, vi } from 'vitest';
import { BOARD_GROUPS, STAGES, moveCard } from './board';
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
