import catalog from '../data/catalog.json';
import { CHARACTERS_DATABASE } from '../data/characters';
import type { GameType, UserCard } from '../types/kanban';

export interface FarmingTarget {
  id: string; name: string; game: GameType; category: string; iconUrl: string;
  days: number[]; location: string; characterIds: string[];
  weaponNames?: string[];
}
export const FARMING_TARGETS = catalog.farming as FarmingTarget[];
export const CATALOG_META = { fetchedAt: catalog.fetchedAt, sources: catalog.sources };
export const DAY_NAMES = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];

/** Genshin/ZZZ reset at 04:00 in their fixed server timezone. */
export function serverDay(now: number, utcOffset: number) {
  return new Date(now + (utcOffset - 4) * 3600000).getUTCDay();
}

export function farmingForDay(day: number, game: string, category: string, search: string, cards?: UserCard[]) {
  const query = search.trim().toLowerCase();
  const characterIds = cards?.map(card => card.characterId);
  return FARMING_TARGETS.filter(target => target.days.includes(day)
    && (game === 'ALL' || target.game === game) && (category === 'all' || target.category === category))
    .map(target => ({ ...target, weapons: (target.weaponNames ?? []).filter(name => !cards || cards.some(card => card.equipment.name.trim().toLowerCase() === name.toLowerCase())),
      characters: CHARACTERS_DATABASE.filter(character => (target.characterIds.includes(character.id)
        || cards?.some(card => card.characterId === character.id && target.weaponNames?.some(name => name.toLowerCase() === card.equipment.name.trim().toLowerCase())))
      && (!characterIds || characterIds.includes(character.id))) }))
    .filter(target => (target.characters.length > 0 || target.weapons.length > 0) && (!query || [target.name, target.location, ...target.weapons, ...target.characters.map(c => c.name)].some(text => text.toLowerCase().includes(query))))
    .sort((a, b) => a.game.localeCompare(b.game) || a.name.localeCompare(b.name));
}
