'use client';

import type { GameType } from '../types/kanban';

function rarityClass(rarity: string) {
  const r = rarity.toUpperCase();
  if (r.includes('5') || r === 'S') return 'rarity-gold';
  if (r.includes('4') || r === 'A') return 'rarity-purple';
  return 'rarity-blue';
}

export function WeaponIcon({
  game,
  weaponType,
  rarity,
}: {
  game: GameType;
  weaponType: string;
  rarity: string;
}) {
  const type = weaponType.toLowerCase();
  return (
    <span className={`gear-icon ${rarityClass(rarity)}`} aria-hidden="true">
      {game === 'ZENLESS_ZONE_ZERO' ? (
        // ZZZ W-Engine iconic spherical core + outer ring
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="8.5" />
          <circle cx="12" cy="12" r="3.5" />
          <path d="M12 3.5v2.5 M12 18v2.5 M3.5 12H6 M18 12h2.5" />
          <path d="M7.5 7.5 9.2 9.2 M14.8 14.8 16.5 16.5" />
        </svg>
      ) : type === 'claymore' ? (
        // Broadsword / Claymore
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
          <path d="M19.5 4.5 17 11l-6 6-3-3 6-6 5.5-3.5Z" />
          <path d="M7.5 13.5 10.5 16.5" />
          <path d="M5 19l3.5-3.5 M4 16.5 7.5 20" />
        </svg>
      ) : type === 'polearm' ? (
        // Spear / Polearm
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 20 16 8" />
          <path d="M14 6l6-2-2 6-4-4Z" />
          <path d="M12.5 9.5 14.5 11.5" />
        </svg>
      ) : type === 'bow' ? (
        // Bow + Arrow
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
          <path d="M6 18C5 11 11 5 18 6" />
          <path d="M6 18 18 6" />
          <path d="M10 14 19 5 M15 5h4v4" />
        </svg>
      ) : type === 'catalyst' ? (
        // Catalyst Tome / Orb
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
          <path d="M5 5.5A2.5 2.5 0 0 1 7.5 3H19v16H7.5A2.5 2.5 0 0 0 5 21V5.5Z" />
          <path d="M5 18.5A2.5 2.5 0 0 1 7.5 16H19" />
          <circle cx="12.5" cy="9.5" r="2" />
        </svg>
      ) : (
        // Sword (default Genshin)
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
          <path d="M19.5 4.5 18 9l-8 8-3-3 8-8 4.5-1.5Z" />
          <path d="M6.5 13.5 10.5 17.5" />
          <path d="M4.5 19.5 8 16" />
        </svg>
      )}
    </span>
  );
}

export function ArtifactSetIcon({ game }: { game: GameType }) {
  return (
    <span className="gear-icon rarity-gold" aria-hidden="true">
      {game === 'ZENLESS_ZONE_ZERO' ? (
        // ZZZ Drive Disc (vinyl disc with grooves & center hole)
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="9" />
          <circle cx="12" cy="12" r="2.5" />
          <path d="M7.8 7.8a6 6 0 0 1 6.4-1.3 M16.2 16.2a6 6 0 0 1-6.4 1.3" />
        </svg>
      ) : (
        // Genshin Artifact Relic Flower
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="2.5" />
          <path d="M12 3.5c2 2.2 2 4.3 0 6-2-1.7-2-3.8 0-6Z" />
          <path d="M12 20.5c2-2.2 2-4.3 0-6-2 1.7-2 3.8 0 6Z" />
          <path d="M3.5 12c2.2-2 4.3-2 6 0-1.7 2-3.8 2-6 0Z" />
          <path d="M20.5 12c-2.2-2-4.3-2-6 0 1.7 2 3.8 2 6 0Z" />
        </svg>
      )}
    </span>
  );
}

export function SlotIcon({ label }: { label: string }) {
  const lower = label.toLowerCase();
  if (lower.includes('sands')) {
    return (
      <svg className="slot-svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M6 3h12 M6 21h12 M7 3c0 5 5 6 5 9s-5 4-5 9 M17 3c0 5-5 6-5 9s5 4 5 9" />
      </svg>
    );
  }
  if (lower.includes('goblet')) {
    return (
      <svg className="slot-svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M7 4h10v5a5 5 0 0 1-10 0V4Z M12 14v6 M8 20h8" />
      </svg>
    );
  }
  if (lower.includes('circlet')) {
    return (
      <svg className="slot-svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M4 17 6 7l6 4 6-4 2 10H4Z" />
      </svg>
    );
  }
  // ZZZ Disc 4 / 5 / 6
  return (
    <svg className="slot-svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="8" />
      <circle cx="12" cy="12" r="2.5" />
    </svg>
  );
}
