import type { DiffRow, Measure, SourceInfo } from './types';

/**
 * Year-over-year program changes, from data/diff/fy{A}_fy{B}.json
 * (docs/DATA_CONTRACT.md "Files" and "Changes" item 8). Types live in types.ts
 * and the loader (`loadDiff`) in data.ts, which share the fetch cache.
 */

/**
 * A valid (from, to) pair for the loaded years, from < to.
 * Defaults: To = the selected year (the second year when the first is selected),
 * From = the year before To. A single valid URL side is kept.
 */
export function resolvePair(
  years: number[],
  selected: number,
  fromRaw: string | null,
  toRaw: string | null,
): { from: number; to: number } {
  const ys = [...years].sort((x, y) => x - y);
  const first = ys[0] ?? selected;
  const last = ys.at(-1) ?? selected;
  const prevOf = (y: number) => ys.filter((v) => v < y).at(-1) ?? first;
  const nextOf = (y: number) => ys.find((v) => v > y) ?? last;
  const from = fromRaw === null ? NaN : Number(fromRaw);
  const to = toRaw === null ? NaN : Number(toRaw);
  const okFrom = ys.includes(from) && from < last;
  const okTo = ys.includes(to) && to > first;
  if (okFrom && okTo && from < to) return { from, to };
  if (okTo && !okFrom) return { from: prevOf(to), to };
  if (okFrom && !okTo) return { from, to: nextOf(from) };
  const defTo = selected <= first ? nextOf(first) : ys.includes(selected) ? selected : last;
  return { from: prevOf(defTo), to: defTo };
}

export type ChangeStatus = 'up' | 'down' | 'new' | 'ended' | 'flat';

/** One row reduced to the active measure. `pct` is a ratio (0.019 = 1.9%). */
export type ChangeRow = {
  id: string;
  name: string;
  path: string;
  sec: string;
  dept: string;
  account: string | null;
  a: number;
  b: number;
  delta: number;
  pct: number | null;
  status: ChangeStatus;
  bucket: boolean;
  /** For a bucket: how many line items it combines, when the data file says. */
  accounts: number | null;
  /** This program's id plus any secretariat/department ids derivable from it. */
  nodeIds: string[];
  /** In the current highlight set (see `isHighlighted`). */
  highlighted: boolean;
  /** Folded search haystack: name, secretariat, department, account. */
  haystack: string;
};

const fold = (s: string) =>
  s
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();

export function statusOf(a: number, b: number): ChangeStatus {
  if (a === 0 && b !== 0) return 'new';
  if (a !== 0 && b === 0) return 'ended';
  if (b > a) return 'up';
  if (b < a) return 'down';
  return 'flat';
}

export function isBucket(id: string): boolean {
  return id.startsWith('prog:other:');
}

const ACCOUNT_ID = /^prog:(\d{6,})$/;
const BUCKET_ID = /^prog:other:([^/]+)(?:\/(.+))?$/;

/**
 * Node ids a row belongs to: its own id plus its secretariat and department
 * (from the row's secId/deptId, or parsed from an "Other" bucket id
 * prog:other:{SEC}/{DEPT} when a file predates those fields).
 */
export function nodeIdsOf(row: Pick<DiffRow, 'id' | 'secId' | 'deptId'>): string[] {
  const out = [row.id];
  const m = row.id.match(BUCKET_ID);
  const sec = row.secId ?? (m ? `sec:${m[1]}` : undefined);
  const dept = row.deptId ?? (m && m[2] ? `dept:${m[1]}/${m[2]}` : undefined);
  if (sec) out.push(sec);
  if (dept) out.push(dept);
  return out;
}

/** A row is highlighted when its id, secretariat or department is in the set. */
export function isHighlighted(nodeIds: readonly string[], highlight: ReadonlySet<string>): boolean {
  return highlight.size > 0 && nodeIds.some((id) => highlight.has(id));
}

/** Rows for one measure. Programs at $0 in both years drop out. */
export function toChangeRows(rows: DiffRow[], measure: Measure, highlight: ReadonlySet<string> = new Set()): ChangeRow[] {
  const out: ChangeRow[] = [];
  for (const r of rows) {
    const a = measure === 'enacted' ? r.enactedA : r.actualA;
    const b = measure === 'enacted' ? r.enactedB : r.actualB;
    if (a === 0 && b === 0) continue;
    const [sec = '', dept = ''] = r.path.split(' › ');
    const bucket = isBucket(r.id);
    const nodeIds = nodeIdsOf(r);
    const account = bucket ? null : (r.code ?? r.id.match(ACCOUNT_ID)?.[1] ?? null);
    out.push({
      id: r.id,
      name: r.name,
      path: r.path,
      sec,
      dept,
      account,
      a,
      b,
      delta: b - a,
      pct: a === 0 ? null : (b - a) / Math.abs(a),
      status: statusOf(a, b),
      bucket,
      accounts: bucket ? (r.accounts ?? null) : null,
      nodeIds,
      highlighted: isHighlighted(nodeIds, highlight),
      haystack: fold(`${r.name} ${sec} ${dept} ${account ?? ''}`),
    });
  }
  return out;
}

/** Every whitespace-separated term must appear in name, department, secretariat or account. Optionally highlighted rows only. */
export function filterRows(rows: ChangeRow[], query: string, highlightedOnly = false): ChangeRow[] {
  const terms = fold(query).split(/\s+/).filter(Boolean);
  return rows.filter((r) => (!highlightedOnly || r.highlighted) && terms.every((t) => r.haystack.includes(t)));
}

export type SortKey = 'abs' | 'pct' | 'name';
export type SortDir = 'desc' | 'asc';

export const DEFAULT_DIR: Record<SortKey, SortDir> = { abs: 'desc', pct: 'desc', name: 'asc' };

const byName = (x: ChangeRow, y: ChangeRow) => x.name.localeCompare(y.name, 'en', { sensitivity: 'base' });

/**
 * `abs` sorts by |$ change|; `pct` by signed % change, with "new" rows (no %)
 * always last, largest first; `name` alphabetically. Ties fall back to name.
 */
export function sortRows(rows: ChangeRow[], key: SortKey, dir: SortDir): ChangeRow[] {
  const sign = dir === 'asc' ? 1 : -1;
  return [...rows].sort((x, y) => {
    if (key === 'name') return sign * byName(x, y);
    if (key === 'pct') {
      if (x.pct === null && y.pct === null) return Math.abs(y.delta) - Math.abs(x.delta) || byName(x, y);
      if (x.pct === null) return 1;
      if (y.pct === null) return -1;
      return sign * (x.pct - y.pct) || byName(x, y);
    }
    return sign * (Math.abs(x.delta) - Math.abs(y.delta)) || byName(x, y);
  });
}

export type ChangeSummary = {
  a: number;
  b: number;
  delta: number;
  pct: number | null;
  up: number;
  down: number;
  new: number;
  ended: number;
  count: number;
};

export function summarize(rows: ChangeRow[]): ChangeSummary {
  const s: ChangeSummary = { a: 0, b: 0, delta: 0, pct: null, up: 0, down: 0, new: 0, ended: 0, count: rows.length };
  for (const r of rows) {
    s.a += r.a;
    s.b += r.b;
    if (r.status !== 'flat') s[r.status] += 1;
  }
  s.delta = s.b - s.a;
  s.pct = s.a === 0 ? null : s.delta / Math.abs(s.a);
  return s;
}

/** Largest |change| in a set: the bar scale's domain. */
export function maxAbsDelta(rows: ChangeRow[]): number {
  let m = 0;
  for (const r of rows) m = Math.max(m, Math.abs(r.delta));
  return m;
}

/** Socrata rows for one account in both years of the pair. */
export function socrataPairUrl(source: SourceInfo, a: number, b: number, account: string): string {
  const base = source.api ?? `https://cthru.data.socrata.com/resource/${source.id}.json`;
  const q = new URLSearchParams({
    $where: `appropriation_account_number='${account.replace(/\D/g, '')}' AND fiscal_year in(${a},${b})`,
    $order: 'fiscal_year',
  });
  return `${base}?${q.toString()}`;
}

/** Socrata rows for both years (no account filter). */
export function socrataYearsUrl(source: SourceInfo, a: number, b: number): string {
  const base = source.api ?? `https://cthru.data.socrata.com/resource/${source.id}.json`;
  return `${base}?${new URLSearchParams({ $where: `fiscal_year in(${a},${b})` }).toString()}`;
}
