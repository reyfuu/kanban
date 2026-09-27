export type GameType = 'GENSHIN_IMPACT' | 'ZENLESS_ZONE_ZERO';

export type KanbanStage =
  | 'WISHLIST'     // Target pull / pre-farm
  | 'BACKLOG'      // Dimiliki tapi belum disentuh
  | 'LEVELING'     // Sedang leveling & ascension
  | 'TALENTS'      // Sedang upgrade skill / talenta
  | 'GEAR'         // Sedang farming artifact / drive disc
  | 'TUNING'       // Min-maxing substat
  | 'READY';       // Selesai & siap tempur

export type PriorityLevel = 'HIGH' | 'MEDIUM' | 'LOW';

export interface Character {
  id: string;
  name: string;
  game: GameType;
  rarity: 4 | 5 | 'A' | 'S';
  element: string; // 'Pyro', 'Hydro', 'Electro', 'Ice', 'Ether', dll
  weaponOrSpecialty: string; // 'Sword', 'Claymore', 'Attack', 'Stun', dll
  avatarUrl: string;
  bossMaterial: string;
  talentBookOrChip: string;
  weeklyBossDrop: string;
  specialtyOrFaction: string;
}

export interface UserCard {
  id: string; // unique card instance ID
  characterId: string;
  game: GameType;
  stage: KanbanStage;
  priority: PriorityLevel;
  tags: string[];

  // Progression: Level & Ascension
  currentLevel: number;
  targetLevel: number;
  currentAscension: number;
  targetAscension: number;

  // Progression: Talents (GI: 3 skills, ZZZ: 6 skills)
  talents: {
    skill1Current: number;
    skill1Target: number;
    skill2Current: number;
    skill2Target: number;
    skill3Current: number;
    skill3Target: number;
    coreSkillCurrent?: string; // A - F (ZZZ)
    coreSkillTarget?: string;
  };

  // Progression: Weapon / W-Engine
  equipment: {
    name: string;
    currentLevel: number;
    targetLevel: number;
    refinement: number; // 1 - 5
  };

  // Target Gear (Artifact / Drive Disc)
  gearTarget: {
    setName: string;
    subStatsGoal: string;
    completed: boolean;
  };

  notes: string;
  updatedAt: number;
}

export interface StaminaState {
  genshinResin: number; // 0 - 200
  genshinCondensed: number; // 0 - 5
  genshinLastUpdated: number; // ms timestamp
  zzzBattery: number; // 0 - 240
  zzzCoffeeUsed: boolean;
  zzzLastUpdated: number; // ms timestamp
}

export interface DailyRoutine {
  lastResetDate: string; // YYYY-MM-DD
  genshinCommissions: boolean;
  genshinResinSpent: boolean;
  zzzErrands: boolean;
  zzzCoffee: boolean;
  zzzScratchCard: boolean;
  genshinWeeklyBosses: number; // 0 - 3
  zzzNotoriousHunts: number; // 0 - 3
}

export interface MaterialDeficit {
  moraOrDenny: number;
  expBooksOrLogs: number;
  bossMaterials: number;
  talentBooksOrChips: number;
  weeklyBossMaterials: number;
  crownsOrHamsterPass: number;
  estimatedResinOrBattery: number;
  estimatedDays: number;
}
