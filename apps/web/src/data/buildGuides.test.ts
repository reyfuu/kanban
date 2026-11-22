import { describe, expect, it } from 'vitest';
import { CHARACTERS_DATABASE } from './characters';
import { formatSubStatsSummary, getCharacterBuildGuide, getPrimaryF2PWeapon } from './buildGuides';

describe('Rekomendasi build, senjata F2P, dan tim', () => {
  it('menyediakan panduan lengkap dengan senjata F2P dan tim F2P di urutan teratas untuk seluruh 184 karakter', () => {
    expect(CHARACTERS_DATABASE.length).toBeGreaterThan(150);

    for (const character of CHARACTERS_DATABASE) {
      const guide = getCharacterBuildGuide(character);
      expect(guide.role.length).toBeGreaterThan(0);
      expect(guide.gearSet.length).toBeGreaterThan(0);
      expect(guide.talentPriority.length).toBeGreaterThan(0);
      expect(guide.subStats.length).toBeGreaterThan(0);

      // F2P weapon always exists and comes first
      expect(guide.weapons.length).toBeGreaterThan(0);
      expect(guide.weapons[0]!.tier).toBe('F2P');
      expect(getPrimaryF2PWeapon(guide).tier).toBe('F2P');

      // F2P team always exists and comes first
      expect(guide.teams.length).toBeGreaterThan(0);
      expect(guide.teams[0]!.tier).toBe('F2P');
      expect(guide.teams[0]!.members.length).toBeGreaterThanOrEqual(3);

      // Slot labels match game
      if (character.game === 'GENSHIN_IMPACT') {
        expect(guide.mainStats.slot1Label).toBe('Sands');
        expect(guide.mainStats.slot2Label).toBe('Goblet');
        expect(guide.mainStats.slot3Label).toBe('Circlet');
      } else {
        expect(guide.mainStats.slot1Label).toBe('Disc 4');
        expect(guide.mainStats.slot2Label).toBe('Disc 5');
        expect(guide.mainStats.slot3Label).toBe('Disc 6');
      }

      expect(formatSubStatsSummary(guide).length).toBeLessThanOrEqual(500);
    }
  });

  it('mengembalikan panduan terkurasi dengan senjata F2P akurat untuk karakter utama Genshin & ZZZ', () => {
    const byId = (id: string) => CHARACTERS_DATABASE.find(c => c.id === id)!;

    const raiden = getCharacterBuildGuide(byId('raiden-shogun'));
    expect(raiden.isGenericFallback).toBe(false);
    expect(getPrimaryF2PWeapon(raiden).name).toBe('The Catch');

    const furina = getCharacterBuildGuide(byId('furina'));
    expect(furina.isGenericFallback).toBe(false);
    expect(getPrimaryF2PWeapon(furina).name).toBe('Fleuve Cendre Ferryman');

    const neuvillette = getCharacterBuildGuide(byId('neuvillette'));
    expect(neuvillette.isGenericFallback).toBe(false);
    expect(getPrimaryF2PWeapon(neuvillette).name).toBe('Prototype Amber');

    const arlecchino = getCharacterBuildGuide(byId('arlecchino'));
    expect(arlecchino.isGenericFallback).toBe(false);
    expect(getPrimaryF2PWeapon(arlecchino).name).toBe('White Tassel');

    const miyabi = getCharacterBuildGuide(byId('miyabi'));
    expect(miyabi.isGenericFallback).toBe(false);
    expect(getPrimaryF2PWeapon(miyabi).name).toBe('Weeping Gemini');

    const zhuYuan = getCharacterBuildGuide(byId('zhu-yuan'));
    expect(zhuYuan.isGenericFallback).toBe(false);
    expect(getPrimaryF2PWeapon(zhuYuan).name).toBe('Starlight Engine');
  });
});
