/**
 * DEV-ONLY FIXTURE. Illustrative numbers shaped like the data contract so the UI
 * can be built before /data exists. Used only when a real /data file 404s in dev.
 * Not real budget figures.
 */
import type { Flows, FlowLink, FlowNode, Measure, Meta, TreeNode } from '../lib/types';

const YEAR = 2027;
const B = 1e9;

type Sec = {
  key: string;
  name: string;
  enacted: number;
  conservation?: true;
  programs: { code: string; name: string; dept: string; share: number; conservation?: true }[];
};

// Enacted amounts. Programs list a share of their secretariat; the rest is "Other".
const SECS: Sec[] = [
  {
    key: 'EHS',
    name: 'Health & Human Services',
    enacted: 27.4 * B,
    programs: [
      { code: '40000500', name: 'MassHealth managed care', dept: 'MassHealth', share: 0.36 },
      { code: '40000700', name: 'MassHealth fee-for-service', dept: 'MassHealth', share: 0.14 },
      { code: '40000601', name: 'Senior care options', dept: 'MassHealth', share: 0.1 },
      { code: '50110100', name: 'Adult mental health services', dept: 'Mental Health', share: 0.04 },
      { code: '59200030', name: 'Developmental services, residential', dept: 'Developmental Services', share: 0.06 },
      { code: '44011000', name: 'Employment services program', dept: 'Transitional Assistance', share: 0.02 },
    ],
  },
  {
    key: 'CTR',
    name: 'Statewide obligations',
    enacted: 9.6 * B,
    programs: [
      { code: '06110100', name: 'Local aid (UGGA)', dept: 'Local aid', share: 0.14 },
      { code: '06123010', name: 'State retiree benefits', dept: 'Pensions', share: 0.42 },
      { code: '06990015', name: 'Debt service', dept: 'Debt service', share: 0.33 },
    ],
  },
  {
    key: 'EDU',
    name: 'Education',
    enacted: 10.4 * B,
    programs: [
      { code: '70610008', name: 'Chapter 70 school aid', dept: 'Elementary & Secondary Ed.', share: 0.67 },
      { code: '71000200', name: 'University of Massachusetts', dept: 'Higher Education', share: 0.08 },
      { code: '70610012', name: 'Special education circuit breaker', dept: 'Elementary & Secondary Ed.', share: 0.06 },
      { code: '30000300', name: 'Early education and care', dept: 'Early Education & Care', share: 0.05 },
    ],
  },
  {
    key: 'ANF',
    name: 'Administration & Finance',
    enacted: 4.2 * B,
    programs: [
      { code: '17504000', name: 'Group insurance premiums', dept: 'Group Insurance', share: 0.62 },
      { code: '11023299', name: 'State building operations', dept: 'Capital Asset Mgmt.', share: 0.05 },
    ],
  },
  {
    key: 'DOT',
    name: 'Transportation',
    enacted: 3.1 * B,
    programs: [
      { code: '15959005', name: 'MBTA state assistance', dept: 'MassDOT', share: 0.42 },
      { code: '15959010', name: 'Commonwealth Transportation Fund transfer', dept: 'MassDOT', share: 0.33 },
    ],
  },
  {
    key: 'EOPSS',
    name: 'Public Safety',
    enacted: 2.3 * B,
    programs: [
      { code: '89000100', name: 'State prisons', dept: 'Correction', share: 0.38 },
      { code: '81000100', name: 'State Police operations', dept: 'State Police', share: 0.22 },
    ],
  },
  {
    key: 'HLC',
    name: 'Housing & Livable Communities',
    enacted: 1.9 * B,
    programs: [
      { code: '70040101', name: 'Emergency family shelter', dept: 'Housing', share: 0.45 },
      { code: '70049024', name: 'Rental vouchers (MRVP)', dept: 'Housing', share: 0.11 },
    ],
  },
  {
    key: 'EEA',
    name: 'Energy & Environmental Affairs',
    enacted: 0.78 * B,
    conservation: true,
    programs: [
      { code: '28100100', name: 'State parks and recreation', dept: 'Conservation & Recreation', share: 0.14, conservation: true },
      { code: '23100200', name: 'Fisheries and wildlife', dept: 'Fisheries & Wildlife', share: 0.05, conservation: true },
      { code: '22000100', name: 'Environmental protection', dept: 'Environmental Protection', share: 0.06, conservation: true },
      { code: '25110100', name: 'Agricultural resources', dept: 'Agricultural Resources', share: 0.04, conservation: true },
    ],
  },
];

// Budgeted-fund revenue by group (collected), enacted-year scale.
const REVENUE: [string, string, number][] = [
  ['rev:income', 'Income tax', 22.1 * B],
  ['rev:sales', 'Sales & use tax', 9.3 * B],
  ['rev:corporate', 'Corporate tax', 4.6 * B],
  ['rev:othertax', 'Other taxes', 3.1 * B],
  ['rev:federal', 'Federal reimbursements', 17.2 * B],
  ['rev:fees', 'Fees & departmental', 6.4 * B],
  ['rev:transfers', 'Transfers & other', 7.9 * B],
];

/** FY27 in progress: spending through early November ≈ 36% of enacted. */
const SPENT_SO_FAR = 0.364;
const COLLECTED_SO_FAR = 0.34;

function round(n: number) {
  return Math.round(n);
}

function buildFlows(measure: Measure): Flows {
  const scale = measure === 'actual' ? SPENT_SO_FAR : 1;
  const revScale = measure === 'actual' ? COLLECTED_SO_FAR : 1;
  const nodes: FlowNode[] = [];
  const links: FlowLink[] = [];

  const revTotal = REVENUE.reduce((s, r) => s + r[2] * revScale, 0);
  const secValues = SECS.map((s) => s.enacted * scale);
  const spendingTotal = secValues.reduce((a, b) => a + b, 0);

  for (const [id, name, v] of REVENUE) {
    nodes.push({ id, name, kind: 'revenue', value: round(v * revScale) });
  }
  SECS.forEach((s, i) => {
    const secId = `sec:${s.key}`;
    const secValue = secValues[i] ?? 0;
    nodes.push({ id: secId, name: s.name, kind: 'secretariat', value: round(secValue), ...(s.conservation ? { conservation: true } : {}) });
    for (const [rid, , rv] of REVENUE) {
      links.push({ source: rid, target: secId, value: round(secValue * ((rv * revScale) / revTotal)), proportional: true });
    }
    let used = 0;
    for (const p of s.programs) {
      const v = secValue * p.share;
      used += v;
      const id = `prog:${p.code}`;
      nodes.push({ id, name: p.name, kind: 'program', value: round(v), parent: secId, ...(p.conservation ? { conservation: true } : {}) });
      links.push({ source: secId, target: id, value: round(v) });
    }
    const rest = secValue - used;
    const oid = `prog:other:${s.key}`;
    nodes.push({ id: oid, name: `Other ${s.name}`, kind: 'program', value: round(rest), parent: secId, ...(s.conservation ? { conservation: true } : {}) });
    links.push({ source: secId, target: oid, value: round(rest) });
  });

  return { nodes, links, revenueTotal: round(revTotal), spendingTotal: round(spendingTotal), measure };
}

function buildTree(): TreeNode {
  const children: TreeNode[] = SECS.map((s) => {
    const depts = new Map<string, TreeNode>();
    let used = 0;
    for (const p of s.programs) {
      const enacted = s.enacted * p.share;
      used += enacted;
      const dKey = `dept:${s.key}/${p.dept}`;
      const dept = depts.get(dKey) ?? { id: dKey, name: p.dept, enacted: 0, gaa: 0, actual: 0, children: [] };
      dept.enacted += enacted;
      dept.gaa += enacted * 0.97;
      dept.actual += enacted * SPENT_SO_FAR;
      dept.children!.push({ id: `prog:${p.code}`, name: p.name, code: p.code, enacted, gaa: enacted * 0.97, actual: enacted * SPENT_SO_FAR, ...(p.conservation ? { conservation: true } : {}) });
      depts.set(dKey, dept);
    }
    const rest = s.enacted - used;
    const other: TreeNode = { id: `prog:other:${s.key}`, name: `Other ${s.name}`, other: true, enacted: rest, gaa: rest * 0.97, actual: rest * SPENT_SO_FAR };
    return {
      id: `sec:${s.key}`,
      name: s.name,
      enacted: s.enacted,
      gaa: s.enacted * 0.97,
      actual: s.enacted * SPENT_SO_FAR,
      ...(s.conservation ? { conservation: true as const } : {}),
      children: [...depts.values(), other],
    };
  });
  const sum = (k: 'enacted' | 'gaa' | 'actual') => children.reduce((a, c) => a + c[k], 0);
  return { id: 'root', name: 'Massachusetts state budget', enacted: sum('enacted'), gaa: sum('gaa'), actual: sum('actual'), children };
}

export const fixtureMeta: Meta = {
  generated: '2026-11-03T00:00:00Z',
  years: [YEAR],
  partial: { [String(YEAR)]: { through: '2026-11-03', label: 'in progress', revenueThrough: '2026-09-30' } },
  revenueGroups: REVENUE.map(([id, name]) => ({ id, name })),
  sources: {
    spending: {
      id: 'kv7m-35wn',
      name: 'CTHRU Budget-to-Actual',
      url: 'https://cthru.data.socrata.com/d/kv7m-35wn',
      api: 'https://cthru.data.socrata.com/resource/kv7m-35wn.json',
      pulled: '2026-11-03',
    },
    revenue: {
      id: 'kcy7-ivxi',
      name: 'CTHRU Commonwealth Revenue Collections',
      url: 'https://cthru.data.socrata.com/d/kcy7-ivxi',
      pulled: '2026-11-03',
    },
  },
  totals: {
    [String(YEAR)]: {
      enacted: SECS.reduce((a, s) => a + s.enacted, 0),
      gaa: SECS.reduce((a, s) => a + s.enacted * 0.97, 0),
      actual: SECS.reduce((a, s) => a + s.enacted * SPENT_SO_FAR, 0),
      revenue: REVENUE.reduce((a, r) => a + r[2] * COLLECTED_SO_FAR, 0),
    },
  },
};

export function fixtureFlows(measure: Measure): Flows {
  return buildFlows(measure);
}
export function fixtureTree(): TreeNode {
  return buildTree();
}
