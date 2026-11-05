import { describe, expect, it } from 'vitest';
import { linkedPlaces, normalizePlace, schoolYearLabel, searchPlaces } from './towns';
import type { TownPlace, Towns } from './types';

const place = (id: string, kind: TownPlace['kind'] = 'town'): TownPlace => ({ id, name: id, kind, aid: {} });
const acton = place('ACTON');
const towns: Towns = {
  years: [2027],
  totals: {},
  places: [acton, place('ACTON BOXBOROUGH', 'district'), place('BOXBOROUGH'), place('NORTH ADAMS'), place('ADAMS'), place('ADAMS CHESHIRE', 'district')],
};

describe('towns', () => {
  it('normalizes typed names', () => {
    expect(normalizePlace('  Manchester-by-the-Sea ')).toBe('manchester by the sea');
  });
  it('puts names that start with the query first', () => {
    expect(searchPlaces(towns, 'adams').map((p) => p.id)).toEqual(['ADAMS', 'ADAMS CHESHIRE', 'NORTH ADAMS']);
    expect(searchPlaces(towns, '')).toEqual([]);
  });
  it('follows membership links and skips places that are not listed', () => {
    const links = [{ id: 'ACTON BOXBOROUGH', students: 3783 }, { id: 'NOT LISTED', students: 2 }];
    expect(linkedPlaces(towns, links).map((l) => [l.place.id, l.students])).toEqual([['ACTON BOXBOROUGH', 3783]]);
    expect(linkedPlaces(towns, undefined)).toEqual([]);
  });
  it('labels school years', () => {
    expect(schoolYearLabel(2026)).toBe('2025–26');
    expect(schoolYearLabel(2000)).toBe('1999–00');
  });
});
