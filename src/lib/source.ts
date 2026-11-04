/**
 * The in-site "Source rows" page: paths to it, and live Socrata queries behind it.
 * The page reads the same CTHRU rows the ETL pulled, straight from the state's API.
 */
import type { SourceInfo } from './types';

export type SourceDataset = 'spending' | 'revenue';

export type SourceQuery = {
  ds: SourceDataset;
  years: number[];
  account?: string | null;
  page?: number;
};

/** In-site path for a source-rows view, e.g. /source?ds=spending&fy=2026&acct=40000500. */
export function sourcePath({ ds, years, account, page }: SourceQuery): string {
  const q = new URLSearchParams({ ds, fy: years.join(',') });
  if (account) q.set('acct', account.replace(/\D/g, ''));
  if (page && page > 1) q.set('page', String(page));
  return `/source?${q.toString()}`;
}

export function parseSourceQuery(params: URLSearchParams): SourceQuery | null {
  const ds = params.get('ds') === 'revenue' ? 'revenue' : 'spending';
  const years = (params.get('fy') ?? '')
    .split(',')
    .map((s) => Number(s))
    .filter((n) => Number.isInteger(n) && n > 2000 && n < 2100)
    .slice(0, 2);
  if (!years.length) return null;
  const account = (params.get('acct') ?? '').replace(/\D/g, '') || null;
  const page = Math.max(1, Number(params.get('page')) || 1);
  return { ds, years, account, page };
}

const apiBase = (s: SourceInfo) => s.api ?? `https://cthru.data.socrata.com/resource/${s.id}.json`;
const yearsWhere = (years: number[]) => (years.length === 1 ? `fiscal_year=${years[0]}` : `fiscal_year in(${years.join(',')})`);

export const PAGE_SIZE = 50;

/** Socrata URL for a view: every field of an account's rows, or a ranked page of a year. */
export function sourceApiUrl(source: SourceInfo, q: SourceQuery, revenueFilter?: string): string {
  const p = new URLSearchParams();
  const offset = String(((q.page ?? 1) - 1) * PAGE_SIZE);
  if (q.ds === 'spending' && q.account) {
    p.set('$where', `appropriation_account_number='${q.account}' AND ${yearsWhere(q.years)}`);
    p.set('$order', 'fiscal_year, fund_number');
  } else if (q.ds === 'spending') {
    p.set('$select', 'fiscal_year,appropriation_account_number,appropriation_account_name,department_name,total_enacted_budget_appropriation,total_expenses');
    p.set('$where', yearsWhere(q.years));
    p.set('$order', 'total_expenses DESC');
    p.set('$limit', String(PAGE_SIZE));
    p.set('$offset', offset);
  } else {
    // Revenue rows are monthly transactions; group them by source so a page is readable.
    p.set('$select', 'revenue_category_name,revenue_source_name,sum(revenue_collected) as collected');
    p.set('$where', [yearsWhere(q.years), revenueFilter].filter(Boolean).join(' AND '));
    p.set('$group', 'revenue_category_name,revenue_source_name');
    p.set('$order', 'collected DESC');
    p.set('$limit', String(PAGE_SIZE));
    p.set('$offset', offset);
  }
  return `${apiBase(source)}?${p.toString()}`;
}

/**
 * Spending fields in reading order, with plain-English labels. `use` marks the
 * two columns the site turns into its Enacted and Spent figures.
 */
export const SPENDING_FIELDS: { key: string; label: string; money?: true; use?: 'Enacted' | 'Spent' }[] = [
  { key: 'fiscal_year', label: 'Fiscal year' },
  { key: 'fund_name', label: 'Fund' },
  { key: 'cabinet_secretariat_name', label: 'Secretariat (spending area)' },
  { key: 'department_name', label: 'Department' },
  { key: 'appropriation_account_number', label: 'Account number' },
  { key: 'appropriation_account_name', label: 'Account name' },
  { key: 'appropriation_class_name', label: 'Account type' },
  { key: 'beginning_balance_prior_appropriation_continued', label: 'Carried in from last year', money: true },
  { key: 'original_enacted_budget', label: 'Original budget (as signed)', money: true },
  { key: 'supplemental_budget_appropriations', label: 'Added by supplemental budgets', money: true },
  { key: 'transfer_in', label: 'Transferred in', money: true },
  { key: 'transfer_out', label: 'Transferred out', money: true },
  { key: 'retained_revenue_collected', label: 'Retained revenue collected', money: true },
  { key: 'planned_saving_9c_cuts', label: 'Mid-year (9C) cuts', money: true },
  { key: 'total_enacted_budget_appropriation', label: 'Total enacted appropriation', money: true, use: 'Enacted' },
  { key: 'other_statutorily_authorized_spending', label: 'Other spending allowed by law', money: true },
  { key: 'total_available_for_spending', label: 'Total available to spend', money: true },
  { key: 'total_expenses', label: 'Total spent', money: true, use: 'Spent' },
  { key: 'balance_forward_prior_appropriation_continued', label: 'Carried forward to next year', money: true },
  { key: 'unexpended_reverted', label: 'Unspent, returned (negative: overspent)', money: true },
];

const dollars = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });

/** Full-precision dollars for the raw view: "$6,013,267,263". */
export function fullDollars(value: string | number | undefined): string {
  const n = Number(value);
  if (value === undefined || value === null || value === '' || !Number.isFinite(n)) return '—';
  return dollars.format(Math.round(n)).replace('-', '−');
}

/** "2026.0" → "2026". */
export function cleanYear(value: string | undefined): string {
  const n = Number(value);
  return Number.isFinite(n) ? String(Math.trunc(n)) : (value ?? '');
}

const SMALL = new Set(['a', 'an', 'and', 'as', 'at', 'by', 'for', 'in', 'of', 'on', 'or', 'the', 'to', 'with']);
const KEEP = new Set(['DCR', 'DMH', 'DDS', 'DCF', 'TANF', 'MBTA', 'UMASS', 'EOHHS', 'II', 'III', 'IV', 'K-12', 'US', 'MA']);

/** "REIMBURSEMENT OF SCHOOL AID TO CITIES," → "Reimbursement of School Aid to Cities". Mixed-case text is left alone. */
export function readableName(raw: string | undefined): string {
  const t = (raw ?? '').trim().replace(/[,;:]+$/, '');
  // Mostly upper case ("EXECUTIVE OFFICE OF HEALTH and HUMAN SERVICES") counts as all caps.
  const letters = t.replace(/[^\p{L}]/gu, '');
  const upper = letters.replace(/[^\p{Lu}]/gu, '').length;
  if (!letters.length || upper / letters.length < 0.8) return t;
  return t
    .toLowerCase()
    .split(/\s+/)
    .map((w, i) => {
      const up = w.toUpperCase();
      const core = up.replace(/^[("']+|[)"',.]+$/g, '');
      if (KEEP.has(core)) return up;
      if (i > 0 && SMALL.has(w)) return w;
      return w.replace(/^([("']?)(\p{L})/u, (_, p: string, c: string) => p + c.toUpperCase());
    })
    .join(' ');
}
