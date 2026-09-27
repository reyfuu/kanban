import { MaterialDeficit, UserCard } from '../types/kanban';

export function calculateMaterialDeficit(card: UserCard): MaterialDeficit {
  const isGenshin = card.game === 'GENSHIN_IMPACT';

  if (isGenshin) {
    // Level scaling: 1 to 90
    const lvlDiff = Math.max(0, card.targetLevel - card.currentLevel);
    const expBooks = Math.ceil((lvlDiff / 89) * 419);
    const moraLevel = Math.round((lvlDiff / 89) * 2092530);

    // Ascension boss materials: (Phase 1-6 requires 2, 4, 8, 12, 20 = 46 boss mats total)
    const ascDiff = Math.max(0, card.targetAscension - card.currentAscension);
    const bossMaterials = Math.round((ascDiff / 6) * 46);

    // Talents (3 skills: Skill 1, 2, 3)
    const talentDiff1 = Math.max(0, card.talents.skill1Target - card.talents.skill1Current);
    const talentDiff2 = Math.max(0, card.talents.skill2Target - card.talents.skill2Current);
    const talentDiff3 = Math.max(0, card.talents.skill3Target - card.talents.skill3Current);
    const totalTalentDiff = talentDiff1 + talentDiff2 + talentDiff3;

    // ~38 gold books + 21 silver per talent 1->10 (approx 60 total equivalent books per max talent)
    const talentBooks = Math.round((totalTalentDiff / 27) * 180);
    const moraTalents = Math.round((totalTalentDiff / 27) * 4950000);
    const weeklyBossMaterials = Math.round((totalTalentDiff / 27) * 18);

    // Crowns (Lv 10 talents)
    let crowns = 0;
    if (card.talents.skill1Target >= 10 && card.talents.skill1Current < 10) crowns++;
    if (card.talents.skill2Target >= 10 && card.talents.skill2Current < 10) crowns++;
    if (card.talents.skill3Target >= 10 && card.talents.skill3Current < 10) crowns++;

    const totalMora = moraLevel + moraTalents;
    // Estimate resin: ~20 resin per domain run (avg 2.5 talent books or 2-3 boss drops)
    const bossRuns = Math.ceil(bossMaterials / 2.5);
    const talentRuns = Math.ceil(talentBooks / 2.5);
    const totalResin = (bossRuns * 40) + (talentRuns * 20);
    const estimatedDays = Math.ceil(totalResin / 180); // 180 resin daily average

    return {
      moraOrDenny: totalMora,
      expBooksOrLogs: expBooks,
      bossMaterials,
      talentBooksOrChips: talentBooks,
      weeklyBossMaterials,
      crownsOrHamsterPass: crowns,
      estimatedResinOrBattery: totalResin,
      estimatedDays: Math.max(1, estimatedDays),
    };
  } else {
    // ZENLESS ZONE ZERO (ZZZ)
    // Level scaling: 1 to 60
    const lvlDiff = Math.max(0, card.targetLevel - card.currentLevel);
    const logs = Math.ceil((lvlDiff / 59) * 300); // 300 Investigator logs
    const dennyLevel = Math.round((lvlDiff / 59) * 800000);

    const ascDiff = Math.max(0, card.targetAscension - card.currentAscension);
    const bossMaterials = Math.round((ascDiff / 5) * 30); // Higher-Dimensional Data

    // Skills
    const skillDiff =
      Math.max(0, card.talents.skill1Target - card.talents.skill1Current) +
      Math.max(0, card.talents.skill2Target - card.talents.skill2Current) +
      Math.max(0, card.talents.skill3Target - card.talents.skill3Current);

    const tacticalChips = Math.round((skillDiff / 33) * 150);
    const dennySkills = Math.round((skillDiff / 33) * 1500000);
    const weeklyBossMaterials = Math.round((skillDiff / 33) * 15);

    let hamsterPass = 0;
    if (card.talents.coreSkillTarget === 'F' && card.talents.coreSkillCurrent !== 'F') {
      hamsterPass = 1;
    }

    const totalDenny = dennyLevel + dennySkills;
    const totalBattery = (Math.ceil(bossMaterials / 2) * 40) + (Math.ceil(tacticalChips / 3) * 40);
    const estimatedDays = Math.ceil(totalBattery / 240);

    return {
      moraOrDenny: totalDenny,
      expBooksOrLogs: logs,
      bossMaterials,
      talentBooksOrChips: tacticalChips,
      weeklyBossMaterials,
      crownsOrHamsterPass: hamsterPass,
      estimatedResinOrBattery: totalBattery,
      estimatedDays: Math.max(1, estimatedDays),
    };
  }
}

export function computeLiveStamina(
  recordedAmount: number,
  maxCap: number,
  lastRecordedTimestamp: number,
  rateInSeconds: number
): { current: number; secondsUntilFull: number; fullAtDate: Date | null } {
  const now = Date.now();
  const elapsedSeconds = Math.max(0, Math.floor((now - lastRecordedTimestamp) / 1000));
  const recovered = Math.floor(elapsedSeconds / rateInSeconds);
  const current = Math.min(maxCap, recordedAmount + recovered);

  if (current >= maxCap) {
    return { current: maxCap, secondsUntilFull: 0, fullAtDate: null };
  }

  const remainderSeconds = elapsedSeconds % rateInSeconds;
  const neededUnits = maxCap - current;
  const secondsUntilFull = (neededUnits * rateInSeconds) - remainderSeconds;
  const fullAtDate = new Date(now + (secondsUntilFull * 1000));

  return { current, secondsUntilFull, fullAtDate };
}
