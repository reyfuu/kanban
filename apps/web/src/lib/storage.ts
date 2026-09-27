import { DailyRoutine, StaminaState, UserCard } from '../types/kanban';

const CARDS_KEY = 'hoyokanban_cards_v1';
const STAMINA_KEY = 'hoyokanban_stamina_v1';
const ROUTINE_KEY = 'hoyokanban_routine_v1';

export const INITIAL_DEMO_CARDS: UserCard[] = [
  {
    id: 'demo-card-raiden',
    characterId: 'raiden-shogun',
    game: 'GENSHIN_IMPACT',
    stage: 'LEVELING',
    priority: 'HIGH',
    tags: ['Abyss Team 1', 'Sub-DPS/Battery'],
    currentLevel: 70,
    targetLevel: 90,
    currentAscension: 4,
    targetAscension: 6,
    talents: {
      skill1Current: 1,
      skill1Target: 6,
      skill2Current: 6,
      skill2Target: 9,
      skill3Current: 7,
      skill3Target: 10,
    },
    equipment: {
      name: 'The Catch',
      currentLevel: 80,
      targetLevel: 90,
      refinement: 5,
    },
    gearTarget: {
      setName: 'Emblem of Severed Fate (4pc)',
      subStatsGoal: 'ER > 230%, CR > 60%, CD > 130%',
      completed: false,
    },
    notes: 'Prioritaskan buku Light hari Rabu/Sabtu.',
    updatedAt: Date.now(),
  },
  {
    id: 'demo-card-furina',
    characterId: 'furina',
    game: 'GENSHIN_IMPACT',
    stage: 'TALENTS',
    priority: 'HIGH',
    tags: ['Hydro Buffer', 'Team Core'],
    currentLevel: 90,
    targetLevel: 90,
    currentAscension: 6,
    targetAscension: 6,
    talents: {
      skill1Current: 1,
      skill1Target: 1,
      skill2Current: 8,
      skill2Target: 10,
      skill3Current: 9,
      skill3Target: 10,
    },
    equipment: {
      name: 'Fleuve Cendre Ferryman',
      currentLevel: 90,
      targetLevel: 90,
      refinement: 5,
    },
    gearTarget: {
      setName: 'Golden Troupe (4pc)',
      subStatsGoal: 'HP > 38k, ER > 170%, CR > 70%',
      completed: true,
    },
    notes: 'Kurang 2 Crown of Insight untuk max Skill & Burst.',
    updatedAt: Date.now(),
  },
  {
    id: 'demo-card-mualani',
    characterId: 'mualani',
    game: 'GENSHIN_IMPACT',
    stage: 'WISHLIST',
    priority: 'MEDIUM',
    tags: ['Natlan DPS', 'Vaporize'],
    currentLevel: 1,
    targetLevel: 90,
    currentAscension: 0,
    targetAscension: 6,
    talents: {
      skill1Current: 1,
      skill1Target: 1,
      skill2Current: 1,
      skill2Target: 10,
      skill3Current: 1,
      skill3Target: 8,
    },
    equipment: {
      name: 'Ring of Yaxche',
      currentLevel: 1,
      targetLevel: 90,
      refinement: 5,
    },
    gearTarget: {
      setName: 'Obsidian Codex (4pc)',
      subStatsGoal: 'HP%, Hydro DMG, Crit DMG',
      completed: false,
    },
    notes: 'Pre-farming material Natlan.',
    updatedAt: Date.now(),
  },
  {
    id: 'demo-card-ellen',
    characterId: 'ellen-joe',
    game: 'ZENLESS_ZONE_ZERO',
    stage: 'GEAR',
    priority: 'HIGH',
    tags: ['Shiyu Defense Team 1', 'Ice Hypercarry'],
    currentLevel: 60,
    targetLevel: 60,
    currentAscension: 5,
    targetAscension: 5,
    talents: {
      skill1Current: 10,
      skill1Target: 12,
      skill2Current: 9,
      skill2Target: 11,
      skill3Current: 11,
      skill3Target: 12,
      coreSkillCurrent: 'D',
      coreSkillTarget: 'F',
    },
    equipment: {
      name: 'Deep Sea Visitor',
      currentLevel: 60,
      targetLevel: 60,
      refinement: 1,
    },
    gearTarget: {
      setName: 'Polar Metal (4pc) + Woodpecker (2pc)',
      subStatsGoal: 'Crit Rate > 75%, Crit DMG > 140%',
      completed: false,
    },
    notes: 'Tuning Disc 4 di Bardic Needle (cari Crit DMG).',
    updatedAt: Date.now(),
  },
  {
    id: 'demo-card-zhu-yuan',
    characterId: 'zhu-yuan',
    game: 'ZENLESS_ZONE_ZERO',
    stage: 'READY',
    priority: 'HIGH',
    tags: ['Ether Burst DPS', 'Shiyu Cleared'],
    currentLevel: 60,
    targetLevel: 60,
    currentAscension: 5,
    targetAscension: 5,
    talents: {
      skill1Current: 12,
      skill1Target: 12,
      skill2Current: 11,
      skill2Target: 11,
      skill3Current: 12,
      skill3Target: 12,
      coreSkillCurrent: 'F',
      coreSkillTarget: 'F',
    },
    equipment: {
      name: 'Riot Suppressor Mark VI',
      currentLevel: 60,
      targetLevel: 60,
      refinement: 1,
    },
    gearTarget: {
      setName: 'Chaotic Metal (4pc) + Hormone Punk (2pc)',
      subStatsGoal: 'Ether DMG & Crit DMG ready',
      completed: true,
    },
    notes: 'Build tuntas! Performa S-Rank di Critical Node.',
    updatedAt: Date.now(),
  },
  {
    id: 'demo-card-jane',
    characterId: 'jane-doe',
    game: 'ZENLESS_ZONE_ZERO',
    stage: 'TUNING',
    priority: 'HIGH',
    tags: ['Physical Anomaly', 'Assault Pro'],
    currentLevel: 60,
    targetLevel: 60,
    currentAscension: 5,
    targetAscension: 5,
    talents: {
      skill1Current: 11,
      skill1Target: 12,
      skill2Current: 11,
      skill2Target: 12,
      skill3Current: 11,
      skill3Target: 12,
      coreSkillCurrent: 'E',
      coreSkillTarget: 'F',
    },
    equipment: {
      name: 'Sharpened Stinger',
      currentLevel: 60,
      targetLevel: 60,
      refinement: 1,
    },
    gearTarget: {
      setName: 'Fanged Metal (4pc) + Freedom Blues (2pc)',
      subStatsGoal: 'Anomaly Proficiency > 420',
      completed: false,
    },
    notes: 'Butuh 1 Hamster Cage Pass untuk Core Skill F.',
    updatedAt: Date.now(),
  },
];

export const INITIAL_STAMINA: StaminaState = {
  genshinResin: 156,
  genshinCondensed: 3,
  genshinLastUpdated: Date.now(),
  zzzBattery: 180,
  zzzCoffeeUsed: false,
  zzzLastUpdated: Date.now(),
};

export const INITIAL_ROUTINE: DailyRoutine = {
  lastResetDate: new Date().toISOString().slice(0, 10),
  genshinCommissions: true,
  genshinResinSpent: false,
  zzzErrands: true,
  zzzCoffee: false,
  zzzScratchCard: true,
  genshinWeeklyBosses: 2,
  zzzNotoriousHunts: 1,
};

export function loadCards(): UserCard[] {
  if (typeof window === 'undefined') return INITIAL_DEMO_CARDS;
  try {
    const raw = localStorage.getItem(CARDS_KEY);
    if (!raw) {
      saveCards(INITIAL_DEMO_CARDS);
      return INITIAL_DEMO_CARDS;
    }
    return JSON.parse(raw);
  } catch {
    return INITIAL_DEMO_CARDS;
  }
}

export function saveCards(cards: UserCard[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(CARDS_KEY, JSON.stringify(cards));
  } catch (err) {
    console.error('Failed to save cards to localStorage', err);
  }
}

export function loadStamina(): StaminaState {
  if (typeof window === 'undefined') return INITIAL_STAMINA;
  try {
    const raw = localStorage.getItem(STAMINA_KEY);
    if (!raw) {
      saveStamina(INITIAL_STAMINA);
      return INITIAL_STAMINA;
    }
    return JSON.parse(raw);
  } catch {
    return INITIAL_STAMINA;
  }
}

export function saveStamina(stamina: StaminaState): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STAMINA_KEY, JSON.stringify(stamina));
  } catch (err) {
    console.error('Failed to save stamina', err);
  }
}

export function loadRoutine(): DailyRoutine {
  if (typeof window === 'undefined') return INITIAL_ROUTINE;
  try {
    const raw = localStorage.getItem(ROUTINE_KEY);
    if (!raw) {
      saveRoutine(INITIAL_ROUTINE);
      return INITIAL_ROUTINE;
    }
    const routine: DailyRoutine = JSON.parse(raw);
    const today = new Date().toISOString().slice(0, 10);
    // Reset daily checkboxes if new day
    if (routine.lastResetDate !== today) {
      routine.lastResetDate = today;
      routine.genshinCommissions = false;
      routine.genshinResinSpent = false;
      routine.zzzErrands = false;
      routine.zzzCoffee = false;
      routine.zzzScratchCard = false;
      saveRoutine(routine);
    }
    return routine;
  } catch {
    return INITIAL_ROUTINE;
  }
}

export function saveRoutine(routine: DailyRoutine): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(ROUTINE_KEY, JSON.stringify(routine));
  } catch (err) {
    console.error('Failed to save routine', err);
  }
}
