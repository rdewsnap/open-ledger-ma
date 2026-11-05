import { describe, expect, it } from 'vitest';
import { districtsNamedFor, normalizePlace, searchPlaces } from './towns';
import type { TownPlace, Towns } from './types';

const place = (id: string, kind: TownPlace['kind'] = 'town'): TownPlace => ({ id, name: id, kind, aid: {} });
const acton = place('ACTON');
const adams = place('ADAMS');
const towns: Towns = {
  years: [2027],
  totals: {},
  places: [acton, place('ACTON BOXBOROUGH', 'district'), place('BOXBOROUGH'), place('NORTH ADAMS'), adams, place('ADAMS CHESHIRE', 'district')],
};

describe('towns', () => {
  it('normalizes typed names', () => {
    expect(normalizePlace('  Manchester-by-the-Sea ')).toBe('manchester by the sea');
  });
  it('puts names that start with the query first', () => {
    expect(searchPlaces(towns, 'adams').map((p) => p.id)).toEqual(['ADAMS', 'ADAMS CHESHIRE', 'NORTH ADAMS']);
    expect(searchPlaces(towns, '')).toEqual([]);
  });
  it('finds districts named for a town by whole words', () => {
    expect(districtsNamedFor(towns, acton).map((p) => p.id)).toEqual(['ACTON BOXBOROUGH']);
    expect(districtsNamedFor(towns, adams).map((p) => p.id)).toEqual(['ADAMS CHESHIRE']);
  });
});
