import { describe, expect, it } from 'vitest';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { CHARACTERS_DATABASE } from '../data/characters';
import { FARMING_TARGETS, farmingForDay, openToday, serverDay } from './farming';
import { cardsOnBoard, DEFAULT_BOARDS, isBoardState } from './board';
import { parseBackup } from './backup';
import { INITIAL_DEMO_CARDS, INITIAL_ROUTINE, INITIAL_STAMINA } from './storage';

describe('Katalog sumber dan farming', () => {
  it('memiliki roster lengkap sumber, relasi valid, dan setiap ikon lokal tersedia', () => {
    expect(CHARACTERS_DATABASE.length).toBeGreaterThan(150);
    const ids = new Set(CHARACTERS_DATABASE.map(character => character.id));
    expect(ids.size).toBe(CHARACTERS_DATABASE.length);
    expect(['raiden-shogun', 'furina', 'ellen-joe', 'burnice-white', 'anby-demara'].every(id => ids.has(id))).toBe(true);
    for (const target of FARMING_TARGETS) {
      expect(target.characterIds.every(id => ids.has(id))).toBe(true);
      expect(target.days.every(day => day >= 0 && day <= 6)).toBe(true);
      expect(existsSync(resolve('public', target.iconUrl.slice(1)))).toBe(true);
    }
    for (const character of CHARACTERS_DATABASE) expect(existsSync(resolve('public', character.avatarUrl.slice(1)))).toBe(true);
  });

  it('Raiden memakai Light pada Rabu/Sabtu/Minggu, bukan Senin', () => {
    expect(farmingForDay(3, 'GENSHIN_IMPACT', 'talent', 'Raiden').map(target => target.name)).toEqual(['Teachings of Light']);
    expect(farmingForDay(1, 'GENSHIN_IMPACT', 'talent', 'Raiden')).toEqual([]);
    expect(farmingForDay(0, 'GENSHIN_IMPACT', 'talent', 'Raiden')).toHaveLength(1);
  });

  it('ZZZ tersedia setiap hari; filter papan tidak memasukkan karakter lain', () => {
    expect(farmingForDay(1, 'ZENLESS_ZONE_ZERO', 'talent', 'Ellen').map(target => target.id))
      .toEqual(farmingForDay(5, 'ZENLESS_ZONE_ZERO', 'talent', 'Ellen').map(target => target.id));
    const rows = farmingForDay(0, 'ALL', 'all', '', [INITIAL_DEMO_CARDS[0]!]);
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.flatMap(row => row.characters).every(character => character.id === 'raiden-shogun')).toBe(true);
    expect(farmingForDay(0, 'ALL', 'all', '', [])).toEqual([]);
  });

  it('menandai domain yang buka hari ini hanya untuk kartu Genshin yang sedang di-build', () => {
    const raiden = { ...INITIAL_DEMO_CARDS[0]!, stage: 'TALENTS' as const };
    const names = (day: number, cards = [raiden]) => openToday(cards, day).map(target => target.name);
    expect(names(3)).toContain('Teachings of Light');
    expect(names(1)).not.toContain('Teachings of Light');
    expect(openToday([{ ...raiden, stage: 'BACKLOG' }], 3)).toEqual([]);
    expect(openToday([{ ...raiden, game: 'ZENLESS_ZONE_ZERO', characterId: 'ellen-joe' }], 3)).toEqual([]);
  });

  it('mengikuti batas reset server 04:00, bukan tengah malam perangkat', () => {
    expect(serverDay(Date.parse('2026-09-27T19:59:59Z'), 8)).toBe(0);
    expect(serverDay(Date.parse('2026-09-27T20:00:00Z'), 8)).toBe(1);
    expect(serverDay(Date.parse('2026-09-28T08:59:59Z'), -5)).toBe(0);
    expect(serverDay(Date.parse('2026-09-28T09:00:00Z'), -5)).toBe(1);
  });

  it('memisahkan kartu per papan, menjaga kartu lama, dan memvalidasi backup beberapa papan', () => {
    const old = INITIAL_DEMO_CARDS[0]!;
    const second = { ...old, id: 'second', boardId: 'abyss' };
    const boards = { boards: [...DEFAULT_BOARDS.boards, { id: 'abyss', name: 'Abyss' }], activeId: 'abyss' };
    expect(cardsOnBoard([old, second], 'main')).toEqual([old]);
    expect(cardsOnBoard([old, second], 'abyss')).toEqual([second]);
    expect(isBoardState(boards)).toBe(true);
    expect(isBoardState({ ...boards, activeId: 'missing' })).toBe(false);
    const backup = { version: '1.0', cards: [old, second], stamina: INITIAL_STAMINA, routine: INITIAL_ROUTINE, boards };
    expect(parseBackup(JSON.stringify(backup)).boards).toEqual(boards);
    expect(() => parseBackup(JSON.stringify({ ...backup, boards: DEFAULT_BOARDS }))).toThrow();
  });
});
