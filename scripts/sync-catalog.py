#!/usr/bin/env python3
"""Fetch public game catalogs and publish a validated, offline-safe UI snapshot.

Python stdlib only. Run: python3 scripts/sync-catalog.py
Downloads are cached for 24 hours in /tmp/hoyokanban-catalog.
"""
import concurrent.futures
import datetime
import hashlib
import json
import pathlib
import re
import time
import urllib.request

ROOT = pathlib.Path(__file__).resolve().parents[1]
CACHE = pathlib.Path('/tmp/hoyokanban-catalog')
CACHE.mkdir(exist_ok=True)
GI = 'GENSHIN_IMPACT'
ZZZ = 'ZENLESS_ZONE_ZERO'
DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']


def fetch(url, binary=False):
    path = CACHE / hashlib.sha256(url.encode()).hexdigest()
    if not path.exists() or time.time() - path.stat().st_mtime > 86400:
        for attempt in range(3):
            try:
                req = urllib.request.Request(url, headers={'User-Agent': 'HoyoKanban/1.0 (public catalog sync)'})
                with urllib.request.urlopen(req, timeout=45) as response:
                    data = response.read()
                if not binary:
                    json.loads(data)
                path.write_bytes(data)
                break
            except Exception as error:
                if attempt == 2:
                    raise RuntimeError(f'Fetch failed: {url}: {error}') from error
                time.sleep(attempt + 1)
    return path.read_bytes() if binary else json.loads(path.read_bytes())


def slug(name):
    return re.sub(r'[^a-z0-9]+', '-', name.lower()).strip('-')


def main():
    base = 'https://genshin-db-api.vercel.app/api/v5/'
    gi = {folder: fetch(base + folder + '?query=names&matchCategories=true&verboseCategories=true')
          for folder in ['characters', 'materials', 'talents', 'domains', 'weapons']}
    assert len(gi['characters']) >= 100 and len(gi['materials']) >= 800, 'Incomplete Genshin response'
    mats = {m['id']: m for m in gi['materials']}
    domains = {d['id']: d for d in gi['domains']}
    talents = {t['name']: t for t in gi['talents']}
    # Match two catalogs; availability still follows community sources, not an official release guarantee.
    home = fetch('https://zzz.nanoka.cc/', binary=True).decode()
    version = re.search(r'static\.nanoka\.cc/zzz/([^/]+)/', home).group(1)
    zbase = 'https://static.nanoka.cc/zzz/' + version + '/'
    zchars = fetch(zbase + 'character.json')
    zmats = fetch(zbase + 'en/item.json')
    enka = fetch('https://raw.githubusercontent.com/EnkaNetwork/API-docs/master/store/zzz/avatars.json')
    ids = sorted(zchars.keys() & enka.keys())
    assert len(ids) >= 40, 'Incomplete ZZZ response'
    with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
        details = list(pool.map(lambda id: fetch(zbase + 'en/character/' + id + '.json'), ids))
    characters, targets = [], {}

    def target(id, name, game, category, icon, days, location, character_id):
        assert name and icon and all(day in range(7) for day in days)
        entry = targets.setdefault(id, dict(id=id, name=name, game=game, category=category,
            iconUrl=icon, days=days, location=location, characterIds=[]))
        if character_id and character_id not in entry['characterIds']:
            entry['characterIds'].append(character_id)

    for c in gi['characters']:
        id = slug(c['name'])
        costs = [v for rows in c.get('costs', {}).values() for v in rows]
        tc = talents.get(c['name'], {}).get('costs', {})
        # Traveler talent materials vary by element. Keep every sourced element rather than guess one.
        if c['name'] in ['Aether', 'Lumine']:
            tc = {f'{name}-{level}': rows for name, t in talents.items() if name.startswith('Traveler (')
                  for level, rows in t.get('costs', {}).items()}
        skill_costs = [v for rows in tc.values() for v in rows]
        books, bosses, weeklies = [], [], []
        seen = set()
        for item, kind in [(i, 'ascension') for i in costs] + [(i, 'talent') for i in skill_costs]:
            m = mats.get(item['id'])
            if not m:
                raise ValueError(f'Missing material {item["id"]}')
            category = None
            if kind == 'talent' and m.get('daysOfWeek'):
                # All three rarities share a domain; only the lowest tier becomes the farming row.
                category = 'talent'
                family = m.get('dropDomainName', m['name'])
                if family in seen:
                    continue
                seen.add(family)
                books.append(m['name'])
            elif str(m['id']).startswith('113'):
                category = 'boss' if kind == 'ascension' else 'weekly'
                (bosses if kind == 'ascension' else weeklies).append(m['name'])
            elif kind == 'ascension' and 'Local Specialty' in m.get('typeText', ''):
                category = 'specialty'
            if not category:
                continue
            domain = domains.get(m.get('dropDomainId'), {})
            location = domain.get('entranceName') or ' · '.join(m.get('sources', [])[:2]) or 'Lihat sumber material di dalam game'
            target(f'gi-{m["id"]}', m['name'], GI, category,
                'https://gi.yatta.moe/assets/UI/' + m['images']['filename_icon'] + '.png',
                [DAYS.index(d) for d in m.get('daysOfWeek', DAYS)], location, id)
        characters.append(dict(id=id, name=c['name'], game=GI, rarity=c['rarity'], element=c['elementText'],
            weaponOrSpecialty=c['weaponText'], avatarUrl='https://enka.network/ui/' + c['images']['filename_icon'] + '.png',
            bossMaterial=', '.join(dict.fromkeys(bosses)), talentBookOrChip=', '.join(dict.fromkeys(books)),
            weeklyBossDrop=', '.join(dict.fromkeys(weeklies)), specialtyOrFaction=c.get('region', ''),
            sourceId=str(c['id'])))

    for weapon in gi['weapons']:
        seen = set()
        for rows in weapon.get('costs', {}).values():
            for item in rows:
                m = mats[item['id']]
                family = m.get('dropDomainName')
                if not m.get('daysOfWeek') or not family or family in seen:
                    continue
                seen.add(family)
                mid = f'gi-{m["id"]}'
                target(mid, m['name'], GI, 'weapon', 'https://gi.yatta.moe/assets/UI/' + m['images']['filename_icon'] + '.png',
                    [DAYS.index(day) for day in m['daysOfWeek']], domains.get(m.get('dropDomainId'), {}).get('entranceName', family), None)
                targets[mid].setdefault('weaponNames', []).append(weapon['name'])

    # Preserve identifiers used by existing saved cards.
    old_names = {'1011': 'Anby Demara', '1031': 'Nicole Demara', '1191': 'Ellen Joe',
                 '1071': 'Caesar King', '1171': 'Burnice White', '1261': 'Jane Doe'}
    for c in details:
        name = old_names.get(str(c['id']), c['name'])
        id = slug(name)
        materials = {'ascension': [x['materials'] for x in c['level'].values()],
                     'talent': list(c['skill']['basic']['material'].values()),
                     'core': list(c['passive']['materials'].values())}
        labels = {'ascension': [], 'talent': [], 'boss': [], 'weekly': []}
        for kind, rows in materials.items():
            for mid in dict.fromkeys(mid for row in rows for mid in row):
                m = zmats[mid]
                if mid == '10' or (kind in ['ascension', 'talent'] and m['rank'] != 1):
                    continue
                category = ('boss' if mid.startswith('1105') else 'weekly') if kind == 'core' else kind
                labels[category].append(m['name'])
                icon = pathlib.PurePosixPath(m['icon']).stem
                location = 'Expert Challenge' if category == 'boss' else 'Notorious Hunt' if category == 'weekly' else 'HIA Club · Combat Simulation'
                target('zzz-' + mid, m['name'], ZZZ, category,
                    'https://static.nanoka.cc/assets/zzz/' + icon + '.webp', list(range(7)), location, id)
        characters.append(dict(id=id, name=name, game=ZZZ, rarity='S' if c['rarity'] == 4 else 'A',
            element=' / '.join(c['element_type'].values()), weaponOrSpecialty=' / '.join(c['weapon_type'].values()),
            avatarUrl='https://enka.network' + enka[str(c['id'])]['CircleIcon'],
            bossMaterial=', '.join(labels['boss']), talentBookOrChip=', '.join(labels['talent']),
            weeklyBossDrop=', '.join(labels['weekly']), specialtyOrFaction=' / '.join(c['camp'].values()), sourceId=str(c['id'])))

    assert len({c['id'] for c in characters}) == len(characters), 'Duplicate character identifier'
    assert all(c['name'] and c['rarity'] in [4, 5, 'A', 'S'] for c in characters)
    # Store original, unmodified image bytes locally: reliable icons without per-request CDN calls.
    assets = ROOT / 'apps/web/public/catalog'
    assets.mkdir(parents=True, exist_ok=True)
    def image_job(entry):
        field = 'avatarUrl' if 'avatarUrl' in entry else 'iconUrl'
        url = entry[field]
        extension = '.webp' if url.endswith('.webp') else '.png'
        filename = ('char-' if field == 'avatarUrl' else 'mat-') + entry['id'] + extension
        data = fetch(url, binary=True)
        assert data.startswith(b'\x89PNG') or data.startswith(b'RIFF'), f'Invalid image: {url}'
        (assets / filename).write_bytes(data)
        entry[field] = '/catalog/' + filename
    with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
        list(pool.map(image_job, characters + list(targets.values())))
    result = dict(fetchedAt=datetime.datetime.now(datetime.timezone.utc).isoformat(),
        sources=[dict(name='genshin-db', url='https://github.com/theBowja/genshin-db', characters=len(gi['characters']), materials=len(gi['materials'])),
                 dict(name='Nanoka + Enka', url='https://zzz.nanoka.cc/', version=version, characters=len(details), materials=len(zmats))],
        characters=characters, farming=list(targets.values()))
    path = ROOT / 'apps/web/src/data/catalog.json'
    temporary = path.with_suffix('.tmp')
    temporary.write_text(json.dumps(result, ensure_ascii=False, separators=(',', ':')) + '\n')
    temporary.replace(path)
    print(f'Published {len(characters)} characters, {len(targets)} farming targets; ZZZ {version}.')


if __name__ == '__main__':
    main()
