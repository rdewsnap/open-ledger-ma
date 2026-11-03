import { describe, expect, it } from 'vitest';
import {
  filterRows,
  highlightFromOverlay,
  isHighlighted,
  maxAbsDelta,
  nodeIdsOf,
  resolvePair,
  socrataPairUrl,
  sortRows,
  statusOf,
  summarize,
  toChangeRows,
  type DiffRow,
} from './diff';

const row = (id: string, name: string, path: string, a: number, b: number, extra: Partial<DiffRow> = {}): DiffRow => ({
  id,
  name,
  path,
  enactedA: a,
  enactedB: b,
  actualA: a * 2,
  actualB: b * 2,
  dEnacted: b - a,
  dActual: (b - a) * 2,
  pctEnacted: a ? ((b - a) / a) * 100 : null,
  pctActual: a ? ((b - a) / a) * 100 : null,
  ...extra,
});

const RAW: DiffRow[] = [
  row('prog:40000500', 'MassHealth managed care', 'Health & Human Services › EOHHS & MassHealth', 100, 150, { code: '40000500' }),
  row('prog:15962450', 'Student Opportunity Act', 'Education › Elementary & Secondary Education', 0, 40),
  row('prog:15992625', 'Family shelter reserve', 'Administration & Finance › Executive Office for Administration & Finance', 80, 0),
  row('prog:28100100', 'State parks operations', 'Energy & Environmental Affairs › Conservation & Recreation', 50, 45, { conservation: true }),
  row('prog:other:EEA/DFG', 'Other Fisheries & Wildlife', 'Energy & Environmental Affairs › Fisheries & Wildlife', 10, 12, { conservation: true }),
  row('prog:99999999', 'Zeroed line', 'Statewide obligations › Pensions', 0, 0),
];

describe('toChangeRows', () => {
  const rows = toChangeRows(RAW, 'enacted');
  it('drops programs at $0 in both years', () => {
    expect(rows.map((r) => r.id)).not.toContain('prog:99999999');
    expect(rows).toHaveLength(5);
  });
  it('picks the measure and computes delta and ratio pct', () => {
    const mh = rows.find((r) => r.id === 'prog:40000500')!;
    expect([mh.a, mh.b, mh.delta]).toEqual([100, 150, 50]);
    expect(mh.pct).toBeCloseTo(0.5);
    const spent = toChangeRows(RAW, 'actual').find((r) => r.id === 'prog:40000500')!;
    expect([spent.a, spent.b]).toEqual([200, 300]);
  });
  it('marks new, ended, buckets, accounts and path parts', () => {
    const by = Object.fromEntries(rows.map((r) => [r.id, r]));
    expect(by['prog:15962450']!.status).toBe('new');
    expect(by['prog:15962450']!.pct).toBeNull();
    expect(by['prog:15992625']!.status).toBe('ended');
    expect(by['prog:other:EEA/DFG']!.bucket).toBe(true);
    expect(by['prog:other:EEA/DFG']!.account).toBeNull();
    expect(by['prog:15962450']!.account).toBe('15962450');
    expect(by['prog:28100100']!.sec).toBe('Energy & Environmental Affairs');
    expect(by['prog:28100100']!.dept).toBe('Conservation & Recreation');
  });
});

describe('statusOf', () => {
  it('classifies', () => {
    expect(statusOf(0, 5)).toBe('new');
    expect(statusOf(5, 0)).toBe('ended');
    expect(statusOf(5, 6)).toBe('up');
    expect(statusOf(6, 5)).toBe('down');
    expect(statusOf(5, 5)).toBe('flat');
  });
});

describe('highlight', () => {
  it('derives node ids from bucket ids', () => {
    expect(nodeIdsOf('prog:40000500')).toEqual(['prog:40000500']);
    expect(nodeIdsOf('prog:other:EEA/DFG')).toEqual(['prog:other:EEA/DFG', 'sec:EEA', 'dept:EEA/DFG']);
  });
  it('matches on any node id, never on an empty set', () => {
    expect(isHighlighted(['prog:other:EEA/DFG', 'sec:EEA', 'dept:EEA/DFG'], new Set(['sec:EEA']))).toBe(true);
    expect(isHighlighted(['prog:1'], new Set(['dept:EEA/DCR']))).toBe(false);
    expect(isHighlighted(['prog:1'], new Set())).toBe(false);
  });
  it('derives the set from the overlay flag', () => {
    expect([...highlightFromOverlay(RAW, true)]).toEqual(['prog:28100100', 'prog:other:EEA/DFG']);
    expect(highlightFromOverlay(RAW, false).size).toBe(0);
  });
  it('marks rows from a sec/dept id set', () => {
    const rows = toChangeRows(RAW, 'enacted', new Set(['dept:EEA/DFG']));
    expect(rows.filter((r) => r.highlighted).map((r) => r.id)).toEqual(['prog:other:EEA/DFG']);
  });
});

describe('filterRows', () => {
  const rows = toChangeRows(RAW, 'enacted', highlightFromOverlay(RAW, true));
  const ids = (q: string, cons = false) => filterRows(rows, q, cons).map((r) => r.id);
  it('returns everything for an empty query', () => {
    expect(ids('')).toHaveLength(5);
    expect(ids('   ')).toHaveLength(5);
  });
  it('matches name, department and secretariat, case-insensitively', () => {
    expect(ids('masshealth')).toEqual(['prog:40000500']);
    expect(ids('SECONDARY')).toEqual(['prog:15962450']);
    expect(ids('environmental')).toEqual(['prog:28100100', 'prog:other:EEA/DFG']);
  });
  it('requires every term', () => {
    expect(ids('environmental parks')).toEqual(['prog:28100100']);
    expect(ids('environmental nothing')).toEqual([]);
  });
  it('matches account numbers', () => {
    expect(ids('1599')).toEqual(['prog:15992625']);
  });
  it('ignores accents', () => {
    expect(ids('opportunité')).toEqual([]);
    expect(ids('Opportunity')).toEqual(['prog:15962450']);
  });
  it('limits to highlighted rows', () => {
    expect(ids('', true)).toEqual(['prog:28100100', 'prog:other:EEA/DFG']);
    expect(ids('parks', true)).toEqual(['prog:28100100']);
  });
});

describe('sortRows', () => {
  const rows = toChangeRows(RAW, 'enacted');
  const ids = (k: Parameters<typeof sortRows>[1], d: Parameters<typeof sortRows>[2]) => sortRows(rows, k, d).map((r) => r.name);
  it('sorts by |$ change| descending by default', () => {
    expect(ids('abs', 'desc')).toEqual([
      'Family shelter reserve', // −80
      'MassHealth managed care', // +50
      'Student Opportunity Act', // +40
      'State parks operations', // −5
      'Other Fisheries & Wildlife', // +2
    ]);
    expect(ids('abs', 'asc')[0]).toBe('Other Fisheries & Wildlife');
  });
  it('sorts by signed % change with new rows last either way', () => {
    expect(ids('pct', 'desc')).toEqual([
      'MassHealth managed care', // +50%
      'Other Fisheries & Wildlife', // +20%
      'State parks operations', // −10%
      'Family shelter reserve', // −100%
      'Student Opportunity Act', // new
    ]);
    expect(ids('pct', 'asc')).toEqual([
      'Family shelter reserve',
      'State parks operations',
      'Other Fisheries & Wildlife',
      'MassHealth managed care',
      'Student Opportunity Act',
    ]);
  });
  it('sorts by name', () => {
    expect(ids('name', 'asc')[0]).toBe('Family shelter reserve');
    expect(ids('name', 'desc')[0]).toBe('Student Opportunity Act');
  });
  it('does not mutate its input', () => {
    const before = rows.map((r) => r.id);
    sortRows(rows, 'name', 'asc');
    expect(rows.map((r) => r.id)).toEqual(before);
  });
});

describe('summarize / maxAbsDelta', () => {
  const rows = toChangeRows(RAW, 'enacted');
  it('totals and counts', () => {
    const s = summarize(rows);
    expect(s.a).toBe(240);
    expect(s.b).toBe(247);
    expect(s.delta).toBe(7);
    expect(s.pct).toBeCloseTo(7 / 240);
    expect([s.up, s.down, s.new, s.ended, s.count]).toEqual([2, 1, 1, 1, 5]);
  });
  it('handles an empty set', () => {
    expect(summarize([])).toMatchObject({ a: 0, b: 0, delta: 0, pct: null, count: 0 });
    expect(maxAbsDelta([])).toBe(0);
  });
  it('finds the largest |change|', () => {
    expect(maxAbsDelta(rows)).toBe(80);
  });
});

describe('resolvePair', () => {
  const Y = [2024, 2025, 2026, 2027];
  it('defaults to the selected year and the one before', () => {
    expect(resolvePair(Y, 2026, null, null)).toEqual({ from: 2025, to: 2026 });
    expect(resolvePair(Y, 2027, null, null)).toEqual({ from: 2026, to: 2027 });
  });
  it('compares FY24 with FY25 when FY24 is selected', () => {
    expect(resolvePair(Y, 2024, null, null)).toEqual({ from: 2024, to: 2025 });
  });
  it('keeps a valid URL pair', () => {
    expect(resolvePair(Y, 2026, '2024', '2027')).toEqual({ from: 2024, to: 2027 });
  });
  it('repairs invalid pairs', () => {
    expect(resolvePair(Y, 2026, '2026', '2025')).toEqual({ from: 2025, to: 2026 });
    expect(resolvePair(Y, 2026, 'x', '2027')).toEqual({ from: 2026, to: 2027 });
    expect(resolvePair(Y, 2026, '2024', '2031')).toEqual({ from: 2024, to: 2025 });
  });
});

describe('socrataPairUrl', () => {
  it('queries one account in both years', () => {
    const url = socrataPairUrl({ id: 'kv7m-35wn', name: '', url: '', pulled: '' }, 2025, 2026, '40000500');
    const q = new URL(url).searchParams;
    expect(url.startsWith('https://cthru.data.socrata.com/resource/kv7m-35wn.json?')).toBe(true);
    expect(q.get('$where')).toBe("appropriation_account_number='40000500' AND fiscal_year in(2025,2026)");
  });
});
