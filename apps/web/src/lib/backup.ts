import type { DailyRoutine, StaminaState, UserCard } from '../types/kanban';
import { STAGES, DEFAULT_BOARDS, isBoardState, type BoardState } from './board';

const object = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const integer = (value: unknown, min: number, max: number) => typeof value === 'number' && Number.isSafeInteger(value) && value >= min && value <= max;
const string = (value: unknown, max = 10000) => typeof value === 'string' && value.length <= max;

export function isCard(value: unknown): value is UserCard {
  if (!object(value)) return false;
  const { talents, equipment, gearTarget } = value;
  const genshin = value.game === 'GENSHIN_IMPACT';
  const level = genshin ? 90 : 60;
  if (!genshin && value.game !== 'ZENLESS_ZONE_ZERO') return false;
  return string(value.id, 200) && !!value.id && string(value.characterId, 200) && !!value.characterId
    && (value.boardId === undefined || (string(value.boardId, 200) && !!value.boardId))
    && STAGES.some(stage => stage.id === value.stage) && ['HIGH', 'MEDIUM', 'LOW'].includes(String(value.priority))
    && Array.isArray(value.tags) && value.tags.length <= 100 && value.tags.every(tag => string(tag, 200))
    && ['currentLevel', 'targetLevel'].every(key => integer(value[key], 1, level))
    && ['currentAscension', 'targetAscension'].every(key => integer(value[key], 0, genshin ? 6 : 5))
    && object(talents) && ['skill1Current', 'skill1Target', 'skill2Current', 'skill2Target', 'skill3Current', 'skill3Target'].every(key => integer(talents[key], 1, genshin ? 10 : 12))
    && ['coreSkillCurrent', 'coreSkillTarget'].every(key => talents[key] === undefined || ['A', 'B', 'C', 'D', 'E', 'F'].includes(String(talents[key])))
    && object(equipment) && string(equipment.name, 200) && integer(equipment.currentLevel, 1, level) && integer(equipment.targetLevel, 1, level) && integer(equipment.refinement, 1, 5)
    && object(gearTarget) && string(gearTarget.setName, 200) && string(gearTarget.subStatsGoal, 500) && typeof gearTarget.completed === 'boolean'
    && string(value.notes) && integer(value.updatedAt, 0, Number.MAX_SAFE_INTEGER);
}

export function isStamina(value: unknown): value is StaminaState {
  return object(value) && integer(value.genshinResin, 0, 200) && integer(value.zzzBattery, 0, 240)
    && integer(value.genshinCondensed, 0, 5) && typeof value.zzzCoffeeUsed === 'boolean'
    && integer(value.genshinLastUpdated, 0, Number.MAX_SAFE_INTEGER) && integer(value.zzzLastUpdated, 0, Number.MAX_SAFE_INTEGER);
}

export function isRoutine(value: unknown): value is DailyRoutine {
  return object(value) && typeof value.lastResetDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value.lastResetDate)
    && ['genshinCommissions', 'genshinResinSpent', 'zzzErrands', 'zzzCoffee', 'zzzScratchCard'].every(key => typeof value[key] === 'boolean')
    && integer(value.genshinWeeklyBosses, 0, 3) && integer(value.zzzNotoriousHunts, 0, 3);
}

export interface Backup { version: '1.0'; cards: UserCard[]; stamina: StaminaState; routine: DailyRoutine; boards?: BoardState }

export function parseBackup(text: string): Backup {
  const value: unknown = JSON.parse(text);
  if (!object(value) || value.version !== '1.0' || !Array.isArray(value.cards) || value.cards.length > 1000
    || !value.cards.every(isCard) || new Set(value.cards.map(card => card.id)).size !== value.cards.length
    || !isStamina(value.stamina) || !isRoutine(value.routine)
    || (value.boards !== undefined && !isBoardState(value.boards))) {
    throw new Error('Backup tidak valid. Gunakan file JSON hasil ekspor HoyoKanban.');
  }
  const boards = (value.boards as BoardState | undefined) ?? DEFAULT_BOARDS;
  if (!(value.cards as UserCard[]).every(card => boards.boards.some(board => board.id === (card.boardId ?? 'main')))) {
    throw new Error('Backup memiliki kartu tanpa papan yang valid.');
  }
  return value as unknown as Backup;
}
