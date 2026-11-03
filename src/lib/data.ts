import type { Flows, Measure, Meta, SourceInfo, TreeNode } from './types';

export class DataMissingError extends Error {
  constructor(public url: string) {
    super(`Data file not found: ${url}`);
  }
}

const cache = new Map<string, Promise<unknown>>();

/** Set when meta.json itself came from the dev fixture. */
let fixtureMode = false;
export function usingFixture(): boolean {
  return fixtureMode;
}

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { headers: { Accept: 'application/json' } });
  const type = res.headers.get('content-type') ?? '';
  // A static host may answer a missing file with the SPA's index.html (200, text/html).
  if (res.status === 404 || !res.ok || type.includes('text/html')) {
    throw new DataMissingError(url);
  }
  return (await res.json()) as T;
}

/**
 * Fetch a /data file once. In dev, if it's missing, fall back to the bundled
 * fixture (loaded lazily, so it never ships in a production chunk on the hot path).
 */
function load<T>(url: string, fixture: () => Promise<T>, isMeta = false): Promise<T> {
  const hit = cache.get(url);
  if (hit) return hit as Promise<T>;
  const p = fetchJson<T>(url).catch(async (err: unknown) => {
    // Only mix in fixture data when there is no real data at all, so a real
    // meta.json is never paired with made-up flows.
    if (import.meta.env.DEV && err instanceof DataMissingError && (isMeta || fixtureMode)) {
      if (isMeta) fixtureMode = true;
      console.warn(`[open-ledger] ${url} not found — using the DEV fixture (illustrative numbers, not real data).`);
      return fixture();
    }
    cache.delete(url);
    throw err;
  });
  cache.set(url, p);
  return p;
}

export const dataUrl = {
  meta: () => '/data/meta.json',
  tree: (year: number) => `/data/fy${year}/tree.json`,
  flows: (year: number, measure: Measure) =>
    measure === 'enacted' ? `/data/fy${year}/flows_enacted.json` : `/data/fy${year}/flows.json`,
};

export function loadMeta(): Promise<Meta> {
  return load(dataUrl.meta(), async () => (await import('../fixtures')).fixtureMeta, true);
}

export function loadTree(year: number): Promise<TreeNode> {
  return load(dataUrl.tree(year), async () => (await import('../fixtures')).fixtureTree());
}

export function loadFlows(year: number, measure: Measure): Promise<Flows> {
  return load(dataUrl.flows(year, measure), async () =>
    (await import('../fixtures')).fixtureFlows(measure),
  );
}

/** True when the year is still open (FY in progress). */
export function isPartial(meta: Meta, year: number): boolean {
  return Boolean(meta.partial?.[String(year)]);
}

/** Latest closed year, else the latest year. */
export function defaultYear(meta: Meta): number {
  const years = [...meta.years].sort((a, b) => a - b);
  const closed = years.filter((y) => !isPartial(meta, y));
  return closed.at(-1) ?? years.at(-1) ?? new Date().getFullYear();
}

export const SOCRATA_PAGE = 'https://cthru.data.socrata.com/d/kv7m-35wn';

/** Socrata row query for a year (and optionally one appropriation account). */
export function socrataRowsUrl(source: SourceInfo, year: number, account?: string): string {
  const base = source.api ?? `https://cthru.data.socrata.com/resource/${source.id}.json`;
  const q = new URLSearchParams({ fiscal_year: String(year) });
  if (account) q.set('appropriation_account_number', account);
  return `${base}?${q.toString()}`;
}

/** "prog:40000500" → "40000500"; synthetic buckets have no account. */
export function accountOf(programId: string): string | null {
  const m = /^prog:(\d{6,})$/.exec(programId);
  return m ? (m[1] ?? null) : null;
}
