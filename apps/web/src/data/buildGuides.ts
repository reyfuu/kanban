import type { Character, CharacterBuildGuide, TeamRecommendation, WeaponRecommendation } from '../types/kanban';

type CompactWeapon = [name: string, rarity: string, tier: 'F2P' | 'BIS' | 'ALT', source: string, note: string];
type CompactTeam = [name: string, tier: 'F2P' | 'META', members: string[], note: string];

interface CompactGuide {
  role: string;
  talent: string;
  set: string;
  alt?: string;
  stats: [string, string, string];
  subs: string;
  weapons: CompactWeapon[];
  teams: CompactTeam[];
}

function expandGuide(game: Character['game'], entry: CompactGuide, isGenericFallback = false): CharacterBuildGuide {
  const genshin = game === 'GENSHIN_IMPACT';
  const order = { F2P: 0, ALT: 1, BIS: 2 };
  const weapons: WeaponRecommendation[] = [...entry.weapons]
    .sort((a, b) => order[a[2]] - order[b[2]])
    .map(([name, rarity, tier, source, note]) => ({ name, rarity, tier, source, note }));
  const teams: TeamRecommendation[] = [...entry.teams]
    .sort((a, b) => (a[1] === 'F2P' ? 0 : 1) - (b[1] === 'F2P' ? 0 : 1))
    .map(([name, tier, members, note]) => ({ name, tier, members, note }));

  return {
    role: entry.role,
    talentPriority: entry.talent,
    gearSet: entry.set,
    ...(entry.alt ? { gearAlt: entry.alt } : {}),
    mainStats: {
      slot1Label: genshin ? 'Sands' : 'Disc 4',
      slot1: entry.stats[0],
      slot2Label: genshin ? 'Goblet' : 'Disc 5',
      slot2: entry.stats[1],
      slot3Label: genshin ? 'Circlet' : 'Disc 6',
      slot3: entry.stats[2],
    },
    subStats: entry.subs,
    weapons,
    teams,
    isGenericFallback,
  };
}

const CURATED_GUIDES: Record<string, CompactGuide> = {
  // ======================== GENSHIN IMPACT ========================
  'raiden-shogun': {
    role: 'Main DPS / Battery',
    talent: 'Burst > Skill > Normal',
    set: '4pc Emblem of Severed Fate',
    alt: '4pc Flower of Paradise Lost (Hyperbloom)',
    stats: ['ER% / ATK%', 'Electro DMG / ATK%', 'CRIT Rate / CRIT DMG'],
    subs: 'ER (220–250%) > CRIT Rate / DMG > ATK%',
    weapons: [
      ['The Catch', '4★', 'F2P', 'Fishing Inazuma (Gratis R5)', 'Senjata F2P terbaik Raiden, bonus Burst DMG & CRIT Rate.'],
      ['Dragon\'s Bane', '4★', 'F2P', 'Gacha 4★', 'Terbaik jika dipakai sebagai pemicu Hyperbloom (Full EM).'],
      ['Engulfing Lightning', '5★', 'BIS', 'Signature 5★', 'Konversi ER ke ATK & energi paling nyaman.'],
    ],
    teams: [
      ['Raiden National (F2P)', 'F2P', ['Raiden Shogun', 'Xiangling', 'Xingqiu', 'Bennett'], 'Tim paling konsisten, semua rekan 4★ mudah dibangun.'],
      ['Raiden Chevreuse Overload', 'META', ['Raiden Shogun', 'Kujou Sara', 'Chevreuse', 'Bennett'], 'Meta Overload modern: C6 Sara + 40% shred Chevreuse untuk burst tertinggi.'],
      ['Raiden Double Hydro Taser', 'META', ['Raiden Shogun', 'Furina', 'Yelan', 'Xilonen'], 'Alternatif meta DPS stabil tanpa terikat lingkaran Bennett.'],
    ],
  },
  furina: {
    role: 'Sub-DPS / Buffer',
    talent: 'Burst = Skill > Normal',
    set: '4pc Golden Troupe',
    alt: '4pc Tenacity of the Millelith (Support)',
    stats: ['HP% / ER%', 'HP%', 'CRIT Rate / CRIT DMG'],
    subs: 'ER (160–200%) > CRIT Rate / DMG > HP% (target ~40k HP)',
    weapons: [
      ['Fleuve Cendre Ferryman', '4★', 'F2P', 'Fishing Fontaine (Gratis R5)', 'Opsi F2P terbaik: ER tinggi + CRIT Rate Skill.'],
      ['Favonius Sword', '4★', 'F2P', 'Quest Mondstadt / Gacha 4★', 'Sangat membantu kebutuhan energi seluruh tim.'],
      ['Splendor of Tranquil Waters', '5★', 'BIS', 'Signature 5★', 'Damage pribadi tertinggi (butuh ER cukup dari substat).'],
    ],
    teams: [
      ['Furina Taser F2P', 'F2P', ['Furina', 'Fischl', 'Sucrose', 'Barbara'], 'Healer tim penuh menjaga stack Fanfare tetap maksimal.'],
      ['Neuvillette Hypercarry', 'META', ['Neuvillette', 'Furina', 'Kaedehara Kazuha', 'Xilonen'], 'Sinergi HP drain + buff DMG terbesar di game.'],
    ],
  },
  neuvillette: {
    role: 'On-Field Main DPS',
    talent: 'Normal Attack > Burst = Skill',
    set: '4pc Marechaussee Hunter',
    alt: '4pc Heart of Depth',
    stats: ['HP%', 'Hydro DMG / HP%', 'CRIT DMG / HP%'],
    subs: 'CRIT Rate (maks 64% dgn 4pc MH) > CRIT DMG > HP% > ER',
    weapons: [
      ['Prototype Amber', '4★', 'F2P', 'Craftable Blacksmith (Gratis)', 'F2P terbaik: stat HP%, pulihkan energi & heal tim.'],
      ['Ring of Yaxche', '4★', 'F2P', 'Craftable Natlan (Gratis)', 'Alternatif craftable HP% + bonus Normal Attack DMG.'],
      ['Tome of the Eternal Flow', '5★', 'BIS', 'Signature 5★', 'Lonjakan damage Charged Attack paling besar.'],
    ],
    teams: [
      ['Neuvillette F2P', 'F2P', ['Neuvillette', 'Fischl', 'Sucrose', 'Layla'], '3 reaksi Hydro berbeda untuk pasif + perisai nyaman.'],
      ['Neuvillette Hypercarry', 'META', ['Neuvillette', 'Furina', 'Kaedehara Kazuha', 'Xilonen'], 'Tim meta #1 Neuvillette: Double Hydro + double shred VV & Xilonen.'],
      ['Neuvillette Escoffier Freeze', 'META', ['Neuvillette', 'Furina', 'Escoffier', 'Citlali'], 'Varian meta Freeze modern dengan 55% shred Cryo/Hydro Escoffier.'],
    ],
  },
  arlecchino: {
    role: 'On-Field Pyro DPS',
    talent: 'Normal Attack > Skill = Burst',
    set: '4pc Fragment of Harmonic Whimsy',
    alt: '4pc Gladiator\'s Finale',
    stats: ['ATK% / EM', 'Pyro DMG', 'CRIT Rate / CRIT DMG'],
    subs: 'CRIT Rate / DMG > ATK% > EM (untuk Vape/Melt)',
    weapons: [
      ['White Tassel', '3★', 'F2P', 'Chest Liyue (Gratis R5)', 'Senjata 3★ luar biasa: CRIT Rate + 48% Normal Attack DMG.'],
      ['Dragon\'s Bane', '4★', 'F2P', 'Gacha 4★', 'Kuat di tim Vaporize bersama Xingqiu/Yelan.'],
      ['Crimson Moon\'s Semblance', '5★', 'BIS', 'Signature 5★', 'Memberi Bond of Life ekstra & CRIT Rate.'],
    ],
    teams: [
      ['Arlecchino Vape F2P', 'F2P', ['Arlecchino', 'Xingqiu', 'Sucrose', 'Bennett'], 'Xingqiu memberi Hydro + damage reduction saat tidak bisa di-heal.'],
      ['Arlecchino Forward Melt', 'META', ['Arlecchino', 'Citlali', 'Xilonen', 'Bennett'], 'Ceiling DPS tertinggi di TC: Forward Melt + perisai Cryo Citlali.'],
      ['Arlecchino Chevreuse Overload', 'META', ['Arlecchino', 'Fischl', 'Chevreuse', 'Bennett'], 'Varian meta paling mudah dimainkan tanpa perlu setup aura Melt.'],
    ],
  },
  mavuika: {
    role: 'Main DPS / Pyro Sub-DPS',
    talent: 'Burst > Skill > Normal',
    set: '4pc Obsidian Codex (DPS)',
    alt: '4pc Scroll of the Hero of Cinder City (Sub-DPS)',
    stats: ['ATK% / EM', 'Pyro DMG', 'CRIT DMG / CRIT Rate'],
    subs: 'CRIT Rate (maks 60% dgn Codex) > CRIT DMG > ATK% / EM',
    weapons: [
      ['Tidal Shadow', '4★', 'F2P', 'Craftable Fontaine (Gratis)', 'Bonus ATK% besar saat menerima heal (mudah aktif dgn Bennett).'],
      ['Earth Shaker', '4★', 'F2P', 'Craftable Natlan (Gratis)', 'Bagus untuk playstyle off-field Pyro Skill.'],
      ['A Thousand Blazing Suns', '5★', 'BIS', 'Signature 5★', 'CRIT + ATK% tinggi sesuai rotasi Nightsoul.'],
    ],
    teams: [
      ['Mavuika Overload F2P', 'F2P', ['Mavuika', 'Ororon', 'Chevreuse', 'Bennett'], 'Ororon mengisi Fighting Spirit dengan cepat + buff Chevreuse.'],
      ['Mavuika Premium Melt', 'META', ['Mavuika', 'Citlali', 'Xilonen', 'Bennett'], 'Tim meta #1 Mavuika: Nuke Forward Melt + Fighting Spirit instan.'],
      ['Mavuika Double Hydro / Vape', 'META', ['Mavuika', 'Furina', 'Xilonen', 'Bennett'], 'Alternatif meta Vaporize konsisten bila Citlali dipakai tim lain.'],
    ],
  },
  xilonen: {
    role: 'Buffer / Shredder / Healer',
    talent: 'Skill > Burst (Normal skip)',
    set: '4pc Scroll of the Hero of Cinder City',
    alt: '4pc Archaic Petra',
    stats: ['DEF% / ER%', 'DEF%', 'Healing Bonus / DEF%'],
    subs: 'ER (160–180%) > DEF% > CRIT Rate (jika pakai Favonius)',
    weapons: [
      ['Flute of Ezpitzal', '4★', 'F2P', 'Craftable Natlan (Gratis)', 'Stat DEF% tinggi untuk heal & mudah dibuat R5.'],
      ['Favonius Sword', '4★', 'F2P', 'Quest Mondstadt / Gacha 4★', 'Terbaik untuk energi tim; butuh ~35% CRIT Rate.'],
      ['Peak Patrol Song', '5★', 'BIS', 'Signature 5★', 'Memberi Elemental DMG Bonus ke seluruh party.'],
    ],
    teams: [
      ['Xilonen Flex F2P', 'F2P', ['Xiangling', 'Xingqiu', 'Xilonen', 'Bennett'], 'Masuk ke hampir semua tim Pyro/Hydro/Cryo/Electro.'],
      ['Mavuika / Neuvillette Core', 'META', ['Neuvillette', 'Furina', 'Kaedehara Kazuha', 'Xilonen'], 'RES shred permanen + 40% Elemental DMG dari Cinder City.'],
    ],
  },
  citlali: {
    role: 'Shielder / Melt-Freeze Buffer',
    talent: 'Skill > Burst > Normal',
    set: '4pc Scroll of the Hero of Cinder City',
    alt: '4pc Tenacity of the Millelith',
    stats: ['EM / ER%', 'EM', 'EM'],
    subs: 'ER (160–190%) > Elemental Mastery',
    weapons: [
      ['Thrilling Tales of Dragon Slayers', '3★', 'F2P', 'Gacha 3★ (Mudah R5)', 'Buff +48% ATK gratis ke Main DPS Pyro/Hydro.'],
      ['Sacrificial Fragments', '4★', 'F2P', 'Gacha 4★', 'EM besar untuk perisai tebal + reset Skill.'],
      ['Starcaller\'s Watch', '5★', 'BIS', 'Signature 5★', 'EM tertinggi + buff DMG karakter aktif.'],
    ],
    teams: [
      ['Gaming Melt F2P', 'F2P', ['Gaming', 'Citlali', 'Sucrose', 'Bennett'], 'Forward Melt mudah dengan shred Pyro 20%.'],
      ['Mavuika / Arlecchino Melt', 'META', ['Mavuika', 'Citlali', 'Xilonen', 'Bennett'], 'Partner terbaik DPS Pyro modern.'],
    ],
  },
  'kaedehara-kazuha': {
    role: 'Anemo Buffer / Grouper',
    talent: 'Burst = Skill = Normal (opsional)',
    set: '4pc Viridescent Venerer',
    stats: ['EM / ER%', 'EM', 'EM'],
    subs: 'ER (160–180%) > Elemental Mastery',
    weapons: [
      ['Iron Sting', '4★', 'F2P', 'Craftable Blacksmith (Gratis)', 'EM tinggi untuk maksimalkan buff Elemental DMG.'],
      ['Favonius Sword', '4★', 'F2P', 'Quest / Gacha 4★', 'Sering lebih optimal dari EM sword karena baterai tim.'],
      ['Freedom-Sworn', '5★', 'BIS', 'Signature 5★', 'EM tertinggi + buff ATK & Normal/Charged DMG tim.'],
    ],
    teams: [
      ['Kazuha National F2P', 'F2P', ['Kaedehara Kazuha', 'Xiangling', 'Xingqiu', 'Bennett'], 'Double Swirl Pyro/Hydro + crowd control rapat.'],
      ['Neuvillette / Freeze Meta', 'META', ['Neuvillette', 'Furina', 'Kaedehara Kazuha', 'Xilonen'], 'RES shred VV + 35–40% Elemental DMG Bonus.'],
    ],
  },
  nahida: {
    role: 'Dendro Enabler / Sub-DPS',
    talent: 'Skill > Burst > Normal',
    set: '4pc Deepwood Memories',
    alt: '4pc Gilded Dreams (jika rekan pakai Deepwood)',
    stats: ['EM', 'EM / Dendro DMG', 'EM / CRIT Rate'],
    subs: 'EM (hingga ~800–1000) > CRIT Rate / DMG > ER',
    weapons: [
      ['Magic Guide', '3★', 'F2P', 'Gacha 3★ (Mudah R5)', 'Sangat kuat di tim Hyperbloom/Bloom berkat EM & pasifnya.'],
      ['Mappa Mare', '4★', 'F2P', 'Craftable Blacksmith (Gratis)', 'Opsi on-field driver gratis yang konsisten.'],
      ['A Thousand Floating Dreams', '5★', 'BIS', 'Signature 5★', 'EM tertinggi + buff EM tambahan untuk rekan tim.'],
    ],
    teams: [
      ['Nahida Hyperbloom F2P', 'F2P', ['Nahida', 'Xingqiu', 'Kuki Shinobu', 'Fischl'], 'Tim paling ramah F2P dengan floor damage sangat tinggi.'],
      ['Alhaitham Quickbloom', 'META', ['Alhaitham', 'Nahida', 'Furina', 'Kuki Shinobu'], 'Spread + Hyperbloom sekaligus dengan baterai Dendro mulus.'],
    ],
  },
  bennett: {
    role: 'ATK Buffer / Healer',
    talent: 'Burst > Skill (Normal skip)',
    set: '4pc Noblesse Oblige',
    alt: '4pc Instructor (Tim Reaksi)',
    stats: ['ER%', 'HP%', 'Healing Bonus / HP%'],
    subs: 'ER (220–260%) > HP%',
    weapons: [
      ['Sapwood Blade', '4★', 'F2P', 'Craftable Sumeru (Gratis)', 'Senjata F2P terbaik Bennett: Base ATK 565 + ER 30.6%.'],
      ['Prototype Rancour', '4★', 'F2P', 'Quest AR10 (Gratis)', 'Base ATK tinggi (565) untuk pemula sebelum Sumeru.'],
      ['Aquila Favonia / Mistsplitter Reforged', '5★', 'BIS', '5★ Base ATK 674', 'Base ATK maksimal untuk buff Burst terbesar.'],
    ],
    teams: [
      ['National F2P', 'F2P', ['Xiangling', 'Xingqiu', 'Bennett', 'Sucrose'], 'Fondasi tim 4★ terkuat untuk Spiral Abyss.'],
      ['Hypercarry Pyro / ATK', 'META', ['Arlecchino', 'Citlali', 'Xilonen', 'Bennett'], 'Buff ATK flat terbesar di seluruh game.'],
    ],
  },
  xiangling: {
    role: 'Off-Field Pyro Sub-DPS',
    talent: 'Burst > Skill (Normal skip)',
    set: '4pc Emblem of Severed Fate',
    stats: ['ER% / EM', 'Pyro DMG', 'CRIT Rate / CRIT DMG'],
    subs: 'ER (200–230%) > CRIT Rate / DMG > EM > ATK%',
    weapons: [
      ['The Catch', '4★', 'F2P', 'Fishing Inazuma (Gratis R5)', 'Terbaik bahkan menyaingi banyak senjata 5★.'],
      ['Kitain Cross Spear', '4★', 'F2P', 'Craftable Inazuma (Gratis)', 'Opsi EM + regenerasi energi jika The Catch dipakai Raiden.'],
      ['Staff of the Scarlet Sands', '5★', 'BIS', '5★ Limited', 'Terbaik untuk Vaporize/Melt berbasis EM.'],
    ],
    teams: [
      ['National F2P', 'F2P', ['Xiangling', 'Xingqiu', 'Bennett', 'Sucrose'], 'Snapshot buff Bennett pada Pyronado tanpa ICD.'],
      ['International', 'META', ['Tartaglia', 'Xiangling', 'Kaedehara Kazuha', 'Bennett'], 'AoE Vaporize legendaris.'],
    ],
  },
  xingqiu: {
    role: 'Off-Field Hydro Sub-DPS',
    talent: 'Burst > Skill (Normal skip)',
    set: '4pc Emblem of Severed Fate',
    alt: '4pc Noblesse Oblige',
    stats: ['ER% / ATK%', 'Hydro DMG', 'CRIT Rate / CRIT DMG'],
    subs: 'ER (180–220%) > CRIT Rate / DMG > ATK%',
    weapons: [
      ['Favonius Sword', '4★', 'F2P', 'Quest Mondstadt / Gacha 4★', 'Menjamin Burst siap tiap rotasi + bantu energi tim.'],
      ['Sacrificial Sword', '4★', 'F2P', 'Gacha 4★', 'Double Skill di R3+ membuat energi melimpah.'],
      ['Primordial Jade Cutter', '5★', 'BIS', '5★ Limited', 'Damage maksimal bila ER sudah cukup (biasanya C6).'],
    ],
    teams: [
      ['Hyperbloom F2P', 'F2P', ['Xingqiu', 'Kuki Shinobu', 'Collei', 'Sucrose'], 'Aplikasi Hydro stabil + anti-interupsi.'],
      ['Arlecchino / Hu Tao Vape', 'META', ['Hu Tao', 'Xingqiu', 'Yelan', 'Zhongli'], 'Double Hydro paling nyaman & konsisten.'],
    ],
  },
  fischl: {
    role: 'Off-Field Electro Sub-DPS',
    talent: 'Skill > Burst (Normal skip)',
    set: '4pc Golden Troupe',
    alt: '4pc Thundering Fury',
    stats: ['ATK% / EM', 'Electro DMG', 'CRIT Rate / CRIT DMG'],
    subs: 'CRIT Rate / DMG > ATK% > EM > ER (120%)',
    weapons: [
      ['Song of Stillness', '4★', 'F2P', 'Craftable Fontaine (Gratis)', 'Opsi F2P solid saat dipasangkan dengan healer.'],
      ['The Stringless', '4★', 'F2P', 'Gacha 4★', 'EM + Skill DMG sangat kuat di tim Aggravate.'],
      ['Polar Star / Aqua Simulacra', '5★', 'BIS', '5★ Limited', 'Stat CRIT tinggi untuk damage Oz maksimal.'],
    ],
    teams: [
      ['Aggravate F2P', 'F2P', ['Keqing', 'Fischl', 'Sucrose', 'Yaoyao'], 'Pasif A4 Fischl memicu Aggravate terus-menerus.'],
      ['Clorinde Aggravate', 'META', ['Clorinde', 'Fischl', 'Nahida', 'Kaedehara Kazuha'], 'Sinergi Electro cepat dengan DPS off-field besar.'],
    ],
  },
  sucrose: {
    role: 'Anemo Driver / EM Buffer',
    talent: 'Tidak wajib dinaikkan (prioritas Level 90)',
    set: '4pc Viridescent Venerer',
    stats: ['EM', 'EM', 'EM'],
    subs: 'Elemental Mastery > ER (140–160%)',
    weapons: [
      ['Thrilling Tales of Dragon Slayers', '3★', 'F2P', 'Gacha 3★ (Mudah R5)', 'Buff +48% ATK ke DPS saat swap.'],
      ['Sacrificial Fragments', '4★', 'F2P', 'Gacha 4★', 'EM terbesar + extra Skill charge untuk baterai/grouping.'],
      ['A Thousand Floating Dreams', '5★', 'BIS', '5★ Limited', 'Stat EM tertinggi untuk share EM maksimal.'],
    ],
    teams: [
      ['Sucrose Taser F2P', 'F2P', ['Sucrose', 'Xingqiu', 'Fischl', 'Beidou'], 'Semua 4★, AoE Electro-Charged sangat efektif.'],
      ['National Variant', 'META', ['Sucrose', 'Xiangling', 'Xingqiu', 'Bennett'], 'Share EM membuat Vaporize Xiangling sangat sakit.'],
    ],
  },
  'kuki-shinobu': {
    role: 'Hyperbloom Trigger / Healer',
    talent: 'Skill > Burst (prioritas Level 90)',
    set: '4pc Flower of Paradise Lost',
    alt: '4pc Gilded Dreams',
    stats: ['EM', 'EM', 'EM'],
    subs: 'Elemental Mastery > HP%',
    weapons: [
      ['Iron Sting', '4★', 'F2P', 'Craftable Blacksmith (Gratis)', 'EM 165 gratis langsung dari pandai besi.'],
      ['Dark Iron Sword', '3★', 'F2P', 'NPC Chen the Sharp Liyue (Gratis)', 'EM 141, sangat murah di-upgrade untuk pemula.'],
      ['Key of Khaj-Nisut', '5★', 'BIS', '5★ Limited', 'Konversi HP menjadi EM tim dalam jumlah besar.'],
    ],
    teams: [
      ['Hyperbloom Budget', 'F2P', ['Kuki Shinobu', 'Xingqiu', 'Collei', 'Barbara'], 'Cukup Level 90 + Full EM untuk clear konten endgame.'],
      ['Alhaitham Quickbloom', 'META', ['Alhaitham', 'Nahida', 'Yelan', 'Kuki Shinobu'], 'Pemicu Hyperbloom paling konsisten sekaligus healer.'],
    ],
  },
  'hu-tao': {
    role: 'On-Field Pyro DPS',
    talent: 'Normal Attack = Skill > Burst',
    set: '4pc Crimson Witch of Flames',
    alt: '4pc Marechaussee Hunter (dgn Furina)',
    stats: ['EM / HP%', 'Pyro DMG', 'CRIT Rate / CRIT DMG'],
    subs: 'CRIT Rate / DMG > EM (200–300) > HP%',
    weapons: [
      ['White Tassel', '3★', 'F2P', 'Chest Liyue (Gratis R5)', 'Opsi pemula solid sebelum dapat Dragon\'s Bane.'],
      ['Dragon\'s Bane', '4★', 'F2P', 'Gacha 4★', 'Senjata 4★ terbaik untuk Vaporize di R5.'],
      ['Staff of Homa', '5★', 'BIS', 'Signature 5★', 'HP%, CRIT DMG, dan konversi HP ke ATK.'],
    ],
    teams: [
      ['Hu Tao Vape F2P', 'F2P', ['Hu Tao', 'Xingqiu', 'Sucrose', 'Layla'], 'Vaporize konsisten dengan perisai Cryo untuk sesekali Melt.'],
      ['Hu Tao Furina Xilonen', 'META', ['Hu Tao', 'Furina', 'Yelan', 'Xilonen'], 'Tim meta #1 Hu Tao modern: Double Hydro + shred Xilonen & Fanfare cepat.'],
      ['Hu Tao Furina Plunge', 'META', ['Hu Tao', 'Furina', 'Yelan', 'Xianyun'], 'Alternatif meta Plunge sangat nyaman untuk Hu Tao C0.'],
    ],
  },
  yelan: {
    role: 'Off-Field Hydro Sub-DPS',
    talent: 'Burst > Skill (Normal skip)',
    set: '4pc Emblem of Severed Fate',
    stats: ['ER% / HP%', 'Hydro DMG', 'CRIT Rate / CRIT DMG'],
    subs: 'ER (170–210% solo) > CRIT Rate / DMG > HP%',
    weapons: [
      ['Favonius Warbow', '4★', 'F2P', 'Quest Mondstadt (Gratis)', 'Senjata F2P terbaik Yelan; selesaikan masalah ER sekaligus baterai tim.'],
      ['Slingshot', '3★', 'F2P', 'Gacha 3★', 'Stat CRIT Rate besar jika ER sudah terpenuhi dari tim Double Hydro.'],
      ['Aqua Simulacra', '5★', 'BIS', 'Signature 5★', 'CRIT DMG 88% + HP% dan bonus DMG universal.'],
    ],
    teams: [
      ['Yelan Hyperbloom F2P', 'F2P', ['Yelan', 'Kuki Shinobu', 'Collei', 'Xingqiu'], 'Double Hydro menjaga ER rendah & Bloom melimpah.'],
      ['Hu Tao / Arlecchino Double Hydro', 'META', ['Arlecchino', 'Yelan', 'Xingqiu', 'Bennett'], 'Hydro tanpa putus + buff DMG progresif Yelan.'],
    ],
  },
  zhongli: {
    role: 'Shielder / Universal Support',
    talent: 'Skill > Burst (Normal skip)',
    set: '4pc Tenacity of the Millelith',
    alt: '4pc Archaic Petra (Buffer Elemental)',
    stats: ['HP%', 'HP%', 'HP%'],
    subs: 'HP% > ER / CRIT Rate (jika pakai Favonius)',
    weapons: [
      ['Black Tassel', '3★', 'F2P', 'Gacha 3★ (Mudah R5)', 'HP% 46.9% membuat perisai tertebal secara gratis.'],
      ['Favonius Lance', '4★', 'F2P', 'Gacha 4★', 'Sangat bagus untuk bantu energi tim tanpa mengorbankan banyak perisai.'],
      ['Staff of Homa', '5★', 'BIS', '5★ Limited', 'HP% sekaligus damage Burst untuk build Hybrid.'],
    ],
    teams: [
      ['Flex Shield F2P', 'F2P', ['Yanfei', 'Xingqiu', 'Bennett', 'Zhongli'], 'Perisai anti-interupsi + 20% RES shred semua elemen.'],
      ['Double Geo / Hypercarry', 'META', ['Navia', 'Zhongli', 'Furina', 'Bennett'], 'Resonansi Geo + Crystallize stabil.'],
    ],
  },
  alhaitham: {
    role: 'On-Field Dendro DPS',
    talent: 'Skill > Normal Attack > Burst',
    set: '4pc Gilded Dreams',
    alt: '4pc Deepwood Memories (jika tidak ada pemakai lain)',
    stats: ['EM', 'Dendro DMG', 'CRIT Rate / CRIT DMG'],
    subs: 'CRIT Rate / DMG > EM (300–500) > ER (130%)',
    weapons: [
      ['Harbinger of Dawn', '3★', 'F2P', 'Gacha 3★ (Mudah R5)', 'CRIT sangat besar jika HP >90% (pakai shielder/healer).'],
      ['Iron Sting', '4★', 'F2P', 'Craftable Blacksmith (Gratis)', 'Opsi EM stabil tanpa syarat HP >90%.'],
      ['Light of Foliar Incision', '5★', 'BIS', 'Signature 5★', 'CRIT DMG 88% + konversi EM ke damage Skill/Normal.'],
    ],
    teams: [
      ['Alhaitham Quickbloom F2P', 'F2P', ['Alhaitham', 'Xingqiu', 'Kuki Shinobu', 'Yaoyao'], 'Spread + Hyperbloom aman dengan 2 healer.'],
      ['Alhaitham Premium Quickbloom', 'META', ['Alhaitham', 'Nahida', 'Furina', 'Kuki Shinobu'], 'DPS Dendro tertinggi untuk single-target maupun AoE.'],
    ],
  },
  clorinde: {
    role: 'On-Field Electro DPS',
    talent: 'Skill > Burst (Normal skip)',
    set: '4pc Fragment of Harmonic Whimsy',
    alt: '4pc Thundering Fury',
    stats: ['ATK%', 'Electro DMG', 'CRIT DMG / CRIT Rate'],
    subs: 'CRIT DMG / Rate (maks 80% krn pasif +20%) > ATK% > EM',
    weapons: [
      ['Finale of the Deep', '4★', 'F2P', 'Craftable Fontaine (Gratis)', 'Sinergi sempurna: memberi Bond of Life yang langsung di-clear Clorinde.'],
      ['Calamity of Eshu', '4★', 'F2P', 'Event 5.2 (Gratis jika punya)', 'Sangat kuat jika bermain dengan shielder (Kirara/Thoma/Lan Yan).'],
      ['Absolution', '5★', 'BIS', 'Signature 5★', 'CRIT DMG tinggi + stack DMG dari perubahan Bond of Life.'],
    ],
    teams: [
      ['Clorinde Aggravate F2P', 'F2P', ['Clorinde', 'Fischl', 'Kirara', 'Sucrose'], 'Aplikasi Electro sangat cepat memicu pasif Fischl.'],
      ['Clorinde Mavuika Overload', 'META', ['Clorinde', 'Mavuika', 'Chevreuse', 'Iansan'], 'Meta ceiling tertinggi Clorinde di TC: Overload + buff ATK Iansan & shred Chevreuse.'],
      ['Clorinde Aggravate Premium', 'META', ['Clorinde', 'Fischl', 'Nahida', 'Kaedehara Kazuha'], 'Alternatif meta Aggravate terbaik untuk AoE & multi-wave.'],
    ],
  },
  navia: {
    role: 'Quickswap / On-Field Geo DPS',
    talent: 'Skill > Normal Attack > Burst',
    set: '4pc Nighttime Whispers in the Echoing Woods',
    alt: '4pc Marechaussee Hunter (dgn Furina)',
    stats: ['ATK%', 'Geo DMG', 'CRIT Rate / CRIT DMG'],
    subs: 'CRIT Rate (target 80%+) > CRIT DMG > ATK% > ER (130%)',
    weapons: [
      ['Tidal Shadow', '4★', 'F2P', 'Craftable Fontaine (Gratis)', 'Bonus ATK% besar dengan healer seperti Bennett.'],
      ['Ultimate Overlord\'s Mega Magic Sword', '4★', 'F2P', 'Event 4.3 (Gratis jika punya)', 'ER + ATK% besar untuk rotasi mulus.'],
      ['Verdict', '5★', 'BIS', 'Signature 5★', 'CRIT Rate + bonus Skill DMG dari Crystallize.'],
    ],
    teams: [
      ['Navia Double Pyro F2P', 'F2P', ['Navia', 'Kachina', 'Xiangling', 'Bennett'], 'Kachina memakai Cinder City + menghasilkan shard Crystallize.'],
      ['Navia Mavuika Xilonen', 'META', ['Navia', 'Xilonen', 'Mavuika', 'Bennett'], 'Meta #1 Navia: Mavuika off-field + shred Geo Xilonen + double Pyro.'],
      ['Navia Furina Xilonen', 'META', ['Navia', 'Xilonen', 'Furina', 'Bennett'], 'Varian meta Hydro Crystallize + Fanfare Furina.'],
    ],
  },
  'kamisato-ayaka': {
    role: 'Cryo Burst DPS',
    talent: 'Burst > Normal Attack > Skill',
    set: '4pc Blizzard Strayer',
    stats: ['ATK%', 'Cryo DMG', 'CRIT DMG'],
    subs: 'ER (130–145%) > CRIT DMG > ATK% > CRIT Rate (maks 45%)',
    weapons: [
      ['Amenoma Kageuchi', '4★', 'F2P', 'Craftable Inazuma (Gratis)', 'Sangat memudahkan ER sehingga bisa fokus penuh ke CRIT DMG & ATK.'],
      ['Finale of the Deep', '4★', 'F2P', 'Craftable Fontaine (Gratis)', 'Damage lebih tinggi jika ER sudah tercukupi & ada healer.'],
      ['Mistsplitter Reforged', '5★', 'BIS', 'Signature 5★', 'Elemental DMG & CRIT DMG tertinggi.'],
    ],
    teams: [
      ['Ayaka Freeze F2P', 'F2P', ['Kamisato Ayaka', 'Kaeya', 'Barbara', 'Sucrose'], 'Freeze budget mudah dipakai melawan musuh yang bisa dibekukan.'],
      ['Ayaka Escoffier Freeze', 'META', ['Kamisato Ayaka', 'Escoffier', 'Furina', 'Shenhe'], 'Shred Cryo/Hydro besar membuat tim Freeze kembali dominan.'],
    ],
  },
  mualani: {
    role: 'Forward Vaporize Hydro DPS',
    talent: 'Skill > Burst (Normal skip)',
    set: '4pc Obsidian Codex',
    stats: ['HP% / EM', 'Hydro DMG', 'CRIT DMG / HP%'],
    subs: 'CRIT Rate (maks 60% dgn Codex) > CRIT DMG > HP% > EM',
    weapons: [
      ['Ring of Yaxche', '4★', 'F2P', 'Craftable Natlan (Gratis)', 'Craftable khusus Natlan: HP% + bonus Normal Attack DMG.'],
      ['The Widsith', '4★', 'F2P', 'Gacha 4★', 'CRIT DMG + peluang buff EM/Elemental DMG besar.'],
      ['Surf\'s Up', '5★', 'BIS', 'Signature 5★', 'CRIT DMG 88% + HP% + bonus Vaporize Normal Attack.'],
    ],
    teams: [
      ['Mualani Vape F2P', 'F2P', ['Mualani', 'Xiangling', 'Sucrose', 'Kachina'], 'Kachina Cinder City + Xiangling Pyro untuk gigitan Vape besar.'],
      ['Mualani Mavuika Xilonen', 'META', ['Mualani', 'Mavuika', 'Xilonen', 'Sucrose'], 'Tim meta #1 Mualani (speedrun/TC): share EM + VV Sucrose + Cinder City Xilonen.'],
    ],
  },
  kinich: {
    role: 'Burning / Burgeon Dendro DPS',
    talent: 'Skill > Burst (Normal skip)',
    set: '4pc Obsidian Codex',
    stats: ['ATK%', 'Dendro DMG', 'CRIT DMG / CRIT Rate'],
    subs: 'CRIT Rate (maks 60% dgn Codex) > CRIT DMG > ATK%',
    weapons: [
      ['Earth Shaker', '4★', 'F2P', 'Craftable Natlan (Gratis)', 'F2P terbaik Kinich: aktif otomatis dari reaksi Burning/Burgeon.'],
      ['Tidal Shadow', '4★', 'F2P', 'Craftable Fontaine (Gratis)', 'Alternatif ATK% tinggi bila bermain dengan Bennett.'],
      ['Fang of the Mountain King', '5★', 'BIS', 'Signature 5★', 'Bonus Skill & Burst DMG besar dari reaksi Pyro+Dendro.'],
    ],
    teams: [
      ['Kinich Burning F2P', 'F2P', ['Kinich', 'Xiangling', 'Yaoyao', 'Bennett'], 'Yaoyao memakai Deepwood Memories untuk shred Dendro.'],
      ['Kinich Emilie Burning', 'META', ['Kinich', 'Emilie', 'Mavuika', 'Bennett'], 'Sub-DPS Burning Emilie + Cinder City Mavuika.'],
    ],
  },
  chasca: {
    role: 'Rainbow Charged Attack DPS',
    talent: 'Skill > Burst (Normal skip)',
    set: '4pc Obsidian Codex',
    stats: ['ATK%', 'ATK%', 'CRIT DMG'],
    subs: 'CRIT Rate (maks 60% dgn Codex) > CRIT DMG > ATK% > EM',
    weapons: [
      ['Chain Breaker', '4★', 'F2P', 'Craftable Natlan (Gratis)', 'Pasif ATK% & EM aktif penuh karena tim Chasca multi-elemen.'],
      ['Song of Stillness', '4★', 'F2P', 'Craftable Fontaine (Gratis)', 'Bonus DMG besar jika ada healer seperti Bennett.'],
      ['Astral Vulture\'s Crimson Plumage', '5★', 'BIS', 'Signature 5★', 'CRIT DMG + bonus Charged Attack saat memicu Swirl.'],
    ],
    teams: [
      ['Chasca Rainbow F2P', 'F2P', ['Chasca', 'Bennett', 'Ororon', 'Barbara'], '3 elemen berbeda (Pyro/Electro/Hydro) untuk peluru maksimal.'],
      ['Chasca Melt/Vape Meta', 'META', ['Chasca', 'Furina', 'Citlali', 'Bennett'], 'Melt + Vaporize otomatis dari setiap tembakan.'],
    ],
  },
  varesa: {
    role: 'Plunging Electro Main DPS',
    talent: 'Normal Attack > Burst > Skill',
    set: '4pc Long Night\'s Oath',
    alt: '4pc Obsidian Codex',
    stats: ['ATK%', 'Electro DMG', 'CRIT Rate / CRIT DMG'],
    subs: 'CRIT Rate / DMG > ATK% > ER (120–130%)',
    weapons: [
      ['Flowing Purity', '4★', 'F2P', 'Craftable Fontaine (Gratis)', 'ATK% & Elemental DMG tinggi saat ada healer tim.'],
      ['The Widsith', '4★', 'F2P', 'Gacha 4★', 'CRIT DMG + buff ATK/Elemental sangat cocok untuk rotasi singkat.'],
      ['Vivid Notions', '5★', 'BIS', 'Signature 5★', 'ATK + CRIT DMG khusus Plunging Attack.'],
    ],
    teams: [
      ['Varesa Overload F2P', 'F2P', ['Varesa', 'Iansan', 'Chevreuse', 'Xiangling'], 'Iansan & Chevreuse memberi buff ATK + Electro/Pyro shred besar.'],
      ['Varesa Mavuika Overload', 'META', ['Varesa', 'Iansan', 'Chevreuse', 'Mavuika'], 'Tim meta #1 Varesa di TC: rotasi super cepat + burst sub-DPS Mavuika.'],
      ['Varesa Furina Xianyun', 'META', ['Varesa', 'Iansan', 'Xianyun', 'Furina'], 'Alternatif meta Hypercarry Plunge dengan buff Xianyun & Fanfare Furina.'],
    ],
  },
  escoffier: {
    role: 'Cryo/Hydro Shredder / Sub-DPS / Healer',
    talent: 'Skill > Burst (Normal skip)',
    set: '4pc Golden Troupe',
    alt: '4pc Tenacity of the Millelith',
    stats: ['ATK% / ER%', 'Cryo DMG / ATK%', 'CRIT Rate / CRIT DMG'],
    subs: 'ER (150–180%) > CRIT Rate / DMG > ATK%',
    weapons: [
      ['Favonius Lance', '4★', 'F2P', 'Gacha 4★', 'Memenuhi ER Escoffier & seluruh tim Freeze sekaligus.'],
      ['Tamayuratei no Ohanashi', '4★', 'F2P', 'Event 5.4 (Gratis jika punya)', 'ER + ATK% tinggi setelah memakai Skill.'],
      ['Symphonist of Scents', '5★', 'BIS', 'Signature 5★', 'Buff ATK tim setelah healing + CRIT DMG tinggi.'],
    ],
    teams: [
      ['Freeze Budget F2P', 'F2P', ['Kaeya', 'Escoffier', 'Xingqiu', 'Rosaria'], '4 karakter Cryo/Hydro mengaktifkan 55% RES shred penuh.'],
      ['Skirk / Ayaka Freeze Meta', 'META', ['Skirk', 'Escoffier', 'Furina', 'Yelan'], 'Core Freeze terkuat: heal instan untuk Furina + 55% shred.'],
    ],
  },
  skirk: {
    role: 'On-Field Cryo Main DPS',
    talent: 'Normal Attack = Burst > Skill',
    set: '4pc Finale of the Deep Galleries',
    alt: '4pc Marechaussee Hunter (dgn Furina)',
    stats: ['ATK%', 'Cryo DMG', 'CRIT Rate / CRIT DMG'],
    subs: 'CRIT Rate / DMG > ATK%',
    weapons: [
      ['Finale of the Deep', '4★', 'F2P', 'Craftable Fontaine (Gratis)', 'ATK% sangat besar & mudah aktif dengan healer seperti Escoffier/Charlotte.'],
      ['Calamity of Eshu', '4★', 'F2P', 'Event (Gratis jika punya)', 'Kuat jika memakai shielder (Layla/Citlali/Dahlia).'],
      ['Azurelight', '5★', 'BIS', 'Signature 5★', 'ATK & CRIT DMG ekstra saat energi 0.'],
    ],
    teams: [
      ['Skirk Freeze F2P', 'F2P', ['Skirk', 'Xingqiu', 'Rosaria', 'Charlotte'], 'Semua Cryo/Hydro untuk memaksimalkan pasif tim.'],
      ['Skirk Premium Freeze', 'META', ['Skirk', 'Escoffier', 'Furina', 'Shenhe'], 'Sinergi Cryo/Hydro puncak.'],
    ],
  },
  chevreuse: {
    role: 'Overload Buffer / Healer',
    talent: 'Skill > Burst (Normal skip)',
    set: '4pc Noblesse Oblige',
    alt: '4pc Song of Days Past / 2pc+2pc HP%',
    stats: ['HP%', 'HP%', 'HP% / Healing Bonus'],
    subs: 'HP% (target 40.000 HP untuk buff 40% ATK maks) > ER',
    weapons: [
      ['Black Tassel', '3★', 'F2P', 'Gacha 3★ (Mudah R5)', 'Cara termudah mencapai batas 40.000 HP.'],
      ['Dialogues of the Desert Sages', '4★', 'F2P', 'Event 4.5 (Gratis jika punya)', 'HP% + regenerasi energi saat healing.'],
      ['Favonius Lance', '4★', 'ALT', 'Gacha 4★', 'Baterai tim jika HP sudah cukup 40k.'],
    ],
    teams: [
      ['Overload F2P', 'F2P', ['Xiangling', 'Fischl', 'Chevreuse', 'Bennett'], 'Wajib hanya Pyro & Electro agar 40% RES shred aktif.'],
      ['Arlecchino / Clorinde Overload', 'META', ['Arlecchino', 'Fischl', 'Chevreuse', 'Bennett'], 'Buff ATK + 40% RES shred tanpa perlu Kazuha.'],
    ],
  },
  gaming: {
    role: 'Plunging Pyro Main DPS',
    talent: 'Skill > Burst > Normal',
    set: '4pc Crimson Witch of Flames',
    alt: '4pc Marechaussee Hunter',
    stats: ['EM / ATK%', 'Pyro DMG', 'CRIT Rate / CRIT DMG'],
    subs: 'CRIT Rate / DMG > EM (200+) > ER (130%) > ATK%',
    weapons: [
      ['Tidal Shadow', '4★', 'F2P', 'Craftable Fontaine (Gratis)', 'ATK% besar yang aktif otomatis karena Gaming drain & heal HP.'],
      ['Rainslasher', '4★', 'F2P', 'Gacha 4★', 'Sangat kuat untuk tim Vaporize bersama Xingqiu/Furina.'],
      ['Fruitful Hook / Thousand Blazing Suns', '5★', 'BIS', 'Gacha Limited', 'CRIT Rate Plunge tertinggi untuk konsistensi damage.'],
    ],
    teams: [
      ['Gaming Vape F2P', 'F2P', ['Gaming', 'Xingqiu', 'Sucrose', 'Bennett'], 'Tim 4★ penuh dengan damage Plunge sangat tinggi.'],
      ['Gaming Melt Premium', 'META', ['Gaming', 'Citlali', 'Xianyun', 'Bennett'], 'Forward Melt Plunge yang menyaingi DPS 5★.'],
    ],
  },
  iansan: {
    role: 'ATK Buffer / Scroll Holder',
    talent: 'Burst > Skill (Normal skip)',
    set: '4pc Scroll of the Hero of Cinder City',
    alt: '4pc Noblesse Oblige',
    stats: ['ATK% / ER%', 'ATK%', 'ATK%'],
    subs: 'ER (170–200%) > ATK% (maksimalkan buff ATK)',
    weapons: [
      ['Tamayuratei no Ohanashi', '4★', 'F2P', 'Event 5.4 (Gratis)', 'ER + ATK% tinggi setelah Skill, sangat pas untuk Iansan.'],
      ['Favonius Lance', '4★', 'F2P', 'Gacha 4★', 'Base ATK 565 + energi tim sangat nyaman.'],
      ['Calamity Queller', '5★', 'BIS', '5★ Limited', 'Base ATK tertinggi (741) untuk batas buff maksimal.'],
    ],
    teams: [
      ['Varesa / Gaming Overload', 'F2P', ['Varesa', 'Iansan', 'Chevreuse', 'Xiangling'], 'Cocok untuk DPS yang banyak bergerak/Plunge agar Nightsoul penuh.'],
      ['Mavuika / Kinich Hypercarry', 'META', ['Kinich', 'Iansan', 'Mavuika', 'Bennett'], 'Double ATK buffer + Cinder City.'],
    ],
  },
  ororon: {
    role: 'Off-Field Electro Sub-DPS / Buffer',
    talent: 'Burst > Skill (Normal skip)',
    set: '4pc Scroll of the Hero of Cinder City',
    stats: ['ATK% / ER%', 'Electro DMG', 'CRIT Rate / CRIT DMG'],
    subs: 'ER (140–160%) > CRIT Rate / DMG > ATK%',
    weapons: [
      ['Chain Breaker', '4★', 'F2P', 'Craftable Natlan (Gratis)', 'ATK% + EM gratis untuk Electro-Charged/Overload.'],
      ['Favonius Warbow', '4★', 'F2P', 'Quest Mondstadt (Gratis)', 'Baterai energi tim tanpa repot substat ER.'],
      ['Elegy for the End', '5★', 'BIS', '5★ Limited', 'Buff EM + ATK untuk seluruh party.'],
    ],
    teams: [
      ['Taser F2P', 'F2P', ['Sucrose', 'Xingqiu', 'Ororon', 'Fischl'], 'Memicu pasif Nightsoul terus-menerus di Electro-Charged.'],
      ['Chasca / Mavuika Natlan', 'META', ['Chasca', 'Furina', 'Ororon', 'Bennett'], 'Pemegang Cinder City murah + baterai Fighting Spirit.'],
    ],
  },
  ganyu: {
    role: 'Charged Shot / Burst Cryo DPS',
    talent: 'Normal Attack > Burst > Skill',
    set: '4pc Wanderer\'s Troupe (Melt)',
    alt: '4pc Blizzard Strayer (Freeze)',
    stats: ['ATK% / EM', 'Cryo DMG', 'CRIT DMG / CRIT Rate'],
    subs: 'CRIT Rate / DMG > ATK% > EM (Melt)',
    weapons: [
      ['Hamayumi', '4★', 'F2P', 'Craftable Inazuma (Gratis)', 'F2P terbaik untuk Ganyu Melt (tidak pakai Burst).'],
      ['Prototype Crescent', '4★', 'F2P', 'Craftable Blacksmith (Gratis)', 'Kuat untuk Freeze jika musuh punya titik lemah.'],
      ['The First Great Magic / Hunter\'s Path', '5★', 'BIS', '5★ Limited', 'Scaling tertinggi untuk Freeze atau Melt.'],
    ],
    teams: [
      ['Ganyu Melt F2P', 'F2P', ['Ganyu', 'Xiangling', 'Bennett', 'Layla'], 'Perisai Layla melindungi Charged Shot tanpa terputus.'],
      ['Ganyu Burnmelt', 'META', ['Ganyu', 'Emilie', 'Mavuika', 'Bennett'], 'Meta Burnmelt modern: aura Burning stabil + damage off-field Emilie & Mavuika.'],
      ['Ganyu Escoffier Freeze', 'META', ['Ganyu', 'Escoffier', 'Furina', 'Shenhe'], 'Varian meta Freeze modern melawan musuh AoE.'],
    ],
  },
  xiao: {
    role: 'Plunging Anemo Hypercarry',
    talent: 'Normal Attack > Burst > Skill',
    set: '4pc Vermillion Hereafter',
    alt: '4pc Long Night\'s Oath / 4pc Marechaussee Hunter',
    stats: ['ATK%', 'Anemo DMG', 'CRIT Rate / CRIT DMG'],
    subs: 'ER (120–135%) > CRIT Rate / DMG > ATK%',
    weapons: [
      ['Blackcliff Pole', '4★', 'F2P', 'Starglitter Shop', 'Opsi CRIT DMG paling mudah didapat tanpa gacha senjata.'],
      ['Favonius Lance', '4★', 'F2P', 'Gacha 4★', 'Alternatif jika energi tim belum mencukupi.'],
      ['Primordial Jade Winged-Spear', '5★', 'BIS', 'Signature 5★', 'CRIT Rate + Base ATK 674 sangat pas untuk Xiao.'],
    ],
    teams: [
      ['Xiao F2P', 'F2P', ['Xiao', 'Faruzan', 'Sucrose', 'Bennett'], 'Sucrose baterai + Faruzan shred Anemo.'],
      ['FFXX Premium', 'META', ['Xiao', 'Faruzan', 'Furina', 'Xianyun'], 'Tim terkuat Xiao dengan buff Plunge + Fanfare.'],
    ],
  },
  wanderer: {
    role: 'On-Field Anemo DPS',
    talent: 'Normal Attack > Skill > Burst',
    set: '4pc Desert Pavilion Chronicle',
    alt: '4pc Shimenawa\'s Reminiscence',
    stats: ['ATK%', 'Anemo DMG', 'CRIT Rate / CRIT DMG'],
    subs: 'CRIT Rate / DMG > ATK%',
    weapons: [
      ['The Widsith', '4★', 'F2P', 'Gacha 4★', 'CRIT DMG besar + buff ATK/Anemo DMG.'],
      ['Flowing Purity', '4★', 'F2P', 'Craftable Fontaine (Gratis)', 'Opsi craftable konsisten bersama Bennett.'],
      ['Tulaytullah\'s Remembrance', '5★', 'BIS', 'Signature 5★', 'Attack Speed + Normal Attack DMG tertinggi.'],
    ],
    teams: [
      ['Wanderer Hypercarry F2P', 'F2P', ['Wanderer', 'Faruzan', 'Layla', 'Bennett'], 'Layla memberi perisai + bonus +20% CRIT Rate Cryo absorption.'],
      ['Wanderer Furina', 'META', ['Wanderer', 'Faruzan', 'Furina', 'Bennett'], 'DPS tertinggi bila nyaman dodge di udara.'],
    ],
  },
  wriothesley: {
    role: 'On-Field Cryo Catalyst DPS',
    talent: 'Normal Attack > Skill > Burst',
    set: '4pc Marechaussee Hunter',
    stats: ['ATK% / EM', 'Cryo DMG', 'CRIT DMG'],
    subs: 'CRIT Rate (maks 64% dgn MH) > CRIT DMG > ATK% > EM (Melt)',
    weapons: [
      ['Flowing Purity', '4★', 'F2P', 'Craftable Fontaine (Gratis)', 'Sinergi bagus dengan heal mandiri + healer tim.'],
      ['The Widsith', '4★', 'F2P', 'Gacha 4★', 'CRIT DMG + buff EM/ATK tinggi untuk Reverse Melt.'],
      ['Cashflow Supervision', '5★', 'BIS', 'Signature 5★', 'Attack Speed + Normal/Charged DMG otomatis dari drain HP.'],
    ],
    teams: [
      ['Wriothesley Melt F2P', 'F2P', ['Wriothesley', 'Xiangling', 'Bennett', 'Sucrose'], 'Reverse Melt klasik dengan semua pendukung 4★.'],
      ['Wriothesley Escoffier Freeze', 'META', ['Wriothesley', 'Escoffier', 'Furina', 'Shenhe'], 'Tim meta Freeze modern dengan 55% RES shred Cryo/Hydro.'],
      ['Wriothesley Burnmelt', 'META', ['Wriothesley', 'Emilie', 'Mavuika', 'Bennett'], 'Alternatif meta Reverse Melt dengan ceiling single-target tinggi.'],
    ],
  },
  lyney: {
    role: 'Mono Pyro Charged Bow DPS',
    talent: 'Normal Attack > Burst = Skill',
    set: '4pc Marechaussee Hunter',
    stats: ['ATK%', 'Pyro DMG', 'CRIT DMG'],
    subs: 'CRIT Rate (maks 64% dgn MH) > CRIT DMG > ATK%',
    weapons: [
      ['Song of Stillness', '4★', 'F2P', 'Craftable Fontaine (Gratis)', 'F2P terbaik Lyney: aktif instan tiap kali di-heal Bennett.'],
      ['Prototype Crescent', '4★', 'F2P', 'Craftable Blacksmith (Gratis)', 'Opsi awal sebelum Fontaine.'],
      ['The First Great Magic', '5★', 'BIS', 'Signature 5★', 'Bonus ATK besar di tim Mono Pyro.'],
    ],
    teams: [
      ['Lyney Mono Pyro F2P', 'F2P', ['Lyney', 'Xiangling', 'Bennett', 'Lynette'], '3 Pyro mengaktifkan pasif +100% DMG pada musuh ber-Pyro.'],
      ['Lyney Kazuha/Xilonen', 'META', ['Lyney', 'Bennett', 'Xilonen', 'Zhongli'], 'Shred tinggi + perisai agar Charged Shot tidak terganggu.'],
    ],
  },
  'arataki-itto': {
    role: 'Mono Geo Burst DPS',
    talent: 'Normal Attack > Burst > Skill',
    set: '4pc Husk of Opulent Dreams',
    stats: ['DEF%', 'Geo DMG', 'CRIT Rate / CRIT DMG'],
    subs: 'ER (130%) > CRIT Rate / DMG > DEF%',
    weapons: [
      ['Whiteblind', '4★', 'F2P', 'Craftable Blacksmith (Gratis)', 'Senjata F2P terbaik Itto: tumpukan DEF% sangat besar.'],
      ['Serpent Spine', '4★', 'ALT', 'Battle Pass', 'CRIT Rate + DMG Bonus tinggi.'],
      ['Redhorn Stonethresher', '5★', 'BIS', 'Signature 5★', '88% CRIT DMG + scaling DEF ke Normal/Charged Attack.'],
    ],
    teams: [
      ['Itto Triple Geo F2P', 'F2P', ['Arataki Itto', 'Gorou', 'Kachina', 'Kuki Shinobu'], 'Gorou wajib untuk buff DEF & Geo DMG.'],
      ['Itto Mono Geo', 'META', ['Arataki Itto', 'Gorou', 'Chiori', 'Zhongli'], 'Meta klasik Mono Geo: 2 boneka Chiori + shred Zhongli + buff C6 Gorou.'],
      ['Itto Double Geo Furina', 'META', ['Arataki Itto', 'Xilonen', 'Furina', 'Yelan'], 'Varian meta Double Geo agar shred Xilonen C0 tetap aktif penuh.'],
    ],
  },
  'kamisato-ayato': {
    role: 'On-Field Hydro Driver / DPS',
    talent: 'Skill > Burst (Normal skip)',
    set: '4pc Heart of Depth',
    alt: '4pc Gladiator\'s Finale',
    stats: ['ATK%', 'Hydro DMG', 'CRIT Rate / CRIT DMG'],
    subs: 'CRIT Rate / DMG > ATK% > ER (130%)',
    weapons: [
      ['Finale of the Deep', '4★', 'F2P', 'Craftable Fontaine (Gratis)', 'ATK% besar bila ada healer di tim.'],
      ['Amenoma Kageuchi', '4★', 'F2P', 'Craftable Inazuma (Gratis)', 'Mempermudah ER untuk Burst tiap rotasi.'],
      ['Haran Geppaku Futsu', '5★', 'BIS', 'Signature 5★', 'CRIT Rate + 40% Normal Attack DMG.'],
    ],
    teams: [
      ['Ayato Hyperbloom F2P', 'F2P', ['Kamisato Ayato', 'Kuki Shinobu', 'Collei', 'Sucrose'], 'Driver Hydro AoE paling santai.'],
      ['Ayato Soup / Hyperbloom', 'META', ['Kamisato Ayato', 'Nahida', 'Kuki Shinobu', 'Fischl'], 'AoE konstan & aman.'],
    ],
  },
  tartaglia: {
    role: 'Hydro Enabler / Burst DPS',
    talent: 'Skill = Burst > Normal',
    set: '4pc Nymph\'s Dream',
    alt: '2pc Hydro DMG + 2pc ATK%',
    stats: ['ATK%', 'Hydro DMG', 'CRIT Rate / CRIT DMG'],
    subs: 'CRIT Rate / DMG > ATK% > EM > ER (125%)',
    weapons: [
      ['Song of Stillness', '4★', 'F2P', 'Craftable Fontaine (Gratis)', 'Bonus DMG besar saat di-heal Bennett.'],
      ['The Stringless', '4★', 'F2P', 'Gacha 4★', 'Kuat untuk Vaporize Burst nuke.'],
      ['Polar Star', '5★', 'BIS', 'Signature 5★', 'CRIT Rate + stack ATK sesuai combo Childe.'],
    ],
    teams: [
      ['Childe National F2P', 'F2P', ['Tartaglia', 'Xiangling', 'Sucrose', 'Bennett'], 'Versi F2P dari tim International.'],
      ['International', 'META', ['Tartaglia', 'Xiangling', 'Kaedehara Kazuha', 'Bennett'], 'Salah satu tim AoE paling ikonik di Genshin.'],
    ],
  },
  keqing: {
    role: 'Quickswap Aggravate DPS',
    talent: 'Normal Attack = Burst = Skill',
    set: '4pc Thundering Fury',
    stats: ['ATK% / EM', 'Electro DMG', 'CRIT Rate / CRIT DMG'],
    subs: 'CRIT Rate / DMG > ATK% = EM',
    weapons: [
      ['Iron Sting', '4★', 'F2P', 'Craftable Blacksmith (Gratis)', 'EM tinggi untuk reaksi Aggravate.'],
      ['Lion\'s Roar', '4★', 'F2P', 'Gacha 4★', 'Sangat kuat karena musuh selalu terkena aura Electro.'],
      ['Mistsplitter Reforged', '5★', 'BIS', '5★ Limited', 'CRIT DMG & Electro DMG Bonus maksimal.'],
    ],
    teams: [
      ['Keqing Aggravate F2P', 'F2P', ['Keqing', 'Fischl', 'Collei', 'Yaoyao'], 'Rotasi cepat & energi selalu penuh.'],
      ['Keqing Aggravate Meta', 'META', ['Keqing', 'Fischl', 'Nahida', 'Kaedehara Kazuha'], 'Double Electro + Swirl VV.'],
    ],
  },
  tighnari: {
    role: 'Quickswap Spread DPS',
    talent: 'Normal Attack > Burst > Skill',
    set: '4pc Wanderer\'s Troupe',
    alt: '4pc Gilded Dreams',
    stats: ['EM', 'Dendro DMG', 'CRIT Rate / CRIT DMG'],
    subs: 'CRIT Rate / DMG > EM (300+) > ATK%',
    weapons: [
      ['Slingshot', '3★', 'F2P', 'Gacha 3★ (Mudah R5)', 'Senjata 3★ luar biasa: 31% CRIT Rate + 60% Charged Shot DMG!'],
      ['Song of Stillness', '4★', 'F2P', 'Craftable Fontaine (Gratis)', 'Alternatif jika bermain dari jarak jauh dengan healer.'],
      ['Hunter\'s Path', '5★', 'BIS', 'Signature 5★', 'Konversi EM ke Charged Attack DMG + 44% CRIT Rate.'],
    ],
    teams: [
      ['Tighnari Spread F2P', 'F2P', ['Tighnari', 'Fischl', 'Lisa', 'Yaoyao'], 'Quickswap singkat 12 detik, sangat mudah dimainkan.'],
      ['Tighnari Yae Spread', 'META', ['Tighnari', 'Yae Miko', 'Nahida', 'Zhongli'], 'Sinergi rotasi 12 detik terbaik.'],
    ],
  },
  'yae-miko': {
    role: 'Off-Field Electro Sub-DPS',
    talent: 'Skill > Burst (Normal skip)',
    set: '4pc Golden Troupe',
    alt: '4pc Gilded Dreams',
    stats: ['ATK% / EM', 'Electro DMG', 'CRIT Rate / CRIT DMG'],
    subs: 'CRIT Rate / DMG > ATK% > EM',
    weapons: [
      ['The Widsith', '4★', 'F2P', 'Gacha 4★', 'Ketiga buff Widsith (ATK/EM/Elemental) semuanya berguna untuk Yae.'],
      ['Flowing Purity', '4★', 'F2P', 'Craftable Fontaine (Gratis)', 'Opsi craftable stabil tanpa RNG.'],
      ['Kagura\'s Verity', '5★', 'BIS', 'Signature 5★', 'Stack 3x Skill DMG penuh secara instan.'],
    ],
    teams: [
      ['Yae Aggravate F2P', 'F2P', ['Yae Miko', 'Fischl', 'Sucrose', 'Yaoyao'], 'Totem off-field terus memicu Aggravate.'],
      ['Tighnari Yae Spread', 'META', ['Tighnari', 'Yae Miko', 'Nahida', 'Zhongli'], 'Duo Quickswap Dendro/Electro.'],
    ],
  },
  nilou: {
    role: 'Bountiful Core Bloom Enabler',
    talent: 'Tidak wajib dinaikkan (prioritas Level 90)',
    set: '2pc Tenacity + 2pc Vourukasha\'s Glow',
    stats: ['HP%', 'HP%', 'HP%'],
    subs: 'HP% (target 74.444 HP) > Flat HP > EM',
    weapons: [
      ['Iron Sting', '4★', 'F2P', 'Craftable Blacksmith (Gratis)', 'EM ekstra untuk Bloom saat belum ada pedang HP%.'],
      ['The Dockhand\'s Assistant', '4★', 'ALT', 'Gacha 4★ Limited', 'Satu-satunya pedang 4★ dengan stat HP%.'],
      ['Key of Khaj-Nisut', '5★', 'BIS', 'Signature 5★', 'HP% raksasa + buff EM tim.'],
    ],
    teams: [
      ['Nilou Bloom F2P', 'F2P', ['Nilou', 'Barbara', 'Collei', 'Yaoyao'], 'Wajib hanya Hydro & Dendro; AoE meledak instan.'],
      ['Nilou Nahida Bloom', 'META', ['Nilou', 'Nahida', 'Sangonomiya Kokomi', 'Collei'], 'Tim AoE tercepat di game.'],
    ],
  },
  'sangonomiya-kokomi': {
    role: 'Healer / Hydro Enabler',
    talent: 'Skill = Burst > Normal',
    set: '4pc Ocean-Hued Clam',
    alt: '4pc Tenacity of the Millelith (Support)',
    stats: ['HP% / ER%', 'HP% / Hydro DMG', 'Healing Bonus'],
    subs: 'ER (160–180%) > HP% > EM (Bloom)',
    weapons: [
      ['Thrilling Tales of Dragon Slayers', '3★', 'F2P', 'Gacha 3★ (Mudah R5)', 'HP% + buff +48% ATK ke Main DPS (terbaik untuk Freeze/Support).'],
      ['Prototype Amber', '4★', 'F2P', 'Craftable Blacksmith (Gratis)', 'HP% + energi untuk build On-Field Driver.'],
      ['Everlasting Moonglow', '5★', 'BIS', 'Signature 5★', 'Khusus build On-Field DPS Kokomi.'],
    ],
    teams: [
      ['Kokomi Taser F2P', 'F2P', ['Sangonomiya Kokomi', 'Fischl', 'Beidou', 'Sucrose'], 'Driver tanky yang mustahil mati.'],
      ['Nilou Bloom', 'META', ['Nilou', 'Nahida', 'Sangonomiya Kokomi', 'Collei'], 'Full EM + Healing Bonus untuk Bloom super kuat.'],
    ],
  },
  xianyun: {
    role: 'Plunge Buffer / Team Healer',
    talent: 'Burst > Skill (Normal skip)',
    set: '4pc Viridescent Venerer',
    alt: '4pc Song of Days Past',
    stats: ['ER% / ATK%', 'ATK%', 'ATK%'],
    subs: 'ER (170–210%) > ATK% (maksimalkan buff Plunge)',
    weapons: [
      ['Oathsworn Eye', '4★', 'F2P', 'Event (Gratis jika punya)', 'ATK% + 48% ER setelah Skill, luar biasa untuk Xianyun.'],
      ['Flowing Purity', '4★', 'F2P', 'Craftable Fontaine (Gratis)', 'Base ATK 565 + ATK% tinggi (butuh ER dari Sands/substat).'],
      ['Crane\'s Echoing Call', '5★', 'BIS', 'Signature 5★', 'Base ATK 741 + bonus Plunge DMG tim + regenerasi energi.'],
    ],
    teams: [
      ['Gaming Plunge F2P', 'F2P', ['Gaming', 'Xingqiu', 'Xianyun', 'Bennett'], 'Mengubah karakter apapun jadi Plunge DPS.'],
      ['Hu Tao / Xiao Plunge Meta', 'META', ['Xiao', 'Faruzan', 'Furina', 'Xianyun'], 'Heal seluruh tim untuk Furina + buff Plunge masif.'],
    ],
  },
  shenhe: {
    role: 'Cryo Dedicated Buffer',
    talent: 'Skill > Burst (Normal skip)',
    set: '2pc ATK% + 2pc ATK%',
    alt: '4pc Noblesse Oblige',
    stats: ['ATK% / ER%', 'ATK%', 'ATK%'],
    subs: 'ER (170–190%) > ATK%',
    weapons: [
      ['Favonius Lance', '4★', 'F2P', 'Gacha 4★', 'Base ATK 565 + solusi energi terbaik untuk tim Cryo.'],
      ['Missive Windspear', '4★', 'F2P', 'Event (Gratis jika punya)', 'Stat ATK% tinggi untuk Icy Quill.'],
      ['Calamity Queller', '5★', 'BIS', 'Signature 5★', 'Base ATK 741 + tumpukan ATK% off-field.'],
    ],
    teams: [
      ['Shenhe Freeze F2P', 'F2P', ['Kaeya', 'Rosaria', 'Shenhe', 'Xingqiu'], 'Setiap Cryo memakai kuota Icy Quill masing-masing.'],
      ['Ayaka / Skirk Freeze', 'META', ['Kamisato Ayaka', 'Shenhe', 'Escoffier', 'Furina'], 'Buff Cryo maksimal.'],
    ],
  },
  emilie: {
    role: 'Off-Field Burning Sub-DPS',
    talent: 'Skill > Burst (Normal skip)',
    set: '4pc Unfinished Reverie',
    alt: '4pc Deepwood Memories',
    stats: ['ATK%', 'Dendro DMG', 'CRIT Rate / CRIT DMG'],
    subs: 'CRIT Rate / DMG > ATK% (target 2400 ATK) > ER',
    weapons: [
      ['Missive Windspear', '4★', 'F2P', 'Event (Gratis)', 'ATK% tinggi mendekati target 2400 ATK.'],
      ['Favonius Lance', '4★', 'F2P', 'Gacha 4★', 'Baterai tim yang mudah didapat.'],
      ['Lumidouce Elegy', '5★', 'BIS', 'Signature 5★', 'CRIT Rate + bonus DMG & energi saat Burning.'],
    ],
    teams: [
      ['Emilie Burn F2P', 'F2P', ['Xiangling', 'Bennett', 'Emilie', 'Kaeya'], 'Memicu Reverse Melt + damage off-field Emilie.'],
      ['Kinich Burning', 'META', ['Kinich', 'Emilie', 'Mavuika', 'Bennett'], 'Partner terbaik Kinich.'],
    ],
  },
  'lan-yan': {
    role: 'Anemo Shielder / VV Buffer',
    talent: 'Skill > Burst (Normal skip)',
    set: '4pc Viridescent Venerer',
    stats: ['ATK%', 'ATK%', 'ATK%'],
    subs: 'ATK% (perisai scale dari ATK) > ER',
    weapons: [
      ['Thrilling Tales of Dragon Slayers', '3★', 'F2P', 'Gacha 3★ (Mudah R5)', 'Shred VV + Perisai + +48% ATK sekaligus!'],
      ['Flowing Purity', '4★', 'F2P', 'Craftable Fontaine (Gratis)', 'ATK% tinggi untuk perisai super tebal.'],
      ['Memory of Dust', '5★', 'BIS', '5★ Limited', 'ATK% & Shield Strength tertinggi.'],
    ],
    teams: [
      ['Arlecchino Shield F2P', 'F2P', ['Arlecchino', 'Xingqiu', 'Lan Yan', 'Bennett'], 'Pengganti Kazuha + Zhongli dalam satu slot!'],
      ['Clorinde Aggravate', 'META', ['Clorinde', 'Fischl', 'Nahida', 'Lan Yan'], 'Mengaktifkan Calamity of Eshu + shred VV.'],
    ],
  },
  diluc: {
    role: 'On-Field Pyro DPS',
    talent: 'Normal Attack = Skill > Burst',
    set: '4pc Crimson Witch of Flames',
    stats: ['EM / ATK%', 'Pyro DMG', 'CRIT Rate / CRIT DMG'],
    subs: 'CRIT Rate / DMG > EM > ATK%',
    weapons: [
      ['Tidal Shadow', '4★', 'F2P', 'Craftable Fontaine (Gratis)', 'ATK% besar dengan Bennett/Xianyun.'],
      ['Rainslasher', '4★', 'F2P', 'Gacha 4★', 'Sangat kuat di tim Vaporize.'],
      ['Beacon of the Reed Sea / Redhorn', '5★', 'BIS', '5★ Limited', 'CRIT tinggi untuk Vaporize Plunge.'],
    ],
    teams: [
      ['Diluc Vape F2P', 'F2P', ['Diluc', 'Xingqiu', 'Sucrose', 'Bennett'], 'Tim klasik ramah pemula.'],
      ['Diluc Plunge Meta', 'META', ['Diluc', 'Xianyun', 'Furina', 'Bennett'], 'Multiplier Plunge Diluc tertinggi di game.'],
    ],
  },
  eula: {
    role: 'Physical Burst DPS',
    talent: 'Burst > Normal Attack > Skill',
    set: '4pc Pale Flame',
    stats: ['ATK%', 'Physical DMG', 'CRIT Rate / CRIT DMG'],
    subs: 'ER (130–145%) > CRIT Rate / DMG > ATK%',
    weapons: [
      ['Tidal Shadow', '4★', 'F2P', 'Craftable Fontaine (Gratis)', 'Mengungguli Snow-Tombed jika ada healer.'],
      ['Snow-Tombed Starsilver', '4★', 'F2P', 'Quest Dragonspine (Gratis)', 'Gratis dari eksplorasi + stat Physical DMG.'],
      ['Beacon of the Reed Sea / Song of Broken Pines', '5★', 'BIS', '5★ Limited', 'CRIT/ATK tertinggi.'],
    ],
    teams: [
      ['Eula Superconduct F2P', 'F2P', ['Eula', 'Fischl', 'Rosaria', 'Diona'], 'Superconduct (-40% Phys RES) + baterai Cryo.'],
      ['Eula Raiden Furina', 'META', ['Eula', 'Raiden Shogun', 'Furina', 'Mika'], 'Energi mulus + Attack Speed & Physical DMG.'],
    ],
  },
  yoimiya: {
    role: 'Single-Target Pyro Bow DPS',
    talent: 'Normal Attack > Skill > Burst',
    set: '4pc Shimenawa\'s Reminiscence',
    alt: '4pc Crimson Witch of Flames',
    stats: ['ATK% / EM', 'Pyro DMG', 'CRIT Rate / CRIT DMG'],
    subs: 'CRIT Rate / DMG > ATK% > EM',
    weapons: [
      ['Slingshot', '3★', 'F2P', 'Gacha 3★ (Mudah R5)', 'Mengalahkan banyak busur 4★ bila dipakai bersama Bennett/Yun Jin!'],
      ['Rust', '4★', 'F2P', 'Gacha 4★', 'Di R5 menyaingi senjata 5★ untuk Normal Attack.'],
      ['Thundering Pulse', '5★', 'BIS', 'Signature 5★', 'CRIT DMG + Normal Attack DMG tertinggi.'],
    ],
    teams: [
      ['Yoimiya Vape F2P', 'F2P', ['Yoimiya', 'Xingqiu', 'Yun Jin', 'Layla'], 'Perisai penting agar combo tembakan ke-5 tidak terputus.'],
      ['Yoimiya Double Hydro', 'META', ['Yoimiya', 'Yelan', 'Xingqiu', 'Zhongli'], 'Single-target boss killer yang sangat nyaman.'],
    ],
  },
  baizhu: {
    role: 'Team Healer / Dendro Shielder',
    talent: 'Burst = Skill (Normal skip)',
    set: '4pc Deepwood Memories',
    alt: '4pc Ocean-Hued Clam / 4pc Song of Days Past',
    stats: ['ER% / HP%', 'HP%', 'HP%'],
    subs: 'ER (170–210%) > HP% (target 50.000 HP)',
    weapons: [
      ['Prototype Amber', '4★', 'F2P', 'Craftable Blacksmith (Gratis)', 'HP% + regenerasi energi + heal tim ekstra, F2P terbaik Baizhu!'],
      ['Thrilling Tales of Dragon Slayers', '3★', 'F2P', 'Gacha 3★', 'HP% + buff ATK untuk DPS scaling ATK.'],
      ['Jadefall\'s Splendor', '5★', 'BIS', 'Signature 5★', 'HP% + energi pasif terbaik.'],
    ],
    teams: [
      ['Baizhu Hyperbloom F2P', 'F2P', ['Baizhu', 'Xingqiu', 'Kuki Shinobu', 'Fischl'], 'Anti-interupsi & heal tim yang sangat aman.'],
      ['Neuvillette / Cyno Furina', 'META', ['Cyno', 'Furina', 'Nahida', 'Baizhu'], 'Heal tim instan mengisi Fanfare Furina penuh.'],
    ],
  },
  cyno: {
    role: 'On-Field Quickbloom Electro DPS',
    talent: 'Burst > Skill (Normal skip)',
    set: '4pc Thundering Fury',
    alt: '4pc Gilded Dreams',
    stats: ['EM', 'Electro DMG', 'CRIT Rate / CRIT DMG'],
    subs: 'ER (130–140%) > CRIT Rate / DMG > EM > ATK%',
    weapons: [
      ['White Tassel', '3★', 'F2P', 'Chest Liyue (Gratis R5)', 'CRIT Rate + Normal Attack DMG sangat efektif untuk Cyno.'],
      ['Kitain Cross Spear', '4★', 'F2P', 'Craftable Inazuma (Gratis)', 'EM + bantu energi Burst.'],
      ['Staff of the Scarlet Sands', '5★', 'BIS', 'Signature 5★', 'Konversi EM ke ATK terbesar.'],
    ],
    teams: [
      ['Cyno Quickbloom F2P', 'F2P', ['Cyno', 'Xingqiu', 'Yaoyao', 'Fischl'], 'Fischl membantu baterai energi Cyno.'],
      ['Cyno Premium Quickbloom', 'META', ['Cyno', 'Furina', 'Nahida', 'Baizhu'], 'Semua buff bertahan sepanjang durasi Burst Cyno.'],
    ],
  },
  faruzan: {
    role: 'Anemo Dedicated Buffer',
    talent: 'Burst > Skill (Normal skip)',
    set: '4pc Tenacity of the Millelith (C6)',
    alt: '4pc Noblesse Oblige / 2pc Emblem',
    stats: ['ER%', 'Anemo DMG / ATK%', 'CRIT Rate (Favonius)'],
    subs: 'ER (260–300% sebelum C6; 200% di C6) > CRIT Rate',
    weapons: [
      ['Favonius Warbow', '4★', 'F2P', 'Quest Mondstadt (Gratis)', 'Wajib untuk memenuhi ER raksasa Faruzan & tim Anemo.'],
      ['End of the Line', '4★', 'F2P', 'Fishing Sumeru (Gratis)', 'Alternatif ER jika Favonius dipakai karakter lain.'],
      ['Elegy for the End', '5★', 'BIS', '5★ Limited', 'ER + buff ATK tim (terutama di C6).'],
    ],
    teams: [
      ['Anemo Hypercarry F2P', 'F2P', ['Shikanoin Heizou', 'Faruzan', 'Bennett', 'Layla'], 'Shred Anemo + buff Anemo DMG terbesar.'],
      ['Xiao / Wanderer Meta', 'META', ['Xiao', 'Faruzan', 'Furina', 'Xianyun'], 'Partner wajib setiap DPS Anemo.'],
    ],
  },
  yaoyao: {
    role: 'Dendro Healer / Enabler',
    talent: 'Skill > Burst (Normal skip)',
    set: '4pc Deepwood Memories',
    alt: '4pc Tenacity of the Millelith',
    stats: ['HP% / ER%', 'HP%', 'Healing Bonus / HP%'],
    subs: 'HP% > ER (150–170%)',
    weapons: [
      ['Black Tassel', '3★', 'F2P', 'Gacha 3★', 'HP% besar untuk heal lebih deras.'],
      ['Favonius Lance', '4★', 'F2P', 'Gacha 4★', 'Baterai energi untuk DPS tim.'],
      ['Dialogues of the Desert Sages', '4★', 'ALT', 'Event 4.5', 'HP% + regenerasi energi.'],
    ],
    teams: [
      ['Aggravate F2P', 'F2P', ['Keqing', 'Fischl', 'Sucrose', 'Yaoyao'], 'Healer + pemegang Deepwood yang murah dibangun.'],
      ['Nilou Bloom', 'META', ['Nilou', 'Yaoyao', 'Xingqiu', 'Nahida'], 'Menjaga HP tim tetap aman dari self-damage Bloom.'],
    ],
  },
  kachina: {
    role: 'Off-Field Cinder City Buffer',
    talent: 'Skill > Burst (Normal skip)',
    set: '4pc Scroll of the Hero of Cinder City',
    stats: ['DEF%', 'Geo DMG', 'CRIT Rate / DEF%'],
    subs: 'DEF% > CRIT Rate (Favonius) > ER',
    weapons: [
      ['Footprint of the Rainbow', '4★', 'F2P', 'Craftable Natlan (Gratis)', 'DEF% + bonus Skill DMG, dibuat khusus untuk Kachina.'],
      ['Favonius Lance', '4★', 'F2P', 'Gacha 4★', 'Baterai energi untuk tim Navia/Itto.'],
    ],
    teams: [
      ['Navia Budget F2P', 'F2P', ['Navia', 'Kachina', 'Xiangling', 'Bennett'], 'Versi gratis Xilonen untuk 40% buff Cinder City + Crystallize.'],
      ['Mualani Natlan Budget', 'META', ['Mualani', 'Xiangling', 'Kachina', 'Sucrose'], 'Memicu buff 40% Hydro DMG dengan mudah.'],
    ],
  },
  jean: {
    role: 'Team Healer / VV Shredder',
    talent: 'Burst > Skill (Normal skip)',
    set: '4pc Viridescent Venerer',
    stats: ['ER% / ATK%', 'ATK% / Anemo DMG', 'Healing Bonus / ATK%'],
    subs: 'ER (180–200%) > ATK% > CRIT Rate (Favonius)',
    weapons: [
      ['Amenoma Kageuchi', '4★', 'F2P', 'Craftable Inazuma (Gratis)', 'ATK% untuk heal + energi Burst gratis.'],
      ['Favonius Sword', '4★', 'F2P', 'Quest / Gacha 4★', 'Baterai energi terbaik untuk tim Furina.'],
      ['Freedom-Sworn', '5★', 'BIS', '5★ Limited', 'Buff tambahan untuk tim.'],
    ],
    teams: [
      ['Sunfire Overvape F2P', 'F2P', ['Jean', 'Bennett', 'Xingqiu', 'Fischl'], 'Kombo Burst Jean + Bennett menyebar Pyro terus-menerus.'],
      ['Furina VV Healer', 'META', ['Neuvillette', 'Furina', 'Jean', 'Fischl'], 'Heal instan penuh langsung memaksimalkan Fanfare Furina.'],
    ],
  },
  mona: {
    role: 'Burst Buffer / Hydro Support',
    talent: 'Burst > Skill (Normal skip)',
    set: '4pc Noblesse Oblige',
    alt: '4pc Emblem of Severed Fate',
    stats: ['ER%', 'Hydro DMG / ATK%', 'CRIT Rate / HP%'],
    subs: 'ER (220–260%) > CRIT Rate (Favonius)',
    weapons: [
      ['Thrilling Tales of Dragon Slayers', '3★', 'F2P', 'Gacha 3★ (Mudah R5)', 'Kombinasi Omen + +48% ATK untuk nuke raksasa.'],
      ['Prototype Amber', '4★', 'F2P', 'Craftable Blacksmith (Gratis)', 'Menjadikan Mona semi-healer di tim Freeze.'],
      ['Favonius Codex', '4★', 'ALT', 'Gacha 4★', 'Baterai energi tim.'],
    ],
    teams: [
      ['Freeze Budget F2P', 'F2P', ['Kaeya', 'Rosaria', 'Mona', 'Sucrose'], 'Omen bertahan lama pada musuh yang beku.'],
      ['Nuke Showcase / Freeze', 'META', ['Kamisato Ayaka', 'Mona', 'Kaedehara Kazuha', 'Diona'], 'Buff Omen 60% DMG + TTDS.'],
    ],
  },
  beidou: {
    role: 'Off-Field AoE Electro Sub-DPS',
    talent: 'Burst > Skill (Normal skip)',
    set: '4pc Emblem of Severed Fate',
    stats: ['ER% / ATK%', 'Electro DMG', 'CRIT Rate / CRIT DMG'],
    subs: 'ER (160–180% dgn Fischl) > CRIT Rate / DMG > ATK%',
    weapons: [
      ['Tidal Shadow', '4★', 'F2P', 'Craftable Fontaine (Gratis)', 'ATK% tinggi bila ada healer.'],
      ['Favonius Greatsword', '4★', 'F2P', 'Gacha 4★', 'Selesaikan kebutuhan energi tinggi Beidou.'],
      ['Serpent Spine / Wolf\'s Gravestone', '5★', 'BIS', 'BP / 5★', 'Scaling tertinggi (snapshot buff saat Burst).'],
    ],
    teams: [
      ['Sucrose Taser F2P', 'F2P', ['Sucrose', 'Xingqiu', 'Fischl', 'Beidou'], 'Sangat kuat melawan 2+ musuh + damage reduction.'],
      ['Arlecchino Overload', 'META', ['Arlecchino', 'Beidou', 'Fischl', 'Chevreuse'], 'Perisai anti-interupsi + AoE Electro.'],
    ],
  },
  rosaria: {
    role: 'Cryo Sub-DPS / CRIT Buffer',
    talent: 'Burst > Skill (Normal skip)',
    set: '4pc Emblem of Severed Fate',
    alt: '4pc Noblesse Oblige',
    stats: ['ATK% / EM', 'Cryo DMG', 'CRIT Rate'],
    subs: 'CRIT Rate (share 15% CRIT ke tim) > ER (140%) > CRIT DMG',
    weapons: [
      ['The Catch', '4★', 'F2P', 'Fishing Inazuma (Gratis)', 'Burst DMG + CRIT Rate tinggi.'],
      ['Favonius Lance', '4★', 'F2P', 'Gacha 4★', 'Baterai Cryo terbaik untuk Ayaka/Eula/Skirk.'],
      ['Staff of the Scarlet Sands', '5★', 'BIS', '5★ Limited', 'Terbaik untuk Reverse Melt.'],
    ],
    teams: [
      ['Reverse Melt F2P', 'F2P', ['Rosaria', 'Kaeya', 'Xiangling', 'Bennett'], 'Semua 4★, Burst Rosaria bisa Melt tanpa ICD!'],
      ['Freeze Support', 'META', ['Kamisato Ayaka', 'Rosaria', 'Sangonomiya Kokomi', 'Kaedehara Kazuha'], 'Baterai + buffer CRIT Rate.'],
    ],
  },
  kaeya: {
    role: 'Off-Field Cryo Sub-DPS',
    talent: 'Burst > Skill (Normal skip)',
    set: '4pc Emblem of Severed Fate',
    alt: '4pc Blizzard Strayer (Freeze)',
    stats: ['ATK% / ER%', 'Cryo DMG', 'CRIT Rate / CRIT DMG'],
    subs: 'ER (150–170%) > CRIT Rate / DMG > ATK%',
    weapons: [
      ['Amenoma Kageuchi', '4★', 'F2P', 'Craftable Inazuma (Gratis)', 'ATK% + energi mudah.'],
      ['Favonius Sword', '4★', 'F2P', 'Quest / Gacha 4★', 'Baterai Cryo super handal.'],
      ['Mistsplitter Reforged', '5★', 'BIS', '5★ Limited', 'Damage personal maksimal.'],
    ],
    teams: [
      ['Reverse Melt F2P', 'F2P', ['Kaeya', 'Rosaria', 'Xiangling', 'Bennett'], 'Tim 4★ starter yang masih kuat di Abyss.'],
      ['Freeze Sub-DPS', 'META', ['Kaeya', 'Escoffier', 'Furina', 'Xingqiu'], 'Cryo off-field yang mengikuti karakter aktif.'],
    ],
  },
  layla: {
    role: 'Cryo Shielder',
    talent: 'Skill > Burst (Normal skip)',
    set: '4pc Tenacity of the Millelith',
    stats: ['HP%', 'HP%', 'HP%'],
    subs: 'HP% > ER (140%)',
    weapons: [
      ['Harbinger of Dawn', '3★', 'F2P', 'Gacha 3★', 'Mudah didapat jika ingin sedikit damage bintang.'],
      ['Favonius Sword', '4★', 'F2P', 'Quest / Gacha 4★', 'Baterai tim terbaik untuk shielder.'],
      ['Key of Khaj-Nisut', '5★', 'BIS', '5★ Limited', 'HP% tertinggi membuat perisai setebal Zhongli.'],
    ],
    teams: [
      ['Wanderer / Hu Tao Shield F2P', 'F2P', ['Wanderer', 'Faruzan', 'Layla', 'Bennett'], 'Perisai Cryo tebal + bonus CRIT Rate Anemo.'],
      ['Arlecchino / Skirk Shield', 'META', ['Arlecchino', 'Xingqiu', 'Layla', 'Bennett'], 'Perisai 100% uptime + sesekali Melt.'],
    ],
  },
  diona: {
    role: 'Cryo Shielder / Healer / Battery',
    talent: 'Skill = Burst (Normal skip)',
    set: '4pc Noblesse Oblige',
    alt: '2pc HP% + 2pc ER%',
    stats: ['HP% / ER%', 'HP%', 'HP% / Healing Bonus'],
    subs: 'ER (180–200%) > HP%',
    weapons: [
      ['Favonius Warbow', '4★', 'F2P', 'Quest Mondstadt (Gratis)', 'Baterai energi Cryo luar biasa.'],
      ['Sacrificial Bow', '4★', 'F2P', 'Gacha 4★', 'Reset Hold Skill menghasilkan 10 partikel Cryo.'],
    ],
    teams: [
      ['Freeze Budget F2P', 'F2P', ['Kamisato Ayaka', 'Diona', 'Xingqiu', 'Sucrose'], 'Heal + shield + baterai dalam 1 slot.'],
      ['Melt EM Buffer (C6)', 'META', ['Gaming', 'Diona', 'Bennett', 'Kaedehara Kazuha'], 'C6 memberi +200 EM di dalam area Burst.'],
    ],
  },
  charlotte: {
    role: 'Team Cryo Healer',
    talent: 'Burst > Skill (Normal skip)',
    set: '4pc Noblesse Oblige',
    alt: '2pc ER% + 2pc ATK%',
    stats: ['ER%', 'ATK%', 'Healing Bonus / ATK%'],
    subs: 'ER (200–230%) > ATK%',
    weapons: [
      ['Prototype Amber', '4★', 'F2P', 'Craftable Blacksmith (Gratis)', 'Memangkas kebutuhan ER sekaligus tambah heal.'],
      ['Thrilling Tales of Dragon Slayers', '3★', 'F2P', 'Gacha 3★', 'Buff +48% ATK ke DPS (butuh ER tinggi dari artefak).'],
      ['Favonius Codex', '4★', 'ALT', 'Gacha 4★', 'Baterai energi tim paling nyaman.'],
    ],
    teams: [
      ['Furina Freeze F2P', 'F2P', ['Neuvillette', 'Furina', 'Charlotte', 'Sucrose'], 'Heal tim penuh dalam 1 tombol untuk stack Fanfare.'],
      ['Skirk / Ayaka Furina', 'META', ['Skirk', 'Furina', 'Charlotte', 'Xingqiu'], 'Alternatif F2P jika tidak punya Escoffier.'],
    ],
  },
  thoma: {
    role: 'Burgeon Trigger / Pyro Shielder',
    talent: 'Burst = Skill (Shield) / Level 90 (Burgeon)',
    set: '4pc Flower of Paradise Lost (Burgeon)',
    alt: '4pc Noblesse / 2pc ER + 2pc HP% (Shield)',
    stats: ['EM / ER%', 'EM / HP%', 'EM / HP%'],
    subs: 'ER (180–210%) > EM (Burgeon) atau HP% (Shield)',
    weapons: [
      ['Kitain Cross Spear', '4★', 'F2P', 'Craftable Inazuma (Gratis)', 'F2P terbaik untuk Burgeon: EM + regenerasi energi!'],
      ['Favonius Lance', '4★', 'F2P', 'Gacha 4★', 'Terbaik untuk build Shielder Support.'],
    ],
    teams: [
      ['Thoma Burgeon F2P', 'F2P', ['Thoma', 'Xingqiu', 'Collei', 'Barbara'], 'AoE Burgeon murah & aman berkat perisai.'],
      ['Kinich / Wanderer Shield', 'META', ['Kinich', 'Thoma', 'Emilie', 'Bennett'], 'Deepwood holder + Pyro konsisten + shield.'],
    ],
  },
  kirara: {
    role: 'Dendro Shielder',
    talent: 'Skill > Burst (Normal skip)',
    set: '4pc Deepwood Memories',
    alt: '2pc HP% + 2pc HP% (Shield Maks)',
    stats: ['HP%', 'HP%', 'HP%'],
    subs: 'HP% > ER (140%)',
    weapons: [
      ['Sapwood Blade', '4★', 'F2P', 'Craftable Sumeru (Gratis)', 'Leaf +120 EM untuk DPS Aggravate/Bloom.'],
      ['Favonius Sword', '4★', 'F2P', 'Quest / Gacha 4★', 'Baterai energi tim.'],
      ['Key of Khaj-Nisut', '5★', 'BIS', '5★ Limited', 'HP% tertinggi untuk perisai tertebal.'],
    ],
    teams: [
      ['Aggravate Shield F2P', 'F2P', ['Clorinde', 'Fischl', 'Kirara', 'Sucrose'], 'Perisai Dendro nyaman tanpa mengganggu reaksi Electro.'],
      ['Nilou Bloom', 'META', ['Nilou', 'Nahida', 'Kirara', 'Sangonomiya Kokomi'], 'Lindungi tim dari ledakan Bloom.'],
    ],
  },
  collei: {
    role: 'Off-Field Dendro Enabler',
    talent: 'Burst > Skill (Normal skip)',
    set: '4pc Deepwood Memories',
    alt: '4pc Instructor',
    stats: ['ER%', 'Dendro DMG / ATK%', 'CRIT Rate (Favonius)'],
    subs: 'ER (180–210%) > CRIT Rate > EM',
    weapons: [
      ['Favonius Warbow', '4★', 'F2P', 'Quest Mondstadt (Gratis)', 'Memastikan Burst selalu siap setiap rotasi.'],
      ['Sacrificial Bow', '4★', 'F2P', 'Gacha 4★', 'Double Boomerang = aplikasi Dendro ekstra.'],
      ['Elegy for the End', '5★', 'BIS', '5★ Limited', 'Buff EM + ATK untuk tim Bloom/Hyperbloom.'],
    ],
    teams: [
      ['Hyperbloom Starter F2P', 'F2P', ['Collei', 'Xingqiu', 'Kuki Shinobu', 'Barbara'], 'Gratis dari Spiral Abyss Floor 4!'],
      ['Nilou Bloom', 'META', ['Nilou', 'Nahida', 'Sangonomiya Kokomi', 'Collei'], 'Aplikasi Dendro front-loaded tercepat.'],
    ],
  },
  barbara: {
    role: 'Healer / Bloom Driver',
    talent: 'Skill > Burst (Normal skip)',
    set: '4pc Ocean-Hued Clam',
    alt: '4pc Flower of Paradise Lost (Nilou Bloom)',
    stats: ['HP% (atau EM utk Bloom)', 'HP% / EM', 'Healing Bonus / EM'],
    subs: 'HP% > ER (atau EM untuk Bloom)',
    weapons: [
      ['Thrilling Tales of Dragon Slayers', '3★', 'F2P', 'Gacha 3★ (Mudah R5)', 'HP% + buff +48% ATK gratis.'],
      ['Prototype Amber', '4★', 'F2P', 'Craftable Blacksmith (Gratis)', 'Heal ekstra & energi Burst.'],
    ],
    teams: [
      ['Hyperbloom F2P', 'F2P', ['Barbara', 'Collei', 'Kuki Shinobu', 'Fischl'], 'Driver Hydro gratis untuk pemain baru.'],
      ['Nilou Bloom F2P', 'META', ['Nilou', 'Barbara', 'Collei', 'Nahida'], 'Alternatif F2P terbaik pengganti Kokomi.'],
    ],
  },
  noelle: {
    role: 'On-Field Geo DPS / Healer',
    talent: 'Normal Attack > Burst > Skill',
    set: '4pc Marechaussee Hunter (dgn Furina)',
    alt: '4pc Husk of Opulent Dreams',
    stats: ['DEF%', 'Geo DMG', 'CRIT Rate / CRIT DMG'],
    subs: 'ER (130–140%) > CRIT Rate / DMG > DEF%',
    weapons: [
      ['Whiteblind', '4★', 'F2P', 'Craftable Blacksmith (Gratis)', 'DEF% raksasa untuk damage (C6), shield, dan heal.'],
      ['Favonius Greatsword', '4★', 'F2P', 'Gacha 4★', 'Bagus saat menjadi driver Furina tanpa baterai Geo.'],
      ['Redhorn Stonethresher', '5★', 'BIS', '5★ Limited', 'BiS mutlak untuk Noelle C6.'],
    ],
    teams: [
      ['Noelle Geo F2P', 'F2P', ['Noelle', 'Gorou', 'Kachina', 'Fischl'], 'DPS + shield + heal sekaligus.'],
      ['Noelle Furina Wet Rock', 'META', ['Noelle', 'Furina', 'Yelan', 'Xilonen'], 'Heal tim Noelle langsung mengisi penuh Fanfare Furina!'],
    ],
  },
  'yun-jin': {
    role: 'Normal Attack Buffer',
    talent: 'Burst > Skill (Normal skip)',
    set: '4pc Husk of Opulent Dreams',
    stats: ['DEF% / ER%', 'DEF%', 'DEF%'],
    subs: 'ER (200–220%) > DEF% > CRIT Rate (Favonius)',
    weapons: [
      ['Favonius Lance', '4★', 'F2P', 'Gacha 4★', 'ER tinggi + partikel energi untuk tim.'],
      ['Footprint of the Rainbow', '4★', 'F2P', 'Craftable Natlan (Gratis)', 'Stat DEF% terbesar untuk buff maksimal.'],
    ],
    teams: [
      ['Yoimiya / Ayato Buffer F2P', 'F2P', ['Yoimiya', 'Xingqiu', 'Yun Jin', 'Layla'], 'Buff flat DMG Normal Attack sangat besar.'],
      ['Wanderer / Yoimiya Meta', 'META', ['Yoimiya', 'Yelan', 'Yun Jin', 'Zhongli'], 'Resonansi Geo + buff Normal Attack.'],
    ],
  },
  gorou: {
    role: 'Mono Geo DEF Buffer',
    talent: 'Skill > Burst (Normal skip)',
    set: '4pc Exile (ER Tim)',
    alt: '4pc Noblesse Oblige / 4pc Husk',
    stats: ['ER%', 'DEF%', 'CRIT Rate (Favonius)'],
    subs: 'ER (220%+) > CRIT Rate > DEF%',
    weapons: [
      ['Favonius Warbow', '4★', 'F2P', 'Quest Mondstadt (Gratis)', 'Senjata terbaik Gorou tanpa tandingan.'],
      ['Sacrificial Bow', '4★', 'F2P', 'Gacha 4★', 'Alternatif jika Favonius dipakai karakter lain.'],
    ],
    teams: [
      ['Itto / Noelle Mono Geo', 'F2P', ['Noelle', 'Gorou', 'Kachina', 'Fischl'], 'Minimal 3 karakter Geo untuk buff Geo DMG +15%.'],
      ['Itto Premium Geo', 'META', ['Arataki Itto', 'Gorou', 'Chiori', 'Zhongli'], 'Core Mono Geo klasik.'],
    ],
  },
  chiori: {
    role: 'Off-Field Geo Sub-DPS',
    talent: 'Skill > Burst (Normal skip)',
    set: '4pc Golden Troupe',
    alt: '4pc Husk of Opulent Dreams',
    stats: ['DEF%', 'Geo DMG', 'CRIT Rate / CRIT DMG'],
    subs: 'CRIT Rate / DMG > DEF% > ATK%',
    weapons: [
      ['Harbinger of Dawn', '3★', 'F2P', 'Gacha 3★ (Mudah R5)', 'Luar biasa kuat untuk Chiori karena dia off-field (HP selalu >90%)!'],
      ['Flute of Ezpitzal', '4★', 'F2P', 'Craftable Natlan (Gratis)', 'Opsi DEF% aman bila bermain bersama Furina.'],
      ['Uraku Misugiri', '5★', 'BIS', 'Signature 5★', '88% CRIT DMG + bonus Skill DMG besar.'],
    ],
    teams: [
      ['Double Geo F2P', 'F2P', ['Chiori', 'Kachina', 'Xiangling', 'Bennett'], 'Kachina membuat Geo Construct untuk 2 boneka Tamoto!'],
      ['Wheelchair Double Geo', 'META', ['Chiori', 'Xilonen', 'Furina', 'Neuvillette'], 'Core off-field Geo dengan DPS tinggi.'],
    ],
  },
  albedo: {
    role: 'Off-Field Geo Sub-DPS',
    talent: 'Skill > Burst (Normal skip)',
    set: '4pc Husk of Opulent Dreams',
    alt: '4pc Golden Troupe',
    stats: ['DEF%', 'Geo DMG', 'CRIT Rate / CRIT DMG'],
    subs: 'CRIT Rate / DMG > DEF%',
    weapons: [
      ['Harbinger of Dawn', '3★', 'F2P', 'Gacha 3★ (Mudah R5)', 'Stat CRIT masif saat HP >90%.'],
      ['Flute of Ezpitzal', '4★', 'F2P', 'Craftable Natlan (Gratis)', 'Opsi DEF% gratis yang stabil di tim Furina.'],
      ['Uraku Misugiri / Cinnabar Spindle', '5★', 'BIS', '5★ / Event 2.3', 'BiS DEF & Skill DMG.'],
    ],
    teams: [
      ['Double Geo F2P', 'F2P', ['Noelle', 'Gorou', 'Albedo', 'Fischl'], 'Baterai Geo + damage off-field konstan.'],
      ['Itto Mono Geo', 'META', ['Arataki Itto', 'Gorou', 'Albedo', 'Zhongli'], 'Sinergi DEF + Geo Construct.'],
    ],
  },
  'kujou-sara': {
    role: 'Electro ATK/CRIT Buffer (C6)',
    talent: 'Skill > Burst (Normal skip)',
    set: '4pc Emblem of Severed Fate',
    alt: '4pc Noblesse Oblige',
    stats: ['ER% / ATK%', 'Electro DMG', 'CRIT Rate / CRIT DMG'],
    subs: 'ER (180–200%) > CRIT Rate / DMG > ATK%',
    weapons: [
      ['Fading Twilight / Sacrificial Bow', '4★', 'F2P', 'Event / Gacha 4★', 'Base ATK 565 + ER membuat buff ATK besar.'],
      ['Favonius Warbow', '4★', 'F2P', 'Quest Mondstadt (Gratis)', 'Energi mulus meski Base ATK sedikit lebih rendah.'],
      ['Skyward Harp / Elegy for the End', '5★', 'BIS', '5★ Standard / Limited', 'Base ATK 674 untuk buff maksimal.'],
    ],
    teams: [
      ['Electro Carry F2P', 'F2P', ['Raiden Shogun', 'Kujou Sara', 'Sucrose', 'Bennett'], 'C6 memberi +60% Electro CRIT DMG.'],
      ['Raiden Hypercarry', 'META', ['Raiden Shogun', 'Kujou Sara', 'Chevreuse', 'Bennett'], 'Nuke Burst Raiden maksimal.'],
    ],
  },
  yanfei: {
    role: 'On-Field Pyro Catalyst DPS',
    talent: 'Normal Attack > Burst > Skill',
    set: '4pc Crimson Witch of Flames',
    alt: '4pc Wanderer\'s Troupe',
    stats: ['ATK% / EM', 'Pyro DMG', 'CRIT Rate / CRIT DMG'],
    subs: 'CRIT Rate / DMG > EM > ATK% > ER (130%)',
    weapons: [
      ['The Widsith', '4★', 'F2P', 'Gacha 4★', 'Sangat kuat untuk Vaporize Charged Attack.'],
      ['Flowing Purity', '4★', 'F2P', 'Craftable Fontaine (Gratis)', 'Alternatif craftable solid bersama Bennett.'],
      ['Tome of the Eternal Flow / Lost Prayer', '5★', 'BIS', '5★ Limited / Standard', 'CRIT tinggi + bonus Charged Attack.'],
    ],
    teams: [
      ['Yanfei Vape F2P', 'F2P', ['Yanfei', 'Xingqiu', 'Sucrose', 'Bennett'], 'Tim 4★ penuh yang nyaman dari jarak jauh.'],
      ['Yanfei Overload', 'META', ['Yanfei', 'Fischl', 'Chevreuse', 'Bennett'], 'Tidak perlu khawatir musuh terpental karena jarak jauh.'],
    ],
  },
  'shikanoin-heizou': {
    role: 'Anemo Quickswap / Driver',
    talent: 'Skill > Normal Attack > Burst',
    set: '4pc Viridescent Venerer',
    alt: '4pc Golden Troupe (Quickswap)',
    stats: ['ATK% / EM', 'Anemo DMG / EM', 'CRIT Rate / CRIT DMG'],
    subs: 'CRIT Rate / DMG > ATK% > EM',
    weapons: [
      ['The Widsith', '4★', 'F2P', 'Gacha 4★', 'Burst Skill punch sangat sakit dengan Widsith.'],
      ['Flowing Purity', '4★', 'F2P', 'Craftable Fontaine (Gratis)', 'Opsi craftable gratis.'],
      ['Skyward Atlas / Kagura\'s Verity', '5★', 'BIS', '5★', 'Stat ATK/CRIT tinggi.'],
    ],
    teams: [
      ['Heizou Taser F2P', 'F2P', ['Shikanoin Heizou', 'Xingqiu', 'Fischl', 'Beidou'], 'Driver VV yang menyenangkan dimainkan.'],
      ['Heizou Hypercarry', 'META', ['Shikanoin Heizou', 'Faruzan', 'Furina', 'Bennett'], 'Memaksimalkan angka punch Skill.'],
    ],
  },
  lynette: {
    role: 'Anemo Sub-DPS / VV Support',
    talent: 'Burst > Skill (Normal skip)',
    set: '4pc Viridescent Venerer',
    stats: ['ER% / ATK%', 'Anemo DMG', 'CRIT Rate / CRIT DMG'],
    subs: 'ER (170–200%) > CRIT Rate / DMG > ATK%',
    weapons: [
      ['Favonius Sword', '4★', 'F2P', 'Quest / Gacha 4★', 'Terbaik untuk energi & utilitas tim.'],
      ['Fleuve Cendre Ferryman', '4★', 'F2P', 'Fishing Fontaine (Gratis)', 'ER tinggi + CRIT Rate Skill.'],
    ],
    teams: [
      ['Gratis AR25 VV Support', 'F2P', ['Xiangling', 'Xingqiu', 'Lynette', 'Bennett'], 'Taunt dari Burst membantu kontrol musuh.'],
      ['Lyney Mono Pyro', 'META', ['Lyney', 'Xiangling', 'Lynette', 'Bennett'], 'VV shred + buff ATK pasif.'],
    ],
  },
  aether: {
    role: 'Dendro / Pyro Off-Field Support',
    talent: 'Burst > Skill (Normal skip)',
    set: '4pc Deepwood Memories (Dendro) / 4pc Cinder City (Pyro)',
    stats: ['ER%', 'Dendro / Pyro DMG', 'CRIT Rate (Favonius)'],
    subs: 'ER (200–230%) > CRIT Rate > EM',
    weapons: [
      ['Favonius Sword', '4★', 'F2P', 'Quest Mondstadt (Gratis)', 'Terbaik untuk semua elemen Traveler.'],
      ['Sapwood Blade', '4★', 'F2P', 'Craftable Sumeru (Gratis)', 'ER + buff 120 EM untuk tim Dendro.'],
    ],
    teams: [
      ['Hyperbloom F2P (Dendro)', 'F2P', ['Aether', 'Xingqiu', 'Kuki Shinobu', 'Fischl'], 'Dendro Traveler adalah versi terbaik & 100% gratis!'],
      ['Mualani / Kinich Support (Pyro)', 'META', ['Kinich', 'Aether', 'Bennett', 'Yaoyao'], 'Pyro Traveler bisa memegang 4pc Cinder City.'],
    ],
  },
  lumine: {
    role: 'Dendro / Pyro Off-Field Support',
    talent: 'Burst > Skill (Normal skip)',
    set: '4pc Deepwood Memories (Dendro) / 4pc Cinder City (Pyro)',
    stats: ['ER%', 'Dendro / Pyro DMG', 'CRIT Rate (Favonius)'],
    subs: 'ER (200–230%) > CRIT Rate > EM',
    weapons: [
      ['Favonius Sword', '4★', 'F2P', 'Quest Mondstadt (Gratis)', 'Terbaik untuk semua elemen Traveler.'],
      ['Sapwood Blade', '4★', 'F2P', 'Craftable Sumeru (Gratis)', 'ER + buff 120 EM untuk tim Dendro.'],
    ],
    teams: [
      ['Hyperbloom F2P (Dendro)', 'F2P', ['Lumine', 'Xingqiu', 'Kuki Shinobu', 'Fischl'], 'Dendro Traveler adalah versi terbaik & 100% gratis!'],
      ['Mualani / Kinich Support (Pyro)', 'META', ['Kinich', 'Lumine', 'Bennett', 'Yaoyao'], 'Pyro Traveler bisa memegang 4pc Cinder City.'],
    ],
  },

  // ======================== ZENLESS ZONE ZERO ========================
  miyabi: {
    role: 'Frost Anomaly / CRIT Hypercarry',
    talent: 'Core Skill > Basic Attack > Ultimate > EX Special',
    set: '4pc Branch & Blade Song + 2pc Woodpecker Electro',
    alt: '2pc Polar Metal (jika CRIT Rate sudah ≥80%)',
    stats: ['CRIT Rate / CRIT DMG', 'Ice DMG / PEN Ratio', 'ATK%'],
    subs: 'CRIT Rate (target 80% untuk pasif) > CRIT DMG > ATK%',
    weapons: [
      ['Weeping Gemini', 'A', 'F2P', 'Box Galaxy (Craftable Gratis)', 'Tumpukan Anomaly Proficiency tinggi untuk Frostburn & Disorder.'],
      ['Rainforest Gourmet', 'A', 'F2P', 'Box Galaxy (Craftable Gratis)', 'Bonus ATK% stabil saat menghabiskan energi.'],
      ['Hailstorm Shrine', 'S', 'BIS', 'Signature S-Rank', 'Satu-satunya Anomaly W-Engine berstat CRIT Rate + Ice DMG masif.'],
    ],
    teams: [
      ['Miyabi Mono Ice F2P', 'F2P', ['Miyabi', 'Lycaon', 'Soukaku'], 'Lycaon + Soukaku memberi Ice shred & buff +1000 ATK gratis.'],
      ['Miyabi Yanagi Disorder', 'META', ['Miyabi', 'Yanagi', 'Astra Yao'], 'Tim meta #1 Miyabi di Prydwen/YT: Polarity Disorder instan isi penuh Fallen Frost.'],
      ['Miyabi Vivian Abloom', 'META', ['Miyabi', 'Vivian', 'Astra Yao'], 'Varian meta Disorder off-field dengan bonus damage Abloom Vivian.'],
    ],
  },
  'astra-yao': {
    role: 'Universal ATK/CRIT Support / Healer',
    talent: 'Core Skill > EX Special > Ultimate',
    set: '4pc Astral Voice + 2pc Swing Jazz',
    alt: '2pc Hormone Punk (untuk capai 3429 ATK)',
    stats: ['ATK%', 'ATK%', 'Energy Regen / ATK%'],
    subs: 'ATK% (target ~3.429 ATK untuk buff +1.200 ATK maks) > Energy Regen',
    weapons: [
      ['Bashful Demon', 'A', 'F2P', 'Gacha A-Rank (Signature Soukaku)', 'ATK% besar untuk mencapai batas buff maksimal.'],
      ['Kaboom the Cannon', 'A', 'F2P', 'Gacha A-Rank (Signature Lucy)', 'Energy Regen + buff ATK tim yang sangat mudah aktif.'],
      ['Elegant Vanity', 'S', 'BIS', 'Signature S-Rank', 'Energy Regen + ATK% + bonus DMG tim saat Quick Assist.'],
    ],
    teams: [
      ['Astra Flex F2P', 'F2P', ['Billy', 'Anby Demara', 'Astra Yao'], 'Cocok masuk ke hampir semua tim Attack maupun Anomaly.'],
      ['Evelyn / Miyabi Meta', 'META', ['Evelyn', 'Lighter', 'Astra Yao'], 'Quick Assist tanpa henti + buff ATK & CRIT DMG.'],
    ],
  },
  evelyn: {
    role: 'On-Field Fire Attack DPS',
    talent: 'Core Skill > Chain/Ultimate > Basic Attack > EX Special',
    set: '4pc Woodpecker Electro + 2pc Branch & Blade Song',
    alt: '4pc Hormone Punk (Burst Window)',
    stats: ['CRIT DMG / CRIT Rate', 'Fire DMG / PEN Ratio', 'ATK%'],
    subs: 'CRIT Rate (maks 75% krn pasif +25%) > CRIT DMG > ATK%',
    weapons: [
      ['Starlight Engine', 'A', 'F2P', 'Box Galaxy (Craftable Gratis R5)', 'ATK% tinggi yang aktif terus dari Quick Assist & Dodge Counter.'],
      ['Marcato Desire', 'A', 'F2P', 'Event 1.4 (Gratis jika punya)', 'CRIT Rate + ATK% sangat cocok untuk Evelyn.'],
      ['Heartstring Nocturne', 'S', 'BIS', 'Signature S-Rank', 'CRIT Rate + 50% CRIT DMG + abaikan Fire RES.'],
    ],
    teams: [
      ['Evelyn Fire F2P', 'F2P', ['Evelyn', 'Koleda', 'Lucy'], 'Koleda stun cepat + buff Chain Attack, Lucy buff ATK tim.'],
      ['Evelyn Premium Meta', 'META', ['Evelyn', 'Lighter', 'Astra Yao'], 'Chain Attack ekstra dari Astra + buff Fire DMG masif Lighter.'],
    ],
  },
  'ellen-joe': {
    role: 'On-Field Ice Attack DPS',
    talent: 'Core Skill > Basic Attack > EX Special = Ultimate',
    set: '4pc Polar Metal + 2pc Woodpecker Electro',
    alt: '4pc Woodpecker Electro + 2pc Polar Metal',
    stats: ['CRIT Rate / CRIT DMG', 'Ice DMG / PEN Ratio', 'ATK%'],
    subs: 'CRIT Rate > CRIT DMG > ATK%',
    weapons: [
      ['Starlight Engine', 'A', 'F2P', 'Box Galaxy (Craftable Gratis R5)', 'Opsi F2P paling konsisten untuk Ellen.'],
      ['Street Superstar', 'A', 'F2P', 'Box Galaxy (Craftable Gratis)', 'Bonus Ultimate DMG dari Chain Attack.'],
      ['Deep Sea Visitor', 'S', 'BIS', 'Signature S-Rank', 'CRIT Rate sangat besar + Ice DMG.'],
    ],
    teams: [
      ['Ellen Ice F2P', 'F2P', ['Ellen Joe', 'Anby Demara', 'Soukaku'], 'Soukaku mudah didapat & memberi buff Ice + ATK besar.'],
      ['Ellen Lighter Astra', 'META', ['Ellen Joe', 'Lighter', 'Astra Yao'], 'Tim meta #1 Ellen modern: +75% Ice DMG Lighter + Quick Assist Astra.'],
      ['Ellen Lycaon Astra', 'META', ['Ellen Joe', 'Lycaon', 'Astra Yao'], 'Alternatif meta Ice RES shred bila Lighter dipakai tim Evelyn.'],
    ],
  },
  'zhu-yuan': {
    role: 'Burst Window Ether Attack DPS',
    talent: 'Core Skill > Basic Attack > Ultimate > EX Special',
    set: '4pc Chaotic Metal + 2pc Woodpecker Electro',
    alt: '2pc Branch & Blade Song',
    stats: ['CRIT DMG', 'Ether DMG / ATK%', 'ATK%'],
    subs: 'CRIT Rate (maks 70% krn pasif +30%) > CRIT DMG > ATK%',
    weapons: [
      ['Starlight Engine', 'A', 'F2P', 'Box Galaxy (Craftable Gratis R5)', 'Pasif ATK% aktif instan saat Quick Assist dari Nicole!'],
      ['Marcato Desire', 'A', 'F2P', 'Event 1.4 (Gratis jika punya)', 'CRIT Rate + ATK% saat musuh kena Corruption/Attribute Anomaly.'],
      ['Riot Suppressor Mark VI', 'S', 'BIS', 'Signature S-Rank', 'CRIT DMG + CRIT Rate + Ether Basic DMG.'],
    ],
    teams: [
      ['Zhu Yuan PubSec F2P', 'F2P', ['Zhu Yuan', 'Anby Demara', 'Nicole Demara'], 'Salah satu tim F2P terkuat sejak rilis: DEF shred Nicole + burst stun.'],
      ['Zhu Yuan Qingyi Astra', 'META', ['Zhu Yuan', 'Qingyi', 'Astra Yao'], 'Tim meta #1 Zhu Yuan: Stun Multiplier Qingyi + buff ATK/CRIT Astra.'],
      ['Zhu Yuan Double Support', 'META', ['Zhu Yuan', 'Nicole Demara', 'Astra Yao'], 'Varian meta quickswap populer di YouTube TC tanpa butuh Stunner.'],
    ],
  },
  yanagi: {
    role: 'On-Field Electric Anomaly / Disorder DPS',
    talent: 'Core Skill > EX Special > Basic Attack > Ultimate',
    set: '4pc Chaos Jazz + 2pc Freedom Blues',
    alt: '4pc Thunder Metal (Mono Electric)',
    stats: ['Anomaly Proficiency', 'Electric DMG / PEN Ratio', 'Anomaly Mastery'],
    subs: 'Anomaly Proficiency > ATK% > PEN',
    weapons: [
      ['Weeping Gemini', 'A', 'F2P', 'Box Galaxy (Craftable Gratis R5)', 'Tumpukan Anomaly Proficiency terbaik untuk F2P.'],
      ['Rainforest Gourmet', 'A', 'F2P', 'Box Galaxy (Craftable Gratis)', 'Alternatif ATK% tinggi saat spamming EX Special.'],
      ['Timeweaver', 'S', 'BIS', 'Signature S-Rank', 'Anomaly Buildup + Disorder DMG +75%.'],
    ],
    teams: [
      ['Yanagi Shock F2P', 'F2P', ['Yanagi', 'Seth', 'Piper'], 'Seth memberi shield & +100 Anomaly Proficiency, Piper picu Disorder.'],
      ['Miyabi Yanagi Disorder', 'META', ['Miyabi', 'Yanagi', 'Astra Yao'], 'Tim meta #1 Disorder: Polarity Disorder instan memicu Frostburn.'],
      ['Yanagi Vivian Abloom', 'META', ['Yanagi', 'Vivian', 'Astra Yao'], 'Varian meta On-Field Yanagi dengan bonus Abloom Vivian.'],
    ],
  },
  'burnice-white': {
    role: 'Off-Field Fire Anomaly Sub-DPS',
    talent: 'Core Skill > EX Special > Ultimate',
    set: '4pc Chaos Jazz + 2pc Freedom Blues',
    stats: ['Anomaly Proficiency', 'Fire DMG', 'Anomaly Mastery / Energy Regen'],
    subs: 'Anomaly Proficiency (target 300+) > ATK%',
    weapons: [
      ['Weeping Gemini', 'A', 'F2P', 'Box Galaxy (Craftable Gratis R5)', 'Anomaly Proficiency besar selama tim memicu Disorder.'],
      ['Rainforest Gourmet', 'A', 'F2P', 'Box Galaxy (Craftable Gratis)', 'Aktif otomatis karena Burnice banyak memakai energi EX Special.'],
      ['Flamemaker Shaker', 'S', 'BIS', 'Signature S-Rank', 'Off-field Energy Regen + Fire Anomaly DMG.'],
    ],
    teams: [
      ['Burnice Piper F2P', 'F2P', ['Piper', 'Burnice White', 'Lucy'], 'Sons of Calydon Disorder F2P paling kuat & mudah dimainkan!'],
      ['Jane / Miyabi Disorder', 'META', ['Jane Doe', 'Burnice White', 'Astra Yao'], 'Off-field Burn terus memicu Disorder dengan Assault Jane.'],
    ],
  },
  'jane-doe': {
    role: 'On-Field Physical Anomaly DPS',
    talent: 'Core Skill > Dodge > Basic Attack > EX Special',
    set: '4pc Fanged Metal + 2pc Freedom Blues',
    stats: ['Anomaly Proficiency', 'Physical DMG', 'Anomaly Mastery'],
    subs: 'Anomaly Proficiency (target 420 untuk 100% Assault CRIT) > ATK%',
    weapons: [
      ['Weeping Gemini', 'A', 'F2P', 'Box Galaxy (Craftable Gratis R5)', 'F2P terbaik: mudah menembus target 420 Anomaly Proficiency.'],
      ['Rainforest Gourmet', 'A', 'F2P', 'Box Galaxy (Craftable Gratis)', 'Alternatif solid dari Box Galaxy.'],
      ['Sharpened Stinger', 'S', 'BIS', 'Signature S-Rank', 'Physical DMG + Anomaly Buildup dari Dodge.'],
    ],
    teams: [
      ['Jane Hypercarry F2P', 'F2P', ['Jane Doe', 'Seth', 'Lucy'], 'Seth (+100 AP & shield) + Lucy (+600 ATK) sangat murah dibangun.'],
      ['Jane Vivian Abloom', 'META', ['Jane Doe', 'Vivian', 'Astra Yao'], 'Tim meta #1 Jane Doe: Abloom Vivian ikut scale dari CRIT Assault Jane!'],
      ['Jane Burnice Disorder', 'META', ['Jane Doe', 'Burnice White', 'Astra Yao'], 'Alternatif meta Disorder klasik melawan musuh lemah Fire/Physical.'],
    ],
  },
  'caesar-king': {
    role: 'Shielder / ATK Buffer / Semi-Stun',
    talent: 'Core Skill > EX Special > Assist',
    set: '4pc Proto Punk + 2pc Shockstar Disco',
    stats: ['ATK% / CRIT Rate', 'Physical DMG / ATK%', 'Impact'],
    subs: 'Impact (Prioritas Disc 6!) > ATK% > CRIT',
    weapons: [
      ['Original Transmorpher', 'A', 'F2P', 'Box Galaxy (Craftable Gratis)', 'HP% & Impact saat diserang (atau pakai Stun W-Engine ber-Impact!).'],
      ['Spring Embrace', 'A', 'F2P', 'Gacha A-Rank', 'Energy Regen + damage reduction.'],
      ['Tusks of Fury', 'S', 'BIS', 'Signature S-Rank', 'Satu-satunya Defense W-Engine dengan stat Impact + buff DMG tim.'],
    ],
    teams: [
      ['Caesar Flex F2P', 'F2P', ['Billy', 'Caesar King', 'Lucy'], 'Perisai anti-interupsi + +1.000 ATK untuk DPS apapun.'],
      ['Jane / Soldier 11 Meta', 'META', ['Jane Doe', 'Burnice White', 'Caesar King'], 'Nyaman di Endless Tower berkat perisai tebal.'],
    ],
  },
  lighter: {
    role: 'Fire & Ice Buffer / Stunner',
    talent: 'Core Skill > EX Special > Basic Attack',
    set: '4pc Shockstar Disco + 2pc Swing Jazz',
    alt: '4pc Proto Punk (Support)',
    stats: ['CRIT Rate / ATK%', 'Fire DMG', 'Impact'],
    subs: 'Impact (target 270 Impact untuk buff maks) > CRIT Rate / DMG > ATK%',
    weapons: [
      ['Steam Oven', 'A', 'F2P', 'Box Galaxy (Craftable Gratis R5)', 'Energy Regen + Impact tambahan untuk mendekati batas buff.'],
      ['Precious Fossilized Core', 'A', 'F2P', 'Box Galaxy (Craftable Gratis)', 'Daze cepat di awal pertarungan.'],
      ['Blazing Laurel', 'S', 'BIS', 'Signature S-Rank', 'Impact tertinggi + +30% Fire/Ice CRIT DMG tim.'],
    ],
    teams: [
      ['Soldier 11 Fire F2P', 'F2P', ['Soldier 11', 'Lighter', 'Lucy'], 'Buff hingga +75% Fire DMG + 15% Fire RES shred.'],
      ['Evelyn / Ellen Meta', 'META', ['Evelyn', 'Lighter', 'Astra Yao'], 'Stunner terbaik untuk semua DPS Fire & Ice.'],
    ],
  },
  qingyi: {
    role: 'On-Field Stunner / Stun Multiplier Buffer',
    talent: 'Core Skill > Basic Attack > EX Special',
    set: '4pc Shockstar Disco + 2pc Swing Jazz',
    stats: ['CRIT Rate / ATK%', 'Electric DMG', 'Impact'],
    subs: 'Impact > ATK% > CRIT Rate / DMG',
    weapons: [
      ['Steam Oven', 'A', 'F2P', 'Box Galaxy (Craftable Gratis R5)', 'Energy Regen + Impact sangat stabil untuk stun cepat.'],
      ['Precious Fossilized Core', 'A', 'F2P', 'Box Galaxy (Craftable Gratis)', 'Pilihan bagus untuk boss dengan HP tinggi.'],
      ['Ice-Jade Teapot', 'S', 'BIS', 'Signature S-Rank', 'Impact besar + buff +20% DMG seluruh tim.'],
    ],
    teams: [
      ['Harumasa Stun F2P', 'F2P', ['Harumasa', 'Qingyi', 'Nicole Demara'], 'Harumasa gratis + Stun Multiplier Qingyi = burst besar.'],
      ['Zhu Yuan Burst Meta', 'META', ['Zhu Yuan', 'Qingyi', 'Nicole Demara'], 'Kombinasi Stun Burst paling efektif.'],
    ],
  },
  trigger: {
    role: 'Off-Field Electric Stunner / Buffer',
    talent: 'Core Skill > Basic Attack > EX Special > Ultimate',
    set: '4pc Shadow Harmony + 2pc Shockstar Disco',
    stats: ['CRIT Rate', 'Electric DMG', 'Impact'],
    subs: 'CRIT Rate (target 90% untuk pasif Daze maks) > Impact > CRIT DMG',
    weapons: [
      ['Precious Fossilized Core', 'A', 'F2P', 'Box Galaxy (Craftable Gratis)', 'Impact + Daze konsisten untuk F2P.'],
      ['Steam Oven', 'A', 'F2P', 'Box Galaxy (Craftable Gratis)', 'Bantu Energy Regen untuk EX Special Aftershock.'],
      ['Spectral Gaze', 'S', 'BIS', 'Signature S-Rank', 'CRIT Rate + DEF shred 25% dari Aftershock.'],
    ],
    teams: [
      ['Harumasa Off-Field Stun F2P', 'F2P', ['Harumasa', 'Trigger', 'Nicole Demara'], 'Stun off-field tanpa mengambil waktu on-field DPS.'],
      ['Soldier 0 - Anby Aftershock', 'META', ['Soldier 0 - Anby', 'Trigger', 'Astra Yao'], 'Sinergi Aftershock terbaik.'],
    ],
  },
  'soldier-0-anby': {
    role: 'On-Field Electric Aftershock DPS',
    talent: 'Core Skill > EX Special > Basic Attack > Ultimate',
    set: '4pc Shadow Harmony + 2pc Woodpecker Electro',
    stats: ['CRIT DMG / CRIT Rate', 'Electric DMG', 'ATK%'],
    subs: 'CRIT Rate / CRIT DMG > ATK%',
    weapons: [
      ['Starlight Engine', 'A', 'F2P', 'Box Galaxy (Craftable Gratis R5)', 'ATK% tinggi & mudah dipicu lewat Dodge Counter / Quick Assist.'],
      ['Marcato Desire', 'A', 'F2P', 'Event 1.4 (Gratis jika punya)', 'CRIT Rate + ATK% sangat kuat.'],
      ['Severed Innocence', 'S', 'BIS', 'Signature S-Rank', 'CRIT DMG raksasa + Electric DMG saat Aftershock.'],
    ],
    teams: [
      ['S0 Anby Aftershock F2P', 'F2P', ['Soldier 0 - Anby', 'Pulchra', 'Nicole Demara'], 'Pulchra A-Rank memicu sinergi Aftershock gratis!'],
      ['S0 Anby Trigger Meta', 'META', ['Soldier 0 - Anby', 'Trigger', 'Astra Yao'], 'Aftershock + buff CRIT DMG ganda.'],
    ],
  },
  vivian: {
    role: 'Off-Field Ether Anomaly Sub-DPS',
    talent: 'Core Skill > EX Special > Basic Attack > Ultimate',
    set: '4pc Phaethon\'s Melody + 2pc Freedom Blues',
    stats: ['Anomaly Proficiency', 'Ether DMG', 'Anomaly Mastery'],
    subs: 'Anomaly Proficiency > ATK%',
    weapons: [
      ['Weeping Gemini', 'A', 'F2P', 'Box Galaxy (Craftable Gratis R5)', 'Anomaly Proficiency tinggi untuk Abloom & Disorder.'],
      ['Rainforest Gourmet', 'A', 'F2P', 'Box Galaxy (Craftable Gratis)', 'Opsi Box Galaxy solid.'],
      ['Flight of Fancy', 'S', 'BIS', 'Signature S-Rank', 'Anomaly Buildup + tumpukan AP off-field.'],
    ],
    teams: [
      ['Vivian Piper F2P', 'F2P', ['Piper', 'Vivian', 'Nicole Demara'], 'Abloom + Disorder Ether/Physical yang sangat ramah F2P.'],
      ['Miyabi / Jane Abloom', 'META', ['Jane Doe', 'Vivian', 'Astra Yao'], 'Abloom melipatgandakan damage Anomaly on-field.'],
    ],
  },
  hugo: {
    role: 'Totalize Ice Burst Attack DPS',
    talent: 'Core Skill > EX Special > Ultimate > Basic Attack',
    set: '4pc Hormone Punk + 2pc Branch & Blade Song',
    alt: '4pc Woodpecker Electro',
    stats: ['CRIT Rate / CRIT DMG', 'Ice DMG / ATK%', 'ATK%'],
    subs: 'CRIT Rate (target 88%+ agar Totalize selalu CRIT) > CRIT DMG > ATK%',
    weapons: [
      ['Starlight Engine', 'A', 'F2P', 'Box Galaxy (Craftable Gratis R5)', 'ATK% besar untuk burst window.'],
      ['Marcato Desire', 'A', 'F2P', 'Event 1.4 (Gratis)', 'CRIT Rate sangat membantu konsistensi Totalize.'],
      ['Myriad Eclipse', 'S', 'BIS', 'Signature S-Rank', 'CRIT Rate + CRIT DMG + abaikan DEF saat Totalize.'],
    ],
    teams: [
      ['Hugo Double Stun F2P', 'F2P', ['Hugo', 'Lycaon', 'Anby Demara'], '2 Stunner mengaktifkan pasif ATK maksimal Hugo!'],
      ['Hugo Lighter Lycaon', 'META', ['Hugo', 'Lighter', 'Lycaon'], 'Double Ice/Fire Stunner untuk nuke Totalize masif.'],
    ],
  },
  yixuan: {
    role: 'On-Field Ether Rupture DPS',
    talent: 'Core Skill > Ultimate > EX Special > Basic Attack',
    set: '4pc Yunkui Tales + 2pc Woodpecker Electro',
    alt: '2pc Branch & Blade Song',
    stats: ['CRIT Rate / CRIT DMG', 'Ether DMG / HP%', 'HP%'],
    subs: 'CRIT Rate / CRIT DMG > HP% (konversi ke Sheer Force)',
    weapons: [
      ['Puzzle Sphere', 'A', 'F2P', 'Box Galaxy (Craftable Gratis R5)', 'Rupture W-Engine F2P terbaik: CRIT DMG + EX Special DMG.'],
      ['Radiowave Journey', 'A', 'ALT', 'Battle Pass', 'HP% + Sheer Force.'],
      ['Qingming Birdcage', 'S', 'BIS', 'Signature S-Rank', 'CRIT Rate + Ether Sheer DMG tertinggi.'],
    ],
    teams: [
      ['Yixuan Rupture F2P', 'F2P', ['Yixuan', 'Pan Yinhu', 'Pulchra'], 'Pan Yinhu memberi buff Sheer Force khusus Rupture + heal.'],
      ['Yixuan Ju Fufu Pan Yinhu', 'META', ['Yixuan', 'Ju Fufu', 'Pan Yinhu'], 'Tim meta #1 Yixuan di TC: buff Sheer Force Pan Yinhu + off-field stun & CRIT DMG Ju Fufu.'],
      ['Yixuan Ju Fufu Astra', 'META', ['Yixuan', 'Ju Fufu', 'Astra Yao'], 'Varian meta Quick Assist dengan heal & buff CRIT DMG Astra.'],
    ],
  },
  'ju-fufu': {
    role: 'Off-Field Fire Stunner / Buffer',
    talent: 'Core Skill > EX Special > Chain/Ultimate',
    set: '4pc King of the Summit + 2pc Shockstar Disco',
    stats: ['ATK% / CRIT Rate', 'ATK% / Fire DMG', 'Impact / ATK%'],
    subs: 'ATK% (target 3.400 ATK) > CRIT Rate (≥50% utk 4pc Summit) > Impact',
    weapons: [
      ['Steam Oven', 'A', 'F2P', 'Box Galaxy (Craftable Gratis R5)', 'Energy Regen + Impact stabil.'],
      ['Precious Fossilized Core', 'A', 'F2P', 'Box Galaxy (Craftable Gratis)', 'Alternatif Daze cepat.'],
      ['Roaring Fur-nace', 'S', 'BIS', 'Signature S-Rank', 'ATK% tinggi + buff DMG tim dari Chain/EX.'],
    ],
    teams: [
      ['Yixuan / Evelyn Stun F2P', 'F2P', ['Soldier 11', 'Ju Fufu', 'Lucy'], 'Buff +50% CRIT DMG + bonus Decibel Ultimate.'],
      ['Yixuan Premium', 'META', ['Yixuan', 'Ju Fufu', 'Pan Yinhu'], 'Partner off-field terbaik Yixuan.'],
    ],
  },
  harumasa: {
    role: 'Burst Electric Attack DPS (Gratis)',
    talent: 'Core Skill > Dash Attack > Ultimate > EX Special',
    set: '4pc Shadow Harmony + 2pc Woodpecker Electro',
    alt: '4pc Thunder Metal',
    stats: ['CRIT DMG', 'Electric DMG / ATK%', 'ATK%'],
    subs: 'CRIT Rate (maks 75% krn pasif +25% Dash) > CRIT DMG > ATK%',
    weapons: [
      ['Marcato Desire', 'A', 'F2P', 'Event 1.4 (Gratis)', 'Dibuat sangat pas untuk Harumasa: CRIT Rate + ATK%.'],
      ['Starlight Engine', 'A', 'F2P', 'Box Galaxy (Craftable Gratis R5)', 'Alternatif craftable terbaik jika melewatkan event.'],
      ['Zanshin Herb Case', 'S', 'BIS', 'Signature S-Rank', 'CRIT DMG + CRIT Rate + Electric Dash DMG.'],
    ],
    teams: [
      ['Harumasa Stun F2P', 'F2P', ['Harumasa', 'Anby Demara', 'Nicole Demara'], '100% tim gratis (Harumasa + starter Cunning Hares)!'],
      ['Harumasa Qingyi Astra', 'META', ['Harumasa', 'Qingyi', 'Astra Yao'], 'Tim meta #1 Harumasa: Stun Multiplier Qingyi + buff ATK/CRIT Astra.'],
      ['Harumasa Trigger Astra', 'META', ['Harumasa', 'Trigger', 'Astra Yao'], 'Varian meta On-Field Harumasa dengan off-field stun Trigger.'],
    ],
  },
  lycaon: {
    role: 'Ice Stunner / Ice RES Shredder',
    talent: 'Core Skill > Basic Attack > EX Special',
    set: '4pc Shockstar Disco + 2pc Polar Metal',
    alt: '4pc King of the Summit',
    stats: ['CRIT Rate / ATK%', 'Ice DMG', 'Impact'],
    subs: 'Impact > CRIT Rate / DMG > ATK%',
    weapons: [
      ['Steam Oven', 'A', 'F2P', 'Box Galaxy (Craftable Gratis R5)', 'Energy Regen + Impact sangat nyaman.'],
      ['Precious Fossilized Core', 'A', 'F2P', 'Box Galaxy (Craftable Gratis)', 'Daze cepat pada musuh HP tinggi.'],
      ['The Restrained', 'S', 'BIS', 'Signature S-Rank (Standard)', 'Impact + Daze Basic Attack tertinggi.'],
    ],
    teams: [
      ['Mono Ice F2P', 'F2P', ['Miyabi', 'Lycaon', 'Soukaku'], '25% Ice RES shred + +35% Stun Multiplier.'],
      ['Ellen / Hugo Ice Meta', 'META', ['Hugo', 'Lighter', 'Lycaon'], 'Inti tim Ice terkuat.'],
    ],
  },
  soukaku: {
    role: 'Ice ATK Buffer (+1000 ATK)',
    talent: 'Core Skill > EX Special > Ultimate',
    set: '4pc Swing Jazz + 2pc Hormone Punk',
    alt: '4pc Freedom Blues (untuk Miyabi)',
    stats: ['ATK%', 'ATK%', 'Energy Regen / ATK%'],
    subs: 'ATK% (target 2.500 ATK untuk buff +1.000 ATK) > Energy Regen',
    weapons: [
      ['Bashful Demon', 'A', 'F2P', 'Gacha A-Rank (Signature)', 'ATK% + Ice DMG tim maksimal.'],
      ['Slice of Time', 'A', 'F2P', 'Box Galaxy (Craftable Gratis)', 'Alternatif gratis untuk energi & Decibel.'],
    ],
    teams: [
      ['Mono Ice F2P', 'F2P', ['Ellen Joe', 'Anby Demara', 'Soukaku'], 'Gratis dari Shiyu Defense; buff +1000 ATK & +20% Ice DMG.'],
      ['Miyabi Mono Ice', 'META', ['Miyabi', 'Lycaon', 'Soukaku'], 'Memicu Freeze cepat untuk tumpukan Miyabi.'],
    ],
  },
  'nicole-demara': {
    role: 'Ether DEF Shredder (-40% DEF) / Grouper',
    talent: 'Core Skill > EX Special > Ultimate',
    set: '4pc Swing Jazz + 2pc Chaos Jazz',
    alt: '4pc Astral Voice (jika tidak ada Astra)',
    stats: ['Anomaly Proficiency / CRIT Rate', 'Ether DMG', 'Energy Regen'],
    subs: 'Energy Regen > Anomaly Proficiency > ATK%',
    weapons: [
      ['The Vault', 'A', 'F2P', 'Gacha A-Rank (Signature)', 'Energy Regen + +24% DMG tim.'],
      ['Slice of Time', 'A', 'F2P', 'Box Galaxy (Craftable Gratis)', 'Opsi Box Galaxy untuk energi & Ultimate cepat.'],
    ],
    teams: [
      ['Cunning Hares / PubSec F2P', 'F2P', ['Zhu Yuan', 'Anby Demara', 'Nicole Demara'], '40% DEF shred + 15% CRIT Rate (M6) cocok di hampir semua tim!'],
      ['Miyabi / Harumasa Quickswap', 'META', ['Miyabi', 'Nicole Demara', 'Astra Yao'], 'Double Support dengan uptime DEF shred tinggi.'],
    ],
  },
  'anby-demara': {
    role: 'Starter Electric Stunner',
    talent: 'Core Skill > Basic Attack > EX Special',
    set: '4pc Shockstar Disco + 2pc Swing Jazz',
    stats: ['CRIT Rate / ATK%', 'Electric DMG', 'Impact'],
    subs: 'Impact > Energy Regen > CRIT',
    weapons: [
      ['Demara Battery Mark II', 'A', 'F2P', 'Starter Gratis (Signature)', 'Impact + Energy Regen pasif saat dodge.'],
      ['Steam Oven', 'A', 'F2P', 'Box Galaxy (Craftable Gratis R5)', 'Alternatif Daze lebih tinggi saat EX Special.'],
    ],
    teams: [
      ['Starter F2P', 'F2P', ['Billy', 'Anby Demara', 'Nicole Demara'], 'Stunner gratis yang solid hingga endgame.'],
      ['Zhu Yuan / Harumasa Budget', 'META', ['Harumasa', 'Anby Demara', 'Nicole Demara'], 'Aktifkan pasif tim tanpa butuh S-Rank Stunner.'],
    ],
  },
  lucy: {
    role: 'Universal ATK Buffer (+600 ATK)',
    talent: 'EX Special > Core Skill > Ultimate',
    set: '4pc Swing Jazz + 2pc Hormone Punk',
    alt: '4pc Astral Voice',
    stats: ['ATK%', 'ATK% / Fire DMG', 'Energy Regen'],
    subs: 'ATK% (target ~2.000 ATK) > Energy Regen > CRIT',
    weapons: [
      ['Kaboom the Cannon', 'A', 'F2P', 'Gacha A-Rank (Signature)', 'Energy Regen + stack ATK% tim dari babi mini.'],
      ['Slice of Time', 'A', 'F2P', 'Box Galaxy (Craftable Gratis)', 'Alternatif gratis untuk rotasi EX lebih cepat.'],
    ],
    teams: [
      ['Calydon Disorder F2P', 'F2P', ['Piper', 'Burnice White', 'Lucy'], 'Buff +600 ATK sangat cepat tanpa makan waktu on-field.'],
      ['Fire / Anomaly Flex', 'META', ['Jane Doe', 'Burnice White', 'Lucy'], 'Support A-Rank paling fleksibel bersama Nicole.'],
    ],
  },
  piper: {
    role: 'On-Field Physical Anomaly DPS',
    talent: 'Core Skill > EX Special > Ultimate',
    set: '4pc Fanged Metal + 2pc Freedom Blues',
    stats: ['Anomaly Proficiency', 'Physical DMG', 'Anomaly Mastery'],
    subs: 'Anomaly Proficiency > ATK%',
    weapons: [
      ['Weeping Gemini', 'A', 'F2P', 'Box Galaxy (Craftable Gratis R5)', 'Anomaly Proficiency masif untuk Assault beruntun.'],
      ['Roaring Ride', 'A', 'F2P', 'Gacha A-Rank (Signature)', 'Buff ATK%, AP, dan Buildup saat berputar EX Special.'],
    ],
    teams: [
      ['Piper Calydon F2P', 'F2P', ['Piper', 'Seth', 'Lucy'], 'DPS A-Rank yang sanggup clear Shiyu Defense dengan nyaman.'],
      ['Piper Burnice Disorder', 'META', ['Piper', 'Burnice White', 'Lucy'], 'Spin-to-win Disorder super cepat.'],
    ],
  },
  seth: {
    role: 'Anomaly Shielder (+100 AP Buffer)',
    talent: 'Core Skill > EX Special > Assist',
    set: '4pc Proto Punk + 2pc Swing Jazz',
    stats: ['ATK%', 'ATK% / Electric DMG', 'Energy Regen / ATK%'],
    subs: 'ATK% (perisai scale dari ATK) > Energy Regen',
    weapons: [
      ['Peacekeeper - Specialized', 'A', 'F2P', 'Gacha A-Rank (Signature)', 'ATK% + Energy Regen saat memakai perisai.'],
      ['Original Transmorpher', 'A', 'F2P', 'Box Galaxy (Craftable Gratis)', 'Opsi gratis jika belum punya Peacekeeper.'],
    ],
    teams: [
      ['Jane / Piper Anomaly F2P', 'F2P', ['Jane Doe', 'Seth', 'Lucy'], 'Quick Assist mundur langsung memberi +100 AP & perisai ke DPS!'],
      ['Yanagi Electric', 'META', ['Yanagi', 'Seth', 'Rina'], 'Menurunkan Anomaly Buildup RES musuh.'],
    ],
  },
  rina: {
    role: 'PEN Ratio Support',
    talent: 'Core Skill > EX Special > Ultimate',
    set: '4pc Swing Jazz + 2pc Puffer Electro',
    stats: ['ATK% / AP', 'PEN Ratio', 'Energy Regen'],
    subs: 'PEN Ratio (Prioritas Disc 5!) > Energy Regen > Anomaly Proficiency',
    weapons: [
      ['Slice of Time', 'A', 'F2P', 'Box Galaxy (Craftable Gratis R5)', 'F2P terbaik Rina: stat PEN Ratio + energi tim!'],
      ['Weeping Cradle', 'S', 'BIS', 'Signature S-Rank (Standard)', 'PEN Ratio + off-field Energy Regen + bonus DMG tim.'],
    ],
    teams: [
      ['Electric Shock F2P', 'F2P', ['Anton', 'Anby Demara', 'Rina'], 'Memperpanjang durasi Shock & beri ~30% PEN Ratio tim.'],
      ['Yanagi / Miyabi PEN', 'META', ['Yanagi', 'Burnice White', 'Rina'], 'PEN Ratio sangat efektif melawan boss DEF tinggi.'],
    ],
  },
  'soldier-11': {
    role: 'On-Field Fire Attack DPS',
    talent: 'Core Skill > Basic Attack > EX Special > Ultimate',
    set: '4pc Inferno Metal + 2pc Woodpecker Electro',
    stats: ['CRIT DMG / CRIT Rate', 'Fire DMG', 'ATK%'],
    subs: 'CRIT Rate (maks 72% dgn Inferno Metal) > CRIT DMG > ATK%',
    weapons: [
      ['Starlight Engine', 'A', 'F2P', 'Box Galaxy (Craftable Gratis R5)', 'Sangat kuat untuk Fire Suppression Basic Attack.'],
      ['The Brimstone', 'S', 'BIS', 'Signature S-Rank (Standard)', 'Tumpukan ATK% raksasa & fleksibel untuk semua Attack.'],
    ],
    teams: [
      ['Mono Fire F2P', 'F2P', ['Soldier 11', 'Ben', 'Lucy'], 'Mudah menjaga Burn agar 4pc Inferno Metal aktif terus.'],
      ['Soldier 11 Lighter Meta', 'META', ['Soldier 11', 'Lighter', 'Astra Yao'], 'Lonjakan DPS Fire sangat signifikan bersama Lighter.'],
    ],
  },
  koleda: {
    role: 'Burst Fire Stunner',
    talent: 'Core Skill > EX Special > Basic Attack',
    set: '4pc Shockstar Disco + 2pc Swing Jazz',
    stats: ['CRIT Rate / ATK%', 'Fire DMG', 'Impact'],
    subs: 'Impact > Energy Regen > ATK%',
    weapons: [
      ['Steam Oven', 'A', 'F2P', 'Box Galaxy (Craftable Gratis R5)', 'F2P terbaik Koleda: EX Special sering = Daze instan.'],
      ['Hellfire Gears', 'S', 'BIS', 'Signature S-Rank (Standard)', 'Off-field Energy Regen + Impact tinggi.'],
    ],
    teams: [
      ['Fire Burst F2P', 'F2P', ['Soldier 11', 'Koleda', 'Lucy'], 'Stun tercepat + buff +70% Chain Attack DMG.'],
      ['Evelyn Stun', 'META', ['Evelyn', 'Koleda', 'Astra Yao'], 'Alternatif terbaik jika tidak memiliki Lighter.'],
    ],
  },
  grace: {
    role: 'Electric Anomaly Sub-DPS',
    talent: 'Core Skill > EX Special > Basic Attack',
    set: '4pc Freedom Blues + 2pc Chaos Jazz',
    stats: ['Anomaly Proficiency', 'Electric DMG / PEN Ratio', 'Anomaly Mastery'],
    subs: 'Anomaly Proficiency > ATK%',
    weapons: [
      ['Weeping Gemini', 'A', 'F2P', 'Box Galaxy (Craftable Gratis R5)', 'Tumpukan AP besar untuk Shock & Disorder.'],
      ['Fusion Compiler', 'S', 'BIS', 'Signature S-Rank (Standard)', 'PEN Ratio + tumpukan AP dari EX Special.'],
    ],
    teams: [
      ['Disorder F2P', 'F2P', ['Grace', 'Piper', 'Seth'], 'Trigger Shock cepat lalu Disorder dengan Assault Piper.'],
      ['Anton / Rina Shock', 'META', ['Anton', 'Grace', 'Rina'], 'Shock permanen untuk pasif Anton.'],
    ],
  },
  nekomata: {
    role: 'Quickswap Physical Attack DPS',
    talent: 'Core Skill > Basic Attack > EX Special > Ultimate',
    set: '4pc Fanged Metal + 2pc Woodpecker Electro',
    stats: ['CRIT Rate / CRIT DMG', 'Physical DMG', 'ATK%'],
    subs: 'CRIT Rate / CRIT DMG > ATK%',
    weapons: [
      ['Starlight Engine', 'A', 'F2P', 'Box Galaxy (Craftable Gratis R5)', 'Aktif mudah dari Dodge Counter & Quick Assist.'],
      ['Steel Cushion', 'S', 'BIS', 'Signature S-Rank (Standard)', 'CRIT Rate + bonus serang dari belakang.'],
    ],
    teams: [
      ['Cunning Hares F2P', 'F2P', ['Nekomata', 'Anby Demara', 'Nicole Demara'], 'Sinergi faksi penuh + DEF shred Nicole.'],
      ['Nekomata Assault', 'META', ['Nekomata', 'Piper', 'Caesar King'], 'Assault Piper memicu pasif EX Special Nekomata.'],
    ],
  },
  billy: {
    role: 'Ranged Physical Attack DPS',
    talent: 'Core Skill > Basic Attack > Ultimate > EX Special',
    set: '4pc Woodpecker Electro + 2pc Fanged Metal',
    stats: ['CRIT Rate / CRIT DMG', 'Physical DMG', 'ATK%'],
    subs: 'CRIT Rate / CRIT DMG > ATK%',
    weapons: [
      ['Starlight Engine', 'A', 'F2P', 'Box Galaxy (Craftable Gratis R5)', 'F2P terbaik Billy; lebih kuat dari signature-nya di banyak situasi.'],
      ['Starlight Engine Replica', 'A', 'F2P', 'Gacha A-Rank (Signature)', 'Bagus bila menjaga jarak dari musuh.'],
    ],
    teams: [
      ['Cunning Hares F2P', 'F2P', ['Billy', 'Anby Demara', 'Nicole Demara'], 'Tim starter gratis yang tetap solid di M6.'],
      ['Billy Caesar Hypercarry', 'META', ['Billy', 'Caesar King', 'Astra Yao'], 'Buff ATK besar + aman dalam Crouching Shot.'],
    ],
  },
  corin: {
    role: 'Stun Burst Physical Attack DPS',
    talent: 'Core Skill > EX Special > Ultimate > Basic Attack',
    set: '4pc Hormone Punk + 2pc Fanged Metal',
    alt: '4pc Woodpecker Electro',
    stats: ['CRIT Rate / CRIT DMG', 'Physical DMG', 'ATK%'],
    subs: 'CRIT Rate / CRIT DMG > ATK%',
    weapons: [
      ['Starlight Engine', 'A', 'F2P', 'Box Galaxy (Craftable Gratis R5)', 'Damage sangat tinggi saat masuk ke jendela Stun.'],
      ['Housekeeper', 'A', 'F2P', 'Event / Gacha A-Rank (Signature)', 'Off-field Energy Regen + Physical DMG saat gergaji EX.'],
    ],
    teams: [
      ['Corin Stun F2P', 'F2P', ['Corin', 'Lycaon', 'Soukaku'], 'Masuk hanya saat musuh Stun untuk memaksimalkan pasif +35% DMG.'],
      ['Corin Caesar Meta', 'META', ['Corin', 'Qingyi', 'Caesar King'], 'Stun multiplier tinggi + perisai.'],
    ],
  },
  anton: {
    role: 'Shock Burst Electric Attack DPS',
    talent: 'Core Skill > Basic Attack > EX Special > Ultimate',
    set: '4pc Thunder Metal + 2pc Woodpecker Electro',
    stats: ['CRIT Rate / CRIT DMG', 'Electric DMG', 'ATK%'],
    subs: 'CRIT Rate / CRIT DMG > ATK%',
    weapons: [
      ['Starlight Engine', 'A', 'F2P', 'Box Galaxy (Craftable Gratis R5)', 'ATK% konsisten saat masuk Burst.'],
      ['Drill Rig - Red Axis', 'A', 'F2P', 'Gacha A-Rank (Signature)', 'Energy Regen + Electric Basic DMG.'],
    ],
    teams: [
      ['Electric Shock F2P', 'F2P', ['Anton', 'Anby Demara', 'Rina'], 'Shock memperbesar damage bor Anton.'],
      ['Anton Qingyi Astra', 'META', ['Anton', 'Qingyi', 'Astra Yao'], 'Quick Assist + stun window.'],
    ],
  },
  ben: {
    role: 'Fire Shielder / Counter',
    talent: 'Core Skill > EX Special > Ultimate',
    set: '4pc Proto Punk + 2pc Soul Rock',
    stats: ['DEF%', 'DEF% / Fire DMG', 'Energy Regen / DEF%'],
    subs: 'DEF% (konversi ke ATK & Shield) > CRIT DMG',
    weapons: [
      ['Big Cylinder', 'A', 'F2P', 'Gacha A-Rank (Signature)', 'DEF% + counter CRIT otomatis.'],
      ['Original Transmorpher', 'A', 'F2P', 'Box Galaxy (Craftable Gratis)', 'Opsi gratis yang mudah R5.'],
    ],
    teams: [
      ['Belobog Fire F2P', 'F2P', ['Soldier 11', 'Koleda', 'Ben'], 'Buff +16% CRIT Rate tim selama perisai aktif + combo Koleda.'],
      ['Fire Tank', 'META', ['Soldier 11', 'Ben', 'Lucy'], 'Tim Fire paling aman untuk pemula.'],
    ],
  },
  pulchra: {
    role: 'Off-Field Physical Stunner (Aftershock)',
    talent: 'Core Skill > EX Special > Basic Attack',
    set: '4pc Shadow Harmony + 2pc Shockstar Disco',
    alt: '4pc King of the Summit',
    stats: ['CRIT Rate / ATK%', 'Physical DMG', 'Impact'],
    subs: 'Impact > CRIT Rate / DMG > ATK%',
    weapons: [
      ['Box Cutter', 'A', 'F2P', 'Event / Gacha A-Rank (Signature)', 'Daze & Physical DMG dari serangan Aftershock.'],
      ['Steam Oven', 'A', 'F2P', 'Box Galaxy (Craftable Gratis)', 'Alternatif gratis untuk Energy Regen + Impact.'],
    ],
    teams: [
      ['Aftershock F2P', 'F2P', ['Soldier 0 - Anby', 'Pulchra', 'Nicole Demara'], 'Stunner off-field A-Rank terbaik untuk tim Aftershock/Rupture.'],
      ['Yixuan Budget', 'META', ['Yixuan', 'Pan Yinhu', 'Pulchra'], 'Stun tanpa mengganggu field time Yixuan.'],
    ],
  },
  'pan-yinhu': {
    role: 'Rupture Sheer Force Support / Healer',
    talent: 'Core Skill > EX Special > Ultimate',
    set: '4pc Astral Voice + 2pc Swing Jazz',
    stats: ['ATK%', 'ATK%', 'Energy Regen / ATK%'],
    subs: 'ATK% (target ~3.000 ATK untuk buff Sheer Force maks) > Energy Regen',
    weapons: [
      ['Tremor Trigram Vessel', 'A', 'F2P', 'Gacha A-Rank (Signature)', 'ATK% + energi untuk EX Special & Ultimate.'],
      ['Original Transmorpher', 'A', 'F2P', 'Box Galaxy (Craftable Gratis)', 'Opsi craftable bila belum punya signature.'],
    ],
    teams: [
      ['Yixuan Rupture F2P', 'F2P', ['Yixuan', 'Pan Yinhu', 'Pulchra'], 'Buffer khusus Rupture terbaik di kelas A-Rank.'],
      ['Rupture Core', 'META', ['Yixuan', 'Ju Fufu', 'Pan Yinhu'], 'Buff Sheer Force + heal tim instan.'],
    ],
  },
};

// ======================== SMART FALLBACK GENERATORS ========================

function genshinFallback(character: Character): CompactGuide {
  const el = character.element;
  const wp = character.weaponOrSpecialty;

  const weaponMap: Record<string, CompactWeapon[]> = {
    Sword: [
      ['Finale of the Deep', '4★', 'F2P', 'Craftable Fontaine (Gratis)', 'ATK% besar untuk DPS bila ada healer di tim.'],
      ['Favonius Sword', '4★', 'F2P', 'Quest Mondstadt / Gacha 4★', 'Opsi universal terbaik untuk Support/Sub-DPS & baterai tim.'],
      ['Iron Sting', '4★', 'F2P', 'Craftable Blacksmith (Gratis)', 'Alternatif EM untuk karakter reaksi (Swirl/Dendro/Vape).'],
    ],
    Claymore: [
      ['Tidal Shadow', '4★', 'F2P', 'Craftable Fontaine (Gratis)', 'ATK% tinggi & konsisten saat menerima heal.'],
      ['Earth Shaker', '4★', 'F2P', 'Craftable Natlan (Gratis)', 'Bonus Skill DMG untuk DPS/Sub-DPS berbasis reaksi Pyro.'],
      ['Favonius Greatsword', '4★', 'F2P', 'Gacha 4★', 'Solusi ER terbaik untuk karakter Support.'],
    ],
    Polearm: [
      ['The Catch', '4★', 'F2P', 'Fishing Inazuma (Gratis R5)', 'Senjata F2P terbaik untuk karakter berbasis Burst.'],
      ['Favonius Lance', '4★', 'F2P', 'Gacha 4★', 'Universal untuk Support/Sub-DPS yang butuh energi.'],
      ['White Tassel', '3★', 'F2P', 'Chest Liyue (Gratis R5)', 'Kuat untuk DPS berbasis Normal Attack.'],
    ],
    Bow: [
      ['Favonius Warbow', '4★', 'F2P', 'Quest Mondstadt (Gratis)', 'Opsi energi terbaik untuk Support & Sub-DPS.'],
      ['Song of Stillness', '4★', 'F2P', 'Craftable Fontaine (Gratis)', 'ATK% & DMG Bonus solid untuk DPS dengan healer.'],
      ['Chain Breaker', '4★', 'F2P', 'Craftable Natlan (Gratis)', 'ATK% & EM untuk tim multi-elemen.'],
    ],
    Catalyst: [
      ['Flowing Purity', '4★', 'F2P', 'Craftable Fontaine (Gratis)', 'ATK% & Elemental DMG tinggi untuk DPS Catalyst.'],
      ['Prototype Amber', '4★', 'F2P', 'Craftable Blacksmith (Gratis)', 'HP%, energi, dan heal tim untuk Support/HP-scaler.'],
      ['Thrilling Tales of Dragon Slayers', '3★', 'F2P', 'Gacha 3★ (Mudah R5)', 'Buff +48% ATK gratis ke Main DPS.'],
    ],
  };

  const setByElement: Record<string, { set: string; alt: string; goblet: string; teamF2P: string[]; teamMeta: string[]; teamNote: string }> = {
    Pyro: { set: '4pc Crimson Witch of Flames / 4pc Obsidian Codex', alt: '4pc Emblem of Severed Fate', goblet: 'Pyro DMG', teamF2P: [character.name, 'Xingqiu', 'Sucrose', 'Bennett'], teamMeta: [character.name, 'Furina', 'Xilonen', 'Bennett'], teamNote: 'Vaporize / Melt konsisten dengan buffer ATK & shred.' },
    Hydro: { set: '4pc Marechaussee Hunter / 4pc Emblem', alt: '4pc Heart of Depth', goblet: 'Hydro DMG / HP%', teamF2P: [character.name, 'Xiangling', 'Sucrose', 'Bennett'], teamMeta: [character.name, 'Furina', 'Kaedehara Kazuha', 'Xilonen'], teamNote: 'Sinergi Vaporize atau Double Hydro.' },
    Cryo: { set: '4pc Blizzard Strayer / 4pc Marechaussee', alt: '4pc Emblem of Severed Fate', goblet: 'Cryo DMG', teamF2P: [character.name, 'Xingqiu', 'Rosaria', 'Sucrose'], teamMeta: [character.name, 'Escoffier', 'Furina', 'Shenhe'], teamNote: 'Freeze modern atau Reverse Melt dengan Xiangling + Bennett.' },
    Electro: { set: '4pc Golden Troupe / 4pc Thundering Fury', alt: '4pc Emblem of Severed Fate', goblet: 'Electro DMG', teamF2P: [character.name, 'Fischl', 'Yaoyao', 'Sucrose'], teamMeta: [character.name, 'Fischl', 'Nahida', 'Kaedehara Kazuha'], teamNote: 'Aggravate cepat atau Overload bersama Chevreuse.' },
    Anemo: { set: '4pc Viridescent Venerer', alt: '4pc Desert Pavilion Chronicle (DPS)', goblet: 'Anemo DMG / EM', teamF2P: [character.name, 'Xiangling', 'Xingqiu', 'Bennett'], teamMeta: [character.name, 'Faruzan', 'Furina', 'Bennett'], teamNote: 'Shred VV 40% atau Hypercarry Anemo dengan Faruzan.' },
    Geo: { set: '4pc Husk of Opulent Dreams / 4pc Nighttime Whispers', alt: '4pc Scroll of the Hero of Cinder City', goblet: 'Geo DMG', teamF2P: [character.name, 'Kachina', 'Xiangling', 'Bennett'], teamMeta: [character.name, 'Xilonen', 'Furina', 'Bennett'], teamNote: 'Resonansi Geo + Crystallize atau buff Cinder City.' },
    Dendro: { set: '4pc Deepwood Memories / 4pc Gilded Dreams', alt: '2pc EM + 2pc EM', goblet: 'Dendro DMG / EM', teamF2P: [character.name, 'Xingqiu', 'Kuki Shinobu', 'Fischl'], teamMeta: [character.name, 'Nahida', 'Furina', 'Kuki Shinobu'], teamNote: 'Quickbloom / Spread dengan Deepwood shred 30%.' },
  };

  const cfg = setByElement[el] ?? {
    set: '4pc Emblem of Severed Fate / 4pc Noblesse Oblige',
    alt: '4pc Deepwood Memories',
    goblet: 'Elemental DMG / ATK%',
    teamF2P: [character.name, 'Xingqiu', 'Fischl', 'Bennett'],
    teamMeta: [character.name, 'Furina', 'Xilonen', 'Bennett'],
    teamNote: 'Komposisi fleksibel yang mudah disesuaikan dengan role utama karakter.',
  };

  return {
    role: `${el !== 'None' ? `${el} ` : ''}${wp} (Panduan Umum)`,
    talent: 'Skill / Burst utama > Normal Attack',
    set: cfg.set,
    alt: cfg.alt,
    stats: ['ATK% / ER% / EM', cfg.goblet, 'CRIT Rate / CRIT DMG'],
    subs: 'ER (secukupnya) > CRIT Rate / DMG > ATK% / EM',
    weapons: weaponMap[wp] ?? weaponMap.Sword!,
    teams: [
      [`${el} F2P Core`, 'F2P', cfg.teamF2P, cfg.teamNote],
      [`${el} Meta Flex`, 'META', cfg.teamMeta, 'Kombinasi buffer universal terkuat untuk memaksimalkan DPS.'],
    ],
  };
}

function zzzFallback(character: Character): CompactGuide {
  const el = character.element;
  const spec = character.weaponOrSpecialty;
  const dmgStat = `${el} DMG / PEN Ratio`;

  const bySpec: Record<string, CompactGuide> = {
    Attack: {
      role: `${el} Attack DPS (Panduan Umum)`,
      talent: 'Core Skill > Basic Attack / EX Special > Ultimate',
      set: '4pc Woodpecker Electro + 2pc Branch & Blade Song',
      alt: '4pc Hormone Punk',
      stats: ['CRIT Rate / CRIT DMG', dmgStat, 'ATK%'],
      subs: 'CRIT Rate / CRIT DMG > ATK%',
      weapons: [
        ['Starlight Engine', 'A', 'F2P', 'Box Galaxy (Craftable Gratis R5)', 'W-Engine Attack F2P terbaik: ATK% aktif dari Dodge Counter & Quick Assist.'],
        ['Marcato Desire', 'A', 'F2P', 'Event 1.4 (Gratis jika punya)', 'Stat CRIT Rate + bonus ATK% saat musuh kena Anomaly/Stun.'],
        ['The Brimstone', 'S', 'BIS', 'S-Rank Standard', 'Opsi universal ATK% tertinggi.'],
      ],
      teams: [
        ['Attack Stun F2P', 'F2P', [character.name, 'Anby Demara', 'Nicole Demara'], 'Stunner + DEF shred Nicole cocok untuk semua Attack DPS.'],
        ['Attack Meta Core', 'META', [character.name, 'Lighter', 'Astra Yao'], 'Buff ATK/DMG + Quick Assist konstan.'],
      ],
    },
    Anomaly: {
      role: `${el} Anomaly DPS (Panduan Umum)`,
      talent: 'Core Skill > EX Special > Basic Attack > Ultimate',
      set: '4pc Chaos Jazz + 2pc Freedom Blues',
      stats: ['Anomaly Proficiency', dmgStat, 'Anomaly Mastery'],
      subs: 'Anomaly Proficiency > ATK% > PEN',
      weapons: [
        ['Weeping Gemini', 'A', 'F2P', 'Box Galaxy (Craftable Gratis R5)', 'Tumpukan Anomaly Proficiency terbaik untuk Disorder F2P.'],
        ['Rainforest Gourmet', 'A', 'F2P', 'Box Galaxy (Craftable Gratis)', 'Bonus ATK% stabil saat memakai EX Special.'],
        ['Fusion Compiler', 'S', 'BIS', 'S-Rank Standard', 'PEN Ratio + Anomaly Proficiency.'],
      ],
      teams: [
        ['Anomaly Disorder F2P', 'F2P', [character.name, 'Piper', 'Lucy'], 'Kombo Disorder murah dengan buff ATK Lucy.'],
        ['Anomaly Meta Core', 'META', [character.name, 'Burnice White', 'Astra Yao'], 'Off-field Anomaly memicu Disorder terus-menerus.'],
      ],
    },
    Stun: {
      role: `${el} Stunner (Panduan Umum)`,
      talent: 'Core Skill > EX Special > Basic Attack',
      set: '4pc Shockstar Disco + 2pc Swing Jazz',
      alt: '4pc King of the Summit',
      stats: ['CRIT Rate / ATK%', dmgStat, 'Impact'],
      subs: 'Impact > Energy Regen > CRIT Rate',
      weapons: [
        ['Steam Oven', 'A', 'F2P', 'Box Galaxy (Craftable Gratis R5)', 'Energy Regen + Impact tambahan untuk stun lebih cepat.'],
        ['Precious Fossilized Core', 'A', 'F2P', 'Box Galaxy (Craftable Gratis)', 'Daze ekstra tinggi saat HP musuh >50%.'],
        ['Hellfire Gears', 'S', 'BIS', 'S-Rank Standard', 'Impact & off-field Energy Regen tinggi.'],
      ],
      teams: [
        ['Stun Burst F2P', 'F2P', ['Billy', character.name, 'Nicole Demara'], 'Buka jendela Stun lalu habisi dengan DPS + DEF shred.'],
        ['Stun Meta Core', 'META', ['Evelyn', character.name, 'Astra Yao'], 'Partner untuk Attack/Rupture carry.'],
      ],
    },
    Support: {
      role: `${el} Support Buffer (Panduan Umum)`,
      talent: 'Core Skill > EX Special > Ultimate',
      set: '4pc Astral Voice + 2pc Swing Jazz',
      stats: ['ATK% / Anomaly Proficiency', 'ATK% / PEN Ratio', 'Energy Regen'],
      subs: 'Energy Regen > ATK%',
      weapons: [
        ['Slice of Time', 'A', 'F2P', 'Box Galaxy (Craftable Gratis R5)', 'PEN Ratio + energi & Decibel tambahan untuk tim.'],
        ['Kaboom the Cannon', 'A', 'F2P', 'Gacha A-Rank', 'Energy Regen + stack ATK% seluruh tim.'],
        ['Weeping Cradle', 'S', 'BIS', 'S-Rank Standard', 'Energy Regen off-field + buff DMG tim.'],
      ],
      teams: [
        ['Support Flex F2P', 'F2P', ['Harumasa', 'Anby Demara', character.name], 'Masuk ke tim DPS manapun untuk buff & Quick Assist.'],
        ['Hypercarry Meta', 'META', ['Miyabi', 'Yanagi', character.name], 'Maksimalkan damage tim utama.'],
      ],
    },
    Rupture: {
      role: `${el} Rupture DPS (Panduan Umum)`,
      talent: 'Core Skill > Ultimate > EX Special > Basic Attack',
      set: '4pc Yunkui Tales + 2pc Woodpecker Electro',
      stats: ['CRIT Rate / CRIT DMG', `${el} DMG / HP%`, 'HP%'],
      subs: 'CRIT Rate / CRIT DMG > HP%',
      weapons: [
        ['Puzzle Sphere', 'A', 'F2P', 'Box Galaxy (Craftable Gratis R5)', 'Rupture W-Engine F2P terbaik: CRIT DMG + EX Special DMG.'],
        ['Radiowave Journey', 'A', 'ALT', 'Battle Pass', 'HP% + bonus Sheer Force.'],
      ],
      teams: [
        ['Rupture F2P', 'F2P', [character.name, 'Pan Yinhu', 'Pulchra'], 'Pan Yinhu buff Sheer Force + Pulchra off-field stun.'],
        ['Rupture Meta Core', 'META', [character.name, 'Ju Fufu', 'Astra Yao'], 'Off-field stun + buff Ultimate & CRIT DMG.'],
      ],
    },
    Defense: {
      role: `${el} Defense / Shielder (Panduan Umum)`,
      talent: 'Core Skill > EX Special > Assist',
      set: '4pc Proto Punk + 2pc Swing Jazz',
      stats: ['ATK% / DEF%', 'ATK% / DEF%', 'Impact / Energy Regen'],
      subs: 'ATK% atau DEF% (sesuai scaling perisai) > Energy Regen',
      weapons: [
        ['Original Transmorpher', 'A', 'F2P', 'Box Galaxy (Craftable Gratis R5)', 'HP% & Impact gratis dari Box Galaxy.'],
        ['Spring Embrace', 'A', 'F2P', 'Gacha A-Rank', 'Energy Regen + damage reduction.'],
      ],
      teams: [
        ['Defense Flex F2P', 'F2P', ['Piper', character.name, 'Lucy'], 'Perisai anti-interupsi untuk pertarungan sulit.'],
        ['Defense Meta Core', 'META', ['Jane Doe', 'Burnice White', character.name], 'Aman untuk konten Endless Tower.'],
      ],
    },
  };

  return bySpec[spec] ?? bySpec.Attack!;
}

export function getCharacterBuildGuide(character: Character): CharacterBuildGuide {
  const curated = CURATED_GUIDES[character.id];
  if (curated) return expandGuide(character.game, curated, false);
  const fallback = character.game === 'GENSHIN_IMPACT' ? genshinFallback(character) : zzzFallback(character);
  return expandGuide(character.game, fallback, true);
}

export function getPrimaryF2PWeapon(guide: CharacterBuildGuide): WeaponRecommendation {
  return guide.weapons.find(weapon => weapon.tier === 'F2P') ?? guide.weapons[0]!;
}

export function formatSubStatsSummary(guide: CharacterBuildGuide): string {
  const { slot1Label, slot1, slot2Label, slot2, slot3Label, slot3 } = guide.mainStats;
  return `${slot1Label}: ${slot1} · ${slot2Label}: ${slot2} · ${slot3Label}: ${slot3} | Sub: ${guide.subStats}`;
}
