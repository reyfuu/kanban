import { describe, it, expect } from 'vitest';
import { calculateMaterialDeficit, computeLiveStamina } from './calculator';
import { UserCard } from '../types/kanban';

describe('HoyoKanban Calculation Engine (TDD)', () => {
  it('calculates Genshin Impact material deficit accurately', () => {
    const card: UserCard = {
      id: 'test-card-1',
      characterId: 'raiden-shogun',
      game: 'GENSHIN_IMPACT',
      stage: 'LEVELING',
      priority: 'HIGH',
      tags: ['Main DPS'],
      currentLevel: 1,
      targetLevel: 90,
      currentAscension: 0,
      targetAscension: 6,
      talents: {
        skill1Current: 1,
        skill1Target: 10,
        skill2Current: 1,
        skill2Target: 10,
        skill3Current: 1,
        skill3Target: 10,
      },
      equipment: {
        name: 'The Catch',
        currentLevel: 1,
        targetLevel: 90,
        refinement: 5,
      },
      gearTarget: {
        setName: 'Emblem of Severed Fate',
        subStatsGoal: 'ER > 220%, CR > 65%',
        completed: false,
      },
      notes: 'Focus on burst talent first',
      updatedAt: Date.now(),
    };

    const deficit = calculateMaterialDeficit(card);
    expect(deficit.moraOrDenny).toBeGreaterThan(6000000);
    expect(deficit.expBooksOrLogs).toBe(419);
    expect(deficit.bossMaterials).toBe(46);
    expect(deficit.crownsOrHamsterPass).toBe(3);
    expect(deficit.estimatedDays).toBeGreaterThan(10);
  });

  it('calculates ZZZ agent deficit accurately', () => {
    const card: UserCard = {
      id: 'test-card-2',
      characterId: 'ellen-joe',
      game: 'ZENLESS_ZONE_ZERO',
      stage: 'LEVELING',
      priority: 'HIGH',
      tags: ['Ice DPS'],
      currentLevel: 1,
      targetLevel: 60,
      currentAscension: 0,
      targetAscension: 5,
      talents: {
        skill1Current: 1,
        skill1Target: 12,
        skill2Current: 1,
        skill2Target: 12,
        skill3Current: 1,
        skill3Target: 12,
        coreSkillCurrent: 'A',
        coreSkillTarget: 'F',
      },
      equipment: {
        name: 'Deep Sea Visitor',
        currentLevel: 1,
        targetLevel: 60,
        refinement: 1,
      },
      gearTarget: {
        setName: 'Polar Metal 4pc',
        subStatsGoal: 'Crit Rate & Ice DMG',
        completed: false,
      },
      notes: 'Build for Shiyu Defense',
      updatedAt: Date.now(),
    };

    const deficit = calculateMaterialDeficit(card);
    expect(deficit.moraOrDenny).toBeGreaterThan(2000000);
    expect(deficit.expBooksOrLogs).toBe(300);
    expect(deficit.crownsOrHamsterPass).toBe(1); // Hamster Cage Pass
  });

  it('calculates live stamina recovery correctly', () => {
    const now = Date.now();
    // 4800 seconds ago (10 intervals of 480s = +10 resin)
    const tenIntervalsAgo = now - (4800 * 1000);
    const result = computeLiveStamina(100, 200, tenIntervalsAgo, 480);

    expect(result.current).toBe(110);
    expect(result.secondsUntilFull).toBe((200 - 110) * 480);
    expect(result.fullAtDate).not.toBeNull();
  });

  it('never exceeds max stamina cap', () => {
    const longAgo = Date.now() - (1000000 * 1000);
    const result = computeLiveStamina(150, 200, longAgo, 480);

    expect(result.current).toBe(200);
    expect(result.secondsUntilFull).toBe(0);
    expect(result.fullAtDate).toBeNull();
  });
});
