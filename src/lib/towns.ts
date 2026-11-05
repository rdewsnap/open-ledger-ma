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

/** The places a town's `districts` or a district's `members` point to, in their listed order. */
export function linkedPlaces(towns: Towns, links: { id: string; students: number }[] | undefined) {
  const byId = new Map(towns.places.map((p) => [p.id, p]));
  return (links ?? []).flatMap((l) => {
    const place = byId.get(l.id);
    return place ? [{ place, students: l.students }] : [];
  });
}

/** School year ending in `year`: 2026 is "2025–26". */
export function schoolYearLabel(year: number): string {
  return `${year - 1}–${String(year % 100).padStart(2, '0')}`;
}
