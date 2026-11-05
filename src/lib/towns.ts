import type { TownPlace, Towns } from './types';

/** Lower-case letters and single spaces only, so "Manchester-by-the-Sea" finds "MANCHESTER". */
export function normalizePlace(text: string): string {
  return text.toLowerCase().replace(/[^a-z ]+/g, ' ').replace(/\s+/g, ' ').trim();
}

/** Places matching a typed name: names that start with it first, then names that contain it. */
export function searchPlaces(towns: Towns, query: string, limit = 8): TownPlace[] {
  const q = normalizePlace(query);
  if (!q) return [];
  const starts: TownPlace[] = [];
  const contains: TownPlace[] = [];
  for (const p of towns.places) {
    const name = p.id.toLowerCase();
    if (name.startsWith(q)) starts.push(p);
    else if (name.includes(q)) contains.push(p);
  }
  return [...starts, ...contains].slice(0, limit);
}

/** Regional school districts whose name includes the town's name as whole words. */
export function districtsNamedFor(towns: Towns, town: TownPlace): TownPlace[] {
  return towns.places.filter((p) => p.kind === 'district' && ` ${p.id} `.includes(` ${town.id} `));
}
