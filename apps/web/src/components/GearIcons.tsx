'use client';

import { useState } from 'react';
import Image from 'next/image';
import gearIcons from '../data/gearIcons.json';
import type { GameType } from '../types/kanban';

const ICON_MAP = gearIcons as Record<string, string>;

export function normalizeGearName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[\u2018\u2019`]/g, "'")
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

export function resolveWeaponIcon(name: string): string | undefined {
  for (const part of name.split(' / ')) {
    const found = ICON_MAP[normalizeGearName(part)];
    if (found) return found;
  }
  return undefined;
}

export function resolveArtifactIcons(setName: string): { label: string; src: string }[] {
  const cleaned = setName.replace(/\([^)]*\)/g, '');
  const results: { label: string; src: string }[] = [];
  const seen = new Set<string>();
  for (const part of cleaned.split(/\s*(?:\+|\/)\s*/)) {
    const label = part.replace(/^(?:4pc|2pc)\s+/i, '').trim();
    if (!label) continue;
    const src = ICON_MAP[normalizeGearName(label)];
    if (src && !seen.has(src)) {
      seen.add(src);
      results.push({ label, src });
    }
  }
  return results;
}

function rarityClass(rarity: string) {
  const r = rarity.toUpperCase();
  if (r.includes('5') || r === 'S') return 'rarity-gold';
  if (r.includes('4') || r === 'A') return 'rarity-purple';
  return 'rarity-blue';
}

export function WeaponIcon({
  name,
  game,
  weaponType,
  rarity,
}: {
  name: string;
  game: GameType;
  weaponType: string;
  rarity: string;
}) {
  const [failed, setFailed] = useState(false);
  const src = resolveWeaponIcon(name);
  const type = weaponType.toLowerCase();

  return (
    <span className={`gear-icon ${rarityClass(rarity)}`} title={name}>
      {src && !failed ? (
        <Image src={src} alt={name} fill sizes="44px" onError={() => setFailed(true)} />
      ) : game === 'ZENLESS_ZONE_ZERO' ? (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="12" cy="12" r="8.5" />
          <circle cx="12" cy="12" r="3.5" />
          <path d="M12 3.5v2.5 M12 18v2.5 M3.5 12H6 M18 12h2.5" />
        </svg>
      ) : type === 'claymore' ? (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M19.5 4.5 17 11l-6 6-3-3 6-6 5.5-3.5Z M7.5 13.5 10.5 16.5 M5 19l3.5-3.5" />
        </svg>
      ) : type === 'polearm' ? (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M4 20 16 8 M14 6l6-2-2 6-4-4Z" />
        </svg>
      ) : type === 'bow' ? (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M6 18C5 11 11 5 18 6 M6 18 18 6 M10 14 19 5" />
        </svg>
      ) : type === 'catalyst' ? (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M5 5.5A2.5 2.5 0 0 1 7.5 3H19v16H7.5A2.5 2.5 0 0 0 5 21V5.5Z" />
          <circle cx="12.5" cy="9.5" r="2" />
        </svg>
      ) : (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M19.5 4.5 18 9l-8 8-3-3 8-8 4.5-1.5Z M6.5 13.5 10.5 17.5 M4.5 19.5 8 16" />
        </svg>
      )}
    </span>
  );
}

export function ArtifactSetIcon({ setName, game, maxIcons = 2 }: { setName: string; game: GameType; maxIcons?: number }) {
  const icons = resolveArtifactIcons(setName).slice(0, maxIcons);
  if (icons.length === 0) {
    return (
      <span className="gear-icon rarity-gold" aria-hidden="true">
        {game === 'ZENLESS_ZONE_ZERO' ? (
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="9" />
            <circle cx="12" cy="12" r="2.5" />
          </svg>
        ) : (
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="2.5" />
            <path d="M12 3.5c2 2.2 2 4.3 0 6-2-1.7-2-3.8 0-6Z M12 20.5c2-2.2 2-4.3 0-6-2 1.7-2 3.8 0 6Z" />
          </svg>
        )}
      </span>
    );
  }

  return (
    <span className="gear-icon-stack">
      {icons.map(item => (
        <span key={item.src} className="gear-icon rarity-gold" title={item.label}>
          <Image src={item.src} alt={item.label} fill sizes="44px" />
        </span>
      ))}
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
  return (
    <svg className="slot-svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="8" />
      <circle cx="12" cy="12" r="2.5" />
    </svg>
  );
}
