/** Shapes from docs/DATA_CONTRACT.md. Dollars are plain USD numbers. */

export type SourceInfo = {
  id: string;
  name: string;
  url: string;
  pulled: string;
  api?: string;
  rowsUpdatedAt?: string;
  filter?: string;
};

export type YearTotals = { enacted: number; gaa: number; actual: number; revenue: number };

export type Meta = {
  generated: string;
  years: number[];
  partial?: Record<string, { through: string; label: string; revenueThrough?: string }>;
  sources: { spending: SourceInfo; revenue: SourceInfo; capital?: SourceInfo };
  totals: Record<string, YearTotals>;
  revenueGroups?: { id: string; name: string }[];
  /** Bond-funded capital payments by year, outside every chart total (DATA_CONTRACT "capital"). */
  capital?: Record<string, CapitalYear>;
  /** Residents on July 1 at the start of each fiscal year (Census estimate), for per-resident figures. */
  population?: { source: string; byYear: Record<string, { residents: number; estimate: number }> };
  coverage?: Record<string, { mappedAccounts: number; otherAccounts: number; otherBuckets: number; mappedShareActual: number; mappedShareEnacted: number }>;
};

/** Chapter 70 school aid and unrestricted aid budgeted for one place in one year. */
export type TownAid = { ch70: number; ugga: number };

export type TownPlace = {
  /** Upper-case name as the state lists it: "ACTON BOXBOROUGH". */
  id: string;
  name: string;
  /** A city or town, or a regional school district (which gets school aid only). */
  kind: 'town' | 'district';
  /** Keyed by fiscal year; a year is absent when the place is not on that year's list. */
  aid: Record<string, TownAid>;
  /** Towns only: Census estimate of residents (Towns.residentsYear) and the town's county. */
  residents?: number;
  county?: string;
  /** A town: public school students who live there. A district: students enrolled in it. */
  students?: number;
  /** A town's regional districts, with how many of its students each enrolls as a member town. */
  districts?: { id: string; students: number }[];
  /** A district's member towns, with how many students each sends. */
  members?: { id: string; students: number }[];
};

/** data/towns.json: the budget's Section 3 local aid lists (DATA_CONTRACT "towns"). */
export type Towns = {
  years: number[];
  totals: Record<string, { towns: number; districts: number; ch70: number; ugga: number; townCh70: number; districtCh70: number }>;
  places: TownPlace[];
  /** July 1 of this year, for residents; absent when the estimates were not pulled. */
  residentsYear?: number;
  /** School year ending in this year (2026 is 2025–26), for students. */
  schoolYear?: number;
};

export type CapitalYear = {
  total: number;
  /** Keyed by secretariat id (sec:EEA); areas with no capital payments are absent. */
  bySec: Record<string, number>;
  /** Keyed by department id (dept:EEA/DCR). */
  byDept: Record<string, number>;
};

export type TreeNode = {
  id: string;
  name: string;
  raw?: string;
  code?: string;
  enacted: number;
  gaa: number;
  actual: number;
  other?: true;
  /** On a program: its page on budget.digital.mass.gov (wording, and the amount at each budget stage). */
  official?: string;
  /** On an "Other {Department}" bucket: how many line items it adds together. */
  accounts?: number;
  children?: TreeNode[];
};

export type FlowNodeKind = 'revenue' | 'secretariat' | 'program';

export type FlowNode = {
  id: string;
  name: string;
  kind: FlowNodeKind;
  value: number;
  parent?: string;
  other?: true;
};

export type FlowLink = { source: string; target: string; value: number; proportional?: true };

export type Measure = 'actual' | 'enacted';

export type Flows = {
  nodes: FlowNode[];
  links: FlowLink[];
  revenueTotal: number;
  spendingTotal: number;
  measure: Measure;
};

/** One program in data/diff/fy{A}_fy{B}.json (docs/DATA_CONTRACT.md "Changes"). */
export type DiffRow = {
  id: string;
  name: string;
  /** "Secretariat › Department" */
  path: string;
  /** Secretariat and department node ids, as in tree.json ("sec:EHS", "dept:EHS/DMH"). */
  secId?: string;
  deptId?: string;
  code?: string;
  /** On an "Other {Department}" row: how many line items it combines. */
  accounts?: number;
  enactedA: number;
  enactedB: number;
  actualA: number;
  actualB: number;
  dEnacted: number;
  dActual: number;
  /** Percent units (1.9 = 1.9%); null when the A value is 0. */
  pctEnacted: number | null;
  pctActual: number | null;
};

export type DiffFile = { a: number; b: number; rows: DiffRow[] };
