export interface DomainSchedule {
  dayName: string;
  dayIndex: number; // 0 = Sunday, 1 = Monday, etc.
  genshinTalents: string[];
  genshinWeapons: string[];
  zzzFocus: string[];
}

export const DOMAIN_SCHEDULE: Record<number, DomainSchedule> = {
  1: {
    dayName: 'Senin (Monday)',
    dayIndex: 1,
    genshinTalents: ['Freedom (Mondstadt)', 'Prosperity (Liyue)', 'Transience (Inazuma)', 'Admonition (Sumeru)', 'Equity (Fontaine)', 'Contention (Natlan)'],
    genshinWeapons: ['Decarabian', 'Guyun', 'Distant Sea', 'Forest Dew', 'Dross', 'Blazing Sacrificial'],
    zzzFocus: ['Basic Attack Seals', 'Stun Tactical Chips', 'Routine Cleanup: Disc 1/4'],
  },
  2: {
    dayName: 'Selasa (Tuesday)',
    dayIndex: 2,
    genshinTalents: ['Resistance (Mondstadt)', 'Diligence (Liyue)', 'Elegance (Inazuma)', 'Ingenuity (Sumeru)', 'Justice (Fontaine)', 'Kindling (Natlan)'],
    genshinWeapons: ['Boreal Wolf', 'Mist Veiled', 'Narukami', 'Oasis Garden', 'Sublime', 'Night-Wind'],
    zzzFocus: ['Anomaly Tactical Chips', 'Defense Seals', 'Routine Cleanup: Disc 2/5'],
  },
  3: {
    dayName: 'Rabu (Wednesday)',
    dayIndex: 3,
    genshinTalents: ['Ballad (Mondstadt)', 'Gold (Liyue)', 'Light (Inazuma)', 'Praxis (Sumeru)', 'Order (Fontaine)', 'Conflict (Natlan)'],
    genshinWeapons: ['Dandelion Gladiator', 'Aerosiderite', 'Mask', 'Scorching Might', 'Pure Sacred Dewdrop', 'Delirious Divinity'],
    zzzFocus: ['Support Tactical Chips', 'Ether Chips', 'Routine Cleanup: Disc 3/6'],
  },
  4: {
    dayName: 'Kamis (Thursday)',
    dayIndex: 4,
    genshinTalents: ['Freedom (Mondstadt)', 'Prosperity (Liyue)', 'Transience (Inazuma)', 'Admonition (Sumeru)', 'Equity (Fontaine)', 'Contention (Natlan)'],
    genshinWeapons: ['Decarabian', 'Guyun', 'Distant Sea', 'Forest Dew', 'Dross', 'Blazing Sacrificial'],
    zzzFocus: ['Attack Seals', 'Physical Chips', 'Expert Challenge Hunt'],
  },
  5: {
    dayName: 'Jumat (Friday)',
    dayIndex: 5,
    genshinTalents: ['Resistance (Mondstadt)', 'Diligence (Liyue)', 'Elegance (Inazuma)', 'Ingenuity (Sumeru)', 'Justice (Fontaine)', 'Kindling (Natlan)'],
    genshinWeapons: ['Boreal Wolf', 'Mist Veiled', 'Narukami', 'Oasis Garden', 'Sublime', 'Night-Wind'],
    zzzFocus: ['Ice Chips', 'Electric Chips', 'Notorious Hunt Free Tries'],
  },
  6: {
    dayName: 'Sabtu (Saturday)',
    dayIndex: 6,
    genshinTalents: ['Ballad (Mondstadt)', 'Gold (Liyue)', 'Light (Inazuma)', 'Praxis (Sumeru)', 'Order (Fontaine)', 'Conflict (Natlan)'],
    genshinWeapons: ['Dandelion Gladiator', 'Aerosiderite', 'Mask', 'Scorching Might', 'Pure Sacred Dewdrop', 'Delirious Divinity'],
    zzzFocus: ['Fire Chips', 'Specialized Seals', 'Hollow Zero Bounty Runs'],
  },
  0: {
    dayName: 'Minggu (Sunday)',
    dayIndex: 0,
    genshinTalents: ['Semua Domain Talenta Terbuka (Pilihan Bebas)'],
    genshinWeapons: ['Semua Domain Senjata Terbuka (Pilihan Bebas)'],
    zzzFocus: ['Semua Simulasi & Routine Cleanup Terbuka'],
  },
};
